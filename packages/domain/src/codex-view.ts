/** Bounded settings state only. Account tokens, login URLs and paths never cross IPC. */
export interface CodexSelection {
  modelId: string;
  reasoning: string;
}
export interface CodexView {
  connection: "disconnected" | "connected" | "unavailable";
  account: "unknown" | "signed_out" | "signing_in" | "signed_in";
  plan: string | null;
  busy: boolean;
  message: string | null;
  models: {
    id: string;
    name: string;
    reasoning: string[];
    defaultReasoning: string;
  }[];
  skills: { name: string; description: string; enabled: boolean }[];
  limits: { name: string; remainingPercent: number; resetsAt: number | null }[];
  selection: CodexSelection | null;
}

function invalid(): never {
  throw new Error("Invalid Codex settings state.");
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  if (Object.keys(value).sort().join() !== keys.sort().join()) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    invalid();
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value;
}
export function assertCodexSelection(
  value: unknown,
): asserts value is CodexSelection {
  const item = object(value, ["modelId", "reasoning"]);
  text(item.modelId, 256);
  text(item.reasoning, 64);
}
export function assertCodexView(value: unknown): asserts value is CodexView {
  const item = object(value, [
    "connection",
    "account",
    "plan",
    "busy",
    "message",
    "models",
    "skills",
    "limits",
    "selection",
  ]);
  if (
    !["disconnected", "connected", "unavailable"].includes(
      item.connection as string,
    ) ||
    !["unknown", "signed_out", "signing_in", "signed_in"].includes(
      item.account as string,
    ) ||
    typeof item.busy !== "boolean"
  )
    invalid();
  if (item.plan !== null) text(item.plan, 128);
  if (item.message !== null) text(item.message, 240);
  if (item.selection !== null) assertCodexSelection(item.selection);
  const ids = new Set<string>();
  for (const raw of list(item.models, 1000)) {
    const model = object(raw, ["id", "name", "reasoning", "defaultReasoning"]);
    text(model.id, 256);
    text(model.name, 1024);
    text(model.defaultReasoning, 64);
    if (ids.has(model.id)) invalid();
    ids.add(model.id);
    const reasoning = list(model.reasoning, 32);
    for (const entry of reasoning) text(entry, 64);
    if (
      new Set(reasoning).size !== reasoning.length ||
      !reasoning.includes(model.defaultReasoning)
    )
      invalid();
  }
  for (const raw of list(item.skills, 1000)) {
    const skill = object(raw, ["name", "description", "enabled"]);
    text(skill.name, 1024);
    if (
      typeof skill.description !== "string" ||
      skill.description.length > 16384 ||
      typeof skill.enabled !== "boolean"
    )
      invalid();
  }
  for (const raw of list(item.limits, 200)) {
    const limit = object(raw, ["name", "remainingPercent", "resetsAt"]);
    text(limit.name, 256);
    if (
      typeof limit.remainingPercent !== "number" ||
      !Number.isFinite(limit.remainingPercent) ||
      limit.remainingPercent < 0 ||
      limit.remainingPercent > 100
    )
      invalid();
    if (
      limit.resetsAt !== null &&
      (!Number.isSafeInteger(limit.resetsAt) || (limit.resetsAt as number) < 0)
    )
      invalid();
  }
  if (
    item.account !== "signed_in" &&
    (item.plan !== null ||
      (item.models as unknown[]).length ||
      (item.limits as unknown[]).length)
  )
    invalid();
  if (item.account === "signed_in" && item.connection !== "connected")
    invalid();
}
