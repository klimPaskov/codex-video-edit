# Screen specifications

The P0 bootstrap in ADR 0012 implements only an actual Home import/library surface and bounded per-frame inspection/seek. Library entries are imported media, not recent projects or draft timelines. Show real import, cancel, selection and seek controls; report unavailable preview for unverified color/precision inputs. Do not display nonfunctional recording, project, Codex, edit, playback or export actions to imitate the complete screens below. P1 and later phases retain their complete screen and accessibility requirements; bootstrap runtime acceptance is still required.

## S01: onboarding

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

The current P1 slice adds Settings to the working import/library Home. Keyboard source selection opens frame inspection with focus on Back; Back returns focus to the selected source card. Source information opens one inspector with actual imported metadata. This is still a media library, not a recent-project implementation or the complete five-stage shell.

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

## S09: revision compare (Review stage)

Visible:

- prior revision and current draft
- linked playhead
- changed-range list
- Keep current
- Restore prior as a new draft
- Continue editing

## S10: review and quality summary (Review stage; internal screen `qa`)

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

The initial working Settings modal contains Interface size at 100%, 125%, and 150%, persisted by main through validated preference get/set IPC. Open it with Settings or Ctrl+,. Cancel/Escape leaves unsaved choices unapplied. Save reports success only after persistence succeeds; failures remain actionable. The dialog owns focus while open and restores the invoking control on close. Any selected source-information inspector is hidden during the modal and restored afterward when still applicable. The complete settings sections above remain later work; do not add inactive controls to imitate them. Packaged native tests and computer-use inspection passed for this bounded slice; full P1 remains incomplete.
