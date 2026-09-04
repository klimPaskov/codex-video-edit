# Ordered implementation backlog

Complete phases in order. A task is complete only when its acceptance evidence exists.

## P0: research, decisions, and repository foundation

- [ ] P0-01 Read all package sources and current official documentation.
- [ ] P0-02 Research Borumi and comparable recorders without copying protected assets.
- [ ] P0-03 Confirm current Electron, Playwright, FFmpeg, local transcription, and Codex app-server contracts.
- [ ] P0-04 Establish the monorepo, strict TypeScript, tests, linting, formatting, schemas, and phase result writer.
- [ ] P0-05 Accept or revise ADRs with evidence.
- [ ] P0-06 Generate and decode a short media fixture, including an exact lossless round trip.
- [ ] P0-07 Resolve the authenticated owner and create or verify the public `codex-video-edit` repository. Publish reviewed source, specs, licence, and CI without private media.
- [ ] P0-08 Establish tested capture, intermediate, preview, and master fidelity profiles and reject silent downgrades.

Acceptance: checks pass and `.astra/results/P0.json` exists.

## P1: secure native shell and simple design system

- [ ] P1-01 Build a packaged Electron window that never opens as a normal browser page.
- [ ] P1-02 Use local packaged renderer content, context isolation, sandboxing, CSP, and a narrow typed preload API.
- [ ] P1-03 Implement Home, the five-step header (Record or Import, Auto Edit, Edit, Review, Export), modal system, toast system, and one-panel-at-a-time layout.
- [ ] P1-04 Keep logs, Ready badges, status footers, repeated titles, and obvious descriptions out of normal screens. Apply the current reference correction notes.
- [ ] P1-05 Add keyboard navigation, scaling, focus states, and visual regression fixtures.
- [ ] P1-06 Launch and inspect the native window with Playwright Electron and computer use.

Acceptance: native screenshots show a simple shell with no debug clutter.

## P2: real Codex runtime

- [ ] P2-01 Spawn the official Codex app-server over stdio and implement initialize lifecycle and restart recovery.
- [ ] P2-02 Add ChatGPT-managed login, logout, account state, and rate-limit display.
- [ ] P2-03 Discover models, reasoning options, skills, and skill changes at runtime.
- [ ] P2-04 Implement durable project threads, streaming items, interrupt, retry, and compact user-facing activity.
- [ ] P2-05 Implement the guarded codex-video-edit MCP tool server and transaction log.
- [ ] P2-06 Prove a real authenticated Codex turn can inspect a fixture project and apply a draft-only edit.
- [ ] P2-07 Reject fake responses and stale protocol assumptions.

Acceptance: a real Codex smoke test passes or the phase remains blocked with exact evidence.

## P3: projects, import, media model, and preview

- [ ] P3-01 Create project storage, source manifests, autosave, locks, and recovery.
- [ ] P3-02 Import and hash media without mutating it.
- [ ] P3-03 Probe streams and build edit, audio, and thumbnail proxies.
- [ ] P3-04 Implement the canonical microsecond timeline and deterministic frame conversion.
- [ ] P3-05 Build smooth preview playback with source-to-output mapping.
- [ ] P3-06 Add recent projects, open, rename, duplicate, archive, and delete-project safeguards.

Acceptance: an imported fixture reopens and previews identically.

## P4: recording studio

- [ ] P4-01 Capture display, window, and selected region.
- [ ] P4-02 Capture microphone, optional system audio, and optional camera.
- [ ] P4-03 Record sources separately against one monotonic clock and persist sync evidence.
- [ ] P4-04 Implement countdown, pause, resume, stop, recovery, and global shortcuts.
- [ ] P4-05 Implement scenes, teleprompter, retries, take history, and take selection.
- [ ] P4-06 Capture consented pointer and click telemetry without recording keystrokes.
- [ ] P4-07 Test with virtual media devices and label hardware gaps honestly.

Acceptance: a virtual-device scene becomes a synchronized editable project.

## P5: transcription, raw cut, and Magic Wand

