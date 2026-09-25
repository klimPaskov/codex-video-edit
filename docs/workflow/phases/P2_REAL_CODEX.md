# P2: real Codex runtime and explicit API providers

Task IDs: `P2-01` through `P2-10`

Use `codex-app-server`, `security-privacy`, `native-app-testing`, and `spec-sync`. Integrate the official Codex app-server as a long-running child process over stdio JSONL. Generate or validate protocol types against the installed binary. Implement ChatGPT-managed sign-in, account state, rate limits, runtime model discovery, skill discovery, durable project threads, streamed events, interruption, restart recovery, and server approval requests.

The packaged Codex path uses seven guarded host-defined tools for new project conversations and retains guarded MCP for existing MCP-bound conversations. Store each thread's route and fail closed on mismatch. The shared main-owned transaction service handles both routes. Packaged native edit, Undo, reopen, legacy-thread compatibility and a bounded forbidden-tool probe must be distinguished from the still-open complete effective-tool boundary. A host call before the `turn/start` response requires a submitted request, a validated owned start notification and a later matching response; unknown, completed or contradictory turns cannot dispatch. The AI selector offers Codex, OpenAI API, DeepSeek and Gemini API with runtime-validated models and provider-specific capabilities. API-provider output must pass the same main-owned guarded transaction engine; it has no direct MCP, file or export authority. Use fixed provider endpoints, main-owned secure keys, explicit paid-turn initiation and provider-specific context disclosure. Gemini function-call thought signatures must be validated, replayed within the current main-process turn and never exposed or persisted. Fake transports are allowed only in tests. Apply ADRs 0014 and 0015.

Apply ADR 0013: use P1's real project foundation and implement the shared validated transaction core in P2-05 before the authenticated P2-06 edit. Require expected draft sequence, durable journaling, atomic persistence before notification, deterministic inverse/undo, stack-ordered redo and recovery of complete committed transactions. Redo is a new hash-chained transaction, survives reopen, and is cleared by a newly applied edit. Manual and later Magic Wand tools must reuse this engine; no AI-only mutation store or UI-only edit is acceptable. Persisted navigation state is separate from draft sequence and operation history. Full P3/P6 acceptance remains required.

The partial manual Edit surface uses the same main-owned transaction service for playhead-based clip-edge trim, interior split, a marked ripple range cut, newest undo and stack-ordered redo. Its IPC carries a strict committed draft head and bounded intent, while main supplies the trusted manual origin and generated journal IDs. A split keeps the left fragment identity and creates a deterministic right fragment identity from the trusted operation. A half-open range cut may cross source joins or remove a source's complete visible span; it reflows surviving fragments without deleting immutable source inventory or baseline. The projected fragment map and Undo/Redo targets must update after manual and assistant commits before further tool targeting. Guarded `cut.split` and `cut.delete_range` tools expose those same validated reducers to Codex and the fixed API-provider adapters; their availability does not satisfy the remaining guarded-tool policy, provider access, or P2 phase gates.

Acceptance:

- parser, recovery, stale protocol, and tool validation tests pass
- a real authenticated Codex smoke test discovers models and skills
- OpenAI API, DeepSeek and Gemini API key paths pass fixed-endpoint, secure-storage/session-fallback, model-discovery, key-redaction and provider-failure tests; Gemini 3 function-call signature replay passes authenticated native verification
- a remembered API model choice survives restart only with its protected key and live catalog membership; replacement, removal and session-only use clear it
- authenticated API-provider fixture turns commit only guarded reversible draft operations after explicit user initiation and pass packaged isolated native tests
- one real turn applies a reversible draft edit through a guarded tool
- the edit survives reopen, rejects stale sequence requests, and can be undone through the shared engine; interrupted/incomplete transactions do not corrupt the committed draft
- raw protocol text stays out of normal UI
- `docs/workflow/results/P2.json` validates
