// The sprite editor (Art tab): draw a game's pictures, Aseprite style, by touch.
//
// Canvas: one finger uses the tool; two fingers pinch to zoom and drag to move; a quick two-finger tap undoes.
// Tools: pencil, eraser, fill, colour picker, hand (move the view). The zoom label in the corner fits the sprite back on screen.
// Colours: the big swatch opens the colour picker (add or remove palette colours there); the strip is the palette.
// Timeline (like Aseprite's): layers down the side (top layer first), frames across. Tap a cell to go there; tap the
// current frame number, layer name or tag again for its settings. Tags are named runs of frames (the game's animations).
// Everything is saved on the phone as you go (artStore.js: an .aseprite file plus the PNG the game reads) and pushed from Sync.
import { well, icon, svgRows, svgText } from '../pixel.js';
import { A, esc, iconBtn, stepper, toggle, bareBtn } from '../ui.js';
import * as input from '../input.js';
import { makeNav, padFrame } from '../padnav.js';
import { celKey, flatten, visibleLayers } from '../ase.js';
import * as store from '../artStore.js';

const PINK = '#ff4fd8';
const ZOOMS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 64];
const TOOLS = [['pencil', 'Pencil'], ['eraser', 'Eraser'], ['fill', 'Fill'], ['picker', 'Pick a colour'], ['pan', 'Move the view']];
const DIRS = ['FORWARD', 'REVERSE', 'PING-PONG'];
const TAG_COLORS = [[255, 90, 31], [125, 255, 106], [255, 79, 216], [77, 124, 255], [255, 210, 63], [180, 180, 180]];

