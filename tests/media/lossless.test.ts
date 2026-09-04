import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  encodeVerifiedMaster,
  sha256,
} from "../../packages/media-engine/src/lossless.ts";
import {
  assertCaptureAvailable,
  assertMasterInput,
  frameByteLength,
  frameToMicroseconds,
  validateFormat,
} from "../../packages/media-engine/src/profiles.ts";
import type {
  AudioFormat,
  CanonicalFormat,
  PixelFormat,
} from "../../packages/media-engine/src/profiles.ts";

const evidenceRoot = resolve(".astra/evidence/media");
const formatFor = (
  pixelFormat: PixelFormat,
  audioFormat: AudioFormat,
  mono = false,
): CanonicalFormat => ({
  width: 16,
  height: 16,
  frameRate: { numerator: 30000, denominator: 1001 },
  pixelFormat,
  color: {
    range: pixelFormat === "bgra" || pixelFormat === "gbrp16le" ? "pc" : "tv",
    space:
      pixelFormat === "bgra" || pixelFormat === "gbrp16le" ? "gbr" : "bt709",
    primaries: "bt709",
    transfer: "bt709",
  },
  audio: {
    format: audioFormat,
    sampleRate: 48000,
    channelLayout: mono ? "mono" : "stereo",
  },
});

function samples(
  format: CanonicalFormat,
  edited: boolean,
): { video: Buffer; audio: Buffer } {
  const video = Buffer.alloc(frameByteLength(format) * 12);
  if (format.pixelFormat === "bgra") {
    for (let i = 0; i < video.length; i++)
      video[i] = (i * 37 + Math.floor(i / 256) * 13 + (edited ? 29 : 0)) % 256;
  } else {
    const max = format.pixelFormat === "yuv444p10le" ? 1024 : 65536;
    for (let i = 0; i < video.length / 2; i++)
      video.writeUInt16LE((i * 997 + (edited ? 411 : 0)) % max, i * 2);
  }
  const bytes = { s16le: 2, s24le: 3, s32le: 4, f32le: 4, f64le: 8 }[
    format.audio.format
  ];
  const count = 19219 * (format.audio.channelLayout === "mono" ? 1 : 2);
  const audio = Buffer.alloc(count * bytes);
  for (let i = 0; i < count; i++) {
    const value = Math.sin(i * 0.17) * (edited ? 0.25 : 0.75);
    const offset = i * bytes;
    if (format.audio.format === "f32le") audio.writeFloatLE(value, offset);
    else if (format.audio.format === "f64le")
      audio.writeDoubleLE(value, offset);
    else
      audio.writeIntLE(
        Math.trunc(value * (2 ** (bytes * 8 - 1) - 1)),
        offset,
        bytes,
      );
  }
  return { video, audio };
}

