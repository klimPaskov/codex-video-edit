/** A paid, user-started OpenAI fixture edit in packaged isolated Electron. */
import assert from "node:assert/strict";
import {
  access,
  chmod,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, expect, type Page } from "playwright/test";
import { assertInitialProjectSnapshot } from "../../packages/domain/src/project.ts";
import type { DraftTransactionRecord } from "../../packages/domain/src/draft-transaction.ts";
import {
  encodeVerifiedMaster,
  sha256,
} from "../../packages/media-engine/src/lossless.ts";

assert.equal(process.platform, "linux");
assert.equal(process.getuid?.(), 1000);
assert.equal(process.env.DISPLAY, ":99");
await access("/.dockerenv");
const executablePath = process.argv[2];
const privateKeyPath = process.argv[3];
if (
  !executablePath?.startsWith("/home/node/") ||
  privateKeyPath !== join(resolve("test-results"), "private-openai.key")
)
  throw new Error(
    "Packaged executable and key input must stay inside the guest",
  );
const keyStat = await lstat(privateKeyPath);
if (!keyStat.isFile() || keyStat.isSymbolicLink() || keyStat.mode & 0o077)
  throw new Error("Private test key is not restricted");
let key: string;
try {
  key = (await readFile(privateKeyPath, "utf8")).trim();
} finally {
  await unlink(privateKeyPath);
}
if (key.length < 8 || key.length > 1024 || !/^[\x21-\x7e]+$/u.test(key))
  throw new Error("Invalid private key input");

const evidence = await mkdtemp(
  join(resolve("test-results"), "native-api-auth-edit-"),
);
await chmod(evidence, 0o700);
const configRoot = await mkdtemp(join(evidence, "account-"));
await chmod(configRoot, 0o700);
const canonicalVideo = Buffer.alloc(96 * 64 * 4 * 3);
const colors = [
  [20, 40, 180],
  [30, 170, 50],
  [190, 60, 30],
];
for (let frame = 0; frame < 3; frame++)
  for (let pixel = 0; pixel < 96 * 64; pixel++)
    for (let channel = 0; channel < 4; channel++)
      canonicalVideo[(frame * 96 * 64 + pixel) * 4 + channel] =
        channel === 3
          ? 255
          : (colors[frame]![channel]! +
              (pixel % 96) +
              Math.floor(pixel / 96) * (channel + 1)) %
            256;
const canonicalAudio = Buffer.alloc(72_000 * 2);
for (let sample = 0; sample < 72_000; sample++)
  canonicalAudio.writeInt16LE(
    Math.round(Math.sin(sample / 20) * 6000),
    sample * 2,
  );
const videoPath = join(evidence, "canonical.raw");
const audioPath = join(evidence, "canonical.pcm");
const source = join(evidence, "fixture.mkv");
await writeFile(videoPath, canonicalVideo);
await writeFile(audioPath, canonicalAudio);
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
const sourceBytes = await readFile(source);
const sourceHash = sha256(sourceBytes);
await writeFile(
  join(evidence, "provenance.json"),
  JSON.stringify({
    asarHash: sha256(
      await readFile(join(dirname(executablePath), "resources/app.asar")),
    ),
    testHash: sha256(await readFile(fileURLToPath(import.meta.url))),
  }),
);

async function assertFrame(page: Page, frame: number): Promise<void> {
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
    canonicalVideo.subarray(frame * 96 * 64 * 4, (frame + 1) * 96 * 64 * 4),
  );
  for (let index = 0; index < expected.length; index += 4) {
    const blue = expected[index]!;
    expected[index] = expected[index + 2]!;
    expected[index + 2] = blue;
  }
  const pixels = Buffer.from(actual.pixels);
  assert.equal(pixels.length, expected.length);
  for (let index = 0; index < pixels.length; index++)
    if (pixels[index] !== expected[index])
      throw new assert.AssertionError({
        message: "Frame pixel mismatch",
        actual: pixels[index],
        expected: expected[index],
      });
}

