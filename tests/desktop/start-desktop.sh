#!/bin/sh
set -eu
umask 077
mkdir -p "$HOME/.vnc" "$HOME/evidence" "$HOME/runtime"
export XDG_RUNTIME_DIR="$HOME/runtime"
unset WAYLAND_DISPLAY PULSE_SERVER
password=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
x11vnc -storepasswd "$password" "$HOME/.vnc/passwd" >/dev/null 2>&1
unset password
Xvfb :99 -screen 0 1440x900x24 -nolisten tcp >"$HOME/evidence/xvfb.log" 2>&1 &
xvfb_pid=$!
trap 'kill "$xvfb_pid" 2>/dev/null || true' EXIT INT TERM
attempt=0
until xdpyinfo >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    test "$attempt" -lt 50 || exit 1
    sleep 0.1
done
dbus-run-session -- openbox >"$HOME/evidence/openbox.log" 2>&1 &
# A native infrastructure probe, never application acceptance evidence.
xmessage -name desktop-probe -title 'Isolated desktop probe' \
    -geometry 520x160+460+340 -buttons 'Input works:0' \
    'Docker virtual display. Click Input works to verify native input.' \
    >"$HOME/evidence/probe.log" 2>&1 &
x11vnc -display :99 -rfbport 5900 -rfbauth "$HOME/.vnc/passwd" \
    -forever -shared -noxdamage -norc -nosel -noprimary -nosetclipboard \
    >"$HOME/evidence/vnc.log" 2>&1 &
vnc_pid=$!
wait "$vnc_pid"
