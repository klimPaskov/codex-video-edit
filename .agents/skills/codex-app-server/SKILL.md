---
name: codex-app-server
description: Integrate real Codex app-server, ChatGPT auth, models, skills, threads, and guarded editing tools.
---

# Codex app-server integration

## Use when

Changing AI login, model selection, skills, threads, streaming, interruption, approvals, or media-edit tools.

## Requirements

- Official Codex app-server for the Codex subscription path; ADRs 0014 and 0015 add separate fixed-endpoint OpenAI API, DeepSeek and Gemini API adapters, never a substitute Codex transport.
- Stdio JSONL transport.
- Initialize handshake before other requests.
- Generate protocol types from the pinned binary.
- Retain exact generation hashes and licensing; normalize imports/formatting reproducibly without changing type shapes. Check nullable/omitted wire fields against the pinned JSON schema rather than assuming TypeScript requiredness is a wire invariant.
- ChatGPT-managed Codex login in the first release, distinct from optional API-provider keys and billing.
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

On thread create and resume, append only main-owned validated `project_id` and `schema_version: "1.0"` as JSON read-tool input in developer instructions. Do not inject project paths, titles or a draft snapshot, or ask the user/model to guess the identifier. Test both create and resume context against the selected project. The read tools must still establish current draft identity, sequence and hash; injected identity never replaces active-project authorization or freshness validation.

Read project metadata and the active draft in one transaction-store serialization. After every settled mutation, reread and publish the authoritative path-free draft even when journal promotion preceded an uncertain response. Do not derive editor state from model text or MCP activity. Bind project preview requests to draft ID, baseline revision, sequence and timeline hash; map output time to source time only in main, recheck the head after decode, and return no stale pixels.

For the pinned experimental thread protocol, request experimental capability during
initialize, disable native collaboration in the current 0.155.1 app-server and thread configuration until inherited tool confinement can be verified, and send the reviewed main-owned environment/tool policy on thread and turn start,
and omit start-only fields on resume. Treat streamed terminal events as authoritative,
correlate them to the active thread and turn, and make retry a new turn with a new request
identity. Earlier 0.142.3 native collaboration evidence is historical; feature flags or model text alone do not prove a current child exists or inherited policy. If native collaboration is safely restored in a future runtime, require a permitted non-Astra model, a fresh child turn and correlated owned read-tool call before claiming support. Persisted rollout `response_item` spawn call/output plus `thread/read` child parent/source and child-owned tool history can establish this even when `thread/turns/list` omits a collaboration item. Keep raw rollout private; do not invent a separate spawn RPC.

App Server broadcasts child-thread notifications on the parent transport. Filter ordinary events for another validated thread identity before parent buffering/projection; keep malformed identities and forbidden notification methods fail-closed. The parent drawer may show only generic collaboration activity. Verify parent spawn and child read-tool history from the authoritative server privately; do not project child transcript, IDs, arguments or results into the renderer.

Restore recent project-thread history from the bounded inline full-turn page, with one exact newest-first `thread/turns/list` fallback when the inline page is absent. Validate the page, cursors, unique turn/item IDs, count/byte limits, item unions, required supported resume thread status, inline activity agreement, and newest-only in-progress turn before flushing buffered notifications. Treat a separate fallback page as the later authority so completion between resume and list remains valid. Project only redacted user/agent text and generic owned activity in chronological order under fresh renderer IDs. Preserve known completion state, seed every active-turn item for raced notifications, and ignore validated skill paths. Quarantine command/file/web/image/dynamic/foreign-MCP/unknown or approval-waiting history; never expose raw history, cursors, server IDs, paths, arguments, results, or reasoning through IPC.

Track and validate live user-message echoes without emitting a duplicate message or an empty Codex reply; main already owns the submitted user text. Compare live and resumed message projections in native tests. Label owned summary tools Reading the project and trim/undo Applying an edit; activity is not a commit assertion. Verify actual journal origin/sequence, duration, retained source-frame preview and immutable baseline separately, then complete live timing, Stop, reopen/history and undo checks before claiming the full authenticated flow.

Run the MCP child as a packaged fixed-hash resource. It forwards only tool name/input
to a main-owned active-project broker authenticated by a process-only random secret.
Verify the exact server name, version, six tool names and input schemas, and empty resources/templates
through `mcpServerStatus/list` before opening a project thread. Never put the broker
secret in app-server arguments, thread configuration, project files, renderer state, or
evidence.

