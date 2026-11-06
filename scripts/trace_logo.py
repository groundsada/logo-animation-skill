import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image


def hex_color(rgb):
    return "#{:02X}{:02X}{:02X}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))


def pbm(mask, path):
    h, w = mask.shape
    packed = np.packbits(mask.astype(np.uint8), axis=1)
    with open(path, "wb") as f:
        f.write(f"P4\n{w} {h}\n".encode())
        f.write(packed.tobytes())


def trace(mask, out_svg):
    with tempfile.NamedTemporaryFile(suffix=".pbm", delete=False) as f:
        pbm_path = f.name
    pbm(mask, pbm_path)
    try:
        subprocess.run(
            ["potrace", "-s", "--turdsize", "5", "-o", str(out_svg), pbm_path],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
    finally:
        Path(pbm_path).unlink(missing_ok=True)
    text = Path(out_svg).read_text()
    return re.findall(r'<path d="([^"]+)"', text, re.S)


def main():
    ap = argparse.ArgumentParser(description="Trace a raster logo into layered SVG paths.")
    ap.add_argument("input")
    ap.add_argument("--out", default=None)
    ap.add_argument("--colors", type=int, default=4)
    ap.add_argument("--min-pixels", type=int, default=40)
    ap.add_argument("--width", type=float, default=1120)
    ap.add_argument("--stage-width", type=float, default=1920)
    ap.add_argument("--stage-height", type=float, default=1080)
    args = ap.parse_args()
    if not shutil.which("potrace"):
        raise SystemExit("potrace is required. Install it with: brew install potrace")
    src = Path(args.input).expanduser().resolve()
    if not src.exists():
        raise SystemExit(f"not found: {src}")
    out = Path(args.out).expanduser().resolve() if args.out else src.parent / (src.stem + "-traced")
    out.mkdir(parents=True, exist_ok=True)

    img = Image.open(src).convert("RGBA")
    a = np.array(img)
    rgb = a[:, :, :3]
    alpha = a[:, :, 3]
    if alpha.min() < 250:
        foreground = alpha > 20
    else:
        corners = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]], dtype=int)
        bg = np.median(corners, axis=0)
        dist = np.abs(rgb.astype(int) - bg).sum(axis=2)
        foreground = dist > 30
    if foreground.sum() == 0:
        raise SystemExit("no foreground pixels found")

    fg = rgb[foreground]
    pal_img = Image.fromarray(fg.reshape(-1, 1, 3)).quantize(colors=max(2, args.colors), method=Image.MEDIANCUT)
    pal = pal_img.getpalette()
    quant = img.convert("RGB").quantize(palette=pal_img, dither=Image.NONE)
    idx = np.array(quant)
    colors = []
    layers = []
    for c in range(max(2, args.colors)):
        mask = foreground & (idx == c)
        count = int(mask.sum())
        if count < args.min_pixels:
            continue
        color = tuple(pal[c * 3:c * 3 + 3])
        with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as f:
            tmp = Path(f.name)
        try:
            paths = trace(mask, tmp)
        finally:
            tmp.unlink(missing_ok=True)
        if not paths:
            continue
        colors.append(hex_color(color))
        layers.extend((hex_color(color), d) for d in paths)

    if not layers:
        raise SystemExit("nothing traced")

    h, w = foreground.shape
    body = "".join(f'<path d="{d}" fill="{color}"/>' for color, d in layers)
    inner = f'<g transform="translate(0 {h}) scale(0.1 -0.1)">{body}</g>'
    scale = args.width / w
    placed_w = w * scale
    placed_h = h * scale
    x = (args.stage_width - placed_w) / 2
    y = (args.stage_height - placed_h) / 2
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
{inner}
</svg>'''
    meta = {
        "input": str(src),
        "kind": "traced-raster",
        "viewBox": {"x": 0, "y": 0, "width": w, "height": h},
        "placement": {
            "scale": round(scale, 8),
            "x": round(x, 4),
            "y": round(y, 4),
            "width": round(placed_w, 4),
            "height": round(placed_h, 4),
            "stageWidth": args.stage_width,
            "stageHeight": args.stage_height,
            "transform": f"translate({x:.4f} {y:.4f}) scale({scale:.8f})"
        },
        "colors": colors,
        "paths": len(layers)
    }
    (out / "logo.svg").write_text(svg)
    (out / "logo.inline.svg").write_text(inner)
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    reference = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Logo reference</title>
<style>
html,body{{margin:0;width:100%;height:100%;background:#fff;overflow:hidden}}
svg{{display:block;width:1920px;height:1080px}}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
<g transform="translate({x:.4f} {y:.4f}) scale({scale:.8f})">
{inner}
</g></svg></body></html>'''
    (out / "reference.html").write_text(reference)
    print(json.dumps(meta, indent=2))
    print(f"wrote {out / 'logo.svg'}")
    print(f"wrote {out / 'logo.inline.svg'}")
    print(f"wrote {out / 'reference.html'}")


if __name__ == "__main__":
    main()
