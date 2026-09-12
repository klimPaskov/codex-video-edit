import { isAbsolute } from "node:path";
import type { ThreadResumeParams as GeneratedThreadResumeParams } from "./generated/v2/ThreadResumeParams.ts";
import type { ThreadStartParams as GeneratedThreadStartParams } from "./generated/v2/ThreadStartParams.ts";
import type { ThreadUnsubscribeParams as GeneratedThreadUnsubscribeParams } from "./generated/v2/ThreadUnsubscribeParams.ts";
import type { ThreadUnsubscribeResponse as GeneratedThreadUnsubscribeResponse } from "./generated/v2/ThreadUnsubscribeResponse.ts";
import type { ThreadTurnsListParams as GeneratedThreadTurnsListParams } from "./generated/v2/ThreadTurnsListParams.ts";
import type { TurnInterruptParams as GeneratedTurnInterruptParams } from "./generated/v2/TurnInterruptParams.ts";
import type { TurnInterruptResponse as GeneratedTurnInterruptResponse } from "./generated/v2/TurnInterruptResponse.ts";
import type { TurnStartParams as GeneratedTurnStartParams } from "./generated/v2/TurnStartParams.ts";

const MAX_IDENTIFIER_LENGTH = 256;
const MAX_INSTRUCTION_LENGTH = 128 * 1024;
const reasoningPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;

export class CodexThreadProtocolError extends Error {
  readonly code: "configuration" | "protocol" | "forbidden";

  constructor(code: "configuration" | "protocol" | "forbidden") {
    const messages = {
      configuration: "The Codex thread configuration is invalid.",
      protocol: "The Codex thread response is unsupported.",
      forbidden: "Codex attempted an operation outside the editor boundary.",
    } as const;
    super(messages[code]);
    this.name = "CodexThreadProtocolError";
    this.code = code;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.getOwnPropertySymbols(value).length === 0
  );
}

function exact(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  ) {
    throw new CodexThreadProtocolError("configuration");
  }
  return value;
}

function identifier(
  value: unknown,
  code: "configuration" | "protocol",
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER_LENGTH ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new CodexThreadProtocolError(code);
  }
  return value;
}

function instruction(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (
    value.length === 0 ||
    value.length > MAX_INSTRUCTION_LENGTH ||
    value.includes("\0")
  ) {
    throw new CodexThreadProtocolError("configuration");
  }
  return value;
}

export interface ExperimentalInitializeRequest {
  clientInfo: {
    name: "codex_video_edit";
    title: "codex-video-edit";
    version: string;
  };
  capabilities: {
    experimentalApi: true;
    requestAttestation: false;
    mcpServerOpenaiFormElicitation: false;
    optOutNotificationMethods: [];
  };
}

/**
 * Application-owned initialize payload. The official 0.142.3 stable generated
 * schema contains this capability; live experimental acceptance is a separate gate.
 */
export function buildExperimentalInitialize(
  applicationVersion: string,
): ExperimentalInitializeRequest {
  const version = identifier(applicationVersion, "configuration");
  return {
    clientInfo: {
      name: "codex_video_edit",
      title: "codex-video-edit",
      version,
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
      mcpServerOpenaiFormElicitation: false,
      optOutNotificationMethods: [],
    },
  };
}

export interface ThreadRuntimePolicy {
  /** Canonical application-owned context directory. */
  cwd: string;
  /** A model ID returned by the connected runtime. */
  model: string;
  /** A reasoning value returned for the selected runtime model. */
  effort: string;
  baseInstructions?: string;
  developerInstructions?: string;
}

function validatePolicy(policy: ThreadRuntimePolicy): ThreadRuntimePolicy {
  exact(policy, [
    "cwd",
    "model",
    "effort",
    "baseInstructions",
    "developerInstructions",
  ]);
  if (
    !isAbsolute(policy.cwd) ||
    policy.cwd.includes("\0") ||
    policy.cwd.length > 4096
  ) {
    throw new CodexThreadProtocolError("configuration");
  }
  if (!reasoningPattern.test(policy.effort)) {
    throw new CodexThreadProtocolError("configuration");
  }
  const baseInstructions = instruction(policy.baseInstructions);
  const developerInstructions = instruction(policy.developerInstructions);
  return {
    cwd: policy.cwd,
    model: identifier(policy.model, "configuration"),
    effort: policy.effort,
    ...(baseInstructions === undefined ? {} : { baseInstructions }),
    ...(developerInstructions === undefined ? {} : { developerInstructions }),
  };
}

