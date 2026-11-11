// Lab shelf: Party. Passing like a sports game: passes go to the teammate you face, control jumps to whoever the pass
// is for (or whoever gets the Solid), and catching can be automatic. The game does the work (game.js passTarget,
// swapTo, MOD.passCone/passSpeed/autoCatch); this shelf sets it and marks who you are.
LAB.shelf('party', 'Party', (game) => {
  const T = game.THREE, MOD = game.MOD;
  const CONES = [2, 0.8, 0.5, -1.01];   // off, about 37°, 60°, anywhere (still the one you face most)
  // switching: 1 when you pass, 2 also whenever a teammate gets the Solid
  window.FEATURES.on('pass', (W, to) => { if ((LAB.get('party.switch') ?? 0) >= 1 && W && W.human) game.swapTo(to); }, 'lab');
  window.FEATURES.on('catch', (W) => { if ((LAB.get('party.switch') ?? 0) >= 2 && W && !W.human) game.swapTo(W); }, 'lab');
  // a ring over the wizard you control, while control can move between wizards
  // (made on first use: three.js gives every new object an id from Math.random, so making it early would change the demon's moves)
  let mark = null, pop = 0;
  function made() {
    if (!mark) { mark = new T.Mesh(new T.TorusGeometry(0.2, 0.035, 6, 24), new T.MeshBasicMaterial({ color: 0xffd23f })); mark.rotation.x = Math.PI / 2; game.scene.add(mark); }
    return mark;
  }
  window.FEATURES.on('swap', () => { pop = 1; }, 'lab');
  function marker(dt, v) {
    const W = game.you, mark = made(); pop = Math.max(0, pop - dt * 3);
    mark.visible = !!v; mark.position.set(W.pos.x, W.y + 1.75 * W.root.scale.y + Math.sin(performance.now() / 300) * 0.05, W.pos.z);
    mark.scale.setScalar(1 + pop * 1.2);
  }
  return [
    { id: 'aim', label: 'Pass help', help: 'A standing throw goes to the teammate you face, leading them', min: 0, max: 3, step: 1, value: 0, dice: false,
      fmt: (x) => ['OFF', 'A LITTLE', 'LOTS', 'ANY WAY'][x], apply: (x) => { MOD.passCone = CONES[x]; } },
    { id: 'passSpeed', label: 'Pass speed', help: 'Helped passes fly flatter and faster', min: 0.5, max: 2.5, step: 0.1, value: 1, apply: (x) => { MOD.passSpeed = x; } },
    { id: 'autoCatch', label: 'Auto catch', help: 'You catch the Solid without pressing anything', kind: 'onoff', value: 0, dice: false, apply: (x) => { MOD.autoCatch = x; } },
    { id: 'switch', label: 'Switch to', help: (x) => ['You always play the same wizard', 'You take over whoever you pass to', 'You always play whoever has the Solid'][x],
      min: 0, max: 2, step: 1, value: 0, dice: false, fmt: (x) => ['OFF', 'WHO YOU PASS TO', 'WHOEVER HAS IT'][x],
      apply: (x) => { if (!x && mark) mark.visible = false; }, frame: marker }
  ];
});
