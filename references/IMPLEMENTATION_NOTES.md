# Reference implementation notes

## Authority

Use `screenshots/current` first. Retain `screenshots/previous` for earlier individual states and alternative placements. All twenty images are generated visual references. Their content is not executable product behavior or acceptance evidence.

The user's latest requirements override image artifacts. Implement their dark palette, accent, preview proportions, tool placement, and direct interaction patterns. Do not copy every text label or turn an image into the whole app by displaying it as a background.

## Mandatory corrections

1. Use `codex-video-edit` for the product, executable identity, GitHub repository, and working root. Ignore old names in previous reference images.
2. No persistent Ready, All systems operational, Local Project Files, or status footer in the final app. No hidden terminal presented as the main editor.
3. Remove large repeated headings and explanatory subtitles. In particular, do not reproduce Edit Video / Visuals / Add captions, B-roll, camera layout, and cursor emphasis. Keep real control labels, file names, actionable warnings, and recording indicators.
4. Show only the active step and selected inspector. The Codex drawer is collapsible. The references show it open to explain its content, not to require it open on every screen. Do not open inspector, transcript, chat, and full navigation simultaneously by default.
5. Real Codex applies authorized reversible changes live. A canned message saying Done is not an edit. Apply Suggestion cards in mockups are optional review interactions, not a mandatory barrier for each ordinary edit.
6. The current export image incorrectly labels ProRes 422 HQ as Lossless. Do not implement that label. Default to the verified FFV1/PCM master in a correct container under `docs/44_LOSSLESS_MEDIA_POLICY.md`. Smaller MP4 output is an explicit opt-in. Source-matched output does not automatically mean 4K or 48 kHz.
7. Separate export settings, rendering, and export-complete states. Do not show them all as simultaneously complete. Only current measurements may populate progress and duration.
8. A single supported provider does not need a repeated Codex provider dropdown on every page. Offer runtime model selection in settings or the drawer.
9. Do not preserve contradictory time ranges, progress, active navigation, speed values, or demo transcript content. Use one canonical clock and committed draft state.
10. Local rendering is not a promise of offline Codex inference. Use accurate context-sharing disclosure during sign-in. Do not put repeated privacy banners in every editor panel.
11. Transcript correction changes text and captions unless a cut is requested. It does not replace spoken words with a new recording or clone a voice.
12. B-roll must come from available permitted assets. The mockup scenery, people, and device pictures are not a licensed production library.

## Simple acceptance

At 1366 x 768 and 1920 x 1080, check one readable preview, one relevant inspector, compact navigation, useful labels, and a visible next action. Check at enlarged UI scale too. Inspect native screenshots of the real app, not only DOM snapshots. Verify each visible control changes the actual timeline, preview, capture, or export as intended.

## Workflow correction

Use five project stages: Record or Import, Auto Edit, Edit, Review, Export. Historical four-stage references do not collapse manual Edit into Review. The internal QA screen belongs to Review, as does revision comparison. These mapping corrections do not alter the reference images or make them native acceptance evidence.
