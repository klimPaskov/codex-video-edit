import assert from "node:assert/strict";
import test from "node:test";
import {
  setImmediate as tick,
  setTimeout as delay,
} from "node:timers/promises";
import {
  CodexAuthController,
  decodeCompletion,
  decodeLogin,
  validateAccountUpdate,
  validateLoginUrl,
  type AuthState,
} from "../../packages/codex-bridge/src/auth.ts";
import {
  decodeRateLimits,
  validateRateLimitsUpdate,
} from "../../packages/codex-bridge/src/metadata.ts";
import { CodexTransportError } from "../../packages/codex-bridge/src/transport.ts";

const url =
  "https://auth.openai.com/oauth/authorize?response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback&code_challenge_method=S256&code_challenge=" +
  "a".repeat(43) +
  "&state=PRIVATE_STATE";
const signedOut = { account: null, requiresOpenaiAuth: true };
const signedIn = {
  account: { type: "chatgpt", email: "PRIVATE_EMAIL", planType: "plus" },
  requiresOpenaiAuth: true,
};
const login = { type: "chatgpt", loginId: "PRIVATE_LOGIN_ID", authUrl: url };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function harness(
  respond: (method: string, params: unknown) => Promise<unknown>,
  timeout?: number,
) {
  const states: AuthState[] = [];
  const calls: { method: string; params: unknown }[] = [];
  const controller = new CodexAuthController({
    request: (method, params) => {
      calls.push({ method, params });
      return respond(method, params);
    },
    onChanged: (state) => {
      states.push(state);
      assert.ok(!JSON.stringify(state).includes("PRIVATE"));
    },
    ...(timeout === undefined ? {} : { loginTimeoutMs: timeout }),
  });
  return { controller, calls, states };
}

test("managed login validates exact initial origin, route, callback and PKCE without rewriting URL", () => {
  assert.equal(validateLoginUrl(url), url);
  assert.equal(
    validateLoginUrl(url.replace("1455", "1457")),
    url.replace("1455", "1457"),
  );
  for (const invalid of [
    url.replace("https:", "http:"),
    url.replace("auth.openai.com", "auth.openai.com.evil.test"),
    url.replace("auth.openai.com", "user:pass@auth.openai.com"),
    url + "#fragment",
    url.replace("auth.openai.com", "auth.openai.com:1443"),
    url.replace("/oauth/authorize", "/codex/device"),
    url.replace("localhost", "127.0.0.1"),
    url.replace("1455", "1456"),
    url.replace("localhost", "evil.test"),
    url.replace("S256", "plain"),
    url.replace("response_type=code", "response_type=token"),
    url + "&state=duplicate",
    url + "&redirect_uri=http://evil.test",
    url.replace("a".repeat(43), "short"),
    url.replace("state=PRIVATE_STATE", "state="),
    "not a URL",
  ])
    assert.throws(() => validateLoginUrl(invalid), CodexTransportError);
  assert.deepEqual(decodeLogin(login), login);
  for (const type of ["apiKey", "chatgptAuthTokens", "chatgptDeviceCode"]) {
    assert.throws(() => decodeLogin({ ...login, type }), CodexTransportError);
  }
});

test("auth notifications discard private errors and reject unsupported account modes", () => {
  assert.deepEqual(
    decodeCompletion({
      loginId: "opaque",
      success: false,
      error: "PRIVATE_ERROR",
    }),
    { loginId: "opaque", success: false },
  );
  assert.deepEqual(decodeCompletion({ success: true }), {
    loginId: null,
    success: true,
  });
  assert.throws(
    () => decodeCompletion({ loginId: "x", success: "true" }),
    CodexTransportError,
  );
  validateAccountUpdate({ authMode: "chatgpt", planType: "plus" });
  validateAccountUpdate({ authMode: null });
  for (const authMode of [
    "apikey",
    "chatgptAuthTokens",
    "agentIdentity",
    "unknown",
  ]) {
    assert.throws(
      () => validateAccountUpdate({ authMode }),
      CodexTransportError,
    );
  }
});

test("login success waits for account reload and an authoritative ChatGPT read", async () => {
  let account = signedOut as unknown;
  const { controller, calls } = harness(async (method) =>
    method === "account/login/start" ? login : account,
  );
  try {
    await controller.refreshAccount();
    assert.deepEqual(await controller.startLogin(), { authUrl: url });
    assert.deepEqual(
      calls.find((c) => c.method === "account/login/start")?.params,
      { type: "chatgpt" },
    );
    controller.notification("account/login/completed", {
      loginId: login.loginId,
      success: true,
      error: null,
    });
    await tick();
    assert.equal(controller.snapshot().status, "reconciling");
    assert.deepEqual(controller.snapshot().account, { status: "signed_out" });
    account = signedIn;
    controller.notification("account/updated", {
      authMode: "chatgpt",
      planType: "plus",
    });
    await tick();
    assert.deepEqual(controller.snapshot(), {
      status: "idle",
      account: { status: "chatgpt", plan: "plus" },
      error: null,
    });
  } finally {
    controller.close();
  }
});

