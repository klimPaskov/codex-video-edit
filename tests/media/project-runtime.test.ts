import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  DesktopProjectRuntime,
  invokeWithProjectDraftRefresh,
  type ProjectDraftNotice,
} from "../../apps/desktop/src/project-runtime.ts";
import type { ProjectView } from "../../packages/domain/src/project-view.ts";
import { MediaLibrary } from "../../packages/media-engine/src/library.ts";
import { encodeVerifiedMaster } from "../../packages/media-engine/src/lossless.ts";
import { ProjectStore } from "../../packages/project-store/src/store.ts";
import { DraftTransactionStore } from "../../packages/project-store/src/transactions.ts";

async function fixture() {
  const base = resolve("test-results/project-runtime");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "fixture-")),
    source = join(root, "source.mkv"),
    videoPath = join(root, "source.bgra"),
    audioPath = join(root, "source.s16le"),
    video = Buffer.alloc(16 * 16 * 4 * 3);
  for (let frame = 0; frame < 3; frame++)
    for (let pixel = 0; pixel < 16 * 16; pixel++) {
      const offset = (frame * 16 * 16 + pixel) * 4;
      video[offset] = 20 + frame * 50;
      video[offset + 1] = 40 + frame * 40;
      video[offset + 2] = 60 + frame * 30;
      video[offset + 3] = 255;
    }
  await writeFile(videoPath, video);
  await writeFile(audioPath, Buffer.alloc(48_000 * 3));
  await encodeVerifiedMaster(
    {
      videoPath,
      audioPath,
      role: "canonical",
      format: {
        width: 16,
        height: 16,
        frameRate: { numerator: 2, denominator: 1 },
        pixelFormat: "bgra",
        color: {
          range: "pc",
          space: "gbr",
          primaries: "bt709",
          transfer: "bt709",
        },
        audio: { format: "s16le", sampleRate: 48_000, channelLayout: "mono" },
      },
    },
    source,
  );
  const library = new MediaLibrary(join(root, "library")),
    media = await library.importFile(source),
    projectsRoot = join(root, "projects"),
    projects = new ProjectStore(projectsRoot, library),
    baseline = await projects.createFromMedia(media.id),
    drafts = new DraftTransactionStore(projectsRoot, projects),
    runtime = new DesktopProjectRuntime(drafts, library);
  return { source, library, projects, baseline, drafts, runtime };
}

function frameRequest(project: ProjectView, timelineTimeUs = 0) {
  return {
    projectId: project.id,
    draftId: project.draft.id,
    baseRevisionId: project.draft.baseRevisionId,
    expectedSequence: project.draft.sequence,
    expectedTimelineSha256: project.draft.timelineSha256,
    timelineTimeUs,
  };
}

function trimRequest(
  current: Awaited<ReturnType<DraftTransactionStore["snapshot"]>>,
  requestId: string,
  edge: "start" | "end",
  timelinePositionUs: number,
) {
  return {
    schema_version: "1.0" as const,
    request_id: requestId,
    project_id: current.draft.project_id,
    draft_id: current.draft.draft_id,
    base_revision_id: current.draft.base_revision_id,
    expected_sequence: current.draft.draft_sequence,
    expected_timeline_sha256: current.draft.timeline_sha256,
    pass_group: { pass_group_id: `pass-${requestId}`, kind: "manual" as const },
    reason: "Verify committed project preview mapping.",
    operations: [
      {
        type: "trim" as const,
        clip_id: current.draft.timeline.clips[0]!.clip_id,
        edge,
        timeline_position_us: timelinePositionUs,
      },
    ],
  };
}

test("committed project views and frames follow trim and undo state without changing source or baseline", async () => {
  const { source, library, projects, baseline, drafts, runtime } =
    await fixture();
  const baselinePath = join(
      baseline.project.storage.project_root,
      "baseline.json",
    ),
    baselineBytes = await readFile(baselinePath),
    sourceBytes = await readFile(source),
    managedBytes = await readFile(baseline.source.managed_path),
    initialView = await runtime.view(baseline.project.project_id),
    expectedOffsetFrame = await library.frame(
      baseline.source.source_id,
      500_000,
    );
  assert.equal(initialView.draft.sequence, 0);
  assert.equal(initialView.timeline.durationUs, 1_500_000);

  const initial = await drafts.snapshot(baseline.project.project_id),
    startTrim = await drafts.applyManual(
      trimRequest(initial, "runtime-start-trim-001", "start", 500_000),
    ),
    trimmedView = await runtime.view(baseline.project.project_id);
  assert.equal(trimmedView.draft.sequence, 1);
  assert.equal(trimmedView.timeline.durationUs, 1_000_000);
  const trimmedFrame = await runtime.frame(frameRequest(trimmedView));
  assert.equal(trimmedFrame.status, "ready");
  if (trimmedFrame.status !== "ready") throw new Error("Expected frame");
  assert.deepEqual(trimmedFrame.frame, expectedOffsetFrame);

  const endTrim = await drafts.applyManual(
    trimRequest(
      await drafts.snapshot(baseline.project.project_id),
      "runtime-end-trim-001",
      "end",
      500_000,
    ),
  );
  assert.equal(
    (await runtime.view(baseline.project.project_id)).timeline.durationUs,
    500_000,
  );
  await drafts.undoManual({
    schema_version: "1.0",
    request_id: "runtime-undo-001",
    project_id: endTrim.draft.project_id,
    draft_id: endTrim.draft.draft_id,
    base_revision_id: endTrim.draft.base_revision_id,
    expected_sequence: endTrim.draft.draft_sequence,
    expected_timeline_sha256: endTrim.draft.timeline_sha256,
    target_transaction_id: endTrim.transaction.transaction_id,
    reason: "Restore the end trim.",
  });
  const restored = await runtime.view(baseline.project.project_id);
  assert.equal(restored.timeline.durationUs, 1_000_000);
  const restoredFrame = await runtime.frame(frameRequest(restored));
  assert.equal(restoredFrame.status, "ready");
  if (restoredFrame.status !== "ready") throw new Error("Expected frame");
  assert.deepEqual(restoredFrame.frame, expectedOffsetFrame);
  assert.equal(startTrim.draft.timeline.clips[0]!.source_start_us, 500_000);
  assert.deepEqual(await readFile(baselinePath), baselineBytes);
  assert.deepEqual(await readFile(source), sourceBytes);
  assert.deepEqual(await readFile(baseline.source.managed_path), managedBytes);
  assert.equal(
    (await projects.open(baseline.project.project_id)).timeline.duration_us,
    1_500_000,
  );
});

