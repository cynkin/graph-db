import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9227;
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "qa-theme");
const PROFILE = path.join(process.env.TEMP ?? ".", `graphnet-theme-${Date.now()}`);
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
    await sleep(250);
}

async function shot(name, width = 1440, height = 1000) {
    await sleep(350);
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
    await sleep(1300);
}

async function toggle() {
    await evaluate("document.querySelector('.gn-theme-toggle').click()");
    await sleep(350);
}

try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await viewport(1440, 1000);

    // First visit: no stored choice, so light regardless of OS.
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(1200);
    console.log("first-visit-theme", await evaluate("document.documentElement.getAttribute('data-theme')"));
    console.log("first-visit-storage", await evaluate("localStorage.getItem('graphnet-theme')"));
    await shot("01-login-light");

    await login("alice@demo.test", "Demo@123");
    await shot("02-dashboard-light");
    console.log("toggle-label", await evaluate("document.querySelector('.gn-theme-toggle')?.getAttribute('aria-label')"));

    await toggle();
    console.log("after-toggle", await evaluate("JSON.stringify({theme:document.documentElement.getAttribute('data-theme'),stored:localStorage.getItem('graphnet-theme')})"));
    await shot("03-dashboard-dark");

    await send("Page.navigate", {url: `${BASE}/network`});
    await sleep(700);
    await waitFor("document.querySelector('.gn-people') !== null");
    await shot("04-network-dark");

    await send("Page.navigate", {url: `${BASE}/discover`});
    await sleep(700);
    await waitFor("document.querySelector('.gn-results-card') !== null");
    await shot("05-discover-dark");

    const dave = await evaluate(`fetch('/api/network').then(r=>r.json()).then(d=>d.users.find(u=>u.degree===2)?.id)`);
    await send("Page.navigate", {url: `${BASE}/connections?user_id=${dave}`});
    await sleep(700);
    await waitFor("document.querySelector('.gn-profile-hero') !== null");
    await shot("06-profile-dark");

    await send("Page.navigate", {url: `${BASE}/requests`});
    await sleep(700);
    await waitFor("document.querySelector('.gn-2col-requests') !== null");
    await shot("07-requests-dark");

    // Auth dark, then back to light for the admin/light pass.
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(900);
    await shot("08-login-dark");
    await toggle();
    console.log("back-to-light", await evaluate("document.documentElement.getAttribute('data-theme')"));

    await send("Page.navigate", {url: `${BASE}/news`}).catch(() => {});
    await send("Network.clearBrowserCookies");
    await login("admin@gmail.com", "admin123", "/admin");
    await waitFor("document.querySelectorAll('.g-node').length > 0", 30000);
    await shot("09-admin-light", 1440, 1200);

    await toggle();
    await shot("10-admin-dark", 1440, 1200);

    // Mobile light and dark dashboards.
    await send("Network.clearBrowserCookies");
    await login("alice@demo.test", "Demo@123");
    await viewport(390, 844);
    await send("Page.navigate", {url: `${BASE}/`});
    await sleep(700);
    await waitFor("document.querySelector('.gn-stats') !== null");
    await toggle();
    console.log("mobile-theme", await evaluate("document.documentElement.getAttribute('data-theme')"));
    await shot("11-dashboard-mobile-dark", 390, 844);
    await toggle();
    await shot("12-dashboard-mobile-light", 390, 844);

    console.log("errors", JSON.stringify(errors));
} finally {
    ws.close();
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(PROFILE, {recursive: true, force: true}); } catch { /* ignore */ }
}
