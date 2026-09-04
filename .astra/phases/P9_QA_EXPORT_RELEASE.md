# P9: review, QA, export, and installer

Task IDs: `P9-01` through `P9-06`

Use `media-engine`, `native-app-testing`, `security-privacy`, `release-packaging`, and `spec-sync`. Implement review flags, revision history, final watch-through state, complete project QA, default lossless master export with an optional compressed MP4 profile, caption sidecars, full decode verification, output hashes, Windows installer, uninstall, update plan, and release hardening.

Do not show export success before exact output bytes pass validation. Export always requires a user action.

Acceptance:

- blocking QA prevents export
- output fully decodes and matches the manifest
- installer works in a clean supported Windows environment
- security, privacy, accessibility, recovery, and performance checks pass
- `.astra/results/P9.json` validates

Use `lossless-media` and `docs/44_LOSSLESS_MEDIA_POLICY.md`. Validate the sample boundary, not only successful decode. Never feed preview or transcription proxies to master output. Publish reviewed working changes under `docs/45_OPEN_SOURCE_DEVELOPMENT.md`.
