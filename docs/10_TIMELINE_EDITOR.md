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

P2's shared foundation implements strict start/end trimming, interior splitting and a marked ripple range cut for one or two ordered immutable sources. It maps requested output-timeline boundaries back to source time, reflows following fragments after a trim or cut, inserts a boundary without changing duration after a split, and persists exact before/after and inverse state in the common hash-chained journal. A split retains the left fragment's ID and derives the right fragment's ID from the trusted operation; a cut retains surviving spans and derives a right fragment ID when it cuts the middle of one. Both preserve source order and are bounded to 4096 fragments. A cut uses a nonempty, non-whole-draft half-open `[in, out)` interval; it may cross fragment/source joins or remove a source's complete visible span without deleting that source from the immutable inventory. The Edit stage exposes playhead-based Trim start, Trim end, Split, Mark in/out, Cut range, Clear and newest Undo through trusted manual IPC. Marks are tied to the current committed head and invalidated when it changes. Codex and API-provider edits use the same reducer and undo history; Magic Wand must join it later. General range selection, restore beyond newest Undo, move, redo, broader clip movement and complete multi-track A/V ripple semantics remain P3/P6 work.

## Preview

Preview must match the timeline within declared tolerances. Proxy playback may use lower quality, but timing, crop, layout, and text placement must remain representative.
