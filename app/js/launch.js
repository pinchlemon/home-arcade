// Launch animation: the app icon's wireframe dodecahedron (iridescent like the logo) spins faster and faster, a tornado of revolutions,
// slowly turning white. Then, a few pixels at a time, it dissolves: small pixels (the size of the pixels in the tab icons) leave it and
// build the five solids in a row, all white, while the dodecahedron thins out. The row then drops down into the circles on the tab bar
// (each solid takes on its tab's color as it lands). Nothing pops in or out: every step grows out of the one before.
// It plays over the finished app (the real tab icons are hidden until the solids land on them), once per app session.
// Tap, any key or a controller button skips it. Turned off by Settings > Display > Launch animation or Reduce motion.
import { solid, cellsSolid } from './pixel.js';

const PHI = (1 + Math.sqrt(5)) / 2, TAU = Math.PI * 2;
const ICON_STOPS = [[0, '#86c94a'], [.12, '#3f9fa8'], [.25, '#5a5cf0'], [.4, '#c04fd0'], [.5, '#ff4fa0'], [.62, '#ff7a2a'], [.75, '#ff9a2a'], [.88, '#c8c83a'], [1, '#86c94a']]
  .map(([o, h]) => [o, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))]);
// seconds. Between `row` (the last pixel lands) and `drop` the finished solids just spin, with nothing flying.
// The spin picks up speed until `fast`, then keeps going flat out. At `leave` pixels begin to leave the dodecahedron, one by one,
// until `gone`; each takes FLIGHT seconds to reach the row, so the row is complete at `row`. Then the row drops to the tabs.
const FLIGHT = 1.0, ROW_N = 44, TAB_N = 20, DROP_DUR = 0.7, DROP_STAGGER = 0.07;
const T = { hold: 0.45, fast: 2.65, pix: 2.2, pixIn: 0.6, leave: 3.0, gone: 6.4, row: 6.4 + FLIGHT, drop: 7.9, end: 7.9 + 4 * DROP_STAGGER + DROP_DUR };
const OMEGA = 32; // radians per second at full speed (about 5 turns a second)
const KINDS = ['dodeca', 'cube', 'icosa', 'octa', 'tetra'];

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// share of the dodecahedron's pixels that have left by time t (gentle at both ends), and its inverse (when the share-th pixel leaves)
const leftBy = t => { const x = clamp((t - T.leave) / (T.gone - T.leave)); return x * x * (3 - 2 * x); };
const leaveAt = r => T.leave + (0.5 - Math.sin(Math.asin(1 - 2 * clamp(r)) / 3)) * (T.gone - T.leave);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const hash = (x, y, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
// the logo's rainbow, by direction around the centre (0 to 1, starting at 3 o'clock and going clockwise)
function iconColor(f) {
  f = ((f % 1) + 1) % 1;
  for (let k = 1; k < ICON_STOPS.length; k++) {
    if (f <= ICON_STOPS[k][0]) {
      const [o0, a] = ICON_STOPS[k - 1], [o1, b] = ICON_STOPS[k], m = (f - o0) / ((o1 - o0) || 1);
      return `rgb(${lerp(a[0], b[0], m) | 0},${lerp(a[1], b[1], m) | 0},${lerp(a[2], b[2], m) | 0})`;
    }
  }
  return 'rgb(134,201,74)';
}

let G = null; // dodecahedron faces, edge-to-face links and the icon's starting pose
function geo() {
  if (G) return G;
  const s = solid('dodeca'), n = s.v.length, normals = [];
  [1, -1].forEach(a => [1, -1].forEach(b => { normals.push([0, a * PHI, b], [a, 0, b * PHI], [a * PHI, b, 0]); }));
  const faces = normals.map(nv => {
    const l = Math.hypot(...nv), nn = nv.map(c => c / l);
    const dots = s.v.map((p, i) => [p[0] * nn[0] + p[1] * nn[1] + p[2] * nn[2], i]).sort((a, b) => b[0] - a[0]);
    return { n: nn, idx: dots.slice(0, 5).map(d => d[1]) };
  });
  const edgeFaces = s.e.map(([i, j]) => faces.map((f, k) => (f.idx.includes(i) && f.idx.includes(j) ? k : -1)).filter(k => k >= 0));
  // the pose that looks straight at the face with normal (0, PHI, 1), with a corner of that pentagon pointing up, as in the icon
  const ay0 = 0, ax0 = Math.atan(PHI);
  const f0 = faces.find(f => f.n[0] === 0 && f.n[1] > 0 && f.n[2] > 0);
  const flat = project(s.v, ay0, ax0, 0, 0);
  let best = 0, bestD = 9;
  f0.idx.forEach(i => { const a = Math.atan2(flat[i][1], flat[i][0]); const d = Math.abs(((a + Math.PI / 2 + Math.PI) % TAU + TAU) % TAU - Math.PI); if (d < bestD) { bestD = d; best = a; } });
  return (G = { s, n, faces, edgeFaces, ay0, ax0, roll0: -Math.PI / 2 - best });
}
function project(v, ay, ax, roll, persp) {
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), cr = Math.cos(roll), sr = Math.sin(roll);
  return v.map(q => {
    const x1 = q[0] * cy + q[2] * sy, z1 = -q[0] * sy + q[2] * cy, y2 = q[1] * cx - z1 * sx, z2 = q[1] * sx + z1 * cx, k = 0.95 * (1 + persp * z2 * 0.25);
    const px = x1 * k, py = -y2 * k;
    return [px * cr - py * sr, px * sr + py * cr, z2];
  });
}
function rotN(nv, ay, ax, roll) {
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), cr = Math.cos(roll), sr = Math.sin(roll);
  const x1 = nv[0] * cy + nv[2] * sy, z1 = -nv[0] * sy + nv[2] * cy, y2 = nv[1] * cx - z1 * sx, z2 = nv[1] * sx + z1 * cx, py = -y2;
  return [x1 * cr - py * sr, x1 * sr + py * cr, z2];
}

