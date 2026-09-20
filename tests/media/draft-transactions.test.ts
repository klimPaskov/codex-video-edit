import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import type {
  ApplyDraftTransactionRequest,
  DraftState,
  PassCheckpointRequest,
  UndoDraftTransactionRequest,
} from "../../packages/domain/src/draft-transaction.ts";
import { MediaLibrary } from "../../packages/media-engine/src/library.ts";
import { runProcess } from "../../packages/media-engine/src/process.ts";
import { ProjectStore } from "../../packages/project-store/src/store.ts";
import {
  DraftTransactionError,
  DraftTransactionStore,
  type DraftTransactionDependencies,
} from "../../packages/project-store/src/transactions.ts";

async function fixture() {
  const base = resolve("test-results/draft-transactions");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "fixture-"));
  const source = join(root, "source.mkv");
  await runProcess({
    executable: "ffmpeg",
    args: [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=16x16:rate=30:duration=1",
      "-c:v",
      "ffv1",
      "-pix_fmt",
      "bgra",
      source,
    ],
  });
  const library = new MediaLibrary(join(root, "library"));
  const media = await library.importFile(source);
  const projects = join(root, "projects");
  const projectStore = new ProjectStore(projects, library);
  const baseline = await projectStore.createFromMedia(media.id);
  return { root, source, projects, projectStore, baseline };
}

function dependencies(
  extras: Partial<DraftTransactionDependencies> = {},
): Partial<DraftTransactionDependencies> {
  let next = 0;
  return {
    now: () => "2026-09-12T12:00:00.000Z",
    id: () => `generated-${String(++next).padStart(3, "0")}`,
    ...extras,
  };
}

function trim(
  draft: DraftState,
  patch: Partial<ApplyDraftTransactionRequest> = {},
): ApplyDraftTransactionRequest {
  return {
    schema_version: "1.0",
    request_id: "request-trim-001",
    project_id: draft.project_id,
    draft_id: draft.draft_id,
    base_revision_id: draft.base_revision_id,
    expected_sequence: draft.draft_sequence,
    expected_timeline_sha256: draft.timeline_sha256,
    pass_group: { pass_group_id: "pass-manual-001", kind: "manual" },
    reason: "Trim the false start without changing the source.",
    operations: [
      {
        type: "trim",
        clip_id: draft.timeline.clips[0]!.clip_id,
        edge: "start",
        timeline_position_us: 200_000,
      },
    ],
    ...patch,
  };
}

function split(
  draft: DraftState,
  clipId = draft.timeline.clips[0]!.clip_id,
  positionUs = 400_000,
  requestId = "request-split-001",
): ApplyDraftTransactionRequest {
  return {
    ...trim(draft),
    request_id: requestId,
    reason: "Split the clip at the selected playhead position.",
    operations: [
      { type: "split", clip_id: clipId, timeline_position_us: positionUs },
    ],
  };
}

function rippleDelete(
  draft: DraftState,
  startUs: number,
  endUs: number,
  requestId = "request-ripple-001",
): ApplyDraftTransactionRequest {
  return {
    ...trim(draft),
    request_id: requestId,
    reason: "Remove the selected range and close the gap.",
    operations: [{ type: "ripple_delete", start_us: startUs, end_us: endUs }],
  };
}

