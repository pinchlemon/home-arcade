// Home Arcade offline support: keeps the launcher, games, libraries and fonts on the phone.
const CACHE='arcade-1792955860';
const PRE=["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "lib/three.min.js", "lib/OrbitControls.js", "lib/cannon.min.js", "void-wizard/", "purgatory-bowl/", "phosphor/", "crab-platformer/"];
const FONTS=["https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;900&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:ital,opsz,wght@1,6..72,400;1,6..72,500&display=swap", "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap", "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&family=Silkscreen&family=Big+Shoulders+Display:wght@900&family=IBM+Plex+Mono:wght@600&display=swap", "https://fonts.googleapis.com/css2?family=Silkscreen&display=swap", "https://fonts.googleapis.com/css2?family=Silkscreen&family=IBM+Plex+Mono:wght@400;500&display=swap"];

async function cacheFonts(cache){
  for(const url of FONTS){
    try{
      const res=await fetch(url);if(!res.ok)continue;
      await cache.put(url,res.clone());
      const css=await res.text();
      for(const m of css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)){
        try{const f=await fetch(m[1]);if(f.ok)await cache.put(m[1],f);}catch(e){}
      }
    }catch(e){}
  }
}

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(PRE.map(u=>new Request(u,{cache:'reload'})));
    await cacheFonts(cache);   // best effort: games still run with fallback fonts if this fails
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k.startsWith('arcade-')&&k!==CACHE)await caches.delete(k);
    await self.clients.claim();
  })());
});

function timeout(ms){return new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms));}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  const isFont=url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com';
  const same=url.origin===self.location.origin;
  if(!same&&!isFont)return;
  const fresh=same&&(req.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/')||url.pathname.endsWith('version.json'));
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(fresh){
      // pages: try the network briefly so updates arrive, fall back to the saved copy offline
      try{
        const res=await Promise.race([fetch(req),timeout(3500)]);
        if(res&&res.ok&&!url.pathname.endsWith('version.json'))cache.put(url.pathname,res.clone());
        return res;
      }catch(err){
        const hit=await cache.match(url.pathname)||await cache.match(req,{ignoreSearch:true});
        if(hit)return hit;
        if(url.pathname.endsWith('version.json'))return new Response('{}',{headers:{'content-type':'application/json'}});
        return (await cache.match('./'))||Response.error();
      }
    }
    // everything else: saved copy first, network to fill gaps
    const hit=await cache.match(req,{ignoreSearch:same});
    if(hit)return hit;
    try{const res=await fetch(req);if(res.ok||res.type==='opaque')cache.put(req,res.clone());return res;}
    catch(err){return Response.error();}
  })());
});
