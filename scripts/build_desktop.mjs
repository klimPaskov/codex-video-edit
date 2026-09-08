import { build } from "esbuild";
import { packager } from "@electron/packager";
import {
  access,
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

assert.equal(
  process.platform,
  "linux",
  "Automated builds run only in the isolated guest",
);
assert.equal(process.getuid(), 1000);
assert.equal(process.env.DISPLAY, ":99");
await access("/.dockerenv");
const root = resolve(import.meta.dirname, "..");
const evidence = join(root, ".astra/evidence");
await mkdir(evidence, { recursive: true });
const output = await mkdtemp(join(evidence, "desktop-build-"));
const staging = join(output, "app");
const codexVersion = "0.142.3";
const codexPackage = join(root, "node_modules/@openai/codex-linux-x64");
const codexPackageMetadata = JSON.parse(
  await readFile(join(codexPackage, "package.json"), "utf8"),
);
assert.equal(codexPackageMetadata.version, `${codexVersion}-linux-x64`);
assert.equal(codexPackageMetadata.license, "Apache-2.0");
const codexSource = join(
  codexPackage,
  "vendor/x86_64-unknown-linux-musl/bin/codex",
);
assert.ok((await lstat(codexSource)).isFile());
assert.ok(!(await lstat(codexSource)).isSymbolicLink());
const codexResources = join(output, "codex");
await mkdir(codexResources);
await copyFile(codexSource, join(codexResources, "codex"));
await chmod(join(codexResources, "codex"), 0o755);
await copyFile(
  join(root, "licenses/CODEX-APACHE-2.0.txt"),
  join(codexResources, "LICENSE-APACHE-2.0.txt"),
);
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
const codexManifest = {
  schemaVersion: 1,
  version: codexVersion,
  platform: "linux",
  arch: "x64",
  executable: "codex",
  size: (await lstat(join(codexResources, "codex"))).size,
  sha256: await sha256(join(codexResources, "codex")),
  licenseSha256: await sha256(join(codexResources, "LICENSE-APACHE-2.0.txt")),
};
await writeFile(
  join(codexResources, "manifest.json"),
  JSON.stringify(codexManifest, null, 2),
);
await mkdir(join(staging, "renderer"), { recursive: true });
await build({
  entryPoints: [join(root, "apps/desktop/src/main.ts")],
  outfile: join(staging, "main.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron"],
});
await build({
  entryPoints: [join(root, "apps/desktop/src/preload.ts")],
  outfile: join(staging, "preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron"],
});
await build({
  entryPoints: [join(root, "apps/desktop/renderer/renderer.ts")],
  outfile: join(staging, "renderer/renderer.js"),
  bundle: true,
  platform: "browser",
  target: "chrome152",
});
for (const file of ["index.html", "style.css"])
  await copyFile(
    join(root, "apps/desktop/renderer", file),
    join(staging, "renderer", file),
  );
await copyFile(join(root, "LICENSE"), join(staging, "LICENSE"));
await writeFile(
  join(staging, "package.json"),
  JSON.stringify({
    name: "codex-video-edit",
    productName: "codex-video-edit",
    version: "0.0.1",
    main: "main.cjs",
    license: "MIT",
  }),
);
const packages = await packager({
  dir: staging,
  out: join(output, "packaged"),
  name: "codex-video-edit",
  executableName: "codex-video-edit",
  platform: "linux",
  arch: "x64",
  electronVersion: "44.2.0",
  asar: true,
  extraResource: [codexResources],
  prune: false,
  overwrite: false,
});
await writeFile(
  join(output, "build.json"),
  JSON.stringify(
    {
      packages,
      root,
      electron: "44.2.0",
      codex: codexManifest,
      scope: "native-media-bootstrap",
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ output, executable: join(packages[0], "codex-video-edit") }),
);
