import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as tick } from "node:timers/promises";
import { resolve } from "node:path";
import {
  DesktopCodex,
  type DesktopCodexDependencies,
} from "../../apps/desktop/src/codex.ts";
import type {
  CodexClientOptions,
  OpenProjectThreadInput,
} from "../../packages/codex-bridge/src/client.ts";
import type { TurnStartInput } from "../../packages/codex-bridge/src/thread-protocol.ts";
import type {
  ThreadHistorySnapshot,
  ThreadStreamEvent,
} from "../../packages/codex-bridge/src/thread-stream.ts";
import { CodexTransportError } from "../../packages/codex-bridge/src/transport.ts";
import type { AuthState } from "../../packages/codex-bridge/src/auth.ts";
import type {
  AccountState,
  ModelSummary,
  SkillSummary,
  RateLimitsSummary,
} from "../../packages/codex-bridge/src/metadata.ts";
import type {
  CodexView,
  CodexSelection,
} from "../../packages/domain/src/codex-view.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const signedOut = (): AuthState => ({
  status: "idle",
  account: { status: "signed_out" },
  error: null,
});
const signedIn = (): AuthState => ({
  status: "idle",
  account: { status: "chatgpt", plan: "plus" },
  error: null,
});
const model: ModelSummary = {
  id: "runtime-id",
  model: "runtime-model",
  displayName: "Runtime model",
  description: "Runtime description",
  isDefault: true,
  reasoning: ["medium"],
  defaultReasoning: "medium",
};
class FakeClient {
  options!: CodexClientOptions;
  auth = signedOut();
  accountReads = 0;
  closeCalls = 0;
  modelValues = [model];
  modelFailure = false;
  skillFailure = false;
  rateFailure = false;
  onConnect: () => Promise<void> = async () => {};
  onClose: () => Promise<void> = async () => {};
  onSkills: (() => Promise<SkillSummary[]>) | undefined;
  onLogin: (() => Promise<{ authUrl: string } | null>) | undefined;
  cancelCalls = 0;
  openThreadCalls: OpenProjectThreadInput[] = [];
  turnCalls: TurnStartInput[] = [];
  interruptCalls = 0;
  closeThreadCalls = 0;
  onOpenThread: ((input: OpenProjectThreadInput) => Promise<void>) | undefined;
  onTurn: ((input: TurnStartInput) => Promise<void>) | undefined;
  onInterrupt: (() => Promise<void>) | undefined;
  emit(auth: AuthState): void {
    this.auth = structuredClone(auth);
    this.options.onAuthStateChanged?.(structuredClone(auth));
  }
  async connect(): Promise<void> {
    await this.onConnect();
  }
  async close(): Promise<void> {
    this.closeCalls++;
    await this.onClose();
  }
  async account(): Promise<AccountState> {
    this.accountReads++;
    this.options.onAuthStateChanged?.(this.authState());
    return structuredClone(this.auth.account ?? { status: "signed_out" });
  }
  authState(): AuthState {
    return structuredClone(this.auth);
  }
  async skills(): Promise<SkillSummary[]> {
    if (this.skillFailure) throw new Error("PRIVATE_SKILL_ERROR");
    return this.onSkills
      ? this.onSkills()
      : [{ name: "Fixture skill", description: "Fixture", enabled: true }];
  }
  async models(): Promise<ModelSummary[]> {
    if (this.modelFailure) throw new Error("PRIVATE_MODEL_ERROR");
    return this.modelValues;
  }
  async rateLimits(): Promise<RateLimitsSummary> {
    if (this.rateFailure) throw new Error("PRIVATE_RATE_ERROR");
    return {
      buckets: [
        {
          id: "codex",
          name: null,
          primary: {
            usedPercent: 25,
            remainingPercent: 75,
            resetsAt: null,
            windowDurationMins: null,
          },
          secondary: null,
        },
      ],
    };
  }
  async startLogin(): Promise<{ authUrl: string } | null> {
    this.emit({
      status: "awaiting_browser",
      account: { status: "signed_out" },
      error: null,
    });
    return this.onLogin ? this.onLogin() : { authUrl: "PRIVATE_AUTH_URL" };
  }
  async cancelLogin(): Promise<void> {
    this.cancelCalls++;
    this.emit(signedOut());
  }
  async logout(): Promise<void> {
    this.emit(signedOut());
  }
  async openProjectThread(input: OpenProjectThreadInput): Promise<void> {
    this.openThreadCalls.push(structuredClone(input));
    await this.onOpenThread?.(input);
  }
  async startProjectTurn(input: TurnStartInput): Promise<void> {
    this.turnCalls.push(structuredClone(input));
    await this.onTurn?.(input);
  }
  async interruptProjectTurn(): Promise<void> {
    this.interruptCalls++;
    await this.onInterrupt?.();
  }
  async closeProjectThread(): Promise<void> {
    this.closeThreadCalls++;
  }
  emitThread(event: ThreadStreamEvent): void {
    this.options.onThreadEvent?.(structuredClone(event));
  }
  emitHistory(history: ThreadHistorySnapshot): void {
    this.options.onThreadHistory?.(structuredClone(history));
  }
}
function harness(
  fake = new FakeClient(),
  overrides: Partial<DesktopCodexDependencies> = {},
  open?: (url: string) => Promise<void>,
) {
  const clients: FakeClient[] = [];
  const opened: string[] = [];
  let selection: CodexSelection | null = null;
  const controller = new DesktopCodex(
    resolve("test-results/test-resources"),
    resolve("test-results/test-userdata"),
    open ??
      (async (url) => {
        opened.push(url);
      }),
    {
      resolveRuntime: async () => resolve("test-results/test-only-runtime"),
      directory: async () => {},
      settings: {
        read: async () => selection,
        write: async (value) => {
          selection = value as CodexSelection;
          return selection;
        },
      },
      createClient: (options) => {
        const client = clients.length ? new FakeClient() : fake;
        client.options = options;
        clients.push(client);
        return client;
      },
      ...overrides,
    },
  );
  return { controller, clients, opened };
}
async function eventually(
  controller: DesktopCodex,
  check: (view: CodexView) => boolean,
): Promise<CodexView> {
  for (let i = 0; i < 100; i++) {
    const view = await controller.get();
    if (check(view)) return view;
    await tick();
  }
  assert.fail("Controller did not settle to expected state");
}

