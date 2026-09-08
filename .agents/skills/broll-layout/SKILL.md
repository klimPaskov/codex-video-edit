---
name: broll-layout
description: Implement local B-roll, camera layouts, elements, canvas formats, and provenance.
---

# B-roll and layout

## Use when

Changing asset import, search, placement, camera layout, canvas, text, image, or transition behavior.

## Requirements

- local asset index with hashes and declared provenance
- search by metadata and transcript context
- Codex suggestion with reason and exact range
- source-shot fallback
- trim, move, crop, fit, fill, replace, and remove
- camera layout presets and direct resize
- common canvas ratios
- caption and active UI collision avoidance
- missing asset relink

## Licence rule

Do not infer a licence from a filename or website. Exclude unresolved assets from final export.

## Testing

Use fixtures for landscape, portrait, transparent images, short B-roll, missing assets, repeated use, crop boundaries, and vertical canvas.

## Editorial layout and graphics extension

Read `docs/47_EDITORIAL_FIRST_CUT.md`. Reuse approved layout properties; default inset placement must yield to meaningful screen/caption visibility. Use a few purposeful camera-led/screen-led sections, returning the camera after temporary screen-only framing, and verify boundaries/midpoint in composed and raw-source context.

A graphics opportunity is suggestion-only: final-cut interval, concept, benefit and complete generator-neutral prompt with proposed 1920×1080 asset size, rate/duration, no audio, grounded wording/reveal order, style/motion, safe margins and optional transparency. Re-map after timing edits. Never create, render, import or place graphics without a separate explicit asset request; a recorded cue is insufficient. Keep these proposals distinct from permitted local B-roll and preserve project/master dimensions and precision. Test unauthorized asset side effects, invented claims, timing drift and incomplete prompts.
