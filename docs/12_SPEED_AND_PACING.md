# Speed and pacing specification

## Automatic candidates

Safe candidates include:

- visible typing with little or no explanation
- loading or build progress
- repetitive setup actions
- long pointer travel
- waiting where the screen state remains understandable

## Protected ranges

Do not automatically speed up:

- important spoken explanation
- warnings or conclusions
- dense UI changes
- camera delivery where facial expression matters
- uncertain audio or transcript regions

## Segment model

A speed segment records source range, output range, multiplier, audio mode, pitch policy, reason, confidence, and origin.

## Audio modes

- Preserve and time-stretch speech with pitch protection.
- Lower or mute nonessential audio when the user chooses.
- Keep system sound when it conveys useful feedback.

## Manual control

The user can create and resize a speed block, choose a multiplier, preview it, and change audio behavior. Supported common values should be simple buttons, with a precise field under Advanced.

## QA

Check exact boundaries, expected duration, source-to-output mapping, A/V synchronization, pitch, clipped words, duplicate frames, and abrupt speed changes.
