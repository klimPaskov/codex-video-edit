---
name: native-app-testing
description: Launch, automate, inspect, and record evidence from the real desktop app in isolation.
---

# Native app testing

## Use when

A phase changes UI, recording, media playback, Codex interaction, or packaging.

## Procedure

1. Verify the isolated environment using `python scripts/desktop_environment.py check`. Follow `tests/desktop/README.md` for provisioning and the sandboxed compatibility probe. Keep probe evidence distinct from product acceptance.
2. Build and launch the current desktop app in the agent's isolated desktop environment.
3. Use Playwright Electron for repeatable navigation, dialogs, controls, state, and screenshots.
4. Use computer use on the visible native window for visual and motion review.
5. Use virtual capture devices for deterministic recording tests.
6. Watch rendered media with audio.
7. Record build hash, test environment, steps, screenshots, short recordings, and failures.
8. Fix defects and rerun the same path.

## Prohibitions

- Do not build or launch the product on the user's host. The current user authorizes Docker provisioning and a native guest-desktop viewer on the host; keep that infrastructure exception scoped to the isolated test environment.
- Do not mount host files, credentials, display sockets, or devices into the guest. Transfer only reviewed source; transfer the supplied video privately only after the relevant fixtures pass.
- Do not disable Chromium sandboxing or use privileged containers. Run the desktop as the unprivileged guest user.
- Do not substitute a browser page.
- Do not call a DOM assertion visual proof.
- Do not call a virtual device full hardware coverage.
- Do not count the Linux compatibility probe as Windows product, capture, installer, or audio-review acceptance. The current VNC viewer carries no audio.
