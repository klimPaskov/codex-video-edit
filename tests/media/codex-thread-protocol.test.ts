import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildExperimentalInitialize,
  buildThreadResumeRequest,
  buildThreadStartRequest,
  buildTurnInterruptRequest,
  buildTurnStartRequest,
  CodexThreadProtocolError,
  decodeThreadSession,
  decodeTurnInterrupt,
  decodeTurnStart,
} from "../../packages/codex-bridge/src/thread-protocol.ts";

const cwd = resolve("test-results", "codex-thread-context");
const policy = {
  cwd,
  model: "runtime-discovered-model",
  effort: "high",
  baseInstructions: "Edit only through the guarded video tools.",
  developerInstructions: "Keep source media immutable.",
};

test("experimental initialization and no-environment requests are exact", () => {
  assert.deepEqual(buildExperimentalInitialize("0.0.0"), {
    clientInfo: {
      name: "codex_video_edit",
      title: "codex-video-edit",
      version: "0.0.0",
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
      mcpServerOpenaiFormElicitation: false,
      optOutNotificationMethods: [],
    },
  });

  assert.deepEqual(buildThreadStartRequest(policy), {
    model: "runtime-discovered-model",
    modelProvider: "openai",
    cwd,
    runtimeWorkspaceRoots: [],
    approvalPolicy: "never",
    approvalsReviewer: "user",
    sandbox: "read-only",
    config: {
      forced_login_method: "chatgpt",
      model_provider: "openai",
      project_root_markers: [],
      features: { shell_tool: false },
    },
    ephemeral: false,
    environments: [],
    selectedCapabilityRoots: [],
    experimentalRawEvents: false,
    baseInstructions: policy.baseInstructions,
    developerInstructions: policy.developerInstructions,
  });

  const resume = buildThreadResumeRequest("thread-1", policy);
  assert.deepEqual(resume, {
    threadId: "thread-1",
    model: "runtime-discovered-model",
    modelProvider: "openai",
    cwd,
    runtimeWorkspaceRoots: [],
    approvalPolicy: "never",
    approvalsReviewer: "user",
    sandbox: "read-only",
    config: {
      forced_login_method: "chatgpt",
      model_provider: "openai",
      project_root_markers: [],
      features: { shell_tool: false },
    },
    excludeTurns: true,
    initialTurnsPage: {
      limit: 100,
      sortDirection: "desc",
      itemsView: "full",
    },
    baseInstructions: policy.baseInstructions,
    developerInstructions: policy.developerInstructions,
  });
  assert.equal("environments" in resume, false);

  assert.deepEqual(
    buildTurnStartRequest(
      "thread-1",
      "message-1",
      {
        text: "Tighten this section.",
        skills: [
          { name: "timeline-editor", path: resolve("skills", "timeline") },
        ],
      },
      policy,
    ),
    {
      threadId: "thread-1",
      clientUserMessageId: "message-1",
      input: [
        { type: "text", text: "Tighten this section.", text_elements: [] },
        {
          type: "skill",
          name: "timeline-editor",
          path: resolve("skills", "timeline"),
        },
      ],
      environments: [],
      cwd,
      runtimeWorkspaceRoots: [],
      approvalPolicy: "never",
      approvalsReviewer: "user",
      sandboxPolicy: { type: "readOnly", networkAccess: false },
      model: policy.model,
      effort: policy.effort,
    },
  );
  assert.deepEqual(buildTurnInterruptRequest("thread-1", "turn-1"), {
    threadId: "thread-1",
    turnId: "turn-1",
  });
});

test("thread and turn decoders expose only correlated identifiers", () => {
  const raw = {
    thread: { id: "thread-1", ephemeral: false, rolloutPath: "C:\\private" },
    model: policy.model,
    modelProvider: "openai",
    cwd,
    approvalPolicy: "never",
    approvalsReviewer: "user",
    sandbox: "read-only",
    privateAccount: "SECRET",
  };
  assert.deepEqual(decodeThreadSession(raw, policy), { threadId: "thread-1" });
  assert.deepEqual(
    decodeTurnStart({
      turn: {
        id: "turn-1",
        status: "inProgress",
        items: [],
        privateField: "SECRET",
      },
    }),
    { turnId: "turn-1", status: "inProgress" },
  );
  assert.equal(decodeTurnInterrupt({}), undefined);
  assert.throws(
    () => decodeTurnInterrupt({ threadId: "leak" }),
    CodexThreadProtocolError,
  );

  for (const response of [
    { ...raw, modelProvider: "private-provider" },
    { ...raw, sandbox: "workspace-write" },
    { ...raw, approvalsReviewer: "auto_review" },
    { ...raw, thread: { id: "thread-1", ephemeral: true } },
  ]) {
    assert.throws(
      () => decodeThreadSession(response, policy),
      CodexThreadProtocolError,
    );
  }
  assert.throws(
    () => decodeTurnStart({ turn: { id: "turn-1", status: "unknown" } }),
    CodexThreadProtocolError,
  );
});

test("builders reject renderer-style policy and identifier overrides", () => {
  for (const invalid of [
    { ...policy, cwd: "relative" },
    { ...policy, model: "" },
    { ...policy, developerInstructions: "\0" },
  ]) {
    assert.throws(
      () => buildThreadStartRequest(invalid),
      CodexThreadProtocolError,
    );
  }
  assert.throws(
    () => buildTurnStartRequest("", "message-1", { text: "edit" }, policy),
    CodexThreadProtocolError,
  );
  assert.throws(
    () => buildTurnStartRequest("thread-1", "message-1", { text: "" }, policy),
    CodexThreadProtocolError,
  );
  assert.throws(
    () =>
      buildTurnStartRequest(
        "thread-1",
        "message-1",
        { text: "edit", cwd: "renderer-choice" } as never,
        policy,
      ),
    CodexThreadProtocolError,
  );
  assert.throws(
    () =>
      buildThreadStartRequest({
        ...policy,
        approvalPolicy: "on-request",
      } as never),
    CodexThreadProtocolError,
  );
});