export interface ThreadStartRequest {
  model: string;
  modelProvider: "openai";
  cwd: string;
  runtimeWorkspaceRoots: [];
  approvalPolicy: "never";
  approvalsReviewer: "user";
  sandbox: "read-only";
  config: {
    forced_login_method: "chatgpt";
    model_provider: "openai";
    project_root_markers: [];
    features: { shell_tool: false };
    web_search: "disabled";
  };
  ephemeral: false;
  environments: [];
  selectedCapabilityRoots: [];
  experimentalRawEvents: false;
  baseInstructions?: string;
  developerInstructions?: string;
}

export function buildThreadStartRequest(
  suppliedPolicy: ThreadRuntimePolicy,
): ThreadStartRequest {
  const policy = validatePolicy(suppliedPolicy);
  const request: ThreadStartRequest = {
    model: policy.model,
    modelProvider: "openai",
    cwd: policy.cwd,
    runtimeWorkspaceRoots: [],
    approvalPolicy: "never",
    approvalsReviewer: "user",
    sandbox: "read-only",
    config: {
      forced_login_method: "chatgpt",
      model_provider: "openai",
      project_root_markers: [],
      features: { shell_tool: false },
      web_search: "disabled",
    },
    ephemeral: false,
    environments: [],
    selectedCapabilityRoots: [],
    experimentalRawEvents: false,
    ...(policy.baseInstructions === undefined
      ? {}
      : { baseInstructions: policy.baseInstructions }),
    ...(policy.developerInstructions === undefined
      ? {}
      : { developerInstructions: policy.developerInstructions }),
  };
  return request satisfies GeneratedThreadStartParams;
}

export interface ThreadResumeRequest {
  threadId: string;
  model: string;
  modelProvider: "openai";
  cwd: string;
  runtimeWorkspaceRoots: [];
  approvalPolicy: "never";
  approvalsReviewer: "user";
  sandbox: "read-only";
  config: ThreadStartRequest["config"];
  excludeTurns: true;
  initialTurnsPage: {
    limit: 100;
    sortDirection: "desc";
    itemsView: "full";
  };
  baseInstructions?: string;
  developerInstructions?: string;
}

export interface ThreadTurnsListRequest {
  threadId: string;
  limit: 100;
  sortDirection: "desc";
  itemsView: "full";
}

/** 0.142.3 thread/resume has no environments property. */
export function buildThreadResumeRequest(
  trustedThreadId: string,
  suppliedPolicy: ThreadRuntimePolicy,
): ThreadResumeRequest {
  const policy = validatePolicy(suppliedPolicy);
  const request: ThreadResumeRequest = {
    threadId: identifier(trustedThreadId, "configuration"),
    model: policy.model,
    modelProvider: "openai",
    cwd: policy.cwd,
    runtimeWorkspaceRoots: [],
    approvalPolicy: "never",
    approvalsReviewer: "user",
    sandbox: "read-only",
    config: {
      forced_login_method: "chatgpt",
      model_provider: "openai",
      project_root_markers: [],
      features: { shell_tool: false },
      web_search: "disabled",
    },
    excludeTurns: true,
    initialTurnsPage: {
      limit: 100,
      sortDirection: "desc",
      itemsView: "full",
    },
    ...(policy.baseInstructions === undefined
      ? {}
      : { baseInstructions: policy.baseInstructions }),
    ...(policy.developerInstructions === undefined
      ? {}
      : { developerInstructions: policy.developerInstructions }),
  };
  return request satisfies GeneratedThreadResumeParams;
}

export function buildThreadTurnsListRequest(
  trustedThreadId: string,
): ThreadTurnsListRequest {
  const request: ThreadTurnsListRequest = {
    threadId: identifier(trustedThreadId, "configuration"),
    limit: 100,
    sortDirection: "desc",
    itemsView: "full",
  };
  return request satisfies GeneratedThreadTurnsListParams;
}

