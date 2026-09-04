# Recording engine specification

## Sources

Support these independent sources:

- display, window, or region video
- system audio when the platform permits it
- microphone audio
- camera video
- pointer and click telemetry with explicit consent

## Synchronization

- Create one recording session ID and monotonic start time.
- Start each source through a coordinated barrier.
- Record start offset, pause intervals, dropped frames, device changes, and end time.
- Preserve each source as a separate managed file.
- Build an automatic timeline from the shared session clock.
- Do not infer synchronization only from container duration.

## Recording quality

- Default to a verified lossless source-native capture profile under `docs/44_LOSSLESS_MEDIA_POLICY.md`.
- Preserve actual capture timestamps and source precision. Record every dropped or duplicated frame.
- Do not transcode a lossy capture and call it lossless. Add a native frame/audio capture adapter if the basic browser capture path cannot prove fidelity.
- Lower-resolution or compressed capture is an explicit user-selected mode, never a silent fallback.
- Create fixed-rate preview proxies only as separate labelled derivatives when requested. Keep source capture timing authoritative.
- Keep original capture data and all takes unchanged.

## Scene workflow

A project may contain ordered scenes. Each scene can have an outline or script and multiple takes. Stopping a take returns to a simple choice:

- Use take
- Retry
- Keep both and decide later

Prior takes remain available.

## Teleprompter

- Optional and hidden when empty.
- Adjustable text size, width, alignment, speed, and opacity.
- Manual scroll first.
- Voice-following mode may ship only after repeatable accuracy tests.

## Pointer telemetry

Record pointer position and button clicks only when enabled. Never record typed keys or clipboard data. Store telemetry locally in a versioned event file.

## Failure handling

- Detect device removal, permission denial, disk exhaustion, encoder failure, and source loss.
- Preserve valid partial recordings.
- Explain the recoverable result without dumping logs into the main UI.
