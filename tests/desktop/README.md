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

The test image also installs Orca, AT-SPI and the Python accessibility bindings. These are test dependencies only. Run the Orca harness in one private `dbus-run-session` so Electron, the screen reader and observer share the session bus. Disable speech and physical braille while checking actual braille-monitor output. Do not connect host audio, displays, devices or accessibility services. Preserve the previous container and its evidence when changing the image.

New guest-only environments publish no host ports. The validator also recognizes the previously reviewed loopback VNC binding for retained historical containers, but no viewer is launched or controlled. Multiple isolated guests can therefore be tested without touching the host desktop or sharing displays.

### Codex runtime bootstrap

For the P2 bootstrap, install the reviewed `@openai/codex@0.142.3` package into a dedicated private guest prefix with `npm install --ignore-scripts --save-exact --prefix <guest-prefix> @openai/codex@0.142.3`. Verify package integrity and the native executable version; retain its hash and generated protocol outputs. Do not copy host account directories or runtime configuration; the only credential-transfer exception is the explicit session authorization in ADR 0006 below. `tests/native/codex-runtime.test.ts <absolute-native-codex-executable>` requires the isolated guest and creates fresh private account/context directories. It tests two real stdio connections, signed-out account state, local fixture-skill discovery, model sign-in gating and close/reconnect exclusion. It records source/runtime provenance before startup. This test does not launch Electron, authenticate, invoke a model, or edit media and cannot satisfy those phase gates.

For this session only, the user explicitly authorized copying the official runtime credential file directly into the private app-owned guest account with mode 600. The host file was unchanged at transfer; no mounts, configuration, history or secret output were used. Keep this private test setup separate from the signed-out harness and from production managed sign-in. No renderer token input or general credential-import feature is introduced. The packaged probe reports connected/signed_in and runtime models, skills and usage, not browser-login completion.

The private synthetic authenticated native flow now passes in packaged Electron with the real signed-in Codex runtime. Run `node tests/native/codex-authenticated.test.ts <packaged-executable> <private-config-root>` only in the isolated guest. The passing run discovered one model and five skills, persisted a runtime-validated selection, committed one Codex-origin start trim at sequence 1 (1.5 to 1.0 seconds), and observed committed controls and exact retained pixels before the turn finished. The same actual thread/history reopened; a real Codex undo appended sequence 2 and restored the 1.5-second draft. Source/baseline bytes and the journal verified. A read-only turn was stopped while running without a journal change and reopened on the same thread. Guest-only capture separately verified the packaged drawer and its switch to the Source inspector after a guest click, with no host input. Keep these result, provenance and screenshot hashes private. Earlier failed native attempts remain failed evidence.

`tests/native/codex-authenticated-settings.test.ts <packaged-executable> <private-config-root> [--inspect]` checks signed-in packaged Settings twice across restart. It compares visible plan, model, usage/reset and skill labels to the live bounded IPC state, then supports guest-only visual input while the native modal remains open. A passing run does not prove managed browser-login completion or future account limits. Keep account screenshots and usage evidence private.

The signed-in trim/undo fixture flow does not prove managed browser-login completion, complete native restriction of unapproved built-in tools, or native subagent inheritance by itself. `tests/native/codex-stale-committed.test.ts <private-authenticated-fixture-evidence> <private-config-root> <packaged-executable>` runs in the guest against one already committed real Codex edit. It checks both direct guarded-service freshness and a second authenticated packaged Electron turn that sends the old sequence/hash through the live MCP tool. Official App Server history must show one failed guarded call with the stale response; journal, draft, source and baseline stay unchanged. The first strict audit failed because it expected a completed MCP status for a rejected call; the corrected rerun passed. `tests/native/codex-native-subagent.test.ts <packaged-executable> <private-config-root> [--inspect]` requires a real completed parent spawn, correlated child thread/read and inherited policy. The corrected strict packaged test passed twice: one parent rollout spawn call/output linked through `thread/read` to a child that completed both approved summary reads under an inherited read-only, never-approval turn policy. Pinned v1 rollout policy filters collaboration events from persisted parent turn history, so the test reads bounded private rollout records instead of requiring a `collabAgentToolCall` item; a bare audit resume would reapply defaults and is not used. Do not count model claims or generic drawer activity. User-supplied media, audio listening, Windows hardware/capture/installer and export remain outside these runs. Retain redacted outcomes and guest-only inspection privately; never record credential contents, account identifiers, private locations or transcripts in public evidence.

