# Traceability

P0 foundation scope and synchronization audit: [46_P0_FOUNDATION.md](46_P0_FOUNDATION.md). Rows describe required checks unless supported by actual execution evidence; they are not task completion claims.

| Requirement | Main spec | Tasks | Main tests |
| --- | --- | --- | --- |
| Native standalone window | 03, 04 | P1 | Playwright Electron launch, computer-use review |
| Persistent interface scale, settings modal and source focus | 04, 05; schemas/desktop_preferences.schema.json; schemas/desktop_ipc.schema.json; matching examples/desktop_preferences.example.json and examples/desktop_ipc.example.json | P1-03, P1-05, P1-06 | Strict preference/IPC and persistence tests; actual packaged modal save/cancel/Escape, Ctrl+,, one-inspector restoration and source/Back focus tests at supported sizes/scales; bounded native inspection passed; full P1 incomplete |
| Real Codex only | 08 | P2 | auth, model, skill, thread, live edit smoke |
| Project import and immutability | 07, 17 | P3 | hash, reopen, recovery, mutation tests |
| Screen, audio, camera recording | 06 | P4 | virtual-device sync and recovery |
| Magic Wand raw edit | 09 | P5 | meaning, undo, interruption, media QA |
| Manual simple editor | 10 | P6 | pointer, keyboard, history, revision tests |
| Automatic and manual zoom | 11 | P7 | target, edge, motion, adjustment tests |
| Speed-ups and pitch | 12, 15 | P7 | boundary, duration, pitch, A/V tests |
| Captions | 13 | P8 | timing, safe area, sidecar tests |
| B-roll and layouts | 14 | P8 | provenance, crop, fallback, render tests |
| Audio cleanup | 15 | P8 | loudness, clipping, sync, ducking tests |
| Export and verification | 18, 19 | P9 | render, decode, hash, manifest tests |
| Native isolated testing | 20; tests/desktop/README.md | P0-04 infrastructure; all product phases | Docker isolation validation, sandboxed Electron/Playwright probe and native viewer input evidence establish infrastructure; product phase screenshots, recordings and audio review remain required |
| Screenshot update process | 26 | P10 and changes | manifest and visual regression checks |
| Cross-file sync | CHANGE_CONTROL | all | spec-sync report |
| Reproducible repository foundation | 46; research/P0_FOUNDATION.md | P0-01 through P0-05 | Strict type, lint, format, unit, schema/example and phase-result-writer checks |
| Synthetic lossless boundary | 44, 46 | P0-06, P0-08 | Raw canonical no-op and edited-frame/audio encode/decode equality; unsupported-format and proxy-isolation rejection |
| Actual native media bootstrap prerequisite | 03, 05, 46; ADR 0012 | P0-04, P0-06 | Packaged product security/IPC checks; native synthetic import, immutable source hashes, library reopen, frame equality/seek and explicit unsupported-preview tests; Playwright Electron and computer-use product evidence |
| Safe source publication | 45, 46 | P0-07 | Staged path/content review, public-source audit, exact verified remote commit and CI |

| Requirement | Specification | Implementation tasks | Required proof |
|---|---|---|---|
| Lossless default and explicit smaller modes | docs/44_LOSSLESS_MEDIA_POLICY.md | P0-08, P3-03, P4-03, P9-03, P10-05 | Canonical sample comparison and proxy isolation |
| Public implementation | docs/45_OPEN_SOURCE_DEVELOPMENT.md | P0-07 and every working slice | Verified remote commits and public CI |
| Individual native UI references | references/manifest.json and IMPLEMENTATION_NOTES.md | P1-04, P1-06, P6-03 | Real native screenshots and interaction checks |

| Five-stage navigation and authorized live draft editing | 02, 04, 05, 08, 30, 46; ADR 0003 | P0-05, P1-03, P2-05 | tests/foundation/test_workflow_contracts.py contract checks; native stage persistence and authenticated live-edit checks remain required |
