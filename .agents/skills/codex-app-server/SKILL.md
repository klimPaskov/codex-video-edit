---
name: codex-app-server
description: Integrate real Codex app-server, ChatGPT auth, models, skills, threads, and guarded editing tools.
---

# Codex app-server integration

## Use when

Changing AI login, model selection, skills, threads, streaming, interruption, approvals, or media-edit tools.

## Requirements

- Official Codex app-server only.
- Stdio JSONL transport.
- Initialize handshake before other requests.
- Generate protocol types from the pinned binary.
- ChatGPT-managed login in the first release.
- Runtime `model/list` and `skills/list` discovery.
- Durable project thread and turn streaming.
- Safe restart, resume, interrupt, and rate-limit handling.
- Explicit skill input items when a known skill is used.
- Guarded codex-video-edit MCP tools with validated transactions.

## Runtime boundary

Codex receives project context and edit tools. It does not receive unrestricted access to the installation, source repository, raw source mutation, project deletion, or export confirmation.

## Validation

- fake transport unit tests
- protocol compatibility tests
- real authenticated smoke test when access exists
- verify a Codex edit changes only the active draft
- verify stop, undo, reconnect, stale transaction, and rate-limit behavior

## Never

Simulate successful Codex output in a production path or hardcode one current model name as the catalog.

## Authorized live operations

Apply authorized reversible active-draft transactions during the turn without repeated material-change confirmation. Magic Wand, Codex and manual edits share undo history. Export preparation may stage settings without confirmation but cannot start final export. Keep source deletion, cleanup, spending, publication and final export under explicit user action; handle native server approvals separately. Test both authorization and forbidden-effect boundaries.
