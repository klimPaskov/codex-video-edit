# P0 foundation research

Checked 2026-09-05. Scope: P0-01, P0-02, P0-03. These are documentation and executable-metadata observations, not implemented feature or native test evidence. Publication dates are stated when the source exposes them; otherwise this date means retrieval only.

## Versions and reproducibility

| Component | Observation | Decision / remaining check |
| --- | --- | --- |
| Electron | Registry `npm view electron version` returned `44.2.0`; its official release page labels it Latest Stable, Chromium `152.0.7977.76`, Node `24.20.0`. | Candidate exact application pin `44.2.0`; test packaged Windows behavior in isolation. The aggregate stable page initially showed `44.1.0`, so use the exact release page plus registry evidence. |
| Playwright | Registry `npm view @playwright/test version` returned `1.62.1`; official release notes describe the `1.62` series. | Candidate exact test pin `1.62.1`; Electron API remains experimental and compatibility must be tested. |
| FFmpeg | Official download page reports stable `9.0.1`, released `2026-08-12` from the 9.0 branch. | Record the actual test binary version/build separately; this observation does not mean a redistributable Windows binary has been obtained or licensed. |
| whisper.cpp | Releases page shows `v1.9.3` as prerelease; GitHub latest-release API returned `b4938`, published `2026-08-20T11:33:19Z`, `prerelease: false`. The page describes b4938 as nightly. | Do not infer stability from the API's latest label. Select a tested exact commit/model checksum in P5; no speech runtime/model was downloaded or executed here. |
| Codex | Locally available `codex --version` returned `codex-cli 0.142.3`. `codex app-server --help` reports stdio default and `generate-ts` / `generate-json-schema`. | Generate protocol artifacts from the chosen exact executable and record its version. No authentication, model invocation, or app-server session was performed by this research subtask. |

Sources: [Electron 44.2.0](https://releases.electronjs.org/release/v44.2.0), [Playwright release notes](https://playwright.dev/docs/release-notes), [FFmpeg releases](https://ffmpeg.org/download.html), [whisper.cpp releases](https://github.com/ggml-org/whisper.cpp/releases), [whisper.cpp latest release metadata](https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest). The npm commands are read-only package-registry queries made on the checked date.

## Electron security and capture

Keep the accepted native-shell ADR: local packaged renderer, sandbox, context isolation, no Node integration, narrow preload methods, validated IPC senders/arguments, restricted navigation and window creation, and restrictive CSP. The main process is a privilege boundary, so renderer types alone cannot validate requests. Use a trusted local protocol and refuse remote product content. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)

`desktopCapturer` runs in the main process and enumerates desktop sources; the documented display-media request handler can supply a video source and loopback audio. The optional system picker is experimental and can bypass that handler. These APIs demonstrate capture access, not sample identity or full separate-source synchronization. Do not copy the example's first-screen selection or low-resolution constraints into production behavior. [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer)

Decision effect: preserve ADRs 0001, 0006, 0007 and 0009. P4 must measure native frame/audio precision, timestamps, drift, dropped frames, throughput and permission failures. A MediaRecorder-to-FFV1 transcode cannot establish a lossless capture boundary. A native adapter remains necessary unless the selected Chromium path is proven end to end against known samples. Region capture and individual system-audio sources need Windows-specific tests; documentation availability is not hardware evidence.

## Native testing

