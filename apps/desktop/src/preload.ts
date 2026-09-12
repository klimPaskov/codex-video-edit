import {
  assertCodexView,
  assertCodexSelection,
} from "../../../packages/domain/src/codex-view.ts";
import { assertPreferences } from "../../../packages/domain/src/preferences.ts";
import {
  assertProjectDraftView,
  assertProjectFrameRequest,
  assertProjectFrameResult,
  assertProjectRequest,
  assertProjectNavigation,
  assertProjectView,
  assertProjectList,
} from "../../../packages/domain/src/project-view.ts";
import { contextBridge, ipcRenderer } from "electron";
import { channels } from "./bridge.ts";
import type { DesktopBridge, Reply } from "./bridge.ts";
import {
  assertFrameRequest,
  assertMediaFrame,
  assertMediaList,
  assertMediaSummary,
} from "../../../packages/domain/src/library.ts";
import {
  assertCodexThreadProjectRequest,
  assertCodexThreadSendRequest,
  assertCodexThreadView,
} from "../../../packages/domain/src/codex-thread-view.ts";

async function invoke<T>(
  channel: string,
  request: unknown,
  validate: (value: unknown) => void,
): Promise<Reply<T>> {
  const result: unknown = await ipcRenderer.invoke(channel, request);
  return reply(result, validate);
}
function reply<T>(
  result: unknown,
  validate: (value: unknown) => void,
): Reply<T> {
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
  getCodex: () => invoke(channels.codexGet, undefined, assertCodexView),
  reconnectCodex: () =>
    invoke(channels.codexReconnect, undefined, assertCodexView),
  loginCodex: () => invoke(channels.codexLogin, undefined, assertCodexView),
  cancelCodexLogin: () =>
    invoke(channels.codexCancelLogin, undefined, assertCodexView),
  logoutCodex: () => invoke(channels.codexLogout, undefined, assertCodexView),
  selectCodexModel: (value) => {
    assertCodexSelection(value);
    return invoke(channels.codexSelect, value, assertCodexView);
  },
  getCodexThread: (request) => {
    assertCodexThreadProjectRequest(request);
    return invoke(channels.codexThreadGet, request, assertCodexThreadView);
  },
  openCodexThread: (request) => {
    assertCodexThreadProjectRequest(request);
    return invoke(channels.codexThreadOpen, request, assertCodexThreadView);
  },
  sendCodexThread: (request) => {
    assertCodexThreadSendRequest(request);
    return invoke(channels.codexThreadSend, request, assertCodexThreadView);
  },
  interruptCodexThread: (request) => {
    assertCodexThreadProjectRequest(request);
    return invoke(
      channels.codexThreadInterrupt,
      request,
      assertCodexThreadView,
    );
  },
  listProjects: () =>
    invoke(channels.projectList, undefined, assertProjectList),
  createProject: (request) => {
    assertProjectRequest(request);
    return invoke(channels.projectCreate, request, assertProjectView);
  },
  openProject: (request) => {
    assertProjectRequest(request);
    return invoke(channels.projectOpen, request, assertProjectView);
  },
  closeProject: (request) => {
    assertProjectRequest(request);
    return invoke(channels.projectClose, request, (value) => {
      if (value !== null) throw new Error("Invalid response");
    });
  },
  navigateProject: (request) => {
    assertProjectNavigation(request);
    return invoke(channels.projectNavigate, request, assertProjectView);
  },
  readProjectFrame: (request) => {
    assertProjectFrameRequest(request);
    return invoke(channels.projectFrame, request, assertProjectFrameResult);
  },
  onProjectDraftChanged: (listener) => {
    if (typeof listener !== "function")
      throw new Error("Invalid project listener");
    const receive = (_event: Electron.IpcRendererEvent, value: unknown) => {
      listener(reply(value, assertProjectDraftView));
    };
    ipcRenderer.on(channels.projectDraftChanged, receive);
    return () =>
      ipcRenderer.removeListener(channels.projectDraftChanged, receive);
  },
  getPreferences: () =>
    invoke(channels.preferencesGet, undefined, assertPreferences),
  setPreferences: (value) => {
    assertPreferences(value);
    return invoke(channels.preferencesSet, value, assertPreferences);
  },
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
