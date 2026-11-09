// The sprite editor (Art tab): draw a game's pictures, Aseprite style, by touch.
//
// Screen, top to bottom: the top bar (back, layer and size, undo, redo, ⋯ Sprite menu); the canvas; the tools (like the
// Studio's tabs: the chosen one shows its name); a context bar (the palette, or while selecting the selection's buttons, or
// while pixels float how to change them); the timeline. Settings open as a sheet over the lower half.
// Controller: the ring moves over the buttons (not the timeline cells); LB/RB step frames, Start plays, X undoes, B goes back.
// Canvas: one finger uses the tool; two fingers pinch to zoom and drag to move; a quick two-finger tap undoes.
// Tools: pencil, eraser, fill, picker, select (box, lasso, magic wand; NEW, ADD or SUB), move, hand.
// Selecting: drawing stays inside the selection. Move lifts the selected pixels (or the whole layer) so they float; while they
// float they can be flipped, turned and scaled (always from the original, so nothing is lost), and they are put down when you
// draw, change frame or layer, or press Drop. Copy, cut and paste work between sprites.
// Timeline (like Aseprite's): layers down the side (top layer first), frames across, a dot where a cel has pixels. Tap a cell to
// go there; tap the current frame, layer or tag again for its settings; the + buttons add a tag, a frame or a layer.
// Sprite menu: Canvas (size with an anchor, trim, crop, scale, flip or turn everything), Import (a picture comes in floating;
// an .aseprite replaces the sprite) and Export (PNG frame or sheet, GIF, .aseprite, through the share sheet).
// Everything is saved on the phone as you go (artStore.js: an .aseprite file plus the PNG the game reads) and pushed from Sync.
import { well, icon, svgRows, svgText, G } from '../pixel.js';
import { A, esc, iconBtn, stepper, toggle, bareBtn } from '../ui.js';
import * as input from '../input.js';
import { makeNav, padFrame } from '../padnav.js';
import { celKey, flatten, visibleLayers, readAse, writeAse } from '../ase.js';
import * as store from '../artStore.js';
import * as SEL from '../spriteSel.js';
import { encodeGif } from '../gif.js';

let CLIP = null;   // copied pixels { data, w, h, mask, x, y }, kept while the app is open so they can go to another sprite

const PINK = '#ff4fd8';
const ZOOMS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 64];
const TOOLS = [['pencil', 'Pencil'], ['eraser', 'Eraser'], ['fill', 'Fill'], ['shade', 'Shade'], ['shape', 'Shape'], ['picker', 'Picker'], ['select', 'Select'], ['move', 'Move'], ['pan', 'Hand']];
const TOOL_HELP = { pencil: 'Pencil', eraser: 'Eraser', fill: 'Fill', shade: 'Shade: step pixels along the palette', shape: 'Shapes: line, box, oval', picker: 'Pick a colour', select: 'Select', move: 'Move pixels', pan: 'Hand: move the view' };
const TOOL_ICON = { pencil: 'pencil', eraser: 'eraser', fill: 'fill', shade: 'shade', shape: 'shapes', picker: 'picker', select: 'selectTool', move: 'movePixels', pan: 'pan' };
const SHAPE_KINDS = [['line', 'Line', 'shapeLine'], ['box', 'Box', 'shapeBox'], ['boxF', 'Filled box', 'shapeBoxF'], ['oval', 'Oval', 'shapeOval'], ['ovalF', 'Filled oval', 'shapeOvalF']];
const SHAPE_ICON = { box: 'boxSelect', lasso: 'lasso', wand: 'wand' };
const SHAPES = [['box', 'Box select'], ['lasso', 'Lasso select'], ['wand', 'Magic wand: select a colour']];
const MODES = ['Replace the selection', 'Add to the selection', 'Take away from the selection'], MODE_TEXT = ['NEW', 'ADD', 'SUB'];
const DIRS = ['FORWARD', 'REVERSE', 'PING-PONG'];
const TAG_COLORS = [[255, 90, 31], [125, 255, 106], [255, 79, 216], [77, 124, 255], [255, 210, 63], [180, 180, 180]];

