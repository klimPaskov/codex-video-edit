import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  publishFileWithoutOverwrite,
  readFileCancellable,
} from "../../packages/media-engine/src/files.ts";

test("cancellation at the publication boundary leaves the destination absent", async () => {
  const root = resolve(".astra/evidence/media");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "cancel-publication-"));
  const staged = join(directory, "staged.raw");
  const output = join(directory, "published.raw");
  const bytes = Buffer.from("atomic publication test bytes, not encoded media");
  await writeFile(staged, bytes);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    publishFileWithoutOverwrite(staged, output, controller.signal),
    { code: "CANCELLED" },
  );
  assert.equal((await readdir(directory)).includes("published.raw"), false);
  assert.deepEqual(await readFile(staged), bytes);
  await publishFileWithoutOverwrite(staged, output);
  assert.deepEqual(await readFile(output), bytes);
  await assert.rejects(publishFileWithoutOverwrite(staged, output), {
    code: "EEXIST",
  });
});

test("cancellation during file reading returns the stable media cancellation error", async () => {
  const root = resolve(".astra/evidence/media");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "cancel-read-"));
  const source = join(directory, "source.raw");
  await writeFile(source, Buffer.alloc(1024 * 1024, 37));
  const controller = new AbortController();
  const reading = readFileCancellable(source, controller.signal);
  controller.abort();
  await assert.rejects(reading, { code: "CANCELLED" });
  await assert.rejects(readFileCancellable(source, controller.signal), {
    code: "CANCELLED",
  });
});
