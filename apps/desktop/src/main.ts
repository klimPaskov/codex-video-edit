import { PreferencesStore } from "./preferences.ts";
import { assertPreferences } from "../../../packages/domain/src/preferences.ts";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  session,
} from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { channels, assertEmptyRequest } from "./bridge.ts";
import {
  assertFrameRequest,
  assertMediaFrame,
  assertMediaList,
  assertMediaSummary,
} from "../../../packages/domain/src/library.ts";
import { MediaLibrary } from "../../../packages/media-engine/src/library.ts";

const origin = "codex-video-edit://app";
const page = `${origin}/index.html`;
let window: BrowserWindow | undefined;
let importing: AbortController | undefined;
const frameRequests = new Set<AbortController>();
app.setName("codex-video-edit");
app.enableSandbox();
protocol.registerSchemesAsPrivileged([
  {
    scheme: "codex-video-edit",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

function assertSender(event: IpcMainInvokeEvent): void {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame.url !== page
  ) {
    throw new Error("Untrusted request");
  }
}
function register(
  channel: string,
  work: (request: unknown) => Promise<unknown>,
): void {
  ipcMain.handle(channel, async (event, request: unknown) => {
    assertSender(event);
    try {
      return { ok: true, value: await work(request) };
    } catch {
      return {
        ok: false,
        message:
          "This operation could not finish. Check the file is available and try again.",
      };
    }
  });
}

async function start(): Promise<void> {
  const assets = new Map([
    ["/index.html", ["index.html", "text/html; charset=utf-8"]],
    ["/renderer.js", ["renderer.js", "text/javascript; charset=utf-8"]],
    ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ]);
  protocol.handle("codex-video-edit", async (request) => {
    const url = new URL(request.url);
    const asset = assets.get(url.pathname);
    if (request.method !== "GET" || url.host !== "app" || url.search || !asset)
      return new Response("Not found", { status: 404 });
    try {
      const bytes = await readFile(
        path.join(app.getAppPath(), "renderer", asset[0]!),
      );
      return new Response(bytes, {
        headers: {
          "Content-Type": asset[1]!,
          "Content-Security-Policy":
            "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; frame-src 'none'; base-uri 'none'; form-action 'none'",
        },
      });
    } catch {
      return new Response("Asset unavailable", { status: 500 });
    }
  });
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on("will-download", (event) => event.preventDefault());
  const preferences = new PreferencesStore(
    path.join(app.getPath("userData"), "preferences"),
  );
  let initialScale = 1;
  try {
    initialScale = (await preferences.read()).interfaceScale;
  } catch {
    /* Renderer reports the read failure through validated IPC. */
  }
  register(channels.preferencesGet, async (request) => {
    assertEmptyRequest(request);
    return preferences.read();
  });
  register(channels.preferencesSet, async (request) => {
    assertPreferences(request);
    const value = await preferences.write(request);
    window?.webContents.setZoomFactor(value.interfaceScale);
    return value;
  });
  const library = new MediaLibrary(
    path.join(app.getPath("userData"), "media-library"),
  );
  register(channels.list, async (request) => {
    assertEmptyRequest(request);
    const value = await library.list();
    assertMediaList(value);
    return value;
  });
  register(channels.import, async (request) => {
    assertEmptyRequest(request);
    if (importing || !window) throw new Error("Import is already running");
    const controller = new AbortController();
    importing = controller;
    try {
      const selected = await dialog.showOpenDialog(window, {
        title: "Import video",
        properties: ["openFile"],
        filters: [
          { name: "Video", extensions: ["mkv", "mp4", "mov", "webm", "avi"] },
        ],
      });
      if (
        selected.canceled ||
        !selected.filePaths[0] ||
        controller.signal.aborted
      )
        return null;
      const value = await library.importFile(
        selected.filePaths[0],
        controller.signal,
      );
      assertMediaSummary(value);
      return value;
    } catch (error) {
      if (controller.signal.aborted) return null;
      throw error;
    } finally {
      importing = undefined;
    }
  });
  register(channels.frame, async (request) => {
    assertFrameRequest(request);
    if (frameRequests.size >= 2)
      throw new Error("Frame request already running");
    const controller = new AbortController();
    frameRequests.add(controller);
    try {
      const value = await library.frame(
        request.id,
        request.timeUs,
        controller.signal,
      );
      assertMediaFrame(value);
      return value;
    } finally {
      frameRequests.delete(controller);
    }
  });
  register(channels.cancel, async (request) => {
    assertEmptyRequest(request);
    importing?.abort();
    return null;
  });
  window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    show: false,
    title: "codex-video-edit",
    backgroundColor: "#11131a",
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      zoomFactor: initialScale,
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.on("closed", () => {
    importing?.abort();
    for (const request of frameRequests) request.abort();
    window = undefined;
  });
  window.once("ready-to-show", () => window?.show());
  await window.loadURL(page);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app
    .whenReady()
    .then(start)
    .catch(() => {
      dialog.showErrorBox(
        "Could not open codex-video-edit",
        "The local application files could not be loaded. Reinstall the application and try again.",
      );
      app.quit();
    });
}
app.on("window-all-closed", () => app.quit());
