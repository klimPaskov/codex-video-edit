# Simple UI specification

## Visual goal

The interface should feel like a focused creator tool. It should not look like an operations dashboard, development console, or traditional professional NLE.

## Rules

- One primary action per screen.
- One inspector panel open at a time.
- No permanent left navigation listing every feature.
- Use the five-stage stepper: Record or Import, Auto Edit, Edit, Review, Export inside projects.
- Keep the AI drawer collapsed until invoked or active.
- Use ordinary language such as “Preparing captions” instead of process names.
- Put technical logs under Help > Diagnostics.
- Hide advanced codec, model, and timing details by default.
- Prefer direct manipulation over forms.
- Keep warnings close to the affected item.
- Do not fill empty space with metrics or status cards.

## Editor layout

### Top bar

Project name, compact current-step navigation, undo, redo, and the relevant next action. Show save failure or unsaved changes when relevant, never a persistent readiness badge.

### Preview

Large and central. Selected zoom, camera, or B-roll items show direct on-canvas handles.

### Tool rail

Compact buttons:

- Select
- Split
- Magic Wand
- Zoom
- Speed
- Captions
- B-roll
- Layout
- Audio

Selecting a tool opens its small inspector and closes the previous one.

### Timeline

Use fixed semantic tracks, not unlimited free-form tracks:

- main screen or imported video
- camera
- audio
- B-roll and overlays
- text and captions
- effects markers

Tracks can collapse. The default view shows only tracks with content.

### Codex drawer

A bottom-right drawer contains natural-language editing, a model selector, current selection context, concise activity, and recent applied actions. Raw reasoning and full command logs are not shown.

## Interface settings and focus

The P1 settings/focus slice implements persistent interface scale choices of 100%, 125%, 150%, and 200%. Main owns preference storage behind strict typed get/set IPC; renderer state and a success toast update only after an actual successful save. Cancel or Escape dismisses unsaved choices, and load/save failures provide actionable messages without claiming success or discarding the prior saved scale. The modal traps keyboard focus and returns it to its invoking control when closed. Ctrl+, opens Settings.

Source information shows real imported-media metadata in one inspector. Opening Settings hides that inspector; closing Settings restores it when its source remains selected. Closing the inspector returns focus to Source details. Opening a source focuses its Back control, and Back restores focus to the selected source card. Interface scaling does not change source samples, preview quality, or master settings.

This slice does not implement the five-stage project shell or complete P1 accessibility acceptance. Packaged native testing remains required at supported window sizes and scales; contract and unit checks alone do not prove those interactions.

The extension to 200% addresses P1-05's full scaling range. Prior native evidence covers the earlier settings/focus slice, including 150% computer-use inspection. Packaged native keyboard/focus/layout tests and guest-only visual input/capture passed at 200%; this does not complete the remaining P1 requirements.

## Empty states

The implemented P1 project shell shows real Projects separately from the retained Source library. Import creates a project after successful ingestion; legacy sources offer Create project. Project views have compact five-stage navigation, with a five-choice select at narrower widths. Update selected stage only after main confirms persistence; failures retain the previous stage. Home returns focus to the originating project/source when applicable, and asynchronous replies must not override later navigation or focus choices.

The current source preview, playhead and one inspector remain available across stage navigation. A concise unavailable-stage message may describe unimplemented actions, but no fake Magic Wand, editing, review findings, or export controls appear. Current packaged native tests passed sizing, keyboard/focus and five-stage persistence. Guest-only visual review confirmed the compact five-choice selector, retained frame across navigation, and one scrollable source inspector. Publication/review and the P1 result remain pending.

Every empty state offers one clear next action. Do not show disabled tool grids before media exists.

## Text and chrome budget

Do not add a page title where the selected step or tool already tells the user where they are. Omit headings such as Edit Video, Visuals, and Review Your Video when they repeat navigation. Omit descriptions such as Add captions, B-roll, camera layout, and cursor emphasis.

Use short labels for real controls and screen-reader names for icon-only controls. Do not remove necessary warnings, confirmation details, capture indicators, filenames, or error recovery guidance. Long help belongs in an optional help surface.

No Ready indicator or debug footer appears in the bottom-left corner. No tool versions, local-service health list, QA dump, model logs, or filesystem paths occupy the normal editing view. A capture timer and microphone meter are recording controls, not debug clutter.

The Codex drawer is readily accessible and can stream edits without being permanently expanded. Opening it replaces the inspector at every window width. Closing it can restore the selected tool inspector. Never squeeze the preview behind a transcript, inspector, chat, and global sidebar all opened by default.
