# Traceability

P0 foundation scope and synchronization audit: [46_P0_FOUNDATION.md](46_P0_FOUNDATION.md). Rows describe required checks unless supported by actual execution evidence; they are not task completion claims.

| Requirement | Main spec | Tasks | Main tests |
| --- | --- | --- | --- |
| Native standalone window | 03, 04 | P1 | Playwright Electron launch, computer-use review |
| Actual project create/open and persisted five-stage shell | 03, 04, 05, 07, 17; ADR 0013; project/source/timeline/revision contracts and extended desktop_ipc schema/example | P1-03, P1-05, P1-06 | tests/media/project.test.ts, project-view.test.ts, project-store.test.ts and IPC checks cover rational source baseline, full probe/integrity validation, path-free committed DTO, failure preservation and stage-only persistence; packaged native all-five-stage baseline/source preservation, permission-denied failure, reopen, scales/security/focus and guest-only visual checks passed; publication/review and P1 result pending |
| Interface scale through 200% | 04, 05, 22; desktop_preferences and desktop_ipc schemas/examples | P1-05, P1-06 | Five storage and seven IPC tests passed for the 200% extension; packaged native keyboard/focus and guest-only layout inspection at 200% passed; prior 150% evidence remains separate |
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

## Editorial first-cut requirement mapping

[47_EDITORIAL_FIRST_CUT.md](47_EDITORIAL_FIRST_CUT.md) and `prompts/EDITORIAL_FIRST_CUT_PROMPT.md` are accepted later-feature requirements. The following evidence remains required; these rows assert neither implemented automation nor P1 completion. Typed editorial/operation/zoom/opportunity contracts and examples must be synchronized as implemented.

| Requirement | Specifications / skill routes | Tasks | Required acceptance evidence |
| --- | --- | --- | --- |
| Actual context, one transcription job, authorized scope and synchronized cut sets | 09, 13, 32, 47; magic-edit; media/recording/Codex engineers | P2-05, P4-03, P5-01 | Real job identity/polling; missing capability and independent-source rejection; protected/approved edits preserved |
| Conservative spoken cues and complete semantic cut | 09, 13, 32, 47; magic-edit | P5-03, P5-05, P10-02 | Configured and opt-in legacy aliases; quoted/ambiguous/hostile cues; final complete redo and unique context; pauses supporting demonstrations; every join, omission pass, full reread and restoration |
| Shared live pass groups and verified checkpoints | 32, 47; magic-edit; editor/Codex engineers | P2-05, P5-04, P5-06 | Current sequence/hash after structural edits; atomic persistence before announcement; abort or compensating undo; no false checkpoint/revision/export claims |
| Approved purposeful layouts | 14, 37, 47; broll-layout | P8-02, P10-02 | Property reuse, preferred-corner collision handling, screen-only return, meaningful section count, both edges/midpoint and protected-region QA |
| Selective graphics opportunities only | 14, 32, 47; broll-layout | P8-03, P10-06 | Final-cut timing/remapping; complete grounded generator-neutral prompts; proposed asset dimensions distinct from master; zero generation/import/placement without separate asset request |
| Initial graphics suggestion data validation | graphics_opportunity schema/example; domain graphics-opportunity.ts | P8-03 | tests/media/graphics-opportunity.test.ts covers detached validation, stale context, bounds, exact rate/duration, strict fields and sparse-array rejection; actual suggestion generation/UI remain unimplemented |
| Named screen/camera zoom targets | 11, 32, 47; automatic-zoom | P7-01, P7-07, P10-02 | Exact target and mode/layer evidence; readability-based scale/duration/rests; overlap/wrong-cursor/empty-target/camera-collision rejection; boundaries/midpoint/interior review |
| Final editorial QA/report and source fidelity | 32, 44, 47; native-qa/security/media engineers | P9-02, P10-03, P10-06 | Whole-video analysis scan plus precise rendered A/V; protected ranges; actual duration/counts/targets/unresolved cues/checkpoint state; analysis/master isolation and no automatic export |
