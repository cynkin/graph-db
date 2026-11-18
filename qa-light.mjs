import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9228;
const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "qa-light");
const PROFILE = path.join(process.env.TEMP ?? ".", `graphnet-light-${Date.now()}`);
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
ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
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
    console.log(name, await evaluate("document.documentElement.getAttribute('data-theme')"), await evaluate("document.documentElement.scrollWidth"));
    await viewport(width, height);
}
async function login(email, password) {
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(900);
    await evaluate(`(() => { const i=document.querySelector('#auth-email'); i.value=${JSON.stringify(email)}; document.querySelector('form').requestSubmit(); return true; })()`);
    await waitFor("location.pathname === '/auth/check-password'");
    await evaluate(`(() => { const i=document.querySelector('#auth-pw'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,${JSON.stringify(password)}); i.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await sleep(200);
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("location.pathname === '/'", 30000);
    await sleep(1200);
}

try {
    await send("Page.enable");
    await send("Runtime.enable");
    await viewport(1440, 1000);
    await login("alice@demo.test", "Demo@123");
    console.log("theme", await evaluate("document.documentElement.getAttribute('data-theme')"));
    console.log("desktopHamburger", await evaluate("getComputedStyle(document.querySelector('.gn-menu-btn')).display"));
    await shot("01-dashboard-light");

    await send("Page.navigate", {url: `${BASE}/network`});
    await sleep(600);
    await waitFor("document.querySelector('.gn-people') !== null");
    await shot("02-network-light");

    await send("Page.navigate", {url: `${BASE}/discover`});
    await sleep(600);
    await waitFor("document.querySelector('.gn-results-card') !== null");
    await shot("03-discover-light");

    await send("Page.navigate", {url: `${BASE}/requests`});
    await sleep(600);
    await waitFor("document.querySelector('.gn-2col-requests') !== null");
    await shot("04-requests-light");

    const dave = await evaluate(`fetch('/api/network').then(r=>r.json()).then(d=>d.users.find(u=>u.degree===2)?.id)`);
    await send("Page.navigate", {url: `${BASE}/connections?user_id=${dave}`});
    await sleep(600);
    await waitFor("document.querySelector('.gn-profile-hero') !== null");
    await shot("05-profile-light");

    await viewport(390, 844);
    await send("Page.navigate", {url: `${BASE}/`});
    await sleep(600);
    await waitFor("document.querySelector('.gn-stats') !== null");
    console.log("mobileHamburger", await evaluate("getComputedStyle(document.querySelector('.gn-menu-btn')).display"));
    await shot("06-dashboard-mobile-light", 390, 844);
} finally {
    ws.close();
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(PROFILE, {recursive: true, force: true}); } catch { /* ignore */ }
}
