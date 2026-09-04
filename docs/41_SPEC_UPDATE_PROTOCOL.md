# Specification update protocol

## Trigger

Use this protocol whenever a product flow, screen, command, data field, automation rule, permission, tool, phase, or acceptance condition changes.

## Required update set

1. Update the main feature specification.
2. Update affected screen and workflow documents.
3. Update task IDs and dependencies.
4. Update schemas and examples.
5. Update unit, integration, media, and native UI test requirements.
6. Update prompts, skills, and subagent routing.
7. Update traceability.
8. Update ADRs when the architectural decision changes.
9. Update the reference manifest when screenshots are added or superseded.
10. Run package validation and record the changed contract list.

## Ownership

The implementation agent owns the product change. The `spec-maintainer` subagent performs a bounded cross-file review. The main agent resolves conflicts and verifies the final set.

## Versioning

- Backward-compatible fields increment the schema minor version when supported.
- Breaking project-format changes require a migration and a major schema version.
- Stored project data keeps its original schema version.
- Migration tests must include rollback or safe failure behavior.

## Completion rule

A feature change is incomplete when implementation and specifications disagree. Do not mark its phase complete until the sync report is clean or documents an explicit, accepted exception.