- [ ] P5-01 Run local word-timed transcription and silence detection.
- [ ] P5-02 Implement transcript correction and transcript-linked cuts.
- [ ] P5-03 Detect silence, filler, false starts, repeated takes, mistakes, and protected speech.
- [ ] P5-04 Implement Magic Wand presets and a live non-destructive operation stream.
- [ ] P5-05 Apply a useful initial raw cut with undo and a readable change summary.
- [ ] P5-06 Stop safely and recover an interrupted automation.

Acceptance: Magic Wand improves a fixture while preserving meaning and source bytes.

## P6: simple editor

- [ ] P6-01 Implement select, split, trim, ripple delete, restore, move, snap, undo, and redo.
- [ ] P6-02 Implement fixed screen, camera, audio, B-roll, text, and caption tracks with collapsible detail.
- [ ] P6-03 Show only the inspector for the current selection or tool.
- [ ] P6-04 Add selection-aware Codex commands that update the same draft history.
- [ ] P6-05 Implement autosave, revision commit, revision compare, and crash recovery.
- [ ] P6-06 Test mouse, keyboard, and accessibility editing flows.

Acceptance: a user can correct the Magic Wand draft without leaving the app.

## P7: zoom, cursor, speed, and reframe

- [ ] P7-01 Generate purposeful automatic zooms from telemetry and visual evidence.
- [ ] P7-02 Implement manual zoom creation and on-canvas target editing.
- [ ] P7-03 Implement smooth cursor, click highlight, cursor visibility, and per-range controls.
- [ ] P7-04 Detect safe typing, loading, and waiting ranges for speed-up.
- [ ] P7-05 Implement manual speed segments with pitch-safe audio choices.
- [ ] P7-06 Implement 16:9, 9:16, 1:1, 4:5, and custom canvas reframing.
- [ ] P7-07 Add boundary, centering, edge, motion, speech, and A/V QA.

Acceptance: automatic effects improve focus and remain directly adjustable.

## P8: captions, layouts, B-roll, elements, and audio

- [ ] P8-01 Implement captions, styling, safe areas, correction, and sidecars.
- [ ] P8-02 Implement screen-only, camera bubble, side-by-side, presenter, and custom layouts.
- [ ] P8-03 Implement text, image, shape, overlay, and simple transition elements.
- [ ] P8-04 Index local B-roll and music with provenance and searchable metadata.
- [ ] P8-05 Let Codex suggest and place local B-roll with source fallback.
- [ ] P8-06 Implement noise cleanup, loudness, fades, gain, music, and speech-priority ducking.
- [ ] P8-07 Implement asset relink and missing-media recovery.

Acceptance: a composed segment renders with licensed local assets and clear speech.

## P9: review, QA, export, and installer

- [ ] P9-01 Implement review flags, compare, revision history, and final watch-through state.
- [ ] P9-02 Run complete media, timing, audio, caption, asset, zoom, speed, and visual QA.
- [ ] P9-03 Implement the default FFV1/PCM lossless master, exact decoded-sample validation, caption sidecars, and an explicitly chosen smaller MP4 export.
- [ ] P9-04 Verify output hash and full decode before success.
- [ ] P9-05 Build a Windows installer, clean uninstall, and update plan.
- [ ] P9-06 Run security, privacy, accessibility, recovery, and performance checks.

Acceptance: the installed app creates and verifies the default lossless master and the optional compressed sharing profile. Source media remains unchanged.

## P10: user example video acceptance

- [ ] P10-01 Import the supplied example video through the native UI.
- [ ] P10-02 Run Magic Wand with real Codex and inspect each automation class.
- [ ] P10-03 Review the complete draft through computer use.
- [ ] P10-04 Fix defects using manual tools and natural-language edits.
- [ ] P10-05 Export and fully decode the lossless master, verify canonical frame and audio equality, and test a separately requested smaller MP4 copy.
- [ ] P10-06 Save screenshots, short recordings, logs, manifests, and a concise acceptance report.
- [ ] P10-07 Update every affected spec, skill, task, schema, and reference entry.

Acceptance: `.astra/results/P10.json` records the exact final evidence and known limits.
