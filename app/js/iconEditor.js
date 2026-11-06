// Icon editor: hold any pixel icon button to redraw its icon. Opens over whatever screen you are on (it is not a full-screen tool of its own),
// and the new art is kept on this phone (see setIcon in pixel.js) and shown everywhere that icon is used.
import { G, well, svgRows, svgText, originalRows, setIcon } from './pixel.js';
import { iconBtn, esc } from './ui.js';
import * as input from './input.js';
import * as snd from './sound.js';

const MIN = 3, MAX = 12;
const pretty = (name) => name.replace(/([A-Z])/g, ' $1').toLowerCase();
const toGrid = (rows) => rows.map(r => [...r].map(c => c === '1' ? 1 : 0));
const toRows = (grid) => grid.map(r => r.join(''));

export function openIconEditor(app, name, acc = '#ffd23f') {
  if (app.modal || !G[name]) return;
  const start = G[name].slice();
  let grid = toGrid(start), past = [], future = [];
  const cur = { x: 0, y: 0, on: false };   // the controller's cell (shown once the controller is used)
  const W = () => grid[0].length, H = () => grid.length;
  const snap = () => JSON.stringify(grid);
  const push = () => { past.push(snap()); if (past.length > 60) past.shift(); future = []; };
  const load = (s) => { grid = JSON.parse(s); cur.x = Math.min(cur.x, W() - 1); cur.y = Math.min(cur.y, H() - 1); };

  const el = document.createElement('div');
  el.className = 'icon-ed screen-tool';
  el.style.setProperty('--acc', acc);
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Edit icon');
  document.body.appendChild(el);
  const fit = () => {   // sit exactly over the app (home-screen apps are shorter than the screen)
    const r = document.getElementById('app').getBoundingClientRect();
    Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  };

  const empty = () => !grid.some(r => r.includes(1));
  const same = () => snap() === JSON.stringify(toGrid(start));
  const sizeStep = (label, v, dec, inc) => `<span class="cap" style="color:var(--muted)">${label}</span><span class="stepper">${iconBtn('minus', `data-k="${dec}"`, { label: 'Less ' + label.toLowerCase(), disabled: v <= MIN })}<span class="vscreen">${svgText(String(v), 'var(--acc)')}</span>${iconBtn('plus', `data-k="${inc}"`, { label: 'More ' + label.toLowerCase(), disabled: v >= MAX })}</span>`;
  const bars = () => `
    <div class="plate bar">
      ${iconBtn('undo', 'data-k="undo"', { label: 'Undo', disabled: !past.length })}
      ${iconBtn('redo', 'data-k="redo"', { label: 'Redo', disabled: !future.length })}
      ${iconBtn('trash', 'data-k="clear"', { label: 'Clear', disabled: empty() })}
      ${iconBtn('reset', 'data-k="orig"', { label: 'Original icon', disabled: JSON.stringify(toRows(grid)) === JSON.stringify(originalRows(name)) })}
      <span id="ie-prev" class="ie-prev">${well(28, svgRows(toRows(grid), '#e4e2dc'))}</span>
    </div>
    <div class="plate bar">${sizeStep('W', W(), 'w-', 'w+')}${sizeStep('H', H(), 'h-', 'h+')}</div>`;
  el.innerHTML = `
    <div class="plate bar">
      ${iconBtn('back', 'data-k="cancel"', { color: '#fff', label: 'Cancel' })}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">Edit icon</span><span class="sub ell">${esc(pretty(name))}</span></span>
      ${iconBtn('check', 'data-k="save"', { color: '#fff', label: 'Save icon' })}
    </div>
    <div class="plate ie-main"><canvas id="ie-cv" aria-label="Icon pixels"></canvas></div>
    <div id="ie-bars" style="display:contents">${bars()}</div>`;
  const cv = el.querySelector('#ie-cv'), main = el.querySelector('.ie-main'), ctx = cv.getContext('2d');

  let cell = 20;
  function draw() {
    const w = W(), h = H(), dpr = Math.min(devicePixelRatio || 1, 3);
    const avail = main.getBoundingClientRect();
    cell = Math.max(8, Math.floor(Math.min((avail.width - 16) / w, (avail.height - 16) / h)));
    cv.style.width = cell * w + 'px'; cv.style.height = cell * h + 'px';
    cv.width = Math.round(cell * w * dpr); cv.height = Math.round(cell * h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cell * w, cell * h);
    const g = Math.max(1, Math.round(cell * 0.06));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      ctx.fillStyle = grid[y][x] ? acc : '#17171c';
      ctx.fillRect(x * cell + g, y * cell + g, cell - g * 2, cell - g * 2);
    }
    if (cur.on) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(cur.x * cell + 2, cur.y * cell + 2, cell - 4, cell - 4); }
  }
  const prev = () => { el.querySelector('#ie-prev').innerHTML = well(28, svgRows(toRows(grid), '#e4e2dc')); };
  const redo = () => { el.querySelector('#ie-bars').innerHTML = bars(); draw(); };

  // ---- drawing: the first cell you touch decides whether the stroke paints or erases
  let stroke = null;
  const cellAt = (e) => {
    const r = cv.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / cell), Math.floor((e.clientY - r.top) / cell)];
  };
  const set = (x, y) => { if (x >= 0 && y >= 0 && x < W() && y < H() && grid[y][x] !== stroke.v) { grid[y][x] = stroke.v; stroke.changed = true; } };
  function line(x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) set(Math.round(x0 + (x1 - x0) * (n ? i / n : 0)), Math.round(y0 + (y1 - y0) * (n ? i / n : 0)));
  }
  cv.addEventListener('pointerdown', (e) => {
    const [x, y] = cellAt(e);
    if (x < 0 || y < 0 || x >= W() || y >= H()) return;
    cv.setPointerCapture(e.pointerId);
    push(); stroke = { v: grid[y][x] ? 0 : 1, x, y, changed: false };
    set(x, y); cur.on = false; draw(); prev();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!stroke) return;
    const [x, y] = cellAt(e);
    if (x === stroke.x && y === stroke.y) return;
    line(stroke.x, stroke.y, x, y); stroke.x = x; stroke.y = y; draw(); prev();
  });
  const end = () => {
    if (!stroke) return;
    const changed = stroke.changed; stroke = null;
    if (!changed) past.pop();
    redo();
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  // ---- buttons
  const resize = (dw, dh) => {
    const w = Math.max(MIN, Math.min(MAX, W() + dw)), h = Math.max(MIN, Math.min(MAX, H() + dh));
    if (w === W() && h === H()) return;
    push();
    grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (grid[y] && grid[y][x]) || 0));
    cur.x = Math.min(cur.x, w - 1); cur.y = Math.min(cur.y, h - 1);
    redo();
  };
  const close = () => {
    removeEventListener('resize', onResize); el.remove(); app.modal = null;
    if (held) held.classList.remove('pressed');
  };
  const save = () => {
    if (empty()) { app.toast('Draw at least one pixel'); return; }
    if (!same()) setIcon(name, toRows(grid));
    close(); app.render();
    if (!same()) app.toast('Icon saved');
  };
  const cancel = () => {
    if (!same() && !confirm('Discard the changes to this icon?')) return;
    close();
  };
  const ACT = {
    cancel, save,
    undo() { if (!past.length) return; future.push(snap()); load(past.pop()); redo(); prev(); },
    redo() { if (!future.length) return; past.push(snap()); load(future.pop()); redo(); prev(); },
    clear() { push(); grid = grid.map(r => r.map(() => 0)); redo(); },
    orig() { push(); grid = toGrid(originalRows(name)); redo(); },
    'w-': () => resize(-1, 0), 'w+': () => resize(1, 0), 'h-': () => resize(0, -1), 'h+': () => resize(0, 1)
  };
  let held = null;
  el.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b || b.disabled) return;
    held = b; b.classList.add('pressed'); snd.click();
  });
  const letGo = () => { if (held) held.classList.remove('pressed'); held = null; };
  el.addEventListener('pointerup', (e) => { const over = document.elementFromPoint(e.clientX, e.clientY); if (held && !(over && held.contains(over))) letGo(); });
  el.addEventListener('pointercancel', letGo);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b || b.disabled) return;
    held = null;
    ACT[b.dataset.k]();
  });
  const onResize = () => { fit(); draw(); };
  addEventListener('resize', onResize);

  // ---- controller: D-pad moves the white square, A flips that pixel, X saves, B cancels
  app.modal = {
    frame() {
      const dx = (input.pressed('right') ? 1 : 0) - (input.pressed('left') ? 1 : 0), dy = (input.pressed('down') ? 1 : 0) - (input.pressed('up') ? 1 : 0);
      if (dx || dy) { cur.on = true; cur.x = Math.max(0, Math.min(W() - 1, cur.x + dx)); cur.y = Math.max(0, Math.min(H() - 1, cur.y + dy)); draw(); }
      if (input.pressed('a')) { cur.on = true; push(); grid[cur.y][cur.x] = grid[cur.y][cur.x] ? 0 : 1; redo(); prev(); }
      if (input.pressed('x') || input.pressed('start')) save();
      else if (input.pressed('b')) cancel();
    }
  };
  fit(); draw();
}
