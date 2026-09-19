/** Authenticated native-child test. It never reads credentials or prints raw turns. */
import assert from "node:assert/strict";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, expect } from "playwright/test";
import { assertInitialProjectSnapshot } from "../../packages/domain/src/project.ts";
import {
  encodeVerifiedMaster,
  sha256,
} from "../../packages/media-engine/src/lossless.ts";
import {
  CodexStdioTransport,
  CodexTransportError,
} from "../../packages/codex-bridge/src/transport.ts";
import { buildCodexAppServerArguments } from "../../packages/codex-bridge/src/client.ts";
import { buildExperimentalInitialize } from "../../packages/codex-bridge/src/thread-protocol.ts";

assert.equal(process.platform, "linux", "Requires isolated Linux guest");
assert.equal(process.getuid?.(), 1000);
assert.equal(process.env.DISPLAY, ":99");
await access("/.dockerenv");
const executablePath = process.argv[2];
const configArgument = process.argv[3];
assert.ok(executablePath && isAbsolute(executablePath));
assert.ok(configArgument && isAbsolute(configArgument));
const configRoot = await realpath(configArgument);
assert.equal(
  configRoot,
  resolve(configArgument),
  "Config root must not redirect",
);
assert.notEqual(configRoot, "/");
const evidenceRoot = resolve("test-results");
await mkdir(evidenceRoot, { recursive: true });
const evidence = await mkdtemp(join(evidenceRoot, "native-codex-child-"));
await chmod(evidence, 0o700);
let step = "fixture";
const mark = (value: string): void => {
  step = value;
  console.log(`STEP ${value}`);
};
async function inspectionHold(): Promise<void> {
  if (!process.argv.includes("--inspect")) return;
  console.log(JSON.stringify({ inspectionReady: true, evidence }));
  const deadline = Date.now() + 600000;
  while (true) {
    try {
      await access(join(evidence, "inspection.done"));
      return;
    } catch {
      /* Guest-only input marker. */
    }
    if (Date.now() > deadline) throw new Error("Inspection timeout");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
const resourceRoot = join(dirname(executablePath), "resources");
await writeFile(
  join(evidence, "provenance.json"),
  JSON.stringify(
    {
      asarHash: sha256(await readFile(join(resourceRoot, "app.asar"))),
      runtimeManifestHash: sha256(
        await readFile(join(resourceRoot, "codex/manifest.json")),
      ),
      mcpManifestHash: sha256(
        await readFile(join(resourceRoot, "mcp/manifest.json")),
      ),
      testHash: sha256(await readFile(fileURLToPath(import.meta.url))),
    },
    null,
    2,
  ),
);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function turns(value: unknown): Record<string, unknown>[] {
  assert.ok(record(value) && Array.isArray(value.data));
  assert.ok(value.data.length > 0 && value.data.length <= 100);
  return value.data.map((turn: unknown) => {
    assert.ok(record(turn) && Array.isArray(turn.items));
    return turn;
  });
}

function items(turn: Record<string, unknown>): Record<string, unknown>[] {
  assert.ok(Array.isArray(turn.items));
  return turn.items.map((item: unknown) => {
    assert.ok(record(item));
    return item;
  });
}

const video = Buffer.alloc(96 * 64 * 4 * 3);
const colors = [
  [20, 40, 180, 255],
  [30, 170, 50, 255],
  [190, 60, 30, 255],
];
for (let frame = 0; frame < 3; frame++)
  for (let pixel = 0; pixel < 96 * 64; pixel++)
    for (let channel = 0; channel < 4; channel++)
      video[(frame * 96 * 64 + pixel) * 4 + channel] =
        channel === 3
          ? 255
          : (colors[frame]![channel]! +
              (pixel % 96) +
              Math.floor(pixel / 96) * (channel + 1)) %
            256;
const audio = Buffer.alloc(72_000 * 2);
for (let sample = 0; sample < 72_000; sample++)
  audio.writeInt16LE(Math.round(Math.sin(sample / 20) * 6000), sample * 2);
const videoPath = join(evidence, "canonical.raw");
const audioPath = join(evidence, "canonical.pcm");
const source = join(evidence, "Child fixture.mkv");
await writeFile(videoPath, video);
await writeFile(audioPath, audio);
await encodeVerifiedMaster(
  {
    videoPath,
    audioPath,
    role: "canonical",
    format: {
      width: 96,
      height: 64,
      frameRate: { numerator: 2, denominator: 1 },
      pixelFormat: "bgra",
      color: {
        range: "pc",
        space: "gbr",
        primaries: "bt709",
        transfer: "bt709",
      },
      audio: { format: "s16le", sampleRate: 48000, channelLayout: "mono" },
    },
  },
  source,
);
const sourceHash = sha256(await readFile(source));
const env = { ...process.env, XDG_CONFIG_HOME: configRoot };
const electron = await _electron.launch({
  executablePath,
  chromiumSandbox: true,
  env,
  timeout: 30000,
});
let transport: CodexStdioTransport | undefined;
let failureSnapshot: () => Promise<unknown> = async () => ({
  status: "before-thread",
});
try {
  const page = await electron.firstWindow();
  assert.equal(await electron.evaluate(({ app }) => app.isPackaged), true);
  assert.equal(page.url(), "codex-video-edit://app/index.html");
  assert.ok(
    !electron
      .process()
      .spawnargs.some((arg) =>
        /--(?:no-sandbox|disable-setuid-sandbox)/u.test(arg),
      ),
  );
  await electron.evaluate(({ shell }) => {
    shell.openExternal = async () => {
      throw new Error("External launch disabled in isolated test");
    };
  });
  failureSnapshot = async () => {
    try {
      const result = await page.evaluate(() => window.desktop.getCodex());
      if (!result.ok) return { status: "account-unavailable" };
      return {
        status: "before-thread",
        connection: result.value.connection,
        account: result.value.account,
        busy: result.value.busy,
        modelCount: result.value.models.length,
        skillCount: result.value.skills.length,
      };
    } catch {
      return { status: "account-unavailable" };
    }
  };
  mark("authenticated-account");
  await expect
    .poll(
      async () => {
        const result = await page.evaluate(() => window.desktop.getCodex());
        return (
          result.ok &&
          !result.value.busy &&
          result.value.connection === "connected" &&
          result.value.account === "signed_in" &&
          result.value.models.length > 0 &&
          result.value.skills.length > 0
        );
      },
      { timeout: 60000 },
    )
    .toBe(true);
  const catalog = await page.evaluate(() => window.desktop.getCodex());
  assert.ok(catalog.ok);
  const model =
    catalog.value.models.find(
      (item) => item.id === catalog.value.selection?.modelId,
    ) ?? catalog.value.models[0]!;
  assert.ok(
    model.reasoning.includes("xhigh"),
    "Authenticated model has no higher collaboration effort",
  );
  mark("select-xhigh-through-settings");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.locator("#codex-model")).toBeEnabled();
  await page.locator("#codex-model").selectOption(model.id);
  await expect
    .poll(async () => {
      const result = await page.evaluate(() => window.desktop.getCodex());
      return result.ok && !result.value.busy
        ? result.value.selection?.modelId
        : null;
    })
    .toBe(model.id);
  await expect(page.locator("#codex-reasoning")).toBeEnabled();
  await page.locator("#codex-reasoning").selectOption("xhigh");
  await expect
    .poll(async () => {
      const result = await page.evaluate(() => window.desktop.getCodex());
      return result.ok && !result.value.busy ? result.value.selection : null;
    })
    .toEqual({ modelId: model.id, reasoning: "xhigh" });
  await page.keyboard.press("Escape");
  mark("import-fixture");
  const before = await page.evaluate(() => window.desktop.listProjects());
  assert.ok(before.ok);
  await electron.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, source);
  await page.getByRole("button", { name: "Import video", exact: true }).click();
  await expect(page.locator("#frame")).toBeVisible({ timeout: 30000 });
  const list = await page.evaluate(() => window.desktop.listProjects());
  assert.ok(list.ok);
  const added = list.value.filter(
    (project) => !before.value.some((prior) => prior.id === project.id),
  );
  assert.equal(added.length, 1);
  const project = added[0]!;
  const userData = await electron.evaluate(({ app }) =>
    app.getPath("userData"),
  );
  assert.equal(await realpath(userData), join(configRoot, "codex-video-edit"));
  const projectFolder = join(userData, "project-store", project.id);
  const baselinePath = join(projectFolder, "baseline.json");
  const baselineBytes = await readFile(baselinePath);
  const baseline: unknown = JSON.parse(baselineBytes.toString("utf8"));
  assertInitialProjectSnapshot(baseline);
  assert.equal(baseline.timeline.duration_us, 1500000);
  const projectSourceHash = sha256(
    await readFile(baseline.source.managed_path),
  );
  assert.equal(projectSourceHash, sourceHash);

  mark("open-project-thread");
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await page
    .getByRole("button", { name: "Open conversation", exact: true })
    .click();
  const threadRequest = {
    schema_version: "1.0" as const,
    project_id: project.id,
  };
  const threadState = async () => {
    const result = await page.evaluate(
      (request) => window.desktop.getCodexThread(request),
      threadRequest,
    );
    assert.ok(result.ok);
    return result.value;
  };
  failureSnapshot = async () => {
    try {
      const state = await threadState();
      const knownMessages = new Set([
        "Codex is retrying this turn.",
        "Codex reported a problem with this turn.",
        "This Codex turn failed. Review the committed draft before retrying.",
        "The Codex turn was interrupted.",
        "The connection ended during this turn. Reopen the project to reconcile its thread and committed draft.",
      ]);
      return {
        status: state.status,
        message:
          state.message === null
            ? null
            : knownMessages.has(state.message)
              ? state.message
              : "Application issue; details omitted",
        userCount: state.messages.filter((message) => message.role === "user")
          .length,
        completedReplyCount: state.messages.filter(
          (message) => message.role === "codex" && message.complete,
        ).length,
        activityKinds: state.activities.map(({ kind, complete }) => ({
          kind,
          complete,
        })),
      };
    } catch {
      return { status: "unavailable" };
    }
  };
  await expect
    .poll(async () => (await threadState()).status, { timeout: 90000 })
    .toBe("ready");
  const registry: unknown = JSON.parse(
    await readFile(
      join(userData, "codex/context/threads/project-threads.json"),
      "utf8",
    ),
  );
  assert.ok(record(registry) && Array.isArray(registry.entries));
  const entries = registry.entries.filter(
    (entry: unknown) =>
      record(entry) &&
      entry.projectId === project.id &&
      typeof entry.threadId === "string",
  ) as Array<{ threadId: string }>;
  assert.equal(entries.length, 1);
  const parentThreadId = entries[0]!.threadId;

  mark("real-native-child-turn");
  const prompt =
    "Use the supported native spawn_agent collaboration tool exactly once for a small read-only child task. Give the child the active project_id from your fixed developer instructions and ask it to use only codex-video-edit project.get_summary and timeline.get_summary to verify this fixture has one clip and is 1.5 seconds long. Wait for that child to finish, then summarize its finding. Neither you nor the child may mutate the draft. Do not claim a child was used unless the native tool actually succeeds.";
  await page.locator("#codex-thread-input").fill(prompt);
  await page.locator("#send-codex-thread").click();
  await expect
    .poll(
      async () => {
        const state = await threadState();
        if (state.status === "failed" || state.status === "uncertain")
          throw new Error("Native Codex child turn failed; details omitted");
        return (
          state.status === "ready" &&
          state.message === null &&
          state.messages.some(
            (message) =>
              message.role === "codex" &&
              message.complete &&
              message.text.trim().length > 0,
          )
        );
      },
      { timeout: 240000, intervals: [250, 500, 1000] },
    )
    .toBe(true);
  const projected = await threadState();
  const projectedChild = projected.activities.some(
    (activity) => activity.kind === "subagent" && activity.complete,
  );
  await page.screenshot({ path: join(evidence, "native-window.png") });
  await inspectionHold();
  await electron.close();

  mark("authoritative-server-history");
  const codexHome = join(userData, "codex/account");
  const cwd = join(userData, "codex/context");
  const runtime = join(resourceRoot, "codex/codex");
  await access(runtime);
  const auditEnv: NodeJS.ProcessEnv = {
    HOME: dirname(codexHome),
    USERPROFILE: dirname(codexHome),
    CODEX_HOME: codexHome,
    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
  };
  transport = new CodexStdioTransport({
    executable: runtime,
    args: buildCodexAppServerArguments(),
    cwd,
    env: auditEnv,
    requestTimeoutMs: 120000,
  });
  const initialized = await transport.start(
    buildExperimentalInitialize("0.0.0"),
  );
  assert.ok(record(initialized) && initialized.codexHome === codexHome);
  const pageParams = (threadId: string) => ({
    threadId,
    limit: 100,
    sortDirection: "desc",
    itemsView: "full",
  });
  const listedTurns = async (threadId: string) => {
    try {
      return turns(
        await transport!.request("thread/turns/list", pageParams(threadId)),
      );
    } catch (error) {
      if (!(
        error instanceof CodexTransportError && error.code === "remote_error"
      ))
        throw error;
      // Some pinned runtimes require the persisted thread to be loaded first.
      await transport!.request("thread/resume", {
        threadId,
        excludeTurns: true,
      });
      return turns(
        await transport!.request("thread/turns/list", pageParams(threadId)),
      );
    }
  };
  const parentTurns = await listedTurns(parentThreadId);
  const parentTurn = parentTurns.find((turn) =>
    items(turn).some(
      (item) =>
        item.type === "userMessage" &&
        Array.isArray(item.content) &&
        item.content.some(
          (content: unknown) => record(content) && content.text === prompt,
        ),
    ),
  );
  assert.ok(parentTurn && parentTurn.status === "completed");
  const spawns = items(parentTurn).filter(
    (item) => item.type === "collabAgentToolCall" && item.tool === "spawnAgent",
  );
  assert.equal(spawns.length, 1, "Require one real native spawnAgent item");
  const spawn = spawns[0]!;
  assert.equal(spawn.status, "completed");
  assert.equal(spawn.senderThreadId, parentThreadId);
  assert.ok(Array.isArray(spawn.receiverThreadIds));
  assert.equal(spawn.receiverThreadIds.length, 1);
  const childThreadId = spawn.receiverThreadIds[0];
  assert.ok(typeof childThreadId === "string" && childThreadId.length > 0);
  assert.notEqual(childThreadId, parentThreadId);
  const childTurns = await listedTurns(childThreadId);
  const childReadTurns = childTurns.filter((turn) =>
    items(turn).some(
      (item) =>
        item.type === "mcpToolCall" &&
        item.server === "codex-video-edit" &&
        (item.tool === "project.get_summary" ||
          item.tool === "timeline.get_summary") &&
        item.status === "completed" &&
        item.error === null &&
        record(item.result) &&
        Array.isArray(item.result.content) &&
        record(item.result.structuredContent),
    ),
  );
  assert.ok(childReadTurns.length > 0, "Child must own a completed read tool");
  assert.ok(childReadTurns.some((turn) => turn.status === "completed"));
  const childItems = childTurns.flatMap(items);
  assert.ok(
    childItems.every(
      (item) =>
        item.type !== "mcpToolCall" ||
        (item.server === "codex-video-edit" &&
          (item.tool === "project.get_summary" ||
            item.tool === "timeline.get_summary")),
    ),
    "Child used an unapproved MCP tool",
  );
  const harmlessItems = new Set([
    "userMessage",
    "agentMessage",
    "reasoning",
    "plan",
    "contextCompaction",
    "sleep",
  ]);
  assert.ok(
    childItems.every(
      (item) =>
        item.type === "mcpToolCall" || harmlessItems.has(String(item.type)),
    ),
    "Child used a non-read capability or an unknown item type",
  );

  mark("child-policy-metadata");
  let childPolicyVerified = false;
  let childParentVerified = false;
  try {
    const resumed: unknown = await transport.request("thread/resume", {
      threadId: childThreadId,
      excludeTurns: true,
    });
    assert.ok(record(resumed) && record(resumed.thread));
    assert.equal(resumed.thread.id, childThreadId);
    assert.equal(resumed.thread.parentThreadId, parentThreadId);
    childParentVerified = true;
    assert.equal(resumed.modelProvider, "openai");
    assert.equal(resumed.cwd, cwd);
    assert.equal(resumed.approvalPolicy, "never");
    assert.equal(resumed.approvalsReviewer, "user");
    assert.deepEqual(resumed.runtimeWorkspaceRoots, []);
    assert.deepEqual(resumed.instructionSources, []);
    assert.ok(record(resumed.sandbox));
    assert.equal(resumed.sandbox.type, "readOnly");
    assert.equal(resumed.sandbox.networkAccess, false);
    assert.equal(resumed.activePermissionProfile, null);
    childPolicyVerified = true;
  } catch (error) {
    if (!(
      error instanceof CodexTransportError && error.code === "remote_error"
    ))
      throw error;
    // A runtime that cannot expose the child policy cannot satisfy this gate.
  }
  assert.ok(childParentVerified, "Child parent link is not verified");
  assert.ok(childPolicyVerified, "Child inherited policy is not verified");
  await transport.close();
  transport = undefined;

  mark("immutable-project-state");
  assert.deepEqual(await readFile(baselinePath), baselineBytes);
  assert.equal(
    sha256(await readFile(baseline.source.managed_path)),
    sourceHash,
  );
  assert.equal(sha256(await readFile(source)), sourceHash);
  const journal = join(projectFolder, "draft/journal");
  const journalEntries = await readdir(journal);
  assert.equal(
    journalEntries.filter((name) => /^\d{12}\..+\.json$/u.test(name)).length,
    0,
  );
  await writeFile(
    join(evidence, "result.json"),
    JSON.stringify(
      {
        status: "pass",
        scope: "P2-real-native-child-read-only",
        authenticated: true,
        selectedModelId: model.id,
        selectedReasoning: "xhigh",
        packagedNativeWindow: true,
        projectedChildActivity: projectedChild,
        rawSpawnCompleted: true,
        receiverThreadCorrelated: true,
        childOwnedReadToolCompleted: true,
        childParentVerified,
        childPolicyVerified,
        childEnvironmentListExposed: false,
        noForbiddenChildItemObserved: true,
        journalUnchanged: true,
        sourceUnchanged: true,
        baselineUnchanged: true,
        computerUse: false,
        audioListening: false,
        windowsAcceptance: false,
        sourceHash,
        baselineHash: sha256(baselineBytes),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "pass", evidence }));
} catch (error) {
  const failure = error && typeof error === "object" ? error : {};
  try {
    await (
      await electron.firstWindow()
    ).screenshot({
      path: join(evidence, "failure-window.png"),
      timeout: 5000,
    });
  } catch {
    /* The original assertion category remains authoritative. */
  }
  const category = (value: unknown): string | null =>
    typeof value === "string" && /^[A-Za-z0-9_]{1,64}$/u.test(value)
      ? value
      : null;
  await writeFile(
    join(evidence, "failure.json"),
    JSON.stringify({
      status: "fail",
      step,
      detailsOmitted: true,
      errorName: category("name" in failure ? failure.name : null),
      errorCode: category("code" in failure ? failure.code : null),
      snapshot: await failureSnapshot(),
    }),
  );
  console.error(
    `Native child test failed at ${step}; private details omitted.`,
  );
  await inspectionHold();
  process.exitCode = 1;
} finally {
  await transport?.close().catch(() => {});
  await electron.close().catch(() => {});
}
