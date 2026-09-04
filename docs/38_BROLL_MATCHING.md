# Local B-roll matching

## Scope

The first release uses user-provided local video, image, music, and sound assets. It does not buy, scrape, generate, or download stock media automatically.

## Asset index

For each asset, store hash, path, media properties, description, tags, provenance, licence, allowed use, attribution, and usage history. Recheck the hash before preview or export.

## Suggestion process

1. Read the selected transcript and scene purpose.
2. Identify whether the main footage needs coverage or explanation.
3. Search the local index by meaning, tags, duration, aspect ratio, and licence state.
4. Rank candidates by relevance, timing fit, visual variety, reuse spacing, and confidence.
5. Suggest a placement with a reason and source fallback.
6. Let the user preview, replace, shorten, reposition, or remove it.

## Automatic placement policy

Magic Wand may add B-roll only when the user enables the feature, the local asset is licence-verified, relevance is high, and the main screen content is not needed during that range. Otherwise it creates a suggestion or keeps the source shot.

## Editing

B-roll can be trimmed, moved, resized, fit, filled, muted, faded, and used as full-frame or picture-in-picture coverage. Keep transitions simple.

## QA

Check hash, licence, duration, crop, safe areas, repeated use, hidden important content, missing media, visual continuity, and audio collision.
