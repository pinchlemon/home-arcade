// Lab shelf: PS1. The look of 1990s console 3D, written for this game:
//   Snap: every corner jumps to a coarse screen grid, so shapes jitter and shift as they move or the camera turns.
//   Wobble: on top of that, corners shimmer a little, as if the maths were never quite sure.
//   Colour depth: 15-bit colour (32 shades a channel) with the console's 4x4 dither pattern.
//   Fog: far things fade into the dark.
//   Low poly: the wizards are rebuilt with far fewer faces, like a real PS1 model. Snapping a detailed model makes
//     its many tiny faces collapse into blocks and flip inside out (the black specks); a low-poly one stays clean.
//   Soft shading: light worked out at the corners and blended across each face (Gouraud), as the PS1 did, instead
//     of the game's banded toon light.
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
      if (uPsWobble > 0.0) { float tk = floor(uPsTime * 12.0); vec3 wp = floor((modelMatrix * vec4(position, 1.0)).xyz * 20.0);
        psP.xy += (vec2(psHash(wp + tk), psHash(wp.zxy - tk)) - 0.5) * uPsWobble * 0.012 * psP.w; }   // by place in the world, so touching pieces move together
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
  const anyOn = () => moving() || v('ps1.gouraud', 0) > 0;
  window.FEATURES.on('frame', () => {
    if (v('ps1.gouraud', 0)) syncSoft();
    if (!anyOn()) { U.snap.value = 0; U.wobble.value = 0; return; }
    const now = performance.now() / 1000;
    if (now - scanAt > 0.5) { scanAt = now; if (v('ps1.gouraud', 0)) soften(true); if (moving()) scan(); }
    U.snap.value = v('ps1.snap', 0); U.wobble.value = v('ps1.wobble', 0); U.aspect.value = innerWidth / innerHeight; U.time.value = now;
  }, 'lab');

  // fog: three.js's own, black like the void
  let fog = null;
  function setFog(k) {
    if (!k) { game.scene.fog = null; return; }
    fog = fog || new T.Fog(0x000000, 40, 90);
    const d = game.camera.position.distanceTo(game.you.root.position) || 55;   // about how far the camera sits from you
    fog.near = d * (1.25 - k * 0.3); fog.far = d * (2.4 - k * 0.9);   // at the most, you are just inside it
    game.scene.fog = fog;
  }

  // 15-bit colour with the console's ordered dither, after the other screen effects
  const FRAG = `uniform sampler2D tDiffuse; varying vec2 vUv;
    float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float d = (bayer4(gl_FragCoord.xy / 2.0) - 0.5) / 31.0 * 2.0 * smoothstep(0.0, 0.08, max(c.r, max(c.g, c.b)));   // no dots on the black
      gl_FragColor = vec4(floor(clamp(c + d, 0.0, 1.0) * 31.0 + 0.5) / 31.0, 1.0); }`;
  let quad = null;
  LAB.screen.add({ active: () => v('ps1.depth', 0) > 0, render(r, from, to) {
    if (!quad) { const mat = new T.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG });
      const sc = new T.Scene(), mesh = new T.Mesh(new T.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; sc.add(mesh);
      const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); quad = { mat, render: (rr) => rr.render(sc, cam) }; }
    quad.mat.uniforms.tDiffuse.value = from.texture; r.setRenderTarget(to); quad.render(r); return true;
  } });

  // ---- low poly: rebuild each wizard's robe, hood, hood rim and face with few faces (the game keeps animating them)
  function lowPoly(on) {
    for (const W of game.ALL) {
      if (on && !W.labHi) {
        const meshes = []; W.root.traverse(o => { if (o.isMesh) meshes.push(o); });
        const hi = { robe: W.robeGeo, robeBase: W.robeBase, hood: W.hoodGeo, hoodBase: W.hoodBase, swaps: [] };
        // robe: the same outline, 7 sides instead of 28, coloured by height as the game does
        const rp = W.robeGeo.parameters.points, rc = W.robeGeo.attributes.color.array, rb = W.robeBase;
        const tY = W.labTrimY || 0.05, bandOf = (y) => (y < 0.005 ? 0 : y < tY ? 1 : 2), band = [];   // Colours may make the trim taller
        for (let i = 0; i < rb.length / 3 && !(band[0] && band[1] && band[2]); i++) { const b = bandOf(rb[i * 3 + 1]); if (!band[b]) band[b] = [rc[i * 3], rc[i * 3 + 1], rc[i * 3 + 2]]; }
        const robe = new T.LatheGeometry(rp, 7), n = robe.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) col.set(band[bandOf(robe.attributes.position.array[i * 3 + 1])] || [1, 1, 1], i * 3);
        robe.setAttribute('color', new T.BufferAttribute(col, 3));
        // hood: a coarse sphere built around the face opening, so the opening is one clean ring of edges that meets
        // the rim (cutting holes in a coarse sphere left a jagged edge with the black inside showing through)
        const hp = W.hoodGeo.parameters, fd = new T.Vector3(0, 0.1, 1).normalize();
        const hood = new T.SphereGeometry(hp.radius * 1.04, 9, 6, 0, Math.PI * 2, 0.78, Math.PI - 0.78);
        hood.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), fd)));
        for (const m of meshes) {
          const g = m.geometry, P = g.parameters || {};
          let lo = null;
          if (g === W.robeGeo) lo = robe;
          else if (g === W.hoodGeo) lo = hood;
          else if (g.type === 'TorusGeometry') lo = new T.TorusGeometry(P.radius * 1.03, P.tube * 1.2, 4, 9);   // the hood's rim, over the opening's edge
          else if (g.type === 'CircleGeometry' && P.radius > 0.4 && P.radius < 0.5) lo = new T.CircleGeometry(P.radius * 0.87, 14);   // the robe's black floor, kept inside the 7-sided hem
          else if (g.type === 'SphereGeometry' && g !== W.hoodGeo && P.radius > 0.2 && P.radius < 0.35) lo = new T.SphereGeometry(P.radius * 0.9, 8, 6);   // the black face, kept well inside the hood
          if (lo) { hi.swaps.push([m, g]); m.geometry = lo; }
        }
        W.robeGeo = robe; W.robeBase = Float32Array.from(robe.attributes.position.array);
        W.hoodGeo = hood; W.hoodBase = Float32Array.from(hood.attributes.position.array);
        W.labHi = hi;
      } else if (!on && W.labHi) {
        const hi = W.labHi, made = new Set();
        for (const [m, g] of hi.swaps) { made.add(m.geometry); m.geometry = g; }
        for (const g of made) g.dispose();
        W.robeGeo = hi.robe; W.robeBase = hi.robeBase; W.hoodGeo = hi.hood; W.hoodBase = hi.hoodBase; W.labHi = null;
      }
    }
  }
  // ---- soft shading: each toon material swapped for a Lambert one (light per corner), kept in step with it
  const softPairs = [];
  function soften(on) {
    if (on) game.scene.traverse(o => {
      const m = o.material; if (!o.isMesh || !m || !m.isMeshToonMaterial || o.userData.labToon) return;
      const l = new T.MeshLambertMaterial({ color: m.color, emissive: m.emissive, vertexColors: m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });
      if (done.has(m)) patch(l);
      if ((m.userData.labKey || '').includes('dissolve') && LAB.patchDissolve) LAB.patchDissolve(l);   // keep the demon's dissolve
      o.userData.labToon = m; o.material = l; softPairs.push(o);
    });
    else { for (const o of softPairs) { const l = o.material; o.material = o.userData.labToon; delete o.userData.labToon; l.dispose(); } softPairs.length = 0; }
  }
  function syncSoft() {   // the game changes its own (toon) materials: colours, glow, fading
    for (const o of softPairs) { const t = o.userData.labToon, l = o.material; if (!t || !l) continue;
      l.color.copy(t.color); l.emissive.copy(t.emissive); l.opacity = t.opacity; l.visible = t.visible; }
  }

  LAB.lowPoly = lowPoly;   // Colours rebuilds low poly when it changes the robe
  // wizards made later (the Party shelf's extra wizards) get whatever PS1 looks are on
  LAB.ps1Refresh = () => {
    if (v('ps1.lowpoly', 0)) lowPoly(true);
    if (v('ps1.snap', 0) || v('ps1.wobble', 0)) scan();
    if (v('ps1.gouraud', 0)) soften(true);
  };
  LAB.shelf('ps1', 'PS1', () => [
    { id: 'snap', label: 'Snap', help: '1 is the real PS1 grid; more is coarser and blockier', min: 0, max: 6, step: 0.25, value: 0, fmt: (x) => (x ? String(x) : 'OFF'),
      apply: (x) => { if (x > 0) scan(); } },
    { id: 'wobble', label: 'Wobble', help: 'Corners shimmer on their own', min: 0, max: 2, step: 0.1, value: 0, apply: (x) => { if (x > 0) scan(); } },
    { id: 'lowpoly', label: 'Low poly', help: 'Wizards with few faces, like a real PS1 model', kind: 'onoff', value: 0, dice: true, apply: (x) => lowPoly(!!x) },
    { id: 'gouraud', label: 'Soft shading', help: 'PS1-style smooth light instead of toon bands', kind: 'onoff', value: 0, dice: true, apply: (x) => soften(!!x) },
    { id: 'depth', label: 'Colour depth', help: '15-bit colour with the old dither pattern', kind: 'onoff', value: 0, dice: true, fmt: (x) => (x ? '15-BIT' : 'OFF'), apply: () => LAB.screen.sync() },
    { id: 'fog', label: 'Fog', help: 'Far things fade into the dark', min: 0, max: 1, step: 0.05, value: 0, apply: setFog, frame: (dt, k) => setFog(k) }
  ]);
})();
