#!/bin/sh
set -eu

if [ "$(id -u)" != 1000 ] || [ "${DISPLAY:-}" != :99 ] || [ ! -f /.dockerenv ]; then
  echo 'Isolated unprivileged desktop required' >&2
  exit 1
fi

keyring_root=/home/node/browser-test/test-results/keyring-session
python3 - "$keyring_root" <<'PY'
from pathlib import Path
import os
import secrets
import sys

root = Path(sys.argv[1])
root.mkdir(mode=0o700, exist_ok=True)
os.chmod(root, 0o700)
for name in ('data', 'config'):
    folder = root / name
    folder.mkdir(mode=0o700, exist_ok=True)
    os.chmod(folder, 0o700)
password = root / 'password'
if not password.exists():
    with password.open('x', encoding='utf8') as stream:
        stream.write(secrets.token_urlsafe(48))
os.chmod(password, 0o600)
PY

export XDG_DATA_HOME="$keyring_root/data"
export XDG_CONFIG_HOME="$keyring_root/config"
export XDG_CURRENT_DESKTOP=GNOME
gnome-keyring-daemon --unlock --components=secrets < "$keyring_root/password" > /dev/null
gnome-keyring-daemon --start --components=secrets > /dev/null
node tests/native/api-provider-remembered-model.test.ts "$@"
