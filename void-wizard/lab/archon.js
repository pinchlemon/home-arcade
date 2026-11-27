// Lab shelf: Archon. A boss in place of the centipede: a "biblically accurate" angel floating in the middle of the
// arena. A great eye at its heart (the weak spot), three rings of eyes turning around it like a gyroscope, six wings.
// Everything is plain geometry, so it needs no character animation.
//   It stays in the middle and turns to face whoever has the Solid (or the nearest wizard). Every eye follows the Solid.
//   Its attacks, each with a clear warning, then an opening:
//     Light orbs: the rings fall into line and go red while sparks gather into its eye; then it fires waves of glowing
//       orbs across the floor at chest height. RING (full circles with gaps, each wave turned half a step), FAN (aimed
//       at whoever has the Solid) or SPIRAL (two turning streams). Walk through the gaps, run, or dive. Blocks stop them.
//     Gaze (beam): a red fan lights up on the ground; then a wall of light sweeps the fan, starting at its bright edge.
//       Dive through it or be somewhere else. The cube's blocks and walls stop it.
//   After each attack it sinks low and dims for a moment: the core hangs at throwing height. That's the opening.
//   Hits on the core count as head hits; hits on a ring's eye make that eye blink shut. The cube's hit cancels a
//   warning (as with the centipede), the icosahedron's slows it, Freeze and Confused stop it attacking.
// Defenders: smaller wheels with one eye each, circling the Archon. While someone holds the Solid they slide into the
// passing lanes; when a pass is in the air the one that can get there first goes for it and swats it away (it loses
// its resonance). Lobs that fly over their reach get past. A fast throw that hits one hurts it (and still bounces off):
// break one and its lane is open until it comes back. With Shield on, the Archon takes half damage while any stand.
// Rushing the passer: hold the Solid too long and some defenders leave their lanes and rush you. How many depends on
// where you are: close to the Archon most of them come, far out they hang back and cover your receivers. A rusher turns
// red, shows "!" and runs at you; if it reaches you before you throw, you go down and lose the Solid (taken, with Solid
// life on; knocked loose, without). A dive gets you past it.
// Solid life (an option): the Solid has health, the team's shared life. A defender that reaches a pass takes it
// instead of swatting it: it holds it, drifting home, while it shakes and swells with light. Reach it in time (run into
// it) and you tackle it free; if not, it lets out a pulse that hurts the Solid, knocks down anyone close, and throws
// the Solid loose. Catches from a pass heal it a little. At zero the Solid shatters: with Match on the match is lost,
// otherwise the Archon heals to full. While a defender holds it, the Solid's state is 'labHeld' (nobody can catch it).
// Through the game's bossHook: the game asks it for the demon's parts, its mouth and its moves. Its health, death,
// capture and respawn are the demon's own, so Match, Health, Abilities and Swords work on it unchanged.
// Nothing is made until it is switched on (three.js uses Math.random to name new things).
LAB.shelf('archon', 'Archon', (game) => {
  const T = game.THREE, D = game.demon;
  const get = (k, d) => { const v = LAB.get('archon.' + k); return v == null ? d : v; };
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => u * u * (3 - 2 * u);
  const RED = new T.Color(0xff2a40), GOLD = new T.Color(0xffc860);
  let A = null;        // the Archon's meshes
  const parts = [];    // the demon as spheres, for the game: the core first
  const tv = V(), tv2 = V(), tv3 = V(), ZAX = V(0, 0, 1), tq = new T.Quaternion(), tq2 = new T.Quaternion(), tm = new T.Matrix4(), UP = V(0, 1, 0);
  const FLAT = new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2);   // a ring lying flat, like a halo
  const ORB_Y = 1.0;   // light orbs fly at chest height

  // ---------------------------------------------------------------- the body
  function lambert(col, emi) { const m = new T.MeshLambertMaterial({ color: col, emissive: emi || 0x000000 }); m.userData.base = m.emissive.clone(); return m; }
  // add: glowing (adds light); otherwise painted on top, which reads better on the bright grass
  function glow(col, op, add) { return new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, side: T.DoubleSide }); }
  let featherGeo = null;
  function feathers() {
    if (featherGeo) return featherGeo;
    const sh = new T.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.16, 0.45, 0, 1); sh.quadraticCurveTo(-0.16, 0.45, 0, 0);
    return (featherGeo = new T.ShapeGeometry(sh, 6));
  }
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
        eyes.push({ e, ball, p, blink: 0, part: { x: 0, y: 0, z: 0, r: 0.5, weak: false, flash: 0 } });
      }
      rings.push({ g, R, axis, sp, ang: i * 1.7, eyes });
    });
    // six wings: two up, two out, two down, behind the core
    const wingMat = lambert(0x6a5f52, 0x000000); wingMat.side = T.DoubleSide; mats.push(wingMat);
    const wings = [];
    for (const [tilt, side] of [[0.55, 1], [0.55, -1], [1.45, 1], [1.45, -1], [2.45, 1], [2.45, -1]]) {
      const w = new T.Group(); w.position.set(side * 0.7, 0, -0.75); body.add(w);
      const fan = new T.Group(); w.add(fan);
      for (let f = 0; f < 7; f++) {
        const m = new T.Mesh(feathers(), wingMat), len = 3.1 - f * 0.28;
        m.scale.set(1.5, len, 1); m.rotation.z = -side * (f * 0.13); m.position.z = -f * 0.02; fan.add(m);
      }
      wings.push({ w, fan, tilt, side });
    }
    const light = new T.PointLight(0xffe0a0, 0, 8, 2); body.add(light);
    // on the ground: a soft disc and a thin circle around its feet
    const floor = new T.Group(); game.scene.add(floor); floor.visible = false;
    const disc = new T.Mesh(new T.CircleGeometry(1, 40), glow(0x000000, 0.3)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; floor.add(disc);
    const circle = new T.Mesh(new T.RingGeometry(0.96, 1, 64), glow(0xc89030, 0.8)); circle.rotation.x = -Math.PI / 2; circle.position.y = 0.025; floor.add(circle);
    // the beam's warning fan and the beam itself (the fan's geometry is made for each attack)
    const fanMat = glow(0xe0102a, 0), fanMesh = new T.Mesh(new T.BufferGeometry(), fanMat); fanMesh.position.y = 0.04; fanMesh.visible = false; game.scene.add(fanMesh);
    const edgeMat = glow(0xff2030, 0), edge = new T.Mesh(new T.PlaneGeometry(1, 1), edgeMat); edge.visible = false; game.scene.add(edge);
    const beam = new T.Group(); beam.visible = false; game.scene.add(beam);
    const cyl = new T.CylinderGeometry(1, 1, 1, 10, 1, true);
    const ray = new T.Mesh(cyl, glow(0xffffff, 0.95)), rayGlow = new T.Mesh(cyl, glow(0xffa030, 0.35, true)); beam.add(ray, rayGlow);
    const wall = new T.Mesh(new T.PlaneGeometry(1, 1), glow(0xfff4d8, 0.85)), wallGlow = new T.Mesh(new T.PlaneGeometry(1, 1), glow(0xffa040, 0.25, true));
    const strip = new T.Mesh(new T.PlaneGeometry(1, 1), glow(0xd02010, 0.7));
    game.scene.add(wall, wallGlow, strip); wall.visible = wallGlow.visible = strip.visible = false;
    // light orbs: a white-hot core in a red-gold glow, with a shadow on the ground so you can tell where they are
    const oCore = new T.SphereGeometry(0.26, 10, 8), oGlow = new T.SphereGeometry(0.44, 10, 8), oShadow = new T.CircleGeometry(0.42, 14);
    const oCoreM = new T.MeshBasicMaterial({ color: 0xfff4dc }), oGlowM = glow(0xff5020, 0.4, true), oShadowM = glow(0x000000, 0.32);
    const orbs = [];
    for (let i = 0; i < 140; i++) {
      const g = new T.Group(); g.add(new T.Mesh(oCore, oCoreM), new T.Mesh(oGlow, oGlowM)); g.visible = false; game.scene.add(g);
      const sh = new T.Mesh(oShadow, oShadowM); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.visible = false; game.scene.add(sh);
      orbs.push({ g, sh, p: V(), v: V(), alive: false, d: 0 });
    }
    A = { root, body, look, core, iris, irisMat, halo, rings, wings, light, floor, disc, circle, fanMesh, fanMat, edge, edgeMat, beam, ray, rayGlow, wall, wallGlow, strip, mats,
      orbs, orbNext: 0, volley: null, ringMat, eyeMat, pupMat,
      grow: 0, y: 3.8, dodge: new Map(), yaw: 0, pitch: 0, align: 0, spread: 1, red: 0, dim: 0, flashT: 0, struck: new Set(), sweep: null, dieT: 0 };
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
      game.bossHook = null; lifeEl.style.display = 'none'; clearAttack(); clearOrbs(); A.root.visible = false; A.floor.visible = false; hideGuards();
      D.alive = false; D.dying = false; D.spawnT = 0.8; D.state = 'walk'; game.hpBar.visible = false; game.labBreathing = false;
    }
  }
  // the whole Archon flashes white when it's hit (the Demon shelf's White flash knobs); Shield gives back half
  window.FEATURES.on('demonHit', (dmg) => {
    if (!A || game.bossHook !== hook) return;
    if (LAB.get('demon.flash')) A.flashT = LAB.get('demon.flashLen') ?? 0.3;
    if (get('shield', 0) && D.alive && !D.dying && guardsUp() > 0 && dmg > 0) { D.hp += dmg * 0.5; if (D.hp > 0 && Math.random() < 0.5) shieldFx(); }
  }, 'lab');

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
    A.root.visible = true; A.floor.visible = true; A.grow = 0; A.dieT = 0; A.y = 0.5; A.align = 0; A.spread = 1; A.dim = 0; A.red = 0;
    clearAttack(); clearOrbs();
    for (const R of A.rings) for (const E of R.eyes) { E.blink = 0; E.ball.scale.setScalar(1); E.e.visible = true; }
    A.core.scale.setScalar(1); A.look.scale.setScalar(1);
    // it rises out of the floor and blows back anyone standing in its place
    const s = size();
    for (const W of game.ALL) { const dx = W.pos.x - D.pos.x, dz = W.pos.z - D.pos.z, d = Math.hypot(dx, dz) || 1; if (d < 6 * s) game.pushBack(W, dx / d, dz / d, 9); }
    game.fxRing(D.pos.x, D.pos.z, 0xffd890, 7 * s, 0.7); game.fxPillar(D.pos.x, D.pos.z, 0xffe0a0, 14, 2 * s, 0.9);
    game.spawnPuffs(20, 4 * s, tv.set(D.pos.x, 0, D.pos.z), 1.6); game.shake(0.2);
    resetLife();
    for (const Gd of G) { if (Gd.hold) letGo(Gd); Gd.hp = get('guardHp', 3); Gd.backT = 0.6 + Gd.i * 0.25; Gd.up = false; Gd.g.visible = false; Gd.sh.visible = false; }
  }

  // ---------------------------------------------------------------- attacks
  function clearAttack() {
    if (!A) return;
    A.fanMesh.visible = false; A.edge.visible = false; A.beam.visible = false; A.wall.visible = A.wallGlow.visible = A.strip.visible = false;
    A.sweep = null; A.volley = null; game.labBreathing = false;
  }
  // the warning fan: a flat ring sector on the ground, from angle a0 to a1 (angles as the game's yaw: 0 is +z)
  function makeFan(a0, a1, r0, r1) {
    const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 0.05)), pos = [], idx = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, sx = Math.sin(a), sz = Math.cos(a); pos.push(sx * r0, 0, sz * r0, sx * r1, 0, sz * r1); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    A.fanMesh.geometry.dispose(); A.fanMesh.geometry = g;
  }
  // a strip from the centre out along angle a, from r0 to r1, w wide: flat on the ground, or standing up like a wall
  function layStrip(m, a, r0, r1, w, y, up) {
    const mid = (r0 + r1) / 2, sx = Math.sin(a), sz = Math.cos(a);
    m.position.set(D.pos.x + sx * mid, y, D.pos.z + sz * mid);
    m.rotation.set(up ? 0 : -Math.PI / 2, a - Math.PI / 2, 0, 'YXZ');
    m.scale.set(r1 - r0, w, 1);
  }
  const PATTERNS = ['ring', 'fan', 'spiral'];
  function startAttack(Tg) {
    const s = size(), mode = get('attacks', 0), dx = Tg.pos.x - D.pos.x, dz = Tg.pos.z - D.pos.z;
    const beam = mode === 1 || (mode === 2 && Math.random() < 0.45);
    A.dodge.clear(); for (const W of game.ALL) A.dodge.set(W, Math.random() < get('dodge', 0.75));
    D.state = 'windup'; D.kind = beam ? 'beam' : 'orbs'; D.atkT = get('windup', 1.3); D.atkLen = D.atkT; A.struck.clear();
    if (beam) {
      const mid = Math.atan2(dx, dz), sw = get('sweep', 110) * Math.PI / 180, dir = Math.random() < 0.5 ? 1 : -1;
      A.sweep = { a0: mid - dir * sw / 2, a1: mid + dir * sw / 2, dir, prev: mid - dir * sw / 2 };
      makeFan(A.sweep.a0, A.sweep.a1, 1.6 * s, get('reach', 24)); A.fanMesh.position.set(D.pos.x, 0.04, D.pos.z); A.fanMesh.visible = true; A.fanMat.opacity = 0;
      A.edge.visible = true; A.edgeMat.opacity = 0;
    } else {
      const pk = get('pattern', 0), kind = pk ? PATTERNS[pk - 1] : PATTERNS[Math.floor(Math.random() * 3)];
      A.volley = { kind, t: 0, fired: 0, base: Math.random() * Math.PI * 2, dir: Math.random() < 0.5 ? 1 : -1 };
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
  function hop(W) { if (W.human || !W.grounded || W.crouchT > 0 || W.downT > 0) return; W.jumpQ = true; W.jumpHeld = true; W.labHopT = 0.45; }
  function hops(dt) { for (const W of game.ALL) if (W.labHopT > 0) { W.labHopT -= dt; if (W.labHopT <= 0 && !W.human) W.jumpHeld = false; } }

  // ---------------------------------------------------------------- light orbs
  function fire(a) {
    const O = A.orbs[A.orbNext]; A.orbNext = (A.orbNext + 1) % A.orbs.length;
    const s = size(), sp = get('orbSpeed', 8), r0 = 1.8 * s;
    O.p.set(D.pos.x + Math.sin(a) * r0, ORB_Y, D.pos.z + Math.cos(a) * r0); O.v.set(Math.sin(a) * sp, 0, Math.cos(a) * sp);
    O.alive = true; O.d = r0; O.g.visible = true; O.sh.visible = true; O.g.scale.setScalar(0.2);
  }
  function volleyFrame(dt) {   // during the strike: fires the waves of its pattern; returns true when it's done
    const Vl = A.volley, n = Math.round(get('orbs', 14)); Vl.t += dt;
    const shoot = (k) => { A.core.getWorldPosition(tv); game.fxSphere(tv, 0xffd0a0, 2.2, 0.2); game.shake(0.08); A.flashT = Math.max(A.flashT, 0.05); return k; };
    if (Vl.kind === 'ring') {   // three full rings, each turned half a step, so the gaps move
      while (Vl.fired < 3 && Vl.t >= Vl.fired * 0.55) { const off = Vl.base + (Vl.fired % 2) * Math.PI / n; for (let i = 0; i < n; i++) fire(off + i / n * Math.PI * 2); Vl.fired = shoot(Vl.fired + 1); }
      return Vl.t > 1.3;
    }
    if (Vl.kind === 'fan') {    // four aimed sprays at whoever has the Solid
      const Tg = target(), m = Math.max(3, Math.round(n / 2)), spread = 1.1;
      while (Vl.fired < 4 && Vl.t >= Vl.fired * 0.4) {
        const mid = Tg ? Math.atan2(Tg.pos.x - D.pos.x, Tg.pos.z - D.pos.z) : Vl.base;
        for (let i = 0; i < m; i++) fire(mid - spread / 2 + spread * i / (m - 1) + (Vl.fired % 2 ? spread / (m - 1) / 2 : 0));
        Vl.fired = shoot(Vl.fired + 1); A.yaw = lerpAng(A.yaw, mid, 0.6);
      }
      return Vl.t > 1.5;
    }
    // spiral: two streams turning around it
    const len = 2.2, every = Math.max(0.05, 1.6 / n);
    while (Vl.t >= Vl.fired * every && Vl.fired * every < len) {
      const a = Vl.base + Vl.dir * Vl.fired * every * 2.2;
      fire(a); fire(a + Math.PI); Vl.fired++; if (Vl.fired % 4 === 0) shoot(0);
    }
    return Vl.t > len;
  }
  function clearOrbs() { if (A) for (const O of A.orbs) { O.alive = false; O.g.visible = false; O.sh.visible = false; } }
  function orbsFrame(dt) {
    const reach = get('reach', 24) * 1.2, hitR = 0.75;
    for (const O of A.orbs) {
      if (!O.alive) continue;
      tv3.copy(O.p); O.p.addScaledVector(O.v, dt); O.d += O.v.length() * dt;
      const fade = clamp((reach - O.d) / (reach * 0.15), 0, 1);
      O.g.position.copy(O.p); O.g.scale.setScalar(Math.min(1, O.g.scale.x + dt * 6) * (0.3 + 0.7 * fade) * (1 + Math.sin(game.time * 30 + O.d) * 0.08));
      O.sh.position.set(O.p.x, 0.03, O.p.z); O.sh.scale.setScalar(0.4 + 0.6 * fade);
      let pop = O.d > reach || (LAB.blocked && LAB.blocked(tv3, O.p));
      if (!pop) for (const W of game.ALL) {
        if (W.downT > 0) continue;
        const dx = W.pos.x - O.p.x, dz = W.pos.z - O.p.z, d = Math.hypot(dx, dz);
        if (!W.human && A.dodge.get(W) && d < 2.2 && (dx * O.v.x + dz * O.v.z) > 0) {   // a teammate sees one coming at them
          const along = (dx * O.v.x + dz * O.v.z) / O.v.length(), side = Math.abs(dx * O.v.z - dz * O.v.x) / O.v.length();
          if (side < hitR + 0.2 && along < 1.4) hop(W);
        }
        if (d > hitR || W.diveT > 0 || W.y > ORB_Y + 0.25) continue;
        const l = O.v.length() || 1; game.knockDown(W, O.v.x / l, O.v.z / l, 8); stats.orbHits++; game.shake(0.18); pop = true; break;
      }
      if (pop) { O.alive = false; O.g.visible = false; O.sh.visible = false; if (O.d <= reach) { game.fxSphere(O.p, 0xffd0a0, 1.1, 0.25); game.sparkBurst(O.p, 8, 3, 0.4, 2, 0xffb060); } }
    }
  }

  // ---------------------------------------------------------------- defenders
  const G = [];
  function buildGuard(i) {
    const g = new T.Group(), spin = new T.Group(); g.add(spin); g.visible = false; game.scene.add(g);
    const ringM = lambert(0xa87a28, 0x120a02), eyeM = lambert(0xe8e0d0, 0x202020), wingM = lambert(0x6a5f52, 0); wingM.side = T.DoubleSide;
    spin.add(new T.Mesh(new T.TorusGeometry(0.85, 0.08, 6, 40), ringM));
    const inner = new T.Mesh(new T.TorusGeometry(0.62, 0.05, 6, 32), ringM); spin.add(inner);
    const eye = new T.Group(); g.add(eye);
    eye.add(new T.Mesh(new T.SphereGeometry(0.42, 14, 10), eyeM));
    const irisM = new T.MeshBasicMaterial({ color: 0xc8203a });
    const iris = new T.Mesh(new T.CircleGeometry(0.24, 18), irisM); iris.position.z = 0.415; eye.add(iris);
    const pup = new T.Mesh(new T.CircleGeometry(0.11, 12), new T.MeshBasicMaterial({ color: 0x050205 })); pup.position.z = 0.42; eye.add(pup);
    const wings = [];
    for (const side of [1, -1]) {
      const w = new T.Group(); w.position.set(side * 0.55, 0.1, -0.2); g.add(w);
      for (let f = 0; f < 4; f++) { const m = new T.Mesh(feathers(), wingM); m.scale.set(0.9, 1.3 - f * 0.18, 1); m.rotation.z = -side * (0.9 + f * 0.28); w.add(m); }
      wings.push({ w, side });
    }
    const sh = new T.Mesh(new T.CircleGeometry(0.8, 18), glow(0x000000, 0.3)); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.025; sh.visible = false; game.scene.add(sh);
    const ringFx = new T.Mesh(new T.RingGeometry(0.9, 1, 40), glow(0xff2a40, 0)); ringFx.rotation.x = -Math.PI / 2; ringFx.position.y = 0.035; ringFx.visible = false; game.scene.add(ringFx);
    const Gd = { i, g, spin, inner, eye, iris, irisM, wings, sh, ringFx, mats: [ringM, eyeM, wingM], pos: V(Math.sin(i) * 12, 0, Math.cos(i) * 12), vel: V(), y: 1.6,
      hp: 3, up: false, backT: 0, stunT: 0, swatCD: 0, flash: 0, red: 0, yaw: 0, chase: false };
    for (const m of Gd.mats) m.userData.base = m.emissive.clone();
    return Gd;
  }
  LAB.archonGuards = () => G;   // the defenders, for other shelves (and tests)
  const rush = { holder: null, set: new Set(), count: 0, after: 0, last: 0 };   // who's rushing the passer this hold
  const stats = LAB.archonStats = { sacks: 0, swats: 0, breaks: 0, orbHits: 0, steals: 0, rescues: 0, pulses: 0, shatters: 0 };   // counts, for tests

  // ---------------------------------------------------------------- Solid life: the team's shared health, on the Solid
  const life = { hp: 10, max: 10, shown: '' };
  const lifeOn = () => !!(get('solidLife', 0) && game.bossHook === hook);
  const css = document.createElement('style');
  css.textContent = `.ar-life{position:fixed;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;pointer-events:none;z-index:6;font-family:var(--font-pixel,monospace);font-size:9px;letter-spacing:1px;color:#fff;text-shadow:0 0 3px #000}
  .ar-life i{width:9px;height:12px;background:#fff4dc;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);filter:drop-shadow(0 0 3px #ffb060)}
  .ar-life i.off{background:#3a2a22;filter:none}
  .ar-life i.hit{animation:arHit .8s steps(6) 1}
  .ar-life.low i:not(.off){animation:arLow .5s steps(2) infinite}
  @keyframes arHit{0%,50%{background:#ff4050}100%{background:#3a2a22}}
  @keyframes arLow{50%{opacity:.35}}`;
  document.head.appendChild(css);
  const lifeEl = document.createElement('div'); lifeEl.className = 'ar-life'; lifeEl.style.display = 'none'; document.body.appendChild(lifeEl);
  function drawLife(lost) {
    const on = lifeOn(); lifeEl.style.display = on ? 'flex' : 'none'; if (!on) return;
    const mt = document.querySelector('.mt-hud'), below = mt && mt.style.display !== 'none' ? mt.getBoundingClientRect().bottom + 6 : 10;
    lifeEl.style.top = 'max(' + Math.round(below) + 'px, env(safe-area-inset-top))';
    const k = life.max + ':' + life.hp + ':' + (lost || 0); if (k === life.shown && !lost) return; life.shown = k;
    const n = Math.ceil(life.hp - 1e-6);
    lifeEl.className = 'ar-life' + (life.hp <= life.max * 0.3 ? ' low' : '');
    lifeEl.innerHTML = 'SOLID ' + Array.from({ length: life.max }, (_, i) => `<i class="${i < n ? '' : 'off'}${lost && i >= n && i < n + lost ? ' hit' : ''}"></i>`).join('');
  }
  function resetLife() { life.max = Math.round(get('solidHp', 10)); life.hp = life.max; life.shown = ''; drawLife(); }
  window.FEATURES.on('catch', (W, caught) => { if (lifeOn() && caught && life.hp < life.max) { life.hp = Math.min(life.max, life.hp + get('heal', 0.5)); drawLife(); } }, 'lab');
  function shatter() {
    const o = game.orb; stats.shatters++;
    game.fxSphere(o.p, 0xffffff, 6, 0.5); game.sparkBurst(o.p, 70, 9, 1, 3, 0xfff0c0); game.fxRing(o.p.x, o.p.z, 0xff4050, 9, 0.6); game.shake(0.5);
    try { game.popup('THE SOLID SHATTERED', new T.Vector3(o.p.x, o.p.y + 2, o.p.z), '#ff6a5a', true); } catch (e) {}
    if (!(LAB.matchLose && LAB.matchLose('solid'))) { D.hp = game.demonMax; A.flashT = 0.6; }   // without Match: the Archon is whole again
    resetLife();
  }
  function loose(o, vx, vy, vz) {   // put the Solid back in the air, nobody's
    o.state = 'air'; o.holder = null; o.v.set(vx, vy, vz); o.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
    o.res = 0; o.chain = null; o.special = null; o.fast = false; o.oop = false; o.bowl = false; o.hitCD = 0.35; o.last = null; o.touched = true;
    o.labTo = null; o.labMadden = null; o.labSuper = null; o.labMul = null;
  }
  function letGo(Gd) { if (Gd.hold && game.orb.state === 'labHeld') loose(game.orb, 0, 5, 0); Gd.hold = null; if (Gd.aura) Gd.aura.visible = false; }
  function take(Gd, o) {   // a defender takes the Solid
    loose(o, 0, 0, 0); o.state = 'labHeld'; o.touched = false; Gd.hold = { t: 0 }; stats.steals++;
    tv.set(Gd.pos.x, Gd.y, Gd.pos.z); game.fxRing(Gd.pos.x, Gd.pos.z, 0xff4050, 2.6, 0.4); game.sparkBurst(tv, 16, 3, 0.4, 2, 0xff6070); game.shake(0.12);
    try { game.popup('TAKEN', new T.Vector3(Gd.pos.x, Gd.y + 2, Gd.pos.z), '#ff6a7a', true); } catch (e) {}
  }
  function holdFrame(Gd, dt) {   // returns true while it still holds the Solid
    const o = game.orb;
    if (o.state !== 'labHeld') { Gd.hold = null; if (Gd.aura) Gd.aura.visible = false; return false; }   // the game took it back (a reset)
    const H = Gd.hold, len = get('stealTime', 1.4); H.t += dt; const k = Math.min(1, H.t / len);
    // shaking in front of its eye, the light around it swelling
    const j = 0.04 + k * 0.22;
    o.p.set(Gd.pos.x + Math.sin(Gd.yaw) * 0.9 + (Math.random() - 0.5) * j, Gd.y + (Math.random() - 0.5) * j, Gd.pos.z + Math.cos(Gd.yaw) * 0.9 + (Math.random() - 0.5) * j);
    o.v.set(0, 0, 0); game.orb.flash = k * 2;
    if (!Gd.aura) { Gd.aura = new T.Mesh(new T.SphereGeometry(1, 16, 12), glow(0xffe0b0, 0, true)); game.scene.add(Gd.aura); }
    Gd.aura.visible = true; Gd.aura.position.set(Gd.pos.x, Gd.y, Gd.pos.z); Gd.aura.scale.setScalar(0.8 + k * 1.5 + Math.sin(game.time * 40) * 0.08 * k); Gd.aura.material.opacity = 0.08 + k * 0.22;
    if (Math.random() < 0.3 + k) { tv.copy(o.p); tv2.set((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4); game.spark(tv, tv2, 0.3, 0.5, Math.random() < 0.5 ? 0xfff0c0 : 0xff6070, 2); }
    game.shake(0.02 + k * 0.05);
    // run into it in time and it lets go
    for (const W of game.ALL) {
      if (W.downT > 0) continue;
      if (Math.hypot(W.pos.x - Gd.pos.x, W.pos.z - Gd.pos.z) < 1.45) {
        const dx = W.pos.x - Gd.pos.x, dz = W.pos.z - Gd.pos.z, dl = Math.hypot(dx, dz) || 1;
        Gd.hold = null; Gd.aura.visible = false; Gd.stunT = 1.4; Gd.flash = 1; stats.rescues++;
        o.p.set(Gd.pos.x + dx / dl * 0.6, Gd.y + 0.3, Gd.pos.z + dz / dl * 0.6); loose(o, dx / dl * 2, 5.5, dz / dl * 2); o.touched = false;
        tv.copy(o.p); game.sparkBurst(tv, 22, 4, 0.5, 2.5, 0xffffff); game.shake(0.15);
        try { game.popup('FREED', new T.Vector3(W.pos.x, 2.4, W.pos.z), '#ffffff', true); } catch (e) {}
        return false;
      }
    }
    if (H.t < len) return true;
    // too late: the pulse
    const dmg = get('stealDmg', 3); life.hp = Math.max(0, life.hp - dmg); stats.pulses++;
    tv.set(Gd.pos.x, Gd.y, Gd.pos.z); game.fxSphere(tv, 0xfff0c0, 4.5, 0.4); game.fxRing(Gd.pos.x, Gd.pos.z, 0xffd0a0, 4.5, 0.5); game.sparkBurst(tv, 40, 7, 0.7, 3, 0xffe0b0); game.shake(0.35);
    for (const W of game.ALL) { const dx = W.pos.x - Gd.pos.x, dz = W.pos.z - Gd.pos.z, d = Math.hypot(dx, dz) || 1; if (d < 3.6 && W.downT <= 0 && W.diveT <= 0) game.knockDown(W, dx / d, dz / d, 9); }
    const ax = Gd.pos.x - D.pos.x, az = Gd.pos.z - D.pos.z, al = Math.hypot(ax, az) || 1;
    loose(o, ax / al * 6, 8, az / al * 6);
    Gd.hold = null; Gd.aura.visible = false; Gd.swatCD = 1.5;
    drawLife(Math.min(dmg, life.max));
    if (life.hp <= 0) shatter();
    return false;
  }
  function hideGuards() { for (const Gd of G) { if (Gd.hold) letGo(Gd); Gd.up = false; Gd.g.visible = false; Gd.sh.visible = false; Gd.ringFx.visible = false; } }
  function guardsUp() { let n = 0; const c = get('guards', 4); for (const Gd of G) if (Gd.i < c && Gd.up) n++; return n; }
  function shieldFx() { const n = guardsUp(); if (!n) return; A.core.getWorldPosition(tv); for (const Gd of G) if (Gd.up && Gd.i < get('guards', 4)) { tv2.set(Gd.pos.x, Gd.y, Gd.pos.z); const b = tv2.clone(); game.fxSphere(b, 0xff8a60, 0.9, 0.25); } game.fxSphere(tv, 0xff6a50, 3.2 * size(), 0.3); }
  function knockOff(Gd, o, hard) {   // the Solid bounces off a defender: it's loose, its resonance gone
    const hs = Math.hypot(o.v.x, o.v.z) || 1;
    let ax = o.p.x - Gd.pos.x, az = o.p.z - Gd.pos.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
    const side = Math.random() < 0.5 ? 1 : -1, bx = ax * 0.6 - o.v.z / hs * side * 0.5 - o.v.x / hs * 0.4, bz = az * 0.6 + o.v.x / hs * side * 0.5 - o.v.z / hs * 0.4, bl = Math.hypot(bx, bz) || 1;
    const out = hard ? 4 : 5.5;
    o.v.set(bx / bl * out, hard ? 9 : 7.5, bz / bl * out); o.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
    o.p.set(Gd.pos.x + ax * 1.15, Math.max(o.p.y, Gd.y), Gd.pos.z + az * 1.15);
    o.res = 0; o.chain = null; o.special = null; o.fast = false; o.oop = false; o.bowl = false; o.hitCD = 0.5; o.last = null; o.touched = false;
    o.labTo = null; o.labMadden = null; o.labSuper = null; o.labMul = null;
    tv.set(Gd.pos.x, Gd.y, Gd.pos.z); game.fxRing(Gd.pos.x, Gd.pos.z, 0xff4050, 2.4, 0.35); game.sparkBurst(tv, 18, 4, 0.5, 2.5, hard ? 0xffffff : 0xff6070);
    Gd.flash = 1; game.shake(hard ? 0.2 : 0.12);
  }
  // a wizard (not the thrower) right there to catch it: the defenders leave that one alone
  function catcherNear(x, z, thrower) { for (const W of game.ALL) if (W !== thrower && W.downT <= 0 && Math.hypot(W.pos.x - x, W.pos.z - z) < 2.2) return true; return false; }
  function guardsFrame(dt) {
    const count = A && D.alive && !D.dying && A.grow >= 1 ? Math.round(get('guards', 4)) : 0;
    while (G.length < count) G.push(buildGuard(G.length));
    const o = game.orb, s = size(), ring = get('guardRing', 13), speed = get('guardSpeed', 5.5), reachR = get('guardReach', 1.4), t = game.time;
    const holder = o.state === 'held' ? o.holder : null;
    // passing lanes: a point a little past halfway from the holder to each teammate who's up
    const lanes = [];
    if (holder) for (const W of game.ALL) { if (W === holder || W.downT > 0) continue; const dx = W.pos.x - holder.pos.x, dz = W.pos.z - holder.pos.z; if (Math.hypot(dx, dz) > 4) lanes.push(V(holder.pos.x + dx * 0.58, 0, holder.pos.z + dz * 0.58)); }
    // a pass or shot in the air: the defender that can get under it first goes for it
    let chaser = null, chaseAt = null;
    const flying = o.state === 'air' && !o.touched && o.last && Math.hypot(o.v.x, o.v.z) > 2;
    if (flying) {
      let best = 1e9; const g = game.G * (game.solid.grav || 1);
      for (let k = 1; k <= 24; k++) {
        const tt = k * 0.06, px = o.p.x + o.v.x * tt, pz = o.p.z + o.v.z * tt, py = o.p.y + o.v.y * tt - 0.5 * g * tt * tt;
        if (py < 0.2) break;
        if (py > 3.2) continue;   // over their heads
        if (catcherNear(px, pz, o.last)) continue;   // a teammate's catch: theirs
        for (const Gd of G) { if (Gd.i >= count || !Gd.up || Gd.stunT > 0 || Gd.hold) continue; const d = Math.hypot(px - Gd.pos.x, pz - Gd.pos.z) - reachR; if (d <= speed * 1.6 * tt && tt < best) { best = tt; chaser = Gd; chaseAt = V(px, py, pz); } }
        if (chaser) break;
      }
    }
    const used = new Set();
    if (chaser) used.add(chaser);
    // rushing the passer: decided once per hold, from how close the holder is to the Archon
    if (holder && get('rush', 1)) {
      if (rush.holder !== holder || o.heldFor < rush.last) {   // a new hold
        const dd = Math.hypot(holder.pos.x - D.pos.x, holder.pos.z - D.pos.z), near = get('rushNear', 10) * s, far = Math.max(near + 1, get('rushFar', 28) * s);
        const p = clamp((far - dd) / (far - near), 0, 1), max = get('rushMax', 2);
        rush.holder = holder; rush.set.clear(); rush.count = Math.min(max, Math.floor(p * max + Math.random() * Math.min(1, p * 2)));
        rush.after = get('rushAfter', 1.2) * (0.7 + Math.random() * 0.6) * (1 - 0.35 * p);
      }
      rush.last = o.heldFor;
      if (o.heldFor >= rush.after && rush.set.size < rush.count) {
        const free = G.filter(Gd => Gd.i < count && Gd.up && Gd.stunT <= 0 && !Gd.hold && !rush.set.has(Gd) && Gd !== chaser)
          .sort((a, b) => Math.hypot(a.pos.x - holder.pos.x, a.pos.z - holder.pos.z) - Math.hypot(b.pos.x - holder.pos.x, b.pos.z - holder.pos.z));
        for (const Gd of free.slice(0, rush.count - rush.set.size)) {
          rush.set.add(Gd); Gd.flash = 0.6;
          try { game.popup('!', new T.Vector3(Gd.pos.x, Gd.y + 1.8, Gd.pos.z), '#ff4050', true); } catch (e) {}
        }
      }
      for (const Gd of rush.set) used.add(Gd);
    } else { rush.holder = null; rush.set.clear(); }
    for (const L of lanes) {   // each lane gets the nearest free defender
      let b = null, bd = 1e9; for (const Gd of G) { if (Gd.i >= count || !Gd.up || Gd.stunT > 0 || Gd.hold || used.has(Gd)) continue; const d = Math.hypot(L.x - Gd.pos.x, L.z - Gd.pos.z); if (d < bd) { bd = d; b = Gd; } }
      if (b) { used.add(b); b.goal = L; }
    }
    for (const Gd of G) {
      if (Gd.i >= count) { if (Gd.hold) letGo(Gd); if (Gd.up || Gd.g.visible) { Gd.up = false; Gd.g.visible = false; Gd.sh.visible = false; Gd.ringFx.visible = false; } continue; }
      if (!Gd.up) {   // gone: back after a while, out of the floor near its post
        Gd.backT -= dt; Gd.g.visible = false; Gd.sh.visible = false; Gd.ringFx.visible = false;
        if (Gd.backT <= 0 && D.alive && !D.dying && A.grow >= 1) {
          const a = Gd.i / Math.max(1, count) * Math.PI * 2 + t * 0.08; Gd.pos.set(D.pos.x + Math.sin(a) * ring, 0, D.pos.z + Math.cos(a) * ring); Gd.vel.set(0, 0, 0);
          Gd.up = true; Gd.hp = get('guardHp', 3); Gd.y = 0.2; Gd.stunT = 0.6; Gd.flash = 1; Gd.g.visible = true; Gd.sh.visible = true;
          game.fxPillar(Gd.pos.x, Gd.pos.z, 0xffd890, 5, 0.9, 0.5); game.fxRing(Gd.pos.x, Gd.pos.z, 0xffd890, 2.5, 0.5);
        }
        continue;
      }
      Gd.stunT = Math.max(0, Gd.stunT - dt); Gd.swatCD = Math.max(0, Gd.swatCD - dt); Gd.flash = Math.max(0, Gd.flash - dt * 3);
      // where it wants to be
      const home = Gd.i / Math.max(1, count) * Math.PI * 2 + t * 0.08;
      let gx = D.pos.x + Math.sin(home) * ring, gz = D.pos.z + Math.cos(home) * ring, sp = speed;
      const holding = Gd.hold ? holdFrame(Gd, dt) : false;
      Gd.chase = Gd === chaser && !holding;
      if (holding) { const hx = Gd.pos.x - D.pos.x, hz = Gd.pos.z - D.pos.z, hl = Math.hypot(hx, hz) || 1; gx = D.pos.x + hx / hl * 5 * s; gz = D.pos.z + hz / hl * 5 * s; sp = speed * 0.45; }
      Gd.rushing = !holding && holder && rush.set.has(Gd);
      if (Gd.rushing) {
        gx = holder.pos.x; gz = holder.pos.z; sp = speed * get('rushSpeed', 1.4);
        // it gets there before the throw: down you go, and the Solid with you
        const rx = holder.pos.x - Gd.pos.x, rz = holder.pos.z - Gd.pos.z, rd = Math.hypot(rx, rz) || 1;
        if (rd < 1.2 && Gd.stunT <= 0 && holder.downT <= 0 && holder.diveT <= 0 && o.heldFor > 0.3) {
          game.knockDown(holder, rx / rd, rz / rd, 8); stats.sacks++; rush.set.delete(Gd);
          try { game.popup('SACKED', new T.Vector3(holder.pos.x, 2.4, holder.pos.z), '#ff4050', true); } catch (e) {}
          o.p.set(holder.pos.x, 1.2, holder.pos.z);
          if (lifeOn() && !G.some(H => H.hold)) take(Gd, o); else loose(o, rx / rd * 3, 6, rz / rd * 3);
          Gd.swatCD = 1; game.shake(0.25);
        }
      }
      else if (Gd.chase) { gx = chaseAt.x; gz = chaseAt.z; sp = speed * 1.6; }
      else if (Gd.goal && used.has(Gd)) { gx = Gd.goal.x; gz = Gd.goal.z; }
      Gd.goal = null;
      if (Gd.stunT > 0) sp *= 0.15;
      const dx = gx - Gd.pos.x, dz = gz - Gd.pos.z, dl = Math.hypot(dx, dz);
      const want = dl > 0.3 ? Math.min(sp, dl * 3) : 0, a = 1 - Math.exp(-(Gd.chase ? 9 : 5) * dt);
      Gd.vel.x += ((dl ? dx / dl : 0) * want - Gd.vel.x) * a; Gd.vel.z += ((dl ? dz / dl : 0) * want - Gd.vel.z) * a;
      // keep apart, out of the Archon's column, and off the wizards
      for (const H of G) { if (H === Gd || !H.up || H.i >= count) continue; const hx = Gd.pos.x - H.pos.x, hz = Gd.pos.z - H.pos.z, hd = Math.hypot(hx, hz) || 0.01; if (hd < 2.2) { Gd.vel.x += hx / hd * (2.2 - hd) * 6 * dt; Gd.vel.z += hz / hd * (2.2 - hd) * 6 * dt; } }
      Gd.pos.addScaledVector(Gd.vel, dt);
      { const cx = Gd.pos.x - D.pos.x, cz = Gd.pos.z - D.pos.z, cd = Math.hypot(cx, cz) || 0.01, minR = 4.5 * s; if (cd < minR) { Gd.pos.x = D.pos.x + cx / cd * minR; Gd.pos.z = D.pos.z + cz / cd * minR; } }
      for (const W of game.ALL) { if (W.y > Gd.y + 1) continue; const wx = W.pos.x - Gd.pos.x, wz = W.pos.z - Gd.pos.z, wd = Math.hypot(wx, wz) || 0.01; if (wd < 0.95) { W.pos.x += wx / wd * (0.95 - wd); W.pos.z += wz / wd * (0.95 - wd); } }
      // the Solid: swatted when it comes in reach; a fast throw hurts it
      Gd.hurtCD = Math.max(0, (Gd.hurtCD || 0) - dt);
      if (!Gd.hold && o.state === 'air' && o.last && o.hitCD <= 0 && o.p.y > 0.2 && o.p.y < Gd.y + 1.6) {
        const ox = o.p.x - Gd.pos.x, oz = o.p.z - Gd.pos.z, od = Math.hypot(ox, oz), spd = o.v.length();
        const hard = spd > 17 && Gd.hurtCD <= 0, ready = Gd.stunT <= 0 && Gd.swatCD <= 0;
        // ready, it swats anything in its reach; hurt or busy, only a fast throw at its body connects
        if (((ready && od < reachR + 0.3) || (hard && od < 1.1 && Math.abs(o.p.y - Gd.y) < 1.1)) && !catcherNear(o.p.x, o.p.z, o.last)) {
          if (!hard && lifeOn() && !G.some(H => H.hold)) { take(Gd, o); Gd.swatCD = 0.8; continue; }
          knockOff(Gd, o, hard); Gd.swatCD = 0.8; if (hard) Gd.hurtCD = 0.3; stats.swats++;
          if (hard) {
            Gd.hp--; Gd.stunT = 1.6; Gd.vel.set(-ox / (od || 1) * 6, 0, -oz / (od || 1) * 6);
            if (Gd.hp <= 0) {
              if (Gd.hold) letGo(Gd); Gd.up = false; Gd.backT = get('guardBack', 12); stats.breaks++; tv.set(Gd.pos.x, Gd.y, Gd.pos.z);
              game.fxSphere(tv, 0xfff0c0, 3, 0.4); game.fxPillar(Gd.pos.x, Gd.pos.z, 0xffe0a0, 8, 1.2, 0.6); game.sparkBurst(tv, 40, 6, 0.8, 3, 0xffe0a0); game.shake(0.3);
              Gd.g.visible = false; Gd.sh.visible = false; Gd.ringFx.visible = false; continue;
            }
          }
        }
      }
      // how it looks: hovering, the ring turning, red and fast when it goes for a pass, wobbling when hurt
      Gd.y += ((Gd.stunT > 0 ? 0.9 : 1.6 + Math.sin(t * 2 + Gd.i) * 0.12) - Gd.y) * (1 - Math.exp(-4 * dt));
      Gd.red += ((Gd.chase || Gd.hold || Gd.rushing ? 1 : lanes.length && used.has(Gd) ? 0.35 : 0) - Gd.red) * (1 - Math.exp(-10 * dt));
      const face = Math.atan2(o.p.x - Gd.pos.x, o.p.z - Gd.pos.z); Gd.yaw = lerpAng(Gd.yaw, face, 1 - Math.exp(-8 * dt));
      Gd.g.position.set(Gd.pos.x, Gd.y * s, Gd.pos.z); Gd.g.scale.setScalar(s); Gd.g.rotation.set(0, Gd.yaw, 0);
      Gd.eye.rotation.x = clamp(-Math.atan2(o.p.y - Gd.y, Math.hypot(o.p.x - Gd.pos.x, o.p.z - Gd.pos.z) || 1), -0.8, 0.8);
      Gd.spin.rotation.z += dt * (1.5 + Gd.red * 9); Gd.inner.rotation.y += dt * (2 + Gd.red * 6);
      if (Gd.stunT > 0) Gd.g.rotation.z = Math.sin(t * 30) * 0.25 * Gd.stunT;
      for (const Wg of Gd.wings) Wg.w.rotation.y = Wg.side * (0.3 + Math.sin(t * (8 + Gd.red * 10) + Gd.i) * 0.35);
      const lit = Gd.flash > 0 && Math.floor(t * 24) % 2 === 0;
      for (const m of Gd.mats) { if (lit) m.emissive.setRGB(1, 1, 1); else m.emissive.copy(m.userData.base).lerp(RED, Gd.red * 0.5); }
      Gd.irisM.color.setRGB(0.78 + 0.22 * Gd.red, 0.13 * (1 - Gd.red), 0.23 * (1 - Gd.red));
      Gd.g.visible = true; Gd.sh.visible = true; Gd.sh.position.set(Gd.pos.x, 0.025, Gd.pos.z);
      // its reach, drawn on the ground while it's guarding a lane or going for a pass
      Gd.ringFx.visible = Gd.red > 0.05; Gd.ringFx.position.set(Gd.pos.x, 0.035, Gd.pos.z); Gd.ringFx.scale.setScalar(reachR + 0.3); Gd.ringFx.material.opacity = 0.25 + 0.55 * Gd.red;
    }
  }

  // ---------------------------------------------------------------- every frame (the game calls this in place of the centipede)
  function update(dt) {
    if (!A) return;
    if (D.g.visible || (game.legGroup && game.legGroup.visible)) hideCentipede();
    const s = size(), t = game.time;
    orbsFrame(dt); hops(dt); guardsFrame(dt); drawLife();
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
        redGoal = k; alignGoal = 1; turn = D.kind === 'beam' ? 0 : 0.8;
        if (D.kind === 'beam') {
          A.fanMat.opacity = (0.22 + 0.33 * k) * (0.75 + 0.25 * Math.sin(t * (8 + 18 * k)));
          layStrip(A.edge, A.sweep.a0, 1.6 * s, get('reach', 24), 0.35, 0.05, false); A.edgeMat.opacity = 0.6 + 0.4 * k;
          A.yaw = lerpAng(A.yaw, A.sweep.a0, 1 - Math.exp(-4 * dt)); A.pitch += (0.55 - A.pitch) * (1 - Math.exp(-4 * dt));
        } else {   // light gathers into the eye from the rings
          spreadGoal = 1.25; yGoal = 3.2;
          if (Math.random() < 0.4 + k) { A.core.getWorldPosition(tv); const a = Math.random() * Math.PI * 2, r = 3.5 * s; tv2.set(tv.x + Math.sin(a) * r, tv.y + (Math.random() - 0.5) * 2, tv.z + Math.cos(a) * r); tv3.subVectors(tv, tv2).multiplyScalar(2.2); game.spark(tv2, tv3, 0.45, 0.5, Math.random() < 0.5 ? 0xffd0a0 : 0xff6a30, 0); }
        }
        A.light.intensity = 0.3 + 1.2 * k;
        if (D.atkT <= 0) {
          D.state = 'strike';
          if (D.kind === 'beam') { D.atkT = get('sweepTime', 1.6); D.atkLen = D.atkT; A.fanMesh.visible = false; A.edge.visible = false; game.labBreathing = true; game.shake(0.2); }
          else { D.atkT = 9; D.atkLen = 9; }
        }
      }
    } else if (D.state === 'strike') {
      D.atkT -= sdt; const k = clamp(1 - D.atkT / D.atkLen, 0, 1); redGoal = 1; alignGoal = 1; turn = 0;
      if (D.kind === 'beam') {
        beamFrame(dt, k); A.yaw = A.sweep.a0 + (A.sweep.a1 - A.sweep.a0) * k; A.pitch = 0.55; A.light.intensity = 1.5;
        if (D.atkT <= 0) { clearAttack(); D.state = 'recover'; D.atkT = get('opening', 1.8); }
      } else {
        spreadGoal = 1.25; yGoal = 3.2; turn = 0.8;
        if (!A.volley || volleyFrame(sdt)) { clearAttack(); D.state = 'recover'; D.atkT = get('opening', 1.8); }
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
    // wings: slow beats, spread while it fires, drooping in the opening
    const beat = Math.sin(t * 2.2) * 0.18 * (1 - A.dim) + (D.kind === 'orbs' && D.state !== 'walk' && D.state !== 'recover' ? -0.25 : 0) + A.dim * 0.45;
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
    if (A.dieT === 0) { game.shake(0.3); for (const Gd of G) if (Gd.up) { if (Gd.hold) letGo(Gd); Gd.up = false; Gd.backT = 99; tv.set(Gd.pos.x, Gd.y, Gd.pos.z); game.fxSphere(tv, 0xfff0c0, 2.5, 0.4); Gd.g.visible = false; Gd.sh.visible = false; Gd.ringFx.visible = false; } }
    A.dieT += dt; const k = A.dieT;
    for (const R of A.rings) { R.ang += dt * 6; tq.setFromAxisAngle(R.axis, R.ang); R.g.quaternion.copy(tq); R.g.scale.setScalar(1 + k * 1.6); for (const E of R.eyes) E.ball.scale.set(1, Math.max(0.1, 1 - k * 1.2), 1); }
    A.body.position.y += dt * 0.8; A.body.rotation.y += dt * (2 + k * 6);
    const lit = Math.floor(k * 18) % 2 === 0; for (const m of A.mats) m.emissive.setRGB(lit ? 1 : 0.4, lit ? 1 : 0.35, lit ? 1 : 0.25);
    if (Math.random() < 0.7) { A.core.getWorldPosition(tv); tv2.set((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6); game.spark(tv, tv2, 0.6, 0.6, Math.random() < 0.5 ? 0xffe0a0 : 0xffffff, 2); }
    if (k > 1.2 && A.root.visible) {
      A.core.getWorldPosition(tv); game.fxSphere(tv, 0xfff0c0, 7 * s, 0.6); game.fxPillar(D.pos.x, D.pos.z, 0xffe0a0, 18, 3 * s, 0.9);
      game.fxRing(D.pos.x, D.pos.z, 0xffd890, 10 * s, 0.7); game.sparkBurst(tv, 60, 8, 0.9, 3, 0xffe0a0); game.shake(0.4);
      A.root.visible = false; A.floor.visible = false; clearOrbs();
    }
    if (k > 1.7) { D.alive = false; D.dying = false; D.spawnT = 3; }
  }

  const ATT = ['ORBS', 'BEAM', 'BOTH'], PAT = ['MIX', 'RING', 'FAN', 'SPIRAL'];
  return [
    { id: 'on', label: 'Archon', help: 'A boss in place of the centipede: an angel of rings and eyes in the middle of the arena, with defenders. It warns, attacks, then sinks low: hit its core then', kind: 'onoff', value: 0, dice: false,
      apply: (v) => enable(v), frame: () => { if (game.bossHook !== hook) enable(1); } },
    { id: 'size', label: 'Archon size', help: 'How big it is (and its defenders)', min: 0.6, max: 1.8, step: 0.1, value: 1, fmt: (x) => x.toFixed(1) + '×' },
    { id: 'attacks', label: 'Attacks', help: 'ORBS: waves of light orbs across the floor, walk through the gaps or dive. BEAM: a sweeping wall of light over a red fan. BOTH: it picks', min: 0, max: 2, step: 1, value: 0, fmt: (x) => ATT[x] },
    { id: 'pattern', label: 'Orb pattern', help: 'RING: full circles with gaps. FAN: aimed sprays at whoever has the Solid. SPIRAL: two turning streams. MIX: it picks', min: 0, max: 3, step: 1, value: 0, fmt: (x) => PAT[x] },
    { id: 'orbs', label: 'Orbs a wave', help: 'How many orbs in a ring (a fan has half as many; a spiral fires them faster)', min: 6, max: 32, step: 1, value: 14 },
    { id: 'orbSpeed', label: 'Orb speed', help: 'How fast the orbs fly', min: 3, max: 18, step: 0.5, value: 8 },
    { id: 'windup', label: 'Warning time', help: 'How long it warns before it attacks (the rings lining up, light gathering, the red fan)', min: 0.5, max: 2.5, step: 0.1, value: 1.3, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'sweep', label: 'Beam sweep', help: 'How wide the beam sweeps', min: 40, max: 220, step: 10, value: 110, fmt: (x) => x + '°' },
    { id: 'sweepTime', label: 'Sweep time', help: 'How long the sweep takes (shorter is faster)', min: 0.5, max: 3, step: 0.1, value: 1.6, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'reach', label: 'Reach', help: 'How far the beam and the orbs go', min: 10, max: 44, step: 2, value: 24, fmt: (x) => x + ' M' },
    { id: 'opening', label: 'Opening', help: 'How long it sinks low after an attack, its core in reach', min: 0.4, max: 4, step: 0.1, value: 1.8, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'dodge', label: 'Teammates dodge', help: 'How often the teammate brains jump the beam and the orbs', min: 0, max: 1, step: 0.05, value: 0.75, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'rest', label: 'Rest', help: 'How long it waits after the opening before the next warning (Aggression shortens it)', min: 0.3, max: 6, step: 0.1, value: 2.2, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'guards', label: 'Defenders', help: 'Smaller wheels with one eye that cover the passing lanes and swat passes away', min: 0, max: 5, step: 1, value: 4, fmt: (x) => (x ? '' + x : 'NONE') },
    { id: 'guardSpeed', label: 'Defender speed', help: 'How fast they move (half as fast again going for a pass)', min: 1, max: 14, step: 0.5, value: 5.5 },
    { id: 'guardReach', label: 'Swat reach', help: 'How close a pass has to come for them to swat it (lobs over their heads get past)', min: 0.5, max: 3, step: 0.1, value: 1.4, fmt: (x) => x.toFixed(1) + ' M' },
    { id: 'guardRing', label: 'Guard distance', help: 'How far from the Archon they circle when there are no lanes to cover', min: 6, max: 26, step: 1, value: 13, fmt: (x) => x + ' M' },
    { id: 'guardHp', label: 'Defender toughness', help: 'Fast throws it takes to break one', min: 1, max: 8, step: 1, value: 3 },
    { id: 'guardBack', label: 'Defender return', help: 'How long a broken one stays gone', min: 2, max: 40, step: 1, value: 12, fmt: (x) => x + ' S' },
    { id: 'rush', label: 'Rush the passer', help: 'Hold the Solid too long and defenders rush you: more of them the closer you are to the Archon', kind: 'onoff', value: 1 },
    { id: 'rushAfter', label: 'Rush after', help: 'About how long you can hold the Solid before they come (sooner close to the Archon)', min: 0.3, max: 5, step: 0.1, value: 1.2, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'rushMax', label: 'Most rushers', help: 'How many can rush at once, close to the Archon', min: 1, max: 5, step: 1, value: 2 },
    { id: 'rushNear', label: 'All-out within', help: 'Closer than this to the Archon, the most rushers come', min: 4, max: 30, step: 1, value: 10, fmt: (x) => x + ' M' },
    { id: 'rushFar', label: 'Nobody past', help: 'Further than this from the Archon, they all stay back and cover', min: 8, max: 50, step: 1, value: 28, fmt: (x) => x + ' M' },
    { id: 'rushSpeed', label: 'Rush speed', help: 'How fast a rusher runs, times Defender speed', min: 1, max: 2.5, step: 0.05, value: 1.4, fmt: (x) => x.toFixed(2) + '×' },
    { id: 'solidLife', label: 'Solid life', help: 'The Solid has health, the team\'s life. A defender that reaches a pass takes it, then pulses and hurts it unless you run into it in time', kind: 'onoff', value: 0,
      apply: (v) => { if (v) resetLife(); else { for (const Gd of G) if (Gd.hold) letGo(Gd); drawLife(); } } },
    { id: 'solidHp', label: 'Solid health', help: 'How much the Solid can take before it shatters', min: 3, max: 20, step: 1, value: 10, apply: () => resetLife() },
    { id: 'stealDmg', label: 'Pulse damage', help: 'What a defender\'s pulse takes from the Solid', min: 1, max: 10, step: 1, value: 3 },
    { id: 'stealTime', label: 'Time to free it', help: 'How long a defender holds the Solid before it pulses: run into it before then', min: 0.4, max: 4, step: 0.1, value: 1.4, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'heal', label: 'Catch heals', help: 'Health a catch from a pass gives back to the Solid', min: 0, max: 3, step: 0.25, value: 0.5 },
    { id: 'shield', label: 'Shield', help: 'While any defender stands, the Archon takes half damage', kind: 'onoff', value: 0 }
  ];
});
