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
- guarded tool permissions and transaction validation
- asset provenance
- cleanup and uninstall preservation

## Method

Build a threat list for each changed boundary. Add abuse and failure tests. Verify secrets and raw logs do not enter renderer state, project files, screenshots, or crash output.

## Stop condition

Block the phase on unrestricted renderer privileges, source mutation, silent capture, token leakage, path escape, or unconfirmed deletion.
