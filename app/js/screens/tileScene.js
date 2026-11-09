// The Studio's Scene tab for games on the tile engine (made with New game): the scene as a grid of 8×8 tiles with things
// placed on top. Tools: Paint and Box (tiles), Erase, Place (objects, start, exit), Select (move or adjust a thing) and Hand.
// One finger uses the tool; two fingers pan and pinch to zoom (any tool). A stroke or a drag is one undo step.
import { well, svgRows, G } from '../pixel.js';
import { A, esc, iconBtn, stepper } from '../ui.js';
import { openTileEditor, planRows, planColor, svgPlan } from '../tileEditor.js';

const T = 8, GREEN = '#7dff6a', MAXW = 256, MAXH = 128;
const TOOLS = [['paint', 'Paint tiles', 'paint'], ['box', 'Box of tiles', 'shapeBoxF'], ['erase', 'Erase', 'erase'], ['place', 'Place', 'place'], ['select', 'Select', 'select'], ['hand', 'Hand: move the view', 'pan']];
const KINDS = [['solid', 'Solid', 'Walls and floors'], ['oneWay', 'Platform', 'Stand on it from above'], ['hurt', 'Hurts', 'Hurts the player'], ['decor', 'Decor', 'Just for looks']];
const COLORS = ['#7a9a4a', '#5a4632', '#b0563c', '#8b8794', '#d6a35a', '#d6d2dc', '#8fd25a', '#3a9a5c', '#2f6f8f', '#4d7cff', '#ff4fd8', '#ff5a1f', '#ffd23f', '#f4f1ea', '#4a4654', '#0b0b10'];
const kindOf = (t) => (t.solid ? 'solid' : t.oneWay ? 'oneWay' : t.hurt ? 'hurt' : 'decor');
const FLAG = ['1111', '1111', '1110', '1000', '1000', '1000', '1000', '1000'];
const START = ['00111100', '01111110', '11011011', '11111111', '01111110', '00111100', '01000010', '11000011'];
function darken(hex, k) { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, n >> 8 & 255, n & 255].map(c => Math.round(c * k).toString(16).padStart(2, '0')).join(''); }

