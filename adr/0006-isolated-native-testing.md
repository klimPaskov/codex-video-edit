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
- Product builds, launches, and capture tests run only in the isolated guest environment.

## Scope resolution, 2026-09-05

The current user request to make the isolated environment available authorizes host-side environment provisioning and a native viewer. Under `AUTHORITATIVE_ORDER.md`, that instruction supersedes the original blanket prohibition on host test actions. This narrow exception permits Docker infrastructure and TigerVNC to display and control the guest desktop. It does not authorize a product launch on the host or mounting host personal files, credentials, devices, or display sockets into the guest.

The current Linux Docker desktop verifies infrastructure with a sandboxed Electron/Playwright probe and native viewer input. It does not establish Windows product, capture, installer, or audio-review acceptance. See `docs/20_NATIVE_COMPUTER_USE_TESTING.md` and `tests/desktop/README.md` for the boundary and reproducible checks.
