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

Electron main owns the active project and the only draft writer. The packaged MCP child accepts only the four reviewed P2 tools and forwards bounded intent through a local broker authenticated by a random process-only credential. App-server startup verifies the exact server, tool names, and input schemas and refuses project threads on mismatch. The child cannot choose a project root, construct transaction authority, approve export/deletion/cleanup, or access a generic main RPC.

Renderer project frames are bound to the exact draft ID, baseline revision, sequence and timeline hash. Main alone maps output time to the immutable source, rechecks the head after decode, and returns no stale pixels. Source IDs, mapped source times and paths stay out of this project-frame request and response. Draft-change events contain only the validated path-free identity and timeline view.

The dedicated app-server process starts with fixed ChatGPT/OpenAI settings and disables web search, shell, unified execution, JavaScript, browser/computer use, apps, connectors, plugins, remote plugins, and image generation. Every turn supplies an empty environment set plus read-only/no-network sandbox policy. Command/file approval and MCP elicitation requests are denied and quarantine the connection. These controls constrain the integrated surface; authenticated model behavior still requires isolated negative tests.

Thread resume consumes at most one validated page of 100 newest full turns and 1,000 unique items. Main reverses that page for chronological display and exposes only up to 200 redacted user/Codex messages and 32 generic activities under fresh application IDs. Skill paths, cursors, raw server IDs, tool inputs/results, reasoning, and unsupported content stay out of renderer state. Command, file, web, image, dynamic-tool, foreign-MCP, unknown, approval-waiting, or an inline page that contradicts its same-response thread status quarantines the connection before it opens. A separately fetched fallback page is later authority and safely absorbs buffered completion races.

## Secrets

Let the official Codex client own ChatGPT credentials. Do not copy tokens into project files, logs, crash reports, or renderer state. The MCP broker credential is inherited through the restricted process environment and never appears in command arguments, thread instructions, project data, or IPC.

OpenAI API and DeepSeek keys are separate secrets. Main owns input and redacted status; never return key bytes or authorization headers over renderer IPC or place them in project files, prompts, URLs, crash output, screenshots or public evidence. Use OS-backed per-user encryption for persistence; if unavailable, keep the key in session memory only or refuse persistence clearly. A remembered model choice is encrypted with its key, not written as a separate plaintext preference; legacy key ciphertext remains readable and gains a model only after selection. Recheck the remembered model against a live provider catalog before use, and clear it on key replacement/removal. A packaged Linux run with real GNOME Secret Service verified protected OpenAI key/model reopen, no plaintext key/model in the protected file, an empty renderer key field and explicit removal; this does not prove another OS backend or a paid turn. Key replacement and removal are explicit; removal interrupts a currently running turn for that provider. A tool already committed before interruption remains in the undo history. Native tests must cover endpoint pinning, key redaction, storage failure, logout/replacement, provider rejection and untrusted output.

The packaged synthetic provider test replaces `fetch` only inside the isolated Electron main process after startup; no renderer API or user-configured endpoint can set that transport. It asserts the fixed destination, synthetic key redaction in conversation storage, guarded stale rejection and unchanged source/baseline through trim, undo and provider failure. This does not authorize an external paid call or prove a live model followed the tool protocol.
