# P3: projects, import, media model, and preview

Task IDs: `P3-01` through `P3-06`

Use `media-engine`, `timeline-editor`, `native-app-testing`, and `spec-sync`. Implement project storage, locks, autosave, recovery, immutable source ingest, hashing, ffprobe normalization, edit proxies, audio proxies, thumbnails, waveforms, and the canonical microsecond timeline. Build representative preview playback and recent-project operations.

Import through the native file picker. Reject source mutation and recover from interruption. Keep destructive project actions deliberate and separate from source files.

The partial source still-frame seek index sorts verified presentation PTS from packet decode order and handles variable-cadence gaps. Complete P3-04 by defining the final-frame boundary and source-to-output mapping for the canonical microsecond timeline; do not infer timing from nominal or average frame rate, and do not feed display pixels into the master.

A further partial P3-04 slice measures the last packet duration, persists two ordered compatible sources as adjacent clips, maps a seek into the correct immutable source, and reflows the second clip under the shared trim/undo journal. The native Add footage action creates a new two-source project from an unedited first project and a newly imported second source. This is not complete P3-04 acceptance: synchronized A/V playback, mixed-format policy, broader source counts, canonical render and full fixture matrix remain required.

Acceptance:

- valid, corrupt, missing-audio, variable-frame-rate, and duplicate fixtures are covered
- imported project reopens with identical timeline and preview timing
- source hashes remain unchanged
- native import and reopen flow is inspected
- `docs/workflow/results/P3.json` validates

Use `lossless-media` and `docs/44_LOSSLESS_MEDIA_POLICY.md`. Validate the sample boundary, not only successful decode. Never feed preview or transcription proxies to master output. Publish reviewed working changes under `docs/45_OPEN_SOURCE_DEVELOPMENT.md`.
