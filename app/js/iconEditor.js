// Icon editor: hold any pixel icon to redraw it. Opens over whatever screen you are on (it is not a full-screen tool of its own).
// The list button shows every icon: use one's picture here, edit it, rename it, see where it shows, make a new one,
// or delete one you made. New art is kept on this phone (setIcon in pixel.js)
// and shown everywhere that icon is used.
import { G, well, svgRows, bitmapPath, placeNow, svgText, originalRows, setIcon, isMine, newIcon, dropIcon, isSaved, iconLabel, renameIcon, seenOn, quietly } from './pixel.js';
import { iconBtn, esc, toggle } from './ui.js';
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
// a slot is the button's rows, or {rows, from} when the picture was picked from another icon in the list (older saves are just the rows)
const slotRows = (v) => v && (Array.isArray(v) ? v : v.rows);
const slotFrom = (v) => (v && !Array.isArray(v) && v.from) || null;
function setSlot(key, rows, from) {
  const m = readSlots();
  if (rows) m[key] = from ? { rows, from } : rows; else delete m[key];
  try { localStorage.setItem(SLOTS, JSON.stringify(m)); } catch (e) { /* storage full: lasts until the app closes */ }
}
// ---- a button's own text: its name and description, kept under the screen + its original name (ha.text.slots)
const TEXTS = 'ha.text.slots';
let texts = null;
const readTexts = () => texts || (texts = (() => { try { return JSON.parse(localStorage.getItem(TEXTS)) || {}; } catch (e) { return {}; } })());
function setText(key, t) {
  const m = readTexts();
  if (t && Object.keys(t).length) m[key] = t; else delete m[key];
  try { localStorage.setItem(TEXTS, JSON.stringify(m)); } catch (e) { /* storage full: lasts until the app closes */ }
}
export const HOST = 'button,[data-a],.row,.row-empty,.setrow';   // things that can be held
// the text parts of a button: name (.title, or a plate button's label) and description (.sub)
function fieldsOf(host) {
  const f = {}, t = host.querySelector('.title') || host.querySelector(':scope > .lbl'), d = host.querySelector('.sub');   // .lbl: a tab's label
  if (t) f.title = t;
  else if (host.matches('button')) { const l = host.querySelector(':scope > span:not(.mount):not(.ring):not(.selring)'); if (l && l.textContent.trim()) f.title = l; }
  const seen = host.dataset.orig && 'sub' in JSON.parse(host.dataset.orig);   // a description we emptied is still there to refill
  if (d && (seen || d.textContent.trim() || host.matches('.row,.setrow')) && !(d.closest('button') && d.closest('button') !== host && host.matches('.setrow'))) f.sub = d;
  return f;
}
// the button's text as the app drew it (kept on the element, so changed text doesn't change its key)
function origOf(host) {
  if (host.dataset.orig) return JSON.parse(host.dataset.orig);
  const o = {};
  for (const [k, e] of Object.entries(fieldsOf(host))) o[k] = e.textContent;
  host.dataset.orig = JSON.stringify(o);
  return o;
}
const norm = (t) => (t || '').trim().replace(/\d+/g, '#').slice(0, 40);   // numbers left out, so a count doesn't make it a different button
const textKey = (host) => { const o = origOf(host); return o.title ? placeNow() + '|' + norm(o.title) : null; };
export const hasText = (host) => !!origOf(host).title;
// the key for an icon on screen
export function slotOf(svg) {
  const b = svg.closest(HOST);
  const label = b ? (b.getAttribute('aria-label') || origOf(b).title || '') : '';
  return [placeNow(), svg.dataset.icon, norm(label)].join('|');
}
function applyText(root) {
  const m = readTexts();
  if (!Object.keys(m).length && !root.querySelector('[data-txt]') && !(root.dataset && root.dataset.txt)) return;
  const hosts = root.matches && root.matches(HOST) ? [root, ...root.querySelectorAll(HOST)] : root.querySelectorAll(HOST);
  for (const h of hosts) {
    if (!origOf(h).title) continue;
    const own = m[textKey(h)], o = origOf(h);
    if (!own && !h.dataset.txt) continue;
    for (const [k, e] of Object.entries(fieldsOf(h))) {
      const v = own && own[k] != null ? own[k] : o[k];
      if (v != null && e.textContent !== v) e.textContent = v;
    }
    if (h.dataset.al === '1' || h.getAttribute('aria-label') === o.title) { h.dataset.al = '1'; h.setAttribute('aria-label', (own && own.title) || o.title); }   // a label that is just the name follows it
    if (own) h.dataset.txt = '1'; else delete h.dataset.txt;
  }
}

