import { assertMediaSummary, mediaIdPattern } from "./library.ts";
import type { MediaSummary } from "./library.ts";

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
/** Path-free view of a committed project, never a renderer-owned persistence model. */
export interface ProjectView {
  id: string;
  name: string;
  stage: ProjectStage;
  revisionId: string;
  source: MediaSummary;
  timeline: {
    id: string;
    durationUs: number;
    frameRate: { numerator: number; denominator: number };
  };
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
export function assertProjectView(
  value: unknown,
): asserts value is ProjectView {
  exact(value, ["id", "name", "stage", "revisionId", "source", "timeline"]);
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
  exact(value.timeline, ["id", "durationUs", "frameRate"]);
  id(value.timeline.id);
  positive(value.timeline.durationUs);
  exact(value.timeline.frameRate, ["numerator", "denominator"]);
  positive(value.timeline.frameRate.numerator);
  positive(value.timeline.frameRate.denominator);
  if (
    new Set([value.id, value.revisionId, value.source.id, value.timeline.id])
      .size !== 4
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
