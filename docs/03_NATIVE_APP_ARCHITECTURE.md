# Native app architecture

## Chosen shell

Use Electron for the first release. It provides a desktop window, access to display and media capture, a mature packaging path, and direct Playwright Electron automation. The shipped product is a standalone desktop app even though the renderer uses packaged web technology internally.

## Process model

### Electron main process

Owns:

- application lifecycle and windows
- safe file dialogs
- project locks and privileged filesystem access
- capture permissions and source selection
- child processes for Codex, FFmpeg, ffprobe, and transcription
- typed IPC validation
- installer and update integration

### Sandboxed renderer

Owns:

- visual interface
- timeline interaction
- preview player
- transcript editing
- tool panels
- user-facing Codex activity

The renderer loads only packaged local assets. Disable Node integration. Enable context isolation, renderer sandboxing, CSP, navigation blocking, and window-creation blocking.

### Preload bridge

Expose small task-based methods. Never expose raw `ipcRenderer`, filesystem, process, shell, or unrestricted command execution.

### Media services

Use typed service boundaries around FFmpeg, ffprobe, local transcription, thumbnail generation, waveform generation, rendering, and QA. Every process call uses argument arrays, timeouts, cancellation, bounded output, stable errors, and redaction.

### Codex bridge

The main process owns a long-running official `codex app-server` child over stdio. A typed adapter handles JSONL framing, request IDs, notifications, server requests, reconnect, version discovery, and schema generation.

### App-specific MCP server

Expose only validated codex-video-edit project operations. Runtime Codex does not receive unrestricted access to the app installation or source repository.

## Suggested repository layout

```text
apps/desktop/              Electron main, preload, renderer
packages/domain/           project and timeline models
packages/project-store/    autosave, revisions, migrations
packages/media-engine/     FFmpeg and transcription adapters
packages/recorder/         capture and synchronization
packages/codex-bridge/     app-server client and MCP tools
packages/editor/           operations, history, snapping
packages/ui/               design system and screens
packages/test-fixtures/    deterministic media and fake devices
schemas/                   versioned contracts
skills/                    Codex and implementation skills
subagents/                 bounded agent prompts
docs/                      product and engineering specs
```

## Version policy

Research and pin compatible stable versions at P0. Do not encode an unverified version in the product spec. Regenerate Codex protocol types from the installed official binary and record its version.
