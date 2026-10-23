/* Isoflux · Colector de campo — funcionamiento sin señal (V21.6)
   Guarda el colector y la librería de Excel en el celular la primera vez que se abre con señal.
   Después abre aunque no haya cobertura; con señal busca primero la versión nueva. */
const C='isoflux-colector-v216';
const APP=new URL('ColectorCampo.html',self.location).href;
const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(async c=>{try{await c.add(new Request(APP,{cache:'reload'}));}catch(x){}for(const u of LIBS){try{const r=await fetch(u,{mode:'no-cors'});await c.put(u,r);}catch(x){}}}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('isoflux-colector-')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
 if(u.href.split('?')[0]===APP||(e.request.mode==='navigate'&&/ColectorCampo\.html$/.test(u.pathname))){
  e.respondWith((async()=>{const c=await caches.open(C);try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),4000);const r=await fetch(APP,{signal:ctl.signal,cache:'no-cache'});clearTimeout(t);if(r&&r.ok)c.put(APP,r.clone());return r;}catch(x){const m=await c.match(APP);if(m)return m;throw x;}})());return;}
 if(LIBS.includes(u.href)){e.respondWith(caches.open(C).then(async c=>(await c.match(u.href))||fetch(e.request).then(r=>{c.put(u.href,r.clone());return r;})));}});
