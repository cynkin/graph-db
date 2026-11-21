import {spawn} from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9232;
const BASE = "http://localhost:3000";
const PROFILE = path.join(process.env.TEMP ?? ".", `graphnet-check-${Date.now()}`);
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
const waitFor = async (expr, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await evaluate(expr).catch(() => false)) return true;
        await sleep(150);
    }
    throw new Error(`timeout ${expr}`);
};

try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {width: 1440, height: 980, deviceScaleFactor: 1, mobile: false});

    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(1300);
    await evaluate(`(() => { const i=document.querySelector('#auth-email'); i.value="admin@gmail.com"; document.querySelector('form').requestSubmit(); return true; })()`);
    await waitFor("location.pathname === '/auth/check-password'");
    await evaluate(`(() => { const i=document.querySelector('#auth-pw'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,"admin123"); i.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await sleep(200);
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("location.pathname === '/admin'");
    await waitFor("document.querySelector('.gn-table tbody tr') !== null");
    await sleep(600);

    const summary = await evaluate(`(() => {
        const heads = [...document.querySelectorAll('.gn-table thead th')].map((th) => th.textContent.trim());
        const rows = [...document.querySelectorAll('.gn-table tbody tr')].map((tr) =>
            [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()));
        const meta = document.querySelector('.gn-admin-table-bar .gn-table-meta')?.textContent.trim() ?? '';
        const body = document.body.innerText;
        return {heads, rows, meta, hasAdminEmail: body.includes('admin@gmail.com'), hasHashText: body.includes('password')};
    })()`);
    console.log("headers:", JSON.stringify(summary.heads));
    console.log("meta:", summary.meta);
    console.log("rows:", summary.rows.length);
    for (const r of summary.rows) console.log("  ", JSON.stringify(r));
    console.log("admin email visible:", summary.hasAdminEmail, "| 'password' visible:", summary.hasHashText);

    const api = await evaluate("fetch('/api/admin').then(r=>r.json()).then(d=>({count:d.users.length, roles:[...new Set(d.users.map(u=>u.role))], emails:d.users.map(u=>u.email)}))");
    console.log("api users:", JSON.stringify(api));

    const {data} = await send("Page.captureScreenshot", {format: "png"});
    fs.writeFileSync(path.join(OUT, "admin-users-table.png"), Buffer.from(data, "base64"));
} finally {
    ws.close();
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(PROFILE, {recursive: true, force: true}); } catch { /* ignore */ }
}
