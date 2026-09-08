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

## Validation

Test zero and final boundaries, overlapping operations, ripple mapping, speed mapping, zoom blocks, transcript restore, batch undo, crash replay, stale dependencies, and revision compare. Use Playwright Electron for pointer and keyboard flows.

## Simplicity rule

Do not add professional editor complexity unless a named requirement needs it.
