# Import and project specification

## Project creation

A project has one stable ID, display name, creation time, platform, canvas, source list, active draft, saved revisions, render cache, and Codex thread identity.

## Import

- Use a native file picker.
- Accept common MP4, MOV, MKV, WebM, WAV, MP3, PNG, JPEG, and supported camera formats.
- Probe before use.
- Reject unreadable media with an actionable message.
- Copy or reference media according to an explicit project policy.
- Hash imported and recorded sources.
- Never change source bytes.

## Project folder

```text
project/
  project.json
  sources/
  drafts/
  revisions/
  transcript/
  assets/
  previews/
  exports/
  cache/
  recovery/
  logs/
```

Logs are not part of the normal UI.

## Autosave

- Append validated operations to a draft journal.
- Snapshot periodically and before render.
- Recover by replaying only complete transactions.
- Preserve the failed tail for diagnostics.

## Revisions

Committing a revision freezes the timeline, transcript, effect settings, assets, and rendering configuration by hash. Editing continues in a new draft derived from that revision.

## Deletion

Project deletion requires confirmation and never deletes externally referenced source files. Cleanup previews every managed path before deletion.
