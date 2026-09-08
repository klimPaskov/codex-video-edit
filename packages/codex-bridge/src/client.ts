import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, normalize } from "node:path";
import { promisify } from "node:util";
import type { InitializeParams } from "./generated/InitializeParams.ts";
import type { GetAccountParams } from "./generated/v2/GetAccountParams.ts";
import type { ModelListParams } from "./generated/v2/ModelListParams.ts";
import type { SkillsListParams } from "./generated/v2/SkillsListParams.ts";
import { CodexAuthController, type AuthState } from "./auth.ts";
import {
  decodeAccount,
  decodeInitialization,
  decodeModels,
  decodeSkills,
  decodeRateLimits,
  validateRateLimitsUpdate,
  type AccountState,
  type ModelSummary,
  type SkillSummary,
  type RateLimitsSummary,
} from "./metadata.ts";
import { CodexStdioTransport, CodexTransportError } from "./transport.ts";

export const CODEX_VERSION = "0.142.3";
const execute = promisify(execFile);
const environmentKeys = ["PATH", "SystemRoot", "WINDIR", "TMP", "TEMP"];

export interface CodexClientOptions {
  executable: string;
  /** Dedicated main-owned context directory, never the app source repository. */
  cwd: string;
  /** Dedicated account/config directory owned by the official client. */
  codexHome: string;
  environment: NodeJS.ProcessEnv;
  onSkillsChanged?: () => void;
  onAuthStateChanged?: (state: AuthState) => void;
  onRateLimitsChanged?: () => void;
}

/** Main-process-only bootstrap client. No arbitrary RPC, turns or edit tools exposed. */
export class CodexClient {
  private readonly options: CodexClientOptions;
  private transport: CodexStdioTransport | undefined;
  private connecting = false;
  private startupAbort: AbortController | undefined;
  private startupFinished: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private auth: CodexAuthController | undefined;

  constructor(options: CodexClientOptions) {
    for (const path of [options.executable, options.cwd, options.codexHome]) {
      if (!isAbsolute(path) || path.includes("\0"))
        throw new CodexTransportError("configuration");
    }
    this.options = { ...options, environment: { ...options.environment } };
  }

  async connect(): Promise<void> {
    if (this.closing) throw new CodexTransportError("closed");
    if (this.transport || this.connecting)
      throw new CodexTransportError("configuration");
    this.connecting = true;
    const startupAbort = new AbortController();
    this.startupAbort = startupAbort;
    let finishStartup!: () => void;
    this.startupFinished = new Promise<void>((resolve) => {
      finishStartup = resolve;
    });
    let transport: CodexStdioTransport | undefined;
    let auth: CodexAuthController | undefined;
    try {
      const executable = await realpath(this.options.executable);
      const cwd = await realpath(this.options.cwd);
      const codexHome = await realpath(this.options.codexHome);
      if (
        !(await stat(cwd)).isDirectory() ||
        !(await stat(codexHome)).isDirectory()
      )
        throw new CodexTransportError("configuration");
      const env: NodeJS.ProcessEnv = {
        HOME: dirname(codexHome),
        USERPROFILE: dirname(codexHome),
        CODEX_HOME: codexHome,
      };
      for (const key of environmentKeys) {
        const value = this.options.environment[key];
        if (value !== undefined) env[key] = value;
      }
      const version = await execute(executable, ["--version"], {
        cwd,
        env,
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 4096,
        encoding: "utf8",
        signal: startupAbort.signal,
      });
      if (startupAbort.signal.aborted) throw new CodexTransportError("closed");
      if (version.stdout.trim() !== `codex-cli ${CODEX_VERSION}`)
        throw new CodexTransportError("protocol");
      transport = new CodexStdioTransport({
        executable,
        args: [
          "app-server",
          "--listen",
          "stdio://",
          "-c",
          'forced_login_method="chatgpt"',
          "-c",
          'model_provider="openai"',
          "-c",
          "features.shell_tool=false",
          "-c",
          "project_root_markers=[]",
        ],
        cwd,
        env,
        onNotification: (method, params) => {
          if (method === "skills/changed") this.options.onSkillsChanged?.();
          auth?.notification(method, params);
          if (method === "account/rateLimits/updated") {
            validateRateLimitsUpdate(params);
            this.options.onRateLimitsChanged?.();
          }
        },
        onDisconnect: () => auth?.close(),
      });
      this.transport = transport;
      const connectedTransport = transport;
      auth = new CodexAuthController({
        request: (method, params) => connectedTransport.request(method, params),
        onChanged: (state) => {
          if (this.auth === auth) this.options.onAuthStateChanged?.(state);
        },
      });
      this.auth = auth;
      const params: InitializeParams = {
        clientInfo: {
          name: "codex_video_edit",
          title: "codex-video-edit",
          version: "0.0.0",
        },
        capabilities: null,
      };
      const response = decodeInitialization(await transport.start(params));
      if (normalize(response.codexHome) !== normalize(codexHome))
        throw new CodexTransportError("protocol");
      if (startupAbort.signal.aborted) throw new CodexTransportError("closed");
    } catch (error) {
      auth?.close();
      if (this.auth === auth) this.auth = undefined;
      await transport?.close();
      if (this.transport === transport) this.transport = undefined;
      if (startupAbort.signal.aborted) throw new CodexTransportError("closed");
      if (error instanceof CodexTransportError) throw error;
      throw new CodexTransportError("process_failed");
    } finally {
      this.connecting = false;
      this.startupAbort = undefined;
      this.startupFinished = undefined;
      finishStartup();
    }
  }

