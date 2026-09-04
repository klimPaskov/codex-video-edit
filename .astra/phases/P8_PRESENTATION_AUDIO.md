# P8: captions, layouts, B-roll, elements, and audio

Task IDs: `P8-01` through `P8-07`

Use `audio-caption`, `broll-layout`, `media-engine`, `native-app-testing`, and `spec-sync`. Implement caption correction and styling, screen and camera layouts, text, images, shapes, simple transitions, local asset indexing, local B-roll suggestions and placement, noise cleanup, loudness, fades, music, ducking, and relink recovery.

Only licence-verified local assets may enter a final render. Keep source footage as fallback.

Acceptance:

- captions pass timing and safe-area checks
- camera layouts work across required canvases
- a local B-roll and music fixture is found, approved, rendered, and audited
- speech remains clear and unclipped
- missing assets recover through relink
- `.astra/results/P8.json` validates

Use `lossless-media` and `docs/44_LOSSLESS_MEDIA_POLICY.md`. Validate the sample boundary, not only successful decode. Never feed preview or transcription proxies to master output. Publish reviewed working changes under `docs/45_OPEN_SOURCE_DEVELOPMENT.md`.
