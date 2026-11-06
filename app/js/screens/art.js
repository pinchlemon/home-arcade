// Art: the current game's pictures, in folders (from its studio.json "art" list), plus the pixel symbols
// its objects use. Tap one to select it, tap again to draw on it (spriteEditor.js); View shows it big and plays
// sprite sheets. + adds a new sprite to the folder. Pictures drawn on the phone show here before they are pushed.
// Controller: D-pad picks, left and right switch folders, A views.
import { well, icon, svgRows, svgText } from '../pixel.js';
import { A, esc, row, pager, plateBtn, iconBtn, pageOf, emptyRow, rows, stepper } from '../ui.js';
import * as games from '../games.js';
import { notReady } from './studio.js';
import { openGameEditor } from './gameEditor.js';
import * as input from '../input.js';
import { makeNav, padFrame } from '../padnav.js';
import * as store from '../artStore.js';
import { openSpriteEditor } from './spriteEditor.js';
import { readAse } from '../ase.js';

const PINK = '#ff4fd8';
const loaded = {}, sizes = {};
function load(app, g) {
  if (!loaded[g.file]) {
    loaded[g.file] = 'loading';
    games.loadGame(g.file).then(x => { loaded[g.file] = x; if (!app.overlay) app.render(); }).catch(() => { loaded[g.file] = null; });
  }
  const x = loaded[g.file]; return x && x !== 'loading' ? x : null;
}
// the picture's address: the phone's copy when it was drawn here, else the site's file
const looking = {};
function src(g, it, app) {
  const r = store.record(g.file, it.id);
  if (!r) return `../${g.file}/${it.file}`;
  const u = store.cachedUrl(g.file, it.file), k = g.file + '/' + it.file + '@' + r.edited;
  if (u && looking[k] === 'done') return u;
  if (!looking[k]) { looking[k] = 'busy'; store.urlFor(g.file, it.file).then(() => { looking[k] = 'done'; delete sizes[g.file + '/' + it.file]; if (app && !app.overlay) app.render(); }); }
  return u || `../${g.file}/${it.file}`;
}
store.load().then(() => { store.tidy(); });
// the picture's size, once it has loaded (the rows say … until then)
function sizeOf(app, g, it) {
  const k = g.file + '/' + it.file, url = src(g, it, app);
  if (!sizes[k]) {
    sizes[k] = 'loading';
    const im = new Image(); im.onload = () => { sizes[k] = [im.naturalWidth, im.naturalHeight]; if (!app.overlay) app.render(); }; im.src = url;
  }
  return Array.isArray(sizes[k]) ? sizes[k] : null;
}

// every folder: the game's own, then Symbols (the simple pixel shapes objects are drawn with in the Studio)
function folders(app, g) {
  const x = load(app, g); if (!x) return null;
  const D = games.applyOverrides(x.data, games.getEdits(g.file).overrides), objs = D.objects || {};
  const out = ((x.schema.art || {}).folders || []).map(f => ({ ...f, items: f.items.map(it => ({ ...it, kind: 'image' })) }));
  // new sprites drawn on this phone, not pushed yet
  for (const r of store.forGame(g.file)) {
    if (!r.item || out.some(f => f.items.some(it => it.id === r.itemId))) continue;
    let f = out.find(f => f.id === r.folder); if (!f) out.push(f = { id: r.folder, name: r.folder[0].toUpperCase() + r.folder.slice(1), items: [] });
    f.items.push({ ...r.item, kind: 'image', fresh: true });
  }
  const used = {};
  for (const o of Object.values(objs)) if (o.symbol && x.symbols[o.symbol]) (used[o.symbol] = used[o.symbol] || []).push(o.name);
  out.push({ id: 'symbols', name: 'Symbols', items: Object.keys(x.symbols).map(k => ({ id: 'sym:' + k, kind: 'symbol', name: k[0].toUpperCase() + k.slice(1), rows: x.symbols[k], used: used[k] || [], help: used[k] ? 'Used by ' + used[k].join(', ') : 'Not used yet' })) });
  return { list: out, data: D, game: x };
}
const FOLDER_ICON = { player: 'sprites', props: 'objects', backdrop: 'display', symbols: 'grid' };

