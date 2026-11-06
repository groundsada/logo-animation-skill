const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));
const FPS = Number(args.fps || 60);
const START = Number(args.start || 0);
const DURATION = Number(args.duration || 9);
const COUNT = Math.round(FPS * DURATION);
const OUT = path.resolve(args.out || path.join(ROOT, "render_frames"));
const PAGE = toUrl(args.page || path.join("templates", "stage.html"));
const RUN_PAGE = PAGE.includes("#") ? PAGE + "&clean=1" : PAGE + "#clean=1";
const PORT = 9300 + Math.floor(Math.random() * 500);
const CHROME = pickChrome();

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[k] = v;
    }
  }
  return out;
}

function toUrl(p) {
  if (/^[a-z]+:/i.test(p)) return p;
  return "file://" + path.resolve(ROOT, p);
}

function pickChrome() {
  const candidates = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);
  for (const c of candidates) {
    if (c.includes(path.sep) && fs.existsSync(c)) return c;
  }
  return "google-chrome";
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(x => x.type === "page");
      if (page) return page;
    } catch {}
    await sleep(100);
  }
  throw new Error("Chrome target not found");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { res, rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      close() { ws.close(); }
    });
    ws.onerror = reject;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
      }
    };
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--enable-unsafe-swiftshader",
    "--allow-file-access-from-files",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=/tmp/logo-skill-render-${PORT}`,
    RUN_PAGE
  ], { stdio: "ignore" });

  try {
    const target = await getTarget();
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false
    });
    for (let i = 0; i < 100; i++) {
      const r = await cdp.send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
      if (r.result.value === "complete") break;
      await sleep(100);
    }
    for (let i = 0; i < 100; i++) {
      const r = await cdp.send("Runtime.evaluate", { expression: "Boolean(window.__seek)", returnByValue: true });
      if (r.result.value) break;
      await sleep(100);
    }
    await sleep(400);
    const started = Date.now();
    for (let i = 0; i < COUNT; i++) {
      const t = START + i / FPS;
      await cdp.send("Runtime.evaluate", {
        expression: `(async()=>{window.__pause();window.__seek(${t});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true})()`,
        awaitPromise: true,
        returnByValue: true
      });
      const shot = await cdp.send("Page.captureScreenshot", {
        format: "png", fromSurface: true, captureBeyondViewport: false
      });
      fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, "0")}.png`), Buffer.from(shot.data, "base64"));
      if (i % 60 === 0 || i === COUNT - 1) {
        const elapsed = ((Date.now() - started) / 1000).toFixed(1);
        const eta = ((Date.now() - started) / (i + 1) * (COUNT - i - 1) / 1000).toFixed(1);
        console.log(`frame ${i + 1}/${COUNT}  ${elapsed}s  eta ${eta}s`);
      }
    }
    cdp.close();
    chrome.kill("SIGTERM");
    console.log(`done ${COUNT} frames in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${OUT}`);
  } catch (e) {
    console.error(e);
    chrome.kill("SIGTERM");
    process.exitCode = 1;
  }
})();
