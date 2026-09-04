import { createHash } from "node:crypto";
import { stat, mkdtemp, rm } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { MediaError, runProcess } from "./process.ts";
import {
  assertMasterInput,
  audioSampleByteLength,
  frameByteLength,
  frameToMicroseconds,
  validateFormat,
} from "./profiles.ts";
import type { CanonicalFormat, MediaRole } from "./profiles.ts";
import {
  assertNotCancelled,
  publishFileWithoutOverwrite,
  readFileCancellable,
} from "./files.ts";

export interface CanonicalInput {
  videoPath: string;
  audioPath: string;
  role: MediaRole;
  format: CanonicalFormat;
}
export interface LosslessEvidence {
  stageKey: string;
  ffmpegVersion: string;
  sourceVideoSha256: string;
  sourceAudioSha256: string;
  outputSha256: string;
  videoSamplesEqual: true;
  audioSamplesEqual: true;
  sourceHashesUnchanged: true;
  frameCount: number;
  audioSampleCount: number;
  durationUs: number;
  audioDurationUs: number;
  avDurationDifferenceUs: number;
  containerVideoTimeBase: string;
  timingVerification: "rational-rate-and-sample-count-only";
  canonicalFormat: CanonicalFormat;
  boundary: "canonical-render-to-encoded-master";
}
export interface MediaExecutables {
  ffmpeg: string;
  ffprobe: string;
}
const defaultExecutables = { ffmpeg: "ffmpeg", ffprobe: "ffprobe" };
export function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function readBounded(
  path: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  assertNotCancelled(signal);
  const info = await stat(path);
  assertNotCancelled(signal);
  if (!info.isFile() || info.size === 0 || info.size > 64 * 1024 * 1024) {
    throw new MediaError(
      "INVALID_INPUT",
      "Foundation adapter accepts nonempty canonical files up to 64 MiB each.",
    );
  }
  return readFileCancellable(path, signal);
}

