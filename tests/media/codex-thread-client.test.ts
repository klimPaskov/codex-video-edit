import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import { CodexProjectThreadClient } from "../../packages/codex-bridge/src/thread-client.ts";
import { CodexThreadProtocolError } from "../../packages/codex-bridge/src/thread-protocol.ts";
import { ProjectThreadRegistry } from "../../packages/codex-bridge/src/thread-registry.ts";
import type { ThreadStreamEvent } from "../../packages/codex-bridge/src/thread-stream.ts";
import { CodexTransportError } from "../../packages/codex-bridge/src/transport.ts";

const policy = {
  cwd: resolve("test-results", "codex-thread-context"),
  model: "runtime-model",
  effort: "high",
};

async function fixture() {
  const parent = resolve("test-results", "codex-thread-client");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, "fixture-"));
  const registry = await ProjectThreadRegistry.open(root);
  const events: ThreadStreamEvent[] = [];
  const calls: Array<{ method: string; params: unknown }> = [];
  let handler: (method: string, params: unknown) => Promise<unknown> = async (
    method,
    params,
  ) => {
    calls.push({ method, params: structuredClone(params) });
    if (method === "thread/start") return threadResponse("thread-1");
    throw new Error("Unexpected RPC");
  };
  const rpc = {
    request: (method: string, params: unknown) => handler(method, params),
  };
  let nextId = 0;
  const client = new CodexProjectThreadClient({
    rpc,
    generation: 1,
    projectId: "project-1",
    policy,
    registry,
    allowedMcpServer: "codex-video-edit",
    allowedMcpTools: new Set(["cut.trim_edge", "timeline.undo"]),
    onEvent: (event) => events.push(event),
    clientMessageId: () => `message-${++nextId}`,
  });
  return {
    root,
    registry,
    client,
    calls,
    events,
    setHandler: (
      next: (method: string, params: unknown) => Promise<unknown>,
    ) => {
      handler = async (method, params) => {
        calls.push({ method, params: structuredClone(params) });
        return next(method, params);
      };
    },
  };
}

function threadResponse(threadId: string) {
  return {
    thread: { id: threadId, ephemeral: false },
    model: policy.model,
    modelProvider: "openai",
    cwd: policy.cwd,
    approvalPolicy: "never",
    approvalsReviewer: "user",
    sandbox: { type: "readOnly", networkAccess: false },
  };
}

function turnResponse(turnId: string, status = "inProgress") {
  return { turn: { id: turnId, status, items: [] } };
}

test("typed client creates then resumes the one registry-owned project thread", async () => {
  const first = await fixture();
  try {
    await first.client.open();
    assert.equal(first.calls[0]?.method, "thread/start");
    assert.deepEqual(
      (first.calls[0]?.params as { environments: unknown }).environments,
      [],
    );
    const resumedCalls: Array<{ method: string; params: unknown }> = [];
    const resumed = new CodexProjectThreadClient({
      rpc: {
        request: async (method, params) => {
          resumedCalls.push({ method, params });
          return threadResponse("thread-1");
        },
      },
      generation: 2,
      projectId: "project-1",
      policy,
      registry: first.registry,
      allowedMcpServer: "codex-video-edit",
      allowedMcpTools: new Set(["cut.trim_edge"]),
    });
    await resumed.open();
    assert.equal(resumedCalls[0]?.method, "thread/resume");
    assert.equal("environments" in (resumedCalls[0]?.params as object), false);
  } finally {
    await rm(first.root, { recursive: true, force: true });
  }
});

test("unsubscribe closes an idle project conversation and keeps the registry binding", async () => {
  const fixtureState = await fixture();
  try {
    await fixtureState.client.open();
    fixtureState.setHandler(async (method, params) => {
      assert.equal(method, "thread/unsubscribe");
      assert.deepEqual(params, { threadId: "thread-1" });
      return { status: "unsubscribed" };
    });
    await fixtureState.client.close();
    assert.equal(
      await fixtureState.registry.threadForProject("project-1"),
      "thread-1",
    );
    assert.throws(
      () => fixtureState.client.notification("warning", {}),
      (error: unknown) =>
        error instanceof CodexThreadProtocolError &&
        error.code === "configuration",
    );
  } finally {
    await rm(fixtureState.root, { recursive: true, force: true });
  }
});

test("an active turn must reach authoritative completion before unsubscribe", async () => {
  const fixtureState = await fixture();
  try {
    await fixtureState.client.open();
    fixtureState.setHandler(async (method) => {
      if (method === "turn/start") return turnResponse("turn-running");
      assert.equal(method, "thread/unsubscribe");
      return { status: "notSubscribed" };
    });
    await fixtureState.client.startTurn({ text: "Keep editing" });
    await assert.rejects(
      fixtureState.client.close(),
      (error: unknown) =>
        error instanceof CodexThreadProtocolError &&
        error.code === "configuration",
    );
    assert.equal(
      fixtureState.calls.filter((call) => call.method === "thread/unsubscribe")
        .length,
      0,
    );
    fixtureState.client.notification("turn/completed", {
      threadId: "thread-1",
      turn: { id: "turn-running", status: "completed", items: [] },
    });
    await fixtureState.client.close();
  } finally {
    await rm(fixtureState.root, { recursive: true, force: true });
  }
});

