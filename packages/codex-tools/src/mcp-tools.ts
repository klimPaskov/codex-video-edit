import { codexVideoEditToolNames } from "./service.ts";

const id = { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$" };
const hash = { type: "string", pattern: "^[a-f0-9]{64}$" };
const prose = { type: "string", minLength: 1, maxLength: 1000 };
const freshness = {
  schema_version: { const: "1.0" },
  request_id: id,
  project_id: id,
  draft_id: id,
  base_revision_id: id,
  expected_sequence: { type: "integer", minimum: 0 },
  expected_timeline_sha256: hash,
  reason: prose,
};

export const codexVideoEditMcpTools = [
  {
    name: codexVideoEditToolNames[0],
    description:
      "Read compact metadata for the active video project and draft.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["schema_version", "project_id"],
      properties: {
        schema_version: { const: "1.0" },
        project_id: id,
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: codexVideoEditToolNames[1],
    description:
      "Read the active draft timeline, exact freshness values, and newest undo target.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["schema_version", "project_id"],
      properties: {
        schema_version: { const: "1.0" },
        project_id: id,
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: codexVideoEditToolNames[2],
    description:
      "Move one edge of the active draft's current clip and commit one undoable transaction.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        ...Object.keys(freshness),
        "pass_group_id",
        "clip_id",
        "edge",
        "timeline_position_us",
      ],
      properties: {
        ...freshness,
        pass_group_id: id,
        clip_id: id,
        edge: { enum: ["start", "end"] },
        timeline_position_us: { type: "integer", minimum: 1 },
      },
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: codexVideoEditToolNames[3],
    description:
      "Undo only the newest applied draft transaction after exact freshness validation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [...Object.keys(freshness), "target_transaction_id"],
      properties: {
        ...freshness,
        target_transaction_id: id,
      },
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
] as const;