// c: { app, ed, g, data, scenes, scene, changeScenes, objects, changeObjects, glyph, rerender, editObject }
export function tileScene(c) {
  const { ed } = c, D = c.data(), tiles = D.tiles || {}, list = c.scenes(), cur = c.scene();
  const si = Math.max(0, list.findIndex(x => x.id === cur.id));
  if (!ed.tt) ed.tt = 'paint';
  if (!tiles[ed.tile]) ed.tile = Object.keys(tiles)[0];
  const objIds = Object.keys(c.objects());
  if (ed.tt === 'place' && !(objIds.includes(ed.placeType) || ed.placeType === 'start' || ed.placeType === 'exit')) ed.placeType = objIds[0] || 'start';
  const toolBtns = TOOLS.map(([k, l, ic]) => iconBtn(null, A(() => { ed.tt = k; if (k !== 'select') ed.tsel = null; c.rerender(); }), { on: ed.tt === k, label: l, pressed: ed.tt === k, rows: G[ic] })).join('');
  const go = (k) => { ed.scene = list[(si + k + list.length) % list.length].id; ed.tsel = null; c.rerender(); };
  const toolbar = `<div class="plate bar ts-tools" role="toolbar" aria-label="Scene tools">${toolBtns}</div>`;
  const screen = `<div class="screen fit gap20 ts-view"><canvas class="pix" id="tsc" role="img" aria-label="${esc(cur.name)}: tiles and things. One finger uses the tool, two fingers move and zoom."></canvas>
    <button class="se-zoom" id="ts-fit" ${A(() => { delete ed.views[cur.id]; c.rerender(); })} aria-label="Fit the scene">FIT</button>
    <button class="se-zoom ts-look${ed.gameLook ? ' on' : ''}" ${A(() => { ed.gameLook = !ed.gameLook; c.rerender(); })} aria-pressed="${!!ed.gameLook}" aria-label="${ed.gameLook ? 'Showing the game art: tap for the plan' : 'Showing the plan: tap for the game art'}">${ed.gameLook ? 'GAME' : 'PLAN'}</button></div>`;
  const tileArt = (ch, size) => { const t = tiles[ch]; return t ? (ed.gameLook ? svgTile(t, size) : svgPlan(t, size)) : ''; };
  let body = '';
  const setL = (fn) => c.changeScenes(l2 => { const L = l2.find(x => x.id === cur.id); if (L) fn(L); });
  if (ed.tt === 'paint' || ed.tt === 'box' || ed.tt === 'erase') {
    const t = tiles[ed.tile];
    {
      body = `<div class="ihead">${well(40, ed.tt === 'erase' ? svgRows(G.erase, GREEN) : tileArt(ed.tile, 16))}<span class="t"><span class="title acc ell">${ed.tt === 'erase' ? 'Erase' : esc(t ? t.name : 'Tiles')}</span><span class="sub">${ed.tt === 'erase' ? 'Drag over tiles to clear them' : ed.tt === 'box' ? 'Drag a box to fill it' : 'Drag to paint'}${ed.tt !== 'erase' && t ? ' · ' + KINDS.find(x => x[0] === kindOf(t))[1].toLowerCase() : ''}</span></span>
          ${ed.tt !== 'erase' && t ? iconBtn('edit', A(() => openTileEditor(c.app, c.g, ed.tile, c.data(), c.rerender, ed.gameLook ? 'game' : 'plan')), { label: 'Draw this tile' }) : ''}</div>
        <div class="tray ts-tray">${Object.keys(tiles).map(ch => { const on = ch === ed.tile && ed.tt !== 'erase'; return `<button class="${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${esc(tiles[ch].name)}" ${A(() => { ed.tile = ch; if (ed.tt === 'erase') ed.tt = 'paint'; c.rerender(); })}>${well(40, (on ? '<span class="ring"></span>' : '') + tileArt(ch, 16))}</button>`; }).join('')}
          <button aria-label="New tile" ${A(() => { const ch = freeChar(tiles); if (!ch) { c.app.toast('No room for more tiles'); return; } c.changeTiles(all => { all[ch] = { name: 'Tile ' + (Object.keys(all).length + 1), color: COLORS[Object.keys(all).length % COLORS.length], solid: true, symbol: ['11111111', '12222221', '12222221', '12222221', '12222221', '12222221', '12222221', '11111111'] }; }); ed.tile = ch; ed.tt = 'paint'; c.rerender(); setTimeout(() => openTileEditor(c.app, c.g, ch, c.data(), c.rerender)); })}>${well(40, svgRows(G.plus, '#e4e2dc'))}</button></div>`;
    }
  } else if (ed.tt === 'place') {
    const opts = [...objIds.map(id => ({ id, name: c.objects()[id].name, art: svgRows(c.glyph(c.objects()[id].symbol), c.objects()[id].color || '#e4e2dc') })),
      { id: 'start', name: 'Player start', art: svgRows(START, '#ff5a1f') }, { id: 'exit', name: 'Exit', art: svgRows(FLAG, GREEN) }];
    const pd = opts.find(o => o.id === ed.placeType) || opts[0];
    body = `<div class="ihead">${well(40, pd.art)}<span class="t"><span class="title acc ell">Place · ${esc(pd.name)}</span><span class="sub">${pd.id === 'start' || pd.id === 'exit' ? 'Tap to move it there' : 'Tap the scene to place one'}</span></span></div>
      <div class="tray ts-tray">${opts.map(o => { const on = o.id === pd.id; return `<button class="${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${esc(o.name)}" ${A(() => { ed.placeType = o.id; c.rerender(); })}>${well(40, (on ? '<span class="ring"></span>' : '') + o.art)}</button>`; }).join('')}</div>`;
  } else if (ed.tt === 'select' && ed.tsel) {
    const s = ed.tsel, th = s.kind === 'thing' ? (cur.things || [])[s.i] : cur[s.kind];
    if (!th) ed.tsel = null;
    else {
      const o = s.kind === 'thing' ? c.objects()[th.obj] : null, name = o ? o.name : s.kind === 'start' ? 'Player start' : 'Exit';
      const art = o ? svgRows(c.glyph(o.symbol), o.color || '#e4e2dc') : svgRows(s.kind === 'start' ? START : FLAG, s.kind === 'start' ? '#ff5a1f' : GREEN);
      const move = (k, d) => setL(L => { const t = s.kind === 'thing' ? L.things[s.i] : L[s.kind]; t[k] = Math.max(0, Math.min((k === 'x' ? L.w : L.h) * T, t[k] + d)); });
      body = `<div class="ihead">${well(40, art)}<span class="t"><span class="title acc ell">${esc(name)}</span><span class="sub">${o ? 'A copy · drag to move' : 'Drag to move'}</span></span>
          ${o ? iconBtn('edit', A(() => c.editObject(th.obj)), { label: 'Edit the ' + name + ' object' }) : ''}
          ${s.kind !== 'start' ? iconBtn('trash', A(() => { setL(L => { if (s.kind === 'exit') delete L.exit; else L.things.splice(s.i, 1); }); ed.tsel = null; c.rerender(); }), { label: 'Remove ' + name }) : ''}</div>
        <div class="grow"><span class="t"><span class="cap">Across</span><span class="sub">Pixels from the left</span></span>${stepper(String(Math.round(th.x)), A(() => move('x', -1)), A(() => move('x', 1)), 'across')}</div>
        <div class="grow"><span class="t"><span class="cap">Down</span><span class="sub">Pixels from the top to its feet</span></span>${stepper(String(Math.round(th.y)), A(() => move('y', -1)), A(() => move('y', 1)), 'down')}</div>`;
    }
  }
  if (!body) {
    const size = (dw, dh) => setL(L => resize(L, Math.max(10, Math.min(MAXW, L.w + dw)), Math.max(9, Math.min(MAXH, L.h + dh))));
    body = `<div class="ihead">${well(40, svgRows(G.scene, GREEN))}<span class="t"><span class="title acc ell">${esc(cur.name)}</span><span class="sub">${cur.w}×${cur.h} tiles · ${(cur.things || []).length} things · tap a thing to select it</span></span>
        ${iconBtn('rename', A(() => { const n = prompt('Scene name', cur.name); if (n && n.trim()) setL(L => { L.name = n.trim().slice(0, 24); }); }), { label: 'Rename scene' })}
        ${iconBtn('trash', A(() => { if (list.length < 2) { c.app.toast('A game needs one scene'); return; } if (!confirm('Delete ' + cur.name + '?')) return; c.changeScenes(l2 => { const i = l2.findIndex(x => x.id === cur.id); if (i >= 0) l2.splice(i, 1); }); ed.scene = null; c.rerender(); }), { label: 'Delete scene' })}</div>
      <div class="grow"><span class="t"><span class="cap">Width</span><span class="sub">Tiles across (adds or cuts on the right)</span></span>${stepper(String(cur.w), A(() => size(-2, 0)), A(() => size(2, 0)), 'width')}</div>
      <div class="grow"><span class="t"><span class="cap">Height</span><span class="sub">Tiles down (adds or cuts at the top)</span></span>${stepper(String(cur.h), A(() => size(0, -1)), A(() => size(0, 1)), 'height')}</div>`;
  }
  const scenesBar = `<div class="plate bar" data-pad="pager">
      <span class="cap" style="color:var(--muted);padding-left:10px">Scene</span>
      <div style="display:flex;align-items:center;gap:2px">
        ${iconBtn('left', A(() => go(-1)), { color: '#fff', label: 'Previous scene' })}<span class="cap acc" style="min-width:30px;text-align:center">${si + 1}/${list.length}</span>${iconBtn('right', A(() => go(1)), { color: '#fff', label: 'Next scene' })}
        ${iconBtn('dup', A(() => { const id = 'level-' + Date.now().toString(36); c.changeScenes(l2 => { const L = structuredClone(cur); L.id = id; L.name = (cur.name + ' copy').slice(0, 24); l2.splice(si + 1, 0, L); }); ed.scene = id; c.rerender(); }), { label: 'Duplicate scene' })}
        ${iconBtn('plus', A(() => { const id = 'level-' + Date.now().toString(36), n = list.length + 1; c.changeScenes(l2 => l2.push(blankScene(id, 'Level ' + n, D))); ed.scene = id; ed.tsel = null; c.rerender(); }), { label: 'New scene' })}
      </div></div>`;
  return { screen, panel: `${toolbar}<div class="plate inspector gap20 ts-insp">${body}</div>${scenesBar}` };
}
const count = (list, ch) => list.reduce((n, L) => n + (L.map || []).reduce((m, r) => m + r.split(ch).length - 1, 0), 0);
function freeChar(tiles) { for (const ch of '#BS=^"WT~:abcdefghijklmnopqrstuvwxyzACDEFGHIJKLMNOPQRUVXYZ0123456789+*%&@$!?') if (!tiles[ch]) return ch; return null; }
function resize(L, w, h) {
  const dh = h - L.h, old = L.map || [];
  // height changes at the top, so the ground stays put
  let rows = dh >= 0 ? [...Array(dh).fill('.'.repeat(L.w)), ...old] : old.slice(-dh);
  rows = rows.map(r => (r.length >= w ? r.slice(0, w) : r + '.'.repeat(w - r.length)));
  const sh = dh * T;
  L.things = (L.things || []).map(t => ({ ...t, y: t.y + sh })).filter(t => t.x < w * T && t.y > 0);
  for (const k of ['start', 'exit']) if (L[k]) { L[k] = { ...L[k], y: Math.max(T, L[k].y + sh), x: Math.min(L[k].x, w * T - 4) }; }
  L.w = w; L.h = h; L.map = rows;
}
export function blankScene(id, name, D) {
  const w = 30, h = 18, top = D.template === 'topdown', solid = Object.keys(D.tiles || {}).find(ch => D.tiles[ch].solid) || '#';
  const map = Array.from({ length: h }, (_, y) => (top ? (y === 0 || y === h - 1 ? solid.repeat(w) : solid + '.'.repeat(w - 2) + solid) : (y >= h - 2 ? solid.repeat(w) : '.'.repeat(w))));
  return { id, name, kind: 'tiles', w, h, map, start: { x: 3 * T, y: (top ? 9 : h - 2) * T }, exit: { x: (w - 3) * T, y: (top ? 9 : h - 2) * T }, things: [] };
}
// a tile as a small SVG (1 its colour, 2 the shade, 0 clear)
export function svgTile(t, size) {
  const rows = Array.isArray(t.symbol) ? t.symbol : [], shade = t.shade || darken(t.color || '#888888', 0.6);
  let a = '', b = '';
  rows.forEach((r, y) => [...r].forEach((v, x) => { if (v === '1') a += `M${x} ${y}h1v1h-1z`; else if (v === '2') b += `M${x} ${y}h1v1h-1z`; }));
  return `<svg viewBox="0 0 8 8" width="${size}" height="${size}" shape-rendering="crispEdges" style="image-rendering:pixelated"><path d="${b}" fill="${shade}"/><path d="${a}" fill="${t.color || '#888'}"/></svg>`;
}

