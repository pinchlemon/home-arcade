// juice bursting out of the squeezed lemon: no outlines, just a bright splash that fans out and breaks up
const RAYS = [-1.1, -0.72, -0.36, 0, 0.36, 0.72, 1.05];
function drawBurst(side, age, x, y) {
  const [lx, ly, rx, ry] = TIPS[pose.key] || TIPS['2,0'];
  let tx, ty;
  if (!pose.flip) [tx, ty] = side < 0 ? [lx, ly] : [rx, ry];
  else [tx, ty] = side < 0 ? [47 - rx, ry] : [47 - lx, ly];
  const bx = x + tx, by = y + ty;
  const dot = (c, px, py) => { ctx.fillStyle = c; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); };
  if (age < 3) {
    dot(JUICE, bx + side, by - 1); dot(JUICE, bx + side, by + 1); dot(JUICE, bx + side * 2, by);
    dot(JUICE_HI, bx + side, by);
    if (age > 0) { dot(JUICE, bx + side * 3, by - 1); dot(JUICE_HI, bx + side * 3, by + 1); }
    return;
  }
  RAYS.forEach((a, i) => {
    const ang = a - 0.2, dx = Math.cos(ang) * side, dy = Math.sin(ang);
    if (age < 8) {
      const r0 = 1 + (age - 3) * 1.1, r1 = r0 + (age < 6 ? 4 : 2);
      for (let r = r0; r <= r1; r += 1) dot(r >= r1 - 0.5 ? JUICE_HI : (i > 3 ? JUICE_DK : JUICE), bx + dx * r, by + dy * r);
    } else if ((i + age) % 2 === 0 || age < 11) {
      const r = 5 + (age - 3) * 1.2;
      dot(age < 11 ? JUICE : JUICE_HI, bx + dx * r, by + dy * r + (age - 8) * 0.5);
    }
  });
}
