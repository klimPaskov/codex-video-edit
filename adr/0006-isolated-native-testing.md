# ADR 0006: Isolated native testing

- Status: Accepted starting decision
- Date: 2026-09-04

## Decision

The implementation agent launches and tests the desktop application only inside its own isolated computer-use environment.

## Consequences

- Browser use is limited to research and public documentation.
- Playwright Electron provides repeatable UI automation.
- Computer use inspects the visible native window and rendered video.
- Virtual devices provide deterministic capture tests.
- No test action may run on the user's host computer.
