# packages/codex-tools

The main process owns the active-project `CodexVideoEditToolService`. Its public surface is the fixed `project.get_summary`, `timeline.get_summary`, `cut.trim_edge`, and `timeline.undo` allowlist. The service accepts bounded, path-free inputs, injects Codex authority internally, and returns only state read back from the shared draft transaction store.

The future stdio MCP adapter must forward tool calls to this main-owned service over an authenticated local channel. It must not open `DraftTransactionStore` in the MCP child process: the shared project queue is deliberately in-process, and a second writer could race the Electron main process. Export, deletion, cleanup, shell access, generic operations, checkpoints, source paths, protocol IDs, and arbitrary RPC remain outside the tool surface.
