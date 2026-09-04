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