async function twoSourceFixture() {
  const base = resolve("test-results/draft-transactions");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "two-source-"));
  const library = new MediaLibrary(join(root, "library"));
  const paths: string[] = [];
  const ids: string[] = [];
  for (const pattern of ["testsrc", "testsrc2"]) {
    const path = join(root, `${pattern}.mp4`);
    await runProcess({
      executable: "ffmpeg",
      args: [
        "-v",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        `${pattern}=size=16x16:rate=30:duration=1`,
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
  const projects = join(root, "projects");
  const projectStore = new ProjectStore(projects, library);
  const baseline = await projectStore.createFromTwoMedia(ids[0]!, ids[1]!);
  return { root, paths, ids, library, projects, projectStore, baseline };
}

function undo(draft: DraftState, target: string): UndoDraftTransactionRequest {
  return {
    schema_version: "1.0",
    request_id: "request-undo-001",
    project_id: draft.project_id,
    draft_id: draft.draft_id,
    base_revision_id: draft.base_revision_id,
    expected_sequence: draft.draft_sequence,
    expected_timeline_sha256: draft.timeline_sha256,
    target_transaction_id: target,
    reason: "Restore the previous draft state.",
  };
}

function checkpoint(
  draft: DraftState,
  transactionId: string,
  patch: Partial<PassCheckpointRequest> = {},
): PassCheckpointRequest {
  return {
    schema_version: "1.0",
    request_id: "request-checkpoint-001",
    project_id: draft.project_id,
    draft_id: draft.draft_id,
    base_revision_id: draft.base_revision_id,
    expected_sequence: draft.draft_sequence,
    expected_timeline_sha256: draft.timeline_sha256,
    pass_group: { pass_group_id: "pass-manual-001", kind: "manual" },
    verified_transaction_ids: [transactionId],
    summary: "Verified the edited join against the persisted draft.",
    checks: [
      {
        check_id: "check-join-001",
        status: "pass",
        method: "Decoded the bounded fixture around the trim boundary.",
        evidence_ids: ["evidence-join-001"],
      },
    ],
    ...patch,
  };
}

function code(expected: DraftTransactionError["code"]) {
  return (error: unknown) =>
    error instanceof DraftTransactionError && error.code === expected;
}

test("one journal orders manual, Magic Wand, Codex and API-provider edits with deterministic undo", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const folder = join(projects, baseline.project.project_id);
  const protectedBefore = await Promise.all([
    readFile(join(folder, "baseline.json")),
    readFile(join(folder, "project.json")),
    readFile(baseline.source.managed_path),
  ]);
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = await store.snapshot(baseline.project.project_id);
  assert.equal(initial.draft.draft_sequence, 0);
  assert.equal(
    initial.draft.timeline_sha256,
    baseline.revision.timeline_sha256,
  );
  assert.equal(initial.undo_transaction_id, null);

  const request = trim(initial.draft);
  const inputCopy = structuredClone(request);
  const applied = await store.applyManual(request);
  assert.deepEqual(request, inputCopy);
  assert.equal(applied.replayed, false);
  assert.equal(applied.transaction.origin, "manual");
  assert.equal(applied.transaction.kind, "apply");
  assert.equal(applied.draft.draft_sequence, 1);
  assert.equal(applied.draft.timeline.duration_us, 800_000);
  assert.equal(applied.draft.timeline.clips[0]!.source_start_us, 200_000);
  assert.equal(applied.transaction.operations[0]!.inverse.type, "restore_clip");
  assert.equal(applied.undo_transaction_id, applied.transaction.transaction_id);

  const verified = await store.recordPassCheckpoint(
    checkpoint(applied.draft, applied.transaction.transaction_id),
  );
  assert.equal(verified.replayed, false);
  assert.equal(verified.checkpoint.draft_sequence, 1);
  assert.equal(verified.checkpoint.status, "verified");
  assert.deepEqual(verified.draft, applied.draft);
  assert.deepEqual(verified.current_pass_checkpoint, verified.checkpoint);

  const reopened = new DraftTransactionStore(projects, projectStore);
  assert.deepEqual(await reopened.snapshot(baseline.project.project_id), {
    draft: applied.draft,
    undo_transaction_id: applied.transaction.transaction_id,
    current_pass_checkpoint: verified.checkpoint,
  });
  const duplicate = await reopened.applyManual(request);
  assert.equal(duplicate.replayed, true);
  assert.deepEqual(duplicate.draft, applied.draft);
  assert.equal(
    duplicate.transaction.transaction_id,
    applied.transaction.transaction_id,
  );
  assert.deepEqual(duplicate.current_pass_checkpoint, verified.checkpoint);
  await assert.rejects(
    reopened.applyManual({ ...request, reason: "Conflicting retry." }),
    code("conflict"),
  );

  const undone = await reopened.undoCodex(
    undo(applied.draft, applied.transaction.transaction_id),
  );
  assert.equal(undone.transaction.origin, "codex");
  assert.equal(undone.transaction.kind, "undo");
  assert.equal(undone.draft.draft_sequence, 2);
  assert.equal(undone.draft.timeline_sha256, baseline.revision.timeline_sha256);
  assert.deepEqual(undone.draft.timeline, baseline.timeline);
  assert.equal(undone.undo_transaction_id, null);
  assert.equal(undone.current_pass_checkpoint, null);

  const wand = await reopened.applyMagicWand({
    ...trim(undone.draft),
    request_id: "request-trim-002",
    pass_group: { pass_group_id: "pass-spoken-001", kind: "spoken_cut" },
  });
  assert.equal(wand.transaction.origin, "magic_wand");
  assert.equal(wand.draft.draft_sequence, 3);
  assert.equal(
    wand.transaction.previous_transaction_sha256,
    undone.transaction.transaction_sha256,
  );
  const providerUndo = await reopened.undoApiProvider({
    ...undo(wand.draft, wand.transaction.transaction_id),
    request_id: "request-undo-api-001",
  });
  assert.equal(providerUndo.transaction.origin, "api_provider");
  assert.equal(providerUndo.draft.timeline.duration_us, 1_000_000);
  const providerTrim = await reopened.applyApiProvider({
    ...trim(providerUndo.draft),
    request_id: "request-trim-api-001",
    pass_group: { pass_group_id: "pass-api-001", kind: "manual" },
  });
  assert.equal(providerTrim.transaction.origin, "api_provider");
  assert.equal(providerTrim.draft.timeline.duration_us, 800_000);
  assert.equal(
    providerTrim.transaction.previous_transaction_sha256,
    providerUndo.transaction.transaction_sha256,
  );

  assert.deepEqual(
    await Promise.all([
      readFile(join(folder, "baseline.json")),
      readFile(join(folder, "project.json")),
      readFile(baseline.source.managed_path),
    ]),
    protectedBefore,
  );
});

test("freshness and batch validation reject without a committed journal entry", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  await assert.rejects(
    store.applyManual(trim(initial, { expected_sequence: 1 })),
    (error: unknown) => {
      assert.ok(error instanceof DraftTransactionError);
      assert.equal(error.code, "stale");
      assert.deepEqual(error.current, {
        project_id: initial.project_id,
        draft_id: initial.draft_id,
        base_revision_id: initial.base_revision_id,
        draft_sequence: 0,
        timeline_sha256: initial.timeline_sha256,
      });
      return true;
    },
  );
  await assert.rejects(
    store.applyManual(
      trim(initial, { expected_timeline_sha256: "0".repeat(64) }),
    ),
    code("stale"),
  );
  assert.throws(
    () =>
      store.applyManual({
        ...trim(initial),
        operations: [
          ...trim(initial).operations,
          { ...trim(initial).operations[0]!, edge: "end" },
        ],
      }),
    code("invalid"),
  );
  assert.throws(
    () => store.applyCodex({ ...trim(initial), origin: "codex" }),
    code("invalid"),
  );
  assert.deepEqual(
    await readdir(
      join(projects, baseline.project.project_id, "draft", "journal"),
    ),
    [],
  );
});

test("start and end trims use exact timeline boundaries and reject empty clips", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const clipId = initial.timeline.clips[0]!.clip_id;
  const endTrim = await store.applyManual(
    trim(initial, {
      request_id: "request-end-trim-001",
      operations: [
        {
          type: "trim",
          clip_id: clipId,
          edge: "end",
          timeline_position_us: 750_000,
        },
      ],
    }),
  );
  assert.equal(endTrim.draft.timeline.duration_us, 750_000);
  assert.equal(endTrim.draft.timeline.clips[0]!.source_start_us, 0);
  assert.equal(endTrim.draft.timeline.clips[0]!.source_end_us, 750_000);

  const startTrim = await store.applyManual(
    trim(endTrim.draft, {
      request_id: "request-start-after-end-001",
      operations: [
        {
          type: "trim",
          clip_id: clipId,
          edge: "start",
          timeline_position_us: 250_000,
        },
      ],
    }),
  );
  assert.equal(startTrim.draft.timeline.duration_us, 500_000);
  assert.equal(startTrim.draft.timeline.clips[0]!.source_start_us, 250_000);
  assert.equal(startTrim.draft.timeline.clips[0]!.source_end_us, 750_000);
  assert.equal(startTrim.draft.timeline.clips[0]!.timeline_start_us, 0);
  assert.equal(startTrim.draft.timeline.clips[0]!.timeline_end_us, 500_000);

  for (const [requestId, edge, position] of [
    ["request-boundary-zero", "start", 0],
    ["request-boundary-current-end", "end", 500_000],
    ["request-boundary-empty-start", "start", 500_000],
  ] as const) {
    const request = trim(startTrim.draft, {
      request_id: requestId,
      operations: [
        {
          type: "trim",
          clip_id: clipId,
          edge,
          timeline_position_us: position,
        },
      ],
    });
    if (position === 0) {
      assert.throws(() => store.applyManual(request), code("invalid"));
    } else {
      await assert.rejects(store.applyManual(request), code("conflict"));
    }
  }
  assert.equal(
    (await store.snapshot(baseline.project.project_id)).draft.draft_sequence,
    2,
  );
});

