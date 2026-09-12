import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { CodexSettingsStore } from "../../apps/desktop/src/codex-settings.ts";
import {
  assertCodexView,
  assertCodexSelection,
} from "../../packages/domain/src/codex-view.ts";

test("Codex IPC rejects private fields and contradictory account or catalog state", async () => {
  const fixture = JSON.parse(
    await readFile(
      resolve("docs/contracts/codex-settings-example.json"),
      "utf8",
    ),
  );
  const view = fixture.response.value;
  assertCodexView(view);
  for (const changed of [
    { ...view, authUrl: "https://auth.openai.com/private" },
    { ...view, account: "signed_in", connection: "unavailable" },
    { ...view, account: "unknown", plan: "pro" },
    { ...view, message: "private\nraw protocol" },
    {
      ...view,
      account: "signed_in",
      models: [
        { id: "a", name: "A", reasoning: ["low"], defaultReasoning: "high" },
      ],
    },
    {
      ...view,
      account: "signed_in",
      limits: [{ name: "Limit", remainingPercent: 101, resetsAt: null }],
    },
    {
      ...view,
      selection: { modelId: "a", reasoning: "low", command: "unsafe" },
    },
  ])
    assert.throws(() => assertCodexView(changed));
  assert.throws(() => assertCodexSelection({ modelId: "a", reasoning: "" }));
});

test("model settings snapshot queued input and survive reopen", async () => {
  const parent = resolve("test-results/codex-settings");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, "fixture-"));
  const store = new CodexSettingsStore(root);
  assert.equal(await store.read(), null);
  const input = { modelId: "runtime-model", reasoning: "runtime-effort" };
  const pending = store.write(input);
  input.modelId = "mutated";
  assert.deepEqual(await pending, {
    modelId: "runtime-model",
    reasoning: "runtime-effort",
  });
  assert.deepEqual(await new CodexSettingsStore(root).read(), {
    modelId: "runtime-model",
    reasoning: "runtime-effort",
  });
  const before = await readFile(join(root, "selection.json"));
  assert.throws(() =>
    store.write({ modelId: "a", reasoning: "b", token: "PRIVATE" }),
  );
  assert.deepEqual(await readFile(join(root, "selection.json")), before);
  await writeFile(join(root, "selection.json"), "broken");
  await assert.rejects(store.read());
  await assert.rejects(store.write({ modelId: "a", reasoning: "b" }));
  assert.equal(await readFile(join(root, "selection.json"), "utf8"), "broken");
});
