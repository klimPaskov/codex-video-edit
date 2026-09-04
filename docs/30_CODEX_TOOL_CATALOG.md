# Codex tool catalog

## Purpose

Codex edits through a guarded project tool surface. It does not receive raw filesystem access through the app. Every mutating call targets the current draft, validates its inputs, writes an operation transaction, updates the native UI, and returns an undo handle.

## Common request fields

Every project tool request includes:

- `project_id`
- `revision_id`
- `expected_draft_sequence`
- `request_id`
- the smallest required time range or entity IDs

Mutating calls also include a user-readable intent and origin. Stale sequence or revision values fail without partial mutation.

## Read-only tools

### `project.get_summary`

Returns project name, current step, source roles, duration, revision, QA state, and active work.

### `timeline.get_summary`

Returns canvas, tracks, clips, operations, selected range, zooms, speed segments, captions, and unresolved warnings. Large payloads use bounded windows.

### `timeline.get_selection`

Returns current selection, nearby transcript, source mapping, visible frame IDs, and applicable tools.

### `transcript.get_range`

Returns word-timed text for a bounded source or output range, including confidence and protected flags.

### `media.get_frames`

Returns requested preview frames or a contact sheet from a bounded range. It never returns an entire raw source by default.

### `assets.search_local`

Searches the indexed local asset library by meaning, tags, format, duration, and licence state.

### `qa.get_findings`

Returns current blocking and warning findings with jump-to-time data.

## Draft mutation tools

### `timeline.apply_operations`

Applies one atomic batch of schema-valid operations. A batch either succeeds fully or fails fully.

### `cut.split`

Splits a supported clip at an exact mapped time.

### `cut.delete_range`

Creates a non-destructive ripple-delete operation. Protected speech requires review or a direct user request.

### `cut.restore_range`

Restores source material when later operations do not make the request ambiguous.

### `cut.trim_edge`

Moves one clip boundary with snapping and minimum-duration validation.

### `zoom.add`, `zoom.update`, `zoom.remove`

Manage purposeful zoom ranges, normalized targets, scale, easing, and evidence.

### `speed.add`, `speed.update`, `speed.remove`

Manage bounded speed ranges, rate, reason, and audio mode. Speech handling is explicit.

### `captions.configure`, `captions.correct`

Apply a caption style or correct transcript-linked caption text without changing the source transcript silently.

### `layout.set`

Chooses a supported screen and camera layout for a range or scene.

### `broll.add`, `broll.update`, `broll.remove`

Place only indexed local assets with current hashes and licence records. Original footage remains the fallback.

### `audio.configure`

Adjust cleanup preset, gain, fades, music, and speech-priority ducking within safe limits.

### `cursor.configure`

Adjust pointer visibility, smoothing, click highlights, size, and per-range overrides.

## Render and analysis tools

- `analysis.run_magic_wand`
- `analysis.find_cut_candidates`
- `analysis.find_zoom_targets`
- `analysis.find_speed_ranges`
- `preview.render_range`
- `preview.render_project`
- `qa.run_range`
- `qa.run_project`
- `export.prepare`

`export.prepare` may validate and stage settings. It cannot confirm the final user export action.

## Tool response

A mutation response contains:

- status
- transaction ID
- new draft sequence
- applied operation IDs
- compact state patch
- user-facing summary
- warnings
- undo token

## Forbidden tools

Do not expose tools that overwrite sources, run arbitrary shell commands, read unrelated files, delete projects, approve licences, confirm export, or clear recoverable revisions.

## Authorization policy

Tools scoped to `active_draft` or `export_staging` use `user_confirmation: none` for already authorized work. This includes Magic Wand and export preparation. Validate scope, source immutability, sequence, protected speech and undo guarantees on every call. Do not request approval again merely because a reversible edit changes the draft materially. Final export requires the explicit user action in the native Export screen; no AI tool may authorize it. Source deletion, cleanup, spending and publication remain explicit user actions.