/** The pinned response permits a null inline page; callers then use the list fallback. */
export function decodeThreadResumeHistoryPage(value: unknown): unknown | null {
  if (!record(value)) throw new CodexThreadProtocolError("protocol");
  return value.initialTurnsPage ?? null;
}

export interface TurnTextInput {
  type: "text";
  text: string;
  text_elements: [];
}

export interface TurnSkillInput {
  type: "skill";
  name: string;
  /** Main-owned runtime skill path. Never renderer supplied or projected back. */
  path: string;
}

export interface TurnStartRequest {
  threadId: string;
  clientUserMessageId: string;
  input: Array<TurnTextInput | TurnSkillInput>;
  environments: [];
  cwd: string;
  runtimeWorkspaceRoots: [];
  approvalPolicy: "never";
  approvalsReviewer: "user";
  sandboxPolicy: { type: "readOnly"; networkAccess: false };
  model: string;
  effort: string;
}

export interface TurnStartInput {
  text: string;
  skills?: ReadonlyArray<{ name: string; path: string }>;
}

export function buildTurnStartRequest(
  trustedThreadId: string,
  trustedClientMessageId: string,
  supplied: TurnStartInput,
  suppliedPolicy: ThreadRuntimePolicy,
): TurnStartRequest {
  const policy = validatePolicy(suppliedPolicy);
  exact(supplied, ["text", "skills"]);
  if (
    typeof supplied.text !== "string" ||
    supplied.text.trim().length === 0 ||
    supplied.text.length > MAX_INSTRUCTION_LENGTH ||
    supplied.text.includes("\0") ||
    (supplied.skills?.length ?? 0) > 32
  ) {
    throw new CodexThreadProtocolError("configuration");
  }
  const input: Array<TurnTextInput | TurnSkillInput> = [
    { type: "text", text: supplied.text, text_elements: [] },
  ];
  for (const skill of supplied.skills ?? []) {
    exact(skill, ["name", "path"]);
    if (
      !isAbsolute(skill.path) ||
      skill.path.includes("\0") ||
      skill.path.length > 4096
    ) {
      throw new CodexThreadProtocolError("configuration");
    }
    input.push({
      type: "skill",
      name: identifier(skill.name, "configuration"),
      path: skill.path,
    });
  }
  const request: TurnStartRequest = {
    threadId: identifier(trustedThreadId, "configuration"),
    clientUserMessageId: identifier(trustedClientMessageId, "configuration"),
    input,
    environments: [],
    cwd: policy.cwd,
    runtimeWorkspaceRoots: [],
    approvalPolicy: "never",
    approvalsReviewer: "user",
    sandboxPolicy: { type: "readOnly", networkAccess: false },
    model: policy.model,
    effort: policy.effort,
  };
  return request satisfies GeneratedTurnStartParams;
}

export interface TurnInterruptRequest {
  threadId: string;
  turnId: string;
}

export interface ThreadUnsubscribeRequest {
  threadId: string;
}

export function buildThreadUnsubscribeRequest(
  trustedThreadId: string,
): ThreadUnsubscribeRequest {
  const request: ThreadUnsubscribeRequest = {
    threadId: identifier(trustedThreadId, "configuration"),
  };
  return request satisfies GeneratedThreadUnsubscribeParams;
}

export function decodeThreadUnsubscribe(
  value: unknown,
): asserts value is GeneratedThreadUnsubscribeResponse {
  if (
    !record(value) ||
    Object.keys(value).length !== 1 ||
    !["notLoaded", "notSubscribed", "unsubscribed"].includes(
      typeof value.status === "string" ? value.status : "",
    )
  ) {
    throw new CodexThreadProtocolError("protocol");
  }
}

export function buildTurnInterruptRequest(
  trustedThreadId: string,
  trustedTurnId: string,
): TurnInterruptRequest {
  const request: TurnInterruptRequest = {
    threadId: identifier(trustedThreadId, "configuration"),
    turnId: identifier(trustedTurnId, "configuration"),
  };
  return request satisfies GeneratedTurnInterruptParams;
}

