# Workflow — any logo, from file to film

This is the full process the `logo-animation` skill follows. The short version:
**prepare the artwork → place it on a 16:9 stage → animate children → verify the
hold → render.**

## 0. Inventory

Ask for:

- the logo file (SVG preferred; PNG/WebP/JPEG if that is all that exists)
- whether it is official artwork or a raster export
- whether the user wants one clip, a multi-logo film, or selectable variations
- the background: white stage or a custom colour

Never assume a brand colour from a screenshot. Sample the artwork or ask.

## 1. Prepare

For an SVG:

```bash
python3 scripts/prepare_logo.py path/to/logo.svg --out logos/my-logo
```

Open `logos/my-logo/meta.json`:

- `viewBox` — the coordinate system
- `elements` — paths/polygons/circles/text
- `fills` — useful for layer naming and ghost colours
- `placement` — the `transform` that centres the logo on the 1920×1080 stage

For a raster:

```bash
uv run --with pillow --with numpy python scripts/trace_logo.py path/to/logo.webp \
  --out logos/my-logo --colors 4
```

Review `reference.html` at 1920×1080. If the trace is too coarse:

- raise `--colors` (6–8 for gradients)
- reduce it if the logo is flat
- trace the official vector instead when one exists

## 2. Place on the stage

The stage is always `viewBox="0 0 1920 1080"`. The prepared `placement` puts the
logo at a 1120px target width and centres it vertically. For a short horizontal
lockup that is usually right; for a square mark use a smaller target width.

```html
<g transform="translate(400 338.68) scale(0.75727)">
  …logo…
</g>
```

The stage is white by default. If the logo is white, change the stage background
in the CSS or wrap the scene in a dark card.

## 3. Choose the stage

### quickstage — any image, four variations

Use `templates/quickstage.html` when the logo is a single image and a generic
rise + variation is enough. Replace the `href`; the template fits the image by
intrinsic size. No renderer is required; the engine default animates
`[data-logo-art]`.

### stage — per-element motion

Use `templates/stage.html` when you need to:

- trace a path or ring with `stroke-dasharray`
- clip a wordmark in
- stagger letters
- animate rings, nodes, pulses, or construction lines

Copy the template, paste the inline SVG, and write a renderer:

```js
window.LOGO_SCENES = {
  logo: function (u, scene, stage, variation) {
    var U = LogoStage.utils;
    // animate children; exact final by u = 0.46
  }
};
LogoStage.create(document.querySelector("[data-logo-app]"));
```

Animate **children** of the scene. The engine owns the scene group's
`transform` and `clip-path` and resets them every frame.

## 4. Timing contract

Each scene is 9s by default (`data-logo-duration`). `u = (t - start) / duration`.

Suggested timeline:

| u | phase |
|---|---|
| 0.00–0.02 | blank |
| 0.02–0.12 | guides / construction in |
| 0.10–0.34 | trace or wordmark reveal |
| 0.28–0.42 | fills / settle |
| **0.46** | **exact final** |
| 0.46–0.62 | hold |
| 0.62–0.94 | reverse |
| 0.94–1.00 | blank |

The engine resets the generic variation at `u = 0.46`. Your renderer must also
be at its final there. If you need a longer hold, finish earlier or reduce the
reverse window.

## 5. Variations

The engine provides four whole-scene behaviours:

- `ORIGINAL` — your renderer (or the default rise)
- `APERTURE` — iris clip + scale
- `KINETIC` — spin-in
- `SCANLINE` — bottom-up strip + scanner

Rename them per scene:

```html
<g data-logo-scene="logo" data-logo-variations="ORIGINAL,FADE,SPIN,SCAN">
```

The behaviours still map to indices 0–3. For four **bespoke** styles, keep the
engine on `ORIGINAL` and branch inside the renderer on the fourth argument:

```js
function (u, scene, stage, variation) {
  if (variation === 1) return fadeVariant(u, scene);
  if (variation === 2) return spinVariant(u, scene);
  return original(u, scene);
}
```

## 6. Multi-logo film

Duplicate the scene block and register a renderer for each id:

```html
<g data-logo-scene="one" data-logo-name="ONE" data-logo-duration="9">…</g>
<g data-logo-scene="two" data-logo-name="TWO" data-logo-duration="9">…</g>
```

```js
window.LOGO_SCENES = { one: renderOne, two: renderTwo };
```

The engine builds chapters, computes starts, and sums the total duration.

## 7. Verify

```bash
node scripts/verify.js templates/stage.html verify
```

It seeks each scene to `start + 0.48 × duration`, captures a clean screenshot,
checks the `[data-logo-check]` group is non-empty and visible, checks the end frame is
blank, and reports console errors.

Then compare the hold to `reference.html`:

```bash
# screenshot reference.html at 1920x1080, then compare with the hold PNG
python3 - <<'PY'
from PIL import Image, ImageChops
a = Image.open("verify/logo.png").convert("RGB")
b = Image.open("reference.png").convert("RGB")
d = ImageChops.difference(a, b)
print("mean", sum(d.convert("L").getdata()) / (a.width * a.height))
PY
```

For raster sources, expect a small edge/shape difference. If the difference is
large, revisit the trace (more colours, cleaner mask, or official SVG).

## 8. Render

```bash
./scripts/render.sh templates/stage.html logo-1080p60.mp4
FPS=60 START=0 DURATION=9 ./scripts/render.sh templates/stage.html scene.mp4
```

`render.sh` clears `render_frames/`, captures PNGs with headless Chrome, and
encodes H.264 with ffmpeg. Use `scripts/render.js` directly for custom frame
ranges or a different fps.

## 9. Publish safely

If the work is going into a public repo:

- keep only original neutral demo artwork
- do not commit customer logos, internal hosts, tokens or private decks
- document the source and licence of any artwork that is included
- run the secret scan in `AGENTS.md` before committing
