# Test fixture matrix

## Generated media fixtures

| Fixture | Purpose |
| --- | --- |
| `screen-basic` | Fixed-frame screen recording with clear clicks and UI regions |
| `screen-vfr` | Variable-frame-rate input and normalization |
| `speech-pauses` | Speech with short and long pauses |
| `speech-fillers` | Filler words, stutters, false starts, and protected numbers |
| `duplicate-takes` | Two takes with one obvious failure and one complete take |
| `typing-waiting` | Silent typing, loading, and waiting ranges |
| `zoom-edge` | Targets near every canvas edge |
| `cursor-clicks` | Cursor path and click telemetry with exact timestamps |
| `camera-sync` | Virtual camera and screen with sync marker |
| `multi-audio` | Microphone plus system audio with known offset |
| `captions-long` | Long words, punctuation, two lines, and safe-area stress |
| `broll-local` | Licensed fixture clips and images with metadata |
| `audio-clipping` | Intentionally clipped speech for QA |
| `black-freeze` | Known black and frozen intervals |
| `corrupt-media` | Truncated container and invalid streams |

## Native UI fixtures

- empty Home
- three recent projects
- dependency warning
- Codex signed out
- Codex rate limit warning
- processing in progress
- interrupted Magic Wand
- timeline with each supported selection kind
- QA pass, warning, and blocked
- export complete
- missing local asset
- recovered autosave

## Capture fixtures

Use virtual screen, microphone, camera, and loopback devices. Record known sync flashes and tones. Never rely on a developer's physical device for repeatable CI.

## Codex fixtures

Use a fake protocol server for parser and recovery tests. Keep a separate real authenticated smoke test that proves current login, model discovery, skill discovery, streamed events, and one guarded draft edit. A fake transport cannot satisfy real integration acceptance.

## User example video

The user-supplied example is final product acceptance, not a unit-test fixture. Preserve its hash, keep it outside source control, and record every derived artifact used for acceptance.
