import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { _electron, expect } from "playwright/test";
import type { Page } from "playwright/test";
import {
  encodeVerifiedMaster,
  sha256,
} from "../../packages/media-engine/src/lossless.ts";

assert.equal(
  process.platform,
  "linux",
  "Native tests require the isolated guest",
);
assert.ok(process.getuid);
assert.equal(process.getuid(), 1000);
assert.equal(process.env.DISPLAY, ":99");
await access("/.dockerenv");
const executablePath = process.argv[2];
assert.ok(executablePath, "Packaged executable path is required");
const evidenceRoot = resolve(".astra/evidence");
await mkdir(evidenceRoot, { recursive: true });
const evidence = await mkdtemp(join(evidenceRoot, "native-product-"));
const video = Buffer.alloc(96 * 64 * 4 * 3);
const colors = [
  [20, 40, 180, 255],
  [30, 170, 50, 255],
  [190, 60, 30, 255],
];
for (let frame = 0; frame < 3; frame++)
  for (let i = 0; i < 96 * 64; i++) {
    for (let channel = 0; channel < 4; channel++)
      video[(frame * 96 * 64 + i) * 4 + channel] =
        channel === 3
          ? 255
          : (colors[frame]![channel]! +
              (i % 96) +
              Math.floor(i / 96) * (channel + 1)) %
            256;
  }
async function assertCanvasFrame(page: Page, frame: number): Promise<void> {
  const actual = await page.locator("canvas").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    return {
      width: canvas.width,
      height: canvas.height,
      pixels: Array.from(
        canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height)
          .data,
      ),
    };
  });
  assert.equal(actual.width, 96);
  assert.equal(actual.height, 64);
  const expected = Buffer.from(
    video.subarray(frame * 96 * 64 * 4, (frame + 1) * 96 * 64 * 4),
  );
  for (let i = 0; i < expected.length; i += 4) {
    const blue = expected[i]!;
    expected[i] = expected[i + 2]!;
    expected[i + 2] = blue;
  }
  assert.deepEqual(Buffer.from(actual.pixels), expected);
}
const audio = Buffer.alloc(72_000 * 2);
for (let i = 0; i < 72_000; i++)
  audio.writeInt16LE(Math.round(Math.sin(i / 20) * 6000), i * 2);
const videoPath = join(evidence, "canonical.raw"),
  audioPath = join(evidence, "canonical.pcm"),
  source = join(evidence, "Color sequence.mkv");
