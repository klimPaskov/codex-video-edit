import {
  buildExperimentalInitialize,
  buildThreadStartRequest,
  buildThreadUnsubscribeRequest,
  buildTurnInterruptRequest,
  buildTurnStartRequest,
  CodexThreadProtocolError,
  decodeThreadSession,
  decodeThreadUnsubscribe,
  decodeTurnInterrupt,
  decodeTurnStart,
  threadProtocolInternals,
  type ExperimentalInitializeRequest,
  type ThreadResumeRequest,
  type ThreadRuntimePolicy,
  type ThreadStartRequest,
  type ThreadUnsubscribeRequest,
  type TurnInterruptRequest,
  type TurnStartInput,
  type TurnStartRequest,
} from "./thread-protocol.ts";
import type { ProjectThreadRegistry } from "./thread-registry.ts";
import { ThreadStreamProjector } from "./thread-stream.ts";
import type { ThreadStreamEvent } from "./thread-stream.ts";

export interface ProjectThreadRuntimeOptions {
  /** Must come from the successful initialize negotiation for this connection. */
  experimentalApiNegotiated: boolean;
  generation: number;
  projectId: string;
  policy: ThreadRuntimePolicy;
  registry: ProjectThreadRegistry;
  allowedMcpServer: string;
  allowedMcpTools: ReadonlySet<string>;
  /** Main-owned id source; overridden only by deterministic tests. */
  clientMessageId?: () => string;
}

export type OpenThreadRequest =
  | { method: "thread/start"; params: ThreadStartRequest }
  | { method: "thread/resume"; params: ThreadResumeRequest };

/**
 * Main-owned thread state machine. Its public commands are project/user intent;
 * server thread and turn IDs only enter through validated responses or the registry.
 */
export class ProjectThreadRuntime {
  private readonly options: ProjectThreadRuntimeOptions;
  private projector: ThreadStreamProjector | undefined;
  private threadId: string | undefined;
  private currentTurnId: string | undefined;
  private turnStarting = false;
  private lastTerminalTurnId: string | undefined;
  private readonly clientMessageId: () => string;

  constructor(options: ProjectThreadRuntimeOptions) {
    if (options.experimentalApiNegotiated !== true) {
      throw new CodexThreadProtocolError("configuration");
    }
    this.options = {
      ...options,
      policy: { ...options.policy },
      allowedMcpTools: new Set(options.allowedMcpTools),
    };
    this.clientMessageId = options.clientMessageId ?? randomUUID;
    // Validate the complete no-environment thread policy at construction.
    buildThreadStartRequest(this.options.policy);
  }

  initializeRequest(applicationVersion: string): ExperimentalInitializeRequest {
    return buildExperimentalInitialize(applicationVersion);
  }

  async openThreadRequest(): Promise<OpenThreadRequest> {
    const existing = await this.options.registry.threadForProject(
      this.options.projectId,
    );
    if (!existing) {
      return {
        method: "thread/start",
        params: buildThreadStartRequest(this.options.policy),
      };
    }
    return {
      method: "thread/resume",
      params: await this.options.registry.resumeRequestForProject(
        this.options.projectId,
        this.options.policy,
      ),
    };
  }

  async acceptThreadResponse(response: unknown): Promise<void> {
    const session = decodeThreadSession(response, this.options.policy);
    await this.options.registry.bindFromThreadResponse(
      this.options.projectId,
      response,
      this.options.policy,
    );
    this.projector = new ThreadStreamProjector({
      experimentalApiNegotiated: true,
      generation: this.options.generation,
      threadId: session.threadId,
      allowedMcpServer: this.options.allowedMcpServer,
      allowedMcpTools: this.options.allowedMcpTools,
    });
    this.threadId = session.threadId;
    this.currentTurnId = undefined;
    this.turnStarting = false;
    this.lastTerminalTurnId = undefined;
  }

  async turnStartRequest(input: TurnStartInput): Promise<TurnStartRequest> {
    if (!this.projector || this.currentTurnId || this.turnStarting) {
      throw new CodexThreadProtocolError("configuration");
    }
    this.turnStarting = true;
    try {
      const threadId = await this.requireThreadId();
      return buildTurnStartRequest(
        threadId,
        this.clientMessageId(),
        input,
        this.options.policy,
      );
    } catch (error) {
      this.turnStarting = false;
      throw error;
    }
  }

