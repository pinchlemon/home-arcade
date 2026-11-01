// Library: the one place a game's sprites, tiles and sounds live, in folders. The Studio trays read this same tree.
// Controller: D-pad up/down picks, left/right switches sprites, tiles and sounds, A opens, B goes up a folder.
import { well, icon, svgRows, svgText, G, PALETTE, PALETTE_NAMES, drawText, textRows } from '../pixel.js';
import * as S from '../store.js';
import { A, esc, row, pager, plateBtn, iconBtn, bareBtn, stepper, pageOf, emptyRow, rows } from '../ui.js';
import * as snd from '../sound.js';
import * as input from '../input.js';

const PINK = '#ff4fd8';
const CATS = [['sprites', 'Sprites', 'sprites', 'sprite'], ['tiles', 'Tiles', 'tiles', 'tile'], ['sounds', 'Sounds', 'sounds', 'sound']];
const col = (c) => PALETTE[c] || c || '#ffffff';
const TILE_TYPES = [['solid', 'Solid'], ['oneway', 'One-way'], ['hurts', 'Hurts'], ['climb', 'Ladder'], ['decor', 'Decor']];
const ROLES = ['player', 'walker', 'flyer', 'pickup', 'goal', 'decor'];
const ROLE_NAMES = { player: 'Player', walker: 'Walker', flyer: 'Flyer', pickup: 'Pickup', goal: 'Goal', decor: 'Decor' };
const WAVES = ['square', 'triangle', 'saw', 'noise'];
const SOUND_ART = ['0001000', '0011010', '1111001', '1111001', '1111001', '0011010', '0001000'];

export const tileType = (a) => (a.solid ? 'solid' : a.oneway ? 'oneway' : a.hurts ? 'hurts' : a.climb ? 'climb' : 'decor');
const setTileType = (a, t) => { a.solid = t === 'solid'; a.oneway = t === 'oneway'; a.hurts = t === 'hurts'; a.climb = t === 'climb'; };

// how many places use an asset: scene objects, painted tiles, event rules
export function usesOf(p, id) {
  const a = p.assets[id]; if (!a) return 0;
  let n = 0;
  for (const sd of Object.values(p.sceneData)) {
    if (a.kind === 'sprite') n += sd.objects.filter(o => o.sprite === id).length;
    if (a.kind === 'tile') n += Object.values(sd.tiles).filter(t => t === id).length;
  }
  if (a.kind === 'sprite') n += p.events.when.filter(w => w.who === id).length;
  if (a.kind === 'sound') n += p.events.do.filter(d => d.tgt === 'sound' && d.act === id).length;
  return n;
}
function metaOf(a) {
  if (a.kind === 'sprite') return '8 x 8 · ' + ROLE_NAMES[a.role || 'decor'].toLowerCase();
  if (a.kind === 'tile') return '8 x 8 · ' + TILE_TYPES.find(t => t[0] === tileType(a))[1].toLowerCase();
  return a.wave + ' · pitch ' + a.pitch;
}
const artOf = (a, color) => (a.kind === 'sound' ? svgRows(SOUND_ART, color || '#e4e2dc') : svgRows(a.px, color || col(a.color)));

function deleteAsset(p, id) {
  const a = p.assets[id]; if (!a) return;
  const cat = a.kind + 's';
  p.library[cat] = S.removeFromTree(p.library[cat], id);
  for (const sd of Object.values(p.sceneData)) {
    sd.objects = sd.objects.filter(o => o.sprite !== id);
    for (const k of Object.keys(sd.tiles)) if (sd.tiles[k] === id) delete sd.tiles[k];
  }
  const ev = p.events, goneW = ev.when.filter(w => w.who === id).map(w => w.id), goneD = ev.do.filter(d => d.tgt === 'sound' && d.act === id).map(d => d.id);
  ev.when = ev.when.filter(w => !goneW.includes(w.id)); ev.do = ev.do.filter(d => !goneD.includes(d.id));
  ev.cables = ev.cables.filter(c => !goneW.includes(c[0]) && !goneD.includes(c[1]));
  delete p.assets[id];
}
// every folder in a tree, as paths, for the "Folder" row in the asset editor
function foldersOf(tree) {
  const out = [{ path: [], name: 'Top level' }];
  (function walk(l, path, prefix) { l.forEach((n, i) => { if (S.isFolder(n)) { const pth = path.concat([i]), name = prefix + n.folder; out.push({ path: pth, name }); walk(n.items, pth, name + ' / '); } }); })(tree, [], '');
  return out;
}
function moveTo(tree, id, toPath) {
  const from = S.pathOf(tree, id) || [];
  if (from.join('.') === toPath.join('.')) return tree;
  const added = S.editAt(tree, toPath, l => [...l, id]);
  return S.editAt(added, from, l => { const i = l.indexOf(id); return l.filter((n, j) => j !== i); });
}

