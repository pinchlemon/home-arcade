// Hedron offline support: keeps the launcher, games, libraries and fonts on the phone.
const CACHE='arcade-1794337390';
const PRE=["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "lib/three.min.js", "lib/OrbitControls.js", "lib/cannon.min.js", "void-wizard/", "void-wizard/game.json", "void-wizard/studio.json", "void-wizard/scripts/game.js", "void-wizard/features/trail.js", "void-wizard/features/text.js", "void-wizard/features/lab.js", "void-wizard/lab/time.js", "void-wizard/lab/world.js", "void-wizard/lab/bodies.js", "void-wizard/lab/spawn.js", "void-wizard/lab/camera.js", "void-wizard/lab/throws.js", "void-wizard/lab/demon.js", "void-wizard/lab/health.js", "void-wizard/lab/look.js", "void-wizard/lab/rules.js", "void-wizard/lab/effects.js", "void-wizard/lab/ps1.js", "void-wizard/lab/transitions.js", "lib/three-examples/BleachBypassShader.js", "lib/three-examples/CopyShader.js", "lib/three-examples/DigitalGlitch.js", "lib/three-examples/DotScreenShader.js", "lib/three-examples/GlitchPass.js", "lib/three-examples/HalftonePass.js", "lib/three-examples/HalftoneShader.js", "lib/three-examples/HorizontalTiltShiftShader.js", "lib/three-examples/LuminosityHighPassShader.js", "lib/three-examples/Pass.js", "lib/three-examples/TechnicolorShader.js", "lib/three-examples/UnrealBloomPass.js", "lib/three-examples/VerticalTiltShiftShader.js", "engine/features.js", "purgatory-bowl/", "phosphor/", "crab-platformer/", "circuit-crush/", "app/", "app/index.html", "app/app.css", "app/manifest.webmanifest", "app/js/input.js", "app/js/main.js", "app/js/pixel.js", "app/js/sound.js", "app/js/store.js", "app/js/ui.js", "app/js/screens/arcade.js", "app/js/screens/settings.js", "app/js/screens/studio.js", "app/js/screens/sync.js", "engine/boot.js", "engine/audio.js", "engine/input.js", "engine/loop.js", "engine/pixels.js", "engine/screen.js", "crab-platformer/game.json", "crab-platformer/scripts/art.js", "crab-platformer/scripts/beach.js", "crab-platformer/scripts/crab-look.js", "crab-platformer/scripts/crab.js", "crab-platformer/scripts/eye-look.js", "crab-platformer/scripts/eyes.js", "crab-platformer/scripts/juice-look.js", "crab-platformer/scripts/juice.js", "crab-platformer/scripts/music.js", "crab-platformer/scripts/particles.js", "crab-platformer/scripts/render.js", "crab-platformer/scripts/settings.js", "crab-platformer/scripts/sounds.js", "crab-platformer/scripts/state.js", "crab-platformer/scripts/logic-host.js", "crab-platformer/assets/castle.png", "crab-platformer/assets/city.png", "crab-platformer/assets/cloud.png", "crab-platformer/assets/palm.png", "crab-platformer/assets/sand.png", "crab-platformer/assets/sheet.png", "crab-platformer/assets/umbrella.png", "app/js/games.js", "app/js/screens/gameEditor.js", "crab-platformer/studio.json", "engine/actors.js", "engine/behaviors.json", "engine/symbols.json", "app/js/screens/art.js", "app/js/screens/soundTab.js", "engine/listen.html", "app/js/screens/review.js", "app/js/padnav.js", "app/js/build.js", "app/js/update.js", "app/js/launch.js", "app/js/ase.js", "app/js/artStore.js", "app/js/screens/spriteEditor.js", "app/js/spriteSel.js", "app/js/gif.js", "app/js/iconEditor.js", "app/js/arrange.js", "app/js/custom.js", "app/custom.json", "app/js/newGame.js", "app/js/screens/tileScene.js", "app/js/screens/logicGraph.js", "app/js/tileEditor.js", "app/js/symbolEditor.js", "engine/tiles.js", "engine/logic.js", "engine/logic.json", "engine/game-template.html"];
const FONTS=["https://fonts.googleapis.com/css2?family=Saira:wght@400;600;700&display=swap", "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;900&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:ital,opsz,wght@1,6..72,400;1,6..72,500&display=swap", "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap", "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&family=Silkscreen&family=Big+Shoulders+Display:wght@900&family=IBM+Plex+Mono:wght@600&display=swap", "https://fonts.googleapis.com/css2?family=Silkscreen&display=swap", "https://fonts.googleapis.com/css2?family=Silkscreen&family=IBM+Plex+Mono:wght@400;500&display=swap", "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800;900&display=swap"];

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

// Art drawn on the phone and not yet on the site lives in IndexedDB (app/js/artStore.js), stored under its path in the repo.
// Pictures and .aseprite files are looked up there first, so the games and the app show the phone's version.
function phoneArt(path){
  return new Promise(res=>{
    try{
      const r=indexedDB.open('hedron-art',1);
      r.onupgradeneeded=()=>{r.transaction.abort();};   // nothing drawn on this phone yet: don't create it here
      r.onerror=()=>res(null);
      r.onsuccess=()=>{
        const d=r.result;
        if(!d.objectStoreNames.contains('files')){d.close();res(null);return;}
        const g=d.transaction('files').objectStore('files').get(path);
        g.onsuccess=()=>{d.close();res(g.result||null);};g.onerror=()=>{d.close();res(null);};
      };
    }catch(err){res(null);}
  });
}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  // games made on the phone (games/<folder>/…): the phone's files first, then the site
  if(url.origin===self.location.origin&&url.pathname.startsWith(new URL(self.registration.scope).pathname+'games/')&&!url.pathname.endsWith('/index.json')){
    let path=decodeURIComponent(url.pathname.slice(new URL(self.registration.scope).pathname.length));if(path.endsWith('/'))path+='index.html';
    e.respondWith((async()=>{
      const f=await phoneArt(path);
      if(f)return new Response(f.bytes,{headers:{'content-type':(f.type||'application/octet-stream')+(/^text|json/.test(f.type||'')?';charset=utf-8':''),'cache-control':'no-store'}});
      const cache=await caches.open(CACHE);
      try{const res=await Promise.race([fetch(req.url,{cache:'no-cache'}),timeout(3500)]);if(res.ok)cache.put(url.pathname,res.clone());return res;}
      catch(err){return (await cache.match(url.pathname))||(await cache.match(req,{ignoreSearch:true}))||Response.error();}
    })());
    return;
  }
  if(url.origin===self.location.origin&&/\.(png|aseprite)$/i.test(url.pathname)){
    const path=decodeURIComponent(url.pathname.slice(new URL(self.registration.scope).pathname.length));
    e.respondWith((async()=>{
      const f=await phoneArt(path);
      if(f)return new Response(f.bytes,{headers:{'content-type':f.type||'image/png','cache-control':'no-store'}});
      const cache=await caches.open(CACHE),hit=await cache.match(req,{ignoreSearch:true});
      if(hit)return hit;
      try{const res=await fetch(req);if(res.ok)cache.put(url.pathname,res.clone());return res;}catch(err){return Response.error();}
    })());
    return;
  }
  const isFont=url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com';
  const same=url.origin===self.location.origin;
  if(!same&&!isFont)return;
  // the Studio app's modules count as pages too, so a new version arrives on the next open
  const fresh=same&&(req.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/')||url.pathname.endsWith('version.json')||url.pathname.includes('/app/')||url.pathname.includes('/engine/')||url.pathname.includes('/scripts/')||url.pathname.endsWith('game.json')||url.pathname.endsWith('studio.json'));
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(fresh){
      // pages: try the network briefly so updates arrive, fall back to the saved copy offline
      try{
        // skip the browser's own short-term cache so a new version is seen right away
        const res=await Promise.race([fetch(req.url,{cache:'no-cache',credentials:'same-origin'}),timeout(3500)]);
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
