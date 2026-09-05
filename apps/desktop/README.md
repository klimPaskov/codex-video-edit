# apps/desktop

The P0 product bootstrap imports immutable source copies into a local media library and inspects source frames in a packaged Electron window. It has a sandboxed preload, strict typed IPC, local-only resource protocol, and persisted ingestion records. This is not yet the full recorder/editor or the P3 project/draft model.

Preview currently accepts only verified native-resolution, full-range BGRA/GBR BT.709 SDR data. Other supported video containers can be preserved, but show an explicit unavailable-preview message. The frame transport performs an exact BGRA-to-RGBA channel permutation; the canvas fits that frame to the visible area and never supplies master inputs. No lossy preview file, audio playback, automatic edit, or export is implied.

Settings persists 100%, 125%, or 150% interface size through main-owned validated storage. Ctrl+, opens its modal; Escape or Cancel discards unsaved choices and returns focus. Source details uses one inspector beside the preview. Native checks cover saved scale after restart, keyboard focus, and panel bounds; the five-stage project shell remains incomplete.

## Isolated development

Provision and verify `tests/desktop/README.md` first. Never build or launch this application directly on the host.

1. Run `python scripts/stage_desktop.py`. It audits an explicit source subset and prints a fresh guest workspace, without host mounts.
2. In that guest directory run `docker exec -w <guest-workspace> codex-video-edit-desktop npm ci --ignore-scripts`.
3. Run `docker exec -w <guest-workspace> codex-video-edit-desktop npm run desktop:build`. The builder outputs the packaged executable path. It refuses a host build.
4. Run `docker exec -w <guest-workspace> codex-video-edit-desktop npm run test:native -- <packaged-executable>`. It generates and verifies a lossless fixture, imports it via the native window, checks exact canvas pixels, security boundaries, reopening and source hashes. Native test evidence stays private in the guest workspace.
5. Inspect that packaged application through the native guest viewer as well. Playwright screenshots alone do not prove the computer-use pass.

FFmpeg/ffprobe are externally installed test dependencies. They are not bundled. The packaged binary is a development artifact, not a signed installer or a Windows release. P1 expands the shell and accessibility; subsequent phases add project drafts, recording, Codex, editing, playback and export.
