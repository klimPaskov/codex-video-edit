# Screen specifications

The P0 bootstrap in ADR 0012 implements only an actual Home import/library surface and bounded per-frame inspection/seek. Library entries are imported media, not recent projects or draft timelines. Show real import, cancel, selection and seek controls; report unavailable preview for unverified color/precision inputs. Do not display nonfunctional recording, project, Codex, edit, playback or export actions to imitate the complete screens below. P0 bootstrap and P1 shell acceptance are recorded in their phase results; later phases retain their complete screen and accessibility requirements.

The subsequent P1 project prerequisite now adds actual project create/open/reopen and five-stage navigation to the bootstrap. Home lists Projects and Source library separately, and retained source entries have a working Create project action. Successful import creates an actual project with a baseline revision. Stage selection saves through main before changing the active control, retains source/frame position, and preserves prior state on failure. P1 is accepted in `docs/workflow/results/P1.json`, including packaged native tests and guest-only visual inspection. Later editing, capture and export controls remain separate implementation work. The complete screen requirements below remain authoritative.

## S01: onboarding

Before ordinary screens, missing required packaged files show a native error with reinstall guidance and Close app. An unexpected renderer failure offers one Reopen window or Close app choice; another failure requires closing. Reopen means loading persisted work, not guaranteeing recovery of unsaved changes. Unreadable interface settings retain their bytes, use 100% presentation and report the failure. These native failure paths are part of P1 lifecycle acceptance and do not expose technical diagnostics in the renderer.

Purpose: establish local readiness and real Codex sign-in.

Visible:

- product mark
- Sign in with ChatGPT
- setup action only if a required dependency is missing
- short context disclosure
- Continue

Hidden under Details: exact versions, paths, protocol events, logs, and repair commands.

## S02: home

Visible:

- New recording
- Import video
- Open project
- recent project thumbnails, names, and modified times
- small Settings and Help actions

No editor tools or empty project panels appear.

The current P1 slice adds Settings to the working import/library Home. Keyboard source selection opens frame inspection with focus on Back; Back returns focus to the selected source card. Source information opens one inspector with actual imported metadata. The accepted P1 shell also lists actual projects separately and implements persisted five-stage navigation; visiting a stage does not execute its later editing or export workflow.

## S03: capture setup

Visible:

- screen, window, or region picker
- microphone picker
- system audio toggle
- camera toggle and picker
- live camera preview only when enabled
- aspect ratio
- optional scene and teleprompter entry
- countdown and Start recording

Advanced camera and audio settings are collapsed.

## S04: recording

Visible:

- selected screen or window preview
- elapsed time
- pause, resume, and stop
- current scene and teleprompter
- microphone, system audio, and camera state

No editor or diagnostics chrome is visible during capture.

## S05: take review

Visible:

- recorded take preview
- Confirm take
- Try again
- previous takes
- source health and sync warning only when needed

Confirming the take adds it to the automatic timeline. Previous takes remain recoverable.

## S06: import and processing

Visible:

- selected file or take set
- one progress surface
- plain labels for reading media, preparing preview, transcribing, and analyzing
- Cancel safely

Do not show raw FFmpeg, transcription, or protocol logs.

## S07: Auto Edit

The later editorial flow follows docs/47_EDITORIAL_FIRST_CUT.md. Show meaningful current pass progress and actionable unresolved directions from real persisted work, with separate spoken-cut, layout and zoom undo groups. Do not turn the detailed QA requirements into persistent dashboards or extra panels. The configured cue and protected scope belong to relevant project/edit settings.

Visible:

- video preview
- Magic Wand as the main action
- preset menu and simple feature switches
- optional natural-language instruction
- concise live activity
- Stop and Undo

## S08: editor (Edit stage)

Visible:

- large preview
- compact tool rail
- simple timeline with non-empty tracks only
- transcript mode
- one inspector
- collapsible Codex drawer

Direct canvas handles appear for the selected zoom, camera, or B-roll item.

