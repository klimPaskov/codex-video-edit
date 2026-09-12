import { CodexTransportError } from "./transport.ts";
import type { ServerRequest } from "./transport.ts";
import { CodexThreadProtocolError } from "./thread-protocol.ts";
import type { ThreadRuntimePolicy, TurnStartInput } from "./thread-protocol.ts";
import type { ProjectThreadRegistry } from "./thread-registry.ts";
import { ProjectThreadRuntime } from "./thread-runtime.ts";
import type {
  ThreadHistorySnapshot,
  ThreadStreamEvent,
} from "./thread-stream.ts";

const MAX_BUFFERED_NOTIFICATIONS = 64;
const MAX_BUFFERED_NOTIFICATION_BYTES = 256 * 1024;

export interface ThreadRpc {
  request(method: string, params: unknown): Promise<unknown>;
}

export interface CodexProjectThreadClientOptions {
  rpc: ThreadRpc;
  generation: number;
  projectId: string;
  policy: ThreadRuntimePolicy;
  registry: ProjectThreadRegistry;
  allowedMcpServer: string;
  allowedMcpTools: ReadonlySet<string>;
  onEvent?: (event: ThreadStreamEvent) => void;
  onHistory?: (history: ThreadHistorySnapshot) => void;
  onPolicyViolation?: () => void;
  clientMessageId?: () => string;
}

type BufferedNotification = { method: string; params: unknown };

function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.getOwnPropertySymbols(value).length === 0
  );
}

function bufferedSize(method: string, params: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify({ method, params }));
  } catch {
    throw new CodexThreadProtocolError("protocol");
  }
}

/**
 * Typed project conversation client. It serializes lifecycle RPCs and buffers the
 * notifications that can race their responses before handing them to the reducer.
 */
export class CodexProjectThreadClient {
  private readonly options: CodexProjectThreadClientOptions;
  private readonly runtime: ProjectThreadRuntime;
  private opened = false;
  private inFlight = false;
  private quarantined = false;
  private pending: BufferedNotification[] = [];

  constructor(options: CodexProjectThreadClientOptions) {
    this.options = {
      ...options,
      policy: { ...options.policy },
      allowedMcpTools: new Set(options.allowedMcpTools),
    };
    this.runtime = new ProjectThreadRuntime({
      experimentalApiNegotiated: true,
      generation: options.generation,
      projectId: options.projectId,
      policy: options.policy,
      registry: options.registry,
      allowedMcpServer: options.allowedMcpServer,
      allowedMcpTools: options.allowedMcpTools,
      ...(options.clientMessageId
        ? { clientMessageId: options.clientMessageId }
        : {}),
    });
  }

  async open(): Promise<void> {
    this.begin(false);
    try {
      const request = await this.runtime.openThreadRequest();
      const response = await this.options.rpc.request(
        request.method,
        request.params,
      );
      const resumed = request.method === "thread/resume",
        inlineHistory = await this.runtime.acceptThreadResponse(
          response,
          resumed,
        );
      if (resumed) {
        const inline = inlineHistory !== null;
        const history = this.runtime.acceptHistoryPage(
          inlineHistory ??
            (await this.options.rpc.request(
              "thread/turns/list",
              await this.runtime.historyRequest(),
            )),
          inline,
        );
        this.options.onHistory?.(structuredClone(history));
      }
      this.opened = true;
      this.flush();
    } catch (error) {
      this.pending = [];
      if (error instanceof CodexThreadProtocolError) this.quarantine();
      throw error;
    } finally {
      this.inFlight = false;
    }
  }

  async startTurn(input: TurnStartInput): Promise<void> {
    this.begin(true);
    let requestBuilt = false;
    try {
      const request = await this.runtime.turnStartRequest(input);
      requestBuilt = true;
      const response = await this.options.rpc.request("turn/start", request);
      this.emit(this.runtime.acceptTurnStartResponse(response));
      this.flush();
    } catch (error) {
      this.pending = [];
      if (
        requestBuilt &&
        error instanceof CodexTransportError &&
        error.code === "remote_error"
      ) {
        this.runtime.rejectTurnStart();
      } else if (requestBuilt) {
        this.emit(this.runtime.disconnect());
        this.opened = false;
      }
      throw error;
    } finally {
      this.inFlight = false;
    }
  }

