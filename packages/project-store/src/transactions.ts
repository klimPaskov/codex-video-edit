import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import {
  assertApplyDraftTransactionRequest,
  assertDraftState,
  assertPassCheckpointRequest,
  assertUndoDraftTransactionRequest,
  cloneDraftState,
  draftRecordSha256,
  draftRequestSha256,
  initialDraftState,
  passCheckpointRecordSha256,
  passCheckpointRequestSha256,
  type ApplyDraftTransactionRequest,
  type DraftOrigin,
  type DraftState,
  type DraftTransactionAuthority,
  type DraftTransactionRecord,
  type PassCheckpointRecord,
  type PassCheckpointRequest,
  type TrimOperationRecord,
  type UndoDraftTransactionRequest,
} from "../../domain/src/draft-transaction.ts";
import {
  canonicalSha256,
  projectCanonicalJson,
  timelineSha256,
  type InitialProjectSnapshot,
} from "../../domain/src/project.ts";
import { sameProjectStorePath, serializeProjectStore } from "./serialize.ts";

type ProjectReader = {
  readForDraftTransaction(projectId: string): Promise<InitialProjectSnapshot>;
};

export type DraftTransactionErrorCode =
  "invalid" | "stale" | "conflict" | "storage" | "outcome_unknown";

export interface DraftConflictState {
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  draft_sequence: number;
  timeline_sha256: string;
}

export class DraftTransactionError extends Error {
  readonly code: DraftTransactionErrorCode;
  readonly current: DraftConflictState | null;
  constructor(
    code: DraftTransactionErrorCode,
    current: DraftConflictState | null = null,
  ) {
    const messages: Record<DraftTransactionErrorCode, string> = {
      invalid:
        "The draft change is invalid. Refresh the project and try again.",
      stale:
        "The draft changed before this edit could be applied. Refresh and try again.",
      conflict:
        "This edit conflicts with newer draft work. Refresh the project and try again.",
      storage:
        "The draft could not be read or saved. Check local storage and reopen the project.",
      outcome_unknown:
        "The draft connection ended during saving. Reopen the project before retrying.",
    };
    super(messages[code]);
    this.name = "DraftTransactionError";
    this.code = code;
    this.current = current ? structuredClone(current) : null;
  }
}

export interface DraftTransactionDependencies {
  now: () => string;
  id: () => string;
  /** Internal deterministic crash seams; never renderer or tool controlled. */
  afterPendingWrite?: () => Promise<void>;
  afterJournalCommit?: () => Promise<void>;
  afterCheckpointPendingWrite?: () => Promise<void>;
  afterCheckpointCommit?: () => Promise<void>;
}

export interface DraftReadResult {
  draft: DraftState;
  undo_transaction_id: string | null;
  current_pass_checkpoint: PassCheckpointRecord | null;
}

export interface DraftCommitResult extends DraftReadResult {
  transaction: DraftTransactionRecord;
  replayed: boolean;
}

export interface PassCheckpointCommitResult extends DraftReadResult {
  checkpoint: PassCheckpointRecord;
  replayed: boolean;
}

interface DraftMeta {
  schema_version: "1.0";
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  baseline_timeline_sha256: string;
  source_sha256: string;
  created_at: string;
}

interface LoadedDraft {
  baseline: InitialProjectSnapshot;
  state: DraftState;
  records: Map<string, DraftTransactionRecord>;
  requests: Map<string, DraftTransactionRecord>;
  applied: DraftTransactionRecord[];
  journal: string;
  checkpointRequests: Map<string, PassCheckpointRecord>;
  currentCheckpoint: PassCheckpointRecord | null;
  checkpoints: string;
}

const jsonLimit = 32 * 1024 * 1024;
const sequenceLimit = 999_999_999_999;
const committedPattern =
  /^(\d{12})\.([A-Za-z0-9][A-Za-z0-9._-]{1,127})\.json$/u;
const pendingPattern = /^\.pending-[A-Za-z0-9][A-Za-z0-9._-]{1,127}\.json$/u;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/u;
const hashPattern = /^[a-f0-9]{64}$/u;

function fail(
  code: DraftTransactionErrorCode = "storage",
  current: DraftState | null = null,
): never {
  throw new DraftTransactionError(
    code,
    current
      ? {
          project_id: current.project_id,
          draft_id: current.draft_id,
          base_revision_id: current.base_revision_id,
          draft_sequence: current.draft_sequence,
          timeline_sha256: current.timeline_sha256,
        }
      : null,
  );
}

