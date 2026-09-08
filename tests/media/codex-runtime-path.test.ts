import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CodexRuntimeError,
  resolveCodexRuntime,
} from "../../packages/codex-bridge/src/runtime.ts";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "codex-packaged-path-"));
  const directory = join(root, "codex");
  await mkdir(directory);
  const name = process.platform === "win32" ? "codex.exe" : "codex";
  const executable = join(directory, name);
  await writeFile(executable, "synthetic binary bytes, never executed");
  await chmod(executable, 0o755);
  await writeFile(
    join(directory, "LICENSE-APACHE-2.0.txt"),
    "synthetic license",
  );
  const manifest = {
    schemaVersion: 1,
    version: "0.142.3",
    platform: process.platform,
    arch: process.arch,
    executable: name,
    size: Buffer.byteLength("synthetic binary bytes, never executed"),
    sha256: hash("synthetic binary bytes, never executed"),
    licenseSha256: hash("synthetic license"),
  };
  const manifestPath = join(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { root, directory, executable, manifest, manifestPath };
}

test("packaged resolver uses fixed resources and verifies content without launching", async () => {
  const files = await fixture();
  try {
    assert.equal(await resolveCodexRuntime(files.root), files.executable);
    await writeFile(files.executable, "modified binary bytes, never executed");
    await assert.rejects(resolveCodexRuntime(files.root), CodexRuntimeError);
    await assert.rejects(resolveCodexRuntime("relative"), CodexRuntimeError);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("packaged manifest rejects missing, malformed, stale, foreign and redirected values", async () => {
  const files = await fixture();
  try {
    for (const patch of [
      { version: "0.0.1" },
      { executable: "../outside" },
      { platform: "other" },
      { arch: "other" },
      { size: 1 },
      { sha256: "invalid" },
      { unexpected: true },
    ]) {
      await writeFile(
        files.manifestPath,
        JSON.stringify({ ...files.manifest, ...patch }),
      );
      await assert.rejects(resolveCodexRuntime(files.root), CodexRuntimeError);
    }
    for (const text of ["{", "null", " ".repeat(4097)]) {
      await writeFile(files.manifestPath, text);
      await assert.rejects(resolveCodexRuntime(files.root), CodexRuntimeError);
    }
    await rm(files.manifestPath);
    await assert.rejects(resolveCodexRuntime(files.root), CodexRuntimeError);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("packaged resolver rejects damaged licensing and missing executable", async () => {
  const files = await fixture();
  try {
    await writeFile(join(files.directory, "LICENSE-APACHE-2.0.txt"), "changed");
    await assert.rejects(resolveCodexRuntime(files.root), CodexRuntimeError);
    await writeFile(
      join(files.directory, "LICENSE-APACHE-2.0.txt"),
      "synthetic license",
    );
    await rm(files.executable);
    await assert.rejects(resolveCodexRuntime(files.root), CodexRuntimeError);
  } finally {
    await rm(files.root, { recursive: true, force: true });
  }
});

test("packaged resolver rejects symlinked runtime directories", async () => {
  const files = await fixture();
  const redirected = await mkdtemp(join(tmpdir(), "codex-packaged-link-"));
  try {
    await symlink(
      files.directory,
      join(redirected, "codex"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(resolveCodexRuntime(redirected), CodexRuntimeError);
    assert.ok((await readFile(files.executable)).length);
  } finally {
    await rm(redirected, { recursive: true, force: true });
    await rm(files.root, { recursive: true, force: true });
  }
});
