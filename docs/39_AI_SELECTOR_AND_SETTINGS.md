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

Skills are not a user-facing plugin marketplace. Show a compact project skills list under Advanced AI Settings. Refresh when the app-server reports skill changes.

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
