import { lstat, mkdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  CodexClient,
  type CodexClientOptions,
} from "../../../packages/codex-bridge/src/client.ts";
import type { AuthState } from "../../../packages/codex-bridge/src/auth.ts";
import {
  resolveCodexRuntime,
  CodexRuntimeError,
} from "../../../packages/codex-bridge/src/runtime.ts";
import {
  assertCodexSelection,
  assertCodexView,
  type CodexView,
  type CodexSelection,
} from "../../../packages/domain/src/codex-view.ts";
import { CodexSettingsStore } from "./codex-settings.ts";

type Client = Pick<
  CodexClient,
  | "connect"
  | "close"
  | "account"
  | "authState"
  | "skills"
  | "models"
  | "rateLimits"
  | "startLogin"
  | "cancelLogin"
  | "logout"
>;
/** Internal deterministic-test seam; never renderer-selectable or exposed through IPC. */
export interface DesktopCodexDependencies {
  createClient: (options: CodexClientOptions) => Client;
  resolveRuntime: typeof resolveCodexRuntime;
  directory: (path: string) => Promise<void>;
  settings: Pick<CodexSettingsStore, "read" | "write">;
}

const initial = (): CodexView => ({
  connection: "disconnected",
  account: "unknown",
  plan: null,
  busy: false,
  message: null,
  models: [],
  skills: [],
  limits: [],
  selection: null,
});
const label = (value: string, max: number) =>
  value
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .slice(0, max)
    .trim();

