// Lab shelf: Demon. How the centipede behaves and how it shows it's hurt.
LAB.shelf('demon', 'Demon', (game) => {
  const D = game.demon;
  // aggression: 1 is normal. Higher: shorter rests between attacks, shorter prowling, longer hunts, faster.
  // Lower: longer rests and slower; at 0 it never attacks.
  function rage(dt, a) {
    if (!D.alive || D.dying) return;
    if (a === 0) D.cd = Math.max(D.cd, 0.5);
    else if (a > 1) D.cd = Math.max(0, D.cd - dt * (a - 1) * 1.5);
    else D.cd += dt * (1 - a);
    if (D.state === 'walk') {
      if (D.mode === 'prowl') D.modeT -= dt * (a - 1) * 0.6;
      else if (D.mode === 'hunt') D.modeT += dt * (a - 1) * 0.3;
    }
    const k = 0.6 + 0.4 * a;   // 0.6 at 0, 1 at 1, 1.8 at 3
    if (D.state === 'walk' || D.state === 'recover') D.pos.addScaledVector(D.vel, dt * (k - 1));
  }
  // the whole centipede flashes white when it gets hit
  let mats = null, flashT = 0, flashing = false;
  function collect() {
    const seen = new Set(); mats = [];
    D.g.traverse(o => { const m = o.material; if (m && m.emissive && !seen.has(m)) { seen.add(m); mats.push({ m, base: m.emissive.clone() }); } });
  }
  window.FEATURES.on('demonHit', () => { if (LAB.get('demon.flash')) flashT = LAB.get('demon.flashLen') ?? 0.3; }, 'lab');
  const restore = () => { if (mats) for (const x of mats) x.m.emissive.copy(x.base); flashing = false; };
  function flash(dt, on, now) {
    if (!mats) collect();
    if (flashT > 0) {
      flashT -= dt;
      const lit = flashT > 0 && Math.floor(now * (LAB.get('demon.flashRate') ?? 12) * 2) % 2 === 0;
      for (const x of mats) if (lit) x.m.emissive.setRGB(1, 1, 1); else x.m.emissive.copy(x.base);
      flashing = true;
    } else if (flashing) restore();
  }
  return [
    { id: 'aggression', label: 'Aggression', help: '0 never attacks, 3 relentless', min: 0, max: 3, step: 0.1, value: 1, frame: rage },
    { id: 'flash', label: 'White flash', help: 'The whole centipede flashes when hit', kind: 'onoff', value: 0, dice: true, frame: flash, apply: (v) => { if (!v) { flashT = 0; restore(); } } },
    { id: 'flashLen', label: 'Flash length', help: 'Seconds it flashes for', min: 0.05, max: 1.5, step: 0.05, value: 0.3 },
    { id: 'flashRate', label: 'Flash speed', help: 'Flashes a second', min: 2, max: 30, step: 1, value: 12 }
  ];
});
