// Lab shelves: Glow, Print and Moments. Screen effects borrowed from others, each under its own free licence:
//   three.js r128 post-processing (MIT): bloom, digital glitch, CMYK halftone, technicolor, bleach bypass,
//     dot screen, tilt-shift. The files are in lib/three-examples, unchanged, loaded only when a knob here is on.
//   gl-transitions (MIT, authors listed in lab/transitions.js): transitions, loaded only when one is picked.
//   "Anime Style Impact Frames" by ProfesorShader, godotshaders.com (CC0), turned into WebGL below.
// They run after the Look shelves' shader (LAB.screen in lab/look.js), in this order.
(() => {
  const game = LAB.game, T = game.THREE;
  const v = (id, normal) => LAB.get(id) ?? normal;
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  // ---------------------------------------------------------------- loading the borrowed files when first needed
  const loaded = {};
  // each file once, in order (a file loaded twice would make a second copy of its classes)
  const one = (src) => loaded[src] || (loaded[src] = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s);
  }));
  const load = (srcs) => srcs.reduce((p, src) => p.then(() => one(src)), Promise.resolve());
  const LIB = '../lib/three-examples/';
  const BASE = [LIB + 'CopyShader.js', LIB + 'Pass.js'];
  let ready = false, w = 1, h = 1;
  const want = () => load([...BASE, LIB + 'LuminosityHighPassShader.js', LIB + 'UnrealBloomPass.js', LIB + 'DigitalGlitch.js', LIB + 'GlitchPass.js',
    LIB + 'HalftoneShader.js', LIB + 'HalftonePass.js', LIB + 'TechnicolorShader.js', LIB + 'BleachBypassShader.js', LIB + 'DotScreenShader.js',
    LIB + 'HorizontalTiltShiftShader.js', LIB + 'VerticalTiltShiftShader.js']).then(() => { ready = true; LAB.screen.sync(); });

  // a full-screen picture drawn with one material (our own, so nothing is shared with the borrowed passes)
  let quadCam = null;
  function quadOf(mat) {
    quadCam = quadCam || new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sc = new T.Scene(), mesh = new T.Mesh(new T.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; sc.add(mesh);
    return { material: mat, render: (r) => r.render(sc, quadCam) };
  }
  // a three.js shader (tDiffuse in, picture out) as a stage
  function shaderStage(def) {
    let mat = null, quad = null;
    return {
      get u() { if (!mat) { mat = new T.ShaderMaterial({ uniforms: T.UniformsUtils.clone(def().uniforms), vertexShader: def().vertexShader, fragmentShader: def().fragmentShader, depthTest: false, depthWrite: false }); quad = quadOf(mat); } return mat.uniforms; },
      draw(r, from, to) { this.u.tDiffuse.value = from.texture; r.setRenderTarget(to); quad.render(r); return true; }
    };
  }
  const passes = {};
  function stage(active, render) { LAB.screen.add({ active: () => ready && active(), render, size: (W, H) => { w = W; h = H; for (const k in passes) passes[k].setSize && passes[k].setSize(W, H); } }); }

  // ---- Glow
  stage(() => v('glow.bloom', 0) > 0, (r, from) => {
    const p = passes.bloom || (passes.bloom = new T.UnrealBloomPass(new T.Vector2(w, h), 1, 0.4, 0.6));
    p.strength = v('glow.bloom', 0); p.radius = v('glow.radius', 0.4); p.threshold = v('glow.threshold', 0.6);
    p.render(r, null, from); return false;   // bloom adds itself onto the picture in place
  });
  const tiltH = shaderStage(() => T.HorizontalTiltShiftShader), tiltV = shaderStage(() => T.VerticalTiltShiftShader);
  stage(() => v('glow.tilt', 0) > 0, (r, from, to) => { const k = v('glow.tilt', 0) * 4; tiltH.u.h.value = k / w; tiltH.u.r.value = v('glow.focus', 0.5); return tiltH.draw(r, from, to); });
  stage(() => v('glow.tilt', 0) > 0, (r, from, to) => { const k = v('glow.tilt', 0) * 4; tiltV.u.v.value = k / h; tiltV.u.r.value = v('glow.focus', 0.5); return tiltV.draw(r, from, to); });
  stage(() => v('glow.glitch', 0) > 0, (r, from, to) => {
    const p = passes.glitch || (passes.glitch = new T.GlitchPass());
    p.goWild = v('glow.glitch', 0) >= 2; p.render(r, to, from); return true;
  });

  // ---- Print
  const techni = shaderStage(() => T.TechnicolorShader), bleach = shaderStage(() => T.BleachBypassShader), dots = shaderStage(() => T.DotScreenShader);
  stage(() => v('print.techni', 0) > 0, (r, from, to) => techni.draw(r, from, to));
  stage(() => v('print.bleach', 0) > 0, (r, from, to) => { bleach.u.opacity.value = v('print.bleach', 0); return bleach.draw(r, from, to); });
  stage(() => v('print.dots', 0) > 0, (r, from, to) => { const u = dots.u; u.tSize.value.set(w, h); u.scale.value = 2.2 - v('print.dots', 0) * 0.4; u.angle.value = 1.2; return dots.draw(r, from, to); });
  stage(() => v('print.halftone', 0) > 0, (r, from, to) => {
    const p = passes.half || (passes.half = new T.HalftonePass(w, h, { shape: 1, radius: 6, scatter: 0, blending: 1, blendingMode: 1, greyscale: false }));
    p.uniforms.radius.value = v('print.radius', 6); p.uniforms.shape.value = v('print.shape', 1); p.uniforms.width.value = w; p.uniforms.height.value = h;
    p.render(r, to, from); return true;
  });

  // ---------------------------------------------------------------- Moments: impact frames and transitions
  // impact frames: a flash, then the picture in two tones, torn outward from the middle by scrolling noise
  const IMPACT = `
    uniform sampler2D tDiffuse, tNoise; uniform float t, halfPos, power, speed, strength, time; uniform vec3 flash, dark, light;
    varying vec2 vUv;
    void main(){
      vec4 scr = texture2D(tDiffuse, vUv);
      if (t < halfPos) { gl_FragColor = vec4(mix(scr.rgb, flash, smoothstep(0.0, halfPos, t)), 1.0); return; }
      vec2 dir = -(vUv - 0.5);
      float radius = length(dir) * 2.0, angle = atan(dir.y, dir.x) / 6.2831853;
      vec2 nuv = mod(vec2(radius * 0.01 - time * speed, angle * 10.0), 1.0);
      float n = texture2D(tNoise, nuv).r * 2.0 - 1.0; n = sign(n) * pow(abs(n), power);
      float d = n * strength * mix(0.5, 1.0, length(dir));
      vec4 s = texture2D(tDiffuse, clamp(vUv + dir * d, 0.0, 1.0));
      float g = dot(s.rgb, vec3(0.299, 0.587, 0.114));
      vec3 tone = g > 0.12 ? light : dark;
      gl_FragColor = vec4(mix(flash, tone, smoothstep(halfPos, 1.0, t)), 1.0);
    }`;
  let impactMat = null, impactQuad = null, impactT = -1, impactLen = 0.3;
  function impactU() {
    if (!impactMat) {
      const N = 64, data = new Uint8Array(N * N * 4);
      for (let i = 0; i < N * N; i++) { const x = Math.random() * 255; data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = x; data[i * 4 + 3] = 255; }
      const tex = new T.DataTexture(data, N, N, T.RGBAFormat); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.magFilter = T.LinearFilter; tex.needsUpdate = true;
      impactMat = new T.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: VERT, fragmentShader: IMPACT, uniforms: { tDiffuse: { value: null }, tNoise: { value: tex }, t: { value: 0 }, halfPos: { value: 0.25 },
        power: { value: 3 }, speed: { value: 0.6 }, strength: { value: 0.12 }, time: { value: 0 }, flash: { value: new T.Color(1, 1, 1) }, dark: { value: new T.Color(0, 0, 0) }, light: { value: new T.Color(1, 1, 1) } } });
      impactQuad = quadOf(impactMat);
    }
    return impactMat.uniforms;
  }
  const LOOKS = [['BLACK', 0xffffff, 0x000000, 0xffffff], ['WHITE', 0x000000, 0xffffff, 0x000000], ['RED', 0xffffff, 0x000000, 0xff2a2a], ['SOLID', null, 0x000000, null]];
  function impact(len) {
    load(BASE).then(() => { impactT = performance.now() / 1000; impactLen = len || v('moments.impactLen', 0.3); LAB.screen.sync(); });
  }
  LAB.screen.add({ active: () => impactT >= 0, render(r, from, to, now) {
    const u = impactU(), k = (now - impactT) / impactLen;
    if (k >= 1) { impactT = -1; setTimeout(() => LAB.screen.sync()); return false; }
    const L = LOOKS[v('moments.impactLook', 0)], sc = game.solid.color;
    u.t.value = k; u.time.value = now; u.tDiffuse.value = from.texture;
    if (L[1] === null) { u.flash.value.copy(sc); u.light.value.copy(sc); } else { u.flash.value.setHex(L[1]); u.light.value.setHex(L[3]); }
    u.dark.value.setHex(L[2]);
    r.setRenderTarget(to); impactQuad.render(r); return true;
  } });

  // transitions: the picture as it was swaps into the game as it is now
  let list = null, trans = null, transT = -1, snap = null, snapCopy = null;
  const transitions = () => (list ? Promise.resolve(list) : load(['lab/transitions.js']).then(() => (list = window.LAB_TRANSITIONS)));
  function material(tr) {
    if (tr.mat) return tr.mat;
    const u = { from: { value: null }, to: { value: null }, progress: { value: 0 }, ratio: { value: 1 } };
    let decl = '';
    for (const k in tr.types) {
      const ty = tr.types[k], d = tr.params[k];
      const val = ty === 'ivec2' ? d.slice() : ty === 'vec2' ? new T.Vector2(...d) : ty === 'vec3' ? new T.Vector3(...d) : ty === 'vec4' ? new T.Vector4(...d) : ty === 'bool' ? !!d : d;
      u[k] = { value: val };
    }
    // the transition's own uniform lines stay in its code; ours come first
    const head = 'uniform sampler2D from, to; uniform float progress, ratio; varying vec2 vUv;\nvec4 getFromColor(vec2 uv){ return texture2D(from, uv); }\nvec4 getToColor(vec2 uv){ return texture2D(to, uv); }\n';
    tr.mat = new T.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: VERT, fragmentShader: head + tr.glsl + '\nvoid main(){ gl_FragColor = transition(vUv); }', uniforms: u });
    return tr.mat;
  }
  function transition() {
    const k = v('moments.transition', 0); if (!k) return;
    Promise.all([load(BASE), transitions()]).then(() => { trans = list[k - 1]; transT = performance.now() / 1000; snap = null; LAB.screen.sync(); });
  }
  LAB.screen.add({ active: () => transT >= 0 && !!trans, render(r, from, to, now) {
    if (!snap) {   // the first frame: keep a copy of it to swap away from
      snap = snap || new T.WebGLRenderTarget(w, h, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false });
      if (snap.width !== w || snap.height !== h) snap.setSize(w, h);
      snapCopy = snapCopy || quadOf(new T.MeshBasicMaterial({ depthTest: false, depthWrite: false }));
      snapCopy.material.map = from.texture; r.setRenderTarget(snap); snapCopy.render(r);
    }
    const k = (now - transT) / v('moments.transLen', 1);
    if (k >= 1) { transT = -1; setTimeout(() => LAB.screen.sync()); return false; }
    const m = material(trans); m.uniforms.from.value = snap.texture; m.uniforms.to.value = from.texture; m.uniforms.progress.value = k; m.uniforms.ratio.value = w / h;
    trans.quad = trans.quad || quadOf(m);
    r.setRenderTarget(to); trans.quad.render(r); return true;
  } });
  // big moments start them
  window.FEATURES.on('demonDown', () => { if (v('moments.onDown', 0)) transition(); if (v('moments.impact', 0)) impact(); }, 'lab');
  window.FEATURES.on('knockdown', (W) => { if (v('moments.impact', 0) && W && W.human) impact(); }, 'lab');
  window.FEATURES.on('demonHit', (dmg) => { if (v('moments.impact', 0) && dmg >= v('moments.impactMin', 12)) impact(); }, 'lab');
  LAB.impact = impact; LAB.transition = transition;   // for the rules

  const sync = () => { if (!ready) want(); LAB.screen.sync(); };
  const names = ['OFF', 'GRAVITY LENS', 'VORTEX', 'WARP SPEED', 'DOOM MELT', 'CROSS ZOOM', 'SWIRL', 'RIPPLE', 'SHATTER', 'INK BLEED', 'PERLIN', 'PLASMA',
    'GLITCH MEM', 'TV OFF', 'HEXAGONS', 'PIXELIZE', 'KALEIDO', 'LIGHTNING', 'CIRCLE BURST', 'DREAMY', 'BURN', 'TUNNEL', 'STATIC', 'DISINTEGRATE', 'CROSS WARP'];
  LAB.shelf('glow', 'Glow', () => [
    { id: 'bloom', label: 'Bloom', help: 'Real glow around bright things (three.js)', min: 0, max: 3, step: 0.1, value: 0, apply: sync },
    { id: 'radius', label: 'Bloom size', help: 'How far the glow spreads', min: 0, max: 1, step: 0.05, value: 0.4, dice: false },
    { id: 'threshold', label: 'Bloom from', help: 'How bright before it glows', min: 0, max: 1, step: 0.05, value: 0.6, dice: false },
    { id: 'tilt', label: 'Tilt-shift', help: 'Blurry top and bottom: a tiny model world', min: 0, max: 3, step: 0.1, value: 0, apply: sync },
    { id: 'focus', label: 'Tilt focus', help: 'Where the sharp band sits', min: 0.1, max: 0.9, step: 0.05, value: 0.5, dice: false },
    { id: 'glitch', label: 'Digital glitch', help: 'Random torn frames (three.js)', min: 0, max: 2, step: 1, value: 0, fmt: (x) => ['OFF', 'ON', 'WILD'][x], apply: sync }
  ]);
  LAB.shelf('print', 'Print', () => [
    { id: 'techni', label: 'Technicolor', help: 'Old two-strip film colour', kind: 'onoff', value: 0, dice: true, apply: sync },
    { id: 'bleach', label: 'Bleach bypass', help: 'Harsh, washed-out film', min: 0, max: 2, step: 0.1, value: 0, apply: sync },
    { id: 'dots', label: 'Dot screen', help: 'Black and white newspaper dots', min: 0, max: 4, step: 0.5, value: 0, apply: sync },
    { id: 'halftone', label: 'CMYK halftone', help: 'Coloured print dots', kind: 'onoff', value: 0, dice: true, apply: sync },
    { id: 'radius', label: 'Print dot size', help: 'How big the coloured dots are', min: 2, max: 20, step: 1, value: 6, dice: false },
    { id: 'shape', label: 'Print dot shape', help: 'Dot, ellipse, line or square', min: 1, max: 4, step: 1, value: 1, fmt: (x) => ['', 'DOT', 'ELLIPSE', 'LINE', 'SQUARE'][x], dice: false }
  ]);
  LAB.shelf('moments', 'Moments', () => [
    { id: 'impact', label: 'Impact frames', help: 'Big hits and knockdowns flash in two tones', kind: 'onoff', value: 0, dice: true, apply: (x) => { if (x) impact(); } },
    { id: 'impactLook', label: 'Impact look', help: 'The colours of the flash', min: 0, max: LOOKS.length - 1, step: 1, value: 0, fmt: (x) => LOOKS[x][0], dice: false, apply: () => { if (v('moments.impact', 0)) impact(); } },
    { id: 'impactLen', label: 'Impact length', help: 'Seconds it lasts', min: 0.1, max: 1, step: 0.05, value: 0.3, dice: false },
    { id: 'impactMin', label: 'Impact from', help: 'How hard a hit on the demon has to be', min: 1, max: 60, step: 1, value: 12, dice: false },
    { id: 'transition', label: 'Transition', help: 'Picking one plays it (gl-transitions)', min: 0, max: names.length - 1, step: 1, value: 0, fmt: (x) => names[x], apply: transition },
    { id: 'transLen', label: 'Transition length', help: 'Seconds it takes', min: 0.3, max: 4, step: 0.1, value: 1, dice: false },
    { id: 'onDown', label: 'On demon down', help: 'Play the transition when a demon is beaten', kind: 'onoff', value: 0, dice: true }
  ]);
})();
