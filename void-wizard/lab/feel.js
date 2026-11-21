// Lab shelf: Feel. How hits land: the screen shake and a short freeze on contact.
//   Shake: how strong every shake is (0 is none), its style and how long it lasts.
//     SHAKE is the game's own jitter; PUNCH kicks the view one way and springs back; ROLL rocks the view side to side;
//     WOBBLE sways smoothly, like a camera on a boat.
//   Hit freeze: the game all but stops for a moment when the Solid hits the centipede; bigger hits hold longer.
// With everything at its start value the game shakes exactly as before (the game's own code runs).
LAB.shelf('feel', 'Feel', (game) => {
  const T = game.THREE, get = (id, n) => LAB.get('feel.' + id) ?? n;
  const dir = new T.Vector3(), side = new T.Vector3();
  let prev = 0, kickT = 9, kickA = 0, roll = 0, t = 0;
  const isOn = () => get('strength', 1) !== 1 || get('style', 0) !== 0 || get('length', 1) !== 1;
  // the game hands over the camera and how much shake is left; this moves the camera and returns what's left after dt
  function shake(cam, s, dt) {
    const k = get('strength', 1), style = get('style', 0), rate = 9 / get('length', 1);
    t += dt;
    if (s > prev + 0.01) { kickT = 0; kickA = s; const a = Math.random() * Math.PI * 2; dir.set(Math.cos(a), Math.sin(a) * 0.6, 0); }   // a new hit
    kickT += dt;
    const e = s * k;
    if (e > 0.002) {
      cam.getWorldDirection(side); side.cross(cam.up).normalize();   // the camera's own right
      if (style === 0) { cam.position.x += (Math.random() - 0.5) * e * 2.5; cam.position.y += (Math.random() - 0.5) * e * 2.5; }
      else if (style === 1) {   // punch: one push, a springy return
        const p = Math.exp(-7 * kickT) * Math.cos(kickT * 26) * kickA * k * 3;
        cam.position.addScaledVector(side, dir.x * p); cam.position.y += dir.y * p;
      } else if (style === 2) roll = Math.sin(t * 34) * e * 0.35;   // roll: turned in the camera hook below
      else { cam.position.addScaledVector(side, Math.sin(t * 7.3) * e * 1.6); cam.position.y += Math.sin(t * 5.1 + 1.3) * e * 1.2; }
    }
    if (style !== 2 || e <= 0.002) roll = 0;
    const left = s > 0.002 ? s * Math.exp(-rate * dt) : 0;
    prev = left; return left;
  }
  window.FEATURES.on('camera', (cam) => { if (roll) cam.rotateZ(roll); }, 'lab');
  const hook = () => { game.shakeHook = isOn() ? shake : null; if (!game.shakeHook) roll = 0; };

  // hit freeze: slow the game's clock almost to a stop for a moment of real time, then give it back
  let until = 0, frozen = false;
  const now = () => performance.now() / 1000;
  window.FEATURES.on('demonHit', (dmg) => {
    const f = get('freeze', 0); if (!f) return;
    const hold = f * Math.min(1.5, Math.max(0.35, (dmg || 20) / 30)) * (game.orb.labSuper ? 2 : 1);
    frozen = true; LAB.hitstop = 0.03;   // on top of any other speed (a rule's slow-mo, the Time shelf)
    until = Math.max(until, now() + hold);
  }, 'lab');
  window.FEATURES.on('frame', () => { if (frozen && now() >= until) { LAB.hitstop = 1; frozen = false; } }, 'lab');

  return [
    { id: 'strength', label: 'Shake', help: 'How strong every shake is; 0 is none', min: 0, max: 3, step: 0.1, value: 1, dice: true, apply: hook,
      fmt: (v) => (v ? Math.round(v * 100) + '%' : 'OFF') },
    { id: 'style', label: 'Shake style', help: 'Shake: the jitter. Punch: a kick that springs back. Roll: rocks side to side. Wobble: a smooth sway',
      min: 0, max: 3, step: 1, value: 0, dice: true, apply: hook, fmt: (v) => ['SHAKE', 'PUNCH', 'ROLL', 'WOBBLE'][v] },
    { id: 'length', label: 'Shake length', help: 'How long a shake lasts', min: 0.3, max: 3, step: 0.1, value: 1, dice: true, apply: hook, fmt: (v) => v.toFixed(1) + '×' },
    { id: 'freeze', label: 'Hit freeze', help: 'The game stops for a moment when the Solid hits the centipede (seconds, for an ordinary hit)',
      min: 0, max: 0.3, step: 0.02, value: 0, dice: true, fmt: (v) => (v ? v.toFixed(2) + ' S' : 'OFF') }
  ];
});
