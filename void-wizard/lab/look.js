// Lab shelves for the screen shaders: Look (bend the picture), Echo (trails and time), Colour, Tone and Screen.
// The finished picture (world, solid, wizards) goes through one shader before it reaches the screen; the HUD and
// the corner badge stay as they are. Nothing is made until a knob moves, and with every knob back to normal the
// game draws straight to the screen again.
// To add a shader knob: a uniform and a few lines in FRAG, its value in draw(), and a toy on the shelf it fits.
(() => {
  const game = LAB.game, T = game.THREE;
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const NAMES = ['warp', 'warpSpeed', 'swirl', 'bulge', 'mirror', 'kal', 'pix', 'trails', 'tZoom', 'tSpin', 'tHue', 'split', 'glitch', 'pulse',
    'levels', 'dither', 'ditherSize', 'tint', 'hue', 'invert', 'pal', 'sat', 'con', 'bri', 'outline', 'glow',
    'scan', 'vig', 'grain', 'crt', 'halftone', 'dotSize'];
  const FRAG = `
    uniform sampler2D tScene, tPrev; uniform vec2 res; uniform float time; uniform vec3 tintCol, pal0, pal1, pal2, pal3;
    uniform float ${NAMES.join(', ')};
    varying vec2 vUv;
    float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    vec3 hueShift(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }
    vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
    vec3 pick(vec2 uv){ return texture2D(tScene, clamp(uv, 0.0, 1.0)).rgb; }
    void main(){
      vec2 asp = vec2(res.x / res.y, 1.0), uv = vUv;
      // ---- Screen: an old curved screen
      if (crt > 0.0) { vec2 c = uv * 2.0 - 1.0; c *= 1.0 + crt * 0.12 * dot(c, c); uv = c * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } }
      // ---- Look: bend the picture
      if (mirror > 0.5) { if (mirror < 1.5 || mirror > 2.5) uv.x = 0.5 - abs(uv.x - 0.5); if (mirror > 1.5) uv.y = 0.5 - abs(uv.y - 0.5); }
      vec2 p = (uv - 0.5) * asp; float r = length(p);
      if (bulge != 0.0) { p *= 1.0 + bulge * 0.6 * (r * r - 0.25); }
      if (swirl != 0.0) { float k = max(0.0, 1.0 - r / 0.7); p = rot(p, swirl * 2.5 * k * k); }
      if (kal >= 2.0) { float a = atan(p.y, p.x), s = 6.2831853 / kal; r = length(p); a = mod(a, s); a = abs(a - s * 0.5); p = vec2(cos(a), sin(a)) * r; }
      uv = p / asp + 0.5;
      if (warp > 0.0) uv += warp * 0.03 * vec2(sin(uv.y * 12.0 + time * warpSpeed * 3.0), cos(uv.x * 10.0 + time * warpSpeed * 2.6));
      // ---- Echo: glitch bands and the hit pulse
      float sp = split + pulse * 3.0;
      if (glitch > 0.0) { float band = floor(uv.y * 24.0), tick = floor(time * 9.0), g = hash(vec2(band, tick));
        if (g < glitch * 0.35) { uv.x += (hash(vec2(tick, band)) - 0.5) * 0.12 * glitch; sp += glitch * 2.0; } }
      if (pix > 1.0) { vec2 cell = pix / res; uv = (floor(uv / cell) + 0.5) * cell; }
      uv = clamp(uv, 0.0, 1.0);
      vec3 col;
      if (sp > 0.0) { vec2 o = sp * 0.006 * vec2(cos(time * 0.7), sin(time * 0.9) * 0.4); col = vec3(pick(uv + o).r, pick(uv).g, pick(uv - o).b); }
      else col = pick(uv);
      // ---- Tone: glow and outlines
      if (glow > 0.0) { vec3 b = vec3(0.0); vec2 px = 3.0 / res;
        for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; b += max(pick(uv + vec2(cos(a), sin(a)) * px * 2.0) - 0.25, 0.0); b += max(pick(uv + vec2(cos(a), sin(a)) * px * 5.0) - 0.25, 0.0); }
        col += b / 16.0 * glow * 2.5; }
      if (outline > 0.0) { vec2 px = 1.5 / res; float e = abs(lum(pick(uv + vec2(px.x, 0.0))) - lum(pick(uv - vec2(px.x, 0.0)))) + abs(lum(pick(uv + vec2(0.0, px.y))) - lum(pick(uv - vec2(0.0, px.y))));
        e = clamp(e * 4.0, 0.0, 1.0); col = mix(col, mix(col * 0.15, tintCol * 1.4 + 0.2, e), outline); }
      if (bri != 0.0) col += bri * 0.5;
      if (con != 0.0) col = (col - 0.5) * (1.0 + con) + 0.5;
      if (sat != 0.0) col = mix(vec3(lum(col)), col, 1.0 + sat);
      col = clamp(col, 0.0, 1.0);
      // ---- Colour
      if (hue != 0.0) col = clamp(hueShift(col, hue), 0.0, 1.0);
      if (tint > 0.0) col = mix(col, clamp(tintCol * lum(col) * 1.8, 0.0, 1.0), tint);
      float d = (bayer4(gl_FragCoord.xy / ditherSize) - 0.5) * dither;
      if (pal > 0.5) { float l = clamp(lum(col) * 3.0 + d * 1.5, 0.0, 3.0); col = l < 0.5 ? pal0 : l < 1.5 ? pal1 : l < 2.5 ? pal2 : pal3; }
      else if (levels >= 2.0) col = floor(col * (levels - 1.0) + 0.5 + d) / (levels - 1.0);
      if (invert > 0.5) col = 1.0 - col;
      // ---- Screen
      if (halftone > 0.0) { vec2 g = gl_FragCoord.xy / dotSize, f = fract(g) - 0.5; float rr = sqrt(lum(col)) * 0.7;
        col = mix(col, col * step(length(f), rr) * 1.4, halftone); }
      if (scan > 0.0) col *= 1.0 - scan * 0.6 * step(mod(gl_FragCoord.y, 3.0), 1.0);
      if (vig > 0.0) col *= 1.0 - vig * smoothstep(0.35, 0.95, length((vUv - 0.5) * asp));
      if (grain > 0.0) col += (hash(gl_FragCoord.xy + fract(time) * 100.0) - 0.5) * grain * 0.35;
      // ---- Echo: the last picture, zoomed and turned, shows through
      if (trails > 0.0) { vec2 q = rot((vUv - 0.5) * asp, -tSpin * 0.03) / asp / (1.0 + tZoom * 0.02) + 0.5;
        vec3 prev = texture2D(tPrev, q).rgb; if (tHue != 0.0) prev = clamp(hueShift(prev, tHue * 0.2), 0.0, 1.0);
        col = max(col, prev * trails); }
      if (pulse > 0.0) col += pulse * 0.25;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;
  // four-colour palettes (dark to light); the Void one is drawn from the current solid
  const PALETTES = [null,
    ['Game Boy', [0x0f380f, 0x306230, 0x8bac0f, 0x9bbc0f]],
    ['CGA', [0x000000, 0x55ffff, 0xff55ff, 0xffffff]],
    ['Sepia', [0x1c1008, 0x5e3c1e, 0xb08a58, 0xf2e2c0]],
    ['Fire', [0x0a0000, 0x8a1a00, 0xff7a1a, 0xffe9a0]],
    ['Ice', [0x02060f, 0x1a3a6e, 0x6fb6ff, 0xeafcff]],
    ['Neon', [0x0b0016, 0xff2bd6, 0x2bfff1, 0xfffbe0]],
    ['Void', null]];
  let made = null, w = 0, h = 0, fresh = true, pulse = 0, lastNow = 0;
  const size = new T.Vector2();
  function make() {   // made on first use (three.js ids use Math.random)
    const rt = () => new T.WebGLRenderTarget(1, 1, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false });   // flat pictures: no depth, so effects drawn over each other never hide one another
    const u = { tScene: { value: null }, tPrev: { value: null }, res: { value: new T.Vector2() }, time: { value: 0 }, tintCol: { value: new T.Color() } };
    for (let i = 0; i < 4; i++) u['pal' + i] = { value: new T.Color() };
    for (const k of NAMES) u[k] = { value: 0 };
    const mat = new T.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
    const copy = new T.MeshBasicMaterial({ depthTest: false, depthWrite: false });
    const geo = new T.PlaneGeometry(2, 2), fx = new T.Scene(), out = new T.Scene();
    fx.add(new T.Mesh(geo, mat)); out.add(new T.Mesh(geo, copy));
    made = { scene: rt(), a: rt(), b: rt(), p: rt(), q: rt(), mat, copy, fx, out, cam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }
  const v = (id, normal) => LAB.get(id) ?? normal;
  // the hit pulse: a flash of colour split and light whenever the demon is hit or a wizard goes down
  const kick = (k) => { if (v('echo.pulse', 0)) pulse = Math.min(1, pulse + k * v('echo.pulse', 0)); };
  window.FEATURES.on('demonHit', () => kick(0.6), 'lab');
  window.FEATURES.on('knockdown', () => kick(0.8), 'lab');
  const post = {
    target(r) {
      if (!made) make();
      r.getDrawingBufferSize(size);
      if (size.x !== w || size.y !== h) { w = size.x; h = size.y; for (const k of ['scene', 'a', 'b', 'p', 'q']) made[k].setSize(w, h); for (const s of stages) if (s.size) s.size(w, h); fresh = true; }
      return made.scene;
    },
    draw(r) {
      const m = made, u = m.mat.uniforms, now = performance.now() / 1000;
      if (fresh) { for (const t of [m.a, m.b]) { r.setRenderTarget(t); r.setClearColor(0x000000, 1); r.clear(); } fresh = false; }
      pulse *= Math.exp(-6 * Math.min(0.1, now - lastNow)); lastNow = now;
      u.tScene.value = m.scene.texture; u.tPrev.value = m.a.texture; u.res.value.set(w, h); u.time.value = now;
      const set = (k, val) => { u[k].value = val; };
      set('warp', v('look.warp', 0)); set('warpSpeed', v('look.warpSpeed', 1)); set('swirl', v('look.swirl', 0)); set('bulge', v('look.bulge', 0));
      set('mirror', v('look.mirror', 0)); set('kal', v('look.kaleido', 0)); set('pix', v('look.pixelate', 1));
      set('trails', v('look.trails', 0)); set('tZoom', v('echo.zoom', 0)); set('tSpin', v('echo.spin', 0)); set('tHue', v('echo.hue', 0));
      set('split', v('look.split', 0)); set('glitch', v('echo.glitch', 0)); set('pulse', pulse);
      set('levels', v('colour.levels', 0)); set('dither', v('colour.dither', 0)); set('ditherSize', v('colour.ditherSize', 2));
      set('tint', v('colour.tint', 0)); set('hue', v('colour.hue', 0) * Math.PI / 180); set('invert', v('colour.invert', 0));
      set('sat', v('tone.sat', 0)); set('con', v('tone.con', 0)); set('bri', v('tone.bri', 0)); set('outline', v('tone.outline', 0)); set('glow', v('tone.glow', 0));
      set('scan', v('colour.scan', 0)); set('vig', v('screen.vignette', 0)); set('grain', v('screen.grain', 0)); set('crt', v('screen.crt', 0));
      set('halftone', v('screen.halftone', 0)); set('dotSize', v('screen.dotSize', 6));
      u.tintCol.value.copy(game.solid.color);
      const pi = v('tone.palette', 0), P = PALETTES[pi];
      set('pal', pi);
      if (P) { if (P[1]) P[1].forEach((c, i) => u['pal' + i].value.setHex(c));
        else { const c = game.solid.color; u.pal0.value.setHex(0x000000); u.pal1.value.copy(c).multiplyScalar(0.35); u.pal2.value.copy(c); u.pal3.value.setHex(0xffffff); } }
      // this file's own shader (only while one of its knobs is on), then any other stages, then the screen
      let src = m.scene;
      const ran = mine();
      if (ran) { r.setRenderTarget(m.b); r.render(m.fx, m.cam); src = m.b; }
      for (const s of stages) {
        if (!s.active()) continue;
        const dst = src === m.p ? m.q : m.p;
        if (s.render(r, src, dst, now)) src = dst;   // a stage that draws into dst says so; one that draws over src in place doesn't
      }
      m.copy.map = src.texture; r.setRenderTarget(null); r.render(m.out, m.cam);
      if (ran) { const t = m.a; m.a = m.b; m.b = t; }   // this picture is the trail for the next one
    }
  };
  // the shader runs only while some knob on these shelves isn't normal
  const knobs = [];
  // other files add stages after this shader: LAB.screen.add({ active(), render(renderer, fromRT, toRT, now) -> true if it drew into toRT, size(w, h) })
  const stages = [];
  const mine = () => knobs.some(([id, normal]) => (LAB.get(id) ?? normal) !== normal && !id.endsWith('Speed') && !id.endsWith('Size')) || pulse > 0.001;
  LAB.screen = { add(s) { stages.push(s); if (made && w) s.size && s.size(w, h); }, sync: () => sync(), get size() { return { w, h }; } };
  function sync() {
    const any = mine() || stages.some(s => s.active());
    if (any && game.post !== post) fresh = true;
    game.post = any ? post : null;
  }
  const offOr = (x) => (x < 2 ? 'OFF' : String(x));
  const deg = (x) => x + '°';
  const reg = (shelf, list) => { for (const t of list) { knobs.push([t.id.includes('.') ? t.id : shelf + '.' + t.id, t.value]); t.apply = sync; } return list; };
  // ids with a dot keep the name they had on the first two shelves, so prototypes saved then still work
  LAB.shelf('look', 'Look', () => reg('look', [
    { id: 'warp', label: 'Warp', help: 'The picture ripples like heat', min: 0, max: 2, step: 0.1, value: 0 },
    { id: 'warpSpeed', label: 'Warp speed', help: 'How fast it ripples', min: 0, max: 4, step: 0.1, value: 1, dice: false },
    { id: 'swirl', label: 'Swirl', help: 'Twist the middle around', min: -3, max: 3, step: 0.1, value: 0 },
    { id: 'bulge', label: 'Bulge', help: 'Fisheye out, or pinch in below 0', min: -2, max: 2, step: 0.1, value: 0 },
    { id: 'mirror', label: 'Mirror', help: 'Fold the picture in half', min: 0, max: 3, step: 1, value: 0, fmt: (x) => ['OFF', 'SIDES', 'TOP', 'BOTH'][x] },
    { id: 'kaleido', label: 'Kaleidoscope', help: 'Mirror pieces around the middle', min: 0, max: 12, step: 1, value: 0, fmt: offOr },
    { id: 'pixelate', label: 'Pixelate', help: 'Big square pixels over everything', min: 1, max: 24, step: 1, value: 1, fmt: offOr }
  ]));
  LAB.shelf('echo', 'Echo', () => reg('echo', [
    { id: 'look.trails', label: 'Trails', help: 'Everything leaves ghosts', min: 0, max: 0.95, step: 0.05, value: 0 },
    { id: 'zoom', label: 'Trail zoom', help: 'Ghosts fly out (or in) like a tunnel', min: -4, max: 4, step: 0.25, value: 0 },
    { id: 'spin', label: 'Trail spin', help: 'Ghosts turn as they fade', min: -4, max: 4, step: 0.25, value: 0 },
    { id: 'hue', label: 'Trail colour', help: 'Ghosts shift colour as they fade', min: -3, max: 3, step: 0.25, value: 0 },
    { id: 'look.split', label: 'Colour split', help: 'Red, green and blue drift apart', min: 0, max: 4, step: 0.1, value: 0 },
    { id: 'glitch', label: 'Glitch', help: 'Bands of the picture jump sideways', min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'pulse', label: 'Hit pulse', help: 'A flash when the demon is hit or someone goes down', min: 0, max: 2, step: 0.1, value: 0 }
  ]));
  LAB.shelf('colour', 'Colour', () => reg('colour', [
    { id: 'levels', label: 'Colours', help: 'Shades per colour: 2 is harsh', min: 0, max: 8, step: 1, value: 0, fmt: offOr },
    { id: 'dither', label: 'Dither', help: 'Dots between shades (with Colours or Palette)', min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'ditherSize', label: 'Dot size', help: 'How big the dither dots are', min: 1, max: 6, step: 1, value: 2, dice: false },
    { id: 'tint', label: 'Solid colour', help: "The world in the solid's colour", min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'hue', label: 'Hue', help: 'Turn every colour around the wheel', min: -180, max: 180, step: 15, value: 0, fmt: deg },
    { id: 'invert', label: 'Invert', help: 'Swap light and dark', kind: 'onoff', value: 0, dice: true }
  ]));
  LAB.shelf('tone', 'Tone', () => reg('tone', [
    { id: 'palette', label: 'Palette', help: 'Only four colours (Void uses the solid)', min: 0, max: PALETTES.length - 1, step: 1, value: 0, fmt: (x) => (x ? PALETTES[x][0].toUpperCase() : 'OFF') },
    { id: 'sat', label: 'Saturation', help: 'Grey at -1, loud above 0', min: -1, max: 2, step: 0.1, value: 0 },
    { id: 'con', label: 'Contrast', help: 'Flat below 0, punchy above', min: -1, max: 2, step: 0.1, value: 0 },
    { id: 'bri', label: 'Brightness', help: 'Darker or lighter', min: -1, max: 1, step: 0.05, value: 0 },
    { id: 'glow', label: 'Glow', help: 'Bright things bleed light', min: 0, max: 2, step: 0.1, value: 0 },
    { id: 'outline', label: 'Outline', help: "Only the edges, in the solid's colour", min: 0, max: 1, step: 0.05, value: 0 }
  ]));
  LAB.shelf('screen', 'Screen', () => reg('screen', [
    { id: 'colour.scan', label: 'Scanlines', help: 'Dark lines like an old screen', min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'crt', label: 'Curve', help: 'Bend the edges like an old TV', min: 0, max: 3, step: 0.1, value: 0 },
    { id: 'vignette', label: 'Vignette', help: 'Dark corners', min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'grain', label: 'Grain', help: 'Film noise', min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'halftone', label: 'Halftone', help: 'Printed dots, like a comic', min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'dotSize', label: 'Halftone size', help: 'How big the printed dots are', min: 3, max: 16, step: 1, value: 6, dice: false }
  ]));
})();
