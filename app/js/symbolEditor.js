// Symbol editor: draw the player of a tile-engine game (New game) as a little one-colour pixel picture, opened from Art › Player.
// Like the tile editor it covers the screen and saves into the game's edits when you press Save. A pixel is on ("1") or clear ("0");
// the game outlines it in black, so it only needs its shape. The colour is the player's colour setting.
import { well, svgRows, G } from './pixel.js';
import { iconBtn, esc, stepper } from './ui.js';
import * as games from './games.js';
import * as input from './input.js';
import * as snd from './sound.js';
import { TILE_COLORS } from './tileEditor.js';

const MIN = 6, MAX = 16;
export const blankRows = (w, h) => Array.from({ length: h }, () => '0'.repeat(w));
// the game's own picture of the player: its symbol name or its own rows
export const playerRows = (D, symbols) => { const s = (D.player || {}).symbol; const r = Array.isArray(s) ? s : (symbols || {})[s]; return (r || blankRows(8, 8)).map(x => x.replace(/[^1]/g, '0')); };

export function openSymbolEditor(app, g, D, symbols, onDone) {
  if (app.modal) return;
  const acc = getComputedStyle(document.querySelector('.screen-tool') || document.body).getPropertyValue('--acc').trim() || '#ff4fd8';
  const sky = (D.colors || {}).sky || '#1d1b24';
  let rows = playerRows(D, symbols), color = (D.player || {}).color || '#ff5a1f', ink = '1', past = [], future = [], sheet = null;
  const start = JSON.stringify([rows, color]);
  const state = () => JSON.stringify([rows, color]);
  const push = () => { past.push(state()); if (past.length > 80) past.shift(); future = []; };
  const load = (s) => { [rows, color] = JSON.parse(s); };
  const W = () => rows[0].length, H = () => rows.length;
  const el = document.createElement('div');
  el.className = 'icon-ed screen-tool te'; el.style.setProperty('--acc', acc);
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Edit player');
  document.body.appendChild(el);
  const fit = () => { const r = document.getElementById('app').getBoundingClientRect(); Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); };
  const sw = (col, on) => `<button class="ts-col${on ? ' on' : ''}" data-k="col" data-c="${col}" aria-label="Colour ${col}" aria-pressed="${on}" style="background:${col}"></button>`;
  const inkBtn = (v, label, c) => `<button class="te-ink${ink === v ? ' on' : ''}" data-k="ink" data-v="${v}" aria-label="${label}" aria-pressed="${ink === v}"><span class="te-dot${v === '0' ? ' clear' : ''}" style="background-color:${c}"></span><span class="cap">${label}</span></button>`;
  function html() {
    const top = `<div class="plate bar">
        ${iconBtn('back', 'data-k="cancel"', { color: '#fff', label: 'Cancel' })}
        <div class="ie-name"><span class="title ell">Player</span><span class="sub ell">${W()}×${H()} · ${esc(g.name)}</span></div>
        ${iconBtn('check', 'data-k="save"', { color: '#fff', label: 'Save player' })}
      </div>`;
    const draw = `<div class="plate ie-main te-main"><canvas id="te-cv" aria-label="Player pixels"></canvas><canvas id="te-rep" aria-label="The player in the game, facing right and left"></canvas></div>`;
    const inks = `<div class="plate bar te-inks">${inkBtn('1', 'Pixel', color)}${inkBtn('0', 'Clear', 'transparent')}
        ${iconBtn('undo', 'data-k="undo"', { label: 'Undo', disabled: !past.length })}${iconBtn('redo', 'data-k="redo"', { label: 'Redo', disabled: !future.length })}${iconBtn(null, 'data-k="more"', { label: 'More', on: sheet === 'more', rows: G.dots })}</div>`;
    const low = sheet === 'more'
      ? `<div class="plate te-low"><div class="se-btns">
          <button class="btn bare" data-k="sl">${well(28, svgRows(G.left, '#e4e2dc'))}<span>Slide left</span></button>
          <button class="btn bare" data-k="sr">${well(28, svgRows(G.right, '#e4e2dc'))}<span>Slide right</span></button>
          <button class="btn bare" data-k="su">${well(28, svgRows(G.up, '#e4e2dc'))}<span>Slide up</span></button>
          <button class="btn bare" data-k="sd">${well(28, svgRows(G.down, '#e4e2dc'))}<span>Slide down</span></button>
          <button class="btn bare" data-k="flip">${well(28, svgRows(G.flipH, '#e4e2dc'))}<span>Flip</span></button>
          <button class="btn bare" data-k="clear">${well(28, svgRows(G.trash, '#e4e2dc'))}<span>Clear all</span></button>
        </div></div>`
      : `<div class="plate te-low">
          <div class="grow"><span class="t"><span class="cap">Width</span><span class="sub">Pixels across</span></span>${stepper(String(W()), 'data-k="w-"', 'data-k="w+"', 'w')}</div>
          <div class="grow"><span class="t"><span class="cap">Height</span><span class="sub">Pixels tall</span></span>${stepper(String(H()), 'data-k="h-"', 'data-k="h+"', 'h')}</div>
          <span class="cap te-lab">Colour</span><div class="ts-cols">${TILE_COLORS.map(c => sw(c, c === color)).join('')}</div>
        </div>`;
    return top + draw + inks + low;
  }
  let cv, rep, cell = 20;
  const on = (r, c, flip) => r >= 0 && r < H() && c >= 0 && c < W() && rows[r][flip ? W() - 1 - c : c] === '1';
  function paint() {
    const main = el.querySelector('.te-main'), r0 = main.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 3);
    const r = { width: r0.width, height: Math.min(r0.height, el.getBoundingClientRect().bottom - r0.top - 12) };
    const repW = Math.min(r.width * 0.32, r.height - 24), w = W(), h = H();
    cell = Math.max(8, Math.floor(Math.min((r.width - repW - 40) / w, (r.height - 24) / h)));
    cv.style.width = cell * w + 'px'; cv.style.height = cell * h + 'px'; cv.width = Math.round(cell * w * dpr); cv.height = Math.round(cell * h * dpr);
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { x.fillStyle = rows[yy][xx] === '1' ? color : (xx + yy) % 2 ? '#1b1b20' : '#26262c'; x.fillRect(xx * cell, yy * cell, cell, cell); }
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.beginPath();
    for (let i = 1; i < w; i++) { x.moveTo(i * cell + 0.5, 0); x.lineTo(i * cell + 0.5, h * cell); }
    for (let i = 1; i < h; i++) { x.moveTo(0, i * cell + 0.5); x.lineTo(w * cell, i * cell + 0.5); }
    x.stroke();
    // in the game: outlined in black on the sky, facing both ways
    const k = Math.max(1, Math.min(4, Math.floor(Math.min(repW / ((w + 2) * 2 + 1), (r.height - 24) / (h + 2)))));
    const rw = ((w + 2) * 2 + 1) * k, rh = (h + 2) * k;
    rep.style.width = rw + 'px'; rep.style.height = rh + 'px'; rep.width = Math.round(rw * dpr); rep.height = Math.round(rh * dpr);
    const y = rep.getContext('2d'); y.setTransform(dpr, 0, 0, dpr, 0, 0); y.fillStyle = sky; y.fillRect(0, 0, rw, rh);
    for (const flip of [false, true]) {
      const ox = (flip ? w + 3 : 1) * k;
      for (let yy = -1; yy <= h; yy++) for (let xx = -1; xx <= w; xx++) {
        if (on(yy, xx, flip)) { y.fillStyle = color; y.fillRect(ox + xx * k, (yy + 1) * k, k, k); }
        else if (on(yy - 1, xx, flip) || on(yy + 1, xx, flip) || on(yy, xx - 1, flip) || on(yy, xx + 1, flip)) { y.fillStyle = '#0b0b10'; y.fillRect(ox + xx * k, (yy + 1) * k, k, k); }
      }
    }
  }
  function rer() {
    el.innerHTML = html();
    cv = el.querySelector('#te-cv'); rep = el.querySelector('#te-rep');
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    paint();
  }
  let stroke = null;
  const cellAt = (e) => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / cell), Math.floor((e.clientY - r.top) / cell)]; };
  const setPx = (x0, y0) => { if (x0 < 0 || y0 < 0 || x0 >= W() || y0 >= H()) return; const r = rows[y0]; if (r[x0] === ink) return; rows = [...rows]; rows[y0] = r.slice(0, x0) + ink + r.slice(x0 + 1); stroke.changed = true; };
  function down(e) { cv.setPointerCapture(e.pointerId); push(); stroke = { changed: false, last: cellAt(e) }; setPx(...stroke.last); paint(); }
  function move(e) {
    if (!stroke) return; const [x1, y1] = cellAt(e), [x0, y0] = stroke.last; if (x1 === x0 && y1 === y0) return;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 1; i <= n; i++) setPx(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n));
    stroke.last = [x1, y1]; paint();
  }
  function up() { if (!stroke) return; if (!stroke.changed) past.pop(); stroke = null; rer(); }
  const close = () => { removeEventListener('resize', onResize); el.remove(); app.modal = null; if (onDone) onDone(); };
  const changed = () => state() !== start;
  function save() {
    if (changed()) {
      games.setValue(g.file, 'player.symbol', rows);
      if (color !== (D.player || {}).color) games.setValue(g.file, 'player.color', color);
      app.toast('Player saved');
    }
    close();
  }
  const edit = (fn) => { push(); fn(); rer(); };
  const slide = (dx, dy) => edit(() => { const s = rows, w = W(); rows = s.map((_, y) => [...s[(y - dy + H()) % H()]].map((__, x) => s[(y - dy + H()) % H()][(x - dx + w) % w]).join('')); });
  // resizing keeps the drawing at the top left
  const resize = (dw, dh) => { const w = Math.max(MIN, Math.min(MAX, W() + dw)), h = Math.max(MIN, Math.min(MAX, H() + dh)); if (w === W() && h === H()) return; edit(() => { rows = Array.from({ length: h }, (_, y) => ((rows[y] || '') + '0'.repeat(w)).slice(0, w)); }); };
  const ACT = {
    cancel() { if (changed() && !confirm('Discard the changes to the player?')) return; close(); },
    save,
    ink(b) { ink = b.dataset.v; rer(); },
    undo() { if (!past.length) return; future.push(state()); load(past.pop()); rer(); },
    redo() { if (!future.length) return; past.push(state()); load(future.pop()); rer(); },
    more() { sheet = sheet === 'more' ? null : 'more'; rer(); },
    col: (b) => edit(() => { color = b.dataset.c; }),
    'w-': () => resize(-1, 0), 'w+': () => resize(1, 0), 'h-': () => resize(0, -1), 'h+': () => resize(0, 1),
    sl: () => slide(-1, 0), sr: () => slide(1, 0), su: () => slide(0, -1), sd: () => slide(0, 1),
    flip: () => edit(() => { rows = rows.map(r => [...r].reverse().join('')); }),
    clear: () => edit(() => { rows = blankRows(W(), H()); })
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
      if (dx || dy) { cur.x = (cur.x + dx + W()) % W(); cur.y = (cur.y + dy + H()) % H(); paint(); const x = cv.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(cur.x * cell + 2, cur.y * cell + 2, cell - 4, cell - 4); }
      if (input.pressed('a')) { push(); stroke = { changed: false }; setPx(Math.min(cur.x, W() - 1), Math.min(cur.y, H() - 1)); stroke = null; rer(); }
      if (input.pressed('x') || input.pressed('start')) save(); else if (input.pressed('b')) ACT.cancel();
    }
  };
  fit(); rer();
}