const hex2 = (n) => n.toString(16).padStart(2, '0');
export const rgbHex = (c) => '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
const rgba = (c) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] === undefined ? 255 : c[3]) / 255})`;
const op = (x) => (x.opacity === undefined ? 255 : x.opacity);   // a layer's or cel's opacity, 0-255
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

// ---- palettes
const hexList = (t) => t.trim().split(/\s+/).map(h => { const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 255]; });
const PRESETS = [
  ['PICO-8', hexList('000000 1D2B53 7E2553 008751 AB5236 5F574F C2C3C7 FFF1E8 FF004D FFA300 FFEC27 00E436 29ADFF 83769C FF77A8 FFCCAA')],
  ['Sweetie 16', hexList('1A1C2C 5D275D B13E53 EF7D57 FFCD75 A7F070 38B764 257179 29366F 3B5DC9 41A6F6 73EFF7 F4F4F4 94B0C2 566C86 333C57')],
  ['Game Boy', hexList('0F380F 306230 8BAC0F 9BBC0F')],
  ['Hedron', hexList('000000 3A3A3F 8A8A90 E4E2DC FF5A1F 7DFF6A FF4FD8 4D7CFF FFD23F')]
];
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
// the next colour along a ramp: the palette neighbour (left or right) of the same family that is darker (dir -1) or lighter (dir 1)
function rampStep(pal, c, dir) {
  const i = pal.findIndex(p => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]);
  if (i < 0) return null;
  const [h, sat] = rgbToHsv(c), L = lum(c);
  const kin = (p) => { const [h2, s2] = rgbToHsv(p); const dh = Math.min(Math.abs(h - h2), 360 - Math.abs(h - h2)); return dh <= 50 || sat < 0.15 || s2 < 0.15; };
  for (const j of [i - 1, i + 1]) { const p = pal[j]; if (p && (p[3] === undefined || p[3] > 0) && kin(p) && (dir < 0 ? lum(p) < L : lum(p) > L)) return p; }
  return null;
}
// five shades around a colour: darker ones turn cooler and richer, lighter ones warmer and paler (the usual pixel-art ramp)
function makeRamp(c) {
  const [h, s, v] = rgbToHsv(c), out = [];
  const toward = (h0, t, deg) => { let d = ((t - h0 + 540) % 360) - 180; return (h0 + Math.sign(d) * Math.min(Math.abs(d), deg) + 360) % 360; };
  for (let k = -2; k <= 2; k++) {
    if (!k) { out.push([c[0], c[1], c[2], 255]); continue; }
    const a = Math.abs(k), dark = k < 0, hh = s < 0.05 ? h : toward(h, dark ? 250 : 60, 12 * a);
    const ss = Math.max(0, Math.min(1, s + (dark ? 0.1 : -0.14) * a)), vv = dark ? v * (1 - 0.24 * a) : Math.min(1, v + (1 - v) * 0.4 * a + 0.04 * a);
    out.push([...hsvToRgb(hh, ss, vv), 255]);
  }
  return out;
}
// palette files: .hex (one colour per line), .gpl (GIMP), .pal (JASC), or a picture (its colours in reading order)
function parsePaletteText(t) {
  const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean), out = [];
  if (/^JASC-PAL/i.test(lines[0] || '')) { for (const l of lines.slice(3)) { const m = l.match(/^(\d+)\s+(\d+)\s+(\d+)/); if (m) out.push([+m[1], +m[2], +m[3], 255]); } return out; }
  if (/^GIMP Palette/i.test(lines[0] || '')) { for (const l of lines.slice(1)) { const m = l.match(/^(\d+)\s+(\d+)\s+(\d+)/); if (m) out.push([+m[1], +m[2], +m[3], 255]); } return out; }
  for (const l of lines) { const m = l.match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i); if (m) out.push(hexList(m[1])[0]); }
  return out;
}

export function openSpriteEditor(app, g, item, opts = {}) {
  const ed = { spr: null, err: null, layer: 0, frame: 0, tool: 'pencil', after: 'pencil', color: [0, 0, 0, 255], zoom: 0, ox: 0, oy: 0,
    onion: false, grid: true, shadeDir: -1, recolor: true, shapeKind: 0, playing: false, playTag: -1, sheet: null, hist: [], fut: [], saved: true, tl: [0, 0], sw: 0, hsv: [0, 0, 0],
    sel: null, float: null, shape: 'box', mode: 0, contiguous: true, preview: null,
    cv: null, exScale: 4, exCols: 0, out: null, gameCols: opts.sheetCols || 0 };
  const nav = makeNav();
  let cv = null, ctx = null, dpr = 1, CW = 0, CH = 0;
  const rer = () => { if (app.overlay === ov) app.render(); };
  const toast = (m) => app.toast(m);

  // ---------------------------------------------------------------- loading
  function ready(spr) {
    ed.spr = spr;
    const usable = spr.layers.map((l, i) => i).filter(i => !spr.layers[i].group);
    ed.layer = usable.length ? usable[usable.length - 1] : 0;   // the top layer you can draw on
    // start with the darkest palette colour that isn't see-through
    const pal = spr.palette.filter(c => (c[3] === undefined ? 255 : c[3]) > 0);
    if (pal.length) ed.color = pal.reduce((a, c) => (c[0] + c[1] + c[2] < a[0] + a[1] + a[2] ? c : a)).slice();
    if (ed.color.length < 4) ed.color.push(255);
    ed.zoom = 0; rer();
    try { if (!localStorage.getItem('ha.se.hint')) { localStorage.setItem('ha.se.hint', '1'); setTimeout(() => toast('Pinch to zoom · two-finger drag to pan · two-finger tap to undo'), 400); } } catch (e) { /* no storage */ }
  }
  if (opts.spr) Promise.resolve().then(() => { ready(opts.spr); save(); });   // after the screen below exists
  else store.openSprite(g.file, item, opts.ticksOf).then(ready).catch(e => { ed.err = e.message || String(e); rer(); });

  // ---------------------------------------------------------------- saving (on the phone, a moment after each change)
  let saveT = 0, saving = Promise.resolve();
  function extra() {
    const x = { ...(opts.extra || {}) };
    if (ed.gameCols) x.sheetCols = ed.gameCols;
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
    const spr = withFloat(); if (!spr) return saving;
    saving = saving.then(() => store.save(g.file, item, spr, extra())).then(() => { ed.saved = !saveT; status(); }).catch(e => toast('Could not save: ' + e.message));
    return saving;
  }
  // the sprite as it would be with floating pixels put down (for saving)
  function withFloat() {
    const s = ed.spr; if (!s || !ed.float) return s;
    const F = ed.float, k = celKey(F.layer, F.frame), old = s.cels.get(k), cels = new Map(s.cels);
    cels.set(k, { data: SEL.drop(F, old ? old.data : new Uint8ClampedArray(s.w * s.h * 4), s.w, s.h), opacity: old ? old.opacity : 255 });
    return { ...s, cels };
  }
  function changed() { ed.saved = false; status(); clearTimeout(saveT); saveT = setTimeout(save, 700); }
  // leaving the app (home screen, app switcher) saves straight away, so the last stroke is never lost
  const flush = () => { if (document.visibilityState === 'hidden' && saveT && !ed.discarded) save(); };
  document.addEventListener('visibilitychange', flush); addEventListener('pagehide', flush);

  // ---------------------------------------------------------------- undo (each step keeps the old cels; cels are never changed in place once made)
  function snap() {
    const s = ed.spr;
    return { w: s.w, h: s.h, layers: s.layers.map(l => ({ ...l })), frames: s.frames.map(f => ({ ...f })), tags: s.tags.map(t => ({ ...t, color: t.color.slice() })),
      palette: s.palette.map(c => c.slice()), cels: new Map(s.cels), layer: ed.layer, frame: ed.frame, sel: ed.sel, float: ed.float };
  }
  function restore(x) {
    if (x.w !== ed.spr.w || x.h !== ed.spr.h) ed.zoom = 0;
    Object.assign(ed.spr, { w: x.w, h: x.h, layers: x.layers, frames: x.frames, tags: x.tags, palette: x.palette, cels: x.cels });
    ed.layer = Math.min(x.layer, x.layers.length - 1); ed.frame = Math.min(x.frame, x.frames.length - 1); ed.sel = x.sel || null; ed.float = x.float || null;
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
  const fpics = new WeakMap();
  function floatPic(p) { let c = fpics.get(p); if (!c) { c = document.createElement('canvas'); c.width = p.w; c.height = p.h; c.getContext('2d').putImageData(new ImageData(p.data, p.w, p.h), 0, 0); fpics.set(p, c); } return c; }
  let frameC = null, onionC = [null, null], composed = false;   // composed: the frame (and onion) pictures are up to date, so the marching ants can reuse them
  // every visible layer of a frame onto a small canvas
  function frameCanvas(f, into) {
    const s = ed.spr; if (!into) { if (!frameC) { frameC = document.createElement('canvas'); } into = frameC; }
    into.width = s.w; into.height = s.h; const x = into.getContext('2d'); x.clearRect(0, 0, s.w, s.h);
    const vis = visibleLayers(s);
    s.layers.forEach((l, i) => {
      if (!vis[i] || l.group) return; const cel = s.cels.get(celKey(i, f)); if (!cel) return;
      x.globalAlpha = op(l) / 255 * op(cel) / 255;
      x.drawImage(picOf(cel), 0, 0);
    });
    const F = ed.float;
    if (F && F.frame === f && vis[F.layer]) { const l = s.layers[F.layer], p = SEL.floatPixels(F); x.globalAlpha = op(l) / 255; x.drawImage(floatPic(p), p.x, p.y); }
    x.globalAlpha = 1; return into;
  }

  // ---------------------------------------------------------------- the view
  function fit() {
    const s = ed.spr; if (!s || !CW) return;
    let z = ZOOMS[0]; for (const k of ZOOMS) if (s.w * k <= CW * 0.92 && s.h * k <= CH * 0.92) z = k;
    ed.zoom = z; ed.ox = Math.round((CW - s.w * z) / 2); ed.oy = Math.round((CH - s.h * z) / 2);
  }
  let checker = null;
  function draw(reuse) {
    if (!ctx || !ed.spr) return;
    if (!reuse) composed = false;
    const s = ed.spr, z = ed.zoom, ox = Math.round(ed.ox * dpr) / dpr, oy = Math.round(ed.oy * dpr) / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, CW, CH); ctx.imageSmoothingEnabled = false;
    if (!checker) { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#3a3a40'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#2a2a2f'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); checker = ctx.createPattern(c, 'repeat'); }
    ctx.fillStyle = checker; ctx.fillRect(ox, oy, s.w * z, s.h * z);
    // onion skin: the frame before in red, the frame after in blue
    if (ed.onion && !ed.playing) {
      [[ed.frame - 1, 'rgba(255,70,70,1)'], [ed.frame + 1, 'rgba(70,140,255,1)']].forEach(([f, col], k) => {
        if (f < 0 || f >= s.frames.length) return;
        if (!composed) {
          const c = frameCanvas(f, onionC[k] || (onionC[k] = document.createElement('canvas'))), x = c.getContext('2d');
          x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.55; x.fillStyle = col; x.fillRect(0, 0, s.w, s.h); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
        }
        ctx.globalAlpha = 0.35; ctx.drawImage(onionC[k], ox, oy, s.w * z, s.h * z); ctx.globalAlpha = 1;
      });
    }
    ctx.drawImage(composed ? frameC : frameCanvas(ed.frame), ox, oy, s.w * z, s.h * z);
    composed = true;
    if (ed.grid && z >= 6) {
      ctx.beginPath();
      for (let x = 1; x < s.w; x++) { ctx.moveTo(ox + x * z + 0.5 / dpr, oy); ctx.lineTo(ox + x * z + 0.5 / dpr, oy + s.h * z); }
      for (let y = 1; y < s.h; y++) { ctx.moveTo(ox, oy + y * z + 0.5 / dpr); ctx.lineTo(ox + s.w * z, oy + y * z + 0.5 / dpr); }
      ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1 / dpr; ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1 / dpr; ctx.strokeRect(ox - 0.5 / dpr, oy - 0.5 / dpr, s.w * z + 1 / dpr, s.h * z + 1 / dpr);
    // the selection (or the one being drawn): marching ants along its edge
    const box = act && act.kind === 'box' && act.moved && !ed.mode ? act : null, sel = box ? null : ed.preview || ed.sel;
    if ((sel || box) && !ed.playing) {
      ctx.beginPath();
      if (box) { const x0 = Math.max(0, Math.min(box.x0, box.x1)), y0 = Math.max(0, Math.min(box.y0, box.y1)), x1 = Math.min(s.w, Math.max(box.x0, box.x1) + 1), y1 = Math.min(s.h, Math.max(box.y0, box.y1) + 1); ctx.rect(ox + x0 * z, oy + y0 * z, (x1 - x0) * z, (y1 - y0) * z); }
      else SEL.outline(sel, s.w, s.h).forEach(([x1, y1, x2, y2]) => { ctx.moveTo(ox + x1 * z, oy + y1 * z); ctx.lineTo(ox + x2 * z, oy + y2 * z); });
      ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.strokeStyle = '#000'; ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.lineDashOffset = -((performance.now() / 60) | 0) % 8; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.setLineDash([]);
    }
    if (lasso && lasso.length > 1) {
      ctx.beginPath(); lasso.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * z, oy + y * z) : ctx.moveTo(ox + x * z, oy + y * z)));
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ---------------------------------------------------------------- drawing
  function blocked(l) {
    const L = ed.spr.layers[l];
    if (!L || L.group) return 'Choose a drawable layer';
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
    const i = y * s.w + x; if (stroke.done[i] || (ed.sel && !ed.sel.mask[i])) return; stroke.done[i] = 1;
    const d = stroke.cel.data, j = i * 4;
    if (ed.tool === 'eraser') { d[j] = d[j + 1] = d[j + 2] = d[j + 3] = 0; }
    else if (ed.tool === 'shade') {
      if (!d[j + 3]) return;
      const n = rampStep(ed.spr.palette, [d[j], d[j + 1], d[j + 2]], ed.shadeDir);
      if (!n) return;
      d[j] = n[0]; d[j + 1] = n[1]; d[j + 2] = n[2];
    } else {
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
  // a shape from where the finger went down to where it is now, drawn over the cel as it was (so it can be redrawn as the finger moves)
  function drawShape(x1, y1) {
    const sh = stroke.shape, d = stroke.cel.data;
    d.set(sh.base); stroke.done.fill(0);
    const k = SHAPE_KINDS[ed.shapeKind][0], x0 = sh.x0, y0 = sh.y0;
    if (k === 'line') { line(x0, y0, x1, y1); stroke.cel.v++; return; }
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    if (k === 'box' || k === 'boxF') {
      if (k === 'boxF') { for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) plot(x, y); }
      else { line(ax, ay, bx, ay); line(bx, ay, bx, by); line(bx, by, ax, by); line(ax, by, ax, ay); }
      stroke.cel.v++; return;
    }
    // an oval fitting the box: pixels whose centres are inside it; the outline is those with a side neighbour outside
    const w = bx - ax + 1, h = by - ay + 1, cx = ax + w / 2, cy = ay + h / 2, rx = w / 2 - 0.2, ry = h / 2 - 0.2;   // a little inside the box, so corners stay round (3×3 is a plus)
    const inside = (x, y) => x >= ax && x <= bx && y >= ay && y <= by && ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0001;
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
      if (!inside(x, y)) continue;
      if (k === 'ovalF' || w < 3 || h < 3 || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) plot(x, y);
    }
    stroke.cel.v++;
  }
  function fill(x, y) {
    const s = ed.spr; if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
    const old = s.cels.get(celKey(ed.layer, ed.frame)), src = old ? old.data : new Uint8ClampedArray(s.w * s.h * 4), j0 = (y * s.w + x) * 4;
    const t = [src[j0], src[j0 + 1], src[j0 + 2], src[j0 + 3]], c = ed.color;
    const same = (j) => (t[3] === 0 ? src[j + 3] === 0 : src[j] === t[0] && src[j + 1] === t[1] && src[j + 2] === t[2] && src[j + 3] === t[3]);
    if ((t[3] && sameColor(t, c)) || (ed.sel && !ed.sel.mask[y * s.w + x])) return false;
    step(); const cel = editableCel(), d = cel.data, seen = new Uint8Array(s.w * s.h), q = [x, y];
    while (q.length) {
      const yy = q.pop(), xx = q.pop(), i = yy * s.w + xx;
      if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h || seen[i] || !same(i * 4) || (ed.sel && !ed.sel.mask[i])) continue;
      seen[i] = 1; const j = i * 4; d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = c[3] === undefined ? 255 : c[3];
      q.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1);
    }
    return true;
  }
  function pick(x, y) {
    const s = ed.spr; if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    // the visible layers at this one pixel, blended bottom to top
    const vis = visibleLayers(s), j = (y * s.w + x) * 4; let r = 0, gg = 0, b = 0, a = 0;
    s.layers.forEach((L, l) => {
      const cel = !L.group && vis[l] && s.cels.get(celKey(l, ed.frame)); if (!cel) return;
      const d = cel.data, sa = d[j + 3] / 255 * op(L) / 255 * op(cel) / 255; if (!sa) return;
      const oa = sa + a * (1 - sa); r = (d[j] * sa + r * a * (1 - sa)) / oa; gg = (d[j + 1] * sa + gg * a * (1 - sa)) / oa; b = (d[j + 2] * sa + b * a * (1 - sa)) / oa; a = oa;
    });
    if (!a) { toast('No colour there'); return; }
    ed.color = [Math.round(r), Math.round(gg), Math.round(b), Math.round(a * 255)]; ed.tool = ed.after; rer();
  }

  // ---------------------------------------------------------------- selecting, and floating pixels
  let lasso = null, act = null;   // act: a one-finger select or move in progress
  const all1 = () => new Uint8Array(ed.spr.w * ed.spr.h).fill(1);
  // the pixels to work on: the selection, or everything drawn on the cel
  const workMask = (cel) => { if (ed.sel) return ed.sel.mask; const m = new Uint8Array(ed.spr.w * ed.spr.h); for (let i = 0; i < m.length; i++) m[i] = cel.data[i * 4 + 3] ? 1 : 0; return m; };
  const curCel = () => ed.spr.cels.get(celKey(ed.layer, ed.frame));
  // lift the selected pixels (or, with nothing selected, everything on the layer) so they float; false if there is nothing to lift
  function lift() {
    if (ed.float) return true;
    const why = blocked(ed.layer); if (why) { toast(why); return false; }
    const s = ed.spr, cel = curCel();
    if (!cel) { toast('This layer is empty here'); return false; }
    const cut = SEL.cutOut(cel.data, s.w, s.h, workMask(cel));
    if (!cut) { toast('Nothing on this layer here'); return false; }
    step();
    s.cels.set(celKey(ed.layer, ed.frame), { data: cut.rest, opacity: cel.opacity, v: 1 });
    ed.float = { orig: cut.orig, cx: cut.x + cut.orig.w / 2, cy: cut.y + cut.orig.h / 2, s: 1, r: 0, fx: false, fy: false, layer: ed.layer, frame: ed.frame, noSel: !ed.sel };
    return true;
  }
  // put floating pixels down where they are
  function settle() {
    const F = ed.float; if (!F) return false;
    step(); const s = ed.spr, k = celKey(F.layer, F.frame), old = s.cels.get(k);
    s.cels.set(k, { data: SEL.drop(F, old ? old.data : new Uint8ClampedArray(s.w * s.h * 4), s.w, s.h), opacity: old ? old.opacity : 255, v: 1 });
    ed.float = null; if (F.noSel) ed.sel = null; changed(); return true;
  }
  const follow = () => { if (ed.float && !ed.float.noSel) ed.sel = SEL.floatSel(ed.float, ed.spr.w, ed.spr.h); };
  // flip, turn or scale: what floats, else the selection (lifted first), else the whole layer
  function transform(fn) {
    stop(); if (!lift()) return;
    step(); ed.float = { ...ed.float, ...fn(ed.float) }; follow(); changed(); rer();
  }
  const flipH = () => transform(F => ({ fx: !F.fx }));
  const flipV = () => transform(F => ({ fy: !F.fy }));
  // turning swaps the flips (a flip and then a quarter turn is the same as the quarter turn and then the other flip)
  const turn = (q) => transform(F => ({ r: (F.r + q + 4) % 4, fx: F.fy, fy: F.fx }));
  const scaleBy = (d) => transform(F => { const i = SEL.SCALES.indexOf(F.s); return { s: SEL.SCALES[Math.max(0, Math.min(SEL.SCALES.length - 1, (i < 0 ? 3 : i) + d))] }; });
  function selectAll() { stop(); settle(); step(); ed.sel = { mask: all1() }; changed(); rer(); }
  function deselect() { stop(); settle(); if (!ed.sel) return; step(); ed.sel = null; changed(); rer(); }
  function invertSel() { stop(); settle(); step(); ed.sel = SEL.invert(ed.sel, ed.spr.w, ed.spr.h); changed(); rer(); }
  function copy(quiet) {
    const s = ed.spr;
    if (ed.float) { const p = SEL.floatPixels(ed.float); CLIP = { data: p.data, w: p.w, h: p.h, mask: p.mask, x: p.x, y: p.y }; }
    else {
      const cel = curCel(); if (!cel) { toast('Nothing on this layer here'); return false; }
      const cut = SEL.cutOut(cel.data, s.w, s.h, workMask(cel)); if (!cut) { toast('Nothing selected on this layer'); return false; }
      CLIP = { ...cut.orig, x: cut.x, y: cut.y };
    }
    if (!quiet) toast('Copied ' + CLIP.w + '×' + CLIP.h);
    rer(); return true;
  }
  function del() {
    stop();
    if (ed.float) { step(); const F = ed.float; ed.float = null; if (F.noSel) ed.sel = null; changed(); paintCells(); rer(); return; }
    if (!ed.sel) { toast('Select something first'); return; }
    const why = blocked(ed.layer); if (why) { toast(why); return; }
    if (!curCel()) return;
    step(); const d = editableCel().data, m = ed.sel.mask;
    for (let i = 0; i < m.length; i++) if (m[i]) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = d[i * 4 + 3] = 0;
    changed(); paintCells(); draw();
  }
  function cut() { if (copy(true)) { toast('Cut ' + CLIP.w + '×' + CLIP.h); del(); } }
  function paste() {
    if (!CLIP) { toast('Copy something first'); return; }
    const why = blocked(ed.layer); if (why) { toast(why); return; }
    stop(); settle();
    const s = ed.spr, fits = CLIP.x >= 0 && CLIP.y >= 0 && CLIP.x + CLIP.w <= s.w && CLIP.y + CLIP.h <= s.h;
    step();
    ed.float = { orig: { data: CLIP.data, w: CLIP.w, h: CLIP.h, mask: CLIP.mask }, cx: fits ? CLIP.x + CLIP.w / 2 : s.w / 2, cy: fits ? CLIP.y + CLIP.h / 2 : s.h / 2, s: 1, r: 0, fx: false, fy: false, layer: ed.layer, frame: ed.frame, noSel: false };
    follow(); ed.tool = 'move'; changed(); rer();
  }
  function fillSel() {
    if (!ed.sel) { toast('Select something first'); return; }
    const why = blocked(ed.layer); if (why) { toast(why); return; }
    stop(); settle(); step(); const d = editableCel().data, m = ed.sel.mask, c = ed.color;
    for (let i = 0; i < m.length; i++) if (m[i]) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = c[3]; }
    changed(); paintCells(); draw();
  }
  function wand(x, y) {
    const s = ed.spr, cel = curCel(), data = cel ? cel.data : new Uint8ClampedArray(s.w * s.h * 4);
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    step(); ed.sel = SEL.combine(ed.sel, SEL.wandMask(data, s.w, s.h, x, y, ed.contiguous), ed.mode); changed(); rer();
  }

  // ---------------------------------------------------------------- the whole canvas
  // every cel redrawn at a new size: from(x, y) gives where each new pixel comes from in the old picture (or null)
  function remap(w2, h2, from) {
    stop(); settle(); step();
    const s = ed.spr, m = new Map();
    for (const [k, c] of s.cels) {
      const d = new Uint8ClampedArray(w2 * h2 * 4); let any = false;
      for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
        const q = from(x, y); if (!q || q[0] < 0 || q[1] < 0 || q[0] >= s.w || q[1] >= s.h) continue;
        const i = (q[1] * s.w + q[0]) * 4, j = (y * w2 + x) * 4; if (!c.data[i + 3]) continue;
        d[j] = c.data[i]; d[j + 1] = c.data[i + 1]; d[j + 2] = c.data[i + 2]; d[j + 3] = c.data[i + 3]; any = true;
      }
      if (any) m.set(k, { data: d, opacity: c.opacity, v: 1 });
    }
    s.cels = m; s.w = w2; s.h = h2; ed.sel = null; ed.zoom = 0; ed.cv = null; ed.sheet = null; changed(); rer();
  }
  const MAXSIDE = 1024;
  function resizeCanvas(w2, h2, ax, ay) {
    const s = ed.spr; w2 = Math.max(1, Math.min(MAXSIDE, w2 | 0)); h2 = Math.max(1, Math.min(MAXSIDE, h2 | 0));
    if (w2 === s.w && h2 === s.h) { toast('The canvas is already that size'); return; }
    const dx = Math.round((w2 - s.w) * ax), dy = Math.round((h2 - s.h) * ay);
    remap(w2, h2, (x, y) => [x - dx, y - dy]);
  }
  function crop(b) { if (!b) return; remap(b.w, b.h, (x, y) => [x + b.x, y + b.y]); }
  function trim() {
    const s = ed.spr, any = new Uint8Array(s.w * s.h);
    for (const c of s.cels.values()) for (let i = 0; i < any.length; i++) if (c.data[i * 4 + 3]) any[i] = 1;
    const b = SEL.maskBounds(any, s.w, s.h);
    if (!b) { toast('Nothing drawn yet'); return; }
    if (b.w === s.w && b.h === s.h) { toast('Nothing to trim'); return; }
    crop(b);
  }
  function scaleSprite(f) {
    const s = ed.spr, w2 = Math.round(s.w * f), h2 = Math.round(s.h * f);
    if (w2 < 1 || h2 < 1 || w2 > MAXSIDE || h2 > MAXSIDE) { toast(f > 1 ? 'Too large' : 'Too small'); return; }
    remap(w2, h2, (x, y) => [Math.floor(x * s.w / w2), Math.floor(y * s.h / h2)]);
  }
  const flipCanvas = (hz) => { const s = ed.spr, w = s.w, h = s.h; remap(w, h, hz ? (x, y) => [w - 1 - x, y] : (x, y) => [x, h - 1 - y]); };
  const turnCanvas = (q) => { const s = ed.spr, w = s.w, h = s.h; remap(h, w, q > 0 ? (x, y) => [y, h - 1 - x] : (x, y) => [w - 1 - y, x]); };

  // ---------------------------------------------------------------- import and export
  async function importFile(file) {
    if (!file) return;
    try {
      if (/\.(aseprite|ase)$/i.test(file.name)) {
        const n = await readAse(await file.arrayBuffer());
        if (!confirm('Replace ' + item.name + ' with ' + file.name + ' (' + n.w + '×' + n.h + ', ' + n.frames.length + (n.frames.length === 1 ? ' frame' : ' frames') + ')? Undo can reverse this.')) return;
        stop(); settle(); step();
        Object.assign(ed.spr, { w: n.w, h: n.h, layers: n.layers, frames: n.frames, cels: n.cels, tags: n.tags, palette: n.palette.length ? n.palette : ed.spr.palette });
        ed.layer = Math.max(0, n.layers.findIndex(l => !l.group)); ed.frame = 0; ed.sel = null; ed.zoom = 0; ed.playTag = -1; ed.sheet = null;
        changed(); rer(); toast('Opened ' + file.name);
        return;
      }
      const why = blocked(ed.layer); if (why) { toast(why); return; }
      const bmp = await createImageBitmap(file), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext('2d'); x.drawImage(bmp, 0, 0); const data = x.getImageData(0, 0, c.width, c.height).data;
      stop(); settle(); step();
      const s = ed.spr;
      ed.float = { orig: { data, w: c.width, h: c.height, mask: new Uint8Array(c.width * c.height).fill(1) }, cx: s.w / 2, cy: s.h / 2, s: 1, r: 0, fx: false, fy: false, layer: ed.layer, frame: ed.frame, noSel: false };
      follow(); ed.tool = 'move'; ed.sheet = null; changed(); rer();
      toast(c.width > s.w || c.height > s.h ? 'Larger than the canvas. Drag it, scale it down or enlarge the canvas.' : 'Drag it into place, then Drop');
    } catch (e) { toast('Could not open ' + file.name + ': ' + (e.message || e)); }
  }
  // a picture made bigger by whole pixels
  function upscale(d, w, h, k) {
    if (k === 1) return d;
    const W = w * k, out = new Uint8ClampedArray(W * h * k * 4);
    for (let y = 0; y < h * k; y++) for (let x = 0; x < W; x++) { const i = ((y / k | 0) * w + (x / k | 0)) * 4; out.set(d.subarray(i, i + 4), (y * W + x) * 4); }
    return out;
  }
  const pngBlob = (d, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(d, w, h), 0, 0); return new Promise(r => c.toBlob(r, 'image/png')); };
  const baseName = () => item.file.split('/').pop().replace(/\.png$/i, '');
  async function prepare(kind) {
    const s = withFloat(), k = ed.exScale, n = s.frames.length, t = s.tags[ed.playTag];
    ed.out = { busy: true }; rer();
    try {
      let blob, name;
      if (kind === 'frame') { blob = await pngBlob(upscale(flatten(s, ed.frame), s.w, s.h, k), s.w * k, s.h * k); name = baseName() + (n > 1 ? '-' + (ed.frame + 1) : '') + (k > 1 ? '@' + k + 'x' : '') + '.png'; }
      else if (kind === 'sheet') {
        const cols = Math.max(1, Math.min(n, ed.exCols || n)), rows = Math.ceil(n / cols), W = s.w * cols, H = s.h * rows, all = new Uint8ClampedArray(W * H * 4);
        for (let f = 0; f < n; f++) { const d = flatten(s, f), ox = (f % cols) * s.w, oy = Math.floor(f / cols) * s.h; for (let y = 0; y < s.h; y++) all.set(d.subarray(y * s.w * 4, (y + 1) * s.w * 4), ((oy + y) * W + ox) * 4); }
        blob = await pngBlob(upscale(all, W, H, k), W * k, H * k); name = baseName() + '-sheet' + (k > 1 ? '@' + k + 'x' : '') + '.png';
      } else if (kind === 'gif') {
        const from = t ? t.from : 0, to = t ? t.to : n - 1, list = [];
        for (let f = from; f <= to; f++) list.push(f);
        if (t && t.dir === 1) list.reverse();
        if (t && t.dir === 2) for (let f = to - 1; f > from; f--) list.push(f);
        const frames = list.map(f => ({ data: upscale(flatten(s, f), s.w, s.h, k), delay: s.frames[f].dur }));
        blob = new Blob([encodeGif(frames, s.w * k, s.h * k)], { type: 'image/gif' }); name = baseName() + (t ? '-' + t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '') + '.gif';
      } else { blob = new Blob([await writeAse(s)], { type: 'application/octet-stream' }); name = baseName() + '.aseprite'; }
      ed.out = { file: new File([blob], name, { type: blob.type || 'application/octet-stream' }) };
    } catch (e) { ed.out = null; toast('Export failed: ' + (e.message || e)); }
    rer();
  }
  // hand the file to the phone's share sheet (Save to Files, AirDrop, Messages…); a computer downloads it
  async function share(file) {
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
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
      if (act) { for (let k = 0; k < (act.steps || 0); k++) restore(ed.hist.pop()); act = null; lasso = null; ed.preview = null; draw(); }
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
    if (ed.tool === 'select') {
      settle();
      if (ed.shape === 'wand') { tap = { x, y }; return; }
      act = { kind: ed.shape, x0: x, y0: y, x1: x, y1: y, moved: false };
      if (ed.shape === 'lasso') lasso = [[(p.x - ed.ox) / ed.zoom, (p.y - ed.oy) / ed.zoom]];
      return;
    }
    if (ed.tool === 'move') { act = { kind: 'move', p0: p, steps: 0, F0: null }; return; }
    if (ed.float) settle();
    const why = blocked(ed.layer); if (why) { toast(why); return; }
    step(); stroke = { cel: editableCel(), done: new Uint8Array(ed.spr.w * ed.spr.h), last: [x, y] };
    if (ed.tool === 'shape') { stroke.shape = { x0: x, y0: y, base: stroke.cel.data.slice() }; drawShape(x, y); draw(); return; }
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
    if (act) {
      const p = at(e), [x, y] = cell(p), s = ed.spr;
      if (act.kind === 'box') {
        if (x !== act.x1 || y !== act.y1) { act.x1 = x; act.y1 = y; act.moved = true; }
        if (act.moved) { if (ed.mode) ed.preview = SEL.combine(ed.sel, SEL.rectMask(s.w, s.h, act.x0, act.y0, act.x1, act.y1), ed.mode) || { mask: new Uint8Array(s.w * s.h) }; draw(true); }
      } else if (act.kind === 'lasso') {
        const q = [(p.x - ed.ox) / ed.zoom, (p.y - ed.oy) / ed.zoom], l = lasso[lasso.length - 1];
        if (Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.35) { lasso.push(q); act.moved = true; draw(); }
      } else if (act.kind === 'move') {
        const dx = Math.round((p.x - act.p0.x) / ed.zoom), dy = Math.round((p.y - act.p0.y) / ed.zoom);
        if (!act.F0) {
          if (!dx && !dy) return;
          const had = !!ed.float; if (!lift()) { act = null; return; }
          if (!had) act.steps++;
          step(); act.steps++; act.F0 = ed.float;
        }
        ed.float = { ...act.F0, cx: act.F0.cx + dx, cy: act.F0.cy + dy }; if (!ed.float.noSel) ed.sel = null; draw();   // the outline comes back when the finger lifts
      }
      return;
    }
    if (stroke && stroke.shape) { const [x, y] = cell(at(e)); if (x !== stroke.last[0] || y !== stroke.last[1]) { stroke.last = [x, y]; drawShape(x, y); draw(); } return; }
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
    if (act) {
      const a = act, s = ed.spr; act = null; ed.preview = null;
      if (a.kind === 'move') { if (a.F0) { follow(); changed(); paintCells(); rer(); } return; }
      let m = null;
      if (a.kind === 'box' && a.moved) m = SEL.rectMask(s.w, s.h, a.x0, a.y0, a.x1, a.y1);
      if (a.kind === 'lasso' && a.moved && lasso.length > 2) m = SEL.lassoMask(s.w, s.h, lasso);
      lasso = null;
      if (m) { step(); ed.sel = SEL.combine(ed.sel, m, ed.mode); changed(); rer(); }
      else if (ed.mode === 0 && ed.sel) deselect();   // a tap without dragging lets go of the selection
      else draw();
      return;
    }
    if (tap) {
      const t = tap; tap = null;
      if (ed.tool === 'select') { wand(t.x, t.y); return; }
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
    stop(); settle(); step(); const s = S(), at = ed.layer + 1, lv = s.layers[ed.layer] ? s.layers[ed.layer].level || 0 : 0;
    let n = s.layers.length + 1; while (s.layers.some(l => l.name === 'Layer ' + n)) n++;
    remapLayers(l => (l >= at ? l + 1 : l));
    s.layers.splice(at, 0, { name: 'Layer ' + n, visible: true, locked: false, opacity: 255, blend: 0, group: false, level: lv, bg: false });
    ed.layer = at; changed(); rer();
  }
  function delLayer() {
    settle();
    const s = S(), L = s.layers[ed.layer];
    if (L.group) { toast('Edit groups in desktop Aseprite'); return; }
    if (drawable() < 2) { toast('A sprite needs at least one layer'); return; }
    step(); const at = ed.layer; remapLayers(l => (l === at ? -1 : l > at ? l - 1 : l)); s.layers.splice(at, 1);
    ed.layer = Math.max(0, at - 1); ed.sheet = null; changed(); rer();
  }
  function dupLayer() {
    settle();
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
    settle();
    const a = ed.layer, b = a + dir;
    if (!sibling(a, b)) { toast(dir > 0 ? 'Already at the top' : 'Already at the bottom'); return; }
    step(); const s = S(); [s.layers[a], s.layers[b]] = [s.layers[b], s.layers[a]];
    remapLayers(l => (l === a ? b : l === b ? a : l)); ed.layer = b; changed(); rer();
  }
  function mergeDown() {
    settle();
    const a = ed.layer, b = a - 1;
    if (!sibling(a, b)) { toast('Nothing below to merge'); return; }
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
    stop(); settle(); step(); const s = S(), f = ed.frame, at = f + 1;
    const copies = []; if (!empty) for (const [k, c] of s.cels) { const [l, ff] = k.split(':').map(Number); if (ff === f) copies.push([l, c]); }
    remapFrames(x => (x >= at ? x + 1 : x));
    s.frames.splice(at, 0, { dur: s.frames[f].dur });
    copies.forEach(([l, c]) => s.cels.set(celKey(l, at), c));
    s.tags.forEach(t => { if (t.from > f) { t.from++; t.to++; } else if (t.to >= f) t.to++; });
    ed.frame = at; changed(); rer();
  }
  function delFrame() {
    settle();
    const s = S(); if (s.frames.length < 2) { toast('A sprite needs at least one frame'); return; }
    step(); const f = ed.frame;
    remapFrames(x => (x === f ? -1 : x > f ? x - 1 : x)); s.frames.splice(f, 1);
    const before = s.tags.length;
    s.tags = s.tags.filter(t => { if (t.from > f) t.from--; if (t.to >= f) t.to--; return t.to >= t.from; });
    if (s.tags.length !== before) ed.playTag = -1;   // a tag went with the frame: play everything
    ed.frame = Math.min(f, s.frames.length - 1); changed(); rer();
  }
  function moveFrame(dir) {
    settle();
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
    settle();
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
    const n = document.getElementById('se-fn'), l = document.getElementById('se-fl');
    if (n) n.textContent = `Frame ${ed.frame + 1} / ${ed.spr.frames.length}`; if (l) l.textContent = frameLine();
  }
  function paintCells() {
    const s = S();
    document.querySelectorAll('#se-tl .se-cel').forEach(el => { const [l, f] = el.dataset.c.split(':').map(Number); el.classList.toggle('on', hasPixels(s.cels.get(celKey(l, f)))); });
    const u = document.querySelector('[aria-label="Undo"]'), r = document.querySelector('[aria-label="Redo"]');
    if (u) u.disabled = !ed.hist.length; if (r) r.disabled = !ed.fut.length;
  }
  const subLine = () => { const s = ed.spr; if (!s) return ''; const L = s.layers[ed.layer], r = store.record(g.file, item.id); return `${L ? L.name : ''} · ${s.w}×${s.h}` + (!ed.saved ? ' · saving…' : r && r.dirty ? ' · saved' : ''); };
  const frameLine = () => { const s = ed.spr, t = s.tags.find(x => ed.frame >= x.from && ed.frame <= x.to); return (s.frames[ed.frame].dur || 100) + ' ms' + (t ? ' · ' + t.name : ''); };

  // ---------------------------------------------------------------- pieces of the screen
  function setFrame(f) { if (f === ed.frame) { stop(); settle(); ed.sheet = { kind: 'frame' }; rer(); } else setCell(ed.layer, f); }
  function setLayer(l) { stop(); settle(); if (l === ed.layer) ed.sheet = { kind: 'layer' }; else ed.layer = l; rer(); }
  function setCell(l, f) {
    stop(); const put = settle();
    if (l !== ed.layer || ed.sheet) { ed.layer = l; ed.frame = f; rer(); return; }
    // only the frame changes: redraw the picture and move the highlights, no need to build the screen again
    ed.frame = f; draw(); markFrame(); if (put) paintCells();
    const cv2 = document.getElementById('se-cv'); if (cv2) cv2.setAttribute('aria-label', item.name + ', frame ' + (f + 1));
  }
  function setTag(i) { settle(); if (ed.playTag === i) ed.sheet = { kind: 'tag', i }; else { ed.playTag = i; const t = S().tags[i]; stop(); ed.frame = t.from; } rer(); }
  function setColor(c) {
    ed.color = c.slice(); if (ed.color.length < 4) ed.color.push(255);
    if (ed.tool !== 'pencil' && ed.tool !== 'fill' && ed.tool !== 'shade' && ed.tool !== 'shape') { ed.tool = 'pencil'; rer(); return; }
    if (ed.sheet && ed.sheet.kind === 'palette') { rer(); return; }
    // just the swatches: the chosen one gets its ring, the big one shows it
    const pal = ed.spr.palette;
    document.querySelectorAll('#se-pal .se-pc').forEach((el, i) => el.classList.toggle('sel', !!pal[i] && sameColor(pal[i], ed.color)));
    const cur = document.querySelector('#se-cur .se-sw > span'); if (cur) cur.style.background = rgba(ed.color); const cb = document.getElementById('se-cur'); if (cb) cb.setAttribute('aria-label', 'Colour ' + rgbHex(ed.color) + ', change it');
    const add = document.querySelector('[aria-label="Add this colour to the palette"]'); if (add) rer();
  }
  function setTool(t) { if (ed.float && t !== 'move' && t !== 'pan') settle(); if (t === 'picker' && ed.tool !== 'picker') ed.after = ed.tool === 'eraser' || ed.tool === 'pan' ? 'pencil' : ed.tool; ed.tool = t; rer(); }

  const swatch = (c, size) => `<span class="se-sw" style="width:${size}px;height:${size}px"><span style="background:${rgba(c)}"></span></span>`;

  function timeline() {
    const s = ed.spr, n = s.frames.length, vis = visibleLayers(s);
    // tags in lanes, so overlapping ones stack
    const lanes = []; const tagLane = s.tags.map(t => { let k = 0; while ((lanes[k] || []).some(o => !(t.to < o.from || t.from > o.to))) k++; (lanes[k] = lanes[k] || []).push(t); return k; });
    const nl = Math.max(1, lanes.length), cols = `grid-template-columns:var(--se-lc) repeat(${n},var(--se-fw))`;
    let h = `<div class="se-grid" style="${cols} var(--se-fw);grid-template-rows:repeat(${nl},14px) 20px repeat(${s.layers.length},28px) 28px">`;
    h += `<button class="se-corner" style="grid-row:1/${nl + 2}" ${A(addTag)} aria-label="New tag starting at this frame">${svgRows(G.plus, PINK)}<span>Tag</span></button>`;
    h += `<button class="se-fh se-add" style="top:${nl * 14}px;grid-row:${nl + 1};grid-column:${n + 2}" ${A(() => addFrame(false))} aria-label="New frame (a copy of this one)">${svgRows(G.plus, PINK)}</button>`;
    h += `<button class="se-ln se-addl" style="grid-row:${nl + 2 + s.layers.length}" ${A(addLayer)} aria-label="New layer">${svgRows(G.plus, PINK)}<span>Layer</span></button>`;
    s.tags.forEach((t, i) => {
      h += `<button class="se-tag${ed.playTag === i ? ' sel' : ''}" style="top:${tagLane[i] * 14}px;grid-row:${tagLane[i] + 1};grid-column:${t.from + 2}/${t.to + 3};--tc:${rgbHex(t.color)}" ${A(() => setTag(i))} aria-label="Tag ${esc(t.name)}">${esc(t.name)}</button>`;
    });
    for (let f = 0; f < n; f++) h += `<button class="se-fh${f === ed.frame ? ' cur' : ''}" data-pad="skip" data-f="${f}" style="top:${nl * 14}px;grid-row:${nl + 1};grid-column:${f + 2}" ${A(() => setFrame(f))} aria-label="Frame ${f + 1}">${f + 1}</button>`;
    for (let r = 0; r < s.layers.length; r++) {
      const l = s.layers.length - 1 - r, L = s.layers[l], row = nl + 2 + r;
      h += `<div class="se-ln${l === ed.layer ? ' sel' : ''}" style="grid-row:${row}">
        <button class="se-eye" ${A(() => { step(); L.visible = !L.visible; changed(); rer(); })} aria-label="${L.visible ? 'Hide' : 'Show'} ${esc(L.name)}">${svgRows(L.visible ? G.eye : G.eyeOff, vis[l] ? '#e4e2dc' : '#6f6d69')}</button>
        <button class="se-lname" style="padding-left:${4 + (L.level || 0) * 8}px" ${A(() => setLayer(l))} aria-pressed="${l === ed.layer}">${L.group ? svgRows(G.group, '#9a98a0') + ' ' : ''}${esc(L.name)}${L.locked ? ' ' + svgRows(G.lock, '#9a98a0') : ''}</button>
      </div>`;
      for (let f = 0; f < n; f++) {
        if (L.group) { h += `<span class="se-cel grp" style="grid-row:${row};grid-column:${f + 2}"></span>`; continue; }
        h += `<button data-pad="skip" class="se-cel${hasPixels(s.cels.get(celKey(l, f))) ? ' on' : ''}${l === ed.layer ? ' lrow' : ''}${f === ed.frame ? ' cur' : ''}" data-f="${f}" data-c="${l}:${f}" style="grid-row:${row};grid-column:${f + 2}" ${A(() => setCell(l, f))} aria-label="${esc(L.name)}, frame ${f + 1}"></button>`;
      }
    }
    return h + '</div>';
  }

  // ---------------------------------------------------------------- palette
  const palIdx = (c) => ed.spr.palette.findIndex(p => sameColor(p, c));
  function setPalette(list, msg) {
    if (!list.length) { toast('No colours found'); return; }
    step(); ed.spr.palette = list.slice(0, 256).map(c => c.slice()); ed.sw = 0; changed(); rer(); if (msg) toast(msg);
  }
  // every colour drawn in the sprite, in the order first seen
  function usedColors() {
    const seen = new Map();
    for (const cel of ed.spr.cels.values()) { const d = cel.data; for (let j = 0; j < d.length; j += 4) if (d[j + 3]) { const k = d[j] << 24 | d[j + 1] << 16 | d[j + 2] << 8 | d[j + 3]; if (!seen.has(k)) seen.set(k, [d[j], d[j + 1], d[j + 2], d[j + 3]]); if (seen.size > 256) return [...seen.values()]; } }
    return [...seen.values()];
  }
  const palOps = {
    ramp() {
      const r = makeRamp(ed.color), pal = ed.spr.palette.slice(), i = palIdx(ed.color);
      const fresh = r.filter((c, k) => k === 2 || !pal.some(p => sameColor(p, c)));
      if (i >= 0) pal.splice(i, 1, ...fresh); else pal.push(...fresh);
      setPalette(pal, 'Added a ramp of ' + fresh.length);
    },
    sort() { setPalette(ed.spr.palette.slice().sort((a, b) => lum(a) - lum(b)), 'Sorted dark to light'); },
    move(d) {
      const pal = ed.spr.palette.slice(), i = palIdx(ed.color), j = i + d;
      if (i < 0 || j < 0 || j >= pal.length) return;
      [pal[i], pal[j]] = [pal[j], pal[i]]; setPalette(pal);
    },
    fromSprite() {
      const pal = ed.spr.palette.slice(), add = usedColors().filter(c => !pal.some(p => sameColor(p, c)));
      if (!add.length) { toast('Every colour is in the palette'); return; }
      setPalette(pal.concat(add), 'Added ' + add.length + (add.length === 1 ? ' colour' : ' colours'));
    },
    unused() {
      const used = usedColors(), pal = ed.spr.palette.filter(p => used.some(c => sameColor(c, p)));
      const n = ed.spr.palette.length - pal.length;
      if (!n) { toast('Every colour is used'); return; }
      setPalette(pal, 'Removed ' + n + (n === 1 ? ' colour' : ' colours'));
    },
    async exportHex() {
      const txt = ed.spr.palette.map(c => rgbHex(c).slice(1)).join('\n') + '\n';
      await share(new File([txt], item.name.replace(/[^\w-]+/g, '_') + '-palette.hex', { type: 'text/plain' }));
    },
    async exportPng() {
      const pal = ed.spr.palette, c = document.createElement('canvas'); c.width = Math.max(1, pal.length); c.height = 1;
      const x = c.getContext('2d'), im = x.createImageData(c.width, 1);
      pal.forEach((p, i) => im.data.set([p[0], p[1], p[2], p[3] === undefined ? 255 : p[3]], i * 4)); x.putImageData(im, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      await share(new File([blob], item.name.replace(/[^\w-]+/g, '_') + '-palette.png', { type: 'image/png' }));
    },
    async importFile(f) {
      if (!f) return;
      try {
        let list;
        if (/\.(aseprite|ase)$/i.test(f.name)) list = (await readAse(await f.arrayBuffer())).palette;
        else if (/^image\//.test(f.type) || /\.(png|gif|jpe?g|webp)$/i.test(f.name)) {
          const bmp = await createImageBitmap(f), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const x = c.getContext('2d'); x.drawImage(bmp, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; list = [];
          for (let j = 0; j < d.length && list.length <= 256; j += 4) if (d[j + 3] && !list.some(p => p[0] === d[j] && p[1] === d[j + 1] && p[2] === d[j + 2])) list.push([d[j], d[j + 1], d[j + 2], 255]);
        } else list = parsePaletteText(await f.text());
        setPalette(list, 'Loaded ' + list.length + ' colours from ' + f.name);
      } catch (e) { toast('Could not read ' + f.name); }
    }
  };
  // change a palette colour; with recolour on, every pixel of the old colour in the sprite changes with it
  function changePaletteColor(i, old) {
    const s = ed.spr, nw = ed.color.slice();
    if (sameColor(old, nw)) { toast('The colour has not changed'); return; }
    step(); s.palette[i] = nw;
    let n = 0;
    if (ed.recolor) for (const [k, cel] of s.cels) {
      const d = cel.data; let copy = null;
      for (let j = 0; j < d.length; j += 4) if (d[j + 3] && d[j] === old[0] && d[j + 1] === old[1] && d[j + 2] === old[2] && d[j + 3] === (old[3] === undefined ? 255 : old[3])) {
        if (!copy) copy = d.slice();
        copy[j] = nw[0]; copy[j + 1] = nw[1]; copy[j + 2] = nw[2]; copy[j + 3] = nw[3]; n++;
      }
      if (copy) s.cels.set(k, { data: copy, opacity: cel.opacity, v: (cel.v || 0) + 1 });
    }
    ed.sheet.old = nw.slice(); changed(); rer(); draw();
    toast(ed.recolor ? (n ? 'Changed ' + n + (n === 1 ? ' pixel' : ' pixels') : 'Palette updated, no pixels used it') : 'Palette updated');
  }

  function sheetHtml() {
    const sh = ed.sheet; if (!sh) return '';
    const s = ed.spr, close = iconBtn('check', A(() => { ed.sheet = null; rer(); }), { color: '#fff', label: 'Done' });
    const head = (t, sub) => `<div class="ihead">${well(40, sh.kind === 'sel' ? svgRows(G.selectTool, PINK) : icon(sh.kind === 'canvas' ? 'scene' : sh.kind === 'export' ? 'up' : sh.kind === 'color' || sh.kind === 'palette' ? 'paint' : sh.kind === 'tag' ? 'events' : sh.kind === 'frame' ? 'scene' : sh.kind === 'layer' ? 'tiles' : 'display', PINK))}<span class="t"><span class="title acc ell">${esc(t)}</span><span class="sub ell">${esc(sub)}</span></span>${close}</div>`;
    const btns = (list, three) => `<div class="se-btns${three ? ' se-btns3' : ''}">${list.map(([ic, label, fn, dis, rows]) => `<button class="btn bare" ${A(fn)}${dis ? ' disabled' : ''}>${well(28, rows ? svgRows(rows, '#e4e2dc') : icon(ic, '#e4e2dc'))}<span>${esc(label)}</span></button>`).join('')}</div>`;
    const field = (id, val, label) => `<label class="se-field"><span class="cap">${esc(label)}</span><input id="${id}" value="${esc(val)}" maxlength="40" autocomplete="off" spellcheck="false"></label>`;
    let body = '';
    if (sh.kind === 'color') {
      body = head(sh.i >= 0 && s.palette[sh.i] ? 'Edit colour' : 'Colour', rgbHex(ed.color).toUpperCase() + ' · ' + Math.round((ed.color[3] / 255) * 100) + '% solid') + `
        <canvas id="se-sv" class="se-pick" style="height:120px"></canvas>
        <canvas id="se-hue" class="se-pick" style="height:24px"></canvas>
        <canvas id="se-alpha" class="se-pick" style="height:24px"></canvas>
        <div class="se-hexrow">${swatch(ed.color, 40)}<label class="se-field" style="flex:1"><span class="cap">Hex</span><input id="se-hex" value="${rgbHex(ed.color).slice(1).toUpperCase()}" maxlength="8" autocomplete="off" spellcheck="false"></label></div>
        ${sh.i >= 0 && s.palette[sh.i] ? `<div class="grow"><span class="t"><span class="cap">Palette colour ${sh.i + 1}</span><span class="sub">${ed.recolor ? 'Pixels of this colour change too' : 'Only the palette changes'}</span></span>${toggle(ed.recolor, A(() => { ed.recolor = !ed.recolor; rer(); }), 'Recolour the sprite')}</div>` : ''}
        ${btns([...(sh.i >= 0 && s.palette[sh.i] ? [['check', 'Change colour', () => changePaletteColor(sh.i, sh.old)]] : []), ['plus', 'Add to palette', () => { if (s.palette.some(c => sameColor(c, ed.color))) { toast('Already in the palette'); return; } step(); s.palette.push(ed.color.slice()); ed.sw = 1e6; changed(); rer(); }],
          ['trash', 'Remove', () => { const i = s.palette.findIndex(c => sameColor(c, ed.color)); if (i < 0) { toast('This colour is not in the palette'); return; } step(); s.palette.splice(i, 1); changed(); rer(); }]])}`;
    } else if (sh.kind === 'palette') {
      const i = palIdx(ed.color), n = s.palette.length;
      body = head('Palette', n + (n === 1 ? ' colour' : ' colours') + (i >= 0 ? ' · colour ' + (i + 1) + ' chosen' : '')) + `
        <div class="se-palgrid">${s.palette.map((c, k) => `<button class="se-pc${k === i ? ' sel' : ''}" ${A(() => { ed.color = c.slice(); if (ed.color.length < 4) ed.color.push(255); rer(); })} aria-label="Palette colour ${k + 1}">${swatch(c, 26)}</button>`).join('')}</div>
        ${btns([['paint', 'Edit colour', () => { ed.sheet = { kind: 'color', i, old: ed.color.slice() }; rer(); }, i < 0], [null, 'Make ramp', palOps.ramp, false, G.shade],
          ['left', 'Move left', () => palOps.move(-1), i <= 0], ['right', 'Move right', () => palOps.move(1), i < 0 || i >= n - 1],
          ['down', 'Sort by light', palOps.sort, n < 2], ['plus', 'From sprite', palOps.fromSprite], ['trash', 'Remove unused', palOps.unused, !n], ['trash', 'Remove colour', () => { if (i < 0) return; step(); s.palette.splice(i, 1); changed(); rer(); }, i < 0]])}
        <div class="se-note sub" style="margin-top:12px">Files</div>
        <div class="se-btns">
          <label class="btn bare se-file">${well(28, icon('down', '#e4e2dc'))}<span>Import</span><input type="file" id="se-palimp" accept=".hex,.gpl,.pal,.txt,.aseprite,.ase,image/png,image/gif"></label>
          <button class="btn bare" ${A(palOps.exportHex)}${n ? '' : ' disabled'}>${well(28, icon('up', '#e4e2dc'))}<span>Export .hex</span></button>
          <button class="btn bare" ${A(palOps.exportPng)}${n ? '' : ' disabled'}>${well(28, icon('up', '#e4e2dc'))}<span>Export .png</span></button>
        </div>
        <div class="se-note sub" style="margin-top:12px">Presets (replace the palette)</div>
        <div class="se-btns">${PRESETS.map(([nm, list]) => `<button class="btn bare" ${A(() => setPalette(list, nm + ' palette'))}><span class="se-strip">${list.slice(0, 8).map(c => `<i style="background:${rgbHex(c)}"></i>`).join('')}</span><span>${esc(nm)}</span></button>`).join('')}</div>`;
    } else if (sh.kind === 'layer') {
      const L = s.layers[ed.layer];
      body = head(L.name, L.group ? 'Layer group (from desktop Aseprite)' : 'Layer ' + (ed.layer + 1) + ' of ' + s.layers.length) + field('se-lname', L.name, 'Name') + `
        <div class="grow"><span class="t"><span class="cap">Visible</span><span class="sub">Hidden layers are not exported</span></span>${toggle(L.visible, A(() => { step(); L.visible = !L.visible; changed(); rer(); }), 'Visible')}</div>
        <div class="grow"><span class="t"><span class="cap">Locked</span><span class="sub">Prevents drawing</span></span>${toggle(L.locked, A(() => { step(); L.locked = !L.locked; changed(); rer(); }), 'Locked')}</div>
        <div class="grow"><span class="t"><span class="cap">Opacity</span><span class="sub">How solid the layer is</span></span>${stepper(Math.round(L.opacity / 2.55) + '%', A(() => { step(); L.opacity = Math.max(0, Math.round(L.opacity - 25.5)); changed(); rer(); }), A(() => { step(); L.opacity = Math.min(255, Math.round(L.opacity + 25.5)); changed(); rer(); }), 'opacity')}</div>
        ${btns([['up', 'Move up', () => moveLayer(1)], ['down', 'Move down', () => moveLayer(-1)], ['dup', 'Duplicate', dupLayer], [null, 'Merge down', mergeDown, false, G.merge], ['plus', 'New layer', addLayer], ['trash', 'Delete', () => { if (confirm('Delete the layer ' + L.name + '?')) delLayer(); }]])}`;
    } else if (sh.kind === 'frame') {
      const fr = s.frames[ed.frame], expect = item.cell && !opts.extra ? item.frames : 0;
      body = head('Frame ' + (ed.frame + 1), s.frames.length + (s.frames.length === 1 ? ' frame' : ' frames') + (expect && expect !== s.frames.length ? ' · the game expects ' + expect : '')) + `
        <div class="grow"><span class="t"><span class="cap">Duration</span><span class="sub">Display time during playback</span></span>${stepper(fr.dur + 'MS', A(() => { step(); fr.dur = Math.max(10, fr.dur - (fr.dur > 200 ? 50 : 10)); changed(); rer(); }), A(() => { step(); fr.dur = Math.min(65535, fr.dur + (fr.dur >= 200 ? 50 : 10)); changed(); rer(); }), 'duration', true)}</div>
        ${btns([['dup', 'Duplicate', () => addFrame(false)], ['plus', 'New empty', () => addFrame(true)], ['left', 'Move left', () => moveFrame(-1), ed.frame === 0], ['right', 'Move right', () => moveFrame(1), ed.frame === s.frames.length - 1], ['events', 'New tag', addTag], ['trash', 'Delete', () => { ed.sheet = null; delFrame(); }, s.frames.length < 2]])}
        ${item.cell ? '' : `<div class="se-note sub">The game shows frame 1 of this picture.</div>`}`;
    } else if (sh.kind === 'tag') {
      const t = s.tags[sh.i]; if (!t) { ed.sheet = null; return ''; }
      const n = s.frames.length;
      body = head(t.name, 'Tag · frames ' + (t.from + 1) + ' to ' + (t.to + 1)) + field('se-tname', t.name, 'Name') + `
        <div class="grow"><span class="t"><span class="cap">From</span></span>${stepper(String(t.from + 1), A(() => { step(); t.from = Math.max(0, t.from - 1); changed(); rer(); }), A(() => { step(); t.from = Math.min(t.to, t.from + 1); changed(); rer(); }), 'start frame')}</div>
        <div class="grow"><span class="t"><span class="cap">To</span></span>${stepper(String(t.to + 1), A(() => { step(); t.to = Math.max(t.from, t.to - 1); changed(); rer(); }), A(() => { step(); t.to = Math.min(n - 1, t.to + 1); changed(); rer(); }), 'end frame')}</div>
        <div class="grow"><span class="t"><span class="cap">Direction</span></span>${stepper(DIRS[t.dir || 0], A(() => { step(); t.dir = ((t.dir || 0) + 2) % 3; changed(); rer(); }), A(() => { step(); t.dir = ((t.dir || 0) + 1) % 3; changed(); rer(); }), 'direction', true)}</div>
        ${btns([[ed.playing && ed.playTag === sh.i ? 'pause' : 'play', ed.playing && ed.playTag === sh.i ? 'Stop' : 'Play', () => { ed.playTag = sh.i; play(); }],
          ['paint', 'Colour', () => { step(); const k = TAG_COLORS.findIndex(c => sameColor(c, t.color)); t.color = TAG_COLORS[(k + 1) % TAG_COLORS.length].slice(); changed(); rer(); }],
          ['select', 'Play all frames', () => { ed.playTag = -1; ed.sheet = null; rer(); }, ed.playTag === -1],
          ['trash', 'Delete', () => { step(); s.tags.splice(sh.i, 1); ed.playTag = ed.playTag === sh.i ? -1 : ed.playTag > sh.i ? ed.playTag - 1 : ed.playTag; ed.sheet = null; changed(); rer(); }]])}`;
    } else if (sh.kind === 'sel') {
      const b = ed.sel && SEL.maskBounds(ed.sel.mask, s.w, s.h), F = ed.float;
      body = head('Selection', F ? 'Floating · ' + Math.round(F.s * 100) + '%' + (F.r ? ' · turned' : '') : b ? b.w + '×' + b.h + ' selected' : 'Nothing selected: changes apply to the whole layer') + btns([
        ['select', 'All', selectAll], ['erase', 'None', deselect], [null, 'Invert', invertSel, false, G.invert],
        ['dup', 'Copy', () => copy()], [null, 'Cut', cut, false, G.cut], [null, 'Paste', paste, !CLIP, G.paste],
        ['trash', 'Delete', del], ['fill', 'Fill', fillSel], [null, 'Flip ↔', flipH, false, G.flipH],
        [null, 'Flip ↕', flipV, false, G.flipV], ['undo', 'Turn left', () => turn(3)], ['redo', 'Turn right', () => turn(1)]], true) + `
        <div class="grow"><span class="t"><span class="cap">Magic wand</span><span class="sub">${ed.contiguous ? 'Connected pixels only' : 'Every pixel of that colour'}</span></span>${toggle(ed.contiguous, A(() => { ed.contiguous = !ed.contiguous; rer(); }), 'Touching only')}</div>`;
    } else if (sh.kind === 'canvas') {
      const c = ed.cv || (ed.cv = { w: s.w, h: s.h, ax: 0.5, ay: 0.5 }), b = ed.sel && SEL.maskBounds(ed.sel.mask, s.w, s.h);
      const gameCell = item.cell && !(opts.extra && opts.extra.item) ? item.cell : null, game = gameCell ? gameCell[0] + '×' + gameCell[1] : !(opts.extra && opts.extra.item) ? 'this size' : '';
      const anchor = [0, 0.5, 1].map(ay => [0, 0.5, 1].map(ax => `<button class="se-anc${c.ax === ax && c.ay === ay ? ' on' : ''}" ${A(() => { c.ax = ax; c.ay = ay; rer(); })} aria-label="Keep the picture ${['top', 'middle', 'bottom'][ay * 2]} ${['left', 'centre', 'right'][ax * 2]}" aria-pressed="${c.ax === ax && c.ay === ay}"></button>`).join('')).join('');
      body = head('Canvas', s.w + '×' + s.h + (game ? ' · the game expects ' + game : '')) + `
        <div class="se-cvrow">
          <label class="se-field"><span class="cap">Width</span><input id="se-cw" type="number" inputmode="numeric" min="1" max="${MAXSIDE}" value="${c.w}"></label>
          <label class="se-field"><span class="cap">Height</span><input id="se-ch" type="number" inputmode="numeric" min="1" max="${MAXSIDE}" value="${c.h}"></label>
          <div class="se-field"><span class="cap">Anchor</span><div class="se-anchor">${anchor}</div></div>
        </div>
        ${btns([['check', 'Use this size', () => { const w = +document.getElementById('se-cw').value, h = +document.getElementById('se-ch').value; resizeCanvas(w, h, c.ax, c.ay); }],
          ['select', 'Trim', trim], ['scene', 'Crop to selection', () => (b ? crop(b) : toast('Select something first'))],
          ['plus', 'Scale ×2', () => scaleSprite(2)], ['minus', 'Scale ×½', () => scaleSprite(0.5)],
          [null, 'Flip all ↔', () => flipCanvas(true), G.flipH], [null, 'Flip all ↕', () => flipCanvas(false), G.flipV], ['redo', 'Turn all', () => turnCanvas(1)]].map(x => x.slice(0, 3).concat([false, x[3]])))}`;
    } else if (sh.kind === 'export') {
      const n = s.frames.length, t = s.tags[ed.playTag], o = ed.out, newSheet = opts.extra && opts.extra.item && opts.extra.item.cell;
      body = head('Export', 'Save or send a copy · ' + s.w * ed.exScale + '×' + s.h * ed.exScale + ' per frame') + `
        <div class="grow"><span class="t"><span class="cap">Size</span><span class="sub">Pixel scale</span></span>${stepper(ed.exScale + '×', A(() => { const L = [1, 2, 3, 4, 6, 8, 10, 16]; ed.exScale = L[Math.max(0, L.indexOf(ed.exScale) - 1)]; ed.out = null; rer(); }), A(() => { const L = [1, 2, 3, 4, 6, 8, 10, 16]; ed.exScale = L[Math.min(L.length - 1, L.indexOf(ed.exScale) + 1)]; ed.out = null; rer(); }), 'size')}</div>
        ${n > 1 ? `<div class="grow"><span class="t"><span class="cap">Sheet</span><span class="sub">Frames per row</span></span>${stepper(String(Math.min(n, ed.exCols || n)), A(() => { ed.exCols = Math.max(1, Math.min(n, ed.exCols || n) - 1); ed.out = null; rer(); }), A(() => { ed.exCols = Math.min(n, (ed.exCols || n) + 1); ed.out = null; rer(); }), 'frames across')}</div>` : ''}
        ${newSheet && n > 1 ? `<div class="grow"><span class="t"><span class="cap">Game picture</span><span class="sub">Frames per row in the game's PNG</span></span>${stepper(String(Math.min(n, ed.gameCols || n)), A(() => { ed.gameCols = Math.max(1, Math.min(n, ed.gameCols || n) - 1); changed(); rer(); }), A(() => { ed.gameCols = Math.min(n, (ed.gameCols || n) + 1); changed(); rer(); }), 'game frames across')}</div>` : ''}
        ${btns([['select', 'PNG · this frame', () => prepare('frame')], ['tiles', 'PNG · sheet', () => prepare('sheet'), n < 2],
          ['play', 'GIF' + (t ? ' · ' + t.name : ''), () => prepare('gif'), n < 2], ['dup', '.aseprite', () => prepare('ase')]])}
        ${o ? `<div class="se-ready">${o.busy ? '<span class="sub">Making it…</span>' : `<span class="t" style="min-width:0;display:flex;flex-direction:column"><span class="cap ell" style="text-transform:none">${esc(o.file.name)}</span><span class="sub">${Math.max(1, Math.round(o.file.size / 1024))} KB · ready</span></span>${bareBtn('up', 'Share', A(() => share(o.file)))}`}</div>` : `<div class="se-note sub">${n > 1 ? 'The GIF plays ' + (t ? 'the tag ' + esc(t.name) : 'every frame') + '. ' : ''}Share saves or sends the file.</div>`}`;
    } else if (sh.kind === 'menu') {
      const r = store.record(g.file, item.id);
      const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
      body = head('Sprite', s.w + '×' + s.h + ' · ' + plural(s.frames.length, 'frame') + ' · ' + plural(s.layers.length, 'layer')) + `
        <div class="se-btns se-btns3 se-big">
          <button class="btn bare" ${A(() => { ed.cv = { w: s.w, h: s.h, ax: 0.5, ay: 0.5 }; ed.sheet = { kind: 'canvas' }; rer(); })}>${well(28, icon('scene', '#e4e2dc'))}<span>Canvas</span></button>
          <label class="btn bare se-file">${well(28, icon('down', '#e4e2dc'))}<span>Import</span><input type="file" id="se-import" accept="image/png,image/gif,image/jpeg,image/webp,.aseprite,.ase"></label>
          <button class="btn bare" ${A(() => { ed.out = null; ed.exCols = ed.exCols || Math.min(s.frames.length, 8); ed.sheet = { kind: 'export' }; rer(); })}>${well(28, icon('up', '#e4e2dc'))}<span>Export</span></button>
        </div>
        <div class="grow"><span class="t"><span class="cap">Pixel grid</span><span class="sub">Shown at high zoom</span></span>${toggle(ed.grid, A(() => { ed.grid = !ed.grid; rer(); }), 'Pixel grid')}</div>
        <div class="grow"><span class="t"><span class="cap">Onion skin</span><span class="sub">Previous frame in red, next in blue</span></span>${toggle(ed.onion, A(() => { ed.onion = !ed.onion; rer(); }), 'Onion skin')}</div>
        <div class="se-note sub">${r && r.dirty ? 'Saved on this phone. Push from Settings › Sync.' : r ? 'Pushed. The site updates within two minutes.' : 'No changes.'} Files: ${esc(store.asePath(item.file).split('/').pop())} (Aseprite) and ${esc(item.file.split('/').pop())} (game).</div>
        ${btns([['select', 'Fit to screen', () => { fit(); ed.sheet = null; rer(); }], ['trash', r && r.isNew ? 'Delete sprite' : 'Discard changes', async () => {
          if (!r) { toast('Nothing to discard'); return; }
          if (!confirm(r.isNew ? 'Delete ' + item.name + '? It has not been pushed.' : 'Discard changes to ' + item.name + ' and restore the GitHub version?')) return;
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
  let antsT = 0;
  const ov = {
    place: 'Sprite editor',
    render() {
      const s = ed.spr;
      const top = `<div class="plate bar">
        ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back to Art' })}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">${esc(item.name)}</span><span class="sub ell" id="se-sub">${s ? esc(subLine()) : ed.err ? 'Could not open: ' + esc(ed.err) : 'Opening…'}</span></span>
        ${iconBtn('undo', A(undo), { color: '#fff', label: 'Undo', disabled: !ed.hist.length })}
        ${iconBtn('redo', A(redo), { color: '#fff', label: 'Redo', disabled: !ed.fut.length })}
        ${iconBtn(null, A(() => { ed.sheet = ed.sheet && ed.sheet.kind === 'menu' ? null : { kind: 'menu' }; rer(); }), { color: '#fff', label: 'Sprite: canvas, import, export', rows: G.dots })}
      </div>`;
      if (!s) return `<div class="screen-tool sprite-ed" style="--acc:${PINK}"><h1 class="sr">Draw · ${esc(item.name)}</h1>${top}<div class="screen fit se-view"><span class="sub">${ed.err ? esc(ed.err) : 'Opening…'}</span></div></div>`;
      // the tools, like the Studio's tabs: the chosen one wide, with its name
      const tools = `<div class="plate bar se-tools" role="tablist" aria-label="Tools" style="grid-template-columns:repeat(${TOOLS.length},1fr)">
        ${TOOLS.map(([t, label]) => { const on = ed.tool === t; return `<button class="btn icon bare se-tool" role="tab" aria-selected="${on}" aria-label="${TOOL_HELP[t]}" ${A(() => setTool(t))}>${well(28, (on ? '<span class="ring"></span>' : '') + svgRows(G[TOOL_ICON[t]], on ? PINK : '#e4e2dc'))}<span class="lbl" hidden>${label}</span></button>`; }).join('')}
      </div>`;
      // under the tools: the palette, or (selecting and moving) the selection's own buttons, or (while pixels float) how to change them
      const F = ed.float;
      const more = iconBtn(null, A(() => { ed.sheet = ed.sheet && ed.sheet.kind === 'sel' ? null : { kind: 'sel' }; rer(); }), { color: '#fff', label: 'More for the selection', rows: G.dots });
      const clipBtns = `${iconBtn('dup', A(() => copy()), { color: '#fff', label: 'Copy' })}${iconBtn(null, A(paste), { color: '#fff', label: 'Paste', rows: G.paste, disabled: !CLIP })}`;
      // Select: how to select (box, lasso, wand) and whether it replaces, adds or subtracts
      const selBar = `<div class="plate bar se-colors" role="toolbar" aria-label="Selection">
        ${SHAPES.map(([k, label]) => iconBtn(null, A(() => { ed.shape = k; rer(); }), { on: ed.shape === k, label, pressed: ed.shape === k, rows: G[SHAPE_ICON[k]] })).join('')}
        <button class="vscreen se-mode" ${A(() => { ed.mode = (ed.mode + 1) % 3; rer(); })} aria-label="${MODES[ed.mode]} (tap to change)">${svgText(MODE_TEXT[ed.mode], PINK)}</button>
        ${clipBtns}${more}
      </div>`;
      // Move: what to do with the selected pixels (or the whole layer)
      const moveBar = `<div class="plate bar se-colors" role="toolbar" aria-label="Move">
        ${iconBtn(null, A(flipH), { color: '#fff', label: 'Flip horizontally', rows: G.flipH })}
        ${iconBtn(null, A(flipV), { color: '#fff', label: 'Flip vertically', rows: G.flipV })}
        ${iconBtn('redo', A(() => turn(1)), { color: '#fff', label: 'Turn a quarter right' })}
        ${clipBtns}${more}
      </div>`;
      const floatBar = F ? `<div class="plate bar se-colors" role="toolbar" aria-label="Floating pixels">
        ${iconBtn('check', A(() => { settle(); paintCells(); rer(); }), { color: PINK, label: 'Drop (put the pixels down)' })}
        ${iconBtn(null, A(flipH), { color: '#fff', label: 'Flip horizontally', rows: G.flipH })}
        ${iconBtn(null, A(flipV), { color: '#fff', label: 'Flip vertically', rows: G.flipV })}
        ${iconBtn('redo', A(() => turn(1)), { color: '#fff', label: 'Turn a quarter right' })}
        ${stepper(Math.round(F.s * 100) + '%', A(() => scaleBy(-1)), A(() => scaleBy(1)), 'size')}
      </div>` : '';
      const colors = F ? floatBar : ed.tool === 'select' ? selBar : ed.tool === 'move' ? moveBar : `<div class="plate bar se-colors">
        ${ed.tool === 'shape' ? iconBtn(null, A(() => { ed.shapeKind = (ed.shapeKind + 1) % SHAPE_KINDS.length; rer(); }), { color: PINK, label: SHAPE_KINDS[ed.shapeKind][1] + ' (tap to change)', rows: G[SHAPE_KINDS[ed.shapeKind][2]] }) : ''}${ed.tool === 'shade' ? `<button class="vscreen se-mode" ${A(() => { ed.shadeDir = -ed.shadeDir; rer(); })} aria-label="${ed.shadeDir < 0 ? 'Darker' : 'Lighter'} (tap to change)">${svgText(ed.shadeDir < 0 ? 'DARK' : 'LIGHT', PINK)}</button>` : ''}<button class="se-cur" id="se-cur" ${A(() => { ed.sheet = ed.sheet && ed.sheet.kind === 'color' ? null : { kind: 'color', i: palIdx(ed.color), old: ed.color.slice() }; rer(); })} aria-label="Colour ${rgbHex(ed.color)}, change it">${swatch(ed.color, 36)}</button>
        <div class="se-pal" id="se-pal">${s.palette.map((c, i) => `<button class="se-pc${sameColor(c, ed.color) ? ' sel' : ''}" ${A(() => setColor(c))} aria-label="Palette colour ${i + 1}">${swatch(c, 24)}</button>`).join('')}</div>
        ${s.palette.some(c => sameColor(c, ed.color)) ? '' : iconBtn('plus', A(() => { step(); s.palette.push(ed.color.slice()); ed.sw = 1e6; changed(); rer(); }), { color: PINK, label: 'Add this colour to the palette' })}
        ${iconBtn(null, A(() => { ed.sheet = ed.sheet && ed.sheet.kind === 'palette' ? null : { kind: 'palette' }; rer(); }), { color: '#fff', label: 'Palette', rows: G.palette })}
      </div>`;
      const tl = `<div class="plate se-tl">
        <div class="se-tlbar" data-pad="pager">
          ${iconBtn(ed.playing ? 'pause' : 'play', A(play), { color: '#fff', label: ed.playing ? 'Stop' : 'Play' + (s.tags[ed.playTag] ? ' ' + s.tags[ed.playTag].name : '') })}
          ${iconBtn('left', A(() => setCell(ed.layer, (ed.frame + s.frames.length - 1) % s.frames.length)), { color: '#fff', label: 'Previous frame' })}
          <button class="se-fbtn" ${A(() => setFrame(ed.frame))} aria-label="Frame settings"><span class="cap acc" id="se-fn">Frame ${ed.frame + 1} / ${s.frames.length}</span><span class="sub ell" id="se-fl">${esc(frameLine())}</span></button>
          ${iconBtn('right', A(() => setCell(ed.layer, (ed.frame + 1) % s.frames.length)), { color: '#fff', label: 'Next frame' })}
          ${iconBtn(null, A(() => { ed.onion = !ed.onion; rer(); }), { on: ed.onion, label: 'Onion skin', pressed: ed.onion, rows: G.onion })}
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
      const pimp = root.querySelector('#se-palimp'); if (pimp) pimp.addEventListener('change', () => { const f = pimp.files && pimp.files[0]; pimp.value = ''; palOps.importFile(f); });
      const imp = root.querySelector('#se-import'); if (imp) imp.addEventListener('change', () => { const f = imp.files && imp.files[0]; imp.value = ''; importFile(f); });
    },
    frame(t) {
      if (ed.playing && ed.spr) tickPlay(performance.now());
      else if ((ed.sel || ed.preview || act) && ed.spr && performance.now() - antsT > 120) { antsT = performance.now(); draw(true); }
      // controller: B closes a sheet or the editor; LB and RB step frames; Start plays; X undoes; the ring does the rest
      if (input.pressed('b')) { if (ed.sheet) { ed.sheet = null; rer(); } else app.close(); return; }
      if (ed.spr) {
        const n = ed.spr.frames.length;
        if (input.pressed('lb')) { setCell(ed.layer, (ed.frame + n - 1) % n); return; }
        if (input.pressed('rb')) { setCell(ed.layer, (ed.frame + 1) % n); return; }
        if (input.pressed('start')) { play(); return; }
        if (input.pressed('x')) { undo(); return; }
      }
      padFrame(document.getElementById('app'), nav, input);
    },
    onClose() { document.removeEventListener('visibilitychange', flush); removeEventListener('pagehide', flush); if (saveT && !ed.discarded) save(); if (opts.onClose) saving.then(opts.onClose); }
  };
  app.open(ov);
}
