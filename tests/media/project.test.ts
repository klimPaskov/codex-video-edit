import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  assertInitialProjectSnapshot,
  createInitialProject,
  projectCanonicalJson,
  projectStages,
  timelineSha256,
} from "../../packages/domain/src/project.ts";
import type {
  InitialProjectInput,
  InitialProjectSnapshot,
} from "../../packages/domain/src/project.ts";

function input(): InitialProjectInput {
  return {
    projectId: "project-fixture",
    timelineId: "timeline-fixture",
    revisionId: "revision-fixture",
    sourceId: "source-fixture",
    name: "Synthetic source",
    createdAt: "2026-09-06T10:00:00Z",
    projectRoot: "/synthetic/project",
    originalPath: "/synthetic/original.mkv",
    managedPath: "/synthetic/library/source.media",
    sha256: "a".repeat(64),
    sizeBytes: 12000,
    probe: {
      streams: [
        {
          index: 0,
          codec_type: "video",
          codec_name: "ffv1",
          width: 3840,
          height: 2160,
          avg_frame_rate: "60000/2002",
          duration: "1.001000",
          nb_frames: "30",
          pix_fmt: "gbrp16le",
          bits_per_raw_sample: "16",
          color_range: "pc",
          color_space: "gbr",
          color_primaries: "bt2020",
          color_transfer: "smpte2084",
          side_data_list: [
            {
              side_data_type: "Mastering display metadata",
              max_luminance: "1000/1",
            },
          ],
        },
        {
          index: 1,
          codec_type: "audio",
          codec_name: "pcm_f64le",
          sample_fmt: "dbl",
          sample_rate: "96000",
          channels: 6,
          channel_layout: "5.1",
          bits_per_sample: 64,
        },
      ],
      format: { duration: "1.001000", format_name: "matroska,webm" },
    },
  };
}
test("initial project creates actual consistent source/timeline/revision contracts without format conversion", () => {
  const original = input();
  const snapshot = createInitialProject(original);
  assertInitialProjectSnapshot(snapshot);
  assert.deepEqual(snapshot.timeline.frame_rate, {
    numerator: 30000,
    denominator: 1001,
  });
  assert.equal(snapshot.timeline.duration_us, 1001000);
  assert.deepEqual(snapshot.timeline.canvas, {
    width: 3840,
    height: 2160,
    aspect_ratio: "custom",
  });
  assert.equal(
    snapshot.revision.timeline_sha256,
    timelineSha256(snapshot.timeline),
  );
  assert.deepEqual(snapshot.source_probe, original.probe);
  assert.equal(snapshot.source.streams[1]?.sample_rate_hz, 96000);
  assert.equal(snapshot.source.streams[1]?.channels, 6);
  assert.deepEqual(snapshot.timeline.operation_ids, []);
  assert.equal(snapshot.revision.qa_status, "not_run");
  original.probe.format = { duration: "999" };
  assert.notDeepEqual(snapshot.source_probe, original.probe);
  // Existing published schemas remain authoritative; no fields were added to these records.
  const check = spawnSync(
    "python",
    [
      "-c",
      "import json,sys; from pathlib import Path; from jsonschema import Draft202012Validator; d=json.load(sys.stdin); [(Draft202012Validator(json.loads(Path('schemas/'+k+'.schema.json').read_text(encoding='utf-8'))).validate(d[k])) for k in ('project','source','timeline','revision')]",
    ],
    { input: JSON.stringify(snapshot), encoding: "utf8" },
  );
  assert.equal(check.status, 0, check.stderr);
});
test("persisted navigation preserves baseline hashes and allows only five actual stages", () => {
  const snapshot = createInitialProject(input());
  const hash = snapshot.revision.timeline_sha256;
  for (const stage of projectStages) {
    snapshot.project.workflow_step = stage;
    snapshot.project.updated_at = "2026-09-06T10:01:00Z";
    assertInitialProjectSnapshot(snapshot);
    assert.equal(snapshot.revision.timeline_sha256, hash);
  }
  assert.equal(
    projectCanonicalJson({ b: 2, a: 1 }),
    projectCanonicalJson({ a: 1, b: 2 }),
  );
});