let electron: Awaited<ReturnType<typeof _electron.launch>> | undefined;
let step = "launch";
let passed = false;
try {
  const launch = () =>
    _electron.launch({
      executablePath,
      chromiumSandbox: true,
      env: { ...process.env, DISPLAY: ":99", XDG_CONFIG_HOME: configRoot },
      timeout: 30000,
    });
  electron = await launch();
  let page = await electron.firstWindow();
  assert.equal(await electron.evaluate(({ app }) => app.isPackaged), true);
  assert.equal(page.url(), "codex-video-edit://app/index.html");
  await electron.evaluate(({ shell }) => {
    shell.openExternal = async () => {
      throw new Error("External launch disabled");
    };
  });
  await electron.evaluate(() => {
    const scope = globalThis as typeof globalThis & {
      nativeProviderStatuses?: number[];
    };
    scope.nativeProviderStatuses = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      if (String(input) !== "https://api.openai.com/v1/chat/completions")
        return originalFetch(input, init);
      try {
        const response = await originalFetch(input, init);
        scope.nativeProviderStatuses?.push(response.status);
        return response;
      } catch (error) {
        scope.nativeProviderStatuses?.push(-1);
        throw error;
      }
    };
  });

  step = "import-fixture";
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
  await assertFrame(page, 0);
  const listed = await page.evaluate(() => window.desktop.listProjects());
  assert.ok(listed.ok);
  const added = listed.value.filter(
    (item) => !before.value.some((prior) => prior.id === item.id),
  );
  assert.equal(added.length, 1);
  const project = added[0]!;
  const userData = await electron.evaluate(({ app }) =>
    app.getPath("userData"),
  );
  const folder = join(userData, "project-store", project.id);
  const baselineBytes = await readFile(join(folder, "baseline.json"));
  const baseline: unknown = JSON.parse(baselineBytes.toString("utf8"));
  assertInitialProjectSnapshot(baseline);
  assert.equal(baseline.timeline.duration_us, 1500000);
  assert.equal(
    sha256(await readFile(baseline.source.managed_path)),
    sourceHash,
  );

  step = "connect-live-catalog";
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "API providers", exact: true })
    .click();
  await page.locator("#api-provider-id").selectOption("openai");
  await page.locator("#api-provider-remember").uncheck({ force: true });
  await page.locator("#api-provider-key").fill(key);
  await page.locator("#api-provider-connect").click();
  await expect(page.locator("#api-provider-status")).toHaveText(
    "Key available for this session",
    { timeout: 90000 },
  );
  await expect(page.locator("#api-provider-key")).toHaveValue("");
  const catalog = await page.evaluate(() => window.desktop.getApiProviders());
  assert.ok(catalog.ok);
  const openai = catalog.value.providers.find((item) => item.id === "openai");
  assert.ok(openai?.connected && openai.models.includes("gpt-4.1-mini"));
  assert.ok(!JSON.stringify(catalog.value).includes(key));
  await page.locator("#api-provider-model").selectOption("gpt-4.1-mini");
  await expect
    .poll(async () => {
      const reply = await page.evaluate(() => window.desktop.getApiProviders());
      return reply.ok
        ? reply.value.providers.find((item) => item.id === "openai")
            ?.selectedModel
        : null;
    })
    .toBe("gpt-4.1-mini");
  await page.keyboard.press("Escape");

  step = "explicit-live-send";
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await page.locator("#assistant-provider").selectOption("openai");
  await expect(page.locator("#api-turn-notice")).toBeVisible();
  await page
    .getByRole("button", { name: "Open conversation", exact: true })
    .click();
  const threadRequest = {
    schema_version: "1.0",
    project_id: project.id,
    provider: "openai",
  } as const;
  const thread = async () => {
    const reply = await page.evaluate(
      (request) => window.desktop.getApiThread(request),
      threadRequest,
    );
    assert.ok(reply.ok);
    return reply.value;
  };
  await expect.poll(async () => (await thread()).status).toBe("ready");
  const prompt =
    "This is a synthetic test project with one clip. First call timeline_get_summary " +
    "to read its current draft identifiers, sequence and timeline hash. Then call " +
    "cut_trim_edge on that sole clip to trim exactly 500000 microseconds from its " +
    "start, using the fresh values from the read tool. Make no other changes. " +
    "Reply only after the trim tool succeeds.";
  await page.locator("#codex-thread-input").fill(prompt);
  await page.locator("#send-codex-thread").click();
  await expect
    .poll(async () => (await thread()).status, { timeout: 180000 })
    .toMatch(/^(ready|failed)$/u);
  const settled = await thread();
  await writeFile(
    join(evidence, "provider-statuses.json"),
    JSON.stringify(
      await electron.evaluate(() => {
        const scope = globalThis as typeof globalThis & {
          nativeProviderStatuses?: number[];
        };
        return scope.nativeProviderStatuses ?? [];
      }),
    ),
  );
  assert.equal(
    settled.status,
    "ready",
    "Authenticated provider turn did not complete",
  );
  const journalNames = (await readdir(join(folder, "draft/journal")))
    .filter((name) => /^\d{12}\..+\.json$/u.test(name))
    .sort();
  assert.equal(journalNames.length, 1, "Provider did not commit one edit");
  const record = JSON.parse(
    await readFile(join(folder, "draft/journal", journalNames[0]!), "utf8"),
  ) as DraftTransactionRecord;
  assert.equal(record.origin, "api_provider");
  assert.equal(record.after.timeline.duration_us, 1000000);
  await expect(page.locator("#seek")).toHaveAttribute("max", "500000");
  await expect
    .poll(
      async () => {
        try {
          await assertFrame(page, 1);
          return true;
        } catch (error) {
          if (error instanceof assert.AssertionError) return false;
          throw error;
        }
      },
      { timeout: 30000 },
    )
    .toBe(true);
  await page.screenshot({
    path: join(evidence, "authenticated-trim-private.png"),
  });

  step = "reopen-project";
  await electron.close();
  electron = await launch();
  page = await electron.firstWindow();
  await page
    .locator('#projects [data-project-id="' + project.id + '"]')
    .click();
  await expect(page.locator("#frame")).toBeVisible();
  await expect(page.locator("#seek")).toHaveAttribute("max", "500000");
  await assertFrame(page, 1);
  assert.equal(sha256(await readFile(source)), sourceHash);
  assert.equal(
    sha256(await readFile(baseline.source.managed_path)),
    sourceHash,
  );
  assert.deepEqual(
    await readFile(join(folder, "baseline.json")),
    baselineBytes,
  );
  assert.deepEqual(await readFile(source), sourceBytes);
  const reopenedProviders = await page.evaluate(() =>
    window.desktop.getApiProviders(),
  );
  assert.ok(reopenedProviders.ok);
  assert.equal(
    reopenedProviders.value.providers.find((item) => item.id === "openai")
      ?.connected,
    false,
  );
  const conversation = await readFile(
    join(userData, "api-provider-threads", project.id + ".openai.json"),
    "utf8",
  );
  assert.ok(!conversation.includes(key));
  passed = true;
  await writeFile(
    join(evidence, "result.json"),
    JSON.stringify({
      status: "pass",
      scope: "P2-authenticated-OpenAI-provider-draft",
      packagedNativeWindow: true,
      liveCatalog: true,
      explicitPaidSend: true,
      committedTrim: true,
      sourceAndBaselineUnchanged: true,
      projectReopened: true,
      sessionKeyNotRestored: true,
      hostInput: false,
    }),
  );
} catch (error) {
  const detail =
    error instanceof Error
      ? (error.name + ": " + error.message)
          .replaceAll(key, "[redacted]")
          .slice(0, 1000)
      : "Unknown test error";
  await writeFile(
    join(evidence, "failure.json"),
    JSON.stringify({
      status: "fail",
      step,
      privateDiagnostic: detail,
    }),
  );
  console.error("Authenticated provider native test failed at " + step + ".");
  process.exitCode = 1;
} finally {
  await electron?.close();
}
if (passed) console.log(JSON.stringify({ status: "pass", evidence }));
