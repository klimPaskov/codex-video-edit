"""Build unmodified, verified test-only Orca/AT-SPI in an isolated guest prefix."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

ROOT = Path('/home/node/orca-comparison')
SOURCES = (
    ('at-spi2-core-2.56.8',
     'https://download.gnome.org/sources/at-spi2-core/2.56/at-spi2-core-2.56.8.tar.xz',
     'b0e0037c3386811f06730a3c5e3e86532ebe3ecb7a7a94eb5002ed4f573b2f69'),
    ('orca-50.2',
     'https://download.gnome.org/sources/orca/50/orca-50.2.tar.xz',
     '0714421cde8ec4baf47f18e4b4a12b4e5c4a3cfe3b161569e070fe037713fd04'),
)


def main():
    if (sys.platform != 'linux' or not Path('/.dockerenv').is_file()
            or os.getuid() != 1000 or os.environ.get('DISPLAY') != ':99'):
        raise SystemExit('Requires the isolated Linux desktop guest, UID 1000, DISPLAY :99')
    ROOT.mkdir(parents=True, exist_ok=True)
    if ROOT.resolve() != ROOT:
        raise SystemExit('Comparison prefix must not redirect outside its guest directory')
    run = Path(tempfile.mkdtemp(prefix='verified-build-', dir=ROOT))
    prefix = run / 'prefix'
    for name, url, digest in SOURCES:
        archive = ROOT / f'{name}.tar.xz'
        if archive.is_symlink():
            raise ValueError('Archive must not be a symlink')
        if archive.exists():
            data = archive.read_bytes()
        else:
            with urllib.request.urlopen(url, timeout=60) as response:
                data = response.read(16 * 1024 * 1024 + 1)
            if len(data) > 16 * 1024 * 1024:
                raise ValueError('Upstream archive exceeds limit')
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError(f'Upstream SHA-256 mismatch: {name}')
        if not archive.exists():
            with archive.open('xb') as output:
                output.write(data)
        source = run / name
        with tarfile.open(archive) as bundle:
            for member in bundle.getmembers():
                target = run / member.name
                if (not target.resolve().is_relative_to(source)
                        or member.issym() or member.islnk()
                        or not (member.isfile() or member.isdir())):
                    raise ValueError('Unexpected upstream archive member')
        subprocess.run(['tar', '-xf', str(archive), '-C', str(run)], check=True)

    env = dict(os.environ,
               PKG_CONFIG_PATH=str(prefix / 'lib/pkgconfig'),
               GI_TYPELIB_PATH=str(prefix / 'lib/girepository-1.0'),
               LD_LIBRARY_PATH=str(prefix / 'lib'))
    for build, source, options in (
        ('atspi-build', SOURCES[0][0],
         ['-Duse_systemd=false', '-Dgtk2_atk_adaptor=false', '-Dintrospection=enabled']),
        ('orca-build', SOURCES[1][0], []),
    ):
        with (run / f'{build}-provision.log').open('xb') as log:
            subprocess.run(['meson', 'setup', build, source,
                            f'--prefix={prefix}', '--libdir=lib', *options],
                           cwd=run, env=env, stdout=log, stderr=log, check=True)
            for args in (['meson', 'compile', '-C', build, '-j', '4'],
                         ['meson', 'install', '-C', build]):
                subprocess.run(args, cwd=run, env=env, stdout=log, stderr=log, check=True)
    version = subprocess.check_output([str(prefix / 'bin/orca'), '--version'],
                                      env=env, text=True).strip()
    if version != 'Orca version 50.2, AT-SPI2 version: 2.56.8':
        raise ValueError(f'Unexpected installed runtime: {version}')
    result = {'status': 'installed', 'version': version, 'prefix': str(prefix),
              'sources': [{'name': n, 'url': u, 'sha256': h} for n, u, h in SOURCES],
              'scope': 'Test dependencies only; no app launch or accessibility pass'}
    (run / 'provision-result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == '__main__':
    main()
