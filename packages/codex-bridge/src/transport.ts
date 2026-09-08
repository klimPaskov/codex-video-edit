import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { isAbsolute } from "node:path";

export type TransportErrorCode =
  | "configuration"
  | "not_ready"
  | "closed"
  | "process_failed"
  | "protocol"
  | "timeout"
  | "capacity"
  | "remote_error";

const messages: Record<TransportErrorCode, string> = {
  configuration: "The Codex runtime configuration is invalid.",
  not_ready: "Codex has not completed initialization.",
  closed: "The Codex connection was closed. Check the draft before retrying.",
  process_failed:
    "The Codex connection ended. Check the draft before reconnecting.",
  protocol: "The Codex connection returned an unsupported response.",
  timeout:
    "Codex did not respond in time. Check the draft before reconnecting.",
  capacity: "Codex has too much pending work. Try again after it finishes.",
  remote_error: "Codex could not complete this request.",
};

/** Safe to classify at the application boundary; contains no protocol payload. */
export class CodexTransportError extends Error {
  readonly code: TransportErrorCode;
  readonly rpcCode: number | undefined;

  constructor(code: TransportErrorCode, rpcCode?: number) {
    super(messages[code]);
    this.name = "CodexTransportError";
    this.code = code;
    this.rpcCode = rpcCode;
  }
}

export interface ServerRequest {
  id: string | number;
  method: string;
  params: unknown;
  signal: AbortSignal;
}

export interface CodexTransportOptions {
  /** Main-owned resolved native executable. Never a shell command or renderer input. */
  executable: string;
  args: readonly string[];
  cwd: string;
  /** Explicit environment; the transport does not merge process.env. */
  env: NodeJS.ProcessEnv;
  requestTimeoutMs?: number;
  serverRequestTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  maxLineBytes?: number;
  maxPendingRequests?: number;
  /** Internal protocol boundary only. Validate before exposing application state. */
  onNotification?: (method: string, params: unknown) => void;
  /** Missing/throwing handlers fail closed with a fixed RPC error, never approval. */
  onServerRequest?: (request: ServerRequest) => Promise<unknown>;
  onDisconnect?: (error: CodexTransportError) => void;
}

interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: CodexTransportError) => void;
  timer: NodeJS.Timeout;
}

interface Session {
  child: ChildProcessWithoutNullStreams;
  ended: Promise<void>;
  pending: Map<number, Pending>;
  serverRequests: Map<string | number, AbortController>;
  buffer: Buffer;
  buffered: number;
  failed: boolean;
  ready: boolean;
  initialization: Promise<unknown>;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(value: unknown): value is string | number {
  return (
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && value.length > 0 && value.length <= 256)
  );
}

function bounded(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > max) {
    throw new CodexTransportError("configuration");
  }
  return result;
}

/**
 * Bounded stdio JSONL transport. Owns one process at a time; reconnection is explicit
 * and never replays requests. Domain/protocol validation belongs in the pinned wrapper.
 */
export class CodexStdioTransport {
  private readonly options: CodexTransportOptions;
  private readonly timeout: number;
  private readonly serverTimeout: number;
  private readonly shutdownTimeout: number;
  private readonly maxLine: number;
  private readonly maxPending: number;
  private session: Session | undefined;
  private closing: Promise<void> | undefined;
  private nextId = 1;

  constructor(options: CodexTransportOptions) {
    if (
      !isAbsolute(options.executable) ||
      /\.(?:cmd|bat|ps1)$/i.test(options.executable) ||
      !isAbsolute(options.cwd) ||
      options.executable.includes("\0") ||
      options.cwd.includes("\0") ||
      options.args.some((arg) => typeof arg !== "string" || arg.includes("\0"))
    ) {
      throw new CodexTransportError("configuration");
    }
    this.options = {
      ...options,
      args: [...options.args],
      env: { ...options.env },
    };
    this.timeout = bounded(options.requestTimeoutMs, 30_000, 600_000);
    this.serverTimeout = bounded(
      options.serverRequestTimeoutMs,
      60_000,
      600_000,
    );
    this.shutdownTimeout = bounded(options.shutdownTimeoutMs, 2_000, 30_000);
    this.maxLine = bounded(
      options.maxLineBytes,
      4 * 1024 * 1024,
      16 * 1024 * 1024,
    );
    this.maxPending = bounded(options.maxPendingRequests, 64, 1024);
  }

  get state(): "closed" | "initializing" | "ready" {
    if (!this.session || this.session.failed) return "closed";
    return this.session.ready ? "ready" : "initializing";
  }

