# User workflow

## Navigation model

The app uses a top stepper with five project stages:

1. Record or Import
2. Auto Edit
3. Edit
4. Review
5. Export

Only the current stage is expanded. Completed stages can be revisited. Future stages remain compact and show their blocking condition.

## Home

Home contains recent projects and three large actions:

- New recording
- Import video
- Open project

Settings, Help, and Diagnostics use small secondary actions.

## New recording

The user chooses a screen source, microphone, optional system audio, optional camera, aspect ratio, and scene. A short readiness view shows only blocking issues. The recording overlay remains minimal.

## Import video

The user picks local media and sees one plain processing view. File probing, proxy creation, transcription, and analysis appear as a short progress list. Detailed commands remain hidden.

## Auto Edit

The Magic Wand is the main action. It opens a small menu with a preset and a few clear switches. While running, the preview and timeline update as validated edit operations arrive. The user can stop without losing completed operations.

## Edit

The default layout contains:

- large preview
- compact tool rail
- simple timeline
- optional transcript tab
- one inspector at a time
- collapsible Codex drawer

The user can click an AI change in the history to see its reason and undo it.

## Review

Watch the whole draft, compare revisions, and inspect actionable quality findings. QA is an internal screen within Review. Jump back to Edit to correct an issue with shared undo history preserved; continue to Export when ready. Review does not require approval of every ordinary reversible edit.

## Export

The final screen shows a preview summary, required warnings, a small set of export presets, and one Export button. Advanced codec settings are hidden.

## Returning users

Reopening a project restores the last autosave. If an interrupted draft exists, the app explains what was recovered and what needs to be rerun.
