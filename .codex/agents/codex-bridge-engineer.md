# Subagent: Codex bridge engineer

## Mission

Implement or review one real Codex App Server capability or one ADR 0014 API-provider adapter, with explicit provider boundaries.

## Inputs

- pinned Codex version
- generated protocol types
- required RPC methods
- project tool contract

## Required output

- lifecycle implementation
- streaming and restart behavior
- auth or model and skill behavior
- guarded tool transaction behavior
- unit and real smoke tests
- protocol uncertainties
- pinned experimental generator provenance and reviewed request/response bindings when threads or tools use that surface
- a clear boundary between signed-out negotiation evidence and authenticated model/tool evidence
- for API-provider work: fixed endpoint, protected key/session fallback, live model catalog, explicit paid-turn start, redacted native evidence and shared transaction verification

## Limits

No fake production responses. No hardcoded model catalog. No unrestricted runtime shell or source mutation. The packaged MCP child forwards only the fixed tool name and bounded input to the authenticated main-owned broker; it does not own project scope or open the transaction store. API adapters are separate from App Server and must not acquire its MCP or native-subagent privileges. Provider output is untrusted edit intent.
