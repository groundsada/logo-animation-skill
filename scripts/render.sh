#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGE="${1:-$ROOT/templates/stage.html}"
MP4="${2:-$ROOT/logo-1080p60.mp4}"
OUT="${OUT:-$ROOT/render_frames}"
FPS="${FPS:-60}"
START="${START:-0}"
DURATION="${DURATION:-9}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required" >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"
node "$ROOT/scripts/render.js" --page "$PAGE" --out "$OUT" --fps "$FPS" --start "$START" --duration "$DURATION"
ffmpeg -y -loglevel error -framerate "$FPS" -i "$OUT/f%05d.png" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart "$MP4"
echo "wrote $MP4"
