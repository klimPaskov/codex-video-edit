/** Real Codex split with synthetic or two ordered private guest sources. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { _electron, expect } from "playwright/test";
import type { Page } from "playwright/test";
import { maxFramePixels } from "../../packages/domain/src/library.ts";
import { assertTwoSourceInitialProjectSnapshot } from "../../packages/domain/src/project.ts";
import type { DraftTransactionRecord } from "../../packages/domain/src/draft-transaction.ts";
import { MediaLibrary } from "../../packages/media-engine/src/library.ts";
import { sha256 } from "../../packages/media-engine/src/lossless.ts";
import { runProcess } from "../../packages/media-engine/src/process.ts";
import { ProjectStore } from "../../packages/project-store/src/store.ts";
import { DraftTransactionStore } from "../../packages/project-store/src/transactions.ts";

assert.equal(process.platform, "linux", "Requires isolated Linux guest");
assert.equal(process.getuid?.(), 1000);
assert.equal(process.env.DISPLAY, ":99");
await access("/.dockerenv");
const executablePath = process.argv[2];
const configArgument = process.argv[3];
assert.ok(executablePath && isAbsolute(executablePath));
assert.ok(configArgument && isAbsolute(configArgument));
let configRoot = await realpath(configArgument);
assert.equal(
  configRoot,
  resolve(configArgument),
  "Config root must not redirect",
);
assert.notEqual(configRoot, "/");
const providedPaths = process.argv
  .slice(4)
  .filter(
    (argument) =>
      argument !== "--inspect" &&
      argument !== "--require-luna" &&
      argument !== "--require-dynamic" &&
      argument !== "--probe-surface",
  );
assert.ok(
  providedPaths.length === 0 || providedPaths.length === 2,
  "Supply exactly two optional guest media paths",
);
for (const sourcePath of providedPaths)
  assert.ok(isAbsolute(sourcePath), "Guest media paths must be absolute");
async function fileHash(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
const resultRoot = resolve("test-results");
await mkdir(resultRoot, { recursive: true });
const evidence = await mkdtemp(join(resultRoot, "native-codex-split-"));
if (process.argv.includes("--require-luna")) {
  const source = join(configRoot, "codex-video-edit/codex/account/auth.json");
  const info = await stat(source);
  assert.ok(info.isFile());
  assert.equal(info.mode & 0o077, 0);
  const fresh = await mkdtemp("/tmp/codex-video-edit-luna-edit-");
  await chmod(fresh, 0o700);
  const target = join(fresh, "codex-video-edit/codex/account");
  await mkdir(target, { recursive: true, mode: 0o700 });
  await copyFile(source, join(target, "auth.json"));
  await chmod(join(target, "auth.json"), 0o600);
  configRoot = fresh;
}
let step = "fixture";
const mark = (value: string): void => {
  step = value;
  console.log(`STEP ${value}`);
};
await writeFile(
  join(evidence, "provenance.json"),
  JSON.stringify(
    {
      asarHash: sha256(
        await readFile(join(dirname(executablePath), "resources/app.asar")),
      ),
      runtimeManifestHash: sha256(
        await readFile(
          join(dirname(executablePath), "resources/codex/manifest.json"),
        ),
      ),
      mcpManifestHash: sha256(
        await readFile(
          join(dirname(executablePath), "resources/mcp/manifest.json"),
        ),
      ),
      testHash: sha256(await readFile(fileURLToPath(import.meta.url))),
    },
    null,
    2,
  ),
);

const sources: string[] = [];
if (providedPaths.length === 2) {
  for (const sourcePath of providedPaths)
    sources.push(
      await realpath(sourcePath).catch(() => {
        throw new Error("Private guest source could not be resolved");
      }),
    );
} else {
  for (const [index, pattern] of ["testsrc", "testsrc2"].entries()) {
    const source = join(evidence, `part-${index + 1}.mp4`);
    await runProcess({
      executable: "ffmpeg",
      args: [
        "-v",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        `${pattern}=size=96x64:rate=2:duration=1`,
        "-vf",
        "setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
        "-c:v",
        "libx264",
        "-qp",
        "0",
        "-pix_fmt",
        "yuv420p",
        "-color_range",
        "tv",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        source,
      ],
    });
    sources.push(source);
  }
}
const originalHashes = await Promise.all(sources.map(fileHash)).catch(() => {
  throw new Error("Guest source integrity could not be read");
});

const env = { ...process.env, XDG_CONFIG_HOME: configRoot };
const launch = () =>
  _electron.launch({
    executablePath,
    chromiumSandbox: true,
    env,
    timeout: 30_000,
  });
let electron = await launch();
let page: Page | undefined;
async function canvasHash(active: Page): Promise<string | null> {
  return active.locator("canvas").evaluate(async (node, pixelLimit) => {
    const canvas = node as HTMLCanvasElement;
    if (!canvas.width || !canvas.height) return null;
    if (canvas.width * canvas.height > pixelLimit)
      throw new Error("Canvas exceeds supported preview bounds");
    const pixels = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", pixels),
    );
    return Array.from(digest, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }, maxFramePixels);
}
function clock(timeUs: number): string {
  const seconds = timeUs / 1_000_000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
}
async function seek(active: Page, timeUs: number): Promise<void> {
  await active.locator("#seek").evaluate((node, value) => {
    const input = node as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, timeUs);
  await expect(active.locator("#time")).toHaveText(clock(timeUs), {
    timeout: 60_000,
  });
}
try {
  page = await electron.firstWindow();
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
  mark("authenticated-account");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.locator("#codex-model")).toBeEnabled({ timeout: 60_000 });
  await expect
    .poll(
      async () => {
        const state = await page!.evaluate(() => window.desktop.getCodex());
        return (
          state.ok &&
          !state.value.busy &&
          state.value.connection === "connected" &&
          state.value.account === "signed_in" &&
          state.value.models.length > 0 &&
          state.value.skills.length > 0
        );
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  const account = await page.evaluate(() => window.desktop.getCodex());
  assert.ok(account.ok);
  if (process.argv.includes("--require-luna"))
    assert.deepEqual(account.value.selection, {
      modelId: "gpt-5.6-luna",
      reasoning: "high",
    });
  if (!account.value.selection) {
    const model = account.value.models[0]!;
    await page.locator("#codex-model").selectOption(model.id);
    await expect
      .poll(
        async () => {
          const state = await page!.evaluate(() => window.desktop.getCodex());
          return (
            state.ok &&
            !state.value.busy &&
            state.value.selection?.modelId === model.id
          );
        },
        { timeout: 60_000 },
      )
      .toBe(true);
  }
  await page.keyboard.press("Escape");

  mark("import-two-sources");
  const before = await page.evaluate(() => window.desktop.listProjects());
  assert.ok(before.ok);
  await electron.evaluate(({ dialog }, paths) => {
    let index = 0;
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [paths[index++]!],
    });
  }, sources);
  await page.getByRole("button", { name: "Import video", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add footage" })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByRole("button", { name: "Add footage" }).click();
  await expect
    .poll(
      async () => {
        const result = await page!.evaluate(() =>
          window.desktop.listProjects(),
        );
        return result.ok
          ? result.value
              .filter(
                (item) => !before.value.some((prior) => prior.id === item.id),
              )
              .some((item) => item.sources?.length === 2)
          : false;
      },
      { timeout: 300_000 },
    )
    .toBe(true);
  const listed = await page.evaluate(() => window.desktop.listProjects());
  assert.ok(listed.ok);
  const added = listed.value.filter(
    (item) => !before.value.some((prior) => prior.id === item.id),
  );
  assert.equal(added.length, 2);
  const combined = added.find((item) => item.sources?.length === 2);
  assert.ok(combined);
  const userData = await electron.evaluate(({ app }) =>
    app.getPath("userData"),
  );
  assert.equal(await realpath(userData), join(configRoot, "codex-video-edit"));
  const projectFolder = join(userData, "project-store", combined.id);
  const baselinePath = join(projectFolder, "baseline.json");
  const baselineBytes = await readFile(baselinePath);
  const baseline: unknown = JSON.parse(baselineBytes.toString("utf8"));
  assertTwoSourceInitialProjectSnapshot(baseline);
  const totalUs = baseline.timeline.duration_us;
  const joinUs = baseline.timeline.clips[0]!.timeline_end_us;
  const splitUs = Math.min(500_000, Math.floor(joinUs / 2));
  if (providedPaths.length === 0) {
    assert.equal(totalUs, 2_000_000);
    assert.equal(joinUs, 1_000_000);
  }
  const target = baseline.timeline.clips[0]!;
  assert.ok(
    target.timeline_start_us < splitUs && splitUs < target.timeline_end_us,
  );
  await expect(page.locator("#duration")).toHaveText(` / ${clock(totalUs)}`);
  const library = new MediaLibrary(join(userData, "media-library"));
  const firstFrameHash = sha256(
    Buffer.from(
      (await library.frame(baseline.sources[0].source_id, 0)).rgbaBase64,
      "base64",
    ),
  );
  const splitRightFrameHash = sha256(
    Buffer.from(
      (await library.frame(baseline.sources[0].source_id, splitUs)).rgbaBase64,
      "base64",
    ),
  );
  const secondSourceFrameHash = sha256(
    Buffer.from(
      (await library.frame(baseline.sources[1].source_id, 0)).rgbaBase64,
      "base64",
    ),
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator("#edit-actions")).toBeVisible();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await page
    .getByRole("button", { name: "Open conversation", exact: true })
    .click();
  const threadRequest = {
    schema_version: "1.0" as const,
    project_id: combined.id,
  };
  async function thread() {
    const result = await page!.evaluate(
      (request) => window.desktop.getCodexThread(request),
      threadRequest,
    );
    assert.ok(result.ok);
    return result.value;
  }
  await expect
    .poll(async () => (await thread()).status, { timeout: 90_000 })
    .toBe("ready");
  const registry = JSON.parse(
    await readFile(
      join(userData, "codex/context/threads/project-threads.json"),
      "utf8",
    ),
  ) as {
    schemaVersion: number;
    entries: Array<{ projectId: string; toolRoute?: string }>;
  };
  const bindings = registry.entries.filter(
    (entry) => entry.projectId === combined.id,
  );
  assert.equal(bindings.length, 1);
  const toolRoute = bindings[0]!.toolRoute ?? "mcp";
  assert.ok(toolRoute === "mcp" || toolRoute === "dynamic");
  if (process.argv.includes("--require-dynamic")) {
    assert.equal(registry.schemaVersion, 2);
    assert.equal(toolRoute, "dynamic");
  }
  if (process.argv.includes("--probe-surface")) {
    mark("safe-tool-surface-probe");
    const ownedPrefix =
      toolRoute === "dynamic"
        ? "codex_video_edit__"
        : "mcp__codex_video_edit__";
    const diagnostic = `In a code-mode JavaScript cell, evaluate only JSON.stringify({owned: typeof tools.${ownedPrefix}project_get_summary, apps: typeof tools.mcp__codex_apps__adobe_adobe_mandatory_init, goals: typeof tools.update_goal, plan: typeof tools.update_plan, input: typeof tools.request_user_input_async, skills: typeof tools.skills__list, spawn: typeof tools.multi_agent_v1__spawn_agent, images: typeof tools.image_gen__imagegen, web: typeof tools.web__run, shell: typeof tools.exec_command, ownedCount: ALL_TOOLS.filter(x => x.name.startsWith('${ownedPrefix}')).length, unownedCount: ALL_TOOLS.filter(x => !x.name.startsWith('${ownedPrefix}')).length, unownedNames: ALL_TOOLS.filter(x => !x.name.startsWith('${ownedPrefix}')).map(x => x.name).slice(0, 20)}). Print that exact JSON with text(). Do not invoke any nested tool, access any file or contact any service. Report the observed JSON only.`;
    await page.locator("#codex-thread-input").fill(diagnostic);
    await page.locator("#send-codex-thread").click();
    await expect
      .poll(async () => (await thread()).status, { timeout: 120_000 })
      .toBe("ready");
    const diagnosticState = await thread();
    const answer = diagnosticState.messages
      .filter((message) => message.role === "codex" && message.complete)
      .at(-1)?.text;
    assert.ok(answer);
    await writeFile(
      join(evidence, "tool-surface-probe.json"),
      JSON.stringify({ answer: answer.slice(0, 500) }),
    );
    assert.match(answer, /"owned"\s*:\s*"function"/u);
    assert.match(answer, /"ownedCount"\s*:\s*7\b/u);
    assert.match(answer, /"unownedCount"\s*:\s*0\b/u);
    for (const key of [
      "apps",
      "goals",
      "plan",
      "input",
      "skills",
      "spawn",
      "images",
      "web",
      "shell",
    ])
      assert.match(answer, new RegExp(`"${key}"\\s*:\\s*"undefined"`, "u"));
  }
  async function records(): Promise<DraftTransactionRecord[]> {
    const folder = join(projectFolder, "draft/journal");
    const names = (await readdir(folder).catch(() => []))
      .filter((name) =>
        /^\d{12}\.[A-Za-z0-9][A-Za-z0-9._-]{1,127}\.json$/u.test(name),
      )
      .sort();
    assert.ok(names.length <= 2, "Unexpected extra transactions");
    return Promise.all(
      names.map(
        async (name) =>
          JSON.parse(
            await readFile(join(folder, name), "utf8"),
          ) as DraftTransactionRecord,
      ),
    );
  }

  mark("authenticated-split");
  const splitTool =
    toolRoute === "dynamic" ? "codex_video_edit__cut_split" : "cut.split";
  const prompt = `Use the guarded editor tools to read the active two-source draft. Split its first clip, ID ${target.clip_id}, at exactly ${splitUs} microseconds on the output timeline using ${splitTool}. Apply exactly one split transaction. The committed draft must have three clips and remain ${totalUs} microseconds long. Do not trim, delete, undo, or make another edit. Read the draft again to verify, then reply briefly.`;
  await page.locator("#codex-thread-input").fill(prompt);
  await page.locator("#send-codex-thread").click();
  let committedDuringTurn = false;
  await expect
    .poll(
      async () => {
        const state = await thread();
        if (state.status === "failed" || state.status === "uncertain")
          throw new Error("Real Codex turn failed; details omitted");
        const journal = await records();
        const committedSplit = journal.find(
          (record) =>
            record.origin === "codex" &&
            record.status === "committed" &&
            record.after.timeline.clips.length === 3,
        );
        if (state.status === "running" && committedSplit) {
          const projected = await page!.evaluate(() =>
            window.desktop.listProjects(),
          );
          if (
            projected.ok &&
            isDeepStrictEqual(
              projected.value.find((item) => item.id === combined.id)?.clips,
              committedSplit.after.timeline.clips.map((clip) => ({
                id: clip.clip_id,
                sourceId: clip.source_id,
                timelineStartUs: clip.timeline_start_us,
                timelineEndUs: clip.timeline_end_us,
                sourceStartUs: clip.source_start_us,
                sourceEndUs: clip.source_end_us,
              })),
            )
          )
            committedDuringTurn = true;
        }
        return (
          state.status === "ready" &&
          state.message === null &&
          state.messages.some(
            (message) => message.role === "user" && message.text === prompt,
          ) &&
          state.messages.some(
            (message) =>
              message.role === "codex" &&
              message.complete &&
              message.text.trim().length > 0,
          )
        );
      },
      { timeout: 240_000, intervals: [100, 250, 500, 1000] },
    )
    .toBe(true);
  assert.equal(
    committedDuringTurn,
    true,
    "Committed split and projected fragments must be visible during the real turn",
  );
  const journal = await records();
  assert.equal(journal.length, 1);
  const split = journal[0]!;
  assert.equal(split.origin, "codex");
  assert.equal(split.kind, "apply");
  assert.equal(split.status, "committed");
  assert.equal(split.operations.length, 1);
  const operation = split.operations[0]!;
  assert.equal(operation.operation_type, "split");
  if (operation.operation_type !== "split")
    throw new Error("Expected clip split");
  assert.equal(operation.clip_id, target.clip_id);
  assert.equal(operation.timeline_position_us, splitUs);
  assert.equal(split.after.timeline.duration_us, totalUs);
  assert.equal(split.after.timeline.clips.length, 3);
  assert.equal(split.after.draft_sequence, 1);
  assert.deepEqual(split.after.timeline.clips.slice(0, 2), operation.after);
  await expect(page.locator("#duration")).toHaveText(` / ${clock(totalUs)}`);
  await seek(page, 0);
  await expect
    .poll(async () => (await canvasHash(page!)) === firstFrameHash, {
      timeout: 30_000,
    })
    .toBe(true);
  await seek(page, splitUs);
  await expect
    .poll(async () => (await canvasHash(page!)) === splitRightFrameHash, {
      timeout: 30_000,
    })
    .toBe(true);
  await seek(page, joinUs);
  await expect
    .poll(async () => (await canvasHash(page!)) === secondSourceFrameHash, {
      timeout: 30_000,
    })
    .toBe(true);
  const edited = await page.evaluate(() => window.desktop.listProjects());
  assert.ok(edited.ok);
  const clips = edited.value.find((item) => item.id === combined.id)?.clips;
  assert.equal(clips?.length, 3);
  assert.equal(clips?.[0]?.timelineStartUs, 0);
  assert.equal(clips?.[0]?.timelineEndUs, splitUs);
  assert.equal(clips?.[1]?.timelineStartUs, splitUs);
  assert.equal(clips?.[1]?.timelineEndUs, joinUs);
  assert.equal(clips?.[1]?.sourceStartUs, splitUs);
  assert.equal(clips?.[2]?.timelineStartUs, joinUs);
  await page.screenshot({
    path: join(evidence, "committed-native-window.png"),
  });

  mark("shared-undo-and-reopen");
  await page.locator("#close-codex").click();
  await page.locator("#undo-edit").click();
  mark("undo-restored-state");
  await expect
    .poll(async () => (await records()).length, { timeout: 60_000 })
    .toBe(2);
  await expect(page.locator("#duration")).toHaveText(` / ${clock(totalUs)}`);
  const undone = await records();
  assert.equal(undone.length, 2);
  assert.equal(undone[1]!.origin, "manual");
  assert.equal(undone[1]!.kind, "undo");
  assert.equal(undone[1]!.target_transaction_id, split.transaction_id);
  assert.deepEqual(undone[1]!.after.timeline, baseline.timeline);
  await expect
    .poll(
      async () => {
        const restored = await page!.evaluate(() =>
          window.desktop.listProjects(),
        );
        return restored.ok
          ? restored.value.find((item) => item.id === combined.id)?.clips
              ?.length
          : null;
      },
      { timeout: 60_000 },
    )
    .toBe(2);
  await seek(page, 0);
  await expect
    .poll(async () => (await canvasHash(page!)) === firstFrameHash, {
      timeout: 30_000,
    })
    .toBe(true);
  mark("reopen-project");
  await electron.close();
  const offline = new DraftTransactionStore(
    join(userData, "project-store"),
    new ProjectStore(join(userData, "project-store"), library),
  );
  assert.deepEqual(
    (await offline.snapshot(combined.id)).draft,
    undone[1]!.after,
  );
  electron = await launch();
  page = await electron.firstWindow();
  await page.locator(`#projects [data-project-id="${combined.id}"]`).click();
  mark("reopen-frame");
  await expect(page.locator("#duration")).toHaveText(` / ${clock(totalUs)}`, {
    timeout: 30_000,
  });
  mark("reopen-duration");
  await seek(page, joinUs);
  mark("reopen-seek");
  await expect
    .poll(async () => (await canvasHash(page!)) === secondSourceFrameHash, {
      timeout: 30_000,
    })
    .toBe(true);
  mark("reopen-exact-frame");
  mark("verify-immutable-inputs");
  assert.deepEqual(await readFile(baselinePath), baselineBytes);
  for (let index = 0; index < sources.length; index++) {
    assert.equal(await fileHash(sources[index]!), originalHashes[index]);
    assert.equal(
      await fileHash(baseline.sources[index]!.managed_path),
      originalHashes[index],
    );
  }
  if (process.argv.includes("--inspect")) {
    await writeFile(join(evidence, "inspection.ready"), "ready\n");
    const deadline = Date.now() + 120_000;
    while (
      Date.now() < deadline &&
      !(await access(join(evidence, "inspection.done")).then(
        () => true,
        () => false,
      ))
    )
      await new Promise((done) => setTimeout(done, 500));
    assert.ok(
      await access(join(evidence, "inspection.done")).then(
        () => true,
        () => false,
      ),
      "Guest visual inspection timed out",
    );
  }
  await writeFile(
    join(evidence, "result.json"),
    JSON.stringify(
      {
        status: "pass",
        scope: "real-authenticated-codex-split",
        toolRoute,
        packaged: true,
        nativeWindow: true,
        sourceCount: 2,
        privateInputs: providedPaths.length === 2,
        committedDuringTurn,
        exactSplitAndJoinFrames: true,
        sharedUndo: true,
        reopen: true,
        immutableSourcesAndBaseline: true,
        audioListening: false,
        windowsAcceptance: false,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "pass", evidence }));
} catch (error) {
  try {
    await page?.screenshot({
      path: join(evidence, "failure-window.png"),
      timeout: 5000,
    });
  } catch {
    /* Preserve the original failure. */
  }
  await writeFile(
    join(evidence, "failure.json"),
    JSON.stringify({
      status: "fail",
      step,
      detailsOmitted: true,
      errorName: error instanceof Error ? error.name : "unknown",
    }),
  );
  console.error(
    `Authenticated native split test failed at ${step}; private details omitted.`,
  );
  process.exitCode = 1;
} finally {
  await electron.close().catch(() => {
    /* Already closed. */
  });
}
