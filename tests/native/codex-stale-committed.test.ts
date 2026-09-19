/** Offline guarded-tool continuation of a real authenticated native fixture edit. */
import assert from "node:assert/strict";
import {
  access,
  chmod,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import {
  CodexVideoEditToolError,
  CodexVideoEditToolService,
} from "../../packages/codex-tools/src/service.ts";
import type { DraftTransactionRecord } from "../../packages/domain/src/draft-transaction.ts";
import { assertInitialProjectSnapshot } from "../../packages/domain/src/project.ts";
import { sha256 } from "../../packages/media-engine/src/lossless.ts";
import { MediaLibrary } from "../../packages/media-engine/src/library.ts";
import { ProjectStore } from "../../packages/project-store/src/store.ts";
import { DraftTransactionStore } from "../../packages/project-store/src/transactions.ts";

assert.equal(process.platform, "linux", "Requires isolated Linux guest");
assert.equal(process.getuid?.(), 1000);
assert.equal(process.env.DISPLAY, ":99");
await access("/.dockerenv");
const suppliedEvidence = process.argv[2];
const suppliedConfig = process.argv[3];
assert.ok(suppliedEvidence && suppliedConfig);
const evidence = await realpath(suppliedEvidence);
const configRoot = await realpath(suppliedConfig);
assert.equal(evidence, resolve(suppliedEvidence));
assert.equal(configRoot, resolve(suppliedConfig));
assert.ok(evidence.startsWith(resolve("test-results") + sep));
assert.match(basename(evidence), /^native-codex-authenticated-[A-Za-z0-9]+$/u);
const resultDir = await mkdtemp(
  join(resolve("test-results"), "native-codex-stale-"),
);
await chmod(resultDir, 0o700);
let step = "locate-real-fixture";
try {
  const original = join(evidence, "Color sequence.mkv");
  const originalHash = sha256(await readFile(original));
  const userData = join(configRoot, "codex-video-edit");
  const projectsRoot = join(userData, "project-store");
  const matches: Array<{
    projectId: string;
    baselinePath: string;
    baselineBytes: Buffer;
    managedPath: string;
  }> = [];
  for (const entry of await readdir(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const baselinePath = join(projectsRoot, entry.name, "baseline.json");
    let baselineBytes: Buffer;
    try {
      baselineBytes = await readFile(baselinePath);
    } catch {
      continue;
    }
    const baseline: unknown = JSON.parse(baselineBytes.toString("utf8"));
    assertInitialProjectSnapshot(baseline);
    if (baseline.source.original_path === original) {
      matches.push({
        projectId: baseline.project.project_id,
        baselinePath,
        baselineBytes,
        managedPath: baseline.source.managed_path,
      });
    }
  }
  assert.equal(matches.length, 1, "Require one matching real native fixture");
  const matched = matches[0]!;
  assert.equal(sha256(await readFile(matched.managedPath)), originalHash);
  const journalRoot = join(projectsRoot, matched.projectId, "draft/journal");
  const journalNames = (await readdir(journalRoot))
    .filter((name) =>
      /^\d{12}\.[A-Za-z0-9][A-Za-z0-9._-]{1,127}\.json$/u.test(name),
    )
    .sort();
  assert.equal(journalNames.length, 1, "Require one real committed Codex edit");
  const journalPath = join(journalRoot, journalNames[0]!);
  const journalBefore = await readFile(journalPath);
  const edit = JSON.parse(
    journalBefore.toString("utf8"),
  ) as DraftTransactionRecord;
  assert.equal(edit.origin, "codex");
  assert.equal(edit.kind, "apply");
  assert.equal(edit.status, "committed");
  assert.equal(edit.before.draft_sequence, 0);
  assert.equal(edit.before.timeline.duration_us, 1500000);
  assert.equal(edit.after.draft_sequence, 1);
  assert.equal(edit.after.timeline.duration_us, 1000000);
  assert.equal(edit.operations.length, 1);
  assert.equal(edit.operations[0]!.edge, "start");

  step = "reject-stale-guarded-request";
  const projects = new ProjectStore(
    projectsRoot,
    new MediaLibrary(join(userData, "media-library")),
  );
  const drafts = new DraftTransactionStore(projectsRoot, projects);
  assert.deepEqual(
    (await drafts.snapshot(matched.projectId)).draft,
    edit.after,
  );
  const service = new CodexVideoEditToolService(matched.projectId, drafts);
  await assert.rejects(
    service.invoke("cut.trim_edge", {
      schema_version: "1.0",
      request_id: "stale-after-real-codex-001",
      project_id: edit.before.project_id,
      draft_id: edit.before.draft_id,
      base_revision_id: edit.before.base_revision_id,
      expected_sequence: edit.before.draft_sequence,
      expected_timeline_sha256: edit.before.timeline_sha256,
      pass_group_id: "stale-spoken-cut-001",
      reason: "Verify stale freshness after a real Codex edit.",
      clip_id: edit.before.timeline.clips[0]!.clip_id,
      edge: "end",
      timeline_position_us: 1000000,
    }),
    (error: unknown) =>
      error instanceof CodexVideoEditToolError && error.code === "stale_draft",
  );
  assert.deepEqual(
    (await drafts.snapshot(matched.projectId)).draft,
    edit.after,
  );
  assert.deepEqual(await readdir(journalRoot), journalNames);
  assert.deepEqual(await readFile(journalPath), journalBefore);
  assert.deepEqual(await readFile(matched.baselinePath), matched.baselineBytes);
  assert.equal(sha256(await readFile(matched.managedPath)), originalHash);
  assert.equal(sha256(await readFile(original)), originalHash);
  await writeFile(
    join(resultDir, "result.json"),
    JSON.stringify(
      {
        status: "pass",
        scope: "P2-stale-guard-after-authenticated-native-edit",
        guardedServiceRejectedStale: true,
        draftUnchanged: true,
        journalUnchanged: true,
        sourceUnchanged: true,
        baselineUnchanged: true,
        nativeLaunchInThisContinuation: false,
        liveStdioStaleRelayVerified: false,
        sourceHash: originalHash,
        journalHash: sha256(journalBefore),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "pass", evidence: resultDir }));
} catch {
  await writeFile(
    join(resultDir, "failure.json"),
    JSON.stringify({ status: "fail", step, detailsOmitted: true }),
  );
  console.error(
    `Stale continuation failed at ${step}; private details omitted.`,
  );
  process.exitCode = 1;
}