test("split preserves source samples, supports fragment trim, and replays and undoes exactly", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const sourceBefore = await readFile(baseline.source.managed_path);
  const baselineBefore = await readFile(
    join(projects, baseline.project.project_id, "baseline.json"),
  );
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const splitResult = await store.applyManual(split(initial));
  const [left, right] = splitResult.draft.timeline.clips;
  assert.ok(left && right);
  assert.equal(left.clip_id, initial.timeline.clips[0]!.clip_id);
  assert.match(right.clip_id, /^clip-[a-f0-9]{32}$/u);
  assert.deepEqual(
    [
      left.source_start_us,
      left.source_end_us,
      right.source_start_us,
      right.source_end_us,
    ],
    [0, 400_000, 400_000, 1_000_000],
  );
  assert.deepEqual(
    [
      left.timeline_start_us,
      left.timeline_end_us,
      right.timeline_start_us,
      right.timeline_end_us,
    ],
    [0, 400_000, 400_000, 1_000_000],
  );
  assert.equal(
    splitResult.draft.timeline.duration_us,
    initial.timeline.duration_us,
  );
  assert.equal(splitResult.transaction.operations[0]!.operation_type, "split");
  assert.equal(
    splitResult.transaction.operations[0]!.inverse.type,
    "merge_split",
  );
  assert.deepEqual(
    (
      await new DraftTransactionStore(projects, projectStore).snapshot(
        baseline.project.project_id,
      )
    ).draft,
    splitResult.draft,
  );
  const trimmed = await store.applyManual({
    ...trim(splitResult.draft),
    request_id: "request-trim-fragment-001",
    operations: [
      {
        type: "trim",
        clip_id: right.clip_id,
        edge: "start",
        timeline_position_us: 500_000,
      },
    ],
  });
  assert.equal(trimmed.draft.timeline.duration_us, 900_000);
  assert.equal(trimmed.draft.timeline.clips[1]!.source_start_us, 500_000);
  assert.equal(trimmed.draft.timeline.clips[1]!.timeline_start_us, 400_000);
  const undoTrim = await store.undoManual(
    undo(trimmed.draft, trimmed.transaction.transaction_id),
  );
  assert.deepEqual(undoTrim.draft.timeline, splitResult.draft.timeline);
  const undoSplit = await store.undoManual({
    ...undo(undoTrim.draft, splitResult.transaction.transaction_id),
    request_id: "request-undo-split-001",
  });
  assert.deepEqual(undoSplit.draft.timeline, initial.timeline);
  assert.deepEqual(
    (
      await new DraftTransactionStore(projects, projectStore).snapshot(
        baseline.project.project_id,
      )
    ).draft,
    undoSplit.draft,
  );
  assert.deepEqual(await readFile(baseline.source.managed_path), sourceBefore);
  assert.deepEqual(
    await readFile(
      join(projects, baseline.project.project_id, "baseline.json"),
    ),
    baselineBefore,
  );
});

