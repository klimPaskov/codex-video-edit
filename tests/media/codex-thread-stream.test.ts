import assert from "node:assert/strict";
import test from "node:test";
import {
  ThreadStreamProjector,
  threadStreamInternals,
} from "../../packages/codex-bridge/src/thread-stream.ts";
import { CodexThreadProtocolError } from "../../packages/codex-bridge/src/thread-protocol.ts";

function projector(): ThreadStreamProjector {
  return new ThreadStreamProjector({
    experimentalApiNegotiated: true,
    generation: 7,
    threadId: "thread-1",
    allowedMcpServer: "codex-video-edit",
    allowedMcpTools: new Set(["draft.trim"]),
  });
}

test("stream correlation ignores stale generations and rejects divergent lifecycle", () => {
  const stream = projector();
  assert.equal(stream.beginTurn(6, "stale"), null);
  assert.deepEqual(
    stream.observe(7, "turn/started", {
      threadId: "thread-1",
      turn: { id: "turn-1", status: "inProgress", items: [] },
    }),
    {
      type: "turn_started",
      generation: 7,
      threadId: "thread-1",
      turnId: "turn-1",
    },
  );
  assert.equal(stream.beginTurn(7, "turn-1"), null);
  assert.throws(
    () =>
      stream.observe(7, "turn/started", {
        threadId: "thread-1",
        turn: { id: "turn-2", status: "inProgress", items: [] },
      }),
    (error: unknown) =>
      error instanceof CodexThreadProtocolError && error.code === "protocol",
  );
  assert.throws(
    () => stream.observe(7, "account/updated", {}),
    (error: unknown) =>
      error instanceof CodexThreadProtocolError && error.code === "forbidden",
  );
});

test("message projection is bounded and strips paths, credentials and email", () => {
  const stream = projector();
  stream.beginTurn(7, "turn-1");
  stream.observe(7, "item/started", {
    threadId: "thread-1",
    turnId: "turn-1",
    startedAtMs: 1,
    item: { id: "message-1", type: "agentMessage", text: "" },
  });
  const event = stream.observe(7, "item/agentMessage/delta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "message-1",
    delta:
      "Opened C:\\Users\\person\\secret.txt for private@example.test using sk-abcdefghijklmnop.",
  });
  assert.equal(event?.type, "message_delta");
  assert.ok(!JSON.stringify(event).includes("Users"));
  assert.ok(!JSON.stringify(event).includes("private@example"));
  assert.ok(!JSON.stringify(event).includes("sk-"));
  assert.match(JSON.stringify(event), /private path/u);
  assert.deepEqual(
    stream.observe(7, "item/completed", {
      threadId: "thread-1",
      turnId: "turn-1",
      completedAtMs: 2,
      item: {
        id: "message-1",
        type: "agentMessage",
        text: "Saved C:\\Users\\person\\secret.txt.",
      },
    }),
    {
      type: "item_completed",
      generation: 7,
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "message-1",
      kind: "message",
      text: "Saved [private path]",
    },
  );
  assert.throws(
    () => threadStreamInternals.redactText("x".repeat(16 * 1024 + 1)),
    CodexThreadProtocolError,
  );
});

test("forbidden items and unowned MCP calls fail closed without raw projection", () => {
  for (const item of [
    { id: "command-1", type: "commandExecution", command: "type secret" },
    {
      id: "mcp-1",
      type: "mcpToolCall",
      server: "unowned-server",
      tool: "draft.trim",
      arguments: { path: "C:\\private" },
      status: "inProgress",
    },
  ]) {
    const stream = projector();
    stream.beginTurn(7, "turn-1");
    assert.throws(
      () =>
        stream.observe(7, "item/started", {
          threadId: "thread-1",
          turnId: "turn-1",
          startedAtMs: 1,
          item,
        }),
      (error: unknown) =>
        error instanceof CodexThreadProtocolError && error.code === "forbidden",
    );
    assert.throws(
      () => stream.observe(7, "skills/changed", {}),
      (error: unknown) =>
        error instanceof CodexThreadProtocolError && error.code === "forbidden",
    );
  }
});

test("owned MCP activity omits arguments, results and paths", () => {
  const stream = projector();
  stream.beginTurn(7, "turn-1");
  const event = stream.observe(7, "item/started", {
    threadId: "thread-1",
    turnId: "turn-1",
    startedAtMs: 1,
    item: {
      id: "mcp-1",
      type: "mcpToolCall",
      server: "codex-video-edit",
      tool: "draft.trim",
      arguments: { source: "C:\\private\\source.mp4", token: "SECRET" },
      result: { private: true },
      status: "inProgress",
    },
  });
  assert.deepEqual(event, {
    type: "item_started",
    generation: 7,
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "mcp-1",
    kind: "edit",
    label: "Applying an edit",
  });
  assert.ok(!JSON.stringify(event).includes("private"));
  assert.ok(!JSON.stringify(event).includes("SECRET"));
});

test("interrupt response is not terminal; first completion remains authoritative", () => {
  const stream = projector();
  stream.beginTurn(7, "turn-1");
  stream.markInterruptRequested(7, "turn-1");
  assert.deepEqual(
    stream.observe(7, "turn/completed", {
      threadId: "thread-1",
      turn: { id: "turn-1", status: "completed", items: [] },
    }),
    {
      type: "turn_terminal",
      status: "completed",
      generation: 7,
      threadId: "thread-1",
      turnId: "turn-1",
    },
  );
  assert.throws(
    () =>
      stream.observe(7, "turn/completed", {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "interrupted", items: [] },
      }),
    (error: unknown) =>
      error instanceof CodexThreadProtocolError && error.code === "protocol",
  );
});

test("disconnect makes a running turn uncertain and rejects stale reconnect traffic", () => {
  const stream = projector();
  stream.beginTurn(7, "turn-1");
  assert.deepEqual(stream.advanceGeneration(8), {
    type: "connection_uncertain",
    generation: 7,
    threadId: "thread-1",
    turnId: "turn-1",
  });
  assert.equal(
    stream.observe(7, "turn/completed", {
      threadId: "thread-1",
      turn: { id: "turn-1", status: "completed", items: [] },
    }),
    null,
  );
  assert.equal(stream.currentGeneration(), 8);
  assert.equal(stream.beginTurn(8, "turn-2"), null);
});
