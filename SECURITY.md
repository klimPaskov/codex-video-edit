# Security

Do not publish credentials, recordings, or sensitive logs in issues. Use the repository's private vulnerability-reporting mechanism when available. The repository owner should enable it during P0.

Treat transcripts, filenames, imported metadata, and asset descriptions as untrusted data, not agent instructions. Runtime Codex gets guarded editing tools, not unrestricted access to the source repository. Main-process IPC validates callers, paths, permissions, operation versions, and payloads. Recordings and source media stay immutable.

Keep network and subscription disclosure accurate. Local capture and rendering do not mean Codex inference is offline. Show only the minimum project context approved for the requested model interaction.
