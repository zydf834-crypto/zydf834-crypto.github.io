/* Service worker: the app works offline; index.html is fetched fresh when online, so weekly updates reach users automatically. */
const VERSION='v1';
const CACHE='physics-'+VERSION,FONTS='physics-fonts';
const CORE=['./','index.html','manifest.webmanifest','privacy.html','icon-192.png','icon-512.png','icon-maskable-512.png','favicon-32.png','apple-touch-icon.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==FONTS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function networkFirst(req){
  return new Promise(resolve=>{
    let done=false;
    const finish=r=>{if(!done&&r){done=true;resolve(r)}};
    const timer=setTimeout(()=>{caches.match(req).then(finish)},3500);
    fetch(req.url,{cache:'no-cache'}).then(res=>{
      clearTimeout(timer);
      const copy=res.ok?res.clone():null;
      finish(res);
      if(copy)caches.open(CACHE).then(c=>c.put(req,copy));
    }).catch(()=>{
      clearTimeout(timer);
      caches.match(req).then(m=>m||caches.match('index.html')).then(m=>{if(m)finish(m);else if(!done){done=true;resolve(Response.error())}});
    });
  });
}
async function fontsHandler(e){
  const c=await caches.open(FONTS),m=await c.match(e.request);
  const net=fetch(e.request).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(e.request,res.clone());return res}).catch(()=>null);
  if(m){e.waitUntil(net);return m}
  return (await net)||Response.error();
}
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    if(r.mode==='navigate'||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/'))e.respondWith(networkFirst(r));
    else e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})));
    return;
  }
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com')e.respondWith(fontsHandler(e));
});
