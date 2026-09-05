# packages/media-engine

P0 implements a bounded canonical FFV1/PCM encoder and verifier, cancellable process execution, immutable snapshots, and exclusive publication of verified output. Tests live in `tests/media/` and run through `npm run check`.

The adapter accepts canonical raw inputs up to 64 MiB each, BT.709 and mono/stereo PCM. It verifies exact decoded samples against those canonical inputs, including intentionally edited samples. This does not imply identity with unedited source footage.

| Boundary | P0 evidence | Remaining product work |
| --- | --- | --- |
| Canonical intermediate/master encoder | BGRA/s16, gbrp16/f32, yuv444p10/s24, yuv444p16/s32, yuva444p16/f64 unchanged and edited round trips | Production compositor, container timing, metadata breadth and full export path |
| Capture | Unverified capture formats reject without fallback | Native devices, lossless input path, separate-source synchronization and throughput |
| Preview/analysis | These roles are rejected as master inputs | Native playback and separate explicit preview quality controls |
| Unsupported precision/HDR | Reject rather than truncate or silently convert | Additional verified profiles and color handling |

The native application integration remains pending. Read root AGENTS.md, TASKS.md and docs/44_LOSSLESS_MEDIA_POLICY.md before extending these boundaries.
