---
name: lossless-media
description: Preserve capture and render samples and verify lossless boundaries.
---

# lossless-media

Read docs/44_LOSSLESS_MEDIA_POLICY.md and the exact source/working-format metadata. Trace every decode, conversion, composite, cache, and encoder boundary. Use explicit pixel and sample formats. Keep analysis and optional playback proxies out of master input. Add no-op and edited canonical round-trip tests. Reject unsupported or silently downgraded precision. A successful decode and a file checksum do not prove equality. Record verified profiles and blockers.

Update this reusable workflow when implementation reveals a repeatable failure or verified improvement. Keep project-specific footage and task transcripts out of the skill.

For strict FFmpeg raw-sample encoding, declare canonical input color metadata before `-i` as well as output metadata, and disable implicit pixel-format conversion with `-pix_fmt +FORMAT`. Verify the resulting metadata and exact decoded bytes. RGB color-space input may use the CLI label `rgb` while ffprobe reports `gbr`. Record container timestamp quantization separately from rational frame-rate and sample-count equality; neither proves exact packet timing or capture throughput.

An explicit YUV-to-BGRA still-frame conversion can be a safe display path for a tagged 8-bit SDR source, but it changes pixel representation and must never be reused as a canonical render or master input. Check imported file hashes and unsupported high-precision/HDR gates independently of preview pixel checks; source preservation is not decoded-sample equality.