test("stale heads return authoritative state and never expose stale decoded pixels", async () => {
  const { baseline, drafts } = await fixture();
  let decodeCalls = 0;
  let releaseDecode: (() => void) | undefined;
  const decodeStarted = Promise.withResolvers<void>();
  const runtime = new DesktopProjectRuntime(drafts, {
    frame: async () => {
      decodeCalls += 1;
      decodeStarted.resolve();
      await new Promise<void>((resolveDecode) => {
        releaseDecode = resolveDecode;
      });
      return { width: 1, height: 1, rgbaBase64: "AAAAAA==" };
    },
  });
  const initialView = await runtime.view(baseline.project.project_id),
    initial = await drafts.snapshot(baseline.project.project_id);
  await drafts.applyManual(
    trimRequest(initial, "runtime-stale-before-001", "start", 500_000),
  );
  const staleBefore = await runtime.frame(frameRequest(initialView));
  assert.equal(staleBefore.status, "stale");
  assert.equal(decodeCalls, 0);

  const currentView = await runtime.view(baseline.project.project_id),
    pending = runtime.frame(frameRequest(currentView));
  await decodeStarted.promise;
  await drafts.applyManual(
    trimRequest(
      await drafts.snapshot(baseline.project.project_id),
      "runtime-stale-after-001",
      "end",
      500_000,
    ),
  );
  releaseDecode?.();
  const staleAfter = await pending;
  assert.equal(staleAfter.status, "stale");
  assert.equal("frame" in staleAfter, false);
  assert.equal(decodeCalls, 1);
});

test("atomic project snapshots are detached and serialize navigation with draft commits", async () => {
  const { baseline, projects, drafts } = await fixture();
  const initial = await drafts.snapshot(baseline.project.project_id),
    [navigated, committed] = await Promise.all([
      projects.navigate(baseline.project.project_id, "edit"),
      drafts.applyManual(
        trimRequest(initial, "runtime-serialized-001", "start", 500_000),
      ),
    ]);
  assert.equal(navigated.project.workflow_step, "edit");
  assert.equal(committed.draft.draft_sequence, 1);
  const atomic = await drafts.snapshotWithProject(baseline.project.project_id);
  assert.equal(atomic.project.project.workflow_step, "edit");
  assert.equal(atomic.draft.draft_sequence, 1);
  atomic.project.project.name = "mutated copy";
  atomic.draft.timeline.duration_us = 1;
  const reopened = await drafts.snapshotWithProject(
    baseline.project.project_id,
  );
  assert.notEqual(reopened.project.project.name, "mutated copy");
  assert.equal(reopened.draft.timeline.duration_us, 1_000_000);
});

test("settled mutations refresh after an uncertain committed outcome without replacing tool results", async () => {
  const { baseline, drafts } = await fixture();
  const projectId = baseline.project.project_id,
    initial = await drafts.snapshot(projectId),
    notices: ProjectDraftNotice[] = [],
    uncertain = new Error("response lost after journal rename");
  await assert.rejects(
    invokeWithProjectDraftRefresh({
      toolName: "cut.trim_edge",
      projectId,
      activeProjectId: () => projectId,
      work: async () => {
        await drafts.applyManual(
          trimRequest(initial, "runtime-uncertain-001", "start", 500_000),
        );
        throw uncertain;
      },
      drafts,
      notify: (notice) => notices.push(notice),
    }),
    (error) => error === uncertain,
  );
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.ok, true);
  if (!notices[0]?.ok) throw new Error("Expected committed refresh");
  assert.equal(notices[0].value.draft.sequence, 1);
  assert.equal(notices[0].value.timeline.durationUs, 1_000_000);

  assert.equal(
    await invokeWithProjectDraftRefresh({
      toolName: "timeline.undo",
      projectId,
      activeProjectId: () => projectId,
      work: async () => "tool-result",
      drafts,
      notify: () => {
        throw new Error("window closed");
      },
    }),
    "tool-result",
  );
});
