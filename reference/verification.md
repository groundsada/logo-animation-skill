# Verification — prove the hold, the blanks and the liveness

A logo animation can look fine while playing and still be broken at the one
frame that matters: the hold. The skill uses headless Chrome to seek, capture
and inspect.

## 1. Hold / blank / console check

```bash
node scripts/verify.js templates/stage.html verify
node scripts/verify.js templates/quickstage.html verify-quick
```

For each scene, the script:

1. seeks to `start + 0.48 × duration` (the hold)
2. waits two animation frames
3. reads `window.__state()` and the `[data-logo-check]` group's `getBBox()`
4. captures a clean screenshot to `verify/<scene>.png`
5. marks the hold `PASS` only if the check group is visible and its box is non-empty

Then it seeks to `total` and checks that every scene is `display: none`.
It writes `verify/report.json` and exits non-zero on errors, empty holds or a
non-blank end.

The page is opened with `#clean=1` so the screenshots show the stage only.

## 2. Reference comparison

`scripts/prepare_logo.py` and `scripts/trace_logo.py` write
`reference.html`. Screenshot it at 1920×1080, then compare with the hold PNG:

```python
from PIL import Image
import numpy as np

a = np.array(Image.open("reference.png").convert("RGB")).astype(int)
b = np.array(Image.open("verify/logo.png").convert("RGB")).astype(int)
d = np.abs(a - b)
print("mean", d.mean())
print("pct>10", (d.max(axis=2) > 10).mean() * 100)
```

Use a logo crop box rather than the whole 1920×1080 frame. A vector final should
be near zero; a raster trace usually keeps a small edge difference (often
0.5–3% `>10` at render size). Document the number for a traced logo.

## 3. Liveness

A frozen frame can still pass a single hold check. Sample several times:

```bash
node scripts/verify.js templates/stage.html verify
# inspect verify/*.png
```

Or add a small loop that seeks `0.15, 0.25, 0.35, 0.48, 0.70, 0.85` and captures
the stage. The exact frames are less important than confirming that:

- something is visible during the entry
- the hold is fully composed
- the reverse ends blank
- no frame is accidentally identical to its neighbour for the whole scene

## 4. Render check

After `./scripts/render.sh`, extract a frame at the hold time and compare:

```bash
ffmpeg -y -ss 4.3 -i logo-1080p60.mp4 -frames:v 1 hold.png
```

The encoded frame should match `verify/logo.png` within compression error.

## 5. Common failures

| symptom | likely cause |
|---|---|
| hold empty | renderer finishes after `u = 0.46`, or an opacity/clip is still 0 |
| hold has a ghost | ghost/construction group not faded at the hold |
| variation leaks into the hold | custom renderer wrote `transform`/`clip-path` on the scene group, fighting the engine |
| end not blank | reverse window too short or a group's opacity never reaches 0 |
| console error | missing id, bad path data, or a selector returning `null` |
| text reflows | `<text>` rendered on another machine; convert to paths |
| trace looks chunky | too few colour layers or a low-resolution source |
| trace has specks | component/threshold filter too permissive |

## 6. Accessibility

The engine pauses when the user prefers reduced motion and seeks to the first
hold instead of playing. It also provides keyboard controls and a `clean=1`
capture mode. Keep those behaviours when customising.

## 7. Public-safe check

Before publishing:

```bash
git grep -n -i -E 'password|secret|token|api[_-]?key|internal|prod'
```

Review every hit. The only allowed matches are documentation words and the
engine's own logic. Never commit real logos, customer names, internal hosts or
private decks.
