---
name: audio-caption
description: Implement speech-first audio cleanup and readable word-timed captions.
---

# Audio and captions

## Audio

Keep microphone, system audio, and music separate where possible. Support safe noise cleanup, gain, fades, loudness normalization, limiter, and speech-priority ducking. Preserve source as fallback.

## Captions

Use stable word timing, editable text, phrase grouping, safe areas, line limits, style presets, and SRT or WebVTT sidecars. Reflow after canvas and crop changes.

## Validation

Check loudness, clipping, dropouts, A/V drift, join clicks, music balance, caption bounds, duplicates, missing words, line breaks, contrast, and collisions.

## UI rule

Expose simple controls first. Put technical filter and typography values under Advanced.
