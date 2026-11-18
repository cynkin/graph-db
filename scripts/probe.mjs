import {spawn} from "node:child_process";
import path from "node:path";
import fs from "node:fs";
const CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT=9239, BASE="http://localhost:3000";
const PROFILE=path.join(process.env.TEMP??".",`gn-probe5-${Date.now()}`);
const chrome=spawn(CHROME,["--headless=new","--disable-gpu","--hide-scrollbars","--no-first-run",`--remote-debugging-port=${PORT}`,`--user-data-dir=${PROFILE}`,"about:blank"],{stdio:"ignore"});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function wsurl(){for(let i=0;i<80;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==="page");if(p?.webSocketDebuggerUrl)return p.webSocketDebuggerUrl;}catch{}await sleep(200);}throw new Error("no cdp");}
const ws=new WebSocket(await wsurl());await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
let n=0;const pend=new Map();const log=[];
ws.onmessage=(e)=>{const m=JSON.parse(e.data);
 if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}
 if(m.method==="Network.requestWillBeSent"){const u=m.params.request.url;if(u.includes("_rsc")||u.includes("/api/network")||u.includes("/api/profile"))log.push("REQ "+u.slice(0,110));}
 if(m.method==="Network.responseReceived"){const u=m.params.response.url;if(u.includes("_rsc"))log.push("RES "+m.params.response.status+" "+u.slice(0,90));}
 if(m.method==="Page.frameNavigated"&&!m.params.frame.parentId)log.push("HARDNAV "+m.params.frame.url.slice(0,90));
 if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error")log.push("CONSOLE "+m.params.args.map(a=>a.value??a.description).join(" ").slice(0,160));
 if(m.method==="Runtime.exceptionThrown")log.push("EXC "+(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text).slice(0,200));
};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pend.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async(x)=>{const r=await send("Runtime.evaluate",{expression:x,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result?.value;};
const waitFor=async(e,t=30000)=>{const s=Date.now();while(Date.now()-s<t){if(await ev(e).catch(()=>false))return true;await sleep(150);}throw new Error("timeout");};
try{
 await send("Page.enable");await send("Runtime.enable");await send("Network.enable");
 await send("Emulation.setDeviceMetricsOverride",{width:1440,height:980,deviceScaleFactor:1,mobile:false});
 await send("Page.navigate",{url:`${BASE}/auth/login`});await sleep(1300);
 await ev(`(()=>{const i=document.querySelector('#auth-email');i.value="alice@demo.test";document.querySelector('form').requestSubmit();return true;})()`);
 await waitFor("location.pathname==='/auth/check-password'");
 await ev(`(()=>{const i=document.querySelector('#auth-pw');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i,"Demo@123");i.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await sleep(200);await ev("document.querySelector('form').requestSubmit()");
 await waitFor("location.pathname==='/'");await sleep(2500);
 log.length=0;
 await ev(`window.__marker="alive"`);
 await ev(`[...document.querySelectorAll('.gn-nav-item')].find((a)=>a.textContent.includes('Requests')).click()`);
 await sleep(3500);
 console.log("marker:", await ev("window.__marker ?? 'GONE'"), "| path:", await ev("location.pathname"));
 console.log(log.join("\n"));
}finally{ws.close();chrome.kill();await sleep(300);try{fs.rmSync(PROFILE,{recursive:true,force:true});}catch{}}