  private ready(): CodexStdioTransport {
    if (this.connecting || !this.transport || this.transport.state !== "ready")
      throw new CodexTransportError("not_ready");
    return this.transport;
  }

  async account(): Promise<AccountState> {
    this.ready();
    return this.auth!.refreshAccount();
  }

  authState(): AuthState {
    return (
      this.auth?.snapshot() ?? { status: "idle", account: null, error: null }
    );
  }
  /** Main-only result. Never serialize its URL to the packaged renderer. */
  async startLogin(): Promise<{ authUrl: string } | null> {
    this.ready();
    return this.auth!.startLogin();
  }
  async cancelLogin(): Promise<void> {
    this.ready();
    await this.auth!.cancelLogin();
  }
  async logout(): Promise<void> {
    this.ready();
    await this.auth!.logout();
  }
  async rateLimits(): Promise<RateLimitsSummary> {
    const transport = this.ready();
    if ((await this.account()).status !== "chatgpt")
      throw new CodexTransportError("not_ready");
    return decodeRateLimits(
      await transport.request("account/rateLimits/read", undefined),
    );
  }

  async models(): Promise<ModelSummary[]> {
    const transport = this.ready();
    const accountParams: GetAccountParams = { refreshToken: false };
    if (
      decodeAccount(await transport.request("account/read", accountParams))
        .status !== "chatgpt"
    )
      throw new CodexTransportError("not_ready");
    const models: ModelSummary[] = [];
    const cursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const params: ModelListParams = {
        cursor,
        limit: 100,
        includeHidden: false,
      };
      const page = decodeModels(await transport.request("model/list", params));
      models.push(...page.models);
      cursor = page.cursor;
      if (
        models.length > 1000 ||
        cursors.size >= 100 ||
        (cursor && cursors.has(cursor))
      )
        throw new CodexTransportError("protocol");
      if (cursor) cursors.add(cursor);
    } while (cursor);
    if (new Set(models.map((model) => model.id)).size !== models.length)
      throw new CodexTransportError("protocol");
    return models;
  }

  async skills(): Promise<SkillSummary[]> {
    const cwd = await realpath(this.options.cwd);
    const params: SkillsListParams = { cwds: [cwd], forceReload: true };
    return decodeSkills(await this.ready().request("skills/list", params), cwd);
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    const startupFinished = this.startupFinished;
    this.startupAbort?.abort();
    this.auth?.close();
    this.auth = undefined;
    const transport = this.transport;
    this.transport = undefined;
    this.closing = Promise.all([transport?.close(), startupFinished])
      .then(() => {})
      .finally(() => {
        this.closing = undefined;
      });
    return this.closing;
  }
}
