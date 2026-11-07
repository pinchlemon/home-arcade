// Icon editor: hold any pixel icon to redraw it. Opens over whatever screen you are on (it is not a full-screen tool of its own).
// The list button shows every icon: use one's picture here, edit it, rename it, see where it shows, make a new one,
// or delete one you made. New art is kept on this phone (setIcon in pixel.js)
// and shown everywhere that icon is used.
import { G, well, svgRows, bitmapPath, placeNow, svgText, originalRows, setIcon, isMine, newIcon, dropIcon, isSaved, iconLabel, renameIcon, seenOn, quietly } from './pixel.js';
import { iconBtn, esc } from './ui.js';
import * as input from './input.js';
import * as snd from './sound.js';

const MIN = 3, MAX = 12, COLS = 6;
const toGrid = (rows) => rows.map(r => [...r].map(c => c === '1' ? 1 : 0));
const toRows = (grid) => grid.map(r => r.join(''));
const json = (x) => JSON.stringify(x);

// ---- one button's own picture. Holding a button redraws only that button: its picture is kept under a key made of the
// screen, the icon and the button's label (ha.icons.slots), and laid over the icon each time the button is drawn.
const SLOTS = 'ha.icons.slots';
let slots = null;
const readSlots = () => slots || (slots = (() => { try { return JSON.parse(localStorage.getItem(SLOTS)) || {}; } catch (e) { return {}; } })());
function setSlot(key, rows) {
  const m = readSlots();
  if (rows) m[key] = rows; else delete m[key];
  try { localStorage.setItem(SLOTS, JSON.stringify(m)); } catch (e) { /* storage full: lasts until the app closes */ }
}
// the key for an icon on screen. Numbers are left out, so a count in a label doesn't make it a different button.
export function slotOf(svg) {
  const b = svg.closest('button,[data-a],.row,.row-empty');
  let label = b ? (b.getAttribute('aria-label') || '') : '';
  if (!label && b) { const t = b.querySelector('.title') || b.querySelector(':scope > span:not(.mount)'); label = t ? t.textContent : ''; }
  return [placeNow(), svg.dataset.icon, label.trim().replace(/\d+/g, '#').slice(0, 40)].join('|');
}
// lay each button's own picture over its icon (main.js calls this whenever the screen changes)
export function applySlots(root) {
  const m = readSlots();
  if (!Object.keys(m).length && !root.querySelector('svg[data-slotted]')) return;
  const all = root.matches && root.matches('svg[data-icon]') ? [root] : root.querySelectorAll('svg[data-icon]');
  for (const svg of all) {
    const own = m[slotOf(svg)];
    if (!own && !svg.dataset.slotted) continue;
    const rows = own || G[svg.dataset.icon];
    if (!rows) continue;
    const vb = svg.getAttribute('viewBox').split(' '), scale = svg.getAttribute('width') / vb[2];
    const w = rows[0].length, h = rows.length;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w * scale); svg.setAttribute('height', h * scale);
    svg.querySelector('path').setAttribute('d', bitmapPath(rows));
    if (own) svg.dataset.slotted = '1'; else delete svg.dataset.slotted;
  }
}

