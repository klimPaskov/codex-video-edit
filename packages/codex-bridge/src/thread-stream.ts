import {
  CodexThreadProtocolError,
  threadProtocolInternals,
  type TurnStatus,
} from "./thread-protocol.ts";

const MAX_DELTA_LENGTH = 16 * 1024;
const MAX_MESSAGE_LENGTH = 64 * 1024;
const MAX_TRACKED_TERMINALS = 32;

type SafeItemKind = "message" | "activity" | "subagent" | "edit";

interface CorrelatedEvent {
  generation: number;
  threadId: string;
  turnId: string;
}

export type ThreadStreamEvent =
  | (CorrelatedEvent & { type: "turn_started" })
  | (CorrelatedEvent & {
      type: "item_started";
      itemId: string;
      kind: SafeItemKind;
      label: string;
    })
  | (CorrelatedEvent & {
      type: "message_delta";
      itemId: string;
      text: string;
    })
  | (CorrelatedEvent & {
      type: "item_completed";
      itemId: string;
      kind: SafeItemKind;
      text: string | null;
    })
  | (CorrelatedEvent & {
      type: "turn_problem";
      retrying: boolean;
    })
  | (CorrelatedEvent & {
      type: "turn_terminal";
      status: Exclude<TurnStatus, "inProgress">;
    })
  | (CorrelatedEvent & { type: "connection_uncertain" });

export interface ThreadStreamProjectorOptions {
  experimentalApiNegotiated: true;
  generation: number;
  threadId: string;
  allowedMcpServer: string;
  allowedMcpTools: ReadonlySet<string>;
}

interface ItemState {
  type: string;
  kind: SafeItemKind;
  completed: boolean;
  text: string;
}

interface ActiveTurn {
  id: string;
  terminal: Exclude<TurnStatus, "inProgress"> | "uncertain" | undefined;
  interruptRequested: boolean;
  items: Map<string, ItemState>;
}

const forbiddenNotificationMethods = new Set([
  "command/exec/outputDelta",
  "command/execution/outputDelta",
  "fileChange/outputDelta",
  "fileChange/patch/updated",
  "process/outputDelta",
  "process/exited",
  "terminal/interaction",
  "turn/diff/updated",
]);

function safeGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CodexThreadProtocolError("configuration");
  }
  return value;
}

function redactText(value: unknown, maximum = MAX_DELTA_LENGTH): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    value.includes("\0")
  ) {
    throw new CodexThreadProtocolError("protocol");
  }
  return value
    .replace(/\\\\[^\s\\/]+[\\/][^\r\n]*/gu, "[private path]")
    .replace(/[A-Za-z]:[\\/][^\r\n\t]*/gu, "[private path]")
    .replace(
      /\/(?:Users|home|tmp|var|private|mnt)\/[^\r\n\t ]*/gu,
      "[private path]",
    )
    .replace(
      /\b(?:Bearer\s+)?(?:sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9._-]{12,})\b/gu,
      "[credential]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, "[private email]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "");
}

function itemProjection(
  item: Record<string, unknown>,
  options: ThreadStreamProjectorOptions,
): { id: string; type: string; kind: SafeItemKind; label: string } {
  const id = threadProtocolInternals.identifier(item.id, "protocol");
  const type = threadProtocolInternals.identifier(item.type, "protocol");
  switch (type) {
    case "userMessage":
      return { id, type, kind: "message", label: "Your request" };
    case "hookPrompt":
    case "agentMessage":
      return {
        id,
        type,
        kind: type === "agentMessage" ? "message" : "activity",
        label:
          type === "agentMessage" ? "Codex response" : "Working on the edit",
      };
    case "plan":
    case "reasoning":
    case "contextCompaction":
    case "sleep":
    case "enteredReviewMode":
    case "exitedReviewMode":
      return { id, type, kind: "activity", label: "Working on the edit" };
    case "collabAgentToolCall":
    case "subAgentActivity":
      return { id, type, kind: "subagent", label: "Codex subagent" };
    case "mcpToolCall": {
      const server = threadProtocolInternals.identifier(
        item.server,
        "protocol",
      );
      const tool = threadProtocolInternals.identifier(item.tool, "protocol");
      if (
        item.status !== "inProgress" &&
        item.status !== "completed" &&
        item.status !== "failed"
      ) {
        throw new CodexThreadProtocolError("protocol");
      }
      if (
        server !== options.allowedMcpServer ||
        !options.allowedMcpTools.has(tool)
      ) {
        throw new CodexThreadProtocolError("forbidden");
      }
      return { id, type, kind: "edit", label: "Applying an edit" };
    }
    default:
      throw new CodexThreadProtocolError("forbidden");
  }
}