test("unchanged account publications settle without a refresh feedback loop", async () => {
  const fake = new FakeClient(),
    { controller } = harness(fake);
  try {
    const view = await controller.get();
    assert.equal(view.account, "signed_out");
    assert.equal(view.connection, "connected");
    const reads = fake.accountReads;
    await tick();
    await tick();
    assert.equal(fake.accountReads, reads);
    assert.ok(reads <= 3);
  } finally {
    await controller.close();
  }
});

test("unverified auth snapshot stays unknown even when an old read returns signed out", async () => {
  const fake = new FakeClient();
  fake.auth = { status: "idle", account: null, error: null };
  const { controller } = harness(fake);
  try {
    assert.equal((await controller.get()).account, "unknown");
  } finally {
    await controller.close();
  }
});

test("login completion during pending discovery drains a trailing refresh", async () => {
  const fake = new FakeClient(),
    held = deferred<SkillSummary[]>();
  let scans = 0;
  fake.onSkills = async () => (++scans === 1 ? held.promise : []);
  const { controller } = harness(fake);
  try {
    const connecting = controller.get();
    while (scans === 0) await tick();
    fake.emit({
      status: "reconciling",
      account: { status: "signed_out" },
      error: null,
    });
    fake.emit(signedIn());
    held.resolve([]);
    const view = await connecting;
    assert.equal(view.account, "signed_in");
    assert.equal(view.models[0]?.id, model.id);
    assert.ok(scans >= 2);
    assert.ok(!JSON.stringify(view).includes("PRIVATE"));
  } finally {
    held.resolve([]);
    await controller.close();
  }
});

test("logout during discovery cannot restore metadata from the previous signed-in state", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  const { controller } = harness(fake),
    held = deferred<SkillSummary[]>();
  try {
    assert.equal((await controller.get()).models.length, 1);
    fake.onSkills = async () => held.promise;
    fake.options.onSkillsChanged?.();
    await tick();
    fake.emit(signedOut());
    assert.equal((await controller.get()).models.length, 0);
    fake.onSkills = async () => [];
    held.resolve([]);
    const view = await eventually(
      controller,
      (view) => view.account === "signed_out",
    );
    await tick();
    assert.deepEqual(view.models, []);
    assert.deepEqual((await controller.get()).limits, []);
  } finally {
    held.resolve([]);
    await controller.close();
  }
});

