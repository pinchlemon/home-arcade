// Lab shelf: PS1. The look of 1990s console 3D, written for this game:
//   Snap: every corner jumps to a coarse screen grid, so shapes jitter and shift as they move or the camera turns.
//   Wobble: on top of that, corners shimmer a little, as if the maths were never quite sure.
//   Colour depth: 15-bit colour (32 shades a channel) with the console's 4x4 dither pattern.
//   Fog: far things fade into the dark.
// Snap and Wobble patch the materials of everything in the scene (and of things made later, checked twice a second);
// nothing is patched until one of them is turned on, and at 0 the patch draws exactly as before.
(() => {
  const game = LAB.game, T = game.THREE;
  const v = (id, normal) => LAB.get(id) ?? normal;
  const U = { snap: { value: 0 }, wobble: { value: 0 }, aspect: { value: 1 }, time: { value: 0 } };
  const HEAD = 'uniform float uPsSnap, uPsWobble, uPsAspect, uPsTime;\nfloat psHash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n';
  const SNAP = `
    if (uPsSnap > 0.0 || uPsWobble > 0.0) {
      vec4 psP = gl_Position;
      if (uPsWobble > 0.0) { float tk = floor(uPsTime * 12.0);
        psP.xy += (vec2(psHash(position + tk), psHash(position.zxy - tk)) - 0.5) * uPsWobble * 0.012 * psP.w; }
      if (uPsSnap > 0.0) { vec2 grid = vec2(240.0 * uPsAspect, 240.0) / uPsSnap; psP.xy = floor(psP.xy / psP.w * grid * 0.5 + 0.5) / (grid * 0.5) * psP.w; }
      gl_Position = psP;
    }`;
  const done = new WeakSet();
  function patch(m) {
    if (!m || Array.isArray(m) || done.has(m) || !m.isMaterial) return;
    done.add(m);
    const before = m.onBeforeCompile;
    m.userData.labKey = (m.userData.labKey || '') + '|ps1';
    m.customProgramCacheKey = () => 'lab' + m.userData.labKey;
    m.onBeforeCompile = (sh, r) => {
      before.call(m, sh, r);
      if (!sh.vertexShader.includes('#include <project_vertex>')) return;
      sh.uniforms.uPsSnap = U.snap; sh.uniforms.uPsWobble = U.wobble; sh.uniforms.uPsAspect = U.aspect; sh.uniforms.uPsTime = U.time;
      sh.vertexShader = HEAD + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + SNAP);
    };
    m.needsUpdate = true;
  }
  let scanAt = 0;
  function scan() { game.scene.traverse(o => { if (o.material) patch(o.material); }); }
  const moving = () => v('ps1.snap', 0) > 0 || v('ps1.wobble', 0) > 0;
  window.FEATURES.on('frame', () => {
    if (!moving()) { U.snap.value = 0; U.wobble.value = 0; return; }
    const now = performance.now() / 1000;
    if (now - scanAt > 0.5) { scanAt = now; scan(); }
    U.snap.value = v('ps1.snap', 0); U.wobble.value = v('ps1.wobble', 0); U.aspect.value = innerWidth / innerHeight; U.time.value = now;
  }, 'lab');

  // fog: three.js's own, black like the void
  let fog = null;
  function setFog(k) {
    if (!k) { game.scene.fog = null; return; }
    fog = fog || new T.Fog(0x000000, 40, 90);
    const d = game.camera.position.distanceTo(game.player.root.position) || 55;   // about how far the camera sits from you
    fog.near = d * (1.25 - k * 0.3); fog.far = d * (2.4 - k * 0.9);   // at the most, you are just inside it
    game.scene.fog = fog;
  }

  // 15-bit colour with the console's ordered dither, after the other screen effects
  const FRAG = `uniform sampler2D tDiffuse; varying vec2 vUv;
    float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float d = (bayer4(gl_FragCoord.xy / 2.0) - 0.5) / 31.0 * 2.0;
      gl_FragColor = vec4(floor(clamp(c + d, 0.0, 1.0) * 31.0 + 0.5) / 31.0, 1.0); }`;
  let quad = null;
  LAB.screen.add({ active: () => v('ps1.depth', 0) > 0, render(r, from, to) {
    if (!quad) { const mat = new T.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG });
      const sc = new T.Scene(), mesh = new T.Mesh(new T.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; sc.add(mesh);
      const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); quad = { mat, render: (rr) => rr.render(sc, cam) }; }
    quad.mat.uniforms.tDiffuse.value = from.texture; r.setRenderTarget(to); quad.render(r); return true;
  } });

  LAB.shelf('ps1', 'PS1', () => [
    { id: 'snap', label: 'Snap', help: 'Corners jump to a coarse grid: shapes jitter as they move', min: 0, max: 8, step: 0.5, value: 0, fmt: (x) => (x ? String(x) : 'OFF'),
      apply: (x) => { if (x > 0) scan(); } },
    { id: 'wobble', label: 'Wobble', help: 'Corners shimmer on their own', min: 0, max: 2, step: 0.1, value: 0, apply: (x) => { if (x > 0) scan(); } },
    { id: 'depth', label: 'Colour depth', help: '15-bit colour with the old dither pattern', kind: 'onoff', value: 0, dice: true, fmt: (x) => (x ? '15-BIT' : 'OFF'), apply: () => LAB.screen.sync() },
    { id: 'fog', label: 'Fog', help: 'Far things fade into the dark', min: 0, max: 1, step: 0.05, value: 0, apply: setFog, frame: (dt, k) => setFog(k) }
  ]);
})();
