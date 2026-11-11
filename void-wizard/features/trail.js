// Sparkle trail (an example feature): while you run, sparks in the colour of the solid trail behind you.
feature('trail', ({ game, set, on }) => {
  const at = new game.THREE.Vector3(), v = new game.THREE.Vector3();
  let acc = 0;
  on('frame', (dt) => {
    const p = game.you || game.player, speed = Math.hypot(p.vel.x, p.vel.z);
    if (speed < 1 || p.downT > 0) { acc = 0; return; }
    acc += dt * set('rate', 40) * Math.min(1, speed / 8.5);
    while (acc >= 1) {
      acc--;
      at.set(p.pos.x - p.vel.x * 0.04 + (Math.random() - 0.5) * 0.4, p.y + 0.15 + Math.random() * 0.5, p.pos.z - p.vel.z * 0.04 + (Math.random() - 0.5) * 0.4);
      v.set(-p.vel.x * 0.1, set('rise', 0.6), -p.vel.z * 0.1);
      game.spark(at, v, set('life', 0.35), set('size', 0.5), game.solid.col, 2);
    }
  });
});
