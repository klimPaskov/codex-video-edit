# Risk register

| Risk | Effect | Mitigation | Blocking evidence |
| --- | --- | --- | --- |
| Screen and audio clocks drift | Lip sync and edit timing fail | One monotonic session clock, sync markers, drift measurement, bounded correction | Virtual multi-source recording exceeds tolerance |
| System audio differs by platform | Missing or dead track | Detect platform support, permission checks, explicit warnings, separate source state | Required audio source records silence |
| Codex protocol changes | Login or turns fail | Pin tested binary, generate types, negotiate version, compatibility tests | Real smoke test fails |
| API key leaks or wrong destination | Account abuse and privacy loss | Main-only key handling, OS-backed encryption or session-only fallback, fixed HTTPS endpoints, redacted tests | Key reaches renderer/project/log or request escapes reviewed endpoint |
| API response bypasses edit guard | Unwanted draft or source mutation | Treat output as untrusted intent; validate scope, freshness and inverse through shared engine | Native provider fixture changes source or commits outside journal |
| API billing is mistaken for subscription | Unexpected charges | Distinct provider labels and explicit user start for paid turns | Background generation or false quota/price claim |
| Automatic cuts remove meaning | Incorrect video | Protected-content policy, conservative confidence, undo, review, re-transcription | Meaning comparison or watch-through fails |
| Zoom target is wrong | Viewers cannot follow | Telemetry first, visual confirmation, edge QA, manual adjustment | Target not visible or centered |
| Speed-up hides an action | Tutorial becomes unclear | Exact action bounds, speech checks, preview, normal-speed fallback | Important step falls inside speed range |
| B-roll lacks rights | Export risk | Local indexed assets, explicit licence record, source fallback | Missing or unverified licence |
| Electron privilege exposure | Local security issue | Local renderer, sandbox, context isolation, typed IPC, navigation blocking | Security checklist failure |
| Large media overwhelms memory | Crash or poor preview | Proxies, streaming decode, bounded caches, cancellation | Target fixture exceeds memory budget |
| UI becomes complex | Product loses core value | Step flow, one panel, hidden empty tracks, visual acceptance tests | Reference and usability review fails |
| Computer-use inspection is mistaken for full QA | Defects escape | Pair visual inspection with deterministic tests and media decode | Required test layer missing |
| User source is altered | Data loss | Immutable source policy and hash checks | Source hash changes |
