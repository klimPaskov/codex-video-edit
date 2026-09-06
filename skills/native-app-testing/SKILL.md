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
4. Inspect and operate the actual guest native window with `tests/desktop/guest-input.py`, running only inside Docker. Observe the guest screenshot, choose one action, and inspect its returned screenshot. All native input and screenshots stay in the guest; no host computer-use or viewer control.
5. Use virtual capture devices for deterministic recording tests.
6. Watch rendered media with audio.
7. Record build hash, test environment, steps, screenshots, short recordings, and failures.
8. Fix defects and rerun the same path.

For the P0-04/P0-06 bootstrap, apply ADR 0012 and test the actual packaged product: native import, immutable managed source, library reopen, frame seek/equality and explicit unsupported-preview behavior. Keep the media library distinct from a project or draft. The compatibility probe verifies infrastructure only. Record product runtime evidence separately; frame inspection does not establish audio or continuous playback.

For interface sizing changes, test persisted zoom after restart, modal focus and dismissal, and inspector bounds alongside the preview at every supported size. Inspect the actual native window after saving a larger scale: focus restoration can scroll navigation out of view even when a screenshot has no horizontal overflow. Keep this visual check separate from pixel transport equality.

## Prohibitions

- Do not build or launch the product on the user's host, control the host PC, or capture host windows. The latest user instruction supersedes the earlier viewer exception. Historical viewer evidence remains historical; future host-viewer use requires a new explicit user request.
- Do not mount host files, credentials, display sockets, or devices into the guest. Transfer only reviewed source; transfer the supplied video privately only after the relevant fixtures pass.
- Do not disable Chromium sandboxing or use privileged containers. Run the desktop as the unprivileged guest user.
- Do not substitute a browser page.
- Do not call a DOM assertion visual proof.
- Do not call a virtual device full hardware coverage.
- Do not count the Linux compatibility probe or guest screenshots as Windows product, capture, installer, or audio-listening acceptance.

ADR 0013 makes the real project foundation the next P1 shell prerequisite. Test actual create/open/reopen, a resolving baseline revision, source-matched rational timing and persisted five-stage navigation without fake projects or implied stage execution. P2's shared transaction prerequisite remains separate work.
