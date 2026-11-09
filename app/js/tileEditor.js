// Tile editor: draw one 8×8 tile of a tile-engine game (New game), opened from Art › Tiles or from the level editor.
// It covers the screen it was opened from (like the icon editor) and saves into the game's edits when you press Save.
// A tile's pixels are 1 (its colour), 2 (its shade) and 0 (clear); its kind says how the game treats it.
import { well, svgRows, svgText, G } from './pixel.js';
import { iconBtn, esc, stepper } from './ui.js';
import * as games from './games.js';
import * as input from './input.js';
import * as snd from './sound.js';

export const TILE_KINDS = [['solid', 'Solid', 'Walls and floors'], ['oneWay', 'Platform', 'Stand on it from above'], ['hurt', 'Hurts', 'Hurts the player'], ['decor', 'Decor', 'Just for looks']];
export const TILE_COLORS = ['#7a9a4a', '#5a4632', '#b0563c', '#8b8794', '#d6a35a', '#d6d2dc', '#8fd25a', '#3a9a5c', '#2f6f8f', '#4d7cff', '#ff4fd8', '#ff5a1f', '#ffd23f', '#f4f1ea', '#4a4654', '#0b0b10'];
export const kindOf = (t) => (t.solid ? 'solid' : t.oneWay ? 'oneWay' : t.hurt ? 'hurt' : 'decor');
export function darken(hex, k) { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, n >> 8 & 255, n & 255].map(c => Math.round(c * k).toString(16).padStart(2, '0')).join(''); }
const shadeOf = (t) => t.shade || darken(t.color || '#888888', 0.6);
export function svgTile(t, size) {
  let a = '', b = '';
  (t.symbol || []).forEach((r, y) => [...r].forEach((v, x) => { if (v === '1') a += `M${x} ${y}h1v1h-1z`; else if (v === '2') b += `M${x} ${y}h1v1h-1z`; }));
  return `<svg viewBox="0 0 8 8" width="${size}" height="${size}" shape-rendering="crispEdges"><path d="${b}" fill="${shadeOf(t)}"/><path d="${a}" fill="${t.color || '#888'}"/></svg>`;
}
export const tileUses = (scenes, ch) => (scenes || []).reduce((n, L) => n + (L.map || []).reduce((m, r) => m + r.split(ch).length - 1, 0), 0);
export function freeTileChar(tiles) { for (const ch of '#BS=^"WT~:abcdefghijklmnopqrstuvwxyzACDEFGHIJKLMNOPQRUVXYZ0123456789+*%&@$!?') if (!tiles[ch]) return ch; return null; }
function setKind(t, k) { delete t.solid; delete t.oneWay; delete t.hurt; if (k !== 'decor') t[k] = true; }

