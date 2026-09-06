# Live state, transactions, and undo

## Source of truth

The main process owns the canonical project state. The renderer holds a view model and sends typed intents. Codex and manual controls use the same domain command layer.

ADR 0013 brings real project identity, source references, initial timeline/baseline revision and persisted active stage into P1. It brings the transaction core necessary for the real guarded fixture edit into P2. P3 and P6 retain all complete project, editing, revision and recovery acceptance. Earlier prerequisite implementation does not establish those complete features.

Project navigation selects a workspace stage without editing media. Persist navigation state before announcing it, preserve the committed draft and source context, and keep it separate from draft sequence and undo history. Stage changes never manufacture automation, successful review or export. Failed navigation saves retain the previous committed stage.

## Draft sequence

Every accepted mutation increments an integer draft sequence. Requests carry the expected sequence. A stale request is rejected and the caller receives the current sequence plus a compact rebase summary.

## Transactions

A transaction contains one or more operations and has these states:

1. received
2. validated
3. applied
4. persisted
5. announced

No UI patch is announced before persistence succeeds. A failed transaction leaves the prior state intact.

P2 must implement this sequence in the common engine before claiming its authenticated edit: validate expected draft sequence, persist a complete transaction with deterministic inverse/undo, promote committed state, then notify the renderer. Its tests include stale requests, failed persistence, interruption, reopen and undo. Runtime Codex uses that engine, not a separate AI mutation path; manual and Magic Wand actions must reuse it when implemented.

## Live Codex changes

During a Codex turn, valid transactions may be committed to the active draft as tools complete. The timeline, transcript, preview markers, inspector values, and history update immediately after each transaction event. The user sees a short activity label and a visible Undo action.

The UI must not stream raw protocol traffic into ordinary screens. Diagnostics can show the full event sequence.

## Stop and interruption

Stopping a Codex turn prevents new tool calls. Transactions that already reached the persisted state remain in history. The user can undo the latest transaction or the whole turn batch. Interrupted analysis without applied transactions leaves no timeline mutation.

## Unified history

Manual, Magic Wand, and Codex edits share one ordered history. Each history item records:

- origin
- summary
- affected range
- transaction and operation IDs
- before and after state
- timestamp
- undo and redo payload
- dependency invalidations

A Magic Wand run or Codex turn appears as a collapsible group. Undoing a group reverses its transactions in reverse order after dependency validation.

## Revision commit

Autosave protects the active draft. A named revision freezes a validated timeline snapshot, operation list, source hashes, and relevant settings. Later changes create a new draft from that revision. Existing revisions never change in place.

## Recovery

Persist transaction intent to staging, validate, then promote atomically. On restart, recover only fully persisted transactions. Incomplete staging records become diagnostic evidence and are not replayed without validation.
