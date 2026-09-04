---
name: native-app-testing
description: Launch, automate, inspect, and record evidence from the real desktop app in isolation.
---

# Native app testing

## Use when

A phase changes UI, recording, media playback, Codex interaction, or packaging.

## Procedure

1. Build the current desktop app.
2. Launch it in the agent's isolated desktop environment.
3. Use Playwright Electron for repeatable navigation, dialogs, controls, state, and screenshots.
4. Use computer use on the visible native window for visual and motion review.
5. Use virtual capture devices for deterministic recording tests.
6. Watch rendered media with audio.
7. Record build hash, test environment, steps, screenshots, short recordings, and failures.
8. Fix defects and rerun the same path.

## Prohibitions

- Do not run on the user's host.
- Do not substitute a browser page.
- Do not call a DOM assertion visual proof.
- Do not call a virtual device full hardware coverage.
