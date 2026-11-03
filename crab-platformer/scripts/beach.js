// ---------- backdrop: sky, clouds, city across the water, sea, and beach props ----------
const SEA = TEAL, SEA_DK = TEAL_DK, CITY = HAZE, CITY_DK = TEAL, CITY_WIN = SKY;
const PALM = TEAL_DK, PALM_DK = INK, TRUNK = YEL, TRUNK_DK = YEL_DK, SAND = YEL;
const HORIZON = 108;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = i => mulberry(i * 9973 + 17)();
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// The beach art is plain images now (assets/), so it can be redrawn in the Library.
// It used to be drawn by code at startup; these files hold exactly the pixels that code made.
const art = (file, done) => { const im = new Image(); im.onload = () => done && done(im); im.src = 'assets/' + file; return im; };
let ground = null, cloudR = null, cloudL = null;
art('sand.png', im => { ground = im; });
art('cloud.png', im => {
  let cctx; [cloudL, cctx] = mk(im.width, im.height); cctx.translate(im.width, 0); cctx.scale(-1, 1); cctx.drawImage(im, 0, 0);
  cloudR = im;   // the same cloud, flipped, for variety
});
const CITY_W = 512;
const cityC = art('city.png');
const palm = art('palm.png'), umb = art('umbrella.png'), castle = art('castle.png');
// sandcastle: solid, so the crab can stand on the towers and the wall (its standing spots are in game.json)
const CASTLE_W = S.beach.castle.width, CASTLE_H = S.beach.castle.height;
const CASTLE_SOLIDS = S.beach.castle.solids;
const PROPS = [palm, palm, umb, castle];
// props live in fixed slots along the beach; castles are kept away from the starting spot
const SLOT = S.beach.propSpacing;
function propAt(i) {
  const r = mulberry(i * 7919 + 3);
  if (r() < S.beach.emptyChance) return null;
  let img = PROPS[r() * PROPS.length | 0];
  const x = Math.round(i * SLOT + r() * (SLOT - (img === castle ? CASTLE_W : 26)));
  if (img === castle && Math.abs(x + CASTLE_W / 2 - P.startX) < S.beach.castleKeepAway) img = umb;
  return { img, x };
}
// levels: props are placed by hand in the Studio instead of by the scatter rule
const LEVEL_PROPS = LEVEL ? (LEVEL.props || []).map(p => ({ img: { palm, umbrella: umb, castle }[p.type], x: p.x, type: p.type })).filter(p => p.img) : null;
const PROP_W = { palm: 72, umbrella: 17, castle: CASTLE_W };
function solidsNear(wx, range = 120) {
  if (LEVEL_PROPS) {
    const out = [];
    for (const p of LEVEL_PROPS) if (p.img === castle && p.x + CASTLE_W >= wx - range && p.x <= wx + range)
      for (const s of CASTLE_SOLIDS) out.push({ x0: p.x + s.x0, x1: p.x + s.x1, top: GROUND + 1 - CASTLE_H + s.top });
    return out;
  }
  const out = [], i0 = Math.floor((wx - range - CASTLE_W) / SLOT), i1 = Math.floor((wx + range) / SLOT);
  for (let i = i0; i <= i1; i++) {
    const p = propAt(i);
    if (p && p.img === castle) for (const s of CASTLE_SOLIDS) out.push({ x0: p.x + s.x0, x1: p.x + s.x1, top: GROUND + 1 - CASTLE_H + s.top });
  }
  return out;
}
const STAR = ["..r..", "rrrrr", ".rpr.", "r...r"];
const SUN = ["..wwww..", ".wwwwww.", "wwwwwwww", "wwwwwwww", "wwwwwwww", "wwwwwwww", ".wwwwww.", "..wwww.."];
const BOAT = ["...k...", "...kw..", "..kkww.", "...kwww", "kkkkkkk", ".kyyyk."];

