# Vectorization — from any artwork to animatable paths

The best logo animation starts from a real vector. A raster can work, but a
traced vector gives you paths, holes, per-letter motion, outline traces and a
crisp final frame at any size.

## 1. Prefer the official SVG

Check:

- `viewBox` — the coordinate system; keep it
- `width`/`height` — often safe to drop in an inline stage
- `<style>` classes — scope them so they cannot leak into the page
- embedded `<image>` — a raster inside an SVG is still a raster
- `<text>` — may render differently on another machine; convert to paths when
  the exact wordmark matters
- clip paths and masks — they often carry the logo's holes

If the SVG is a 847-byte file with a handful of tiny paths, it is probably a
failed auto-trace wrapper. Go back to the original raster or ask for the real
vector.

## 2. Normalize for the stage

`scripts/prepare_logo.py` does the mechanical part:

```bash
python3 scripts/prepare_logo.py logo.svg --out logos/my-logo
```

It writes:

- `logo.svg` — the source
- `logo.inline.svg` — the body to paste inside a scene
- `meta.json` — viewBox, elements, fills, placement
- `reference.html` — the logo on a 1920×1080 white stage at the computed
  transform

For an SVG with CSS classes, keep the `<style>` block in the inline body, but
prefix every selector with a scene-scoped class or id. Otherwise a class like
`.cls-1` can collide with the page or another logo.

## 3. Trace a raster

Use Potrace per colour layer, not a single black threshold, unless the logo is
truly monochrome.

```bash
uv run --with pillow --with numpy python scripts/trace_logo.py logo.webp \
  --out logos/my-logo --colors 4
```

The script:

1. finds the foreground (alpha, or a corner-sampled background)
2. quantizes the foreground to `--colors` clusters
3. writes one PBM mask per cluster
4. runs `potrace -s --turdsize 5` for each mask
5. writes `logo.svg`, `logo.inline.svg`, `meta.json`, `reference.html`

### Gradients

A gradient logo can be approximated by:

- **more colour layers** (6–8 clusters) and a small overlap, or
- tracing the union of the gradient colours as one path and filling it with an
  SVG `<linearGradient>` sampled from the source.

A gradient across a multi-letter mark can be one global gradient with
`gradientUnits="userSpaceOnUse"`. Each letter path can reference the same
gradient; the colours then line up across the lockup.

### Per-letter motion

For a wordmark, split the mask into connected components and trace each letter
separately. Keep the paths in reading order (sort by bounding-box `x`) so a
staggered reveal follows the word.

### Outline traces

For every filled path you want to trace, create a copy with:

```html
<path class="ghost" d="…" fill="none" stroke="currentColor"
      stroke-width="24" stroke-linejoin="round" opacity="0"/>
```

The stroke width is in the path's user units. If the path is inside a
`scale(0.1)` Potrace group, a width of 24 becomes about 1.3px on the stage.
Animate with `stroke-dasharray` / `stroke-dashoffset` and hide the ghost at the
hold.

### Colour accuracy

Sample the source at target size, not at 100%. A 2192px-wide raster shown at
1120px averages its own edges; a solid fill sampled from the 2192px original can
look too saturated.

Compare:

```bash
# screenshot reference.html at 1920x1080, then compare
python3 - <<'PY'
from PIL import Image
import numpy as np
a = np.array(Image.open("reference.png").convert("RGB")).astype(int)
b = np.array(Image.open("traced.png").convert("RGB")).astype(int)
d = np.abs(a - b)
print("mean", d.mean(), "pct>10", (d.max(axis=2) > 10).mean() * 100)
PY
```

A clean trace is typically within a few percent `>10` at render size; most of
that is edge anti-aliasing. If the interior colours differ, the palette is off.
If whole shapes are missing, the mask threshold or component filter is wrong.

## 4. What to keep for animation

- **IDs** for the layers you will animate (letters, rings, wordmark groups)
- **ghost paths** for outline traces
- **clip path + rect** for wordmark wipes
- **separate dots** for pops
- **construction geometry** only if it supports the story; delete it at the hold

## 5. Common pitfalls

- A white background path traced as a layer covers everything. Remove it or
  keep it behind the mark.
- Tiny anti-aliasing specks become thousands of paths. Filter components by
  size before tracing.
- A compound path with holes needs the correct fill rule. Potrace preserves
  holes; don't flatten them.
- A wordmark converted to `<text>` may reflow on another machine. Convert to
  paths when exactness matters.
- An `evenodd` clip on a group is not the same as a `nonzero` fill. Check the
  final hold against the source.
- A gradient traced as many flat layers can band. Prefer a real SVG gradient
  over 12 flat clusters.

## 6. Checklist

- `reference.html` matches the source at 1920×1080.
- The final has no ghost, guide or construction path visible.
- Path IDs are stable and meaningful.
- Each animated path has a known length or clip dimension.
- The trace error is documented for raster sources.
- The demo artwork in a public repo is original or properly licensed.
