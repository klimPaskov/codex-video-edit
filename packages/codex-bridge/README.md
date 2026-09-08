# packages/codex-bridge

The implemented bootstrap client starts the official Codex 0.142.3 native executable over bounded stdio JSONL, initializes once, reads account metadata and discovers local skills. Model discovery requires a ChatGPT account response and uses the runtime catalog with bounded pagination. The client exposes no generic RPC or edit operation to the renderer. Typed protocol inputs come from the pinned generator; consumed response fields are bounded and mapped without credentials or raw payloads.

The transport owns process lifetime, fixed safe errors, request matching and fail-closed server requests. Close waits for startup and process cleanup before reconnect; requests are never replayed. Tests may use a separate fake child, but the production client requires the exact official version. Main chooses a dedicated context and account directory and passes an environment allowlist; host account files are not copied.

This is the P2 runtime prerequisite. Native sign-in controls, rate limits, durable threads/streaming, guarded MCP transactions and the authenticated edit are still required. A real unauthenticated server test does not establish native-window or P2 acceptance.

Generate types with the pinned binary inside the isolated guest, transfer the generated text privately, then run `python scripts/sync_codex_types.py <generated-ts-directory>`. It verifies the reviewed dependency closure in `docs/contracts/codex-protocol.json`, adds explicit TypeScript import extensions and applies the pinned formatter. `--check` verifies the published copy without modifying it. Preserve original generated output privately. Upstream type shapes are unchanged; Apache-2.0 terms are retained in `licenses/CODEX-APACHE-2.0.txt`.
