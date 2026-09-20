import {
  buildExperimentalInitialize,
  buildThreadStartRequest,
  buildThreadTurnsListRequest,
  buildThreadUnsubscribeRequest,
  buildTurnInterruptRequest,
  buildTurnStartRequest,
  CodexThreadProtocolError,
  decodeThreadResumeHistoryPage,
  decodeThreadSession,
  decodeThreadUnsubscribe,
  decodeTurnInterrupt,
  decodeTurnStart,
  threadProtocolInternals,
  type ExperimentalInitializeRequest,
  type ThreadResumeRequest,
  type ThreadRuntimePolicy,
  type ThreadStartRequest,
  type ThreadTurnsListRequest,
  type ThreadUnsubscribeRequest,
  type TurnInterruptRequest,
  type TurnStartInput,
  type TurnStartRequest,
} from "./thread-protocol.ts";
import type {
  ProjectThreadRegistry,
  ProjectThreadToolRoute,
} from "./thread-registry.ts";
import {
  buildCodexVideoEditDynamicTools,
  CODEX_EDITOR_NAMESPACE,
  ownedDynamicToolWireNames,
} from "./dynamic-tools.ts";
import type { DynamicToolSpec } from "./generated/v2/DynamicToolSpec.ts";
import { ThreadStreamProjector } from "./thread-stream.ts";
import type {
  ThreadHistorySnapshot,
  ThreadStreamEvent,
} from "./thread-stream.ts";

export interface ProjectThreadRuntimeOptions {
  /** Must come from the successful initialize negotiation for this connection. */
  experimentalApiNegotiated: boolean;
  generation: number;
  projectId: string;
  policy: ThreadRuntimePolicy;
  registry: ProjectThreadRegistry;
  allowedMcpServer: string;
  allowedMcpTools: ReadonlySet<string>;
  allowedDynamicNamespace?: string;
  allowedDynamicTools?: ReadonlySet<string>;
  /** Only used for new threads; a persisted binding decides resume mode. */
  newThreadToolRoute?: ProjectThreadToolRoute;
  /** Main-owned id source; overridden only by deterministic tests. */
  clientMessageId?: () => string;
}

