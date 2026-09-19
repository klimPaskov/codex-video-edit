import assert from "node:assert/strict";
import test from "node:test";
import { DesktopApiProviders } from "../../apps/desktop/src/api-providers.ts";
import type { ApiProviderId } from "../../packages/domain/src/api-providers.ts";

const testKey = "TEST-ONLY-PROVIDER-KEY";
function harness(canRemember: boolean) {
  const keys = new Map<ApiProviderId, { value: string; remembered: boolean }>();
  const calls: { provider: ApiProviderId; key: string }[] = [];
  const account = new DesktopApiProviders(
    {
      get: async (provider) => keys.get(provider)?.value ?? null,
      status: async (provider) => ({
        hasKey: keys.has(provider),
        remembered: keys.get(provider)?.remembered ?? false,
        canRemember,
      }),
      set: async (provider, key, { remember }) => {
        keys.set(provider, { value: key, remembered: remember });
        return { hasKey: true, remembered: remember, canRemember };
      },
      remove: async (provider) => {
        keys.delete(provider);
      },
    },
    {
      listModels: async (provider, key) => {
        calls.push({ provider, key });
        if (key === "INVALID-KEY") throw new Error(`PRIVATE ${key}`);
        return provider === "deepseek" ? ["deepseek-flash"] : ["gpt-4.1"];
      },
    },
  );
  return { account, calls, keys };
}

test("explicit API-key connection discovers separate catalogs without exposing keys", async () => {
  const { account, calls } = harness(true);
  assert.equal((await account.get()).providers[0]?.connected, false);
  let view = await account.connect({
    provider: "deepseek",
    key: testKey,
    remember: true,
  });
  assert.equal(view.providers[0]?.remembered, true);
  assert.deepEqual(view.providers[0]?.models, ["deepseek-flash"]);
  assert.ok(!JSON.stringify(view).includes(testKey));
  view = await account.selectModel({
    provider: "deepseek",
    model: "deepseek-flash",
  });
  assert.equal(view.providers[0]?.selectedModel, "deepseek-flash");
  assert.deepEqual(await account.selected("deepseek"), {
    key: testKey,
    model: "deepseek-flash",
  });
  await assert.rejects(
    account.selectModel({ provider: "deepseek", model: "fabricated" }),
  );
  view = await account.connect({
    provider: "openai",
    key: testKey,
    remember: false,
  });
  assert.deepEqual(view.providers[1]?.models, ["gpt-4.1"]);
  assert.deepEqual(
    calls.map((entry) => entry.provider),
    ["deepseek", "openai"],
  );
  view = await account.remove({ provider: "deepseek" });
  assert.equal(view.providers[0]?.connected, false);
  assert.equal(await account.selected("deepseek"), null);
});

test("insecure persistence and invalid credentials never replace a working key", async () => {
  const { account, calls } = harness(false);
  let view = await account.connect({
    provider: "deepseek",
    key: testKey,
    remember: true,
  });
  assert.equal(view.providers[0]?.connected, false);
  assert.equal(
    view.providers[0]?.message,
    "Secure storage is unavailable. Use this session only.",
  );
  assert.equal(calls.length, 0);
  view = await account.connect({
    provider: "deepseek",
    key: testKey,
    remember: false,
  });
  assert.equal(view.providers[0]?.connected, true);
  view = await account.connect({
    provider: "deepseek",
    key: "INVALID-KEY",
    remember: false,
  });
  assert.equal(
    view.providers[0]?.message,
    "Connection failed. Check the key and try again.",
  );
  assert.equal(view.providers[0]?.connected, true);
  assert.ok(!JSON.stringify(view).includes("INVALID-KEY"));
});

test("a saved key with an unavailable secure backend stays removable", async () => {
  let removed = false;
  const account = new DesktopApiProviders(
    {
      get: async () => null,
      status: async () => ({
        hasKey: false,
        remembered: !removed,
        canRemember: false,
      }),
      set: async () => {
        throw new Error("Unavailable");
      },
      remove: async () => {
        removed = true;
      },
    },
    { listModels: async () => [] },
  );
  const view = await account.get();
  assert.equal(view.providers[0]?.connected, false);
  assert.equal(view.providers[0]?.remembered, true);
  assert.match(view.providers[0]?.message ?? "", /unavailable/);
  assert.equal(
    (await account.remove({ provider: "deepseek" })).providers[0]?.remembered,
    false,
  );
});