`tests/native/codex-forbidden-policy.test.ts <packaged-executable> <private-config-root> [--inspect]` is a bounded authenticated command-policy probe, not a complete tool-catalog introspection. It passed with a ready native thread, completed saved turn, no command/file/dynamic or unrequested tool item, and unchanged synthetic project bytes. The separate audit resumes with the production fixed policy; a bare audit resume was an invalid comparison because it reapplied defaults. The model's statement that shell was prohibited or unavailable is classified as a claim. The test records `effectiveToolUnavailabilityProven: false`; do not mark the full P2 restriction gate complete from it. Guest-only visual captures and the first failed audit are private.

Generate `app-server generate-ts --experimental` and `app-server generate-json-schema --experimental` using that same pinned executable in the guest. Transfer only the generated text to private evidence, then normalize the reviewed TypeScript dependency closure with `scripts/sync_codex_types.py`; `--check` verifies all 207 retained files against their original pinned hashes. Request builders compile against the generated inputs, and response decoders enforce the supported security-sensitive fields. Preserve the complete generated output privately so later protocol changes can be compared without publishing machine-local evidence.

`npm run check:protocol` also generates the pinned experimental JSON schema and requires definitions for every consumed account, catalog, thread-history and turn request, including `thread/resume` and `thread/turns/list`. It is a metadata check only; it does not start app-server, read an account or prove runtime acceptance.

### Pinned Orca comparison

The Debian reader remains available for reproducing its failures. Build a separate dependency image for the reviewed Orca 50.2/AT-SPI2 2.56.8 comparison:

```sh
docker build -t codex-video-edit-desktop:p1-accessibility tests/desktop
docker build -f tests/desktop/orca50.Dockerfile -t codex-video-edit-desktop:p1-orca50-build tests/desktop
```

Create a distinct guest using `scripts.desktop_environment.start_arguments()`, changing only its name and image, and validate the resulting inspection with `validate_inspection()`. Preserve existing guests. Do not add mounts, devices, published ports or privileges. Transfer the reviewed provisioner and test sources with the same allowlisted source-transfer boundary as the product tests.

Inside that guest, run `python3 tests/desktop/provision-orca50.py`. It verifies pinned upstream archive hashes and extracts, builds and installs into a fresh invocation directory. It retains previous runs and prints the new prefix. Installation is separate from product or accessibility acceptance.

In the guest test workspace, set `ORCA_TEST_PREFIX` to that emitted prefix and `PACKAGED_EXECUTABLE` to the absolute reviewed package path, then run:

```sh
env ORCA_EXECUTABLE="$ORCA_TEST_PREFIX/bin/orca" \
  LD_LIBRARY_PATH="$ORCA_TEST_PREFIX/lib" \
  GI_TYPELIB_PATH="$ORCA_TEST_PREFIX/lib/girepository-1.0" \
  XDG_DATA_DIRS="$ORCA_TEST_PREFIX/share:/usr/local/share:/usr/share" \
  dbus-run-session -- node tests/native/orca-smoke.test.ts "$PACKAGED_EXECUTABLE"
```

The harness accepts only reviewed reader versions. Orca 50.2 uses its live D-Bus service for readiness and runtime setting readback; speech and physical braille must be off and the monitor on before app testing. All seven control checks still require actual reader output and matching application-owned focus events. Record package, reader and test provenance before startup. A monitor screenshot may show a subsequent reader mode announcement; inspect it and do not mislabel it as the earlier control announcement.

