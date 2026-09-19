# Real Codex integration

## Provider scope

Codex remains the mandatory App Server provider. ADR 0014 also requires optional OpenAI API and DeepSeek key connections, each on a fixed provider endpoint. Do not show disabled competitors or an empty marketplace. Show only implemented provider rows and models verified against the relevant live catalog and reviewed endpoint contract. Fixed-endpoint/fake-transport tests and packaged Settings tests pass. A packaged OpenAI API key authenticated a live catalog read and model selection, with no paid completion; no authenticated DeepSeek or API editing turn has been evidenced.

## Authentication

- Spawn the official Codex app-server as a managed local child process.
- Use ChatGPT-managed browser login through `account/login/start` with the supported ChatGPT mode.
- Offer the official `chatgptDeviceCode` mode as an explicit alternative when the user signs in from another device. Show only the fixed verification page and one-time code for that active Settings attempt; do not treat initiation as completion.
- Let Codex own token persistence and refresh.
- Display account state and plan type when returned.
- Do not ask for an API key on the Codex subscription path. Separate API-provider key entry is main-owned under ADR 0014, with OS-backed encryption or session-only fallback; never put a key in a project, renderer-visible state or public evidence.

## Protocol

Implement the official initialization handshake. Use generated types from the installed app-server version. Required functions include:

- account read, login, logout, and rate limits
- model list
- skills list and skills changed
- thread start, resume, and bounded recent-turn list
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

OpenAI API and DeepSeek responses pass through fixed provider adapters and a bounded local conversation service. The service maps only the four reviewed project/timeline tools to main, which applies the same freshness, active-project, transaction and undo checks as Codex and labels committed edits `api_provider`. API keys grant no Codex App Server skills or native subagents. A paid API turn starts only after explicit Send; the drawer shows the selected provider, shared context and billing disclosure before it opens. An authenticated provider edit and a packaged native provider conversation turn still need evidence. OpenAI model-list membership is intersected with reviewed GPT-4.1/GPT-4o Chat Completions families; a base model visible in the raw catalog is not offered as an editor choice. A remembered model is encrypted with its key and restored only after live catalog revalidation; older key-only ciphertext remains usable. A separate packaged Linux native run with real GNOME Secret Service verified protected OpenAI model restoration and explicit removal; it started no paid turn.

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

The P2 bootstrap library pins official Codex 0.142.3, verifies its executable version before connection, and uses the reviewed generated TypeScript closure in `docs/contracts/codex-protocol.json`. Initialization verifies the server's account-directory identity. The process receives an explicit environment allowlist, dedicated context/account directories, OpenAI provider and ChatGPT login configuration. No renderer-selected executable, configuration, RPC method or environment is exposed. Close is a startup/shutdown barrier, and reconnection never replays requests. Disconnect preserves a poisoned projector's quarantine while publishing active-turn uncertainty at most once; callback exceptions cannot bypass transport shutdown. A later corrected packaged authenticated flow passed; the earlier failed attempts remain in P2 progress.

Account responses establish account type and plan, not token provenance. Omitted nullable fields are interpreted according to the pinned JSON wire schema even when the generated TypeScript spelling is required-null. Consumed model and skill fields are validated and detached; raw protocol, email, skill paths and credentials are not returned by the bootstrap summaries. Model pages are bounded and queried on one transport. A signed-out response prevents model availability claims.

The native account/settings source is implemented as described below. The common draft transaction foundation supplies trusted Codex, Magic Wand, and manual adapters, file-synced atomic hash-chained records, exact freshness, deterministic undo, replay, and verified pass-checkpoint binding for one bounded trim-edge reducer. Its main-owned active-project service implements path-free project/timeline summaries, bounded trim, and newest-transaction undo; callers cannot set origin, IDs, timestamps, inverse data, paths, or broader side effects. The service returns committed state and maps backend detail to fixed errors.

The P2 thread continuation wires exact application-owned experimental requests into the real app-server client. A project-thread registry owns create/resume identity. Lifecycle calls are serialized, racing notifications are bounded and ordered, terminal notifications remain authoritative, and idle project close performs `thread/unsubscribe`. Ordinary notifications from a native child thread are filtered before buffering the active parent's stream; malformed thread identities and forbidden notification methods still fail closed. Known remote turn rejection permits a new request identity; an uncertain transport outcome remains visible and is never replayed. Server requests for command, file, legacy execution, or MCP elicitation are declined or cancelled and quarantine the connection. Native projection contains only compact messages and activity; raw identifiers, paths, tool arguments, reasoning, command output, and protocol errors do not cross IPC.

