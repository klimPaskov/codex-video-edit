import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertGraphicsOpportunity,
  validateGraphicsOpportunity,
} from "../../packages/domain/src/graphics-opportunity.ts";
import type {
  GraphicsOpportunity,
  GraphicsTimelineContext,
} from "../../packages/domain/src/graphics-opportunity.ts";

function example(): GraphicsOpportunity {
  return JSON.parse(
    readFileSync("examples/graphics_opportunity.example.json", "utf8"),
  ) as GraphicsOpportunity;
}
function context(): GraphicsTimelineContext {
  return {
    project_id: "project-synthetic",
    timeline_id: "timeline-synthetic",
    timeline_sha256: "a".repeat(64),
    draft_sequence: 7,
    duration_us: 10_000_000,
    frame_rate: { numerator: 30000, denominator: 1001 },
  };
}
test("complete suggestion validates without changing timeline context or authorizing an asset", () => {
  const active = context(),
    before = structuredClone(active),
    suggestion = example();
  const result = validateGraphicsOpportunity(suggestion, active);
  assert.deepEqual(result, suggestion);
  assert.notEqual(result, suggestion);
  assert.deepEqual(active, before);
  assert.equal(result.authorization, "suggestion_only");
  assert.equal(result.prompt.audio, false);
  assert.equal(result.prompt.asset_format.width, 1920);
  result.prompt.exact_onscreen_words.push("Changed detached result");
  assert.equal(suggestion.prompt.exact_onscreen_words.length, 2);
  // On-screen tutorial wording may itself contain paths or URLs; this is not filesystem authority.
  suggestion.prompt.exact_onscreen_words = [
    "Open /example/path",
    "https://example.org/help",
  ];
  assertGraphicsOpportunity(suggestion, active);
});
test("structural cuts invalidate suggestions by identity, hash, sequence and time mapping", () => {
  for (const change of [
    { project_id: "other-project" },
    { timeline_id: "other-timeline" },
    { timeline_sha256: "b".repeat(64) },
    { draft_sequence: 8 },
    { duration_us: 5_000_000 },
    { frame_rate: { numerator: 25, denominator: 1 } },
  ])
    assert.throws(() =>
      assertGraphicsOpportunity(example(), { ...context(), ...change }),
    );
  const remapped = example();
  remapped.start_us = 1_000_000;
  remapped.end_us = 5_000_000;
  assert.throws(() =>
    assertGraphicsOpportunity(remapped, { ...context(), draft_sequence: 8 }),
  );
  remapped.draft_sequence = 8;
  remapped.timeline_sha256 = "b".repeat(64);
  assertGraphicsOpportunity(remapped, {
    ...context(),
    draft_sequence: 8,
    timeline_sha256: "b".repeat(64),
  });
});

test("sparse text arrays cannot bypass required prose validation", () => {
  for (const key of [
    "reveal_order",
    "exact_onscreen_words",
    "unresolved_facts",
  ]) {
    const value = example();
    const sparse: string[] = new Array<string>(1);
    if (key === "unresolved_facts") value.unresolved_facts = sparse;
    else if (key === "reveal_order") value.prompt.reveal_order = sparse;
    else value.prompt.exact_onscreen_words = sparse;
    assert.throws(() => assertGraphicsOpportunity(value, context()));
    assert.throws(() => validateGraphicsOpportunity(value, context()));
  }
});

