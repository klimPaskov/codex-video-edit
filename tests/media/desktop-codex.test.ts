import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as tick } from "node:timers/promises";
import { resolve } from "node:path";
import {
  DesktopCodex,
  type DesktopCodexDependencies,
} from "../../apps/desktop/src/codex.ts";
import type { CodexClientOptions } from "../../packages/codex-bridge/src/client.ts";
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
