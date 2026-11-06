# logo-animation

An agent skill and a zero-dependency **16:9 HTML logo animation stage** for any
SVG or raster logo. Prepare or trace the artwork, choose generic variations or
write a bespoke scene renderer, verify frame-exact holds, and render an MP4.

Works as a skill for [Claude Code](https://claude.com/claude-code), Hermes, and
OpenCode.

```text
data-logo-scene  ──►  renderer(u)  ──►  exact hold at u >= 0.46
       │                    │
       └─ engine owns ──────┴─ transform / clip / variation
          the scene group
```

## Why another animation kit?

Most logo animations are one-off timelines with no verification and no
repeatable workflow. This kit keeps the reusable parts:

- a fixed 1920×1080 stage and a player with chapters, seeking and deep links
- four whole-scene variations: `ORIGINAL`, `APERTURE`, `KINETIC`, `SCANLINE`
- a scene contract that makes the exact final frame explicit
- headless-Chrome hold / blank / error checks
- frame capture and H.264 export with ffmpeg
- SVG preparation and a Potrace recipe for raster logos

The demo logo is neutral (`examples/orbit-logo.svg`). No brand artwork is
included.

## Quick start

Open [`templates/quickstage.html`](templates/quickstage.html) in a browser. It
fits any logo image into the stage and gives you the four generic variations.

Replace:

```html
<image id="logo-image" href="my-logo.svg" x="0" y="0" width="100" height="100"/>
```

For per-element motion, copy [`templates/stage.html`](templates/stage.html) and
edit the `LOGO_SCENES.orbit` renderer.

## Install as a skill

```bash
git clone https://github.com/groundsada/logo-animation-skill
cd logo-animation-skill
./install.sh            # symlink into Claude Code, Hermes, OpenCode
./install.sh --copy     # copy instead
```

The installer links:

- `~/.claude/skills/logo-animation`
- `~/.hermes/skills/logo-animation`
- `~/.config/opencode/skills/logo-animation`

Then ask your agent to animate a logo; the skill is picked up automatically.

## Prepare a logo

```bash
python3 scripts/prepare_logo.py path/to/logo.svg --out logos/my-logo
```

Writes:

- `logo.svg` — original vector
- `logo.inline.svg` — body to paste into a scene
- `meta.json` — viewBox, element counts, fills and stage placement
- `reference.html` — static 1920×1080 reference at the computed transform

For a raster source:

```bash
uv run --with pillow --with numpy python scripts/trace_logo.py path/to/logo.webp \
  --out logos/my-logo --colors 4
```

`trace_logo.py` colour-segments the image, traces each layer with Potrace, and
writes the same files plus `colors`. It is a starting point: review the
reference, raise `--colors` for gradients, and simplify the layers if needed.

## Stage contract

```html
<g data-logo-scene="logo"
   data-logo-name="LOGO"
   data-logo-duration="9"
   data-logo-variations="ORIGINAL,APERTURE,KINETIC,SCANLINE">
  <g data-logo-art data-logo-check>…</g>
</g>
```

- No renderer → the engine fades/rises `[data-logo-art]` (quickstage mode).
- Mark the final artwork group with `[data-logo-check]` (quickstage does this).
- With a renderer → `window.LOGO_SCENES.logo = function (u, scene, stage, variation) { … }`.
- Animate children. The engine owns the scene group's `transform` and
  `clip-path`.
- Reach the final by `u = 0.46`; the generic variation is reset there.
- Reverse runs `0.62–0.94`.

## Variations

| index | name | behaviour |
|---|---|---|
| 0 | `ORIGINAL` | scene renderer / default rise |
| 1 | `APERTURE` | circular iris clip + settle |
| 2 | `KINETIC` | spin-in with scale |
| 3 | `SCANLINE` | bottom-up strip reveal + scan line |

The variation selector is built into the player. `data-logo-variations` renames
the four slots per scene. For four bespoke styles, keep the engine on
`ORIGINAL` and branch on the `variation` argument in the renderer.

## Verify

```bash
node scripts/verify.js templates/stage.html verify
node scripts/verify.js templates/quickstage.html verify-quick
```

The script launches headless Chrome, collects console errors, seeks each scene
to `start + 0.48 × duration`, captures a clean screenshot, and checks that the
scene has a non-empty `getBBox()` and is visible. It also checks that every
scene is hidden at the end. Results and screenshots land in `verify/`.

## Render

```bash
./scripts/render.sh templates/stage.html logo-1080p60.mp4

# one 9s scene from t=0
FPS=60 START=0 DURATION=9 ./scripts/render.sh templates/stage.html logo.mp4
```

`render.sh` clears `render_frames/`, captures PNGs with Chrome CDP, and encodes
H.264 with ffmpeg. `scripts/render.js` can be called directly for custom frame
ranges.

## Deep links

```text
templates/stage.html#scene=0&t=4.3&variation=1&clean=1
templates/stage.html#scene=orbit&variation=2
```

`clean=1` hides the player chrome for capture. The same parameters are read by
`verify.js` and `render.js` when they append `clean=1`.

## Files

```text
assets/logo-animation.js       timeline, chapters, variations, UI
assets/logo-animation.css      16:9 stage + controls
templates/quickstage.html      drop-in image/SVG
templates/stage.html           inline-SVG starter with a custom renderer
examples/orbit-logo.svg        neutral demo artwork
scripts/prepare_logo.py        SVG inspection + placement
scripts/trace_logo.py          raster → layered SVG via Potrace
scripts/verify.js              headless hold/blank/error check
scripts/render.js              CDP frame capture
scripts/render.sh              capture + ffmpeg
reference/                     workflow, recipes, vectorization, verification
```

## Requirements

- Node 22+ (global `fetch` and `WebSocket` for CDP)
- Google Chrome or Chromium
- ffmpeg for MP4 export
- Python 3.9+ for SVG prep; Pillow + numpy for raster tracing; Potrace for
  raster tracing

The stage itself has **no runtime dependencies** and works over `file://`.

## License

MIT — see [LICENSE](LICENSE).
