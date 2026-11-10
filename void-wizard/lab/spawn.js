// Lab shelf: Spawn. Extra solids that drop in from above. Run into them to kick them about; they bounce off the
// demon, each other and the real solid. They follow the World shelf's solid gravity.
// With Pick up on, the catch button picks one up when your hands are empty; press and hold to wind up, let go to throw.
// A thrown one that hits the demon hurts it.
LAB.shelf('spawn', 'Spawn', (game) => {
  const T = game.THREE, list = [];
  let edges = null;   // made on first use (three.js ids use Math.random, so making them early would change the demon's moves)
  const tmp = new T.Vector3();
  function add() {
    if (!edges) edges = game.SOLIDS.map(S => new T.EdgesGeometry(S.geo));
    const k = Math.random() * game.SOLIDS.length | 0, S = game.SOLIDS[k], p = game.player.pos;
    const m = new T.LineSegments(edges[k], new T.LineBasicMaterial({ color: S.col }));
    const b = { m, col: S.col, r: S.circ * 0.75, p: new T.Vector3(p.x + (Math.random() - 0.5) * 14, 8 + Math.random() * 10, p.z + (Math.random() - 0.5) * 14),
      v: new T.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2), w: new T.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4) };
    m.position.copy(b.p); game.scene.add(m); list.push(b);
  }
  function drop() { const b = list.pop(); for (const W of game.ALL) if (W.labHold === b) W.labHold = null; game.scene.remove(b.m); b.m.material.dispose(); }
  // ---- picking up and throwing (any wizard a person plays)
  function hands(dt) {
    const o = game.orb, pick = LAB.get('spawn.pickup') ?? 1;
    for (const W of game.ALL) {
      if (!W.human) { W.labHold = null; continue; }
      const held = !!(W.ctl && W.ctl.castHeld), pressed = held && !W.labPrev, let_go = !held && W.labPrev;
      W.labPrev = held;
      const hasOrb = o.state === 'held' && o.holder === W;
      let b = W.labHold;
      if (b && (hasOrb || W.downT > 0 || !list.includes(b))) { if (list.includes(b)) { b.held = false; b.v.set(0, 2, 0); } W.labHold = b = null; W.labCharging = false; }
      if (pressed && !b && pick && !hasOrb && W.downT <= 0) {
        let best = null, bd = 9;
        for (const x of list) { if (x.held) continue; const d = Math.hypot(x.p.x - W.pos.x, x.p.z - W.pos.z); if (d < 1.4 + x.r * size() && x.p.y < W.y + 2.2 && d < bd) { bd = d; best = x; } }
        if (best) { W.labHold = b = best; b.held = true; b.thrown = false; W.labCharging = false; W.labFresh = true; game.sparkBurst(b.p, 8, 2, 0.4, 0, b.col); }
      } else if (pressed && b) { W.labCharging = true; W.labCharge = 0; }
      if (b && W.labFresh && !held) W.labFresh = false;   // the press that picked it up doesn't also throw it
      if (b && W.labCharging) W.labCharge = Math.min(1, W.labCharge + dt);
      if (b && W.labCharging && let_go) {
        const c = W.labCharge, pw = LAB.get('spawn.power') ?? 1, fx = Math.sin(W.yaw), fz = Math.cos(W.yaw), hs = (9 + 13 * c) * pw;
        b.v.set(fx * hs + W.vel.x * 0.4, (W.grounded ? 4 + 4 * c : 1.5) * Math.min(1.5, pw), fz * hs + W.vel.z * 0.4);
        b.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(20);
        b.held = false; b.thrown = true; b.owner = W; b.noKick = 0.35; W.labHold = null; W.labCharging = false;
        game.rumble(W, 0.2, 0.3, 80);
      }
      if (b && b.held) {   // carried in front, up by the hands; spins faster while winding up
        b.p.set(W.pos.x + Math.sin(W.yaw) * 0.55, W.y + 1.15, W.pos.z + Math.cos(W.yaw) * 0.55); b.v.set(0, 0, 0);
        const k = 2 + (W.labCharging ? W.labCharge * 14 : 0); b.w.set(k, k * 0.7, 0);
      }
    }
  }
  const size = () => LAB.get('spawn.size') ?? 1;
  function step(dt) {
    if (!dt) return;
    const g = 24 * (LAB.get('world.solidGravity') ?? 1), bounce = LAB.get('spawn.bounce') ?? 0.6, kick = LAB.get('spawn.kick') ?? 1, sz = size();
    const parts = game.demon.alive && !game.demon.dying ? game.demonParts() : [];
    hands(dt);
    for (const b of list) {
      const r = b.r * sz;
      if (b.held) { b.m.position.copy(b.p); b.m.scale.setScalar(sz); b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; continue; }
      b.noKick = Math.max(0, (b.noKick || 0) - dt);
      b.v.y -= g * dt; b.p.addScaledVector(b.v, dt);
      if (b.p.y < r) { b.p.y = r; b.thrown = false; if (b.v.y < 0) b.v.y = -b.v.y * bounce; if (b.v.y < 0.6) b.v.y = 0; const f = Math.exp(-2.5 * dt); b.v.x *= f; b.v.z *= f; b.w.multiplyScalar(Math.exp(-2 * dt)); }
      // wizards kick them, faster wizards kick harder
      for (const W of game.ALL) {
        if (b.owner === W && b.noKick > 0) continue;
        const dx = b.p.x - W.pos.x, dz = b.p.z - W.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.55 + r && b.p.y < W.y + 1.7 && d > 0.001) {
          const sp = Math.hypot(W.vel.x, W.vel.z), pw = (0.8 + sp * 1.2) * kick;   // walking up to one only nudges it, running into it kicks it
          b.v.x = dx / d * pw + W.vel.x * 0.5; b.v.z = dz / d * pw + W.vel.z * 0.5; b.v.y = Math.max(b.v.y, (sp > 3 ? 2 + sp * 0.4 : 0.5) * kick);
          b.p.x = W.pos.x + dx / d * (0.56 + r); b.p.z = W.pos.z + dz / d * (0.56 + r);
          b.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14);
        }
      }
      // the demon and the real solid push them away
      for (const q of parts) {
        // a thrown one that hits the demon hurts it, harder the faster it flies
        if (b.thrown && b.v.length() > 5 && tmp.set(q.x, q.y, q.z).distanceTo(b.p) < r + q.r) {
          game.hurtDemon(q, (LAB.get('spawn.damage') ?? 6) * Math.min(2, b.v.length() / 14), b.col); b.thrown = false; game.shake(0.06);
        }
        bounceOff(b, r, tmp.set(q.x, q.y, q.z), q.r);
      }
      bounceOff(b, r, game.orb.p, game.solid.circ * 0.7);
      b.m.position.copy(b.p); b.m.scale.setScalar(sz);
      b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
      // too far away: drop back in near you
      if (Math.hypot(b.p.x - game.player.pos.x, b.p.z - game.player.pos.z) > 70) { b.p.set(game.player.pos.x + (Math.random() - 0.5) * 10, 14, game.player.pos.z + (Math.random() - 0.5) * 10); b.v.set(0, 0, 0); }
    }
    // and each other
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], c = list[j], rr = (a.r + c.r) * sz;
      if (a.held || c.held) continue;
      tmp.subVectors(c.p, a.p); const d = tmp.length();
      if (d > 0.0001 && d < rr) { tmp.divideScalar(d); const o = (rr - d) / 2; a.p.addScaledVector(tmp, -o); c.p.addScaledVector(tmp, o);
        const rel = (c.v.x - a.v.x) * tmp.x + (c.v.y - a.v.y) * tmp.y + (c.v.z - a.v.z) * tmp.z;
        if (rel < 0) { a.v.addScaledVector(tmp, rel); c.v.addScaledVector(tmp, -rel); } }
    }
  }
  function bounceOff(b, r, at, R) {
    tmp.subVectors(b.p, at); const d = tmp.length();
    if (d < r + R && d > 0.0001) { tmp.divideScalar(d); b.p.copy(at).addScaledVector(tmp, r + R); const vn = b.v.dot(tmp); if (vn < 0) b.v.addScaledVector(tmp, -1.8 * vn); }
  }
  return [
    { id: 'count', label: 'Extra solids', help: 'They drop in from above', min: 0, max: 60, step: 1, value: 0,
      apply: (v) => { while (list.length < v) add(); while (list.length > v) drop(); }, frame: (dt) => step(dt) },
    { id: 'size', label: 'Their size', help: 'How big the extra solids are', min: 0.3, max: 3, step: 0.1, value: 1 },
    { id: 'bounce', label: 'Their bounce', help: '1 bounces forever', min: 0, max: 1, step: 0.05, value: 0.6 },
    { id: 'kick', label: 'Kick strength', help: 'How far you knock them', min: 0, max: 3, step: 0.1, value: 1 },
    { id: 'pickup', label: 'Pick up', help: 'Catch button picks one up, hold and let go to throw', kind: 'onoff', value: 1 },
    { id: 'power', label: 'Throw power', help: 'How hard you throw them', min: 0.3, max: 3, step: 0.1, value: 1 },
    { id: 'damage', label: 'Hit damage', help: 'How much a thrown one hurts the demon', min: 0, max: 40, step: 1, value: 6 }
  ];
});
