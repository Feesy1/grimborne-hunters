#!/bin/bash
cd "$(dirname "$0")" || exit 1
PORT=8090

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Please install Python 3 or open https://feesy1.github.io/grimborne-hunters/?v=20261120z40"
  read -r -p "Press Enter to exit..."
  exit 1
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '')"
TS="$(date +%s)"

echo "=================================================="
echo "  Grimborne Hunters — Local Server (macOS / iOS)"
echo "=================================================="
echo "MacBook URL : http://localhost:${PORT}/?t=${TS}"
if [ -n "$LAN_IP" ]; then
  echo "iPhone URL  : http://${LAN_IP}:${PORT}/?t=${TS}"
fi
echo "Press Ctrl+C to stop the server."
echo ""

(sleep 1 && open "http://localhost:${PORT}/?t=${TS}") &
python3 -m http.server "${PORT}" --bind 0.0.0.0
