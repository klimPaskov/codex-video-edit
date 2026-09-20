# Simple timeline editor

## Model

The timeline is non-destructive and operation-based. Media time uses integer microseconds. Display frames use rational frame-rate conversion with tested rounding.

## Required tools

- select clip or range
- split at playhead
- trim left or right edge
- ripple delete selection
- restore deleted range
- move supported clips
- change clip order inside supported scene groups
- snap to playhead, cuts, transcript words, clicks, scene boundaries, and markers
- undo and redo

## Fixed tracks

1. Main video
2. Camera
3. Production audio and system audio
4. B-roll and image overlays
5. Text and captions
6. Effects markers for zoom and speed

Do not expose arbitrary track creation in the first release. Empty tracks stay hidden.

## Transcript edit

Deleting transcript text creates a linked cut operation. Restoring text restores the linked media when no later operation conflicts. Highlight uncertain words and prevent accidental deletion without review.

## Direct manipulation

- Drag cut edges.
- Drag zoom and speed blocks.
- Select a zoom to show target handles in the preview.
- Select camera or B-roll to move and resize it on canvas.
- Keep numeric controls available in the inspector for precision.

## History

Manual actions and Codex actions share one ordered history. Each item shows origin, short reason, affected time, and Undo. Batch operations can be expanded.

P2's shared foundation implements strict start/end trimming for one or two ordered clips. It maps the requested timeline boundary back to source time, reflows following clips, appends a generated operation to the canonical timeline, and persists exact before/after and inverse state in the common hash-chained journal. The Edit stage now exposes playhead-based Trim start, Trim end and Undo for the current clip through trusted manual IPC. Codex and API-provider edits use the same reducer and undo history; Magic Wand must join it later. Remaining tools, broader clip movement and complete multi-track ripple semantics remain P3/P6 work.

## Preview

Preview must match the timeline within declared tolerances. Proxy playback may use lower quality, but timing, crop, layout, and text placement must remain representative.
