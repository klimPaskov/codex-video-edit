/** API-key providers are independent of the Codex App Server subscription account. */
export type ProviderId = "deepseek" | "openai";

export type ApiChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      toolCalls?: ApiToolCall[];
    }
  | { role: "tool"; content: string; toolCallId: string };

export interface ApiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ApiToolCall {
  id: string;
  name: string;
  /** Untrusted JSON text. The caller must parse and validate before executing. */
  arguments: string;
}

export interface ApiChatRequest {
  model: string;
  messages: ApiChatMessage[];
  tools?: ApiToolDefinition[];
  maxTokens?: number;
}

export interface ApiChatCompletion {
  model: string;
  content: string | null;
  toolCalls: ApiToolCall[];
  finishReason: string;
}

export type ApiProviderErrorCode =
  | "invalid_request"
  | "network_error"
  | "request_cancelled"
  | "request_timeout"
  | "authentication_failed"
  | "rate_limited"
  | "provider_rejected"
  | "invalid_response";

/** Never retain a provider error body, response headers, URL, or a key. */
export class ApiProviderError extends Error {
  readonly code: ApiProviderErrorCode;
  constructor(code: ApiProviderErrorCode) {
    super(code);
    this.name = "ApiProviderError";
    this.code = code;
  }
}