  async interrupt(): Promise<void> {
    this.begin(true);
    let requestBuilt = false;
    try {
      const request = await this.runtime.interruptRequest();
      requestBuilt = true;
      const response = await this.options.rpc.request(
        "turn/interrupt",
        request,
      );
      this.runtime.acceptInterruptResponse(response);
      this.flush();
    } catch (error) {
      this.pending = [];
      if (
        requestBuilt &&
        (!(error instanceof CodexTransportError) ||
          error.code !== "remote_error")
      ) {
        this.emit(this.runtime.disconnect());
        this.opened = false;
      }
      throw error;
    } finally {
      this.inFlight = false;
    }
  }

  async close(): Promise<void> {
    if (this.quarantined || !this.opened) {
      this.pending = [];
      this.opened = false;
      return;
    }
    this.begin(true);
    try {
      const request = await this.runtime.unsubscribeRequest();
      const response = await this.options.rpc.request(
        "thread/unsubscribe",
        request,
      );
      this.runtime.acceptUnsubscribeResponse(response);
      this.pending = [];
      this.opened = false;
    } finally {
      this.inFlight = false;
    }
  }

  notification(method: string, params: unknown): void {
    if (this.quarantined) throw new CodexThreadProtocolError("forbidden");
    if (this.inFlight) {
      if (
        this.pending.length >= MAX_BUFFERED_NOTIFICATIONS ||
        bufferedSize(method, params) > MAX_BUFFERED_NOTIFICATION_BYTES
      ) {
        this.quarantine();
        throw new CodexThreadProtocolError("protocol");
      }
      this.pending.push({ method, params });
      return;
    }
    if (!this.opened) throw new CodexThreadProtocolError("configuration");
    this.emit(this.runtime.notification(method, params));
  }

  serverRequest(request: ServerRequest): unknown {
    if (this.quarantined || !this.opened || request.signal.aborted) {
      throw new CodexThreadProtocolError("forbidden");
    }
    const { method, params } = request;
    if (
      method === "item/commandExecution/requestApproval" ||
      method === "item/fileChange/requestApproval"
    ) {
      this.runtime.assertActiveCorrelation(params, true);
      this.quarantine();
      return { decision: "decline" };
    }
    if (method === "mcpServer/elicitation/request") {
      if (
        !record(params) ||
        params.serverName !== this.options.allowedMcpServer
      ) {
        this.quarantine();
        throw new CodexThreadProtocolError("forbidden");
      }
      this.runtime.assertActiveCorrelation(
        { threadId: params.threadId, turnId: params.turnId },
        false,
      );
      this.quarantine();
      return { action: "cancel", content: null, _meta: null };
    }
    if (method === "applyPatchApproval" || method === "execCommandApproval") {
      this.quarantine();
      return {
        decision: {
          denied: {
            rejection: "This editor does not allow command or file access.",
          },
        },
      };
    }
    this.quarantine();
    throw new CodexThreadProtocolError("forbidden");
  }

  disconnect(): void {
    this.pending = [];
    this.inFlight = false;
    if (this.opened) this.emit(this.runtime.disconnect());
    this.opened = false;
  }

  private begin(requireOpen: boolean): void {
    if (
      this.quarantined ||
      this.inFlight ||
      (requireOpen ? !this.opened : this.opened)
    ) {
      throw new CodexThreadProtocolError("configuration");
    }
    this.inFlight = true;
    this.pending = [];
  }

  private flush(): void {
    while (this.pending.length) {
      const notification = this.pending.shift()!;
      this.emit(
        this.runtime.notification(notification.method, notification.params),
      );
    }
  }

  private emit(event: ThreadStreamEvent | null): void {
    if (event) this.options.onEvent?.(structuredClone(event));
  }

  private quarantine(): void {
    if (this.quarantined) return;
    this.quarantined = true;
    this.options.onPolicyViolation?.();
  }
}