test("connection loss during settled account metadata work reports unavailable immediately", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  const { controller } = harness(fake),
    held = deferred<SkillSummary[]>();
  try {
    await controller.get();
    fake.onSkills = async () => held.promise;
    fake.options.onSkillsChanged?.();
    await tick();
    fake.emit({ status: "failed", account: null, error: "connection_lost" });
    held.resolve([]);
    await tick();
    const view = await controller.get();
    assert.equal(view.connection, "unavailable");
    assert.equal(view.account, "unknown");
    assert.deepEqual(view.models, []);
  } finally {
    held.resolve([]);
    await controller.close();
  }
});

test("failed metadata clears stale catalogs and successful refresh clears only the transient error", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  const { controller } = harness(fake);
  try {
    await controller.get();
    fake.modelFailure = fake.skillFailure = fake.rateFailure = true;
    fake.options.onSkillsChanged?.();
    const failed = await eventually(
      controller,
      (view) => view.message?.startsWith("Some Codex") === true,
    );
    assert.deepEqual(failed.models, []);
    assert.deepEqual(failed.skills, []);
    assert.deepEqual(failed.limits, []);
    assert.ok(!JSON.stringify(failed).includes("PRIVATE"));
    fake.modelFailure = fake.skillFailure = fake.rateFailure = false;
    fake.options.onSkillsChanged?.();
    const recovered = await eventually(
      controller,
      (view) => view.models.length === 1 && view.message === null,
    );
    assert.equal(recovered.account, "signed_in");
  } finally {
    await controller.close();
  }
});

test("an authenticated empty model catalog has an actionable message and clears obsolete selection", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  fake.modelValues = [];
  const { controller } = harness(fake, {
    settings: {
      read: async () => ({ modelId: "old", reasoning: "medium" }),
      write: async () => null,
    },
  });
  try {
    const view = await controller.get();
    assert.match(view.message ?? "", /No compatible Codex models/);
    assert.equal(view.selection, null);
  } finally {
    await controller.close();
  }
});

test("close waits for runtime resolution and prevents a late startup from constructing a client", async () => {
  const runtime = deferred<string>();
  let resolving = false;
  const { controller, clients } = harness(new FakeClient(), {
    resolveRuntime: async () => {
      resolving = true;
      return runtime.promise;
    },
  });
  const opening = controller.get();
  while (!resolving) await tick();
  let closed = false;
  const closing = controller.close().then(() => {
    closed = true;
  });
  await tick();
  assert.equal(closed, false);
  runtime.resolve(resolve("test-results/test-runtime"));
  await Promise.all([opening, closing]);
  assert.equal(clients.length, 0);
  assert.equal((await controller.get()).connection, "disconnected");
});

test("close during connect awaits the startup and its actual client shutdown", async () => {
  const fake = new FakeClient(),
    connect = deferred<void>();
  let entered = false;
  fake.onConnect = async () => {
    entered = true;
    await connect.promise;
  };
  fake.onClose = async () => {
    connect.resolve();
  };
  const { controller } = harness(fake);
  const opening = controller.get();
  while (!entered) await tick();
  await controller.close();
  await opening;
  assert.ok(fake.closeCalls >= 1);
  assert.equal((await controller.get()).connection, "disconnected");
});

test("reconnect waits for old shutdown and ignores callbacks from the previous generation", async () => {
  const fake = new FakeClient(),
    closed = deferred<void>();
  const { controller, clients } = harness(fake);
  try {
    await controller.get();
    fake.onClose = async () => closed.promise;
    const reconnecting = controller.reconnect();
    await tick();
    assert.equal(clients.length, 1);
    fake.emit(signedIn());
    closed.resolve();
    const view = await reconnecting;
    assert.equal(clients.length, 2);
    assert.equal(view.account, "signed_out");
    fake.emit(signedIn());
    assert.equal((await controller.get()).account, "signed_out");
  } finally {
    closed.resolve();
    await controller.close();
  }
});