  acceptTurnStartResponse(response: unknown): ThreadStreamEvent | null {
    const projector = this.requireProjector();
    const turn = decodeTurnStart(response);
    if (
      !this.turnStarting &&
      this.currentTurnId !== turn.turnId &&
      this.lastTerminalTurnId !== turn.turnId
    ) {
      throw new CodexThreadProtocolError("protocol");
    }
    this.turnStarting = false;
    if (this.lastTerminalTurnId === turn.turnId) return null;
    this.currentTurnId = turn.turnId;
    const event = projector.beginTurn(
      projector.currentGeneration(),
      turn.turnId,
      turn.status,
    );
    if (event?.type === "turn_terminal") {
      this.lastTerminalTurnId = turn.turnId;
      this.currentTurnId = undefined;
    }
    return event;
  }

  async interruptRequest(): Promise<TurnInterruptRequest> {
    const projector = this.requireProjector();
    if (!this.currentTurnId) {
      throw new CodexThreadProtocolError("configuration");
    }
    const threadId = await this.requireThreadId();
    projector.markInterruptRequested(
      projector.currentGeneration(),
      this.currentTurnId,
    );
    return buildTurnInterruptRequest(threadId, this.currentTurnId);
  }

  acceptInterruptResponse(response: unknown): void {
    decodeTurnInterrupt(response);
    // Only turn/completed is terminal. The response does not clear the active turn.
  }

  async unsubscribeRequest(): Promise<ThreadUnsubscribeRequest> {
    this.requireProjector();
    if (this.currentTurnId || this.turnStarting) {
      throw new CodexThreadProtocolError("configuration");
    }
    return buildThreadUnsubscribeRequest(await this.requireThreadId());
  }

  acceptUnsubscribeResponse(response: unknown): void {
    decodeThreadUnsubscribe(response);
    this.projector = undefined;
    this.threadId = undefined;
    this.currentTurnId = undefined;
    this.turnStarting = false;
    this.lastTerminalTurnId = undefined;
  }

  /** A correlated RPC error proves that no turn was accepted; timeouts use disconnect(). */
  rejectTurnStart(): void {
    if (!this.turnStarting || this.currentTurnId) {
      throw new CodexThreadProtocolError("configuration");
    }
    this.turnStarting = false;
  }

  assertActiveCorrelation(params: unknown, requireItem: boolean): void {
    this.requireProjector();
    if (!threadProtocolInternals.record(params)) {
      throw new CodexThreadProtocolError("protocol");
    }
    const threadId = threadProtocolInternals.identifier(
      params.threadId,
      "protocol",
    );
    const turnId = threadProtocolInternals.identifier(
      params.turnId,
      "protocol",
    );
    if (
      threadId !== this.threadId ||
      (!this.currentTurnId ? !this.turnStarting : turnId !== this.currentTurnId)
    ) {
      throw new CodexThreadProtocolError("forbidden");
    }
    if (requireItem) {
      threadProtocolInternals.identifier(params.itemId, "protocol");
    }
  }

  notification(method: string, params: unknown): ThreadStreamEvent | null {
    const projector = this.requireProjector();
    const event = projector.observe(
      projector.currentGeneration(),
      method,
      params,
    );
    if (
      event?.type === "turn_terminal" ||
      event?.type === "connection_uncertain"
    ) {
      this.lastTerminalTurnId = event.turnId;
      this.currentTurnId = undefined;
      this.turnStarting = false;
    } else if (event?.type === "turn_started") {
      if (this.currentTurnId && this.currentTurnId !== event.turnId) {
        throw new CodexThreadProtocolError("protocol");
      }
      this.currentTurnId = event.turnId;
    }
    return event;
  }

  disconnect(): ThreadStreamEvent | null {
    const projector = this.requireProjector();
    const event = projector.disconnect(projector.currentGeneration());
    if (event) {
      this.lastTerminalTurnId = event.turnId;
      this.currentTurnId = undefined;
    }
    this.turnStarting = false;
    return event;
  }

  private async requireThreadId(): Promise<string> {
    const threadId = await this.options.registry.threadForProject(
      this.options.projectId,
    );
    if (!threadId) throw new CodexThreadProtocolError("configuration");
    return threadId;
  }

  private requireProjector(): ThreadStreamProjector {
    if (!this.projector) throw new CodexThreadProtocolError("configuration");
    return this.projector;
  }
}
import { randomUUID } from "node:crypto";
