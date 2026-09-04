# Reference screenshot pass

Read `references/manifest.json` and inspect every new screenshot with built-in vision.

For each image:

1. Map it to one or more codex-video-edit screen IDs.
2. Record the useful traits: hierarchy, spacing, disclosure, navigation, control density, and interaction pattern.
3. Record what must not be copied: brand, text, icons, artwork, exact layout, or proprietary elements.
4. Compare it with `docs/04_SIMPLE_UI_SPEC.md` and `docs/05_SCREEN_SPECS.md`.
5. Update only the product's own design contract.
6. Add or update visual acceptance tests and screenshots.
7. Update traceability and the manifest.

Keep one primary action and one open inspector. Do not add panels merely because a reference contains them.

Individual current and previous native references are now included in references/screenshots/. Their exact coverage and required corrections are recorded in references/SCREEN_COVERAGE.md and references/IMPLEMENTATION_NOTES.md. Do not assume all thirteen full states have dedicated images.
