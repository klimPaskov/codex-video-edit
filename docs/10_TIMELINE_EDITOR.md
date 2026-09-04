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

## Preview

Preview must match the timeline within declared tolerances. Proxy playback may use lower quality, but timing, crop, layout, and text placement must remain representative.
