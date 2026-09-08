import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  CodexStdioTransport,
  CodexTransportError,
  type CodexTransportOptions,
  type TransportErrorCode,
} from "../../packages/codex-bridge/src/transport.ts";

const fixture = resolve("tests/native/fixtures/codex-transport-child.mjs");
const init = {
  clientInfo: { name: "fixture", version: "0" },
  capabilities: null,
};
function create(options: Partial<CodexTransportOptions> = {}, mode = "normal") {
  return new CodexStdioTransport({
    executable: process.execPath,
    args: [fixture, mode],
    cwd: resolve("."),
    env: { SystemRoot: process.env.SystemRoot },
    requestTimeoutMs: 10_000,
    shutdownTimeoutMs: 100,
    ...options,
  });
}
function code(expected: TransportErrorCode) {
  return (error: unknown) => {
    assert.ok(error instanceof CodexTransportError);
    assert.equal(error.code, expected);
    assert.ok(!JSON.stringify(error).includes("SECRET"));
    assert.ok(!error.message.includes("SECRET"));
    return true;
  };
}

test("stdio handshake is shared exactly once and request IDs match out-of-order replies", async () => {
  const transport = create();
  try {
    await assert.rejects(transport.request("echo", {}), code("not_ready"));
    const first = transport.start(init);
    assert.equal(first, transport.start(init));
    const result = await first;
    assert.equal((result as { initializations: number }).initializations, 1);
    assert.equal(transport.state, "ready");
    assert.deepEqual(await transport.start({ different: true }), result);
    const values = await Promise.all([
      transport.request("order", { delay: 80 }),
      transport.request("order", { delay: 1 }),
    ]);
    assert.deepEqual(values, [{ delay: 80 }, { delay: 1 }]);
    await assert.rejects(
      transport.request("initialize", init),
      code("not_ready"),
    );
    assert.throws(() => transport.notify("initialized", {}), code("not_ready"));
  } finally {
    await transport.close();
  }
  assert.equal(transport.state, "closed");
});

test("UTF-8 fragmentation, CRLF and coalesced notifications preserve exact order", async () => {
  const notifications: unknown[] = [];
  const transport = create({
    onNotification: (method, params) => notifications.push({ method, params }),
  });
  try {
    await transport.start(init);
    assert.equal(await transport.request("fragment", {}), "é 🌍");
    assert.equal(await transport.request("coalesce", {}), true);
    assert.deepEqual(notifications, [
      { method: "event", params: { delta: "first" } },
      { method: "event", params: { delta: "second" } },
    ]);
  } finally {
    await transport.close();
  }
});

test("RPC errors expose a fixed message and numeric code without raw error or stderr", async () => {
  const transport = create();
  try {
    await transport.start(init);
    await assert.rejects(transport.request("error", {}), (error: unknown) => {
      code("remote_error")(error);
      assert.equal((error as CodexTransportError).rpcCode, -32001);
      return true;
    });
    assert.equal(
      await transport.request("echo", "still connected"),
      "still connected",
    );
  } finally {
    await transport.close();
  }
});

test("malformed, invalid UTF-8, invalid envelopes, truncated and oversized lines fail closed", async (t) => {
  const cases = [
    { name: "malformed", bytes: Buffer.from("PRIVATE SECRET\n") },
    { name: "blank", bytes: Buffer.from("\n") },
    { name: "utf8", bytes: Buffer.from([0xc3, 0x28, 10]) },
    { name: "truncated", bytes: Buffer.from('{"id":'), exit: true },
    { name: "oversized", bytes: Buffer.from("x".repeat(4097)) },
    { name: "array", bytes: Buffer.from("[]\n") },
    {
      name: "version",
      bytes: Buffer.from('{"jsonrpc":"1.0","id":2,"result":true}\n'),
    },
    { name: "both", bytes: Buffer.from('{"id":2,"result":true,"error":{}}\n') },
    {
      name: "error shape",
      bytes: Buffer.from(
        '{"id":2,"error":{"code":"bad","message":"SECRET"}}\n',
      ),
    },
    {
      name: "null server ID",
      bytes: Buffer.from('{"id":null,"method":"approve"}\n'),
    },
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      const errors: CodexTransportError[] = [];
      const transport = create({
        maxLineBytes: 4096,
        onDisconnect: (error) => errors.push(error),
      });
      try {
        await transport.start(init);
        // Generate an oversized line in the child without oversizing the test command.
        if (item.name === "oversized") {
          await assert.rejects(
            transport.request("raw", { repeat: 4097 }),
            code("protocol"),
          );
        } else {
          await assert.rejects(
            transport.request("raw", {
              bytes: [...item.bytes],
              exit: item.exit,
            }),
            code("protocol"),
          );
        }
        assert.equal(transport.state, "closed");
        assert.equal(errors.length, 1);
        await assert.rejects(transport.start(init), code("closed"));
      } finally {
        await transport.close();
      }
    });
  }
});