test("reconnect cannot overlap a pending action and close prevents its late browser launch", async () => {
  const fake = new FakeClient(),
    start = deferred<{ authUrl: string } | null>();
  fake.onLogin = async () => start.promise;
  fake.onClose = async () => {
    start.resolve({ authUrl: "PRIVATE_LATE_URL" });
  };
  const { controller, clients, opened } = harness(fake);
  await controller.get();
  const login = controller.login();
  const reconnect = await controller.reconnect();
  assert.equal(reconnect.busy, true);
  assert.equal(clients.length, 1);
  await controller.close();
  await login;
  assert.deepEqual(opened, []);
  assert.equal((await controller.get()).connection, "disconnected");
});

test("browser launch failure cancels the attempt and only returns a fixed action error", async () => {
  const fake = new FakeClient();
  const { controller } = harness(fake, {}, async () => {
    throw new Error("PRIVATE_BROWSER_ERROR");
  });
  try {
    await controller.get();
    const view = await controller.login();
    assert.equal(fake.cancelCalls, 1);
    assert.equal(view.account, "signed_out");
    assert.ok(view.message);
    assert.ok(!JSON.stringify(view).includes("PRIVATE"));
  } finally {
    await controller.close();
  }
});

test("project conversation uses runtime model identity and exposes only compact committed activity", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  const { controller } = harness(fake);
  try {
    await controller.get();
    await controller.select({ modelId: model.id, reasoning: "medium" });
    const opened = await controller.openThread("project-1");
    assert.equal(opened.status, "ready");
    assert.deepEqual(fake.openThreadCalls, [
      {
        projectId: "project-1",
        model: "runtime-model",
        effort: "medium",
        developerInstructions:
          "You are the in-app codex-video-edit editor. Read current state through project.get_summary and timeline.get_summary. Before every mutation, refresh the draft sequence and hash, then use only the codex-video-edit MCP tools to apply the user's requested reversible edit. Describe an edit as applied only after its tool result confirms the commit. Never invent timeline, preview, transcript, render, review, or export state. Do not request or use shell, file, network, browser, external app, export, deletion, cleanup, spending, or publication access.",
      },
    ]);
    const running = await controller.sendThread(
      "project-1",
      "Trim the false start.",
    );
    assert.equal(running.status, "running");
    assert.equal(running.messages[0]?.role, "user");
    fake.emitThread({
      generation: 1,
      threadId: "server-private-thread",
      turnId: "server-private-turn",
      type: "item_started",
      itemId: "server-private-item",
      kind: "edit",
      label: "Applying an edit",
    });
    fake.emitThread({
      generation: 1,
      threadId: "server-private-thread",
      turnId: "server-private-turn",
      type: "message_delta",
      itemId: "server-private-message",
      text: "The first trim is committed.",
    });
    fake.emitThread({
      generation: 1,
      threadId: "server-private-thread",
      turnId: "server-private-turn",
      type: "item_completed",
      itemId: "server-private-message",
      kind: "message",
      text: "The first trim is committed.",
    });
    fake.emitThread({
      generation: 1,
      threadId: "server-private-thread",
      turnId: "server-private-turn",
      type: "turn_terminal",
      status: "completed",
    });
    const finished = controller.getThread("project-1");
    assert.equal(finished.status, "ready");
    assert.equal(finished.messages.at(-1)?.role, "codex");
    assert.equal(finished.activities[0]?.complete, true);
    assert.ok(!JSON.stringify(finished).includes("server-private"));
  } finally {
    await controller.close();
  }
});