// ---------------------------------------------------------------- the canvas
export function mountTileScene(root, c) {
  const { ed } = c, cv = root.querySelector('#tsc'); if (!cv) return;
  const box = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const CW = Math.max(1, box.width - 3), CH = Math.max(1, box.height - 3);
  cv.style.width = CW + 'px'; cv.style.height = CH + 'px'; cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr);
  const x = cv.getContext('2d');
  ed.views = ed.views || {};
  let L = c.scene(), work = null;   // work: the scene being changed by a stroke or drag (saved when the finger lifts)
  const D = c.data(), tiles = D.tiles || {}, objs = c.objects();
  const V = () => {
    if (!ed.views[L.id]) { const z = Math.max(0.5, Math.min(CW / (L.w * T), CH / (L.h * T)) * 0.98); ed.views[L.id] = { z, ox: (CW - L.w * T * z) / 2, oy: (CH - L.h * T * z) / 2 }; }
    return ed.views[L.id];
  };
  const tileCv = {};
  function tileArt(ch) {
    if (tileCv[ch]) return tileCv[ch];
    const t = tiles[ch], k = document.createElement('canvas'); k.width = k.height = T;
    const g = k.getContext('2d'), shade = t.shade || darken(t.color || '#888888', 0.6);
    // plan view: one colour; game view: the tile's art
    if (!ed.gameLook) { g.fillStyle = planColor(t); planRows(t).forEach((r, yy) => [...r].forEach((v, xx) => { if (v === '1') g.fillRect(xx, yy, 1, 1); })); return (tileCv[ch] = k); }
    (t.symbol || []).forEach((r, yy) => [...r].forEach((v, xx) => { if (v === '1' || v === '2') { g.fillStyle = v === '1' ? t.color : shade; g.fillRect(xx, yy, 1, 1); } }));
    return (tileCv[ch] = k);
  }
  const symCv = {};
  function symArt(rows, color) {
    const key = rows.join() + color; if (symCv[key]) return symCv[key];
    const k = document.createElement('canvas'), w = rows[0].length, h = rows.length; k.width = w + 2; k.height = h + 2;
    const g = k.getContext('2d'), on = (r, q) => r >= 0 && r < h && q >= 0 && q < w && rows[r][q] === '1';
    g.fillStyle = '#0b0b10';
    for (let r = -1; r <= h; r++) for (let q = -1; q <= w; q++) if (!on(r, q) && (on(r - 1, q) || on(r + 1, q) || on(r, q - 1) || on(r, q + 1))) g.fillRect(q + 1, r + 1, 1, 1);
    g.fillStyle = color; for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) if (on(r, q)) g.fillRect(q + 1, r + 1, 1, 1);
    return (symCv[key] = k);
  }
  const thingBox = (t) => { const o = objs[t.obj], rows = c.glyph(o ? o.symbol : 'blob'), s = (o && o.scale) || 1; return { rows, s, color: (o && o.color) || '#e4e2dc', w: rows[0].length * s, h: rows.length * s }; };
  function draw() {
    const S = work || L, v = V();
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
    x.fillStyle = '#000'; x.fillRect(0, 0, CW, CH);
    x.save(); x.translate(v.ox, v.oy); x.scale(v.z, v.z);
    x.fillStyle = ed.gameLook ? (D.colors || {}).sky || '#1d1b24' : '#000'; x.fillRect(0, 0, S.w * T, S.h * T);
    S.map.forEach((r, ty) => { for (let tx = 0; tx < S.w; tx++) { const ch = r[tx]; if (ch && ch !== '.' && tiles[ch]) x.drawImage(tileArt(ch), tx * T, ty * T); } });
    (S.things || []).forEach((t, i) => { const b = thingBox(t); x.drawImage(symArt(b.rows, b.color), Math.round(t.x - b.w / 2) - b.s, Math.round(t.y - b.h) - b.s, (b.rows[0].length + 2) * b.s, (b.rows.length + 2) * b.s); });
    if (S.exit) x.drawImage(symArt(FLAG, GREEN), Math.round(S.exit.x - 2) - 1, Math.round(S.exit.y - 8) - 1);
    if (S.start) x.drawImage(symArt(START, '#ff5a1f'), Math.round(S.start.x - 4) - 1, Math.round(S.start.y - 8) - 1);
    x.restore();
    // grid when zoomed in, and the edge of the scene
    if (v.z >= 3) {
      x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1; x.beginPath();
      for (let tx = 0; tx <= S.w; tx++) { const px = Math.round(v.ox + tx * T * v.z) + 0.5; x.moveTo(px, v.oy); x.lineTo(px, v.oy + S.h * T * v.z); }
      for (let ty = 0; ty <= S.h; ty++) { const py = Math.round(v.oy + ty * T * v.z) + 0.5; x.moveTo(v.ox, py); x.lineTo(v.ox + S.w * T * v.z, py); }
      x.stroke();
    }
    x.strokeStyle = 'rgba(125,255,106,.5)'; x.lineWidth = 1; x.strokeRect(Math.round(v.ox) + 0.5, Math.round(v.oy) + 0.5, Math.round(S.w * T * v.z), Math.round(S.h * T * v.z));
    // the selected thing, and the box being dragged
    const sel = ed.tsel && hitBox(S, ed.tsel);
    if (sel) { x.strokeStyle = GREEN; x.lineWidth = 2; x.strokeRect(v.ox + sel.x0 * v.z - 2, v.oy + sel.y0 * v.z - 2, (sel.x1 - sel.x0) * v.z + 4, (sel.y1 - sel.y0) * v.z + 4); }
    if (act && act.kind === 'box' && act.b) { const b = act.b; x.strokeStyle = '#fff'; x.setLineDash([3, 3]); x.strokeRect(v.ox + b[0] * T * v.z, v.oy + b[1] * T * v.z, (b[2] - b[0] + 1) * T * v.z, (b[3] - b[1] + 1) * T * v.z); x.setLineDash([]); }
  }
  function hitBox(S, s) {
    const t = s.kind === 'thing' ? (S.things || [])[s.i] : S[s.kind]; if (!t) return null;
    if (s.kind === 'thing') { const b = thingBox(t); return { x0: t.x - b.w / 2, x1: t.x + b.w / 2, y0: t.y - b.h, y1: t.y }; }
    return s.kind === 'exit' ? { x0: t.x - 2, x1: t.x + 2, y0: t.y - 8, y1: t.y } : { x0: t.x - 4, x1: t.x + 4, y0: t.y - 8, y1: t.y };
  }
  function hit(S, wx, wy) {
    const pad = 3 / V().z;
    const inside = (b) => b && wx >= b.x0 - pad && wx <= b.x1 + pad && wy >= b.y0 - pad && wy <= b.y1 + pad;
    for (const k of ['start', 'exit']) if (inside(hitBox(S, { kind: k }))) return { kind: k };
    for (let i = (S.things || []).length - 1; i >= 0; i--) if (inside(hitBox(S, { kind: 'thing', i }))) return { kind: 'thing', i };
    return null;
  }
  const world = (p) => { const v = V(); return { wx: (p.x - v.ox) / v.z, wy: (p.y - v.oy) / v.z }; };
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const setTile = (S, tx, ty, ch) => { if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) return; const r = S.map[ty]; if (r[tx] === ch) return; S.map[ty] = r.slice(0, tx) + ch + r.slice(tx + 1); };
  function paintLine(S, a, b, ch) {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let i = 0; i <= n; i++) setTile(S, Math.round(a[0] + (b[0] - a[0]) * (n ? i / n : 0)), Math.round(a[1] + (b[1] - a[1]) * (n ? i / n : 0)), ch);
  }
  const snap = (v, s) => Math.round(v / s) * s;
  // ---- touch
  const ptrs = new Map(); let act = null, gest = null;
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* not a real pointer */ }
    ptrs.set(e.pointerId, at(e));
    if (ptrs.size === 2) {   // two fingers: drop what one finger started, pan and zoom instead
      work = null; act = null;
      const [p, q] = [...ptrs.values()], v = V();
      gest = { d: Math.hypot(p.x - q.x, p.y - q.y), m: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, v: { ...v } };
      draw(); return;
    }
    if (ptrs.size > 2) return;
    const p = at(e), { wx, wy } = world(p), tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    L = c.scene();
    if (ed.tt === 'hand') { act = { kind: 'pan', p, v: { ...V() } }; return; }
    if (ed.tt === 'paint' || ed.tt === 'erase') { work = structuredClone(L); const ch = ed.tt === 'erase' ? '.' : ed.tile; setTile(work, tx, ty, ch); act = { kind: 'paint', last: [tx, ty], ch }; draw(); return; }
    if (ed.tt === 'box') { act = { kind: 'box', a: [tx, ty], b: [tx, ty, tx, ty] }; act.b = [Math.min(tx, tx), Math.min(ty, ty), tx, ty]; draw(); return; }
    if (ed.tt === 'place') { act = { kind: 'tap', wx, wy }; return; }
    if (ed.tt === 'select') {
      const h = hit(L, wx, wy);
      ed.tsel = h; act = h ? { kind: 'drag', h, wx, wy, moved: false } : { kind: 'tap' };
      draw(); return;
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, at(e));
    if (gest && ptrs.size >= 2) {
      const [p, q] = [...ptrs.values()], d = Math.hypot(p.x - q.x, p.y - q.y), m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, g0 = gest.v;
      const z = Math.max(0.5, Math.min(24, g0.z * d / (gest.d || 1))), v = V();
      v.z = z; v.ox = m.x - (gest.m.x - g0.ox) * z / g0.z; v.oy = m.y - (gest.m.y - g0.oy) * z / g0.z; draw(); return;
    }
    if (!act) return;
    const p = at(e), { wx, wy } = world(p), tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (act.kind === 'pan') { const v = V(); v.ox = act.v.ox + p.x - act.p.x; v.oy = act.v.oy + p.y - act.p.y; draw(); return; }
    if (act.kind === 'paint') { if (tx !== act.last[0] || ty !== act.last[1]) { paintLine(work, act.last, [tx, ty], act.ch); act.last = [tx, ty]; draw(); } return; }
    if (act.kind === 'box') { act.b = [Math.min(act.a[0], tx), Math.min(act.a[1], ty), Math.max(act.a[0], tx), Math.max(act.a[1], ty)]; draw(); return; }
    if (act.kind === 'drag') {
      if (!act.moved && Math.hypot(wx - act.wx, wy - act.wy) * V().z < 6) return;
      act.moved = true; work = work || structuredClone(L);
      const t = act.h.kind === 'thing' ? work.things[act.h.i] : work[act.h.kind], t0 = act.h.kind === 'thing' ? L.things[act.h.i] : L[act.h.kind];
      t.x = Math.max(0, Math.min(work.w * T, snap(t0.x + wx - act.wx, 2))); t.y = Math.max(1, Math.min(work.h * T, snap(t0.y + wy - act.wy, 2)));
      draw();
    }
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (gest) { if (!ptrs.size) gest = null; return; }
    if (!act) return;
    const a = act; act = null;
    if (a.kind === 'paint' || a.kind === 'drag') { if (work && (a.kind === 'paint' || a.moved)) { const w = work; work = null; c.changeScenes(l2 => { const i = l2.findIndex(s => s.id === w.id); if (i >= 0) l2[i] = w; }); c.rerender(); } else { work = null; c.rerender(); } return; }
    if (a.kind === 'box') { const [x0, y0, x1, y1] = a.b; c.changeScenes(l2 => { const S = l2.find(s => s.id === L.id); for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) setTile(S, tx, ty, ed.tile); }); c.rerender(); return; }
    if (a.kind === 'tap' && ed.tt === 'place') {
      const t = ed.placeType, px = Math.max(0, Math.min(L.w * T, snap(a.wx, 4))), feet = Math.max(T, Math.min(L.h * T, Math.ceil(a.wy / T) * T));
      if (a.wx < 0 || a.wy < 0 || a.wx > L.w * T || a.wy > L.h * T) return;
      c.changeScenes(l2 => { const S = l2.find(s => s.id === L.id); if (t === 'start' || t === 'exit') S[t] = { x: px, y: feet }; else (S.things = S.things || []).push({ obj: t, x: px, y: feet }); });
      c.rerender(); return;
    }
    if (a.kind === 'tap' || a.kind === 'drag') c.rerender();
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  draw();
}
