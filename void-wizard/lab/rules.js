// Lab shelves: Rules. "When this happens, then that, for so long." Four rules on two shelves, each three knobs.
// A rule changes other Lab knobs for a while (LAB.boost), so anything on a shelf can become the "then".
// To add a "when": an entry in WHEN (an event name from the game, or a test that runs every frame).
// To add a "then": an entry in THEN (knobs to change, or do() for something that happens once).
(() => {
  const game = LAB.game;
  const me = (W) => W && W.human;
  const WHEN = [
    ['OFF', 'Rule switched off'],
    ['CATCH', 'When you catch or pick up the solid', 'catch', me],
    ['THROW', 'When you throw', 'throw', me],
    ['JUMP', 'When you jump', 'jump', (W, air) => me(W) && !air],
    ['AIR JUMP', 'When you jump in the air', 'jump', (W, air) => me(W) && air],
    ['LAND', 'When you land', 'land', me],
    ['DIVE', 'When you dive', 'dive', me],
    ['TACKLE', 'When you tackle', 'tackle', me],
    ['KNOCKED', 'When you get knocked down', 'knockdown', me],
    ['DEMON HIT', 'When the demon is hit', 'demonHit', () => true],
    ['DEMON DOWN', 'When a demon is beaten', 'demonDown', () => true],
    ['EVERY 3S', 'Every three seconds', 'every'],
    ['HOLDING', 'While you hold the solid', null, () => game.orb.state === 'held' && game.orb.holder === game.player],
    ['IN AIR', 'While you are in the air', null, () => !game.player.grounded],
    ['RUNNING', 'While you run fast', null, () => Math.hypot(game.player.vel.x, game.player.vel.z) > 6.5]
  ];
  const near = (W, r) => game.ALL.filter(o => o !== W && Math.hypot(o.pos.x - W.pos.x, o.pos.z - W.pos.z) < r);
  const THEN = [
    ['NOTHING', 'Does nothing yet', {}],
    ['SLOW-MO', 'Slow motion', { 'time.speed': 0.35 }],
    ['FAST', 'Everything speeds up', { 'time.speed': 1.8 }],
    ['FREEZE', 'Everything holds still', { 'time.freeze': 1 }],
    ['FLOAT', 'Wizards and the solid float', { 'world.gravity': 0.25, 'world.solidGravity': 0.3 }],
    ['HEAVY', 'Everything falls hard', { 'world.gravity': 2.2, 'world.solidGravity': 2 }],
    ['BOUNCY', 'The solid barely stops bouncing', { 'world.bounce': 2.6 }],
    ['SPEED', 'Wizards run fast', { 'world.speed': 1.9 }],
    ['MOON JUMP', 'High jumps, jump again in the air', { 'world.jump': 1.7, 'world.endless': 1 }],
    ['GIANT', 'You grow huge', { 'bodies.wizard': 2.4 }],
    ['TINY', 'You shrink', { 'bodies.wizard': 0.4 }],
    ['DEMON TINY', 'The demon shrinks (and can not attack)', { 'bodies.demon': 0.35 }],
    ['CALM DEMON', 'The demon stops attacking', { 'demon.aggression': 0 }],
    ['MAD DEMON', 'The demon goes wild', { 'demon.aggression': 3 }],
    ['SOLID RAIN', 'Ten extra solids drop in', { 'spawn.count': () => Math.min(60, (LAB.base('spawn.count') || 0) + 10) }],
    ['HOMING', 'Throws home in on the demon', { 'throws.homing': 2.5 }],
    ['INVERT', 'Light and dark swap', { 'colour.invert': 1 }],
    ['HUE FLIP', 'Every colour turns around', { 'colour.hue': 180 }],
    ['KALEIDO', 'Kaleidoscope', { 'look.kaleido': 6 }],
    ['SWIRL', 'The middle twists', { 'look.swirl': 2 }],
    ['TUNNEL', 'Trails that fly out like a tunnel', { 'look.trails': 0.85, 'echo.zoom': 2.5, 'echo.spin': 1.5 }],
    ['GLITCH', 'The picture glitches', { 'echo.glitch': 0.7, 'look.split': 2 }],
    ['VOID', "Four colours from the solid's colour", { 'tone.palette': 7 }],
    ['GAME BOY', 'Game Boy greens', { 'tone.palette': 1, 'colour.dither': 0.6 }],
    ['UPSIDE DN', 'The camera turns upside down', { 'camera.tilt': 180 }],
    ['SPIN CAM', 'The camera spins', { 'camera.spin': 1.5 }],
    ['ZOOM IN', 'The camera moves in close', { 'camera.zoom': 1.8 }],
    ['SHOCKWAVE', 'Knocks everyone near you away (once)', null, (W) => {
      for (const o of near(W, 6)) { const dx = o.pos.x - W.pos.x, dz = o.pos.z - W.pos.z, d = Math.hypot(dx, dz) || 1; game.pushBack(o, dx / d, dz / d, 10); }
      game.fxRing(W.pos.x, W.pos.z, game.solid.col, 6, 0.45); game.shake(0.15); }],
    ['SHAKE', 'The screen shakes (once)', null, (W) => { game.shake(0.35); game.rumble(W, 0.6, 0.6, 200); }],
    ['SWAP', 'You and your buddy swap places (once)', null, () => {
      const a = game.player.pos.clone(); game.player.pos.copy(game.buddy.pos); game.buddy.pos.copy(a); game.spawnPuffs(8, 2, game.player.pos); game.spawnPuffs(8, 2, game.buddy.pos); }]
  ];
  const fire = (k, W) => {
    const then = THEN[LAB.get('rules.then' + k) || 0], sec = LAB.get('rules.for' + k) || 3;
    if (then[3]) { then[3](W || game.player); return; }
    for (const id in then[2]) { const x = then[2][id]; LAB.boost(id, typeof x === 'function' ? x() : x, sec); }
  };
  const whenOf = (k) => WHEN[LAB.get('rules.when' + k) || 0];
  // events from the game
  for (const name of ['catch', 'throw', 'jump', 'land', 'dive', 'tackle', 'knockdown', 'demonHit', 'demonDown'])
    window.FEATURES.on(name, (W, x) => { for (let k = 1; k <= 4; k++) { const w = whenOf(k); if (w[2] === name && w[3](W, x)) fire(k, W && W.pos ? W : null); } }, 'lab');
  // every frame: timers and "while" rules (instant ones fire as the "while" starts)
  const was = {}, timer = {};
  function tick(now) {
    for (let k = 1; k <= 4; k++) {
      const w = whenOf(k), then = THEN[LAB.get('rules.then' + k) || 0];
      if (w[2] === 'every') { if (!timer[k]) timer[k] = now; if (now - timer[k] >= 3) { timer[k] = now; fire(k); } continue; }
      timer[k] = 0;
      if (w[2] !== null || !w[3]) { was[k] = false; continue; }
      const on = w[3]();
      // a "while" rule keeps its change going, and lets it last its seconds after it stops; a once-only one fires as it starts
      if (on && (!then[3] || !was[k])) fire(k);
      was[k] = on;
    }
  }
  const rule = (k) => [
    { id: 'rules.when' + k, label: 'Rule ' + k + ': when', help: (v) => WHEN[v][1], min: 0, max: WHEN.length - 1, step: 1, value: 0, fmt: (v) => WHEN[v][0] },
    { id: 'rules.then' + k, label: 'Rule ' + k + ': then', help: (v) => THEN[v][1], min: 0, max: THEN.length - 1, step: 1, value: 0, fmt: (v) => THEN[v][0] },
    { id: 'rules.for' + k, label: 'Rule ' + k + ': for', help: 'Seconds it lasts (a "while" rule: after it stops)', min: 0.5, max: 10, step: 0.5, value: 3, dice: false, fmt: (v) => v + ' S' }
  ];
  // the timer and "while" rules need a frame hook that runs whenever any rule is on
  const any = () => [1, 2, 3, 4].some(k => (LAB.get('rules.when' + k) || 0) > 0);
  window.FEATURES.on('frame', () => { if (any()) tick(performance.now() / 1000); }, 'lab');
  LAB.shelf('rules', 'Rules 1 and 2', () => [...rule(1), ...rule(2)]);
  LAB.shelf('rules2', 'Rules 3 and 4', () => [...rule(3), ...rule(4)]);
})();
