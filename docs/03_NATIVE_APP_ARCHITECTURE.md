# Native app architecture

## Chosen shell

Use Electron for the first release. It provides a desktop window, access to display and media capture, a mature packaging path, and direct Playwright Electron automation. The shipped product is a standalone desktop app even though the renderer uses packaged web technology internally.

## Process model

ADR 0012 brings a minimum actual product shell into P0-04/P0-06 so native media acceptance has a product to exercise. `apps/desktop` owns packaged local content, main/preload isolation and validated task-based IPC; `packages/domain` and `packages/media-engine` own the bounded media-library contract and ingestion/frame adapter. The append-only library retains source bytes and probe metadata locally and is distinct from project storage, drafts, and revisions. This bootstrap does not complete the architecture below.

Its initial frame path transports native-dimension BGRA full-range GBR BT.709 SDR samples without resampling or lossy proxies, within explicit dimensions/payload bounds. Import may preserve other supported video formats while reporting preview unavailable. Frame inspection and seek are not smooth playback, audio review, or an export/compositor path; those remain later acceptance work.

ADR 0013 moves the minimum real project foundation into P1: stable project identity, immutable source references, a source-matched initial canonical timeline, a real baseline revision, create/open/reopen, and persisted active stage. Main owns this state behind validated task-based IPC. Five-stage navigation selects a workspace view only after persistence succeeds; it does not mutate media operations or claim stage completion. The renderer must retain the committed project/draft context while changing stage presentation.

P2 adds the common draft transaction core needed for its authenticated edit: sequence validation, durable journal, atomic persistence, inverse/undo and committed-transaction recovery. This core is shared by manual, Magic Wand and Codex actions. It must not become a second AI-only state store. P3/P6 still complete their full project, playback, editor, history and recovery requirements; implementing prerequisites earlier does not waive their acceptance.

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

## P1 project shell implementation

`packages/project-store` now implements the ADR 0013 prerequisite behind Electron main. Creation consumes a verified library source, publishes a project folder with an immutable baseline and separate mutable navigation metadata, and returns an actual committed project. Open/list/navigation revalidate references, source hashes and the complete reprobed stream/format metadata. Source library entries remain independently identifiable media.

The renderer receives a path-free `ProjectView`: project identity/name/stage, resolving baseline revision ID, source summary and canonical timeline identity/duration/rational frame rate. The main process maps this DTO purely from the already validated committed snapshot, with no fallible postcommit filesystem read. Strict project list/create/open/navigate IPC uses the existing trusted-sender boundary. Runtime source paths and full probe data never cross preload.

The renderer separates Projects from Source library, creates a project after successful import, and offers Create project for existing sources. Five-stage controls persist before their selected state changes; stale responses cannot reopen a screen after Home or overwrite a newer selection. Stage changes retain the preview position and current source. Headless and current packaged native tests passed, including all five stages, immutable baseline/source checks, failed-save preservation, reopen and security/focus at 100/125/150/200%. Guest-only native visual review also passed. It does not complete P1 or implement later stage features.

## Version policy

Research and pin compatible stable versions at P0. Do not encode an unverified version in the product spec. Regenerate Codex protocol types from the installed official binary and record its version.
