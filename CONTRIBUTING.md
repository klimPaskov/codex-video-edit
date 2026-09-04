# Contributing

Read AGENTS.md, the active task, and relevant specifications before editing. Keep changes small and testable. Update affected contracts and reusable guidance in the same change. Never replace an implemented feature with a mock or remove a requirement without a documented decision.

Install the development dependencies using `npm ci --ignore-scripts` and `python -m pip install -r requirements-validation.txt`, then run `npm run check` with FFmpeg and ffprobe on PATH. This runs foundation and media tests without launching a desktop window. Inspect the native app in an isolated desktop for UI and media acceptance; headless checks do not replace that review. Record what was actually tested and what remains unverified.

Run `npm run check:publication` against the staged Git snapshot and inspect the entire staged diff before committing. The automatic audit rejects known private paths, common credentials, runtime/media binaries, and unexpected symlinks. It cannot certify arbitrary data as public. Generated media and acceptance evidence stay ignored.

Use feature branches and focused pull requests. Keep recordings, authentication, private projects, and private evidence out of commits. Public fixtures must be synthetic or cleared for redistribution. Follow docs/45_OPEN_SOURCE_DEVELOPMENT.md.
