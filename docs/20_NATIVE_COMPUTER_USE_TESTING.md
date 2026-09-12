# Native computer-use testing

## Environment boundary

The implementation agent must build and run the product app only in its isolated desktop environment. The latest user instruction prohibits controlling the host PC: all native input and screenshots must remain inside Docker. Do not use host computer-use tools or operate/capture a host viewer. Historical viewer authorization is superseded; any future viewer use requires a new explicit request. Do not access host capture devices, personal files, credentials, or display sockets.

The current [Docker environment](../tests/desktop/README.md) provides a private Linux display, an unprivileged user, dropped capabilities, restricted seccomp, and no host mounts or devices. Use `tests/desktop/guest-input.py` inside that guest for native input and screenshots. It uses X11/XTEST via ctypes and FFmpeg x11grab, guarded by Linux, `/.dockerenv`, UID 1000 and display `:99`. The existing authenticated loopback VNC endpoint is not the current testing route. Retain Chromium sandboxing; do not use `--no-sandbox` to make a test pass.

Docker 28.5.2, Electron 44.2, and Playwright 1.63.0 passed the environment probe. Earlier TigerVNC observations are historical; the later host-viewer 200% attempt was stopped by the user and did not pass. The current guest-only path captured the desktop, closed the probe, opened the actual product source, opened Settings with Ctrl+,, selected and saved 200%, opened Source details, and advanced the actual frame to 0:00.500 without host input. Native 200% tests passed separately. These bounded observations do not prove full P1 acceptance, Windows devices/installers, audio listening, or high-precision display fidelity.

## Browser role

Use the integrated browser for public research and documentation. Do not use a browser-hosted clone as product evidence.

## Native test layers

### Unit tests

Domain operations, time conversion, history, schemas, policy, IPC validation, and Codex message parsing.

### Integration tests

FFmpeg fixtures, transcription adapters, project recovery, app-server fake transport, real app-server smoke when authenticated, and render QA.

### Playwright Electron

Launch the Electron app, obtain the first window, stub native dialogs where needed, interact through accessibility selectors, capture screenshots, and close cleanly.

### Computer use

Operate and capture the actual guest native window using the guarded guest helper. Inspect the latest guest screenshot before choosing a coordinate or key, perform one action, and inspect its resulting screenshot. Test resize, focus, selection, drag handles, menus, keyboard shortcuts, progress, errors, and final playback as implemented. Record exact steps and screenshots privately. Do not infer a visual pass from helper exit status alone.

### Capture tests

Use virtual camera, microphone, system-audio, and screen sources for deterministic runs. When the environment has no real device, say so. A virtual-device pass is not a claim that every physical device works.

## Test data safety

Use generated media and the two supplied example videos only. Never capture unrelated desktop content, notifications, credentials, or personal files.

## P1 lifecycle and accessibility checks

Run `tests/native/lifecycle.test.ts` against a packaged guest executable. It tests normal shutdown, second-instance behavior, process-kill reopening, corrupted preferences, actual renderer-crash dialogs and missing assets in a task-owned package copy. Preserve the original build and fixture bytes. Native dialogs in this suite are real; screenshots still require visual inspection.

Run `tests/native/accessibility.test.ts` for keyboard project navigation, focus, measured primary-button contrast, emulated forced colors/contrast preferences and reduced-motion chrome with unchanged preview samples. Emulation inside Electron does not establish Windows OS integration.

Run `dbus-run-session -- node tests/native/orca-smoke.test.ts <absolute-packaged-executable>` only inside the isolated image with Orca and AT-SPI dependencies. The real screen reader, observer and Electron share a private session bus. Speech and physical braille are disabled; require actual Orca braille-monitor output and named/typed focus events belonging to the packaged application's process IDs. Inspect full guest screenshots of that output. Test natural activation first; any separate `--forced-accessibility` run is explicitly forced, not proof of automatic detection. This is a bounded Linux control-output smoke test, not speech listening, physical braille, error-announcement coverage or full accessibility certification.

Use the pinned comparison recipe in `tests/desktop/README.md` for Orca 50.2 and AT-SPI2 2.56.8. Keep old-reader failures distinct from new-reader passes. The harness records version, package and test hashes before startup and confirms reader settings through its supported API. Build each comparison from verified archives in fresh directories; do not reuse unverified extracted sources or generated build rules. Successful provisioning alone is never a passing smoke test.

## No visual shortcuts

A DOM assertion or screenshot diff does not replace watching motion and audio. A native computer-use pass does not replace deterministic tests. Both are required for final acceptance.
