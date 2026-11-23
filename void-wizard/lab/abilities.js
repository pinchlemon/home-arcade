// Lab shelf: Abilities. Each solid's special, used by whoever holds it, paid for with the Solid's resonance.
//   L1 (or V): a tap is the small ability (3 resonance), holding it is the big one (5). The dodecahedron's Pentacle is
//   the Match shelf's.
//   Tetrahedron  Ignite: the next hit sets the demon Burning.   Blast: the next hit explodes and leaves it Exposed.
//   Cube         Build: three blocks in front of you (again on the same spot stacks them).   Wall: one long wall.
//                Blocks stop the demon, its spit and its breath; your throws go through.
//   Octahedron   Thread: the next pass homes in on a teammate and adds 2 resonance.   Gust: the team runs faster,
//                spit is blown away and the demon is pushed back.
//   Icosahedron  Freeze: the demon freezes solid and is Exposed.   d20: roll it. 1 backfires, 2-9 it stumbles,
//                10-19 it is lifted, slammed and Exposed, 20 everything floats, it slams down and is Confused (no attacks).
//   Dice: every ability rolls its solid's die (d4, d6, d8); a higher roll is stronger, the top face is a critical.
//   Conditions work on any demon: Burning (hurts over time), Exposed (takes more damage), Frozen (can't move or attack),
//   Confused (wanders, can't attack).
// The demon's damage from Exposed is added in demonHit, before the Match shelf keeps its health at 1 (so this shelf
// loads before Match). attacks.js asks LAB.blocked(from, to) before the breath hits someone.
LAB.shelf('abilities', 'Abilities', (game) => {
  const T = game.THREE, FX = window.FEATURES, o = game.orb, D = game.demon;
  const get = (k, d) => { const v = LAB.get('abilities.' + k); return v == null ? d : v; };
  const on = () => !!LAB.get('abilities.on');
  const btn = (gp, i) => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const pop = (text, at, col) => { try { game.popup(text, V3(at.x, at.y == null ? 2 : at.y, at.z), col, true); } catch (e) {} };
  const live = () => D.alive && !D.dying;
  const head = () => { const p = game.demonParts()[0]; return V3(p.x, p.y, p.z); };
  const colOf = (name) => { const S = game.SOLIDS.find(s => s.name === name); return S ? S.col : 0xffffff; };
  const css = (hex) => '#' + new T.Color(hex).getHexString();
  const st = { burnT: 0, burnDps: 0, burnAcc: 0, exposeT: 0, exposeMul: 1.5, frozenT: 0, confuseT: 0, confuseFlip: 0,
    lift: 0, liftGoal: 0, slamAt: 0, armed: null, thread: null, threadTo: null, threadAdd: 2, l1: false, l1T: 0, fired: false, key: false, roll: null, hp: 0 };

  // ---------------------------------------------------------------- dice
  const DIE = { tetrahedron: 4, cube: 6, octahedron: 8, icosahedron: 20, dodecahedron: 12 };
  function roll(name) {
    const n = DIE[name] || 6; if (!get('dice', 1)) return { n, face: 0, mul: 1, crit: false };
    const face = 1 + Math.floor(Math.random() * n);
    return { n, face, mul: 0.7 + 0.6 * (face - 1) / (n - 1), crit: face === n };
  }
  const say = (r, at, col) => { if (r.face) pop('d' + r.n + ' · ' + r.face + (r.crit ? ' · CRIT!' : ''), V3(at.x, (at.y || 0) + 3, at.z), r.crit ? '#ffd36a' : col); };

  // ---------------------------------------------------------------- conditions on the demon
  const statusEl = document.createElement('div');
  statusEl.style.cssText = 'position:fixed;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);font-family:var(--font-pixel,monospace);font-size:10px;letter-spacing:1px;color:#fff;text-shadow:0 0 4px #000,0 0 2px #000;pointer-events:none;z-index:6;text-align:center;white-space:nowrap';
  document.body.appendChild(statusEl);
  function expose(sec, mul) { st.exposeT = Math.max(st.exposeT, sec); st.exposeMul = Math.max(mul || 1.5, st.exposeT > 0 ? st.exposeMul : 0); if (live()) pop('EXPOSED', V3(head().x, head().y + 1.6, head().z), '#ffffff'); }
  function freeze(sec) {
    st.frozenT = Math.max(st.frozenT, sec); D.stunT = Math.max(D.stunT || 0, sec);
    if (D.state === 'windup' || D.state === 'strike') { D.state = 'recover'; D.atkT = 0.6; }
  }
  FX.on('demonHit', (dmg) => {
    if (!on() || !live()) return;
    if (st.exposeT > 0 && dmg > 0 && !st.inExtra) { const extra = dmg * (st.exposeMul - 1); D.hp -= extra; }
    // the armed Solid's ability lands
    if (st.armed && o.state === 'air' && o.last && near(o.p, 3)) {
      const a = st.armed; st.armed = null;
      const h = head(), col = colOf('tetrahedron');
      if (a.kind === 'ignite') {
        st.burnT = Math.max(st.burnT, 5 * a.mul * (a.crit ? 1.6 : 1)); st.burnDps = get('burn', 4) * a.mul * (a.crit ? 1.5 : 1);
        pop('BURNING', V3(h.x, h.y + 1.6, h.z), '#ff8a4a');
      } else if (a.kind === 'blast') boom(o.p, a);
    }
  }, 'lab');
  function near(p, extra) { if (!live()) return false; return game.demonParts().some(q => Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < q.r + extra); }
  function boom(p, a) {
    const col = colOf('tetrahedron'), at = V3(p.x, Math.max(0.5, p.y), p.z), dmg = get('blast', 25) * a.mul * (a.crit ? 1.6 : 1);
    game.fxSphere(at, 0xffd36a, 4.2, 0.5); game.fxRing(p.x, p.z, col, 6, 0.55); game.fxRing(p.x, p.z, 0xffd36a, 3.5, 0.4, 0.08);
    game.fxPillar(p.x, p.z, col, 8, 1.2, 0.6); game.fxBurst(at, col, 80, 7); game.shake(0.35);
    if (live()) { const parts = game.demonParts(); let best = parts[0], bd = 1e9; for (const q of parts) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
      if (bd < 5) { st.inExtra = true; game.hurtDemon(best, dmg, col); st.inExtra = false; expose(4 * a.mul * (a.crit ? 1.5 : 1)); } }
    pop('BLAST!', V3(p.x, 2.5, p.z), '#ffd36a');
  }

  // ---------------------------------------------------------------- blocks (Build and Wall): boxes the demon, its spit and its breath can't pass
  const blocks = [];
  const see = () => get('opacity', 0.3);   // the cube's blocks and walls are see-through
  function blockMesh(w, h, d, hex) {
    const g = new T.Group();
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.5, transparent: true, opacity: see(), depthWrite: false, side: T.DoubleSide }));
    const e = new T.LineSegments(new T.EdgesGeometry(m.geometry), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    m.renderOrder = 3; e.renderOrder = 4;
    g.add(m, e); game.scene.add(g); return g;
  }
  function addBlock(x, z, y0, w, h, d, yaw, life, hex) {
    const g = blockMesh(w, h, d, hex); g.position.set(x, y0 + h / 2, z); g.rotation.y = yaw; g.scale.set(1, 0.01, 1);
    const b = { x, z, y0, h, hw: w / 2, hd: d / 2, yaw, life, t: 0, g };
    blocks.push(b);
    while (blocks.length > get('maxBlocks', 18)) dropBlock(blocks[0]);
    game.fxRing(x, z, hex, Math.max(w, d), 0.4); game.spawnPuffs(4, 1.5, V3(x, 0, z), 0.9);
    return b;
  }
  function dropBlock(b) { const i = blocks.indexOf(b); if (i >= 0) blocks.splice(i, 1); game.scene.remove(b.g); b.g.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); game.spawnPuffs(5, 1.5, V3(b.x, 0.3, b.z), 1); }
  // a point in a block's own frame
  const local = (b, x, z) => { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw); return [dx * c - dz * s, dx * s + dz * c]; };
  function inside(b, x, y, z, r) { if (y > b.y0 + b.h + r || y < b.y0 - r) return false; const [lx, lz] = local(b, x, z); return Math.abs(lx) < b.hw + r && Math.abs(lz) < b.hd + r; }
  // does the straight line from a to b cross any block (on the ground plan, below the block's top)?
  LAB.blocked = (a, b) => {
    if (!on() || !blocks.length) return false;
    for (const k of blocks) {
      if (k.y0 > 1.2) continue;
      const [ax, az] = local(k, a.x, a.z), [bx, bz] = local(k, b.x, b.z);
      let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az, ok = (p, q) => { if (Math.abs(p) < 1e-9) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
      if (ok(-dx, ax + k.hw) && ok(dx, k.hw - ax) && ok(-dz, az + k.hd) && ok(dz, k.hd - az) && t0 <= t1) return true;
    }
    return false;
  };
  function tickBlocks(dt) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i]; b.t += dt;
      const grow = Math.min(1, b.t / 0.25), fade = b.life - b.t;
      b.g.scale.y = Math.max(0.01, grow); b.g.position.y = b.y0 + b.h / 2 * grow;
      if (fade < 0.6) b.g.children.forEach(c => { c.material.opacity = Math.max(0, fade / 0.6) * (c.isMesh ? see() : 0.9); });
      if (b.t >= b.life) dropBlock(b);
    }
    if (!blocks.length) return;
    // spit gobs stop at a block
    for (const V of game.venoms) if (V.alive) for (const b of blocks) if (inside(b, V.g.position.x, V.g.position.y, V.g.position.z, 0.2)) {
      V.alive = false; V.g.visible = false; game.fxBurst(V.g.position.clone(), 0xff5a1a, 14, 3); break;
    }
    // the demon's head can't go through: it's pushed back out the nearest side
    if (live()) {
      const r = 0.62 * (D.scale || 1) * 0.8;
      for (const b of blocks) {
        if (b.y0 > 1.5) continue;
        const [lx, lz] = local(b, D.pos.x, D.pos.z), ox = b.hw + r - Math.abs(lx), oz = b.hd + r - Math.abs(lz);
        if (ox <= 0 || oz <= 0) continue;
        let nx = 0, nz = 0, push = 0;
        if (ox < oz) { nx = Math.sign(lx) || 1; push = ox; } else { nz = Math.sign(lz) || 1; push = oz; }
        const c = Math.cos(b.yaw), s = Math.sin(b.yaw), wx = nx * c + nz * s, wz = -nx * s + nz * c;   // back to world
        D.pos.x += wx * push; D.pos.z += wz * push;
        const vn = D.vel.x * wx + D.vel.z * wz; if (vn < 0) { D.vel.x -= vn * wx; D.vel.z -= vn * wz; }
        if (D.state === 'strike') { D.state = 'recover'; D.atkT = 0.8; D.stunT = Math.max(D.stunT || 0, 0.6); game.shake(0.2); game.fxBurst(V3(D.pos.x, 1, D.pos.z), 0xffffff, 20, 4); }
      }
    }
  }
  function build(Y, r) {
    const hex = colOf('cube'), fx = Math.sin(Y.yaw), fz = Math.cos(Y.yaw), s = 1.3 * (r.crit ? 1.25 : 1), life = get('blockTime', 12) * r.mul;
    for (let i = -1; i <= 1; i++) {
      const x = Y.pos.x + fx * 2.6 + fz * i * s, z = Y.pos.z + fz * 2.6 - fx * i * s;
      let y0 = 0; for (const b of blocks) if (hd(b, { x, z }) < s * 0.7 && b.hw < 1.5) y0 = Math.max(y0, b.y0 + b.h);   // on the same spot: on top
      if (y0 > s * 2.5) continue;
      addBlock(x, z, y0, s, s, s, Y.yaw, life, hex);
    }
    pop('BUILD', V3(Y.pos.x, 2.4, Y.pos.z), css(hex));
  }
  function wall(Y, r) {
    const hex = colOf('cube'), fx = Math.sin(Y.yaw), fz = Math.cos(Y.yaw), len = get('wallLen', 8) * r.mul * (r.crit ? 2 : 1);
    addBlock(Y.pos.x + fx * 3, Y.pos.z + fz * 3, 0, len, 2.6, 0.7, Y.yaw, get('wallTime', 6) * r.mul, hex);
    game.shake(0.2);
    pop(r.crit ? 'GREAT WALL' : 'WALL', V3(Y.pos.x, 2.4, Y.pos.z), css(hex));
  }

  // ---------------------------------------------------------------- Thread and Gust
  FX.on('pass', (W, R) => { if (st.thread && W === st.thread.from) { st.threadTo = R; st.thread = null; } }, 'lab');
  FX.on('throw', (W) => {
    if (st.armed && st.armed.by !== W) st.armed = null;
    if (st.thread && st.thread.from === W) st.thread.pending = true;
  }, 'lab');
  FX.on('catch', (W, caught) => {
    if (st.threadTo) {
      if (W === st.threadTo && caught) { o.res = Math.min(5, (o.res || 0) + st.threadAdd); pop('+' + st.threadAdd + ' RESONANCE', V3(W.pos.x, 2.4, W.pos.z), css(colOf('octahedron'))); }
      st.threadTo = null;
    }
    if (st.armed && st.armed.by !== W) st.armed = null;
  }, 'lab');
  function tickThread(dt) {
    if (st.thread && st.thread.pending && o.state === 'air') {   // a throw that wasn't a Madden pass: the teammate it's heading for
      const W = st.thread.from; let R = o.labTo || game.passTarget(W, Math.sin(W.yaw), Math.cos(W.yaw));
      if (!R) { let bd = 1e9; for (const x of game.ALL) if (x !== W && x.downT <= 0) { const d = hd(x.pos, W.pos); if (d < bd) { bd = d; R = x; } } }
      st.threadTo = R; st.thread = null;
    }
    const R = st.threadTo;
    if (!R || o.state !== 'air' || o.touched) { if (R && o.state !== 'air') st.threadTo = null; return; }
    // homes in: steer onto a path that meets the receiver's chest
    const g = game.G * game.solid.grav, dx = R.pos.x - o.p.x, dz = R.pos.z - o.p.z, d = Math.hypot(dx, dz);
    const tt = Math.max(0.15, d / 16), want = V3(dx / tt + R.vel.x, ((R.y || 0) + 1 - o.p.y + 0.5 * g * tt * tt) / tt, dz / tt + R.vel.z), k = Math.min(1, dt * 8);
    o.v.x += (want.x - o.v.x) * k; o.v.z += (want.z - o.v.z) * k; o.v.y += (want.y - o.v.y) * k;
    if (Math.random() < 0.7) game.spark(o.p.clone(), V3((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)), 0.35, 0.5, colOf('octahedron'), 2);
  }
  function gust(Y, r) {
    const hex = colOf('octahedron'), sec = 4 * r.mul * (r.crit ? 1.5 : 1);
    LAB.boost('world.speed', (LAB.base('world.speed') || 1) * (r.crit ? 1.7 : 1.45), sec);
    let blown = 0; for (const V of game.venoms) if (V.alive && hd(V.g.position, Y.pos) < 16) { V.alive = false; V.g.visible = false; game.fxBurst(V.g.position.clone(), 0xffffff, 8, 3); blown++; }
    if (live() && hd(D.pos, Y.pos) < 16) {
      const dx = D.pos.x - Y.pos.x, dz = D.pos.z - Y.pos.z, d = Math.hypot(dx, dz) || 1, k = 6 * r.mul;
      D.pos.x += dx / d * k * 0.4; D.pos.z += dz / d * k * 0.4; D.vel.x = dx / d * k * 2; D.vel.z = dz / d * k * 2; D.stunT = Math.max(D.stunT || 0, 0.7);
      if (D.state === 'windup' || D.state === 'strike') { D.state = 'recover'; D.atkT = 0.8; }
    }
    for (let i = 0; i < 3; i++) game.fxRing(Y.pos.x, Y.pos.z, i ? 0xffffff : hex, 14 - i * 4, 0.6, i * 0.08);
    for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2; game.spark(V3(Y.pos.x, 0.6, Y.pos.z), V3(Math.cos(a) * 12, 1 + Math.random() * 2, Math.sin(a) * 12), 0.5, 0.5, i % 2 ? 0xffffff : hex, 1.5); }
    game.shake(0.2);
    pop('GUST', V3(Y.pos.x, 2.4, Y.pos.z), css(hex));
  }

  // ---------------------------------------------------------------- Freeze and the d20
  const d20El = document.createElement('div');
  d20El.style.cssText = 'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);font-family:var(--font-pixel,monospace);font-size:44px;color:#fff;text-shadow:0 0 12px #7ab8ff,0 0 3px #000;pointer-events:none;z-index:7;display:none;text-align:center';
  document.body.appendChild(d20El);
  function freezeIt(Y, r) {
    if (!live()) return;
    const sec = get('freeze', 2.5) * r.mul * (r.crit ? 1.6 : 1), h = head();
    freeze(sec); expose(sec);
    game.fxRing(D.pos.x, D.pos.z, 0xbfe8ff, 6 * (D.scale || 1) / 2, 0.6); game.fxBurst(h, 0xe4f4ff, 60, 5);
    pop('FROZEN', V3(h.x, h.y + 2.2, h.z), '#bfe8ff');
  }
  function d20(Y) {
    if (st.roll) return;
    const face = 1 + Math.floor(Math.random() * 20);
    st.roll = { face, t: 0, Y };
  }
  function tickRoll(dt) {
    const R = st.roll; if (!R) return;
    R.t += dt;
    if (R.t < 0.9) { d20El.style.display = ''; d20El.textContent = 1 + Math.floor(Math.random() * 20); d20El.style.color = '#fff'; return; }
    if (!R.done) {
      R.done = true; d20El.textContent = String(R.face); d20El.style.color = R.face === 20 ? '#ffd36a' : R.face === 1 ? '#ff6a5a' : '#bfe8ff';
      const f = R.face, Y = R.Y, h = live() ? head() : V3(Y.pos.x, 1, Y.pos.z);
      if (f === 1) { Y.diveT = 0; game.knockDown(Y, Math.random() - 0.5, Math.random() - 0.5, 8); pop('BACKFIRE', V3(Y.pos.x, 2.4, Y.pos.z), '#ff6a5a'); }
      else if (!live()) { }
      else if (f <= 9) { D.slowT = Math.max(D.slowT || 0, 5); freeze(1); pop('STUMBLES', V3(h.x, h.y + 2, h.z), '#bfe8ff'); }
      else if (f <= 19) { st.liftGoal = 1; st.slamAt = 1.1; st.slamKind = 'lift'; freeze(1.6); pop('LIFTED', V3(h.x, h.y + 2, h.z), '#bfe8ff'); }
      else { st.liftGoal = 2.2; st.slamAt = 1.6; st.slamKind = 'float'; freeze(2); pop('NATURAL 20', V3(h.x, h.y + 2.5, h.z), '#ffd36a'); game.shake(0.3);
        for (const W of game.ALL) if (W.downT <= 0) { W.vy = Math.max(W.vy, 9); W.grounded = false; } }
    }
    if (R.t > 2.2) { d20El.style.display = 'none'; st.roll = null; }
  }
  function tickLift(dt) {
    if (st.slamAt > 0) {
      st.slamAt -= dt; st.lift += (st.liftGoal - st.lift) * (1 - Math.exp(-dt * 3));
      if (live() && D.stunT < 0.3) D.stunT = 0.3;
      if (st.slamAt <= 0) { st.liftGoal = 0; st.slam = true; }
    } else if (st.lift > 0) {
      st.lift = Math.max(0, st.lift - dt * 14);   // down hard
      if (st.lift === 0 && st.slam) {
        st.slam = false;
        if (live()) {
          const p = D.pos, col = 0xbfe8ff;
          game.shake(0.45); game.fxRing(p.x, p.z, col, 9, 0.6); game.fxRing(p.x, p.z, 0xffffff, 6, 0.45, 0.08); game.spawnPuffs(16, 4, V3(p.x, 0, p.z), 1.5);
          game.hurtDemon(game.demonParts()[0], get('slam', 12) * (st.slamKind === 'float' ? 1.6 : 1), col);
          if (st.slamKind === 'float') { st.confuseT = get('confused', 20); expose(4); pop('CONFUSED', V3(p.x, 3.5, p.z), '#ffd36a'); }
          else expose(get('expose', 6));
        }
      }
    }
    // lifted: the whole centipede floats (its legs too); its shadow stays on the ground
    const L = st.lift;
    if (game.legGroup) game.legGroup.position.y = L;
    if (L > 0.001 && live()) { D.g.position.y += L; for (const S of D.segs) S.g.position.y += L; }
  }
  function tickConfuse(dt) {
    if (!(st.confuseT > 0) || !live()) { st.confuseT = 0; return; }
    st.confuseT -= dt;
    D.cd = Math.max(D.cd || 0, 0.6);   // it can't start an attack
    if (D.state === 'windup' || D.state === 'strike') { D.state = 'recover'; D.atkT = 0.6; }
    st.confuseFlip -= dt; if (st.confuseFlip <= 0) { st.confuseFlip = 1.2 + Math.random() * 1.5; D.mode = 'prowl'; D.modeT = 3; D.orbitDir = Math.random() < 0.5 ? -1 : 1; D.orbitA = Math.random() * Math.PI * 2; }
    D.yaw += Math.sin(performance.now() / 260) * dt * 1.2;
    if (Math.random() < dt * 10) { const h = head(), a = performance.now() / 200; game.spark(V3(h.x + Math.cos(a) * 1.2, h.y + 1.2, h.z + Math.sin(a) * 1.2), V3(0, 0.6, 0), 0.5, 0.5, Math.random() < 0.5 ? 0xffd36a : 0xffffff, 0); }
  }

  // ---------------------------------------------------------------- the button
  const ABIL = {
    tetrahedron: ['IGNITE', 'BLAST'], cube: ['BUILD', 'WALL'], octahedron: ['THREAD', 'GUST'], icosahedron: ['FREEZE', 'd20']
  };
  function use(Y, big) {
    const name = game.solid.name, A = ABIL[name]; if (!A) return;
    const cost = big ? get('big', 5) : get('small', 3), at = V3(Y.pos.x, Y.y + 2.4, Y.pos.z), col = css(game.solid.col);
    if ((o.res || 0) < cost) { pop((big ? A[1] : A[0]) + ' · RESONANCE ' + (o.res || 0) + ' / ' + cost, at, '#ffffff'); return; }
    if (!big && name === 'icosahedron' && !live()) { pop('NO DEMON', at, '#ffffff'); return; }
    o.res = (o.res || 0) - cost;
    if (name === 'icosahedron' && big) { pop('d20', at, col); d20(Y); return; }
    const r = roll(name); say(r, V3(Y.pos.x, Y.y, Y.pos.z), col);
    if (name === 'tetrahedron') { st.armed = { kind: big ? 'blast' : 'ignite', by: Y, mul: r.mul, crit: r.crit }; pop(big ? 'BLAST READY' : 'IGNITE READY', at, col); game.fxRing(Y.pos.x, Y.pos.z, game.solid.col, 2.5, 0.4); }
    else if (name === 'cube') big ? wall(Y, r) : build(Y, r);
    else if (name === 'octahedron') { if (big) gust(Y, r); else { st.thread = { from: Y }; st.threadAdd = r.crit ? 3 : 2; pop('THREAD READY', at, col); } }
    else if (name === 'icosahedron') freezeIt(Y, r);
    game.rumble(Y, 0.4, 0.6, 180);
  }
  function tickButton() {
    const Y = game.you; if (!Y) return;
    const holding = o.state === 'held' && o.holder === Y && Y.downT <= 0 && !game.blockPad;
    const down = btn(Y.gp, 4) || game.keys.has('KeyV');
    const now = performance.now() / 1000;
    if (down && !st.l1) { st.l1T = now; st.fired = false; }
    if (holding && ABIL[game.solid.name]) {
      if (down && !st.fired && now - st.l1T >= get('hold', 0.3)) { st.fired = true; use(Y, true); }
      if (!down && st.l1 && !st.fired) use(Y, false);
    }
    st.l1 = down;
  }

  // ---------------------------------------------------------------- every frame
  let wasAlive = false;
  function reset() { st.burnT = st.exposeT = st.frozenT = st.confuseT = 0; st.liftGoal = 0; st.slamAt = 0; st.slam = false; st.armed = null; }
  function tick(dt) {
    if (live() && !wasAlive) reset();   // a new demon starts clean
    wasAlive = live();
    tickButton(); tickBlocks(dt); tickThread(dt); tickRoll(dt); tickLift(dt); tickConfuse(dt);
    if (st.armed && (o.state === 'ground' || (o.state === 'air' && o.touched && !near(o.p, 3)))) {   // Blast goes off where it lands, Ignite fizzles
      if (st.armed.kind === 'blast' && o.state === 'air' && st.armed.by !== o.holder && o.last) boom(o.p, st.armed);
      st.armed = null;
    }
    if (st.armed && o.state === 'air' && Math.random() < 0.8) game.spark(o.p.clone(), V3((Math.random() - .5) * 2, 1, (Math.random() - .5) * 2), 0.35, 0.6, st.armed.kind === 'blast' ? 0xffd36a : 0xff5a1a, 1);
    // conditions run down
    st.exposeT = Math.max(0, st.exposeT - dt); st.frozenT = Math.max(0, st.frozenT - dt);
    if (st.burnT > 0 && live()) {
      st.burnT -= dt; st.burnAcc += dt;
      if (st.burnAcc >= 0.5) { st.burnAcc = 0; const ps = game.demonParts(), q = ps[Math.floor(Math.random() * ps.length)]; st.inExtra = true; game.hurtDemon(q, st.burnDps * 0.5, 0xff6a1a); st.inExtra = false; }
      if (Math.random() < 0.6) { const ps = game.demonParts(), q = ps[Math.floor(Math.random() * ps.length)]; game.spark(V3(q.x, q.y + q.r * 0.6, q.z), V3((Math.random() - .5), 1.5 + Math.random() * 1.5, (Math.random() - .5)), 0.6, 0.6, Math.random() < 0.5 ? 0xff5a1a : 0xffd36a, -1); }
    } else st.burnT = 0;
    if (st.frozenT > 0 && live() && Math.random() < 0.8) { const ps = game.demonParts(), q = ps[Math.floor(Math.random() * ps.length)]; game.spark(V3(q.x, q.y + q.r * 0.5, q.z), V3((Math.random() - .5) * 0.5, 0.3, (Math.random() - .5) * 0.5), 0.8, 0.5, Math.random() < 0.5 ? 0xe4f4ff : 0x9fd8ff, 0.5); }
    if (st.exposeT > 0 && live() && Math.random() < 0.3) { const h = head(); game.fxRing(h.x, h.z, 0xffffff, 2.2 * (D.scale || 1) / 2, 0.3); }
    // the line at the bottom: what you can do now, and how the demon is
    const Y = game.you, A = ABIL[game.solid.name], holding = Y && o.state === 'held' && o.holder === Y;
    const parts = [];
    if (holding && A) { const r = o.res || 0; parts.push(`L1 ${A[0]}${r >= get('small', 3) ? '' : ' (' + get('small', 3) + ')'} · HOLD ${A[1]}${r >= get('big', 5) ? '' : ' (' + get('big', 5) + ')'}`); }
    const c = []; if (st.burnT > 0) c.push('BURNING'); if (st.exposeT > 0) c.push('EXPOSED'); if (st.frozenT > 0) c.push('FROZEN'); if (st.confuseT > 0) c.push('CONFUSED ' + Math.ceil(st.confuseT));
    if (c.length && live()) parts.push('DEMON: ' + c.join(' · '));
    if (st.armed) parts.push(st.armed.kind === 'blast' ? 'BLAST READY' : 'IGNITE READY'); if (st.thread) parts.push('THREAD READY');
    const t = parts.join('   ');
    if (statusEl.textContent !== t) statusEl.textContent = t;
    statusEl.style.display = t ? '' : 'none';
  }
  LAB.abilities = { st, blocks, use };   // for tests
  function off() {
    for (const b of [...blocks]) dropBlock(b);
    reset(); st.lift = 0; st.thread = null; st.threadTo = null; st.roll = null; d20El.style.display = 'none'; statusEl.style.display = 'none';
    if (game.legGroup) game.legGroup.position.y = 0;
  }
  return [
    { id: 'on', label: 'Abilities', help: 'Each solid\'s special on L1: tap for the small one (3 resonance), hold for the big one (5)', kind: 'onoff', value: 0, dice: false,
      frame: (dt) => tick(dt), apply: (v) => { if (!v) off(); } },
    { id: 'dice', label: 'Dice', help: 'Every ability rolls its solid\'s die: higher is stronger, the top face is a critical', kind: 'onoff', value: 1, dice: false },
    { id: 'small', label: 'Small costs', help: 'Resonance for a tap of L1', min: 1, max: 5, step: 1, value: 3, dice: false },
    { id: 'big', label: 'Big costs', help: 'Resonance for holding L1', min: 1, max: 5, step: 1, value: 5, dice: false },
    { id: 'hold', label: 'Hold for big', help: 'How long you hold L1 for the big ability', min: 0.15, max: 1, step: 0.05, value: 0.3, dice: false, fmt: (x) => x.toFixed(2) + ' S' },
    { id: 'burn', label: 'Burn', help: 'Ignite\'s damage a second (for 5 seconds)', min: 1, max: 15, step: 1, value: 4, dice: false },
    { id: 'blast', label: 'Blast', help: 'Blast\'s extra damage', min: 5, max: 80, step: 5, value: 25, dice: false },
    { id: 'blockTime', label: 'Blocks last', help: 'Seconds a Build block stays', min: 3, max: 30, step: 1, value: 12, dice: false, fmt: (x) => x + ' S' },
    { id: 'wallLen', label: 'Wall length', help: 'How long the Wall is', min: 3, max: 20, step: 1, value: 8, dice: false },
    { id: 'wallTime', label: 'Wall lasts', help: 'Seconds the Wall stays', min: 2, max: 20, step: 1, value: 6, dice: false, fmt: (x) => x + ' S' },
    { id: 'freeze', label: 'Freeze', help: 'Seconds Freeze holds the demon (and it is Exposed)', min: 0.5, max: 8, step: 0.5, value: 2.5, dice: false, fmt: (x) => x + ' S' },
    { id: 'expose', label: 'Exposed (d20)', help: 'Seconds a 10 to 19 on the d20 leaves it Exposed', min: 1, max: 15, step: 1, value: 6, dice: false, fmt: (x) => x + ' S' },
    { id: 'confused', label: 'Confused (20)', help: 'Seconds a natural 20 leaves it Confused, unable to attack', min: 5, max: 40, step: 1, value: 20, dice: false, fmt: (x) => x + ' S' },
    { id: 'slam', label: 'Slam', help: 'Damage when the d20 slams it down', min: 0, max: 60, step: 2, value: 12, dice: false },
    { id: 'opacity', label: 'Wall opacity', help: 'How solid Build blocks and Walls look (lower is more see-through)', min: 0.1, max: 1, step: 0.05, value: 0.3, dice: false, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'maxBlocks', label: 'Most blocks', help: 'Blocks at once (the oldest goes)', min: 3, max: 40, step: 1, value: 18, dice: false }
  ];
});
