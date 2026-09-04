# Automatic zoom specification

## Goal

Guide attention to meaningful screen actions without constant motion.

## Evidence order

1. Recorded click and pointer telemetry
2. Declared scene or user markers
3. Visible cursor and UI change analysis
4. Codex review of sampled frames and transcript context

Low-confidence imported footage uses fewer or no automatic zooms.

## Candidate generation

Create candidates around clicks, text entry, menu selection, key reveals, and small controls that would otherwise be hard to see. Exclude ordinary cursor travel, long narration over a static screen, and repeated nearby actions that would cause zoom pumping.

## Motion rules

- Target a visible UI region, not an arbitrary point.
- Add padding around the target.
- Keep target inside safe bounds throughout motion.
- Use smooth easing in and out.
- Hold long enough to understand the action.
- Avoid overlapping zooms.
- Merge nearby candidates when one stable shot works better.
- Return to a useful wider view after the action.

## Manual control

The user can add a zoom block, drag its edges, move or resize the target rectangle, set strength, choose follow-cursor or fixed target, and remove it.

## QA

Check target visibility, centering, edge coverage, text readability, motion stability, timing against action, overlap, and frequency. Render proof frames at start, peak, hold, and end.
