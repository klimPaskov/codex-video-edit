import assert from "node:assert/strict";
import test from "node:test";

import { reconcileProjectDraft } from "../../apps/desktop/renderer/project-draft.ts";
import type {
  ProjectDraftView,
  ProjectView,
} from "../../packages/domain/src/project-view.ts";

function project(): ProjectView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Fixture",
    stage: "review",
    revisionId: "22222222-2222-4222-8222-222222222222",
    draft: {
      id: "draft-22222222-2222-4222-8222-222222222222",
      baseRevisionId: "22222222-2222-4222-8222-222222222222",
      sequence: 2,
      timelineSha256: "a".repeat(64),
      undoTransactionId: "transaction-002",
    },
    source: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Fixture.mkv",
      width: 16,
      height: 16,
      durationUs: 1_500_000,
      frameRate: 2,
      previewAvailable: true,
    },
    timeline: {
      id: "44444444-4444-4444-8444-444444444444",
      durationUs: 1_000_000,
      frameRate: { numerator: 2, denominator: 1 },
    },
  };
}

function changed(sequence: number, hash = "b".repeat(64)): ProjectDraftView {
  const current = project();
  return {
    projectId: current.id,
    draft: {
      ...current.draft,
      sequence,
      timelineSha256: hash,
      undoTransactionId: "transaction-003",
    },
    timeline: { ...current.timeline, durationUs: 500_000 },
  };
}

test("renderer reconciliation applies only a newer matching committed head", () => {
  const current = project(),
    result = reconcileProjectDraft(current, changed(3));
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("Expected update");
  assert.equal(result.value.stage, "review");
  assert.equal(result.value.source, current.source);
  assert.equal(result.value.timeline.durationUs, 500_000);
  assert.equal(result.value.draft.sequence, 3);
  assert.equal(current.timeline.durationUs, 1_000_000);
});

test("renderer reconciliation ignores duplicates and old events but rejects divergent heads", () => {
  const current = project();
  assert.deepEqual(reconcileProjectDraft(current, changed(1)), {
    status: "stale",
  });
  assert.deepEqual(
    reconcileProjectDraft(current, changed(2, current.draft.timelineSha256)),
    { status: "unchanged" },
  );
  assert.deepEqual(reconcileProjectDraft(current, changed(2)), {
    status: "invalid",
  });
  assert.deepEqual(
    reconcileProjectDraft(current, {
      ...changed(3),
      projectId: current.source.id,
    }),
    { status: "unrelated" },
  );
  const newHead = changed(3);
  assert.deepEqual(
    reconcileProjectDraft(current, {
      ...newHead,
      draft: { ...newHead.draft, id: "another-draft" },
    }),
    { status: "invalid" },
  );
});