test("early completion correlates the eventual login ID and never launches a finished flow", async () => {
  const started = deferred<unknown>();
  const { controller } = harness(async (method) =>
    method === "account/login/start" ? started.promise : signedIn,
  );
  try {
    const opening = controller.startLogin();
    controller.notification("account/login/completed", {
      loginId: "superseded",
      success: false,
    });
    controller.notification("account/login/completed", {
      loginId: login.loginId,
      success: true,
    });
    started.resolve(login);
    assert.equal(await opening, null);
    await tick();
    assert.equal(controller.snapshot().status, "idle");
    assert.equal(controller.snapshot().account?.status, "chatgpt");
  } finally {
    controller.close();
  }
});

test("cancel during login start waits for its ID and sends exactly one cancel without exposing a URL", async () => {
  const started = deferred<unknown>();
  const { controller, calls } = harness(async (method) => {
    if (method === "account/login/start") return started.promise;
    if (method === "account/login/cancel") return { status: "canceled" };
    return signedOut;
  });
  try {
    const opening = controller.startLogin();
    const cancel = controller.cancelLogin();
    const secondCancel = controller.cancelLogin();
    started.resolve(login);
    assert.equal(await opening, null);
    await Promise.all([cancel, secondCancel]);
    assert.equal(
      calls.filter((c) => c.method === "account/login/cancel").length,
      1,
    );
    assert.deepEqual(controller.snapshot(), {
      status: "idle",
      account: { status: "signed_out" },
      error: null,
    });
  } finally {
    controller.close();
  }
});

test("cancel notFound racing a successful login reconciles instead of asserting signed out", async () => {
  const { controller } = harness(async (method) => {
    if (method === "account/login/start") return login;
    if (method === "account/login/cancel") return { status: "notFound" };
    return signedIn;
  });
  try {
    await controller.startLogin();
    const cancel = controller.cancelLogin();
    controller.notification("account/login/completed", {
      loginId: login.loginId,
      success: true,
    });
    await cancel;
    assert.equal(controller.snapshot().account?.status, "chatgpt");
    assert.equal(controller.snapshot().status, "idle");
  } finally {
    controller.close();
  }
});

test("superseded completions cannot finish or fail the next attempt", async () => {
  let id = "first";
  const { controller } = harness(async (method) => {
    if (method === "account/login/start") return { ...login, loginId: id };
    if (method === "account/login/cancel") return { status: "canceled" };
    return signedOut;
  });
  try {
    await controller.startLogin();
    await controller.cancelLogin();
    id = "second";
    await controller.startLogin();
    controller.notification("account/login/completed", {
      loginId: "first",
      success: true,
    });
    controller.notification("account/login/completed", {
      loginId: "first",
      success: false,
    });
    await tick();
    assert.equal(controller.snapshot().status, "awaiting_browser");
    controller.notification("account/login/completed", {
      loginId: "second",
      success: false,
      error: "PRIVATE_ERROR",
    });
    assert.equal(controller.snapshot().error, "login_failed");
  } finally {
    controller.close();
  }
});

test("connection close invalidates pending start and account reads and clears sensitive attempt state", async () => {
  const started = deferred<unknown>();
  const read = deferred<unknown>();
  const { controller, calls } = harness(async (method) =>
    method === "account/login/start" ? started.promise : read.promise,
  );
  const opening = assert.rejects(controller.startLogin(), CodexTransportError);
  const refreshing = assert.rejects(
    controller.refreshAccount(),
    CodexTransportError,
  );
  controller.close();
  started.resolve(login);
  read.resolve(signedIn);
  await Promise.all([opening, refreshing]);
  controller.notification("account/login/completed", {
    loginId: login.loginId,
    success: true,
  });
  assert.deepEqual(controller.snapshot(), {
    status: "failed",
    account: null,
    error: "connection_lost",
  });
  assert.equal(calls.length, 2);
});

test("overlapping account reads publish only the latest response", async () => {
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  let count = 0;
  const { controller } = harness(async () =>
    ++count === 1 ? first.promise : second.promise,
  );
  try {
    const a = controller.refreshAccount();
    const b = controller.refreshAccount();
    second.resolve(signedOut);
    await b;
    first.resolve(signedIn);
    await a;
    assert.deepEqual(controller.snapshot().account, { status: "signed_out" });
  } finally {
    controller.close();
  }
});

