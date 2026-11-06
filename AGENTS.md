# AGENTS.md — working rules for this repository

This is the public, generic home of the LogoStage kit and the `logo-animation`
skill. Keep it reusable, small, and free of anything environment-specific.

## Layout

```
assets/logo-animation.js       engine: timeline, chapters, variations, UI
assets/logo-animation.css      stage + player chrome
templates/quickstage.html      drop-in image/SVG + default renderer
templates/stage.html           inline-SVG starter with a custom renderer
examples/orbit-logo.svg        neutral demo logo
scripts/prepare_logo.py        SVG inspection + placement + reference
scripts/trace_logo.py          raster → layered SVG via Potrace
scripts/verify.js              headless hold/blank/error check
scripts/render.js              CDP frame capture
scripts/render.sh              capture + ffmpeg H.264
reference/                     workflow, recipes, vectorization, verification
install.sh                     link/copy into Claude, Hermes, OpenCode
SKILL.md                       installed agent skill
README.md                      human overview
```

## Hard rules

1. **No brand or confidential data.** Never add real company logos, customer
   names, internal hostnames, IP addresses, credentials, tokens or private
   assets. The only artwork in the repo is `examples/orbit-logo.svg`, which is
   an original neutral demo mark.
2. **Zero runtime dependencies for the stage.** The template uses one CSS file
   and one JS file. No build step, bundler, framework, CDN or network access.
   It must work over `file://`.
3. **Keep the scene contract stable.** `data-logo-scene`,
   `data-logo-duration`, `data-logo-name`, `data-logo-variations`,
   `[data-logo-art]`, `[data-logo-check]`, `window.LOGO_SCENES` and `LogoStage.utils` are public.
   Breaking them requires updating the engine, templates, SKILL.md, README.md
   and reference docs in the same commit.
4. **Exact hold is a rule, not a suggestion.** Custom renderers must reach the
   intended final by `u = 0.46`. The generic variation is reset there. The
   verification script checks the hold frame.
5. **The engine owns the scene group.** Custom renderers animate children.
   Do not write `transform` or `clip-path` on the scene group.
6. **Variations are four fixed behaviours.** `ORIGINAL`, `APERTURE`,
   `KINETIC`, `SCANLINE`. Renaming them per scene is fine; changing their
   indices is a breaking change.
7. **Accessibility stays in.** Keep reduced-motion hold behaviour, keyboard
   controls, the `clean` capture mode and the player labels.
8. **No automatic asset fetching.** The stage must not depend on a server.
9. **Public-safe verification.** Run the secret scan before committing:
   `git grep -n -i -E 'password|secret|token|api[_-]?key|internal|prod'`.
   The only allowed hits are documentation words and the engine's own logic.

## How to test

```bash
node scripts/verify.js templates/stage.html verify
node scripts/verify.js templates/quickstage.html verify-quick
```

Manual checklist:

- The stage has at least one `[data-logo-scene]`.
- The scene has a `data-logo-duration`.
- The custom renderer reaches the final by `u = 0.46`.
- The hold screenshot is non-empty.
- The end frame is blank or the next scene.
- No console errors.
- The page opens directly from `file://`.

## Definition of done

- `scripts/verify.js` passes for both templates.
- `npm`/`node` and Python scripts parse (`node --check`, `python3 -m py_compile`).
- README/SKILL/reference match the engine.
- `install.sh` links/copies into all three agent skill directories.
- No secrets, no brand assets, no internal names.

## Adding a demo

1. Keep it neutral: use the Orbit mark or another original shape.
2. Put the scene in a template or a new file under `examples/`.
3. If it uses a renderer, register it in `window.LOGO_SCENES` before
   `LogoStage.create`.
4. Do not add binary assets unless they are small, original and MIT-compatible.
5. Update the README links and, if the demo exercises new behaviour, the
   verification command.