export interface ThreadSession {
  threadId: string;
  active: boolean | null;
}

function threadActiveState(thread: Record<string, unknown>): boolean | null {
  if (thread.status === undefined) return null;
  if (!record(thread.status)) {
    throw new CodexThreadProtocolError("protocol");
  }
  const status = thread.status;
  if (status.type === "active") {
    if (
      Object.keys(status).length !== 2 ||
      !Object.hasOwn(status, "activeFlags") ||
      !Array.isArray(status.activeFlags) ||
      status.activeFlags.some(
        (flag) => flag !== "waitingOnApproval" && flag !== "waitingOnUserInput",
      )
    ) {
      throw new CodexThreadProtocolError("protocol");
    }
    if (status.activeFlags.length) {
      throw new CodexThreadProtocolError("forbidden");
    }
    return true;
  }
  if (status.type !== "idle" || Object.keys(status).length !== 1) {
    throw new CodexThreadProtocolError("protocol");
  }
  return false;
}

export function decodeThreadSession(
  value: unknown,
  expectedPolicy: ThreadRuntimePolicy,
  requireThreadStatus = false,
): ThreadSession {
  const policy = validatePolicy(expectedPolicy);
  if (!record(value) || !record(value.thread)) {
    throw new CodexThreadProtocolError("protocol");
  }
  const thread = value.thread;
  if (requireThreadStatus && thread.status === undefined) {
    throw new CodexThreadProtocolError("protocol");
  }
  if (
    value.model !== policy.model ||
    value.modelProvider !== "openai" ||
    value.cwd !== policy.cwd ||
    value.approvalPolicy !== "never" ||
    value.approvalsReviewer !== "user" ||
    !record(value.sandbox) ||
    Object.keys(value.sandbox).some(
      (key) => key !== "type" && key !== "networkAccess",
    ) ||
    value.sandbox.type !== "readOnly" ||
    value.sandbox.networkAccess !== false ||
    thread.ephemeral !== false ||
    (thread.parentThreadId ?? null) !== null ||
    (value.runtimeWorkspaceRoots !== undefined &&
      (!Array.isArray(value.runtimeWorkspaceRoots) ||
        value.runtimeWorkspaceRoots.length !== 0)) ||
    (value.instructionSources !== undefined &&
      (!Array.isArray(value.instructionSources) ||
        value.instructionSources.length !== 0)) ||
    (value.activePermissionProfile ?? null) !== null ||
    (value.multiAgentMode !== undefined &&
      value.multiAgentMode !== "explicitRequestOnly") ||
    (value.reasoningEffort !== undefined &&
      value.reasoningEffort !== null &&
      value.reasoningEffort !== policy.effort)
  ) {
    throw new CodexThreadProtocolError("protocol");
  }
  return {
    threadId: identifier(thread.id, "protocol"),
    active: threadActiveState(thread),
  };
}

export type TurnStatus = "completed" | "interrupted" | "failed" | "inProgress";

function turn(value: unknown): { id: string; status: TurnStatus } {
  if (!record(value)) throw new CodexThreadProtocolError("protocol");
  const status = value.status;
  if (
    status !== "completed" &&
    status !== "interrupted" &&
    status !== "failed" &&
    status !== "inProgress"
  ) {
    throw new CodexThreadProtocolError("protocol");
  }
  if (!Array.isArray(value.items)) {
    throw new CodexThreadProtocolError("protocol");
  }
  return { id: identifier(value.id, "protocol"), status };
}

export function decodeTurnStart(value: unknown): {
  turnId: string;
  status: TurnStatus;
} {
  if (!record(value)) throw new CodexThreadProtocolError("protocol");
  const decoded = turn(value.turn);
  return { turnId: decoded.id, status: decoded.status };
}

export function decodeTurnInterrupt(
  value: unknown,
): asserts value is GeneratedTurnInterruptResponse {
  if (!record(value) || Object.keys(value).length !== 0) {
    throw new CodexThreadProtocolError("protocol");
  }
}

export const threadProtocolInternals = { record, identifier, turn };