for (const [pixel, audio, mono] of [
  ["bgra", "s16le", false],
  ["gbrp16le", "f32le", false],
  ["yuv444p10le", "s24le", true],
  ["yuv444p16le", "s32le", false],
  ["yuva444p16le", "f64le", false],
] as const) {
  test(`${pixel}/${audio}: exact no-op and edited canonical round trips`, async () => {
    await mkdir(evidenceRoot, { recursive: true });
    const directory = await mkdtemp(join(evidenceRoot, `${pixel}-${audio}-`));
    const format = formatFor(pixel, audio, mono);
    const original = samples(format, false);
    const edited = samples(format, true);
    assert.notEqual(sha256(original.video), sha256(edited.video));
    assert.notEqual(sha256(original.audio), sha256(edited.audio));
    const originalVideoPath = join(directory, "source-video.raw");
    const originalAudioPath = join(directory, "source-audio.raw");
    await writeFile(originalVideoPath, original.video);
    await writeFile(originalAudioPath, original.audio);
    for (const [name, canonical] of [
      ["noop", original],
      ["edited", edited],
    ] as const) {
      const videoPath = join(directory, `${name}-video.raw`);
      const audioPath = join(directory, `${name}-audio.raw`);
      const outputPath = join(directory, `${name}.mkv`);
      await writeFile(videoPath, canonical.video);
      await writeFile(audioPath, canonical.audio);
      const evidence = await encodeVerifiedMaster(
        { videoPath, audioPath, role: "canonical", format },
        outputPath,
      );
      assert.equal(evidence.frameCount, 12);
      assert.equal(evidence.audioSampleCount, 19219);
      assert.equal(evidence.durationUs, 400400);
      assert.equal(
        evidence.timingVerification,
        "rational-rate-and-sample-count-only",
      );
      assert.match(evidence.containerVideoTimeBase, /^\d+\/\d+$/);
      assert.ok(Math.abs(evidence.avDurationDifferenceUs) <= 21);
      assert.equal(evidence.videoSamplesEqual, true);
      assert.equal(evidence.audioSamplesEqual, true);
      assert.equal(evidence.outputSha256, sha256(await readFile(outputPath)));
      assert.equal(
        sha256(await readFile(originalVideoPath)),
        sha256(original.video),
      );
      assert.equal(
        sha256(await readFile(originalAudioPath)),
        sha256(original.audio),
      );
      assert.equal(
        (await readdir(directory)).some((entry) =>
          entry.startsWith(".media-stage-"),
        ),
        false,
      );
      await writeFile(
        join(directory, `${name}-evidence.json`),
        `${JSON.stringify(evidence, null, 2)}\n`,
      );
    }
  });
}

test("precision, HDR, proxy, and unverified capture fail without a fallback", () => {
  const format = formatFor("gbrp16le", "f32le");
  assert.throws(
    () => validateFormat({ ...format, pixelFormat: "yuv420p" as PixelFormat }),
    { code: "UNSUPPORTED_PROFILE" },
  );
  assert.throws(
    () =>
      validateFormat({
        ...format,
        color: { ...format.color, transfer: "smpte2084" as "bt709" },
      }),
    { code: "UNSUPPORTED_PROFILE" },
  );
  assert.throws(
    () =>
      validateFormat({
        ...format,
        frameRate: { numerator: 29.97, denominator: 1 },
      }),
    { code: "INVALID_INPUT" },
  );
  for (const role of [
    "preview-proxy",
    "analysis",
    "original",
    "lossless-intermediate",
  ] as const)
    assert.throws(() => assertMasterInput(role), { code: "INVALID_INPUT" });
  assert.throws(assertCaptureAvailable, { code: "UNSUPPORTED_PROFILE" });
  assert.equal(frameToMicroseconds(1, format.frameRate), 33366);
  assert.equal(frameToMicroseconds(30000, format.frameRate), 1001000000);
  assert.throws(() => frameToMicroseconds(-1, format.frameRate), {
    code: "INVALID_INPUT",
  });
});

test("failed encoding does not promote output or mutate samples; destinations cannot be overwritten", async () => {
  await mkdir(evidenceRoot, { recursive: true });
  const directory = await mkdtemp(join(evidenceRoot, "failure-"));
  const format = formatFor("bgra", "s16le");
  const canonical = samples(format, false);
  const videoPath = join(directory, "video.raw");
  const audioPath = join(directory, "audio.raw");
  const outputPath = join(directory, "master.mkv");
  await writeFile(videoPath, canonical.video);
  await writeFile(audioPath, canonical.audio);
  const input = { videoPath, audioPath, role: "canonical" as const, format };
  await assert.rejects(
    encodeVerifiedMaster(input, outputPath, {
      executables: { ffmpeg: "ffmpeg", ffprobe: "nonexistent-media-probe" },
    }),
    { code: "PROCESS_UNAVAILABLE" },
  );
  assert.equal(
    (await readdir(directory)).some(
      (entry) => entry.startsWith(".media-stage-") || entry === "master.mkv",
    ),
    false,
  );
  await writeFile(outputPath, "existing user output");
  await assert.rejects(encodeVerifiedMaster(input, outputPath), {
    code: "EEXIST",
  });
  assert.equal((await readFile(outputPath)).toString(), "existing user output");
  assert.equal(sha256(await readFile(videoPath)), sha256(canonical.video));
  await assert.rejects(
    encodeVerifiedMaster({ ...input, role: "preview-proxy" }, outputPath),
    { code: "INVALID_INPUT" },
  );
  await assert.rejects(
    encodeVerifiedMaster(input, join(directory, "wrong.mp4")),
    { code: "INVALID_INPUT" },
  );
  await writeFile(videoPath, canonical.video.subarray(1));
  await assert.rejects(encodeVerifiedMaster(input, outputPath), {
    code: "INVALID_INPUT",
  });
});

