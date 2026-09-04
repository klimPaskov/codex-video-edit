"""Enumerate source without walking dependencies, generated data or private evidence."""
import os
import hashlib
from pathlib import Path

EXCLUDED = frozenset({
    '.git', 'node_modules', '.venv', '__pycache__', 'dist', 'build', 'out',
    'coverage', 'private', 'projects', 'recordings', 'exports', 'models',
    'checkpoints', 'credentials', '.codex',
})


def source_files(root: Path):
    for current, directories, files in os.walk(root, followlinks=False):
        relative = Path(current).relative_to(root)
        policy_relative = relative.as_posix().casefold()
        directories[:] = sorted(d for d in directories if d.casefold() not in EXCLUDED
                                and not (policy_relative == '.astra' and d.casefold() in {'evidence', 'private'})
                                )
        if policy_relative == 'fixtures/user-example':
            directories[:] = []
        for directory in directories:
            candidate = Path(current) / directory
            if candidate.is_symlink():
                yield candidate
        for name in sorted(files):
            if policy_relative == 'fixtures/user-example' and name.casefold() != 'readme.md':
                continue
            yield Path(current) / name


def source_digest(path: Path):
    """Hash text with Git's LF normalization; binary reference bytes stay exact."""
    data = path.read_bytes()
    if b'\x00' not in data:
        data = data.replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()
