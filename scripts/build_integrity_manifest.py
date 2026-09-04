#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from workspace_files import source_files, source_digest

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'MANIFEST.sha256'
rows = []
for path in sorted(source_files(ROOT)):
    if not path.is_file() or path == OUTPUT:
        continue
    digest = source_digest(path)
    rows.append(f'{digest}  {path.relative_to(ROOT).as_posix()}')
OUTPUT.write_text('\n'.join(rows) + '\n', encoding='utf-8')
print(f'Wrote {OUTPUT} with {len(rows)} entries')
