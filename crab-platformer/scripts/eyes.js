// ---- eyes ----
// levels: an eye placed in the Studio waits at its spot (h pixels above the sand) until the crab comes near
function placeEye(p, c) {
  eyes.push({ c, oid: p.obj, x: p.x, y: GROUND - p.h, vx: 0, hy: GROUND - p.h, homeX: p.x, homeY: GROUND - p.h,
    pref: (Math.random() < 0.5 ? -1 : 1) * rnd(34, Math.max(44, VW / 2 - 20)), hp: c.hp, st: 'float', t: 0, timer: rnd(...c.firstShotFrames),
    ax: 0, ay: 1, flash: 0, lx: 0, ly: 0, squint: 0, phase: rnd(0, 6), scale: 1, melt: 0, vy: 0, blink: 0, blinkIn: rnd(30, 160) });
}
function spawnEye() {
  const side = Math.random() < S.spawning.aheadChance ? crab.face : -crab.face;
  const x = crab.x + side * (VW / 2 + 26);
  eyes.push({ c: EYE_DEFAULT, x, y: GROUND - rnd(...S.eyes.spawnHeight), vx: -side * 0.8, hy: GROUND - rnd(...S.eyes.hoverHeight),
    pref: side * rnd(34, Math.max(44, VW / 2 - 20)), hp: EYE_HP, st: 'float', t: 0, timer: rnd(...S.eyes.firstShotFrames),
    ax: 0, ay: 1, flash: 0, lx: 0, ly: 0, squint: 0, phase: rnd(0, 6), scale: 1, melt: 0, vy: 0, blink: 0, blinkIn: rnd(30, 160) });
}
function hurtCrab(srcX) {
  if (crab.invuln > 0 || crab.dead) return;
  crab.hp--; if (window.crabLogicFire) crabLogicFire('hurt'); crab.invuln = P.hurtInvulnFrames; crab.stun = P.hurtStunFrames; shake = 8;
  crab.vx = Math.sign(crab.x - srcX || 1) * P.knockback; crab.vy = -P.knockbackUp; crab.onGround = false;
  splash(crab.x, crab.y - 8, 5, RED);
  sfx.hurt(); rumble(260, 0.9, 0.6);
  if (crab.hp <= 0) { crab.dead = true; overT = 0; sfx.over(); for (let i = 0; i < 14; i++) splash(crab.x, crab.y - 8, 1, i % 2 ? RED : YEL); if (window.crabLogicFire) crabLogicFire('dies'); }
}
function beamLen(e) { return e.ay > 0.02 ? Math.min(600, (GROUND - e.y) / e.ay) : 600; }
function segDist(px, py, x0, y0, dx, dy, len) {
  const k = Math.max(0, Math.min(len, (px - x0) * dx + (py - y0) * dy));
  return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k));
}

