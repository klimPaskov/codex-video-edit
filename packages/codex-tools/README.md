# packages/codex-tools

The main process owns the active-project `CodexVideoEditToolService`. Its public surface is the fixed `project.get_summary`, `timeline.get_summary`, `cut.trim_edge`, and `timeline.undo` allowlist. The service accepts bounded, path-free inputs, injects Codex authority internally, and returns only state read back from the shared draft transaction store.

The packaged stdio MCP child forwards tool calls to this service over a bounded authenticated local channel. It never opens `DraftTransactionStore`: the shared project queue remains in Electron main. The random 256-bit broker credential is inherited only through the restricted process environment. The broker accepts one bounded request per connection, uses timing-safe authentication, limits concurrent connections and response size, and returns fixed errors.

`mcp-server.ts` implements the reviewed MCP initialize, ping, `tools/list`, and `tools/call` subset. Its four input schemas and annotations are fixed in source. Packaging emits a size-and-SHA manifest for the child script; main rejects a missing, linked, redirected, or changed resource. App-server startup checks the exact server, tool names, and input schemas before enabling project conversations. Export, deletion, cleanup, shell access, generic operations, checkpoints, source paths, protocol IDs, and arbitrary RPC remain outside the tool surface.
