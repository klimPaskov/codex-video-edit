import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  assertFrameRequest,
  assertMediaFrame,
  assertMediaSummary,
} from "../../packages/domain/src/library.ts";
import { MediaLibrary } from "../../packages/media-engine/src/library.ts";
import { runProcess } from "../../packages/media-engine/src/process.ts";

async function fixture(pixel = "bgra") {
  const root = resolve(".astra/evidence/library");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, "fixture-"));
  const raw = Buffer.alloc(16 * 16 * 4 * 2);
  for (let i = 0; i < raw.length; i++)
    raw[i] = (i * 37 + Math.floor(i / 1024) * 59) % 256;
  await writeFile(join(dir, "samples.raw"), raw);
  const source = join(dir, "sample.mkv");
  await runProcess({
    executable: "ffmpeg",
    args: [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "rawvideo",
      "-pixel_format",
      "bgra",
      "-video_size",
      "16x16",
      "-framerate",
      "2",
      "-color_range",
      "pc",
      "-colorspace",
      "rgb",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-i",
      join(dir, "samples.raw"),
      "-c:v",
      "ffv1",
      "-level",
      "3",
      "-pix_fmt",
      pixel,
      "-color_range",
      "pc",
      "-colorspace",
      "rgb",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      source,
    ],
  });
  return { dir, raw, source };
}
test("library preserves source, reopens, and transports exact native BGRA samples as RGBA", async () => {
  const { dir, raw, source } = await fixture();
  const original = await readFile(source);
  const root = join(dir, "library");
  const library = new MediaLibrary(root);
  assert.deepEqual(await library.list(), []);
  const summary = await library.importFile(source);
  assert.equal(summary.previewAvailable, true);
  assert.equal(summary.durationUs, 1_000_000);
  assert.equal(summary.frameRate, 2);
  assert.deepEqual(await new MediaLibrary(root).list(), [summary]);
  for (const timeUs of [0, 500_000]) {
    const frame = await library.frame(summary.id, timeUs);
    const expected = Buffer.from(
      raw.subarray(timeUs === 0 ? 0 : 1024, timeUs === 0 ? 1024 : 2048),
    );
    for (let i = 0; i < expected.length; i += 4) {
      const b = expected[i]!;
      expected[i] = expected[i + 2]!;
      expected[i + 2] = b;
    }
    assert.deepEqual(Buffer.from(frame.rgbaBase64, "base64"), expected);
  }
  assert.deepEqual(await readFile(source), original);
  const index = JSON.parse(
    await readFile(join(root, "index", `${summary.id}.json`), "utf8"),
  ) as { source: { sha256: string } };
  assert.equal(
    index.source.sha256,
    createHash("sha256").update(original).digest("hex"),
  );
  for (const time of [-1, NaN, Infinity, 1_000_000])
    await assert.rejects(library.frame(summary.id, time));
  await writeFile(join(root, "assets", `${summary.id}.media`), "tampered");
  await assert.rejects(library.frame(summary.id, 0), /changed/u);
});
test("higher precision imports without enabling an unverified preview", async () => {
  const { dir, source } = await fixture("gbrp16le");
  const library = new MediaLibrary(join(dir, "library"));
  const summary = await library.importFile(source);
  assert.equal(summary.previewAvailable, false);
  await assert.rejects(library.frame(summary.id, 0), /not yet verified/u);
  const path = join(dir, "library", "index", `${summary.id}.json`);
  const entry = JSON.parse(await readFile(path, "utf8")) as {
    summary: { previewAvailable: boolean };
  };
  entry.summary.previewAvailable = true;
  await writeFile(path, JSON.stringify(entry));
  await assert.rejects(library.list(), /invalid/u);
  await assert.rejects(library.frame(summary.id, 0), /invalid/u);
});
test("malformed and traversing manifests, symlink directories, and cancellation are rejected", async () => {
  const { dir, source } = await fixture();
  const root = join(dir, "library");
  const library = new MediaLibrary(root);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(library.importFile(source, controller.signal));
  const summary = await library.importFile(source);
  const path = join(root, "index", `${summary.id}.json`);
  const entry = JSON.parse(await readFile(path, "utf8")) as {
    source: { file: string };
  };
  entry.source.file = "../../sample.mkv";
  await writeFile(path, JSON.stringify(entry));
  await assert.rejects(library.list());
  const linked = join(dir, "linked");
  await symlink(root, linked, "junction");
  await assert.rejects(new MediaLibrary(linked).list());
  await writeFile(path, "{");
  await assert.rejects(library.list());
});
test("renderer contracts reject nonfinite seeks, excess fields, and wrong frame sizes", () => {
  assert.throws(() => assertFrameRequest({ id: "../file", timeUs: 0 }));
  assert.throws(() =>
    assertMediaFrame({ width: 1, height: 1, rgbaBase64: "AAAA" }),
  );
  assert.throws(() =>
    assertMediaFrame({ width: 1, height: 1, rgbaBase64: "AAAAAAAA" }),
  );
  assert.throws(() =>
    assertMediaSummary({ id: "unused", originalPath: "private" }),
  );
});
test("verified source remeasures precision, color and audio metadata despite unchanged source bytes", async () => {
  const { dir, source } = await fixture("gbrp16le");
  const withAudio = join(dir, "audio-video.mkv");
  await runProcess({
    executable: "ffmpeg",
    args: [
      "-v",
      "error",
      "-nostdin",
      "-i",
      source,
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000:duration=1",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "pcm_s16le",
      withAudio,
    ],
  });
  const root = join(dir, "verified-library");
  const library = new MediaLibrary(root);
  const summary = await library.importFile(withAudio);
  const verified = await library.verifiedSource(summary.id);
  assert.equal(summary.previewAvailable, false);
  const path = join(root, "index", `${summary.id}.json`);
  const pristine = await readFile(path, "utf8");
  const sourceBytes = await readFile(verified.managedPath);
  for (const [kind, field, value] of [
    ["video", "pix_fmt", "gbrp10le"],
    ["video", "color_primaries", "bt2020"],
    ["audio", "sample_fmt", "flt"],
  ]) {
    const entry = JSON.parse(pristine) as {
      probe: { streams: Record<string, unknown>[] };
    };
    const stream = entry.probe.streams.find(
      (item) => item.codec_type === kind,
    )!;
    stream[field!] = value;
    await writeFile(path, JSON.stringify(entry));
    // All displayed measurements and the recorded byte hash still agree.
    assert.deepEqual(await library.list(), [summary]);
    await assert.rejects(library.verifiedSource(summary.id), /measurements/u);
    assert.deepEqual(await readFile(verified.managedPath), sourceBytes);
  }
  await writeFile(path, pristine);
  assert.deepEqual(await library.verifiedSource(summary.id), verified);
});
