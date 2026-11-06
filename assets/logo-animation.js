(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var uid = 0;

  function clamp(v, a, b) {
    if (a === undefined) a = 0;
    if (b === undefined) b = 1;
    return Math.max(a, Math.min(b, v));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function smooth(t) {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  }
  function easeOut(t) {
    return 1 - Math.pow(1 - clamp(t), 3);
  }
  function easeInOut(t) {
    t = clamp(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutBack(t) {
    t = clamp(t);
    var c = 1.45;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }
  function phase(u, a, b) {
    return clamp((u - a) / (b - a));
  }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      e.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(e);
    return e;
  }
  function setOp(e, v) {
    if (e) e.setAttribute("opacity", clamp(v).toFixed(4));
  }
  function setFillOp(e, v) {
    if (e) e.setAttribute("fill-opacity", clamp(v).toFixed(4));
  }
  function setDash(e, len, p) {
    if (!e) return;
    e.style.strokeDasharray = String(len);
    e.style.strokeDashoffset = String(len * (1 - clamp(p)));
  }
  function setTransform(e, x, y, sx, sy, rot, cx, cy) {
    if (!e) return;
    x = x || 0;
    y = y || 0;
    sx = sx === undefined ? 1 : sx;
    sy = sy === undefined ? 1 : sy;
    rot = rot || 0;
    cx = cx || 0;
    cy = cy || 0;
    e.setAttribute(
      "transform",
      "translate(" + x.toFixed(3) + " " + y.toFixed(3) + ") " +
      "translate(" + cx.toFixed(3) + " " + cy.toFixed(3) + ") " +
      "rotate(" + rot.toFixed(3) + ") " +
      "scale(" + sx.toFixed(4) + " " + sy.toFixed(4) + ") " +
      "translate(" + (-cx).toFixed(3) + " " + (-cy).toFixed(3) + ")"
    );
  }
  function setAttr(e, k, v) {
    if (e) e.setAttribute(k, v);
  }

  var utils = {
    clamp: clamp,
    lerp: lerp,
    smooth: smooth,
    easeOut: easeOut,
    easeInOut: easeInOut,
    easeOutBack: easeOutBack,
    phase: phase,
    el: el,
    setOp: setOp,
    setFillOp: setFillOp,
    setDash: setDash,
    setTransform: setTransform,
    setAttr: setAttr
  };

  function fmt(t) {
    var s = Math.floor(t % 60);
    var m = Math.floor(t / 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function LogoStage(root, options) {
    if (!(this instanceof LogoStage)) return new LogoStage(root, options);
    options = options || {};
    this.root = root;
    this.stage = root.querySelector("[data-logo-stage]");
    if (!this.stage) throw new Error("LogoStage: missing [data-logo-stage]");
    this.options = Object.assign({
      variationNames: ["ORIGINAL", "APERTURE", "KINETIC", "SCANLINE"],
      holdAt: 0.46,
      autoStart: true
    }, options);
    this.renderers = this.options.scenes || global.LOGO_SCENES || {};
    this.sceneGroups = Array.prototype.slice.call(this.stage.querySelectorAll("[data-logo-scene]"));
    if (!this.sceneGroups.length) throw new Error("LogoStage: no [data-logo-scene] found");
    this.scenes = this.sceneGroups.map(function (group, i) {
      var id = group.getAttribute("data-logo-scene") || "scene-" + (i + 1);
      var name = group.getAttribute("data-logo-name") || id.toUpperCase();
      var duration = Number(group.getAttribute("data-logo-duration") || 9);
      var names = group.getAttribute("data-logo-variations");
      return {
        id: id,
        name: name,
        duration: duration > 0 ? duration : 9,
        group: group,
        variationNames: names ? names.split(",").map(function (x) { return x.trim(); }).filter(Boolean) : null,
        render: null,
        start: 0
      };
    });
    var total = 0;
    this.scenes.forEach(function (scene) {
      scene.start = total;
      total += scene.duration;
    });
    this.total = total;
    this.scenes.forEach(function (scene) {
      scene.render = this.renderers[scene.id] || null;
    }, this);
    this.variationByScene = {};
    this.scenes.forEach(function (scene) {
      this.variationByScene[scene.id] = 0;
    }, this);
    this.variationScene = -1;
    this.time = 0;
    this.playing = !global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.loop = true;
    this.chapterMode = false;
    this.chapterEnd = null;
    this.last = global.performance.now();
    this.uid = ++uid;
    this.buildUI();
    this.ensureVariationLayer();
    this.bind();
    this.tick = this.tick.bind(this);
    this.render(0);
    this.readHash();
    if (global.matchMedia("(prefers-reduced-motion: reduce)").matches && !global.location.hash) {
      this.playing = false;
      this.setTime(this.scenes[0].start + this.scenes[0].duration * 0.48);
    }
    this.updateUI();
    global.__logoStage = this;
    global.__seek = this.seek.bind(this);
    global.__play = this.play.bind(this);
    global.__pause = this.pause.bind(this);
    global.__state = this.state.bind(this);
    global.requestAnimationFrame(this.tick);
  }

  LogoStage.prototype.buildUI = function () {
    var self = this;
    this.chapters = this.root.querySelector("[data-logo-chapters]");
    if (this.chapters) {
      this.chapters.innerHTML = "";
      this.scenes.forEach(function (scene, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "logo-chapter";
        b.innerHTML = '<span class="logo-chapter-dot"></span>' + scene.name;
        b.addEventListener("click", function () { self.seekScene(i); });
        self.chapters.appendChild(b);
      });
    }
    this.track = this.root.querySelector("[data-logo-track]");
    if (this.track) {
      this.track.querySelectorAll(".logo-tick").forEach(function (t) { t.remove(); });
      this.scenes.forEach(function (scene, i) {
        if (i === 0) return;
        var tick = document.createElement("div");
        tick.className = "logo-tick";
        tick.style.left = (scene.start / self.total * 100) + "%";
        self.track.appendChild(tick);
      });
      this.track.addEventListener("click", function (e) {
        var r = self.track.getBoundingClientRect();
        self.seek(clamp((e.clientX - r.left) / r.width) * self.total);
      });
    }
    this.progress = this.root.querySelector("[data-logo-progress]");
    this.timeEl = this.root.querySelector("[data-logo-time]");
    this.variationSelect = this.root.querySelector("[data-logo-variation]");
    if (this.variationSelect) {
      this.variationSelect.addEventListener("change", function () {
        self.previewVariation(Number(self.variationSelect.value));
      });
    }
    this.playBtn = this.root.querySelector('[data-logo-action="play"]');
    this.loopBtn = this.root.querySelector('[data-logo-action="loop"]');
    this.root.querySelectorAll("[data-logo-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-logo-action");
        if (action === "play") self.toggle();
        else if (action === "playall") self.playAll();
        else if (action === "loop") self.toggleLoop();
        else if (action === "fullscreen") self.toggleFullscreen();
        else if (action === "clean") self.toggleClean();
      });
    });
    var frame = this.root.querySelector("[data-logo-frame]") || this.stage;
    frame.addEventListener("click", function (e) {
      if (e.target.closest("[data-logo-ui]")) return;
      self.toggle();
    });
  };

  LogoStage.prototype.bind = function () {
    var self = this;
    global.document.addEventListener("keydown", function (e) {
      var tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); self.toggle(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); self.seek(self.time - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); self.seek(self.time + 1); }
      else if (e.key === "r" || e.key === "R") self.playAll();
      else if (e.key === "l" || e.key === "L") self.toggleLoop();
      else if (e.key === "f" || e.key === "F") self.toggleFullscreen();
      else if (e.key === "h" || e.key === "H") self.toggleClean();
      else if (e.key === "Escape" && self.root.classList.contains("is-clean")) self.toggleClean();
      else if (/^[1-9]$/.test(e.key)) {
        var i = Number(e.key) - 1;
        if (i < self.scenes.length) self.seekScene(i);
      }
    });
  };

  LogoStage.prototype.ensureVariationLayer = function () {
    var defs = this.stage.querySelector("defs");
    if (!defs) defs = el("defs", {}, this.stage);
    var id = this.uid;
    this.irisId = "logo-iris-" + id;
    this.scanId = "logo-scan-" + id;
    var iris = el("clipPath", { id: this.irisId, clipPathUnits: "userSpaceOnUse" }, defs);
    this.irisCircle = el("circle", { cx: 960, cy: 540, r: 0 }, iris);
    var scan = el("clipPath", { id: this.scanId, clipPathUnits: "userSpaceOnUse" }, defs);
    this.scanRect = el("rect", { x: 0, y: 1080, width: 1920, height: 0 }, scan);
    this.overlay = el("g", { opacity: 0 }, this.stage);
    this.scanGlow = el("line", {
      x1: 0, y1: 0, x2: 1920, y2: 0,
      stroke: "#5EB2D7", "stroke-width": 18, opacity: 0.22
    }, this.overlay);
    this.scanLine = el("line", {
      x1: 0, y1: 0, x2: 1920, y2: 0,
      stroke: "#E9FBFF", "stroke-width": 2.4, opacity: 0.95
    }, this.overlay);
  };

  LogoStage.prototype.activeIndex = function () {
    var idx = 0;
    for (var i = 0; i < this.scenes.length; i++) {
      if (this.time >= this.scenes[i].start) idx = i;
    }
    return idx;
  };

  LogoStage.prototype.sceneById = function (id) {
    for (var i = 0; i < this.scenes.length; i++) {
      if (this.scenes[i].id === id) return this.scenes[i];
    }
    return null;
  };

  LogoStage.prototype.applyVariation = function (group, u, vi) {
    group.removeAttribute("transform");
    group.removeAttribute("clip-path");
    if (vi === 0 || u < 0.02 || u >= this.options.holdAt) return;
    if (vi === 1) {
      var p = easeInOut(phase(u, 0.02, 0.44));
      this.irisCircle.setAttribute("r", (1200 * p).toFixed(2));
      group.setAttribute("clip-path", "url(#" + this.irisId + ")");
      var s = lerp(0.84, 1, p);
      setTransform(group, 0, 0, s, s, 0, 960, 540);
    } else if (vi === 2) {
      var q = easeInOut(phase(u, 0.03, 0.38));
      var sc = lerp(0.12, 1, easeOutBack(phase(u, 0.03, 0.36)));
      setTransform(group, 0, 0, sc, sc, -540 * (1 - q), 960, 540);
    } else if (vi === 3) {
      var r = easeInOut(phase(u, 0.02, 0.44));
      var y = 1080 * (1 - r);
      this.scanRect.setAttribute("y", y.toFixed(2));
      this.scanRect.setAttribute("height", (1080 - y).toFixed(2));
      group.setAttribute("clip-path", "url(#" + this.scanId + ")");
      this.scanGlow.setAttribute("y1", y.toFixed(2));
      this.scanGlow.setAttribute("y2", y.toFixed(2));
      this.scanLine.setAttribute("y1", y.toFixed(2));
      this.scanLine.setAttribute("y2", y.toFixed(2));
      setOp(this.overlay, smooth(phase(u, 0.02, 0.08)) * (1 - smooth(phase(u, 0.34, 0.42))));
    }
  };

  LogoStage.prototype.defaultRender = function (u, scene) {
    var art = scene.group.querySelector("[data-logo-art]");
    if (!art) return;
    var p = easeOut(phase(u, 0.04, 0.22));
    var fade = u < 0.5 ? 1 : 1 - smooth(phase(u, 0.62, 0.94));
    setOp(art, smooth(phase(u, 0.04, 0.16)) * fade);
    setTransform(art, 0, lerp(20, 0, p), lerp(0.94, 1, p), lerp(0.94, 1, p), 0, 960, 540);
  };

  LogoStage.prototype.render = function (t) {
    if (this.overlay) setOp(this.overlay, 0);
    var self = this;
    this.scenes.forEach(function (scene) {
      var u = (t - scene.start) / scene.duration;
      var active = u >= 0 && u < 1;
      scene.group.style.display = active ? "" : "none";
      if (active) {
        var uu = clamp(u);
        if (scene.render) scene.render(uu, scene, self, self.variationByScene[scene.id]);
        else self.defaultRender(uu, scene);
        self.applyVariation(scene.group, uu, self.variationByScene[scene.id]);
      }
    });
    if (t >= this.total) {
      this.scenes.forEach(function (scene) { scene.group.style.display = "none"; });
    }
  };

  LogoStage.prototype.variationNamesFor = function (scene) {
    return scene.variationNames && scene.variationNames.length ? scene.variationNames : this.options.variationNames;
  };

  LogoStage.prototype.updateVariationUI = function (idx) {
    if (!this.variationSelect) return;
    if (idx !== this.variationScene) {
      this.variationScene = idx;
      var scene = this.scenes[idx];
      var names = this.variationNamesFor(scene);
      this.variationSelect.innerHTML = names.map(function (n, i) {
        return '<option value="' + i + '">' + n + "</option>";
      }).join("");
    }
    var current = this.scenes[Math.min(Math.max(idx, 0), this.scenes.length - 1)];
    this.variationSelect.value = String(this.variationByScene[current.id]);
  };

  LogoStage.prototype.updateUI = function () {
    if (this.progress) this.progress.style.width = (clamp(this.time / this.total) * 100) + "%";
    if (this.timeEl) this.timeEl.textContent = fmt(this.time) + " / " + fmt(this.total);
    if (this.playBtn) {
      this.playBtn.textContent = this.playing ? "PAUSE" : "PLAY";
      this.playBtn.setAttribute("aria-label", this.playing ? "Pause" : "Play");
    }
    if (this.loopBtn) {
      this.loopBtn.textContent = this.loop ? "LOOP ON" : "LOOP OFF";
      this.loopBtn.setAttribute("aria-pressed", String(this.loop));
    }
    var idx = this.activeIndex();
    if (this.chapters) {
      Array.prototype.forEach.call(this.chapters.children, function (b, i) {
        b.classList.toggle("is-active", i === idx && this.time < this.total);
      }, this);
    }
    this.updateVariationUI(idx);
  };

  LogoStage.prototype.setTime = function (t) {
    this.time = clamp(t, 0, this.total);
    this.render(this.time);
    this.updateUI();
  };

  LogoStage.prototype.seek = function (t) {
    this.setTime(t);
  };

  LogoStage.prototype.play = function () {
    if (this.time >= this.total) this.time = 0;
    this.playing = true;
    this.last = global.performance.now();
    this.updateUI();
  };

  LogoStage.prototype.pause = function () {
    this.playing = false;
    this.updateUI();
  };

  LogoStage.prototype.toggle = function () {
    if (this.playing) this.pause(); else this.play();
  };

  LogoStage.prototype.playAll = function () {
    this.chapterMode = false;
    this.chapterEnd = null;
    this.setTime(0);
    this.play();
  };

  LogoStage.prototype.seekScene = function (i) {
    if (i < 0 || i >= this.scenes.length) return;
    this.chapterMode = true;
    this.chapterEnd = this.scenes[i].start + this.scenes[i].duration;
    this.setTime(this.scenes[i].start);
    this.play();
  };

  LogoStage.prototype.setVariation = function (idx, v) {
    var scene = this.scenes[Math.min(Math.max(idx, 0), this.scenes.length - 1)];
    var names = this.variationNamesFor(scene);
    this.variationByScene[scene.id] = Math.min(Math.max(v, 0), names.length - 1);
  };

  LogoStage.prototype.previewVariation = function (v) {
    var idx = this.variationScene >= 0 ? this.variationScene : 0;
    var scene = this.scenes[idx];
    this.setVariation(idx, v);
    this.chapterMode = true;
    this.chapterEnd = scene.start + scene.duration;
    this.setTime(scene.start);
    this.play();
  };

  LogoStage.prototype.toggleLoop = function () {
    this.loop = !this.loop;
    this.updateUI();
  };

  LogoStage.prototype.toggleClean = function () {
    this.root.classList.toggle("is-clean");
  };

  LogoStage.prototype.toggleFullscreen = function () {
    var frame = this.root.querySelector("[data-logo-frame]") || this.stage;
    if (global.document.fullscreenElement) global.document.exitFullscreen();
    else frame.requestFullscreen();
  };

  LogoStage.prototype.tick = function (now) {
    if (this.stopped) return;
    var dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.playing) {
      this.time += dt;
      if (this.chapterMode && this.chapterEnd !== null && this.time >= this.chapterEnd) {
        this.time = this.chapterEnd;
        this.playing = false;
        this.chapterMode = false;
        this.chapterEnd = null;
      } else if (this.time >= this.total) {
        if (this.loop && !this.chapterMode) this.time = this.time % this.total;
        else {
          this.time = this.total;
          this.playing = false;
        }
      }
    }
    this.render(this.time);
    this.updateUI();
    global.requestAnimationFrame(this.tick);
  };

  LogoStage.prototype.readHash = function () {
    var p = new URLSearchParams(global.location.hash.slice(1));
    if (p.has("clean")) this.root.classList.add("is-clean");
    var sceneIdx = -1;
    if (p.has("scene")) {
      var raw = p.get("scene");
      var byId = this.sceneById(raw);
      sceneIdx = byId ? this.scenes.indexOf(byId) : Number(raw);
      if (sceneIdx >= 0 && sceneIdx < this.scenes.length) {
        this.playing = false;
        this.setTime(this.scenes[sceneIdx].start);
      }
    }
    if (p.has("t")) {
      var t = Number(p.get("t"));
      if (isFinite(t)) {
        this.playing = false;
        this.setTime(t);
      }
    }
    if (p.has("variation")) {
      var v = Number(p.get("variation"));
      if (sceneIdx < 0) sceneIdx = this.activeIndex();
      if (sceneIdx >= 0 && sceneIdx < this.scenes.length) {
        this.setVariation(sceneIdx, v);
        if (!p.has("t")) {
          this.playing = false;
          this.setTime(this.scenes[sceneIdx].start);
        }
      }
    }
    if (p.has("loop") && p.get("loop") === "0") this.loop = false;
  };

  LogoStage.prototype.state = function () {
    var idx = this.activeIndex();
    var scene = this.scenes[idx];
    var variations = {};
    this.scenes.forEach(function (s) {
      variations[s.id] = this.variationByScene[s.id];
    }, this);
    return {
      time: this.time,
      playing: this.playing,
      loop: this.loop,
      chapterMode: this.chapterMode,
      scene: scene.id,
      sceneIndex: idx,
      variation: this.variationByScene[scene.id],
      variations: variations
    };
  };

  LogoStage.create = function (root, options) {
    return new LogoStage(root, options);
  };

  LogoStage.utils = utils;

  global.LogoStage = LogoStage;
})(window);