test("unknown response IDs terminate the connection rather than attaching data to a request", async () => {
  const transport = create();
  try {
    await transport.start(init);
    await assert.rejects(transport.request("unknown", {}), code("protocol"));
  } finally {
    await transport.close();
  }
});

test("pending capacity rejects only the new request; timeout rejects all uncertain work", async () => {
  const transport = create({ maxPendingRequests: 1, requestTimeoutMs: 3000 });
  try {
    await transport.start(init);
    const held = transport.request("hold", {});
    const rejected = assert.rejects(held, code("timeout"));
    await assert.rejects(transport.request("echo", {}), code("capacity"));
    await rejected;
    assert.equal(transport.state, "closed");
  } finally {
    await transport.close();
  }
});

test("exit/close reject pending work; explicit restart uses a new process without replay", async () => {
  const transport = create();
  try {
    const first = (await transport.start(init)) as { pid: number };
    const held = assert.rejects(
      transport.request("hold", { edit: "do not replay" }),
      code("process_failed"),
    );
    await assert.rejects(transport.request("exit", {}), code("process_failed"));
    await held;
    const second = (await transport.restart(init)) as {
      pid: number;
      initializations: number;
    };
    assert.notEqual(second.pid, first.pid);
    assert.equal(second.initializations, 1);
    assert.equal(await transport.request("echo", "new"), "new");
    const pending = assert.rejects(
      transport.request("hold", {}),
      code("closed"),
    );
    await transport.close();
    await pending;
    assert.throws(() => process.kill(second.pid, 0));
  } finally {
    await transport.close();
  }
});

test("server requests are denied when missing, throwing or timed-out, and support explicit responses", async (t) => {
  for (const mode of ["missing", "throw", "timeout", "response"] as const) {
    await t.test(mode, async () => {
      let signal: AbortSignal | undefined;
      const options: Partial<CodexTransportOptions> = {
        serverRequestTimeoutMs: 50,
      };
      if (mode !== "missing")
        options.onServerRequest = async (request) => {
          signal = request.signal;
          assert.equal(request.method, "permission/request");
          if (mode === "throw") throw new Error("PRIVATE SECRET");
          if (mode === "timeout") return new Promise(() => {});
          return { decision: "decline" };
        };
      const transport = create(options);
      try {
        await transport.start(init);
        const result = (await transport.request("server", {})) as Record<
          string,
          unknown
        >;
        assert.equal(result.id, "approval-1");
        if (mode === "response")
          assert.deepEqual(result.result, { decision: "decline" });
        else assert.ok(result.error);
        assert.ok(!JSON.stringify(result).includes("SECRET"));
        if (mode === "timeout") assert.equal(signal?.aborted, true);
      } finally {
        await transport.close();
      }
    });
  }
});

test("server request duplicate IDs fail closed and abort the outstanding handler", async () => {
  const transport = create({
    onServerRequest: async () => new Promise(() => {}),
  });
  try {
    await transport.start(init);
    await assert.rejects(
      transport.request("duplicate-server", {}),
      code("protocol"),
    );
  } finally {
    await transport.close();
  }
});

