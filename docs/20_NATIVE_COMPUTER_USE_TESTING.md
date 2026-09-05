# Native computer-use testing

## Environment boundary

The implementation agent must build and run the product app only in its isolated desktop environment. The current user instruction authorizes provisioning that environment and running its native viewer on the host. This exception covers Docker infrastructure and the viewer, not a host launch of the product or access to host capture devices, personal files, credentials, or display sockets.

The current [Docker environment](../tests/desktop/README.md) provides a private Linux display, an unprivileged user, dropped capabilities, restricted seccomp, and no host mounts or devices. Its authenticated VNC endpoint binds only to loopback. Use a native viewer with clipboard transfer disabled. The separate Electron compatibility probe must retain Chromium sandboxing; do not use `--no-sandbox` to make a test pass.

Docker 28.5.2, Electron 44.2, and Playwright 1.63.0 have passed the environment probe. Computer use inspected the native Xmessage and Electron windows through TigerVNC and confirmed visible input responses. This establishes display/input and sandbox compatibility, not a usable editor. A user Escape interrupted the later computer-use close step; no clean computer-use close is claimed. Linux desktop evidence does not prove Windows capture or installer behavior. VNC does not forward audio, and its 24-bit display does not prove high-precision master fidelity.

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

Operate the visible native window for real visual inspection. Test resize, focus, selection, drag handles, menus, keyboard shortcuts, progress, errors, and final playback. Record exact steps and screenshots.

### Capture tests

Use virtual camera, microphone, system-audio, and screen sources for deterministic runs. When the environment has no real device, say so. A virtual-device pass is not a claim that every physical device works.

## Test data safety

Use generated media and the supplied example video only. Never capture unrelated desktop content, notifications, credentials, or personal files.

## No visual shortcuts

A DOM assertion or screenshot diff does not replace watching motion and audio. A native computer-use pass does not replace deterministic tests. Both are required for final acceptance.
