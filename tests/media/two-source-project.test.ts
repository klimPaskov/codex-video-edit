import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { DesktopProjectRuntime } from "../../apps/desktop/src/project-runtime.ts";
import { CodexVideoEditToolService } from "../../packages/codex-tools/src/service.ts";
import type { ProjectView } from "../../packages/domain/src/project-view.ts";
import { MediaLibrary } from "../../packages/media-engine/src/library.ts";
import { runProcess } from "../../packages/media-engine/src/process.ts";
import { ProjectStore } from "../../packages/project-store/src/store.ts";
import { DraftTransactionStore } from "../../packages/project-store/src/transactions.ts";

async function fixture() {
  const base = resolve("test-results/two-source-project");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "fixture-"));
  const library = new MediaLibrary(join(root, "library"));
  const paths: string[] = [];
  const ids: string[] = [];
  for (const [index, pattern] of ["testsrc", "testsrc2"].entries()) {
    const path = join(root, `part-${index + 1}.mp4`);
    await runProcess({
      executable: "ffmpeg",
      args: [
        "-v",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        `${pattern}=size=16x16:rate=2:duration=1`,
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
        path,
      ],
    });
    paths.push(path);
    ids.push((await library.importFile(path)).id);
  }
  const projectRoot = join(root, "projects");
  const projects = new ProjectStore(projectRoot, library);
  const baseline = await projects.createFromTwoMedia(ids[0]!, ids[1]!);
  const drafts = new DraftTransactionStore(projectRoot, projects);
  const runtime = new DesktopProjectRuntime(drafts, library);
  return {
    root,
    paths,
    ids,
    library,
    projectRoot,
    projects,
    baseline,
    drafts,
    runtime,
  };
}

function request(view: ProjectView, timelineTimeUs: number) {
  return {
    projectId: view.id,
    draftId: view.draft.id,
    baseRevisionId: view.draft.baseRevisionId,
    expectedSequence: view.draft.sequence,
    expectedTimelineSha256: view.draft.timelineSha256,
    timelineTimeUs,
  };
}

test("two verified sources form one editable draft with an exact seek join and undo", async () => {
  const {
    paths,
    ids,
    library,
    projectRoot,
    projects,
    baseline,
    drafts,
    runtime,
  } = await fixture();
  const originals = await Promise.all(paths.map((path) => readFile(path)));
  const baselinePath = join(
    projectRoot,
    baseline.project.project_id,
    "baseline.json",
  );
  const baselineBytes = await readFile(baselinePath);
  assert.equal(baseline.schema_version, "1.1");
  assert.deepEqual(baseline.project.source_ids, ids);
  assert.equal(baseline.timeline.clips[0]!.timeline_end_us, 1_000_000);
  assert.equal(baseline.timeline.clips[1]!.timeline_start_us, 1_000_000);
  const view = await runtime.view(baseline.project.project_id);
  assert.deepEqual(
    view.sources?.map((source) => source.id),
    ids,
  );
  assert.equal(view.timeline.durationUs, 2_000_000);
  assert.deepEqual(
    view.clips?.map((clip) => ({
      id: clip.id,
      sourceId: clip.sourceId,
      timelineStartUs: clip.timelineStartUs,
      timelineEndUs: clip.timelineEndUs,
    })),
    [
      {
        id: "clip-main",
        sourceId: ids[0],
        timelineStartUs: 0,
        timelineEndUs: 1_000_000,
      },
      {
        id: "clip-following",
        sourceId: ids[1],
        timelineStartUs: 1_000_000,
        timelineEndUs: 2_000_000,
      },
    ],
  );
  const summary = await new CodexVideoEditToolService(view.id, drafts).invoke(
    "project.get_summary",
    { schema_version: "1.0", project_id: view.id },
  );
  assert.deepEqual(
    (summary as { sources: { source_id: string }[] }).sources.map(
      (source) => source.source_id,
    ),
    ids,
  );
  assert.ok(!JSON.stringify(summary).includes(paths[0]!));
  assert.ok(!JSON.stringify(summary).includes(paths[1]!));
  const beforeJoin = await runtime.frame(request(view, 999_999));
  const atJoin = await runtime.frame(request(view, 1_000_000));
  assert.equal(beforeJoin.status, "ready");
  assert.equal(atJoin.status, "ready");
  if (beforeJoin.status !== "ready" || atJoin.status !== "ready") return;
  assert.deepEqual(beforeJoin.frame, await library.frame(ids[0]!, 999_999));
  assert.deepEqual(atJoin.frame, await library.frame(ids[1]!, 0));
  assert.notDeepEqual(beforeJoin.frame, atJoin.frame);

  const initial = await drafts.snapshot(view.id);
  const edited = await drafts.applyManual({
    schema_version: "1.0",
    request_id: "two-source-trim-request",
    project_id: view.id,
    draft_id: initial.draft.draft_id,
    base_revision_id: initial.draft.base_revision_id,
    expected_sequence: initial.draft.draft_sequence,
    expected_timeline_sha256: initial.draft.timeline_sha256,
    pass_group: { pass_group_id: "two-source-manual-pass", kind: "manual" },
    reason: "Trim the opening while keeping the following footage adjacent.",
    operations: [
      {
        type: "trim",
        clip_id: "clip-main",
        edge: "start",
        timeline_position_us: 200_000,
      },
    ],
  });
  assert.equal(edited.draft.timeline.clips[1]!.timeline_start_us, 800_000);
  assert.equal(edited.draft.timeline.duration_us, 1_800_000);
  const editedView = await runtime.view(view.id);
  assert.equal(editedView.clips?.[0]?.sourceStartUs, 200_000);
  assert.equal(editedView.clips?.[1]?.timelineStartUs, 800_000);
  const editedJoin = await runtime.frame(request(editedView, 800_000));
  assert.equal(editedJoin.status, "ready");
  if (editedJoin.status === "ready")
    assert.deepEqual(editedJoin.frame, await library.frame(ids[1]!, 0));
  const reopened = new DraftTransactionStore(
    projectRoot,
    new ProjectStore(projectRoot, library),
  );
  assert.deepEqual((await reopened.snapshot(view.id)).draft, edited.draft);
  const undone = await reopened.undoManual({
    schema_version: "1.0",
    request_id: "two-source-undo-request",
    project_id: view.id,
    draft_id: edited.draft.draft_id,
    base_revision_id: edited.draft.base_revision_id,
    expected_sequence: edited.draft.draft_sequence,
    expected_timeline_sha256: edited.draft.timeline_sha256,
    target_transaction_id: edited.transaction.transaction_id,
    reason: "Restore the original two-source join.",
  });
  assert.equal(undone.draft.timeline.duration_us, 2_000_000);
  assert.equal(undone.draft.timeline.clips[1]!.timeline_start_us, 1_000_000);
  assert.deepEqual(await readFile(baselinePath), baselineBytes);
  for (let index = 0; index < paths.length; index++)
    assert.deepEqual(await readFile(paths[index]!), originals[index]);
  const secondManaged = (await library.verifiedSource(ids[1]!)).managedPath;
  await writeFile(secondManaged, "tampered");
  await assert.rejects(projects.open(view.id));
});