For pinned Codex 0.142.3, the exact six owned server tools and empty resources/templates do not establish absence of built-in MCP resource listing/template/read helpers. The upstream turn router and tool planner register those helpers whenever an MCP server exists, independently of empty environments; no supported disabling switch was found in the pinned schema review. Preserve quarantine for unreviewed items, including those helpers under the current policy. Do not invent a configuration key, silently widen parser acceptance, or treat injected project identity as tool confinement. See `docs/research/P2_RUNTIME_POLICY.md` for pinned sources and the observed failure.

A separate direct 0.155.1 App Server probe in `tests/native/codex-dynamic-tools-probe.test.ts` found that a namespaced host-defined dynamic tool can be called without an MCP server, with one owned-only bounded `ALL_TOOLS` inventory. `item/tool/call.params.tool` used the bare function name even though code mode used the namespace-qualified identifier. Treat this as protocol feasibility only. Before routing production project threads through dynamic tools, validate the exact namespace/name mapping, active thread and turn, arguments, response bounds, persisted resume behavior, existing MCP-backed thread compatibility, shared transaction commit/Undo and packaged native behavior. Do not remove the functioning MCP path or claim P2-07 complete from this direct probe.

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

Account type alone does not prove managed-token provenance. Restrict the actual login entrypoint and account-directory ownership. Before enabling turns, verify the pinned no-environment/tool policy, guarded MCP access, and that native children are disabled or have proven inherited confinement; a disabled shell feature or read-only sandbox alone is not a complete project read boundary. Bootstrap stdio tests cannot replace native sign-in and authenticated reversible-edit evidence.

ADR 0006 records the user's explicit authorization to seed this session's private app-owned guest account with only the official runtime credential file, mode 600. This test setup exception does not change production managed ChatGPT onboarding, add a credential-import feature, permit renderer token input, or authorize copying configuration/history or mounting a host account directory. Never expose credential bytes, account identifiers or private locations. A seeded connected/signed_in probe with runtime model/skill/usage discovery is authenticated discovery evidence, not browser-login completion. Real private-fixture turns, guarded reversible edits, interruption, history reopen, stale rejection, shared undo and native child-policy checks remain separate acceptance tests.

A packaged signed-out test now opens the real OpenAI login page in an isolated guest-local Chromium browser and returns to signed out after cancellation. Count it only as browser opener/cancel evidence. The optional official `chatgptDeviceCode` path uses a fresh App Server login attempt and exposes only the fixed `https://auth.openai.com/codex/device` page and bounded one-time code in the active Settings panel. Main owns the fixed external page action; the renderer cannot supply a destination. Clear the code on cancellation, completion, failure, reconnect and panel close. A separate inspected packaged guest attempt received official completion after the user verified externally, reconciled to signed in, cleared the code, and reopened with authoritative account, plan, model and skill reads. This verifies managed device-code completion in the tested runtime. The browser OAuth callback route remains unverified, and the authorized credential seed must never be counted as proof of either managed route.

## Authorized live operations

Apply authorized reversible active-draft transactions during the turn without repeated material-change confirmation. Magic Wand, Codex and manual edits share undo history. Export preparation may stage settings without confirmation but cannot start final export. Keep source deletion, cleanup, spending, publication and final export under explicit user action; handle native server approvals separately. Test both authorization and forbidden-effect boundaries.

For an API-provider turn, require an explicit user start action because that call may incur provider charges. Once started, validated reversible edits may commit during the turn without repeated per-edit approval. API-provider output is untrusted intent; only main's shared transaction service commits it. Do not infer Codex skills, threads, subagents or subscription usage for another provider. Keep provider model catalogs and capability labels separate. A `/models` listing proves account membership, not Chat Completions or tool compatibility: intersect live IDs with the adapter's reviewed model families, and report an empty supported subset instead of offering base, embedding, audio, or untested reasoning models.

For a remembered API key, save its selected model in the same OS-protected key record and revalidate that ID against fresh provider discovery on restart. A key replacement must clear the previous selection even when the new account offers the same model. Keep session-only model selection in memory only, and migrate older key-only ciphertext without exposing the key. Do not count fake secure-storage tests as native OS-keyring acceptance. The packaged Linux GNOME Secret Service test in `tests/native/api-provider-remembered-model.test.ts` verifies this one backend and live OpenAI catalog only; retain separate evidence gates for other OS backends and providers. A separate session-only DeepSeek run proved one paid guarded edit, not remembered-key behavior.

