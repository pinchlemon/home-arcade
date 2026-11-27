// Lab shelf: Archon. A boss in place of the centipede: a "biblically accurate" angel floating in the middle of the
// arena. A great eye at its heart (the weak spot), three rings of eyes turning around it like a gyroscope, six wings.
// Everything is plain geometry, so it needs no character animation.
//   It stays in the middle and turns to face whoever has the Solid (or the nearest wizard). Every eye follows the Solid.
//   Two attacks, each with a clear warning, then an opening:
//     Gaze (beam): the rings fall into line and go red, and a red fan lights up on the ground: the beam will sweep
//       across all of it, starting at its bright edge. Then a wall of light sweeps the fan. Jump over it, dive through
//       it, or be somewhere else. The cube's blocks and walls stop it.
//     Judgement (shockwave): it rises high, rings spread wide and red; then it slams down and a ring of light rolls out
//       across the floor. Jump or dive as it passes.
//   After each attack it sinks low and dims for a moment: the core hangs at throwing height. That's the opening.
//   Hits on the core count as head hits; hits on a ring's eye make that eye blink shut. The cube's hit cancels a
//   warning (as with the centipede), the icosahedron's slows it, Freeze and Confused stop it attacking.
// Through the game's bossHook: the game asks it for the demon's parts, its mouth and its moves. Its health, death,
// capture and respawn are the demon's own, so Match, Health, Abilities and Swords work on it unchanged.
// Nothing is made until it is switched on (three.js uses Math.random to name new things).
LAB.shelf('archon', 'Archon', (game) => {
  const T = game.THREE, D = game.demon;
  const get = (k, d) => { const v = LAB.get('archon.' + k); return v == null ? d : v; };
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => u * u * (3 - 2 * u);
  const RED = new T.Color(0xff2a40), GOLD = new T.Color(0xffc860), WHITE = new T.Color(1, 1, 1);
  let A = null;        // the Archon's meshes
  const parts = [];    // the demon as spheres, for the game: the core first
  const tv = V(), tv2 = V(), tv3 = V(), ZAX = V(0, 0, 1), tq = new T.Quaternion(), tq2 = new T.Quaternion(), tm = new T.Matrix4(), UP = V(0, 1, 0);
  const FLAT = new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2);   // a ring lying flat, like a halo

  // ---------------------------------------------------------------- the body
  function lambert(col, emi) { const m = new T.MeshLambertMaterial({ color: col, emissive: emi || 0x000000 }); m.userData.base = m.emissive.clone(); return m; }
  // add: glowing (adds light); otherwise painted on top, which reads better on the bright grass
  function glow(col, op, add) { return new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, side: T.DoubleSide }); }
  function build() {
    const root = new T.Group(), body = new T.Group(); root.add(body); root.visible = false; game.scene.add(root);
    const mats = [];
    // the core: a great eye that turns to look
    const look = new T.Group(); body.add(look);
    const coreMat = lambert(0xa89a7c, 0x080402); mats.push(coreMat);
    const core = new T.Mesh(new T.SphereGeometry(1, 20, 14), coreMat); look.add(core);
    const irisMat = new T.MeshBasicMaterial({ color: 0xc8203a });
    const iris = new T.Mesh(new T.CircleGeometry(0.6, 28), irisMat); iris.position.z = 0.985; look.add(iris);
    const pupil = new T.Mesh(new T.CircleGeometry(0.28, 20), new T.MeshBasicMaterial({ color: 0x050205 })); pupil.position.z = 0.995; look.add(pupil);
    const shine = new T.Mesh(new T.CircleGeometry(0.08, 10), new T.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(0.16, 0.16, 1.0); look.add(shine);
    const halo = new T.Mesh(new T.SphereGeometry(1.35, 16, 12), glow(0xff3048, 0, true)); body.add(halo);
    // three rings of eyes, turning on different axes
    const ringMat = lambert(0xa87a28, 0x120a02); mats.push(ringMat);
    const eyeMat = lambert(0xe8e0d0, 0x202020); mats.push(eyeMat);
    const pupMat = new T.MeshBasicMaterial({ color: 0x0a0408 });
    const eyeGeo = new T.SphereGeometry(0.24, 12, 8), pupGeo = new T.SphereGeometry(0.12, 8, 6);
    const rings = [];
    [[2.1, 6, V(1, 0, 0), 0.55], [2.75, 8, V(0, 1, 0), -0.4], [3.4, 10, V(1, 0, 1).normalize(), 0.3]].forEach(([R, n, axis, sp], i) => {
      const g = new T.Group(); body.add(g);
      g.add(new T.Mesh(new T.TorusGeometry(R, 0.075, 6, 72), ringMat));
      const eyes = [];
      for (let k = 0; k < n; k++) {
        const a = (k + i * 0.5) / n * Math.PI * 2, e = new T.Group();
        e.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); g.add(e);
        const ball = new T.Mesh(eyeGeo, eyeMat); e.add(ball);
        const p = new T.Mesh(pupGeo, pupMat); e.add(p);
        eyes.push({ e, ball, p, blink: 0, flash: 0, part: { x: 0, y: 0, z: 0, r: 0.5, weak: false, flash: 0 } });
      }
      rings.push({ g, R, axis, sp, ang: i * 1.7, eyes });
    });
    // six wings: two up, two out, two down, behind the core
    const featherShape = new T.Shape(); featherShape.moveTo(0, 0); featherShape.quadraticCurveTo(0.16, 0.45, 0, 1); featherShape.quadraticCurveTo(-0.16, 0.45, 0, 0);
    const featherGeo = new T.ShapeGeometry(featherShape, 6);
    const wingMat = lambert(0x6a5f52, 0x000000); wingMat.side = T.DoubleSide; mats.push(wingMat);
    const wings = [];
    for (const [tilt, side] of [[0.55, 1], [0.55, -1], [1.45, 1], [1.45, -1], [2.45, 1], [2.45, -1]]) {
      const w = new T.Group(); w.position.set(side * 0.7, 0, -0.75); body.add(w);
      const fan = new T.Group(); w.add(fan);
      for (let f = 0; f < 7; f++) {
        const m = new T.Mesh(featherGeo, wingMat), len = 3.1 - f * 0.28;
        m.scale.set(1.5, len, 1); m.rotation.z = -side * (f * 0.13); m.position.z = -f * 0.02; fan.add(m);
      }
      wings.push({ w, fan, tilt, side });
    }
    const light = new T.PointLight(0xffe0a0, 0, 8, 2); body.add(light);
    // on the ground: a soft disc and a thin circle around its feet
    const floor = new T.Group(); game.scene.add(floor); floor.visible = false;
    const disc = new T.Mesh(new T.CircleGeometry(1, 40), glow(0x000000, 0.3)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; floor.add(disc);
    const circle = new T.Mesh(new T.RingGeometry(0.96, 1, 64), glow(0xc89030, 0.8)); circle.rotation.x = -Math.PI / 2; circle.position.y = 0.025; floor.add(circle);
    // the warning fan, the beam and the shockwave (geometry made for each attack)
    const fanMat = glow(0xe0102a, 0), fanMesh = new T.Mesh(new T.BufferGeometry(), fanMat); fanMesh.position.y = 0.04; fanMesh.visible = false; game.scene.add(fanMesh);
    const edgeMat = glow(0xff2030, 0), edge = new T.Mesh(new T.PlaneGeometry(1, 1), edgeMat); edge.visible = false; game.scene.add(edge);
    const beam = new T.Group(); beam.visible = false; game.scene.add(beam);
    const cyl = new T.CylinderGeometry(1, 1, 1, 10, 1, true);
    const ray = new T.Mesh(cyl, glow(0xffffff, 0.95)), rayGlow = new T.Mesh(cyl, glow(0xffa030, 0.35, true)); beam.add(ray, rayGlow);
    const wall = new T.Mesh(new T.PlaneGeometry(1, 1), glow(0xfff4d8, 0.85)), wallGlow = new T.Mesh(new T.PlaneGeometry(1, 1), glow(0xffa040, 0.25, true));
    const strip = new T.Mesh(new T.PlaneGeometry(1, 1), glow(0xd02010, 0.7));
    game.scene.add(wall, wallGlow, strip); wall.visible = wallGlow.visible = strip.visible = false;
    const wave = new T.Mesh(new T.RingGeometry(0.95, 1, 96), glow(0xfff0c8, 0.95)); wave.rotation.x = -Math.PI / 2; wave.position.y = 0.06; wave.visible = false; game.scene.add(wave);
    const waveGlow = new T.Mesh(new T.RingGeometry(0.88, 0.95, 96), glow(0xd02010, 0.6)); waveGlow.rotation.x = -Math.PI / 2; waveGlow.position.y = 0.05; waveGlow.visible = false; game.scene.add(waveGlow);
    A = { root, body, look, core, iris, irisMat, halo, rings, wings, light, floor, disc, circle, fanMesh, fanMat, edge, edgeMat, beam, ray, rayGlow, wall, wallGlow, strip, wave, waveGlow, mats,
      grow: 0, y: 3.8, dodge: new Map(), yaw: 0, pitch: 0, align: 0, spread: 1, glowK: 0, red: 0, dim: 0, flashT: 0, shock: null, struck: new Set(), sweep: null, dieT: 0 };
    parts.length = 0; parts.push({ x: 0, y: 3, z: 0, r: 1.2, weak: true, flash: 0 });
    for (const R of rings) for (const E of R.eyes) parts.push(E.part);
  }

  // ---------------------------------------------------------------- turning it on and off
  const hook = { update, spawn, parts: () => parts, mouth: (out) => { if (!A) return out.set(0, 3, 0); return A.core.getWorldPosition(out); } };
  function hideCentipede() {
    D.g.visible = false; for (const S of D.segs) S.g.visible = false;
    if (game.legGroup) game.legGroup.visible = false; if (D.disc) D.disc.material.opacity = 0;
    for (const v of game.venoms) { v.alive = false; v.g.visible = false; if (v.puddle) v.puddle.material.opacity = 0; }
  }
  function enable(v) {
    if (v) {
      if (!A) build();
      if (game.bossHook !== hook) { game.bossHook = hook; hideCentipede(); D.alive = false; D.dying = false; D.spawnT = 0.6; game.hpBar.visible = false; }
    } else if (game.bossHook === hook) {
      game.bossHook = null; clearAttack(); A.root.visible = false; A.floor.visible = false; A.wave.visible = A.waveGlow.visible = false; A.shock = null;
      D.alive = false; D.dying = false; D.spawnT = 0.8; D.state = 'walk'; game.hpBar.visible = false; game.labBreathing = false;
    }
  }
  // the whole Archon flashes white when it's hit (the Demon shelf's White flash knobs)
  window.FEATURES.on('demonHit', () => { if (A && game.bossHook === hook && LAB.get('demon.flash')) A.flashT = LAB.get('demon.flashLen') ?? 0.3; }, 'lab');

  // ---------------------------------------------------------------- where it is and who it watches
  const size = () => get('size', 1);
  function target() {
    const o = game.orb; let Tg = o.state === 'held' ? o.holder : null;
    if (!Tg || Tg.downT > 0) { let bd = 1e9; for (const W of game.ALL) { if (W.downT > 0) continue; const d = Math.hypot(W.pos.x - D.pos.x, W.pos.z - D.pos.z); if (d < bd) { bd = d; Tg = W; } } }
    return Tg || game.ALL[0];
  }
  function spawn() {
    if (!A) build();
    hideCentipede();
    D.pos.set(0, 0, 0); D.vel.set(0, 0, 0); D.yaw = 0;
    D.hp = game.demonMax; D.alive = true; D.dying = false; D.headGone = false; D.scale = 0.05; D.state = 'walk'; D.atkT = 0; D.cd = 2.5; D.mode = 'prowl'; D.modeT = 99; D.stunT = 0; D.slowT = 0; D.flash = 0;
    A.root.visible = true; A.floor.visible = true; A.grow = 0; A.dieT = 0; A.y = 0.5; A.align = 0; A.spread = 1; A.dim = 0; A.red = 0; A.shock = null; A.wave.visible = A.waveGlow.visible = false;
    clearAttack();
    for (const R of A.rings) for (const E of R.eyes) { E.blink = 0; E.ball.scale.setScalar(1); E.e.visible = true; }
    A.core.scale.setScalar(1); A.look.scale.setScalar(1);
    // it rises out of the floor and blows back anyone standing in its place
    const s = size();
    for (const W of game.ALL) { const dx = W.pos.x - D.pos.x, dz = W.pos.z - D.pos.z, d = Math.hypot(dx, dz) || 1; if (d < 6 * s) game.pushBack(W, dx / d, dz / d, 9); }
    game.fxRing(D.pos.x, D.pos.z, 0xffd890, 7 * s, 0.7); game.fxPillar(D.pos.x, D.pos.z, 0xffe0a0, 14, 2 * s, 0.9);
    game.spawnPuffs(20, 4 * s, tv.set(D.pos.x, 0, D.pos.z), 1.6); game.shake(0.2);
  }

  // ---------------------------------------------------------------- attacks
  function clearAttack() {
    if (!A) return;
    A.fanMesh.visible = false; A.edge.visible = false; A.beam.visible = false; A.wall.visible = A.wallGlow.visible = A.strip.visible = false;
    A.sweep = null; game.labBreathing = false;
  }
  // the warning fan: a flat ring sector on the ground, from angle a0 to a1 (angles as the game's yaw: 0 is +z)
  function makeFan(a0, a1, r0, r1) {
    const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 0.05)), pos = [], idx = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, sx = Math.sin(a), sz = Math.cos(a); pos.push(sx * r0, 0, sz * r0, sx * r1, 0, sz * r1); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    A.fanMesh.geometry.dispose(); A.fanMesh.geometry = g;
  }
  // a flat strip on the ground from the centre out along angle a, from r0 to r1, w wide
  function layStrip(m, a, r0, r1, w, y, up) {
    const mid = (r0 + r1) / 2, sx = Math.sin(a), sz = Math.cos(a);
    m.position.set(D.pos.x + sx * mid, y, D.pos.z + sz * mid);
    m.rotation.set(up ? 0 : -Math.PI / 2, a - Math.PI / 2, 0, 'YXZ');   // its length along the angle; standing up like a wall, or flat
    m.scale.set(r1 - r0, w, 1);
  }
  function startAttack(Tg) {
    const s = size(), mode = get('attacks', 0), dx = Tg.pos.x - D.pos.x, dz = Tg.pos.z - D.pos.z, d = Math.hypot(dx, dz);
    let near = 0; for (const W of game.ALL) if (W.downT <= 0 && Math.hypot(W.pos.x - D.pos.x, W.pos.z - D.pos.z) < 9 * s) near++;
    const slam = mode === 2 || (mode === 0 && (near >= 2 || (d < 8 * s && Math.random() < 0.6) || Math.random() < 0.25));
    A.dodge.clear(); for (const W of game.ALL) A.dodge.set(W, Math.random() < get('dodge', 0.75));
    D.state = 'windup'; D.kind = slam ? 'slam' : 'beam'; D.atkT = get('windup', 1.3) * (slam ? 0.9 : 1); D.atkLen = D.atkT; A.struck.clear();
    if (!slam) {
      const mid = Math.atan2(dx, dz), sw = get('sweep', 110) * Math.PI / 180, dir = Math.random() < 0.5 ? 1 : -1;
      A.sweep = { a0: mid - dir * sw / 2, a1: mid + dir * sw / 2, dir, prev: mid - dir * sw / 2 };
      makeFan(A.sweep.a0, A.sweep.a1, 1.6 * s, get('reach', 24)); A.fanMesh.position.set(D.pos.x, 0.04, D.pos.z); A.fanMesh.visible = true; A.fanMat.opacity = 0;
      A.edge.visible = true; A.edgeMat.opacity = 0;
    }
    game.shake(0.05);
  }
  function beamFrame(dt, k) {   // during the strike: k is how far through the sweep (0 to 1)
    const S = A.sweep, s = size(), reach = get('reach', 24), a = S.a0 + (S.a1 - S.a0) * k, sx = Math.sin(a), sz = Math.cos(a);
    const near = 3.2 * s;
    // the ray from the eye down to the ground, then a wall of light along the ground out to its reach
    A.core.getWorldPosition(tv); tv2.set(D.pos.x + sx * near, 0.1, D.pos.z + sz * near);
    const len = tv.distanceTo(tv2), wob = 1 + Math.sin(game.time * 60) * 0.12;
    A.beam.visible = true; A.beam.position.copy(tv).lerp(tv2, 0.5); A.beam.quaternion.setFromUnitVectors(UP, tv3.copy(tv2).sub(tv).normalize());
    A.ray.scale.set(0.16 * s * wob, len, 0.16 * s * wob); A.rayGlow.scale.set(0.42 * s * wob, len, 0.42 * s * wob);
    A.wall.visible = A.wallGlow.visible = A.strip.visible = true;
    layStrip(A.wall, a, near, reach, 0.9, 0.45, true); layStrip(A.wallGlow, a, near, reach, 1.4, 0.7, true);
    layStrip(A.strip, a, near, reach, 0.9, 0.05, false);
    A.wall.material.opacity = 0.8 * wob; A.wallGlow.material.opacity = 0.22 * wob;
    for (let i = 0; i < 3; i++) { const r = near + Math.random() * (reach - near); tv2.set(D.pos.x + sx * r, 0.2, D.pos.z + sz * r); tv.set((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3); game.spark(tv2, tv, 0.35, 0.5, Math.random() < 0.5 ? 0xfff0c0 : 0xff6040, 2); }
    game.shake(0.06);
    // anyone the line passes over who is on the ground, not diving, and not behind a block goes down
    for (const W of game.ALL) {
      if (A.struck.has(W) || W.downT > 0 || W.diveT > 0 || W.y > 0.9) continue;
      const wx = W.pos.x - D.pos.x, wz = W.pos.z - D.pos.z, wd = Math.hypot(wx, wz);
      if (wd < near - 0.5 || wd > reach + 0.5) continue;
      const wa = Math.atan2(wx, wz), tol = 0.6 / wd;
      const rel = (x) => Math.atan2(Math.sin(x - S.a0), Math.cos(x - S.a0)) * S.dir;   // how far along the sweep
      const now = rel(a), was = rel(S.prev), at = rel(wa);
      if (A.dodge.get(W) && at > now && at - now < (now - was) * 9 + 0.9 / wd) hop(W);   // a teammate sees it coming
      if (at < Math.min(now, was) - tol || at > Math.max(now, was) + tol) continue;
      if (LAB.blocked && LAB.blocked({ x: D.pos.x, z: D.pos.z }, W.pos)) continue;
      A.struck.add(W);
      const tx = Math.cos(a) * S.dir, tz = -Math.sin(a) * S.dir;   // pushed the way the beam is sweeping, and outward
      game.knockDown(W, tx * 0.8 + wx / wd * 0.6, tz * 0.8 + wz / wd * 0.6, 11);
      game.fxSphere(tv.set(W.pos.x, 0.8, W.pos.z), 0xfff0c0, 1.6, 0.3); game.shake(0.25);
    }
    S.prev = a;
  }
  // a teammate brain jumps it: a full jump (held), let go once it's in the air a while
  function hop(W) { if (W.human || !W.grounded || W.crouchT > 0) return; W.jumpQ = true; W.jumpHeld = true; W.labHopT = 0.45; }
  function hops(dt) { for (const W of game.ALL) if (W.labHopT > 0) { W.labHopT -= dt; if (W.labHopT <= 0 && !W.human) W.jumpHeld = false; } }
  function shockFrame(dt) {
    const W0 = A.shock; if (!W0) return;
    W0.r += W0.v * dt; const s = size(), reach = get('reach', 24) * 1.15, fade = clamp(1 - (W0.r - reach * 0.8) / (reach * 0.2), 0, 1);
    A.wave.visible = A.waveGlow.visible = true;
    A.wave.position.set(D.pos.x, 0.06, D.pos.z); A.waveGlow.position.set(D.pos.x, 0.05, D.pos.z);
    A.wave.scale.setScalar(W0.r); A.waveGlow.scale.setScalar(W0.r); A.wave.material.opacity = 0.95 * fade; A.waveGlow.material.opacity = 0.6 * fade;
    if (Math.random() < 0.8) { const a = Math.random() * Math.PI * 2; tv2.set(D.pos.x + Math.sin(a) * W0.r, 0.2, D.pos.z + Math.cos(a) * W0.r); tv.set(Math.sin(a) * 2, 2.5, Math.cos(a) * 2); game.spark(tv2, tv, 0.4, 0.5, 0xfff0c0, 2); }
    for (const W of game.ALL) {
      if (W0.hit.has(W) || W.downT > 0 || W.diveT > 0 || W.y > 0.5) continue;
      const dx = W.pos.x - D.pos.x, dz = W.pos.z - D.pos.z, d = Math.hypot(dx, dz) || 1;
      if (A.dodge.get(W) && d > W0.r && (d - W0.r) / W0.v < 0.34) hop(W);
      if (Math.abs(d - W0.r) > 0.75) continue;
      W0.hit.add(W); game.knockDown(W, dx / d, dz / d, 9); game.shake(0.2);
    }
    if (W0.r > reach) { A.shock = null; A.wave.visible = A.waveGlow.visible = false; }
  }

  // ---------------------------------------------------------------- every frame (the game calls this in place of the centipede)
  function update(dt) {
    if (!A) return;
    if (D.g.visible || (game.legGroup && game.legGroup.visible)) hideCentipede();
    const s = size(), t = game.time;
    shockFrame(dt); hops(dt);
    if (D.dying) { die(dt, s); return; }
    if (!D.alive) { A.root.visible = false; A.floor.visible = false; D.spawnT -= dt; if (D.spawnT <= 0) spawn(); return; }
    A.grow = Math.min(1, A.grow + dt / 1.4); D.scale = A.grow;
    D.stunT = Math.max(0, (D.stunT || 0) - dt); D.slowT = Math.max(0, (D.slowT || 0) - dt); D.cd = Math.max(0, (D.cd || 0) - dt);
    const slow = D.slowT > 0 ? 0.55 : 1, sdt = dt * slow, stunned = D.stunT > 0;
    D.pos.lerp(tv.set(0, 0, 0), 1 - Math.exp(-2 * dt)); D.vel.set(0, 0, 0);   // pushed (Gust), it drifts back to the middle
    const Tg = target();
    // what it's doing
    let yGoal = 3.8, alignGoal = 0, spreadGoal = 1, redGoal = 0, dimGoal = 0, turn = 1.3;
    if (D.state === 'walk') {
      if (!stunned && D.cd <= 0 && A.grow >= 1 && Tg) startAttack(Tg);
    } else if (D.state === 'windup') {
      if (stunned) { D.state = 'recover'; D.atkT = 1.1; clearAttack(); }
      else {
        D.atkT -= sdt; const k = clamp(1 - D.atkT / D.atkLen, 0, 1);
        redGoal = k; alignGoal = 1; turn = D.kind === 'beam' ? 0 : 0.5;
        if (D.kind === 'beam') {
          yGoal = 3.8; A.fanMat.opacity = (0.22 + 0.33 * k) * (0.75 + 0.25 * Math.sin(t * (8 + 18 * k)));
          layStrip(A.edge, A.sweep.a0, 1.6 * s, get('reach', 24), 0.35, 0.05, false); A.edgeMat.opacity = 0.6 + 0.4 * k;
          A.yaw = lerpAng(A.yaw, A.sweep.a0, 1 - Math.exp(-4 * dt)); A.pitch += (0.55 - A.pitch) * (1 - Math.exp(-4 * dt));
        } else { yGoal = 6.2; spreadGoal = 1.35; if (Math.random() < 0.5) { tv.set(D.pos.x, 0.1, D.pos.z); game.spawnPuffs(1, 3 * s, tv, 0.6); } }
        A.light.intensity = 0.3 + 1.2 * k;
        if (D.atkT <= 0) {
          D.state = 'strike';
          if (D.kind === 'beam') { D.atkT = get('sweepTime', 1.6); D.atkLen = D.atkT; A.fanMesh.visible = false; A.edge.visible = false; game.labBreathing = true; game.shake(0.2); }
          else { D.atkT = 0.18; D.atkLen = D.atkT; }
        }
      }
    } else if (D.state === 'strike') {
      D.atkT -= sdt; const k = clamp(1 - D.atkT / D.atkLen, 0, 1); redGoal = 1; alignGoal = 1; turn = 0;
      if (D.kind === 'beam') {
        yGoal = 3.8; beamFrame(dt, k); A.yaw = A.sweep.a0 + (A.sweep.a1 - A.sweep.a0) * k; A.pitch = 0.55; A.light.intensity = 1.5;
        if (D.atkT <= 0) { clearAttack(); D.state = 'recover'; D.atkT = get('opening', 1.8); }
      } else {
        yGoal = 1.2; spreadGoal = 1.5; A.y += (1.2 - A.y) * (1 - Math.exp(-30 * dt));
        if (D.atkT <= 0) {
          A.shock = { r: 2 * s, v: get('waveSpeed', 12), hit: new Set() }; game.shake(0.45);
          game.fxRing(D.pos.x, D.pos.z, 0xfff0c0, 6 * s, 0.4); game.fxPillar(D.pos.x, D.pos.z, 0xffe0a0, 10, 2.5 * s, 0.5);
          game.spawnPuffs(26, 5 * s, tv.set(D.pos.x, 0, D.pos.z), 2.2);
          D.state = 'recover'; D.atkT = get('opening', 1.8);
        }
      }
    } else if (D.state === 'recover') {   // the opening: it sinks and dims, the core at throwing height
      clearAttack(); D.atkT -= sdt; yGoal = 1.7; dimGoal = 1; alignGoal = 1; turn = 0.3;
      if (D.atkT <= 0) { D.state = 'walk'; D.cd = get('rest', 2.2); }
    }
    if (stunned) { turn = 0; dimGoal = 0.5; }
    // pose
    const kk = (r) => 1 - Math.exp(-r * dt);
    A.y += (yGoal - A.y) * kk(D.state === 'recover' ? 5 : 2.5);
    A.align += (alignGoal - A.align) * kk(alignGoal ? 5 : 2);
    A.spread += (spreadGoal - A.spread) * kk(4);
    A.red += (redGoal - A.red) * kk(8); A.dim += (dimGoal - A.dim) * kk(4);
    if (Tg && turn > 0) { const want = Math.atan2(Tg.pos.x - D.pos.x, Tg.pos.z - D.pos.z), dd = Math.atan2(Math.sin(want - A.yaw), Math.cos(want - A.yaw)); A.yaw += clamp(dd * 3, -turn, turn) * sdt; }
    if (D.state !== 'strike' && !(D.state === 'windup' && D.kind === 'beam')) A.pitch += (0.12 - A.pitch) * kk(3);
    D.yaw = A.yaw;
    const g = ease(A.grow), bob = Math.sin(t * 1.3) * 0.15 * (1 - A.dim), shiver = stunned ? Math.sin(t * 40) * 0.06 : 0;
    A.root.position.set(D.pos.x, 0, D.pos.z); A.root.scale.setScalar(s * Math.max(0.05, g));
    A.body.position.set(shiver, A.y + bob, 0); A.body.rotation.set(0, A.yaw, 0);
    A.look.rotation.set(A.pitch, 0, 0);
    // rings: turning like a gyroscope; on a warning they fall into line, flat, and spread
    for (const R of A.rings) {
      R.ang += R.sp * sdt * (1 + A.red * 2) * (1 - A.dim * 0.7) * (stunned ? 0.2 : 1);
      tq.setFromAxisAngle(R.axis, R.ang); tq2.setFromAxisAngle(ZAX, R.ang * 0.7).premultiply(FLAT);
      R.g.quaternion.slerpQuaternions(tq, tq2, ease(A.align));
      R.g.scale.setScalar(A.spread * (1 - A.dim * 0.12));
    }
    // wings: slow beats, raised on the shockwave, drooping in the opening
    const beat = Math.sin(t * 2.2) * 0.18 * (1 - A.dim) + (D.kind === 'slam' && D.state === 'windup' ? -0.4 : 0) + A.dim * 0.45;
    for (const Wg of A.wings) { Wg.w.rotation.set(-0.25, 0, -Wg.side * (Wg.tilt + beat * (Wg.tilt < 1 ? 1 : 0.6))); Wg.fan.rotation.y = Wg.side * (0.35 + beat * 0.5); }
    // colours: red as it warns, dim in the opening, white while hit
    A.flashT = Math.max(0, A.flashT - dt);
    const lit = A.flashT > 0 && Math.floor(performance.now() / 1000 * (LAB.get('demon.flashRate') ?? 12) * 2) % 2 === 0;
    for (const m of A.mats) { if (lit) m.emissive.setRGB(1, 1, 1); else m.emissive.copy(m.userData.base).lerp(RED, A.red * 0.4).multiplyScalar(1 - A.dim * 0.6); }
    A.irisMat.color.setRGB(0.78 + 0.22 * A.red, 0.13 * (1 - A.red), 0.23 * (1 - A.red));
    A.look.scale.setScalar(1 + A.red * 0.12 - A.dim * 0.1);
    A.halo.material.opacity = 0.18 * A.red;
    if (D.state === 'walk' || D.state === 'recover') A.light.intensity = 0.3 * (1 - A.dim * 0.7);
    A.light.color.copy(GOLD).lerp(RED, A.red);
    A.floor.visible = true; A.floor.position.set(D.pos.x, 0, D.pos.z); A.floor.scale.setScalar(3.4 * s * g);
    A.disc.material.opacity = 0.3; A.circle.material.color.copy(GOLD).lerp(RED, A.red);
    // every eye follows the Solid, and blinks shut when it's hit
    A.root.updateMatrixWorld(true);
    const o = game.orb.p;
    for (const R of A.rings) {
      tm.copy(R.g.matrixWorld).invert();
      for (const E of R.eyes) {
        if (E.part.flash > 0) { E.blink = 1; E.part.flash = 0; }
        E.blink = Math.max(0, E.blink - dt * 2.5);
        tv.copy(o).applyMatrix4(tm).sub(E.e.position).normalize();
        E.p.position.copy(tv).multiplyScalar(0.17); E.p.scale.setScalar(1 + A.red * 0.5);
        E.ball.scale.set(1, Math.max(0.12, 1 - E.blink * 0.9), 1); E.p.visible = E.blink < 0.6;
        E.e.getWorldPosition(tv); E.part.x = tv.x; E.part.y = tv.y; E.part.z = tv.z; E.part.r = 0.5 * s * g;
      }
    }
    const C = parts[0]; A.core.getWorldPosition(tv); C.x = tv.x; C.y = tv.y; C.z = tv.z; C.r = 1.15 * s * g;
    // nobody walks through its column
    for (const W of game.ALL) {
      if (W.y > C.y + C.r) continue;
      const dx = W.pos.x - D.pos.x, dz = W.pos.z - D.pos.z, d = Math.hypot(dx, dz) || 0.001, r = 1.5 * s * g;
      if (d < r) { W.pos.x += dx / d * (r - d); W.pos.z += dz / d * (r - d); }
    }
    // the health bar, above it
    const hb = game.hpBar, max = game.demonMax;
    hb.visible = D.hp < max; hb.position.set(D.pos.x, (A.y + 4.2) * s, D.pos.z); hb.quaternion.copy(game.camera.quaternion); hb.scale.setScalar(2.2 * s);
    if (hb.children[1]) hb.children[1].scale.x = Math.max(0.001, Math.min(1, D.hp / max));
  }
  function lerpAng(a, b, k) { return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k; }

  // ---------------------------------------------------------------- beaten: the rings fly apart, the eyes close, a burst of light
  function die(dt, s) {
    clearAttack(); game.hpBar.visible = false;
    if (A.dieT === 0) game.shake(0.3);
    A.dieT += dt; const k = A.dieT;
    for (const R of A.rings) { R.ang += dt * 6; tq.setFromAxisAngle(R.axis, R.ang); R.g.quaternion.copy(tq); R.g.scale.setScalar(1 + k * 1.6); for (const E of R.eyes) E.ball.scale.set(1, Math.max(0.1, 1 - k * 1.2), 1); }
    A.body.position.y += dt * 0.8; A.body.rotation.y += dt * (2 + k * 6);
    const lit = Math.floor(k * 18) % 2 === 0; for (const m of A.mats) m.emissive.setRGB(lit ? 1 : 0.4, lit ? 1 : 0.35, lit ? 1 : 0.25);
    if (Math.random() < 0.7) { A.core.getWorldPosition(tv); tv2.set((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6); game.spark(tv, tv2, 0.6, 0.6, Math.random() < 0.5 ? 0xffe0a0 : 0xffffff, 2); }
    if (k > 1.2 && A.root.visible) {
      A.core.getWorldPosition(tv); game.fxSphere(tv, 0xfff0c0, 7 * s, 0.6); game.fxPillar(D.pos.x, D.pos.z, 0xffe0a0, 18, 3 * s, 0.9);
      game.fxRing(D.pos.x, D.pos.z, 0xffd890, 10 * s, 0.7); game.sparkBurst(tv, 60, 8, 0.9, 3, 0xffe0a0); game.shake(0.4);
      A.root.visible = false; A.floor.visible = false;
    }
    if (k > 1.7) { D.alive = false; D.dying = false; D.spawnT = 3; }
  }

  const ATT = ['BOTH', 'BEAM', 'SHOCKWAVE'];
  return [
    { id: 'on', label: 'Archon', help: 'A boss in place of the centipede: an angel of rings and eyes in the middle of the arena. It warns, attacks, then sinks low: hit its core then', kind: 'onoff', value: 0, dice: false,
      apply: (v) => enable(v), frame: () => { if (game.bossHook !== hook) enable(1); } },
    { id: 'size', label: 'Archon size', help: 'How big it is (and how far apart its rings and wings are)', min: 0.6, max: 1.8, step: 0.1, value: 1, fmt: (x) => x.toFixed(1) + '×' },
    { id: 'attacks', label: 'Attacks', help: 'BEAM: a sweeping wall of light, jump it. SHOCKWAVE: it slams down, a ring rolls out, jump it. BOTH: it picks (the shockwave when you crowd it)', min: 0, max: 2, step: 1, value: 0, fmt: (x) => ATT[x] },
    { id: 'windup', label: 'Warning time', help: 'How long it warns before it attacks (the red fan, the rings lining up)', min: 0.5, max: 2.5, step: 0.1, value: 1.3, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'sweep', label: 'Beam sweep', help: 'How wide the beam sweeps', min: 40, max: 220, step: 10, value: 110, fmt: (x) => x + '°' },
    { id: 'sweepTime', label: 'Sweep time', help: 'How long the sweep takes (shorter is faster)', min: 0.5, max: 3, step: 0.1, value: 1.6, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'reach', label: 'Reach', help: 'How far the beam and the shockwave go', min: 10, max: 44, step: 2, value: 24, fmt: (x) => x + ' M' },
    { id: 'waveSpeed', label: 'Shockwave speed', help: 'How fast the ring rolls out', min: 5, max: 26, step: 1, value: 12 },
    { id: 'opening', label: 'Opening', help: 'How long it sinks low after an attack, its core in reach', min: 0.4, max: 4, step: 0.1, value: 1.8, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'dodge', label: 'Teammates dodge', help: 'How often the teammate brains jump the beam and the shockwave', min: 0, max: 1, step: 0.05, value: 0.75, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'rest', label: 'Rest', help: 'How long it waits after the opening before the next warning (Aggression shortens it)', min: 0.3, max: 6, step: 0.1, value: 2.2, fmt: (x) => x.toFixed(1) + ' S' }
  ];
});