test("an invalid 10-bit canonical sample cannot be silently truncated", async () => {
  await mkdir(evidenceRoot, { recursive: true });
  const directory = await mkdtemp(join(evidenceRoot, "invalid-precision-"));
  const format = formatFor("yuv444p10le", "s24le", true);
  const canonical = samples(format, false);
  canonical.video.writeUInt16LE(65535, 0);
  const videoPath = join(directory, "video.raw");
  const audioPath = join(directory, "audio.raw");
  const outputPath = join(directory, "master.mkv");
  await writeFile(videoPath, canonical.video);
  await writeFile(audioPath, canonical.audio);
  await assert.rejects(
    encodeVerifiedMaster(
      { videoPath, audioPath, role: "canonical", format },
      outputPath,
    ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      ["FIDELITY_MISMATCH", "PROCESS_FAILED"].includes(String(error.code)),
  );
  assert.equal(
    (await readdir(directory)).some(
      (entry) => entry.startsWith(".media-stage-") || entry === "master.mkv",
    ),
    false,
  );
  assert.equal(sha256(await readFile(videoPath)), sha256(canonical.video));
});

test("encoding snapshots caller format and returns frozen evidence", async () => {
  await mkdir(evidenceRoot, { recursive: true });
  const directory = await mkdtemp(join(evidenceRoot, "format-snapshot-"));
  const format = formatFor("bgra", "s16le");
  const expectedFormat = structuredClone(format);
  const canonical = samples(format, false);
  const videoPath = join(directory, "video.raw");
  const audioPath = join(directory, "audio.raw");
  await writeFile(videoPath, canonical.video);
  await writeFile(audioPath, canonical.audio);
  const encoding = encodeVerifiedMaster(
    { videoPath, audioPath, role: "canonical", format },
    join(directory, "master.mkv"),
  );
  // Mutate while the first asynchronous read is pending; the encode must retain its validated input.
  format.pixelFormat = "gbrp16le";
  format.frameRate.numerator = 25;
  format.color.space = "bt709";
  format.audio.sampleRate = 44100;
  const evidence = await encoding;
  assert.deepEqual(evidence.canonicalFormat, expectedFormat);
  assert.equal(evidence.videoSamplesEqual, true);
  assert.equal(evidence.audioSamplesEqual, true);
  assert.equal(
    evidence.stageKey,
    sha256(
      JSON.stringify({
        adapter: "canonical-ffv1-pcm-v1",
        format: expectedFormat,
        sourceVideoSha256: sha256(canonical.video),
        sourceAudioSha256: sha256(canonical.audio),
        ffmpegVersion: evidence.ffmpegVersion,
      }),
    ),
  );
  format.width = 1920;
  format.audio.format = "f64le";
  assert.deepEqual(evidence.canonicalFormat, expectedFormat);
  assert.throws(() => {
    evidence.canonicalFormat.width = 1920;
  }, TypeError);
  assert.throws(() => {
    evidence.canonicalFormat.frameRate.numerator = 25;
  }, TypeError);
  assert.throws(() => {
    evidence.canonicalFormat.color.range = "tv";
  }, TypeError);
  assert.throws(() => {
    evidence.canonicalFormat.audio.sampleRate = 44100;
  }, TypeError);
  assert.throws(() => {
    evidence.stageKey = "changed";
  }, TypeError);
  assert.deepEqual(evidence.canonicalFormat, expectedFormat);
});
