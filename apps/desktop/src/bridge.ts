import type { Preferences } from "../../../packages/domain/src/preferences.ts";
import type {
  FrameRequest,
  MediaFrame,
  MediaSummary,
} from "../../../packages/domain/src/library.ts";

export type Reply<T> = { ok: true; value: T } | { ok: false; message: string };
export interface DesktopBridge {
  getPreferences(): Promise<Reply<Preferences>>;
  setPreferences(value: Preferences): Promise<Reply<Preferences>>;
  listMedia(): Promise<Reply<MediaSummary[]>>;
  importVideo(): Promise<Reply<MediaSummary | null>>;
  readFrame(request: FrameRequest): Promise<Reply<MediaFrame>>;
  cancelImport(): Promise<Reply<null>>;
}
export const channels = Object.freeze({
  preferencesGet: "preferences:get",
  preferencesSet: "preferences:set",
  list: "library:list",
  import: "library:import",
  frame: "library:frame",
  cancel: "library:cancel",
});
export function assertEmptyRequest(value: unknown): void {
  if (value !== undefined) throw new Error("Unexpected request parameters");
}
