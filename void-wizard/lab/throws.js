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
  return [
    { id: 'homing', label: 'Homing', help: 'Throws curve toward the demon', min: 0, max: 3, step: 0.1, value: 0, frame: home },
    { id: 'cone', label: 'Homing reach', help: 'How far off target it still homes (degrees)', min: 10, max: 180, step: 10, value: 60, fmt: (v) => v + '°' }
  ];
});
