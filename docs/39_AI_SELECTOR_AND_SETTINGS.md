# AI selector and Codex settings

## First release

The app has an AI settings area and model selector. Codex is the only provider entry. Do not show fake providers, disabled provider marketing cards, API-key fields, or an unimplemented marketplace.

## Provider row

Show:

- Codex
- signed-in account state
- ChatGPT plan when returned by the current protocol
- connection state
- Sign in, Sign out, or Reconnect

## Model selector

Populate from the current app-server model catalog. Show friendly labels and supported reasoning choices returned by the runtime. Do not hardcode Astra or any other model as the only selectable model. Save the project default and allow a per-turn override when the protocol supports it.

## Skills

Skills are not a user-facing plugin marketplace. Use the label Available skills for the compact discovered list. It may include bundled runtime guides as well as project guides; discovery does not establish that every referenced tool is exposed by the editor. Refresh when the app-server reports skill changes.

## Usage and limits

Show a simple remaining-usage or rate-limit state only when the protocol supplies it. Never estimate subscription allowance from guesses.

## Context disclosure

Before first use, explain that Codex may receive project instructions, transcript excerpts, timeline state, requested preview frames, and local tool results. Do not send full raw recordings by default.

## Failure states

- signed out
- app-server unavailable
- unsupported protocol version
- no compatible model
- rate limited
- turn interrupted
- tool validation failed

Each state has a direct recovery action and preserves the project draft.

## Current P2 implementation and acceptance boundary

Source now adds the Codex section beside Appearance in the Settings modal. Main resolves the fixed packaged Codex runtime, owns its dedicated account/context directories, validates browser-login URLs and exposes only bounded account/settings replies through typed IPC. Sign in, Cancel sign-in, Sign out and Reconnect use the real client. No API-key or external-token entrypoint is exposed. Browser sign-in opens externally from main; it does not replace packaged renderer content. Automated browser opening and native app tests must remain inside the isolated guest.

The model and reasoning selection is currently an application preference saved immediately, validated against the active runtime catalog. It is not yet a project default or per-turn override. Remaining usage comes from returned windows, with supplied reset times; absent data is not estimated. Skills appear in Advanced within the selected Codex section. Errors offer recovery without exposing raw protocol, email, URLs, codes or account paths.

Packaged Linux signed-out connection, login initiation/cancellation, reopen and scale checks passed with guest-only visual inspection; the test explicitly suppressed external browser launching. Real managed authentication and authenticated catalog/usage/selection checks remain pending. Threads, turns, draft transactions and actual editing remain unimplemented requirements; no fabricated conversation or edit preview follows from selecting a model.
