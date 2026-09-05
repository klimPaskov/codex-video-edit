const { _electron } = require("playwright");
const assert = require("node:assert/strict");
const { readFile, writeFile, mkdtemp } = require("node:fs/promises");
const path = require("node:path");

(async () => {
  assert.equal(
    process.platform,
    "linux",
    "Run only inside the isolated test container",
  );
  assert.equal(process.env.DISPLAY, ":99");
  assert.equal(process.getuid(), 1000);
  await readFile("/.dockerenv");
  const evidence = await mkdtemp("/home/node/evidence/electron-probe-");
  const electron = await _electron.launch({
    executablePath: require("electron"),
    args: [path.join(__dirname, "main.cjs")],
    chromiumSandbox: true,
    timeout: 30000,
  });
  try {
    const window = await electron.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    assert.equal(await window.title(), "Electron environment probe");
    assert.match(window.url(), /^file:\/\//);
    assert.deepEqual(
      await window.evaluate(() => ({
        sandboxed: globalThis.environmentProbe.sandboxed,
        contextIsolated: globalThis.environmentProbe.contextIsolated,
        node: typeof globalThis.require,
      })),
      { sandboxed: true, contextIsolated: true, node: "undefined" },
    );
    const args = electron.process().spawnargs;
    assert.ok(
      !args.some((value) =>
        /--(?:no-sandbox|disable-setuid-sandbox)/.test(value),
      ),
    );
    await window.getByRole("button", { name: "Verify input" }).click();
    assert.equal(
      await window.locator("#result").textContent(),
      "Native input received",
    );
    await window.screenshot({ path: path.join(evidence, "window.png") });
    const result = {
      scope: "environment-only",
      electron: "44.2.0",
      playwright: "1.63.0",
      sandboxed: true,
      contextIsolated: true,
      nodeIntegration: false,
      input: "passed",
      args,
    };
    await writeFile(
      path.join(evidence, "result.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(
      "Sandboxed native Electron environment probe passed. Product acceptance is not established.",
    );
    console.log(`Private evidence: ${evidence}`);
  } finally {
    await electron.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
