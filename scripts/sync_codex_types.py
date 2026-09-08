"""Verify and normalize the reviewed subset of official generated Codex types.

Run generation with the pinned binary inside the isolated guest first. This
script only reads generated text; it never launches Codex or reads credentials.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'packages/codex-bridge/src/generated'
IMPORT = re.compile(r'from "(\.[^"]+)"')


def normalize_types(source: Path, contract: dict) -> dict[str, str]:
    source = source.resolve()
    files = contract['typescript_sha256']
    output = {}
    for name, digest in files.items():
        path = (source / name).resolve()
        if source not in path.parents or path.suffix != '.ts':
            raise ValueError('Generated type path escapes source root')
        data = path.read_bytes().replace(b'\r\n', b'\n')
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError('Generated type differs from pinned contract: ' + name)
        text = data.decode('utf-8')
        if not text.startswith('// GENERATED CODE! DO NOT MODIFY BY HAND!'):
            raise ValueError('Missing upstream generation marker')

        def replace(match):
            dependency = (path.parent / (match[1] + '.ts')).resolve()
            if source not in dependency.parents:
                raise ValueError('Generated import escapes source root')
            if dependency.relative_to(source).as_posix() not in files:
                raise ValueError('Generated import is outside reviewed closure')
            return 'from "' + match[1] + '.ts"'

        output[name] = IMPORT.sub(replace, text)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    contract = json.loads((ROOT / 'docs/contracts/codex-protocol.json').read_text())
    output = normalize_types(args.source, contract)
    with tempfile.TemporaryDirectory(prefix='codex-types-') as temporary:
        stage = Path(temporary)
        paths = []
        for name, content in output.items():
            path = stage / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content.encode('utf-8'))
            paths.append(str(path))
        subprocess.run(['node', str(ROOT / 'node_modules/prettier/bin/prettier.cjs'),
                        '--write', *paths], check=True, stdout=subprocess.DEVNULL)
        existing = {p.relative_to(TARGET).as_posix() for p in TARGET.rglob('*.ts')}
        if existing - output.keys():
            raise ValueError('Unexpected generated files require explicit review')
        for name in output:
            data = (stage / name).read_bytes()
            destination = TARGET / name
            if args.check:
                if not destination.is_file() or destination.read_bytes().replace(b'\r\n', b'\n') != data:
                    raise ValueError('Checked-in generated type differs: ' + name)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(data)
    print('Verified generated Codex types:', len(output))


if __name__ == '__main__':
    main()
