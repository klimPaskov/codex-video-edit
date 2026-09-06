# B-roll, layouts, and elements

## Local asset library

Users can import videos, images, logos, music, and sounds. Index each asset with path, hash, media properties, user description, tags, source, licence, attribution, and usage history.

The first release does not purchase or download remote stock media automatically.

## B-roll workflow

- Drag a local asset to the B-roll track.
- Search by text and tags.
- Ask Codex to suggest relevant local assets from transcript context.
- Show the suggested range and reason.
- Keep the main source shot as fallback.
- Let the user replace, trim, move, crop, fit, fill, or remove the asset.

## Layouts

Required presets:

- screen only
- camera bubble
- camera rectangle
- screen with side camera
- presenter-focused camera with screen inset
- side-by-side
- vertical screen and camera stack
- custom saved layout

## Elements

Support text, images, basic shapes, callouts, chapter titles, lower thirds, and simple full-frame transitions. The Elements panel opens only when used.

## Canvas

Support 16:9, 9:16, 1:1, 4:5, Fit source, and custom size. Reframing must preserve important screen and camera content.

## Licence rule

Codex may select only assets with declared usable provenance. Missing provenance creates a warning and excludes the asset from final export until resolved.

## Editorial layouts and suggestion-only graphics

Apply [47_EDITORIAL_FIRST_CUT.md](47_EDITORIAL_FIRST_CUT.md). Reuse exact available properties of an approved layout; otherwise use a restrained inset. Prefer bottom-right PiP only when it leaves useful UI and captions visible. Plan a few meaningful screen-led/camera-led sections and inspect both boundaries and midpoint of each. Protected edits remain intact.

Motion-graphic opportunities are a separate suggestion record, not B-roll assets or generated overlays. A normal edit request, including a recorded cue asking for a graphic, permits only selective concepts with final-cut start/end times, benefit and a complete generator-neutral prompt. Include proposed 1920×1080 asset dimensions, exact rate/duration, no audio, reveal order, exact grounded wording, style/motion, safe margins and transparency when appropriate. Rebind opportunity timing after structural changes. This asset proposal cannot change the source-matched project canvas/master or authorize another generative provider. No composition, generation, render, import or placement occurs without a separate explicit asset request.

Existing permitted local B-roll and manually requested elements remain supported. Tests must distinguish local-asset placement from graphics suggestions, reject unauthorized asset side effects and invented data/branding, and verify prompt completeness and final-cut timing. These are later P8/P10 acceptance requirements.
