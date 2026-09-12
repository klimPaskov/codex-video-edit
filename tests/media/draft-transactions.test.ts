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

test("one journal orders trusted manual, Magic Wand, and Codex edits with deterministic undo", async () => {
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
