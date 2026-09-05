const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld(
  "environmentProbe",
  Object.freeze({
    sandboxed: process.sandboxed,
    contextIsolated: process.contextIsolated,
  }),
);
