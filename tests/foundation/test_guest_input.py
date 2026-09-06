"""Guest guard tests only: never load X11, capture a display, or send input."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


class GuestInputGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('guest_input_under_test', ROOT / 'tests/desktop/guest-input.py')
        cls.helper = importlib.util.module_from_spec(spec)
        # Importing the helper must itself have no input, capture or native-library effects.
        with patch('ctypes.CDLL') as load, patch('subprocess.run') as run:
            spec.loader.exec_module(cls.helper)
            load.assert_not_called()
            run.assert_not_called()

    def environment(self, *, platform='linux', uid=1000, display=':99', docker=True, uid_available=True):
        fake_os = SimpleNamespace(environ={'DISPLAY': display})
        if uid_available:
            fake_os.getuid = lambda: uid
        return (
            patch.object(self.helper, 'sys', SimpleNamespace(platform=platform)),
            patch.object(self.helper, 'os', fake_os),
            patch.object(self.helper.Path, 'is_file', return_value=docker),
        )

    def test_guard_accepts_only_expected_guest_identity_without_operating_it(self):
        platform, operating_system, marker = self.environment()
        with platform, operating_system, marker:
            self.helper.validate_runtime()

    def test_unsafe_runtime_rejected_before_parser_libraries_and_subprocess(self):
        cases = [
            {'platform': 'win32'}, {'platform': 'darwin'},
            {'uid': 0}, {'uid': 1001}, {'uid_available': False},
            {'display': ':0'}, {'display': 'localhost:99'}, {'display': ''},
            {'docker': False},
        ]
        for case in cases:
            with self.subTest(case=case):
                platform, operating_system, marker = self.environment(**case)
                with platform, operating_system, marker:
                    with patch.object(self.helper.c, 'CDLL') as load, patch.object(self.helper.subprocess, 'run') as run, patch.object(self.helper.argparse, 'ArgumentParser') as parser:
                        with self.assertRaisesRegex(RuntimeError, 'requires Docker'):
                            self.helper.main()
                        load.assert_not_called()
                        run.assert_not_called()
                        parser.assert_not_called()


if __name__ == '__main__':
    unittest.main()