Resume restores at most 100 recent full turns from the inline `initialTurnsPage`, with one exact `thread/turns/list` fallback when that page is absent. The fallback is newest-first and uses the main-owned thread ID; cursors are validated but never followed or exposed. Main accepts at most 1,000 unique items, then projects at most 200 redacted user/Codex messages and 32 generic activities in chronological order. Skill paths and server item IDs stay in main. Command, file, web, image, dynamic-tool, foreign-MCP, unknown, or approval-waiting history fails closed and quarantines the session. A newest in-progress turn is restored before buffered notifications are reduced and remains interruptible. Resume must report a supported thread status; an inline page must agree with it. A fallback page is the later authoritative observation because a turn may finish between the two RPCs.

Electron main owns an authenticated local broker. The packaged MCP child exposes exactly `project.get_summary`, `timeline.get_summary`, `cut.trim_edge`, and `timeline.undo`; it forwards bounded tool name/input to main and never opens the transaction store. The random broker credential is process-environment only, absent from app-server arguments, thread configuration, renderer state, logs, and persistent files. Startup fails unless `mcpServerStatus/list` returns exactly the owned server, four reviewed tool names and input schemas, no resources/templates, and the expected server version. The app-server process also disables shell, unified execution, JavaScript, browser/computer use, apps/connectors/plugins, remote plugins, image generation, and web search through fixed main-owned configuration.

Project summaries read project metadata and the draft head atomically under the shared root queue. After every settled trim or undo call, including an uncertain response after journal promotion, main rereads that authority and emits a validated path-free draft update independently of model text or streamed MCP activity. Delivery failure never changes the tool result. The renderer reconciles sequence/hash monotonically and requests project frames with the exact committed head; main maps timeline time to source time and withholds pixels if the head changes during decode.

Live user-message echoes are tracked and validated but emit no second message: main already owns the sent user text. Only actual Codex messages produce Codex replies. Owned summary reads display Reading the project; trim and undo display Applying an edit. These activity labels describe tool activity, not successful commit evidence. An earlier authenticated attempt committed one Codex-origin trim but failed projected-history equality after resume; that failure remains recorded. The corrected private synthetic packaged native flow later passed: one real Codex-origin start trim at sequence 1 reduced the draft from 1.5 to 1.0 seconds, and committed controls and exact retained source-frame pixels were observed while the turn was running. The same actual thread and matching projected history reopened. A real Codex undo appended sequence 2, restoring 1.5 seconds and the original first-frame pixels. Source and baseline remained unchanged, and the journal and offline reopen verified. A separate read-only turn was interrupted through Stop without a journal change and reopened on the same thread. Guest-only visual evidence confirmed that clicking Source details replaced the Codex drawer with one inspector. Private result and provenance records retain hashes without public account or media details.

The 0.142.3 experimental generator output is retained privately and a reviewed 207-type dependency closure is pinned by source hashes. Request objects compile against those generated inputs; consumed responses are checked against the supported security invariants before their safe projection. Signed-out packaged startup proves experimental initialization and MCP inventory negotiation. The separate signed-in packaged run proves the bounded authenticated trim, undo, history reopen and Stop flow above. An offline guarded-service continuation of a later real native Codex trim rejected the old sequence/hash as `stale_draft` and preserved the journal, draft, source and baseline; a later packaged native turn proved the live App Server/MCP stale-error relay with unchanged journal, source and baseline. App-server and thread configuration request v1 native collaboration, but model metadata or persisted state can override that fallback; only a correlated child turn and owned tool call can verify inheritance. At that checkpoint the parent turn-history page showed no collaboration item, so model text alone was not counted as proof; a later rollout audit found native child records. Managed browser-login completion and effective live restriction of all unapproved built-in tools remain unverified; a later strict packaged child run verified inherited policy. P2 is not accepted.

A later packaged native negative probe asked the signed-in model for a harmless built-in command on a synthetic fixture. The app returned ready and the persisted turn recorded no command, file, dynamic or unrequested MCP/collaboration item; source, baseline and journal remained unchanged. This proves observed non-use in that turn, not full tool-catalog absence. The separate audit connection resumed with production fixed policy fields and verified its read-only/never-approval response; it does not independently establish the original model-visible tool set. A further `gpt-5.5` xhigh prompt explicitly requesting native tool-search discovery completed without a collaboration item in persisted parent history; a later private rollout audit found a linked child for that turn. The `thread/turns/list` item union cannot represent tool-search calls, so that history cannot establish whether discovery ran. These results left the P2 tool and native-agent gates open at that checkpoint.

