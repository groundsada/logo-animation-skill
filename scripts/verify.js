const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RAW_PAGE = process.argv[2] || path.join(ROOT, "templates", "stage.html");
const PAGE = /^[a-z]+:/i.test(RAW_PAGE) ? RAW_PAGE : "file://" + path.resolve(ROOT, RAW_PAGE);
const RUN_PAGE = PAGE.includes("#") ? PAGE + "&clean=1" : PAGE + "#clean=1";
const OUT = path.resolve(process.argv[3] || path.join(ROOT, "verify"));
const PORT = 9300 + Math.floor(Math.random() * 500);
const CHROME = pickChrome();

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

function connect(url, onEvent) {
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
      } else if (onEvent) {
        onEvent(m);
      }
    };
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const errors = [];
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--enable-unsafe-swiftshader",
    "--allow-file-access-from-files",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=/tmp/logo-skill-verify-${PORT}`,
    RUN_PAGE
  ], { stdio: "ignore" });

  try {
    const target = await getTarget();
    const cdp = await connect(target.webSocketDebuggerUrl, m => {
      if (m.method === "Runtime.exceptionThrown") {
        errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "exception");
      }
      if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
        errors.push(m.params.entry.text);
      }
    });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false
    });

    for (let i = 0; i < 100; i++) {
      const r = await cdp.send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
      if (r.result.value === "complete") break;
      await sleep(100);
    }
    for (let i = 0; i < 100; i++) {
      const r = await cdp.send("Runtime.evaluate", { expression: "Boolean(window.__logoStage)", returnByValue: true });
      if (r.result.value) break;
      await sleep(100);
    }
    await sleep(500);
    const scenesResult = await cdp.send("Runtime.evaluate", {
      expression: `window.__logoStage.scenes.map(s => ({ id: s.id, name: s.name, start: s.start, duration: s.duration }))`,
      returnByValue: true
    });
    const scenes = scenesResult.result.value || [];
    if (!scenes.length) throw new Error("No scenes found");

    const holds = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const t = scene.start + scene.duration * 0.48;
      const result = await cdp.send("Runtime.evaluate", {
        expression: `(async()=>{
          window.__pause();
          window.__seek(${t});
          await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
          const s=window.__logoStage.scenes[${i}];
          const check=s.group.querySelector("[data-logo-check]")||s.group;
          const b=check.getBBox();
          const st=getComputedStyle(check);
          return {state:window.__state(),box:{x:b.x,y:b.y,width:b.width,height:b.height},display:st.display,opacity:Number(st.opacity)};
        })()`,
        awaitPromise: true,
        returnByValue: true
      });
      const value = result.result.value;
      const shot = await cdp.send("Page.captureScreenshot", {
        format: "png", fromSurface: true, captureBeyondViewport: false
      });
      const file = path.join(OUT, `${scene.id.replace(/[^a-z0-9_-]+/gi, "_")}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
      const ok = value.display !== "none" && value.opacity > 0.05 && value.box.width > 10 && value.box.height > 10;
      holds.push({ ...scene, time: t, file, ok, box: value.box, state: value.state });
      console.log(ok ? "PASS" : "FAIL", scene.id, "hold", t.toFixed(2), "box", value.box.width.toFixed(1) + "x" + value.box.height.toFixed(1));
    }

    const endResult = await cdp.send("Runtime.evaluate", {
      expression: `(async()=>{
        window.__pause();
        window.__seek(window.__logoStage.total);
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        return window.__logoStage.scenes.map(s=>({id:s.id,display:getComputedStyle(s.group).display}));
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    const blank = (endResult.result.value || []).every(x => x.display === "none");

    const report = {
      page: PAGE,
      generatedAt: new Date().toISOString(),
      errors,
      holds,
      blankAtEnd: blank,
      ok: errors.length === 0 && blank && holds.every(h => h.ok)
    };
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
    cdp.close();
    console.log("blank at end:", blank ? "PASS" : "FAIL");
    console.log("console errors:", errors.length);
    console.log(report.ok ? "OK" : "FAILED");
    chrome.kill("SIGTERM");
    if (!report.ok) process.exitCode = 1;
  } catch (e) {
    engineError(e);
    chrome.kill("SIGTERM");
    process.exitCode = 1;
  }

  function engineError(e) {
    console.error(e);
  }
})();
