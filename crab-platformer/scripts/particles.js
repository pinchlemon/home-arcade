function updateParts() {
  for (const p of parts) {
    p.life--;
    if (p.kind === 'juice') {
      p.px = p.x; p.py = p.y;
      p.vy += 0.075; p.x += p.vx; p.y += p.vy;
      for (const e of eyes) {
        if (e.st === 'dying' || p.life <= 0) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < 8) {
          p.life = 0; splash(p.x, p.y, 3);
          e.hp--; e.flash = 8; e.pain = 52; e.vx += Math.sign(p.vx) * 0.5; e.squint = 1;
          if (e.st === 'charge' && e.hp <= e.c.hp / 2) { e.st = 'float'; e.timer = rnd(60, 110); }   // juice in the eye interrupts the charge
          sfx.eyeHit();
          if (e.hp <= 0) { e.st = 'dying'; e.t = 0; kills++; sfx.melt(); rumble(160, 0.2, 0.5); splash(e.x, e.y, 6, RED); }
        }
      }
      if (LEVEL && p.life > 0) juiceHitsActor(p);
      if (p.life > 0) for (const r of solidsNear(p.x, 0)) if (p.x >= r.x0 && p.x <= r.x1 && p.y >= r.top) { p.life = 0; splash(p.x, r.top - 1, 2); break; }
      if (p.life > 0 && p.y >= GROUND - 1) {
        p.life = 0; splash(p.x, GROUND - 1, 2);
        if (p.big) parts.push({ kind: 'stain', x: p.x, w: 2, life: 90, max: 90 });
      }
    } else if (p.kind === 'seed' || p.kind === 'pulp') {
      p.vy += 0.14; p.x += p.vx; p.y += p.vy;
      if (p.y >= GROUND - 1) {
        p.y = GROUND - 1;
        if (p.kind === 'pulp') { p.life = 0; splash(p.x, GROUND - 1, 2); }
        else if (p.bounced < 2) { p.vy *= -0.45; p.vx *= 0.6; p.bounced++; }
        else { p.vy = 0; p.vx = 0; }
      }
    } else if (p.kind === 'tear') {
      p.vy += 0.1; p.x += p.vx; p.y += p.vy; p.vx *= 0.97;
      if (p.y >= GROUND - 1) { p.life = 0; splash(p.x, GROUND - 1, 1, CREAM); }
    } else if (p.kind === 'goo') {
      p.vy += 0.1; p.x += p.vx; p.y += p.vy;
      if (p.y >= GROUND - 1) p.life = 0;
    } else if (p.kind === 'charge') {
      p.ang += 0.32; p.rad *= 0.84;                          // spiral in toward the eye
      p.x = p.eye.x + Math.cos(p.ang) * p.rad; p.y = p.eye.y + Math.sin(p.ang) * p.rad;
    } else if (p.kind === 'ember') {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9;
    } else if (p.kind === 'puddle') {
      p.w = Math.min(14, p.w + 0.5);
    } else if (p.vx !== undefined) {
      p.x += p.vx; p.y += p.vy;
      if (p.kind === 'spark' || p.kind === 'mist') { p.vx *= 0.92; p.vy *= 0.92; }
      if (p.kind === 'splash') { p.vy += 0.15; if (p.y > GROUND - 1) p.life = 0; }
    }
  }
  parts = parts.filter(p => p.life > 0);
}
