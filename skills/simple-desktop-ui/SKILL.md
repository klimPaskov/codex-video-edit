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

## Procedure

1. Start from the user task and current screen ID.
2. Define the one decision the screen supports.
3. Remove controls unrelated to that decision.
4. Preserve keyboard access and readable scaling.
5. Implement loading, empty, warning, blocked, and recovery states.
6. Test at common desktop window sizes.
7. Inspect with computer use and capture screenshots.

## Reference rule

Use future screenshots for principles and proportions. Do not copy brands, assets, or exact layouts.
