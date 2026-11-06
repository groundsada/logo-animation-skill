---
name: logo-animation
description: "Build 16:9 HTML logo animations for any SVG or raster logo: prepare or trace the artwork, design reusable variations, verify frame-exact holds, and render MP4. Use when the user asks to animate a logo, create a logo motion study, add logo variations, trace a raster logo, or export a logo video."
---

# Logo Animation

A zero-dependency HTML stage and workflow for animating **any** logo. It is the
generic version of the multi-logo motion studies this workflow was built from:
the same stage, timeline, variation picker, verification loop and MP4 renderer,
without any brand data.

The kit is deliberately small:

- `assets/logo-animation.js` — timeline, chapters, variations, deep links, UI.
- `assets/logo-animation.css` — 16:9 stage and player controls.
- `templates/quickstage.html` — drop in any image/SVG and get four variations.
- `templates/stage.html` — inline-SVG starter with a custom traced scene.
- `scripts/prepare_logo.py` — inspect an SVG, compute placement, emit inline SVG.
- `scripts/trace_logo.py` — colour-segment a raster logo and trace it with Potrace.
- `scripts/verify.js` — headless Chrome hold / blank / console check.
- `scripts/render.js` + `render.sh` — capture frames and encode H.264.

## Quick start

Open `templates/quickstage.html` in a browser. It fits any logo image into the
stage and provides `ORIGINAL`, `APERTURE`, `KINETIC` and `SCANLINE` variations.

Replace the image source:

```html
<image id="logo-image" href="my-logo.svg" x="0" y="0" width="100" height="100"/>
```

The inline script probes the intrinsic size and centers the artwork. For
non-image SVGs or per-element animation, use `templates/stage.html`.

## Deep workflow

1. **Inventory the artwork.** Prefer an official SVG. If only PNG/WebP/JPEG
   exists, trace it first.
2. **Prepare an SVG.**
   ```bash
   python3 scripts/prepare_logo.py path/to/logo.svg --out logos/my-logo
   ```
   It writes `logo.svg`, `logo.inline.svg`, `meta.json` and a static
   `reference.html` with the computed stage transform.
3. **Trace a raster logo.**
   ```bash
   uv run --with pillow --with numpy python scripts/trace_logo.py path/to/logo.webp \
     --out logos/my-logo --colors 4
   ```
   Colour layers become separate paths. Review `reference.html`; if the trace is
   too coarse, raise `--colors` or trace the official vector instead.
4. **Choose a stage.**
   - One-off / generic: `templates/quickstage.html`.
   - Bespoke per-element motion: `templates/stage.html`.
   - Many logos: duplicate the `<g data-logo-scene>` block and add a renderer
     for each scene.
5. **Animate children, not the scene.** The engine owns the scene group's
   `transform` and `clip-path` for the generic variations. Custom renderers
   animate groups and paths **inside** the scene.
6. **Finish by `u = 0.46`.** The engine resets the generic variation at
   `u >= 0.46`; the scene must be at its exact final there. Reverse runs
   `0.62–0.94`. Scene duration defaults to `9s`.
7. **Verify.**
   ```bash
   node scripts/verify.js templates/stage.html verify
   node scripts/verify.js templates/quickstage.html verify-quick
   ```
8. **Render.**
   ```bash
   ./scripts/render.sh templates/stage.html logo-1080p60.mp4
   # or
   FPS=60 START=0 DURATION=9 ./scripts/render.sh templates/stage.html logo.mp4
   ```

## Scene contract

```html
<g data-logo-scene="orbit"
   data-logo-name="ORBIT"
   data-logo-duration="9"
   data-logo-variations="ORIGINAL,APERTURE,KINETIC,SCANLINE">
  ...
</g>
```

```js
window.LOGO_SCENES = {
  orbit: function (u, scene, stage, variation) {
    var U = LogoStage.utils;
    // animate children; reach the exact final by u = 0.46
  }
};
LogoStage.create(document.querySelector("[data-logo-app]"));
```

