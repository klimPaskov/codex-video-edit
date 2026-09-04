# P0 foundation slice

P0 is the first incomplete dependency-safe phase. Its active tasks are P0-01 through P0-08. This document describes the bounded foundation and its remaining acceptance requirements; it is not a completed phase result.

## Scope and evidence boundaries

The foundation establishes an npm workspace with strict TypeScript, linting and formatting, a media package and domain contracts, schema/example validation, a guarded phase-result writer, public-source auditing, and synthetic FFV1/PCM round-trip fixtures. The checks must run through the documented repository command and report actual failures. Research and exact dependency observations are in [P0 foundation research](../research/P0_FOUNDATION.md).

Synthetic fixtures compare decoded video and audio against canonical raw samples, including an intentionally edited canonical case. Tested encoder boundaries do not prove native capture, renderer precision, hardware access, real-time throughput, or the full master-export path. Capture adapters and unsupported precision profiles must remain unverified until their own evidence exists. Default preview, capture, intermediate and master requirements remain governed by [the lossless policy](44_LOSSLESS_MEDIA_POLICY.md).

No Electron app has been launched for this slice. The integration environment has no supplied isolated native desktop; the Docker engine is not running. The user's host is not an authorized fallback. Headless checks may establish foundation correctness, but media/native acceptance still requires Playwright Electron and computer-use inspection in the isolated environment. No screenshot, login, recording device, runtime AI turn, or final export is implied by these checks.

Public repository work must resolve and verify the authenticated owner, review staged paths and contents, and verify the remote commit under [the public-development policy](45_OPEN_SOURCE_DEVELOPMENT.md). This document does not assert remote publication. Private footage, projects, tokens, logs, and generated acceptance evidence remain excluded. MIT licensing does not grant redistribution rights for runtime binaries, models, fonts, or supplied imagery.

## Specification synchronization audit

The changed foundation requirement is executable, reproducible validation with truthful evidence, rather than planning checks alone. Active task coverage now includes P0-07 and P0-08. Research links and the stale unsupported-WebSocket rationale have been corrected. Traceability distinguishes foundation checks from required native evidence.

The latest user workflow is now synchronized as Record or Import → Auto Edit → Edit → Review → Export. ADR 0003 records that the current instruction supersedes the historical four-stage starting decision. Planning, workflow, P1 header task wording, user/UI/screen specifications, screen manifest, UI and screen schemas, examples, UI skill, native review prompt, routing guidance and reference correction notes now distinguish Edit from Review. S08 is Edit; revision comparison and S10 quality review are Review. The internal `qa` screen identifier is retained, but `qa` is no longer a project-stage value. Reference images and their manifest are unchanged.

The guarded tool manifest, tool schema, examples, Codex integration/catalog documentation and runtime skill now require `user_confirmation: none` for already authorized `active_draft` and `export_staging` work, including Magic Wand and `export.prepare`. Final export is still an explicit native user action unavailable to AI tools. Source deletion, cleanup, spending and publication remain explicit user actions. Native server approval events are distinct from application draft-edit authorization. The Codex integration document also now gives the current stdio rationale without the stale WebSocket maturity assertion.

`tests/foundation/test_workflow_contracts.py` checks five-stage enums, screen assignments, preserved QA screen identity, authorized tool policies and negative confirmation regressions. These are contract checks, not native interaction or real runtime tests. P1/P2 must still verify stage transitions preserve draft/undo state and a real authenticated turn edits the active draft without repeated approval. Native inspection remains blocked by the isolation gap described above.

Migration impact: persisted editor UI states previously using `step: review` must become `edit`; `screen: qa` states previously using `step: qa` must become `review`. No existing application storage or runtime migration is implemented in this foundation. Future project loading must apply the mapping before validating older saved UI state.

Other domain schemas, timeline operations and source/media contracts remain unchanged by this workflow synchronization. No image assets were changed. The foundation schema/result-writer implementation must be reviewed and validated independently. A final phase result may contain its spec-sync section only after all phase acceptance checks pass; no P0 result or task completion is asserted here.

The UI state contract also rejects an open Codex drawer alongside an inspector at every width. This removes the old wide-window pin exception from the UI specification and has a negative contract regression test. Native focus restoration and layout remain P1 acceptance work.
