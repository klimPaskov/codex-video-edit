import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  ProjectThreadRegistry,
  ProjectThreadRegistryError,
} from "../../packages/codex-bridge/src/thread-registry.ts";

const policy = {
  cwd: resolve("test-results", "codex-thread-context"),
  model: "runtime-model",
  effort: "high",
};

function response(threadId: string): unknown {
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

async function fixtureRoot(): Promise<string> {
  const fixtures = resolve("test-results", "codex-thread-registry");
  await mkdir(fixtures, { recursive: true });
  return mkdtemp(join(fixtures, "fixture-"));
}

test("project thread binding persists atomically and reopens without caller IDs", async () => {
  const root = await fixtureRoot();
  try {
    const registry = await ProjectThreadRegistry.open(root);
    assert.equal(await registry.threadForProject("project-1"), null);
    assert.equal(
      await registry.bindFromThreadResponse(
        "project-1",
        response("thread-runtime-1"),
        policy,
      ),
      "thread-runtime-1",
    );
    await registry.bindFromThreadResponse(
      "project-2",
      response("thread-runtime-2"),
      policy,
    );
    const reopened = await ProjectThreadRegistry.open(root);
    assert.equal(
      await reopened.threadForProject("project-1"),
      "thread-runtime-1",
    );
    assert.equal(
      await reopened.threadForProject("project-2"),
      "thread-runtime-2",
    );
    assert.deepEqual(await reopened.bindingForProject("project-1"), {
      projectId: "project-1",
      threadId: "thread-runtime-1",
      toolRoute: "mcp",
    });
    const resume = await reopened.resumeRequestForProject("project-1", policy);
    assert.equal(resume.threadId, "thread-runtime-1");
    assert.equal("environments" in resume, false);
    assert.deepEqual(
      (await readdir(root)).filter((name) => name.endsWith(".pending")),
      [],
    );
    const disk = await readFile(join(root, "project-threads.json"), "utf8");
    assert.ok(!disk.includes(policy.cwd));
    assert.equal(JSON.parse(disk).schemaVersion, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy registry threads remain MCP and migrate only on a later write", async () => {
  const root = await fixtureRoot();
  const path = join(root, "project-threads.json");
  const legacy =
    '{"schemaVersion":1,"entries":[{"projectId":"legacy-project","threadId":"legacy-thread"}]}\n';
  try {
    await writeFile(path, legacy, "utf8");
    const registry = await ProjectThreadRegistry.open(root);
    assert.deepEqual(await registry.bindingForProject("legacy-project"), {
      projectId: "legacy-project",
      threadId: "legacy-thread",
      toolRoute: "mcp",
    });
    assert.equal(await readFile(path, "utf8"), legacy);
    await assert.rejects(
      registry.bindFromThreadResponse(
        "legacy-project",
        response("legacy-thread"),
        policy,
        "dynamic",
      ),
      (error: unknown) =>
        error instanceof ProjectThreadRegistryError &&
        error.code === "conflict",
    );
    assert.equal(await readFile(path, "utf8"), legacy);
    await registry.bindFromThreadResponse(
      "new-project",
      response("new-thread"),
      policy,
      "dynamic",
    );
    const migrated = JSON.parse(await readFile(path, "utf8"));
    assert.equal(migrated.schemaVersion, 2);
    assert.deepEqual(migrated.entries, [
      {
        projectId: "legacy-project",
        threadId: "legacy-thread",
        toolRoute: "mcp",
      },
      {
        projectId: "new-project",
        threadId: "new-thread",
        toolRoute: "dynamic",
      },
    ]);
    assert.deepEqual(
      await (
        await ProjectThreadRegistry.open(root)
      ).bindingForProject("new-project"),
      migrated.entries[1],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registry rejects divergent bindings and missing project resumes", async () => {
  const root = await fixtureRoot();
  try {
    const registry = await ProjectThreadRegistry.open(root);
    await assert.rejects(
      registry.resumeRequestForProject("missing", policy),
      (error: unknown) =>
        error instanceof ProjectThreadRegistryError && error.code === "missing",
    );
    await registry.bindFromThreadResponse(
      "project-1",
      response("thread-1"),
      policy,
    );
    await assert.rejects(
      registry.bindFromThreadResponse(
        "project-1",
        response("thread-2"),
        policy,
      ),
      (error: unknown) =>
        error instanceof ProjectThreadRegistryError &&
        error.code === "conflict",
    );
    await assert.rejects(
      registry.bindFromThreadResponse(
        "project-2",
        response("thread-1"),
        policy,
      ),
      (error: unknown) =>
        error instanceof ProjectThreadRegistryError &&
        error.code === "conflict",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registry fails closed on corruption and does not replace evidence", async () => {
  const root = await fixtureRoot();
  const path = join(root, "project-threads.json");
  const corrupt =
    '{"schemaVersion":1,"entries":[{"projectId":"pp","threadId":"same"},{"projectId":"qq","threadId":"same"}]}\n';
  try {
    await writeFile(path, corrupt, "utf8");
    const registry = await ProjectThreadRegistry.open(root);
    await assert.rejects(
      registry.threadForProject("pp"),
      (error: unknown) =>
        error instanceof ProjectThreadRegistryError && error.code === "corrupt",
    );
    await assert.rejects(
      registry.bindFromThreadResponse(
        "new-project",
        response("new-thread"),
        policy,
      ),
      ProjectThreadRegistryError,
    );
    assert.equal(await readFile(path, "utf8"), corrupt);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unknown or malformed v2 routes fail closed without replacing evidence", async () => {
  for (const route of ["other", null, 2]) {
    const root = await fixtureRoot();
    const path = join(root, "project-threads.json");
    const corrupt = `${JSON.stringify({ schemaVersion: 2, entries: [{ projectId: "project-1", threadId: "thread-1", toolRoute: route }] })}\n`;
    try {
      await writeFile(path, corrupt, "utf8");
      const registry = await ProjectThreadRegistry.open(root);
      await assert.rejects(
        registry.bindingForProject("project-1"),
        (error: unknown) =>
          error instanceof ProjectThreadRegistryError &&
          error.code === "corrupt",
      );
      assert.equal(await readFile(path, "utf8"), corrupt);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
