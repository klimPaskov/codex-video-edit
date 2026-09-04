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