  start(initializeParams: unknown): Promise<unknown> {
    if (this.closing) return Promise.reject(new CodexTransportError("closed"));
    if (this.session) {
      return this.session.failed
        ? Promise.reject(new CodexTransportError("closed"))
        : this.session.initialization;
    }
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(this.options.executable, [...this.options.args], {
        cwd: this.options.cwd,
        env: this.options.env,
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      return Promise.reject(new CodexTransportError("process_failed"));
    }
    const session: Session = {
      child,
      ended: new Promise<void>((resolve) =>
        child.once("close", () => resolve()),
      ),
      pending: new Map(),
      serverRequests: new Map(),
      buffer: Buffer.alloc(this.maxLine),
      buffered: 0,
      failed: false,
      ready: false,
      initialization: Promise.resolve(),
    };
    this.session = session;
    child.stderr.resume(); // Drain without collecting potentially sensitive diagnostics.
    child.on("error", () => this.fail(session, "process_failed"));
    child.stdin.on("error", () => this.fail(session, "process_failed"));
    child.stdout.on("error", () => this.fail(session, "process_failed"));
    child.stderr.on("error", () => this.fail(session, "process_failed"));
    child.stdout.on("data", (chunk: Buffer) => this.receive(session, chunk));
    child.stdout.on("end", () => {
      this.fail(session, session.buffered ? "protocol" : "process_failed");
    });
    child.on("close", () => this.fail(session, "process_failed"));
    session.initialization = this.sendRequest(
      session,
      "initialize",
      initializeParams,
    )
      .then((result) => {
        this.write(session, { method: "initialized" });
        session.ready = true;
        return result;
      })
      .catch((error: unknown) => {
        this.fail(session, "process_failed");
        throw error;
      });
    return session.initialization;
  }

  request(method: string, params: unknown): Promise<unknown> {
    const session = this.session;
    if (!session?.ready || session.failed || this.reserved(method)) {
      return Promise.reject(new CodexTransportError("not_ready"));
    }
    return this.sendRequest(session, method, params);
  }

  notify(method: string, params: unknown): void {
    const session = this.session;
    if (!session?.ready || session.failed || this.reserved(method)) {
      throw new CodexTransportError("not_ready");
    }
    this.assertMethod(method);
    this.write(session, { method, params });
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    const session = this.session;
    if (!session) return Promise.resolve();
    this.fail(session, "closed");
    this.closing = (async () => {
      const timer = setTimeout(
        () => session.child.kill("SIGKILL"),
        this.shutdownTimeout,
      );
      try {
        await session.ended;
      } finally {
        clearTimeout(timer);
        if (this.session === session) this.session = undefined;
        this.closing = undefined;
      }
    })();
    return this.closing;
  }

  async restart(initializeParams: unknown): Promise<unknown> {
    await this.close();
    return this.start(initializeParams);
  }

  private reserved(method: string): boolean {
    return method === "initialize" || method === "initialized";
  }

  private assertMethod(method: string): void {
    if (typeof method !== "string" || !method.length || method.length > 256) {
      throw new CodexTransportError("protocol");
    }
  }

  private sendRequest(
    session: Session,
    method: string,
    params: unknown,
  ): Promise<unknown> {
    if (session.failed)
      return Promise.reject(new CodexTransportError("closed"));
    if (
      session.pending.size >= this.maxPending ||
      !Number.isSafeInteger(this.nextId)
    ) {
      return Promise.reject(new CodexTransportError("capacity"));
    }
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(
        () => this.fail(session, "timeout"),
        this.timeout,
      );
      session.pending.set(id, { resolve, reject, timer });
      try {
        this.assertMethod(method);
        this.write(session, { id, method, params });
      } catch (error) {
        clearTimeout(timer);
        session.pending.delete(id);
        reject(
          error instanceof CodexTransportError
            ? error
            : new CodexTransportError("protocol"),
        );
      }
    });
  }

  private write(session: Session, message: unknown): void {
    if (session.failed) throw new CodexTransportError("closed");
    let encoded: string;
    try {
      encoded = JSON.stringify(message) + "\n";
    } catch {
      throw new CodexTransportError("protocol");
    }
    if (Buffer.byteLength(encoded) - 1 > this.maxLine) {
      throw new CodexTransportError("capacity");
    }
    if (
      session.child.stdin.writableLength + Buffer.byteLength(encoded) >
      this.maxLine * 2
    ) {
      this.fail(session, "capacity");
      throw new CodexTransportError("capacity");
    }
    session.child.stdin.write(encoded, (error) => {
      if (error) this.fail(session, "process_failed");
    });
  }

  private receive(session: Session, chunk: Buffer): void {
    if (session.failed) return;
    let offset = 0;
    while (offset < chunk.length && !session.failed) {
      const newline = chunk.indexOf(10, offset);
      const end = newline < 0 ? chunk.length : newline;
      const part = chunk.subarray(offset, end);
      if (session.buffered + part.length > this.maxLine) {
        this.fail(session, "protocol");
        return;
      }
      part.copy(session.buffer, session.buffered);
      session.buffered += part.length;
      if (newline < 0) return;
      const line = session.buffer.subarray(0, session.buffered);
      session.buffered = 0;
      try {
        const message: unknown = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(line),
        );
        this.dispatch(session, message);
      } catch {
        this.fail(session, "protocol");
      }
      offset = newline + 1;
    }
  }

  private dispatch(session: Session, message: unknown): void {
    if (
      !record(message) ||
      ("jsonrpc" in message && message.jsonrpc !== "2.0")
    ) {
      throw new CodexTransportError("protocol");
    }
    if ("method" in message) {
      if (
        typeof message.method !== "string" ||
        "result" in message ||
        "error" in message
      ) {
        throw new CodexTransportError("protocol");
      }
      this.assertMethod(message.method);
      if ("id" in message) {
        if (!validId(message.id)) throw new CodexTransportError("protocol");
        this.handleServerRequest(
          session,
          message.id,
          message.method,
          message.params,
        );
      } else {
        const delivered = this.options.onNotification?.(
          message.method,
          message.params,
        );
        void Promise.resolve(delivered).catch(() =>
          this.fail(session, "protocol"),
        );
      }
      return;
    }
    if (
      typeof message.id !== "number" ||
      !Number.isSafeInteger(message.id) ||
      "result" in message === "error" in message
    ) {
      throw new CodexTransportError("protocol");
    }
    const pending = session.pending.get(message.id);
    if (!pending) throw new CodexTransportError("protocol");
    if ("error" in message) {
      if (
        !record(message.error) ||
        !Number.isSafeInteger(message.error.code) ||
        typeof message.error.message !== "string"
      ) {
        throw new CodexTransportError("protocol");
      }
      pending.reject(
        new CodexTransportError("remote_error", message.error.code as number),
      );
    } else {
      pending.resolve(message.result);
    }
    clearTimeout(pending.timer);
    session.pending.delete(message.id);
  }

  private handleServerRequest(
    session: Session,
    id: string | number,
    method: string,
    params: unknown,
  ): void {
    if (
      session.serverRequests.has(id) ||
      session.serverRequests.size >= this.maxPending
    ) {
      throw new CodexTransportError("protocol");
    }
    const controller = new AbortController();
    session.serverRequests.set(id, controller);
    const timer = setTimeout(() => {
      controller.abort();
      finish({ error: { code: -32603, message: "Client request timed out." } });
    }, this.serverTimeout);
    const finish = (
      response:
        { result: unknown } | { error: { code: number; message: string } },
    ) => {
      if (session.serverRequests.get(id) !== controller) return;
      clearTimeout(timer);
      session.serverRequests.delete(id);
      if (!session.failed) {
        try {
          this.write(session, { id, ...response });
        } catch {
          this.fail(session, "protocol");
        }
      }
    };
    controller.signal.addEventListener("abort", () => clearTimeout(timer), {
      once: true,
    });
    if (!session.ready || !this.options.onServerRequest) {
      finish({
        error: { code: -32601, message: "Client method is not supported." },
      });
      return;
    }
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) throw new CodexTransportError("closed");
        return this.options.onServerRequest!({
          id,
          method,
          params,
          signal: controller.signal,
        });
      })
      .then(
        (result) =>
          finish(
            result === undefined
              ? { error: { code: -32603, message: "Client request failed." } }
              : { result },
          ),
        () =>
          finish({
            error: { code: -32603, message: "Client request failed." },
          }),
      );
  }

  private fail(session: Session, code: TransportErrorCode): void {
    if (session.failed) return;
    session.failed = true;
    session.ready = false;
    session.buffer = Buffer.alloc(0);
    session.buffered = 0;
    const error = new CodexTransportError(code);
    for (const pending of session.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    session.pending.clear();
    for (const controller of session.serverRequests.values())
      controller.abort();
    session.serverRequests.clear();
    session.child.stdin.destroy();
    session.child.kill();
    const killTimer = setTimeout(
      () => session.child.kill("SIGKILL"),
      this.shutdownTimeout,
    );
    void session.ended.then(() => clearTimeout(killTimer));
    try {
      this.options.onDisconnect?.(error);
    } catch {
      // A consumer callback cannot prevent process/pending-request cleanup.
    }
  }
}
