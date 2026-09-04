# Open decisions

Resolve these through research, prototypes, or user input at the phase where they become material. Do not guess silently.

## Branding

- product name is fixed as `codex-video-edit`
- icon and visual identity
- light theme at first release or later

## Capture

- exact Windows system-audio capture path
- region capture implementation
- maximum supported resolution and frame rate
- pause representation in separate source files
- teleprompter voice-follow mode for first release

## Media

- local transcription runtime and default model
- proxy codecs and hardware acceleration policy
- preview engine and cache budget
- production audio cleanup library

## Codex

- bundled versus separately installed app-server binary
- compatible protocol version range
- default model selection rules
- consent granularity for preview frames

## Editor

- support for clip reorder outside scene groups
- transition set for the first release
- whether custom layout keyframes are needed
- maximum automatic zoom scale by canvas

## Distribution

- installer technology
- code signing
- update channel
- crash-reporting policy
- supported Windows editions and minimum hardware

## Already fixed

The lossless-first default, separate opt-in compressed modes, simplified interface, real Codex live editing, and early public GitHub development are requirements. Research may determine how to implement them, not silently remove them. No design-reference screenshot can reopen these decisions.
