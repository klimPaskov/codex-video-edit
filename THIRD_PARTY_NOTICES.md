# Third-party notices

Original code and documentation use the root MIT licence. This is not a blanket licence for dependencies or assets.

Before shipping, record each runtime dependency, exact version, upstream URL, licence, redistribution terms, and bundled notices. Review the actual FFmpeg build configuration and encoder licences, Electron, transcription runtime and models, Codex client, fonts, and any stock assets.

The screenshots under references/screenshots are unmodified generated design references from this conversation. They are not product runtime assets. Do not extract the people, scenery, device imagery, icons, or logos as stock content. The manifest records their source and limitations. No font files, model weights, private footage, or credentials are included in this workspace.

## P0 development dependencies

The exact JavaScript dependency tree is pinned in package-lock.json. TypeScript 6.0.3 uses Apache-2.0; ESLint 10.10.0, typescript-eslint 8.69.0, Prettier 3.9.6, and @types/node 24.13.3 use MIT. They are development tools, not shipped application assets. Upstreams: https://github.com/microsoft/TypeScript, https://github.com/eslint/eslint, https://github.com/typescript-eslint/typescript-eslint, https://github.com/prettier/prettier, https://github.com/DefinitelyTyped/DefinitelyTyped.

Foundation tests invoke an externally installed FFmpeg/ffprobe. The local tested build identifies GPL and version3 flags; it has not been approved or packaged for redistribution. No FFmpeg, Electron, Codex, transcription binary, model weights, fonts, or production imagery are bundled by this foundation slice. Their exact redistribution review remains required before packaging.
