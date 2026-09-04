---
name: magic-edit
description: Build useful non-destructive Magic Wand drafts and focused automations.
---

# Magic Edit

## Use when

Changing automatic cuts, captions, audio cleanup, layout, pacing, or Magic Wand UX.

## Procedure

1. Read source, transcript, silence, scene, pointer, and visual evidence.
2. Generate candidate operations with reason and confidence.
3. Protect meaning-critical and uncertain material.
4. Apply only policy-allowed operations to the active draft.
5. Stream operations as atomic transactions.
6. Keep Stop, Undo, and source fallback available.
7. Render short boundary previews.
8. Re-transcribe and inspect risky joins.
9. Summarize concrete changes.

## Quality rule

The goal is a useful edit, not maximum change. Do not add random effects or shorten content without evidence.

## Presets

Gentle, Balanced, Tight, and Custom. The exact thresholds belong in versioned policy files and tests.