test("all identities use the canonical minimum length and dotted identifier grammar", () => {
  const value = example();
  value.opportunity_id = "opportunity.v1";
  value.project_id = "project.v1";
  value.timeline_id = "timeline.v1";
  value.grounding_refs[0]!.id = "grounding.v1";
  value.grounding_refs[0]!.evidence_id = "transcript.v1";
  const active = {
    ...context(),
    project_id: value.project_id,
    timeline_id: value.timeline_id,
  };
  assertGraphicsOpportunity(value, active);
  for (const key of ["opportunity_id", "project_id", "timeline_id"] as const) {
    const bad = structuredClone(value);
    bad[key] = "x";
    assert.throws(() => assertGraphicsOpportunity(bad, active));
  }
  for (const key of ["id", "evidence_id"] as const) {
    const bad = structuredClone(value);
    bad.grounding_refs[0]![key] = "x";
    assert.throws(() => assertGraphicsOpportunity(bad, active));
  }
  assert.throws(() =>
    assertGraphicsOpportunity(
      { ...value, project_id: "x" },
      { ...active, project_id: "x" },
    ),
  );
  assert.throws(() =>
    assertGraphicsOpportunity(
      { ...value, timeline_id: "x" },
      { ...active, timeline_id: "x" },
    ),
  );
});
test("bounds, rational precision, safe margins and all prompt components are required", () => {
  const mutations: ((value: GraphicsOpportunity) => void)[] = [
    (value) => {
      value.start_us = -1;
    },
    (value) => {
      value.end_us = value.start_us;
    },
    (value) => {
      value.end_us = 11_000_000;
    },
    (value) => {
      value.start_us = 1.5;
    },
    (value) => {
      value.prompt.duration_us = 3;
    },
    (value) => {
      value.prompt.frame_rate.denominator = 0;
    },
    (value) => {
      value.prompt.frame_rate.numerator = NaN;
    },
    (value) => {
      value.prompt.frame_rate.denominator = Number.MAX_SAFE_INTEGER + 1;
    },
    (value) => {
      value.prompt.title_safe_margins.top = 0.01;
    },
    (value) => {
      value.prompt.action_safe_margins.left = 0.5;
    },
    (value) => {
      value.prompt.title_safe_margins.bottom = Infinity;
    },
    (value) => {
      value.prompt.reveal_order = [];
    },
    (value) => {
      value.grounding_refs = [];
    },
    (value) => {
      value.grounding_refs.push(value.grounding_refs[0]!);
    },
    (value) => {
      value.rationale = " ";
    },
  ];
  for (const mutate of mutations) {
    const value = example();
    mutate(value);
    assert.throws(() => assertGraphicsOpportunity(value, context()));
  }
  for (const key of Object.keys(example().prompt)) {
    const value = example();
    delete (value.prompt as unknown as Record<string, unknown>)[key];
    assert.throws(() => assertGraphicsOpportunity(value, context()));
  }
  const equivalent = example();
  equivalent.prompt.frame_rate = { numerator: 60000, denominator: 2002 };
  assertGraphicsOpportunity(equivalent, context());
});
test("record rejects asset execution, export, private path and source-format fields at every structural boundary", () => {
  for (const field of [
    "sourcePath",
    "outputPath",
    "asset_id",
    "operation",
    "create",
    "export",
    "master_format",
  ]) {
    for (const nested of [false, true]) {
      const value = example();
      const target = nested ? value.prompt : value;
      (target as unknown as Record<string, unknown>)[field] = "/private/file";
      assert.throws(() => assertGraphicsOpportunity(value, context()));
    }
  }
  const wrong = example() as unknown as Record<string, unknown>;
  wrong.authorization = "create_asset";
  assert.throws(() => assertGraphicsOpportunity(wrong, context()));
});
test("graphics schema and synthetic example validate, with strict structural rejection", () => {
  const result = spawnSync(
    "python",
    [
      "-c",
      [
        "import json",
        "from jsonschema import Draft202012Validator",
        "s=json.load(open('schemas/graphics_opportunity.schema.json'))",
        "v=json.load(open('examples/graphics_opportunity.example.json'))",
        "Draft202012Validator.check_schema(s)",
        "validator=Draft202012Validator(s)",
        "validator.validate(v)",
        "for key in ('opportunity_id','project_id','timeline_id'): v[key] += '.v1'",
        "v['grounding_refs'][0]['id'] += '.v1'",
        "v['grounding_refs'][0]['evidence_id'] += '.v1'",
        "validator.validate(v)",
        "for key in ('opportunity_id','project_id','timeline_id'):",
        "    bad={**v,key:'x'}; assert not validator.is_valid(bad)",
        "for key in ('id','evidence_id'):",
        "    bad={**v,'grounding_refs':[{**v['grounding_refs'][0],key:'x'}]}; assert not validator.is_valid(bad)",
        "v['outputPath']='/private/file'",
        "assert not validator.is_valid(v)",
      ].join("\n"),
    ],
    { encoding: "utf8", timeout: 30_000, windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
});
