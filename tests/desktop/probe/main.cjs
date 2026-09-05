// Infrastructure compatibility probe only. This is not the product shell.
const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");
const assert = require("node:assert/strict");
assert.equal(process.platform, "linux");
assert.equal(process.getuid(), 1000);
assert.equal(process.env.DISPLAY, ":99");
require("node:fs").accessSync("/.dockerenv");
app.enableSandbox();
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  const window = new BrowserWindow({
    width: 700,
    height: 400,
    title: "Electron environment probe",
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.loadFile(path.join(__dirname, "index.html"));
});
app.on("window-all-closed", () => app.quit());