test("container duration fallback preserves measured rational rate without inventing frame counts", () => {
  const value = input();
  const video = (value.probe.streams as Record<string, unknown>[])[0]!;
  delete video.duration;
  delete video.nb_frames;
  const snapshot = createInitialProject(value);
  assertInitialProjectSnapshot(snapshot);
  assert.equal(snapshot.timeline.duration_us, 1001000);
  assert.deepEqual(snapshot.timeline.frame_rate, {
    numerator: 30000,
    denominator: 1001,
  });
  assert.equal(
    "nb_frames" in
      (snapshot.source_probe.streams as Record<string, unknown>[])[0]!,
    false,
  );
});
test("bad references, hashes, ranges, fabricated edits and malformed baseline records fail", () => {
  const mutations: ((snapshot: InitialProjectSnapshot) => void)[] = [
    (s) => {
      s.project.current_revision_id = "other-revision";
    },
    (s) => {
      s.project.source_ids = ["other-source"];
    },
    (s) => {
      s.timeline.project_id = "other-project";
    },
    (s) => {
      s.timeline.revision_id = "other-revision";
    },
    (s) => {
      s.timeline.clips[0]!.source_id = "other-source";
    },
    (s) => {
      s.timeline.clips[0]!.track_id = "other-track";
    },
    (s) => {
      s.timeline.clips[0]!.source_start_us = 1;
    },
    (s) => {
      s.timeline.clips[0]!.timeline_end_us++;
    },
    (s) => {
      s.timeline.duration_us++;
      s.revision.timeline_sha256 = timelineSha256(s.timeline);
    },
    (s) => {
      s.source.duration_us++;
    },
    (s) => {
      s.timeline.frame_rate.denominator = 1000;
    },
    (s) => {
      s.timeline.canvas.width = 1920;
    },
    (s) => {
      s.revision.timeline_sha256 = "0".repeat(64);
    },
    (s) => {
      s.timeline.operation_ids.push("fake-operation");
    },
    (s) => {
      s.project.updated_at = "2026-09-05T10:01:00Z";
    },
    (s) => {
      Object.assign(s.project, { workflow_step: "complete" });
    },
    (s) => {
      Object.assign(s.revision, { locked: false });
    },
    (s) => {
      Object.assign(s.source, { immutable: false });
    },
    (s) => {
      Object.assign(s, { unexpected: true });
    },
    (s) => {
      s.source.streams[0]!.width = NaN;
    },
  ];
  for (const mutate of mutations) {
    const snapshot = createInitialProject(input());
    mutate(snapshot);
    assert.throws(() => assertInitialProjectSnapshot(snapshot));
  }
  for (const value of [null, [], {}, { project: {} }])
    assert.throws(() => assertInitialProjectSnapshot(value));
});
test("real probe timing and stream metadata are required; unsupported or contradictory values fail", () => {
  const mutations: ((value: InitialProjectInput) => void)[] = [
    (value) => {
      value.createdAt = "2026-02-30T10:00:00Z";
    },
    (value) => {
      value.projectRoot = "relative";
    },
    (value) => {
      value.sizeBytes = Infinity;
    },
    (value) => {
      value.sourceId = value.projectId;
    },
    (value) => {
      value.sha256 = "unknown";
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[0]!.avg_frame_rate =
        "29.97";
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[0]!.avg_frame_rate =
        "0/0";
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[0]!.duration = "NaN";
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[0]!.duration = "0";
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[0]!.nb_frames = "90";
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[0]!.width = -1;
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[1]!.index = 0;
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[1]!.channels = NaN;
    },
    (value) => {
      (value.probe.streams as Record<string, unknown>[])[1]!.codec_type =
        "attachment";
    },
    (value) => {
      value.probe.bad = undefined;
    },
  ];
  for (const mutate of mutations) {
    const value = input();
    mutate(value);
    assert.throws(() => createInitialProject(value));
  }
  for (const value of [
    NaN,
    Infinity,
    undefined,
    { value: undefined },
    [undefined],
  ])
    assert.throws(() => projectCanonicalJson(value));
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(() => projectCanonicalJson(cycle));
});
