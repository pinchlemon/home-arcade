// Lab shelf: PS2. A sixth-generation console look, from gsimone's "crunchy ps2 style rendering resources" list:
// the picture drawn at 640x448 and stretched soft to the screen, interlaced fields and the de-flicker filter,
// a composite cable (colour blurred narrower than brightness, so it bleeds sideways, and a little dot crawl), 16-bit
// colour with ordered (Bayer) dithering, Shadow of the Colossus style dreamy bloom and a washed-out grade, light
// shafts from the Solid (volumetric light scattering as a post-process, GPU Gems 3 ch. 13) and framebuffer motion blur.
// One screen stage (LAB.screen) that runs only while a knob here isn't normal. Nothing is made until then.
(() => {
  const game = LAB.game, T = game.THREE;
  const v = (id, n) => LAB.get(id) ?? n;
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const COMMON = `
    varying vec2 vUv;
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }`;
  // bright parts, smaller
  const BRIGHT = COMMON + `
    uniform sampler2D tSrc; uniform float thresh;
    void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = lum(c); gl_FragColor = vec4(c * smoothstep(thresh, thresh + 0.35, l), 1.0); }`;
  // a 9-tap blur one way
  const BLUR = COMMON + `
    uniform sampler2D tSrc; uniform vec2 dir;
    void main(){
      vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
      s += (texture2D(tSrc, vUv + dir * 1.385).rgb + texture2D(tSrc, vUv - dir * 1.385).rgb) * 0.316;
      s += (texture2D(tSrc, vUv + dir * 3.231).rgb + texture2D(tSrc, vUv - dir * 3.231).rgb) * 0.070;
      gl_FragColor = vec4(s, 1.0);
    }`;
  // light shafts: march from each pixel toward the light, gathering bright sky and solid as it goes
  const RAYS = COMMON + `
    uniform sampler2D tSrc; uniform vec2 light; uniform float on;
    void main(){
      vec2 d = (vUv - light) / 40.0, uv = vUv; float w = 1.0; vec3 s = vec3(0.0);
      for (int i = 0; i < 40; i++) { uv -= d; vec3 c = texture2D(tSrc, uv).rgb; s += c * smoothstep(0.45, 0.9, lum(c)) * w; w *= 0.955; }
      gl_FragColor = vec4(s / 40.0 * on, 1.0);
    }`;
  // the console and the cable, drawn at the picture size (640x448 with 480i on)
  const MAIN = COMMON + `
    uniform sampler2D tSrc, tBloom, tRays, tPrev; uniform vec2 res; uniform float frame, bloom, wash, rays, blur, c16, comp, inter;
    uniform vec3 rayCol;
    float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    vec3 console(vec2 uv){
      vec3 c = texture2D(tSrc, uv).rgb;
      if (bloom > 0.0) { vec3 b = texture2D(tBloom, uv).rgb * bloom * 1.6; c = 1.0 - (1.0 - c) * (1.0 - b); c += b * 0.25; }   // screen, then a little over
      if (rays > 0.0) c += texture2D(tRays, uv).rgb * rayCol * rays * 3.0;
      if (wash > 0.0) { float l = lum(c); c = mix(c, vec3(l) * vec3(1.03, 1.0, 0.94), wash * 0.6); c = mix(c, c * 0.85 + 0.08, wash * 0.7); }   // faded, a touch warm, lifted blacks
      return c;
    }
    vec3 toYIQ(vec3 c){ return vec3(lum(c), dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312))); }
    vec3 toRGB(vec3 y){ return vec3(y.x + 0.956 * y.y + 0.621 * y.z, y.x - 0.272 * y.y - 0.647 * y.z, y.x - 1.106 * y.y + 1.703 * y.z); }
    void main(){
      vec2 px = 1.0 / res, uv = vUv;
      vec3 c = console(uv);
      // composite: brightness stays sharp-ish, I blurs over about 5 pixels and Q over about 9, then a crawling dot pattern
      if (comp > 0.0) {
        vec3 y0 = toYIQ(c), acc = vec3(0.0); float wi = 0.0, wq = 0.0, yl = 0.0;
        for (int k = -4; k <= 4; k++) {
          float fk = float(k); vec3 s = toYIQ(console(uv + vec2(fk * px.x, 0.0)));
          float a = abs(fk) <= 2.0 ? 1.0 : 0.0; acc.y += s.y * a; wi += a; acc.z += s.z; wq += 1.0;
          if (abs(fk) <= 1.0) yl += s.x * (fk == 0.0 ? 0.5 : 0.25);
        }
        vec3 yiq = vec3(mix(y0.x, yl, comp), mix(y0.y, acc.y / wi, comp), mix(y0.z, acc.z / wq, comp));
        float crawl = sin((gl_FragCoord.x * 1.5708) + (gl_FragCoord.y * 3.1416) + frame * 3.1416) * length(yiq.yz) * 0.18 * comp;
        yiq.x += crawl;
        c = toRGB(yiq);
      }
      // framebuffer motion blur: a little of the last picture stays
      if (blur > 0.0) c = mix(c, texture2D(tPrev, uv).rgb, blur);
      // 16-bit colour: 32 shades a channel, ordered dither between them
      if (c16 > 0.0) { float d = bayer4(gl_FragCoord.xy) - 0.5; c = floor(c * 31.0 + 0.5 + d) / 31.0; }
      // interlace: every other line a touch darker, swapping each frame, softened by the de-flicker filter
      if (inter > 0.0) {
        vec3 up = console(uv + vec2(0.0, px.y)), dn = console(uv - vec2(0.0, px.y));
        c = mix(c, c * 0.5 + (up + dn) * 0.25, inter * 0.7);
        float field = mod(floor(gl_FragCoord.y) + frame, 2.0);
        c *= 1.0 - inter * 0.18 * field;
      }
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`;
  const COPY = COMMON + 'uniform sampler2D tSrc; void main(){ gl_FragColor = texture2D(tSrc, vUv); }';

  // ---- the parts, made the first time they are needed (three.js gives new things ids from Math.random)
  let made = null, W = 0, H = 0, frame = 0;
  let cam = null;
  function quad(frag, uniforms) {
    cam = cam || new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    const sc = new T.Scene(), m = new T.Mesh(new T.PlaneGeometry(2, 2), mat); m.frustumCulled = false; sc.add(m);
    return { u: mat.uniforms, draw(r, to) { r.setRenderTarget(to); r.render(sc, cam); } };
  }
  const rt = (w, h) => new T.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), { depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
  function make() {
    const t = () => ({ value: null });
    made = {
      low: rt(640, 448), main: rt(640, 448), prev: rt(640, 448),
      b1: rt(80, 56), b2: rt(80, 56), ray: rt(320, 224),
      bright: quad(BRIGHT, { tSrc: t(), thresh: { value: 0.55 } }),
      blur: quad(BLUR, { tSrc: t(), dir: { value: new T.Vector2() } }),
      rays: quad(RAYS, { tSrc: t(), light: { value: new T.Vector2(0.5, 0.5) }, on: { value: 1 } }),
      main0: quad(MAIN, { tSrc: t(), tBloom: t(), tRays: t(), tPrev: t(), res: { value: new T.Vector2(640, 448) }, frame: { value: 0 }, rayCol: { value: new T.Color() },
        bloom: { value: 0 }, wash: { value: 0 }, rays: { value: 0 }, blur: { value: 0 }, c16: { value: 0 }, comp: { value: 0 }, inter: { value: 0 } }),
      copy: quad(COPY, { tSrc: t() })
    };
  }
  const sized = { w: 0, h: 0 };
  function sizeTo(w, h) {   // the picture size: 640x448 for 480i, otherwise the screen's own
    if (sized.w === w && sized.h === h) return;
    sized.w = w; sized.h = h; made.main.setSize(w, h); made.prev.setSize(w, h);
    made.b1.setSize(Math.max(1, w / 8 | 0), Math.max(1, h / 8 | 0)); made.b2.setSize(Math.max(1, w / 8 | 0), Math.max(1, h / 8 | 0)); made.ray.setSize(Math.max(1, w / 2 | 0), Math.max(1, h / 2 | 0));
  }
  const KNOBS = [['ps2.res', 0], ['ps2.inter', 0], ['ps2.comp', 0], ['ps2.c16', 0], ['ps2.bloom', 0], ['ps2.wash', 0], ['ps2.rays', 0], ['ps2.blur', 0]];
  const on = () => KNOBS.some(([id, n]) => v(id, n) !== n);
  const P = new T.Vector3();
  LAB.screen.add({
    active: on,
    size: (w, h) => { W = w; H = h; },
    render(r, from, to) {
      if (!made) make();
      const m = made, lowRes = v('ps2.res', 0) === 1;
      const w = lowRes ? 640 : W, h = lowRes ? 448 : H;
      sizeTo(w, h);
      let src = from;
      if (lowRes) { m.copy.u.tSrc.value = from.texture; m.copy.draw(r, m.low); src = m.low; }   // drawn at 480 lines
      const bl = v('ps2.bloom', 0), ry = v('ps2.rays', 0);
      if (bl > 0) {   // bright parts at an eighth, blurred twice each way
        m.bright.u.tSrc.value = src.texture; m.bright.draw(r, m.b1);
        for (let i = 0; i < 2; i++) {
          m.blur.u.tSrc.value = m.b1.texture; m.blur.u.dir.value.set(1 / m.b1.width * (1 + i), 0); m.blur.draw(r, m.b2);
          m.blur.u.tSrc.value = m.b2.texture; m.blur.u.dir.value.set(0, 1 / m.b1.height * (1 + i)); m.blur.draw(r, m.b1);
        }
      }
      if (ry > 0) {   // from the Solid, wherever it is on screen (fading out as it leaves)
        P.copy(game.orbMesh.position).project(game.camera);
        const inside = P.z < 1 ? Math.max(0, 1 - Math.max(0, Math.max(Math.abs(P.x), Math.abs(P.y)) - 1) * 2) : 0;
        m.rays.u.tSrc.value = src.texture; m.rays.u.light.value.set(P.x * 0.5 + 0.5, P.y * 0.5 + 0.5); m.rays.u.on.value = inside; m.rays.draw(r, m.ray);
      }
      const u = m.main0.u;
      u.tSrc.value = src.texture; u.tBloom.value = m.b1.texture; u.tRays.value = m.ray.texture; u.tPrev.value = m.prev.texture;
      u.res.value.set(w, h); u.frame.value = frame = (frame + 1) % 2; u.rayCol.value.copy(game.solid.color).lerp(new T.Color(1, 1, 1), 0.5);
      u.bloom.value = bl; u.wash.value = v('ps2.wash', 0); u.rays.value = ry; u.blur.value = v('ps2.blur', 0);
      u.c16.value = v('ps2.c16', 0); u.comp.value = v('ps2.comp', 0); u.inter.value = v('ps2.inter', 0);
      m.main0.draw(r, m.main);
      m.copy.u.tSrc.value = m.main.texture; m.copy.draw(r, to);   // stretched (softly) to the screen
      if (u.blur.value > 0) { const t = m.prev; m.prev = m.main; m.main = t; }   // this picture is the next one's blur
      return true;
    }
  });
  const sync = () => LAB.screen.sync();
  LAB.shelf('ps2', 'PS2', () => [
    { id: 'res', label: '480i', help: 'Drawn at 640 by 448 and stretched soft to the screen', kind: 'onoff', value: 0, dice: true, apply: sync },
    { id: 'inter', label: 'Interlace', help: 'Every other line flickers, softened by the de-flicker filter', min: 0, max: 1, step: 0.05, value: 0, apply: sync },
    { id: 'comp', label: 'Composite', help: 'The yellow cable: colour bleeds sideways, with a little dot crawl', min: 0, max: 1, step: 0.05, value: 0, apply: sync },
    { id: 'c16', label: '16-bit colour', help: 'Fewer shades, with a fine dither pattern between them', kind: 'onoff', value: 0, dice: true, apply: sync },
    { id: 'bloom', label: 'Dreamy bloom', help: 'Shadow of the Colossus: light spills soft over everything', min: 0, max: 1.5, step: 0.05, value: 0, apply: sync },
    { id: 'wash', label: 'Washed out', help: 'Faded colour, lifted blacks, a touch warm', min: 0, max: 1, step: 0.05, value: 0, apply: sync },
    { id: 'rays', label: 'Light shafts', help: 'Rays of light stream out from the Solid', min: 0, max: 1.5, step: 0.05, value: 0, apply: sync },
    { id: 'blur', label: 'Motion blur', help: 'A little of the last frame stays', min: 0, max: 0.85, step: 0.05, value: 0, apply: sync }
  ]);
})();
