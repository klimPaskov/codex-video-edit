import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  CodexVideoEditToolError,
  CodexVideoEditToolService,
} from "../../packages/codex-tools/src/service.ts";
import { MediaLibrary } from "../../packages/media-engine/src/library.ts";
import { runProcess } from "../../packages/media-engine/src/process.ts";
import { ProjectStore } from "../../packages/project-store/src/store.ts";
import {
  DraftTransactionStore,
  type DraftTransactionDependencies,
} from "../../packages/project-store/src/transactions.ts";

async function fixture(
  dependencyOverrides: Partial<DraftTransactionDependencies> = {},
) {
  const base = resolve("test-results/codex-tools");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "fixture-"));
  const source = join(root, "private-source.mkv");
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
  const projectsRoot = join(root, "projects");
  const projects = new ProjectStore(projectsRoot, library);
  const active = await projects.createFromMedia(media.id);
  const other = await projects.createFromMedia(media.id);
  let next = 0;
  const dependencies: Partial<DraftTransactionDependencies> = {
    now: () => "2026-09-12T12:00:00.000Z",
    id: () => `tool-generated-${String(++next).padStart(3, "0")}`,
    ...dependencyOverrides,
  };
  const drafts = new DraftTransactionStore(
    projectsRoot,
    projects,
    dependencies,
  );
  const service = new CodexVideoEditToolService(
    active.project.project_id,
    drafts,
  );
  return { source, active, other, drafts, service };
}

function readInput(projectId: string) {
  return { schema_version: "1.0", project_id: projectId };
}

function trimInput(
  draft: Awaited<ReturnType<DraftTransactionStore["snapshot"]>>["draft"],
) {
  return {
    schema_version: "1.0",
    request_id: "codex-trim-request-001",
    project_id: draft.project_id,
    draft_id: draft.draft_id,
    base_revision_id: draft.base_revision_id,
    expected_sequence: draft.draft_sequence,
    expected_timeline_sha256: draft.timeline_sha256,
    pass_group_id: "codex-spoken-cut-001",
    reason: "Remove the false start while preserving the source.",
    clip_id: draft.timeline.clips[0]!.clip_id,
    edge: "start",
    timeline_position_us: 200_000,
  };
}

function expectCode(expected: CodexVideoEditToolError["code"]) {
  return (error: unknown) =>
    error instanceof CodexVideoEditToolError && error.code === expected;
}

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

test("bounded project and timeline summaries omit private persistence and probe data", async () => {
  const { active, service } = await fixture();
  const project = await service.invoke(
    "project.get_summary",
    readInput(active.project.project_id),
  );
  const timeline = await service.invoke(
    "timeline.get_summary",
    readInput(active.project.project_id),
  );
  assert.equal(
    (project as { project_id: string }).project_id,
    active.project.project_id,
  );
  assert.equal((timeline as { draft_sequence: number }).draft_sequence, 0);
  for (const output of [project, timeline]) {
    const json = serialized(output);
    assert.doesNotMatch(
      json,
      /original_path|managed_path|project_root|source_probe/u,
    );
    assert.doesNotMatch(json, /\\|\/fixture-/u);
    assert.doesNotMatch(
      json,
      /sha256.*private-source|codec_long_name|format_name/u,
    );
  }
});

test("Codex trim and newest undo return only committed draft authority", async () => {
  const { source, active, drafts, service } = await fixture();
  const sourceBefore = await readFile(source);
  const managedBefore = await readFile(active.source.managed_path);
  const initial = await drafts.snapshot(active.project.project_id);
  const applied = (await service.invoke(
    "cut.trim_edge",
    trimInput(initial.draft),
  )) as {
    status: string;
    transaction_id: string;
    applied_operation_ids: string[];
    draft: { draft_sequence: number; duration_us: number };
    undo_token: string;
  };
  assert.equal(applied.status, "committed");
  assert.equal(applied.draft.draft_sequence, 1);
  assert.equal(applied.draft.duration_us, 800_000);
  assert.equal(applied.applied_operation_ids.length, 1);
  assert.equal(applied.undo_token, applied.transaction_id);
  assert.doesNotMatch(
    serialized(applied),
    /inverse|before|created_at|origin|original_path|managed_path/u,
  );
  const current = await drafts.snapshot(active.project.project_id);
  const undone = (await service.invoke("timeline.undo", {
    schema_version: "1.0",
    request_id: "codex-undo-request-001",
    project_id: current.draft.project_id,
    draft_id: current.draft.draft_id,
    base_revision_id: current.draft.base_revision_id,
    expected_sequence: current.draft.draft_sequence,
    expected_timeline_sha256: current.draft.timeline_sha256,
    target_transaction_id: applied.transaction_id,
    reason: "Restore the newest draft edit.",
  })) as {
    status: string;
    draft: { draft_sequence: number; duration_us: number };
  };
  assert.equal(undone.status, "committed");
  assert.equal(undone.draft.draft_sequence, 2);
  assert.equal(undone.draft.duration_us, 1_000_000);
  assert.deepEqual(await readFile(source), sourceBefore);
  assert.deepEqual(await readFile(active.source.managed_path), managedBefore);
});

