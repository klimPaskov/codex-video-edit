/** Bounded, path-free state for user-supplied API-key providers. */
export type ApiProviderId = "deepseek" | "openai" | "gemini";
export const apiProviderIds = ["deepseek", "openai", "gemini"] as const;

export interface ApiProviderView {
  id: ApiProviderId;
  connected: boolean;
  remembered: boolean;
  canRemember: boolean;
  models: string[];
  selectedModel: string | null;
  busy: boolean;
  message:
    | "Connection failed. Check the key and try again."
    | "Secure storage is unavailable. Use this session only."
    | "Provider models are unavailable. Try reconnecting."
    | "Saved key is unavailable on this device. Remove it or connect again."
    | "No supported editing models are available for this key."
    | "Model choice could not be saved. Try again."
    | null;
}
export interface ApiProvidersView {
  providers: ApiProviderView[];
}
export interface ApiProviderConnectRequest {
  provider: ApiProviderId;
  key: string;
  remember: boolean;
}
export interface ApiProviderRequest {
  provider: ApiProviderId;
}
export interface ApiProviderModelRequest extends ApiProviderRequest {
  model: string;
}

const modelPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const issues = new Set([
  "Connection failed. Check the key and try again.",
  "Secure storage is unavailable. Use this session only.",
  "Provider models are unavailable. Try reconnecting.",
  "Saved key is unavailable on this device. Remove it or connect again.",
  "No supported editing models are available for this key.",
  "Model choice could not be saved. Try again.",
]);
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new Error("Invalid API provider exchange.");
  return value as Record<string, unknown>;
}
function provider(value: unknown): asserts value is ApiProviderId {
  if (value !== "deepseek" && value !== "openai" && value !== "gemini")
    throw new Error("Invalid API provider exchange.");
}
export function assertApiProviderConnectRequest(
  value: unknown,
): asserts value is ApiProviderConnectRequest {
  const request = exact(value, ["provider", "key", "remember"]);
  provider(request.provider);
  if (
    typeof request.key !== "string" ||
    request.key.length < 8 ||
    request.key.length > 1024 ||
    !/^[\x21-\x7e]+$/u.test(request.key) ||
    typeof request.remember !== "boolean"
  )
    throw new Error("Invalid API provider exchange.");
}
export function assertApiProviderRequest(
  value: unknown,
): asserts value is ApiProviderRequest {
  provider(exact(value, ["provider"]).provider);
}
export function assertApiProviderModelRequest(
  value: unknown,
): asserts value is ApiProviderModelRequest {
  const request = exact(value, ["provider", "model"]);
  provider(request.provider);
  if (typeof request.model !== "string" || !modelPattern.test(request.model))
    throw new Error("Invalid API provider exchange.");
}
export function assertApiProvidersView(
  value: unknown,
): asserts value is ApiProvidersView {
  const view = exact(value, ["providers"]);
  if (
    !Array.isArray(view.providers) ||
    view.providers.length !== apiProviderIds.length
  )
    throw new Error("Invalid API provider exchange.");
  const seen = new Set<string>();
  for (const entry of view.providers) {
    const state = exact(entry, [
      "id",
      "connected",
      "remembered",
      "canRemember",
      "models",
      "selectedModel",
      "busy",
      "message",
    ]);
    provider(state.id);
    if (seen.has(state.id)) throw new Error("Invalid API provider exchange.");
    seen.add(state.id);
    if (
      typeof state.connected !== "boolean" ||
      typeof state.remembered !== "boolean" ||
      typeof state.canRemember !== "boolean" ||
      typeof state.busy !== "boolean" ||
      !Array.isArray(state.models) ||
      state.models.length > 1024 ||
      state.models.some(
        (model) => typeof model !== "string" || !modelPattern.test(model),
      ) ||
      new Set(state.models).size !== state.models.length ||
      (state.selectedModel !== null &&
        (typeof state.selectedModel !== "string" ||
          !state.models.includes(state.selectedModel))) ||
      (state.message !== null && !issues.has(state.message as string)) ||
      (!state.connected &&
        (state.models.length > 0 || state.selectedModel !== null))
    )
      throw new Error("Invalid API provider exchange.");
  }
  if (apiProviderIds.some((id) => !seen.has(id)))
    throw new Error("Invalid API provider exchange.");
}
