# P5: transcription, raw cut, and Magic Wand

Task IDs: `P5-01` through `P5-06`

Use `magic-edit`, `media-engine`, `codex-app-server`, `native-app-testing`, and `spec-sync`. Implement local word-timed transcription, independent silence evidence, transcript correction, protected speech, candidate generation, presets, live draft transactions, readable summaries, stop, undo, and recovery.

Magic Wand must create a real useful edit. Apply the base cut and time map before dependent effects. Preserve uncertain meaning and use original footage as fallback.

Acceptance:

- fixtures cover silence, filler, false starts, repetitions, failed takes, names, numbers, negation, and uncertainty
- Balanced Magic Wand improves a fixture without altering source bytes
- draft changes appear live in the native timeline and shared history
- interruption and whole-run undo work
- `.astra/results/P5.json` validates
