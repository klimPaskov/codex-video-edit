# Export and delivery

The normal view contains filename, destination, and one quality choice: **Lossless master** by default, or **Smaller file** by explicit choice. Caption sidecars are optional. Keep codec and timing details under Advanced. Do not show a QA dashboard, redundant title, or success card before the export is done.

Lossless master uses the verified profile in `docs/44_LOSSLESS_MEDIA_POLICY.md`: Matroska with FFV1 and representation-matched PCM. Preserve source or canonical precision, timing, colour metadata, and channel layout. A compressed MP4 is an optional separate sharing output, never a silent default or a replacement master.

## Process

1. The user confirms export of the current revision and exact profile.
2. Freeze an export snapshot without discarding later editing ability.
3. Resolve immutable sources, current assets, and hashes.
4. Render canonical frames and audio from the shared timeline engine.
5. Encode and mux into a staging path with the correct extension.
6. Fully decode, inspect stream metadata, and verify lossless sample equality against the canonical render where required.
7. Verify timing, caption bounds, output hash, and current review state.
8. Write a delivery manifest including fidelity profile and explicit downgrade decisions.
9. Promote atomically to the chosen destination.

Codex may prepare settings, but must not invent user confirmation. A requested lower-quality preview must never lower master quality.

## Success and recovery

Show the final thumbnail, filename, Open video, and Open folder only after the exact output passes required checks. Keep detailed QA and hashes in optional details. Do not show export settings, running progress, and completion as simultaneous live states.

Cancellation preserves the project and earlier exports. Incomplete staging output is not advertised as a delivery. A later revision makes the previous review stale for that later revision only. Previous valid exports remain valid records of their own snapshots.
