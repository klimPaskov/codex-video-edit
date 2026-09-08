import type { InitializeResponse } from "./generated/InitializeResponse.ts";
import type { Model } from "./generated/v2/Model.ts";
import type { SkillMetadata } from "./generated/v2/SkillMetadata.ts";
import { CodexTransportError } from "./transport.ts";

export type AccountState =
  { status: "signed_out" } | { status: "chatgpt"; plan: string };
export type ModelSummary = Pick<
  Model,
  "id" | "model" | "displayName" | "description" | "isDefault"
> & { reasoning: string[]; defaultReasoning: string };
export type SkillSummary = Pick<
  SkillMetadata,
  "name" | "description" | "enabled"
>;

function invalid(): never {
  throw new CodexTransportError("protocol");
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 16384): string {
  if (typeof value !== "string" || value.length > max) invalid();
  return value;
}
function flag(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value;
}

/** Decode only fields consumed by this client. Never forward raw protocol data. */
export function decodeInitialization(value: unknown): InitializeResponse {
  const result = object(value);
  return {
    userAgent: text(result.userAgent, 4096),
    codexHome: text(result.codexHome, 32768),
    platformFamily: text(result.platformFamily, 64),
    platformOs: text(result.platformOs, 64),
  };
}

export function decodeAccount(value: unknown): AccountState {
  const result = object(value);
  // The product supports the OpenAI provider with managed ChatGPT auth only.
  if (!flag(result.requiresOpenaiAuth)) invalid();
  if (result.account === null || result.account === undefined)
    return { status: "signed_out" };
  const account = object(result.account);
  if (account.type !== "chatgpt") invalid();
  if (account.email !== null) text(account.email, 1024);
  return { status: "chatgpt", plan: text(account.planType, 128) };
}

export function decodeModels(value: unknown): {
  models: ModelSummary[];
  cursor: string | null;
} {
  const result = object(value);
  const ids = new Set<string>();
  const models: ModelSummary[] = [];
  for (const item of list(result.data, 1000)) {
    const model = object(item);
    const id = text(model.id, 256);
    if (!id || ids.has(id)) invalid();
    ids.add(id);
    const reasoning = list(model.supportedReasoningEfforts, 32).map((entry) => {
      const option = object(entry);
      text(option.description);
      return text(option.reasoningEffort, 64);
    });
    const defaultReasoning = text(model.defaultReasoningEffort, 64);
    if (!reasoning.includes(defaultReasoning)) invalid();
    const summary: ModelSummary = {
      id,
      model: text(model.model, 256),
      displayName: text(model.displayName, 1024),
      description: text(model.description),
      isDefault: flag(model.isDefault),
      reasoning,
      defaultReasoning,
    };
    if (!flag(model.hidden)) models.push(summary);
  }
  const cursor =
    result.nextCursor == null ? null : text(result.nextCursor, 4096);
  if (cursor === "") invalid();
  return { models, cursor };
}

export function decodeSkills(value: unknown, cwd: string): SkillSummary[] {
  const result = object(value);
  const entries = list(result.data, 1);
  if (entries.length !== 1) invalid();
  const entry = object(entries[0]);
  if (entry.cwd !== cwd) invalid();
  // Do not silently hide a failed scan behind a successful empty list.
  if (list(entry.errors, 1000).length) invalid();
  return list(entry.skills, 1000).map((item) => {
    const skill = object(item);
    return {
      name: text(skill.name, 1024),
      description: text(skill.description),
      enabled: flag(skill.enabled),
    };
  });
}
