import { link, readFile } from "node:fs/promises";
import { MediaError } from "./process.ts";

export function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new MediaError("CANCELLED", "Media operation cancelled.");
}

export async function readFileCancellable(
  path: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  assertNotCancelled(signal);
  try {
    const data = await readFile(path, signal ? { signal } : {});
    assertNotCancelled(signal);
    return data;
  } catch (error) {
    assertNotCancelled(signal);
    throw error;
  }
}

/** Commit point: cancellation is honored until the atomic link is submitted. */
export async function publishFileWithoutOverwrite(
  stagedPath: string,
  outputPath: string,
  signal?: AbortSignal,
): Promise<void> {
  assertNotCancelled(signal);
  await link(stagedPath, outputPath);
}
