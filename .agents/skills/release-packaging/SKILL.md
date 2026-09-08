---
name: release-packaging
description: Build, install, test, and verify the Windows desktop release.
---

# Release packaging

## Use when

Changing installer, bundled tools, first-run setup, updates, uninstall, or release artifacts.

## Procedure

1. Pin and inventory dependencies.
2. Check redistribution and licence terms.
3. Package local renderer and sidecars.
4. Build installer and checksum.
5. Install on a clean isolated Windows image.
6. Run first launch, login, import, virtual recording, Magic Wand, manual edit, export, restart, and uninstall tests.
7. Verify uninstall preserves projects by default.
8. Record exact artifact hash and signing status.

## Rule

Do not claim a signed or production-ready release without available signing credentials and a verified signature.
