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

## Secrets

Let the official Codex client own ChatGPT credentials. Do not copy tokens into project files, logs, crash reports, or renderer state.
