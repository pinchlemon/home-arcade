// Launch animation: the app icon's wireframe dodecahedron (iridescent like the logo) spins faster and faster, a tornado of revolutions,
// turning white as it goes, and pixelates. Its pixels (the same small size as in the tab icons) then separate into the five solids
// standing in a row, all white, which drop down into their circles on the tab bar (and take on the tab's color as they land).
// It plays over the finished app (the real tab icons are hidden until the solids land on them), once per app session.
// Tap, any key or a controller button skips it. Turned off by Settings > Display > Launch animation or Reduce motion.
import { solid, cellsSolid } from './pixel.js';

const PHI = (1 + Math.sqrt(5)) / 2, TAU = Math.PI * 2;
const ICON_STOPS = [[0, '#86c94a'], [.12, '#3f9fa8'], [.25, '#5a5cf0'], [.4, '#c04fd0'], [.5, '#ff4fa0'], [.62, '#ff7a2a'], [.75, '#ff9a2a'], [.88, '#c8c83a'], [1, '#86c94a']];
// seconds: icon (hold), spin and pixelate, separate into small pixels, solids in a row, drop to the tabs
const T = { hold: 0.4, pix: 1.5, snap: 2.3, split: 2.7, row: 3.6, drop: 4.0, end: 5.05 };
const SPIN = 56;   // radians turned before the pixels let go (about 9 revolutions), ever faster
const WHITE = [255, 255, 255];
const SPLIT_DUR = 0.6, ROW_N = 44, TAB_N = 20, DROP_DUR = 0.7, DROP_STAGGER = 0.07;
const KINDS = ['dodeca', 'cube', 'icosa', 'octa', 'tetra'];

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);