Copy only the probe source, install its pinned test dependencies inside the container, and run:

```sh
python scripts/desktop_environment.py probe-setup
python scripts/desktop_environment.py probe
```

The setup transfers an allowlist of probe files through tar stdin as UID 1000. It needs no root ownership changes or host mounts. Electron 44's npm package exposes an explicit binary installer; installing the package alone did not provide the executable in this environment.

The probe requires Docker, UID 1000 and the isolated display. Playwright explicitly sets `chromiumSandbox: true`; its Linux default disables sandboxing. Assertions check local file loading, isolated preload, sandbox state, lack of renderer Node access, input response and launch arguments. Evidence remains under the container's `/home/node/evidence/`. Inspect Electron visually as well. This compatibility probe is not a product mockup and cannot complete application acceptance.

Source transfer for later application tests must use an explicit reviewed Git archive or selected files. Never mount the repository root, user home, Docker socket, authentication directories or host display sockets. The supplied video may be copied separately into a private project only when the relevant fixture tests pass.

### Packaged Codex account/settings slice

The guest desktop build now requires the locked official Codex platform package installed by guest `npm ci`. It copies the reviewed Linux x64 `vendor/x86_64-unknown-linux-musl/bin/codex` into packaged resources/codex outside ASAR, together with its Apache licence and version/hash manifest. No build or runtime launch is permitted on the user host. The main resolver has no environment-selected executable fallback; test absent/tampered resources as actionable failures.

The protocol closure now includes 207 generated types covering account/settings, the consumed experimental thread and turn lifecycle, bounded recent-turn history, streamed items, server approvals, and owned MCP status. Unit tests require inline history or exactly one newest-first `thread/turns/list` fallback, strict page and item bounds, chronological redacted projection, active-turn restoration, interrupt continuity, activity-state agreement, and quarantine of forbidden history. Appearance/Codex settings sections and real client actions passed packaged signed-out native checks with guest-only visual inspection at 100% and 200%. Run `node tests/native/codex-settings.test.ts <packaged-executable> [--inspect]` in the guest; the inspection flag retains the native window until the private inspection.done signal or its deadline. This test suppresses external browser launching explicitly while exercising the actual official login-start/cancel methods. The separate `tests/native/desktop.test.ts` opens the compact project Codex drawer and verifies its signed-out error without inserting a sample conversation. A signed-out browser-login start/cancel test can validate runtime URL handling and cancellation without authenticating. Keep the URL, login IDs, codes and raw errors out of screenshots and evidence; record bounded outcomes only. Never treat that test as managed-login success, authenticated catalog discovery, persisted thread history, a model turn, or an edit. Browser opening for native tests must target only a browser inside the same isolated guest; no host viewer or port forwarding. The credential seed exception above does not authorize other host access.

The packaged build carries the reviewed MCP child outside ASAR with a size/SHA manifest. Main starts a token-authenticated local broker and configures the app-server with exactly the four owned tools. Signed-out `mcpServerStatus/list` validation must confirm the expected server name/version, exact tool names and input schemas, and empty resources/templates before project conversations are enabled. Unit tests exercise the child protocol, broker authentication and bounds, fixed error mapping, deep POSIX application-data paths and package tamper rejection. These signed-out checks alone do not establish authenticated tool use, built-in-tool absence under a live model, or native subagent inheritance; separate signed-in fixture tests cover bounded tool use and one native child read path.

The earlier product native suite also closed the packaged app, committed a real fixture trim through the production draft transaction store, and reopened the visible project. It verified the shortened project duration and seek range, mapped output time zero to the retained source offset, then opened the same Source library item at source time zero. That run proved packaged reopen and project-frame mapping for the supported single-clip reducer. The later authenticated native flow above separately passed live event delivery from a real Codex tool.