// the dangling optic nerve: a little rope of points with gravity and inertia, pinned under the eye
// The nerve swims behind the eye like a flagellum. It always comes off the back of the eye, opposite the pupil
// (away from whatever the eye is looking or aiming at), and its points have inertia so it lags and trails.
function updateRope(e) {
  const N = 7, SEG = 1.8;
  const vx = e.x - (e.lastX ?? e.x), vy = e.y - (e.lastY ?? e.y), sp = Math.hypot(vx, vy);
  e.lastX = e.x; e.lastY = e.y;
  // direction the tail points: straight away from where the pupil is looking
  const aiming = e.st === 'charge' || e.st === 'fire';
  let lx = aiming ? e.ax : crab.x - e.x, ly = aiming ? e.ay : crab.y - 8 - e.y;
  const ll = Math.hypot(lx, ly);
  const tx = ll > 1 ? -lx / ll : 0, ty = ll > 1 ? -ly / ll : 1;
  e.tdx = (e.tdx ?? tx) + (tx - (e.tdx ?? tx)) * 0.06;
  e.tdy = (e.tdy ?? ty) + (ty - (e.tdy ?? ty)) * 0.06;
  const dl = Math.hypot(e.tdx, e.tdy) || 1, dx = e.tdx / dl, dy = e.tdy / dl;
  e.speed = (e.speed ?? 0) * 0.9 + sp * 0.1;
  e.wave = (e.wave ?? 0) + 0.055 + Math.min(0.05, e.speed * 0.06);
  const ax = e.x + dx * 6, ay = e.y + dy * 6;          // attached on the rim, on the trailing side
  if (!e.rope) e.rope = Array.from({ length: N }, (_, i) => ({ x: ax + dx * i * SEG, y: ay + dy * i * SEG, px: ax + dx * i * SEG, py: ay + dy * i * SEG }));
  const R = e.rope;
  R[0].x = ax; R[0].y = ay; R[0].px = ax; R[0].py = ay;
  for (let i = 1; i < R.length; i++) {
    const p = R[i], ivx = (p.x - p.px) * 0.86, ivy = (p.y - p.py) * 0.86;
    p.px = p.x; p.py = p.y;
    // gently steered toward a straight streamer behind the eye, plus a little gravity
    const gx = ax + dx * i * SEG, gy = ay + dy * i * SEG;
    p.x += ivx + (gx - p.x) * 0.06; p.y += ivy + (gy - p.y) * 0.06 + 0.03;
  }
  for (let it = 0; it < 4; it++) for (let i = 1; i < R.length; i++) {
    const a = R[i - 1], b = R[i], ddx = b.x - a.x, ddy = b.y - a.y, d = Math.hypot(ddx, ddy) || 0.001, diff = (d - SEG) / d;
    if (i === 1) { b.x -= ddx * diff; b.y -= ddy * diff; }
    else { a.x += ddx * diff * 0.5; a.y += ddy * diff * 0.5; b.x -= ddx * diff * 0.5; b.y -= ddy * diff * 0.5; }
  }
}
const BLINK_LEN = 10;
function updateEyes() {
  if (LEVEL) { if (!eyesPlaced) { eyesPlaced = true; for (const p of LEVEL_THINGS) { const o = objOf(p); if (o.base === 'eye') placeEye(p, { ...EYE_DEFAULT, ...(o.settings || {}) }); } } }
  else {
  const want = Math.min(1 + Math.floor(kills / S.spawning.oneMorePerKills), S.spawning.maxAlive);
  const alive = eyes.filter(e => e.st !== 'dying').length;
  if (!crab.dead && alive < want && --spawnT <= 0) { spawnEye(); spawnT = rnd(...S.spawning.intervalFrames); }
  }

  for (const e of eyes) {
    e.t++;
    if (e.flash > 0) e.flash--;
    if (e.shakeT > 0) e.shakeT--;
    if (e.openT > 0) e.openT--;
    if (e.pain > 0) {
      e.pain--;
      if (e.pain < 46 && e.pain % 13 === 0 && e.st !== 'dying') {   // tears from the corner of the eye
        const side = (e.pain >> 4) % 2 ? 1 : -1;
        parts.push({ kind: 'tear', x: e.x + side * 5, y: e.y + 3, vx: side * rnd(0.15, 0.4), vy: rnd(-0.3, 0), life: 160 });
      }
    }
    updateRope(e);
    if (e.blink > 0) e.blink--;
    else if (e.st === 'float' && !(e.openT > 0) && --e.blinkIn <= 0) { e.blink = BLINK_LEN; e.blinkIn = Math.random() < 0.25 ? 14 : rnd(90, 240); }   // sometimes a quick double blink
    const cxr = crab.x, cyr = crab.y - 8;
    if (e.st === 'dying') {
      // shrink, then melt and drip down onto the sand
      if (e.t < 26) { e.scale = 1 - (e.t / 26) * 0.5; e.y += Math.sin(e.t * 0.9) * 0.3; }
      else {
        e.melt = Math.min(1, (e.t - 26) / 30);
        e.vy = Math.min(e.vy + 0.08, 2.2); e.y += e.vy;
        if (e.t % 3 === 0) parts.push({ kind: 'goo', x: e.x + rnd(-2, 2), y: e.y + 3, vx: rnd(-.2, .2), vy: rnd(.3, .8), life: 80, color: e.t % 2 ? PINK : RED });
        if (e.y >= GROUND - 4) {
          e.gone = true;
          parts.push({ kind: 'puddle', x: e.x, w: 4, life: 220, max: 220 });
          splash(e.x, GROUND - 1, 4, RED);
        }
      }
      continue;
    }
    // drift toward a spot near the crab, bobbing as it floats
    const asleep = e.homeX !== undefined && Math.abs(crab.x - e.homeX) > S.level.wakeRange;
    const tx = asleep ? e.homeX : crab.x + e.pref;
    e.vx += (tx - e.x) * e.c.driftPull; e.vx *= e.c.driftDamping;
    e.x += e.vx;
    const by = e.hy + Math.sin(e.t * 0.05 + e.phase) * 3;
    e.y += (by - e.y) * 0.08;
    // pupil follows the crab
    const dx = cxr - e.x, dy = cyr - e.y, d = Math.hypot(dx, dy) || 1;
    e.lx = Math.round(dx / d * 2); e.ly = Math.round(dy / d * 2);

    if (e.st === 'float') {
      e.squint = Math.max(0, e.squint - 0.08);
      if (--e.timer <= 0 && onScreen(e.x, -8) && !crab.dead && !asleep) { e.st = 'charge'; e.t = 0; sfx.charge(); }
    } else if (e.st === 'charge') {
      if (e.t < e.c.aimLockFrames) { e.ax = dx / d; e.ay = dy / d; }
      e.squint = Math.min(0.55, e.t / e.c.chargeFrames * 0.7);
      if (e.t > e.c.aimLockFrames) e.x += (e.t % 2 ? 1 : -1) * 0.5;   // shiver right before firing
      if (e.t % 2 === 0) {
        const a = rnd(0, Math.PI * 2), r = rnd(10, 14);
        parts.push({ kind: 'charge', x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, tx: e.x, ty: e.y, ang: a, rad: r, eye: e, life: 14, max: 14 });
      }
      if (e.t >= e.c.chargeFrames) {
        e.st = 'fire'; e.t = 0; e.squint = 0; sfx.laser();
        if (onScreen(e.x, 20)) { shake = Math.max(shake, 8); rumble(180, 0.45, 0.5); }
        // energy bursting off the eye as it fires
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2 + rnd(-.15, .15), sp = rnd(1.4, 3);
          parts.push({ kind: 'ember', x: e.x + Math.cos(a) * 8, y: e.y + Math.sin(a) * 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18 + (Math.random() * 8 | 0), max: 26 });
        }
      }
    } else if (e.st === 'fire') {
      const len = beamLen(e);
      if (segDist(cxr, cyr, e.x, e.y, e.ax, e.ay, len) < e.c.beamRadius) hurtCrab(e.x);
      if (e.ay > 0.02 && len < 590 && e.t % 2 === 0) {
        const hx = e.x + e.ax * len;
        parts.push({ kind: 'spark', x: hx, y: GROUND - 2, vx: rnd(-1.2, 1.2), vy: rnd(-1.6, -.4), life: 16, max: 16 });
        parts.push({ kind: 'scorch', x: hx, life: 90, max: 90 });
      }
      const kick = e.t < 4 ? 1.6 : 0.3; e.x -= e.ax * kick; e.y -= e.ay * kick;   // big kick back as it fires, then a steady push
      for (let k = 0; k < 2; k++) {
        const a = Math.atan2(-e.ay, -e.ax) + rnd(-0.9, 0.9);
        parts.push({ kind: 'ember', x: e.x + Math.cos(a) * 7, y: e.y + Math.sin(a) * 7, vx: Math.cos(a) * rnd(0.8, 1.8), vy: Math.sin(a) * rnd(0.8, 1.8), life: 12, max: 12 });
      }
      if (e.t === e.c.fireFrames - 8) e.shakeT = 22;
      if (e.t >= e.c.fireFrames) e.openT = 24;
      if (e.t >= e.c.fireFrames) { e.st = 'float'; e.t = 0; e.timer = rnd(...e.c.restFrames); e.hy = GROUND - rnd(...e.c.hoverHeight); e.pref = (Math.random() < .5 ? -1 : 1) * rnd(34, Math.max(44, VW / 2 - 20)); }
    }
    // bumping into an eye hurts
    if (Math.hypot(cxr - e.x, cyr - e.y) < e.c.contactRadius) hurtCrab(e.x);
  }
  eyes = eyes.filter(e => !e.gone && (e.homeX !== undefined || Math.abs(e.x - crab.x) < 600));
}
