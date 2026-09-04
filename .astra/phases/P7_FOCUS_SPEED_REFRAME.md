# P7: zoom, cursor, speed, and reframe

Task IDs: `P7-01` through `P7-07`

Use `automatic-zoom`, `timeline-editor`, `media-engine`, `native-app-testing`, and `spec-sync`. Implement purposeful automatic zooms from pointer telemetry and confirmed visual evidence, manual zoom creation, on-canvas targets, smooth cursor and click treatment, safe speed ranges, pitch-aware audio modes, and common canvas formats.

Every automatic zoom needs a visible target and purpose. Every automatic speed range needs an allowed reason and verified bounds. Normal footage is the fallback.

Acceptance:

- edge, target, motion, overlap, speech, and A/V fixtures pass
- zoom target, scale, easing, and range are directly adjustable
- speed range, rate, and audio mode are directly adjustable
- vertical and square reframing preserves important content
- `.astra/results/P7.json` validates
