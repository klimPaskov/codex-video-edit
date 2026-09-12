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
- idle thread unsubscribe
- owned MCP server status and exact tool inventory
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

The native account/settings source is implemented as described below. The common draft transaction foundation supplies trusted Codex, Magic Wand, and manual adapters, file-synced atomic hash-chained records, exact freshness, deterministic undo, replay, and verified pass-checkpoint binding for one bounded trim-edge reducer. Its main-owned active-project service implements path-free project/timeline summaries, bounded trim, and newest-transaction undo; callers cannot set origin, IDs, timestamps, inverse data, paths, or broader side effects. The service returns committed state and maps backend detail to fixed errors.

The P2 thread continuation wires exact application-owned experimental requests into the real app-server client. A project-thread registry owns create/resume identity. Lifecycle calls are serialized, racing notifications are bounded and ordered, terminal notifications remain authoritative, and idle project close performs `thread/unsubscribe`. Known remote turn rejection permits a new request identity; an uncertain transport outcome remains visible and is never replayed. Server requests for command, file, legacy execution, or MCP elicitation are declined or cancelled and quarantine the connection. Native projection contains only compact messages and activity; raw identifiers, paths, tool arguments, reasoning, command output, and protocol errors do not cross IPC.

Electron main owns an authenticated local broker. The packaged MCP child exposes exactly `project.get_summary`, `timeline.get_summary`, `cut.trim_edge`, and `timeline.undo`; it forwards bounded tool name/input to main and never opens the transaction store. The random broker credential is process-environment only, absent from app-server arguments, thread configuration, renderer state, logs, and persistent files. Startup fails unless `mcpServerStatus/list` returns exactly the owned server, four reviewed tool names and input schemas, no resources/templates, and the expected server version. The app-server process also disables shell, unified execution, JavaScript, browser/computer use, apps/connectors/plugins, remote plugins, image generation, and web search through fixed main-owned configuration.

The 0.142.3 experimental generator output is retained privately and a reviewed 205-type dependency closure is pinned by source hashes. Request objects compile against those generated inputs; consumed responses are checked against the supported security invariants before their safe projection. Signed-out packaged startup proves experimental initialization and MCP inventory negotiation. It cannot prove authenticated turns, model-side tool invocation, server-supported subagent activity, or a reversible real Codex edit; those P2 acceptance gates remain blocked on a guest ChatGPT sign-in.

## Draft authorization

Apply already authorized reversible edits while the turn runs; no repeated material-change approval is required. Magic Wand and manual tools use the same validated active-draft transactions and undo history. `export.prepare` stages settings without another confirmation and cannot start an export. Source deletion, cleanup, spending, publication and final export remain explicit user actions outside these tools. Server-initiated approval requests remain distinct from application edit authorization.

## Native account/settings (partial P2)

The bridge includes managed browser-login start/cancel/logout handling, completion/account reconciliation and rate-limit mapping. The reviewed generated dependency closure contains 205 types from the experimental output of the same official 0.142.3 binary. Sign-in completion alone does not establish refreshed account metadata; reconcile the runtime account update/read before exposing signed-in controls.

The isolated desktop build now copies the official native binary and Apache licence into `resources/codex` outside ASAR, with a version/platform/architecture/content-hash manifest. Main resolves only this fixed packaged resource, checks file type, paths, manifest and hashes, then the client verifies the executable version before starting stdio. The hash manifest detects inconsistent or damaged packaged content; it is not a release signature against replacement of the whole installation. Missing or damaged resources produce actionable reinstall guidance. No environment or renderer executable override is accepted.

The native controller owns account/context directories and external login opening. Appearance/Codex sections expose sign-in, cancellation, sign-out, reconnect, runtime model/reasoning preference, supplied usage and discovered skills. Selection is currently app-level, not a project or turn setting. Packaged Linux signed-out connection, login initiation/cancellation, reopen and scale checks passed with guest-only visual input inspection. The native test explicitly suppressed external browser launching. Authenticated model/usage/selection controls remain unverified against a real signed-in account. No thread, model turn, MCP edit, source mutation or export authority is added by account/settings actions.
