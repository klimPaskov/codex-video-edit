# tests

Implementation location: Unit, media, native interaction, and recovery acceptance.

`foundation/` contains Python tests for phase evidence, source enumeration, publication safety and synchronized contracts. `media/` contains TypeScript tests for process safety and exact canonical FFV1/PCM round trips. Run all through `npm run check`. Synthetic artifacts stay under ignored `.astra/evidence/`; these are headless tests and make no native-window, capture, or user-example acceptance claim.
