# P2 Codex runtime policy research

Date: 2026-09-08. Scope: official Codex `0.142.3`, source tag `rust-v0.142.3`, and the protocol generated from the installed unmodified runtime. This began as a source review and proposed integration policy. A 2026-09-12 implementation update records signed-out packaged validation separately; no managed login, model turn, credential read, authenticated tool invocation, or Codex media edit is claimed.

## Authentication and provider

The pinned [configuration schema](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core/config.schema.json) supports `forced_login_method = "chatgpt"` and `model_provider = "openai"`. Built-in provider IDs cannot be replaced through `model_providers`. The stable generated `ThreadStartParams` supports `modelProvider`, `sandbox`, `approvalPolicy`, `config`, `cwd`, and `ephemeral`.

The pinned [account processor](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/app-server/src/request_processors/account_processor.rs#L283) rejects API-key login when the forced method is ChatGPT. This restriction does **not** itself distinguish managed ChatGPT login from externally supplied ChatGPT tokens: the external-token path rejects forced API mode, not forced ChatGPT mode. The product must expose only the managed ChatGPT login variants and must never forward arbitrary login payloads or accept access tokens through its renderer IPC.

Use a product-owned Codex home and an explicit child environment, without inherited provider credentials, endpoint overrides, unrelated MCP servers, plugins, or host runtime configuration. Keep credential ownership with the official runtime. Treat account metadata as status only; do not read or copy the credential store. Pin the provider on thread creation/resume and validate returned state before allowing turns. The production client now applies these fixed boundaries and validates them in signed-out/package tests; authenticated model behavior remains unverified.

## Environment access and built-in tools

`features.shell_tool = false` is supported. The pinned [tool configuration](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/tools/src/tool_config.rs#L81) maps this flag to `ConfigShellToolType::Disabled`.

It is insufficient to infer that `features.apply_patch_freeform = false` removes file mutation tools. The current [tool planner](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core/src/tools/spec_plan.rs#L741) registers `apply_patch` when an environment exists and the selected model supports it. The same planner registers `view_image` whenever an environment exists. Read-only sandboxing alone is not a project-scoped read boundary.

The pinned experimental protocol provides a stronger mechanism:

- [`thread/start.environments`](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/app-server-protocol/src/protocol/v2/thread.rs#L109): an empty array disables environment access for turns without an override.
- [`turn/start.environments`](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/app-server-protocol/src/protocol/v2/turn.rs#L87): an empty array disables environment access and updates the thread's sticky selection.
- The [thread processor](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/app-server/src/request_processors/thread_processor.rs#L1115) supplies default environments only when the selection is omitted.
- The upstream [`environment_count_controls_environment_backed_tools` test](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core/src/tools/spec_plan_tests.rs#L600) asserts that no-environment turns have neither visible nor registered `shell_command`, `exec_command`, `apply_patch`, or `view_image`, even with the shell feature enabled and a patch-capable model.

The stable schemas initially generated under private test evidence omit these experimental properties. The implementation regenerated TypeScript/JSON with `--experimental` from the same pinned binary, retained the complete output privately, and pins a reviewed 205-type dependency closure by original hashes. Request objects compile against the generated inputs, and the signed-out packaged server accepts `initialize.capabilities.experimentalApi` plus the owned MCP configuration. A signed-out startup cannot exercise `thread/start` or `turn/start`, so live no-environment acceptance remains an authenticated gate. Experimental compatibility is a versioned product dependency.

The implemented request policy is `modelProvider: "openai"`, request-side `sandbox: "read-only"`, `approvalPolicy: "never"`, `ephemeral: false`, and `environments: []`, with an app-owned working directory and fixed instruction. It sets `environments: []` again on every turn, including the first turn after resume. The renderer cannot supply overrides. The generated response sandbox is validated as `{ type: "readOnly", networkAccess: false }`. Read-only and never-approval remain defense in depth; never-approval is not a prohibition on all tools. Server requests for command execution, file change, legacy approvals, or MCP elicitation are declined or cancelled and quarantine the connection.

## Guarded MCP and native subagents

The pinned schema supports `mcp_servers.<name>.command`, `args`, `cwd`, `env`, `enabled`, `required`, `enabled_tools`, `disabled_tools`, `supports_parallel_tool_calls`, and startup/tool timeouts. Use only the product-owned server, an explicit tool allowlist, and no project-controlled command or environment values. Each allowed edit tool must authenticate its application session and validate project identity, draft sequence, operation schema, and authorization through the shared transaction engine. Do not expose final export, deletion, cleanup, publication, or spending as generically authorized tools.

The [MCP tool planner](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core/src/tools/spec_plan.rs#L861) adds discovered MCP handlers separately from environment-backed built-ins. The packaged signed-out runtime now starts the fixed-hash owned child and verifies its exact four-tool name/schema inventory with empty resources/templates through `mcpServerStatus/list`. Direct child/broker tests cover bounded authenticated forwarding into the main-owned transaction service. Authenticated model invocation and edit execution with empty turn environments remain outstanding.

`features.multi_agent` and `features.multi_agent_v2` exist in the pinned configuration schema. The [collaboration planner](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core/src/tools/spec_plan.rs#L768) exposes native collaboration tools independently of environment access. Choose and test one supported runtime surface; do not fabricate a separate subagent API or infer that enabling a feature guarantees availability for every model.

Both the [v1 spawn handler](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core/src/tools/handlers/multi_agents/spawn.rs#L120) and [v2 spawn handler](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs#L107) pass the parent's environment selections to children. [Shared spawn configuration](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core/src/tools/handlers/multi_agents_common.rs#L220) clones the current configuration and provider, then reapplies approval and permission state. Restrict role configuration to reviewed application-owned files; live child-policy and guarded-tool inheritance still require tests.

The experimental `multiAgentMode` request property is deprecated and ignored in this version. Its source directs proactive behavior through Ultra effort; it is not an enforcement control. Product instructions and authorization must remain separate from this deprecated property and from model choice.

## Required validation before relying on this policy

- Generate both intended protocol surfaces from the pinned binary and verify experimental negotiation, empty-environment thread creation, resume, and turn dispatch.
- Verify effective account/provider/config values without exposing credentials, raw protocol logs, or private context to the renderer.
- Exercise forbidden built-in file/process tools and demonstrate they are unavailable, including in a native child agent; absence from a UI is insufficient.
- Demonstrate the owned MCP server and allowed skills remain usable, with no unrelated tools or context discovered.
- Complete an authenticated reversible fixture edit, stale sequence rejection, interruption, reconnect, durable commit recovery, and shared undo. Source review and unauthenticated discovery cannot substitute for these checks.

Signed-out packaged startup proves experimental initialization and the owned MCP name/schema inventory. It does not prove live empty-environment thread/turn acceptance, the effective authenticated model tool set, guarded tool use by a model, subagent inheritance, or the real edit workflow. No phase completion is claimed here.

## Account-settings skill discovery

The settings client now sets `project_root_markers=[]` so the pinned [skill root finder](https://github.com/openai/codex/blob/rust-v0.142.3/codex-rs/core-skills/src/loader.rs#L405) stops repository-scope discovery at its app-owned context. A dedicated HOME alone does not restrict ancestor repository skills. The native test also keeps its account/context outside the source workspace. Runtime home, system and configured extra skill roots remain separate mechanisms; this does not establish a complete skill allowlist or authenticated conversation confinement.
