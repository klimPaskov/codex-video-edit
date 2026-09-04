# Screen acceptance criteria

## S01 Onboarding

- The user understands that media stays local unless Codex is asked to inspect supplied context.
- ChatGPT sign-in can begin and recover from cancellation.
- Dependency problems have one plain repair action.
- Protocol logs are hidden.

## S02 Home

- New Recording and Import Video are the dominant actions.
- Recent projects show thumbnail, name, state, and modified time.
- Opening a project restores its last safe draft.
- No editor panels are visible.

## S03 Capture setup

- Screen or window, microphone, system audio, and camera choices are clear.
- Camera controls disappear when camera is off.
- Permission denial explains the exact missing permission.
- Start is disabled until required sources are valid.

## S04 Recording

- Countdown, pause, resume, stop, elapsed time, source state, scene, and teleprompter remain readable.
- Editor and diagnostics chrome stay hidden.
- Source failure cannot silently produce a complete take.

## S05 Take review

- Preview, Confirm, Try Again, and previous takes are clear.
- Discarding a take requires a deliberate action.
- Confirming creates or updates the automatic timeline.

## S06 Import processing

- One progress surface shows copy or reference, probe, proxy, waveform, transcript, and analysis status.
- Cancel is safe and leaves recoverable evidence.
- A corrupt file gives a specific repair route.

## S07 Auto Edit

- Magic Wand is the primary control.
- Presets and switches are understandable without technical terms.
- Live changes appear in the draft and history.
- Stop and Undo remain visible.

## S08 Review editor

- Preview is visually dominant.
- The timeline shows only tracks that contain content.
- One tool or inspector is open.
- Split, trim, delete, restore, zoom, speed, captions, B-roll, layout, audio, and cursor controls work on the selected object.
- Codex can receive the current selection and apply validated changes to the same history.

## S09 Compare

- Linked playback makes changed ranges obvious.
- The user can keep current, restore prior, or return to editing.
- Restoring creates a new draft and does not rewrite history.

## S10 QA

- The top state is Ready, Warnings, or Blocked.
- Each finding can jump to its range.
- Blocking failures prevent export.
- Technical evidence is optional.

## S11 Export

- Common options fit without scrolling at normal window size.
- Destination and overwrite behavior are explicit.
- Export requires a user action.
- Progress can be cancelled safely.

## S12 Complete

- Success appears only after full decode and output hash verification.
- Open Video, Open Folder, and Return to Project work.

## S13 Settings

- Codex provider is shown as the only provider.
- Runtime-discovered Codex models can be selected.
- Only one settings section opens at a time.
- Diagnostics remain separate.
