import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
  ProviderKeyError,
  ProviderKeyStore,
} from "../../apps/desktop/src/provider-keys.ts";
import type { SafeStorageAdapter } from "../../apps/desktop/src/provider-keys.ts";

const key = "test-provider-key-12345";

function storage(
  backend = "gnome_libsecret",
  available = true,
): SafeStorageAdapter {
  return {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => backend,
    encryptString: (plainText) => Buffer.from(`encrypted:${plainText}`, "utf8"),
    decryptString: (encrypted) => encrypted.toString("utf8").slice(10),
  };
}

function errorCode(code: string) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof ProviderKeyError);
    assert.equal(error.code, code);
    assert.ok(!JSON.stringify(error).includes(key));
    return true;
  };
}

async function directory(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "provider-keys-test-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  return root;
}

test("both providers retain separate session-only keys and remove them", async (t) => {
  const root = await directory(t);
  const keys = new ProviderKeyStore(root, storage(), { platform: "linux" });
  assert.deepEqual(await keys.set("openai", key, { remember: false }), {
    hasKey: true,
    remembered: false,
    canRemember: true,
  });
  await keys.set("deepseek", "test-deepseek-key-456", { remember: false });
  assert.equal(await keys.get("openai"), key);
  assert.equal(await keys.get("deepseek"), "test-deepseek-key-456");
  assert.equal(
    await new ProviderKeyStore(root, storage(), { platform: "linux" }).get(
      "openai",
    ),
    null,
  );
  await keys.remove("openai");
  assert.equal(await keys.get("openai"), null);
  assert.equal(await keys.get("deepseek"), "test-deepseek-key-456");
});

test("remembered key is ciphertext in a private file and reloads", async (t) => {
  const root = await directory(t);
  const keys = new ProviderKeyStore(root, storage(), { platform: "linux" });
  assert.deepEqual(await keys.set("deepseek", key, { remember: true }), {
    hasKey: true,
    remembered: true,
    canRemember: true,
  });
  const file = join(root, "deepseek.key");
  const onDisk = await readFile(file, "utf8");
  assert.ok(!onDisk.startsWith(key));
  if (process.platform !== "win32")
    assert.equal((await stat(file)).mode & 0o777, 0o600);
  const reopened = new ProviderKeyStore(root, storage(), { platform: "linux" });
  assert.equal(await reopened.get("deepseek"), key);
  assert.deepEqual(await reopened.status("deepseek"), {
    hasKey: true,
    remembered: true,
    canRemember: true,
  });
  await reopened.remove("deepseek");
  assert.equal(await reopened.get("deepseek"), null);
});

test("Linux basic_text and unavailable encryption reject remember atomically", async (t) => {
  const root = await directory(t);
  for (const adapter of [
    storage("basic_text"),
    storage("unknown"),
    storage("", false),
  ]) {
    const keys = new ProviderKeyStore(root, adapter, { platform: "linux" });
    await assert.rejects(
      keys.set("openai", key, { remember: true }),
      errorCode("secure_storage_unavailable"),
    );
    assert.deepEqual(await keys.status("openai"), {
      hasKey: false,
      remembered: false,
      canRemember: false,
    });
    assert.equal(await keys.get("openai"), null);
    assert.deepEqual(await keys.set("openai", key, { remember: false }), {
      hasKey: true,
      remembered: false,
      canRemember: false,
    });
    await keys.remove("openai");
  }
});

test("rejected remember preserves a preexisting session key and ciphertext", async (t) => {
  const root = await directory(t);
  const good = new ProviderKeyStore(root, storage(), { platform: "linux" });
  await good.set("openai", key, { remember: true });
  const before = await readFile(join(root, "openai.key"));
  const bad = new ProviderKeyStore(root, storage("basic_text"), {
    platform: "linux",
  });
  await assert.rejects(
    bad.set("openai", "new-key-rejected", { remember: true }),
    errorCode("secure_storage_unavailable"),
  );
  assert.deepEqual(await readFile(join(root, "openai.key")), before);
  await bad.set("openai", "session-key-before", { remember: false });
  await assert.rejects(
    bad.set("openai", "new-key-rejected", { remember: true }),
    errorCode("secure_storage_unavailable"),
  );
  assert.equal(await bad.get("openai"), "session-key-before");
  // The explicit session-only save removed the earlier persisted value.
  await assert.rejects(readFile(join(root, "openai.key")), /ENOENT/);
  assert.ok(before.length > 0);
});

test("storage failures expose fixed errors without key fragments", async (t) => {
  const root = await directory(t);
  const broken: SafeStorageAdapter = {
    ...storage(),
    encryptString: () => {
      throw new Error(`private failure ${key}`);
    },
  };
  const keys = new ProviderKeyStore(root, broken, { platform: "linux" });
  await assert.rejects(
    keys.set("deepseek", key, { remember: true }),
    errorCode("storage_failure"),
  );
  assert.equal(await keys.get("deepseek"), null);
});

test("invalid provider IDs and malformed keys are rejected before storage", async (t) => {
  const root = await directory(t);
  const keys = new ProviderKeyStore(root, storage(), { platform: "linux" });
  await assert.rejects(
    keys.set("host.invalid" as "openai", key, { remember: false }),
    errorCode("invalid_key"),
  );
  await assert.rejects(
    keys.set("openai", "bad\nkey", { remember: false }),
    errorCode("invalid_key"),
  );
});

test(
  "a linked parent directory cannot redirect key storage",
  { skip: process.platform === "win32" },
  async (t) => {
    const root = await directory(t);
    await mkdir(join(root, "real"));
    await symlink(join(root, "real"), join(root, "linked"), "dir");
    const keys = new ProviderKeyStore(join(root, "linked", "keys"), storage(), {
      platform: "linux",
    });
    await assert.rejects(
      keys.set("deepseek", key, { remember: false }),
      errorCode("storage_failure"),
    );
  },
);
