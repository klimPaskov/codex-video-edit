# Research-led product decisions

## Keep the app native

A desktop shell fits screen capture, local file access, native dialogs, global recording shortcuts, and direct Electron testing. The product still uses a packaged renderer, but users open one installed desktop application.

## Use a short step flow

Creator tools are easier to learn when recording, automatic editing, review, and export are distinct. A permanent feature dashboard would expose too much state and recreate the current problem of visual clutter.

## Record sources separately

Separate screen, camera, microphone, and system-audio files improve layout changes, audio repair, take selection, and synchronization evidence. The app presents this simply and handles the complexity internally.

## Make automation editable

Automatic zooms, cuts, speed ranges, captions, B-roll, and layouts must become ordinary non-destructive timeline operations. Users can adjust or remove them. This avoids a one-click black box.

## Use real Codex through the supported rich-client interface

The App Server provides durable threads, streaming events, approvals, auth, model discovery, and skills. These map directly to a native editing assistant. The app exposes one provider, Codex, and lets users select among runtime-discovered Codex models.

## Pair native computer use with deterministic tests

Computer use can operate and inspect the real app. It does not replace media probes, schema validation, timing assertions, full decode, or repeatable Playwright flows. Every final claim needs the appropriate evidence layer.

Individual current and previous native references are now included in references/screenshots/. Their exact coverage and required corrections are recorded in references/SCREEN_COVERAGE.md and references/IMPLEMENTATION_NOTES.md. Do not assume all thirteen full states have dedicated images.