Main supplies the validated active project ID and read-tool schema version as a JSON context in the project thread's developer instructions on create and resume. No source paths or project titles are needed to bootstrap the read tools. Draft identity, sequence and timeline hash still come from fresh guarded reads before each mutation. The user is never asked to discover an internal project identifier.

## Draft authorization

Apply already authorized reversible edits while the turn runs; no repeated material-change approval is required. Magic Wand and manual tools use the same validated active-draft transactions and undo history. `export.prepare` stages settings without another confirmation and cannot start an export. Source deletion, cleanup, spending, publication and final export remain explicit user actions outside these tools. Server-initiated approval requests remain distinct from application edit authorization.

## Native account/settings (partial P2)

The optional device-code path now uses the same official App Server, login attempt correlation, cancellation and account reconciliation as browser login. An explicit Settings action returns only the exact `https://auth.openai.com/codex/device` verification page and bounded one-time code through typed IPC. Main opens that fixed page on a second explicit click; the renderer supplies no destination. The code stays in transient Settings memory and clears on cancel, completion, failure, reconnect or closing the panel. A packaged native guest run proved real device-code initiation, visible code, guest-local page opening, cancellation to signed out and process cleanup. The pinned runtime also accepted a direct start/cancel probe. In a separate live packaged attempt, the user completed official verification externally. The App Server completion was followed by the same native window's reconciled signed-in state and cleared code; a separate packaged reopen with that private account confirmed authoritative signed-in state, plan, live models and skills. This verifies managed device-code completion, not the browser OAuth callback route or the full P2 phase.

The bridge includes managed browser-login start/cancel/logout handling, completion/account reconciliation and rate-limit mapping. The reviewed generated dependency closure contains 207 types from the experimental output of the same official 0.142.3 binary. Sign-in completion alone does not establish refreshed account metadata; reconcile the runtime account update/read before exposing signed-in controls.

The isolated desktop build now copies the official native binary and Apache licence into `resources/codex` outside ASAR, with a version/platform/architecture/content-hash manifest. Main resolves only this fixed packaged resource, checks file type, paths, manifest and hashes, then the client verifies the executable version before starting stdio. The hash manifest detects inconsistent or damaged packaged content; it is not a release signature against replacement of the whole installation. Missing or damaged resources produce actionable reinstall guidance. No environment or renderer executable override is accepted.

The native controller owns account/context directories and external login opening. Appearance/Codex sections expose sign-in, cancellation, sign-out, reconnect, runtime model/reasoning preference, supplied usage and discovered skills. Selection is currently app-level, not a project or turn setting. Packaged Linux signed-out connection, login initiation/cancellation, reopen and scale checks passed with guest-only visual input inspection; that earlier test suppressed external browser launching. A separate packaged native test in a browser-equipped isolated guest used the real opener: the Settings action started guest Chromium on the OpenAI authorization route, guest-only visual inspection showed the loaded OpenAI login page with the editor behind it, and cancellation returned the app to signed out. The test-owned browser and opener exited without host browser use. This verifies the opening/cancel path, not managed browser-login completion or account provenance. The later signed-in synthetic run discovered one model and five skills and persisted a runtime-validated selection; the earlier authenticated probe also returned usage. A separate signed-in packaged Settings run matched the returned plan, model, usage windows/reset times and skills across restart, with guest-only visual input. Account/settings actions add no source mutation or export authority; the guarded project thread separately performed the bounded edit described above.

The strict packaged native child test now passed twice on fresh synthetic projects. A private official rollout recorded one completed v1 `spawn_agent` call/output; `thread/read` linked the returned child to its parent, and the child history contained two completed approved summary reads. Parent and child saved turn contexts matched on model, effort, working directory, collaboration version, read-only sandbox, restricted permission profile and never-approval. Source, baseline and draft journal remained unchanged. The renderer settled to its completed conversation in the inspected native screenshot. This proves a bounded supported native-child read path and policy inheritance for this runtime, not complete absence of every unapproved built-in tool. The pinned rollout policy filters collaboration spawn events while retaining function calls and outputs, so `thread/turns/list` alone cannot reconstruct v1 spawn evidence. The test reads bounded private rollout files only after App Server identifies their account-contained paths; raw records never cross renderer IPC.