test("resumed history replaces server identities before the drawer receives it", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  fake.onOpenThread = async () => {
    fake.emitHistory({
      activeTurnId: "server-active-turn",
      messages: [
        {
          itemId: "server-user-item",
          role: "user",
          text: "Tighten the opening.",
          complete: true,
        },
        {
          itemId: "server-agent-item",
          role: "codex",
          text: "Applying the saved trim.",
          complete: false,
        },
      ],
      activities: [
        {
          itemId: "server-tool-item",
          kind: "edit",
          label: "Applying an edit",
          complete: false,
        },
      ],
    });
  };
  const { controller } = harness(fake);
  try {
    await controller.get();
    await controller.select({ modelId: model.id, reasoning: "medium" });
    const restored = await controller.openThread("project-1");
    assert.equal(restored.status, "running");
    assert.deepEqual(
      restored.messages.map(({ role, text, complete }) => ({
        role,
        text,
        complete,
      })),
      [
        { role: "user", text: "Tighten the opening.", complete: true },
        {
          role: "codex",
          text: "Applying the saved trim.",
          complete: false,
        },
      ],
    );
    assert.ok(!JSON.stringify(restored).includes("server-"));
    fake.emitThread({
      generation: 1,
      threadId: "server-thread",
      turnId: "server-active-turn",
      type: "message_delta",
      itemId: "server-agent-item",
      text: " Done.",
    });
    fake.emitThread({
      generation: 1,
      threadId: "server-thread",
      turnId: "server-active-turn",
      type: "turn_terminal",
      status: "completed",
    });
    const completed = controller.getThread("project-1");
    assert.equal(completed.status, "ready");
    assert.equal(
      completed.messages.at(-1)?.text,
      "Applying the saved trim. Done.",
    );
    assert.equal(completed.activities[0]?.complete, true);
  } finally {
    await controller.close();
  }
});

test("rejected turns are removable while interrupt completion remains stream-authoritative", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  const { controller } = harness(fake);
  try {
    await controller.get();
    await controller.select({ modelId: model.id, reasoning: "medium" });
    await controller.openThread("project-1");
    fake.onTurn = async () => {
      throw new CodexTransportError("remote_error", -32602);
    };
    const rejected = await controller.sendThread("project-1", "Bad request");
    assert.equal(rejected.status, "ready");
    assert.deepEqual(rejected.messages, []);
    fake.onTurn = undefined;
    await controller.sendThread("project-1", "Run an edit");
    const interrupting = await controller.interruptThread("project-1");
    assert.equal(interrupting.status, "interrupting");
    assert.equal(fake.interruptCalls, 1);
    fake.emitThread({
      generation: 1,
      threadId: "server-thread",
      turnId: "server-turn",
      type: "turn_terminal",
      status: "interrupted",
    });
    const interrupted = controller.getThread("project-1");
    assert.equal(interrupted.status, "ready");
    assert.match(interrupted.message ?? "", /interrupted/u);
  } finally {
    await controller.close();
  }
});

test("project close unsubscribes only after the current turn is terminal", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  const { controller } = harness(fake);
  try {
    await controller.get();
    await controller.select({ modelId: model.id, reasoning: "medium" });
    await controller.openThread("project-1");
    await controller.sendThread("project-1", "Keep this project active");
    await assert.rejects(
      controller.closeThread("project-1"),
      /Stop the running Codex turn/u,
    );
    assert.equal(fake.closeThreadCalls, 0);
    fake.emitThread({
      generation: 1,
      threadId: "server-thread",
      turnId: "server-turn",
      type: "turn_terminal",
      status: "completed",
    });
    await controller.closeThread("project-1");
    assert.equal(fake.closeThreadCalls, 1);
    assert.equal(controller.getThread("project-1").status, "closed");
  } finally {
    await controller.close();
  }
});

test("closing an uncertain project conversation clears its client session for reopen", async () => {
  const fake = new FakeClient();
  fake.auth = signedIn();
  const { controller } = harness(fake);
  try {
    await controller.get();
    await controller.select({ modelId: model.id, reasoning: "medium" });
    await controller.openThread("project-1");
    fake.onTurn = async () => {
      throw new CodexTransportError("process_failed");
    };
    const uncertain = await controller.sendThread(
      "project-1",
      "Apply the requested edit.",
    );
    assert.equal(uncertain.status, "uncertain");

    await controller.closeThread("project-1");
    assert.equal(fake.closeThreadCalls, 1);
    assert.equal(controller.getThread("project-1").status, "closed");

    fake.onTurn = undefined;
    const reopened = await controller.openThread("project-1");
    assert.equal(reopened.status, "ready");
    assert.equal(fake.openThreadCalls.length, 2);
  } finally {
    await controller.close();
  }
});
