# Simple native design system

## Direction

The app should feel focused, direct, and easy to learn. Use current creator-tool patterns as reference for restraint and workflow clarity. Do not copy another product's branding, wording, assets, or exact composition.

## Window structure

The normal project window has four areas:

1. Compact top bar with project name, compact current step, undo, redo, and the relevant next action.
2. Main canvas or task content.
3. Bottom timeline only during Review.
4. One context panel or a collapsed Codex drawer.

Do not show a permanent multi-section sidebar. The Home screen and Settings may use a compact navigation list. Project screens use a step header and Back action.

## Progressive disclosure

- Show one primary action.
- Show no more than one inspector.
- Hide empty tracks.
- Collapse advanced settings.
- Replace raw logs with plain status.
- Put diagnostics behind Help > Diagnostics.
- Keep the Codex drawer collapsed until the user opens it or Codex needs a decision.

## Core components

- primary and secondary buttons
- segmented choices
- source cards
- simple device picker
- preview canvas
- compact timeline ruler and tracks
- selection inspector
- Magic Wand menu
- progress sheet
- toast and blocking alert
- review finding row
- model picker
- searchable local asset picker

## Visual tokens

The included current individual screenshots establish the dark palette and accent direction. Apply their mandatory correction notes. Start with:

- neutral dark and light themes
- one accent colour
- high contrast text
- 8 px spacing grid
- 8 to 12 px radii
- 40 px minimum primary control height
- 44 px minimum pointer target where space allows
- restrained shadows and borders
- motion between 120 and 240 ms for ordinary UI transitions

## Typography

Use a bundled licensed UI font or a system stack. Normal body text should remain readable at 100 percent scaling. Avoid long explanatory paragraphs in the product UI.

## Empty, loading, and error states

Every screen needs an intentional empty state, cancellable loading state, recoverable warning state, and plain blocked state. Keep the user's completed work visible when possible.

## Native behavior

Support native menus, file dialogs, keyboard shortcuts, drag and drop, window resizing, display scaling, and standard focus behavior. Never open the main product inside a browser tab.

## No redundant chrome

Do not add hero headings, instructional subtitles, permanent Ready or Saved indicators, debug footers, repeated selected-tool names, or marketing language. Use one concise progress label when work is running. Default to a restrained dark theme with a single violet accent. Do not expose a provider dropdown with only one provider in the main editor. Model choice lives in Codex settings or its compact drawer menu.
