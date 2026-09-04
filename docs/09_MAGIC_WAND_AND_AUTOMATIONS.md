# Magic Wand and automation specification

## Purpose

Magic Wand produces a useful first edit and offers focused one-click improvements later. It is not a decorative button and it must not hide unreviewable changes.

## Entry points

### Full Magic Edit

Available after import or recording. Default preset: Balanced.

Options:

- Clean cuts
- Captions
- Automatic zooms
- Safe speed-ups
- Audio cleanup
- Camera layout
- Cursor treatment
- Local B-roll suggestions

### Selection Magic Wand

Available in Review for the selected time range. Actions include:

- Tighten section
- Remove pause
- Improve audio
- Add zoom
- Add captions
- Suggest B-roll
- Reframe for canvas

## Operation model

Every automation emits versioned draft operations. Each operation records source evidence, intent, confidence, affected range, before state, after state, origin, and undo payload.

## Cut policy

Automatically apply only high-confidence, low-risk edits under the chosen preset. Protect names, numbers, negation, qualifications, warnings, useful pauses, uncertain words, overlapping speakers, and visible UI steps that must remain understandable.

## Live behavior

- Stream concise progress.
- Apply valid transactions to the draft as they finish.
- Keep playback usable when safe.
- Allow Stop.
- Show a compact summary such as “Removed 28 seconds, added 6 zooms, created captions.”
- Let the user review every class of change from the history filter.

## Presets

- Gentle: remove only clear dead air and failed takes.
- Balanced: normal tutorial pacing.
- Tight: stronger filler and pause cleanup, still protects meaning.
- Custom: user-selected switches and thresholds.

## Failure and uncertainty

Use the original material as fallback. Do not insert random zooms, unrelated B-roll, or speech speed-ups to make the output appear more edited.
