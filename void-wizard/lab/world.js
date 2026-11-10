// Lab shelf: World. Gravity, bounce and how the wizards move.
LAB.shelf('world', 'World', (game) => {
  const was = game.SOLIDS.map(S => ({ grav: S.grav, rest: S.rest }));
  return [
    { id: 'gravity', label: 'Wizard gravity', help: 'How hard the wizards fall', min: 0.1, max: 3, step: 0.1, value: 1, apply: (v) => { game.MOD.gravity = v; } },
    { id: 'solidGravity', label: 'Solid gravity', help: 'How hard the solid falls', min: 0.1, max: 3, step: 0.1, value: 1, apply: (v) => game.SOLIDS.forEach((S, i) => { S.grav = was[i].grav * v; }) },
    { id: 'bounce', label: 'Solid bounce', help: 'Past 2 it barely loses height', min: 0, max: 3, step: 0.1, value: 1, apply: (v) => game.SOLIDS.forEach((S, i) => { S.rest = Math.min(0.98, was[i].rest * v); }) },
    { id: 'speed', label: 'Run speed', help: 'How fast the wizards move', min: 0.2, max: 3, step: 0.1, value: 1, apply: (v) => { game.MOD.speed = v; } },
    { id: 'jump', label: 'Jump', help: 'How high the wizards jump', min: 0.3, max: 3, step: 0.1, value: 1, apply: (v) => { game.MOD.jump = v; } },
    { id: 'endless', label: 'Endless jumps', help: 'Jump again in the air, forever', kind: 'onoff', value: 0, dice: true,
      frame: () => { for (const W of game.ALL) W.airJumps = 1; } },
    { id: 'safe', label: 'No knockdowns', help: 'Nobody gets knocked over', kind: 'onoff', value: 0, dice: true, apply: (v) => { game.MOD.knock = v ? 0 : 1; } }
  ];
});
