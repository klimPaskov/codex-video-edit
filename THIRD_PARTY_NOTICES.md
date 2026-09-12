# Third-party notices

The native bootstrap pins Electron 44.2.0 (MIT, with Chromium and other bundled notices retained by the packager), Playwright 1.63.0 (Apache-2.0), esbuild 0.28.2 (MIT) and @electron/packager 20.3.0 (BSD-2-Clause). Build/test dependencies are recorded in package-lock.json. Local development packages include the original application MIT licence; no packaged binaries are published by this slice. Sources: https://github.com/electron/electron, https://github.com/microsoft/playwright, https://github.com/evanw/esbuild, https://github.com/electron/packager.

The test-only seccomp profile derives from Moby/profiles under Apache-2.0. Its pinned source, modification notice, hashes and full upstream licence are in [tests/desktop/SECCOMP.md](tests/desktop/SECCOMP.md). It is not relicensed under MIT.

Original code and documentation use the root MIT licence. This is not a blanket licence for dependencies or assets.

The generated protocol types under `packages/codex-bridge/src/generated/` derive from official Codex 0.142.3 (Copyright 2025 OpenAI, Apache-2.0). The pinned upstream licence is retained at `licenses/CODEX-APACHE-2.0.txt`. Generation markers remain intact; only explicit TypeScript import extensions and formatting are normalized by the reviewed sync script. The type-generation manifest records original source hashes. The subsequent P2 native build bundles the official native runtime and this Apache-2.0 licence under resources/codex outside ASAR, with a generated version/hash manifest. These builds remain private test artifacts; no binary or credential is checked into Git or publicly released by source publication. Installer and release acceptance remain separate.

The isolated accessibility comparison builds unmodified Orca 50.2 and AT-SPI2 2.56.8 from GNOME source archives. Both archives include GNU LGPL 2.1 COPYING text; their accompanying source notices remain authoritative. They are external test dependencies, not application runtime assets or checked-in binaries. Source archives: https://download.gnome.org/sources/orca/50/ and https://download.gnome.org/sources/at-spi2-core/2.56/. Preserve upstream notices in the private build environment; the project MIT licence does not replace them.

Before shipping, record each runtime dependency, exact version, upstream URL, licence, redistribution terms, and bundled notices. Review the actual FFmpeg build configuration and encoder licences, Electron, transcription runtime and models, Codex client, fonts, and any stock assets.

The screenshots under docs/references/screenshots are unmodified generated design references from this conversation. They are not product runtime assets. Do not extract the people, scenery, device imagery, icons, or logos as stock content. The manifest records their source and limitations. No font files, model weights, private footage, or credentials are included in this workspace.

## P0 development dependencies

The exact JavaScript dependency tree is pinned in package-lock.json. TypeScript 6.0.3 uses Apache-2.0; ESLint 10.10.0, typescript-eslint 8.69.0, Prettier 3.9.6, and @types/node 24.13.3 use MIT. They are development tools, not shipped application assets. Upstreams: https://github.com/microsoft/TypeScript, https://github.com/eslint/eslint, https://github.com/typescript-eslint/typescript-eslint, https://github.com/prettier/prettier, https://github.com/DefinitelyTyped/DefinitelyTyped.

Foundation tests and the native bootstrap invoke an externally installed FFmpeg/ffprobe. The local tested build identifies GPL and version3 flags; it has not been approved or packaged for redistribution. The private development application package includes Electron and retains its bundled notices. No application binaries, FFmpeg, Codex, transcription binary, model weights, fonts, or production imagery are published by this slice. Runtime redistribution review remains required before a public binary release.
