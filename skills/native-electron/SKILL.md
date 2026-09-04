---
name: native-electron
description: Build and secure the standalone Electron desktop shell and typed IPC.
---

# Native Electron application

## Use when

Changing windows, main process, preload, permissions, IPC, packaging, or desktop lifecycle.

## Requirements

- Packaged local renderer, never localhost in production.
- `nodeIntegration` disabled.
- Context isolation and renderer sandbox enabled.
- Restrictive CSP.
- Navigation and new-window blocking.
- Narrow typed preload methods.
- Schema validation for every IPC request and response.
- Main-process ownership of files, child processes, dialogs, and capture permissions.
- Current Electron release pinned and reviewed.

## Validation

- unit-test IPC validation and path boundaries
- launch with Playwright Electron
- inspect the actual native window with computer use
- test startup failure, second instance, shutdown, crash recovery, scaling, and keyboard focus
- package and launch a local development build

## Never

Expose raw `ipcRenderer`, shell, filesystem, tokens, process environment, or arbitrary command execution to the renderer.