// lay each button's own picture over its icon (main.js calls this whenever the screen changes)
export function applySlots(root) {
  applyText(root);
  const m = readSlots();
  if (!Object.keys(m).length && !root.querySelector('svg[data-slotted]')) return;
  const all = root.matches && root.matches('svg[data-icon]') ? [root] : root.querySelectorAll('svg[data-icon]');
  for (const svg of all) {
    const own = slotRows(m[slotOf(svg)]);
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
// host: the held button, whose name and description can be changed too. With no icon (first = null) only its text is edited.
export function openIconEditor(app, first, acc = '#ffd23f', slot = null, host = null) {
  const hasIcon = !!G[first];
  if (app.modal || (!hasIcon && !(host && hasText(host)))) return;
  let name, start, grid, past, future, list = false, textView = !hasIcon, sel = first;
  // for a single button: the icon its picture came from, and whether saving also updates that icon in the list (on every button using it)
  let from = first, alsoList = false;
  const cur = { x: 0, y: 0, on: false };   // the controller's cell (shown once the controller is used)
  const W = () => grid[0].length, H = () => grid.length;
  const names = () => Object.keys(G);
  function loadIcon(n) {
    name = n; from = n; alsoList = false; const saved = slot && readSlots()[slot];
    start = (slotRows(saved) || G[n]).slice(); grid = toGrid(start); past = []; future = [];
    // reopening a button: the icon its picture was picked from (if it still exists) is the one shown and highlighted
    const was = slotFrom(saved);
    if (was && G[was] && was !== n) { from = was; alsoList = true; }
    cur.x = Math.min(cur.x, W() - 1); cur.y = Math.min(cur.y, H() - 1);
  }
  if (hasIcon) loadIcon(first); else { name = null; start = ['0']; grid = [[0]]; past = []; future = []; }
  // text: what the app shows, what this button has saved, and the edits not yet saved
  const tKey = host && hasText(host) ? textKey(host) : null, tOrig = tKey ? origOf(host) : {};
  const tFields = tKey ? Object.keys(tOrig) : [];
  let tSaved = tKey ? { ...(readTexts()[tKey] || {}) } : {}, tNow = { ...tSaved };
  const textChanged = () => json(tNow) !== json(tSaved);
  const tVal = (k) => tNow[k] != null ? tNow[k] : tOrig[k];
  const snap = () => json(grid);
  const push = () => { past.push(snap()); if (past.length > 60) past.shift(); future = []; };
  const load = (s) => { grid = JSON.parse(s); cur.x = Math.min(cur.x, W() - 1); cur.y = Math.min(cur.y, H() - 1); };
  const empty = () => !grid.some(r => r.includes(1));
  const changed = () => json(toRows(grid)) !== json(start);
  const base = () => slot ? G[name] : originalRows(name);
  const dirty = () => (hasIcon && changed()) || textChanged();   // what "Original" goes back to

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
  const FIELD = { title: 'Name', sub: 'Description' };
  const top = () => textView
    ? `<div class="plate bar">
        ${iconBtn('back', hasIcon ? 'data-k="text"' : 'data-k="cancel"', { color: '#fff', label: hasIcon ? 'Back to the drawing' : 'Cancel' })}
        <span class="ie-name"><span class="title ell">Edit text</span><span class="sub ell">${esc(tOrig.title || '')} · this button only</span></span>
        ${iconBtn('check', 'data-k="save"', { color: '#fff', label: 'Save' })}
      </div>`
    : list
    ? `<div class="plate bar">
        ${iconBtn('back', 'data-k="list"', { color: '#fff', label: 'Back to the drawing' })}
        <span class="ie-name"><span class="title ell">Icons</span><span class="sub ell">${names().length} icons</span></span>
        ${iconBtn('plus', 'data-k="new"', { color: '#fff', label: 'New icon' })}
      </div>`
    : `<div class="plate bar">
        ${iconBtn('back', 'data-k="cancel"', { color: '#fff', label: 'Cancel' })}
        <span class="ie-name"><span class="title ell">${slot ? 'Edit button' : 'Edit icon'}</span><span class="sub ell">${esc(slot ? iconLabel(from) + ' · this button only' : iconLabel(name) + ' · everywhere')}</span></span>
        ${tKey ? iconBtn('rename', 'data-k="text"', { color: '#fff', label: 'Name and description' }) : ''}
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
      ${act('use', 'check', 'Use here', !slot && sel === name)}${act('edit', 'edit', 'Edit', !slot && sel === name)}
      ${act('rename', 'rename', 'Rename')}${act('del', 'trash', 'Delete', !isMine(sel) || sel === name)}
    </div>`;
  const textHtml = () => `<div class="plate ie-main ie-texts">
      ${tFields.map(k => `<button class="ie-field" data-k="tx" data-f="${k}"><span class="ie-name"><span class="cap" style="color:var(--muted)">${FIELD[k]}</span><span class="${k === 'title' ? 'title' : 'sub'} clamp2" style="color:${tVal(k) === '' ? 'var(--muted)' : 'var(--text)'}">${tVal(k) === '' ? 'None' : esc(tVal(k))}</span></span>${well(28, svgRows(G.rename, '#e4e2dc'))}</button>`).join('')}
    </div>
    <div class="plate ie-acts se-btns">${act('txreset', 'reset', 'Original text', !Object.keys(tNow).length)}</div>`;
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
    <div class="plate bar">${sizeStep('W', W(), 'w-', 'w+')}${sizeStep('H', H(), 'h-', 'h+')}</div>
    ${slot ? `<div class="plate bar"><span class="ie-name" style="margin-left:8px"><span class="title ell">Update list icon</span><span class="sub ell">${esc(alsoList ? iconLabel(from) + ' changes on every button' : 'This button only')}</span></span>${toggle(alsoList, 'data-k="also"', 'Update list icon')}</div>` : ''}`;

  let cv = null, ctx = null, main = null, cell = 20;
  function draw() {
    if (list || textView || !cv) return;
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
    el.innerHTML = quietly(() => top() + (textView ? textHtml() : list ? listHtml() : drawHtml()));   // the editor's own buttons don't count as uses
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
  const keep = () => {   // save the icon being drawn and the text; false if the icon is blank
    if (textChanged()) { setText(tKey, tNow); tSaved = { ...tNow }; }
    if (!hasIcon || !changed()) return true;
    if (empty()) { app.toast('Draw at least one pixel'); return false; }
    const rows = toRows(grid);
    if (slot && alsoList && json(rows) !== json(G[from])) setIcon(from, rows);   // the list shows the new picture
    if (slot) setSlot(slot, json(rows) === json(G[name]) ? null : rows, from !== name ? from : null);
    else setIcon(name, rows);
    return true;
  };
  const close = () => { if (name && !isSaved(name)) dropIcon(name); removeEventListener('resize', onResize); el.remove(); app.modal = null; };
  const save = () => {
    const did = dirty();
    if (!keep()) return;
    close(); if (did) { app.render(); applySlots(document.getElementById('app')); }
    if (did) app.toast('Saved');
  };
  const cancel = () => {
    if (dirty() && !confirm('Discard the changes?')) return;
    close();
  };
  const openList = () => { list = true; sel = slot ? from : name; rer(); };
  // use another icon's picture for this one (undo brings the old one back); the other icon is not changed
  const useHere = (n) => {
    push(); grid = toGrid(G[n]); from = n; alsoList = n !== name;   // picked from the list: starts on "update the list"
    cur.x = Math.min(cur.x, W() - 1); cur.y = Math.min(cur.y, H() - 1);
    list = false; rer();
  };
  // switch to editing another icon (offers to save this one first)
  const editOther = (n) => {
    if (dirty() && confirm('Save the changes first?') && !keep()) return;
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
    also() { alsoList = !alsoList; rer(); },
    text() { textView = !textView; list = false; rer(); },
    tx(b) {
      const k = b.dataset.f, v = prompt(k === 'sub' ? 'Description (leave blank for none)' : FIELD[k], tVal(k));
      if (v === null) return;
      if (k === 'title' && v.trim() === '') delete tNow[k];                   // a name can't be empty
      else if (k === 'sub' && v.trim() === '') { if (tOrig.sub === '') delete tNow.sub; else tNow.sub = ''; }   // blank: no description
      else if (v === tOrig[k]) delete tNow[k];
      else tNow[k] = v.slice(0, 80);
      rer();
    },
    txreset() { tNow = {}; rer(); },
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
      if (textView) { if (input.pressed('x') || input.pressed('start')) save(); else if (input.pressed('b')) (hasIcon ? ACT.text() : cancel()); return; }
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
