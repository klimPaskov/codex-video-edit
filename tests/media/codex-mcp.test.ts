import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createInterface, type Interface } from "node:readline";
import { join, resolve } from "node:path";
import test from "node:test";
import { once } from "node:events";

import {
  CodexMcpBroker,
  resolveCodexMcpScript,
} from "../../packages/codex-tools/src/broker.ts";
import { CodexVideoEditToolError } from "../../packages/codex-tools/src/service.ts";
import { codexVideoEditMcpTools } from "../../packages/codex-tools/src/mcp-tools.ts";
import {
  buildCodexAppServerArguments,
  codexClientInternals,
} from "../../packages/codex-bridge/src/client.ts";
import { CodexTransportError } from "../../packages/codex-bridge/src/transport.ts";

type RpcHarness = {
  child: ChildProcessWithoutNullStreams;
  lines: Interface;
  iterator: AsyncIterator<string>;
  request(value: unknown): Promise<Record<string, unknown>>;
  close(): Promise<void>;
};

async function childFor(
  runtime: ReturnType<CodexMcpBroker["runtime"]>,
  token = runtime.token,
): Promise<RpcHarness> {
  const child = spawn(runtime.command, [runtime.script], {
    env: {
      CODEX_VIDEO_EDIT_MCP_ENDPOINT: runtime.endpoint,
      CODEX_VIDEO_EDIT_MCP_TOKEN: token,
      NODE_NO_WARNINGS: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  const iterator = lines[Symbol.asyncIterator]();
  return {
    child,
    lines,
    iterator,
    async request(value) {
      child.stdin.write(`${JSON.stringify(value)}\n`);
      const result = await iterator.next();
      assert.equal(result.done, false);
      const parsed: unknown = JSON.parse(result.value!);
      assert.ok(parsed && typeof parsed === "object" && !Array.isArray(parsed));
      return parsed as Record<string, unknown>;
    },
    async close() {
      lines.close();
      child.stdin.end();
      if (child.exitCode === null) await once(child, "exit");
    },
  };
}

async function fixture(
  invoke: (name: unknown, input: unknown) => Promise<unknown>,
) {
  const parent = resolve("test-results", "codex-mcp");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, "fixture-"));
  const broker = await CodexMcpBroker.open(root, invoke);
  const runtime = broker.runtime(
    process.execPath,
    resolve("packages/codex-tools/src/mcp-server.ts"),
  );
  return { root, broker, runtime };
}

test("packaged MCP protocol lists only reviewed tools and forwards a bounded call", async () => {
  const calls: Array<{ name: unknown; input: unknown }> = [];
  const state = await fixture(async (name, input) => {
    calls.push({ name, input });
    return { schema_version: "1.0", project_id: "project-1" };
  });
  const rpc = await childFor(state.runtime);
  try {
    const initialized = await rpc.request({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      },
    });
    assert.equal(
      (initialized.result as { protocolVersion: string }).protocolVersion,
      "2025-06-18",
    );
    const listed = await rpc.request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    const tools = (listed.result as { tools: Array<{ name: string }> }).tools;
    assert.deepEqual(
      tools.map((tool) => tool.name),
      [
        "project.get_summary",
        "timeline.get_summary",
        "cut.trim_edge",
        "timeline.undo",
      ],
    );
    assert.ok(!JSON.stringify(tools).includes(state.runtime.endpoint));
    const called = await rpc.request({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "project.get_summary",
        arguments: { schema_version: "1.0", project_id: "project-1" },
      },
    });
    assert.equal((called.result as { isError: boolean }).isError, false);
    assert.deepEqual(calls, [
      {
        name: "project.get_summary",
        input: { schema_version: "1.0", project_id: "project-1" },
      },
    ]);
  } finally {
    await rpc.close();
    await state.broker.close();
    await rm(state.root, { recursive: true, force: true });
  }
});

test("MCP boundary rejects unknown tools and returns only fixed service errors", async () => {
  const state = await fixture(async () => {
    throw new CodexVideoEditToolError("stale_draft");
  });
  const rpc = await childFor(state.runtime);
  try {
    const unknown = await rpc.request({
      jsonrpc: "2.0",
      id: "unknown",
      method: "tools/call",
      params: { name: "filesystem.read", arguments: {} },
    });
    assert.equal((unknown.error as { code: number }).code, -32602);
    const failed = await rpc.request({
      jsonrpc: "2.0",
      id: "stale",
      method: "tools/call",
      params: {
        name: "timeline.get_summary",
        arguments: { schema_version: "1.0", project_id: "project-1" },
      },
    });
    const result = failed.result as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /draft changed/u);
    assert.ok(!JSON.stringify(failed).includes(state.runtime.endpoint));
    assert.ok(!JSON.stringify(failed).includes(state.runtime.token));
  } finally {
    await rpc.close();
    await state.broker.close();
    await rm(state.root, { recursive: true, force: true });
  }
});

