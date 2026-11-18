import {spawn} from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9231;
const BASE = "http://localhost:3000";
const PROFILE = path.join(process.env.TEMP ?? ".", `graphnet-audit-${Date.now()}`);
const OUT = path.join(process.cwd(), "qa-audit");
fs.mkdirSync(OUT, {recursive: true});

const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "about:blank",
], {stdio: "ignore"});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
    for (let i = 0; i < 80; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const page = list.find((t) => t.type === "page");
            if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        } catch { /* wait */ }
        await sleep(200);
    }
    throw new Error("no CDP");
}
const ws = new WebSocket(await getWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let n = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        return;
    }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++n;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params}));
});
const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true, userGesture: true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
};
const waitFor = async (expr, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await evaluate(expr).catch(() => false)) return true;
        await sleep(150);
    }
    throw new Error(`timeout ${expr}`);
};

const AUDIT = `(() => {
  const lum = (c) => {
    const [r,g,b] = c.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const parse = (s) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(s || "");
    if (!m) return null;
    const p = m[1].split(",").map(x => parseFloat(x));
    return {rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1};
  };
  const effBg = (el) => {
    let node = el;
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.5) return c.rgb;
      node = node.parentElement;
    }
    return [246,244,239];
  };
  const rows = [];
  for (const el of document.querySelectorAll("button, .gn-btn, a.gn-btn, .gn-role, .gn-chip, .gn-deg, .gn-page-btn, .gn-iconbtn, .gn-nav-badge, .gn-tab-n, .gn-av")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const own = parse(getComputedStyle(el).backgroundColor);
    const hasOwnBg = !!own && own.a > 0.5;
    const fg = parse(getComputedStyle(el).color);
    if (!fg) continue;
    const bg = hasOwnBg ? own.rgb : effBg(el);
    const L1 = lum(bg), L2 = lum(fg.rgb);
    const ratio = (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05);
    rows.push({
      cls: (el.className && el.className.toString ? el.className.toString() : "").slice(0, 70),
      text: (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 40),
      bg, fg: fg.rgb, ratio: Math.round(ratio * 100) / 100,
      hex: "#" + fg.rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join(""),
    });
  }
  return rows;
})()`;

async function audit(label, {shot = true} = {}) {
    const theme = await evaluate("document.documentElement.getAttribute('data-theme')");
    const rows = await evaluate(AUDIT);
    const bad = rows.filter((r) => r.ratio < 4.5);
    console.log(`\n=== ${label} [${theme}] ${rows.length} controls · low contrast: ${bad.length}`);
    for (const b of bad.slice(0, 20)) console.log("LOW", JSON.stringify(b));
    const primary = rows.filter((r) => /gn-btn-primary/.test(r.cls));
    for (const p of primary.slice(0, 3)) console.log("PRIMARY", JSON.stringify(p));
    if (shot) {
        const name = label.replace(/[^a-z0-9]+/gi, "_");
        const {data} = await send("Page.captureScreenshot", {format: "png"});
        fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
    }
    return {rows, bad};
}

async function login(email, password, expected) {
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(1200);
    await evaluate(`(() => { const i=document.querySelector('#auth-email'); i.value=${JSON.stringify(email)}; document.querySelector('form').requestSubmit(); return true; })()`);
    await waitFor("location.pathname === '/auth/check-password'");
    await evaluate(`(() => { const i=document.querySelector('#auth-pw'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,${JSON.stringify(password)}); i.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await sleep(200);
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor(`location.pathname === ${JSON.stringify(expected)}`);
    await sleep(1500);
}

async function go(p, waitExpr) {
    await send("Page.navigate", {url: BASE + p});
    await sleep(1400);
    if (waitExpr) await waitFor(waitExpr);
    await sleep(500);
}

async function toggle() {
    await evaluate("document.querySelector('.gn-theme-toggle').click()");
    await sleep(450);
}

try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 980, deviceScaleFactor: 1, mobile: false});

    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(1500);
    await audit("01-login-light");

    await login("alice@demo.test", "Demo@123", "/");
    await audit("02-dashboard-light");
    await go("/network", "document.querySelector('.gn-people') !== null");
    await audit("03-network-light");
    await go("/discover", "document.querySelector('.gn-search-card') !== null");
    await audit("04-discover-light");
    await go("/requests", "document.querySelector('.gn-2col-requests') !== null");
    await audit("05-requests-light");
    const dave = await evaluate("fetch('/api/network').then(r=>r.json()).then(d=>d.users.find(u=>u.degree===2)?.id)");
    await go(`/connections?user_id=${dave}`, "document.querySelector('.gn-profile-hero') !== null");
    await audit("06-profile-light");

    await go("/discover", "document.querySelector('.gn-search-card') !== null");
    await toggle();
    await audit("07-discover-dark");
    await go("/network", "document.querySelector('.gn-people') !== null");
    await audit("08-network-dark");
    await toggle();

    await send("Network.clearBrowserCookies");
    await login("admin@gmail.com", "admin123", "/admin");
    await waitFor("document.querySelectorAll('.g-node').length > 0");
    await audit("09-admin-light");
    await toggle();
    await audit("10-admin-dark");
    await toggle();

    console.log("\nerrors", JSON.stringify(errors));
} finally {
    ws.close();
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(PROFILE, {recursive: true, force: true}); } catch { /* ignore */ }
}