/** Main owns runtime paths, credentials, login URLs and external launch authority. */
export class DesktopCodex {
  private state = initial();
  private client: Client | undefined;
  private attempted = false;
  private generation = 0;
  private refreshing: Promise<void> | undefined;
  private refreshAgain = false;
  private stopped = false;
  private startupFinished: Promise<void> | undefined;
  private actionFinished: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private authKey = "";
  private authRevision = 0;
  private readonly settings: Pick<CodexSettingsStore, "read" | "write">;
  private readonly dependencies: DesktopCodexDependencies;
  private readonly resources: string;
  private readonly userData: string;
  private readonly openLogin: (url: string) => Promise<void>;
  constructor(
    resources: string,
    userData: string,
    openLogin: (url: string) => Promise<void>,
    dependencies: Partial<DesktopCodexDependencies> = {},
  ) {
    this.resources = resources;
    this.userData = userData;
    this.openLogin = openLogin;
    this.dependencies = {
      createClient: (options) => new CodexClient(options),
      resolveRuntime: resolveCodexRuntime,
      directory: (path) => this.directory(path),
      settings: new CodexSettingsStore(join(userData, "codex-settings")),
      ...dependencies,
    };
    this.settings = this.dependencies.settings;
  }
  private current(generation: number, client?: Client): boolean {
    return (
      !this.stopped &&
      generation === this.generation &&
      (client === undefined || client === this.client)
    );
  }
  private applyAuth(auth: AuthState): void {
    const key = JSON.stringify(auth);
    if (key !== this.authKey) {
      this.authKey = key;
      this.authRevision++;
    }
    if (auth.error === "connection_lost") {
      this.state = {
        ...initial(),
        connection: "unavailable",
        busy: this.state.busy,
        message: "The Codex connection was lost. Reconnect to continue.",
      };
      return;
    }
    const pending = [
      "starting",
      "awaiting_browser",
      "reconciling",
      "canceling",
    ].includes(auth.status);
    this.state.account = pending
      ? "signing_in"
      : auth.account === null
        ? "unknown"
        : auth.account.status === "chatgpt"
          ? "signed_in"
          : "signed_out";
    this.state.plan =
      this.state.account === "signed_in" && auth.account?.status === "chatgpt"
        ? auth.account.plan
        : null;
    if (auth.error)
      this.state.message =
        auth.error === "login_timed_out"
          ? "Sign-in expired. Sign in again."
          : "Sign-in did not finish. Try again.";
    else if (
      [
        "Sign-in expired. Sign in again.",
        "Sign-in did not finish. Try again.",
      ].includes(this.state.message ?? "")
    )
      this.state.message = null;
    if (this.state.account !== "signed_in") {
      this.state.models = [];
      this.state.limits = [];
    }
  }
  private snapshot(): CodexView {
    assertCodexView(this.state);
    return structuredClone(this.state);
  }
  async get(): Promise<CodexView> {
    if (!this.attempted && !this.stopped) return this.reconnect();
    return this.snapshot();
  }
  private async directory(path: string): Promise<void> {
    await mkdir(path, { recursive: true, mode: 0o700 });
    const info = await lstat(path);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      resolve(await realpath(path)) !== resolve(path)
    )
      throw new Error("Invalid account storage");
  }
  async reconnect(): Promise<CodexView> {
    if (this.stopped || this.state.busy) return this.snapshot();
    this.attempted = true;
    const generation = ++this.generation;
    let finishStartup!: () => void;
    this.startupFinished = new Promise<void>((resolve) => {
      finishStartup = resolve;
    });
    const previous = this.client;
    this.client = undefined;
    this.state = { ...initial(), busy: true };
    this.authKey = "";
    this.authRevision++;
    this.refreshAgain = false;
    try {
      await previous?.close();
      await this.refreshing;
      if (!this.current(generation)) return this.snapshot();
      const executable = await this.dependencies.resolveRuntime(this.resources);
      if (!this.current(generation)) return this.snapshot();
      const root = join(this.userData, "codex");
      const cwd = join(root, "context"),
        codexHome = join(root, "account");
      for (const path of [root, cwd, codexHome]) {
        await this.dependencies.directory(path);
        if (!this.current(generation)) return this.snapshot();
      }
      if (this.stopped || generation !== this.generation)
        return this.snapshot();
      let lastAuthKey = "";
      const update = () => {
        if (
          generation === this.generation &&
          this.state.connection === "connected"
        )
          if (this.refreshing) this.refreshAgain = true;
          else void this.refresh();
      };
      const client = this.dependencies.createClient({
        executable,
        cwd,
        codexHome,
        environment: process.env,
        onAuthStateChanged: (state) => {
          if (!this.current(generation)) return;
          const key = JSON.stringify(state);
          if (key !== lastAuthKey) {
            lastAuthKey = key;
            if (this.state.connection === "connected") this.applyAuth(state);
            update();
          }
        },
        onSkillsChanged: update,
        onRateLimitsChanged: update,
      });
      this.client = client;
      await client.connect();
      if (this.stopped || generation !== this.generation) {
        await client.close();
        return this.snapshot();
      }
      this.state.connection = "connected";
      try {
        const selection = await this.settings.read();
        if (this.current(generation, client)) this.state.selection = selection;
      } catch {
        if (this.current(generation, client))
          this.state.message =
            "Saved model settings could not be loaded. Check local storage access and reconnect.";
      }
      if (this.current(generation, client)) await this.refresh();
    } catch (error) {
      if (generation === this.generation) {
        await this.client?.close();
        this.client = undefined;
        this.state = {
          ...initial(),
          connection: "unavailable",
          message:
            error instanceof CodexRuntimeError
              ? error.message
              : "Codex could not connect. Reconnect to try again.",
        };
      }
    } finally {
      if (generation === this.generation) this.state.busy = false;
      this.startupFinished = undefined;
      finishStartup();
    }
    return this.snapshot();
  }
  private refresh(changed = false): Promise<void> {
    if (this.refreshing) {
      if (changed) this.refreshAgain = true;
      return this.refreshing;
    }
    const client = this.client,
      generation = this.generation;
    if (!client || this.stopped || this.state.connection !== "connected")
      return Promise.resolve();
    this.refreshing = (async () => {
      await Promise.resolve();
      do {
        this.refreshAgain = false;
        await this.refreshOnce(client, generation);
      } while (
        this.refreshAgain &&
        this.current(generation, client) &&
        this.state.connection === "connected"
      );
    })().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }
  private async refreshOnce(client: Client, generation: number): Promise<void> {
    try {
      await client.account();
      if (
        !this.current(generation, client) ||
        this.state.connection !== "connected"
      )
        return;
      this.applyAuth(client.authState());
      if (this.state.connection !== "connected") return;
      const revision = this.authRevision;
      const work = await Promise.allSettled([
        client.skills(),
        ...(this.state.account === "signed_in"
          ? [client.models(), client.rateLimits()]
          : []),
      ]);
      if (
        !this.current(generation, client) ||
        this.state.connection !== "connected"
      )
        return;
      this.applyAuth(client.authState());
      if (this.state.connection !== "connected") return;
      if (revision !== this.authRevision) {
        this.refreshAgain = true;
        return;
      }
      this.state.skills = [];
      this.state.models = [];
      this.state.limits = [];
      const skills = work[0];
      if (skills?.status === "fulfilled" && Array.isArray(skills.value))
        this.state.skills = (
          skills.value as Awaited<ReturnType<CodexClient["skills"]>>
        ).map((entry) => ({
          ...entry,
          name: label(entry.name, 1024) || "Unnamed skill",
        }));
      const models = work[1];
      if (models?.status === "fulfilled" && Array.isArray(models.value))
        this.state.models = (
          models.value as Awaited<ReturnType<CodexClient["models"]>>
        ).map((entry) => ({
          id: entry.id,
          name: label(entry.displayName, 1024) || entry.id,
          reasoning: entry.reasoning,
          defaultReasoning: entry.defaultReasoning,
        }));
      const limits = work[2];
      if (limits?.status === "fulfilled" && !Array.isArray(limits.value)) {
        this.state.limits = [];
        for (const bucket of limits.value.buckets)
          for (const [kind, window] of [
            ["Primary", bucket.primary],
            ["Secondary", bucket.secondary],
          ] as const) {
            if (window)
              this.state.limits.push({
                name: label(
                  `${bucket.name ?? bucket.id ?? "Codex"} · ${kind}`,
                  256,
                ),
                remainingPercent: window.remainingPercent,
                resetsAt: window.resetsAt,
              });
          }
      }
      if (work.some((result) => result.status === "rejected"))
        this.state.message =
          "Some Codex settings could not be refreshed. Reconnect to try again.";
      else if (this.state.account === "signed_in" && !this.state.models.length)
        this.state.message =
          "No compatible Codex models are available for this account. Reconnect or check your ChatGPT access.";
      else if (
        [
          "Some Codex settings could not be refreshed. Reconnect to try again.",
          "No compatible Codex models are available for this account. Reconnect or check your ChatGPT access.",
        ].includes(this.state.message ?? "")
      )
        this.state.message = null;
      if (
        this.state.selection &&
        models?.status === "fulfilled" &&
        !this.state.models.some(
          (model) =>
            model.id === this.state.selection?.modelId &&
            model.reasoning.includes(this.state.selection.reasoning),
        )
      )
        this.state.selection = null;
    } catch {
      if (generation === this.generation && !this.stopped)
        this.state = {
          ...initial(),
          connection: "unavailable",
          busy: this.state.busy,
          message: "The Codex connection was lost. Reconnect to continue.",
        };
    }
  }
  private async action(
    work: (client: Client, generation: number) => Promise<void>,
  ): Promise<CodexView> {
    if (
      !this.client ||
      this.state.connection !== "connected" ||
      this.state.busy ||
      this.stopped
    )
      return this.snapshot();
    this.state.busy = true;
    this.state.message = null;
    const client = this.client,
      generation = this.generation;
    let finishAction!: () => void;
    this.actionFinished = new Promise<void>((resolve) => {
      finishAction = resolve;
    });
    try {
      await work(client, generation);
      if (this.current(generation, client)) await this.refresh(true);
    } catch {
      if (this.current(generation, client))
        this.state.message =
          "This Codex action could not finish. Reconnect or try again.";
    } finally {
      if (this.current(generation, client)) this.state.busy = false;
      this.actionFinished = undefined;
      finishAction();
    }
    return this.snapshot();
  }
  login(): Promise<CodexView> {
    return this.action(async (client, generation) => {
      const login = await client.startLogin();
      if (login && this.current(generation, client)) {
        try {
          await this.openLogin(login.authUrl);
        } catch {
          if (this.current(generation, client)) await client.cancelLogin();
          throw new Error("Browser unavailable");
        }
      }
    });
  }
  cancelLogin(): Promise<CodexView> {
    return this.action(async (client) => {
      await client.cancelLogin();
    });
  }
  logout(): Promise<CodexView> {
    return this.action(async (client) => {
      await client.logout();
    });
  }
  async select(value: unknown): Promise<CodexView> {
    assertCodexSelection(value);
    const selected: CodexSelection = { ...value };
    if (
      this.state.account !== "signed_in" ||
      !this.state.models.some(
        (model) =>
          model.id === selected.modelId &&
          model.reasoning.includes(selected.reasoning),
      )
    )
      throw new Error("Choose an available model and reasoning level.");
    return this.action(async (client, generation) => {
      const selection = await this.settings.write(selected);
      if (this.current(generation, client)) this.state.selection = selection;
    });
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true;
    this.generation++;
    const client = this.client;
    this.client = undefined;
    this.state = initial();
    this.refreshAgain = false;
    this.closing = Promise.all([
      client?.close(),
      this.startupFinished,
      this.actionFinished,
      this.refreshing,
    ]).then(() => {});
    return this.closing;
  }
}