test("notifications racing turn response are reduced in order from authoritative completion", async () => {
  const fixtureState = await fixture();
  const { client, events } = fixtureState;
  try {
    await client.open();
    fixtureState.setHandler(async (method, params) => {
      assert.equal(method, "turn/start");
      const request = params as {
        threadId: string;
        clientUserMessageId: string;
        environments: unknown[];
      };
      assert.equal(request.threadId, "thread-1");
      assert.equal(request.clientUserMessageId, "message-1");
      assert.deepEqual(request.environments, []);
      client.notification("turn/started", {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "inProgress", items: [] },
      });
      client.notification("item/started", {
        threadId: "thread-1",
        turnId: "turn-1",
        startedAtMs: 1,
        item: { type: "agentMessage", id: "item-1", text: "" },
      });
      client.notification("item/agentMessage/delta", {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        delta: "Draft saved to C:\\Users\\person\\private.mov",
      });
      client.notification("item/completed", {
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 2,
        item: {
          type: "agentMessage",
          id: "item-1",
          text: "The trim is committed. private@example.test",
        },
      });
      client.notification("turn/completed", {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "completed", items: [] },
      });
      return turnResponse("turn-1");
    });
    await client.startTurn({ text: "Trim the false start." });
    assert.deepEqual(
      events.map((event) => event.type),
      [
        "turn_started",
        "item_started",
        "message_delta",
        "item_completed",
        "turn_terminal",
      ],
    );
    assert.ok(!JSON.stringify(events).includes("Users"));
    assert.ok(!JSON.stringify(events).includes("example.test"));
    assert.match(JSON.stringify(events), /\[private path\]/u);
  } finally {
    await rm(fixtureState.root, { recursive: true, force: true });
  }
});

test("known rejected turn can retry with a fresh main-owned message id", async () => {
  const fixtureState = await fixture();
  try {
    await fixtureState.client.open();
    let attempts = 0;
    fixtureState.setHandler(async (method) => {
      assert.equal(method, "turn/start");
      if (++attempts === 1)
        throw new CodexTransportError("remote_error", -32602);
      return turnResponse("turn-retry");
    });
    await assert.rejects(
      fixtureState.client.startTurn({ text: "First attempt" }),
      (error: unknown) =>
        error instanceof CodexTransportError && error.code === "remote_error",
    );
    await fixtureState.client.startTurn({ text: "Explicit retry" });
    const turnCalls = fixtureState.calls.filter(
      (entry) => entry.method === "turn/start",
    );
    assert.equal(turnCalls.length, 2);
    assert.notEqual(
      (turnCalls[0]?.params as { clientUserMessageId: string })
        .clientUserMessageId,
      (turnCalls[1]?.params as { clientUserMessageId: string })
        .clientUserMessageId,
    );
  } finally {
    await rm(fixtureState.root, { recursive: true, force: true });
  }
});

test("interrupt waits for raced turn completion and does not fabricate status", async () => {
  const fixtureState = await fixture();
  try {
    await fixtureState.client.open();
    fixtureState.setHandler(async (method) => {
      if (method === "turn/start") return turnResponse("turn-running");
      assert.equal(method, "turn/interrupt");
      fixtureState.client.notification("turn/completed", {
        threadId: "thread-1",
        turn: { id: "turn-running", status: "interrupted", items: [] },
      });
      return {};
    });
    await fixtureState.client.startTurn({ text: "Long operation" });
    assert.equal(fixtureState.events.length, 0);
    await fixtureState.client.interrupt();
    const terminal = fixtureState.events.at(-1);
    assert.equal(terminal?.type, "turn_terminal");
    assert.equal(
      terminal?.type === "turn_terminal" ? terminal.status : null,
      "interrupted",
    );
  } finally {
    await rm(fixtureState.root, { recursive: true, force: true });
  }
});

test("approval and elicitation requests always decline or cancel then quarantine", async () => {
  for (const [method, expected] of [
    ["item/commandExecution/requestApproval", { decision: "decline" }],
    ["item/fileChange/requestApproval", { decision: "decline" }],
    [
      "mcpServer/elicitation/request",
      { action: "cancel", content: null, _meta: null },
    ],
  ] as const) {
    const fixtureState = await fixture();
    try {
      await fixtureState.client.open();
      fixtureState.setHandler(async () => turnResponse("turn-policy"));
      await fixtureState.client.startTurn({ text: "Inspect the draft" });
      const abort = new AbortController();
      const params =
        method === "mcpServer/elicitation/request"
          ? {
              threadId: "thread-1",
              turnId: "turn-policy",
              serverName: "codex-video-edit",
            }
          : {
              threadId: "thread-1",
              turnId: "turn-policy",
              itemId: "item-policy",
            };
      assert.deepEqual(
        fixtureState.client.serverRequest({
          id: 1,
          method,
          params,
          signal: abort.signal,
        }),
        expected,
      );
      assert.throws(
        () =>
          fixtureState.client.notification("turn/completed", {
            threadId: "thread-1",
            turn: { id: "turn-policy", status: "completed", items: [] },
          }),
        (error: unknown) =>
          error instanceof CodexThreadProtocolError &&
          error.code === "forbidden",
      );
    } finally {
      await rm(fixtureState.root, { recursive: true, force: true });
    }
  }
});

test("unsupported or uncorrelated server requests fail closed", async () => {
  const fixtureState = await fixture();
  try {
    await fixtureState.client.open();
    fixtureState.setHandler(async () => turnResponse("turn-policy"));
    await fixtureState.client.startTurn({ text: "Inspect the draft" });
    const signal = new AbortController().signal;
    assert.throws(
      () =>
        fixtureState.client.serverRequest({
          id: "request-1",
          method: "item/permissions/requestApproval",
          params: {},
          signal,
        }),
      (error: unknown) =>
        error instanceof CodexThreadProtocolError && error.code === "forbidden",
    );
  } finally {
    await rm(fixtureState.root, { recursive: true, force: true });
  }
});