// slot: the button being redrawn (from holding it). Without one, the icon itself is edited, everywhere it is used.
export function openIconEditor(app, first, acc = '#ffd23f', slot = null) {
  if (app.modal || !G[first]) return;
  let name, start, grid, past, future, list = false, sel = first;
  const cur = { x: 0, y: 0, on: false };   // the controller's cell (shown once the controller is used)
  const W = () => grid[0].length, H = () => grid.length;
  const names = () => Object.keys(G);
  function loadIcon(n) {
    name = n; start = ((slot && readSlots()[slot]) || G[n]).slice(); grid = toGrid(start); past = []; future = [];
    cur.x = Math.min(cur.x, W() - 1); cur.y = Math.min(cur.y, H() - 1);
  }
  loadIcon(first);
  const snap = () => json(grid);
  const push = () => { past.push(snap()); if (past.length > 60) past.shift(); future = []; };
  const load = (s) => { grid = JSON.parse(s); cur.x = Math.min(cur.x, W() - 1); cur.y = Math.min(cur.y, H() - 1); };
  const empty = () => !grid.some(r => r.includes(1));
  const changed = () => json(toRows(grid)) !== json(start);
  const base = () => slot ? G[name] : originalRows(name);   // what "Original" goes back to

  const el = document.createElement('div');
  el.className = 'icon-ed screen-tool';
  el.style.setProperty('--acc', acc);
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Edit icon');
  document.body.appendChild(el);
  const fit = () => {   // sit exactly over the app (home-screen apps are shorter than the screen)
    const r = document.getElementById('app').getBoundingClientRect();
    Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  };

  // ---- drawing view and list view
  const sizeStep = (label, v, dec, inc) => `<span class="cap" style="color:var(--muted)">${label}</span><span class="stepper">${iconBtn('minus', `data-k="${dec}"`, { label: 'Less ' + label.toLowerCase(), disabled: v <= MIN })}<span class="vscreen">${svgText(String(v), 'var(--acc)')}</span>${iconBtn('plus', `data-k="${inc}"`, { label: 'More ' + label.toLowerCase(), disabled: v >= MAX })}</span>`;
  const top = () => list
    ? `<div class="plate bar">
        ${iconBtn('back', 'data-k="list"', { color: '#fff', label: 'Back to the drawing' })}
        <span class="ie-name"><span class="title ell">Icons</span><span class="sub ell">${names().length} icons</span></span>
        ${iconBtn('plus', 'data-k="new"', { color: '#fff', label: 'New icon' })}
      </div>`
    : `<div class="plate bar">
        ${iconBtn('back', 'data-k="cancel"', { color: '#fff', label: 'Cancel' })}
        <span class="ie-name"><span class="title ell">${slot ? 'Edit button' : 'Edit icon'}</span><span class="sub ell">${esc(slot ? iconLabel(name) + ' · this button only' : iconLabel(name) + ' · everywhere')}</span></span>
        ${iconBtn('tiles', 'data-k="list"', { color: '#fff', label: 'All icons' })}
        ${iconBtn('check', 'data-k="save"', { color: '#fff', label: 'Save icon' })}
      </div>`;
  const where = (n) => {
    if (isMine(n)) return 'Made on this phone';
    const at = seenOn(n);
    return at.length ? 'Used on ' + at.join(', ') : 'Not used';
  };
  const act = (k, ic, label, dis) => `<button class="btn bare" data-k="${k}"${dis ? ' disabled' : ''}>${well(28, svgRows(G[ic], '#e4e2dc'))}<span>${label}</span></button>`;
  const listHtml = () => `<div class="plate ie-main ie-list" role="listbox" aria-label="Icons">${names().map((n) => {
    const on = n === sel;
    return `<button class="ie-item${on ? ' on' : ''}" data-k="pick" data-n="${n}" role="option" aria-selected="${on}" aria-label="${esc(iconLabel(n))}">${well(28, svgRows(G[n], on ? acc : '#e4e2dc'))}</button>`;
  }).join('')}</div>
    <div class="plate bar ie-info">${well(28, svgRows(G[sel], acc))}<span class="ie-name" style="margin-left:8px"><span class="title ell">${esc(iconLabel(sel))}</span><span class="sub clamp2">${esc(where(sel))}</span></span></div>
    <div class="plate ie-acts se-btns">
      ${act('use', 'check', 'Use here', sel === name)}${act('edit', 'edit', 'Edit', !slot && sel === name)}
      ${act('rename', 'rename', 'Rename')}${act('del', 'trash', 'Delete', !isMine(sel) || sel === name)}
    </div>`;
  const drawHtml = () => `
    <div class="plate ie-main"><canvas id="ie-cv" aria-label="Icon pixels"></canvas></div>
    <div class="plate bar">
      ${iconBtn('undo', 'data-k="undo"', { label: 'Undo', disabled: !past.length })}
      ${iconBtn('redo', 'data-k="redo"', { label: 'Redo', disabled: !future.length })}
      ${iconBtn('trash', 'data-k="clear"', { label: 'Clear', disabled: empty() })}
      ${iconBtn('reset', 'data-k="orig"', { label: slot ? 'Same as the icon' : 'Original icon', disabled: json(toRows(grid)) === json(base()) })}
      <span id="ie-prev" class="ie-prev">${well(28, svgRows(toRows(grid), '#e4e2dc'))}</span>
    </div>
    <div class="plate bar"><span class="cap" style="color:var(--muted);margin-left:8px">Slide</span><span style="display:flex;gap:2px">
      ${iconBtn('left', 'data-k="sl"', { label: 'Slide left', disabled: empty() })}${iconBtn('up', 'data-k="su"', { label: 'Slide up', disabled: empty() })}${iconBtn('down', 'data-k="sd"', { label: 'Slide down', disabled: empty() })}${iconBtn('right', 'data-k="sr"', { label: 'Slide right', disabled: empty() })}
    </span></div>
    <div class="plate bar">${sizeStep('W', W(), 'w-', 'w+')}${sizeStep('H', H(), 'h-', 'h+')}</div>`;

  let cv = null, ctx = null, main = null, cell = 20;
  function draw() {
    if (list || !cv) return;
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
  const prev = () => { const p = el.querySelector('#ie-prev'); if (p) p.innerHTML = well(28, svgRows(toRows(grid), '#e4e2dc')); };
  function rer() {
    const scroll = list && el.querySelector('.ie-list') ? el.querySelector('.ie-list').scrollTop : null;
    el.innerHTML = quietly(() => top() + (list ? listHtml() : drawHtml()));   // the editor's own buttons don't count as uses
    cv = el.querySelector('#ie-cv'); main = el.querySelector('.ie-main'); ctx = cv && cv.getContext('2d');
    if (cv) { cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); }
    if (list) {
      const box = el.querySelector('.ie-list');
      if (scroll !== null) box.scrollTop = scroll;
      const target = box.querySelector('.on');
      if (target && (scroll === null || cur.on)) target.scrollIntoView({ block: 'nearest' });
    }
    draw();
  }

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
  function down(e) {
    const [x, y] = cellAt(e);
    if (x < 0 || y < 0 || x >= W() || y >= H()) return;
    cv.setPointerCapture(e.pointerId);
    push(); stroke = { v: grid[y][x] ? 0 : 1, x, y, changed: false };
    set(x, y); cur.on = false; draw(); prev();
  }
  function move(e) {
    if (!stroke) return;
    const [x, y] = cellAt(e);
    if (x === stroke.x && y === stroke.y) return;
    line(stroke.x, stroke.y, x, y); stroke.x = x; stroke.y = y; draw(); prev();
  }
  function end() {
    if (!stroke) return;
    const did = stroke.changed; stroke = null;
    if (!did) past.pop();
    rer();
  }

  // ---- actions
  const resize = (dw, dh) => {
    const w = Math.max(MIN, Math.min(MAX, W() + dw)), h = Math.max(MIN, Math.min(MAX, H() + dh));
    if (w === W() && h === H()) return;
    push();
    grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (grid[y] && grid[y][x]) || 0));
    cur.x = Math.min(cur.x, w - 1); cur.y = Math.min(cur.y, h - 1);
    rer();
  };
  // slide every pixel one step; what goes off one edge comes back on the other, so nothing is lost
  const slide = (dx, dy) => {
    if (empty()) return;
    push();
    const w = W(), h = H();
    grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => grid[(y - dy + h) % h][(x - dx + w) % w]));
    rer();
  };
  const keep = () => {   // save the icon being drawn; false if it is blank
    if (!changed()) return true;
    if (empty()) { app.toast('Draw at least one pixel'); return false; }
    if (slot) setSlot(slot, json(toRows(grid)) === json(G[name]) ? null : toRows(grid));
    else setIcon(name, toRows(grid));
    return true;
  };
  const close = () => { if (!isSaved(name)) dropIcon(name); removeEventListener('resize', onResize); el.remove(); app.modal = null; };
  const save = () => {
    const did = changed();
    if (!keep()) return;
    close(); if (did) app.render();
    if (did) app.toast('Icon saved');
  };
  const cancel = () => {
    if (changed() && !confirm('Discard the changes to this icon?')) return;
    close();
  };
  const openList = () => { list = true; sel = name; rer(); };
  // use another icon's picture for this one (undo brings the old one back); the other icon is not changed
  const useHere = (n) => {
    push(); grid = toGrid(G[n]);
    cur.x = Math.min(cur.x, W() - 1); cur.y = Math.min(cur.y, H() - 1);
    list = false; rer();
  };
  // switch to editing another icon (offers to save this one first)
  const editOther = (n) => {
    if (changed() && confirm('Save the changes to ' + iconLabel(name) + ' first?') && !keep()) return;
    if (!isSaved(name)) dropIcon(name);
    slot = null; loadIcon(n); sel = n; list = false; rer();
  };
  const make = () => { const n = newIcon(); editOther(n); };
  const rename = () => {
    const v = prompt('Icon name', iconLabel(sel));
    if (v === null) return;
    renameIcon(sel, v.trim().slice(0, 30)); rer();
  };
  const del = () => {
    if (!isMine(sel) || sel === name || !confirm('Delete ' + iconLabel(sel) + '?')) return;
    dropIcon(sel); sel = name; rer();
  };
  const ACT = {
    cancel, save,
    list() { if (list) { list = false; rer(); } else openList(); },
    pick(b) { sel = b.dataset.n; cur.on = false; rer(); },
    use: () => useHere(sel), edit: () => editOther(sel), new: make, rename, del,
    undo() { if (!past.length) return; future.push(snap()); load(past.pop()); rer(); },
    redo() { if (!future.length) return; past.push(snap()); load(future.pop()); rer(); },
    clear() { push(); grid = grid.map(r => r.map(() => 0)); rer(); },
    orig() { push(); grid = toGrid(base()); rer(); },
    sl: () => slide(-1, 0), sr: () => slide(1, 0), su: () => slide(0, -1), sd: () => slide(0, 1),
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
    ACT[b.dataset.k](b);
  });
  const onResize = () => { fit(); draw(); };
  addEventListener('resize', onResize);

  // ---- controller. Drawing: D-pad moves the white square, A flips that pixel, X saves, B cancels.
  // List: D-pad moves through the icons, A uses one here, B goes back to the drawing.
  app.modal = {
    frame() {
      const dx = (input.pressed('right') ? 1 : 0) - (input.pressed('left') ? 1 : 0), dy = (input.pressed('down') ? 1 : 0) - (input.pressed('up') ? 1 : 0);
      if (list) {
        const n = names().length;
        if (dx || dy) { cur.on = true; sel = names()[Math.max(0, Math.min(n - 1, names().indexOf(sel) + dx + dy * COLS))]; rer(); }
        if (input.pressed('a') && sel !== name) useHere(sel);
        else if (input.pressed('b')) { list = false; rer(); }
        return;
      }
      if (dx || dy) { cur.on = true; cur.x = Math.max(0, Math.min(W() - 1, cur.x + dx)); cur.y = Math.max(0, Math.min(H() - 1, cur.y + dy)); draw(); }
      if (input.pressed('a')) { cur.on = true; push(); grid[cur.y][cur.x] = grid[cur.y][cur.x] ? 0 : 1; rer(); }
      if (input.pressed('x') || input.pressed('start')) save();
      else if (input.pressed('b')) cancel();
    }
  };
  fit(); rer();
}
