// Lab shelf: Bodies. Sizes. Wizards and the solid change how they look (their reach stays the same);
// the demon really grows or shrinks, and only attacks once it is full size.
LAB.shelf('bodies', 'Bodies', (game) => {
  const sizeOf = (W, v) => { if (!(W.capT > 0)) W.root.scale.setScalar(v); };
  const blue = game.player;
  return [
    { id: 'wizard', label: 'Your size', help: 'The wizard you start as', min: 0.3, max: 3, step: 0.1, value: 1,
      apply: (v) => sizeOf(blue, v), frame: (dt, v) => sizeOf(blue, v) },
    { id: 'buddy', label: 'Teammates\' size', help: 'Everyone else on your team', min: 0.3, max: 3, step: 0.1, value: 1,
      apply: (v) => { for (const W of game.ALL) if (W !== blue) sizeOf(W, v); }, frame: (dt, v) => { for (const W of game.ALL) if (W !== blue) sizeOf(W, v); } },   // every teammate, like Teammates' health
    { id: 'solid', label: 'Solid size', help: 'Looks only: it still bounces as normal', min: 0.3, max: 4, step: 0.1, value: 1,
      frame: (dt, v) => {
        const m = game.orbMesh, S = game.solid;
        m.scale.multiplyScalar(v);
        if (game.orb.state !== 'held') m.position.y += S.circ * S.inr * (v - 1);   // sit on the floor, not in it
      } },
    { id: 'demon', label: 'Demon size', help: 'Small demons never attack', min: 0.2, max: 3, step: 0.1, value: 1, apply: (v) => { game.MOD.demon = v; } }
  ];
});
