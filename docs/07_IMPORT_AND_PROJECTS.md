# Import and project specification

## Project creation

A project has one stable ID, display name, creation time, platform, canvas, source list, active draft, saved revisions, render cache, and Codex thread identity.

Under ADR 0013, P1 implements the minimum project foundation needed by its actual project shell: create from imported media, open/reopen, stable identity, immutable source references, an initial source-matched canonical timeline and real baseline revision, and persisted active stage. Existing ingestion-library records remain separate media records. Project revision IDs must resolve to immutable snapshots, and source IDs must resolve to preserved media; placeholder identities are invalid.

Read rational timing and canvas metadata from the actual source contract. Do not reconstruct the working frame rate from rounded UI text or silently choose a lower-precision working format. Unsupported project/preview paths must be reported honestly. P3 retains the complete import-format, project-management, locking, autosave/recovery and smooth A/V preview requirements below.

## Project navigation

The five navigation controls select Record or Import, Auto Edit, Edit, Review, or Export on the active project. Main validates and persists the stage before returning the committed state. Reopen restores the saved stage without implying its feature ran. Stage selection preserves the active draft, source references, selection and playhead as applicable, and does not append edits or advance draft sequence. A save failure leaves the previous committed stage intact.

Stage actions appear only when implemented. No navigation action may fabricate AI edits, certify watch-through/QA, or start export. A stage with unavailable actions may disclose that limitation and retain working navigation/source inspection. Final export remains a separate explicit user action. P1 tests shell navigation; later phases prove the corresponding stage features.

## Import

- Use a native file picker.
- Accept common MP4, MOV, MKV, WebM, WAV, MP3, PNG, JPEG, and supported camera formats.
- Probe before use.
- Reject unreadable media with an actionable message.
- Copy or reference media according to an explicit project policy.
- Hash imported and recorded sources.
- Never change source bytes.

During ingestion, Importing video offers Cancel. After ingestion succeeds and project creation begins, show Creating project and hide the import-only Cancel control; it cannot cancel committed source ingestion or project creation. A project-creation failure preserves the imported source for a later Create project retry.

## Project folder

The current P1 implementation publishes a managed project directory containing `baseline.json` and `project.json`. The baseline contains actual versioned project/source/timeline/revision records with referential checks; navigation replaces only the committed project's stage/update metadata. This limited physical store is a prerequisite to the complete P3 folder model below, not an implementation of every listed directory or draft service.

Creation and reopening verify the immutable managed media hash and compare the complete ffprobe result, including stream and format metadata, against the retained source probe. Staged creation is published only after validation. Failed creation preserves source-library media; unpublished creation directories remain for explicit recovery/cleanup. Source paths and raw probe data stay main-only. The renderer receives a strict path-free project DTO and distinguishes actual projects from imported sources.

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