test("login timeout cancels and reconciles but preserves an actionable fixed failure", async () => {
  const { controller, calls } = harness(async (method) => {
    if (method === "account/login/start") return login;
    if (method === "account/login/cancel") return { status: "canceled" };
    return signedOut;
  }, 10);
  try {
    await controller.startLogin();
    await delay(30);
    assert.equal(controller.snapshot().error, "login_timed_out");
    assert.equal(
      calls.filter((c) => c.method === "account/login/cancel").length,
      1,
    );
  } finally {
    controller.close();
  }
});

test("logout is explicit, reconciles its empty acknowledgement, and rejects a still signed-in result", async () => {
  for (const account of [signedOut, signedIn]) {
    const { controller, calls } = harness(async (method) =>
      method === "account/logout" ? {} : account,
    );
    try {
      if (account === signedOut) await controller.logout();
      else await assert.rejects(controller.logout(), CodexTransportError);
      assert.deepEqual(
        calls.map((c) => c.method),
        ["account/logout", "account/read"],
      );
    } finally {
      controller.close();
    }
  }
});

test("rate limit summaries preserve unknown windows, validate counts and omit credits/private fields", () => {
  const bucket = {
    limitId: "codex",
    limitName: "Codex",
    primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 2000000000 },
    secondary: null,
    credits: { balance: "PRIVATE" },
    privateField: "PRIVATE",
  };
  const decoded = decodeRateLimits({
    rateLimits: bucket,
    rateLimitsByLimitId: { codex: bucket },
  });
  assert.equal(decoded.buckets[0]?.primary?.remainingPercent, 75);
  assert.equal(decoded.buckets[0]?.secondary, null);
  assert.ok(!JSON.stringify(decoded).includes("PRIVATE"));
  assert.equal(
    decodeRateLimits({ rateLimits: { primary: { usedPercent: 110 } } })
      .buckets[0]?.primary?.remainingPercent,
    0,
  );
  assert.deepEqual(decodeRateLimits({ rateLimits: {} }), {
    buckets: [{ id: null, name: null, primary: null, secondary: null }],
  });
  validateRateLimitsUpdate({ rateLimits: { primary: { usedPercent: 10 } } });
  for (const primary of [
    { usedPercent: -1 },
    { usedPercent: NaN },
    { usedPercent: "25" },
    { usedPercent: 1, resetsAt: -1 },
    { usedPercent: 1, windowDurationMins: 0 },
  ]) {
    assert.throws(
      () => decodeRateLimits({ rateLimits: { primary } }),
      CodexTransportError,
    );
  }
  assert.throws(
    () =>
      decodeRateLimits({
        rateLimits: bucket,
        rateLimitsByLimitId: { other: bucket },
      }),
    CodexTransportError,
  );
});

test("cancellation retains exclusive ownership until account reconciliation finishes", async () => {
  const read = deferred<unknown>();
  const { controller } = harness(async (method) => {
    if (method === "account/login/start") return login;
    if (method === "account/login/cancel") return { status: "canceled" };
    return read.promise;
  });
  try {
    await controller.startLogin();
    const cancel = controller.cancelLogin();
    await tick();
    await assert.rejects(controller.startLogin(), CodexTransportError);
    read.resolve(signedOut);
    await cancel;
    assert.deepEqual(await controller.startLogin(), { authUrl: url });
    assert.equal(controller.snapshot().status, "awaiting_browser");
  } finally {
    controller.close();
  }
});

test("stale account-update failures cannot replace a new login's state", async () => {
  const oldRead = deferred<unknown>();
  const { controller } = harness(async (method) =>
    method === "account/login/start" ? login : oldRead.promise,
  );
  try {
    controller.notification("account/updated", { authMode: null });
    await controller.startLogin();
    oldRead.reject(new Error("PRIVATE_ERROR"));
    await tick();
    assert.equal(controller.snapshot().status, "awaiting_browser");
    assert.equal(controller.snapshot().error, null);
  } finally {
    controller.close();
  }
});

test("failed initiation strips unknown errors and permits a later explicit attempt", async () => {
  let fail = true;
  const { controller } = harness(async () => {
    if (fail) throw new Error("PRIVATE_ERROR");
    return login;
  });
  try {
    await assert.rejects(controller.startLogin(), (error: unknown) => {
      assert.ok(error instanceof CodexTransportError);
      assert.ok(!error.message.includes("PRIVATE"));
      return true;
    });
    assert.equal(controller.snapshot().error, "login_failed");
    fail = false;
    assert.deepEqual(await controller.startLogin(), { authUrl: url });
  } finally {
    controller.close();
  }
});