test("notification handler failure closes transport without leaking callback text", async () => {
  const transport = create({
    onNotification: () => {
      throw new Error("PRIVATE SECRET");
    },
  });
  try {
    await transport.start(init);
    await assert.rejects(transport.request("coalesce", {}), code("protocol"));
  } finally {
    await transport.close();
  }
});

test("initialization errors and spawn failures are safe and recoverable only by explicit restart", async () => {
  const transport = create({}, "init-error");
  try {
    await assert.rejects(transport.start(init), code("remote_error"));
    assert.equal(transport.state, "closed");
  } finally {
    await transport.close();
  }
  const missing = create({
    executable: resolve(".astra/nonexistent-codex-executable"),
  });
  try {
    await assert.rejects(missing.start(init), code("process_failed"));
  } finally {
    await missing.close();
  }
});

test("runtime configuration cannot invoke a shell and explicit env is not inherited", async () => {
  for (const executable of [
    "codex",
    resolve("codex.cmd"),
    resolve("codex.ps1"),
  ]) {
    assert.throws(() => create({ executable }), code("configuration"));
  }
  assert.throws(() => create({ requestTimeoutMs: NaN }), code("configuration"));
  assert.throws(() => create({ cwd: "." }), code("configuration"));
  const previous = process.env.TRANSPORT_MARKER;
  process.env.TRANSPORT_MARKER = "PRIVATE SECRET";
  const transport = create();
  try {
    await transport.start(init);
    assert.deepEqual(await transport.request("environment", {}), {
      cwd: process.cwd(),
      marker: null,
    });
  } finally {
    await transport.close();
    if (previous === undefined) delete process.env.TRANSPORT_MARKER;
    else process.env.TRANSPORT_MARKER = previous;
  }
});

test("close forcibly reaps a child that ignores graceful termination", async () => {
  const transport = create({}, "stubborn");
  const initialized = (await transport.start(init)) as { pid: number };
  await transport.close();
  assert.throws(() => process.kill(initialized.pid, 0));
});

test("outbound size and serialization failures release capacity without writing a partial frame", async () => {
  const transport = create({ maxLineBytes: 1024, maxPendingRequests: 1 });
  try {
    await transport.start(init);
    await assert.rejects(
      transport.request("echo", "x".repeat(1024)),
      code("capacity"),
    );
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await assert.rejects(transport.request("echo", circular), code("protocol"));
    assert.equal(await transport.request("echo", "intact"), "intact");
  } finally {
    await transport.close();
  }
});

test("close aborts an executing server handler and never sends its late response", async () => {
  let markEntered!: () => void;
  let complete!: (value: unknown) => void;
  let signal: AbortSignal | undefined;
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve;
  });
  const transport = create({
    onServerRequest: async (request) => {
      signal = request.signal;
      markEntered();
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  try {
    await transport.start(init);
    const pending = assert.rejects(
      transport.request("server", {}),
      code("closed"),
    );
    await entered;
    await transport.close();
    await pending;
    assert.equal(signal?.aborted, true);
    complete({ decision: "accept" });
    await transport.restart(init);
    assert.equal(await transport.request("echo", "new session"), "new session");
  } finally {
    await transport.close();
  }
});

test("duplicate responses and asynchronous notification failures disconnect once", async () => {
  let resolveDisconnect!: () => void;
  const disconnected = new Promise<void>((resolve) => {
    resolveDisconnect = resolve;
  });
  let count = 0;
  const transport = create({
    onDisconnect: () => {
      count++;
      resolveDisconnect();
    },
  });
  try {
    await transport.start(init);
    assert.equal(await transport.request("duplicate", {}), true);
    await disconnected;
    assert.equal(count, 1);
    assert.equal(transport.state, "closed");
  } finally {
    await transport.close();
  }
  const asynchronous = create({
    onNotification: async () => {
      throw new Error("PRIVATE SECRET");
    },
  });
  try {
    await asynchronous.start(init);
    // Coalesced response can settle before the handler's rejected promise; it is not replayed.
    await asynchronous.request("coalesce", {}).catch(() => {});
    assert.equal(asynchronous.state, "closed");
  } finally {
    await asynchronous.close();
  }
});
