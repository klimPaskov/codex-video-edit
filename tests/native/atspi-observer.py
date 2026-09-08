"""Record real AT-SPI focus events inside the private test desktop."""
import json
import os
from pathlib import Path
import sys
import time

if (sys.platform != 'linux' or os.getuid() != 1000
        or os.environ.get('DISPLAY') != ':99'
        or not Path('/.dockerenv').is_file()
        or not os.environ.get('DBUS_SESSION_BUS_ADDRESS')):
    raise RuntimeError('AT-SPI observer requires the isolated guest session')

import pyatspi  # noqa: E402


def focused(event):
    if event.type == 'object:state-changed:focused' and not event.detail1:
        return
    try:
        source = event.source
        application = source.getApplication()
        print(json.dumps({
            'time': time.time(), 'event': event.type,
            'name': source.name, 'role': source.getRoleName(),
            'application': application.name,
            'pid': application.get_process_id(),
        }), flush=True)
    except Exception as error:
        print(json.dumps({'time': time.time(), 'error': str(error)}), flush=True)


pyatspi.Registry.registerEventListener(focused, 'object:state-changed:focused')
print(json.dumps({'ready': True}), flush=True)
pyatspi.Registry.start()
