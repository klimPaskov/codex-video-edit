/** Real Codex range-cut test. The private app-owned account is supplied by the guest. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
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
import type { Page } from "playwright/test";
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
const configRoot = await realpath(configArgument);
assert.equal(
  configRoot,
  resolve(configArgument),
  "Config root must not redirect",
);
assert.notEqual(configRoot, "/");
const providedPaths = process.argv
  .slice(4)
  .filter((argument) => argument !== "--inspect" && argument !== "--batch");
const batch = process.argv.includes("--batch");
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
const evidence = await mkdtemp(join(resultRoot, "native-codex-range-cut-"));
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
    sources.push(await realpath(sourcePath));
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
const originalHashes = await Promise.all(sources.map(fileHash));

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
  return active.locator("canvas").evaluate(async (node) => {
    const canvas = node as HTMLCanvasElement;
    if (!canvas.width || !canvas.height) return null;
    const pixels = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", pixels),
    );
    return Array.from(digest, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  });
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
  const cutStartUs = providedPaths.length === 2 ? joinUs - 1_000_000 : 250_000;
  const cutEndUs = providedPaths.length === 2 ? joinUs + 1_000_000 : 1_500_000;
  const earlyStartUs = 50_000;
  const earlyEndUs = 150_000;
  assert.ok(
    cutStartUs > 0 && cutEndUs < totalUs,
    "Both sources must extend beyond the requested cut",
  );
  if (batch) assert.ok(earlyEndUs < cutStartUs);
  const secondSourceStartUs = cutEndUs - joinUs;
  const cutDurationUs =
    totalUs - (cutEndUs - cutStartUs) - (batch ? earlyEndUs - earlyStartUs : 0);
  const editedJoinUs = cutStartUs - (batch ? earlyEndUs - earlyStartUs : 0);
  mark("select-combined-project");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.locator(`#projects [data-project-id="${combined.id}"]`).click();
  await expect(page.locator("#duration")).toHaveText(` / ${clock(totalUs)}`, {
    timeout: 120_000,
  });
  const library = new MediaLibrary(join(userData, "media-library"));
  const firstFrame = Buffer.from(
    (await library.frame(baseline.sources[0].source_id, cutStartUs)).rgbaBase64,
    "base64",
  );
  const cutJoinFrame = Buffer.from(
    (await library.frame(baseline.sources[1].source_id, secondSourceStartUs))
      .rgbaBase64,
    "base64",
  );
  mark("open-edit-stage");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator("#edit-actions")).toBeVisible({ timeout: 120_000 });
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
  if (batch) {
    const registry = JSON.parse(
      await readFile(
        join(userData, "codex/context/threads/project-threads.json"),
        "utf8",
      ),
    ) as { entries: Array<{ projectId: string; toolRoute?: string }> };
    assert.equal(
      registry.entries.find((entry) => entry.projectId === combined.id)
        ?.toolRoute,
      "dynamic",
    );
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

  mark("authenticated-range-cut");
  const prompt = batch
    ? `Use the guarded editor tools to read the active two-source draft. Call codex_video_edit__cut_delete_ranges exactly once with these two confirmed disjoint half-open output-time ranges in descending order: [${cutStartUs}, ${cutEndUs}) across the source join, then [${earlyStartUs}, ${earlyEndUs}) in the first source. The batch must be one transaction with two ripple_delete operations and final duration ${cutDurationUs} microseconds. Do not use cut_delete_range, split, trim, undo, or make another edit. Read the draft again to verify, then reply briefly.`
    : `Use the guarded editor tools to read the active two-source draft. Delete exactly the half-open output range [${cutStartUs}, ${cutEndUs}) microseconds using cut.delete_range, spanning the join between its two source clips. Apply exactly one range-cut transaction. The committed draft must be ${cutDurationUs} microseconds long. Do not trim, undo, or make another edit. Read the draft again to verify, then reply briefly.`;
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
        if (
          state.status === "running" &&
          journal.some(
            (record) =>
              record.origin === "codex" &&
              record.status === "committed" &&
              record.after.timeline.duration_us === cutDurationUs,
          )
        )
          committedDuringTurn = true;
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
    "Committed edit must exist during the real turn",
  );
  const journal = await records();
  assert.equal(journal.length, 1);
  const cut = journal[0]!;
  assert.equal(cut.origin, "codex");
  assert.equal(cut.kind, "apply");
  assert.equal(cut.status, "committed");
  assert.equal(cut.operations.length, batch ? 2 : 1);
  const operation = cut.operations[0]!;
  assert.equal(operation.operation_type, "ripple_delete");
  if (operation.operation_type !== "ripple_delete")
    throw new Error("Expected range cut");
  assert.equal(operation.start_us, cutStartUs);
  assert.equal(operation.end_us, cutEndUs);
  if (batch) {
    const second = cut.operations[1]!;
    assert.equal(second.operation_type, "ripple_delete");
    if (second.operation_type !== "ripple_delete")
      throw new Error("Expected second range cut");
    assert.equal(second.start_us, earlyStartUs);
    assert.equal(second.end_us, earlyEndUs);
  }
  assert.equal(cut.after.timeline.duration_us, cutDurationUs);
  assert.equal(cut.after.draft_sequence, 1);
  await expect(page.locator("#duration")).toHaveText(
    ` / ${clock(cutDurationUs)}`,
  );
  await seek(page, editedJoinUs);
  await expect
    .poll(async () => (await canvasHash(page!)) === sha256(cutJoinFrame), {
      timeout: 30_000,
    })
    .toBe(true);
  const edited = await page.evaluate(() => window.desktop.listProjects());
  assert.ok(edited.ok);
  const clips = edited.value.find((item) => item.id === combined.id)?.clips;
  assert.equal(clips?.length, batch ? 3 : 2);
  assert.equal(clips?.[batch ? 1 : 0]?.timelineEndUs, editedJoinUs);
  assert.equal(clips?.[batch ? 2 : 1]?.timelineStartUs, editedJoinUs);
  assert.equal(clips?.[batch ? 2 : 1]?.sourceStartUs, secondSourceStartUs);
  await page.screenshot({
    path: join(evidence, "committed-native-window.png"),
  });

  mark("shared-undo-and-reopen");
  await page.locator("#close-codex").click();
  await page.locator("#undo-edit").click();
  mark("undo-restored-state");
  await expect(page.locator("#duration")).toHaveText(` / ${clock(totalUs)}`);
  const undone = await records();
  assert.equal(undone.length, 2);
  assert.equal(undone[1]!.origin, "manual");
  assert.equal(undone[1]!.kind, "undo");
  assert.equal(undone[1]!.target_transaction_id, cut.transaction_id);
  assert.deepEqual(undone[1]!.after.timeline, baseline.timeline);
  await seek(page, cutStartUs);
  await expect
    .poll(async () => (await canvasHash(page!)) === sha256(firstFrame), {
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
  const restoredSecond = Buffer.from(
    (await library.frame(baseline.sources[1].source_id, 0)).rgbaBase64,
    "base64",
  );
  await expect
    .poll(async () => (await canvasHash(page!)) === sha256(restoredSecond), {
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
        scope: batch
          ? "real-authenticated-codex-range-batch"
          : "real-authenticated-codex-range-cut",
        packaged: true,
        nativeWindow: true,
        sourceCount: 2,
        privateInputs: providedPaths.length === 2,
        committedDuringTurn,
        exactJoinFrame: true,
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
    `Authenticated native range-cut test failed at ${step}; private details omitted.`,
  );
  process.exitCode = 1;
} finally {
  await electron.close().catch(() => {
    /* Already closed. */
  });
}
