// ---- juice ----
let squirtId = 0;
let pose = { key: '2,0', flip: false };
function lemonTip(side) {
  const [lx, ly, rx, ry] = TIPS[pose.key] || TIPS['2,0'];
  let x, y;
  if (!pose.flip) [x, y] = side < 0 ? [lx, ly] : [rx, ry];
  else [x, y] = side < 0 ? [47 - rx, ry] : [47 - lx, ly];
  return { x: crab.x - 24 + x + side, y: crab.y - 16 + y };
}
function startSquirt(side) {
  crab.squirt = { side, n: S.squirt.drops, i: 0, id: ++squirtId };
  shake = Math.max(shake, 3);
  const tip = lemonTip(side);
  parts.push({ kind: 'flash', x: tip.x + side * 2, y: tip.y, side, life: 4, max: 4 });
  // sometimes a lemon seed pops out too
  if (Math.random() < S.squirt.seedChance) parts.push({ kind: 'seed', x: tip.x, y: tip.y, vx: side * rnd(1.2, 2.2), vy: rnd(-2.4, -1.4), life: 160, max: 160, bounced: 0 });
}
function emitJuice() {
  const s = crab.squirt; if (!s) return;
  const side = s.side, tip = lemonTip(side), x = tip.x + side * 2, y = tip.y;
  // a hard spritz: a burst of droplets up front, then a trailing spray, plus mist and pulp
  const count = s.i < 3 ? 2 : 1;
  for (let c = 0; c < count; c++) {
    const big = (s.i + c) % 3 === 0;
    parts.push({ kind: 'juice', big, sid: s.id, idx: s.i, x, y, px: x, py: y,
      vx: side * (S.squirt.dropSpeed + rnd(0, 1.0) - s.i * 0.06) + crab.vx * 0.5, vy: -0.85 + rnd(-.6, .5) + crab.vy * 0.3, life: 200 });
  }
  if (s.i === 1 || s.i === 4) parts.push({ kind: 'pulp', x, y, vx: side * rnd(2.2, 3.2), vy: rnd(-1.6, -.6), life: 120, max: 120 });
  for (let i = 0; i < 3; i++) parts.push({ kind: 'mist', x: x + side * rnd(1, 4), y: y + rnd(-2, 2), vx: side * rnd(.8, 2.2), vy: rnd(-.8, .5), life: 10 + (Math.random() * 6 | 0), max: 16 });
  s.i++; if (--s.n <= 0) crab.squirt = null;
}
function splash(x, y, n = 3, color = JUICE) {
  for (let i = 0; i < n; i++) parts.push({ kind: 'splash', x, y, vx: rnd(-1, 1), vy: rnd(-1.4, -.4), life: 18, max: 18, color });
}
