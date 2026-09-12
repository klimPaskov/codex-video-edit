"""Enumerate source without walking dependencies, generated data or private evidence."""
import os
import hashlib
from pathlib import Path, PurePosixPath

EXCLUDED = frozenset({
    '.git', 'node_modules', '.venv', '__pycache__', 'dist', 'build', 'out',
    'coverage', 'private', 'projects', 'recordings', 'exports', 'models',
    'checkpoints', 'credentials', '.codex', 'test-results', 'local-data',
})


def is_agent_source(path: str) -> bool:
    """Only checked-in direct agent guidance belongs in the runtime directory."""
    parts = PurePosixPath(path.casefold()).parts
    return (len(parts) == 3 and parts[:2] == ('.codex', 'agents')
            and (parts[2] == 'routing.json' or parts[2].endswith('.md')))


def source_files(root: Path):
    for current, directories, files in os.walk(root, followlinks=False):
        relative = Path(current).relative_to(root)
        policy_relative = relative.as_posix().casefold()
        directories[:] = sorted(d for d in directories if (d.casefold() not in EXCLUDED
                                or (policy_relative == '.' and d.casefold() == '.codex'))
                                )
        if policy_relative == '.codex':
            directories[:] = [d for d in directories if d.casefold() == 'agents']
        elif policy_relative == '.codex/agents':
            directories[:] = []
        if policy_relative == 'fixtures/user-example':
            directories[:] = []
        for directory in directories:
            candidate = Path(current) / directory
            if candidate.is_symlink():
                yield candidate
        for name in sorted(files):
            if (policy_relative == '.codex' or policy_relative.startswith('.codex/')) and not is_agent_source((relative / name).as_posix()):
                continue
            if policy_relative == 'fixtures/user-example' and name.casefold() != 'readme.md':
                continue
            yield Path(current) / name


def source_digest(path: Path):
    """Hash text with Git's LF normalization; binary reference bytes stay exact."""
    data = path.read_bytes()
    if b'\x00' not in data:
        data = data.replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()