function newAsset(p, cat, path) {
  const n = S.flatten(p.library[cat]).length + 1, id = (cat === 'sprites' ? 'sp_' : cat === 'tiles' ? 'tl_' : 'sd_') + S.uid('');
  if (cat === 'sprites') p.assets[id] = { kind: 'sprite', name: 'Sprite ' + n, px: [...S.BLANK8], color: 'white', role: 'decor' };
  else if (cat === 'tiles') p.assets[id] = { kind: 'tile', name: 'Tile ' + n, px: ['11111111', '10000001', '10000001', '10000001', '10000001', '10000001', '10000001', '11111111'], color: 'bone', solid: true, oneway: false, hurts: false, climb: false };
  else p.assets[id] = { kind: 'sound', name: 'Sound ' + n, wave: 'square', pitch: 5, slide: 0, len: 3 };
  p.library[cat] = S.editAt(p.library[cat], path, l => [...l, id]);
  return id;
}

// ---------------------------------------------------------------- the tab
function state(app) {
  const u = app.ui;
  u.lib = u.lib || { cat: 'sprites', path: { sprites: [], tiles: [], sounds: [] }, sel: 0, page: 0 };
  return u.lib;
}
function rowsOf(p, L) {
  const tree = p.library[L.cat], path = L.path[L.cat] = L.path[L.cat] || [];
  let list = S.listAt(tree, path);
  // a stale path (folder removed elsewhere) falls back to the top
  if (path.length && !S.folderNameAt(tree, path)) { L.path[L.cat] = []; list = tree; }
  return (L.path[L.cat].length ? [{ back: true }] : []).concat(list.map((n, i) => ({ n, i })));
}

