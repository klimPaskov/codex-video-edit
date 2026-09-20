import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { _electron, expect } from "playwright/test";
import type { Page } from "playwright/test";
import { assertTwoSourceInitialProjectSnapshot } from "../../packages/domain/src/project.ts";
import { MediaLibrary } from "../../packages/media-engine/src/library.ts";
import { runProcess } from "../../packages/media-engine/src/process.ts";

assert.equal(
  process.platform,
  "linux",
  "Native tests require the isolated guest",
);
assert.equal(process.getuid?.(), 1000);
assert.equal(process.env.DISPLAY, ":99");
await access("/.dockerenv");
const executablePath = process.argv[2];
assert.ok(executablePath, "Packaged executable path is required");
const root = resolve("test-results");
await mkdir(root, { recursive: true });
const evidence = await mkdtemp(join(root, "native-two-source-"));
const sources: string[] = [];
const originals: Buffer[] = [];
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
  originals.push(await readFile(source));
}
const env = { ...process.env, XDG_CONFIG_HOME: join(evidence, "config") };
let electron = await _electron.launch({
  executablePath,
  chromiumSandbox: true,
  env,
  timeout: 30_000,
});
async function canvasBytes(page: Page): Promise<Buffer> {
  return Buffer.from(
    await page
      .locator("canvas")
      .evaluate((node) =>
        Array.from(
          (node as HTMLCanvasElement)
            .getContext("2d")!
            .getImageData(0, 0, 96, 64).data,
        ),
      ),
  );
}
async function seek(page: Page, timeUs: number): Promise<void> {
  await page.locator("#seek").evaluate((node, value) => {
    const input = node as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, timeUs);
  await expect(page.locator("#time")).toHaveText(
    timeUs === 1_000_000 ? "0:01.000" : "0:00.750",
  );
}
try {
  let page = await electron.firstWindow();
  assert.equal(await electron.evaluate(({ app }) => app.isPackaged), true);
  assert.equal(page.url(), "codex-video-edit://app/index.html");
  await electron.evaluate(({ dialog }, paths) => {
    let index = 0;
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [paths[index++]!],
    });
  }, sources);
  await page.getByRole("button", { name: "Import video", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add footage" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Add footage" }).click();
  await expect(page.locator("#duration")).toHaveText(" / 0:02.000", {
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Add footage" })).toBeHidden();
  const userData = await electron.evaluate(({ app }) =>
    app.getPath("userData"),
  );
  const listed = await page.evaluate(() => window.desktop.listProjects());
  assert.ok(listed.ok);
  assert.equal(listed.value.length, 2);
  const combined = listed.value.find(
    (project) => project.sources?.length === 2,
  );
  assert.ok(combined);
  const baselinePath = join(
    userData,
    "project-store",
    combined.id,
    "baseline.json",
  );
  const baselineBytes = await readFile(baselinePath);
  const baseline: unknown = JSON.parse(baselineBytes.toString("utf8"));
  assertTwoSourceInitialProjectSnapshot(baseline);
  assert.deepEqual(
    combined.sources?.map((source) => source.id),
    baseline.project.source_ids,
  );
  const library = new MediaLibrary(join(userData, "media-library"));
  const expectedSecond = Buffer.from(
    (await library.frame(baseline.sources[1].source_id, 0)).rgbaBase64,
    "base64",
  );
  await seek(page, 750_000);
  const firstFrame = await canvasBytes(page);
  await seek(page, 1_000_000);
  assert.deepEqual(await canvasBytes(page), expectedSecond);
  assert.notDeepEqual(firstFrame, expectedSecond);
  await page.getByRole("button", { name: "Source details" }).click();
  await expect(page.locator("#source-properties")).toContainText("Part 1");
  await expect(page.locator("#source-properties")).toContainText("Part 2");
  await page.screenshot({ path: join(evidence, "two-source-join.png") });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator("#edit-actions")).toBeVisible();
  await expect(page.locator("#trim-start")).toBeDisabled();
  await expect(page.locator("#trim-end")).toBeDisabled();
  await expect(page.locator("#undo-edit")).toBeDisabled();
  await seek(page, 750_000);
  await expect(page.locator("#trim-start")).toBeEnabled();
  await page.locator("#trim-start").click();
  await expect(page.locator("#duration")).toHaveText(" / 0:01.250");
  const editedProjects = await page.evaluate(() =>
    window.desktop.listProjects(),
  );
  assert.ok(editedProjects.ok);
  const edited = editedProjects.value.find(
    (project) => project.id === combined.id,
  );
  assert.equal(edited?.clips?.[0]?.sourceStartUs, 750_000);
  assert.equal(edited?.clips?.[1]?.timelineStartUs, 250_000);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#duration")).toHaveText(" / 0:02.000");
  const restoredProjects = await page.evaluate(() =>
    window.desktop.listProjects(),
  );
  assert.ok(restoredProjects.ok);
  const restored = restoredProjects.value.find(
    (project) => project.id === combined.id,
  );
  assert.equal(restored?.clips?.[0]?.sourceStartUs, 0);
  assert.equal(restored?.clips?.[1]?.timelineStartUs, 1_000_000);
  await electron.close();

  electron = await _electron.launch({
    executablePath,
    chromiumSandbox: true,
    env,
    timeout: 30_000,
  });
  page = await electron.firstWindow();
  await page.locator(`#projects [data-project-id="${combined.id}"]`).click();
  await expect(page.locator("#duration")).toHaveText(" / 0:02.000", {
    timeout: 30_000,
  });
  await seek(page, 1_000_000);
  assert.deepEqual(await canvasBytes(page), expectedSecond);
  assert.deepEqual(await readFile(baselinePath), baselineBytes);
  for (let index = 0; index < sources.length; index++) {
    assert.deepEqual(await readFile(sources[index]!), originals[index]);
    assert.deepEqual(
      await readFile(baseline.sources[index]!.managed_path),
      originals[index],
    );
  }
  await page.screenshot({ path: join(evidence, "two-source-reopened.png") });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator("#interface-scale").selectOption("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#settings-dialog")).toBeHidden();
  assert.equal(
    await electron.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor(),
    ),
    2,
  );
  await page.locator("#edit-actions").scrollIntoViewIfNeeded();
  await expect(page.locator("#edit-actions")).toBeInViewport();
  const actionBounds = await page.locator("#edit-actions").boundingBox();
  assert.ok(actionBounds);
  assert.ok(actionBounds.x >= 0);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  assert.ok(actionBounds.x + actionBounds.width <= viewportWidth);
  await page.screenshot({ path: join(evidence, "two-source-edit-200.png") });
  if (process.argv.includes("--inspect")) {
    await writeFile(join(evidence, "inspection.ready"), "ready\n");
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (
        await access(join(evidence, "inspection.done")).then(
          () => true,
          () => false,
        )
      )
        break;
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  await writeFile(
    join(evidence, "result.json"),
    JSON.stringify(
      {
        scope: "two-source-native-project",
        packaged: true,
        nativeWindow: true,
        sourceCount: 2,
        exactJoinFrame: true,
        reopen: true,
        originalsAndManagedCopiesUnchanged: true,
        baselineUnchanged: true,
        syntheticFixtureHashes: originals.map((bytes) =>
          createHash("sha256").update(bytes).digest("hex"),
        ),
      },
      null,
      2,
    ),
  );
  process.stdout.write(JSON.stringify({ evidence, result: "passed" }) + "\n");
} finally {
  await electron.close();
}
