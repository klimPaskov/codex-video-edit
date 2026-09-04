---
name: automatic-zoom
description: Plan, render, adjust, and validate purposeful zoom and speed effects.
---

# Automatic zoom and pacing

## Use when

Changing zoom candidates, cursor focus, speed segments, reframing, or their editor controls.

## Zoom evidence

Prefer click and pointer telemetry. Use scene markers and visible UI changes next. Use sampled-frame Codex analysis for context, not as sole geometric proof when confidence is low.

## Zoom rules

- visible target
- padded bounds
- stable centering
- smooth easing
- relevant start and end
- no overlap or pumping
- original wide view fallback
- direct target rectangle editing

## Speed rules

- safe typing, loading, waiting, and repetitive action ranges
- protect important speech and dense UI changes
- exact source and output mapping
- pitch-safe audio mode
- direct block and multiplier editing

## QA

Render proof frames and short previews. Check purpose, target, edges, text readability, motion, range, frequency, duration, A/V sync, and speech continuity.
