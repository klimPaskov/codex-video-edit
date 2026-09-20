import type { ApiProviderId } from "./api-providers.ts";

/** Path-free projection of a paid-provider conversation. */
export interface ApiThreadView {
  status: "closed" | "ready" | "running" | "interrupting" | "failed";
  projectId: string | null;
  provider: ApiProviderId | null;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    text: string;
  }>;
  message: string | null;
}

export interface ApiThreadProjectRequest {
  schema_version: "1.0";
  project_id: string;
  provider: ApiProviderId;
}

export interface ApiThreadSendRequest extends ApiThreadProjectRequest {
  text: string;
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/u;
const issues = new Set([
  "Choose a connected provider and model in Settings before sending.",
  "The provider request failed. Check the connection and try a new turn.",
  "The provider rate or quota limit was reached. Check your API account before sending again.",
  "The provider rejected this API connection. Check the key and account access in Settings before sending again.",
  "The provider rejected this response. Check the selected model and try a new turn.",
  "This turn stopped. Review the current draft before sending again.",
  "The edit may have been saved. Reopen the project before sending again.",
  "The conversation could not be saved. Check local storage and reopen the project.",
]);

function invalid(): never {
  throw new Error("Invalid API conversation exchange.");
}

function exact(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length !== 0 ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    invalid();
  return value as Record<string, unknown>;
}

function id(value: unknown): asserts value is string {
  if (typeof value !== "string" || !idPattern.test(value)) invalid();
}

function provider(value: unknown): asserts value is ApiProviderId {
  if (value !== "deepseek" && value !== "openai") invalid();
}

function prose(
  value: unknown,
  maximum: number,
  empty = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  )
    invalid();
}

export function assertApiThreadProjectRequest(
  value: unknown,
): asserts value is ApiThreadProjectRequest {
  const request = exact(value, ["schema_version", "project_id", "provider"]);
  if (request.schema_version !== "1.0") invalid();
  id(request.project_id);
  provider(request.provider);
}

export function assertApiThreadSendRequest(
  value: unknown,
): asserts value is ApiThreadSendRequest {
  const request = exact(value, [
    "schema_version",
    "project_id",
    "provider",
    "text",
  ]);
  if (request.schema_version !== "1.0") invalid();
  id(request.project_id);
  provider(request.provider);
  prose(request.text, 16 * 1024);
}

export function assertApiThreadView(
  value: unknown,
): asserts value is ApiThreadView {
  const view = exact(value, [
    "status",
    "projectId",
    "provider",
    "messages",
    "message",
  ]);
  if (
    !["closed", "ready", "running", "interrupting", "failed"].includes(
      view.status as string,
    ) ||
    !Array.isArray(view.messages) ||
    view.messages.length > 48
  )
    invalid();
  if (view.projectId !== null) id(view.projectId);
  if (view.provider !== null) provider(view.provider);
  if (view.message !== null && !issues.has(view.message as string)) invalid();
  if (
    (view.status === "closed" &&
      (view.projectId !== null ||
        view.provider !== null ||
        view.messages.length !== 0 ||
        view.message !== null)) ||
    (view.status !== "closed" &&
      (view.projectId === null || view.provider === null))
  )
    invalid();
  const ids = new Set<string>();
  for (const raw of view.messages) {
    const message = exact(raw, ["id", "role", "text"]);
    id(message.id);
    prose(message.text, message.role === "assistant" ? 32 * 1024 : 16 * 1024);
    if (
      ids.has(message.id as string) ||
      !["user", "assistant"].includes(message.role as string)
    )
      invalid();
    ids.add(message.id as string);
  }
}