export default {
  render(app) {
    const p = app.project(), L = state(app), cat = CATS.find(c => c[0] === L.cat), kind = cat[3];
    if (!p) return { right: `<span class="cap acc">Library</span><span class="title clamp2">No game yet</span><span class="sub">Make a game in the Studio first</span>`, body: emptyRow('books', 'Each game has its own Library of sprites, tiles and sounds.') };
    const list0 = rowsOf(p, L), path = L.path[L.cat], tree = p.library[L.cat], fname = S.folderNameAt(tree, path);
    L.sel = Math.max(0, Math.min(list0.length - 1, L.sel || 0));
    const pg = pageOf(list0, L.page ?? Math.floor(L.sel / rows())), sel = list0[L.sel];
    const go = (np) => { L.path[L.cat] = np; L.sel = 0; L.page = 0; app.saveUI(); app.render(); };
    const pick = (i) => { L.sel = i; L.page = Math.floor(i / rows()); app.saveUI(); const r = list0[i], a = r && !r.back && p.assets[r.n]; if (a && a.kind === 'sound') snd.play(a); app.render(); };
    const add = () => { const pp = S.loadProject(p.id) || p, id = newAsset(pp, L.cat, path); S.saveProject(pp); app.refreshProjects(); L.sel = list0.length; L.page = Math.floor(L.sel / rows()); app.saveUI(); openAsset(app, pp.id, id); };
    const open = (r) => {
      if (!r) return;
      if (r.back) go(path.slice(0, -1));
      else if (S.isFolder(r.n)) go(path.concat([r.i]));
      else openAsset(app, p.id, r.n);
    };
    // rename the folder you are in; an empty name removes it and moves what was inside up a level
    const renameHere = () => {
      const parent = path.slice(0, -1), i = path[path.length - 1], f = S.listAt(tree, parent)[i];
      const n = prompt('Folder name. Clear it to remove the folder; what is inside moves up a level.', f.folder);
      if (n === null) return;
      const pp = S.loadProject(p.id) || p;
      pp.library[L.cat] = S.editAt(pp.library[L.cat], parent, l => (n.trim()
        ? l.map((x, j) => (j === i ? { ...x, folder: n.trim().slice(0, 20) } : x))
        : [...l.slice(0, i), ...l[i].items, ...l.slice(i + 1)]));
      S.saveProject(pp); app.refreshProjects();
      if (!n.trim()) { L.path[L.cat] = parent; L.sel = 0; L.page = 0; app.saveUI(); }
      app.render();
    };
    // emblem: the selected asset or folder
    let title, meta, a1 = '';
    const a2 = plateBtn('plus', 'New ' + kind, A(add));
    if (!sel) { title = 'Empty'; meta = 'No ' + cat[1].toLowerCase() + ' yet'; }
    else if (sel.back) { const c = S.flatten(S.listAt(tree, path)).length; title = fname; meta = 'Folder · ' + c + ' ' + kind + (c === 1 ? '' : 's'); a1 = plateBtn('rename', 'Rename', A(renameHere)); }
    else if (S.isFolder(sel.n)) { const c = S.flatten(sel.n.items).length; title = sel.n.folder; meta = 'Folder · ' + c + ' ' + kind + (c === 1 ? '' : 's'); a1 = plateBtn('folder', 'Open', A(() => open(sel))); }
    else { const a = p.assets[sel.n] || { name: '?', kind }; title = a.name; meta = metaOf(a); a1 = plateBtn('edit', 'Edit', A(() => open(sel))); }
    const many = app.projects.length > 1;
    const right = `
      <button class="cap acc ell" style="text-align:left" ${many ? A(() => { const i = app.projects.findIndex(q => q.id === p.id); app.ui.project = app.projects[(i + 1) % app.projects.length].id; L.path = { sprites: [], tiles: [], sounds: [] }; L.sel = 0; L.page = 0; app.saveUI(); app.render(); }) + ' aria-label="Switch game"' : 'disabled'}>${esc(p.name)}${many ? ' ›' : ''}</button>
      <span class="title clamp2">${esc(title)}</span>
      <span class="sub">${esc(meta)}</span>
      <div class="actions">${a1}${a2}</div>`;

    const list = pg.slice.map((r, j) => {
      const i = pg.p * rows() + j, on = i === L.sel, act = A(() => (on ? open(r) : pick(i)));
      if (r.back) return row({ art: icon('back', '#fff'), name: fname, meta: 'Back to ' + (path.length > 1 ? 'folder' : cat[1].toLowerCase()), tag: '', selected: on, act });
      if (S.isFolder(r.n)) { const c = S.flatten(r.n.items).length; return row({ art: icon('folder', on ? PINK : '#e4e2dc'), artOff: icon('folder', '#e4e2dc'), name: r.n.folder, meta: c + ' ' + kind + (c === 1 ? '' : 's'), tag: 'Folder', selected: on, act }); }
      const a = p.assets[r.n]; if (!a) return '';
      const used = usesOf(p, r.n);
      return row({ art: artOf(a, on ? PINK : null), artOff: artOf(a, null), name: a.name, meta: metaOf(a), tag: used ? 'Used' : 'Unused', tagColor: on ? PINK : used ? 'var(--muted)' : '#8f8d88', selected: on, act });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        <div role="tablist" aria-label="Asset types" style="display:flex;align-items:center;gap:4px">
          ${CATS.map(c => iconBtn(c[2], A(() => { L.cat = c[0]; L.sel = 0; L.page = 0; app.saveUI(); app.render(); }), { on: c[0] === L.cat, label: c[1], pressed: c[0] === L.cat })).join('')}
          ${iconBtn('folderPlus', A(() => {
            const n = prompt('New folder name', 'New folder'); if (!n || !n.trim()) return;
            const pp = S.loadProject(p.id) || p; pp.library[L.cat] = S.editAt(pp.library[L.cat], path, l => [{ folder: n.trim().slice(0, 20), items: [] }, ...l]);
            S.saveProject(pp); app.refreshProjects(); L.sel = path.length ? 1 : 0; L.page = 0; app.saveUI(); app.render();
          }), { label: 'New folder' })}
        </div>
        ${pager(pg.range, A(() => { L.page = Math.max(0, pg.p - 1); app.saveUI(); app.render(); }), A(() => { L.page = Math.min(pg.pages - 1, pg.p + 1); app.saveUI(); app.render(); }))}
      </div>
      ${list || emptyRow(cat[2], 'No ' + cat[1].toLowerCase() + ' here yet. Add one with New ' + kind + '.')}
    </div>`;
    return { right, body };
  },
  pad(app, input) {
    const p = app.project(); if (!p) return;
    const L = state(app), list0 = rowsOf(p, L), i = L.sel || 0, ci = CATS.findIndex(c => c[0] === L.cat);
    const set = (patch) => { Object.assign(L, patch); app.saveUI(); app.render(); };
    if (input.pressed('down')) set({ sel: Math.min(list0.length - 1, i + 1), page: Math.floor(Math.min(list0.length - 1, i + 1) / rows()) });
    else if (input.pressed('up')) set({ sel: Math.max(0, i - 1), page: Math.floor(Math.max(0, i - 1) / rows()) });
    else if (input.pressed('right')) set({ cat: CATS[(ci + 1) % 3][0], sel: 0, page: 0 });
    else if (input.pressed('left')) set({ cat: CATS[(ci + 2) % 3][0], sel: 0, page: 0 });
    else if (input.pressed('b') && L.path[L.cat].length) set({ sel: 0, page: 0, path: { ...L.path, [L.cat]: L.path[L.cat].slice(0, -1) } });
    else if (input.pressed('a')) { const r = list0[i]; if (!r) return; if (r.back) set({ sel: 0, page: 0, path: { ...L.path, [L.cat]: L.path[L.cat].slice(0, -1) } }); else if (S.isFolder(r.n)) set({ sel: 0, page: 0, path: { ...L.path, [L.cat]: L.path[L.cat].concat([r.i]) } }); else openAsset(app, p.id, r.n); }
  }
};

// ---------------------------------------------------------------- asset editor: pixels for sprites and tiles, a synth for sounds
export function openAsset(app, projectId, id) {
  const p = S.loadProject(projectId); if (!p || !p.assets[id]) return;
  const a = p.assets[id], cat = a.kind + 's';
  let tool = 'draw', hist = [], fut = [], view = null, saveT = null, stroke = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => S.saveProject(p), 200); };
  const snap = () => { hist.push(JSON.stringify(a)); if (hist.length > 60) hist.shift(); fut = []; };
  const change = (fn) => { snap(); fn(); save(); app.render(); };
  const restore = (from, to) => { if (!from.length) return; to.push(JSON.stringify(a)); Object.assign(a, JSON.parse(from.pop())); save(); app.render(); };
  const row2 = (label, control) => `<div class="irow"><span class="cap" style="color:var(--muted)">${esc(label)}</span>${control}</div>`;
  const cyc = (label, list, cur, fmt, set) => { const i = Math.max(0, list.indexOf(cur)); return row2(label, stepper(fmt(cur), A(() => change(() => set(list[(i - 1 + list.length) % list.length]))), A(() => change(() => set(list[(i + 1) % list.length]))), label, true)); };
  const num = (label, k, min, max) => row2(label, stepper(String(a[k]), A(() => change(() => { a[k] = Math.max(min, a[k] - 1); })), A(() => change(() => { a[k] = Math.min(max, a[k] + 1); })), label));

  function drawPixels() {
    const c = view.getContext('2d'), w = view.width, cell = w / 8, gap = Math.max(1, Math.round(cell * 0.06));
    c.fillStyle = '#000'; c.fillRect(0, 0, w, w);
    c.fillStyle = '#141417';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c.fillRect(Math.round(x * cell) + gap, Math.round(y * cell) + gap, Math.round(cell) - gap * 2, Math.round(cell) - gap * 2);
    c.fillStyle = col(a.color);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (a.px[y][x] === '1') c.fillRect(Math.round(x * cell) + gap, Math.round(y * cell) + gap, Math.round(cell) - gap * 2, Math.round(cell) - gap * 2);
  }
  function drawSound() {
    // the pitch over time, as pixels on a 64 x 36 screen
    const c = view.getContext('2d'), W = 64, H = 36, s = view.width / W;
    c.fillStyle = '#000'; c.fillRect(0, 0, view.width, view.height);
    const len = 0.05 + a.len * 0.06, f0 = 110 * Math.pow(2, a.pitch * 0.5), f1 = f0 * Math.pow(2, a.slide * 0.25), cols = Math.max(4, Math.round(W * len / 0.6));
    const fy = (f) => Math.round(H - 4 - (Math.log2(Math.max(30, f) / 55) / 8) * (H - 8));
    c.fillStyle = '#1c1c20'; for (let x = 0; x < W; x += 2) c.fillRect(x * s, (H - 3) * s, s, s);
    for (let x = 0; x < cols; x++) {
      const t = x / Math.max(1, cols - 1), f = f0 * Math.pow(f1 / f0, t), y = fy(f), vol = 1 - t * 0.85;
      c.fillStyle = PINK; c.globalAlpha = 0.35 + vol * 0.65;
      if (a.wave === 'noise') { for (let k = 0; k < 3; k++) c.fillRect(x * s, (y + ((x * 7 + k * 5) % 5) - 2) * s, s * 0.9, s * 0.9); }
      else c.fillRect(x * s, y * s, s * 0.9, s * 0.9);
    }
    c.globalAlpha = 1;
  }
  const cellOf = (e) => { const r = view.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) / r.width * 8), y: Math.floor((e.clientY - r.top) / r.height * 8) }; };
  const setPx = (x, y, v) => { if (x < 0 || y < 0 || x > 7 || y > 7) return; const r = a.px[y]; a.px[y] = r.slice(0, x) + v + r.slice(x + 1); };
  function fill(x, y) {
    const target = a.px[y][x], v = '1'; if (target === v) return;
    const q = [[x, y]];
    while (q.length) { const [cx, cy] = q.pop(); if (cx < 0 || cy < 0 || cx > 7 || cy > 7 || a.px[cy][cx] !== target) continue; setPx(cx, cy, v); q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); }
  }
  function down(e) {
    if (a.kind === 'sound') { snd.play(a); return; }
    e.preventDefault(); view.setPointerCapture(e.pointerId);
    const c = cellOf(e); snap();
    if (tool === 'fill') { fill(c.x, c.y); save(); app.render(); return; }
    // a stroke paints or erases, starting from what you touched: tap a lit pixel with Draw to turn it off
    const v = tool === 'erase' ? '0' : (a.px[c.y][c.x] === '1' ? '0' : '1');
    stroke = { v, last: c.x + ',' + c.y }; setPx(c.x, c.y, v); drawPixels();
  }
  function move(e) { if (!stroke) return; const c = cellOf(e), k = c.x + ',' + c.y; if (k === stroke.last) return; stroke.last = k; setPx(c.x, c.y, stroke.v); drawPixels(); }
  function up() { if (stroke) { stroke = null; save(); app.render(); } }

  const ov = {
    render() {
      const folders = foldersOf(p.library[cat]), here = (S.pathOf(p.library[cat], id) || []).join('.');
      const curF = folders.find(f => f.path.join('.') === here) || folders[0];
      const folderRow = folders.length > 1 ? cyc('Folder', folders, curF, f => f.name.split(' / ').pop(), f => { p.library[cat] = moveTo(p.library[cat], id, f.path); }) : '';
      const used = usesOf(p, id);
      let fields = '';
      if (a.kind === 'sprite') fields = cyc('Color', PALETTE_NAMES, a.color, c => c, c => { a.color = c; }) + cyc('Role', ROLES, a.role || 'decor', r => ROLE_NAMES[r], r => { a.role = r; }) + folderRow
        + row2('Used', `<span class="sub" style="color:var(--text);margin-right:6px">${used ? used + (used === 1 ? ' place' : ' places') : 'Not placed yet'}</span>`);
      else if (a.kind === 'tile') fields = cyc('Color', PALETTE_NAMES, a.color, c => c, c => { a.color = c; }) + cyc('Type', TILE_TYPES.map(t => t[0]), tileType(a), t => TILE_TYPES.find(x => x[0] === t)[1], t => setTileType(a, t)) + folderRow
        + row2('Used', `<span class="sub" style="color:var(--text);margin-right:6px">${used ? used + (used === 1 ? ' tile' : ' tiles') + ' painted' : 'Not painted yet'}</span>`);
      else fields = cyc('Wave', WAVES, a.wave, w => w, w => { a.wave = w; }) + num('Pitch', 'pitch', 0, 9) + num('Slide', 'slide', -4, 4) + num('Length', 'len', 1, 9) + folderRow;
      const isPx = a.kind !== 'sound';
      return `<div class="screen-tool" style="--acc:${PINK}">
        <h1 class="sr">Library · ${esc(a.name)}</h1>
        <div class="plate bar">
          ${iconBtn('back', A(() => { S.saveProject(p); app.close(); }), { color: '#fff', label: 'Back to Library' })}
          <button ${A(() => { const n = prompt('Name', a.name); if (n && n.trim()) change(() => { a.name = n.trim().slice(0, 20); }); })} style="flex:1;min-width:0;display:flex;flex-direction:column;text-align:left" aria-label="Rename">
            <span class="title ell">${esc(a.name)}</span><span class="sub">${esc((a.kind === 'sprite' ? 'Sprite' : a.kind === 'tile' ? 'Tile' : 'Sound') + ' · ' + p.name)}</span></button>
          ${iconBtn('dup', A(() => {
            const nid = id.slice(0, 3) + S.uid(''); p.assets[nid] = { ...structuredClone(a), name: (a.name + ' 2').slice(0, 20) };
            const pth = S.pathOf(p.library[cat], id) || []; p.library[cat] = S.editAt(p.library[cat], pth, l => { const i = l.indexOf(id); return [...l.slice(0, i + 1), nid, ...l.slice(i + 1)]; });
            S.saveProject(p); app.toast('Copied ' + a.name); app.overlay = null; openAsset(app, p.id, nid);
          }), { label: 'Duplicate' })}
          ${iconBtn('trash', A(() => {
            const n = usesOf(p, id);
            if (a.kind === 'sprite' && a.role === 'player' && S.flatten(p.library.sprites).filter(x => (p.assets[x] || {}).role === 'player').length === 1 && !confirm('This is the only player sprite. Delete it anyway? Your game needs a player to play.')) return;
            if (!confirm(n ? `${a.name} is used in ${n} ${n === 1 ? 'place' : 'places'}. Delete it and remove it from your scenes and events?` : `Delete ${a.name}?`)) return;
            deleteAsset(p, id); S.saveProject(p); app.toast('Deleted ' + a.name); app.close();
          }), { label: 'Delete' })}
        </div>
        <div class="screen fit gap20" style="${isPx ? '' : 'flex-basis:192px;height:192px'}">
          <canvas class="pix" id="ped" style="aspect-ratio:${isPx ? '1/1' : '16/9'}" aria-label="${isPx ? 'Pixel editor, 8 by 8' : 'Sound shape. Tap to play.'}" role="img"></canvas>
        </div>
        <div class="plate bar" role="toolbar" aria-label="Tools">
          ${isPx ? `<div style="display:flex;gap:6px">${[['draw', 'Draw'], ['erase', 'Erase'], ['fill', 'Fill']].map(([k, l]) => iconBtn(k === 'draw' ? 'paint' : k, A(() => { tool = k; app.render(); }), { on: tool === k, label: l, pressed: tool === k })).join('')}
              ${iconBtn('reset', A(() => change(() => { a.px = [...S.BLANK8]; })), { label: 'Clear' })}</div>`
            : bareBtn('play', 'Play', A(() => snd.play(a)))}
          <div style="display:flex;gap:6px">${iconBtn('undo', A(() => restore(hist, fut)), { color: hist.length ? '#fff' : '#555', label: 'Undo' })}${iconBtn('redo', A(() => restore(fut, hist)), { color: fut.length ? '#fff' : '#555', label: 'Redo' })}</div>
        </div>
        <div class="plate inspector gap20" style="overflow-y:auto">${fields}</div>
      </div>`;
    },
    mount(root) {
      view = root.querySelector('#ped');
      const dpr = window.devicePixelRatio || 1, r = view.getBoundingClientRect();
      view.width = Math.round(r.width * dpr); view.height = Math.round(r.height * dpr);
      view.addEventListener('pointerdown', down); view.addEventListener('pointermove', move);
      view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
      if (a.kind === 'sound') drawSound(); else drawPixels();
    },
    frame() {
      if (input.pressed('b')) { S.saveProject(p); app.close(); }
      else if (a.kind === 'sound' && input.pressed('a')) snd.play(a);
    },
    onClose() { clearTimeout(saveT); S.saveProject(p); }
  };
  app.open(ov);
}