await writeFile(videoPath, video);
await writeFile(audioPath, audio);
const mediaEvidence = await encodeVerifiedMaster(
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
await writeFile(
  join(evidence, "master-roundtrip.json"),
  JSON.stringify(mediaEvidence, null, 2),
);
const sourceHash = sha256(await readFile(source));
const env = { ...process.env, XDG_CONFIG_HOME: join(evidence, "config") };
let electron = await _electron.launch({
  executablePath,
  chromiumSandbox: true,
  env,
  timeout: 30000,
});
try {
  let window = await electron.firstWindow();
  await expect(
    window.getByRole("button", { name: "Import video", exact: true }),
  ).toBeVisible();
  assert.equal(window.url(), "codex-video-edit://app/index.html");
  assert.equal(await electron.evaluate(({ app }) => app.isPackaged), true);
  // Electron's sandboxed metric is macOS/Windows-only. Verify Linux kernel state.
  const renderers = await electron.evaluate(({ app }) =>
    app
      .getAppMetrics()
      .filter((metric) => metric.type === "Tab")
      .map((metric) => metric.pid),
  );
  assert.ok(renderers.length > 0);
  const parentStatus = await readFile("/proc/self/status", "utf8");
  const filters = (status: string): number =>
    Number(/^Seccomp_filters:\s+(\d+)$/m.exec(status)?.[1]);
  const namespaceDepth = (status: string): number =>
    /^NSpid:\s+(.+)$/m.exec(status)![1]!.trim().split(/\s+/).length;
  for (const pid of renderers) {
    const status = await readFile(`/proc/${pid}/status`, "utf8");
    assert.match(status, /^NoNewPrivs:\s+1$/m);
    assert.match(status, /^Seccomp:\s+2$/m);
    assert.ok(
      filters(status) > filters(parentStatus),
      "Renderer must add sandbox filters",
    );
    assert.ok(
      namespaceDepth(status) > namespaceDepth(parentStatus),
      "Renderer must use a nested PID namespace",
    );
  }
  assert.ok(
    !electron.process().spawnargs.some((arg) => arg.includes("--no-sandbox")),
  );
  assert.equal(
    await window.evaluate(
      () => typeof (globalThis as Record<string, unknown>).require,
    ),
    "undefined",
  );
  await electron.evaluate(({ dialog }, sourcePath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [sourcePath],
    });
  }, source);
  await window
    .getByRole("button", { name: "Import video", exact: true })
    .click();
  await expect(window.locator("#frame")).toBeVisible();
  await expect(window.locator("#time")).toHaveText("0:00.000");
  await expect(
    window.getByRole("button", { name: "Library", exact: true }),
  ).toBeFocused();
  await assertCanvasFrame(window, 0);
  await window.getByRole("button", { name: "Next frame", exact: true }).click();
  await expect(window.locator("#time")).toHaveText("0:00.500");
  await assertCanvasFrame(window, 1);
  await window
    .getByRole("button", { name: "Source details", exact: true })
    .click();
  await expect(
    window.getByRole("complementary", { name: "Source details" }),
  ).toBeVisible();
  await expect(
    window.getByRole("button", { name: "Close source details" }),
  ).toBeFocused();
  await window.keyboard.press("Control+,");
  await expect(
    window.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(window.locator("#inspector")).toBeHidden();
  await expect(
    window.getByLabel("Interface size", { exact: true }),
  ).toBeFocused();
  for (let index = 0; index < 6; index++) {
    await window.keyboard.press("Tab");
    assert.equal(
      await window.evaluate(() => !!document.activeElement?.closest("dialog")),
      true,
    );
  }
  await window.keyboard.press("Escape");
  await expect(window.locator("#settings-dialog")).toBeHidden();
  await expect(window.locator("#inspector")).toBeVisible();
  await expect(
    window.getByRole("button", { name: "Close source details" }),
  ).toBeFocused();
  await window.keyboard.press("Escape");
  await expect(window.locator("#inspector")).toBeHidden();
  await expect(
    window.getByRole("button", { name: "Source details", exact: true }),
  ).toBeFocused();
  for (const [width, height, scale] of [
    [1366, 768, 1],
    [1366, 768, 1.5],
    [1366, 768, 2],
    [1200, 800, 2],
    [1920, 1080, 1.25],
  ]) {
    await electron.evaluate(
      ({ BrowserWindow }, size) =>
        BrowserWindow.getAllWindows()[0]!.setSize(size[0]!, size[1]!),
      [width!, height!],
    );
    await window.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      window.getByLabel("Interface size", { exact: true }),
    ).toBeEnabled();
    await window
      .getByLabel("Interface size", { exact: true })
      .selectOption(String(scale));
    await window.getByRole("button", { name: "Save", exact: true }).click();
    await expect(window.locator("#settings-dialog")).toBeHidden();
    assert.equal(
      await electron.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor(),
      ),
      scale,
    );
    await expect(
      window.getByRole("button", { name: "Settings", exact: true }),
    ).toBeFocused();
    assert.equal(
      await window.evaluate(
        () => document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
      true,
    );
    await assertCanvasFrame(window, 1);
    await window
      .getByRole("button", { name: "Source details", exact: true })
      .click();
    assert.equal(
      await window.locator("#inspector").evaluate((node) => {
        const panel = node.getBoundingClientRect();
        const preview = document
          .querySelector(".preview")!
          .getBoundingClientRect();
        return (
          panel.left >= preview.right &&
          panel.bottom <= globalThis.innerHeight &&
          document.querySelector("header")!.getBoundingClientRect().top >= 0 &&
          document.querySelector("#frame-controls")!.getBoundingClientRect()
            .bottom <= globalThis.innerHeight
        );
      }),
      true,
    );
    await window.screenshot({
      path: join(evidence, `shell-${width}-${scale}.png`),
    });
    await window.keyboard.press("Escape");
  }
  await electron.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setSize(1366, 768),
  );
  await window.screenshot({ path: join(evidence, "native-frame-1366.png") });
  await window.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.__injected=true";
    document.body.append(script);
  });
  assert.equal(
    await window.evaluate(
      () => (globalThis as Record<string, unknown>).__injected,
    ),
    undefined,
  );
  assert.equal(
    await electron.evaluate(
      async ({ net }) =>
        (await net.fetch("codex-video-edit://app/main.cjs")).status,
    ),
    404,
  );
  const foreignSenderAccepted = await electron.evaluate(
    async ({ app, BrowserWindow }) => {
      const foreign = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: `${app.getAppPath()}/preload.cjs`,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      await foreign.loadURL("codex-video-edit://app/index.html");
      try {
        await foreign.webContents.executeJavaScript(
          "window.desktop.listMedia()",
        );
        return "unexpectedly allowed";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      } finally {
        foreign.destroy();
      }
    },
  );
  assert.match(
    foreignSenderAccepted,
    /Untrusted request/,
    "Same-origin foreign windows must not access the media library",
  );
  await electron.close();
  electron = await _electron.launch({
    executablePath,
    chromiumSandbox: true,
    env,
    timeout: 30000,
  });
  window = await electron.firstWindow();
  assert.equal(
    await electron.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor(),
    ),
    1.25,
  );
  await window.getByRole("button", { name: /Color sequence/ }).click();
  await expect(window.locator("#frame")).toBeVisible();
  await expect(window.locator("#time")).toHaveText("0:00.000");
  await assertCanvasFrame(window, 0);
  assert.equal(sha256(await readFile(source)), sourceHash);
  await window.screenshot({ path: join(evidence, "native-reopened.png") });
  await writeFile(
    join(evidence, "result.json"),
    JSON.stringify(
      {
        scope: "P1-settings-focus-slice",
        executablePath,
        sourceHash,
        packaged: true,
        sandbox: true,
        import: true,
        exactFramePixels: true,
        pixelScope:
          "All pixels of opaque nonuniform BGRA frames through native canvas readback; not display or arbitrary alpha equality",
        reopen: true,
        sourceUnchanged: true,
        preferencesPersisted: true,
        keyboardFocus: true,
        modalIsolation: true,
        computerUse: false,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      evidence,
      config: env.XDG_CONFIG_HOME,
      source,
      executablePath,
    }),
  );
} finally {
  await electron.close();
}