Playwright exposes experimental `_electron.launch`, main-process evaluation and `firstWindow` automation/screenshots. Documentation lists Electron 14+ among supported versions and notes that disabling the Node CLI inspect fuse can prevent launch. Native dialogs are not intercepted automatically; deterministic tests can replace dialog methods in the main process. [Playwright Electron API](https://playwright.dev/docs/api/class-electron)

Use isolated test builds for automation and inspect the actual native window separately through computer use. Do not weaken shipping security to satisfy test instrumentation. A browser-renderer screenshot or a passing process command cannot satisfy native acceptance. This research did not launch Electron, enumerate the user's capture devices, or create screenshots.

## Media and transcription boundaries

FFV1 specifies lossless video coding; that guarantee applies to the samples supplied to the encoder. [FFV1 specification](https://ffmpeg.org/~michael/ffv1.html) Product policy additionally requires exact decoded canonical video/audio equality, metadata preservation, source immutability, explicit formats, and unsupported-format rejection. Verify the encoder's available pixel formats and PCM representations from the actual binary. Keep analysis-only mono speech extraction and optional faster-preview derivatives out of master inputs. Do not treat codec names, successful decode or encoded-file hashes as sample-equality evidence. No high-precision, alpha, HDR or capture path is declared verified by this research.

whisper.cpp provides a local C/C++ Whisper implementation and documents word-level timestamps as experimental. [whisper.cpp project documentation](https://github.com/ggml-org/whisper.cpp) Treat timings as estimated analysis. P5 needs known speech fixtures, word-boundary tolerance checks, silence/overlap cases, language coverage, cancellation, confidence handling and model provenance. Transcript correction must not be described as speech replacement. Pin binary and model independently; licenses and redistribution remain a release check.

## Codex contract

Current official documentation redirects from developers.openai.com to ChatGPT Learn. It documents JSONL stdio, version-specific schema generation, `initialize` then `initialized`, persistent thread/resume, streamed item events, `turn/interrupt`, runtime `model/list`, and `skills/list` with `skills/changed`. ChatGPT-managed browser login starts through `account/login/start` with `type: chatgpt`; device-code login is also documented. Wait for completion/account events instead of inferring authentication from opening a URL. Runtime catalog results govern model/effort choices. [Official App Server documentation](https://learn.chatgpt.com/docs/app-server)

The same documentation now lists WebSocket and Unix transports; the earlier repository statement that WebSocket is unsupported is stale. Keep stdio because it meets this product's local integration requirement. The server's broader provider support does not change this product's Codex-only, ChatGPT-managed policy. Installed-binary schemas and a real isolated P2 smoke test must resolve version drift. No runtime subagent API was established by this research; do not fabricate one from the surrounding development agent's tools.

## Comparable creator workflows

Borumi's public site describes ideation, per-scene recording with retries, then editing/export. It markets screen/camera/microphone capture, cursor smoothing and automatic zoom. These are observed website claims, not hands-on verification of its application or encoding quality. [Borumi](https://borumi.com/)

Screen Studio's public site describes automatic and adjustable timeline zooms, cursor presentation, cuts and speed changes, webcam/microphone/system audio, and locally generated transcripts/subtitles. It markets macOS recording. This supports discoverable automatic edits with manual adjustment as a useful product pattern; it does not establish Windows parity or verified lossless media. [Screen Studio](https://screen.studio/)

Decision effect: keep scenes/retakes, automatic first cut, adjustable zooms and restrained contextual controls already required by the user. Retain Record or Import → Auto Edit → Edit → Review → Export as the latest authoritative workflow. Competitor marketing cannot remove review, undo, source preservation or explicit final export. No competitor text, branding, image, video or exact layout was copied into the product.

## Evidence and synchronization handoff

Local generator follow-up: `python scripts/verify_codex_protocol.py` successfully inspected Codex 0.142.3 without a server session or authentication. It generated 267 schemas and resolved all seven required request definitions plus managed `chatgpt` login. Generated `skills/list` parameters contain `cwds` and `forceReload`; hosted-login and extra-root fields shown in newer online documentation must not be assumed. The generated internal `chatgptAuthTokens` mode is not the selected login path. Native subagent event/item shapes occur in generated schemas, but they do not prove a public client spawning API or runtime availability. Per-file hashes remain in ignored local evidence. The verifier now generates into a fresh directory for every run so stale schema files cannot inflate the result.

Read: AGENTS.md, authoritative order, goal, planning package, workflow, tasks, active P0 prompt, all accepted ADRs, contracts, lossless/open-source policies, reference notes, researcher instructions and relevant research/orchestration/spec-sync/Codex/lossless skills. No schema was changed. Parent integration should link this report from research/RESEARCH.md, correct its stale transport rationale, and record independently verified protocol artifacts and media results. This report alone does not complete P0, grant native-test access, prove login, or authorize publication of media.
