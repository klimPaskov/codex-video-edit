import type { InitialProjectSnapshot } from "../../domain/src/project.ts";
import {
  DraftTransactionError,
  type DraftCommitResult,
  type DraftReadResult,
} from "../../project-store/src/transactions.ts";

export const codexVideoEditToolNames = [
  "project.get_summary",
  "timeline.get_summary",
  "cut.trim_edge",
  "timeline.undo",
] as const;

export type CodexVideoEditToolName = (typeof codexVideoEditToolNames)[number];

type ProjectReader = {
  open(projectId: string): Promise<InitialProjectSnapshot>;
};

type DraftTransactions = {
  snapshot(projectId: string): Promise<DraftReadResult>;
  applyCodex(value: unknown): Promise<DraftCommitResult>;
  undoCodex(value: unknown): Promise<DraftCommitResult>;
};

export type CodexVideoEditToolErrorCode =
  | "tool_not_available"
  | "invalid_request"
  | "inactive_project"
  | "stale_draft"
  | "edit_conflict"
  | "storage_unavailable"
  | "outcome_unknown"
  | "service_unavailable";

const messages: Record<CodexVideoEditToolErrorCode, string> = {
  tool_not_available: "That editing tool is not available.",
  invalid_request:
    "The edit request is invalid. Refresh the project and try again.",
  inactive_project: "That project is not the active project.",
  stale_draft:
    "The draft changed before this edit could be applied. Refresh and try again.",
  edit_conflict:
    "This edit conflicts with newer draft work. Refresh the project and try again.",
  storage_unavailable:
    "The draft could not be read or saved. Reopen the project and try again.",
  outcome_unknown:
    "The edit may have been saved. Reopen the project before retrying.",
  service_unavailable:
    "The editing service is unavailable. Reopen the project and try again.",
};

export class CodexVideoEditToolError extends Error {
  readonly code: CodexVideoEditToolErrorCode;

  constructor(code: CodexVideoEditToolErrorCode) {
    super(messages[code]);
    this.name = "CodexVideoEditToolError";
    this.code = code;
  }
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/u;
const hashPattern = /^[a-f0-9]{64}$/u;

function reject(code: CodexVideoEditToolErrorCode): never {
  throw new CodexVideoEditToolError(code);
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
    Object.getOwnPropertySymbols(value).length !== 0 ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    reject("invalid_request");
  return value as Record<string, unknown>;
}

function id(value: unknown): asserts value is string {
  if (typeof value !== "string" || !idPattern.test(value))
    reject("invalid_request");
}

function hash(value: unknown): asserts value is string {
  if (typeof value !== "string" || !hashPattern.test(value))
    reject("invalid_request");
}

function integer(value: unknown, minimum = 0): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    reject("invalid_request");
}

function prose(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 1000 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    reject("invalid_request");
}

function assertActiveProject(
  value: Record<string, unknown>,
  activeProjectId: string,
): asserts value is Record<string, unknown> & { project_id: string } {
  id(value.project_id);
  if (value.project_id !== activeProjectId) reject("inactive_project");
}

function readRequest(value: unknown, activeProjectId: string): string {
  const request = exact(value, ["schema_version", "project_id"]);
  if (request.schema_version !== "1.0") reject("invalid_request");
  assertActiveProject(request, activeProjectId);
  return request.project_id;
}

function freshness(
  request: Record<string, unknown>,
  activeProjectId: string,
): void {
  if (request.schema_version !== "1.0") reject("invalid_request");
  assertActiveProject(request, activeProjectId);
  id(request.request_id);
  id(request.draft_id);
  id(request.base_revision_id);
  integer(request.expected_sequence);
  hash(request.expected_timeline_sha256);
  prose(request.reason);
}

function safeDraft(draft: DraftReadResult["draft"], undoId: string | null) {
  return {
    schema_version: "1.0" as const,
    project_id: draft.project_id,
    draft_id: draft.draft_id,
    base_revision_id: draft.base_revision_id,
    draft_sequence: draft.draft_sequence,
    timeline_sha256: draft.timeline_sha256,
    duration_us: draft.timeline.duration_us,
    frame_rate: structuredClone(draft.timeline.frame_rate),
    canvas: structuredClone(draft.timeline.canvas),
    tracks: draft.timeline.tracks.map((track) => ({
      track_id: track.track_id,
      kind: track.kind,
      order: track.order,
      visible: track.visible,
      locked: track.locked,
    })),
    clips: draft.timeline.clips.map((clip) => ({
      clip_id: clip.clip_id,
      track_id: clip.track_id,
      source_id: clip.source_id,
      source_start_us: clip.source_start_us,
      source_end_us: clip.source_end_us,
      timeline_start_us: clip.timeline_start_us,
      timeline_end_us: clip.timeline_end_us,
      enabled: clip.enabled,
    })),
    operation_ids: [...draft.timeline.operation_ids],
    zoom_ids: [...draft.timeline.zoom_ids],
    speed_ids: [...draft.timeline.speed_ids],
    undo_transaction_id: undoId,
  };
}

function safeMutation(result: DraftCommitResult, summary: string) {
  return {
    status: "committed" as const,
    replayed: result.replayed,
    transaction_id: result.transaction.transaction_id,
    applied_operation_ids: result.transaction.operations.map(
      (operation) => operation.operation_id,
    ),
    draft: safeDraft(result.draft, result.undo_transaction_id),
    summary,
    warnings: [] as string[],
    undo_token: result.undo_transaction_id,
  };
}

