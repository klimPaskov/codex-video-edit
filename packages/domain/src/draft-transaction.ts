import type { InitialProjectSnapshot } from "./project.ts";
import {
  canonicalSha256,
  projectCanonicalJson,
  timelineSha256,
} from "./project.ts";

export type DraftTimeline = InitialProjectSnapshot["timeline"];
export type DraftOrigin = "manual" | "codex" | "magic_wand";
export type DraftPassKind =
  | "manual"
  | "spoken_cut"
  | "layout"
  | "zoom"
  | "captions"
  | "speed"
  | "audio"
  | "broll"
  | "cursor";

export interface DraftPassGroup {
  pass_group_id: string;
  kind: DraftPassKind;
}

export interface TrimEdgeIntent {
  type: "trim";
  clip_id: string;
  edge: "start" | "end";
  timeline_position_us: number;
}

/** Untrusted callers provide intent and freshness only. Authority is injected by the adapter. */
export interface ApplyDraftTransactionRequest {
  schema_version: "1.0";
  request_id: string;
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  expected_sequence: number;
  expected_timeline_sha256: string;
  pass_group: DraftPassGroup;
  reason: string;
  operations: TrimEdgeIntent[];
}

export interface UndoDraftTransactionRequest {
  schema_version: "1.0";
  request_id: string;
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  expected_sequence: number;
  expected_timeline_sha256: string;
  target_transaction_id: string;
  reason: string;
}

export interface DraftVerificationCheck {
  check_id: string;
  status: "pass";
  method: string;
  evidence_ids: string[];
}

/** Created only by the trusted verification service after its checks have passed. */
export interface PassCheckpointRequest {
  schema_version: "1.0";
  request_id: string;
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  expected_sequence: number;
  expected_timeline_sha256: string;
  pass_group: DraftPassGroup;
  verified_transaction_ids: string[];
  summary: string;
  checks: DraftVerificationCheck[];
}

export interface DraftState {
  schema_version: "1.0";
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  draft_sequence: number;
  timeline_sha256: string;
  head_transaction_sha256: string | null;
  timeline: DraftTimeline;
}

export interface TrimOperationRecord {
  schema_version: "1.0";
  operation_id: string;
  operation_type: "trim";
  clip_id: string;
  edge: "start" | "end";
  timeline_position_us: number;
  before: DraftTimeline["clips"][number];
  after: DraftTimeline["clips"][number];
  inverse: {
    type: "restore_clip";
    clip: DraftTimeline["clips"][number];
    expected_after_sha256: string;
  };
}

export interface DraftTransactionRecord {
  schema_version: "1.0";
  transaction_id: string;
  request_id: string;
  request_sha256: string;
  transaction_sha256: string;
  previous_transaction_sha256: string | null;
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  kind: "apply" | "undo";
  origin: DraftOrigin;
  pass_group: DraftPassGroup | null;
  reason: string;
  created_at: string;
  target_transaction_id: string | null;
  before: DraftState;
  after: DraftState;
  operations: TrimOperationRecord[];
  status: "committed";
}

export interface PassCheckpointRecord {
  schema_version: "1.0";
  checkpoint_id: string;
  request_id: string;
  request_sha256: string;
  checkpoint_sha256: string;
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  draft_sequence: number;
  timeline_sha256: string;
  head_transaction_sha256: string;
  pass_group: DraftPassGroup;
  verified_transaction_ids: string[];
  summary: string;
  checks: DraftVerificationCheck[];
  created_at: string;
  status: "verified";
}

export interface DraftTransactionAuthority {
  origin: DraftOrigin;
  transaction_id: string;
  operation_ids: string[];
  created_at: string;
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/u;
const hashPattern = /^[a-f0-9]{64}$/u;
const passKinds: readonly DraftPassKind[] = [
  "manual",
  "spoken_cut",
  "layout",
  "zoom",
  "captions",
  "speed",
  "audio",
  "broll",
  "cursor",
];

function invalid(): never {
  throw new Error(
    "The draft transaction is invalid or stale. Refresh the project and try again.",
  );
}

function exact(
  value: unknown,
  keys: readonly string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    invalid();
}

function id(value: unknown): asserts value is string {
  if (typeof value !== "string" || !idPattern.test(value)) invalid();
}

function hash(value: unknown): asserts value is string {
  if (typeof value !== "string" || !hashPattern.test(value)) invalid();
}

function integer(value: unknown, minimum = 0): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    invalid();
}

function prose(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 1000 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    invalid();
}

