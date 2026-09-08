---
name: orchestrate-implementation
description: Select and complete the first dependency-safe implementation phase with evidence.
---

# Orchestrate implementation

## Use when

Starting or continuing any implementation session.

## Procedure

1. Read the authoritative order and all mandatory sources in `AGENTS.md`.
2. Inspect `.astra/results/`, repository state, tests, fixtures, and active phase.
3. Find the first incomplete phase whose dependencies are complete.
4. State exact task IDs and the smallest complete product result.
5. Route bounded specialist work through `SUBAGENT_ROUTING.md`.
6. Add or update tests before treating code as complete.
7. Launch and inspect the native app when UI or media behavior changes.
8. Validate media outputs and schemas.
9. Run security, privacy, accessibility, and source-immutability checks.
10. Run `spec-sync`.
11. Write the phase result only after acceptance passes.

## Rules

- Do not skip an earlier failure.
- Do not stop at an assessment.
- Do not let a subagent mark the phase complete.
- Do not claim visual success from process output.
- Preserve failed evidence that helps diagnosis.