// D: the game's data with edits; onDone(): called after closing (the screen behind redraws)
export function openTileEditor(app, g, ch, D, onDone) {
  if (app.modal || !D.tiles || !D.tiles[ch]) return;
  const acc = getComputedStyle(document.querySelector('.screen-tool') || document.body).getPropertyValue('--acc').trim() || '#ff4fd8';
  let t = structuredClone(D.tiles[ch]), ink = '1', past = [], future = [], sheet = null;
  const start = JSON.stringify(t);
  t.symbol = (t.symbol || []).slice(0, 8).map(r => (r + '00000000').slice(0, 8)); while (t.symbol.length < 8) t.symbol.push('00000000');
  const push = () => { past.push(JSON.stringify(t)); if (past.length > 80) past.shift(); future = []; };
  const el = document.createElement('div');
  el.className = 'icon-ed screen-tool te'; el.style.setProperty('--acc', acc);
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Edit tile');
  document.body.appendChild(el);
  const fit = () => { const r = document.getElementById('app').getBoundingClientRect(); Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); };
  const K = () => TILE_KINDS.findIndex(x => x[0] === kindOf(t));
  const sw = (col, on, k, label) => `<button class="ts-col${on ? ' on' : ''}" data-k="${k}" data-c="${col}" aria-label="${label} ${col}" aria-pressed="${on}" style="background:${col}"></button>`;
  const inkBtn = (v, label, color) => `<button class="te-ink${ink === v ? ' on' : ''}" data-k="ink" data-v="${v}" aria-label="${label}" aria-pressed="${ink === v}"><span class="te-dot${v === '0' ? ' clear' : ''}" style="background-color:${color}"></span><span class="cap">${label}</span></button>`;
  function html() {
    const ki = K();
    const top = `<div class="plate bar">
        ${iconBtn('back', 'data-k="cancel"', { color: '#fff', label: 'Cancel' })}
        <button class="ie-name namebtn" data-k="rename" style="text-align:left" aria-label="Rename the tile"><span class="title ell">${esc(t.name)}</span><span class="sub ell">Tile · ${TILE_KINDS[ki][1].toLowerCase()} · ${esc(g.name)}</span></button>
        ${iconBtn('check', 'data-k="save"', { color: '#fff', label: 'Save tile' })}
      </div>`;
    const draw = `<div class="plate ie-main te-main"><canvas id="te-cv" aria-label="Tile pixels"></canvas><canvas id="te-rep" aria-label="The tile repeated, as it looks in a level"></canvas></div>`;
    const inks = `<div class="plate bar te-inks">${inkBtn('1', 'Colour', t.color)}${inkBtn('2', 'Shade', shadeOf(t))}${inkBtn('0', 'Clear', 'transparent')}
        ${iconBtn('undo', 'data-k="undo"', { label: 'Undo', disabled: !past.length })}${iconBtn('redo', 'data-k="redo"', { label: 'Redo', disabled: !future.length })}${iconBtn(null, 'data-k="more"', { label: 'More', on: sheet === 'more', rows: G.dots })}</div>`;
    let low;
    if (sheet === 'more') {
      low = `<div class="plate te-low">
        <div class="se-btns">
          <button class="btn bare" data-k="sl">${well(28, svgRows(G.left, '#e4e2dc'))}<span>Slide left</span></button>
          <button class="btn bare" data-k="sr">${well(28, svgRows(G.right, '#e4e2dc'))}<span>Slide right</span></button>
          <button class="btn bare" data-k="su">${well(28, svgRows(G.up, '#e4e2dc'))}<span>Slide up</span></button>
          <button class="btn bare" data-k="sd">${well(28, svgRows(G.down, '#e4e2dc'))}<span>Slide down</span></button>
          <button class="btn bare" data-k="flip">${well(28, svgRows(G.flipH, '#e4e2dc'))}<span>Flip</span></button>
          <button class="btn bare" data-k="fill">${well(28, svgRows(G.fill, '#e4e2dc'))}<span>Fill with ink</span></button>
          <button class="btn bare" data-k="dup">${well(28, svgRows(G.dup, '#e4e2dc'))}<span>Duplicate</span></button>
          <button class="btn bare" data-k="del">${well(28, svgRows(G.trash, '#e4e2dc'))}<span>Delete tile</span></button>
        </div></div>`;
    } else {
      low = `<div class="plate te-low">
        <div class="grow"><span class="t"><span class="cap">Kind</span><span class="sub">${TILE_KINDS[ki][2]}</span></span>${stepper(TILE_KINDS[ki][1].toUpperCase(), 'data-k="kind-"', 'data-k="kind+"', 'kind')}</div>
        <span class="cap te-lab">Colour</span><div class="ts-cols">${TILE_COLORS.map(c => sw(c, c === t.color, 'col', 'Colour')).join('')}</div>
        <span class="cap te-lab">Shade</span><div class="ts-cols">${sw(darken(t.color, 0.6), !t.shade, 'auto', 'Shade (automatic)').replace('></button>', '><span class="te-a">A</span></button>')}${TILE_COLORS.slice(0, 15).map(c => sw(c, t.shade === c, 'shade', 'Shade')).join('')}</div>
      </div>`;
    }
    return top + draw + inks + low;
  }
  let cv, rep, cell = 20;
  function paint() {
    const main = el.querySelector('.te-main'), r0 = main.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 3);
    const r = { width: r0.width, height: Math.min(r0.height, el.getBoundingClientRect().bottom - r0.top - 12) };   // landscape: the grid row can run past the screen
    const repW = Math.min(r.width * 0.32, r.height - 24);
    cell = Math.max(10, Math.floor(Math.min((r.width - repW - 40) / 8, (r.height - 24) / 8)));
    const sz = cell * 8;
    cv.style.width = cv.style.height = sz + 'px'; cv.width = cv.height = Math.round(sz * dpr);
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
      const v = t.symbol[yy][xx];
      x.fillStyle = v === '1' ? t.color : v === '2' ? shadeOf(t) : ((xx + yy) % 2 ? '#1b1b20' : '#26262c');
      x.fillRect(xx * cell, yy * cell, cell, cell);
    }
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.beginPath();
    for (let i = 1; i < 8; i++) { x.moveTo(i * cell + 0.5, 0); x.lineTo(i * cell + 0.5, sz); x.moveTo(0, i * cell + 0.5); x.lineTo(sz, i * cell + 0.5); }
    x.stroke();
    // 3×3 copies, the way it tiles in a level
    const rs = Math.max(24, Math.floor(repW / 24) * 24), k = rs / 24;
    rep.style.width = rep.style.height = rs + 'px'; rep.width = rep.height = Math.round(rs * dpr);
    const y = rep.getContext('2d'); y.setTransform(dpr, 0, 0, dpr, 0, 0);
    y.fillStyle = (D.colors || {}).sky || '#1d1b24'; y.fillRect(0, 0, rs, rs);
    for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
      const v = t.symbol[yy][xx]; if (v === '0') continue;
      y.fillStyle = v === '1' ? t.color : shadeOf(t); y.fillRect((tx * 8 + xx) * k, (ty * 8 + yy) * k, k, k);
    }
  }
  function rer() {
    el.innerHTML = html();
    cv = el.querySelector('#te-cv'); rep = el.querySelector('#te-rep');
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    paint();
  }
  // drawing with the chosen ink
  let stroke = null;
  const cellAt = (e) => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / cell), Math.floor((e.clientY - r.top) / cell)]; };
  const setPx = (x0, y0) => { if (x0 < 0 || y0 < 0 || x0 > 7 || y0 > 7) return; const r = t.symbol[y0]; if (r[x0] === ink) return; t.symbol = [...t.symbol]; t.symbol[y0] = r.slice(0, x0) + ink + r.slice(x0 + 1); stroke.changed = true; };
  function down(e) { cv.setPointerCapture(e.pointerId); push(); stroke = { changed: false, last: cellAt(e) }; setPx(...stroke.last); paint(); }
  function move(e) {
    if (!stroke) return; const [x1, y1] = cellAt(e), [x0, y0] = stroke.last; if (x1 === x0 && y1 === y0) return;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 1; i <= n; i++) setPx(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n));
    stroke.last = [x1, y1]; paint();
  }
  function up() { if (!stroke) return; if (!stroke.changed) past.pop(); stroke = null; rer(); }
  // saving: the game's tiles (and, when a tile is deleted or copied, its scenes) go into the game's edits
  const close = () => { removeEventListener('resize', onResize); el.remove(); app.modal = null; if (onDone) onDone(); };
  const changed = () => JSON.stringify(t) !== start;
  function save() {
    if (changed()) { const all = structuredClone(D.tiles); all[ch] = t; games.setValue(g.file, 'tiles', all); app.toast('Tile saved'); }
    close();
  }
  const edit = (fn) => { push(); fn(); rer(); };
  const slide = (dx, dy) => edit(() => { const s = t.symbol; t.symbol = s.map((_, y) => [...s[(y - dy + 8) % 8]].map((__, x) => s[(y - dy + 8) % 8][(x - dx + 8) % 8]).join('')); });
  const ACT = {
    cancel() { if (changed() && !confirm('Discard the changes to this tile?')) return; close(); },
    save,
    rename() { const n = prompt('Tile name', t.name); if (n && n.trim()) edit(() => { t.name = n.trim().slice(0, 20); }); },
    ink(b) { ink = b.dataset.v; rer(); },
    undo() { if (!past.length) return; future.push(JSON.stringify(t)); t = JSON.parse(past.pop()); rer(); },
    redo() { if (!future.length) return; past.push(JSON.stringify(t)); t = JSON.parse(future.pop()); rer(); },
    more() { sheet = sheet === 'more' ? null : 'more'; rer(); },
    'kind-': () => edit(() => setKind(t, TILE_KINDS[(K() + TILE_KINDS.length - 1) % TILE_KINDS.length][0])),
    'kind+': () => edit(() => setKind(t, TILE_KINDS[(K() + 1) % TILE_KINDS.length][0])),
    col: (b) => edit(() => { t.color = b.dataset.c; }),
    shade: (b) => edit(() => { t.shade = b.dataset.c; }),
    auto: () => edit(() => { delete t.shade; }),
    sl: () => slide(-1, 0), sr: () => slide(1, 0), su: () => slide(0, -1), sd: () => slide(0, 1),
    flip: () => edit(() => { t.symbol = t.symbol.map(r => [...r].reverse().join('')); }),
    fill: () => edit(() => { t.symbol = t.symbol.map(() => ink.repeat(8)); }),
    dup() {
      const nc = freeTileChar(D.tiles); if (!nc) { app.toast('No room for more tiles'); return; }
      const all = structuredClone(D.tiles); all[ch] = t; all[nc] = { ...structuredClone(t), name: (t.name + ' 2').slice(0, 20) };
      games.setValue(g.file, 'tiles', all); app.toast('Made ' + all[nc].name); close();
    },
    del() {
      if (Object.keys(D.tiles).length < 2) { app.toast('A game needs one tile'); return; }
      const n = tileUses(D.scenes, ch);
      if (!confirm(n ? `Delete ${t.name}? Its ${n} tiles in the levels are erased too.` : `Delete ${t.name}?`)) return;
      const all = structuredClone(D.tiles); delete all[ch];
      games.setValue(g.file, 'tiles', all);
      if (n) games.setValue(g.file, 'scenes', D.scenes.map(L => (L.map ? { ...L, map: L.map.map(r => r.split(ch).join('.')) } : L)));
      close();
    }
  };
  let held = null;
  el.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; held = b; b.classList.add('pressed'); snd.click(); });
  const letGo = () => { if (held) held.classList.remove('pressed'); held = null; };
  el.addEventListener('pointerup', letGo); el.addEventListener('pointercancel', letGo);
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; letGo(); (ACT[b.dataset.k] || (() => {}))(b); });
  const onResize = () => { fit(); paint(); };
  addEventListener('resize', onResize);
  // controller: D-pad moves a square, A paints with the ink, X saves, B cancels
  const cur = { x: 0, y: 0 };
  app.modal = {
    frame() {
      const dx = (input.pressed('right') ? 1 : 0) - (input.pressed('left') ? 1 : 0), dy = (input.pressed('down') ? 1 : 0) - (input.pressed('up') ? 1 : 0);
      if (dx || dy) { cur.x = (cur.x + dx + 8) % 8; cur.y = (cur.y + dy + 8) % 8; paint(); const x = cv.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(cur.x * cell + 2, cur.y * cell + 2, cell - 4, cell - 4); }
      if (input.pressed('a')) { push(); stroke = { changed: false }; setPx(cur.x, cur.y); stroke = null; rer(); }
      if (input.pressed('x') || input.pressed('start')) save(); else if (input.pressed('b')) ACT.cancel();
    }
  };
  fit(); rer();
}
