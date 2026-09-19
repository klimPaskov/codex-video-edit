# AI selector and Codex settings

## First release

The AI settings area offers Codex with ChatGPT sign-in plus explicit OpenAI API and DeepSeek key connections under ADR 0014. Do not show fake providers, disabled marketing cards or an arbitrary provider marketplace. A packaged isolated native test covers disconnected API settings and key rejection; no authenticated API key or provider turn was available for live verification.

## Provider row

For Codex show:

- Codex
- signed-in account state
- ChatGPT plan when returned by the current protocol
- connection state
- Sign in, Sign out, or Reconnect

For each supported API provider, show only a main-owned key connect/replace/remove action, connection state, live-validated model choice and clear separate API-billing label. Do not imply a ChatGPT subscription covers API usage or display guessed prices/credit. The key must never return to renderer state; persist it only with OS-backed protection, or use a clearly session-only fallback.

## Model selector

Populate Codex from the current app-server model catalog and each API provider from its supported live model discovery. Show friendly labels and reasoning choices only where that provider returns them. Do not hardcode a model as the only selectable model. Validate the choice against its own provider catalog; report unavailable discovery rather than fabricate choices. Save a project default and allow a per-turn override when supported.

## Skills

Skills are not a user-facing plugin marketplace. Use the label Available skills for the compact discovered list. It may include bundled runtime guides as well as project guides; discovery does not establish that every referenced tool is exposed by the editor. Refresh when the app-server reports skill changes.

## Usage and limits

Show a simple remaining-usage or rate-limit state only when the protocol supplies it. Never estimate subscription allowance from guesses.

## Context disclosure

Before first use, explain which selected provider may receive project instructions, transcript excerpts, timeline state, requested preview frames and local tool results. Do not send full raw recordings by default. Require an explicit start action for any paid API turn.

## Failure states

- signed out
- app-server unavailable
- unsupported protocol version
- no compatible model
- rate limited
- turn interrupted
- tool validation failed
- API key unavailable or rejected; secure storage unavailable with session-only fallback
- provider model discovery unavailable or provider request failed

Each state has a direct recovery action and preserves the project draft.

## Current P2 implementation and acceptance boundary

Settings offers browser sign-in and a compact Sign in from another device action. The latter starts the official ChatGPT device-code flow, shows the fixed verification page and one-time code for that attempt, and clears them on cancellation, success, failure, reconnect or closing Settings. Clicking the page link asks main to open only that fixed destination; the renderer cannot navigate or choose a URL. The user can instead open the displayed page on their own device and enter the code. A packaged isolated native run proved real initiation, page opening and cancellation, with guest-only visual inspection. In a separate live attempt, the user completed verification externally; the same native app reconciled to signed in and cleared the code, and a packaged reopen recovered the signed-in plan, live models and skills. Browser OAuth callback completion is a distinct unverified path.

Source now adds the Codex section beside Appearance in the Settings modal. Main resolves the fixed packaged Codex runtime, owns its dedicated account/context directories, validates browser-login URLs and exposes only bounded account/settings replies through typed IPC. Sign in, Cancel sign-in, Sign out and Reconnect use the real client. No API-key or external-token entrypoint is implemented yet; this is a current-state statement, not the revised product requirement. Browser sign-in opens externally from main; it does not replace packaged renderer content. Automated browser opening and native app tests must remain inside the isolated guest.

The model and reasoning selection is currently an application preference saved immediately, validated against the active runtime catalog. It is not yet a project default or per-turn override. Remaining usage comes from returned windows, with supplied reset times; absent data is not estimated. Skills appear in Advanced within the selected Codex section. Errors offer recovery without exposing raw protocol, email, URLs, codes or account paths.

Packaged Linux signed-out connection, login initiation/cancellation, reopen and scale checks passed with guest-only visual inspection; that test suppressed external browser launching. A separate browser-equipped isolated guest then opened the real OpenAI login page from packaged Electron's Settings sign-in action. Guest-only visual inspection showed Chromium in front of the native editor; cancellation restored signed out and the test-owned browser exited. A later device-code attempt completed through the official runtime and reconciled to signed in in the native app; a packaged reopen confirmed the account and live catalogs. The project view now includes the path-free Codex drawer and typed open/send/interrupt IPC. Production wiring preserves the runtime model identity, durable project thread, bounded redacted recent history, streaming, interruption, compact activity, and idle unsubscribe. A restored newest in-progress turn reopens as running and remains interruptible; forbidden or contradictory history fails closed before the drawer opens. The fixed developer instruction requires current project/timeline summaries and committed tool results before claiming edits. After any bounded Codex trim or undo settles, main rereads the committed draft and sends its exact head and timeline to the renderer; uncertain postcommit outcomes receive the same refresh without being replayed. The preview requests frames against that head and discards stale decode results. A private signed-in packaged Settings run matched the actual returned ChatGPT plan, runtime model choice, usage window/reset time and discovered skills across restart, with guest-only visual input. Earlier authenticated fixture turns also passed bounded trim/undo, history reopen and Stop. Browser OAuth callback completion remains unverified; the authorized private credential seed and browser opener are not evidence of that path. Selecting a model never fabricates an edit preview.
