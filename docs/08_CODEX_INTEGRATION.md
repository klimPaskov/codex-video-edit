# Real Codex integration

## Provider scope

Codex is the only AI provider exposed in the first release. Do not show disabled competitors or an empty provider marketplace. The AI settings screen may show the provider label and a runtime-discovered Codex model selector.

## Authentication

- Spawn the official Codex app-server as a managed local child process.
- Use ChatGPT-managed browser login through `account/login/start` with the supported ChatGPT mode.
- Let Codex own token persistence and refresh.
- Display account state and plan type when returned.
- Do not ask for or store an API key in the first release.

## Protocol

Implement the official initialization handshake. Use generated types from the installed app-server version. Required functions include:

- account read, login, logout, and rate limits
- model list
- skills list and skills changed
- thread start, resume, read, and list
- turn start and interrupt
- streamed turn and item notifications
- server-initiated approval requests when applicable

Use stdio JSONL for the required local child-process integration. Current official documentation also lists WebSocket and Unix transports; their availability does not change this product decision. Validate compatibility against the installed binary.

## Runtime project thread

Each codex-video-edit project owns a durable Codex thread. The thread receives:

- project brief
- current timeline summary
- transcript excerpts
- selected time range
- contact sheets or requested preview frames
- user instruction
- available skills
- guarded codex-video-edit tool descriptions

Do not send raw full-resolution media unless a supported tool and user disclosure require it.

## Live editing

Codex may call guarded tools that append operations to the active draft. The UI applies validated operations as they complete and displays them in the shared undo history. A partial turn may leave completed transactions in place. Stop and undo remain available.

## Guarded tool set

Required tool groups:

- inspect project, timeline, transcript, selection, and frames
- add, update, remove, and restore edit operations
- add or adjust zoom and speed ranges
- configure captions, layout, camera, cursor, and audio
- search and place local B-roll
- render preview and run QA
- prepare export settings

Codex cannot overwrite raw sources, delete projects, execute cleanup, or confirm final export through these tools.

## Skills

Load project skills from a dedicated root. Re-list when `skills/changed` is received. Send explicit skill input items when invoking a known skill.

## User-facing activity

Show short states such as “Finding long pauses” or “Adjusting two zooms.” Put command output, protocol messages, and stack traces under Diagnostics.

## Protocol and privacy verification

Use `codex app-server` with the documented default stdio transport, or the verified `--listen stdio://` option. Generate types from the pinned binary and validate the initialization and auth flow against its documentation. Protocol feature maturity can change, so record compatibility and actual native subagent support instead of assuming it.

Local app processes do not imply local model inference. Codex may send approved context to the provider. Do not reproduce mockup statements claiming all AI runs offline. Managed ChatGPT login does not guarantee every account has the same model availability or limits.

Official protocol reference checked 2026-09-05: https://developers.openai.com/codex/app-server/

## Implemented bootstrap boundary

The P2 bootstrap library pins official Codex 0.142.3, verifies its executable version before connection, and uses the reviewed generated TypeScript closure in `docs/contracts/codex-protocol.json`. Initialization verifies the server's account-directory identity. The process receives an explicit environment allowlist, dedicated context/account directories, OpenAI provider and ChatGPT login configuration. No renderer-selected executable, configuration, RPC method or environment is exposed. Close is a startup/shutdown barrier, and reconnection never replays requests.

Account responses establish account type and plan, not token provenance. Omitted nullable fields are interpreted according to the pinned JSON wire schema even when the generated TypeScript spelling is required-null. Consumed model and skill fields are validated and detached; raw protocol, email, skill paths and credentials are not returned by the bootstrap summaries. Model pages are bounded and queried on one transport. A signed-out response prevents model availability claims.

Native sign-in, durable threads and guarded editing remain unimplemented. Follow `docs/research/P2_RUNTIME_POLICY.md` before enabling turns: the reviewed experimental no-environment policy requires exact generated types and actual negative-tool tests. Disabling the shell feature alone does not establish a complete filesystem/tool boundary. Real unauthenticated bootstrap evidence is separate from the native and authenticated P2 gates.

## Draft authorization

Apply already authorized reversible edits while the turn runs; no repeated material-change approval is required. Magic Wand and manual tools use the same validated active-draft transactions and undo history. `export.prepare` stages settings without another confirmation and cannot start an export. Source deletion, cleanup, spending, publication and final export remain explicit user actions outside these tools. Server-initiated approval requests remain distinct from application edit authorization.