The current P2 conversation slice implements the compact Codex drawer beside the existing project preview. Opening it closes the source inspector so only one panel is visible. It renders only projected user/Codex text, generic work/subagent/edit activity, Stop while a turn runs, and an actionable failure or uncertainty. It requires a real selected project and signed-in runtime selection, contains no sample messages, and updates from the authoritative thread view returned through typed IPC. Leaving a project performs an idle unsubscribe and refuses while a turn is active.

The project preview shows current and total output time. Its frame and seek bounds come from the current committed draft head. A committed trim refreshes the project duration and remaps output time through the retained immutable source; stale decoded pixels are discarded. Source library inspection remains clearly labelled as source position.

## S09: revision compare (Review stage)

Visible:

- prior revision and current draft
- linked playhead
- changed-range list
- Keep current
- Restore prior as a new draft
- Continue editing

## S10: review and quality summary (Review stage; internal screen `qa`)

The editorial report exposes measured changes, unresolved cues and selective graphics suggestions at final-cut times. Each suggestion contains its complete prompt and remains distinct from an imported asset; viewing it never triggers generation or export. Keep this in the selected review surface or Codex drawer, respecting the single-panel rule. A pass checkpoint does not certify whole-result review. These are later implementation requirements, not current shell controls.

Visible:

- actionable warnings or blockers, otherwise one enabled Continue action
- short issue list with jump-to-time
- Fix with Magic Wand when supported
- full-draft watch-through and jump-to-time playback
- Return to Edit and Continue to Export actions

Technical evidence opens only from Details.

## S11: export

Visible:

- file name and destination
- Lossless master by default, Smaller file only by explicit choice
- captions and sidecar choices
- Export
- cancellable progress after export begins

Advanced codec settings are collapsed.

## S12: export complete

Visible:

- final thumbnail
- filename and Open folder action, with path and technical verification under Details
- Open video
- Open folder
- Return to project

## S13: settings

Sections:

- Codex account and runtime-discovered model
- recording devices and shortcuts
- project and cache locations
- default captions and export
- privacy
- diagnostics

Codex is the only provider entry. Only one settings section opens at a time.

The initial working Settings modal contains Interface size at 100%, 125%, 150%, and 200%, persisted by main through validated preference get/set IPC. Open it with Settings or Ctrl+,. Cancel/Escape leaves unsaved choices unapplied. Save reports success only after persistence succeeds; failures remain actionable. The dialog owns focus while open and restores the invoking control on close. Any selected source-information inspector is hidden during the modal and restored afterward when still applicable. Only implemented settings sections are exposed; do not add inactive controls to imitate later sections. The earlier settings/focus slice passed packaged native tests and computer-use inspection at 150%; the 200% packaged native and guest-only visual checks passed. P1 is accepted in `docs/workflow/results/P1.json`.

## P2 Codex implementation boundary

Appearance and Codex sections are implemented within the existing Settings modal, with one section visible at a time. Appearance retains the saved interface-scale behavior. Codex provides real runtime connection, managed ChatGPT browser sign-in, cancellation, sign-out and reconnect actions. Login URLs and account storage stay in main; the packaged renderer never navigates to authentication content. Model and reasoning controls appear only for a signed-in account with runtime-discovered choices. Selection is persisted immediately through main, separately from Appearance Save. Usage is shown only from returned limits; discovered skills remain under the single Advanced disclosure.

Packaged Linux signed-out settings, login initiation/cancellation, reopen and 200% scale checks passed, with guest-only visual inspection at 100% and 200%. The test explicitly suppressed external browser launching. The project drawer, production thread lifecycle and owned MCP inventory are implemented, but managed sign-in completion, authenticated model/usage/selection, an actual model turn, native subagent behavior and a committed Codex edit remain unverified. Project-level model defaults and renderer-selected per-turn overrides are not implemented. Preserve the modal focus/scale/one-panel rules while testing these surfaces.
