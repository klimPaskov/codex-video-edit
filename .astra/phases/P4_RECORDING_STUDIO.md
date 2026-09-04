# P4: recording studio

Task IDs: `P4-01` through `P4-07`

Use `recording-capture`, `media-engine`, `native-app-testing`, `security-privacy`, and `spec-sync`. Implement display, window, and region capture, microphone, optional system audio, optional camera, separate synchronized source files, countdown, pause, resume, stop, recovery, shortcuts, scenes, teleprompter, retries, take history, and selection. Pointer telemetry is optional and never captures keystrokes.

Use virtual media devices and known sync markers for repeatable tests. Label physical hardware coverage honestly.

Acceptance:

- a virtual-device scene records separate screen, audio, and optional camera sources
- offsets and drift stay within policy or create a blocking finding
- interrupted recording recovers usable complete chunks
- take review and retry work in the native UI
- `.astra/results/P4.json` validates

Use `lossless-media` and `docs/44_LOSSLESS_MEDIA_POLICY.md`. Validate the sample boundary, not only successful decode. Never feed preview or transcription proxies to master output. Publish reviewed working changes under `docs/45_OPEN_SOURCE_DEVELOPMENT.md`.