/** P0 bounded raw-sample adapter. No capture, compositing, resampling, or implicit conversion. */
export async function encodeVerifiedMaster(
  input: CanonicalInput,
  outputPath: string,
  options: { executables?: MediaExecutables; signal?: AbortSignal } = {},
): Promise<LosslessEvidence> {
  const { videoPath, audioPath, role } = input;
  const { signal } = options;
  const executables = { ...(options.executables ?? defaultExecutables) };
  const format = structuredClone(input.format);
  assertNotCancelled(signal);
  assertMasterInput(role);
  validateFormat(format);
  Object.freeze(format.frameRate);
  Object.freeze(format.color);
  Object.freeze(format.audio);
  Object.freeze(format);
  if (
    extname(outputPath).toLowerCase() !== ".mkv" ||
    [videoPath, audioPath].some((path) => resolve(path) === resolve(outputPath))
  ) {
    throw new MediaError(
      "INVALID_INPUT",
      "A distinct Matroska output path is required.",
    );
  }
  const video = await readBounded(videoPath, signal);
  const audio = await readBounded(audioPath, signal);
  const frameCount = video.length / frameByteLength(format);
  const audioSampleCount = audio.length / audioSampleByteLength(format);
  if (!Number.isInteger(frameCount) || !Number.isInteger(audioSampleCount))
    throw new MediaError(
      "INVALID_INPUT",
      "Canonical input has incomplete frames or audio samples.",
    );
  const durationUs = frameToMicroseconds(frameCount, format.frameRate);
  const audioDurationUs = Number(
    (BigInt(audioSampleCount) * 1_000_000n) / BigInt(format.audio.sampleRate),
  );
  if (
    Math.abs(durationUs - audioDurationUs) >
    Math.ceil(1_000_000 / format.audio.sampleRate)
  ) {
    throw new MediaError(
      "INVALID_INPUT",
      "Canonical audio and video duration differ by more than one audio sample.",
    );
  }
  const run = (executable: string, args: string[]) =>
    runProcess({
      executable,
      args,
      ...(signal ? { signal } : {}),
    });
  const version = await run(executables.ffmpeg, ["-version"]);
  const ffmpegVersion = version.stdout.toString().split(/\r?\n/)[0] ?? "";
  const sourceVideoSha256 = sha256(video);
  const sourceAudioSha256 = sha256(audio);
  const stageKey = sha256(
    JSON.stringify({
      adapter: "canonical-ffv1-pcm-v1",
      format,
      sourceVideoSha256,
      sourceAudioSha256,
      ffmpegVersion,
    }),
  );
  const directory = await mkdtemp(
    join(dirname(resolve(outputPath)), ".media-stage-"),
  );
  const staged = join(directory, "master.mkv");
  const decodedVideo = join(directory, "decoded-video.raw");
  const decodedAudio = join(directory, "decoded-audio.raw");
  const common = ["-hide_banner", "-loglevel", "error", "-nostdin", "-n"];
  try {
    await run(executables.ffmpeg, [
      ...common,
      "-f",
      "rawvideo",
      "-pixel_format",
      format.pixelFormat,
      "-video_size",
      `${format.width}x${format.height}`,
      "-framerate",
      `${format.frameRate.numerator}/${format.frameRate.denominator}`,
      "-color_range",
      format.color.range,
      "-colorspace",
      format.color.space === "gbr" ? "rgb" : format.color.space,
      "-color_primaries",
      format.color.primaries,
      "-color_trc",
      format.color.transfer,
      "-i",
      resolve(videoPath),
      "-f",
      format.audio.format,
      "-ar",
      String(format.audio.sampleRate),
      "-ch_layout",
      format.audio.channelLayout,
      "-i",
      resolve(audioPath),
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-map_metadata",
      "-1",
      "-c:v",
      "ffv1",
      "-level",
      "3",
      "-coder",
      "1",
      "-context",
      "1",
      "-slicecrc",
      "1",
      "-pix_fmt",
      `+${format.pixelFormat}`,
      "-threads:v",
      "1",
      "-fps_mode",
      "passthrough",
      "-color_range",
      format.color.range,
      "-colorspace",
      format.color.space === "gbr" ? "rgb" : format.color.space,
      "-color_primaries",
      format.color.primaries,
      "-color_trc",
      format.color.transfer,
      "-c:a",
      `pcm_${format.audio.format}`,
      "-f",
      "matroska",
      staged,
    ]);
    const probe = JSON.parse(
      (
        await run(executables.ffprobe, [
          "-v",
          "error",
          "-count_frames",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          staged,
        ])
      ).stdout.toString(),
    ) as {
      streams: Array<Record<string, string | number>>;
    };
    const v = probe.streams.find((stream) => stream["codec_type"] === "video");
    const a = probe.streams.find((stream) => stream["codec_type"] === "audio");
    const expectedAudioFormat = {
      s16le: "s16",
      s24le: "s32",
      s32le: "s32",
      f32le: "flt",
      f64le: "dbl",
    }[format.audio.format];
    const rationalEqual = (rate: string | number | undefined) => {
      if (typeof rate !== "string" || !/^\d+\/\d+$/.test(rate)) return false;
      const [n, d] = rate.split("/").map(BigInt);
      return (
        n !== undefined &&
        d !== undefined &&
        n * BigInt(format.frameRate.denominator) ===
          d * BigInt(format.frameRate.numerator)
      );
    };
    if (
      !v ||
      !a ||
      probe.streams.length !== 2 ||
      v["codec_name"] !== "ffv1" ||
      v["pix_fmt"] !== format.pixelFormat ||
      v["width"] !== format.width ||
      v["height"] !== format.height ||
      Number(v["nb_read_frames"]) !== frameCount ||
      !rationalEqual(v["r_frame_rate"]) ||
      v["color_range"] !== format.color.range ||
      v["color_space"] !== format.color.space ||
      v["color_primaries"] !== format.color.primaries ||
      v["color_transfer"] !== format.color.transfer ||
      a["codec_name"] !== `pcm_${format.audio.format}` ||
      a["sample_fmt"] !== expectedAudioFormat ||
      Number(a["sample_rate"]) !== format.audio.sampleRate ||
      a["channels"] !== (format.audio.channelLayout === "mono" ? 1 : 2)
    ) {
      throw new MediaError(
        "FIDELITY_MISMATCH",
        "Encoded stream metadata differs from the canonical profile.",
      );
    }
    await run(executables.ffmpeg, [
      ...common,
      "-i",
      staged,
      "-map",
      "0:v:0",
      "-c:v",
      "rawvideo",
      "-pix_fmt",
      `+${format.pixelFormat}`,
      "-fps_mode",
      "passthrough",
      "-f",
      "rawvideo",
      decodedVideo,
    ]);
    await run(executables.ffmpeg, [
      ...common,
      "-i",
      staged,
      "-map",
      "0:a:0",
      "-c:a",
      `pcm_${format.audio.format}`,
      "-f",
      format.audio.format,
      decodedAudio,
    ]);
    if (
      !video.equals(await readBounded(decodedVideo, signal)) ||
      !audio.equals(await readBounded(decodedAudio, signal))
    ) {
      throw new MediaError(
        "FIDELITY_MISMATCH",
        "Decoded samples differ from the canonical render.",
      );
    }
    if (
      sha256(await readBounded(videoPath, signal)) !== sourceVideoSha256 ||
      sha256(await readBounded(audioPath, signal)) !== sourceAudioSha256
    ) {
      throw new MediaError(
        "FIDELITY_MISMATCH",
        "Canonical input changed during encoding.",
      );
    }
    const outputSha256 = sha256(await readFileCancellable(staged, signal));
    // Same-volume link is atomic and fails if the destination already exists. Never overwrite.
    await publishFileWithoutOverwrite(staged, resolve(outputPath), signal);
    return Object.freeze<LosslessEvidence>({
      stageKey,
      ffmpegVersion,
      sourceVideoSha256,
      sourceAudioSha256,
      outputSha256,
      videoSamplesEqual: true,
      audioSamplesEqual: true,
      sourceHashesUnchanged: true,
      frameCount,
      audioSampleCount,
      durationUs,
      audioDurationUs,
      avDurationDifferenceUs: audioDurationUs - durationUs,
      containerVideoTimeBase: String(v["time_base"]),
      timingVerification: "rational-rate-and-sample-count-only",
      canonicalFormat: format,
      boundary: "canonical-render-to-encoded-master",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
