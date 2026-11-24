// Lab shelf: Solid look. How the Solid itself is drawn (its colours, overall size, fire aura and spiral are on other
// shelf files but shown with these on the Solid look shelf). Every solid is drawn the same way: a frame of bright
// edges, a small solid core in the middle, a faint see-through shell, a glow on the ground under it, and a light it
// casts on the wizards.
//   Frame: Thickness swaps the hairline edges for real bars (a merged mesh per solid, turning with it); Frame glow
//   puts a soft halo round every bar and runs them toward white, so they read as giving off light (and feed Bloom).
//   Orbiting sparks (they show with the Fire aura, on Ball play's code): how many a resonance level (1 = exactly the
//   resonance, evenly round one ring), size, speed and distance.
//   Spin: how fast it turns in your hands. Trail: a fading ribbon behind a thrown Solid. Each solid's own size.
// The game works out the shell, the light, the ground glow and the edge colour again every frame (they brighten with
// resonance), so these scale or follow what it worked out rather than replace it.
LAB.shelf('solidlook', 'Solid look', (game) => {
  const T = game.THREE, o = game.orb;
  const get = (k, d) => { const v = LAB.get('solid.' + k); return v == null ? d : v; };
  const S = game.SOLIDS, core = (s) => s.g.children[1], lines = (s) => s.g.children[0];
  const WHITE = new T.Color(0xffffff);

  // ---------------------------------------------------------------- the frame as bars, and its glow
  // one merged mesh of bars per solid (and a wider one for the glow), built when the thickness changes
  function barsFor(s, r) {
    const pos = s.geo.index ? s.geo.toNonIndexed() : s.geo, eg = new T.EdgesGeometry(s.geo), p = eg.attributes.position, out = [], m = new T.Matrix4(), q = new T.Quaternion(), a = new T.Vector3(), b = new T.Vector3(), mid = new T.Vector3(), Z = new T.Vector3(0, 1, 0);
    for (let i = 0; i < p.count; i += 2) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1);
      const len = a.distanceTo(b), g = new T.CylinderGeometry(r, r, len + r * 1.6, 6, 1, false);
      q.setFromUnitVectors(Z, mid.subVectors(b, a).normalize()); m.compose(mid.addVectors(a, b).multiplyScalar(0.5), q, new T.Vector3(1, 1, 1));
      g.applyMatrix4(m); out.push(g.toNonIndexed());
    }
    eg.dispose(); if (pos !== s.geo) pos.dispose();
    const merged = new T.BufferGeometry(); let total = 0; for (const g of out) total += g.attributes.position.array.length;
    const buf = new Float32Array(total); let k = 0; for (const g of out) { buf.set(g.attributes.position.array, k); k += g.attributes.position.array.length; g.dispose(); }
    merged.setAttribute('position', new T.BufferAttribute(buf, 3));
    return merged;
  }
  let builtThick = -1;
  function frame() {
    const th = get('thick', 0), glow = get('frameGlow', 0);
    if (th !== builtThick) {
      builtThick = th;
      for (const s of S) {
        for (const k of ['labBars', 'labHalo']) if (s[k]) { s.g.remove(s[k]); s[k].geometry.dispose(); s[k].material.dispose(); s[k] = null; }
        if (th > 0) {
          const layers = lines(s).layers.mask;
          s.labBars = new T.Mesh(barsFor(s, th), new T.MeshBasicMaterial({ color: s.col, transparent: true }));
          s.labHalo = new T.Mesh(barsFor(s, th * 2.6 + 0.015), new T.MeshBasicMaterial({ color: s.col, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
          for (const m of [s.labBars, s.labHalo]) { m.layers.mask = layers; s.g.add(m); }
        }
      }
    }
    // without bars, the hairline edges carry the glow by running toward white
    for (const s of S) {
      const e = get('edges', 1), bars = s.labBars;
      lines(s).visible = e > 0 && !bars;
      if (bars) {
        bars.visible = e > 0; bars.material.opacity = e; bars.material.color.copy(s.lineMat.color).lerp(WHITE, Math.min(0.85, glow * 0.3));
        s.labHalo.visible = glow > 0 && e > 0; s.labHalo.material.opacity = Math.min(0.9, glow * 0.22) * e; s.labHalo.material.color.copy(s.lineMat.color);
      } else if (glow > 0) s.lineMat.color.lerp(WHITE, Math.min(0.85, glow * 0.3));
    }
  }
  function shape() {
    const c = get('core', 0.42), e = get('edges', 1);
    for (const s of S) {
      core(s).scale.setScalar(Math.max(0.001, c)); core(s).visible = c > 0;
      s.lineMat.transparent = e < 1; s.lineMat.opacity = e; s.lineMat.needsUpdate = true;
    }
  }
  const sizeEach = () => S.forEach((s, i) => s.g.scale.setScalar(get('size' + i, 1)));

  // ---------------------------------------------------------------- the trail: a ribbon behind a thrown Solid
  const N = 40, pts = [], trailPos = new Float32Array(N * 2 * 3), trailCol = new Float32Array(N * 2 * 3);
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(trailPos, 3)); tg.setAttribute('color', new T.BufferAttribute(trailCol, 3));
  { const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tg.setIndex(idx); }
  const trail = new T.Mesh(tg, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  trail.frustumCulled = false; trail.visible = false; trail.layers.set(2); game.scene.add(trail);
  const side = new T.Vector3(), dir = new T.Vector3(), toCam = new T.Vector3(), c = new T.Color();
  let trailT = 0;
  function tickTrail(dt) {
    const on = get('trail', 0) > 0;
    if (!on) { trail.visible = false; pts.length = 0; return; }
    const flying = o.state === 'air';
    trailT += dt;
    if (flying && trailT > 0.016) { trailT = 0; pts.unshift(o.p.clone()); }
    else if (!flying && pts.length) { pts.pop(); if (pts.length) pts.pop(); }   // it shrinks away after a catch or a landing
    const len = Math.max(4, Math.round(N * get('trailLen', 0.6)));
    while (pts.length > len) pts.pop();
    if (pts.length < 2) { trail.visible = false; return; }
    trail.visible = true; c.set(game.solid.col);
    const w0 = 0.22 * get('trail', 1) * (game.orbMesh.scale.x || 1);
    for (let i = 0; i < N; i++) {
      const j = Math.min(i, pts.length - 1), p = pts[j], q = pts[Math.min(j + 1, pts.length - 1)], u = j / (pts.length - 1);
      dir.subVectors(p, q); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); toCam.subVectors(game.camera.position, p);
      side.crossVectors(dir, toCam).normalize().multiplyScalar(w0 * (1 - u));
      trailPos.set([p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z], i * 6);
      const f = i < pts.length ? (1 - u) * (1 - u) : 0;   // additive: darker is more see-through
      trailCol.set([c.r * f, c.g * f, c.b * f, c.r * f, c.g * f, c.b * f], i * 6);
    }
    tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true;
  }

  // ---------------------------------------------------------------- every frame, after the game's own update
  let last = 0;
  window.FEATURES.on('frame', (dtGame) => {
    const now = performance.now() / 1000, dt = last ? Math.min(0.1, now - last) : 0; last = now;
    const sh = get('shell', 1), li = get('light', 1), spin = get('spin', 1);
    if (sh !== 1) for (const s of S) s.fillMat.opacity = Math.min(1, s.fillMat.opacity * sh);
    if (li !== 1) game.orbLight.intensity *= li;
    if (spin !== 1 && o.state === 'held') game.orbSpin.rotation.y += dtGame * 1.4 * (spin - 1);   // the game turns it at 1.4 a second in your hands
    frame(); tickTrail(dt);
  }, 'lab');
  // the ground glow is set after the frame event, so it's scaled when the camera moves (later in the same frame)
  window.FEATURES.on('camera', () => { const g = get('glow', 1); if (g !== 1) game.orbMark.material.opacity = Math.min(1, game.orbMark.material.opacity * g); }, 'lab');
  const pct = (x) => (x ? Math.round(x * 100) + '%' : 'OFF');
  const NAMES = ['Tetrahedron', 'Cube', 'Octahedron', 'Dodecahedron', 'Icosahedron'];
  return [
    { id: 'solid.core', label: 'Core', help: 'The small solid shape in the middle (0 is none: just the frame and shell)', min: 0, max: 1, step: 0.02, value: 0.42, dice: true, fmt: pct, apply: shape },
    { id: 'solid.shell', label: 'Shell', help: 'The faint see-through skin; it brightens as resonance builds', min: 0, max: 4, step: 0.25, value: 1, dice: true, fmt: pct },
    { id: 'solid.edges', label: 'Frame', help: 'How strong the frame of edges is (0 hides it)', min: 0, max: 1, step: 0.1, value: 1, dice: true, fmt: pct, apply: shape },
    { id: 'solid.thick', label: 'Frame thickness', help: 'HAIRLINE is the thin line; anything more draws the frame as solid bars this thick', min: 0, max: 0.08, step: 0.005, value: 0, dice: true, fmt: (x) => (x ? (x * 100).toFixed(1) : 'HAIRLINE') },
    { id: 'solid.frameGlow', label: 'Frame glow', help: 'How much light the frame gives off: it runs toward white, and with some thickness a soft halo glows round each bar', min: 0, max: 3, step: 0.1, value: 0, dice: true, fmt: pct },
    { id: 'solid.glow', label: 'Ground glow', help: 'The glow on the ground under it, which also shows where a throw will land', min: 0, max: 3, step: 0.25, value: 1, dice: true, fmt: pct },
    { id: 'solid.light', label: 'Light', help: 'The coloured light it casts on the wizards and the demon close by', min: 0, max: 3, step: 0.25, value: 1, dice: true, fmt: pct },
    { id: 'solid.sparks', label: 'Orbiting sparks', help: 'Sparks circling it as resonance builds (with Fire aura on): how many for each level of resonance. 1 shows your resonance exactly, one spark a level', min: 0, max: 3, step: 1, value: 2, dice: true, fmt: (x) => (x ? x + ' A LEVEL' : 'OFF') },
    { id: 'solid.sparkSize', label: 'Spark size', help: 'How big the orbiting sparks are', min: 0.3, max: 3, step: 0.1, value: 1, dice: true, fmt: pct },
    { id: 'solid.sparkSpeed', label: 'Spark speed', help: 'How fast they circle', min: 0, max: 3, step: 0.1, value: 1, dice: true, fmt: pct },
    { id: 'solid.sparkDist', label: 'Spark distance', help: 'How far out they circle', min: 0.5, max: 3, step: 0.1, value: 1, dice: true, fmt: pct },
    { id: 'solid.spin', label: 'Spin', help: 'How fast it turns in your hands (0 holds it still)', min: 0, max: 4, step: 0.25, value: 1, dice: true, fmt: pct },
    { id: 'solid.trail', label: 'Trail', help: 'A fading ribbon in its colour behind a thrown Solid: how wide', min: 0, max: 3, step: 0.1, value: 0, dice: true, fmt: pct },
    { id: 'solid.trailLen', label: 'Trail length', help: 'How long the ribbon is', min: 0.1, max: 1, step: 0.05, value: 0.6, dice: false, fmt: pct },
    ...NAMES.map((n, i) => ({ id: 'solid.size' + i, label: n + ' size', help: 'This solid only, on top of Solid size (looks only: it bounces the same)', min: 0.4, max: 2.5, step: 0.05, value: 1, dice: true, fmt: pct, apply: sizeEach }))
  ];
});
