// Lab shelf: Throws. How the solid flies once it leaves your hands.
LAB.shelf('throws', 'Throws', (game) => {
  const T = game.THREE, to = new T.Vector3();
  // homing: a thrown solid curves toward the demon's head, as long as the demon is roughly ahead of it
  // (so passes to your buddy still go to your buddy)
  function home(dt, v) {
    const o = game.orb;
    if (o.state !== 'air' || o.touched || !o.last || !game.demon.alive || (game.DUEL && !game.PARTY)) return;
    const parts = game.demonParts(); if (!parts.length) return;
    to.set(parts[0].x - o.p.x, parts[0].y - o.p.y, parts[0].z - o.p.z);
    const sp = Math.hypot(o.v.x, o.v.z), d = Math.hypot(to.x, to.z);
    if (sp < 1 || d < 0.3) return;
    const cone = Math.cos((LAB.get('throws.cone') ?? 60) * Math.PI / 180);
    if ((o.v.x * to.x + o.v.z * to.z) / (sp * d) < cone) return;
    // turn the flat part of the velocity toward the head, keeping its speed
    const a = Math.atan2(o.v.x, o.v.z), b = Math.atan2(to.x, to.z);
    let dd = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const turn = Math.max(-v * 3 * dt, Math.min(v * 3 * dt, dd)), na = a + turn;
    o.v.x = Math.sin(na) * sp; o.v.z = Math.cos(na) * sp;
    // and ease the height toward the head, so it doesn't sail over
    const t = d / sp, want = (to.y + 0.5 * 24 * game.solid.grav * t * t) / Math.max(t, 0.05);
    o.v.y += (want - o.v.y) * Math.min(1, v * 0.8 * dt);
  }
  // spiral: a thrown solid flies point first, spinning around its line of flight like a football, instead of
  // tumbling end over end (a tumbling tetrahedron's corners swing about so much it looks like it's veering)
  const q = new T.Quaternion(), qs = new T.Quaternion(), fwd = new T.Vector3(), tip = new T.Vector3();
  let roll = 0;
  function spiral(dt, x) {
    const o = game.orb, S = game.solid;
    if (o.state !== 'air' || o.touched || (x === 1 && S !== game.SOLIDS[0])) return;
    const sp = Math.hypot(o.v.x, o.v.y, o.v.z); if (sp < 1) return;
    fwd.copy(o.v).divideScalar(sp);
    tip.copy(S.verts[0]).normalize();
    roll += dt * 16;
    q.setFromUnitVectors(tip, fwd); qs.setFromAxisAngle(fwd, roll);
    S.g.parent.quaternion.copy(q).premultiply(qs);   // the solid's spinning holder (the game turns it by orb.w)
    o.w.copy(fwd).multiplyScalar(16);   // spinning about the flight line, so a landing carries on from it
  }
  return [
    { id: 'spiral', label: 'Spiral throws', help: 'Thrown solids fly point first, spinning like a football, so they read as flying straight', min: 0, max: 2, step: 1, value: 0,
      fmt: (x) => ['OFF', 'TETRAHEDRON', 'ALL SOLIDS'][x], frame: spiral },
    { id: 'homing', label: 'Homing', help: 'Throws curve toward the demon', min: 0, max: 3, step: 0.1, value: 0, frame: home },
    { id: 'cone', label: 'Homing reach', help: 'How far off target it still homes (degrees)', min: 10, max: 180, step: 10, value: 60, fmt: (v) => v + '°' }
  ];
});