test("split rejects boundaries and stale heads without adding journal entries", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  assert.throws(
    () => store.applyManual(split(initial, undefined, 0)),
    code("invalid"),
  );
  await assert.rejects(
    store.applyManual(split(initial, undefined, 1_000_000)),
    code("conflict"),
  );
  assert.equal(
    (await store.snapshot(baseline.project.project_id)).draft.draft_sequence,
    0,
  );
  const applied = await store.applyManual(split(initial));
  await assert.rejects(
    store.applyManual(
      split(initial, undefined, 600_000, "request-stale-split-001"),
    ),
    code("stale"),
  );
  assert.equal(
    (await store.snapshot(baseline.project.project_id)).draft.draft_sequence,
    1,
  );
  assert.equal(applied.draft.timeline.clips.length, 2);
});

test("split after an earlier trim maps the output cut back to the exact source offset", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const trimmed = await store.applyManual(trim(initial));
  const result = await store.applyManual(
    split(trimmed.draft, undefined, 300_000, "request-split-trimmed-001"),
  );
  assert.deepEqual(
    result.draft.timeline.clips.map((clip) => [
      clip.source_start_us,
      clip.source_end_us,
      clip.timeline_start_us,
      clip.timeline_end_us,
    ]),
    [
      [200_000, 500_000, 0, 300_000],
      [500_000, 1_000_000, 300_000, 800_000],
    ],
  );
  assert.deepEqual(
    (
      await new DraftTransactionStore(projects, projectStore).snapshot(
        baseline.project.project_id,
      )
    ).draft,
    result.draft,
  );
});