test("an undo committed before an uncertain response is idempotent on retry", async () => {
  let commits = 0;
  const { active, drafts, service } = await fixture({
    afterJournalCommit: async () => {
      commits += 1;
      if (commits === 2) throw new Error("response lost after commit");
    },
  });
  const initial = await drafts.snapshot(active.project.project_id);
  const applied = (await service.invoke(
    "cut.trim_edge",
    trimInput(initial.draft),
  )) as { transaction_id: string };
  const current = await drafts.snapshot(active.project.project_id);
  const request = {
    schema_version: "1.0",
    request_id: "codex-undo-retry-001",
    project_id: current.draft.project_id,
    draft_id: current.draft.draft_id,
    base_revision_id: current.draft.base_revision_id,
    expected_sequence: current.draft.draft_sequence,
    expected_timeline_sha256: current.draft.timeline_sha256,
    target_transaction_id: applied.transaction_id,
    reason: "Restore the newest edit after an uncertain response.",
  };
  await assert.rejects(
    service.invoke("timeline.undo", request),
    expectCode("outcome_unknown"),
  );
  const replay = (await service.invoke("timeline.undo", request)) as {
    replayed: boolean;
    draft: { draft_sequence: number; duration_us: number };
  };
  assert.equal(replay.replayed, true);
  assert.equal(replay.draft.draft_sequence, 2);
  assert.equal(replay.draft.duration_us, 1_000_000);
});

test("inactive, stale, excess, path, source-mutation, and arbitrary tools fail closed", async () => {
  const { active, other, drafts, service } = await fixture();
  const initial = await drafts.snapshot(active.project.project_id);
  const otherInitial = await drafts.snapshot(other.project.project_id);
  await assert.rejects(
    service.invoke("project.get_summary", readInput(other.project.project_id)),
    expectCode("inactive_project"),
  );
  await assert.rejects(
    service.invoke("cut.trim_edge", trimInput(otherInitial.draft)),
    expectCode("inactive_project"),
  );
  for (const forbidden of [
    { source_path: "C:\\Users\\private\\recording.mp4" },
    { origin: "codex" },
    { transaction_id: "caller-transaction-001" },
    { operation_id: "caller-operation-001" },
    { created_at: "2026-09-12T12:00:00.000Z" },
    { inverse: { type: "restore_source" } },
  ]) {
    await assert.rejects(
      service.invoke("cut.trim_edge", {
        ...trimInput(initial.draft),
        ...forbidden,
      }),
      expectCode("invalid_request"),
    );
  }
  await assert.rejects(
    service.invoke("project.get_summary", {
      ...readInput(active.project.project_id),
      path: "C:\\Users\\private\\recording.mp4",
    }),
    expectCode("invalid_request"),
  );
  for (const name of [
    "source.overwrite",
    "project.delete",
    "export.confirm",
    "cleanup.run",
    "shell.exec",
    "rpc.call",
    "timeline.apply_operations",
  ]) {
    await assert.rejects(
      service.invoke(name, readInput(active.project.project_id)),
      expectCode("tool_not_available"),
    );
  }
  await service.invoke("cut.trim_edge", trimInput(initial.draft));
  await assert.rejects(
    service.invoke("cut.trim_edge", {
      ...trimInput(initial.draft),
      request_id: "codex-stale-request-002",
    }),
    expectCode("stale_draft"),
  );
  assert.equal(
    (await drafts.snapshot(other.project.project_id)).draft.draft_sequence,
    0,
  );
  assert.equal(
    (await drafts.snapshot(active.project.project_id)).draft.draft_sequence,
    1,
  );
});

test("unexpected backend details are replaced with a fixed safe error", async () => {
  const activeProjectId = "active-project-001";
  const service = new CodexVideoEditToolService(activeProjectId, {
    snapshotWithProject: async () => {
      throw new Error(
        "C:\\Users\\private\\recording.mp4 transcript=private protocol=raw token=secret-123",
      );
    },
    snapshot: async () => {
      throw new Error("probe stderr /private/source.mp4");
    },
    applyCodex: async () => {
      throw new Error("unreachable");
    },
    undoCodex: async () => {
      throw new Error("unreachable");
    },
  });
  await assert.rejects(
    service.invoke("project.get_summary", readInput(activeProjectId)),
    (error: unknown) => {
      assert.ok(error instanceof CodexVideoEditToolError);
      assert.equal(error.code, "service_unavailable");
      assert.equal(
        error.message,
        "The editing service is unavailable. Reopen the project and try again.",
      );
      assert.doesNotMatch(
        error.message,
        /private|token|probe|transcript|protocol|\.mp4/u,
      );
      return true;
    },
  );
});
