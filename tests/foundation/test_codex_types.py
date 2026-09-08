import hashlib
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from sync_codex_types import normalize_types


class CodexTypeTests(unittest.TestCase):
    def test_verified_dependency_closure_and_extension_normalization(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            values = {
                'Root.ts': '// GENERATED CODE! DO NOT MODIFY BY HAND!\nimport type { Child } from "./Child";\n',
                'Child.ts': '// GENERATED CODE! DO NOT MODIFY BY HAND!\nexport type Child = string;\n',
            }
            hashes = {}
            for name, value in values.items():
                (root / name).write_bytes(value.encode())
                hashes[name] = hashlib.sha256(value.encode()).hexdigest()
            contract = {'typescript_sha256': hashes}
            self.assertIn('from "./Child.ts"', normalize_types(root, contract)['Root.ts'])
            (root / 'Child.ts').write_text('unreviewed replacement')
            with self.assertRaisesRegex(ValueError, 'pinned contract'):
                normalize_types(root, contract)

    def test_missing_dependency_and_traversal_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for dependency in ('./Missing', '../Outside'):
                value = '// GENERATED CODE! DO NOT MODIFY BY HAND!\nimport type { X } from "' + dependency + '";\n'
                (root / 'Root.ts').write_bytes(value.encode())
                with self.assertRaises(ValueError):
                    normalize_types(root, {'typescript_sha256': {'Root.ts': hashlib.sha256(value.encode()).hexdigest()}})
            with self.assertRaisesRegex(ValueError, 'escapes'):
                normalize_types(root, {'typescript_sha256': {'../outside.ts': 'untrusted'}})


if __name__ == '__main__':
    unittest.main()
