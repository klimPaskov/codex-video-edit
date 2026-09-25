# Security and privacy

## Desktop renderer

- Load packaged local content only.
- Disable Node integration.
- Enable context isolation and renderer sandboxing.
- Apply a restrictive CSP.
- Deny unexpected navigation and new windows.
- Validate every IPC sender and payload.
- Expose only narrow preload functions.
- Never render arbitrary remote HTML inside a privileged view.

## Filesystem

- Limit project operations to selected project roots.
- Canonicalize paths and reject traversal.
- Keep source files immutable.
- Use staging and atomic promotion.
- Confirm project deletion and cleanup.

## Capture privacy

- Request clear permission for screen, camera, microphone, system audio, and pointer telemetry.
- Display active capture indicators.
- Never capture keystrokes.
- Avoid notification and secret exposure in fixtures and documentation.

## AI data boundary

- Explain which selected provider receives text, metadata, frames and instructions before first use.
- Send the minimum context needed for the task.
- Keep raw media local by default.
- Show when a frame or transcript excerpt is being shared.
- Let the user sign out and use the manual editor without AI.
- Keep API-provider requests on fixed reviewed HTTPS endpoints under main; do not let renderer data choose a destination.
- Treat API-provider output as untrusted edit intent with the same active-project, scope, sequence/hash and undo validation as Codex tools.
- Require an explicit user action before any paid generation turn; do not guess prices or remaining credit.

## Runtime tools

Codex receives guarded codex-video-edit tools, not unrestricted filesystem or shell control. Tool calls validate project, draft, range, asset, and transaction identity.

Electron main owns the active project and the only draft writer. The packaged MCP child accepts only the seven reviewed P2 tools, including bounded reversible `cut.split`, `cut.delete_range`, and `cut.delete_ranges`, and forwards bounded intent through a local broker authenticated by a random process-only credential. App-server startup verifies the exact server, tool names, and input schemas and refuses MCP project threads on mismatch. The child cannot choose a project root, construct transaction authority, approve export/deletion/cleanup, or access a generic main RPC.

Renderer project frames are bound to the exact draft ID, baseline revision, sequence and timeline hash. Main alone maps output time to the immutable source, rechecks the head after decode, and returns no stale pixels. Source IDs, mapped source times and paths stay out of this project-frame request and response. Draft-change events contain only the validated path-free identity and timeline view.

The dedicated App Server uses fixed ChatGPT/OpenAI settings and disables web search, shell, unified execution, the separate JS REPL, browser/computer use, apps, connectors, plugins, remote plugins, image generation, the plan tool and user-input requests. Its matching packaged Luna code-mode host is hash-checked and required for guarded editor tools. MCP-bound project threads disable native collaboration. Dynamic-bound Codex subscription threads enable native v1 children with depth limited to one; the project client accepts child tools only after a server-owned parent spawn identifies the receiver and the child turn is active. The main-owned invoker allows children to read only project and timeline summaries and independently denies child edits. Empty environments, read-only/no-network sandbox policy, command/file approval rejection, and MCP elicitation cancellation apply to the tested child path. Child notifications never enter the parent projection. A packaged native fixture passed the parent spawn/wait, child summary reads and inherited policy checks with unchanged source, baseline and journal. This establishes that bounded path, not a complete effective model-visible tool catalog or permanent upstream restriction; full P2-07 confinement remains open.

Thread resume consumes at most one validated page of 100 newest full turns and 1,000 unique items. Main reverses that page for chronological display and exposes only up to 200 redacted user/Codex messages and 32 generic activities under fresh application IDs. Skill paths, cursors, raw server IDs, tool inputs/results, reasoning, and unsupported content stay out of renderer state. Command, file, web, image, foreign dynamic-tool, foreign-MCP, unknown, approval-waiting, or an inline page that contradicts its same-response thread status quarantines the connection before it opens. Dynamic-bound threads accept only the seven reviewed namespaced tools as generic activity, while MCP-bound threads reject host calls. A separately fetched fallback page is later authority and safely absorbs buffered completion races.

The private thread registry tags each version 2 binding with its tool route. Version 1 entries are interpreted only as MCP, and an incompatible process route fails before resume. A dynamic thread projects no MCP calls; an MCP thread rejects host calls even if an internal invoker exists. Corrupt or unknown routes fail without replacing the registry. Product main selects host-defined tools for new conversations and retains MCP for existing bindings; both reach the same guarded active-project service. Packaged dynamic edit/Undo/reopen and separate v1 MCP read passed. Complete effective-tool confinement remains open.

A packaged native dynamic stale-draft turn also passed: the host tool returned an unsuccessful bounded response for an obsolete sequence/hash, while the authoritative draft, two journal entries, original, managed copy and baseline remained unchanged. Keep the safe error contract for this route and continue to distinguish a rejected owned call from proof that unrelated built-in tools are unavailable.