export type OpenThreadRequest =
  | {
      method: "thread/start";
      params: ThreadStartRequest & { dynamicTools?: DynamicToolSpec[] };
    }
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
  private expectedHistoryActive: boolean | null = null;
  private openingToolRoute: ProjectThreadToolRoute | undefined;
  private activeToolRoute: ProjectThreadToolRoute | undefined;
  private readonly clientMessageId: () => string;

  constructor(options: ProjectThreadRuntimeOptions) {
    if (options.experimentalApiNegotiated !== true) {
      throw new CodexThreadProtocolError("configuration");
    }
    this.options = {
      ...options,
      policy: { ...options.policy },
      allowedMcpTools: new Set(options.allowedMcpTools),
      ...(options.allowedDynamicTools
        ? { allowedDynamicTools: new Set(options.allowedDynamicTools) }
        : {}),
    };
    this.clientMessageId = options.clientMessageId ?? randomUUID;
    if (
      options.newThreadToolRoute !== undefined &&
      options.newThreadToolRoute !== "mcp" &&
      options.newThreadToolRoute !== "dynamic"
    ) {
      throw new CodexThreadProtocolError("configuration");
    }
    const reviewedDynamicNames = ownedDynamicToolWireNames();
    if (
      options.allowedDynamicTools &&
      (options.allowedDynamicNamespace !== CODEX_EDITOR_NAMESPACE ||
        options.allowedDynamicTools.size !== reviewedDynamicNames.size ||
        [...options.allowedDynamicTools].some(
          (name) => !reviewedDynamicNames.has(name),
        ))
    ) {
      throw new CodexThreadProtocolError("configuration");
    }
    if (
      options.newThreadToolRoute === "dynamic" &&
      (!options.allowedDynamicNamespace || !options.allowedDynamicTools?.size)
    ) {
      throw new CodexThreadProtocolError("configuration");
    }
    // Validate the complete no-environment thread policy at construction.
    buildThreadStartRequest(this.options.policy);
  }

  initializeRequest(applicationVersion: string): ExperimentalInitializeRequest {
    return buildExperimentalInitialize(applicationVersion);
  }

  async openThreadRequest(): Promise<OpenThreadRequest> {
    const existing = await this.options.registry.bindingForProject(
      this.options.projectId,
    );
    const toolRoute =
      existing?.toolRoute ?? this.options.newThreadToolRoute ?? "mcp";
    if (
      toolRoute === "dynamic" &&
      (!this.options.allowedDynamicNamespace ||
        !this.options.allowedDynamicTools?.size)
    ) {
      throw new CodexThreadProtocolError("configuration");
    }
    this.openingToolRoute = toolRoute;
    if (!existing) {
      return {
        method: "thread/start",
        params: {
          ...buildThreadStartRequest(this.options.policy),
          ...(toolRoute === "dynamic"
            ? { dynamicTools: buildCodexVideoEditDynamicTools() }
            : {}),
        },
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

  async acceptThreadResponse(
    response: unknown,
    resumed = false,
  ): Promise<unknown | null> {
    if (!this.openingToolRoute)
      throw new CodexThreadProtocolError("configuration");
    const session = decodeThreadSession(response, this.options.policy, resumed);
    const historyPage = resumed
      ? decodeThreadResumeHistoryPage(response)
      : null;
    await this.options.registry.bindFromThreadResponse(
      this.options.projectId,
      response,
      this.options.policy,
      this.openingToolRoute,
    );
    this.projector = new ThreadStreamProjector({
      experimentalApiNegotiated: true,
      generation: this.options.generation,
      threadId: session.threadId,
      allowedMcpServer: this.options.allowedMcpServer,
      allowedMcpTools:
        this.openingToolRoute === "mcp"
          ? this.options.allowedMcpTools
          : new Set(),
      ...(this.openingToolRoute === "dynamic" &&
      this.options.allowedDynamicTools
        ? {
            allowedDynamicNamespace: this.options.allowedDynamicNamespace,
            allowedDynamicTools: this.options.allowedDynamicTools,
          }
        : {}),
    });
    this.threadId = session.threadId;
    this.activeToolRoute = this.openingToolRoute;
    this.openingToolRoute = undefined;
    this.currentTurnId = undefined;
    this.turnStarting = false;
    this.lastTerminalTurnId = undefined;
    this.expectedHistoryActive = resumed ? session.active : null;
    return historyPage;
  }

  async historyRequest(): Promise<ThreadTurnsListRequest> {
    this.requireProjector();
    return buildThreadTurnsListRequest(await this.requireThreadId());
  }

  toolRoute(): ProjectThreadToolRoute | undefined {
    return this.activeToolRoute;
  }

  acceptHistoryPage(
    response: unknown,
    requireActivityAgreement: boolean,
  ): ThreadHistorySnapshot {
    const history = this.requireProjector().restoreHistory(response);
    if (
      requireActivityAgreement &&
      this.expectedHistoryActive !== null &&
      this.expectedHistoryActive !== (history.activeTurnId !== null)
    ) {
      throw new CodexThreadProtocolError("protocol");
    }
    this.currentTurnId = history.activeTurnId ?? undefined;
    this.turnStarting = false;
    this.expectedHistoryActive = null;
    return history;
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
    this.activeToolRoute = undefined;
    this.openingToolRoute = undefined;
    this.currentTurnId = undefined;
    this.turnStarting = false;
    this.lastTerminalTurnId = undefined;
    this.expectedHistoryActive = null;
  }

  /** A correlated RPC error proves that no turn was accepted; timeouts use disconnect(). */
  rejectTurnStart(): void {
    if (!this.turnStarting || this.currentTurnId) {
      throw new CodexThreadProtocolError("configuration");
    }
    this.turnStarting = false;
  }

  assertActiveCorrelation(
    params: unknown,
    requireItem: boolean,
    allowStarting = true,
  ): void {
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
      (!this.currentTurnId
        ? !allowStarting || !this.turnStarting
        : turnId !== this.currentTurnId)
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

  /** App Server broadcasts native-child events on the same connection. */
  isOtherThreadNotification(params: unknown): boolean {
    if (!this.threadId || !threadProtocolInternals.record(params)) return false;
    if (!Object.hasOwn(params, "threadId")) return false;
    return (
      threadProtocolInternals.identifier(params.threadId, "protocol") !==
      this.threadId
    );
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
