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
import {
  MediaLibrary,
  mediaMeasurements,
} from "../../packages/media-engine/src/library.ts";
import { runProcess } from "../../packages/media-engine/src/process.ts";

async function fixture(pixel = "bgra") {
  const root = resolve("test-results/library");
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

test("tagged H.264/AAC imports byte-identically and decodes deterministic display-only frames", async () => {
  const root = resolve("test-results/library");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, "h264-"));
  const source = join(dir, "source.mp4");
  await runProcess({
    executable: "ffmpeg",
    args: [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=64x48:rate=2:duration=1.5",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000:duration=1.5",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-vf",
      "setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
      "-c:v",
      "libx264",
      "-qp",
      "0",
      "-pix_fmt",
      "yuv420p",
      "-color_range",
      "tv",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-c:a",
      "aac",
      "-ac",
      "2",
      source,
    ],
  });
  const sourceBytes = await readFile(source);
  const libraryRoot = join(dir, "library");
  const library = new MediaLibrary(libraryRoot);
  const summary = await library.importFile(source);
  assert.equal(summary.previewAvailable, true);
  assert.equal(summary.width, 64);
  assert.equal(summary.height, 48);
  assert.equal(summary.frameRate, 2);
  assert.equal(summary.durationUs, 1_500_000);
  const verified = await library.verifiedSource(summary.id);
  assert.equal(
    verified.sha256,
    createHash("sha256").update(sourceBytes).digest("hex"),
  );
  assert.deepEqual(await readFile(verified.managedPath), sourceBytes);
  assert.deepEqual(await readFile(source), sourceBytes);
  assert.deepEqual(await new MediaLibrary(libraryRoot).list(), [summary]);
  const frames = [];
  for (const timeUs of [0, 500_000, 1_000_000]) {
    const frame = await library.frame(summary.id, timeUs);
    assert.equal(frame.width, 64);
    assert.equal(frame.height, 48);
    const rgba = Buffer.from(frame.rgbaBase64, "base64");
    assert.equal(rgba.length, 64 * 48 * 4);
    for (let i = 3; i < rgba.length; i += 4) assert.equal(rgba[i], 255);
    assert.deepEqual(
      await new MediaLibrary(libraryRoot).frame(summary.id, timeUs),
      frame,
    );
    frames.push(createHash("sha256").update(rgba).digest("hex"));
  }
  assert.equal(new Set(frames).size, 3);
  assert.deepEqual(await readFile(verified.managedPath), sourceBytes);
});

test("H.264 preview rejects unknown color, higher precision, display transforms and non-square pixels", async () => {
  const root = resolve("test-results/library");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, "profiles-"));
  const source = join(dir, "source.mp4");
  await runProcess({
    executable: "ffmpeg",
    args: [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=32x32:rate=1:duration=1",
      "-vf",
      "setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-color_range",
      "tv",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      source,
    ],
  });
  const library = new MediaLibrary(join(dir, "library"));
  const summary = await library.importFile(source);
  assert.equal(summary.previewAvailable, true);
  const video = (await library.verifiedSource(summary.id)).probe
    .streams as Record<string, unknown>[];
  const original = video.find((item) => item.codec_type === "video")!;
  for (const change of [
    { color_space: "unknown" },
    { color_primaries: "bt2020" },
    { color_transfer: "smpte2084" },
    { pix_fmt: "yuv420p10le" },
    { sample_aspect_ratio: "4:3" },
    { tags: { rotate: "90" } },
    { side_data_list: [{ side_data_type: "Display Matrix", rotation: 0 }] },
  ]) {
    const measured = mediaMeasurements({
      streams: [{ ...original, ...change }],
      format: { duration: "1" },
    });
    assert.equal(measured.previewAvailable, false, JSON.stringify(change));
  }
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