test("MCP child cannot reach Electron main with the wrong launch secret", async () => {
  let invoked = false;
  const state = await fixture(async () => {
    invoked = true;
    return {};
  });
  const rpc = await childFor(state.runtime, "0".repeat(64));
  try {
    const failed = await rpc.request({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "project.get_summary",
        arguments: { schema_version: "1.0", project_id: "project-1" },
      },
    });
    assert.equal((failed.result as { isError: boolean }).isError, true);
    assert.equal(invoked, false);
    assert.ok(!JSON.stringify(failed).includes(state.runtime.endpoint));
  } finally {
    await rpc.close();
    await state.broker.close();
    await rm(state.root, { recursive: true, force: true });
  }
});

test("MCP broker supports deep application-data roots within the POSIX socket limit", async () => {
  const parent = resolve(
    "test-results",
    "codex-mcp-deep-root",
    "a".repeat(48),
    "b".repeat(48),
  );
  const broker = await CodexMcpBroker.open(parent, async () => ({}));
  try {
    const runtime = broker.runtime(
      process.execPath,
      resolve("packages/codex-tools/src/mcp-server.ts"),
    );
    if (process.platform !== "win32") {
      assert.ok(Buffer.byteLength(runtime.endpoint) < 100);
      assert.ok(
        runtime.endpoint.startsWith(resolve("test-results")) ||
          runtime.endpoint.startsWith("/tmp/"),
      );
    }
  } finally {
    await broker.close();
    await rm(resolve("test-results", "codex-mcp-deep-root"), {
      recursive: true,
      force: true,
    });
  }
});

test("packaged MCP resolver rejects a changed child script", async () => {
  const parent = resolve("test-results", "codex-mcp-package");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, "fixture-"));
  const directory = join(root, "mcp");
  await mkdir(directory);
  const script = join(directory, "codex-video-edit-mcp.cjs");
  const bytes = Buffer.from("process.exit(0);\n");
  await writeFile(script, bytes);
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      executable: "codex-video-edit-mcp.cjs",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
  );
  try {
    assert.equal(await resolveCodexMcpScript(root), script);
    await writeFile(script, "changed\n");
    await assert.rejects(resolveCodexMcpScript(root), /missing or damaged/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("App Server receives the owned MCP allowlist without command-line secrets", () => {
  const runtime = {
    command: resolve("runtime", "electron"),
    script: resolve("runtime", "codex-video-edit-mcp.cjs"),
    endpoint: "private-endpoint",
    token: "b".repeat(64),
  };
  const args = buildCodexAppServerArguments(runtime);
  const serialized = JSON.stringify(args);
  assert.match(serialized, /mcp_servers\.codex-video-edit\.command/u);
  assert.match(serialized, /enabled_tools/u);
  assert.match(serialized, /default_tools_approval_mode/u);
  assert.ok(!serialized.includes(runtime.endpoint));
  assert.ok(!serialized.includes(runtime.token));
  assert.ok(!serialized.includes("filesystem.read"));
});

test("App Server startup accepts only the reviewed owned MCP schemas", () => {
  const status = {
    data: [
      {
        name: "codex-video-edit",
        serverInfo: { name: "codex-video-edit", version: "0.0.1" },
        tools: Object.fromEntries(
          codexVideoEditMcpTools.map((tool) => [tool.name, tool]),
        ),
        resources: [],
        resourceTemplates: [],
        authStatus: "unsupported",
      },
    ],
    nextCursor: null,
  };
  codexClientInternals.validateOwnedMcpStatus(structuredClone(status));
  const changed = structuredClone(status) as unknown as {
    data: Array<{
      tools: Record<string, { inputSchema: unknown }>;
    }>;
    nextCursor: null;
  };
  changed.data[0]!.tools["cut.trim_edge"]!.inputSchema = {
    type: "object",
  };
  assert.throws(
    () => codexClientInternals.validateOwnedMcpStatus(changed),
    CodexTransportError,
  );
});
