import {
  assertMediaFrame,
  assertMediaSummary,
  mediaIdPattern,
} from "./library.ts";
import type { MediaFrame, MediaSummary } from "./library.ts";

export const projectStages = [
  "record_import",
  "auto_edit",
  "edit",
  "review",
  "export",
] as const;
export type ProjectStage = (typeof projectStages)[number];
export interface ProjectRequest {
  id: string;
}
export interface ProjectNavigation extends ProjectRequest {
  stage: ProjectStage;
}
export interface ProjectFrameRequest {
  projectId: string;
  draftId: string;
  baseRevisionId: string;
  expectedSequence: number;
  expectedTimelineSha256: string;
  timelineTimeUs: number;
}
export interface ProjectFrameView {
  status: "ready";
  projectId: string;
  draftId: string;
  baseRevisionId: string;
  draftSequence: number;
  timelineSha256: string;
  timelineTimeUs: number;
  frame: MediaFrame;
}
export type ProjectFrameResult =
  ProjectFrameView | { status: "stale"; draft: ProjectDraftView };
export interface ProjectDraftView {
  projectId: string;
  draft: {
    id: string;
    baseRevisionId: string;
    sequence: number;
    timelineSha256: string;
    undoTransactionId: string | null;
  };
  timeline: {
    id: string;
    durationUs: number;
    frameRate: { numerator: number; denominator: number };
  };
}
/** Path-free view of a committed project, never a renderer-owned persistence model. */
export interface ProjectView extends Omit<ProjectDraftView, "projectId"> {
  id: string;
  name: string;
  stage: ProjectStage;
  revisionId: string;
  source: MediaSummary;
}
function invalid(): never {
  throw new Error("Invalid project exchange.");
}
function exact(
  value: unknown,
  keys: string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    invalid();
}
function id(value: unknown): asserts value is string {
  if (typeof value !== "string" || !mediaIdPattern.test(value)) invalid();
}
function opaqueId(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/u.test(value)
  )
    invalid();
}
function hash(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) invalid();
}
function integer(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    invalid();
}
function positive(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    invalid();
}
export function assertProjectRequest(
  value: unknown,
): asserts value is ProjectRequest {
  exact(value, ["id"]);
  id(value.id);
}
export function assertProjectNavigation(
  value: unknown,
): asserts value is ProjectNavigation {
  exact(value, ["id", "stage"]);
  id(value.id);
  if (!projectStages.includes(value.stage as ProjectStage)) invalid();
}
export function assertProjectFrameRequest(
  value: unknown,
): asserts value is ProjectFrameRequest {
  exact(value, [
    "projectId",
    "draftId",
    "baseRevisionId",
    "expectedSequence",
    "expectedTimelineSha256",
    "timelineTimeUs",
  ]);
  id(value.projectId);
  opaqueId(value.draftId);
  id(value.baseRevisionId);
  integer(value.expectedSequence);
  hash(value.expectedTimelineSha256);
  integer(value.timelineTimeUs);
  if (
    new Set([value.projectId, value.baseRevisionId, value.draftId]).size !== 3
  )
    invalid();
}
export function assertProjectFrameView(
  value: unknown,
): asserts value is ProjectFrameView {
  exact(value, [
    "status",
    "projectId",
    "draftId",
    "baseRevisionId",
    "draftSequence",
    "timelineSha256",
    "timelineTimeUs",
    "frame",
  ]);
  if (value.status !== "ready") invalid();
  assertProjectFrameRequest({
    projectId: value.projectId,
    draftId: value.draftId,
    baseRevisionId: value.baseRevisionId,
    expectedSequence: value.draftSequence,
    expectedTimelineSha256: value.timelineSha256,
    timelineTimeUs: value.timelineTimeUs,
  });
  assertMediaFrame(value.frame);
}
export function assertProjectFrameResult(
  value: unknown,
): asserts value is ProjectFrameResult {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "status" in value &&
    value.status === "stale"
  ) {
    const stale = value as Record<string, unknown>;
    exact(stale, ["status", "draft"]);
    assertProjectDraftView(stale.draft);
    return;
  }
  assertProjectFrameView(value);
}
export function assertProjectDraftView(
  value: unknown,
): asserts value is ProjectDraftView {
  exact(value, ["projectId", "draft", "timeline"]);
  id(value.projectId);
  exact(value.draft, [
    "id",
    "baseRevisionId",
    "sequence",
    "timelineSha256",
    "undoTransactionId",
  ]);
  opaqueId(value.draft.id);
  id(value.draft.baseRevisionId);
  integer(value.draft.sequence);
  hash(value.draft.timelineSha256);
  if (value.draft.undoTransactionId !== null)
    opaqueId(value.draft.undoTransactionId);
  exact(value.timeline, ["id", "durationUs", "frameRate"]);
  id(value.timeline.id);
  positive(value.timeline.durationUs);
  exact(value.timeline.frameRate, ["numerator", "denominator"]);
  positive(value.timeline.frameRate.numerator);
  positive(value.timeline.frameRate.denominator);
  if (
    new Set([
      value.projectId,
      value.draft.baseRevisionId,
      value.draft.id,
      value.timeline.id,
    ]).size !== 4
  )
    invalid();
}
export function assertProjectView(
  value: unknown,
): asserts value is ProjectView {
  exact(value, [
    "id",
    "name",
    "stage",
    "revisionId",
    "draft",
    "source",
    "timeline",
  ]);
  id(value.id);
  id(value.revisionId);
  if (
    typeof value.name !== "string" ||
    !value.name.length ||
    value.name.length > 160 ||
    /[\x00-\x1f/\\]/u.test(value.name)
  )
    invalid();
  if (!projectStages.includes(value.stage as ProjectStage)) invalid();
  assertMediaSummary(value.source);
  const draftView = {
    projectId: value.id,
    draft: value.draft,
    timeline: value.timeline,
  };
  assertProjectDraftView(draftView);
  if (draftView.draft.baseRevisionId !== value.revisionId) invalid();
  if (
    [
      value.id,
      value.revisionId,
      draftView.draft.id,
      draftView.timeline.id,
    ].includes(value.source.id)
  )
    invalid();
}
export function assertProjectList(
  value: unknown,
): asserts value is ProjectView[] {
  if (!Array.isArray(value) || value.length > 1000) invalid();
  value.forEach(assertProjectView);
  if (new Set(value.map((item) => item.id)).size !== value.length) invalid();
}
