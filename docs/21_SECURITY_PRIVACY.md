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

## Codex data boundary

- Explain that selected text, metadata, frames, and instructions may be sent to Codex.
- Send the minimum context needed for the task.
- Keep raw media local by default.
- Show when a frame or transcript excerpt is being shared.
- Let the user sign out and use the manual editor without AI.

## Runtime tools

Codex receives guarded codex-video-edit tools, not unrestricted filesystem or shell control. Tool calls validate project, draft, range, asset, and transaction identity.

Electron main owns the active project and the only draft writer. The packaged MCP child accepts only the four reviewed P2 tools and forwards bounded intent through a local broker authenticated by a random process-only credential. App-server startup verifies the exact server, tool names, and input schemas and refuses project threads on mismatch. The child cannot choose a project root, construct transaction authority, approve export/deletion/cleanup, or access a generic main RPC.

Renderer project frames are bound to the exact draft ID, baseline revision, sequence and timeline hash. Main alone maps output time to the immutable source, rechecks the head after decode, and returns no stale pixels. Source IDs, mapped source times and paths stay out of this project-frame request and response. Draft-change events contain only the validated path-free identity and timeline view.

The dedicated app-server process starts with fixed ChatGPT/OpenAI settings and disables web search, shell, unified execution, JavaScript, browser/computer use, apps, connectors, plugins, remote plugins, and image generation. Every turn supplies an empty environment set plus read-only/no-network sandbox policy. Command/file approval and MCP elicitation requests are denied and quarantine the connection. These controls constrain the integrated surface; authenticated model behavior still requires isolated negative tests.

## Secrets

Let the official Codex client own ChatGPT credentials. Do not copy tokens into project files, logs, crash reports, or renderer state. The MCP broker credential is inherited through the restricted process environment and never appears in command arguments, thread instructions, project data, or IPC.
