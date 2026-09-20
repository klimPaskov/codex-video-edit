import type { DynamicToolCallParams } from "./generated/v2/DynamicToolCallParams.ts";
import type { DynamicToolCallResponse } from "./generated/v2/DynamicToolCallResponse.ts";
import type { DynamicToolSpec } from "./generated/v2/DynamicToolSpec.ts";
import type { JsonValue } from "./generated/serde_json/JsonValue.ts";
import { CodexThreadProtocolError } from "./thread-protocol.ts";
import { codexVideoEditMcpTools } from "../../codex-tools/src/mcp-tools.ts";
import {
  CodexVideoEditToolError,
  type CodexVideoEditToolName,
} from "../../codex-tools/src/service.ts";

export const CODEX_EDITOR_NAMESPACE = "codex_video_edit";
const MAX_INPUT_BYTES = 16 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u;

/** Stable wire names, independent of the internal dotted service API. */
const dynamicNames: Record<CodexVideoEditToolName, string> = {
  "project.get_summary": "project_get_summary",
  "timeline.get_summary": "timeline_get_summary",
  "cut.trim_edge": "cut_trim_edge",
  "cut.split": "cut_split",
  "cut.delete_range": "cut_delete_range",
  "cut.delete_ranges": "cut_delete_ranges",
  "timeline.undo": "timeline_undo",
};
const internalNames = new Map(
  Object.entries(dynamicNames).map(([internal, wire]) => [
    wire,
    internal as CodexVideoEditToolName,
  ]),
);

export function ownedDynamicToolWireNames(): Set<string> {
  return new Set(internalNames.keys());
}

export function buildCodexVideoEditDynamicTools(): DynamicToolSpec[] {
  return [
    {
      type: "namespace",
      name: CODEX_EDITOR_NAMESPACE,
      description: "Application-owned reversible video editor tools.",
      tools: codexVideoEditMcpTools.map((tool) => ({
        type: "function" as const,
        name: dynamicNames[tool.name],
        description: tool.description,
        inputSchema: structuredClone(tool.inputSchema) as unknown as JsonValue,
      })),
    },
  ];
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

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

export interface OwnedDynamicToolCall {
  threadId: string;
  turnId: string;
  callId: string;
  name: CodexVideoEditToolName;
  arguments: Record<string, unknown>;
}

/** Reject anything outside the pinned request shape before invoking main-owned work. */
export function decodeOwnedDynamicToolCall(
  value: unknown,
): OwnedDynamicToolCall {
  const keys = [
    "threadId",
    "turnId",
    "callId",
    "namespace",
    "tool",
    "arguments",
  ] as const;
  if (
    !record(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key)) ||
    !validIdentifier(value.threadId) ||
    !validIdentifier(value.turnId) ||
    !validIdentifier(value.callId) ||
    value.namespace !== CODEX_EDITOR_NAMESPACE ||
    typeof value.tool !== "string" ||
    !internalNames.has(value.tool) ||
    !record(value.arguments)
  )
    throw new CodexThreadProtocolError("forbidden");
  let size: number;
  try {
    size = Buffer.byteLength(JSON.stringify(value.arguments));
  } catch {
    throw new CodexThreadProtocolError("protocol");
  }
  if (size > MAX_INPUT_BYTES) throw new CodexThreadProtocolError("forbidden");
  const params = value as DynamicToolCallParams;
  return {
    threadId: params.threadId,
    turnId: params.turnId,
    callId: params.callId,
    name: internalNames.get(params.tool)!,
    arguments: value.arguments,
  };
}

function response(text: string, success: boolean): DynamicToolCallResponse {
  return { contentItems: [{ type: "inputText", text }], success };
}

function safeError(
  code: CodexVideoEditToolError["code"],
): DynamicToolCallResponse {
  const error = new CodexVideoEditToolError(code);
  return response(
    JSON.stringify({ error: { code, message: error.message } }),
    false,
  );
}

/** A rejected edit is a safe model-visible result; a malformed call is never dispatched. */
export async function invokeOwnedDynamicTool(
  call: OwnedDynamicToolCall,
  invoke: (name: CodexVideoEditToolName, input: unknown) => Promise<unknown>,
): Promise<DynamicToolCallResponse> {
  try {
    const value = await invoke(call.name, call.arguments);
    const text = JSON.stringify(value);
    if (typeof text !== "string" || Buffer.byteLength(text) > MAX_OUTPUT_BYTES)
      return safeError("outcome_unknown");
    return response(text, true);
  } catch (cause) {
    return safeError(
      cause instanceof CodexVideoEditToolError
        ? cause.code
        : "service_unavailable",
    );
  }
}