test("ripple delete across sources preserves exact source spans, replay, undo, and immutable bytes", async () => {
  const { paths, ids, library, projects, projectStore, baseline } =
    await twoSourceFixture();
  const folder = join(projects, baseline.project.project_id);
  const protectedPaths = [
    ...paths,
    join(folder, "baseline.json"),
    join(folder, "project.json"),
    (await library.verifiedSource(ids[0]!)).managedPath,
    (await library.verifiedSource(ids[1]!)).managedPath,
  ];
  const protectedBefore = await Promise.all(
    protectedPaths.map((path) => readFile(path)),
  );
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const applied = await store.applyManual(
    rippleDelete(initial, 800_000, 1_200_000),
  );
  assert.equal(applied.draft.timeline.duration_us, 1_600_000);
  assert.deepEqual(
    applied.draft.timeline.clips.map((clip) => ({
      id: clip.clip_id,
      source: clip.source_id,
      sourceStart: clip.source_start_us,
      sourceEnd: clip.source_end_us,
      start: clip.timeline_start_us,
      end: clip.timeline_end_us,
    })),
    [
      {
        id: "clip-main",
        source: ids[0],
        sourceStart: 0,
        sourceEnd: 800_000,
        start: 0,
        end: 800_000,
      },
      {
        id: "clip-following",
        source: ids[1],
        sourceStart: 200_000,
        sourceEnd: 1_000_000,
        start: 800_000,
        end: 1_600_000,
      },
    ],
  );
  assert.equal(
    applied.transaction.operations[0]?.operation_type,
    "ripple_delete",
  );
  const operation = applied.transaction.operations[0]!;
  if (operation.operation_type !== "ripple_delete")
    throw new Error("Expected a ripple delete");
  assert.deepEqual(operation.before, initial.timeline.clips);
  assert.deepEqual(operation.after, applied.draft.timeline.clips);
  assert.deepEqual(operation.inverse.clips, initial.timeline.clips);
  const reopened = new DraftTransactionStore(projects, projectStore);
  assert.deepEqual(
    (await reopened.snapshot(baseline.project.project_id)).draft,
    applied.draft,
  );
  const undone = await reopened.undoManual(
    undo(applied.draft, applied.transaction.transaction_id),
  );
  assert.deepEqual(undone.draft.timeline.clips, initial.timeline.clips);
  assert.deepEqual(
    await Promise.all(protectedPaths.map((path) => readFile(path))),
    protectedBefore,
  );
});

test("ripple delete may remove one complete source group and retain the later source", async () => {
  const { projects, projectStore, baseline, ids } = await twoSourceFixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const applied = await store.applyManual(rippleDelete(initial, 0, 1_000_000));
  assert.equal(applied.draft.timeline.duration_us, 1_000_000);
  assert.equal(applied.draft.timeline.clips.length, 1);
  assert.equal(applied.draft.timeline.clips[0]?.source_id, ids[1]);
  assert.equal(applied.draft.timeline.clips[0]?.clip_id, "clip-following");
  assert.equal(applied.draft.timeline.clips[0]?.timeline_start_us, 0);
  assert.deepEqual(
    (
      await new DraftTransactionStore(projects, projectStore).snapshot(
        baseline.project.project_id,
      )
    ).draft,
    applied.draft,
  );
});

