function render() {
  const cx = camX;
  ctx.fillStyle = SKY; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(shake ? ((shake >> 1) % 2) : 0, OY);   // a slow 1px jolt, not a per-frame jitter
  drawBackdrop(cx);

  // things lying on the sand
  for (const p of parts) {
    const px = Math.round(p.x - cx);
    if (p.kind === 'stain' || p.kind === 'scorch') {
      if (p.life < 40 && (px + t) % 2) continue;
      ctx.fillStyle = p.kind === 'stain' ? JUICE : INK;
      ctx.fillRect(px - 1, GROUND - 1, p.kind === 'stain' ? p.w : 2, 1);
    } else if (p.kind === 'puddle') {
      const w = Math.round(p.w), x0 = px - (w >> 1);
      for (let i = 0; i < w; i++) {
        if (p.life < 60 && (i + t) % 2) continue;
        ctx.fillStyle = i === 0 || i === w - 1 ? INK : (i === w >> 1 || i === (w >> 1) - 1) ? PINK : RED;
        ctx.fillRect(x0 + i, GROUND - 2, 1, 2);
      }
    } else if (p.kind === 'dust') {
      if (p.life < 5 && t % 2) continue;
      ctx.fillStyle = CREAM; ctx.fillRect(px, Math.round(p.y), 2, 1);
    }
  }

  for (const e of eyes) if (e.st === 'charge') drawTelegraph(e, cx);
  for (const e of eyes) drawEye(e, cx);
  for (const e of eyes) if (e.st === 'fire') drawBeam(e, cx);

  if (sheet.complete && !(crab.dead && overT > 20) && !(crab.invuln > 0 && crab.invuln < 80 && t % 8 < 2 && !crab.dead)) {
    const recoil = crab.recoil > 0 ? -crab.snapSide * (crab.recoil > RECOIL_FRAMES - 2 ? 2 : 1) : 0;
    drawCrab(Math.round(crab.x) - cx - 24 + recoil, Math.round(crab.y) - 16);
  }

  for (const p of parts) {
    const px = Math.round(p.x - cx), py = Math.round(p.y);
    if (p.kind === 'spark') {
      const f = p.life / p.max;
      if (f > 0.5) sprite(SPARK, px - 1, py - 1);
      else if (f > 0.2) sprite(SPARK, px - 1, py - 1, false, (i, j) => (i + j + t) % 2 === 0);
      else if (t % 2) { ctx.fillStyle = YEL; ctx.fillRect(px, py, 1, 1); }
    } else if (p.kind === 'juice') {
      // short motion streak behind each droplet, with a flickering glint
      ctx.fillStyle = JUICE;
      ctx.fillRect(Math.round(p.x - p.vx * 0.7 - cx), Math.round(p.y - p.vy * 0.7), 1, 1);
      if (p.big) sprite(DROP, px - 1, py - 1);
      else { ctx.fillStyle = (t + p.idx) % 4 < 2 ? JUICE_HI : JUICE; ctx.fillRect(px, py, 1, 1); }
    } else if (p.kind === 'ember') {
      const f = p.life / p.max;
      if (f < 0.35 && (t + px) % 2) continue;
      ctx.fillStyle = f > 0.7 ? CREAM : f > 0.4 ? PINK : RED; ctx.fillRect(px, py, 1, 1);
      if (f > 0.6) { ctx.fillStyle = RED; ctx.fillRect(Math.round(px - p.vx), Math.round(py - p.vy), 1, 1); }
    } else if (p.kind === 'muzzle' || p.kind === 'ring') {
      // expanding burst: a cream-hot disc for the muzzle, a ring of sparks at the impact
      const k = p.max - p.life, rad = p.kind === 'muzzle' ? 3 + k : 2 + k * 1.2;
      for (let a = 0; a < 24; a++) {
        const ang = a / 24 * Math.PI * 2, rx = Math.round(px + Math.cos(ang) * rad), ry = Math.round(py + Math.sin(ang) * rad);
        if (p.kind === 'ring' && ry > py) continue;
        ctx.fillStyle = (a + k) % 2 ? INK : CREAM; ctx.fillRect(rx, ry, 1, 1);
      }
      if (p.kind === 'muzzle' && k < 4) { ctx.fillStyle = CREAM; ctx.fillRect(px - 2, py - 2, 5, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(px - 1, py - 1, 3, 3); }
    } else if (p.kind === 'flash') {
      // impact pop at the lemon tip
      const r = p.max - p.life + 1, s = p.side;
      ctx.fillStyle = p.life > 2 ? JUICE_HI : JUICE;
      for (const [dx, dy] of [[0, 0], [s, 0], [0, -1], [0, 1], [s * 2, 0], [s * r, -r], [s * r, r], [s * (r + 1), 0]]) ctx.fillRect(px + dx, py + dy, 1, 1);
    } else if (p.kind === 'seed') {
      if (p.life < 40 && t % 2) continue;
      ctx.fillStyle = CREAM; ctx.fillRect(px, py - 1, 2, 1);
      ctx.fillStyle = SHADE; ctx.fillRect(px, py, 2, 1);
    } else if (p.kind === 'pulp') {
      ctx.fillStyle = JUICE; ctx.fillRect(px, py, 2, 2);
      ctx.fillStyle = JUICE_HI; ctx.fillRect(px, py, 1, 1);
    } else if (p.kind === 'mist') {
      if ((p.life + px) % 3 === 0) continue;
      ctx.fillStyle = p.life > 7 ? JUICE_HI : JUICE; ctx.fillRect(px, py, 1, 1);
    } else if (p.kind === 'splash') {
      ctx.fillStyle = p.color; ctx.fillRect(px, py, 1, 1);
    } else if (p.kind === 'tear') {
      ctx.fillStyle = CREAM; ctx.fillRect(px, py - 1, 1, 1);
      ctx.fillStyle = TEAL; ctx.fillRect(px, py, 1, 1); ctx.fillRect(px - (p.vy > 1.2 ? 0 : 1), py + 1, p.vy > 1.2 ? 1 : 3, 1);
    } else if (p.kind === 'goo') {
      ctx.fillStyle = p.color; ctx.fillRect(px, py, 1, 2);
    } else if (p.kind === 'charge') {
      ctx.fillStyle = p.life % 2 ? RED : CREAM; ctx.fillRect(px, py, 1, 1);
    }
  }
  ctx.restore();

  // HUD: hearts (life points) and eyes melted
  for (let i = 0; i < LIFE; i++) sprite(i < crab.hp ? HEART : HEART_EMPTY, 4 + i * 8, 4);
  const score = String(kills);
  const sx = VW - 4 - score.length * 4 - 10;
  sprite(EYE_ICON, sx, 4);
  text(score, sx + 10, 5);

  if (paused) {
    const mid = VW >> 1, my = (VH >> 1) - 10;
    ctx.fillStyle = INK; ctx.fillRect(mid - 16, my - 4, 32, 13);
    ctx.fillStyle = CREAM; ctx.fillRect(mid - 15, my - 3, 30, 11);
    text('PAUSED', mid - 12, my, INK, null);
  }
  if (cleared && clearT > 20) {
    const mid = VW >> 1, my = (VH >> 1) - 10, last = SCENES.indexOf(SCENE) === SCENES.length - 1;
    const msg = last ? 'ALL CLEAR!' : 'LEVEL CLEAR!', w = msg.length * 4;
    ctx.fillStyle = INK; ctx.fillRect(mid - w / 2 - 6, my - 4, w + 12, 13);
    ctx.fillStyle = CREAM; ctx.fillRect(mid - w / 2 - 5, my - 3, w + 10, 11);
    text(msg, mid - w / 2 + 1, my, TEAL_DK, null);
    if (clearT > 60 && (t >> 4) % 2) text('PRESS JUMP', mid - 20, my + 14, INK, CREAM);
  }
  if (crab.dead && overT > 40) {
    const mid = VW >> 1, my = (VH >> 1) - 10;
    ctx.fillStyle = INK; ctx.fillRect(mid - 26, my - 4, 52, 13);
    ctx.fillStyle = CREAM; ctx.fillRect(mid - 25, my - 3, 50, 11);
    text('GAME OVER', mid - 18, my, RED, null);
    if (overT > 60 && (t >> 4) % 2) text('PRESS JUMP', mid - 20, my + 14, INK, CREAM);
  }
}
