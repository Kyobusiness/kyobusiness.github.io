'use strict';
const root=new URL(self.registration.scope).pathname;
const prefix=root.slice(0,-1);
const backend='https://testsiteportal.kyosuke-0101.chatgpt.site/_pages/file';
const loginFiles=new Set(['gate.js','sw.js','index.html','404.html','.nojekyll']);
const db=new Promise((resolve,reject)=>{
  const req=indexedDB.open('testsiteportal-session',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('session');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
async function session(value) {
  const connection=await db;
  return new Promise((resolve,reject)=>{
    const tx=connection.transaction('session',value?'readwrite':'readonly');
    const store=tx.objectStore('session');
    const op=value?store.put(value,'current'):store.get('current');
    tx.oncomplete=()=>resolve(op.result);tx.onerror=()=>reject(tx.error);
  });
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  const caller=event.source?.url;
  if(!caller || !caller.startsWith(self.registration.scope) || !event.ports[0])return;
  event.waitUntil(session(event.data.session).then(()=>event.ports[0].postMessage(true)));
});
function gate(navigation) {
  return navigation?fetch(root+'index.html',{cache:'no-store'}):new Response(null,{status:401});
}
function adapt(text,file,type) {
  if(type.includes('text/html'))return text.replace(/\b(href|src|action)="\/(?!\/)/g,(_,attr)=>attr+'="'+root)
    .replace("location.replace('/en/","location.replace('"+root+"en/");
  if(type.includes('text/css'))return text.replace(/(url\(["']?)\/assets\//g,'$1'+root+'assets/');
  if(file==='/site.js')text=text.replace("const base = en ? '/en' : '';","const base = "+JSON.stringify(prefix)+" + (en ? '/en' : '');");
  return text.replaceAll("'/assets/","'"+root+"assets/").replaceAll("'/checker-model.js'", "'"+root+"checker-model.js'");
}
async function content(request,url) {
  const nav=request.mode==='navigate';
  const auth=await session();
  if(!auth || auth.expires<=Date.now())return gate(nav);
  let file=url.pathname.slice(prefix.length);
  if(nav && !file.endsWith('/') && !/\.[^/]+$/.test(file)){
    url.pathname+='/';return Response.redirect(url.href,308);
  }
  const result=await fetch(backend,{method:'POST',body:new URLSearchParams({token:auth.token,path:file}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  if(result.status===401)return gate(nav);
  if(!result.ok)return new Response(null,{status:result.status});
  const type=result.headers.get('Content-Type')||'application/octet-stream';
  const headers={'Content-Type':type,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
  const body=/text\/html|text\/css|javascript/.test(type)?adapt(await result.text(),file,type):result.body;
  return new Response(body,{headers});
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(root)||loginFiles.has(url.pathname.slice(root.length)))return;
  event.respondWith(content(event.request,url).catch(()=>new Response(null,{status:503})));
});
