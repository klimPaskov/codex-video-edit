---
name: codex-app-server
description: Integrate real Codex app-server, ChatGPT auth, models, skills, threads, and guarded editing tools.
---

# Codex app-server integration

## Use when

Changing AI login, model selection, skills, threads, streaming, interruption, approvals, or media-edit tools.

## Requirements

- Official Codex app-server only.
- Stdio JSONL transport.
- Initialize handshake before other requests.
- Generate protocol types from the pinned binary.
- Retain exact generation hashes and licensing; normalize imports/formatting reproducibly without changing type shapes. Check nullable/omitted wire fields against the pinned JSON schema rather than assuming TypeScript requiredness is a wire invariant.
- ChatGPT-managed login in the first release.
- Runtime `model/list` and `skills/list` discovery.
- Durable project thread and turn streaming.
- Safe restart, resume, interrupt, and rate-limit handling.
- Close must settle startup and process shutdown before reconnecting against the same account directory. Never replay requests whose outcome became uncertain after timeout or disconnection.
- Explicit skill input items when a known skill is used.
- Guarded codex-video-edit MCP tools with validated transactions.

Generate the thread/turn/MCP-status closure with the pinned binary's `--experimental`
flag when those methods are consumed. Bind request objects to the generated input types
and validate the security-relevant response fields before projection. Treat the response
`sandbox` as the generated policy object and require `{ type: "readOnly",
networkAccess: false }`; the request-side legacy mode remains `"read-only"`.

The guarded tool layer must resolve its active project and draft in the main process. Tool
arguments contain only bounded edit intent plus exact freshness preconditions; they never
contain project paths, arbitrary operation objects, origin, export, deletion, cleanup,
network, shell, or permission expansion. Read tools return compact editor state. Mutation
tools call the same transaction service as manual and Magic Wand edits, and return the
committed draft sequence and timeline hash. Errors are stable, redacted application errors.

For the pinned experimental thread protocol, request experimental capability during
initialize, send the reviewed main-owned environment/tool policy on thread and turn start,
and omit start-only fields on resume. Treat streamed terminal events as authoritative,
correlate them to the active thread and turn, and make retry a new turn with a new request
identity. Native subagents are represented only by app-server collaboration items; do not
invent a separate spawn RPC.

Run the MCP child as a packaged fixed-hash resource. It forwards only tool name/input
to a main-owned active-project broker authenticated by a process-only random secret.
Verify the exact server name, version, four tool names and input schemas, and empty resources/templates
through `mcpServerStatus/list` before opening a project thread. Never put the broker
secret in app-server arguments, thread configuration, project files, renderer state, or
evidence.

## Runtime boundary

Codex receives project context and edit tools. It does not receive unrestricted access to the installation, source repository, raw source mutation, project deletion, or export confirmation.

## Validation

- fake transport unit tests
- protocol compatibility tests
- real authenticated smoke test when access exists
- verify a Codex edit changes only the active draft
- verify stop, undo, reconnect, stale transaction, and rate-limit behavior

## Never

Simulate successful Codex output in a production path or hardcode one current model name as the catalog.

Account type alone does not prove managed-token provenance. Restrict the actual login entrypoint and account-directory ownership. Before enabling turns, verify the pinned no-environment/tool policy, guarded MCP access and native child inheritance; a disabled shell feature or read-only sandbox alone is not a complete project read boundary. Bootstrap stdio tests cannot replace native sign-in and authenticated reversible-edit evidence.

## Authorized live operations

Apply authorized reversible active-draft transactions during the turn without repeated material-change confirmation. Magic Wand, Codex and manual edits share undo history. Export preparation may stage settings without confirmation but cannot start final export. Keep source deletion, cleanup, spending, publication and final export under explicit user action; handle native server approvals separately. Test both authorization and forbidden-effect boundaries.

## Packaged account/settings validation

Resolve only main-owned fixed packaged resources and verify the pinned runtime manifest, binary and licence before connection. Keep the official runtime outside ASAR and out of Git; preserve licensing in private packaged builds. A content hash is not a release signature. Test missing, damaged and redirected resources without launching test fixture bytes.

Managed browser-login URLs stay in main and require exact pinned origin/path and OAuth parameter checks before external launch. Correlate attempt/connection identity; reconcile account state after completion, cancellation and replacement. Cancel incomplete login when the browser cannot open. Never expose raw errors, login URLs, codes or credentials in ordinary UI/evidence. Signed-out start/cancel checks do not prove authentication. Isolated tests must never open the user host browser.

Keep Appearance and Codex settings in one modal with one selected section. Persist model/reasoning choices only after runtime validation, distinguish application preferences from later project/turn settings, and show usage only from actual returned limits. Verify native focus, cancellation, reconnect, persistence and failure states before claiming the settings slice works.
