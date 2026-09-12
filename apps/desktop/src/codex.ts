import { lstat, mkdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  CodexClient,
  type CodexClientOptions,
} from "../../../packages/codex-bridge/src/client.ts";
import type { AuthState } from "../../../packages/codex-bridge/src/auth.ts";
import type {
  ThreadHistorySnapshot,
  ThreadStreamEvent,
} from "../../../packages/codex-bridge/src/thread-stream.ts";
import { CodexTransportError } from "../../../packages/codex-bridge/src/transport.ts";
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
import {
  assertCodexThreadView,
  type CodexThreadView,
} from "../../../packages/domain/src/codex-thread-view.ts";
import type { CodexMcpRuntime } from "../../../packages/codex-tools/src/broker.ts";

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
  | "openProjectThread"
  | "startProjectTurn"
  | "interruptProjectTurn"
  | "closeProjectThread"
>;
/** Internal deterministic-test seam; never renderer-selectable or exposed through IPC. */
export interface DesktopCodexDependencies {
  createClient: (options: CodexClientOptions) => Client;
  resolveRuntime: typeof resolveCodexRuntime;
  directory: (path: string) => Promise<void>;
  settings: Pick<CodexSettingsStore, "read" | "write">;
  mcpRuntime?: CodexMcpRuntime;
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
const initialThread = (): CodexThreadView => ({
  status: "closed",
  projectId: null,
  messages: [],
  activities: [],
  message: null,
});
const PROJECT_THREAD_INSTRUCTIONS =
  "You are the in-app codex-video-edit editor. Read current state through project.get_summary and timeline.get_summary. Before every mutation, refresh the draft sequence and hash, then use only the codex-video-edit MCP tools to apply the user's requested reversible edit. Describe an edit as applied only after its tool result confirms the commit. Never invent timeline, preview, transcript, render, review, or export state. Do not request or use shell, file, network, browser, external app, export, deletion, cleanup, spending, or publication access.";
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
  private thread = initialThread();
  private readonly threadItems = new Map<string, string>();
  private nextThreadViewId = 0;
  private readonly requestModels = new Map<string, string>();
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
  private threadSnapshot(): CodexThreadView {
    assertCodexThreadView(this.thread);
    return structuredClone(this.thread);
  }
  private resetThread(): void {
    this.thread = initialThread();
    this.threadItems.clear();
  }
  private viewId(prefix: "message" | "activity"): string {
    return `${prefix}-${String(++this.nextThreadViewId).padStart(8, "0")}`;
  }
  private applyThreadEvent(event: ThreadStreamEvent): void {
    if (this.thread.status === "closed") return;
    switch (event.type) {
      case "turn_started":
        this.thread.status = "running";
        break;
      case "item_started":
        if (event.kind !== "message") {
          const id = this.viewId("activity");
          this.threadItems.set(event.itemId, id);
          this.thread.activities.push({
            id,
            kind: event.kind,
            label: event.label,
            complete: false,
          });
          this.thread.activities = this.thread.activities.slice(-32);
        }
        break;
      case "message_delta": {
        let id = this.threadItems.get(event.itemId);
        let message = this.thread.messages.find((item) => item.id === id);
        if (!message) {
          id = this.viewId("message");
          this.threadItems.set(event.itemId, id);
          message = { id, role: "codex", text: "", complete: false };
          this.thread.messages.push(message);
        }
        message.text += event.text;
        this.thread.messages = this.thread.messages.slice(-200);
        break;
      }
      case "item_completed": {
        const id = this.threadItems.get(event.itemId);
        if (event.kind === "message") {
          let message = this.thread.messages.find((item) => item.id === id);
          if (!message) {
            const nextId = this.viewId("message");
            this.threadItems.set(event.itemId, nextId);
            message = {
              id: nextId,
              role: "codex",
              text: "",
              complete: false,
            };
            this.thread.messages.push(message);
          }
          message.text = event.text ?? message.text;
          message.complete = true;
          this.thread.messages = this.thread.messages.slice(-200);
        } else {
          const activity = this.thread.activities.find(
            (item) => item.id === id,
          );
          if (activity) activity.complete = true;
        }
        break;
      }
      case "turn_problem":
        this.thread.message = event.retrying
          ? "Codex is retrying this turn."
          : "Codex reported a problem with this turn.";
        break;
      case "turn_terminal":
        this.thread.status = "ready";
        for (const message of this.thread.messages) message.complete = true;
        for (const activity of this.thread.activities) activity.complete = true;
        this.thread.message =
          event.status === "failed"
            ? "This Codex turn failed. Review the committed draft before retrying."
            : event.status === "interrupted"
              ? "The Codex turn was interrupted."
              : null;
        break;
      case "connection_uncertain":
        this.thread.status = "uncertain";
        this.thread.message =
          "The connection ended during this turn. Reopen the project to reconcile its thread and committed draft.";
        break;
    }
  }
  private applyThreadHistory(history: ThreadHistorySnapshot): void {
    if (this.thread.status === "closed") return;
    this.threadItems.clear();
    this.thread.messages = history.messages.map((message) => {
      const id = this.viewId("message");
      this.threadItems.set(message.itemId, id);
      return {
        id,
        role: message.role,
        text: message.text,
        complete: message.complete,
      };
    });
    this.thread.activities = history.activities.map((activity) => {
      const id = this.viewId("activity");
      this.threadItems.set(activity.itemId, id);
      return {
        id,
        kind: activity.kind,
        label: activity.label,
        complete: activity.complete,
      };
    });
    this.thread.status = history.activeTurnId ? "running" : "ready";
    this.thread.message = null;
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
    this.resetThread();
    this.requestModels.clear();
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
        onThreadEvent: (event) => {
          if (this.current(generation, client)) this.applyThreadEvent(event);
        },
        onThreadHistory: (history) => {
          if (this.current(generation, client))
            this.applyThreadHistory(history);
        },
        ...(this.dependencies.mcpRuntime
          ? { mcp: this.dependencies.mcpRuntime }
          : {}),
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
      this.requestModels.clear();
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
        ).map((entry) => {
          this.requestModels.set(entry.id, entry.model);
          return {
            id: entry.id,
            name: label(entry.displayName, 1024) || entry.id,
            reasoning: entry.reasoning,
            defaultReasoning: entry.defaultReasoning,
          };
        });
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
  getThread(projectId: string): CodexThreadView {
    if (this.thread.projectId !== null && this.thread.projectId !== projectId)
      throw new Error("Open the active project's Codex conversation.");
    return this.threadSnapshot();
  }
  async openThread(projectId: string): Promise<CodexThreadView> {
    if (
      !this.client ||
      this.state.connection !== "connected" ||
      this.state.account !== "signed_in" ||
      !this.state.selection ||
      this.state.busy ||
      this.thread.status !== "closed"
    )
      throw new Error("Codex is not ready to open this project conversation.");
    const requestModel = this.requestModels.get(this.state.selection.modelId);
    if (!requestModel)
      throw new Error(
        "Choose an available Codex model before opening the conversation.",
      );
    this.thread = {
      status: "opening",
      projectId,
      messages: [],
      activities: [],
      message: null,
    };
    try {
      await this.client.openProjectThread({
        projectId,
        model: requestModel,
        effort: this.state.selection.reasoning,
        developerInstructions: PROJECT_THREAD_INSTRUCTIONS,
      });
      if (this.thread.status === "opening") this.thread.status = "ready";
    } catch {
      this.thread.status = "failed";
      this.thread.message =
        "The project conversation could not be opened. Reconnect Codex and try again.";
    }
    return this.threadSnapshot();
  }
  async sendThread(projectId: string, text: string): Promise<CodexThreadView> {
    if (
      !this.client ||
      this.thread.projectId !== projectId ||
      this.thread.status !== "ready"
    )
      throw new Error("The project conversation is not ready.");
    const id = this.viewId("message");
    this.thread.messages.push({ id, role: "user", text, complete: true });
    this.thread.messages = this.thread.messages.slice(-200);
    this.thread.status = "starting";
    this.thread.message = null;
    try {
      await this.client.startProjectTurn({ text });
      if (this.thread.status === "starting") this.thread.status = "running";
    } catch (error) {
      if (
        error instanceof CodexTransportError &&
        error.code === "remote_error"
      ) {
        this.thread.messages = this.thread.messages.filter(
          (message) => message.id !== id,
        );
        this.thread.status = "ready";
        this.thread.message =
          "Codex rejected this turn. Adjust it and try again.";
      } else {
        this.thread.status = "uncertain";
        this.thread.message =
          "The turn outcome is uncertain. Reopen the project before retrying.";
      }
    }
    return this.threadSnapshot();
  }
  async interruptThread(projectId: string): Promise<CodexThreadView> {
    if (
      !this.client ||
      this.thread.projectId !== projectId ||
      this.thread.status !== "running"
    )
      throw new Error("There is no running Codex turn to interrupt.");
    this.thread.status = "interrupting";
    try {
      await this.client.interruptProjectTurn();
      if (this.thread.status === "interrupting")
        this.thread.message = "Interrupt requested. Waiting for Codex to stop.";
    } catch {
      if (this.thread.status === "interrupting") {
        this.thread.status = "uncertain";
        this.thread.message =
          "The interrupt outcome is uncertain. Reopen the project to reconcile the turn.";
      }
    }
    return this.threadSnapshot();
  }
  async closeThread(projectId: string): Promise<void> {
    if (this.thread.projectId === null) return;
    if (this.thread.projectId !== projectId)
      throw new Error("Close the active project's Codex conversation.");
    if (
      ["opening", "starting", "running", "interrupting"].includes(
        this.thread.status,
      )
    )
      throw new Error(
        "Stop the running Codex turn before leaving this project.",
      );
    await this.client?.closeProjectThread();
    this.resetThread();
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true;
    this.generation++;
    const client = this.client;
    this.client = undefined;
    this.state = initial();
    this.resetThread();
    this.requestModels.clear();
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
