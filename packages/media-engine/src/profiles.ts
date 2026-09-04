import { MediaError } from "./process.ts";

export const pixelFormats = [
  "bgra",
  "gbrp16le",
  "yuv444p10le",
  "yuv444p16le",
  "yuva444p16le",
] as const;
export const audioFormats = [
  "s16le",
  "s24le",
  "s32le",
  "f32le",
  "f64le",
] as const;
export type PixelFormat = (typeof pixelFormats)[number];
export type AudioFormat = (typeof audioFormats)[number];
export interface Rational {
  numerator: number;
  denominator: number;
}
export interface CanonicalFormat {
  width: number;
  height: number;
  frameRate: Rational;
  pixelFormat: PixelFormat;
  color: {
    range: "pc" | "tv";
    space: "gbr" | "bt709";
    primaries: "bt709";
    transfer: "bt709";
  };
  audio: {
    format: AudioFormat;
    sampleRate: number;
    channelLayout: "mono" | "stereo";
  };
}
export type MediaRole =
  | "canonical"
  | "original"
  | "lossless-intermediate"
  | "preview-proxy"
  | "analysis";

export function assertMasterInput(role: MediaRole): void {
  if (role !== "canonical")
    throw new MediaError(
      "INVALID_INPUT",
      "Master encoding requires canonical render samples; proxies and analysis derivatives are forbidden.",
    );
}

export function assertCaptureAvailable(): never {
  throw new MediaError(
    "UNSUPPORTED_PROFILE",
    "Native capture fidelity and throughput have not been verified.",
  );
}

export function validateFormat(format: CanonicalFormat): void {
  const integers = [
    format.width,
    format.height,
    format.frameRate.numerator,
    format.frameRate.denominator,
    format.audio.sampleRate,
  ];
  if (integers.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new MediaError(
      "INVALID_INPUT",
      "Dimensions, rates, and rational components must be positive integers.",
    );
  }
  if (
    !pixelFormats.includes(format.pixelFormat) ||
    !audioFormats.includes(format.audio.format) ||
    !["mono", "stereo"].includes(format.audio.channelLayout)
  ) {
    throw new MediaError(
      "UNSUPPORTED_PROFILE",
      "Canonical sample representation is unsupported; no conversion was applied.",
    );
  }
  const rgb =
    format.pixelFormat === "bgra" || format.pixelFormat === "gbrp16le";
  if (
    format.color.primaries !== "bt709" ||
    format.color.transfer !== "bt709" ||
    !["pc", "tv"].includes(format.color.range) ||
    format.color.space !== (rgb ? "gbr" : "bt709") ||
    (rgb && format.color.range !== "pc")
  ) {
    throw new MediaError(
      "UNSUPPORTED_PROFILE",
      "This color path is unverified; no HDR or color conversion was applied.",
    );
  }
}

export function frameByteLength(format: CanonicalFormat): number {
  validateFormat(format);
  const channels =
    format.pixelFormat === "bgra" || format.pixelFormat === "yuva444p16le"
      ? 4
      : 3;
  return (
    format.width *
    format.height *
    channels *
    (format.pixelFormat === "bgra" ? 1 : 2)
  );
}

export function audioSampleByteLength(format: CanonicalFormat): number {
  const precision = { s16le: 2, s24le: 3, s32le: 4, f32le: 4, f64le: 8 }[
    format.audio.format
  ];
  return precision * (format.audio.channelLayout === "mono" ? 1 : 2);
}

/** Frame starts rounded down to the authoritative integer microsecond clock. */
export function frameToMicroseconds(frame: number, rate: Rational): number {
  if (
    ![frame, rate.numerator, rate.denominator].every(Number.isSafeInteger) ||
    frame < 0 ||
    rate.numerator < 1 ||
    rate.denominator < 1
  ) {
    throw new MediaError("INVALID_INPUT", "Invalid frame or rational rate.");
  }
  const value =
    (BigInt(frame) * BigInt(rate.denominator) * 1_000_000n) /
    BigInt(rate.numerator);
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new MediaError(
      "INVALID_INPUT",
      "Timeline time exceeds safe integer precision.",
    );
  return Number(value);
}
