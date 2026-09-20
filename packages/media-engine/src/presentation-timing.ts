import { MediaError, runProcess } from "./process.ts";

/** Presentation timestamps are sorted here because packet output is in decode order. */
export interface PresentationTiming {
  readonly pts: readonly number[];
  readonly timeBaseNumerator: number;
  readonly timeBaseDenominator: number;
  readonly variableCadence: boolean;
}

function invalidTiming(): never {
  throw new MediaError(
    "UNSUPPORTED_PROFILE",
    "This video's presentation timing cannot be verified for accurate seeking.",
  );
}

export function parsePresentationTiming(
  csv: string,
  video: Record<string, unknown>,
): PresentationTiming {
  const match = /^(\d+)\/(\d+)$/u.exec(String(video.time_base));
  if (!match) invalidTiming();
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator <= 0 ||
    denominator <= 0 ||
    video.start_pts !== 0
  )
    invalidTiming();
  const lines = csv.trim().split(/\r?\n/u);
  if (lines.length === 0 || lines.length > 5_000_000) invalidTiming();
  const pts = lines.map((line) => {
    if (!/^(0|[1-9]\d*)$/u.test(line)) invalidTiming();
    const value = Number(line);
    if (!Number.isSafeInteger(value)) invalidTiming();
    return value;
  });
  pts.sort((a, b) => a - b);
  if (pts[0] !== 0) invalidTiming();
  let firstDelta = 0;
  let variableCadence = false;
  for (let i = 1; i < pts.length; i++) {
    const delta = pts[i]! - pts[i - 1]!;
    if (!Number.isSafeInteger(delta) || delta <= 0) invalidTiming();
    if (i === 1) firstDelta = delta;
    else if (delta !== firstDelta) variableCadence = true;
  }
  if (video.nb_frames !== undefined) {
    const count = Number(video.nb_frames);
    if (Number.isSafeInteger(count) && count > 0 && count !== pts.length)
      invalidTiming();
  }
  return {
    pts,
    timeBaseNumerator: numerator,
    timeBaseDenominator: denominator,
    variableCadence,
  };
}

/** Resolve a time to the displayed frame that started at or before it. */
export function presentationSeekUs(
  timing: PresentationTiming,
  timeUs: number,
): number {
  if (!Number.isSafeInteger(timeUs) || timeUs < 0 || !timing.pts.length)
    invalidTiming();
  const target = BigInt(timeUs) * BigInt(timing.timeBaseDenominator);
  const scale = BigInt(timing.timeBaseNumerator) * 1_000_000n;
  let low = 0;
  let high = timing.pts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (BigInt(timing.pts[middle]!) * scale <= target) low = middle;
    else high = middle;
  }
  const seekUs =
    (BigInt(timing.pts[low]!) * scale) / BigInt(timing.timeBaseDenominator);
  const result = Number(seekUs);
  if (!Number.isSafeInteger(result)) invalidTiming();
  return result;
}

export async function probePresentationTiming(
  executable: string,
  path: string,
  video: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<PresentationTiming> {
  const result = await runProcess({
    executable,
    args: [
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-format_whitelist",
      "matroska,webm,mov,avi",
      "-select_streams",
      "v:0",
      "-show_packets",
      "-show_entries",
      "packet=pts",
      "-of",
      "csv=p=0",
      path,
    ],
    timeoutMs: 120_000,
    maxOutputBytes: 64 * 1024 * 1024,
    ...(signal ? { signal } : {}),
  });
  return parsePresentationTiming(result.stdout.toString("utf8"), video);
}
