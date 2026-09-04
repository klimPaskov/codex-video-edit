# Magic Wand pipeline

## Goal

Magic Wand creates a useful first edit from recorded or imported media. It operates through visible, reversible draft transactions and keeps the original footage available.

## Inputs

- source manifests and proxies
- word-timed transcript
- silence evidence
- cursor and click telemetry when recorded
- visible frame samples
- selected preset
- optional user instruction
- camera, audio, caption, and canvas preferences
- indexed local asset descriptions

## Pipeline

### 1. Readiness

Verify source hashes, media decode, proxy availability, transcript bounds, free disk space, and current revision identity.

### 2. Structural analysis

Find scenes, takes, topic changes, screen states, long waits, typing ranges, visible interactions, and camera availability.

### 3. Cut analysis

Generate candidates for dead air, filler, false starts, abandoned phrases, immediate repetitions, failed takes, setup time, and obvious mistakes. Protect facts, names, numbers, negation, warnings, uncertainty, useful pauses, overlapping speech, and visual steps needed to follow the tutorial.

### 4. Visual focus

Generate zoom candidates only when a visible target is known. Prefer pointer telemetry and click regions. Confirm targets from preview frames. Omit low-confidence zooms.

### 5. Pacing

Generate speed candidates for silent typing, loading, and waiting. Keep normal speed around important actions and spoken explanation unless the user asks otherwise. Select an explicit audio mode.

### 6. Presentation

Create captions, cursor treatment, audio cleanup, camera layout, and local B-roll suggestions according to enabled switches. Do not add unrelated decoration.

### 7. Apply live

Order transactions so the base cut and time map are established before effects. Persist and announce each valid batch. Keep Stop and Undo available throughout.

### 8. Preview and verify

Render representative joins, zooms, speed boundaries, captions, layouts, and audio. Run machine checks and inspect motion through the native app.

## Presets

### Gentle

Remove clear failed material and excessive silence. Use few effects.

### Balanced

Use normal tutorial pacing, captions, purposeful focus, and conservative cleanup.

### Tight

Use stronger pause and filler cleanup while preserving complete meaning and readable UI actions.

### Custom

Use only the enabled switches and user thresholds.

## Completion summary

Show removed duration, restored or protected sections, cut count, zoom count, speed ranges, caption status, audio work, layout changes, B-roll suggestions, and unresolved warnings. Every category links to the affected timeline items.
