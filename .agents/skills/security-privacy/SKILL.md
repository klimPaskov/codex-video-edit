---
name: security-privacy
description: Review Electron, files, capture, Codex, assets, and deletion boundaries.
---

# Security and privacy review

## Review areas

- packaged local renderer and CSP
- sandbox, context isolation, IPC sender validation
- path canonicalization and project root limits
- source immutability and atomic writes
- screen, camera, microphone, system audio, and pointer consent
- no keystroke capture
- Codex minimum-context disclosure
- credential ownership by official Codex client
- separate API-provider key entry, fixed HTTPS destinations, OS-backed protected persistence or session-only fallback, key replacement/removal, and no key exposure in renderer or project data
- encrypted remembered-model selection bound to its key; legacy key-only migration, live revalidation, replacement clearing and no plaintext model preference
- explicit user initiation before paid provider generation and provider-specific context disclosure
- guarded tool permissions and transaction validation
- asset provenance
- cleanup and uninstall preservation

## Method

Build a threat list for each changed boundary. Add abuse and failure tests. Verify secrets and raw logs do not enter renderer state, project files, screenshots, or crash output.

For OpenAI API, DeepSeek and Gemini API, test that malformed keys and malicious model output cannot choose a URL, escape edit scope, invoke Codex/MCP privileges, or bypass draft sequence/hash checks. Gemini function-call thought signatures are bounded opaque turn-local metadata in main; reject foreign/malformed metadata and never persist or expose a signature. Treat a network model response as untrusted, not as an authorized tool call.

For native remembered-key evidence, require packaged Electron, a real secure OS backend (the isolated Linux GNOME Secret Service path uses `gnome_libsecret`), private input and protected-file permissions, live model revalidation after restart, no key in renderer state or plaintext protected bytes, and explicit removal. Keep the credential and screenshots outside Git. This one backend does not establish Windows/macOS keyring behavior or paid provider editing.

For synthetic native turns for all three API providers, inject only into the isolated main process and reject every URL outside the selected fixed reviewed provider routes. Assert source/baseline preservation, stale rejection, shared undo and key/raw-response redaction in persisted conversation. For Gemini 3, assert exact thought-signature replay with matching tool results and no signature in persisted state. Do not treat synthetic model output as an authenticated provider edit or permit renderer-supplied transport overrides.

Map provider 429 to fixed rate-or-quota recovery text without persisting raw response bodies, headers, account data or credentials. A live-key test may keep status codes only in ignored private evidence; delete any transferred mode-600 key file before launching Electron. Never publish the live project, screenshot or test transcript.

Map provider 401/403 on a started turn to separate fixed API-connection recovery text; do not infer a particular account, key or model-access cause. Keep the failed request in the local thread, but no raw response, credential or fictitious edit. Synthetic native assertions must check both renderer projection and unchanged journal for each provider.

## Stop condition

Block the phase on unrestricted renderer privileges, source mutation, silent capture, token leakage, path escape, or unconfirmed deletion.

For Codex 0.155.1 Luna code mode, App Server launch, thread create and resume must disable app defaults, the supported plan and user-input tools, and native agents while excluding unrelated code-mode namespaces. The matching packaged `codex-code-mode-host` is required and hash-checked. Disable native child agents while effective inherited tool confinement remains unproven; never spawn Astra agents. Test the visible tool surface in a real bounded turn, but do not generalize one successful probe into a permanent allowlist guarantee. Treat a lost Codex connection as a failed run, preserving only redacted private evidence.

If evaluating App Server host-defined dynamic tools as an MCP-free boundary, bind every `item/tool/call` to the active trusted thread and turn, exact bare tool name, reviewed schema and main-owned project before reaching the existing transaction service. Validate the bounded response and never echo raw arguments or rollout content into renderer state. A direct owned-only code-mode inventory without MCP is only a single-turn observation; production migration must retain old project threads and pass packaged native edit, Undo, reopen and forbidden-tool tests.
