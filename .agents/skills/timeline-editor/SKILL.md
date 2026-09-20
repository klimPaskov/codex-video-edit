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

For the partial two-source baseline, preserve the two ordered clip/source identities and
half-open contiguous timeline intervals. A trim on the first clip must reflow the second
through the same transaction and undo journal. Do not mutate either immutable source or
the baseline, and do not treat this still-frame map as synchronized A/V playback or export.

The first native Edit controls use exact head-bound manual trim and newest undo through
the same store as Codex. Main injects the manual origin and operation identity; renderer
input carries only bounded intent. Return the committed clip map with every draft refresh
so an assistant edit cannot leave the next manual target stale. Disable trims at clip
boundaries and keep failure/uncertain outcomes truthful.

For the partial split tool, require an interior playhead position on the currently
committed fragment. Keep its left ID and derive the new right ID from the trusted
operation rather than renderer input. Preserve half-open timeline/source intervals,
source order, total duration and the immutable baseline. Bound the fragment count,
store the exact inverse in the shared journal, and refresh the committed fragment map
before another manual or assistant edit. Split must be undoable and replay identically
after reopen; it is not a ripple delete or an audio/video render.

Expose the same split reducer to the guarded Codex and fixed API-provider adapters only with exact draft-head freshness, current clip ID, interior output time, pass group and reason. Main supplies origin and journal IDs; the AI tool must return committed state and refresh the native fragment projection. Without transcript or audio evidence, the call can honor an exact requested split but cannot infer a meaningful speech boundary.

For the partial marked range cut, bind both marks to the current committed head and
send only a strict `projects:manual-range-cut` output interval. Reject empty, reversed,
out-of-bounds and whole-draft intervals. The half-open interval may cross fragment or
source joins and may remove one source's complete visible span. Keep the immutable
source inventory and baseline, reflow surviving fragment positions, derive any new
right fragment ID from trusted operation authority, and store an exact inverse in the
shared durable journal. Refresh preview and tool targeting from the committed map;
newest Undo must restore the previous map after reopen. Do not call this a general
transcript cut, synchronized A/V render, or model-visible Codex tool.

## Validation

Test zero and final boundaries, overlapping operations, ripple mapping, speed mapping, zoom blocks, transcript restore, batch undo, crash replay, stale dependencies, and revision compare. The first bounded reducer must also test immutable source/baseline bytes, reopen replay, postcommit-unknown recovery, strict input rejection, stale-head concurrency, and checkpoint invalidation. For split, test exact interior/boundary behavior, fragment IDs/order/limits, seek equivalence on both sides, trim-after-split, undo and replay. Use Playwright Electron for pointer and keyboard flows once the transaction path changes native UI behavior.

## Simplicity rule

Do not add professional editor complexity unless a named requirement needs it.
