# Recording telemetry and privacy

## Purpose

Pointer telemetry improves automatic zooms and cursor presentation. It is project data and must be optional, bounded, and disclosed.

## Captured events

When enabled, record:

- monotonic timestamp
- pointer x and y in source coordinates
- source display or window ID
- button down and up
- click count
- optional wheel delta
- capture-frame dimensions
- active capture region changes

Do not record text typed by the user, raw keyboard events, clipboard contents, passwords, unrelated window titles, or application content outside the selected source.

## Sampling

Use event-driven click records and a bounded pointer sampling rate. Compress paths after capture while preserving click timing and visible motion. Keep the raw telemetry file immutable alongside the recording take.

## Coordinate mapping

Record source geometry, display scale, capture crop, and rotation. Convert telemetry to normalized source coordinates. Map to every later crop and canvas format through the canonical transform stack.

## Imported videos

Imported media may have no telemetry. In that case, automatic zooms use bounded visual analysis and transcript context. Lower confidence must reduce automation. Manual zoom remains available.

## User controls

- Enable pointer telemetry during capture.
- Hide pointer in selected ranges.
- Adjust size and smoothing.
- Disable click highlights.
- Delete derived pointer paths while preserving source media.

## QA

Check temporal bounds, coordinate bounds, jumps, edge clipping, hidden-pointer ranges, and alignment between click events and zoom targets.