function thumb(g, it, size, color, app) {
  if (it.kind === 'symbol') return svgRows(it.rows, color || '#e4e2dc', 3);
  const s = size, cw = it.cell ? it.cell[0] : s && s[0], ch = it.cell ? it.cell[1] : s && s[1];
  if (!cw) return '';
  // small enough that its corners stay inside the round well (on the sprite background from Settings)
  const k = Math.min(32 / Math.hypot(cw, ch), 4), W = s ? s[0] : cw, H = s ? s[1] : ch;
  return `<span class="thumbbg"><span class="thumb" style="width:${Math.round(cw * k)}px;height:${Math.round(ch * k)}px;background-image:url('${src(g, it, app)}');background-size:${W * k}px ${H * k}px"></span></span>`;
}
const meta = (it, s, g) => {
  if (it.kind === 'symbol') return '8×8 symbol · ' + it.help;
  const r = g && store.record(g.file, it.id), mark = r && r.dirty ? (it.fresh ? ' · new, not pushed' : ' · drawn here, not pushed') : '';
  return (it.cell ? it.cell[0] + '×' + it.cell[1] + ' · ' + it.frames + ' frames' : s ? s[0] + '×' + s[1] + ' px' : '…') + mark + ' · ' + it.help;
};

// where to adjust how it's used: its object, its backdrop layer, or the game's settings
function jump(app, g, it) {
  if (it.object) { app.ui.geTab = 'objects'; app.ui.geObj = it.object; }
  else if (it.layer) { app.ui.geTab = 'background'; app.ui.geLayer = it.layer; }
  else if (it.kind === 'symbol') app.ui.geTab = 'objects';
  else app.ui.geTab = 'settings';
  app.saveUI(); openGameEditor(app, g);
}

function state(app) {
  const g = games.currentGame(app); if (!g || !g.editable) return { g, off: true };
  const F = folders(app, g); if (!F) return { g };
  let fi = Math.max(0, F.list.findIndex(f => f.id === app.ui.artFolder)); if (fi < 0) fi = 0;
  const f = F.list[fi], si = Math.max(0, Math.min(f.items.length - 1, f.items.findIndex(it => it.id === app.ui.artSel)));
  return { g, F, fi, f, si, it: f.items[si] };
}
function setFolder(app, fi) { const F = state(app).F; const f = F.list[(fi + F.list.length) % F.list.length]; app.ui.artFolder = f.id; app.ui.artSel = f.items[0] && f.items[0].id; app.saveUI(); app.render(); }
function setSel(app, i) { const s = state(app); const it = s.f.items[Math.max(0, Math.min(s.f.items.length - 1, i))]; if (it) { app.ui.artSel = it.id; app.saveUI(); app.render(); } }

