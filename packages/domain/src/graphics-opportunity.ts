export interface GraphicsTimelineContext {
  project_id: string;
  timeline_id: string;
  timeline_sha256: string;
  draft_sequence: number;
  duration_us: number;
  frame_rate: { numerator: number; denominator: number };
}
type Margins = { top: number; right: number; bottom: number; left: number };
export interface GraphicsOpportunity {
  schema_version: "1.0";
  kind: "graphics_suggestion";
  authorization: "suggestion_only";
  opportunity_id: string;
  project_id: string;
  timeline_id: string;
  timeline_sha256: string;
  draft_sequence: number;
  start_us: number;
  end_us: number;
  concept: string;
  rationale: string;
  grounding_policy: "use_referenced_evidence_only";
  grounding_refs: {
    id: string;
    kind: "transcript" | "frame" | "approved_branding" | "project_note";
    evidence_id: string;
    excerpt: string;
  }[];
  unresolved_facts: string[];
  prompt: {
    asset_format: { width: 1920; height: 1080 };
    duration_us: number;
    frame_rate: { numerator: number; denominator: number };
    audio: false;
    visual_concept: string;
    reveal_order: string[];
    exact_onscreen_words: string[];
    style: string;
    motion: string;
    title_safe_margins: Margins;
    action_safe_margins: Margins;
    transparency: boolean;
  };
}
const token = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/u;
function invalid(): never {
  throw new Error(
    "Invalid or stale graphics suggestion. Recheck the committed timeline and evidence.",
  );
}
function exact(
  value: unknown,
  keys: string[],
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
function integer(value: unknown, min = 0): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min)
    invalid();
}
function id(value: unknown): void {
  if (typeof value !== "string" || !token.test(value)) invalid();
}
function prose(value: unknown): void {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 2000 ||
    /[\x00-\x1f]/u.test(value)
  )
    invalid();
}
function strings(value: unknown, minimum: number): void {
  if (!Array.isArray(value) || value.length < minimum || value.length > 64)
    invalid();
  for (const item of value) prose(item);
}
function rational(
  value: unknown,
): asserts value is GraphicsTimelineContext["frame_rate"] {
  exact(value, ["numerator", "denominator"]);
  integer(value.numerator, 1);
  integer(value.denominator, 1);
}
function margins(value: unknown): asserts value is Margins {
  exact(value, ["top", "right", "bottom", "left"]);
  for (const side of ["top", "right", "bottom", "left"]) {
    const n = value[side];
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n >= 0.5)
      invalid();
  }
}
/** Structure/freshness only: does not prove factual grounding or privacy of freeform wording. */
export function assertGraphicsOpportunity(
  value: unknown,
  active: GraphicsTimelineContext,
): asserts value is GraphicsOpportunity {
  exact(active, [
    "project_id",
    "timeline_id",
    "timeline_sha256",
    "draft_sequence",
    "duration_us",
    "frame_rate",
  ]);
  id(active.project_id);
  id(active.timeline_id);
  integer(active.draft_sequence);
  integer(active.duration_us, 1);
  rational(active.frame_rate);
  if (
    typeof active.timeline_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(active.timeline_sha256)
  )
    invalid();
  exact(value, [
    "schema_version",
    "kind",
    "authorization",
    "opportunity_id",
    "project_id",
    "timeline_id",
    "timeline_sha256",
    "draft_sequence",
    "start_us",
    "end_us",
    "concept",
    "rationale",
    "grounding_policy",
    "grounding_refs",
    "unresolved_facts",
    "prompt",
  ]);
  if (
    value.schema_version !== "1.0" ||
    value.kind !== "graphics_suggestion" ||
    value.authorization !== "suggestion_only" ||
    value.grounding_policy !== "use_referenced_evidence_only"
  )
    invalid();
  id(value.opportunity_id);
  id(value.project_id);
  id(value.timeline_id);
  integer(value.draft_sequence);
  if (
    value.project_id !== active.project_id ||
    value.timeline_id !== active.timeline_id ||
    value.timeline_sha256 !== active.timeline_sha256 ||
    value.draft_sequence !== active.draft_sequence
  )
    invalid();
  integer(value.start_us);
  integer(value.end_us, 1);
  if (value.start_us >= value.end_us || value.end_us > active.duration_us)
    invalid();
  prose(value.concept);
  prose(value.rationale);
  strings(value.unresolved_facts, 0);
  if (
    !Array.isArray(value.grounding_refs) ||
    !value.grounding_refs.length ||
    value.grounding_refs.length > 64
  )
    invalid();
  const referenceIds = new Set<string>();
  for (const ref of value.grounding_refs) {
    exact(ref, ["id", "kind", "evidence_id", "excerpt"]);
    id(ref.id);
    id(ref.evidence_id);
    prose(ref.excerpt);
    if (
      !["transcript", "frame", "approved_branding", "project_note"].includes(
        ref.kind as string,
      ) ||
      referenceIds.has(ref.id as string)
    )
      invalid();
    referenceIds.add(ref.id as string);
  }
  const prompt = value.prompt;
  exact(prompt, [
    "asset_format",
    "duration_us",
    "frame_rate",
    "audio",
    "visual_concept",
    "reveal_order",
    "exact_onscreen_words",
    "style",
    "motion",
    "title_safe_margins",
    "action_safe_margins",
    "transparency",
  ]);
  exact(prompt.asset_format, ["width", "height"]);
  if (
    prompt.asset_format.width !== 1920 ||
    prompt.asset_format.height !== 1080 ||
    prompt.audio !== false ||
    typeof prompt.transparency !== "boolean"
  )
    invalid();
  integer(prompt.duration_us, 1);
  if (prompt.duration_us !== value.end_us - value.start_us) invalid();
  rational(prompt.frame_rate);
  if (
    BigInt(prompt.frame_rate.numerator) *
      BigInt(active.frame_rate.denominator) !==
    BigInt(active.frame_rate.numerator) * BigInt(prompt.frame_rate.denominator)
  )
    invalid();
  prose(prompt.visual_concept);
  prose(prompt.style);
  prose(prompt.motion);
  strings(prompt.reveal_order, 1);
  strings(prompt.exact_onscreen_words, 0);
  margins(prompt.title_safe_margins);
  margins(prompt.action_safe_margins);
  for (const side of ["top", "right", "bottom", "left"] as const)
    if (prompt.title_safe_margins[side] < prompt.action_safe_margins[side])
      invalid();
}
export function validateGraphicsOpportunity(
  value: unknown,
  active: GraphicsTimelineContext,
): GraphicsOpportunity {
  assertGraphicsOpportunity(value, active);
  return structuredClone(value);
}
