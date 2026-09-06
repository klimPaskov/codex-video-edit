# Subagent routing

The main agent owns phase selection, integration, final judgment, and evidence. It may delegate bounded work, but it must inspect every returned result.

| Need | Subagent | Required skill |
| --- | --- | --- |
| Current product and technical research | `researcher` | `research-product` |
| Flow, visual hierarchy, and simple screens | `ux-designer` | `simple-desktop-ui` |
| Electron process and IPC design | `desktop-architect` | `native-electron` |
| Codex protocol, auth, threads, and tools | `codex-bridge-engineer` | `codex-app-server` |
| Screen, audio, camera, and sync capture | `recording-engineer` | `recording-capture` |
| FFmpeg, transcription, rendering, and media QA | `media-engineer` | `media-engine` |
| Timeline interactions and history | `editor-engineer` | `timeline-editor` |
| Magic Wand, zooms, speed, and B-roll plans | `automation-editor` | `magic-edit`, `automatic-zoom` |
| Native launch, Playwright, and computer-use review | `native-qa` | `native-app-testing` |
| Threat model, permissions, and privacy | `security-reviewer` | `security-privacy` |
| Installer and release | `release-engineer` | `release-packaging` |
| Cross-file updates and traceability | `spec-maintainer` | `spec-sync` |

## Routing rules

For the ADR 0013 project shell, keep domain/store/complete-probe verification, main/preload IPC, renderer interaction, and spec/native evidence ownership bounded by explicit files. Renderer work consumes only the path-free committed `ProjectView`; it must not create its own persistence model or fake project/revision identities. The main agent verifies pure postcommit mapping, save-failure preservation, and native five-stage interaction before integration. Project/source/timeline/revision schema shapes remain authoritative; extended IPC, examples and tests must stay synchronized. P2 shared transactions remain a separate prerequisite and must serve manual and Codex edits alike.

- Delegate only a clear file or evidence boundary.
- Give the subagent exact task IDs, inputs, outputs, and stop conditions.
- Do not let two agents edit the same file at once.
- A subagent may not mark a phase complete.
- Research agents do not decide architecture alone.
- Visual agents do not weaken product, privacy, accessibility, or testing requirements.
- QA agents must reproduce claims from the current build.
- When a task changes a workflow contract, always route a final pass to `spec-maintainer`.

## Fidelity, reference, and publishing ownership

The media engineer owns `lossless-media` checks across capture, intermediate rendering, and export. The UX designer and native QA agent use `reference-fidelity` for the current individual references and their correction notes. The release engineer uses `open-source-development` from P0 onward, not only at release. The parent reviews all changes and verifies remote publication.

For five-stage navigation changes, the UX designer and native QA agent verify Edit separately from Review, with comparison and QA inside Review. The Codex bridge engineer and security reviewer verify that authorized active-draft edits and export staging do not require repeated confirmation, while final export and forbidden effects remain outside the AI tool surface.

## Editorial policy ownership

For `docs/47_EDITORIAL_FIRST_CUT.md` and `prompts/EDITORIAL_FIRST_CUT_PROMPT.md`, route source/synchronization/transcription-job evidence to the media and recording engineers; conservative spoken-cue, retake/coherence and pass planning to `automation-editor`; shared sequence/hash/undo/checkpoint behavior to the editor and Codex bridge engineers; approved-layout/occlusion and suggestion-only opportunity records to the automation/editor specialists; and actual joins, boundary/midpoint/interior renders and whole-video checks to `native-qa`. The security reviewer checks quoted/ambiguous cues, permission expansion, protected edits and unauthorized asset/export side effects. `spec-maintainer` closes the task/schema/example/prompt/skill/traceability sync.

Pass explicit source scope, verified synchronized sets, current timeline identity and evidence requirements. Do not delegate operation of the reference editor, invent unavailable tools, create graphics from a recorded cue, or infer completion from planning. Codex is the sole generative provider; separate reversible pass groups share one history. The main agent reviews the measured final report and every claimed pass, leaving later feature acceptance incomplete until proved.
