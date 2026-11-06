# Animation recipes

All snippets assume:

```js
var U = LogoStage.utils;
```

`u` runs `0 → 1` across the scene. The exact final must be reached by
`u = 0.46`; the generic variation is reset there. Reverse runs `0.62–0.94`.

## Exact-hold pattern

Every renderer should end with a full-state branch:

```js
function render(u, scene) {
  var final = u < 0.5 ? 1 : 1 - U.smooth(U.phase(u, 0.62, 0.94));
  U.setOp(scene.group.querySelector(".art"), final);
  // ...other properties...
}
```

At `u = 0.46` every animated child must be at its intended final. A useful QA
check is to seek `start + 0.48 × duration` and compare against a static
reference.

## Outline trace

```js
var ghost = document.getElementById("ring-ghost");
var len = ghost.getTotalLength();
var draw = u < 0.5
  ? U.easeOut(U.phase(u, 0.04, 0.28))
  : 1 - U.easeOut(U.phase(u, 0.70, 0.90));

U.setDash(ghost, len, draw);
U.setOp(ghost, u < 0.5 ? 1 - U.smooth(U.phase(u, 0.26, 0.34)) : 1);
```

For an ellipse or circle where `getTotalLength()` is unavailable, approximate:

```js
function ellipseLen(rx, ry) {
  return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
}
```

## Wordmark clip reveal

```html
<clipPath id="word-clip" clipPathUnits="userSpaceOnUse">
  <rect id="word-clip-rect" x="420" y="0" width="0" height="420"/>
</clipPath>
```

```js
var p = u < 0.5
  ? U.smooth(U.phase(u, 0.14, 0.36))
  : 1 - U.smooth(U.phase(u, 0.70, 0.88));
document.getElementById("word-clip-rect")
  .setAttribute("width", (780 * p).toFixed(2));
```

Pair it with a scan line at the clip edge:

```js
var x = 420 + 780 * p;
line.setAttribute("x1", x);
line.setAttribute("x2", x);
```

## Staggered letters

Sort the letter nodes by `getBBox().x` once, then use a small per-letter delay:

```js
var letters = [...scene.group.querySelectorAll(".letter")]
  .sort((a, b) => a.getBBox().x - b.getBBox().x);

letters.forEach(function (el, i) {
  var p = U.easeOutBack(U.phase(u, 0.10 + i * 0.025, 0.24 + i * 0.025));
  var b = el.getBBox();
  U.setTransform(el, 0, (1 - p) * 12, p, p, 0, b.x + b.width / 2, b.y + b.height);
  U.setOp(el, p);
});
```

## Orbit rings and pulses

Draw two elliptical guides, then run dots around them:

```js
var rings = [
  { el: ringA, len: ellipseLen(150, 86) },
  { el: ringB, len: ellipseLen(92, 50) }
];

rings.forEach(function (r, i) {
  var p = u < 0.5
    ? U.easeOut(U.phase(u, 0.04 + i * 0.03, 0.28 + i * 0.03))
    : 1 - U.easeOut(U.phase(u, 0.70 + i * 0.02, 0.90 + i * 0.02));
  U.setDash(r.el, r.len, p);
});

var t = u * 0.8;
var x = 960 + Math.cos(t * Math.PI * 2) * 560;
var y = 540 + Math.sin(t * Math.PI * 2) * 210;
pulse.setAttribute("cx", x);
pulse.setAttribute("cy", y);
```

## Particle / constellation assembly

Sample points from a real path, then converge them:

```js
var path = document.getElementById("logo-outline");
var total = path.getTotalLength();
var pts = [];
for (var i = 0; i < 40; i++) {
  var p = path.getPointAtLength(total * (i + 0.5) / 40);
  pts.push({ x: p.x, y: p.y });
}
```

```js
var gather = U.easeOut(U.phase(u, 0.08, 0.30));
nodes.forEach(function (n, i) {
  var t = U.easeOut(U.clamp(gather - n.delay));
  n.el.setAttribute("cx", U.lerp(n.start.x, n.target.x, t));
  n.el.setAttribute("cy", U.lerp(n.start.y, n.target.y, t));
});
```

Connect consecutive points with lines whose dash offset follows the same
progress. Fade the whole construction group out by `u = 0.42`.

## Slice assembly

Clip a copy of the artwork into horizontal bands and slide each band into
register:

```html
<clipPath id="slice-0"><rect x="0" y="0" width="1200" height="105"/></clipPath>
<clipPath id="slice-1"><rect x="0" y="105" width="1200" height="105"/></clipPath>
```

```js
bands.forEach(function (band, i) {
  var p = U.easeOut(U.clamp(assemble * 1.35 - i * 0.02));
  var dx = (i % 2 ? -1 : 1) * 260 * (1 - p);
  band.setAttribute("transform", "translate(" + dx + " 0)");
});
```

Fade the bands out and the single official copy in by `u = 0.40`.

## Scan line

```js
var p = U.easeInOut(U.phase(u, 0.02, 0.44));
var y = 1080 * (1 - p);
scanRect.setAttribute("y", y);
scanRect.setAttribute("height", 1080 - y);
```

The generic `SCANLINE` variation already does this for the whole scene. Use a
custom scan when you want it inside the logo bounds or aligned to a wordmark.

## Reverse

Reverse should be visible, not just a fade:

```js
var rev = U.smooth(U.phase(u, 0.62, 0.90));
U.setDash(ghost, len, 1 - rev);
wordClip.setAttribute("width", (full * (1 - rev)).toFixed(2));
U.setOp(art, 1 - U.smooth(U.phase(u, 0.62, 0.94)));
```

Finish blank by `u ≈ 0.94`.

## Variant branching

For bespoke variations, the engine passes the selected index:

```js
function render(u, scene, stage, variation) {
  if (variation === 1) return apertureVariant(u, scene);
  if (variation === 2) return kineticVariant(u, scene);
  if (variation === 3) return scanVariant(u, scene);
  return originalVariant(u, scene);
}
```

Set the engine's generic variation to `ORIGINAL` for that scene so the two
systems do not stack:

```js
LogoStage.create(root, { holdAt: 0.46 });
```

The default selector already includes the four generic names. If you use
bespoke variants, keep the names descriptive:

```html
<g data-logo-scene="logo" data-logo-variations="TRACE,MASK,SPIN,SCAN">
```

## Default renderer

If a scene has no renderer, the engine animates `[data-logo-art]`:

```html
<g data-logo-scene="logo">
  <g data-logo-art><image href="logo.svg" .../></g>
</g>
```

This is the quickstage path. It fades and rises the artwork, then fades it out
on reverse. Generic variations layer on top.
