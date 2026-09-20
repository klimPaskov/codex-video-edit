# P6: simple editor

Task IDs: `P6-01` through `P6-06`

Use `timeline-editor`, `simple-desktop-ui`, `codex-app-server`, `native-app-testing`, and `spec-sync`. Implement selection, split, trim, ripple delete, restore, supported move and reorder, snapping, transcript edits, direct preview handles, fixed semantic tracks, one inspector, undo, redo, autosave, revisions, compare, and recovery. Manual and Codex commands must use one domain command layer and one history.

The current P2 dependency slice exposes playhead trim, playhead split and newest Undo in Edit through that shared journal. Split fragments preserve ordered immutable source intervals and preview mapping. P6 acceptance still requires the selection, transcript, range, history, revision and recovery tools above; the partial native controls do not complete this phase.

Do not build an unrestricted professional NLE. Hide empty tracks and inactive panels.

Acceptance:

- mouse, keyboard, transcript, canvas, and history tests pass
- the user can correct the Magic Wand draft completely inside the app
- a Codex request can alter the current selection live and be undone
- revision compare and crash recovery pass
- `docs/workflow/results/P6.json` validates

Use `reference-fidelity`. Read current full-page references and `docs/references/IMPLEMENTATION_NOTES.md`. Remove debug badges, persistent readiness, duplicate headings, and excessive explanations. Default to one relevant panel. Keep working capture indicators, errors, and accessible controls.
