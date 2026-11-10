// Lab shelf: Spawn. Extra solids that drop in from above. Run into them to kick them about; they bounce off the
// demon, each other and the real solid. They follow the World shelf's solid gravity.
LAB.shelf('spawn', 'Spawn', (game) => {
  const T = game.THREE, list = [];
  let edges = null;   // made on first use (three.js ids use Math.random, so making them early would change the demon's moves)
  const tmp = new T.Vector3();
  function add() {
    if (!edges) edges = game.SOLIDS.map(S => new T.EdgesGeometry(S.geo));
    const k = Math.random() * game.SOLIDS.length | 0, S = game.SOLIDS[k], p = game.player.pos;
    const m = new T.LineSegments(edges[k], new T.LineBasicMaterial({ color: S.col }));
    const b = { m, r: S.circ * 0.75, p: new T.Vector3(p.x + (Math.random() - 0.5) * 14, 8 + Math.random() * 10, p.z + (Math.random() - 0.5) * 14),
      v: new T.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2), w: new T.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4) };
    m.position.copy(b.p); game.scene.add(m); list.push(b);
  }
  function drop() { const b = list.pop(); game.scene.remove(b.m); b.m.material.dispose(); }
  const size = () => LAB.get('spawn.size') ?? 1;
  function step(dt) {
    if (!dt) return;
    const g = 24 * (LAB.get('world.solidGravity') ?? 1), bounce = LAB.get('spawn.bounce') ?? 0.6, kick = LAB.get('spawn.kick') ?? 1, sz = size();
    const parts = game.demon.alive ? game.demonParts() : [];
    for (const b of list) {
      const r = b.r * sz;
      b.v.y -= g * dt; b.p.addScaledVector(b.v, dt);
      if (b.p.y < r) { b.p.y = r; if (b.v.y < 0) b.v.y = -b.v.y * bounce; if (b.v.y < 0.6) b.v.y = 0; const f = Math.exp(-2.5 * dt); b.v.x *= f; b.v.z *= f; b.w.multiplyScalar(Math.exp(-2 * dt)); }
      // wizards kick them, faster wizards kick harder
      for (const W of game.ALL) {
        const dx = b.p.x - W.pos.x, dz = b.p.z - W.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.55 + r && b.p.y < W.y + 1.7 && d > 0.001) {
          const sp = Math.hypot(W.vel.x, W.vel.z), pw = (2.5 + sp * 0.9) * kick;
          b.v.x = dx / d * pw + W.vel.x * 0.5; b.v.z = dz / d * pw + W.vel.z * 0.5; b.v.y = Math.max(b.v.y, (2 + sp * 0.4) * kick);
          b.p.x = W.pos.x + dx / d * (0.56 + r); b.p.z = W.pos.z + dz / d * (0.56 + r);
          b.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14);
        }
      }
      // the demon and the real solid push them away
      for (const q of parts) bounceOff(b, r, tmp.set(q.x, q.y, q.z), q.r);
      bounceOff(b, r, game.orb.p, game.solid.circ * 0.7);
      b.m.position.copy(b.p); b.m.scale.setScalar(sz);
      b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
      // too far away: drop back in near you
      if (Math.hypot(b.p.x - game.player.pos.x, b.p.z - game.player.pos.z) > 70) { b.p.set(game.player.pos.x + (Math.random() - 0.5) * 10, 14, game.player.pos.z + (Math.random() - 0.5) * 10); b.v.set(0, 0, 0); }
    }
    // and each other
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], c = list[j], rr = (a.r + c.r) * sz;
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
    { id: 'kick', label: 'Kick strength', help: 'How far you knock them', min: 0, max: 3, step: 0.1, value: 1 }
  ];
});
