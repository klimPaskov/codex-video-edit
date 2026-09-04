# Project data and revisions

## State types

### Source state

Immutable files and recording metadata.

### Draft state

Mutable through validated operations. Autosaved and undoable.

### Revision state

Immutable snapshot created by the user or a defined milestone.

### Derived state

Proxies, previews, transcripts, waveforms, contact sheets, renders, and QA reports. Rebuildable from source and revision state.

## Operation journal

Each operation contains:

- stable operation ID
- transaction ID
- project and draft IDs
- operation type and schema version
- source or output range
- previous and next values
- origin: user, Codex, Magic Wand, migration, or recovery
- concise reason
- creation time
- dependency hashes
- undo data

## Shared history

Manual and AI edits use the same transaction journal. Undo reverses the newest applicable transaction. Redo reapplies it only when dependencies remain valid.

## Revision creation

A revision captures the operation journal head, timeline, transcript, assets, canvas, caption style, audio settings, model and skill metadata for AI-generated changes, and preview hash when available.

## Migration

Every stored contract has a schema version. Migrations are explicit, tested, backed up, and reversible when practical. An unknown newer schema opens read-only rather than risking corruption.
