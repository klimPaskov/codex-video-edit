import type { LoginAccountParams } from "./generated/v2/LoginAccountParams.ts";
import type { LoginAccountResponse } from "./generated/v2/LoginAccountResponse.ts";
import type { CancelLoginAccountParams } from "./generated/v2/CancelLoginAccountParams.ts";
import type { CancelLoginAccountResponse } from "./generated/v2/CancelLoginAccountResponse.ts";
import type { AccountLoginCompletedNotification } from "./generated/v2/AccountLoginCompletedNotification.ts";
import type { AccountUpdatedNotification } from "./generated/v2/AccountUpdatedNotification.ts";
import {
  decodeAccount,
  decodePlan,
  object,
  text,
  type AccountState,
} from "./metadata.ts";
import { CodexTransportError } from "./transport.ts";

export interface AuthState {
  status:
    | "idle"
    | "starting"
    | "awaiting_browser"
    | "reconciling"
    | "canceling"
    | "failed";
  account: AccountState | null;
  error: "login_failed" | "login_timed_out" | "connection_lost" | null;
}
type Login = Extract<LoginAccountResponse, { type: "chatgpt" }>;
type Completion = Pick<
  AccountLoginCompletedNotification,
  "loginId" | "success"
>;
interface Attempt {
  id: string | undefined;
  canceled: boolean;
  timedOut: boolean;
  completed: boolean;
  early: Completion[];
  started: Promise<Login>;
  canceling: Promise<void> | undefined;
  timer: NodeJS.Timeout;
}
export interface AuthControllerOptions {
  /** Private transport boundary supplied by CodexClient, never by the renderer. */
  request: (method: string, params: unknown) => Promise<unknown>;
  onChanged?: (state: AuthState) => void;
  loginTimeoutMs?: number;
}

function invalid(): never {
  throw new CodexTransportError("protocol");
}

/** Validate only the initial URL returned by the pinned managed browser flow. */
export function validateLoginUrl(value: unknown): string {
  const original = text(value, 16384);
  if (
    !original.startsWith("https://auth.openai.com/oauth/authorize?") ||
    /[\u0000-\u0020\u007f]/.test(original)
  )
    invalid();
  let url: URL;
  try {
    url = new URL(original);
  } catch {
    return invalid();
  }
  if (
    url.origin !== "https://auth.openai.com" ||
    url.pathname !== "/oauth/authorize" ||
    url.username ||
    url.password ||
    url.hash ||
    url.port
  )
    invalid();
  const required: Record<string, string | undefined> = {
    redirect_uri: undefined,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: undefined,
    state: undefined,
  };
  for (const [name, expected] of Object.entries(required)) {
    const values = url.searchParams.getAll(name);
    if (
      values.length !== 1 ||
      !values[0] ||
      (expected !== undefined && values[0] !== expected)
    )
      invalid();
  }
  if (
    ![
      "http://localhost:1455/auth/callback",
      "http://localhost:1457/auth/callback",
    ].includes(url.searchParams.get("redirect_uri")!)
  )
    invalid();
  if (!/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("code_challenge")!))
    invalid();
  return original;
}
export function decodeLogin(value: unknown): Login {
  const response = object(value);
  if (response.type !== "chatgpt") invalid();
  const loginId = text(response.loginId, 256);
  if (!loginId) invalid();
  return {
    type: "chatgpt",
    loginId,
    authUrl: validateLoginUrl(response.authUrl),
  };
}
export function decodeCompletion(value: unknown): Completion {
  const notice = object(value);
  const loginId = notice.loginId == null ? null : text(notice.loginId, 256);
  if (loginId === "" || typeof notice.success !== "boolean") invalid();
  // Validate and discard the private error; never pass it to UI state.
  if (notice.error != null) text(notice.error, 16384);
  return { loginId, success: notice.success };
}
export function validateAccountUpdate(value: unknown): void {
  const notice = object(value);
  const mode: AccountUpdatedNotification["authMode"] =
    notice.authMode == null
      ? null
      : (notice.authMode as AccountUpdatedNotification["authMode"]);
  if (mode !== null && mode !== "chatgpt") invalid();
  if (notice.planType != null) decodePlan(notice.planType);
}
function decodeCancel(value: unknown): CancelLoginAccountResponse {
  const response = object(value);
  if (response.status !== "canceled" && response.status !== "notFound")
    invalid();
  return { status: response.status };
}