test("descending range batch commits once, replays, and undoes both cuts atomically", async () => {
  const { paths, projects, projectStore, baseline } = await twoSourceFixture();
  const originalBytes = await Promise.all(paths.map((path) => readFile(path)));
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const request = {
    ...rippleDelete(initial, 1_400_000, 1_600_000, "request-batch-001"),
    operations: [
      {
        type: "ripple_delete" as const,
        start_us: 1_400_000,
        end_us: 1_600_000,
      },
      { type: "ripple_delete" as const, start_us: 200_000, end_us: 400_000 },
    ],
  };
  const applied = await store.applyManual(request);
  assert.equal(applied.draft.draft_sequence, 1);
  assert.equal(applied.transaction.operations.length, 2);
  assert.equal(applied.draft.timeline.duration_us, 1_600_000);
  assert.deepEqual(
    applied.draft.timeline.clips.map((clip) => [
      clip.source_id,
      clip.source_start_us,
      clip.source_end_us,
    ]),
    [
      [baseline.sources[0].source_id, 0, 200_000],
      [baseline.sources[0].source_id, 400_000, 1_000_000],
      [baseline.sources[1].source_id, 0, 400_000],
      [baseline.sources[1].source_id, 600_000, 1_000_000],
    ],
  );
  const reopened = new DraftTransactionStore(projects, projectStore);
  assert.deepEqual(
    (await reopened.snapshot(initial.project_id)).draft,
    applied.draft,
  );
  const replay = await reopened.applyManual(request);
  assert.equal(replay.replayed, true);
  assert.equal(
    replay.transaction.transaction_id,
    applied.transaction.transaction_id,
  );
  const restored = await reopened.undoManual(
    undo(applied.draft, applied.transaction.transaction_id),
  );
  assert.deepEqual(restored.draft.timeline.clips, initial.timeline.clips);
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(path))),
    originalBytes,
  );
});

test("range batch rejects overlap and out-of-bounds cuts without a partial commit", async () => {
  const { projects, projectStore, baseline } = await twoSourceFixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const base = rippleDelete(
    initial,
    1_400_000,
    1_600_000,
    "request-batch-invalid",
  );
  assert.throws(
    () =>
      store.applyManual({
        ...base,
        operations: [
          { type: "ripple_delete", start_us: 1_400_000, end_us: 1_600_000 },
          { type: "ripple_delete", start_us: 1_300_000, end_us: 1_500_000 },
        ],
      }),
    code("invalid"),
  );
  await assert.rejects(
    store.applyManual({
      ...base,
      operations: [
        { type: "ripple_delete", start_us: 2_100_000, end_us: 2_200_000 },
        { type: "ripple_delete", start_us: 0, end_us: 200_000 },
      ],
    }),
    code("conflict"),
  );
  assert.deepEqual((await store.snapshot(initial.project_id)).draft, initial);
});

test("interior ripple delete retains the left ID and derives the right ID, then replays", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const applied = await store.applyManual(
    rippleDelete(initial, 250_000, 750_000),
  );
  const [left, right] = applied.draft.timeline.clips;
  assert.equal(applied.draft.timeline.duration_us, 500_000);
  assert.equal(left?.clip_id, initial.timeline.clips[0]?.clip_id);
  assert.equal(left?.source_end_us, 250_000);
  assert.match(right?.clip_id ?? "", /^clip-[a-f0-9]{32}$/u);
  assert.notEqual(right?.clip_id, left?.clip_id);
  assert.equal(right?.source_start_us, 750_000);
  assert.equal(right?.timeline_start_us, 250_000);
  assert.deepEqual(
    (
      await new DraftTransactionStore(projects, projectStore).snapshot(
        baseline.project.project_id,
      )
    ).draft,
    applied.draft,
  );
  const removedLeft = await store.applyManual(
    rippleDelete(applied.draft, 0, 250_000, "request-ripple-remove-left"),
  );
  assert.equal(removedLeft.draft.timeline.clips.length, 1);
  assert.equal(removedLeft.draft.timeline.clips[0]?.clip_id, right?.clip_id);
  assert.equal(removedLeft.draft.timeline.clips[0]?.source_start_us, 750_000);
  assert.equal(removedLeft.draft.timeline.clips[0]?.timeline_start_us, 0);
  assert.deepEqual(
    (
      await new DraftTransactionStore(projects, projectStore).snapshot(
        baseline.project.project_id,
      )
    ).draft,
    removedLeft.draft,
  );
});

