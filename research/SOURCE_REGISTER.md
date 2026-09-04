# Source register

Research date: 2026-09-04

| Source | Type | Planning use | Recheck trigger |
| --- | --- | --- | --- |
| OpenAI, GPT-6 Astra introduction | Official product source | Confirms current computer-use, browsing, software-engineering, and application QA focus | Before sending the goal prompt to a different model or after a major model update |
| OpenAI, Codex App Server article | Official architecture source | Supports a long-running local client using bidirectional JSON-RPC over stdio and streamed UI-ready events | Before implementing P2 |
| OpenAI Codex app-server README | Official protocol source | Confirms current transports, lifecycle, approvals, skills, apps, and auth endpoints | At every pinned Codex binary update |
| Borumi website and help center | Official product source | Supports scene-by-scene recording, separate sources, retries, layouts, automatic timeline, transcript editing, and automatic zooms as useful product patterns | When new reference screenshots are added |
| Electron desktopCapturer | Official API source | Supports screen and window enumeration plus loopback audio where the platform permits it | Before P4 and Electron upgrades |
| Electron security, context isolation, and sandbox guides | Official security sources | Defines secure local renderer and IPC requirements | Before P1, security review, and Electron upgrades |
| Playwright Electron API | Official test source | Supports launching and automating the real Electron app and windows | Before P1 and Playwright upgrades |
| Comparable current recorder and editor products | Public product sources | Confirms common user expectations for automatic zoom, cursor treatment, simple timeline correction, camera layouts, and reframing | During P0 and design refreshes |

## URLs

- https://openai.com/index/gpt-6-astra/
- https://openai.com/index/unlocking-the-codex-harness/
- https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md
- https://borumi.com/
- https://borumi.com/help/introduction/quick-start/
- https://www.electronjs.org/docs/latest/api/desktop-capturer
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/tutorial/context-isolation
- https://www.electronjs.org/docs/latest/tutorial/sandbox
- https://playwright.dev/docs/api/class-electron

## Research rule

Technical implementation must use current official sources. Product comparison may use public product pages for observed interaction patterns. Never infer an undocumented protocol or feature from marketing copy.

## Final fidelity and Codex checks, 2026-09-05

- FFV1 lossless video format: https://ffmpeg.org/~michael/ffv1.html
- FFmpeg encoder profiles: https://www.ffmpeg.org/ffmpeg-codecs.html
- FLAC audio format: https://xiph.org/flac/
- ProRes 422 HQ visual-losslessness wording: https://support.apple.com/en-us/102207
- Codex App Server protocol and managed ChatGPT login: https://developers.openai.com/codex/app-server/

These sources inform the corrected requirements. Exact dependency builds and generated protocol types must still be checked and pinned during P0. Do not treat provider runtime access or native tests as already verified.
