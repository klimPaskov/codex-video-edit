# Quality assurance and acceptance

## Automated groups

### Media

- source and output decode
- expected streams and codecs
- duration and frame count
- missing media
- corrupt or empty frames

### Timing

- source-to-output mapping
- cut bounds and overlaps
- speed-segment duration
- audio and video drift
- caption timing

### Audio

- loudness
- peak and clipping
- silence and dropouts
- joins
- speech and music balance

### Visual

- black and frozen frames
- unexpected blank canvas
- zoom target and edge coverage
- camera and B-roll crop
- caption safe area
- text and overlay collision
- transition completeness

### AI and provenance

- real Codex event and model identity
- operation transaction integrity
- current skill and input hashes
- asset provenance
- stale draft or revision dependencies

## Human visual review

Computer use must inspect the real native app and rendered media. Review at least:

- first launch and onboarding
- record or import path
- Magic Wand progress and live changes
- editor direct manipulation
- Codex natural-language edit
- QA warning jump
- export and final playback

## User example acceptance

The user-provided example video is the final end-to-end fixture. Save:

- source hash
- Magic Wand configuration
- operation summary
- before and after duration
- screenshots of key app states
- review notes and repairs
- final lossless master hash and canonical-sample equality report
- full decode result
- known limits

Do not claim subjective improvement without showing the concrete edits and inspection basis.

## Fidelity acceptance

Apply the tests in `docs/44_LOSSLESS_MEDIA_POLICY.md`. Full decode alone cannot certify a lossless pipeline. Require decoded sample equality against the correct canonical boundary, source immutability, sample-format and colour checks, and proof that preview proxies cannot feed the master. Keep these detailed checks out of the normal user interface.
