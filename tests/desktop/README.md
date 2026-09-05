# Isolated native desktop

This P0 test environment runs Linux native windows inside Docker. The host runs only a native VNC viewer; never launch Electron directly on the host. This environment is not Windows capture, installer, audio-listening or product acceptance evidence.

## Provision

With Docker's Linux engine running:

```sh
python scripts/desktop_environment.py build
python scripts/desktop_environment.py start
python scripts/desktop_environment.py check
```

The launcher creates `codex-video-edit-desktop`. It fails on an existing name instead of deleting it. The container has a private display, PID/IPC namespaces and shared memory, runs as UID 1000, drops capabilities, prevents privilege escalation, and mounts no host files, sockets or devices. The reviewed [seccomp profile](SECCOMP.md) permits Chromium's nested sandbox. Do not replace it with privileged mode or disable the Chromium sandbox.

The build context is only this directory; `.dockerignore` includes only the Dockerfile and display entry point. Private evidence and user footage must never enter a build context. Stop a test session with `docker stop codex-video-edit-desktop`; retain failed environments/evidence until cleanup is explicitly authorized.

## Native viewer

Use a trusted native VNC viewer, not a browser. This session used the standalone Windows TigerVNC 1.16.2 binary from the official project's linked SourceForge distribution, with its valid Brian Hinz Authenticode signature checked before launch. Keep downloaded binaries and the password file under ignored `.astra/private/desktop/`.

Copy the generated environment password without displaying it:

```sh
docker cp codex-video-edit-desktop:/home/node/.vnc/passwd .astra/private/desktop/vnc.passwd
```

Connect to `127.0.0.1::5909` with `-PasswordFile <absolute-private-password-path> -AcceptClipboard=0 -SendClipboard=0 -AutoSelect=0 -PreferredEncoding=Raw -FullColor=1`. The only published port is localhost; authentication still applies. No file transfer is provided. Do not expose this endpoint on the network or publish debugger ports. VNC raw display transport avoids an extra JPEG representation, but the virtual display remains 24-bit and cannot establish high-precision master fidelity. VNC does not forward audio.

Use computer use to inspect the actual viewer window and click the native infrastructure probe. Confirm that the probe disappears. This verifies input/display transport, not the video editor. Keep screenshots private and label their scope.

## Sandboxed Electron compatibility

Copy only the probe source, install its pinned test dependencies inside the container, and run:

```sh
python scripts/desktop_environment.py probe-setup
python scripts/desktop_environment.py probe
```

The setup transfers an allowlist of probe files through tar stdin as UID 1000. It needs no root ownership changes or host mounts. Electron 44's npm package exposes an explicit binary installer; installing the package alone did not provide the executable in this environment.

The probe requires Docker, UID 1000 and the isolated display. Playwright explicitly sets `chromiumSandbox: true`; its Linux default disables sandboxing. Assertions check local file loading, isolated preload, sandbox state, lack of renderer Node access, input response and launch arguments. Evidence remains under the container's `/home/node/evidence/`. Inspect Electron visually as well. This compatibility probe is not a product mockup and cannot complete application acceptance.

Source transfer for later application tests must use an explicit reviewed Git archive or selected files. Never mount the repository root, user home, Docker socket, authentication directories or host display sockets. The supplied video may be copied separately into a private project only when the relevant fixture tests pass.
