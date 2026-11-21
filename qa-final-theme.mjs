import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9229;
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "qa-final");
const PROFILE = path.join(process.env.TEMP ?? ".", `graphnet-final-${Date.now()}`);
fs.mkdirSync(OUT, {recursive: true});

const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "about:blank",
], {stdio: "ignore"});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
    for (let i = 0; i < 60; i++) {
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
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push(m.params.entry.text);
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
const waitFor = async (expr, timeout = 25000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await evaluate(expr).catch(() => false)) return true;
        await sleep(120);
    }
    throw new Error(`timeout ${expr}`);
};
async function viewport(width, height) {
    await send("Emulation.setDeviceMetricsOverride", {width, height, deviceScaleFactor: 1, mobile: width < 800});
    await sleep(200);
}
async function shot(name, width = 1440, height = 1000) {
    await sleep(300);
    const metrics = await send("Page.getLayoutMetrics");
    const full = Math.min(Math.max(height, Math.ceil(metrics.cssContentSize.height)), 2600);
    await send("Emulation.setDeviceMetricsOverride", {width, height: full, deviceScaleFactor: 1, mobile: width < 800});
    await sleep(250);
    const {data} = await send("Page.captureScreenshot", {format: "png", captureBeyondViewport: false});
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
    const state = await evaluate("document.documentElement.getAttribute('data-theme')");
    const overflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
    console.log(name, state, "overflow", overflow);
    await viewport(width, height);
}
async function login(email, password, expected = "/") {
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(900);
    await evaluate(`(() => { const i=document.querySelector('#auth-email'); i.value=${JSON.stringify(email)}; document.querySelector('form').requestSubmit(); return true; })()`);
    await waitFor("location.pathname === '/auth/check-password'");
    await evaluate(`(() => { const i=document.querySelector('#auth-pw'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,${JSON.stringify(password)}); i.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await sleep(200);
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor(`location.pathname === ${JSON.stringify(expected)}`, 30000);
    await sleep(1200);
}
async function toggle() {
    await evaluate("document.querySelector('.gn-theme-toggle').click()");
    await sleep(350);
}

try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Emulation.setEmulatedMedia", {features: [{name: "prefers-color-scheme", value: "dark"}]});
    await viewport(1440, 1000);

    // OS dark must not override the product's light-first default.
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(1200);
    console.log("os-dark-first-visit", await evaluate("document.documentElement.getAttribute('data-theme')"));
    console.log("stored", await evaluate("localStorage.getItem('graphnet-theme')"));
    await send("Emulation.setEmulatedMedia", {features: []});

    await login("alice@demo.test", "Demo@123");
    console.log("desktopMenu", await evaluate("getComputedStyle(document.querySelector('.gn-menu-btn')).display"));

    const navAudit = await evaluate(`(() => {
        const pages = ['/','/network','/discover','/requests'];
        return [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => pages.includes(h));
    })()`);
    console.log("page-links", JSON.stringify(navAudit));
    console.log("legend", await evaluate("[...document.querySelectorAll('.gn-degree-key-item')].map(e=>e.textContent.trim())"));
    console.log("outside", await evaluate("document.body.innerText.includes('Outside')"));
    console.log("oldTags", await evaluate("document.querySelectorAll('.gn-deg-1,.gn-deg-2,.gn-deg-3').length"));

    // Persist dark, reload, and prove the attribute survives before the page is usable.
    await toggle();
    console.log("toggle", await evaluate("JSON.stringify({theme:document.documentElement.getAttribute('data-theme'),stored:localStorage.getItem('graphnet-theme')})"));
    await send("Page.reload");
    await sleep(1400);
    console.log("reload-dark", await evaluate("document.documentElement.getAttribute('data-theme')"));
    await shot("01-dashboard-dark-reload");

    await toggle();
    console.log("back-light", await evaluate("document.documentElement.getAttribute('data-theme')"));

    await viewport(768, 1024);
    await send("Page.navigate", {url: `${BASE}/`});
    await sleep(600);
    await waitFor("document.querySelector('.gn-stats') !== null");
    console.log("tabletMenu", await evaluate("getComputedStyle(document.querySelector('.gn-menu-btn')).display"));
    await shot("02-dashboard-tablet-light", 768, 1024);

    await send("Page.navigate", {url: `${BASE}/network`});
    await sleep(600);
    await waitFor("document.querySelector('.gn-people') !== null");
    await shot("03-network-tablet-light", 768, 1024);

    await send("Network.clearBrowserCookies");
    await login("admin@gmail.com", "admin123", "/admin");
    await waitFor("document.querySelectorAll('.g-node').length > 0", 30000);
    const zoomCovered = await evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Zoom in');
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !(top === b || b.contains(top));
    })()`);
    console.log("admin-zoom-covered-768", zoomCovered);
    console.log("admin-theme-toggle", await evaluate("!!document.querySelector('.gn-admin-bar .gn-theme-toggle')"));
    await shot("04-admin-tablet-light", 768, 1024);

    await viewport(390, 844);
    await send("Page.navigate", {url: `${BASE}/admin`});
    await sleep(700);
    await waitFor("document.querySelectorAll('.g-node').length > 0", 30000);
    await shot("05-admin-mobile-light", 390, 844);
    await toggle();
    await shot("06-admin-mobile-dark", 390, 844);

    await send("Network.clearBrowserCookies");
    await login("alice@demo.test", "Demo@123");
    await viewport(390, 844);
    await send("Page.navigate", {url: `${BASE}/`});
    await sleep(700);
    await waitFor("document.querySelector('.gn-stats') !== null");
    await toggle();
    console.log("mobile-theme-after-toggle", await evaluate("document.documentElement.getAttribute('data-theme')"));
    await shot("07-dashboard-mobile-dark", 390, 844);
    await toggle();
    await shot("08-dashboard-mobile-light", 390, 844);

    // Auth toggle check at mobile size.
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(800);
    console.log("auth-theme-toggle", await evaluate("!!document.querySelector('.gn-auth-theme')"));
    await toggle();
    await shot("09-login-mobile-dark", 390, 844);

    console.log("errors", JSON.stringify(errors));
} finally {
    ws.close();
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(PROFILE, {recursive: true, force: true}); } catch { /* ignore */ }
}