export default {
  render(app) {
    const s = state(app);
    if (s.off) return notReady(app, s.g, 'sprites', 'Art');
    if (!s.F) return { right: `<span class="cap acc">Art</span><span class="title clamp2">${esc(s.g.name)}</span><span class="sub">Loading…</span>`, body: `<div class="group">${emptyRow('sprites', 'Loading the art…')}</div>` };
    const { g, F, fi, f, si, it } = s, size = it && it.kind === 'image' ? sizeOf(app, g, it) : null;
    const right = it ? `
      <span class="cap acc ell">${esc(g.name)}</span>
      <span class="title clamp2">${esc(it.name)}</span>
      <span class="sub clamp2" style="white-space:normal">${esc(f.name + ' · ' + meta(it, size, g))}</span>
      <div class="actions">
        ${it.kind === 'symbol' ? plateBtn('select', 'View', A(() => openViewer(app, g, it, F))) : plateBtn('paint', 'Draw', A(() => openDraw(app, g, it, F)))}
        ${it.kind === 'symbol' ? plateBtn('edit', 'Objects', A(() => jump(app, g, it))) : plateBtn(it.cell ? 'play' : 'select', it.cell ? 'Animate' : 'View', A(() => openViewer(app, g, it, F)))}
      </div>` : `<span class="cap acc">${esc(g.name)}</span><span class="title clamp2">${esc(f.name)}</span><span class="sub">Empty folder</span>`;
    const per = rows(), pg = pageOf(f.items, Math.floor(si / per));
    const rowHtml = pg.slice.map((x, j) => {
      const i = pg.p * per + j, on = i === si, sz = x.kind === 'image' ? sizeOf(app, g, x) : null;
      return row({ art: thumb(g, x, sz, on ? PINK : null, app), artOff: x.kind === 'symbol' ? thumb(g, x, sz) : null, name: x.name, meta: meta(x, sz, g), tag: on ? (x.kind === 'symbol' ? 'View' : 'Draw') : x.kind === 'symbol' ? 'Symbol' : x.cell ? 'Sheet' : 'PNG', selected: on,
        act: A(() => (!on ? setSel(app, i) : x.kind === 'symbol' ? openViewer(app, g, x, F) : openDraw(app, g, x, F))) });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        <div role="tablist" aria-label="Folders" style="display:flex;align-items:center;gap:4px">
          ${F.list.map((x, k) => iconBtn(FOLDER_ICON[x.id] || 'folder', A(() => setFolder(app, k)), { on: k === fi, label: x.name, pressed: k === fi })).join('')}
        </div>
        ${f.id !== 'symbols' ? iconBtn('plus', A(() => openNew(app, g, f)), { color: '#fff', label: 'New sprite in ' + f.name }) : ''}
        ${pager(pg.range, A(() => setSel(app, Math.max(0, pg.p - 1) * per)), A(() => setSel(app, Math.min(pg.pages - 1, pg.p + 1) * per)))}
      </div>
      ${rowHtml || emptyRow('folder', 'Nothing in this folder yet.')}
    </div>`;
    return { right, body };
  },
  pad(app, input) {
    const s = state(app); if (!s || s.off || !s.F) return;
    if (input.pressed('down')) setSel(app, s.si + 1);
    else if (input.pressed('up')) setSel(app, s.si - 1);
    else if (input.pressed('right')) setFolder(app, s.fi + 1);
    else if (input.pressed('left')) setFolder(app, s.fi - 1);
    else if (input.pressed('a') && s.it) openViewer(app, s.g, s.it, s.F);
  }
};

// ---------------------------------------------------------------- the viewer: big, crisp pixels; sheets animate
function openViewer(app, g, it, F) {
  const v = { scale: 0, fit: 1, anim: 0, frame: 0, playing: true, img: null, t: 0 };
  let cv = null, ctx2 = null, last = 0;
  const nav = makeNav();
  const anims = it.anims || [];
  const ticks = (a) => (typeof a.ticks === 'string' ? +games.getPath(F.data, a.ticks) : a.ticks) || 8;
  if (it.kind === 'image') { v.img = new Image(); v.img.onload = () => draw(); v.img.src = src(g, it, app); }
  function draw() {
    if (!cv) return;
    const W = cv.width, H = cv.height; ctx2.clearRect(0, 0, W, H); ctx2.imageSmoothingEnabled = false;
    let sw, sh, sx = 0, sy = 0;
    if (it.kind === 'symbol') { sw = 8; sh = 8; }
    else { if (!v.img || !v.img.complete || !v.img.naturalWidth) return; sw = it.cell ? it.cell[0] : v.img.naturalWidth; sh = it.cell ? it.cell[1] : v.img.naturalHeight; }
    if (it.cell) { const a = anims[v.anim], n = a ? a.from + (v.frame % a.count) : v.frame, cols = Math.floor(v.img.naturalWidth / sw); sx = (n % cols) * sw; sy = Math.floor(n / cols) * sh; }
    const fit = Math.max(1, Math.floor(Math.min(W / sw, H / sh))), k = v.scale ? Math.min(v.scale, fit) : fit; v.fit = fit; v.k = k;
    const dx = Math.round((W - sw * k) / 2), dy = Math.round((H - sh * k) / 2);
    if (it.kind === 'symbol') { ctx2.fillStyle = PINK; it.rows.forEach((r, y) => { for (let x = 0; x < 8; x++) if (r[x] === '1') ctx2.fillRect(dx + x * k, dy + y * k, k - Math.max(1, k >> 4), k - Math.max(1, k >> 4)); }); }
    else ctx2.drawImage(v.img, sx, sy, sw, sh, dx, dy, sw * k, sh * k);
  }
  const rer = () => { if (app.overlay === ov) app.render(); };
  const ov = {
    render() {
      const a = anims[v.anim];
      let panel = '';
      if (it.cell) {
        panel = `<div class="plate inspector gap20">
          <div class="ihead">${well(40, icon('sprites', PINK))}<span class="t"><span class="title acc ell">${esc(a ? a.name : 'Frames')}</span><span class="sub">${a ? a.count + ' frames · ' + ticks(a) + ' game frames each' : ''}</span></span>
            ${iconBtn(v.playing ? 'pause' : 'play', A(() => { v.playing = !v.playing; rer(); }), { color: '#fff', label: v.playing ? 'Pause' : 'Play' })}</div>
          <div class="grow"><span class="t"><span class="cap">Animation</span><span class="sub">Runs of frames the game plays</span></span>${stepper(String(v.anim + 1) + '/' + anims.length, A(() => { v.anim = (v.anim + anims.length - 1) % anims.length; v.frame = 0; rer(); }), A(() => { v.anim = (v.anim + 1) % anims.length; v.frame = 0; rer(); }), 'Animation')}</div>
          <div class="grow"><span class="t"><span class="cap">Frame</span><span class="sub">Step through one at a time</span></span>${stepper(String((v.frame % (a ? a.count : 1)) + 1), A(() => { v.playing = false; v.frame = (v.frame + (a ? a.count : 1) - 1) % (a ? a.count : 1); rer(); }), A(() => { v.playing = false; v.frame = (v.frame + 1) % (a ? a.count : 1); rer(); }), 'Frame')}</div>
        </div>`;
      } else {
        panel = `<div class="plate inspector gap20">
          <div class="grow"><span class="t"><span class="cap">Zoom</span><span class="sub">Screen pixels per art pixel</span></span>${stepper((v.k || v.fit) + '×', A(() => { v.scale = Math.max(1, (v.k || v.fit) - 1); draw(); rer(); }), A(() => { v.scale = Math.min(v.fit, (v.k || v.fit) + 1); draw(); rer(); }), 'Zoom')}</div>
          <div class="grow"><span class="t"><span class="cap">${esc(it.kind === 'symbol' ? 'Symbol' : 'Picture')}</span><span class="sub" style="white-space:normal">${esc(it.help)}. Drawing on it comes with the pixel editor.</span></span></div>
        </div>`;
      }
      return `<div class="screen-tool" style="--acc:${PINK}">
        <h1 class="sr">Art · ${esc(it.name)}</h1>
        <div class="plate bar">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back to Art' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">${esc(it.name)}</span><span class="sub">${esc(g.name)} · ${esc(it.kind === 'symbol' ? '8×8 symbol' : it.file)}</span></span>
          ${iconBtn('edit', A(() => { app.close(); jump(app, g, it); }), { color: '#fff', label: 'Where it is used' })}
        </div>
        <div class="screen fit gap20 checker"><canvas class="pix" id="artv" role="img" aria-label="${esc(it.name)}, drawn big"></canvas></div>
        ${panel}
      </div>`;
    },
    mount(root) {
      cv = root.querySelector('#artv'); ctx2 = cv.getContext('2d');
      const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.style.width = (r.width - 16) + 'px'; cv.style.height = (r.height - 16) + 'px';
      cv.width = Math.round((r.width - 16) * dpr); cv.height = Math.round((r.height - 16) * dpr);
      draw(); if (!it.cell && v.k) { const el = root.querySelector('.stepper .vscreen'); if (el) el.innerHTML = svgText(v.k + '×', 'var(--acc)'); }
    },
    frame(t) {
      if (it.cell && v.playing && anims[v.anim]) {
        const step = ticks(anims[v.anim]) / 60;
        if (t - last >= step) { last = t; v.frame = (v.frame + 1) % anims[v.anim].count; draw(); const el = document.querySelectorAll('.screen-tool .stepper .vscreen')[1]; if (el) el.innerHTML = svgText(String(v.frame + 1), 'var(--acc)'); }
      }
      if (input.pressed('b')) app.close();
      else if (padFrame(document.getElementById('app'), nav, input)) { /* the ring took it */ }
      else if (it.cell && input.pressed('a')) { v.playing = !v.playing; rer(); }
    }
  };
  app.open(ov);
}

// ---------------------------------------------------------------- drawing
// open a picture in the sprite editor (a sprite sheet keeps its layout in the PNG: as many frames across as before)
async function openDraw(app, g, it, F) {
  const ticks = (a) => (typeof a.ticks === 'string' ? +games.getPath(F.data, a.ticks) : a.ticks) || 8;
  const r = store.record(g.file, it.id);
  let cols = (r && r.sheetCols) || 0;
  // a sheet must be saved with as many frames across as the game expects, so measure the picture first
  if (it.cell && !cols && !(r && r.item)) {
    const k = g.file + '/' + it.file, url = await store.urlFor(g.file, it.file);
    const w = Array.isArray(sizes[k]) ? sizes[k][0] : await new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = url; });
    cols = w ? Math.max(1, Math.floor(w / it.cell[0])) : 0;
    if (!cols) { app.toast('Could not open ' + it.name + ' (its picture did not load)'); return; }
  }
  openSpriteEditor(app, g, it, { ticksOf: ticks, sheetCols: cols, extra: r && r.item ? { isNew: r.isNew, folder: r.folder, item: r.item } : undefined });
}

// a new sprite in a folder: name, size, and whether it is animated (a sprite sheet)
const SIZES = [8, 12, 16, 24, 32, 48, 64, 96, 128, 256];
function openNew(app, g, f) {
  const v = { name: '', w: 32, h: 32, sheet: false };
  const nav = makeNav(), rer = () => { if (app.overlay === ov) app.render(); };
  const bump = (k, d) => { const i = SIZES.indexOf(v[k]); v[k] = SIZES[Math.max(0, Math.min(SIZES.length - 1, (i < 0 ? 4 : i) + d))]; rer(); };
  function create(spr, fileName) {
    spr = spr && spr.cels ? spr : null;
    const name = (v.name || '').trim() || (fileName ? fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase()) : 'Sprite');
    const x = folders(app, g), taken = new Set(x ? x.list.flatMap(ff => ff.items.map(it => it.id)) : []);
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sprite', id = slug, n = 2;
    while (taken.has(id)) id = slug + '-' + n++;
    const item = { id, name, file: 'assets/' + id + '.png', help: fileName ? 'From ' + fileName : 'Drawn on the phone' };
    if (v.sheet || (spr && spr.frames.length > 1)) { item.cell = [spr ? spr.w : v.w, spr ? spr.h : v.h]; item.frames = spr ? spr.frames.length : 1; item.anims = []; }
    app.ui.artFolder = f.id; app.ui.artSel = id; app.saveUI();
    app.close();
    openSpriteEditor(app, g, item, { spr: spr || store.blankSprite(v.w, v.h), extra: { isNew: true, folder: f.id, item } });
  }
  // start from a file: an .aseprite as it is; a picture as one frame, or (Animated on) cut into frames of the size set above
  async function fromFile(file) {
    if (!file) return;
    try {
      let spr;
      if (/\.(aseprite|ase)$/i.test(file.name)) spr = await readAse(await file.arrayBuffer());
      else {
        const url = URL.createObjectURL(file), img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('not a picture')); im.src = url; });
        const cut = v.sheet && img.naturalWidth % v.w === 0 && img.naturalHeight % v.h === 0 && (img.naturalWidth > v.w || img.naturalHeight > v.h);
        if (v.sheet && !cut) app.toast('The picture is not a whole number of ' + v.w + '×' + v.h + ' frames, so it comes in as one frame');
        spr = store.spriteFromImage(img, cut ? { cell: [v.w, v.h] } : {});
        if (cut) { // leave out empty frames at the end
          while (spr.frames.length > 1 && ![...spr.cels.keys()].some(k => +k.split(':')[1] === spr.frames.length - 1)) spr.frames.pop();
        }
        URL.revokeObjectURL(url);
      }
      create(spr, file.name);
    } catch (e) { app.toast('Could not open ' + file.name + ': ' + (e.message || e)); }
  }
  const ov = {
    render() {
      return `<div class="screen-tool" style="--acc:${PINK}">
        <h1 class="sr">New sprite</h1>
        <div class="plate bar">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back to Art' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">New sprite</span><span class="sub ell">${esc(g.name)} · ${esc(f.name)}</span></span>
        </div>
        <div class="screen nw-prev" aria-hidden="true">${(() => { const k = Math.max(1, Math.min(8, Math.floor(Math.min(300 / v.w, 200 / v.h)))); return `<div class="nw-box" style="width:${v.w * k}px;height:${v.h * k}px;--px:${k * 2}px"></div><span class="sub">${v.w}×${v.h}${v.sheet ? ' · animated' : ''} · shown ${k}× · each square is 2×2 pixels</span>`; })()}</div>
        <div class="plate inspector" style="flex:none">
          <label class="se-field"><span class="cap">Name</span><input id="nw-name" value="${esc(v.name)}" placeholder="Sprite" maxlength="40" autocomplete="off" spellcheck="false"></label>
          <div class="grow"><span class="t"><span class="cap">Width</span><span class="sub">Pixels across</span></span>${stepper(String(v.w), A(() => bump('w', -1)), A(() => bump('w', 1)), 'width')}</div>
          <div class="grow"><span class="t"><span class="cap">Height</span><span class="sub">Pixels down</span></span>${stepper(String(v.h), A(() => bump('h', -1)), A(() => bump('h', 1)), 'height')}</div>
          <div class="grow"><span class="t"><span class="cap">Animated</span><span class="sub" style="white-space:normal">A sprite sheet: its frames are saved side by side</span></span>${toggleBtn(v.sheet, A(() => { v.sheet = !v.sheet; rer(); }))}</div>
        </div>
        <div class="plate bar" style="gap:8px">${plateBtn('plus', 'Create', A(() => create()))}
          <label class="plate btn se-file" style="flex:1">${well(28, icon('down', '#fff'))}<span>Open a file</span><input type="file" id="nw-file" accept="image/png,image/gif,image/jpeg,image/webp,.aseprite,.ase"></label></div>
      </div>`;
    },
    mount(root) {
      const i = root.querySelector('#nw-name'); if (i) i.addEventListener('input', () => { v.name = i.value; });
      const fi = root.querySelector('#nw-file'); if (fi) fi.addEventListener('change', () => { const f = fi.files && fi.files[0]; fi.value = ''; fromFile(f); });
    },
    frame() { if (input.pressed('b')) app.close(); else padFrame(document.getElementById('app'), nav, input); }
  };
  app.open(ov);
}
const toggleBtn = (on, act) => `<button class="vscreen" role="switch" aria-checked="${on}" aria-label="Animated" ${act} style="margin-right:6px">${svgText(on ? 'ON' : 'OFF', on ? 'var(--acc)' : '#6f6d69')}</button>`;
