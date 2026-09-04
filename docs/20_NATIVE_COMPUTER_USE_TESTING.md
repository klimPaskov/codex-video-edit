# Native computer-use testing

## Environment boundary

The implementation agent must run the app in its own isolated desktop environment. It must not launch processes, open windows, install software, or capture devices on the user's host machine.

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
