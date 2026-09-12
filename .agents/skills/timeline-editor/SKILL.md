---
name: timeline-editor
description: Implement the operation-based simple timeline, transcript edits, history, and revisions.
---

# Timeline editor

## Use when

Changing edit operations, timeline UI, snapping, undo, autosave, or revisions.

## Requirements

- canonical operation schema
- select, split, trim, ripple delete, restore, move, and supported reorder
- transcript-linked edits
- fixed semantic tracks
- direct on-canvas manipulation for spatial items
- shared manual and Codex history
- atomic transactions
- deterministic inverse or before state
- autosave journal and snapshot recovery
- immutable revisions

For the P2 transaction foundation, start with one strict canonical operation that can be
proved end to end before widening the reducer. Persist append-only transaction envelopes
with the prior sequence and timeline hash, the complete before/after state, a deterministic
inverse, origin injected by the trusted entrypoint, and a self/prior hash chain. Rebuild the
draft from the immutable baseline and committed journal on reopen. Stable request IDs are
idempotent only when their canonical requests match exactly; a reused ID with different
content is a conflict. A verification checkpoint is a separate hash-bound record for the
current pass and does not commit a revision or clear undo history.

Keep transaction and navigation writes on the same project-root serialization boundary.
Pending same-directory files may be ignored during recovery, while a corrupt committed
journal entry fails closed. Do not expose filesystem paths or let renderer or model input
supply a trusted edit origin.

## Validation

Test zero and final boundaries, overlapping operations, ripple mapping, speed mapping, zoom blocks, transcript restore, batch undo, crash replay, stale dependencies, and revision compare. The first bounded reducer must also test immutable source/baseline bytes, reopen replay, postcommit-unknown recovery, strict input rejection, stale-head concurrency, and checkpoint invalidation. Use Playwright Electron for pointer and keyboard flows once the transaction path changes native UI behavior.

## Simplicity rule

Do not add professional editor complexity unless a named requirement needs it.