// The wireframe's pose at time t: still for a beat, then spinning faster and faster until `fast`, then flat out. It fades from iridescent to white all along.
function pose(t) {
  const g = geo(), u = Math.max(0, t - T.hold), A = T.fast - T.hold, e = ease(clamp(u / 1.2)), r = clamp(u / A);
  const spin = u <= A ? OMEGA * A / 2.5 * Math.pow(r, 2.5) : OMEGA * A / 2.5 + OMEGA * (u - A);
  return { ay: g.ay0 + spin, ax: lerp(g.ax0, 0.42 + Math.sin(t * 0.8) * 0.1 * e, e) + Math.sin(t * 5) * 0.06 * r, roll: g.roll0 * (1 - e), back: ease(clamp(u / 1.0)), persp: e,
    white: ease(clamp((t - 0.6) / 2.4)), speed: OMEGA * Math.pow(r, 1.5) };
}
// how the real tab icons are turned at time tt (seconds), see paintSolids in main.js
const tabPose = (i, tt) => ({ ay: tt * (0.55 + i * 0.08) + i * 1.3, ax: 0.45 + Math.sin(tt * 0.3 + i) * 0.15 });

// ---- drawing the smooth wireframe
// a faint, cheap copy of the front bars (one flat colour per bar), for the motion blur trail
function drawGhost(ctx, Q, st, alpha) {
  const g = geo(), u = Q / 2.5, c = Q / 2;
  const P = project(g.s.v, st.ay, st.ax, st.roll, st.persp).map(p => [c + p[0] * u, c + p[1] * u]);
  const fn = g.faces.map(f => rotN(f.n, st.ay, st.ax, st.roll));
  ctx.lineCap = 'round'; ctx.lineWidth = u * 0.07; ctx.globalAlpha = alpha;
  g.s.e.forEach(([i, j], k) => {
    if (!g.edgeFaces[k].some(f => fn[f][2] > 0.001)) return;
    const a = P[i], b = P[j], m = iconColor(Math.atan2((a[1] + b[1]) / 2 - c, (a[0] + b[0]) / 2 - c) / TAU).match(/\d+/g).map(Number), w = st.white;
    ctx.strokeStyle = `rgb(${lerp(m[0], 255, w) | 0},${lerp(m[1], 255, w) | 0},${lerp(m[2], 255, w) | 0})`;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  });
  ctx.globalAlpha = 1;
}
function drawScene(ctx, Q, st) {
  const g = geo(), u = Q / 2.5, c = Q / 2;
  ctx.clearRect(0, 0, Q, Q);
  const P = project(g.s.v, st.ay, st.ax, st.roll, st.persp).map(p => [c + p[0] * u, c + p[1] * u, p[2]]);
  const fn = g.faces.map(f => rotN(f.n, st.ay, st.ax, st.roll));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const front = g.s.e.map((_, k) => g.edgeFaces[k].some(f => fn[f][2] > 0.001));
  // each bar is coloured by where it is around the centre, so the rainbow stays put as the solid turns (and meets its neighbours in the same colour)
  const edgeGrad = (a, b) => {
    const gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    for (let s = 0; s <= 4; s++) { const f = s / 4; gr.addColorStop(f, iconColor(Math.atan2(a[1] + (b[1] - a[1]) * f - c, a[0] + (b[0] - a[0]) * f - c) / TAU)); }
    return gr;
  };
  const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  // far edges, faint, show the solid behind (a skeleton: no faces)
  if (st.back > 0.01) {
    ctx.lineWidth = u * 0.03;
    g.s.e.forEach(([i, j], k) => { if (!front[k]) { ctx.globalAlpha = st.back * (0.1 + 0.2 * clamp(0.5 - (P[i][2] + P[j][2]) / 2)); ctx.strokeStyle = iconColor(Math.atan2((P[i][1] + P[j][1]) / 2 - c, (P[i][0] + P[j][0]) / 2 - c) / TAU); line(P[i], P[j]); } }); // faint, so one flat colour each is plenty
  }
  const w = u * 0.07, near = [];
  g.s.e.forEach(([i, j], k) => { if (front[k]) near.push([P[i], P[j]]); });
  ctx.globalAlpha = 1; ctx.lineWidth = w;
  near.forEach(([a, b]) => { ctx.strokeStyle = edgeGrad(a, b); line(a, b); });
  // bevel, like the logo: a light strip along the upper-left side of each bar and a shade along the lower-right.
  // Each is one path, so where bars meet nothing doubles up.
  const strip = (side, style, alpha) => {
    ctx.beginPath();
    near.forEach(([a, b]) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l;
      if (nx + ny > 0) { nx = -nx; ny = -ny; }
      const o = side * w * 0.3;
      ctx.moveTo(a[0] + nx * o, a[1] + ny * o); ctx.lineTo(b[0] + nx * o, b[1] + ny * o);
    });
    ctx.globalAlpha = alpha; ctx.strokeStyle = style; ctx.lineWidth = w * 0.18; ctx.stroke();
  };
  strip(1, '#ffffff', 0.3);
  strip(-1, '#000000', 0.1);
  ctx.globalAlpha = 1;
  // fading to white tints everything drawn so far
  if (st.white > 0.01) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,255,255,${st.white})`; ctx.fillRect(0, 0, Q, Q); ctx.globalCompositeOperation = 'source-over'; }
}

// halve a canvas step by step (so thin lines survive) down to n x n, then cut the alpha to full, dim or off
function pixelate(src, n, tmp) {
  let cur = src;
  while (cur.width > n * 2) {
    const w = Math.max(n, Math.ceil(cur.width / 2)), c = tmp(w); const x = c.getContext('2d');
    x.clearRect(0, 0, w, w); x.imageSmoothingEnabled = true; x.drawImage(cur, 0, 0, w, w); cur = c;
  }
  const out = tmp(n, 1), x = out.getContext('2d');
  x.clearRect(0, 0, n, n); x.imageSmoothingEnabled = true; x.drawImage(cur, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n), a = d.data;
  for (let i = 0; i < a.length; i += 4) a[i + 3] = a[i + 3] > 110 ? 255 : (a[i + 3] > 45 ? 120 : 0);
  return { canvas: out, ctx: x, img: d, data: a }; // the caller puts the image back (after thinning it out)
}

let playing = false;
export const launching = () => playing;
const SEEN = 'ha.launched';
export function shouldPlay(app) {
  if (app.settings.reduceMotion || app.settings.launchAnim === false) return false;
  try { return !sessionStorage.getItem(SEEN); } catch (e) { return true; }
}

// root: the #app element (already drawn). Returns a promise that resolves when the animation is over.
export function play({ root, input, tabSolids, preview }) {
  if (playing) return Promise.resolve();
  if (tabSolids().length < 5) return Promise.resolve();
  playing = true;
  if (!preview) { try { sessionStorage.setItem(SEEN, '1'); } catch (e) {} }
  const html = document.documentElement;
  html.classList.add('launching');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  let W = innerWidth, H = innerHeight;
  const wrap = document.createElement('div');
  wrap.id = 'launch'; wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#060607;touch-action:none';
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  wrap.appendChild(cv); document.body.appendChild(wrap);
  const ctx = cv.getContext('2d');

  const U = Math.min(W, H) * 0.35, cx = W / 2, cy = Math.min(H * 0.43, H - U * 2), Dg = U * 2.5; // U: px per unit, Dg: the 2.5-unit square the solid lives in
  const Q = Math.round(Dg * Math.min(dpr, 2)), scene = document.createElement('canvas'); scene.width = scene.height = Q;
  const sctx = scene.getContext('2d'), acc = document.createElement('canvas'); acc.width = acc.height = Q;
  const actx = acc.getContext('2d');
  const pool = {}; const tmp = (w, key) => { const k = key ? 'px' + w : 'm' + w; if (!pool[k]) { pool[k] = document.createElement('canvas'); pool[k].width = pool[k].height = w; } return pool[k]; };

  // the smooth wireframe at time t; when it spins fast, several moments within a few milliseconds are laid over each other (motion blur)
  function renderSmooth(t, still) {
    const st = pose(t), K = still || st.speed < 6 ? 0 : 5;
    actx.clearRect(0, 0, Q, Q);
    for (let k = K; k >= 1; k--) drawGhost(actx, Q, pose(t - k * 0.004), 0.16);
    drawScene(sctx, Q, st);
    actx.drawImage(scene, 0, 0);
    return acc;
  }

  const t0 = performance.now() / 1000;
  let done = false, raf = 0;

  function finish() {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    removeEventListener('pointerdown', skip, true); removeEventListener('keydown', skip, true); removeEventListener('resize', resized);
    html.classList.remove('launching'); wrap.remove(); playing = false;
    // the tap that skipped it must not also press whatever is under the finger
    const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
    addEventListener('click', swallow, true); setTimeout(() => removeEventListener('click', swallow, true), 500);
  }
  function skip(e) { if (e && e.type === 'pointerdown') e.preventDefault(); finish(); }
  function resized() { if (Math.abs(innerWidth - W) > 40 || Math.abs(innerHeight - H) > 80) finish(); }
  addEventListener('pointerdown', skip, true); addEventListener('keydown', skip, true); addEventListener('resize', resized);

  const alphaOf = l => [.3, .6, 1][l];
  let rects = null, tcs = 1.5, slots = null, landing = null, particles = null, nextP = 0, counts = null, sent = null;

  // where the five solids stand in a row (where the dodecahedron was) and where their circles on the tab bar are.
  function layout() {
    const els = tabSolids(); rects = els.map(e => e.getBoundingClientRect());
    // the colour each real tab icon has right now (the chosen tab in its colour, the others white), where the white solids land
    landing = els.map(e => { const cs = getComputedStyle(e), m = (cs.color.match(/[\d.]+/g) || [255, 255, 255]).map(Number); return { c: [m[0], m[1], m[2]], o: parseFloat(cs.opacity) || 1 }; });
    tcs = rects[0].width / TAB_N;
    const gap = Math.min(W * 0.2, ROW_N * tcs + 12);
    slots = KINDS.map((_, i) => ({ x: cx + (i - 2) * gap, y: cy }));
  }
  layout();
  // the dodecahedron's pixels are only a little bigger than the tab-icon pixels, so the ones that fly off shrink just a touch on the way
  const PN = Math.max(60, Math.round(Dg / (tcs * 1.6))), pcs = Dg / PN;

  // one little pixel for every pixel of the five solids, each given a moment to leave the dodecahedron (spread evenly, solids mixed together)
  function makeParticles() {
    counts = KINDS.map((kind, i) => { const q = tabPose(i, t0 + T.row); return cellsSolid(kind, q.ay, q.ax, ROW_N).length; });
    sent = [0, 0, 0, 0, 0];
    const owners = []; counts.forEach((n, i) => { for (let k = 0; k < n; k++) owners.push(i); });
    for (let k = owners.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [owners[k], owners[j]] = [owners[j], owners[k]]; }
    const M = owners.length;
    particles = owners.map((i, k) => ({ i, tl: leaveAt((k + Math.random()) / M), on: false, bx: (Math.random() - .5) * 18, by: (Math.random() - .5) * 18 }));
  }
  // the lit pixels of the dodecahedron this frame (screen px), left to right, so its left side feeds the left solids
  let lit = [];
  function readLit(data) {
    lit = [];
    for (let y = 0; y < PN; y++) for (let x = 0; x < PN; x++) {
      const k = (y * PN + x) * 4; if (data[k + 3]) lit.push({ x: cx + (x + .5 - PN / 2) * pcs, y: cy + (y + .5 - PN / 2) * pcs, a: data[k + 3] / 255, c: [data[k], data[k + 1], data[k + 2]] });
    }
    lit.sort((a, b) => a.x - b.x);
  }
  // send off the pixels whose moment has come. A solid's pixels appear in a set order (by hash, see drawSolids), so each flying pixel
  // is aimed at exactly the spot that will light up when it lands: it lands, and that pixel of the solid is there.
  function launchDue(t, now) {
    if (nextP >= particles.length || particles[nextP].tl > t || !lit.length) return;
    const tgt = {};
    while (nextP < particles.length && particles[nextP].tl <= t) {
      const p = particles[nextP++], slice = Math.max(1, Math.floor(lit.length / 5));
      const src = lit[Math.min(lit.length - 1, p.i * slice + Math.floor(Math.random() * slice))];
      if (!tgt[p.i]) { const q = tabPose(p.i, now + FLIGHT - (t - p.tl)); tgt[p.i] = cellsSolid(KINDS[p.i], q.ay, q.ax, ROW_N); }
      const want = (sent[p.i]++ + 0.5) / counts[p.i];
      let tc = tgt[p.i][0], bd = 9;
      tgt[p.i].forEach(c => { const d = Math.abs(hash(c[0], c[1], p.i) - want); if (d < bd) { bd = d; tc = c; } });
      p.on = true; p.x0 = src.x; p.y0 = src.y; p.a0 = src.a; p.c0 = src.c;
      p.x1 = slots[p.i].x + (tc[0] + .5 - ROW_N / 2) * tcs; p.y1 = slots[p.i].y + (tc[1] + .5 - ROW_N / 2) * tcs; p.a1 = alphaOf(tc[2]);
    }
  }
  // the solids in a row, spinning like the real tab icons. While pixels are still arriving only the share that has arrived shows;
  // later each drops to its circle, getting smaller pixel by pixel and taking on the tab's colour.
  function drawSolids(t, now) {
    const arrived = [0, 0, 0, 0, 0];
    if (t < T.row) particles.forEach(p => { if (p.on && t >= p.tl + FLIGHT) arrived[p.i]++; });
    KINDS.forEach((kind, i) => {
      const q = tabPose(i, now), e = ease(clamp((t - T.drop - i * DROP_STAGGER) / DROP_DUR)), N = Math.round(lerp(ROW_N, TAB_N, e)), r = rects[i];
      const share = t >= T.row ? 1 : arrived[i] / counts[i];
      if (share <= 0) return;
      const x = lerp(slots[i].x, r.left + r.width / 2, e), y = lerp(slots[i].y, r.top + r.height / 2, e);
      const lc = landing[i], rr = lerp(255, lc.c[0], e) | 0, gg = lerp(255, lc.c[1], e) | 0, bb = lerp(255, lc.c[2], e) | 0, op = lerp(1, lc.o, e);
      cellsSolid(kind, q.ay, q.ax, N).forEach(([gx, gy, l]) => {
        if (share < 1 && hash(gx, gy, i) >= share) return;
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${alphaOf(l) * op})`;
        ctx.fillRect(x + (gx - N / 2) * tcs, y + (gy - N / 2) * tcs, tcs, tcs);
      });
    });
  }

  function tick() {
    if (done) return;
    const now = performance.now() / 1000, t = now - t0;
    if (input && (input.pressed('a') || input.pressed('b') || input.pressed('start') || input.pressed('x') || input.pressed('y'))) { finish(); return; }
    if (t >= T.end) { finish(); return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, W, H);
    // the dark gives way to the app as the solids start to drop
    wrap.style.background = `rgba(6,6,7,${clamp(1 - (t - (T.drop - 0.1)) / 0.5)})`;

    if (t < T.gone) {
      const m = clamp((t - T.pix) / T.pixIn), mm = ease(m), smooth = mm < 1 ? renderSmooth(t) : null;
      // the smooth wireframe, which melts into its pixel version
      if (mm < 1) { ctx.globalAlpha = clamp(t / 0.35) * (1 - mm); ctx.drawImage(smooth, cx - Dg / 2, cy - Dg / 2, Dg, Dg); ctx.globalAlpha = 1; }
      if (m > 0) {
        if (!particles) makeParticles();
        const px = pixelate(renderSmooth(t, true), PN, tmp);
        if (t >= T.leave) { readLit(px.data); launchDue(t, now); }
        // as pixels leave, the dodecahedron thins out, pixel by pixel
        // as pixels leave, the dodecahedron thins out pixel by pixel, and what is left fades a little, so it dissipates rather than vanishes
        const keep = 1 - leftBy(t), dim = 0.45 + 0.55 * keep;
        if (keep < 1) for (let y = 0; y < PN; y++) for (let x = 0; x < PN; x++) { const k = (y * PN + x) * 4 + 3; px.data[k] = hash(x, y, 7) >= keep ? 0 : px.data[k] * dim; }
        px.ctx.putImageData(px.img, 0, 0);
        ctx.globalAlpha = mm; ctx.imageSmoothingEnabled = false; ctx.drawImage(px.canvas, cx - Dg / 2, cy - Dg / 2, Dg, Dg); ctx.globalAlpha = 1;
      }
    } else if (!particles) { finish(); return; }
    if (particles && t >= T.leave) {
      launchDue(t, now);
      // pixels in flight, shrinking a little from the dodecahedron's pixel size to the tab icons'
      particles.forEach(p => {
        if (!p.on || t >= p.tl + FLIGHT) return;
        const e = clamp((t - p.tl) / FLIGHT), m = ease(e), bump = Math.sin(Math.PI * easeOut(e)), sz = lerp(pcs, tcs, m);
        ctx.fillStyle = `rgba(${p.c0[0]},${p.c0[1]},${p.c0[2]},${lerp(p.a0, p.a1, m)})`;
        ctx.fillRect(lerp(p.x0, p.x1, m) + p.bx * bump - sz / 2, lerp(p.y0, p.y1, m) + p.by * bump - sz / 2, sz, sz);
      });
      drawSolids(t, now);
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return new Promise(res => { const iv = setInterval(() => { if (done) { clearInterval(iv); res(); } }, 100); });
}
