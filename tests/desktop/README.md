# Isolated native desktop

This P0 test environment runs Linux native windows inside Docker. All native input and screenshots now stay inside Docker under the latest user instruction. Never control the host PC or launch Electron directly on it. This environment is not Windows capture, installer, audio-listening or product acceptance evidence.

## Provision

With Docker's Linux engine running:

```sh
python scripts/desktop_environment.py build
python scripts/desktop_environment.py start
python scripts/desktop_environment.py check
```

The launcher creates `codex-video-edit-desktop`. It fails on an existing name instead of deleting it. The container has a private display, PID/IPC namespaces and shared memory, runs as UID 1000, drops capabilities, prevents privilege escalation, and mounts no host files, sockets or devices. The reviewed [seccomp profile](SECCOMP.md) permits Chromium's nested sandbox. Do not replace it with privileged mode or disable the Chromium sandbox.

The build context is only this directory; `.dockerignore` includes only the Dockerfile and display entry point. Private evidence and user footage must never enter a build context. Stop a test session with `docker stop codex-video-edit-desktop`; retain failed environments/evidence until cleanup is explicitly authorized.

## Restart recovery

The display startup script recovers only display 99's stale lock and socket inside the private container namespace. It refuses recovery when the recorded process is alive or the display responds. An abrupt stop/start of the empty test container must pass `python scripts/desktop_environment.py check` again before product testing. The empty-guest abrupt kill/start recovery test passed, with the previous container retained and source evidence private. Retain failed containers and evidence; rebuilding the image does not update an existing container's startup script.

## Guest-only native observation and input

The current visual testing route is `tests/desktop/guest-input.py`, copied as reviewed source into the guest and executed there with Python. It uses the guest's existing X11/XTEST libraries via ctypes for native input and FFmpeg x11grab for screenshots. Runtime guards require Linux, `/.dockerenv`, UID 1000, `DISPLAY=:99`, and the expected 1440×900 guest display. It neither controls nor captures the host desktop.

Actions are `capture`, `click <x> <y>`, and `key <permitted-key>`. Inspect the most recent guest screenshot before choosing coordinates. The permitted keys are Tab, Shift_L+Tab, Escape, Return, Up, Down, Home, End and Control_L+comma. Each action produces a fresh private screenshot and JSON record under `/home/node/evidence/visual/` with the action, display, hash and `hostInput: false`. Inspect the result before taking another action; a successful command alone is not a visual pass.

The current path captured the guest desktop, closed its probe, opened an actual product source, opened Settings with Ctrl+,, selected/saved 200%, opened Source details and advanced the actual frame to 0:00.500. Native 200% tests passed separately. This does not establish audio listening, full accessibility, arbitrary-alpha/display precision, or Windows acceptance.

Earlier tests used an authenticated loopback TigerVNC viewer. That is historical evidence only. The user's later stop interrupted the host-viewer 200% attempt; it is not a pass. Do not launch or operate a host viewer unless the user explicitly requests it again. Retain private viewer files and old evidence without using them as current host-control authorization. The existing VNC endpoint must remain loopback-only and must not be exposed to the network.

## Sandboxed Electron compatibility

Copy only the probe source, install its pinned test dependencies inside the container, and run:

```sh
python scripts/desktop_environment.py probe-setup
python scripts/desktop_environment.py probe
```

The setup transfers an allowlist of probe files through tar stdin as UID 1000. It needs no root ownership changes or host mounts. Electron 44's npm package exposes an explicit binary installer; installing the package alone did not provide the executable in this environment.

The probe requires Docker, UID 1000 and the isolated display. Playwright explicitly sets `chromiumSandbox: true`; its Linux default disables sandboxing. Assertions check local file loading, isolated preload, sandbox state, lack of renderer Node access, input response and launch arguments. Evidence remains under the container's `/home/node/evidence/`. Inspect Electron visually as well. This compatibility probe is not a product mockup and cannot complete application acceptance.

Source transfer for later application tests must use an explicit reviewed Git archive or selected files. Never mount the repository root, user home, Docker socket, authentication directories or host display sockets. The supplied video may be copied separately into a private project only when the relevant fixture tests pass.