let G = null; // dodecahedron faces, edge-to-face links and the icon's starting pose
function geo() {
  if (G) return G;
  const s = solid('dodeca'), n = s.v.length, normals = [];
  [1, -1].forEach(a => [1, -1].forEach(b => { normals.push([0, a * PHI, b], [a, 0, b * PHI], [a * PHI, b, 0]); }));
  const faces = normals.map(nv => {
    const l = Math.hypot(...nv), nn = nv.map(c => c / l);
    const dots = s.v.map((p, i) => [p[0] * nn[0] + p[1] * nn[1] + p[2] * nn[2], i]).sort((a, b) => b[0] - a[0]);
    const idx = dots.slice(0, 5).map(d => d[1]);
    const ref = Math.abs(nn[0]) < .9 ? [1, 0, 0] : [0, 1, 0];
    const u0 = [nn[1] * ref[2] - nn[2] * ref[1], nn[2] * ref[0] - nn[0] * ref[2], nn[0] * ref[1] - nn[1] * ref[0]], ul = Math.hypot(...u0), u = u0.map(c => c / ul);
    const w = [nn[1] * u[2] - nn[2] * u[1], nn[2] * u[0] - nn[0] * u[2], nn[0] * u[1] - nn[1] * u[0]];
    const ang = i => Math.atan2(s.v[i][0] * w[0] + s.v[i][1] * w[1] + s.v[i][2] * w[2], s.v[i][0] * u[0] + s.v[i][1] * u[1] + s.v[i][2] * u[2]);
    idx.sort((a, b) => ang(a) - ang(b));
    return { n: nn, idx };
  });
  const edgeFaces = s.e.map(([i, j]) => faces.map((f, k) => (f.idx.includes(i) && f.idx.includes(j) ? k : -1)).filter(k => k >= 0));
  // the pose that looks straight at the face with normal (0, PHI, 1), with a corner of that pentagon pointing up, as in the icon
  const ay0 = 0, ax0 = Math.atan(PHI);
  const f0 = faces.find(f => f.n[0] === 0 && f.n[1] > 0 && f.n[2] > 0);
  const flat = project(s.v, ay0, ax0, 0, 0);
  let best = 0, bestD = 9;
  f0.idx.forEach(i => { const a = Math.atan2(flat[i][1], flat[i][0]); let d = Math.abs(((a + Math.PI / 2 + Math.PI) % TAU + TAU) % TAU - Math.PI); if (d < bestD) { bestD = d; best = a; } });
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

// The wireframe's pose at time t: still for a beat, then spinning faster and faster (a tornado), and fading from iridescent to white.
function pose(t) {
  const g = geo(), sp = clamp((t - T.hold) / (T.split - T.hold)), e = ease(clamp((t - T.hold) / 1.2));
  const spin = SPIN * Math.pow(sp, 2.5);
  return { ay: g.ay0 + spin, ax: lerp(g.ax0, 0.42 + Math.sin(t * 0.8) * 0.1 * e, e) + Math.sin(t * 5) * 0.06 * sp, roll: g.roll0 * (1 - e), back: ease(clamp((t - T.hold) / 1.0)), persp: e,
    white: ease(clamp((t - T.hold - 0.2) / (T.pix - T.hold - 0.2))), speed: 2.5 * SPIN / (T.split - T.hold) * Math.pow(sp, 1.5) };
}
// how the real tab icons are turned at time tt (seconds), see paintSolids in main.js
const tabPose = (i, tt) => ({ ay: tt * (0.55 + i * 0.08) + i * 1.3, ax: 0.45 + Math.sin(tt * 0.3 + i) * 0.15 });

// ---- drawing the smooth wireframe
function drawScene(ctx, Q, st, grad) {
  const g = geo(), u = Q / 2.5, c = Q / 2;
  ctx.clearRect(0, 0, Q, Q);
  const P = project(g.s.v, st.ay, st.ax, st.roll, st.persp).map(p => [c + p[0] * u, c + p[1] * u, p[2]]);
  const fn = g.faces.map(f => rotN(f.n, st.ay, st.ax, st.roll));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const path = (i, j) => { ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke(); };
  const front = g.s.e.map((_, k) => g.edgeFaces[k].some(f => fn[f][2] > 0.001));
  // far edges, faint, show the solid behind (a skeleton: no faces)
  if (st.back > 0.01) {
    ctx.strokeStyle = grad; ctx.lineWidth = u * 0.035;
    g.s.e.forEach(([i, j], k) => { if (!front[k]) { ctx.globalAlpha = st.back * (0.12 + 0.22 * clamp(0.5 - (P[i][2] + P[j][2]) / 2)); path(i, j); } });
  }
  // near edges, like the logo: a slim iridescent bar with a violet-blue fringe on its upper left and a green one on its lower right
  const w = u * 0.07, d = u * 0.013;
  const bar = (dx, dy, style, width) => { ctx.strokeStyle = style; ctx.lineWidth = width; ctx.translate(dx, dy); g.s.e.forEach(([i, j], k) => { if (front[k]) path(i, j); }); ctx.translate(-dx, -dy); };
  ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  bar(-d, -d, 'rgba(120,130,255,.95)', w * 1.02);
  bar(d, d, 'rgba(130,235,110,.9)', w * 1.02);
  bar(0, 0, grad, w);
  // fading to white tints everything drawn so far
  if (st.white > 0.01) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,255,255,${st.white})`; ctx.fillRect(0, 0, Q, Q); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1;
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
  x.putImageData(d, 0, 0);
  return out;
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
  const Q = Math.round(Dg * dpr), scene = document.createElement('canvas'); scene.width = scene.height = Q;
  const sctx = scene.getContext('2d'), acc = document.createElement('canvas'); acc.width = acc.height = Q;
  const actx = acc.getContext('2d');
  const grad = (() => { const g = sctx.createConicGradient ? sctx.createConicGradient(0, Q / 2, Q / 2) : sctx.createLinearGradient(0, 0, Q, Q); ICON_STOPS.forEach(([o, c]) => g.addColorStop(o, c)); return g; })();
  const pool = {}; const tmp = (w, key) => { const k = key ? 'px' + w : 'm' + w; if (!pool[k]) { pool[k] = document.createElement('canvas'); pool[k].width = pool[k].height = w; } return pool[k]; };

  // the smooth wireframe at time t; when it spins fast, several moments within a few milliseconds are laid over each other (motion blur)
  function renderSmooth(t, still) {
    const st = pose(t), K = still || st.speed < 6 ? 1 : 7;
    actx.clearRect(0, 0, Q, Q);
    for (let k = K - 1; k >= 0; k--) {
      drawScene(sctx, Q, k ? pose(t - k * 0.003) : st, grad);
      actx.globalAlpha = k ? 0.2 : 1; actx.drawImage(scene, 0, 0);
    }
    actx.globalAlpha = 1;
    return acc;
  }

  const t0 = performance.now() / 1000;
  let particles = null, done = false, raf = 0;

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
  let rects = null, tcs = 1.5, slots = null, frozen = null, landing = null;

  // where the five solids stand in a row (where the dodecahedron was) and where their circles on the tab bar are.
  // Every pixel from here on is the size of a pixel in the tab icons.
  function layout() {
    const els = tabSolids(); rects = els.map(e => e.getBoundingClientRect());
    // the colour each real tab icon has right now (the chosen tab in its colour, the others white), where the white solids land
    landing = els.map(e => { const cs = getComputedStyle(e), m = (cs.color.match(/[\d.]+/g) || [255, 255, 255]).map(Number); return { c: [m[0], m[1], m[2]], o: parseFloat(cs.opacity) || 1 }; });
    tcs = rects[0].width / TAB_N;
    const gap = Math.min(W * 0.2, ROW_N * tcs + 12);
    slots = KINDS.map((_, i) => ({ x: cx + (i - 2) * gap, y: cy }));
  }
  // the little pixels that leave the big ones and form the row. Each solid is built from a slice of the dodecahedron (left slice, left solid).
  function buildParticles(cells, srcN, tRow) {
    const cs = Dg / srcN, src = cells.map(c => ({ x: cx + (c.x + .5 - srcN / 2) * cs, y: cy + (c.y + .5 - srcN / 2) * cs, a: c.a, c: c.c })).sort((a, b) => a.x - b.x);
    const per = src.length / 5, out = [];
    KINDS.forEach((kind, i) => {
      const slice = src.slice(Math.round(i * per), Math.round((i + 1) * per)), q = tabPose(i, tRow);
      cellsSolid(kind, q.ay, q.ax, ROW_N).forEach(([x, y, l], j) => {
        const a = slice[(j * 7 + i) % slice.length] || src[0], ang = Math.random() * TAU, burst = 8 + Math.random() * 26;
        out.push({ x0: a.x + (Math.random() - .5) * cs, y0: a.y + (Math.random() - .5) * cs, a0: a.a, c0: a.c, x1: slots[i].x + (x + .5 - ROW_N / 2) * tcs, y1: slots[i].y + (y + .5 - ROW_N / 2) * tcs, l1: l, bx: Math.cos(ang) * burst, by: Math.sin(ang) * burst, delay: Math.random() * 0.3 });
      });
    });
    return out;
  }
  // the solids in a row, spinning like the real tab icons; later each drops to its circle, getting smaller pixel by pixel
  function drawSolids(t, now) {
    KINDS.forEach((kind, i) => {
      const q = tabPose(i, now), e = ease(clamp((t - T.drop - i * DROP_STAGGER) / DROP_DUR)), N = Math.round(lerp(ROW_N, TAB_N, e)), r = rects[i];
      const x = lerp(slots[i].x, r.left + r.width / 2, e), y = lerp(slots[i].y, r.top + r.height / 2, e);
      const lc = landing[i], rr = lerp(255, lc.c[0], e) | 0, gg = lerp(255, lc.c[1], e) | 0, bb = lerp(255, lc.c[2], e) | 0, op = lerp(1, lc.o, e);
      cellsSolid(kind, q.ay, q.ax, N).forEach(([gx, gy, l]) => {
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
    const st = pose(t);

    if (t < T.split) {
      wrap.style.background = '#060607';
      const fade = clamp(t / 0.35); // the icon fades in
      if (t < T.pix) {
        ctx.globalAlpha = fade; ctx.drawImage(renderSmooth(t), cx - Dg / 2, cy - Dg / 2, Dg, Dg); ctx.globalAlpha = 1;
      } else {
        // coarser and coarser pixels (128, 64, then 40 across), still iridescent and still spinning faster; at the end they tremble
        const n = t < T.pix + 0.2 ? 128 : (t < T.pix + 0.4 ? 64 : 40), j = clamp((t - T.snap) / (T.split - T.snap));
        const px = pixelate(renderSmooth(t, true), n, tmp); ctx.imageSmoothingEnabled = false;
        const sh = j * 3, sc = 1 + Math.sin(j * 40) * 0.01 * j;
        ctx.drawImage(px, cx - Dg * sc / 2 + (Math.random() - .5) * sh, cy - Dg * sc / 2 + (Math.random() - .5) * sh, Dg * sc, Dg * sc);
      }
    } else {
      if (!particles) {
        layout();
        const px = pixelate(renderSmooth(T.split, true), 40, tmp), data = px.getContext('2d').getImageData(0, 0, 40, 40).data, cells = [];
        frozen = document.createElement('canvas'); frozen.width = frozen.height = 40; frozen.getContext('2d').drawImage(px, 0, 0);
        for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { const i = (y * 40 + x) * 4; if (data[i + 3]) cells.push({ x, y, a: data[i + 3] / 255, c: [data[i], data[i + 1], data[i + 2]] }); }
        particles = buildParticles(cells, 40, t0 + T.row);
      }
      const k = t - T.split;
      // the dark gives way to the app as the solids start to drop
      wrap.style.background = `rgba(6,6,7,${clamp(1 - (t - (T.drop - 0.1)) / 0.5)})`;
      if (t < T.row) {
        if (k < 0.2) { ctx.globalAlpha = 1 - k / 0.2; ctx.imageSmoothingEnabled = false; ctx.drawImage(frozen, cx - Dg / 2, cy - Dg / 2, Dg, Dg); ctx.globalAlpha = 1; } // the big pixels dissolve as the small ones leave them
        particles.forEach(p => {
          const e = clamp((k - p.delay) / SPLIT_DUR), m = ease(e), bump = Math.sin(Math.PI * easeOut(e));
          const x = lerp(p.x0, p.x1, m) + p.bx * bump, y = lerp(p.y0, p.y1, m) + p.by * bump;
          ctx.fillStyle = `rgba(${p.c0[0]},${p.c0[1]},${p.c0[2]},${lerp(p.a0, alphaOf(p.l1), m)})`;
          ctx.fillRect(x - tcs / 2, y - tcs / 2, tcs, tcs);
        });
      } else drawSolids(t, now);
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return new Promise(res => { const iv = setInterval(() => { if (done) { clearInterval(iv); res(); } }, 100); });
}