test("ripple delete rejects zero, whole, over-end, malformed, and stale ranges", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  assert.throws(
    () => store.applyManual(rippleDelete(initial, 0, 0)),
    code("invalid"),
  );
  assert.throws(
    () => store.applyManual(rippleDelete(initial, -1, 100_000)),
    code("invalid"),
  );
  assert.throws(
    () => store.applyManual(rippleDelete(initial, 500_000, 400_000)),
    code("invalid"),
  );
  assert.throws(
    () =>
      store.applyManual({
        ...rippleDelete(initial, 100_000, 200_000),
        operations: [
          { type: "ripple_delete", start_us: 100_000, end_us: 200_000 },
          { type: "ripple_delete", start_us: 300_000, end_us: 400_000 },
        ],
      }),
    code("invalid"),
  );
  await assert.rejects(
    store.applyManual(rippleDelete(initial, 0, 1_000_000)),
    code("conflict"),
  );
  await assert.rejects(
    store.applyManual(rippleDelete(initial, 0, 1_000_001)),
    code("conflict"),
  );
  const applied = await store.applyManual(rippleDelete(initial, 0, 100_000));
  assert.equal(applied.draft.timeline.clips[0]?.source_start_us, 100_000);
  await assert.rejects(
    store.applyManual(
      rippleDelete(initial, 100_000, 200_000, "request-stale-001"),
    ),
    code("stale"),
  );
  assert.equal(
    (await store.snapshot(baseline.project.project_id)).draft.draft_sequence,
    1,
  );
});

test("checkpoints bind passed verification to the exact current pass and reject invented scope", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const applied = await store.applyCodex({
    ...trim(initial),
    pass_group: { pass_group_id: "pass-spoken-001", kind: "spoken_cut" },
  });
  await assert.rejects(
    store.recordPassCheckpoint(
      checkpoint(applied.draft, applied.transaction.transaction_id, {
        pass_group: { pass_group_id: "pass-layout-001", kind: "layout" },
      }),
    ),
    code("conflict"),
  );
  await assert.rejects(
    store.recordPassCheckpoint(
      checkpoint(applied.draft, "transaction-not-applied", {
        pass_group: { pass_group_id: "pass-spoken-001", kind: "spoken_cut" },
      }),
    ),
    code("conflict"),
  );
  assert.throws(
    () =>
      store.recordPassCheckpoint({
        ...checkpoint(applied.draft, applied.transaction.transaction_id),
        checks: [
          {
            check_id: "check-join-001",
            status: "failed",
            method: "The rendered join was not verified.",
            evidence_ids: [],
          },
        ],
      }),
    code("invalid"),
  );
  assert.deepEqual(
    await readdir(
      join(projects, baseline.project.project_id, "draft", "checkpoints"),
    ),
    [],
  );
});

test("a checkpoint committed before an uncertain response is recovered and deduplicated", async () => {
  const setup = await fixture();
  let crash = true;
  const store = new DraftTransactionStore(
    setup.projects,
    setup.projectStore,
    dependencies({
      afterCheckpointCommit: async () => {
        if (crash) {
          crash = false;
          throw new Error("synthetic checkpoint postcommit crash");
        }
      },
    }),
  );
  const initial = (await store.snapshot(setup.baseline.project.project_id))
    .draft;
  const applied = await store.applyManual(trim(initial));
  const request = checkpoint(applied.draft, applied.transaction.transaction_id);
  await assert.rejects(
    store.recordPassCheckpoint(request),
    code("outcome_unknown"),
  );

  const reopened = new DraftTransactionStore(
    setup.projects,
    setup.projectStore,
  );
  const recovered = await reopened.snapshot(setup.baseline.project.project_id);
  assert.equal(
    recovered.current_pass_checkpoint?.request_id,
    request.request_id,
  );
  const retry = await reopened.recordPassCheckpoint(request);
  assert.equal(retry.replayed, true);
  assert.deepEqual(
    retry.current_pass_checkpoint,
    recovered.current_pass_checkpoint,
  );
});