The synthetic packaged API-provider draft fixture must run OpenAI, DeepSeek and Gemini separately. It may replace `fetch` only inside isolated Electron main after startup; each run must assert its fixed destinations, a synthetic key, the real imported project, committed journal/preview/undo and no external completion. Gemini 3 fixtures must assert exact thought-signature replay within the tool loop and absence from persisted/renderer state. Label visible responses as synthetic and keep authenticated paid-provider edit acceptance separate. The pinned Codex 0.155.1 runtime explicitly disables its plan, user-input and native-agent tools, but the owned MCP server still exposes resource helpers without a released exact effective-tool allowlist. Require authoritative parent/child effective tool specifications before P2-07 acceptance.

For a live API-key fixture, make the explicit Send through packaged Electron and record only bounded HTTP status classifications in private evidence. A 429 may mean rate or quota; map it to fixed redacted recovery text, require no journal commit unless a validated tool succeeds, and stop paid retries until account state changes. Synthetic 429 injection can verify native error presentation but cannot satisfy authenticated edit acceptance.

Classify generation-time 401/403 as a separate API-connection failure after a key was initially connected. Show fixed key/account-access recovery text without inferring its precise provider cause, preserve the submitted request, and keep raw response material out of the thread. The live fixture harness accepts OpenAI, DeepSeek or Gemini only with that provider's private mode-600 key file; a synthetic 401/403 native pass is not authenticated edit evidence. Gemini 3 live acceptance also requires exact transient thought-signature replay with no signature bytes in evidence. No Gemini key has been supplied.

## Packaged account/settings validation

Resolve only main-owned fixed packaged resources and verify the pinned runtime manifest, binary and licence before connection. Keep the official runtime outside ASAR and out of Git; preserve licensing in private packaged builds. A content hash is not a release signature. Test missing, damaged and redirected resources without launching test fixture bytes.

Managed browser-login URLs stay in main and require exact pinned origin/path and OAuth parameter checks before external launch. Device-code login returns only the exact fixed verification page and bounded code from the official runtime; opening that page is a second main-owned action. Correlate attempt/connection identity; reconcile account state after completion, cancellation and replacement. Cancel incomplete login when the browser cannot open. Never expose raw errors, login URLs, codes or credentials outside the active Settings attempt or in public evidence. Signed-out start/cancel checks do not prove authentication. Require the official completion, reconciled signed-in account and a packaged reopen before claiming the managed route. Isolated tests must never open the user host browser.

Keep Appearance and Codex settings in one modal with one selected section. Persist model/reasoning choices only after runtime validation, distinguish application preferences from later project/turn settings, and show usage only from actual returned limits. Verify native focus, cancellation, reconnect, persistence and failure states before claiming the settings slice works.

A live stale-draft native check must distinguish an MCP tool rejection from an RPC failure: the pinned server records a rejected guarded call as a failed `mcpToolCall` item whose result contains the safe application error. Require that persisted call, the obsolete sequence/hash, unchanged draft/journal/source/baseline, and a completed turn before marking live relay verified. A direct guarded-service call proves only the service boundary.

Do not infer tool-search or v1 spawn non-use from `thread/turns/list`: the pinned `v2/ThreadItem` union omits search items, and rollout policy filters v1 collaboration events while persisting function calls and outputs. For a negative native policy probe, correlate the exact turn ID to a bounded account-confined private rollout and classify all raw response-item call and unknown variants without exposing payloads. This can establish no invocation in that turn, not complete catalog unavailability. Correlate a private parent rollout's completed `spawn_agent` call/output with the child ID, `thread/read` parent/source, child-owned tool history and parent/child turn policy. A missing collaboration item alone proves neither presence nor absence. Never expose raw payloads through renderer IPC or claim a complete model-visible catalog from request flags or model metadata.

The pinned runtime is now official Codex 0.155.1 with the matching `codex-code-mode-host` companion. For a fresh ChatGPT account without a saved preference, select `gpt-5.6-luna` and `high` only when the live runtime catalog offers that exact pair. Preserve a previously saved, still-valid user choice. If Luna/high is unavailable, leave the selection unset and present an actionable Settings message; never invent catalog entries. In code mode, test the model-visible namespace in a real packaged turn. Disable unrelated apps, external tool namespaces and native child agents until an effective per-turn restriction is proven. Do not spawn Astra agents.
