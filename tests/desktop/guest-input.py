"""Observe and operate only the isolated Linux X11 desktop, never host input."""
import argparse
import ctypes as c
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid


def validate_runtime():
    if (sys.platform != 'linux' or not hasattr(os, 'getuid') or os.getuid() != 1000
            or os.environ.get('DISPLAY') != ':99' or not Path('/.dockerenv').is_file()):
        raise RuntimeError('Guest input requires Docker, UID 1000 and display :99')


def main():
    validate_runtime()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['capture', 'click', 'key'])
    parser.add_argument('values', nargs='*')
    args = parser.parse_args()
    x = c.CDLL('libX11.so.6')
    x.XOpenDisplay.argtypes = [c.c_char_p]
    x.XOpenDisplay.restype = c.c_void_p
    x.XCloseDisplay.argtypes = [c.c_void_p]
    x.XFlush.argtypes = [c.c_void_p]
    x.XDisplayWidth.argtypes = [c.c_void_p, c.c_int]
    x.XDisplayHeight.argtypes = [c.c_void_p, c.c_int]
    display = x.XOpenDisplay(b':99')
    if not display:
        raise RuntimeError('Guest display is unavailable')
    try:
        width, height = x.XDisplayWidth(display, 0), x.XDisplayHeight(display, 0)
        if (width, height) != (1440, 900):
            raise RuntimeError('Unexpected guest display geometry')
        if args.action == 'capture':
            if args.values:
                parser.error('Capture has no input arguments')
        else:
            xt = c.CDLL('libXtst.so.6')
            xt.XTestFakeMotionEvent.argtypes = [c.c_void_p, c.c_int, c.c_int, c.c_int, c.c_ulong]
            xt.XTestFakeButtonEvent.argtypes = [c.c_void_p, c.c_uint, c.c_int, c.c_ulong]
            xt.XTestFakeKeyEvent.argtypes = [c.c_void_p, c.c_uint, c.c_int, c.c_ulong]
            if args.action == 'click':
                if len(args.values) != 2:
                    parser.error('Click requires x and y from the last guest screenshot')
                px, py = map(int, args.values)
                if not (0 <= px < width and 0 <= py < height):
                    parser.error('Click is outside the guest display')
                accepted = [xt.XTestFakeMotionEvent(display, 0, px, py, 0),
                            xt.XTestFakeButtonEvent(display, 1, 1, 0),
                            xt.XTestFakeButtonEvent(display, 1, 0, 0)]
                if not all(accepted):
                    raise RuntimeError('Guest XTEST rejected click input')
            else:
                permitted = {'Tab', 'Shift_L+Tab', 'Escape', 'Return', 'Up', 'Down',
                             'Home', 'End', 'Control_L+comma'}
                if len(args.values) != 1 or args.values[0] not in permitted:
                    parser.error('Unsupported guest test key')
                x.XStringToKeysym.argtypes = [c.c_char_p]
                x.XStringToKeysym.restype = c.c_ulong
                x.XKeysymToKeycode.argtypes = [c.c_void_p, c.c_ulong]
                x.XKeysymToKeycode.restype = c.c_ubyte
                keys = [x.XKeysymToKeycode(display, x.XStringToKeysym(k.encode('ascii')))
                        for k in args.values[0].split('+')]
                if not all(keys):
                    raise RuntimeError('Guest key mapping unavailable')
                accepted = []
                try:
                    for key in keys:
                        accepted.append(xt.XTestFakeKeyEvent(display, key, 1, 0))
                finally:
                    for key in reversed(keys):
                        accepted.append(xt.XTestFakeKeyEvent(display, key, 0, 0))
                    x.XFlush(display)
                if not all(accepted):
                    raise RuntimeError('Guest XTEST rejected key input')
            x.XFlush(display)
            time.sleep(0.2)
    finally:
        x.XCloseDisplay(display)
    folder = Path('/home/node/evidence/visual')
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / (str(uuid.uuid4()) + '.png')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
                    '-f', 'x11grab', '-video_size', f'{width}x{height}', '-i', ':99',
                    '-frames:v', '1', '-threads', '1', str(output)],
                   check=True, timeout=20, capture_output=True)
    record = {'action': args.action, 'values': args.values, 'screenshot': str(output),
              'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
              'display': ':99', 'width': width, 'height': height, 'hostInput': False}
    output.with_suffix('.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(record))


if __name__ == '__main__':
    main()
