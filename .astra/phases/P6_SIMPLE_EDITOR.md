# P6: simple editor

Task IDs: `P6-01` through `P6-06`

Use `timeline-editor`, `simple-desktop-ui`, `codex-app-server`, `native-app-testing`, and `spec-sync`. Implement selection, split, trim, ripple delete, restore, supported move and reorder, snapping, transcript edits, direct preview handles, fixed semantic tracks, one inspector, undo, redo, autosave, revisions, compare, and recovery. Manual and Codex commands must use one domain command layer and one history.

Do not build an unrestricted professional NLE. Hide empty tracks and inactive panels.

Acceptance:

- mouse, keyboard, transcript, canvas, and history tests pass
- the user can correct the Magic Wand draft completely inside the app
- a Codex request can alter the current selection live and be undone
- revision compare and crash recovery pass
- `.astra/results/P6.json` validates

Use `reference-fidelity`. Read current full-page references and `references/IMPLEMENTATION_NOTES.md`. Remove debug badges, persistent readiness, duplicate headings, and excessive explanations. Default to one relevant panel. Keep working capture indicators, errors, and accessible controls.
