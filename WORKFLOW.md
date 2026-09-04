# Product workflow

## 0. Onboarding

The app checks its local dependencies, asks the user to sign in to Codex with ChatGPT, reads the current model catalog, and explains what project context may be sent to Codex. Technical details remain collapsed.

## 1. Home

Show recent projects and three primary actions:

- New recording
- Import video
- Open project

A secondary action opens an optional script and scene planner.

## 2. Record or import

### Record

Select display, window, or region. Select microphone and optional system audio. Enable camera when wanted. Choose canvas format, teleprompter, and scene. Start after a countdown. Allow pause, resume, stop, retry, and take selection.

### Import

Choose one or more local media files. Probe, hash, index, and create project proxies without changing the originals.

## 3. Auto Edit

Magic Wand opens a short menu with a Balanced preset and individual switches:

- clean cuts
- captions
- automatic zooms
- safe speed-ups
- audio cleanup
- camera layout
- local B-roll suggestions
- cursor treatment

Running it creates or updates the active draft. The app streams concise progress and updates the timeline live. The user can stop safely.

## 4. Edit

Show a large preview, a simple timeline, transcript, and one context panel at a time. The user can:

- split, trim, ripple-delete, restore, move, and reorder supported clips
- delete transcript words to cut matching media
- adjust zoom target, duration, and strength
- adjust speed range and multiplier
- change camera layout and crop
- edit caption text and style
- import, replace, trim, and position local B-roll
- adjust audio gain, cleanup, fades, and music ducking
- ask Codex to change the current selection
- undo, redo, compare, and save a revision

## 5. Review

Watch the complete draft, compare revisions, and run decode, timing, audio, caption, framing, missing-media, black-frame, freeze-frame, zoom, speed, and licence checks. Return to Edit for corrections without losing draft history. Show a plain summary. Open technical details only when requested.

## 6. Export

Default to a source-matched lossless master. Choose filename, destination, and optional caption sidecars. Advanced controls and smaller sharing copies are opt-in. Render locally from originals and verified lossless intermediates. Verify decode and canonical sample equality, then record revision, source hashes, and the exact quality profile.

## 7. Return and revise

A project reopens at the last saved draft or revision. Autosave recovers interrupted work. The original sources remain available and unchanged.

## Development loop

Create the public `codex-video-edit` repository in P0 after authentication and privacy checks. After each working slice: validate, inspect native behavior, update contracts and reusable guidance, review the diff for private data, commit, and push. Keep incomplete milestones visibly incomplete. Publish release binaries only after installer and media acceptance.
