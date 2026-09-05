import { contextBridge, ipcRenderer } from "electron";
import { channels } from "./bridge.ts";
import type { DesktopBridge, Reply } from "./bridge.ts";
import {
  assertFrameRequest,
  assertMediaFrame,
  assertMediaList,
  assertMediaSummary,
} from "../../../packages/domain/src/library.ts";

async function invoke<T>(
  channel: string,
  request: unknown,
  validate: (value: unknown) => void,
): Promise<Reply<T>> {
  const result: unknown = await ipcRenderer.invoke(channel, request);
  if (!result || typeof result !== "object" || !("ok" in result))
    throw new Error("Invalid desktop response");
  if (
    result.ok === false &&
    Object.keys(result).sort().join() === "message,ok" &&
    "message" in result &&
    typeof result.message === "string" &&
    result.message.length > 0 &&
    result.message.length <= 240
  ) {
    return { ok: false, message: result.message };
  }
  if (
    result.ok !== true ||
    Object.keys(result).sort().join() !== "ok,value" ||
    !("value" in result)
  )
    throw new Error("Invalid desktop response");
  validate(result.value);
  return { ok: true, value: result.value as T };
}
const bridge: DesktopBridge = {
  listMedia: () => invoke(channels.list, undefined, assertMediaList),
  importVideo: () =>
    invoke(channels.import, undefined, (value) => {
      if (value !== null) assertMediaSummary(value);
    }),
  readFrame: (request) => {
    assertFrameRequest(request);
    return invoke(channels.frame, request, assertMediaFrame);
  },
  cancelImport: () =>
    invoke(channels.cancel, undefined, (value) => {
      if (value !== null) throw new Error("Invalid response");
    }),
};
contextBridge.exposeInMainWorld("desktop", Object.freeze(bridge));