function mapError(error: unknown): never {
  if (error instanceof CodexVideoEditToolError) throw error;
  if (error instanceof DraftTransactionError) {
    const mapped: Record<
      DraftTransactionError["code"],
      CodexVideoEditToolErrorCode
    > = {
      invalid: "invalid_request",
      stale: "stale_draft",
      conflict: "edit_conflict",
      storage: "storage_unavailable",
      outcome_unknown: "outcome_unknown",
    };
    reject(mapped[error.code]);
  }
  reject("service_unavailable");
}

/**
 * Main creates one instance for the currently active project and replaces it when
 * project focus changes. Tool input can assert that scope but cannot choose it.
 */
export class CodexVideoEditToolService {
  private readonly activeProjectId: string;
  private readonly projects: ProjectReader;
  private readonly drafts: DraftTransactions;

  constructor(
    activeProjectId: string,
    projects: ProjectReader,
    drafts: DraftTransactions,
  ) {
    if (!idPattern.test(activeProjectId)) reject("invalid_request");
    this.activeProjectId = activeProjectId;
    this.projects = projects;
    this.drafts = drafts;
  }

  async invoke(name: unknown, input: unknown): Promise<unknown> {
    try {
      if (typeof name !== "string") reject("tool_not_available");
      switch (name) {
        case "project.get_summary":
          return await this.projectSummary(input);
        case "timeline.get_summary":
          return await this.timelineSummary(input);
        case "cut.trim_edge":
          return await this.trimEdge(input);
        case "timeline.undo":
          return await this.undo(input);
        default:
          reject("tool_not_available");
      }
    } catch (error) {
      mapError(error);
    }
  }

  private async projectSummary(input: unknown): Promise<unknown> {
    const projectId = readRequest(input, this.activeProjectId);
    const [project, draft] = await Promise.all([
      this.projects.open(projectId),
      this.drafts.snapshot(projectId),
    ]);
    if (
      project.project.project_id !== this.activeProjectId ||
      draft.draft.project_id !== this.activeProjectId ||
      draft.draft.base_revision_id !== project.revision.revision_id
    )
      reject("service_unavailable");
    return {
      schema_version: "1.0",
      project_id: project.project.project_id,
      name: project.project.name,
      workflow_step: project.project.workflow_step,
      current_revision_id: project.project.current_revision_id,
      duration_us: draft.draft.timeline.duration_us,
      qa_status: project.revision.qa_status,
      sources: [
        {
          source_id: project.source.source_id,
          role: "main_video",
          kind: project.source.kind,
          duration_us: project.source.duration_us,
          immutable: project.source.immutable,
          stream_types: [
            ...new Set(
              project.source.streams.map((stream) => stream.media_type),
            ),
          ],
        },
      ],
      active_draft: {
        draft_id: draft.draft.draft_id,
        base_revision_id: draft.draft.base_revision_id,
        draft_sequence: draft.draft.draft_sequence,
        timeline_sha256: draft.draft.timeline_sha256,
        undo_transaction_id: draft.undo_transaction_id,
      },
    };
  }

  private async timelineSummary(input: unknown): Promise<unknown> {
    const projectId = readRequest(input, this.activeProjectId);
    const snapshot = await this.drafts.snapshot(projectId);
    return safeDraft(snapshot.draft, snapshot.undo_transaction_id);
  }

  private async trimEdge(input: unknown): Promise<unknown> {
    const request = exact(input, [
      "schema_version",
      "request_id",
      "project_id",
      "draft_id",
      "base_revision_id",
      "expected_sequence",
      "expected_timeline_sha256",
      "pass_group_id",
      "reason",
      "clip_id",
      "edge",
      "timeline_position_us",
    ]);
    freshness(request, this.activeProjectId);
    id(request.pass_group_id);
    id(request.clip_id);
    integer(request.timeline_position_us, 1);
    if (request.edge !== "start" && request.edge !== "end")
      reject("invalid_request");
    const result = await this.drafts.applyCodex({
      schema_version: "1.0",
      request_id: request.request_id,
      project_id: request.project_id,
      draft_id: request.draft_id,
      base_revision_id: request.base_revision_id,
      expected_sequence: request.expected_sequence,
      expected_timeline_sha256: request.expected_timeline_sha256,
      pass_group: {
        pass_group_id: request.pass_group_id,
        kind: "spoken_cut",
      },
      reason: request.reason,
      operations: [
        {
          type: "trim",
          clip_id: request.clip_id,
          edge: request.edge,
          timeline_position_us: request.timeline_position_us,
        },
      ],
    });
    return safeMutation(result, "Trim applied to the active draft.");
  }

  private async undo(input: unknown): Promise<unknown> {
    const request = exact(input, [
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
    freshness(request, this.activeProjectId);
    id(request.target_transaction_id);
    const result = await this.drafts.undoCodex({
      schema_version: "1.0",
      request_id: request.request_id,
      project_id: request.project_id,
      draft_id: request.draft_id,
      base_revision_id: request.base_revision_id,
      expected_sequence: request.expected_sequence,
      expected_timeline_sha256: request.expected_timeline_sha256,
      target_transaction_id: request.target_transaction_id,
      reason: request.reason,
    });
    return safeMutation(result, "Newest draft transaction undone.");
  }
}
