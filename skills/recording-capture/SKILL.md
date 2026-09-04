---
name: recording-capture
description: Implement screen, audio, camera, scene, take, and pointer capture with synchronization.
---

# Recording capture

## Use when

Changing capture setup, recording controls, devices, scenes, teleprompter, or source synchronization.

## Requirements

- display, window, and region capture
- microphone and optional system audio
- optional camera
- separate source files where supported
- shared monotonic session clock
- start offsets, pause intervals, dropped-frame and device evidence
- countdown, pause, resume, stop, retry, and recovery
- scene and take model
- pointer and click telemetry only with consent
- never record keystrokes

## Procedure

1. Verify current platform APIs and permissions.
2. Implement source readiness checks.
3. Start sources through one coordination barrier.
4. Write session metadata continuously.
5. Finalize each valid partial file independently.
6. Build the initial synchronized timeline.
7. Test with virtual devices.
8. Inspect recording UX in the native window.

## Stop condition

Do not claim physical camera, microphone, or system-audio compatibility when only virtual devices were tested.
