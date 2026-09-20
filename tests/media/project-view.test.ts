import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProjectList,
  assertProjectDraftView,
  assertProjectFrameRequest,
  assertProjectFrameResult,
  assertManualTrimRequest,
  assertManualUndoRequest,
  assertProjectNavigation,
  assertProjectRequest,
  assertTwoSourceProjectRequest,
  assertProjectView,
  projectStages,
} from "../../packages/domain/src/project-view.ts";
import type { ProjectView } from "../../packages/domain/src/project-view.ts";

function view(): ProjectView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Synthetic project",
    stage: "record_import",
    revisionId: "22222222-2222-4222-8222-222222222222",
    draft: {
      id: "draft-22222222-2222-4222-8222-222222222222",
      baseRevisionId: "22222222-2222-4222-8222-222222222222",
      sequence: 0,
      timelineSha256: "a".repeat(64),
      undoTransactionId: null,
    },
    source: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Fixture.mkv",
      width: 1920,
      height: 1080,
      durationUs: 1001000,
      frameRate: 30000 / 1001,
      previewAvailable: true,
    },
    timeline: {
      id: "44444444-4444-4444-8444-444444444444",
      durationUs: 1001000,
      frameRate: { numerator: 30000, denominator: 1001 },
    },
  };
}
test("project IPC runtime accepts path-free views and exact requests for all five navigation stages", () => {
  const value = view();
  assertProjectRequest({ id: value.id });
  assertProjectRequest({ id: value.source.id });
  assertProjectList([]);
  for (const stage of projectStages) {
    value.stage = stage;
    assertProjectNavigation({ id: value.id, stage });
    assertProjectView(value);
    assertProjectList([value]);
  }
});
test("project requests reject paths, malformed IDs, unknown stages and excess fields", () => {
  for (const value of [
    null,
    [],
    {},
    { id: "../private" },
    { id: 1 },
    { id: "11111111-1111-1111-1111-111111111111" },
    { id: view().id, path: "/private" },
  ]) {
    assert.throws(() => assertProjectRequest(value));
  }
  for (const value of [
    null,
    {},
    { id: view().id },
    { id: view().id, stage: "complete" },
    { id: view().id, stage: "qa" },
    { id: view().id, stage: "edit", path: "/private" },
    { id: "../private", stage: "edit" },
  ]) {
    assert.throws(() => assertProjectNavigation(value));
  }
});
test("two-source project requests require two distinct path-free library IDs", () => {
  const firstId = view().source.id;
  const secondId = "55555555-5555-4555-8555-555555555555";
  assertTwoSourceProjectRequest({ firstId, secondId });
  for (const bad of [
    null,
    {},
    { firstId },
    { firstId, secondId: firstId },
    { firstId: "../private", secondId },
    { firstId, secondId: "C:\\private\\video.mp4" },
    { firstId, secondId, path: "/private/source.mp4" },
  ])
    assert.throws(() => assertTwoSourceProjectRequest(bad));
});
test("project views accept exactly two ordered summaries and preserve legacy view shape", () => {
  const legacy = view();
  assertProjectView(legacy);
  assert.equal(Object.keys(legacy).length, 7);
  const second = {
    ...legacy.source,
    id: "55555555-5555-4555-8555-555555555555",
    name: "Second.mkv",
  };
  const joined: ProjectView = {
    ...legacy,
    sources: [{ ...legacy.source }, second],
  };
  assertProjectView(joined);
  for (const sources of [
    [],
    [legacy.source],
    [legacy.source, second, second],
    [second, legacy.source],
    [legacy.source, { ...legacy.source }],
    [{ ...legacy.source, name: "Changed.mkv" }, second],
    [legacy.source, { ...second, path: "/private/video.mp4" }],
    [legacy.source, { ...second, id: legacy.id }],
  ])
    assert.throws(() => assertProjectView({ ...joined, sources }));
  assert.throws(() => assertProjectView({ ...joined, path: "/private" }));
});
test("project frame exchanges bind decoded pixels to one committed draft head", () => {
  const project = view();
  const request = {
    projectId: project.id,
    draftId: project.draft.id,
    baseRevisionId: project.revisionId,
    expectedSequence: project.draft.sequence,
    expectedTimelineSha256: project.draft.timelineSha256,
    timelineTimeUs: 0,
  };
  assertProjectFrameRequest(request);
  assertProjectFrameResult({
    status: "ready",
    projectId: project.id,
    draftId: project.draft.id,
    baseRevisionId: project.revisionId,
    draftSequence: project.draft.sequence,
    timelineSha256: project.draft.timelineSha256,
    timelineTimeUs: 0,
    frame: { width: 1, height: 1, rgbaBase64: "AAAAAA==" },
  });
  assertProjectFrameResult({
    status: "stale",
    draft: {
      projectId: project.id,
      draft: project.draft,
      timeline: project.timeline,
    },
  });
  for (const extra of [
    { ...request, path: "/private/source" },
    { ...request, expectedSequence: -1 },
    { ...request, expectedTimelineSha256: "bad" },
    { ...request, timelineTimeUs: 0.5 },
  ])
    assert.throws(() => assertProjectFrameRequest(extra));
});
test("manual edit IPC accepts only exact intent and a valid draft head", () => {
  const project = view();
  const head = {
    schema_version: "1.0",
    projectId: project.id,
    draftId: project.draft.id,
    baseRevisionId: project.revisionId,
    expectedSequence: 0,
    expectedTimelineSha256: project.draft.timelineSha256,
  };
  const trim = {
    ...head,
    clipId: "clip-main",
    edge: "start",
    timelinePositionUs: 500_000,
  };
  const undo = { ...head, targetTransactionId: "transaction-1" };
  assertManualTrimRequest(trim);
  assertManualUndoRequest(undo);
  for (const bad of [
    { ...trim, path: "/private/source.mp4" },
    { ...trim, schema_version: "2.0" },
    { ...trim, clipId: "../private" },
    { ...trim, edge: "middle" },
    { ...trim, timelinePositionUs: 0 },
    { ...trim, timelinePositionUs: 0.5 },
    { ...trim, expectedTimelineSha256: "bad" },
    { ...trim, projectId: project.revisionId },
  ])
    assert.throws(() => assertManualTrimRequest(bad));
  for (const bad of [
    { ...undo, targetTransactionId: "" },
    { ...undo, expectedSequence: -1 },
    { ...undo, request_id: "renderer-owned" },
  ])
    assert.throws(() => assertManualUndoRequest(bad));
});
test("committed clip maps enforce contiguous ordered half-open source mapping", () => {
  const first = view();
  const firstClip = {
    id: "clip-main",
    sourceId: first.source.id,
    timelineStartUs: 0,
    timelineEndUs: first.timeline.durationUs,
    sourceStartUs: 0,
    sourceEndUs: first.timeline.durationUs,
  };
  assertProjectView({ ...first, clips: [firstClip] });
  const secondSource = {
    ...first.source,
    id: "55555555-5555-4555-8555-555555555555",
    name: "Second.mkv",
  };
  const secondClip = {
    ...firstClip,
    id: "clip-following",
    sourceId: secondSource.id,
    timelineStartUs: firstClip.timelineEndUs,
    timelineEndUs: firstClip.timelineEndUs * 2,
  };
  const joined: ProjectView = {
    ...first,
    sources: [first.source, secondSource],
    clips: [firstClip, secondClip],
    timeline: { ...first.timeline, durationUs: firstClip.timelineEndUs * 2 },
  };
  assertProjectView(joined);
  const draftOnly = {
    projectId: joined.id,
    draft: joined.draft,
    timeline: joined.timeline,
    clips: joined.clips,
  };
  assertProjectDraftView(draftOnly);
  for (const clips of [
    [],
    [firstClip],
    [secondClip, firstClip],
    [
      firstClip,
      { ...secondClip, timelineStartUs: secondClip.timelineStartUs + 1 },
    ],
    [firstClip, { ...secondClip, sourceEndUs: secondClip.sourceEndUs + 1 }],
    [firstClip, { ...secondClip, sourceId: firstClip.sourceId }],
    [firstClip, { ...secondClip, sourceEndUs: secondSource.durationUs + 1 }],
    [firstClip, { ...secondClip, path: "/private" }],
  ])
    assert.throws(() => assertProjectView({ ...joined, clips }));
  assert.throws(() =>
    assertProjectDraftView({
      ...draftOnly,
      clips: [
        firstClip,
        { ...secondClip, timelineEndUs: secondClip.timelineEndUs + 1 },
      ],
    }),
  );
});
test("project views reject unsafe numeric formats, private fields and malformed shapes", () => {
  for (const bad of [
    NaN,
    Infinity,
    -Infinity,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    "30000",
    true,
    null,
  ]) {
    for (const key of ["numerator", "denominator"]) {
      const value = view();
      Object.assign(value.timeline.frameRate, { [key]: bad });
      assert.throws(() => assertProjectView(value));
    }
    const value = view();
    Object.assign(value.timeline, { durationUs: bad });
    assert.throws(() => assertProjectView(value));
  }
  for (const name of [
    "",
    "x".repeat(161),
    "/private/video",
    "C:\\private\\video",
    "bad\u0000name",
  ]) {
    const value = view();
    value.name = name;
    assert.throws(() => assertProjectView(value));
  }
  for (const location of ["root", "source", "timeline", "frameRate"]) {
    const value = view();
    const target =
      location === "root"
        ? value
        : location === "source"
          ? value.source
          : location === "timeline"
            ? value.timeline
            : value.timeline.frameRate;
    Object.assign(target, { path: "/private/project.json" });
    assert.throws(() => assertProjectView(value));
  }
  for (const value of [
    null,
    [],
    {},
    { ...view(), stage: "complete" },
    { ...view(), source: null },
    { ...view(), timeline: { ...view().timeline, frameRate: 29.97 } },
  ]) {
    assert.throws(() => assertProjectView(value));
  }
});
test("runtime rejects shared role identities and duplicate project IDs even if views differ", () => {
  for (const role of ["revision", "draft", "source", "timeline"]) {
    const value = view();
    if (role === "revision") value.revisionId = value.id;
    else if (role === "draft") value.draft.id = value.id;
    else if (role === "source") value.source.id = value.id;
    else value.timeline.id = value.id;
    assert.throws(() => assertProjectView(value));
  }
  const first = view(),
    second = view();
  second.name = "Different display name";
  assert.throws(() => assertProjectList([first, second]));
  assert.throws(() => assertProjectList(Array.from({ length: 1001 }, view)));
  for (const value of [null, {}, [null]])
    assert.throws(() => assertProjectList(value));
  const staleBase = view();
  staleBase.draft.baseRevisionId = staleBase.source.id;
  assert.throws(() => assertProjectView(staleBase));
  assert.throws(() =>
    assertProjectDraftView({
      projectId: view().id,
      draft: { ...view().draft, sequence: 0.5 },
      timeline: view().timeline,
    }),
  );
});