test("reopen fails closed when a committed transaction is altered", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  await store.applyManual(trim(initial));
  const journal = join(
      projects,
      baseline.project.project_id,
      "draft",
      "journal",
    ),
    entries = await readdir(journal),
    committed = entries.find((entry) => /^\d{12}\..+\.json$/u.test(entry));
  assert.ok(committed);
  const path = join(journal, committed),
    record = JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      unknown
    >;
  record.reason = "Altered after commit.";
  await writeFile(path, JSON.stringify(record), "utf8");
  await assert.rejects(
    new DraftTransactionStore(projects, projectStore).snapshot(
      baseline.project.project_id,
    ),
    code("storage"),
  );
});

test("pending writes are ignored while a post-rename crash replays exactly once", async () => {
  const before = await fixture();
  let beforeCrash = true;
  const pendingStore = new DraftTransactionStore(
    before.projects,
    before.projectStore,
    dependencies({
      afterPendingWrite: async () => {
        if (beforeCrash) {
          beforeCrash = false;
          throw new Error("synthetic precommit crash");
        }
      },
    }),
  );
  const pendingInitial = (
    await pendingStore.snapshot(before.baseline.project.project_id)
  ).draft;
  await assert.rejects(
    pendingStore.applyManual(trim(pendingInitial)),
    code("storage"),
  );
  assert.equal(
    (
      await new DraftTransactionStore(
        before.projects,
        before.projectStore,
      ).snapshot(before.baseline.project.project_id)
    ).draft.draft_sequence,
    0,
  );

  const after = await fixture();
  let afterCrash = true;
  const committedStore = new DraftTransactionStore(
    after.projects,
    after.projectStore,
    dependencies({
      afterJournalCommit: async () => {
        if (afterCrash) {
          afterCrash = false;
          throw new Error("synthetic postcommit crash");
        }
      },
    }),
  );
  const committedInitial = (
    await committedStore.snapshot(after.baseline.project.project_id)
  ).draft;
  const request = trim(committedInitial);
  await assert.rejects(
    committedStore.applyManual(request),
    code("outcome_unknown"),
  );
  const recoveredStore = new DraftTransactionStore(
    after.projects,
    after.projectStore,
  );
  const recovered = await recoveredStore.snapshot(
    after.baseline.project.project_id,
  );
  assert.equal(recovered.draft.draft_sequence, 1);
  const retry = await recoveredStore.applyManual(request);
  assert.equal(retry.replayed, true);
  assert.equal(retry.draft.draft_sequence, 1);
});

test("concurrent edit and navigation share one root queue and preserve both commits", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const [navigation, edit] = await Promise.all([
    projectStore.navigate(baseline.project.project_id, "edit"),
    store.applyManual(trim(initial)),
  ]);
  assert.equal(navigation.project.workflow_step, "edit");
  assert.equal(edit.draft.draft_sequence, 1);
  assert.equal(
    (await projectStore.open(baseline.project.project_id)).project
      .workflow_step,
    "edit",
  );
  assert.deepEqual(
    (await store.snapshot(baseline.project.project_id)).draft,
    edit.draft,
  );
});

test("two writes from one head produce one commit and one stale rejection", async () => {
  const { projects, projectStore, baseline } = await fixture();
  const store = new DraftTransactionStore(
    projects,
    projectStore,
    dependencies(),
  );
  const initial = (await store.snapshot(baseline.project.project_id)).draft;
  const [first, second] = await Promise.allSettled([
    store.applyManual(trim(initial)),
    store.applyCodex({ ...trim(initial), request_id: "request-trim-002" }),
  ]);
  assert.equal(first.status, "fulfilled");
  assert.equal(second.status, "rejected");
  if (second.status === "rejected") assert.ok(code("stale")(second.reason));
  assert.equal(
    (await store.snapshot(baseline.project.project_id)).draft.draft_sequence,
    1,
  );
});
