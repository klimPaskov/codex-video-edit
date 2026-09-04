# Product requirements

## Functional requirements

### Create

- Create, rename, duplicate, archive, and reopen local projects.
- Start from a scene outline, a script, a recording, or imported media.
- Save all drafts automatically.

### Record

- Capture a display, application window, or selected region.
- Record microphone and optional system audio.
- Record optional camera video.
- Start every selected source against one monotonic session clock.
- Keep source tracks separate for later layout and audio control.
- Provide countdown, pause, resume, stop, retry, and keyboard shortcuts.
- Support scene-by-scene recording and prior-take retention.
- Support a basic teleprompter with manual and voice-following modes when evidence supports it.

### Edit automatically

- Produce word-timed transcript and independent silence evidence.
- Create a useful first draft from a Magic Wand action.
- Remove or shorten dead air, filler, false starts, obvious repetitions, and failed takes when confidence and policy allow.
- Add captions, safe audio cleanup, purposeful zooms, and requested or clearly safe speed-ups.
- Suggest local B-roll and layouts when suitable.
- Apply operations to a non-destructive draft and show them live.

### Edit manually

- Play, seek, zoom the timeline, select ranges, split, trim, ripple delete, restore, move, and reorder supported clips.
- Edit by deleting transcript words or sentences.
- Add, remove, retime, resize, and reposition zooms, speed segments, captions, B-roll, text, and camera layouts.
- Undo and redo every draft operation.
- Save immutable named revisions.

### Review and export

- Preview at full speed and at selected quality.
- Compare original, draft, and saved revisions.
- Run machine QA and show clear warnings.
- Export a local lossless master and caption sidecars, with an opt-in compressed MP4 sharing copy.
- Verify the output can be fully decoded before showing success.

## Non-functional requirements

- Fast cold start after dependencies are installed.
- Smooth 1080p preview on target hardware.
- Responsive editing during background analysis and rendering.
- Crash-safe project state and resumable work.
- Local source and project files by default.
- Clear disclosure of media or text sent to Codex.
- Keyboard access, scalable text, visible focus, and readable contrast.
- No normal screen should resemble a debug console.

## Definition of useful first draft

A first draft is useful when it preserves the intended message, removes clear waste, improves visual focus, keeps speech understandable, and can be refined with a small number of direct actions. A shorter video alone is not evidence of improvement.