function drawBackdrop(cx) {
  const B = S.backdrop;   // how fast each background layer scrolls (parallax) and drifts, from game.json
  // sun, far away
  ctx.globalAlpha = 0.85; sprite(SUN, Math.round(VW * 0.72 - cx * B.sun.parallax), -Math.min(OY, 40) + 14); ctx.globalAlpha = 1;
  // clouds on two depth layers, uneven spacing and heights, some flipped
  if (cloudR) for (const { parallax: par, spacing: span, drift, seed } of B.clouds) {
    const off = cx * par + t * drift, i0 = Math.floor(off / span) - 1;
    for (let i = i0; i < i0 + Math.ceil(VW / span) + 3; i++) {
      const r = mulberry(i * 131 + seed);
      if (r() < 0.25) continue;                                 // some gaps
      const img = r() < 0.5 ? cloudR : cloudL;
      const x = Math.round(i * span + r() * (span - 40) - off);
      const ylo = -Math.min(OY, 120) + 2, yhi = 44;
      const y = Math.round(ylo + r() * (yhi - ylo) * (par < 0.2 ? 0.8 : 1));
      ctx.drawImage(img, x, y);
    }
  }
  // seagulls
  for (let g = 0; g < B.gulls.count; g++) {
    const gx = ((g * 211 + t * (0.35 + g * 0.08) - cx * B.gulls.parallax) % (VW + 80) + VW + 80) % (VW + 80) - 40;
    const gy = 30 + g * 13 + Math.round(Math.sin(t * 0.03 + g) * 3) - (g === 2 ? Math.min(OY, 40) : 0);
    const up = ((t >> 3) + g) % 2;
    ctx.fillStyle = INK;
    ctx.fillRect(Math.round(gx), gy, 1, 1);
    ctx.fillRect(Math.round(gx) - 1, gy - up, 1, 1); ctx.fillRect(Math.round(gx) + 1, gy - up, 1, 1);
    ctx.fillRect(Math.round(gx) - 2, gy - up * 2 + (up ? 0 : 1) - 0, 1, 1); ctx.fillRect(Math.round(gx) + 2, gy - up * 2 + (up ? 0 : 1), 1, 1);
  }
  // city across the water
  const co = Math.round(cx * B.city.parallax), cxo = -(((co % CITY_W) + CITY_W) % CITY_W);
  for (let x = cxo; x < VW; x += CITY_W) ctx.drawImage(cityC, x, HORIZON - 64);
  // sea with shimmer and foam
  ctx.fillStyle = SEA; ctx.fillRect(0, HORIZON, VW, GROUND - HORIZON);
  ctx.fillStyle = SEA_DK; ctx.fillRect(0, HORIZON, VW, 1);
  const so = Math.round(cx * B.sea.parallax);
  for (let y = HORIZON + 3; y < GROUND - 2; y += 3) {
    const step = 7 + (y % 5), k0 = Math.floor(so / step);
    for (let k = k0; k <= k0 + Math.ceil(VW / step) + 1; k++) {
      const h = mulberry(k * 53 + y * 977)();
      const phase = (h * 8 + t / 40) % 8;                       // each glint twinkles slowly on its own clock
      if (phase > 3) continue;
      ctx.fillStyle = phase < 1 ? CREAM : SEA_DK;
      ctx.fillRect(k * step - so + ((h * 5) | 0), y, 2, 1);
    }
  }
  // sailboat drifting along the horizon
  const bx = ((300 + t * B.boat.drift - cx * B.boat.parallax) % (VW + 300) + VW + 300) % (VW + 300) - 30;
  sprite(BOAT, Math.round(bx), HORIZON - 3);
  // foam lapping at the shore
  const lap = Math.round(Math.sin(t * 0.04) * 1.5);
  for (let x = -((cx % 6 + 6) % 6); x < VW; x += 6) { ctx.fillStyle = CREAM; ctx.fillRect(x + lap, GROUND - 2, 3, 1); ctx.fillRect(x + 3 - lap, GROUND - 1, 2, 1); }
  // sand
  if (ground) { const gx = -(((cx % W) + W) % W); for (let x = gx; x < VW; x += W) ctx.drawImage(ground, x, GROUND); }
  // beach props, in the world with the crab (behind him)
  // little shells, pebbles and the odd starfish scattered on the sand
  const D = 23, d0 = Math.floor(cx / D) - 1;
  for (let i = d0; i <= d0 + Math.ceil(VW / D) + 1; i++) {
    const r = mulberry(i * 613 + 9), k = r();
    const x = Math.round(i * D + r() * 18 - cx), y = GROUND + 3 + (r() * 10 | 0);
    if (k < 0.35) { ctx.fillStyle = YEL_DK; ctx.fillRect(x, y, 2, 1); }
    else if (k < 0.5) { ctx.fillStyle = CREAM; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = PINK; ctx.fillRect(x, y + 1, 2, 1); }
    else if (k < 0.54) sprite(STAR, x, y - 1);
  }
  if (LEVEL_PROPS) {
    for (const p of LEVEL_PROPS) if (p.x - cx < VW && p.x + PROP_W[p.type] - cx > 0) ctx.drawImage(p.img, p.x - cx, GROUND + 1 - p.img.height);
    drawLevelMarks(cx);
    return;
  }
  const i0 = Math.floor((cx - CASTLE_W - 40) / SLOT);
  for (let i = i0; i <= i0 + Math.ceil(VW / SLOT) + 2; i++) {
    const p = propAt(i); if (!p) continue;
    ctx.drawImage(p.img, p.x - cx, GROUND + 1 - p.img.height);
  }
}

// levels: checkpoint pennants (they turn cream once reached) and the exit flag
const PENNANT = ["kyy..", "kyyyy", "kyy..", "k....", "k....", "k....", "k....", "k...."];
const EXIT_FLAG = ["krrrrr.", "krrwrrr", "krrrrr.", "krr....", "k......", "k......", "k......", "k......", "k......", "k......", "k......", "k......", "kk....."];
function drawLevelMarks(cx) {
  for (const c of LEVEL.checkpoints || []) {
    const got = checkpointX !== null && c.x <= checkpointX;
    sprite(got ? PENNANT.map(r => r.replace(/y/g, 'w')) : PENNANT, Math.round(c.x - cx), GROUND - PENNANT.length + 1);
  }
  if (LEVEL.exit) sprite(EXIT_FLAG, Math.round(LEVEL.exit.x - cx), GROUND - EXIT_FLAG.length + 1);
}