function exact(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail();
  return value as Record<string, unknown>;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && idPattern.test(value);
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && hashPattern.test(value);
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

async function safeDirectory(path: string): Promise<void> {
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    !sameProjectStorePath(await realpath(path), path)
  )
    fail();
}

async function readJson(path: string): Promise<unknown> {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||
    info.size < 2 ||
    info.size > jsonLimit
  )
    fail();
  const handle = await open(
    path,
    constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
  );
  try {
    const current = await handle.stat();
    if (!current.isFile() || current.nlink !== 1 || current.size > jsonLimit)
      fail();
    return JSON.parse(await handle.readFile("utf8")) as unknown;
  } catch (error) {
    if (error instanceof DraftTransactionError) throw error;
    fail();
  } finally {
    await handle.close();
  }
}

async function writeNew(path: string, value: unknown): Promise<void> {
  const content = `${projectCanonicalJson(value)}\n`;
  if (Buffer.byteLength(content) > jsonLimit) fail("invalid");
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function same(left: unknown, right: unknown): boolean {
  return projectCanonicalJson(left) === projectCanonicalJson(right);
}

function assertMeta(
  value: unknown,
  baseline: InitialProjectSnapshot,
): DraftMeta {
  const meta = exact(value, [
    "schema_version",
    "project_id",
    "draft_id",
    "base_revision_id",
    "baseline_timeline_sha256",
    "source_sha256",
    "created_at",
  ]);
  if (
    meta.schema_version !== "1.0" ||
    meta.project_id !== baseline.project.project_id ||
    !validId(meta.draft_id) ||
    meta.base_revision_id !== baseline.revision.revision_id ||
    meta.baseline_timeline_sha256 !== timelineSha256(baseline.timeline) ||
    meta.source_sha256 !== baseline.source.sha256 ||
    !validTimestamp(meta.created_at)
  )
    fail();
  return meta as unknown as DraftMeta;
}

function recordWithoutHash(
  record: DraftTransactionRecord,
): Omit<DraftTransactionRecord, "transaction_sha256"> {
  const withoutHash: Partial<DraftTransactionRecord> = { ...record };
  delete withoutHash.transaction_sha256;
  return withoutHash as Omit<DraftTransactionRecord, "transaction_sha256">;
}

function checkpointWithoutHash(
  record: PassCheckpointRecord,
): Omit<PassCheckpointRecord, "checkpoint_sha256"> {
  const withoutHash: Partial<PassCheckpointRecord> = { ...record };
  delete withoutHash.checkpoint_sha256;
  return withoutHash as Omit<PassCheckpointRecord, "checkpoint_sha256">;
}

function assertRecordEnvelope(value: unknown): DraftTransactionRecord {
  const record = exact(value, [
    "schema_version",
    "transaction_id",
    "request_id",
    "request_sha256",
    "transaction_sha256",
    "previous_transaction_sha256",
    "project_id",
    "draft_id",
    "base_revision_id",
    "kind",
    "origin",
    "pass_group",
    "reason",
    "created_at",
    "target_transaction_id",
    "before",
    "after",
    "operations",
    "status",
  ]);
  if (
    record.schema_version !== "1.0" ||
    !validId(record.transaction_id) ||
    !validId(record.request_id) ||
    !validHash(record.request_sha256) ||
    !validHash(record.transaction_sha256) ||
    (record.previous_transaction_sha256 !== null &&
      !validHash(record.previous_transaction_sha256)) ||
    !validId(record.project_id) ||
    !validId(record.draft_id) ||
    !validId(record.base_revision_id) ||
    !["apply", "undo"].includes(record.kind as string) ||
    !["manual", "codex", "magic_wand"].includes(record.origin as string) ||
    typeof record.reason !== "string" ||
    !record.reason.trim() ||
    record.reason.length > 1000 ||
    !validTimestamp(record.created_at) ||
    (record.target_transaction_id !== null &&
      !validId(record.target_transaction_id)) ||
    !Array.isArray(record.operations) ||
    record.status !== "committed"
  )
    fail();
  return record as unknown as DraftTransactionRecord;
}

function checkpointRequestFromRecord(
  record: PassCheckpointRecord,
): PassCheckpointRequest {
  return {
    schema_version: "1.0",
    request_id: record.request_id,
    project_id: record.project_id,
    draft_id: record.draft_id,
    base_revision_id: record.base_revision_id,
    expected_sequence: record.draft_sequence,
    expected_timeline_sha256: record.timeline_sha256,
    pass_group: record.pass_group,
    verified_transaction_ids: record.verified_transaction_ids,
    summary: record.summary,
    checks: record.checks,
  };
}

function assertCheckpointEnvelope(value: unknown): PassCheckpointRecord {
  const record = exact(value, [
    "schema_version",
    "checkpoint_id",
    "request_id",
    "request_sha256",
    "checkpoint_sha256",
    "project_id",
    "draft_id",
    "base_revision_id",
    "draft_sequence",
    "timeline_sha256",
    "head_transaction_sha256",
    "pass_group",
    "verified_transaction_ids",
    "summary",
    "checks",
    "created_at",
    "status",
  ]);
  if (
    record.schema_version !== "1.0" ||
    !validId(record.checkpoint_id) ||
    !validId(record.request_id) ||
    !validHash(record.request_sha256) ||
    !validHash(record.checkpoint_sha256) ||
    !validId(record.project_id) ||
    !validId(record.draft_id) ||
    !validId(record.base_revision_id) ||
    !Number.isSafeInteger(record.draft_sequence) ||
    (record.draft_sequence as number) < 1 ||
    !validHash(record.timeline_sha256) ||
    !validHash(record.head_transaction_sha256) ||
    !validTimestamp(record.created_at) ||
    record.status !== "verified"
  )
    fail();
  const result = record as unknown as PassCheckpointRecord;
  assertPassCheckpointRequest(checkpointRequestFromRecord(result));
  return result;
}

type DraftFreshness = {
  project_id: string;
  draft_id: string;
  base_revision_id: string;
  expected_sequence: number;
  expected_timeline_sha256: string;
};

function ensureFresh(request: DraftFreshness, state: DraftState) {
  if (
    request.project_id !== state.project_id ||
    request.draft_id !== state.draft_id ||
    request.base_revision_id !== state.base_revision_id ||
    request.expected_sequence !== state.draft_sequence ||
    request.expected_timeline_sha256 !== state.timeline_sha256
  )
    fail("stale", state);
}

function nextState(
  before: DraftState,
  timeline: DraftState["timeline"],
): DraftState {
  return {
    schema_version: "1.0",
    project_id: before.project_id,
    draft_id: before.draft_id,
    base_revision_id: before.base_revision_id,
    draft_sequence: before.draft_sequence + 1,
    timeline_sha256: timelineSha256(timeline),
    head_transaction_sha256: "0".repeat(64),
    timeline,
  };
}

function prepareApply(
  baseline: InitialProjectSnapshot,
  before: DraftState,
  request: ApplyDraftTransactionRequest,
  authority: DraftTransactionAuthority,
): DraftTransactionRecord {
  ensureFresh(request, before);
  if (
    authority.operation_ids.length !== request.operations.length ||
    new Set(authority.operation_ids).size !== authority.operation_ids.length
  )
    fail("invalid");
  const timeline = structuredClone(before.timeline),
    records: TrimOperationRecord[] = [];
  for (let index = 0; index < request.operations.length; index++) {
    const intent = request.operations[index]!,
      operationId = authority.operation_ids[index]!;
    if (!validId(operationId) || timeline.operation_ids.includes(operationId))
      fail("conflict");
    const clipIndex = timeline.clips.findIndex(
      (candidate) => candidate.clip_id === intent.clip_id,
    );
    if (clipIndex < 0) fail("invalid");
    const current = timeline.clips[clipIndex]!;
    if (
      intent.timeline_position_us <= current.timeline_start_us ||
      intent.timeline_position_us >= current.timeline_end_us
    )
      fail("conflict");
    const next = structuredClone(current);
    if (intent.edge === "start") {
      const removed = intent.timeline_position_us - current.timeline_start_us;
      next.source_start_us += removed;
    } else {
      next.source_end_us =
        current.source_start_us +
        (intent.timeline_position_us - current.timeline_start_us);
    }
    next.timeline_start_us = 0;
    next.timeline_end_us = next.source_end_us - next.source_start_us;
    timeline.clips[clipIndex] = next;
    timeline.duration_us = next.timeline_end_us;
    timeline.operation_ids.push(operationId);
    records.push({
      schema_version: "1.0",
      operation_id: operationId,
      operation_type: "trim",
      clip_id: intent.clip_id,
      edge: intent.edge,
      timeline_position_us: intent.timeline_position_us,
      before: structuredClone(current),
      after: structuredClone(next),
      inverse: {
        type: "restore_clip",
        clip: structuredClone(current),
        expected_after_sha256: canonicalSha256(next),
      },
    });
  }
  const after = nextState(before, timeline);
  assertDraftState(after, baseline);
  const partial: Omit<DraftTransactionRecord, "transaction_sha256"> = {
    schema_version: "1.0",
    transaction_id: authority.transaction_id,
    request_id: request.request_id,
    request_sha256: draftRequestSha256(request, authority.origin),
    previous_transaction_sha256: before.head_transaction_sha256,
    project_id: before.project_id,
    draft_id: before.draft_id,
    base_revision_id: before.base_revision_id,
    kind: "apply",
    origin: authority.origin,
    pass_group: structuredClone(request.pass_group),
    reason: request.reason,
    created_at: authority.created_at,
    target_transaction_id: null,
    before: cloneDraftState(before),
    after,
    operations: records,
    status: "committed",
  };
  const transaction_sha256 = draftRecordSha256(partial);
  partial.after.head_transaction_sha256 = transaction_sha256;
  return { ...partial, transaction_sha256 };
}

function prepareUndo(
  baseline: InitialProjectSnapshot,
  before: DraftState,
  request: UndoDraftTransactionRequest,
  authority: DraftTransactionAuthority,
  target: DraftTransactionRecord,
): DraftTransactionRecord {
  ensureFresh(request, before);
  if (
    authority.operation_ids.length !== 0 ||
    target.kind !== "apply" ||
    target.transaction_id !== request.target_transaction_id ||
    target.after.timeline_sha256 !== before.timeline_sha256 ||
    target.operations.some(
      (operation) =>
        canonicalSha256(operation.after) !==
        operation.inverse.expected_after_sha256,
    )
  )
    fail("conflict");
  const after = nextState(before, structuredClone(target.before.timeline));
  assertDraftState(after, baseline);
  const partial: Omit<DraftTransactionRecord, "transaction_sha256"> = {
    schema_version: "1.0",
    transaction_id: authority.transaction_id,
    request_id: request.request_id,
    request_sha256: draftRequestSha256(request, authority.origin),
    previous_transaction_sha256: before.head_transaction_sha256,
    project_id: before.project_id,
    draft_id: before.draft_id,
    base_revision_id: before.base_revision_id,
    kind: "undo",
    origin: authority.origin,
    pass_group: null,
    reason: request.reason,
    created_at: authority.created_at,
    target_transaction_id: target.transaction_id,
    before: cloneDraftState(before),
    after,
    operations: [],
    status: "committed",
  };
  const transaction_sha256 = draftRecordSha256(partial);
  partial.after.head_transaction_sha256 = transaction_sha256;
  return { ...partial, transaction_sha256 };
}

/** Shared durable history for manual, Codex, and Magic Wand draft mutations. */
export class DraftTransactionStore {
  private readonly root: string;
  private readonly projects: ProjectReader;
  private readonly dependencies: DraftTransactionDependencies;

  constructor(
    rootAbsolute: string,
    projects: ProjectReader,
    dependencies: Partial<DraftTransactionDependencies> = {},
  ) {
    if (!isAbsolute(rootAbsolute)) fail("invalid");
    this.root = resolve(rootAbsolute);
    this.projects = projects;
    this.dependencies = {
      now: () => new Date().toISOString(),
      id: () => randomUUID(),
      ...dependencies,
    };
  }

  private async load(projectId: string): Promise<LoadedDraft> {
    let baseline: InitialProjectSnapshot;
    try {
      baseline = await this.projects.readForDraftTransaction(projectId);
    } catch {
      fail();
    }
    const folder = join(this.root, projectId);
    await safeDirectory(this.root);
    await safeDirectory(folder);
    if (
      !sameProjectStorePath(
        await realpath(folder),
        baseline.project.storage.project_root,
      )
    )
      fail();
    const draftFolder = join(folder, "draft"),
      journal = join(draftFolder, "journal"),
      checkpoints = join(draftFolder, "checkpoints");
    await mkdir(draftFolder, { recursive: true, mode: 0o700 });
    await safeDirectory(draftFolder);
    await mkdir(journal, { recursive: true, mode: 0o700 });
    await safeDirectory(journal);
    await mkdir(checkpoints, { recursive: true, mode: 0o700 });
    await safeDirectory(checkpoints);
    const metaPath = join(draftFolder, "meta.json");
    let meta: DraftMeta;
    try {
      meta = assertMeta(await readJson(metaPath), baseline);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
      const draftId = `draft-${this.dependencies.id()}`,
        createdAt = this.dependencies.now();
      if (!validId(draftId) || !validTimestamp(createdAt)) fail("invalid");
      meta = {
        schema_version: "1.0",
        project_id: baseline.project.project_id,
        draft_id: draftId,
        base_revision_id: baseline.revision.revision_id,
        baseline_timeline_sha256: timelineSha256(baseline.timeline),
        source_sha256: baseline.source.sha256,
        created_at: createdAt,
      };
      await writeNew(metaPath, meta);
    }
    const entries = await readdir(journal);
    if (entries.length > 100_000) fail();
    const committed: { sequence: number; id: string; path: string }[] = [];
    for (const entry of entries) {
      if (pendingPattern.test(entry)) {
        const info = await lstat(join(journal, entry));
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) fail();
        continue;
      }
      const match = committedPattern.exec(entry);
      if (!match) fail();
      const sequence = Number(match[1]);
      if (!Number.isSafeInteger(sequence) || sequence < 1) fail();
      committed.push({ sequence, id: match[2]!, path: join(journal, entry) });
    }
    committed.sort((left, right) => left.sequence - right.sequence);
    let state = initialDraftState(baseline, meta.draft_id);
    const records = new Map<string, DraftTransactionRecord>(),
      requests = new Map<string, DraftTransactionRecord>(),
      applied: DraftTransactionRecord[] = [],
      states = new Map<number, DraftState>([[0, cloneDraftState(state)]]),
      appliedIds = new Map<number, string[]>([[0, []]]);
    for (let index = 0; index < committed.length; index++) {
      const entry = committed[index]!;
      if (entry.sequence !== index + 1 || records.has(entry.id)) fail();
      const record = assertRecordEnvelope(await readJson(entry.path));
      if (
        record.transaction_id !== entry.id ||
        record.project_id !== projectId ||
        record.draft_id !== meta.draft_id ||
        record.base_revision_id !== meta.base_revision_id ||
        record.previous_transaction_sha256 !== state.head_transaction_sha256 ||
        record.transaction_sha256 !==
          draftRecordSha256(recordWithoutHash(record)) ||
        !same(record.before, state)
      )
        fail();
      assertDraftState(record.before, baseline);
      assertDraftState(record.after, baseline);
      if (
        record.after.draft_sequence !== entry.sequence ||
        record.after.head_transaction_sha256 !== record.transaction_sha256 ||
        requests.has(record.request_id)
      )
        fail();
      let replay: DraftTransactionRecord;
      if (record.kind === "apply") {
        if (!record.pass_group || record.target_transaction_id !== null) fail();
        const request: ApplyDraftTransactionRequest = {
          schema_version: "1.0",
          request_id: record.request_id,
          project_id: record.project_id,
          draft_id: record.draft_id,
          base_revision_id: record.base_revision_id,
          expected_sequence: record.before.draft_sequence,
          expected_timeline_sha256: record.before.timeline_sha256,
          pass_group: record.pass_group,
          reason: record.reason,
          operations: record.operations.map((operation) => ({
            type: "trim",
            clip_id: operation.clip_id,
            edge: operation.edge,
            timeline_position_us: operation.timeline_position_us,
          })),
        };
        assertApplyDraftTransactionRequest(request);
        replay = prepareApply(baseline, state, request, {
          origin: record.origin,
          transaction_id: record.transaction_id,
          operation_ids: record.operations.map(
            (operation) => operation.operation_id,
          ),
          created_at: record.created_at,
        });
        applied.push(record);
      } else {
        if (
          record.pass_group !== null ||
          record.operations.length ||
          !record.target_transaction_id ||
          applied.at(-1)?.transaction_id !== record.target_transaction_id
        )
          fail();
        const request: UndoDraftTransactionRequest = {
          schema_version: "1.0",
          request_id: record.request_id,
          project_id: record.project_id,
          draft_id: record.draft_id,
          base_revision_id: record.base_revision_id,
          expected_sequence: record.before.draft_sequence,
          expected_timeline_sha256: record.before.timeline_sha256,
          target_transaction_id: record.target_transaction_id,
          reason: record.reason,
        };
        assertUndoDraftTransactionRequest(request);
        replay = prepareUndo(
          baseline,
          state,
          request,
          {
            origin: record.origin,
            transaction_id: record.transaction_id,
            operation_ids: [],
            created_at: record.created_at,
          },
          applied.at(-1)!,
        );
        applied.pop();
      }
      if (!same(replay, record)) fail();
      state = cloneDraftState(record.after);
      records.set(record.transaction_id, record);
      requests.set(record.request_id, record);
      states.set(entry.sequence, cloneDraftState(state));
      appliedIds.set(
        entry.sequence,
        applied.map((transaction) => transaction.transaction_id),
      );
    }
    const checkpointEntries = await readdir(checkpoints);
    if (checkpointEntries.length > 100_000) fail();
    const checkpointFiles: { sequence: number; id: string; path: string }[] =
      [];
    for (const entry of checkpointEntries) {
      if (pendingPattern.test(entry)) {
        const info = await lstat(join(checkpoints, entry));
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) fail();
        continue;
      }
      const match = committedPattern.exec(entry);
      if (!match) fail();
      const sequence = Number(match[1]);
      if (!Number.isSafeInteger(sequence) || sequence < 1) fail();
      checkpointFiles.push({
        sequence,
        id: match[2]!,
        path: join(checkpoints, entry),
      });
    }
    checkpointFiles.sort((left, right) => left.sequence - right.sequence);
    const checkpointRequests = new Map<string, PassCheckpointRecord>(),
      checkpointIds = new Set<string>(),
      checkpointSequences = new Set<number>();
    let currentCheckpoint: PassCheckpointRecord | null = null;
    for (const entry of checkpointFiles) {
      const checkpoint = assertCheckpointEnvelope(await readJson(entry.path)),
        checkpointState = states.get(entry.sequence),
        activeIds = appliedIds.get(entry.sequence);
      if (
        !checkpointState ||
        !activeIds ||
        checkpoint.checkpoint_id !== entry.id ||
        checkpoint.project_id !== projectId ||
        checkpoint.draft_id !== meta.draft_id ||
        checkpoint.base_revision_id !== meta.base_revision_id ||
        checkpoint.draft_sequence !== entry.sequence ||
        checkpoint.timeline_sha256 !== checkpointState.timeline_sha256 ||
        checkpoint.head_transaction_sha256 !==
          checkpointState.head_transaction_sha256 ||
        checkpoint.request_sha256 !==
          passCheckpointRequestSha256(
            checkpointRequestFromRecord(checkpoint),
          ) ||
        checkpoint.checkpoint_sha256 !==
          passCheckpointRecordSha256(checkpointWithoutHash(checkpoint)) ||
        checkpointIds.has(checkpoint.checkpoint_id) ||
        checkpointSequences.has(entry.sequence) ||
        checkpointRequests.has(checkpoint.request_id)
      )
        fail();
      const groupIds = activeIds.filter((transactionId) => {
        const transaction = records.get(transactionId);
        return (
          transaction?.pass_group?.pass_group_id ===
            checkpoint.pass_group.pass_group_id &&
          transaction.pass_group.kind === checkpoint.pass_group.kind
        );
      });
      const newest = records.get(activeIds.at(-1) ?? "");
      if (
        !same(groupIds, checkpoint.verified_transaction_ids) ||
        newest?.pass_group?.pass_group_id !==
          checkpoint.pass_group.pass_group_id ||
        newest.pass_group.kind !== checkpoint.pass_group.kind
      )
        fail();
      checkpointIds.add(checkpoint.checkpoint_id);
      checkpointSequences.add(entry.sequence);
      checkpointRequests.set(checkpoint.request_id, checkpoint);
      if (entry.sequence === state.draft_sequence)
        currentCheckpoint = checkpoint;
    }
    return {
      baseline,
      state,
      records,
      requests,
      applied,
      journal,
      checkpointRequests,
      currentCheckpoint,
      checkpoints,
    };
  }

  private serialize<T>(projectId: string, work: () => Promise<T>): Promise<T> {
    if (!validId(projectId))
      return Promise.reject(new DraftTransactionError("invalid"));
    return serializeProjectStore(this.root, work).catch((error: unknown) => {
      if (error instanceof DraftTransactionError) throw error;
      fail("storage");
    });
  }

  snapshot(projectId: string): Promise<DraftReadResult> {
    return this.serialize(projectId, async () => {
      const loaded = await this.load(projectId);
      return {
        draft: cloneDraftState(loaded.state),
        undo_transaction_id: loaded.applied.at(-1)?.transaction_id ?? null,
        current_pass_checkpoint: loaded.currentCheckpoint
          ? structuredClone(loaded.currentCheckpoint)
          : null,
      };
    });
  }

  applyManual(value: unknown): Promise<DraftCommitResult> {
    return this.applyAs("manual", value);
  }

  applyCodex(value: unknown): Promise<DraftCommitResult> {
    return this.applyAs("codex", value);
  }

  applyMagicWand(value: unknown): Promise<DraftCommitResult> {
    return this.applyAs("magic_wand", value);
  }

  private applyAs(
    origin: DraftOrigin,
    value: unknown,
  ): Promise<DraftCommitResult> {
    try {
      assertApplyDraftTransactionRequest(value);
    } catch {
      fail("invalid");
    }
    const request = structuredClone(value);
    return this.serialize(request.project_id, async () => {
      const loaded = await this.load(request.project_id),
        requestHash = draftRequestSha256(request, origin),
        previous = loaded.requests.get(request.request_id);
      if (loaded.checkpointRequests.has(request.request_id)) fail("conflict");
      if (previous) {
        if (previous.request_sha256 !== requestHash) fail("conflict");
        return {
          draft: cloneDraftState(loaded.state),
          undo_transaction_id: loaded.applied.at(-1)?.transaction_id ?? null,
          current_pass_checkpoint: loaded.currentCheckpoint
            ? structuredClone(loaded.currentCheckpoint)
            : null,
          transaction: structuredClone(previous),
          replayed: true,
        };
      }
      ensureFresh(request, loaded.state);
      if (loaded.state.draft_sequence >= sequenceLimit) fail("conflict");
      const transactionId = this.dependencies.id(),
        operationIds = request.operations.map(() => this.dependencies.id()),
        createdAt = this.dependencies.now();
      if (
        !validId(transactionId) ||
        operationIds.some((id) => !validId(id)) ||
        !validTimestamp(createdAt) ||
        loaded.records.has(transactionId)
      )
        fail("invalid");
      const transaction = prepareApply(loaded.baseline, loaded.state, request, {
        origin,
        transaction_id: transactionId,
        operation_ids: operationIds,
        created_at: createdAt,
      });
      await this.commit(loaded.journal, transaction);
      return {
        draft: cloneDraftState(transaction.after),
        undo_transaction_id: transaction.transaction_id,
        current_pass_checkpoint: null,
        transaction: structuredClone(transaction),
        replayed: false,
      };
    });
  }

  recordPassCheckpoint(value: unknown): Promise<PassCheckpointCommitResult> {
    try {
      assertPassCheckpointRequest(value);
    } catch {
      fail("invalid");
    }
    const request = structuredClone(value);
    return this.serialize(request.project_id, async () => {
      const loaded = await this.load(request.project_id),
        requestHash = passCheckpointRequestSha256(request),
        previous = loaded.checkpointRequests.get(request.request_id);
      if (loaded.requests.has(request.request_id)) fail("conflict");
      if (previous) {
        if (previous.request_sha256 !== requestHash) fail("conflict");
        return {
          draft: cloneDraftState(loaded.state),
          undo_transaction_id: loaded.applied.at(-1)?.transaction_id ?? null,
          current_pass_checkpoint: loaded.currentCheckpoint
            ? structuredClone(loaded.currentCheckpoint)
            : null,
          checkpoint: structuredClone(previous),
          replayed: true,
        };
      }
      ensureFresh(request, loaded.state);
      const groupIds = loaded.applied
          .filter(
            (transaction) =>
              transaction.pass_group?.pass_group_id ===
                request.pass_group.pass_group_id &&
              transaction.pass_group.kind === request.pass_group.kind,
          )
          .map((transaction) => transaction.transaction_id),
        newest = loaded.applied.at(-1);
      if (
        !same(groupIds, request.verified_transaction_ids) ||
        newest?.pass_group?.pass_group_id !==
          request.pass_group.pass_group_id ||
        newest.pass_group.kind !== request.pass_group.kind ||
        !loaded.state.head_transaction_sha256
      )
        fail("conflict");
      const checkpointId = this.dependencies.id(),
        createdAt = this.dependencies.now();
      if (
        !validId(checkpointId) ||
        !validTimestamp(createdAt) ||
        loaded.records.has(checkpointId) ||
        [...loaded.checkpointRequests.values()].some(
          (checkpoint) => checkpoint.checkpoint_id === checkpointId,
        )
      )
        fail("invalid");
      const partial: Omit<PassCheckpointRecord, "checkpoint_sha256"> = {
          schema_version: "1.0",
          checkpoint_id: checkpointId,
          request_id: request.request_id,
          request_sha256: requestHash,
          project_id: loaded.state.project_id,
          draft_id: loaded.state.draft_id,
          base_revision_id: loaded.state.base_revision_id,
          draft_sequence: loaded.state.draft_sequence,
          timeline_sha256: loaded.state.timeline_sha256,
          head_transaction_sha256: loaded.state.head_transaction_sha256,
          pass_group: structuredClone(request.pass_group),
          verified_transaction_ids: [...request.verified_transaction_ids],
          summary: request.summary,
          checks: structuredClone(request.checks),
          created_at: createdAt,
          status: "verified",
        },
        checkpoint: PassCheckpointRecord = {
          ...partial,
          checkpoint_sha256: passCheckpointRecordSha256(partial),
        };
      await this.commitCheckpoint(loaded.checkpoints, checkpoint);
      return {
        draft: cloneDraftState(loaded.state),
        undo_transaction_id: loaded.applied.at(-1)?.transaction_id ?? null,
        current_pass_checkpoint: structuredClone(checkpoint),
        checkpoint: structuredClone(checkpoint),
        replayed: false,
      };
    });
  }

  undoManual(value: unknown): Promise<DraftCommitResult> {
    return this.undoAs("manual", value);
  }

  undoCodex(value: unknown): Promise<DraftCommitResult> {
    return this.undoAs("codex", value);
  }

  undoMagicWand(value: unknown): Promise<DraftCommitResult> {
    return this.undoAs("magic_wand", value);
  }

  private undoAs(
    origin: DraftOrigin,
    value: unknown,
  ): Promise<DraftCommitResult> {
    try {
      assertUndoDraftTransactionRequest(value);
    } catch {
      fail("invalid");
    }
    const request = structuredClone(value);
    return this.serialize(request.project_id, async () => {
      const loaded = await this.load(request.project_id),
        requestHash = draftRequestSha256(request, origin),
        previous = loaded.requests.get(request.request_id);
      if (loaded.checkpointRequests.has(request.request_id)) fail("conflict");
      if (previous) {
        if (previous.request_sha256 !== requestHash) fail("conflict");
        return {
          draft: cloneDraftState(loaded.state),
          undo_transaction_id: loaded.applied.at(-1)?.transaction_id ?? null,
          current_pass_checkpoint: loaded.currentCheckpoint
            ? structuredClone(loaded.currentCheckpoint)
            : null,
          transaction: structuredClone(previous),
          replayed: true,
        };
      }
      ensureFresh(request, loaded.state);
      if (loaded.state.draft_sequence >= sequenceLimit) fail("conflict");
      const target = loaded.applied.at(-1);
      if (!target || target.transaction_id !== request.target_transaction_id)
        fail("conflict");
      const transactionId = this.dependencies.id(),
        createdAt = this.dependencies.now();
      if (
        !validId(transactionId) ||
        !validTimestamp(createdAt) ||
        loaded.records.has(transactionId)
      )
        fail("invalid");
      const transaction = prepareUndo(
        loaded.baseline,
        loaded.state,
        request,
        {
          origin,
          transaction_id: transactionId,
          operation_ids: [],
          created_at: createdAt,
        },
        target,
      );
      await this.commit(loaded.journal, transaction);
      return {
        draft: cloneDraftState(transaction.after),
        undo_transaction_id: loaded.applied.at(-2)?.transaction_id ?? null,
        current_pass_checkpoint: null,
        transaction: structuredClone(transaction),
        replayed: false,
      };
    });
  }

  private async commit(
    journal: string,
    transaction: DraftTransactionRecord,
  ): Promise<void> {
    const pending = join(
        journal,
        `.pending-${transaction.transaction_id}.json`,
      ),
      committed = join(
        journal,
        `${String(transaction.after.draft_sequence).padStart(12, "0")}.${transaction.transaction_id}.json`,
      );
    await writeNew(pending, transaction);
    try {
      await this.dependencies.afterPendingWrite?.();
    } catch {
      fail("storage");
    }
    await safeDirectory(journal);
    await rename(pending, committed);
    try {
      await this.dependencies.afterJournalCommit?.();
    } catch {
      fail("outcome_unknown");
    }
  }

  private async commitCheckpoint(
    checkpoints: string,
    checkpoint: PassCheckpointRecord,
  ): Promise<void> {
    const pending = join(
        checkpoints,
        `.pending-${checkpoint.checkpoint_id}.json`,
      ),
      committed = join(
        checkpoints,
        `${String(checkpoint.draft_sequence).padStart(12, "0")}.${checkpoint.checkpoint_id}.json`,
      );
    await writeNew(pending, checkpoint);
    try {
      await this.dependencies.afterCheckpointPendingWrite?.();
    } catch {
      fail("storage");
    }
    await safeDirectory(checkpoints);
    await rename(pending, committed);
    try {
      await this.dependencies.afterCheckpointCommit?.();
    } catch {
      fail("outcome_unknown");
    }
  }
}
