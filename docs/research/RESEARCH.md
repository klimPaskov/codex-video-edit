# Research summary

Research date: 2026-09-04

Current foundation review: [P0 research, checked 2026-09-05](P0_FOUNDATION.md). Use that report for current dependency observations, protocol corrections, and explicit limits; the earlier summary below is background research.

## Astra

OpenAI describes GPT-6 Astra as strong in computer use, browsing, software engineering, and frontend QA. The implementation prompt therefore requires research, native app launch, visible inspection, and iterative correction. Model capability does not remove the need for deterministic tests and evidence.

Source: https://openai.com/index/gpt-6-astra/

## Borumi

Borumi presents a three-part creator flow: ideate, record, and edit. Its public feature set includes scene-by-scene recording, screen, camera, microphone, separate sources, retries, layouts, automatic timeline, transcript editing, noise removal, multiple canvas formats, automatic zooms, system audio, cursor controls, silence removal, teleprompter, and editor shortcuts.

Sources:

- https://borumi.com/
- https://borumi.com/changelog/
- https://borumi.com/alternatives/camtasia/

The product may take inspiration from the simplicity and feature classes. It must not copy Borumi branding, assets, copy, or exact screen composition.

## Comparable patterns

Other current products reinforce these patterns:

- automatic zooms around clicks and cursor activity
- an editable AI-generated timeline
- user control over zoom range and target
- clean screen, camera, and microphone capture
- local or desktop-first export

Sources:

- https://www.vidova.ai/
- https://framevo.app/
- https://screenforge.co/
- https://www.canvid.com/features/auto-manual-zoom
- https://getflowy.app/

## Codex

The official Codex app-server is intended for rich clients. It uses bidirectional JSON-RPC, supports stdio, threads, turns, streamed events, model discovery, skills, ChatGPT-managed login, and rate-limit state. The package chooses stdio for the required local child-process integration. The [current official documentation](https://learn.chatgpt.com/docs/app-server) also lists WebSocket and Unix transports; the previous claim that WebSocket is unsupported is stale. Validate protocol types against the exact installed executable before implementing P2.

Sources:

- https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md
- https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan

## Native stack

Electron provides desktop capture and system-audio loopback interfaces. Playwright can launch Electron apps, automate their windows, and capture screenshots. Electron security guidance requires current releases, context isolation, sandboxing, restricted navigation, validated IPC, and local trusted renderer content.

Sources:

- https://www.electronjs.org/docs/latest/api/desktop-capturer/
- https://www.electronjs.org/docs/latest/tutorial/security
- https://playwright.dev/docs/api/class-electron
