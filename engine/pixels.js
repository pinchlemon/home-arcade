// ---- drawing ----
function sprite(rows, x, y, flip = false, skip) {
  const w = rows[0].length;
  rows.forEach((row, j) => { for (let i = 0; i < w; i++) {
    const c = row[flip ? w - 1 - i : i];
    if (c === '.' || (skip && skip(i, j))) continue;
    ctx.fillStyle = COLS[c]; ctx.fillRect(x + i, y + j, 1, 1);
  } });
}
function text(str, x, y, color = INK, shadow = CREAM) {
  for (const pass of [shadow, color]) {
    let cx = x + (pass === shadow ? 1 : 0), cy = y + (pass === shadow ? 1 : 0);
    if (!pass) continue;
    for (const ch of str) {
      const g = FONT[ch]; if (g) g.forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') { ctx.fillStyle = pass; ctx.fillRect(cx + i, cy + j, 1, 1); } }));
      cx += 4;
    }
  }
}
