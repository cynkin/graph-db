import {spawn} from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9240;
const BASE = "http://localhost:3000";
const PROFILE = path.join(process.env.TEMP ?? ".", `graphnet-ui-${Date.now()}`);
const OUT = path.join(process.cwd(), "qa-redesign");
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
const netCalls = [];
let interceptQueryMs = null;

ws.onmessage = async (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        return;
    }
    if (m.method === "Runtime.exceptionThrown") {
        errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    }
    if (m.method === "Network.requestWillBeSent" && m.params.request.url.includes("/api/network")) {
        netCalls.push(m.params.request.url);
    }
    if (m.method === "Fetch.requestPaused") {
        const {requestId} = m.params;
        try {
            const {body, base64Encoded} = await send("Fetch.getResponseBody", {requestId});
            const json = JSON.parse(base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body);
            json.meta = {...(json.meta ?? {}), queryMs: interceptQueryMs};
            await send("Fetch.fulfillRequest", {
                requestId,
                responseCode: 200,
                responseHeaders: [{name: "content-type", value: "application/json"}],
                body: Buffer.from(JSON.stringify(json)).toString("base64"),
            });
        } catch {
            await send("Fetch.continueRequest", {requestId}).catch(() => {});
        }
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
async function shot(name) {
    await sleep(350);
    const {data} = await send("Page.captureScreenshot", {format: "png"});
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
}
async function viewport(width, height) {
    await send("Emulation.setDeviceMetricsOverride", {width, height, deviceScaleFactor: 1, mobile: width < 800});
    await sleep(250);
}
async function login(base, email, password, expected) {
    await send("Page.navigate", {url: `${base}/auth/login`});
    await sleep(1200);
    await evaluate(`(() => {
        const i = document.querySelector('#auth-email');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(i, ${JSON.stringify(email)});
        i.dispatchEvent(new Event('input', {bubbles: true}));
        document.querySelector('form').requestSubmit();
        return true;
    })()`);
    await waitFor("location.pathname === '/auth/check-password'");
    await evaluate(`(() => { const i=document.querySelector('#auth-pw'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(i,${JSON.stringify(password)}); i.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    await sleep(200);
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor(`location.pathname === ${JSON.stringify(expected)}`);
    await sleep(1600);
}
async function go(p, waitExpr) {
    await send("Page.navigate", {url: BASE + p});
    await sleep(1300);
    if (waitExpr) await waitFor(waitExpr);
    await sleep(600);
}
const navTo = (label) => `[...document.querySelectorAll('.gn-nav-item')].find((a) => a.textContent.includes(${JSON.stringify(label)})).click()`;

try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    // Without this, headless Chrome never really focuses the page, so blur/focus
    // handlers cannot fire and inline validation looks broken when it is not.
    await send("Emulation.setFocusEmulationEnabled", {enabled: true});
    await viewport(1440, 980);

    // ---------- chrome: no top search, no sidebar footer, no theme switch ----------
    await login(BASE, "alice@demo.test", "Demo@123", "/");
    await waitFor("document.querySelector('.gn-stats') !== null");

    // ---------- no boot splash on a cold load ----------
    await send("Page.navigate", {url: BASE + "/"});
    await sleep(60);
    console.log("boot gate:", JSON.stringify(await evaluate(`(() => {
        const html = document.documentElement.outerHTML;
        return {
            splashMarkup: /gn-boot-(line|text|inner|mark)|Loading your network/.test(html),
            gate: /class="gn gn-boot"/.test(html),
        };
    })()`)));
    await waitFor("document.querySelector('.gn-stats') !== null");
    console.log("chrome:", JSON.stringify(await evaluate(`(() => ({
        topSearch: !!document.querySelector('.gn-top form.gn-search'),
        sidebarFooter: !!document.querySelector('.gn-side-foot'),
        themeToggle: !!document.querySelector('.gn-theme-toggle'),
        themeAttr: document.documentElement.getAttribute('data-theme'),
        colourScheme: getComputedStyle(document.documentElement).colorScheme,
    }))()`)));

    // ---------- dashboard / network / profile bits that were removed ----------
    console.log("dashboard degree grid:", await evaluate("!!document.querySelector('.gn-degree-grid')"));
    await go("/network", "document.querySelector('.gn-people') !== null");
    console.log("network view toggle:", await evaluate("!!document.querySelector('.gn-viewtoggle')"), "| cards:", await evaluate("document.querySelectorAll('.gn-person').length"));
    await shot("v3-02-network");
    const other = await evaluate("fetch('/api/network').then(r=>r.json()).then(d=>d.users.find(u=>u.degree===2)?.id ?? d.users[1].id)");
    await go(`/connections?user_id=${other}`, "document.querySelector('.gn-profile-hero') !== null");
    console.log("profile position card:", await evaluate("[...document.querySelectorAll('.gn-card-title')].some((t) => t.textContent.toLowerCase().includes('network position'))"),
        "| note:", await evaluate("!!document.querySelector('.gn-profile-note')"));
    await shot("v3-03-profile");

    // ---------- nav refresh: a real API call per navigation, no hard reload ----------
    await go("/", "document.querySelector('.gn-stats') !== null");
    await evaluate("window.__marker = 'alive'");
    netCalls.length = 0;
    await evaluate(navTo("Requests"));
    await waitFor("location.pathname === '/requests'");
    await sleep(1400);
    console.log("nav 1:", JSON.stringify({path: await evaluate("location.pathname"), spa: await evaluate("window.__marker ?? 'RELOADED'"), apiCalls: netCalls.length}));

    netCalls.length = 0;
    await evaluate(navTo("Requests"));
    await sleep(1400);
    console.log("nav 2 (same tab):", JSON.stringify({apiCalls: netCalls.length, spa: await evaluate("window.__marker ?? 'RELOADED'")}));

    // ---------- fresh data really reaches the page ----------
    await send("Fetch.enable", {patterns: [{urlPattern: "*api/network*", requestStage: "Response"}]});
    interceptQueryMs = 777;
    await evaluate(navTo("Overview"));
    await waitFor("location.pathname === '/'");
    await sleep(1600);
    const meta = await evaluate("document.querySelector('.gn-meta')?.innerText.replace(/\\s+/g, ' ')");
    console.log("intercepted meta:", JSON.stringify(meta));
    await send("Fetch.disable");
    interceptQueryMs = null;
    await shot("v3-01-dashboard");

    // ---------- sign out stays on the serving host ----------
    await send("Network.clearBrowserCookies");
    await login("http://127.0.0.1:3000", "alice@demo.test", "Demo@123", "/");
    await evaluate("document.querySelector('.gn-userbtn').click()");
    await sleep(400);
    await evaluate(`[...document.querySelectorAll('.gn-menu-item')].find((b) => b.textContent.includes('Sign out')).click()`);
    await sleep(2500);
    console.log("after sign-out:", await evaluate("location.href"));

    // ---------- email validation belongs to step 1, and only step 1 ----------
    const setEmailValue = (v) => `(() => {
        const i = document.querySelector('#auth-email');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(i, ${JSON.stringify(v)});
        i.dispatchEvent(new Event('input', {bubbles: true}));
        i.focus(); i.blur();
        return true;
    })()`;

    // (0) a rejected password empties the box
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(1400);
    await evaluate(setEmailValue("alice@demo.test"));
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("location.pathname === '/auth/check-password'");
    await sleep(700);
    await evaluate(`(() => {
        const i = document.querySelector('#auth-pw');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(i, 'not-the-password');
        i.dispatchEvent(new Event('input', {bubbles: true}));
        document.querySelector('form').requestSubmit();
        return true;
    })()`);
    await sleep(1600);
    console.log("wrong password:", JSON.stringify(await evaluate("({path: location.pathname, value: document.querySelector('#auth-pw').value, err: document.querySelector('.gn-err')?.innerText ?? null})")));
    await shot("v3-09-wrong-password");

    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(1500);

    // (a) the message shows while the field is still being filled in, before Continue
    await evaluate(setEmailValue("bob@test"));
    await sleep(500);
    console.log("step1 inline error:", JSON.stringify(await evaluate("({path: location.pathname, err: document.querySelector('.gn-err')?.innerText ?? null})")));
    await shot("v3-06-invalid-email");

    // (b) Continue stays on step 1
    await evaluate("document.querySelector('form').requestSubmit()");
    await sleep(900);
    console.log("step1 submit blocked:", JSON.stringify(await evaluate("({path: location.pathname, ariaInvalid: document.querySelector('#auth-email').getAttribute('aria-invalid')})")));

    // (c) the API names the field that failed, so a later step can route it back
    console.log("api field tag:", JSON.stringify(await evaluate(`fetch('/api/auth/register', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: 'bob@test', name: 'Bob Test', password: 'Demo@123'})}).then(async (r) => ({status: r.status, ...(await r.json())}))`)));

    // (d) step 3 cannot be opened without step 1
    await send("Page.navigate", {url: `${BASE}/auth/register`});
    await sleep(1300);
    console.log("step3 without step1:", await evaluate("location.pathname"));

    // (e) a real sign-up reaches step 3, where only name errors are reported
    const fresh = `qa-step-${Date.now()}@demo.test`;
    await evaluate(setEmailValue(fresh));
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("location.pathname === '/auth/create-password'");
    await sleep(700);
    await evaluate(`(() => {
        const i = document.querySelector('#auth-new');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(i, 'Demo@123');
        i.dispatchEvent(new Event('input', {bubbles: true}));
        return true;
    })()`);
    await sleep(250);
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("location.pathname === '/auth/register'");
    await sleep(900);
    await evaluate(`(() => {
        const i = document.querySelector('#auth-name');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(i, 'ab');
        i.dispatchEvent(new Event('input', {bubbles: true}));
        document.querySelector('form').requestSubmit();
        return true;
    })()`);
    await sleep(700);
    console.log("step3 name error:", JSON.stringify(await evaluate(`({
        path: location.pathname,
        heading: document.querySelector('.gn-auth-title')?.innerText ?? null,
        err: document.querySelector('.gn-err')?.innerText ?? null,
        mentionsEmail: document.body.innerText.includes('valid email address'),
    })`)));
    await shot("v3-08-step3-name-only");

    // ---------- mobile ----------
    await viewport(390, 844);
    await send("Page.navigate", {url: `${BASE}/auth/login`});
    await sleep(1500);
    await shot("v3-07-login-mobile");

    console.log("errors", JSON.stringify(errors));
} finally {
    ws.close();
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(PROFILE, {recursive: true, force: true}); } catch { /* ignore */ }
}
