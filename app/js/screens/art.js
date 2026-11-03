// Art: the current game's pictures, in folders (from its studio.json "art" list), plus the pixel symbols
// its objects use. Tap one to select it, tap again to view it big; sprite sheets play their animations.
// Drawing on them comes with the pixel and animation editor. Controller: D-pad picks, left and right
// switch folders, A views.
import { well, icon, svgRows, svgText } from '../pixel.js';
import { A, esc, row, pager, plateBtn, iconBtn, pageOf, emptyRow, rows, stepper } from '../ui.js';
import * as games from '../games.js';
import { notReady } from './studio.js';
import { openGameEditor } from './gameEditor.js';
import * as input from '../input.js';
import { makeNav, padFrame } from '../padnav.js';

const PINK = '#ff4fd8';
const loaded = {}, sizes = {};
function load(app, g) {
  if (!loaded[g.file]) {
    loaded[g.file] = 'loading';
    games.loadGame(g.file).then(x => { loaded[g.file] = x; if (!app.overlay) app.render(); }).catch(() => { loaded[g.file] = null; });
  }
  const x = loaded[g.file]; return x && x !== 'loading' ? x : null;
}
const src = (g, it) => `../${g.file}/${it.file}`;
// the picture's size, once it has loaded (the rows say … until then)
function sizeOf(app, g, it) {
  const k = src(g, it);
  if (!sizes[k]) {
    sizes[k] = 'loading';
    const im = new Image(); im.onload = () => { sizes[k] = [im.naturalWidth, im.naturalHeight]; if (!app.overlay) app.render(); }; im.src = k;
  }
  return Array.isArray(sizes[k]) ? sizes[k] : null;
}

// every folder: the game's own, then Symbols (the simple pixel shapes objects are drawn with in the Studio)
function folders(app, g) {
  const x = load(app, g); if (!x) return null;
  const D = games.applyOverrides(x.data, games.getEdits(g.file).overrides), objs = D.objects || {};
  const out = ((x.schema.art || {}).folders || []).map(f => ({ ...f, items: f.items.map(it => ({ ...it, kind: 'image' })) }));
  const used = {};
  for (const o of Object.values(objs)) if (o.symbol && x.symbols[o.symbol]) (used[o.symbol] = used[o.symbol] || []).push(o.name);
  out.push({ id: 'symbols', name: 'Symbols', items: Object.keys(x.symbols).map(k => ({ id: 'sym:' + k, kind: 'symbol', name: k[0].toUpperCase() + k.slice(1), rows: x.symbols[k], used: used[k] || [], help: used[k] ? 'Used by ' + used[k].join(', ') : 'Not used yet' })) });
  return { list: out, data: D, game: x };
}
const FOLDER_ICON = { player: 'sprites', props: 'objects', backdrop: 'display', symbols: 'grid' };

function thumb(g, it, size, color) {
  if (it.kind === 'symbol') return svgRows(it.rows, color || '#e4e2dc', 3);
  const s = size, cw = it.cell ? it.cell[0] : s && s[0], ch = it.cell ? it.cell[1] : s && s[1];
  if (!cw) return '';
  // small enough that its corners stay inside the round well (on the sprite background from Settings)
  const k = Math.min(32 / Math.hypot(cw, ch), 4), W = s ? s[0] : cw, H = s ? s[1] : ch;
  return `<span class="thumbbg"><span class="thumb" style="width:${Math.round(cw * k)}px;height:${Math.round(ch * k)}px;background-image:url('${src(g, it)}');background-size:${W * k}px ${H * k}px"></span></span>`;
}
const meta = (it, s) => it.kind === 'symbol' ? '8×8 symbol · ' + it.help : (s ? s[0] + '×' + s[1] + ' px' : '…') + (it.cell ? ' · ' + it.frames + ' frames' : '') + ' · ' + it.help;

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
      <span class="sub clamp2" style="white-space:normal">${esc(f.name + ' · ' + meta(it, size))}</span>
      <div class="actions">
        ${plateBtn(it.cell ? 'play' : 'select', it.cell ? 'Animate' : 'View', A(() => openViewer(app, g, it, F)))}
        ${plateBtn('edit', it.object ? 'Object' : it.kind === 'symbol' ? 'Objects' : it.layer ? 'Layer' : 'Settings', A(() => jump(app, g, it)))}
      </div>` : `<span class="cap acc">${esc(g.name)}</span><span class="title clamp2">${esc(f.name)}</span><span class="sub">Empty folder</span>`;
    const per = rows(), pg = pageOf(f.items, Math.floor(si / per));
    const rowHtml = pg.slice.map((x, j) => {
      const i = pg.p * per + j, on = i === si, sz = x.kind === 'image' ? sizeOf(app, g, x) : null;
      return row({ art: thumb(g, x, sz, on ? PINK : null), artOff: x.kind === 'symbol' ? thumb(g, x, sz) : null, name: x.name, meta: meta(x, sz), tag: on ? 'View' : x.kind === 'symbol' ? 'Symbol' : x.cell ? 'Sheet' : 'PNG', selected: on,
        act: A(() => (on ? openViewer(app, g, x, F) : setSel(app, i))) });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        <div role="tablist" aria-label="Folders" style="display:flex;align-items:center;gap:4px">
          ${F.list.map((x, k) => iconBtn(FOLDER_ICON[x.id] || 'folder', A(() => setFolder(app, k)), { on: k === fi, label: x.name, pressed: k === fi })).join('')}
        </div>
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
  if (it.kind === 'image') { v.img = new Image(); v.img.onload = () => draw(); v.img.src = src(g, it); }
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
