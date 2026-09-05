# codex-video-edit

A standalone desktop recorder and video editor with live Codex editing, a simple timeline, optional camera, captions, B-roll, automatic zooms, and lossless-first media handling.

**Status: P0 foundation in development. This is not yet a usable recorder or editor.** The actual packaged Electron bootstrap imports media into an immutable local library and supports bounded frame inspection. Its synthetic import, seek, reopen, security, and frame-equality checks passed in the isolated Linux desktop, with native computer-use inspection. Full phase acceptance and source publication of this slice remain pending.

## Start

Open this `codex-video-edit` folder as your working repository and give the implementation agent `GOAL_PROMPT.md`. Do not move the files into another planning folder.

The agent starts with `AGENTS.md` and `TASKS.md`, builds the native app, and tests it inside its own isolated desktop environment. The public repository is [klimPaskov/codex-video-edit](https://github.com/klimPaskov/codex-video-edit). Source publication and native acceptance are tracked separately; see [P0 foundation](docs/46_P0_FOUNDATION.md).

## Included

- Product, desktop architecture, recorder, editor, Codex, media, QA, and release specifications
- Ordered phase prompts, reusable skills, specialist subagents, schemas, examples, and checklists
- 20 original, separate native-app UI reference images: 10 current and 10 previous
- Lossless-first policy, restrained interface rules, and open-source development requirements

Open `references/index.html` locally to browse one full-size reference at a time. Read `references/IMPLEMENTATION_NOTES.md` before copying any visual detail. No contact sheets or multi-screen collages are included.

## Implementation priorities

`Record or Import -> Auto Edit -> Edit -> Review -> Export`

Codex edits the live draft through the same reversible operations as the manual tools. Only the active step and relevant controls are shown. Lossless capture, intermediates, and master export are the default. Smaller previews and compressed sharing copies require an explicit quality choice.

## Validation

```bash
npm ci --ignore-scripts
python -m pip install -r requirements-validation.txt
npm run check
```

Prerequisites: Node 24.15 or later in the 24.x line, Python 3.9+, and FFmpeg/ffprobe on PATH. The single check command runs strict TypeScript, lint, formatting, Python foundation tests, synthetic media encode/decode comparisons, schemas, and reference validation. It does not launch a desktop window or touch capture devices. CI runs these checks on Windows and Linux; FFmpeg installed there is a test dependency and is not bundled for redistribution.

Media fixtures are generated under ignored `.astra/evidence/`. The bounded P0 adapter verifies canonical raw samples up to 64 MiB per input, BT.709, and mono/stereo PCM. It rejects preview/analysis inputs and unsupported precision or HDR paths. These checks do not establish production capture, compositor, playback, or real-time throughput support.

The [isolated desktop setup](tests/desktop/README.md) runs native windows inside Docker and exposes only an authenticated loopback VNC connection. A native viewer displays the guest desktop; the product must never launch directly on the host. Separate from the infrastructure probe, the actual packaged product passed Playwright Electron checks and native source selection/Next frame inspection. Its frame path is limited to native-dimension BGRA full-range GBR BT.709 SDR within explicit bounds; other supported imports remain preserved with preview unavailable. This does not establish audio playback, Windows capture, installer support, Codex editing, or the user-video workflow.

Before publishing, stage only reviewed source, run `npm run check:publication`, inspect the staged diff, and verify the pushed commit. `npm run phase:write -- path/to/result.json` accepts only complete, validated phase evidence tied to a published Git revision. Keep incomplete work under `.astra/progress/`. See `VALIDATION_REPORT.md` for the planning package's historical checks, and `.astra/progress/` for implementation progress.

`MANIFEST.sha256` covers source files using LF-normalized text and exact binary bytes, so Git's platform line endings do not invalidate it. Regenerate with `python scripts/build_integrity_manifest.py` and verify with `python scripts/validate_delivery.py --check-integrity`. Reference-image hashes always compare exact original bytes.
