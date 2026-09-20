---
name: simple-desktop-ui
description: Design and implement the quiet step-based creator interface.
---

# Simple desktop UI

## Use when

Changing screen flow, visual hierarchy, design system, editor panels, or empty and error states.

## Core rules

- Home plus five project steps: Record or Import, Auto Edit, Edit, Review, Export. QA is a screen within Review.
- One primary action per screen.
- One tool inspector open at a time.
- No permanent full feature navigation.
- AI drawer collapsed unless active or requested.
- Technical details behind Diagnostics.
- Large preview and direct manipulation in Edit; watch-through, comparison and quality findings in Review.
- Hide empty tracks and unavailable controls.
- Use plain user language.

For a partial Edit tool, put only actionable trim/undo controls by the current preview position. Show which part a two-source trim targets, disable invalid boundaries, and retain the single-inspector/drawer rule. Do not add inactive tracks or a fake full tool rail to match a reference image.

## Procedure

1. Start from the user task and current screen ID.
2. Define the one decision the screen supports.
3. Remove controls unrelated to that decision.
4. Preserve keyboard access and readable scaling.
5. Implement loading, empty, warning, blocked, and recovery states.
6. Test at common desktop window sizes.
7. Inspect with computer use and capture screenshots.

For a long assistant conversation, bound the selected drawer and let the history scroll inside it while the composer and actionable error remain readable. At compact native sizes, assert the alert is inside the drawer and visible in the viewport; finding its text in the DOM is insufficient.

At 200% interface scale, retain a minimum usable history height and let the drawer scroll to a changed error. Review preview and drawer states separately in a small window; do not claim they fit simultaneously when the viewport cannot show both.

## Reference rule

Use future screenshots for principles and proportions. Do not copy brands, assets, or exact layouts.