For the dynamic route, a host call received before the `turn/start` RPC response requires a validated `turn/started` notification naming the registry-owned thread and a single provisional turn. The response must agree with that turn; a call before notification, after buffered completion, or after contradiction cannot reach the guarded invoker. Notifications stay buffered until reconciliation. Unit tests exercise those races, and a direct isolated App Server run completed one owned read. A packaged dynamic negative-command probe observed no forbidden invocation in that exact turn; this does not prove full upstream tool confinement.

A packaged dynamic-route Luna/high inventory/split fixture observed exactly six owned and zero unowned nested code-mode tools in the tested turn. The same native test passed on synthetic and privately staged supplied footage with unchanged original/managed sources and baseline after shared Undo/reopen. Keep the private files, model answer and screenshots outside Git. One nested inventory and forbidden-command probe cannot establish complete upstream effective-tool confinement or child inheritance.

The current reviewed host/MCP surface has seven tools after adding `cut.delete_ranges`. Its input permits only 2–16 strict, disjoint time intervals in descending order and carries no source path, arbitrary operation, export or cleanup authority. A real packaged Luna/high turn applied the batch on synthetic and private supplied footage; source and baseline bytes remained unchanged after manual Undo and reopen. The earlier six-tool inventory is historical, and no complete upstream tool-confinement claim follows from the new batch run.

A separate fresh packaged Luna/high split turn on this seven-tool build observed exactly seven owned and zero unowned nested names in a bounded code-mode inventory, then passed guarded split, Undo and reopen. This establishes only that turn's nested inventory, not a complete permanent upstream or child tool policy.

## Secrets

Let the official Codex client own ChatGPT credentials. Do not copy tokens into project files, logs, crash reports, or renderer state. The MCP broker credential is inherited through the restricted process environment and never appears in command arguments, thread instructions, project data, or IPC.

OpenAI API, DeepSeek and Gemini API keys are separate secrets. Main owns input and redacted status; never return key bytes or authorization headers over renderer IPC or place them in project files, prompts, URLs, crash output, screenshots or public evidence. Use OS-backed per-user encryption for persistence; if unavailable, keep the key in session memory only or refuse persistence clearly. A remembered model choice is encrypted with its key, not written as a separate plaintext preference; legacy key ciphertext remains readable and gains a model only after selection. Recheck the remembered model against a live provider catalog before use, and clear it on key replacement/removal. Gemini function-call thought signatures stay bounded in main turn memory and must not enter renderer IPC, persisted conversation, logs or public evidence. A packaged Linux run with real GNOME Secret Service verified protected OpenAI key/model reopen, no plaintext key/model in the protected file, an empty renderer key field and explicit removal; this does not prove another OS backend or a paid turn. Key replacement and removal are explicit; removal interrupts a currently running turn for that provider. A tool already committed before interruption remains in the undo history. Native tests must cover endpoint pinning, key redaction, storage failure, logout/replacement, provider rejection and untrusted output.

The packaged synthetic provider test runs each supported API choice and replaces `fetch` only inside the isolated Electron main process after startup; no renderer API or user-configured endpoint can set that transport. Each run asserts its fixed destination, synthetic key redaction in conversation storage, guarded stale rejection and unchanged source/baseline through trim, undo and provider failure. This does not authorize an external paid call or prove a live model followed the tool protocol.

HTTP 429 is a fixed, redacted rate-or-quota condition; the provider body and request headers never enter renderer state or project history. The authenticated OpenAI packaged attempt observed only status 429 in private test evidence and committed no transaction. A synthetic native 429 check covers visible recovery and unchanged journal for both provider selections; the exact account-side rate or quota cause is unknown.

HTTP 401/403 during a generation turn is a separate fixed, redacted API-connection failure. Do not infer whether the key, account, model permission or provider policy caused it from status alone. The local conversation retains the user request but not the raw error, and the draft journal stays unchanged unless an earlier validated tool already committed. Synthetic native checks cover OpenAI and DeepSeek; the live fixture still requires a private authorized key for each provider.
## Inherited MCP and Apps boundary

Before App Server starts, main discovers configured MCP names with the pinned CLI's JSON list, bounds and validates the result, applies an explicit disabled override to each name, then verifies the complete inventory. It repeats exact status validation for the active thread before exposing Codex editing. An external server with tools or resources, a changed inventory, or a reserved-name collision fails closed. Thread start and resume explicitly disable Apps, plugins and remote plugins; packaged synthetic hostile-config testing verified the external server stayed disabled and the host-owned `codex_apps` service was absent for the exercised authenticated runtime. Empty `mcp_servers={}` alone is insufficient because Codex merges an empty table. This evidence is bounded to the tested runtime and fixture; it does not prove a complete upstream tool catalog.
