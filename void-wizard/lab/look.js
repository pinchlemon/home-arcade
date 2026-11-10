// Lab shelves: Look and Colour. Screen shaders: the finished picture (world, solid, wizards) goes through one
// shader before it reaches the screen. The HUD and the corner badge stay as they are.
// Nothing is made until a knob moves, and with every knob back to normal the game draws straight to the screen again.
(() => {
  const game = LAB.game, T = game.THREE;
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const FRAG = `
    uniform sampler2D tScene, tPrev; uniform vec2 res; uniform float time;
    uniform float warp, warpSpeed, kal, split, trails, levels, dither, ditherSize, tint, hue, scan, invert;
    uniform vec3 tintCol;
    varying vec2 vUv;
    float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    vec3 hueShift(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }
    void main(){
      vec2 uv = vUv, asp = vec2(res.x / res.y, 1.0);
      if (kal >= 2.0) {   // kaleidoscope: fold the picture around the middle
        vec2 p = (uv - 0.5) * asp; float r = length(p), a = atan(p.y, p.x), s = 6.2831853 / kal;
        a = mod(a, s); a = abs(a - s * 0.5); uv = vec2(cos(a), sin(a)) * r / asp + 0.5;
      }
      if (warp > 0.0) uv += warp * 0.03 * vec2(sin(uv.y * 12.0 + time * warpSpeed * 3.0), cos(uv.x * 10.0 + time * warpSpeed * 2.6));
      uv = clamp(uv, 0.0, 1.0);
      vec3 col;
      if (split > 0.0) { vec2 o = split * 0.006 * vec2(cos(time * 0.7), sin(time * 0.9) * 0.4);
        col = vec3(texture2D(tScene, clamp(uv + o, 0.0, 1.0)).r, texture2D(tScene, uv).g, texture2D(tScene, clamp(uv - o, 0.0, 1.0)).b); }
      else col = texture2D(tScene, uv).rgb;
      if (hue != 0.0) col = clamp(hueShift(col, hue), 0.0, 1.0);
      if (tint > 0.0) { float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(col, clamp(tintCol * l * 1.8, 0.0, 1.0), tint); }
      if (levels >= 2.0) { float d = (bayer4(gl_FragCoord.xy / ditherSize) - 0.5) * dither; col = floor(col * (levels - 1.0) + 0.5 + d) / (levels - 1.0); }
      if (invert > 0.5) col = 1.0 - col;
      if (scan > 0.0) col *= 1.0 - scan * 0.6 * step(mod(gl_FragCoord.y, 3.0), 1.0);
      if (trails > 0.0) col = max(col, texture2D(tPrev, vUv).rgb * trails);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;
  let made = null, w = 0, h = 0, fresh = true;
  const size = new T.Vector2();
  function make() {   // made on first use (three.js ids use Math.random)
    const rt = () => new T.WebGLRenderTarget(1, 1, { minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    const u = { tScene: { value: null }, tPrev: { value: null }, res: { value: new T.Vector2() }, time: { value: 0 }, tintCol: { value: new T.Color() } };
    for (const k of ['warp', 'warpSpeed', 'kal', 'split', 'trails', 'levels', 'dither', 'ditherSize', 'tint', 'hue', 'scan', 'invert']) u[k] = { value: 0 };
    const mat = new T.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
    const copy = new T.MeshBasicMaterial({ depthTest: false, depthWrite: false });
    const geo = new T.PlaneGeometry(2, 2), fx = new T.Scene(), out = new T.Scene();
    fx.add(new T.Mesh(geo, mat)); out.add(new T.Mesh(geo, copy));
    made = { scene: rt(), a: rt(), b: rt(), mat, copy, fx, out, cam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }
  const v = (id, normal) => LAB.get(id) ?? normal;
  const post = {
    target(r) {
      if (!made) make();
      r.getDrawingBufferSize(size);
      if (size.x !== w || size.y !== h) { w = size.x; h = size.y; for (const k of ['scene', 'a', 'b']) made[k].setSize(w, h); fresh = true; }
      return made.scene;
    },
    draw(r) {
      const m = made, u = m.mat.uniforms;
      if (fresh) { for (const t of [m.a, m.b]) { r.setRenderTarget(t); r.setClearColor(0x000000, 1); r.clear(); } fresh = false; }
      u.tScene.value = m.scene.texture; u.tPrev.value = m.a.texture; u.res.value.set(w, h); u.time.value = performance.now() / 1000;
      u.warp.value = v('look.warp', 0); u.warpSpeed.value = v('look.warpSpeed', 1); u.kal.value = v('look.kaleido', 0);
      u.split.value = v('look.split', 0); u.trails.value = v('look.trails', 0);
      u.levels.value = v('colour.levels', 0); u.dither.value = v('colour.dither', 0); u.ditherSize.value = v('colour.ditherSize', 2);
      u.tint.value = v('colour.tint', 0); u.tintCol.value.copy(game.solid.color); u.hue.value = v('colour.hue', 0) * Math.PI / 180;
      u.scan.value = v('colour.scan', 0); u.invert.value = v('colour.invert', 0);
      r.setRenderTarget(m.b); r.render(m.fx, m.cam);
      m.copy.map = m.b.texture; r.setRenderTarget(null); r.render(m.out, m.cam);
      const t = m.a; m.a = m.b; m.b = t;   // this picture is the trail for the next one
    }
  };
  // the shader runs only while some knob on these two shelves isn't normal
  const knobs = [];
  function sync() {
    const any = knobs.some(([id, normal]) => (LAB.get(id) ?? normal) !== normal);
    if (any && game.post !== post) fresh = true;
    game.post = any ? post : null;
  }
  const offOr = (v) => (v < 2 ? 'OFF' : String(v));
  const reg = (shelf, list) => { for (const t of list) { knobs.push([shelf + '.' + t.id, t.value]); t.apply = sync; } return list; };
  LAB.shelf('look', 'Look', () => reg('look', [
    { id: 'warp', label: 'Warp', help: 'The picture ripples like heat', min: 0, max: 2, step: 0.1, value: 0 },
    { id: 'warpSpeed', label: 'Warp speed', help: 'How fast it ripples', min: 0, max: 4, step: 0.1, value: 1, dice: false },
    { id: 'trails', label: 'Trails', help: 'Everything leaves ghosts', min: 0, max: 0.95, step: 0.05, value: 0 },
    { id: 'kaleido', label: 'Kaleidoscope', help: 'Mirror pieces around the middle', min: 0, max: 12, step: 1, value: 0, fmt: offOr },
    { id: 'split', label: 'Colour split', help: 'Red, green and blue drift apart', min: 0, max: 4, step: 0.1, value: 0 }
  ]));
  LAB.shelf('colour', 'Colour', () => reg('colour', [
    { id: 'levels', label: 'Colours', help: 'Shades per colour: 2 is harsh', min: 0, max: 8, step: 1, value: 0, fmt: offOr },
    { id: 'dither', label: 'Dither', help: 'Dots between shades (with Colours on)', min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'ditherSize', label: 'Dot size', help: 'How big the dither dots are', min: 1, max: 6, step: 1, value: 2, dice: false },
    { id: 'tint', label: 'Solid colour', help: "The world in the solid's colour", min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'hue', label: 'Hue', help: 'Turn every colour around the wheel', min: -180, max: 180, step: 15, value: 0, fmt: (x) => x + '°' },
    { id: 'scan', label: 'Scanlines', help: 'Dark lines like an old screen', min: 0, max: 1, step: 0.05, value: 0 },
    { id: 'invert', label: 'Invert', help: 'Swap light and dark', kind: 'onoff', value: 0, dice: true }
  ]));
})();
