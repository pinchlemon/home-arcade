function drawNerve(e, cx) {
  const R = e.rope; if (!R) return;
  const n = R.length - 1;
  // whip: a wave travels down the tail, sideways to it, quicker and bigger when the eye is swimming
  const amp = 1.6 + Math.min(0.8, (e.speed ?? 0) * 0.8);   // slow, lazy undulation (advanced in updateRope)
  const W = R.map((p, i) => {
    const a = R[Math.max(0, i - 1)], b = R[Math.min(n, i + 1)];
    let ux = b.x - a.x, uy = b.y - a.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const off = Math.sin(e.wave + e.phase - i * 1.1) * amp * (i / n) ** 1.1;
    return { x: p.x - uy * off, y: p.y + ux * off };
  });
  const pts = [];
  for (let i = 1; i < W.length; i++) {
    const a = W[i - 1], b = W[i], m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    const horiz = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
    for (let k = 0; k < m; k++) pts.push([Math.round(a.x + (b.x - a.x) * k / m - cx), Math.round(a.y + (b.y - a.y) * k / m), horiz]);
  }
  // outline on both sides of the tail
  ctx.fillStyle = INK;
  for (const [x, y, h] of pts) { if (h) { ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); } else { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); } }
  // red tail, in the eye's shadow where it attaches
  pts.forEach(([x, y], k) => { ctx.fillStyle = k < 2 ? INK : k < 4 && (x + y) % 2 ? INK : RED; ctx.fillRect(x, y, 1, 1); });
  // frayed nerve ending
  const tip = W[n], tx = Math.round(tip.x - cx), ty = Math.round(tip.y);
  ctx.fillStyle = INK; ctx.fillRect(tx - 1, ty - 1, 3, 3);
  ctx.fillStyle = RED; ctx.fillRect(tx, ty, 1, 1);
  ctx.fillStyle = PINK; ctx.fillRect(tx + Math.round(-R[n - 1].x + R[n].x), ty + Math.round(-R[n - 1].y + R[n].y), 1, 1);
}
// Eye: the project's eye shape, drawn 2px wider (same flat top and heavier black bottom),
// with its ringed pupil free to aim anywhere. Veins spread as it takes damage; it flushes red as it melts.
// the project's eye exactly: 14px across, flat top, heavier black at the bottom, and its ringed pupil
const EYE_ART = [
  "................",
  "......####......",
  "....##oooo##....",
  "...#oooooooo#...",
  "..#oooooooooo#..",
  "..#oooooooooo#..",
  ".#oooooooooooo#.",
  ".#oooooooooooo#.",
  ".#oooooooooooo#.",
  ".##oooooooooo##.",
  "..#oooooooooo#..",
  "..##oooooooo##..",
  "...###oooo###...",
  "....########....",
  "......####......",
  "................"
];
const EYE_W = EYE_ART[0].length, EYE_H = EYE_ART.length, ECX = 7.5, ECY = 7.5;
const PUPIL_SMALL = ["##", "##"];   // tiny pinpoint pupil when it's hurting
const EYE_PUPIL = [
  "..##..",
  ".#++#.",
  "#+#o+#",
  "#+##+#",
  ".#++#.",
  "..##.."
];
// veins every eye starts with (scattered around the rim, like the earlier eye)
const BASE_VEINS = [[2, 7], [3, 6], [3, 9], [3, 10], [12, 5], [13, 7], [12, 10], [11, 11], [7, 12], [9, 12]];
// extra vein branches grow in from the rim as damage builds up
const VEIN_BRANCHES = [3.3, 0.2, 2.5, 0.95, 4.1, 5.6, 1.6, 3.9].map((a, k) =>
  [[5.9, 0], [5.1, 0.09], [4.5, -0.08], [5.0, 0.25]].map(([r, da]) => [Math.round(ECX + Math.cos(a + da) * r), Math.round(ECY + Math.sin(a + da) * r)]));