/** One instance per connection generation. Close invalidates every pending async result. */
export class CodexAuthController {
  private readonly options: AuthControllerOptions;
  private readonly timeout: number;
  private active = true;
  private attempt: Attempt | undefined;
  private readSequence = 0;
  private loggingOut = false;
  private state: AuthState = { status: "idle", account: null, error: null };

  constructor(options: AuthControllerOptions) {
    this.options = options;
    this.timeout = options.loginTimeoutMs ?? 10 * 60_000;
    if (
      !Number.isSafeInteger(this.timeout) ||
      this.timeout < 1 ||
      this.timeout > 30 * 60_000
    )
      throw new CodexTransportError("configuration");
  }
  snapshot(): AuthState {
    return structuredClone(this.state);
  }
  private publish(patch: Partial<AuthState>): void {
    if (!this.active) return;
    this.state = { ...this.state, ...patch };
    this.options.onChanged?.(this.snapshot());
  }
  private ready(): void {
    if (!this.active) throw new CodexTransportError("closed");
  }
  private discard(attempt: Attempt): void {
    clearTimeout(attempt.timer);
    attempt.id = undefined;
    attempt.early = [];
    if (this.attempt === attempt) this.attempt = undefined;
  }
  async refreshAccount(): Promise<AccountState> {
    this.ready();
    const sequence = ++this.readSequence;
    const account = decodeAccount(
      await this.options.request("account/read", { refreshToken: false }),
    );
    this.ready();
    if (sequence === this.readSequence) {
      const attempt = this.attempt;
      if (
        attempt?.completed &&
        !attempt.canceled &&
        account.status === "chatgpt"
      ) {
        this.discard(attempt);
        this.publish({ account, status: "idle", error: null });
      } else this.publish({ account });
    }
    if (sequence !== this.readSequence) {
      if (this.state.account === null)
        throw new CodexTransportError("not_ready");
      return structuredClone(this.state.account);
    }
    return account;
  }
  async startLogin(): Promise<{ authUrl: string } | null> {
    this.ready();
    if (this.attempt || this.loggingOut)
      throw new CodexTransportError("not_ready");
    this.readSequence++;
    const params: LoginAccountParams = { type: "chatgpt" };
    const started = this.options
      .request("account/login/start", params)
      .then(decodeLogin);
    const attempt: Attempt = {
      id: undefined,
      canceled: false,
      timedOut: false,
      completed: false,
      early: [],
      started,
      canceling: undefined,
      timer: setTimeout(() => {
        if (this.attempt !== attempt || !this.active) return;
        attempt.timedOut = true;
        void this.cancelLogin().catch(() =>
          this.publish({ status: "failed", error: "login_timed_out" }),
        );
      }, this.timeout),
    };
    this.attempt = attempt;
    this.publish({ status: "starting", error: null });
    try {
      const login = await started;
      this.ready();
      if (this.attempt !== attempt) return null;
      attempt.id = login.loginId;
      if (attempt.canceled) {
        await this.cancelAttempt(attempt);
        return null;
      }
      for (const notice of attempt.early) this.complete(attempt, notice);
      attempt.early = [];
      if (this.attempt !== attempt || attempt.completed) return null;
      this.publish({ status: "awaiting_browser" });
      return { authUrl: login.authUrl };
    } catch (error) {
      if (this.attempt === attempt) {
        this.discard(attempt);
        this.publish({ status: "failed", error: "login_failed" });
      }
      throw error instanceof CodexTransportError
        ? error
        : new CodexTransportError("protocol");
    }
  }
  async cancelLogin(): Promise<void> {
    this.ready();
    const attempt = this.attempt;
    if (!attempt) return;
    attempt.canceled = true;
    this.readSequence++;
    this.publish({ status: "canceling", error: null });
    await this.cancelAttempt(attempt);
  }
  private cancelAttempt(attempt: Attempt): Promise<void> {
    if (attempt.canceling) return attempt.canceling;
    attempt.canceling = (async () => {
      try {
        const login = await attempt.started;
        this.ready();
        if (this.attempt !== attempt) return;
        const params: CancelLoginAccountParams = { loginId: login.loginId };
        decodeCancel(
          await this.options.request("account/login/cancel", params),
        );
        this.ready();
        clearTimeout(attempt.timer);
        attempt.id = undefined;
        attempt.early = [];
        // canceled and notFound both require reading the account. Cancellation may race success.
        await this.refreshAccount();
        if (this.attempt !== attempt) return;
        this.discard(attempt);
        this.publish({
          status: attempt.timedOut ? "failed" : "idle",
          error: attempt.timedOut ? "login_timed_out" : null,
        });
      } catch (error) {
        if (this.attempt === attempt) {
          this.discard(attempt);
          this.publish({
            status: "failed",
            error: attempt.timedOut ? "login_timed_out" : "login_failed",
          });
        }
        throw error instanceof CodexTransportError
          ? error
          : new CodexTransportError("protocol");
      }
    })();
    return attempt.canceling;
  }
  private complete(attempt: Attempt, notice: Completion): void {
    if (
      this.attempt !== attempt ||
      attempt.canceled ||
      notice.loginId !== attempt.id ||
      attempt.completed
    )
      return;
    if (!notice.success) {
      this.discard(attempt);
      this.publish({ status: "failed", error: "login_failed" });
      return;
    }
    attempt.completed = true;
    this.publish({ status: "reconciling" });
    // Completion precedes the runtime auth reload. A signed-out read cannot finish this attempt.
    void this.refreshAccount().catch(() => {
      if (this.attempt === attempt && !attempt.canceled)
        this.publish({ status: "failed", error: "login_failed" });
    });
  }
  notification(method: string, value: unknown): void {
    if (!this.active) return;
    if (method === "account/login/completed") {
      const notice = decodeCompletion(value);
      const attempt = this.attempt;
      if (!attempt || attempt.canceled) return;
      if (attempt.id === undefined) {
        if (attempt.early.length >= 8) invalid();
        attempt.early.push(notice);
      } else this.complete(attempt, notice);
    } else if (method === "account/updated") {
      validateAccountUpdate(value);
      if (!this.loggingOut) {
        const refresh = this.refreshAccount();
        const sequence = this.readSequence;
        void refresh.catch(() => {
          if (sequence === this.readSequence)
            this.publish({ status: "failed", error: "login_failed" });
        });
      }
    }
  }
  async logout(): Promise<void> {
    this.ready();
    if (this.loggingOut) throw new CodexTransportError("not_ready");
    this.loggingOut = true;
    try {
      await this.cancelLogin();
      this.publish({ status: "reconciling", error: null });
      if (
        Object.keys(
          object(await this.options.request("account/logout", undefined)),
        ).length
      )
        invalid();
      const account = await this.refreshAccount();
      if (account.status !== "signed_out") invalid();
      this.publish({ status: "idle", error: null });
    } catch (error) {
      this.publish({ status: "failed", error: "login_failed" });
      throw error instanceof CodexTransportError
        ? error
        : new CodexTransportError("protocol");
    } finally {
      this.loggingOut = false;
    }
  }
  close(): void {
    if (this.attempt) this.discard(this.attempt);
    this.readSequence++;
    this.publish({ status: "failed", account: null, error: "connection_lost" });
    this.active = false;
  }
}
