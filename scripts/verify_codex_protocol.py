#!/usr/bin/env python3
"""Generate and inspect schemas without starting a server or reading account data."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METHODS = ('initialize', 'model/list', 'skills/list', 'thread/start',
           'turn/start', 'turn/interrupt', 'account/login/start')


def resolve_local(document: dict, reference: str) -> dict:
    if not reference.startswith('#/'):
        raise ValueError('Only document-local schema references are supported')
    current = document
    for part in reference[2:].split('/'):
        key = part.replace('~1', '/').replace('~0', '~')
        if not isinstance(current, dict) or key not in current:
            raise ValueError('Unresolved schema reference')
        current = current[key]
    if not isinstance(current, dict) or not current:
        raise ValueError('Empty or invalid parameter definition')
    return current


def inspect_requests(document: dict) -> dict:
    """Validate request discriminants and their actual parameter definitions."""
    found = {}
    for variant in document.get('oneOf', []):
        properties = variant.get('properties', {})
        method_schema = properties.get('method', {})
        names = method_schema.get('enum', [method_schema.get('const')])
        for name in names:
            if name not in METHODS:
                continue
            if name in found:
                raise ValueError(f'Duplicate request method: {name}')
            if not {'id', 'method', 'params'}.issubset(variant.get('required', [])):
                raise ValueError(f'Incomplete request envelope: {name}')
            params = properties.get('params', {})
            reference = params.get('$ref')
            definition = resolve_local(document, reference) if reference else params
            if not definition or not any(k in definition for k in ('properties', 'oneOf', 'anyOf', 'allOf', 'type')):
                raise ValueError(f'Missing parameter shape: {name}')
            found[name] = {'params_ref': reference, 'required': definition.get('required', []),
                           'properties': sorted(definition.get('properties', {}))}
            if name == 'account/login/start':
                variants = definition.get('oneOf', [])
                chatgpt = [item for item in variants if
                           'chatgpt' in item.get('properties', {}).get('type', {}).get('enum', [])]
                if not chatgpt or 'type' not in chatgpt[0].get('required', []):
                    raise ValueError('ChatGPT managed login definition missing')
                found[name]['chatgpt_properties'] = sorted(chatgpt[0].get('properties', {}))
    missing = sorted(set(METHODS) - found.keys())
    if missing:
        raise ValueError(f'Required request definitions missing: {missing}')
    return found


def run(executable: str, args: list[str], timeout: int = 60) -> str:
    result = subprocess.run([executable, *args], capture_output=True, text=True,
                            encoding='utf-8', errors='strict', timeout=timeout, check=False)
    if result.returncode:
        # Do not propagate arbitrary process output into the public report.
        raise RuntimeError(f'Codex metadata command failed with exit {result.returncode}')
    return result.stdout


def main() -> None:
    executable = shutil.which('codex')
    if not executable:
        raise RuntimeError('Codex executable unavailable')
    version_text = run(executable, ['--version']).strip()
    match = re.fullmatch(r'codex-cli (\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)', version_text)
    if not match:
        raise ValueError('Unrecognized Codex version format')
    version = match.group(1)
    version_root = ROOT / '.astra' / 'evidence' / 'codex-protocol' / version
    version_root.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix='generation-', dir=version_root))
    run(executable, ['app-server', 'generate-json-schema', '--out', str(directory)])
    document = json.loads((directory / 'ClientRequest.json').read_text(encoding='utf-8'))
    methods = inspect_requests(document)
    hashes = {path.relative_to(directory).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in sorted(directory.rglob('*.json')) if path.name != 'manifest.json'}
    report = {'checked_at': datetime.now(timezone.utc).isoformat(), 'codex_version': version,
              'generator_experimental_flag': False, 'methods': methods, 'schema_sha256': hashes,
              'runtime_smoke_test': False, 'authentication_attempted': False}
    (directory / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'codex_version': version, 'schema_count': len(hashes),
                      'verified_methods': sorted(methods), 'runtime_smoke_test': False}))


if __name__ == '__main__':
    main()