/**
 * Converts raw notifications into a small renderer-safe stream. It never returns
 * protocol objects, paths, tool arguments, command output, reasoning, or errors.
 */
export class ThreadStreamProjector {
  private generation: number;
  private readonly threadId: string;
  private readonly options: ThreadStreamProjectorOptions;
  private active: ActiveTurn | undefined;
  private readonly terminals = new Map<
    string,
    Exclude<TurnStatus, "inProgress"> | "uncertain"
  >();
  private poisoned = false;

  constructor(options: ThreadStreamProjectorOptions) {
    if (options.experimentalApiNegotiated !== true) {
      throw new CodexThreadProtocolError("configuration");
    }
    this.generation = safeGeneration(options.generation);
    this.threadId = threadProtocolInternals.identifier(
      options.threadId,
      "configuration",
    );
    this.options = {
      ...options,
      allowedMcpServer: threadProtocolInternals.identifier(
        options.allowedMcpServer,
        "configuration",
      ),
      allowedMcpTools: new Set(options.allowedMcpTools),
    };
    for (const tool of this.options.allowedMcpTools) {
      threadProtocolInternals.identifier(tool, "configuration");
    }
  }

  currentGeneration(): number {
    return this.generation;
  }

  beginTurn(
    generation: number,
    turnId: string,
    status: TurnStatus = "inProgress",
  ): ThreadStreamEvent | null {
    if (generation !== this.generation) return null;
    this.assertHealthy();
    const id = threadProtocolInternals.identifier(turnId, "protocol");
    if (this.active && this.active.id !== id && !this.active.terminal) {
      return this.failProtocol();
    }
    if (this.terminals.has(id)) return null;
    if (!this.active || this.active.id !== id) {
      this.active = {
        id,
        terminal: undefined,
        interruptRequested: false,
        items: new Map(),
      };
    }
    if (status === "inProgress") return null;
    return this.complete(status);
  }

  markInterruptRequested(generation: number, turnId: string): void {
    if (generation !== this.generation) return;
    this.assertHealthy();
    const active = this.requireActive(turnId);
    if (!active.terminal) active.interruptRequested = true;
  }

