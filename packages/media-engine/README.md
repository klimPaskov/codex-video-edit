# packages/media-engine

P0 implements a bounded canonical FFV1/PCM encoder and verifier, cancellable process execution, immutable snapshots, exclusive publication of verified output, and an append-only managed media library. The library preserves sources and exposes bounded frame inspection; it is not project storage or an edit journal. Tests live in `tests/media/` and run through `npm run check`.

The adapter accepts canonical raw inputs up to 64 MiB each, BT.709 and mono/stereo PCM. It verifies exact decoded samples against those canonical inputs, including intentionally edited samples. This does not imply identity with unedited source footage.

| Boundary | P0 evidence | Remaining product work |
| --- | --- | --- |
| Canonical intermediate/master encoder | BGRA/s16, gbrp16/f32, yuv444p10/s24, yuv444p16/s32, yuva444p16/f64 unchanged and edited round trips | Production compositor, container timing, metadata breadth and full export path |
| Capture | Unverified capture formats reject without fallback | Native devices, lossless input path, separate-source synchronization and throughput |
| Preview/analysis | These roles are rejected as master inputs | Native playback and separate explicit preview quality controls |
| Native library/frame transport | Actual packaged Electron synthetic import, exact native-size two-frame inspection/seek, source integrity and library reopen; native computer-use source selection/Next frame | Smooth A/V playback, broader color/precision paths, projects and editing |
| Unsupported precision/HDR | Reject rather than truncate or silently convert | Additional verified profiles and color handling |

The initial native frame adapter accepts BGRA full-range GBR BT.709 SDR within explicit dimensions/payload limits. It reorders channels without resampling or lossy encoding. Other supported video imports preserve their source bytes with preview explicitly unavailable. Verified canonical master equality is a separate encoder boundary, not evidence of an implemented final-export UI. Audio listening, capture, Windows device behavior, Codex editing and the user-video workflow remain unverified. Read root AGENTS.md, TASKS.md and docs/44_LOSSLESS_MEDIA_POLICY.md before extending these boundaries.
