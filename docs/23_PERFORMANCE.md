# Performance targets

## Interaction

- Basic editor actions should update the draft immediately.
- Timeline scrubbing should stay responsive while background work runs.
- Codex streaming should not block playback or input.
- Large history batches should virtualize rather than render every row.

## Media

- Use proxies for difficult source formats.
- Generate thumbnails and waveforms incrementally.
- Render short preview ranges before full exports.
- Limit concurrent heavy FFmpeg jobs.
- Pause or lower background work when preview drops frames.

## Recording

- Monitor dropped frames, encoder pressure, and disk throughput.
- Warn before recording when the selected quality is unsafe for the machine.
- Degrade preview before degrading recorded source quality.

## Measurement

Record cold start, project open, first playable frame, scrub latency, Magic Wand stage duration, preview render speed, export speed, memory, CPU, GPU, dropped frames, and cache size. Do not promise a fixed completion time across hardware.
