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
- explicit user initiation before paid provider generation and provider-specific context disclosure
- guarded tool permissions and transaction validation
- asset provenance
- cleanup and uninstall preservation

## Method

Build a threat list for each changed boundary. Add abuse and failure tests. Verify secrets and raw logs do not enter renderer state, project files, screenshots, or crash output.

For OpenAI API and DeepSeek, test that malformed keys and malicious model output cannot choose a URL, escape edit scope, invoke Codex/MCP privileges, or bypass draft sequence/hash checks. Treat a network model response as untrusted, not as an authorized tool call.

## Stop condition

Block the phase on unrestricted renderer privileges, source mutation, silent capture, token leakage, path escape, or unconfirmed deletion.