  observe(
    generation: number,
    method: string,
    params: unknown,
  ): ThreadStreamEvent | null {
    if (generation !== this.generation) return null;
    this.assertHealthy();
    if (
      forbiddenNotificationMethods.has(method) ||
      method.includes("commandExecution") ||
      method.includes("fileChange") ||
      method.includes("terminal/") ||
      method.includes("process/")
    ) {
      this.poisoned = true;
      throw new CodexThreadProtocolError("forbidden");
    }
    if (
      method !== "turn/started" &&
      method !== "item/started" &&
      method !== "item/agentMessage/delta" &&
      method !== "item/completed" &&
      method !== "turn/completed" &&
      method !== "error"
    ) {
      return null;
    }
    if (!threadProtocolInternals.record(params)) return this.failProtocol();
    const threadId = threadProtocolInternals.identifier(
      params.threadId,
      "protocol",
    );
    if (threadId !== this.threadId) return this.failProtocol();

    if (method === "turn/started" || method === "turn/completed") {
      const turn = threadProtocolInternals.turn(params.turn);
      const terminal = this.terminals.get(turn.id);
      if (terminal !== undefined) {
        if (
          method === "turn/completed" &&
          terminal !== "uncertain" &&
          terminal !== turn.status
        ) {
          return this.failProtocol();
        }
        return null;
      }
      if (!this.active) {
        this.active = {
          id: turn.id,
          terminal: undefined,
          interruptRequested: false,
          items: new Map(),
        };
      } else if (this.active.id !== turn.id) {
        if (!this.active.terminal) return this.failProtocol();
        this.active = {
          id: turn.id,
          terminal: undefined,
          interruptRequested: false,
          items: new Map(),
        };
      }
      if (method === "turn/started") {
        if (turn.status !== "inProgress") return this.failProtocol();
        return this.event(turn.id, { type: "turn_started" });
      }
      if (turn.status === "inProgress") return this.failProtocol();
      return this.complete(turn.status);
    }

    const turnId = threadProtocolInternals.identifier(
      params.turnId,
      "protocol",
    );
    if (this.terminals.has(turnId)) return null;
    const active = this.requireActive(turnId);
    if (active.terminal) return null;

    if (method === "error") {
      if (typeof params.willRetry !== "boolean") return this.failProtocol();
      return this.event(turnId, {
        type: "turn_problem",
        retrying: params.willRetry,
      });
    }

    if (method === "item/agentMessage/delta") {
      const itemId = threadProtocolInternals.identifier(
        params.itemId,
        "protocol",
      );
      const item = active.items.get(itemId);
      if (!item || item.type !== "agentMessage" || item.completed) {
        return this.failProtocol();
      }
      const text = redactText(params.delta);
      if (item.text.length + text.length > MAX_MESSAGE_LENGTH) {
        return this.failProtocol();
      }
      item.text += text;
      return this.event(turnId, {
        type: "message_delta",
        itemId,
        text,
      });
    }

    if (!threadProtocolInternals.record(params.item))
      return this.failProtocol();
    const timestamp =
      method === "item/started" ? params.startedAtMs : params.completedAtMs;
    if (!Number.isSafeInteger(timestamp) || (timestamp as number) < 0) {
      return this.failProtocol();
    }
    let projected: ReturnType<typeof itemProjection>;
    try {
      projected = itemProjection(params.item, this.options);
    } catch (error) {
      this.poisoned = true;
      throw error;
    }
    const existing = active.items.get(projected.id);
    if (method === "item/started") {
      if (existing) {
        if (existing.type !== projected.type) return this.failProtocol();
        return null;
      }
      active.items.set(projected.id, {
        type: projected.type,
        kind: projected.kind,
        completed: false,
        text: "",
      });
      return this.event(turnId, {
        type: "item_started",
        itemId: projected.id,
        kind: projected.kind,
        label: projected.label,
      });
    }
    if (!existing || existing.type !== projected.type || existing.completed) {
      return this.failProtocol();
    }
    existing.completed = true;
    const text =
      projected.type === "agentMessage"
        ? redactText(params.item.text, MAX_MESSAGE_LENGTH)
        : null;
    return this.event(turnId, {
      type: "item_completed",
      itemId: projected.id,
      kind: projected.kind,
      text,
    });
  }

  disconnect(generation: number): ThreadStreamEvent | null {
    if (generation !== this.generation) return null;
    this.assertHealthy();
    if (!this.active || this.active.terminal) return null;
    this.active.terminal = "uncertain";
    this.rememberTerminal(this.active.id, "uncertain");
    return this.event(this.active.id, { type: "connection_uncertain" });
  }

  advanceGeneration(nextGeneration: number): ThreadStreamEvent | null {
    const next = safeGeneration(nextGeneration);
    if (next <= this.generation) {
      throw new CodexThreadProtocolError("configuration");
    }
    const uncertainty = this.disconnect(this.generation);
    this.generation = next;
    this.active = undefined;
    return uncertainty;
  }

  private complete(
    status: Exclude<TurnStatus, "inProgress">,
  ): ThreadStreamEvent | null {
    if (!this.active || this.active.terminal) return null;
    this.active.terminal = status;
    this.rememberTerminal(this.active.id, status);
    return this.event(this.active.id, { type: "turn_terminal", status });
  }

  private rememberTerminal(
    turnId: string,
    status: Exclude<TurnStatus, "inProgress"> | "uncertain",
  ): void {
    this.terminals.set(turnId, status);
    while (this.terminals.size > MAX_TRACKED_TERMINALS) {
      const oldest = this.terminals.keys().next().value;
      if (oldest === undefined) break;
      this.terminals.delete(oldest);
    }
  }

  private requireActive(turnId: unknown): ActiveTurn {
    const id = threadProtocolInternals.identifier(turnId, "protocol");
    if (!this.active || this.active.id !== id) return this.failProtocol();
    return this.active;
  }

  private event<T extends Omit<ThreadStreamEvent, keyof CorrelatedEvent>>(
    turnId: string,
    event: T,
  ): ThreadStreamEvent {
    return {
      generation: this.generation,
      threadId: this.threadId,
      turnId,
      ...event,
    } as ThreadStreamEvent;
  }

  private assertHealthy(): void {
    if (this.poisoned) throw new CodexThreadProtocolError("forbidden");
  }

  private failProtocol(): never {
    this.poisoned = true;
    throw new CodexThreadProtocolError("protocol");
  }
}

export const threadStreamInternals = { redactText };
