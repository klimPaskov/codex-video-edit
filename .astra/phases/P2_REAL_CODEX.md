# P2: real Codex runtime

Task IDs: `P2-01` through `P2-07`

Use `codex-app-server`, `security-privacy`, `native-app-testing`, and `spec-sync`. Integrate the official Codex app-server as a long-running child process over stdio JSONL. Generate or validate protocol types against the installed binary. Implement ChatGPT-managed sign-in, account state, rate limits, runtime model discovery, skill discovery, durable project threads, streamed events, interruption, restart recovery, and server approval requests.

Expose only guarded codex-video-edit MCP tools. The app's AI selector shows Codex as the only provider and runtime-discovered models. Fake transports are allowed only in tests.

Apply ADR 0013: use P1's real project foundation and implement the shared validated transaction core in P2-05 before the authenticated P2-06 edit. Require expected draft sequence, durable journaling, atomic persistence before notification, deterministic inverse/undo and recovery of complete committed transactions. Manual and later Magic Wand tools must reuse this engine; no AI-only mutation store or UI-only edit is acceptable. Persisted navigation state is separate from draft sequence and operation history. Full P3/P6 acceptance remains required.

Acceptance:

- parser, recovery, stale protocol, and tool validation tests pass
- a real authenticated Codex smoke test discovers models and skills
- one real turn applies a reversible draft edit through a guarded tool
- the edit survives reopen, rejects stale sequence requests, and can be undone through the shared engine; interrupted/incomplete transactions do not corrupt the committed draft
- raw protocol text stays out of normal UI
- `.astra/results/P2.json` validates