const [eyeCv, eyeG] = (() => { const c = document.createElement('canvas'); c.width = EYE_W; c.height = EYE_H; return [c, c.getContext('2d')]; })();
function paintEye(e) {
  eyeG.clearRect(0, 0, EYE_W, EYE_H);
  const put = (c, x, y) => { eyeG.fillStyle = c; eyeG.fillRect(x, y, 1, 1); };
  const dying = e.st === 'dying';
  const dmg = dying ? 99 : Math.floor((EYE_HP - e.hp) * 6 / EYE_HP);   // 0 = healthy … 5 = nearly melted
  const red = dying ? Math.min(1, e.t / 14) : 0;                  // how far it has flushed red while melting
  const wince = !dying && e.flash > 0;
  // eyelids: 0 = wide open, 1 = shut. Blinks now and then, squints while charging, squeezes shut when juiced.
  // top and bottom lids move separately so the eye can glare (heavy top lid) while it fires
  let lidT = 0, lidB = 0;
  if (!dying) {
    if (e.blink > 0) lidT = lidB = Math.sin(Math.PI * (1 - e.blink / BLINK_LEN));
    if (e.st === 'charge') {
      if (e.t >= CHARGE - 6) { lidT = 0; lidB = 0; }                                       // eyes pop wide right before the shot
      else { const k = Math.min(1, e.t / (CHARGE * 0.3)); lidT = Math.max(lidT, 0.8 * k); lidB = Math.max(lidB, 0.8 * k); }   // a quick, hard squint
    }
    if (e.st === 'fire') { lidT = 0; lidB = 0; }                                 // wide open for the whole blast
    if (e.openT > 0) { lidT = 0; lidB = 0; }                                   // ...and for a moment after
    if (!wince && e.pain > 0 && e.st !== 'fire') {                                // in pain: pinched, twitching lids
      const tw = (t >> 2) % 3 === 0 ? 0.12 : 0;
      lidT = Math.max(lidT, 0.6 + tw); lidB = Math.max(lidB, 0.7);
    }
    if (wince) lidT = lidB = 1;
  }
  const lid = Math.max(lidT, lidB);
  // like a real eye, the top lid does most of the travel and they meet below the middle (around row 10)
  const topLid = Math.round(2 + lidT * 7.5), botLid = Math.round(12 - lidB * 2.4);   // rows of the white still showing
  // pupil aims at the crab, or along the laser while charging / firing
  const aiming = e.st === 'charge' || e.st === 'fire';
  let dx = aiming ? e.ax : crab.x - e.x, dy = aiming ? e.ay : crab.y - 8 - e.y;
  const d = Math.hypot(dx, dy) || 1, near = !aiming && d < 14;
  const ox = near ? 0 : Math.round(dx / d * 2.6), oy = near ? 0 : Math.round(dy / d * 2.2);
  const px0 = 5 + ox, py0 = 5 + oy;
  // veins (and any red or pink on the white) always stay at least a pixel away from the pupil
  const nearPupil = (x, y) => {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const r = EYE_PUPIL[y + j - py0]; if (r && r[x + i - px0] && r[x + i - px0] !== '.') return true;
    }
    return false;
  };
  const sclera = (x, y) => {
    if (red >= 1) return (x + y) % 5 === 0 ? PINK : RED;
    if (nearPupil(x, y)) return CREAM;
    if (red > 0 && ((x * 7 + y * 3) % 10) / 10 < red) return RED;
    if (dmg >= 4 && (x + y) % 3 === 0 && Math.hypot(x - ECX, y - ECY) > 4.3) return PINK;   // bloodshot
    return CREAM;
  };
  const veinOK = (x, y) => EYE_ART[y][x] === 'o' && (red >= 1 || !nearPupil(x, y));
  for (let y = 0; y < EYE_H; y++) for (let x = 0; x < EYE_W; x++) {
    const ch = EYE_ART[y][x];
    if (ch === '#') put(INK, x, y); else if (ch === 'o') put(sclera(x, y), x, y);
  }
  if (red < 1) {
    if (e.hp < EYE_HP) for (const [x, y] of BASE_VEINS) if (veinOK(x, y)) put(RED, x, y);   // fresh eyes are clean
    const branches = Math.min(VEIN_BRANCHES.length, dmg * 2), len = Math.min(4, 1 + dmg);
    for (let b = 0; b < branches; b++) VEIN_BRANCHES[b].slice(0, len).forEach(([x, y]) => { if (veinOK(x, y)) put(RED, x, y); });
  }
  if (red >= 1) return;
  const iris = e.st === 'fire' ? RED : e.st === 'charge' ? (((t >> (e.t > AIM_LOCK ? 1 : 2)) & 1) ? RED : PINK) : TEAL;
  const pained = e.pain > 0 && e.st !== 'fire' && e.st !== 'charge';
  const PUP = pained ? PUPIL_SMALL : EYE_PUPIL;
  const pj = pained ? [((t >> 1) % 3) - 1, 0] : [0, 0];
  const qx = pained ? px0 + 2 + pj[0] : px0, qy = pained ? py0 + 2 : py0;
  PUP.forEach((row, j) => [...row].forEach((ch, i) => {
    const x = qx + i, y = qy + j;
    if (ch === '.' || !EYE_ART[y] || EYE_ART[y][x] !== 'o' || y < topLid || y > botLid) return;
    put(ch === '#' ? INK : ch === '+' ? iris : CREAM, x, y);
  }));
  // eyelids over the top and bottom of the white, each with a dark lash line at its edge.
  // When the lids meet there is no white left, so they close on one single black line.
  const shut = botLid - topLid < 1;
  const seam = shut ? Math.min(11, Math.max(topLid, botLid + 1) - 1) : -1;
  if (lid > 0.02) for (let y = 0; y < EYE_H; y++) for (let x = 0; x < EYE_W; x++) {
    if (EYE_ART[y][x] !== 'o') continue;
    if (shut) put(y === seam ? INK : RED, x, y);
    else if (y < topLid) put(y === topLid - 1 ? INK : RED, x, y);
    else if (y > botLid) put(y === botLid + 1 ? INK : RED, x, y);
  }
}
function drawEye(e, cx) {
  const jit = e.shakeT > 0 ? ((t >> 1) % 2 ? 1 : -1) * (e.shakeT > 6 ? 1 : (t % 3 === 0 ? 1 : 0)) : 0;   // post-shot tremble
  const ouch = e.pain > 20 && e.st !== 'dying' ? (t % 2 ? 1 : -1) : e.pain > 0 && t % 4 === 0 ? 1 : 0;   // shaking in pain
  const x = Math.round(e.x - cx) + jit + ouch, y = Math.round(e.y) + (e.shakeT > 8 && t % 4 === 0 ? 1 : 0);
  const ex = x, ey = y;
  if (e.st === 'charge' && (e.t > AIM_LOCK || t % 2 === 0)) {          // glow ring tightening around the eye
    const rad = 13 - e.t / CHARGE * 3;
    for (let k = 0; k < 20; k++) {
      const a = k / 20 * Math.PI * 2 + t * 0.12;
      ctx.fillStyle = k % 2 ? RED : PINK; ctx.fillRect(Math.round(ex + Math.cos(a) * rad), Math.round(ey + Math.sin(a) * rad), 1, 1);
    }
  }
  if (e.st === 'fire' && e.t < 10) {                                     // shockwave pushing out from the eye
    const rad = 9 + e.t * 1.8;
    for (let k = 0; k < 30; k++) {
      if ((k + e.t) % 3 === 0) continue;
      const a = k / 30 * Math.PI * 2;
      ctx.fillStyle = k % 2 ? CREAM : RED; ctx.fillRect(Math.round(ex + Math.cos(a) * rad), Math.round(ey + Math.sin(a) * rad), 1, 1);
    }
  }
  if (e.st !== 'dying') drawNerve(e, cx);
  paintEye(e);
  if (e.st !== 'dying') { ctx.drawImage(eyeCv, x - 8, y - 8); return; }
  // melting: shrinks with a wobble, then squashes as it slides down, dripping red
  const s = e.scale, m = e.melt;
  const w = Math.max(2, Math.round(EYE_W * s * (1 + m * 0.9))), h = Math.max(1, Math.round(EYE_H * s * (1 - m * 0.8)));
  const bottom = y + Math.round(7 * s);
  ctx.drawImage(eyeCv, 0, 0, EYE_W, EYE_H, x - (w >> 1), bottom - h, w, h);
  if (m > 0) {
    for (const [ox, k, col] of [[-3, 0.9, RED], [-1, 1.4, PINK], [1, 0.7, RED], [3, 1.2, RED]]) {
      const len = Math.round(m * 5 * k + Math.sin(t * 0.3 + ox) * 0.6);
      const dx = x + Math.round(ox * w / 10);
      for (let i = 0; i < len; i++) { ctx.fillStyle = i === len - 1 ? INK : col; ctx.fillRect(dx, bottom + i, 1, 1); }
    }
  }
}
function drawBeam(e, cx) {
  const len = beamLen(e), thin = e.t < 3 || e.t > FIRE - 4;
  for (const pass of [0, 1]) for (let i = 6; i < len; i++) {
    const x = Math.round(e.x + e.ax * i - cx), y = Math.round(e.y + e.ay * i);
    if (x < -2 || x > VW + 2) continue;
    if (pass === 0) { ctx.fillStyle = (t >> 1) & 1 ? RED : PINK; thin ? ctx.fillRect(x, y, 1, 1) : ctx.fillRect(x - 1, y - 1, 3, 3); }
    else if (!thin) { ctx.fillStyle = CREAM; ctx.fillRect(x, y, 1, 1); }
  }
}
function drawTelegraph(e, cx) {
  if (t % 2) return;
  const reach = Math.min(beamLen(e), 30 + e.t * 3);
  ctx.fillStyle = e.t > AIM_LOCK ? RED : PINK;
  for (let i = 10; i < reach; i += 5) ctx.fillRect(Math.round(e.x + e.ax * i - cx), Math.round(e.y + e.ay * i), 1, 1);
}
