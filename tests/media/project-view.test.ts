import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProjectList,
  assertProjectNavigation,
  assertProjectRequest,
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
  for (const role of ["revision", "source", "timeline"]) {
    const value = view();
    if (role === "revision") value.revisionId = value.id;
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
});
