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

For the managed-login opener, use a guest-local browser/URL handler under the same unprivileged, no-mount, no-port policy. Launch packaged Electron from a fresh signed-out account with the real `shell.openExternal` path, inspect both guest browser and native window with `guest-input.py`, cancel back to signed out, and terminate only test-owned guest browser/opener processes. A loaded OpenAI login page proves opening, not account-login completion. Keep OAuth URLs, codes, browser profiles and screenshots private.

## Prohibitions

- Do not build or launch the product on the user's host, control the host PC, or capture host windows. The latest user instruction supersedes the earlier viewer exception. Historical viewer evidence remains historical; future host-viewer use requires a new explicit user request.
- Do not mount host files, credentials, display sockets, or devices into the guest. Transfer only reviewed source and expressly authorized private test inputs; transfer the supplied video privately only after the relevant fixtures pass. ADR 0006 records this session's narrow user-authorized transfer of only the official runtime credential file into the private app-owned guest account with mode 600. It grants no host UI access, account-directory/configuration/history copying, general credential import or secret output.
- Do not disable Chromium sandboxing or use privileged containers. Run the desktop as the unprivileged guest user.
- Do not substitute a browser page.
- Do not call a DOM assertion visual proof.
- Do not call a virtual device full hardware coverage.
- Do not count the Linux compatibility probe or guest screenshots as Windows product, capture, installer, or audio-listening acceptance.

For screen-reader regressions, preserve failed runs and compare unmodified upstream releases in separate isolated environments. Pin and verify downloaded source hashes. Record exact reader/AT-SPI versions, package and test hashes before startup, confirm supported settings through real API readback, and require both actual reader output and application-owned focus events. Buffered debug text is not a reliable readiness signal. Inspect the visible monitor after it paints; a stale screenshot must remain identified as stale. Never alter the product or reader just to manufacture a passing announcement.

ADR 0013 makes the real project foundation the next P1 shell prerequisite. Test actual create/open/reopen, a resolving baseline revision, source-matched rational timing and persisted five-stage navigation without fake projects or implied stage execution. P2's shared transaction prerequisite remains separate work.

For the implemented project shell, verify Projects and Source library remain distinct; import/create/open/reopen operate on actual records; every stage saves before selected state changes; failure and delayed replies preserve the active project, source and frame position. Compare immutable baseline/source state across navigation and restart. Inspect compact stage controls at 100–200% with guest-only input/capture, including keyboard focus after success, failure, Home and Settings. Visiting a stage cannot count as running its later feature. Keep complete-probe/store tests separate from native visual acceptance. At enlarged interface scale, verify screenshot coverage before judging layout: cropped Playwright PNGs cannot prove the whole window. Use full guest-display screenshots for whole-window visual review, retaining original images privately. Record an unexplained launch timeout and any unchanged retry separately; a later pass does not establish the timeout cause.

For committed-draft preview changes, precommit a real fixture transaction while the packaged app is closed, reopen through the visible project card, and verify duration, seek bounds and decoded source-offset pixels. Confirm the same Source library item still starts at source time zero and source/baseline hashes remain unchanged. Unit tests must also cover a draft change before and during decode; native reopen does not replace the authenticated live-tool gate.

Keep seeded-account discovery distinct from managed browser-login completion. After the authorized seed, use private synthetic fixtures for real native turns, guarded edits, committed-state/preview verification, interruption, history reopen, stale rejection and shared undo. A production guarded-service stale check against a real packaged Codex-created draft can prove offline freshness without another model call; label live stdio relay separately. Verify tool restrictions and native subagent inheritance separately with an authoritative parent rollout spawn call/output, `thread/read` child parent/source, completed child-owned tool history and matching saved turn policies, not model text or generic drawer activity. Pinned v1 persisted turn history omits collaboration items; a bare audit `thread/resume` can overwrite effective settings. Report actual results without secrets, account identifiers or private locations; a connected account and runtime catalogs alone do not satisfy the other P2 gates. Production onboarding remains managed ChatGPT sign-in.

For a negative live tool-policy probe, request a harmless forbidden command on a synthetic project, then check both the settled native projection and persisted server item types. A model refusal and zero observed command items prove only that this turn did not invoke a command; they do not prove every built-in was absent from the model-visible catalog. Audit resume with the same production policy overrides, since a bare separate resume can reapply defaults and does not describe the original live turn. Keep the first failed attempt and guest-only visual record private.

For signed-in Settings, compare displayed plan, runtime model, usage windows/reset labels and available skills with the current bounded IPC state before and after restart. A seeded account can verify presentation but cannot prove managed browser-login completion. Keep account screenshots private and use guest-only input for a visible control change.