function passGroup(value: unknown): asserts value is DraftPassGroup {
  exact(value, ["pass_group_id", "kind"]);
  id(value.pass_group_id);
  if (!passKinds.includes(value.kind as DraftPassKind)) invalid();
}

function verificationCheck(
  value: unknown,
): asserts value is DraftVerificationCheck {
  exact(value, ["check_id", "status", "method", "evidence_ids"]);
  id(value.check_id);
  if (value.status !== "pass") invalid();
  prose(value.method);
  if (!Array.isArray(value.evidence_ids) || value.evidence_ids.length > 64)
    invalid();
  for (const evidenceId of value.evidence_ids) id(evidenceId);
  if (new Set(value.evidence_ids).size !== value.evidence_ids.length) invalid();
}

function clip(value: unknown): asserts value is DraftTimeline["clips"][number] {
  exact(value, [
    "clip_id",
    "track_id",
    "source_id",
    "source_start_us",
    "source_end_us",
    "timeline_start_us",
    "timeline_end_us",
    "enabled",
  ]);
  id(value.clip_id);
  id(value.track_id);
  id(value.source_id);
  integer(value.source_start_us);
  integer(value.source_end_us, 1);
  integer(value.timeline_start_us);
  integer(value.timeline_end_us, 1);
  if (
    value.source_start_us >= value.source_end_us ||
    value.timeline_start_us >= value.timeline_end_us ||
    value.enabled !== true
  )
    invalid();
}

/** P2's first reducer is restricted to the imported single-main-clip baseline. */
export function assertDraftTimeline(
  value: unknown,
  baseline: DraftTimeline,
): asserts value is DraftTimeline {
  exact(value, [
    "schema_version",
    "timeline_id",
    "project_id",
    "revision_id",
    "duration_us",
    "frame_rate",
    "canvas",
    "tracks",
    "clips",
    "operation_ids",
    "zoom_ids",
    "speed_ids",
    "created_at",
  ]);
  if (
    value.schema_version !== "1.0" ||
    value.timeline_id !== baseline.timeline_id ||
    value.project_id !== baseline.project_id ||
    value.revision_id !== baseline.revision_id ||
    value.created_at !== baseline.created_at ||
    projectCanonicalJson(value.frame_rate) !==
      projectCanonicalJson(baseline.frame_rate) ||
    projectCanonicalJson(value.canvas) !==
      projectCanonicalJson(baseline.canvas) ||
    projectCanonicalJson(value.tracks) !==
      projectCanonicalJson(baseline.tracks) ||
    projectCanonicalJson(value.zoom_ids) !==
      projectCanonicalJson(baseline.zoom_ids) ||
    projectCanonicalJson(value.speed_ids) !==
      projectCanonicalJson(baseline.speed_ids) ||
    !Array.isArray(value.operation_ids) ||
    value.operation_ids.length > 100_000 ||
    !Array.isArray(value.clips) ||
    value.clips.length !== 1 ||
    baseline.clips.length !== 1
  )
    invalid();
  for (const operationId of value.operation_ids) id(operationId);
  if (new Set(value.operation_ids).size !== value.operation_ids.length)
    invalid();
  const current = value.clips[0],
    original = baseline.clips[0];
  clip(current);
  clip(original);
  if (
    current.clip_id !== original.clip_id ||
    current.track_id !== original.track_id ||
    current.source_id !== original.source_id ||
    current.source_start_us < original.source_start_us ||
    current.source_end_us > original.source_end_us ||
    current.timeline_start_us !== 0 ||
    current.timeline_end_us !==
      current.source_end_us - current.source_start_us ||
    value.duration_us !== current.timeline_end_us
  )
    invalid();
}

export function assertDraftState(
  value: unknown,
  baseline: InitialProjectSnapshot,
): asserts value is DraftState {
  exact(value, [
    "schema_version",
    "project_id",
    "draft_id",
    "base_revision_id",
    "draft_sequence",
    "timeline_sha256",
    "head_transaction_sha256",
    "timeline",
  ]);
  if (
    value.schema_version !== "1.0" ||
    value.project_id !== baseline.project.project_id ||
    value.base_revision_id !== baseline.revision.revision_id
  )
    invalid();
  id(value.draft_id);
  integer(value.draft_sequence);
  hash(value.timeline_sha256);
  if (value.head_transaction_sha256 !== null)
    hash(value.head_transaction_sha256);
  if ((value.draft_sequence === 0) !== (value.head_transaction_sha256 === null))
    invalid();
  assertDraftTimeline(value.timeline, baseline.timeline);
  if (timelineSha256(value.timeline) !== value.timeline_sha256) invalid();
}

