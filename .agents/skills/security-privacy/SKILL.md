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

For OpenAI API and DeepSeek, test that malformed keys and malicious model output cannot choose a URL, escape edit scope, invoke Codex/MCP privileges, or bypass draft sequence/hash checks. Treat a network model response as untrusted, not as an authorized tool call.

For native remembered-key evidence, require packaged Electron, a real secure OS backend (the isolated Linux GNOME Secret Service path uses `gnome_libsecret`), private input and protected-file permissions, live model revalidation after restart, no key in renderer state or plaintext protected bytes, and explicit removal. Keep the credential and screenshots outside Git. This one backend does not establish Windows/macOS keyring behavior or paid provider editing.

## Stop condition

Block the phase on unrestricted renderer privileges, source mutation, silent capture, token leakage, path escape, or unconfirmed deletion.
