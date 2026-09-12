# P10: user example video acceptance

Task IDs: `P10-01` through `P10-07`

Use all relevant product skills, `native-app-testing`, and `spec-sync`. Import both supplied example videos through the native UI and append the second after the first in one editable sequence while preserving both immutable sources. Run Balanced Magic Wand with real Codex. Observe live operations. Review the entire draft and the source join, fix defects with manual tools and natural-language edits, save a revision, run QA, export, fully decode, and watch the final file.

Do not substitute generated media, a web preview, or a CLI-only run. Preserve private media outside source control.

Acceptance:

- every checklist item in `docs/checklists/EXAMPLE_VIDEO_CHECKLIST.md` is addressed
- screenshots and a short native app recording exist
- both source hashes, append order, timeline, QA, revision, and export hashes are recorded
- final defects and known limits are stated plainly
- all affected specs and references are synchronized
- `docs/workflow/results/P10.json` validates

Use `lossless-media` and `docs/44_LOSSLESS_MEDIA_POLICY.md`. Validate the sample boundary, not only successful decode. Never feed preview or transcription proxies to master output. Publish reviewed working changes under `docs/45_OPEN_SOURCE_DEVELOPMENT.md`.