const hex2 = (n) => n.toString(16).padStart(2, '0');
export const rgbHex = (c) => '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
const rgba = (c) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] === undefined ? 255 : c[3]) / 255})`;
const sameColor = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && (a[3] === undefined ? 255 : a[3]) === (b[3] === undefined ? 255 : b[3]);
function rgbToHsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx];
}
function hsvToRgb(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255); };
  return [f(5), f(3), f(1)];
}

export function openSpriteEditor(app, g, item, opts = {}) {
  const ed = { spr: null, err: null, layer: 0, frame: 0, tool: 'pencil', after: 'pencil', color: [0, 0, 0, 255], zoom: 0, ox: 0, oy: 0,
    onion: false, grid: true, playing: false, playTag: -1, sheet: null, hist: [], fut: [], saved: true, tl: [0, 0], sw: 0, hsv: [0, 0, 0] };
  const nav = makeNav();
  let cv = null, ctx = null, dpr = 1, CW = 0, CH = 0;
  const rer = () => { if (app.overlay === ov) app.render(); };
  const toast = (m) => app.toast(m);

  // ---------------------------------------------------------------- loading
  function ready(spr) {
    ed.spr = spr;
    const draw = spr.layers.map((l, i) => i).filter(i => !spr.layers[i].group);
    ed.layer = draw.length ? draw[draw.length - 1] : 0;
    // start with the darkest palette colour that isn't see-through
    const pal = spr.palette.filter(c => (c[3] === undefined ? 255 : c[3]) > 0);
    if (pal.length) ed.color = pal.reduce((a, c) => (c[0] + c[1] + c[2] < a[0] + a[1] + a[2] ? c : a)).slice();
    if (ed.color.length < 4) ed.color.push(255);
    ed.zoom = 0; rer();
  }
  if (opts.spr) Promise.resolve().then(() => { ready(opts.spr); save(); });   // after the screen below exists
  else store.openSprite(g.file, item, opts.ticksOf).then(ready).catch(e => { ed.err = e.message || String(e); rer(); });

  // ---------------------------------------------------------------- saving (on the phone, a moment after each change)
  let saveT = 0, saving = Promise.resolve();
  function extra() {
    const x = { ...(opts.extra || {}) };
    if (opts.sheetCols) x.sheetCols = opts.sheetCols;
    if (x.item) {
      // a new sprite: its entry in the Art list follows the drawing (frames, and its tags as animations)
      const spr = ed.spr, it = { ...x.item };
      if (it.cell) { it.cell = [spr.w, spr.h]; it.frames = spr.frames.length; it.anims = spr.tags.map(t => ({ name: t.name, from: t.from, count: t.to - t.from + 1, ticks: Math.max(1, Math.round((spr.frames[t.from].dur || 100) * 60 / 1000)) })); }
      x.item = it;
    }
    return x;
  }
  function save() {
    clearTimeout(saveT); saveT = 0;
    const spr = ed.spr; if (!spr) return saving;
    saving = saving.then(() => store.save(g.file, item, spr, extra())).then(() => { ed.saved = !saveT; status(); }).catch(e => toast('Could not save: ' + e.message));
    return saving;
  }
  function changed() { ed.saved = false; status(); clearTimeout(saveT); saveT = setTimeout(save, 700); }

  // ---------------------------------------------------------------- undo (each step keeps the old cels; cels are never changed in place once made)
  function snap() {
    const s = ed.spr;
    return { layers: s.layers.map(l => ({ ...l })), frames: s.frames.map(f => ({ ...f })), tags: s.tags.map(t => ({ ...t, color: t.color.slice() })),
      palette: s.palette.map(c => c.slice()), cels: new Map(s.cels), layer: ed.layer, frame: ed.frame };
  }
  function restore(x) {
    Object.assign(ed.spr, { layers: x.layers, frames: x.frames, tags: x.tags, palette: x.palette, cels: x.cels });
    ed.layer = Math.min(x.layer, x.layers.length - 1); ed.frame = Math.min(x.frame, x.frames.length - 1);
  }
  function step() { ed.hist.push(snap()); if (ed.hist.length > 200) ed.hist.shift(); ed.fut = []; }
  function undo() { if (!ed.hist.length) return; stop(); ed.fut.push(snap()); restore(ed.hist.pop()); changed(); rer(); }
  function redo() { if (!ed.fut.length) return; stop(); ed.hist.push(snap()); restore(ed.fut.pop()); changed(); rer(); }

  // ---------------------------------------------------------------- pictures of cels, for drawing (redrawn when a cel's pixels change)
  const pics = new WeakMap();
  function picOf(cel) {
    let p = pics.get(cel);
    if (!p) { const c = document.createElement('canvas'); c.width = ed.spr.w; c.height = ed.spr.h; p = { c, v: -1 }; pics.set(cel, p); }
    if (p.v !== (cel.v || 0)) { p.c.getContext('2d').putImageData(new ImageData(cel.data, ed.spr.w, ed.spr.h), 0, 0); p.v = cel.v || 0; }
    return p.c;
  }
  const filled = new WeakMap();
  function hasPixels(cel) {
    if (!cel) return false;
    const f = filled.get(cel); if (f && f.v === (cel.v || 0)) return f.on;
    let on = false; const d = cel.data; for (let i = 3; i < d.length; i += 4) if (d[i]) { on = true; break; }
    filled.set(cel, { v: cel.v || 0, on }); return on;
  }
  let frameC = null, tintC = null;
  // every visible layer of a frame onto a small canvas
  function frameCanvas(f, into) {
    const s = ed.spr; if (!into) { if (!frameC) { frameC = document.createElement('canvas'); } into = frameC; }
    into.width = s.w; into.height = s.h; const x = into.getContext('2d'); x.clearRect(0, 0, s.w, s.h);
    const vis = visibleLayers(s);
    s.layers.forEach((l, i) => {
      if (!vis[i] || l.group) return; const cel = s.cels.get(celKey(i, f)); if (!cel) return;
      x.globalAlpha = (l.opacity === undefined ? 255 : l.opacity) / 255 * (cel.opacity === undefined ? 255 : cel.opacity) / 255;
      x.drawImage(picOf(cel), 0, 0);
    });
    x.globalAlpha = 1; return into;
  }

  // ---------------------------------------------------------------- the view
  function fit() {
    const s = ed.spr; if (!s || !CW) return;
    let z = ZOOMS[0]; for (const k of ZOOMS) if (s.w * k <= CW * 0.92 && s.h * k <= CH * 0.92) z = k;
    ed.zoom = z; ed.ox = Math.round((CW - s.w * z) / 2); ed.oy = Math.round((CH - s.h * z) / 2);
  }
  let checker = null;
  function draw() {
    if (!ctx || !ed.spr) return;
    const s = ed.spr, z = ed.zoom, ox = Math.round(ed.ox * dpr) / dpr, oy = Math.round(ed.oy * dpr) / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, CW, CH); ctx.imageSmoothingEnabled = false;
    if (!checker) { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#3a3a40'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#2a2a2f'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); checker = ctx.createPattern(c, 'repeat'); }
    ctx.fillStyle = checker; ctx.fillRect(ox, oy, s.w * z, s.h * z);
    // onion skin: the frame before in red, the frame after in blue
    if (ed.onion && !ed.playing) {
      [[ed.frame - 1, 'rgba(255,70,70,1)'], [ed.frame + 1, 'rgba(70,140,255,1)']].forEach(([f, col]) => {
        if (f < 0 || f >= s.frames.length) return;
        if (!tintC) tintC = document.createElement('canvas');
        const c = frameCanvas(f, tintC), x = c.getContext('2d');
        x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.55; x.fillStyle = col; x.fillRect(0, 0, s.w, s.h); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
        ctx.globalAlpha = 0.35; ctx.drawImage(c, ox, oy, s.w * z, s.h * z); ctx.globalAlpha = 1;
      });
    }
    ctx.drawImage(frameCanvas(ed.frame), ox, oy, s.w * z, s.h * z);
    if (ed.grid && z >= 6) {
      ctx.beginPath();
      for (let x = 1; x < s.w; x++) { ctx.moveTo(ox + x * z + 0.5 / dpr, oy); ctx.lineTo(ox + x * z + 0.5 / dpr, oy + s.h * z); }
      for (let y = 1; y < s.h; y++) { ctx.moveTo(ox, oy + y * z + 0.5 / dpr); ctx.lineTo(ox + s.w * z, oy + y * z + 0.5 / dpr); }
      ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1 / dpr; ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1 / dpr; ctx.strokeRect(ox - 0.5 / dpr, oy - 0.5 / dpr, s.w * z + 1 / dpr, s.h * z + 1 / dpr);
  }

  // ---------------------------------------------------------------- drawing
  function blocked(l) {
    const L = ed.spr.layers[l];
    if (!L || L.group) return 'Pick a layer to draw on';
    if (!visibleLayers(ed.spr)[l]) return 'This layer is hidden';
    if (L.locked) return 'This layer is locked';
    return null;
  }
  let stroke = null;
  function editableCel() {
    const s = ed.spr, k = celKey(ed.layer, ed.frame), old = s.cels.get(k);
    const cel = { data: old ? old.data.slice() : new Uint8ClampedArray(s.w * s.h * 4), opacity: old ? old.opacity : 255, v: 1 };
    s.cels.set(k, cel); return cel;
  }
  function plot(x, y) {
    const s = ed.spr; if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    const i = y * s.w + x; if (stroke.done[i]) return; stroke.done[i] = 1;
    const d = stroke.cel.data, j = i * 4;
    if (ed.tool === 'eraser') { d[j] = d[j + 1] = d[j + 2] = d[j + 3] = 0; }
    else {
      const c = ed.color, sa = (c[3] === undefined ? 255 : c[3]) / 255, da = d[j + 3] / 255;
      if (sa >= 1 || !da) { d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = Math.round(sa * 255); }
      else { const oa = sa + da * (1 - sa); for (let k = 0; k < 3; k++) d[j + k] = Math.round((c[k] * sa + d[j + k] * da * (1 - sa)) / oa); d[j + 3] = Math.round(oa * 255); }
    }
    stroke.cel.v++;
  }
  function line(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { plot(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function fill(x, y) {
    const s = ed.spr; if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
    const old = s.cels.get(celKey(ed.layer, ed.frame)), src = old ? old.data : new Uint8ClampedArray(s.w * s.h * 4), j0 = (y * s.w + x) * 4;
    const t = [src[j0], src[j0 + 1], src[j0 + 2], src[j0 + 3]], c = ed.color;
    const same = (j) => (t[3] === 0 ? src[j + 3] === 0 : src[j] === t[0] && src[j + 1] === t[1] && src[j + 2] === t[2] && src[j + 3] === t[3]);
    if (t[3] && sameColor(t, c)) return false;
    step(); const cel = editableCel(), d = cel.data, seen = new Uint8Array(s.w * s.h), q = [x, y];
    while (q.length) {
      const yy = q.pop(), xx = q.pop(), i = yy * s.w + xx;
      if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h || seen[i] || !same(i * 4)) continue;
      seen[i] = 1; const j = i * 4; d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = c[3] === undefined ? 255 : c[3];
      q.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1);
    }
    return true;
  }
  function pick(x, y) {
    const s = ed.spr; if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    const d = flatten(s, ed.frame), j = (y * s.w + x) * 4;
    if (!d[j + 3]) { toast('Nothing there to pick'); return; }
    ed.color = [d[j], d[j + 1], d[j + 2], d[j + 3]]; ed.tool = ed.after; rer();
  }

  // ---------------------------------------------------------------- touch on the canvas
  const ptrs = new Map(); let gest = null, lock = false, panning = null, tap = null;   // tap: a fill or pick that happens when the finger lifts (unless it became a pinch)
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const cell = (p) => [Math.floor((p.x - ed.ox) / ed.zoom), Math.floor((p.y - ed.oy) / ed.zoom)];
  function down(e) {
    if (!ed.spr) return;
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* not a real pointer */ } ptrs.set(e.pointerId, at(e));
    if (ptrs.size === 2) {
      if (stroke) { restore(ed.hist.pop()); stroke = null; draw(); }   // the first finger's dot was the start of a pinch
      panning = null; tap = null;
      const [a, b] = [...ptrs.values()];
      gest = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z0: ed.zoom, ox0: ed.ox, oy0: ed.oy, t0: performance.now(), moved: false };
      return;
    }
    if (ptrs.size > 2 || lock) return;
    stop();
    const p = at(e), [x, y] = cell(p);
    if (ed.tool === 'pan') { panning = { p, ox: ed.ox, oy: ed.oy }; return; }
    if (ed.tool === 'picker' || ed.tool === 'fill') { tap = { x, y }; return; }
    const why = blocked(ed.layer); if (why) { toast(why); return; }
    step(); stroke = { cel: editableCel(), done: new Uint8Array(ed.spr.w * ed.spr.h), last: [x, y] };
    plot(x, y); draw();
  }
  function move(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, at(e));
    if (gest && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const want = gest.z0 * d / gest.d0; let z = ZOOMS[0]; for (const k of ZOOMS) if (Math.abs(Math.log(k / want)) < Math.abs(Math.log(z / want))) z = k;
      const ix = (gest.m0.x - gest.ox0) / gest.z0, iy = (gest.m0.y - gest.oy0) / gest.z0;
      ed.zoom = z; ed.ox = m.x - ix * z; ed.oy = m.y - iy * z;
      if (Math.abs(d - gest.d0) > 12 || Math.hypot(m.x - gest.m0.x, m.y - gest.m0.y) > 12) gest.moved = true;
      draw(); zoomLabel(); return;
    }
    if (panning) { const p = at(e); ed.ox = panning.ox + p.x - panning.p.x; ed.oy = panning.oy + p.y - panning.p.y; draw(); return; }
    if (stroke) { const [x, y] = cell(at(e)); if (x !== stroke.last[0] || y !== stroke.last[1]) { line(stroke.last[0], stroke.last[1], x, y); stroke.last = [x, y]; draw(); } }
  }
  function up(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (gest) {
      if (!ptrs.size) { if (!gest.moved && performance.now() - gest.t0 < 350 && e.type === 'pointerup') { undo(); toast('Undo'); } gest = null; lock = false; }
      else lock = true;   // one finger still down after a pinch: it doesn't draw
      return;
    }
    if (!ptrs.size) lock = false;
    panning = null;
    if (tap) {
      const t = tap; tap = null;
      if (ed.tool === 'picker') pick(t.x, t.y);
      else { const why = blocked(ed.layer); if (why) toast(why); else if (fill(t.x, t.y)) { draw(); strokeDone(); } }
      return;
    }
    if (stroke) { stroke = null; strokeDone(); }
  }
  function strokeDone() { changed(); paintCells(); }

  // ---------------------------------------------------------------- layers, frames and tags
  const S = () => ed.spr;
  function remapLayers(fn) { const m = new Map(); for (const [k, c] of S().cels) { const [l, f] = k.split(':').map(Number), n = fn(l); if (n >= 0) m.set(celKey(n, f), c); } S().cels = m; }
  function remapFrames(fn) { const m = new Map(); for (const [k, c] of S().cels) { const [l, f] = k.split(':').map(Number), n = fn(f); if (n >= 0) m.set(celKey(l, n), c); } S().cels = m; }
  const drawable = () => S().layers.filter(l => !l.group).length;
  function addLayer() {
    step(); const s = S(), at = ed.layer + 1, lv = s.layers[ed.layer] ? s.layers[ed.layer].level || 0 : 0;
    let n = s.layers.length + 1; while (s.layers.some(l => l.name === 'Layer ' + n)) n++;
    remapLayers(l => (l >= at ? l + 1 : l));
    s.layers.splice(at, 0, { name: 'Layer ' + n, visible: true, locked: false, opacity: 255, blend: 0, group: false, level: lv, bg: false });
    ed.layer = at; changed(); rer();
  }
  function delLayer() {
    const s = S(), L = s.layers[ed.layer];
    if (L.group) { toast('Groups can be changed in desktop Aseprite'); return; }
    if (drawable() < 2) { toast('A sprite needs one layer'); return; }
    step(); const at = ed.layer; remapLayers(l => (l === at ? -1 : l > at ? l - 1 : l)); s.layers.splice(at, 1);
    ed.layer = Math.max(0, at - 1); ed.sheet = null; changed(); rer();
  }
  function dupLayer() {
    const s = S(), L = s.layers[ed.layer]; if (L.group) { toast('Groups can be changed in desktop Aseprite'); return; }
    step(); const at = ed.layer, copies = [];
    for (const [k, c] of s.cels) { const [l, f] = k.split(':').map(Number); if (l === at) copies.push([f, c]); }
    remapLayers(l => (l > at ? l + 1 : l));
    s.layers.splice(at + 1, 0, { ...L, name: L.name + ' copy' });
    copies.forEach(([f, c]) => s.cels.set(celKey(at + 1, f), c));
    ed.layer = at + 1; changed(); rer();
  }
  const sibling = (a, b) => { const s = S(); return s.layers[a] && s.layers[b] && !s.layers[a].group && !s.layers[b].group && (s.layers[a].level || 0) === (s.layers[b].level || 0); };
  function moveLayer(dir) {
    const a = ed.layer, b = a + dir;
    if (!sibling(a, b)) { toast(dir > 0 ? 'Already at the top' : 'Already at the bottom'); return; }
    step(); const s = S(); [s.layers[a], s.layers[b]] = [s.layers[b], s.layers[a]];
    remapLayers(l => (l === a ? b : l === b ? a : l)); ed.layer = b; changed(); rer();
  }
  function mergeDown() {
    const a = ed.layer, b = a - 1;
    if (!sibling(a, b)) { toast('No layer below to merge into'); return; }
    step(); const s = S(), L = s.layers[a], B = s.layers[b];
    // each frame: the two layers blended (with their opacities) into one new cel on the layer below
    for (let f = 0; f < s.frames.length; f++) {
      const low = s.cels.get(celKey(b, f)), top = s.cels.get(celKey(a, f)); if (!low && !top) continue;
      const one = { w: s.w, h: s.h, layers: [{ ...B, visible: true, level: 0, group: false }, { ...L, visible: true, level: 0, group: false }], cels: new Map() };
      if (low) one.cels.set(celKey(0, f), low); if (top) one.cels.set(celKey(1, f), top);
      s.cels.set(celKey(b, f), { data: flatten(one, f), opacity: 255, v: 1 });
    }
    B.opacity = 255;
    remapLayers(l => (l === a ? -1 : l > a ? l - 1 : l)); s.layers.splice(a, 1); ed.layer = b; ed.sheet = null; changed(); rer();
  }
  function addFrame(empty) {
    step(); const s = S(), f = ed.frame, at = f + 1;
    const copies = []; if (!empty) for (const [k, c] of s.cels) { const [l, ff] = k.split(':').map(Number); if (ff === f) copies.push([l, c]); }
    remapFrames(x => (x >= at ? x + 1 : x));
    s.frames.splice(at, 0, { dur: s.frames[f].dur });
    copies.forEach(([l, c]) => s.cels.set(celKey(l, at), c));
    s.tags.forEach(t => { if (t.from > f) { t.from++; t.to++; } else if (t.to >= f) t.to++; });
    ed.frame = at; changed(); rer();
  }
  function delFrame() {
    const s = S(); if (s.frames.length < 2) { toast('A sprite needs one frame'); return; }
    step(); const f = ed.frame;
    remapFrames(x => (x === f ? -1 : x > f ? x - 1 : x)); s.frames.splice(f, 1);
    s.tags = s.tags.filter(t => { if (t.from > f) t.from--; if (t.to >= f) t.to--; return t.to >= t.from; });
    ed.frame = Math.min(f, s.frames.length - 1); changed(); rer();
  }
  function moveFrame(dir) {
    const s = S(), a = ed.frame, b = a + dir; if (b < 0 || b >= s.frames.length) return;
    step(); [s.frames[a], s.frames[b]] = [s.frames[b], s.frames[a]]; remapFrames(x => (x === a ? b : x === b ? a : x)); ed.frame = b; changed(); rer();
  }
  function addTag() {
    step(); const s = S(); s.tags.push({ name: 'Tag ' + (s.tags.length + 1), from: ed.frame, to: ed.frame, dir: 0, repeat: 0, color: TAG_COLORS[s.tags.length % TAG_COLORS.length].slice() });
    ed.sheet = { kind: 'tag', i: s.tags.length - 1 }; changed(); rer();
  }

  // ---------------------------------------------------------------- playback
  let playAt = 0, pong = 1;
  function play() {
    if (ed.playing) { stop(); return; }
    const s = S(); if (s.frames.length < 2) { toast('Add a frame to animate'); return; }
    ed.playing = true; playAt = performance.now(); pong = 1;
    const r = range(); if (ed.frame < r.from || ed.frame > r.to) ed.frame = r.dir === 1 ? r.to : r.from;
    rer();
  }
  function stop() { if (ed.playing) { ed.playing = false; rer(); } }
  const range = () => { const t = S().tags[ed.playTag]; return t ? t : { from: 0, to: S().frames.length - 1, dir: 0 }; };
  function tickPlay(now) {
    const s = S(), r = range();
    if (now - playAt < (s.frames[ed.frame].dur || 100)) return;
    playAt = now;
    let f = ed.frame;
    if (r.dir === 1) f = f - 1 < r.from ? r.to : f - 1;
    else if (r.dir === 2) { if (f + pong > r.to || f + pong < r.from) pong = -pong; f = Math.max(r.from, Math.min(r.to, f + pong)); }
    else f = f + 1 > r.to ? r.from : f + 1;
    ed.frame = f; draw(); markFrame();
  }

  // ---------------------------------------------------------------- small updates without drawing the whole screen again
  function status() { const el = document.getElementById('se-sub'); if (el) el.textContent = subLine(); }
  function zoomLabel() { const el = document.getElementById('se-zoom'); if (el) el.textContent = (ed.zoom < 1 ? ed.zoom : ed.zoom | 0) + '×'; }
  function markFrame() {
    document.querySelectorAll('#se-tl [data-f]').forEach(el => el.classList.toggle('cur', +el.dataset.f === ed.frame));
    status();
  }
  function paintCells() {
    const s = S();
    document.querySelectorAll('#se-tl .se-cel').forEach(el => { const [l, f] = el.dataset.c.split(':').map(Number); el.classList.toggle('on', hasPixels(s.cels.get(celKey(l, f)))); });
    const u = document.querySelector('[aria-label="Undo"]'), r = document.querySelector('[aria-label="Redo"]');
    if (u) u.disabled = !ed.hist.length; if (r) r.disabled = !ed.fut.length;
  }
  const subLine = () => { const s = ed.spr; if (!s) return ''; const r = store.record(g.file, item.id); return `${s.w}×${s.h} · frame ${ed.frame + 1}/${s.frames.length}` + (!ed.saved ? ' · saving…' : r && r.dirty ? ' · saved on phone' : ''); };

  // ---------------------------------------------------------------- pieces of the screen
  function setFrame(f) { stop(); if (f === ed.frame) ed.sheet = { kind: 'frame' }; else ed.frame = f; rer(); }
  function setLayer(l) { stop(); if (l === ed.layer) ed.sheet = { kind: 'layer' }; else ed.layer = l; rer(); }
  function setCell(l, f) { stop(); ed.layer = l; ed.frame = f; rer(); }
  function setTag(i) { if (ed.playTag === i) ed.sheet = { kind: 'tag', i }; else { ed.playTag = i; const t = S().tags[i]; stop(); ed.frame = t.from; } rer(); }
  function setColor(c) { ed.color = c.slice(); if (ed.color.length < 4) ed.color.push(255); if (ed.tool !== 'pencil' && ed.tool !== 'fill') ed.tool = 'pencil'; rer(); }
  function setTool(t) { if (t === 'picker' && ed.tool !== 'picker') ed.after = ed.tool === 'eraser' || ed.tool === 'pan' ? 'pencil' : ed.tool; ed.tool = t; rer(); }

  const swatch = (c, size) => `<span class="se-sw" style="width:${size}px;height:${size}px"><span style="background:${rgba(c)}"></span></span>`;

  function timeline() {
    const s = ed.spr, n = s.frames.length, vis = visibleLayers(s);
    // tags in lanes, so overlapping ones stack
    const lanes = []; const tagLane = s.tags.map(t => { let k = 0; while ((lanes[k] || []).some(o => !(t.to < o.from || t.from > o.to))) k++; (lanes[k] = lanes[k] || []).push(t); return k; });
    const nl = Math.max(1, lanes.length), cols = `grid-template-columns:var(--se-lc) repeat(${n},var(--se-fw))`;
    let h = `<div class="se-grid" style="${cols};grid-template-rows:repeat(${nl},14px) 20px repeat(${s.layers.length},28px)">`;
    h += `<span class="se-corner" style="grid-row:1/${nl + 2}">${s.tags.length ? 'Tags' : ''}</span>`;
    s.tags.forEach((t, i) => {
      h += `<button class="se-tag${ed.playTag === i ? ' sel' : ''}" style="top:${tagLane[i] * 14}px;grid-row:${tagLane[i] + 1};grid-column:${t.from + 2}/${t.to + 3};--tc:${rgbHex(t.color)}" ${A(() => setTag(i))} aria-label="Tag ${esc(t.name)}">${esc(t.name)}</button>`;
    });
    for (let f = 0; f < n; f++) h += `<button class="se-fh${f === ed.frame ? ' cur' : ''}" data-f="${f}" style="top:${nl * 14}px;grid-row:${nl + 1};grid-column:${f + 2}" ${A(() => setFrame(f))} aria-label="Frame ${f + 1}">${f + 1}</button>`;
    for (let r = 0; r < s.layers.length; r++) {
      const l = s.layers.length - 1 - r, L = s.layers[l], row = nl + 2 + r;
      h += `<div class="se-ln${l === ed.layer ? ' sel' : ''}" style="grid-row:${row}">
        <button class="se-eye" ${A(() => { step(); L.visible = !L.visible; changed(); rer(); })} aria-label="${L.visible ? 'Hide' : 'Show'} ${esc(L.name)}">${svgRows(L.visible ? EYE : EYE_OFF, vis[l] ? '#e4e2dc' : '#6f6d69')}</button>
        <button class="se-lname" style="padding-left:${4 + (L.level || 0) * 8}px" ${A(() => setLayer(l))} aria-pressed="${l === ed.layer}">${L.group ? svgRows(['1110000', '1111111', '1000001', '1000001', '1111111'], '#9a98a0') + ' ' : ''}${esc(L.name)}${L.locked ? ' ' + svgRows(LOCK, '#9a98a0') : ''}</button>
      </div>`;
      for (let f = 0; f < n; f++) {
        if (L.group) { h += `<span class="se-cel grp" style="grid-row:${row};grid-column:${f + 2}"></span>`; continue; }
        h += `<button class="se-cel${hasPixels(s.cels.get(celKey(l, f))) ? ' on' : ''}${l === ed.layer ? ' lrow' : ''}${f === ed.frame ? ' cur' : ''}" data-f="${f}" data-c="${l}:${f}" style="grid-row:${row};grid-column:${f + 2}" ${A(() => setCell(l, f))} aria-label="${esc(L.name)}, frame ${f + 1}"></button>`;
      }
    }
    return h + '</div>';
  }

  function sheetHtml() {
    const sh = ed.sheet; if (!sh) return '';
    const s = ed.spr, close = iconBtn('check', A(() => { ed.sheet = null; rer(); }), { color: '#fff', label: 'Done' });
    const head = (t, sub) => `<div class="ihead">${well(40, icon(sh.kind === 'color' ? 'paint' : sh.kind === 'tag' ? 'events' : sh.kind === 'frame' ? 'scene' : sh.kind === 'layer' ? 'tiles' : 'display', PINK))}<span class="t"><span class="title acc ell">${esc(t)}</span><span class="sub ell">${esc(sub)}</span></span>${close}</div>`;
    const btns = (list) => `<div class="se-btns">${list.map(([ic, label, fn, dis]) => `<button class="btn bare" ${A(fn)}${dis ? ' disabled' : ''}>${well(28, icon(ic, '#e4e2dc'))}<span>${esc(label)}</span></button>`).join('')}</div>`;
    const field = (id, val, label) => `<label class="se-field"><span class="cap">${esc(label)}</span><input id="${id}" value="${esc(val)}" maxlength="40" autocomplete="off" spellcheck="false"></label>`;
    let body = '';
    if (sh.kind === 'color') {
      body = head('Colour', rgbHex(ed.color).toUpperCase() + ' · ' + Math.round((ed.color[3] / 255) * 100) + '% solid') + `
        <canvas id="se-sv" class="se-pick" style="height:120px"></canvas>
        <canvas id="se-hue" class="se-pick" style="height:24px"></canvas>
        <canvas id="se-alpha" class="se-pick" style="height:24px"></canvas>
        <div class="se-hexrow">${swatch(ed.color, 40)}<label class="se-field" style="flex:1"><span class="cap">Hex</span><input id="se-hex" value="${rgbHex(ed.color).slice(1).toUpperCase()}" maxlength="8" autocomplete="off" spellcheck="false"></label></div>
        ${btns([['plus', 'Add to palette', () => { if (s.palette.some(c => sameColor(c, ed.color))) { toast('Already in the palette'); return; } step(); s.palette.push(ed.color.slice()); ed.sw = 1e6; changed(); rer(); }],
          ['trash', 'Remove from palette', () => { const i = s.palette.findIndex(c => sameColor(c, ed.color)); if (i < 0) { toast('This colour is not in the palette'); return; } step(); s.palette.splice(i, 1); changed(); rer(); }]])}`;
    } else if (sh.kind === 'layer') {
      const L = s.layers[ed.layer];
      body = head('Layer · ' + L.name, L.group ? 'A group (from desktop Aseprite)' : 'Layer ' + (ed.layer + 1) + ' of ' + s.layers.length) + field('se-lname', L.name, 'Name') + `
        <div class="grow"><span class="t"><span class="cap">Visible</span><span class="sub">Hidden layers are left out of the game's picture</span></span>${toggle(L.visible, A(() => { step(); L.visible = !L.visible; changed(); rer(); }), 'Visible')}</div>
        <div class="grow"><span class="t"><span class="cap">Locked</span><span class="sub">No drawing on it</span></span>${toggle(L.locked, A(() => { step(); L.locked = !L.locked; changed(); rer(); }), 'Locked')}</div>
        <div class="grow"><span class="t"><span class="cap">Opacity</span><span class="sub">How solid the whole layer is</span></span>${stepper(Math.round(L.opacity / 2.55) + '%', A(() => { step(); L.opacity = Math.max(0, Math.round(L.opacity - 25.5)); changed(); rer(); }), A(() => { step(); L.opacity = Math.min(255, Math.round(L.opacity + 25.5)); changed(); rer(); }), 'opacity')}</div>
        ${btns([['up', 'Move up', () => moveLayer(1)], ['down', 'Move down', () => moveLayer(-1)], ['dup', 'Duplicate', dupLayer], ['down', 'Merge down', mergeDown], ['plus', 'New layer', addLayer], ['trash', 'Delete', () => { if (confirm('Delete the layer ' + L.name + '?')) delLayer(); }]])}`;
    } else if (sh.kind === 'frame') {
      const fr = s.frames[ed.frame], expect = item.cell && !opts.extra ? item.frames : 0;
      body = head('Frame ' + (ed.frame + 1), s.frames.length + (s.frames.length === 1 ? ' frame' : ' frames') + (expect && expect !== s.frames.length ? ' · the game expects ' + expect : '')) + `
        <div class="grow"><span class="t"><span class="cap">Duration</span><span class="sub">How long it shows when playing here</span></span>${stepper(fr.dur + 'MS', A(() => { step(); fr.dur = Math.max(10, fr.dur - (fr.dur > 200 ? 50 : 10)); changed(); rer(); }), A(() => { step(); fr.dur = Math.min(65535, fr.dur + (fr.dur >= 200 ? 50 : 10)); changed(); rer(); }), 'duration', true)}</div>
        ${btns([['dup', 'Duplicate', () => addFrame(false)], ['plus', 'New empty', () => addFrame(true)], ['left', 'Move left', () => moveFrame(-1), ed.frame === 0], ['right', 'Move right', () => moveFrame(1), ed.frame === s.frames.length - 1], ['events', 'Tag from here', addTag], ['trash', 'Delete', () => { ed.sheet = null; delFrame(); }, s.frames.length < 2]])}
        ${item.cell ? '' : `<div class="se-note sub">The game shows frame 1 of this picture.</div>`}`;
    } else if (sh.kind === 'tag') {
      const t = s.tags[sh.i]; if (!t) { ed.sheet = null; return ''; }
      const n = s.frames.length;
      body = head('Tag · ' + t.name, 'Frames ' + (t.from + 1) + ' to ' + (t.to + 1)) + field('se-tname', t.name, 'Name') + `
        <div class="grow"><span class="t"><span class="cap">From</span></span>${stepper(String(t.from + 1), A(() => { step(); t.from = Math.max(0, t.from - 1); changed(); rer(); }), A(() => { step(); t.from = Math.min(t.to, t.from + 1); changed(); rer(); }), 'start frame')}</div>
        <div class="grow"><span class="t"><span class="cap">To</span></span>${stepper(String(t.to + 1), A(() => { step(); t.to = Math.max(t.from, t.to - 1); changed(); rer(); }), A(() => { step(); t.to = Math.min(n - 1, t.to + 1); changed(); rer(); }), 'end frame')}</div>
        <div class="grow"><span class="t"><span class="cap">Direction</span></span>${stepper(DIRS[t.dir || 0], A(() => { step(); t.dir = ((t.dir || 0) + 2) % 3; changed(); rer(); }), A(() => { step(); t.dir = ((t.dir || 0) + 1) % 3; changed(); rer(); }), 'direction', true)}</div>
        ${btns([[ed.playing && ed.playTag === sh.i ? 'pause' : 'play', ed.playing && ed.playTag === sh.i ? 'Stop' : 'Play it', () => { ed.playTag = sh.i; play(); }],
          ['paint', 'Colour', () => { step(); const k = TAG_COLORS.findIndex(c => sameColor(c, t.color)); t.color = TAG_COLORS[(k + 1) % TAG_COLORS.length].slice(); changed(); rer(); }],
          ['select', 'Play all frames', () => { ed.playTag = -1; ed.sheet = null; rer(); }, ed.playTag === -1],
          ['trash', 'Delete', () => { step(); s.tags.splice(sh.i, 1); if (ed.playTag >= s.tags.length) ed.playTag = -1; ed.sheet = null; changed(); rer(); }]])}`;
    } else if (sh.kind === 'menu') {
      const r = store.record(g.file, item.id);
      body = head(item.name, s.w + '×' + s.h + ' · ' + s.frames.length + ' frames · ' + s.layers.length + ' layers') + `
        <div class="grow"><span class="t"><span class="cap">Pixel grid</span><span class="sub">Lines between pixels when zoomed in</span></span>${toggle(ed.grid, A(() => { ed.grid = !ed.grid; rer(); }), 'Pixel grid')}</div>
        <div class="grow"><span class="t"><span class="cap">Onion skin</span><span class="sub">The frames before (red) and after (blue)</span></span>${toggle(ed.onion, A(() => { ed.onion = !ed.onion; rer(); }), 'Onion skin')}</div>
        <div class="se-note sub">${r && r.dirty ? 'Saved on this phone, not pushed yet. Push it from Settings › Sync.' : r ? 'Pushed. The site shows it in a minute or two.' : 'Matches GitHub.'} Saved as ${esc(store.asePath(item.file).split('/').pop())} (opens in Aseprite) and ${esc(item.file.split('/').pop())} (what the game reads).</div>
        ${btns([['select', 'Fit to screen', () => { fit(); ed.sheet = null; rer(); }], ['trash', r && r.isNew ? 'Delete sprite' : 'Discard changes', async () => {
          if (!r) { toast('Nothing to discard'); return; }
          if (!confirm(r.isNew ? 'Delete ' + item.name + '? It has not been pushed.' : 'Discard the changes to ' + item.name + '? It goes back to the version on GitHub.')) return;
          clearTimeout(saveT); saveT = 0; await saving; await store.discard(g.file, item.id); ed.discarded = true; app.close();
        }, !r]])}`;
    }
    return `<div class="plate se-sheet inspector">${body}</div>`;
  }

  // ---------------------------------------------------------------- the colour picker's three bars
  function pickerMount(root) {
    const sv = root.querySelector('#se-sv'), hue = root.querySelector('#se-hue'), al = root.querySelector('#se-alpha'), hx = root.querySelector('#se-hex');
    if (!sv) return;
    ed.hsv = rgbToHsv(ed.color);
    const size = (c) => { const r = c.getBoundingClientRect(); c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); return [c.width, c.height]; };
    function paint() {
      const [h, s, v] = ed.hsv;
      let [w, hh] = size(sv), x = sv.getContext('2d');
      const g1 = x.createLinearGradient(0, 0, w, 0); g1.addColorStop(0, '#fff'); g1.addColorStop(1, rgbHex(hsvToRgb(h, 1, 1))); x.fillStyle = g1; x.fillRect(0, 0, w, hh);
      const g2 = x.createLinearGradient(0, 0, 0, hh); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, '#000'); x.fillStyle = g2; x.fillRect(0, 0, w, hh);
      ring(x, s * w, (1 - v) * hh);
      [w, hh] = size(hue); x = hue.getContext('2d');
      const g3 = x.createLinearGradient(0, 0, w, 0); for (let k = 0; k <= 6; k++) g3.addColorStop(k / 6, rgbHex(hsvToRgb(k * 60, 1, 1))); x.fillStyle = g3; x.fillRect(0, 0, w, hh);
      ring(x, h / 360 * w, hh / 2);
      [w, hh] = size(al); x = al.getContext('2d');
      for (let i = 0; i * 8 * dpr < w; i++) for (let j = 0; j * 8 * dpr < hh; j++) { x.fillStyle = (i + j) % 2 ? '#3a3a40' : '#2a2a2f'; x.fillRect(i * 8 * dpr, j * 8 * dpr, 8 * dpr, 8 * dpr); }
      const c = ed.color, g4 = x.createLinearGradient(0, 0, w, 0); g4.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0)`); g4.addColorStop(1, `rgb(${c[0]},${c[1]},${c[2]})`); x.fillStyle = g4; x.fillRect(0, 0, w, hh);
      ring(x, c[3] / 255 * w, hh / 2);
      root.querySelectorAll('.se-hexrow .se-sw > span, #se-cur .se-sw > span').forEach(el => { el.style.background = rgba(c); });
      if (document.activeElement !== hx) hx.value = rgbHex(c).slice(1).toUpperCase() + (c[3] < 255 ? hex2(c[3]).toUpperCase() : '');
      const t = root.querySelector('.se-sheet .ihead .sub'); if (t) t.textContent = rgbHex(c).toUpperCase() + ' · ' + Math.round(c[3] / 2.55) + '% solid';
    }
    function ring(x, cx, cy) { x.lineWidth = 2 * dpr; x.strokeStyle = '#000'; x.beginPath(); x.arc(cx, cy, 6 * dpr, 0, 7); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 1.5 * dpr; x.beginPath(); x.arc(cx, cy, 5 * dpr, 0, 7); x.stroke(); }
    const drag = (el, fn) => {
      const go = (e) => { const r = el.getBoundingClientRect(); fn(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))); paint(); };
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); go(e); el.onpointermove = go; });
      el.addEventListener('pointerup', () => { el.onpointermove = null; });
    };
    const apply = () => { const [h, s, v] = ed.hsv; ed.color = [...hsvToRgb(h, s, v), ed.color[3]]; };
    drag(sv, (x, y) => { ed.hsv[1] = x; ed.hsv[2] = 1 - y; apply(); });
    drag(hue, (x) => { ed.hsv[0] = Math.min(359.9, x * 360); apply(); });
    drag(al, (x) => { ed.color[3] = Math.round(x * 255); });
    hx.addEventListener('input', () => {
      const m = hx.value.trim().replace(/^#/, '').match(/^([0-9a-f]{6})([0-9a-f]{2})?$/i); if (!m) return;
      const n = parseInt(m[1], 16); ed.color = [n >> 16 & 255, n >> 8 & 255, n & 255, m[2] ? parseInt(m[2], 16) : 255]; ed.hsv = rgbToHsv(ed.color); paint();
    });
    paint();
  }

  // ---------------------------------------------------------------- the screen
  const ov = {
    render() {
      const s = ed.spr;
      const top = `<div class="plate bar">
        ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back to Art' })}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">${esc(item.name)}</span><span class="sub ell" id="se-sub">${s ? esc(subLine()) : ed.err ? 'Could not open: ' + esc(ed.err) : 'Opening…'}</span></span>
        ${iconBtn('undo', A(undo), { color: '#fff', label: 'Undo', disabled: !ed.hist.length })}
        ${iconBtn('redo', A(redo), { color: '#fff', label: 'Redo', disabled: !ed.fut.length })}
        ${iconBtn(null, A(() => { ed.sheet = ed.sheet && ed.sheet.kind === 'menu' ? null : { kind: 'menu' }; rer(); }), { color: '#fff', label: 'Sprite settings', rows: DOTS })}
      </div>`;
      if (!s) return `<div class="screen-tool sprite-ed" style="--acc:${PINK}"><h1 class="sr">Draw · ${esc(item.name)}</h1>${top}<div class="screen fit se-view"><span class="sub">${ed.err ? esc(ed.err) : 'Opening…'}</span></div></div>`;
      const tools = `<div class="plate bar se-tools" role="toolbar" aria-label="Tools">
        <div style="display:flex;gap:2px">${TOOLS.map(([t, label]) => iconBtn(null, A(() => setTool(t)), { on: ed.tool === t, label, pressed: ed.tool === t, rows: TOOL_ICONS[t] })).join('')}</div>
        <div style="display:flex;gap:2px">${iconBtn('grid', A(() => { ed.grid = !ed.grid; rer(); }), { on: ed.grid, label: 'Pixel grid', pressed: ed.grid })}</div>
      </div>`;
      const colors = `<div class="plate bar se-colors">
        <button class="se-cur" id="se-cur" ${A(() => { ed.sheet = ed.sheet && ed.sheet.kind === 'color' ? null : { kind: 'color' }; rer(); })} aria-label="Colour ${rgbHex(ed.color)}, change it">${swatch(ed.color, 36)}</button>
        <div class="se-pal" id="se-pal">${s.palette.map((c, i) => `<button class="se-pc${sameColor(c, ed.color) ? ' sel' : ''}" ${A(() => setColor(c))} aria-label="Palette colour ${i + 1}">${swatch(c, 24)}</button>`).join('')}</div>
      </div>`;
      const tl = `<div class="plate se-tl">
        <div class="se-tlbar">
          ${iconBtn(ed.playing ? 'pause' : 'play', A(play), { color: '#fff', label: ed.playing ? 'Stop' : 'Play' })}
          ${iconBtn('left', A(() => setCell(ed.layer, (ed.frame + s.frames.length - 1) % s.frames.length)), { color: '#fff', label: 'Previous frame' })}
          ${iconBtn('right', A(() => setCell(ed.layer, (ed.frame + 1) % s.frames.length)), { color: '#fff', label: 'Next frame' })}
          ${iconBtn(null, A(() => { ed.onion = !ed.onion; rer(); }), { on: ed.onion, label: 'Onion skin', pressed: ed.onion, rows: ONION })}
          <span style="flex:1"></span>
          ${iconBtn('dup', A(() => addFrame(false)), { label: 'New frame (a copy of this one)' })}
          ${iconBtn('tiles', A(addLayer), { label: 'New layer' })}
          ${iconBtn('events', A(addTag), { label: 'New tag' })}
        </div>
        <div class="se-scroll" id="se-tl">${timeline()}</div>
      </div>`;
      return `<div class="screen-tool sprite-ed" style="--acc:${PINK}">
        <h1 class="sr">Draw · ${esc(item.name)}</h1>
        ${top}
        <div class="screen fit se-view"><canvas class="pix" id="se-cv" role="img" aria-label="${esc(item.name)}, frame ${ed.frame + 1}"></canvas>
          <button class="se-zoom" id="se-zoom" ${A(() => { fit(); draw(); zoomLabel(); })} aria-label="Fit the sprite on screen">${ed.zoom < 1 ? ed.zoom : ed.zoom | 0}×</button></div>
        ${tools}${colors}${tl}${sheetHtml()}
      </div>`;
    },
    mount(root) {
      dpr = window.devicePixelRatio || 1;
      cv = root.querySelector('#se-cv');
      if (cv) {
        const box = cv.parentElement.getBoundingClientRect();
        CW = Math.max(1, box.width - 3); CH = Math.max(1, box.height - 3);
        cv.style.width = CW + 'px'; cv.style.height = CH + 'px'; cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr);
        ctx = cv.getContext('2d');
        if (!ed.zoom) fit();
        cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
        cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
        draw(); zoomLabel();
      }
      // keep where the timeline and palette were scrolled to
      const tl = root.querySelector('#se-tl'), pal = root.querySelector('#se-pal');
      if (tl) {
        tl.scrollLeft = ed.tl[0]; tl.scrollTop = ed.tl[1];
        const fw = 22, lc = 108, x = lc + ed.frame * fw;   // the current frame stays in view
        if (x < tl.scrollLeft + lc) tl.scrollLeft = x - lc; else if (x + fw > tl.scrollLeft + tl.clientWidth) tl.scrollLeft = x + fw - tl.clientWidth;
        tl.addEventListener('scroll', () => { ed.tl = [tl.scrollLeft, tl.scrollTop]; }, { passive: true });
      }
      if (pal) { pal.scrollLeft = ed.sw; pal.addEventListener('scroll', () => { ed.sw = pal.scrollLeft; }, { passive: true }); }
      const nm = root.querySelector('#se-lname'), tn = root.querySelector('#se-tname');
      if (nm) nm.addEventListener('change', () => { const v = nm.value.trim(); if (v && v !== S().layers[ed.layer].name) { step(); S().layers[ed.layer].name = v; changed(); rer(); } });
      if (tn) tn.addEventListener('change', () => { const t = S().tags[ed.sheet.i], v = tn.value.trim(); if (t && v && v !== t.name) { step(); t.name = v; changed(); rer(); } });
      if (ed.sheet && ed.sheet.kind === 'color') pickerMount(root);
    },
    frame(t) {
      if (ed.playing && ed.spr) tickPlay(performance.now());
      if (input.pressed('b')) { if (ed.sheet) { ed.sheet = null; rer(); } else app.close(); }
      else padFrame(document.getElementById('app'), nav, input);
    },
    onClose() { if (saveT && !ed.discarded) save(); if (opts.onClose) saving.then(opts.onClose); }
  };
  app.open(ov);
}

// icons only the editor uses
const EYE = ['0000000', '0111110', '1100011', '1011101', '1100011', '0111110', '0000000'];
const EYE_OFF = ['1000000', '0111110', '1110011', '1011101', '1100111', '0111110', '0000001'];
const LOCK = ['01110', '10001', '11111', '11011', '11111'];
const ONION = ['1010100', '0000000', '0011111', '0010001', '0010001', '0010001', '0011111'];
const DOTS = ['0000000', '0000000', '1101011', '1101011', '0000000', '0000000', '0000000'];
const TOOL_ICONS = {
  pencil: ['0000011', '0000111', '0001110', '0011100', '0111000', '1110000', '1100000'],
  eraser: ['0001100', '0011110', '0111111', '1111110', '1011100', '1111000', '0000000'],
  fill: ['0011000', '0100100', '1000010', '1111111', '0111110', '0011100', '0000001'],
  picker: ['0000110', '0001111', '0001111', '0011100', '0101000', '1010000', '1100000'],
  pan: ['0101010', '0101010', '0111110', '1111110', '0111110', '0111100', '0011100']
};