function commonRequest(value: Record<string, unknown>): void {
  if (value.schema_version !== "1.0") invalid();
  id(value.request_id);
  id(value.project_id);
  id(value.draft_id);
  id(value.base_revision_id);
  integer(value.expected_sequence);
  hash(value.expected_timeline_sha256);
  prose(value.reason);
}

export function assertApplyDraftTransactionRequest(
  value: unknown,
): asserts value is ApplyDraftTransactionRequest {
  exact(value, [
    "schema_version",
    "request_id",
    "project_id",
    "draft_id",
    "base_revision_id",
    "expected_sequence",
    "expected_timeline_sha256",
    "pass_group",
    "reason",
    "operations",
  ]);
  commonRequest(value);
  passGroup(value.pass_group);
  if (
    !Array.isArray(value.operations) ||
    value.operations.length < 1 ||
    value.operations.length > 64
  )
    invalid();
  const clips = new Set<string>();
  for (const operation of value.operations) {
    exact(operation, ["type", "clip_id", "edge", "timeline_position_us"]);
    id(operation.clip_id);
    integer(operation.timeline_position_us, 1);
    if (
      operation.type !== "trim" ||
      !["start", "end"].includes(operation.edge as string) ||
      clips.has(operation.clip_id)
    )
      invalid();
    clips.add(operation.clip_id);
  }
}

export function assertUndoDraftTransactionRequest(
  value: unknown,
): asserts value is UndoDraftTransactionRequest {
  exact(value, [
    "schema_version",
    "request_id",
    "project_id",
    "draft_id",
    "base_revision_id",
    "expected_sequence",
    "expected_timeline_sha256",
    "target_transaction_id",
    "reason",
  ]);
  commonRequest(value);
  id(value.target_transaction_id);
}

export function assertPassCheckpointRequest(
  value: unknown,
): asserts value is PassCheckpointRequest {
  exact(value, [
    "schema_version",
    "request_id",
    "project_id",
    "draft_id",
    "base_revision_id",
    "expected_sequence",
    "expected_timeline_sha256",
    "pass_group",
    "verified_transaction_ids",
    "summary",
    "checks",
  ]);
  commonRequest({
    schema_version: value.schema_version,
    request_id: value.request_id,
    project_id: value.project_id,
    draft_id: value.draft_id,
    base_revision_id: value.base_revision_id,
    expected_sequence: value.expected_sequence,
    expected_timeline_sha256: value.expected_timeline_sha256,
    reason: value.summary,
  });
  passGroup(value.pass_group);
  if (
    !Array.isArray(value.verified_transaction_ids) ||
    value.verified_transaction_ids.length < 1 ||
    value.verified_transaction_ids.length > 64 ||
    !Array.isArray(value.checks) ||
    value.checks.length < 1 ||
    value.checks.length > 64
  )
    invalid();
  for (const transactionId of value.verified_transaction_ids) id(transactionId);
  if (
    new Set(value.verified_transaction_ids).size !==
    value.verified_transaction_ids.length
  )
    invalid();
  for (const check of value.checks) verificationCheck(check);
  if (
    new Set(value.checks.map((check) => check.check_id)).size !==
    value.checks.length
  )
    invalid();
}

export function cloneDraftState(value: DraftState): DraftState {
  return JSON.parse(projectCanonicalJson(value)) as DraftState;
}

export function initialDraftState(
  baseline: InitialProjectSnapshot,
  draftId: string,
): DraftState {
  id(draftId);
  const timeline = JSON.parse(
    projectCanonicalJson(baseline.timeline),
  ) as DraftTimeline;
  return {
    schema_version: "1.0",
    project_id: baseline.project.project_id,
    draft_id: draftId,
    base_revision_id: baseline.revision.revision_id,
    draft_sequence: 0,
    timeline_sha256: timelineSha256(timeline),
    head_transaction_sha256: null,
    timeline,
  };
}

export function draftRequestSha256(
  request: ApplyDraftTransactionRequest | UndoDraftTransactionRequest,
  origin: DraftOrigin,
): string {
  return canonicalSha256({ request, origin });
}

export function draftRecordSha256(
  record: Omit<DraftTransactionRecord, "transaction_sha256">,
): string {
  return canonicalSha256({
    ...record,
    // The head points at this digest, so it is excluded from its own preimage.
    after: { ...record.after, head_transaction_sha256: null },
  });
}

export function passCheckpointRequestSha256(
  request: PassCheckpointRequest,
): string {
  return canonicalSha256(request);
}

export function passCheckpointRecordSha256(
  record: Omit<PassCheckpointRecord, "checkpoint_sha256">,
): string {
  return canonicalSha256(record);
}
