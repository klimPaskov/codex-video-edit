# Transcript and captions

## Transcription

- Run locally by default.
- Produce stable word IDs and integer microsecond times.
- Store model identity, language, confidence evidence, and raw result hash.
- Detect reversed, overlapping, negative, and out-of-range timing.
- Support explicit language choice and re-transcription.

## Transcript editing

- Clicking a word seeks the preview.
- Text correction changes caption text without changing audio.
- Deleting words creates linked media edits.
- Uncertain words are marked quietly.
- Search supports words and timestamps.

## Captions

- Generate phrase groups from word timing.
- Support plain, current-word highlight, and minimal subtitle styles.
- Control font, size, weight, line length, position, background, and safe area.
- Avoid covering active UI and camera faces when possible.
- Reflow after canvas or crop changes.
- Export SRT and WebVTT sidecars when requested.

## QA

Check order, bounds, readability, safe areas, line breaks, collisions, missing words, duplicate words, and synchronization after cuts and speed changes.

## Editorial instructions and coherence

Apply [47_EDITORIAL_FIRST_CUT.md](47_EDITORIAL_FIRST_CUT.md). Transcript processing reuses the actual job handle; request transcription once only when absent, and do not restart merely because an observation times out. Configured editor cues identify candidates, not unconditional commands. Inspect neighboring sentences and visuals, accept conservative variants, require opt-in legacy aliases, and retain quoted or ambiguous cues and affected content as unresolved items.

Use word-level timing and microphone silence as supporting evidence for semantic cuts within verified synchronized edit sets. Never cut an independent screen source merely because narration was removed. Preserve the final complete retake, unique setup and qualifications, meaningful pauses and protected material. Verify every resulting transcript/A/V join; perform a separate whole-source omission pass and a complete edited-transcript reread in scene order. Restore necessary wording when a join fragments a sentence or loses context. Resolved spoken directions may be cut only after their edits and joins are verified.

Do not polish transcript text to disguise an awkward recording edit. Text/caption correction remains distinct from audio cuts and never resynthesizes speech. Tests include quoted/phonetic false cues, ambiguous scope, incomplete final retakes, independent screen layers, retained demonstration pauses, full-reread omissions and successful restoration.