- `u` runs `0 → 1` over the scene duration.
- `scene.group` is the scene element; `stage` is the engine.
- `variation` is the selected index. Use it for bespoke variations; the engine
  also applies its generic whole-scene treatment unless the index is `0`.
- No renderer? The engine fades/rises `[data-logo-art]` automatically. This is
  what `quickstage.html` uses.
- Mark the final artwork group with `[data-logo-check]` so `verify.js` measures
  the logo, not construction geometry that is hidden at the hold.
- Renderers should not touch the scene group's `transform`/`clip-path`; the
  engine resets those every frame.

## Built-in variations

| index | name | behaviour |
|---|---|---|
| 0 | `ORIGINAL` | the scene renderer / default rise |
| 1 | `APERTURE` | circular iris clip + settle |
| 2 | `KINETIC` | spin-in with scale |
| 3 | `SCANLINE` | bottom-up strip reveal + scan line |

`data-logo-variations` only renames them per scene; the behaviours stay the
same. For four truly bespoke styles, keep the engine on `ORIGINAL` and branch
inside the renderer on `variation`.

## Engine API

```js
var stage = LogoStage.create(root, { holdAt: 0.46 });
stage.seek(4.3);
stage.play();
stage.pause();
stage.playAll();
stage.seekScene(2);
stage.previewVariation(1);
stage.setVariation(0, 2);
stage.state();
```

Deep links: `#scene=0&t=4.3&variation=1&clean=1` or
`#scene=orbit&variation=2`. `clean=1` hides the player chrome for capture.

`LogoStage.utils` exposes `clamp`, `lerp`, `smooth`, `easeOut`, `easeInOut`,
`easeOutBack`, `phase`, `el`, `setOp`, `setFillOp`, `setDash`, `setTransform`,
`setAttr`.

## Recipes

See [`reference/animation-recipes.md`](reference/animation-recipes.md) for:

- outline trace with `setDash`
- wordmark clip reveal
- staggered letter pop
- orbit rings and travelling pulses
- particle / constellation assembly
- slice / scan-line assembly
- reverse un-draw

For raster fidelity, see [`reference/vectorization.md`](reference/vectorization.md).
For the full preparation flow, see [`reference/workflow.md`](reference/workflow.md).
For the verification contract, see [`reference/verification.md`](reference/verification.md).

## QA rules

1. **Exact hold.** At `u >= 0.46` the scene is the intended final; no faded
   ghost, construction line, or variation clip remains.
2. **No accidental blanks.** The first frame may be blank; the hold must not.
   The frame at scene end must be blank or the next scene.
3. **No console errors.** `verify.js` collects `Runtime.exceptionThrown` and
   error-level log entries.
4. **Reverse is real.** The scene must un-draw/fade to blank by `u ≈ 0.94`.
5. **Trace honestly.** For raster sources, compare the traced `reference.html`
   against the source; keep the colour layers and note edge error.
6. **Public-safe.** Do not commit brand logos, customer names, internal hosts,
   tokens or private assets into a public repo. Use neutral demo artwork.

## Files

```
assets/logo-animation.js       engine
assets/logo-animation.css      stage + UI
templates/quickstage.html      drop-in image/SVG, default renderer
templates/stage.html           inline-SVG starter with custom renderer
examples/orbit-logo.svg        neutral demo logo
scripts/prepare_logo.py        SVG inspection + placement + reference
scripts/trace_logo.py          raster → layered SVG via Potrace
scripts/verify.js              headless Chrome hold/blank/error check
scripts/render.js              frame capture via CDP
scripts/render.sh              capture + ffmpeg H.264
reference/                     workflow, recipes, vectorization, verification
```

## Install as a skill

```bash
./install.sh            # symlink into Claude Code, Hermes, OpenCode
./install.sh --copy     # copy instead
```

The installer links `~/.claude/skills/logo-animation`,
`~/.hermes/skills/logo-animation` and
`~/.config/opencode/skills/logo-animation`.

## License

MIT. See [LICENSE](LICENSE).
