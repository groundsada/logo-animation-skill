import argparse
import json
import re
from pathlib import Path


def number(value):
    if value is None:
        return None
    m = re.match(r"^\s*([0-9.]+)", str(value))
    return float(m.group(1)) if m else None


def parse_svg(text):
    root = re.search(r"<svg\b([^>]*)>", text, re.S)
    if not root:
        raise SystemExit("not an SVG: missing <svg>")
    attrs = root.group(1)
    view_box = re.search(r'viewBox="([^"]+)"', attrs)
    width = re.search(r'\bwidth="([^"]+)"', attrs)
    height = re.search(r'\bheight="([^"]+)"', attrs)
    if view_box:
        parts = [float(x) for x in re.split(r"[\s,]+", view_box.group(1).strip())]
        vb = {"x": parts[0], "y": parts[1], "width": parts[2], "height": parts[3]}
    else:
        w = number(width.group(1)) if width else 1920
        h = number(height.group(1)) if height else 1080
        vb = {"x": 0, "y": 0, "width": w, "height": h}
    body = text[root.end():]
    body = body.rsplit("</svg>", 1)[0]
    return vb, body.strip()


def main():
    ap = argparse.ArgumentParser(description="Prepare a logo for LogoStage.")
    ap.add_argument("input")
    ap.add_argument("--out", default=None)
    ap.add_argument("--width", type=float, default=1120)
    ap.add_argument("--stage-width", type=float, default=1920)
    ap.add_argument("--stage-height", type=float, default=1080)
    args = ap.parse_args()
    src = Path(args.input).expanduser().resolve()
    if not src.exists():
        raise SystemExit(f"not found: {src}")
    out = Path(args.out).expanduser().resolve() if args.out else src.parent / (src.stem + "-prepared")
    out.mkdir(parents=True, exist_ok=True)

    if src.suffix.lower() != ".svg":
        print(json.dumps({
            "input": str(src),
            "kind": "raster",
            "next": f"uv run --with pillow --with numpy python scripts/trace_logo.py {src} --out {out} --colors 4"
        }, indent=2))
        return

    text = src.read_text()
    vb, body = parse_svg(text)
    scale = args.width / vb["width"]
    placed_w = vb["width"] * scale
    placed_h = vb["height"] * scale
    x = (args.stage_width - placed_w) / 2
    y = (args.stage_height - placed_h) / 2
    paths = len(re.findall(r"<path\b", body))
    polygons = len(re.findall(r"<polygon\b", body))
    circles = len(re.findall(r"<circle\b", body))
    rects = len(re.findall(r"<rect\b", body))
    texts = len(re.findall(r"<text\b", body))
    fills = sorted(set(re.findall(r'fill="([^"]+)"', body)))
    meta = {
        "input": str(src),
        "kind": "svg",
        "viewBox": vb,
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
        "elements": {
            "paths": paths,
            "polygons": polygons,
            "circles": circles,
            "rects": rects,
            "text": texts
        },
        "fills": fills[:60]
    }
    (out / "logo.svg").write_text(text)
    (out / "logo.inline.svg").write_text(body)
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    reference = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Logo reference</title>
<style>
html,body{{margin:0;width:100%;height:100%;background:#fff;overflow:hidden}}
svg{{display:block;width:1920px;height:1080px}}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
<g transform="translate({x:.4f} {y:.4f}) scale({scale:.8f})">
{body}
</g></svg></body></html>'''
    (out / "reference.html").write_text(reference)
    print(json.dumps(meta, indent=2))
    print(f"wrote {out / 'logo.inline.svg'}")
    print(f"wrote {out / 'reference.html'}")


if __name__ == "__main__":
    main()
