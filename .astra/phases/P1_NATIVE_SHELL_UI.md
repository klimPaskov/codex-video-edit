# P1: secure native shell and simple UI

Task IDs: `P1-01` through `P1-06`

Use `native-electron`, `simple-desktop-ui`, `native-app-testing`, `security-privacy`, and `spec-sync`. Build the real Electron shell with packaged local content, sandboxing, context isolation, restrictive CSP, navigation blocking, sender validation, and a small typed preload API. Implement Home and the step-based project shell. Show one primary action and one panel. Keep diagnostics hidden.

Launch the actual Electron app in the isolated desktop environment. Use Playwright Electron for repeatable assertions and computer use for visible inspection at supported sizes and scaling.

Acceptance:

- app opens in its own native window
- no localhost product UI or normal browser tab is used
- Home and step shell match the simple UI rules
- keyboard and accessibility basics pass
- native screenshots and inspection notes exist
- `.astra/results/P1.json` validates

Use `reference-fidelity`. Read current full-page references and `references/IMPLEMENTATION_NOTES.md`. Remove debug badges, persistent readiness, duplicate headings, and excessive explanations. Default to one relevant panel. Keep working capture indicators, errors, and accessible controls.
