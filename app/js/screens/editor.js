// Studio level editor. Layers decide the tools: Tiles (paint, fill, erase, pan), Objects (select, place, move, pan), Events (patch, select, remove).
// The tile and object trays are views of the project's Library tree.
import { well, icon, svgRows, svgText, G, bitmapCanvas, drawRows, drawText, textRows, present, PALETTE, sq } from '../pixel.js';
import * as S from '../store.js';
import { A, esc, iconBtn, bareBtn, valScreen, stepper, toggle, pageOf } from '../ui.js';
import { openPlayer } from './player.js';
import { pushAll } from './sync.js';
import * as snd from '../sound.js';
import * as input from '../input.js';

const GREEN = '#7dff6a', T = 8, VW = 20, VH = 18;
const col = (c) => PALETTE[c] || c || '#ffffff';
const TOOLS = { tiles: [['paint', 'Paint'], ['fill', 'Fill'], ['erase', 'Erase'], ['pan', 'Pan']], objects: [['select', 'Select'], ['place', 'Place'], ['move', 'Move'], ['pan', 'Pan']], events: [['patch', 'Patch'], ['select', 'Select'], ['remove', 'Remove']] };
const ROLE_TEXT = { player: 'The player. Move with the D-pad, jump with A.', walker: 'Walks back and forth.', flyer: 'Flies back and forth.', pickup: 'Stays put. Use Events to decide what touching it does.', goal: 'Stays put. Use Events to decide what touching it does.', decor: 'Scenery. Nothing touches it.' };
const pad2 = (n) => (n < 10 ? '0' : '') + n;

export function openEditor(app, project) {
  const firstScene = S.flatten(project.scenes)[0];
  const ed = {
    p: structuredClone(project), sceneId: firstScene, layer: 'objects', tool: 'select', tile: project.library.tiles.find(n => !S.isFolder(n)) || S.flatten(project.library.tiles)[0], sprite: project.library.sprites.find(n => !S.isFolder(n)) || S.flatten(project.library.sprites)[0],
    selId: null, evSel: null, patchFrom: null, itab: 'props', scenesOpen: false, scenePath: [], scenePage: 0, trayPath: { tiles: [], objects: [] },
    camX: 0, camY: 0, cur: { x: 0, y: 0 }, hist: [], fut: []
  };
  const sd = () => ed.p.sceneData[ed.sceneId];
  const sel = () => (sd().objects.find(o => o.id === ed.selId) || null);
  let saveT = null, view = null, off = null, octx = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => S.saveProject(ed.p), 250); };
  const snapshot = () => { ed.hist.push(JSON.stringify({ sceneData: ed.p.sceneData, events: ed.p.events, scenes: ed.p.scenes })); if (ed.hist.length > 60) ed.hist.shift(); ed.fut = []; };
  const commit = (fn) => { snapshot(); fn(); save(); rerender(); };
  const restore = (from, to) => {
    if (!from.length) return;
    to.push(JSON.stringify({ sceneData: ed.p.sceneData, events: ed.p.events, scenes: ed.p.scenes }));
    Object.assign(ed.p, JSON.parse(from.pop()));
    if (!ed.p.sceneData[ed.sceneId]) ed.sceneId = S.flatten(ed.p.scenes)[0];
    ed.patchFrom = null; save(); rerender();
  };
  const rerender = () => app.render();
  const setTool = (t) => { ed.tool = t; ed.patchFrom = null; rerender(); };
  const setLayer = (l) => { ed.layer = l; ed.tool = TOOLS[l][0][0]; ed.patchFrom = null; ed.scenesOpen = false; rerender(); };
  const clampCam = () => { const s = sd(); ed.camX = Math.max(0, Math.min(s.w - VW, ed.camX)); ed.camY = Math.max(0, Math.min(Math.max(0, s.h - VH), ed.camY)); };
  const openScene = (id) => { if (id === ed.sceneId) return; ed.sceneId = id; ed.selId = null; ed.camX = 0; ed.camY = 0; ed.hist = []; ed.fut = []; rerender(); };

  // ------------------------------------------------------------ canvas: level or patch bay
  function bay() {
    const ev = ed.p.events, L = [], R = [], NW = 64, NH = 14, GAP = 2;
    const top = (n) => 12 + Math.max(0, (8 - n) * (NH + GAP) / 2);
    ev.when.forEach((w, i) => L.push({ id: w.id, x: 1, y: Math.round(top(ev.when.length) + i * (NH + GAP)), a: S.whoLabel(w.who, ed.p), b: S.WHEN_EVENTS[w.ev] || w.ev }));
    ev.do.forEach((d, i) => R.push({ id: d.id, x: 95, y: Math.round(top(ev.do.length) + i * (NH + GAP)), a: S.tgtLabel(d.tgt), b: S.doLabel(d, ed.p) }));
    return { L, R, NW, NH };
  }
  function draw() {
    if (!view) return;
    const c = octx; c.fillStyle = '#000'; c.fillRect(0, 0, 160, 144);
    if (ed.layer === 'events') drawBay(c); else drawLevel(c);
    present(off, view, 160, 144);
  }
  const fit = (str, max) => { let s = String(str).toUpperCase(); while (s.length > 1 && textRows(s)[0].length > max) s = s.slice(0, -1); return s; };
  function drawBay(c) {
    const b = bay(), ev = ed.p.events, hot = ed.patchFrom || ed.evSel;
    drawText(c, 'WHEN', 1, 3, '#6f6d69'); drawText(c, 'DO', 159 - 7, 3, '#6f6d69');
    const rect = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h); };
    for (const cab of ev.cables) {
      const a = b.L.find(n => n.id === cab[0]), d = b.R.find(n => n.id === cab[1]); if (!a || !d) continue;
      const on = cab[0] === hot || cab[1] === hot; c.fillStyle = on ? GREEN : 'rgba(228,226,220,0.45)';
      const x0 = a.x + b.NW + 2, y0 = a.y + 6, x3 = d.x - 3, y3 = d.y + 6, seen = {};
      for (let k = 0; k <= 80; k++) {
        const t = k / 80, u = 1 - t;
        const x = u * u * u * x0 + 3 * u * u * t * (x0 + 12) + 3 * u * t * t * (x3 - 12) + t * t * t * x3, y = u * u * u * y0 + 3 * u * u * t * (y0 + 5) + 3 * u * t * t * (y3 + 5) + t * t * t * y3;
        const px = Math.round(x), py = Math.round(y); if (!seen[px + ',' + py]) { seen[px + ',' + py] = 1; c.fillRect(px, py, 1, 1); }
      }
    }
    for (const n of b.L.concat(b.R)) {
      const on = n.id === ed.evSel || n.id === ed.patchFrom;
      rect(n.x, n.y, b.NW, b.NH, on ? GREEN : '#3a3a3f');
      drawText(c, fit(n.a, b.NW - 5), n.x + 3, n.y + 2, on ? GREEN : '#8f8d88');
      drawText(c, fit(n.b, b.NW - 5), n.x + 3, n.y + 8, on ? GREEN : '#e4e2dc');
      c.fillStyle = '#fff'; c.fillRect(n.id[0] === 'w' ? n.x + b.NW : n.x - 3, n.y + 5, 3, 3);
    }
  }
  function drawLevel(c) {
    const s = sd(), cx = ed.camX, cy = ed.camY;
    c.globalAlpha = ed.layer === 'tiles' ? 1 : 0.45;
    for (let ty = cy; ty < cy + VH; ty++) for (let tx = cx; tx < cx + VW; tx++) {
      const id = s.tiles[tx + ',' + ty]; if (!id) continue; const a = ed.p.assets[id]; if (a) c.drawImage(bitmapCanvas(a.px, col(a.color)), (tx - cx) * T, (ty - cy) * T);
    }
    c.globalAlpha = ed.layer === 'objects' ? 1 : 0.45;
    for (const o of s.objects) {
      if (o.x < cx || o.x >= cx + VW || o.y < cy || o.y >= cy + VH) continue;
      const a = ed.p.assets[o.sprite]; if (a) c.drawImage(bitmapCanvas(a.px, col(a.color)), (o.x - cx) * T, (o.y - cy) * T);
    }
    c.globalAlpha = 1;
    // level edges and the green selection ring
    c.fillStyle = '#2a2a2e';
    if (s.w - cx < VW) c.fillRect((s.w - cx) * T, 0, 1, 144);
    if (s.h - cy < VH) c.fillRect(0, (s.h - cy) * T, 160, 1);
    const o = sel(), showRing = (ed.tool === 'select' || ed.tool === 'move') ? !!o : ed.tool !== 'pan';
    const rx = o && (ed.tool === 'select' || ed.tool === 'move') ? o.x : ed.cur.x, ry = o && (ed.tool === 'select' || ed.tool === 'move') ? o.y : ed.cur.y;
    if (showRing) { c.fillStyle = GREEN; const x = (rx - cx) * T, y = (ry - cy) * T; c.fillRect(x - 1, y - 1, 10, 1); c.fillRect(x - 1, y + 8, 10, 1); c.fillRect(x - 1, y, 1, 8); c.fillRect(x + 8, y, 1, 8); }
    // readout
    const here = s.objects.find(q => q.x === rx && q.y === ry), t = s.tiles[rx + ',' + ry];
    const what = here ? (ed.p.assets[here.sprite] || {}).name : t ? (ed.p.assets[t] || {}).name : 'empty';
    const txt = pad2(rx) + ',' + pad2(ry) + ' ' + String(what || '').toUpperCase(), w = textRows(txt)[0].length;
    c.fillStyle = '#000'; c.fillRect(160 - w - 4, 0, w + 4, 8); drawText(c, txt, 160 - w - 2, 2, GREEN);
    if (s.w > VW) { const bw = Math.max(8, Math.round(160 * VW / s.w)), bx = Math.round((160 - bw) * cx / Math.max(1, s.w - VW)); c.fillStyle = '#3a3a3f'; c.fillRect(0, 143, 160, 1); c.fillStyle = GREEN; c.fillRect(bx, 143, bw, 1); }
  }

  // ------------------------------------------------------------ taps on the canvas
  function cellFrom(e) { const r = view.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) / r.width * VW) + ed.camX, y: Math.floor((e.clientY - r.top) / r.height * VH) + ed.camY, ux: (e.clientX - r.left) / r.width * 160, uy: (e.clientY - r.top) / r.height * 144 }; }
  const inScene = (x, y) => x >= 0 && y >= 0 && x < sd().w && y < sd().h;
  let stroke = null;
  function down(e) {
    e.preventDefault(); view.setPointerCapture(e.pointerId);
    const c = cellFrom(e);
    if (ed.layer === 'events') return tapBay(c.ux, c.uy);
    if (ed.tool === 'pan') { stroke = { pan: true, x: e.clientX, y: e.clientY, cx: ed.camX, cy: ed.camY }; return; }
    if (!inScene(c.x, c.y)) return;
    ed.cur = { x: c.x, y: c.y };
    const s = sd(), hit = s.objects.find(o => o.x === c.x && o.y === c.y);
    if (ed.tool === 'paint' || ed.tool === 'erase') { snapshot(); stroke = { paint: true }; paintAt(c.x, c.y); draw(); return; }
    if (ed.tool === 'fill') { commit(() => fill(c.x, c.y)); return; }
    if (ed.tool === 'select') { ed.selId = hit ? hit.id : null; rerender(); return; }
    if (ed.tool === 'move') { if (hit) { ed.selId = hit.id; rerender(); } else if (sel()) commit(() => { const o = sel(); o.x = c.x; o.y = c.y; }); return; }
    if (ed.tool === 'place') {
      if (hit) { ed.selId = hit.id; rerender(); return; }
      const a = ed.p.assets[ed.sprite]; if (!a) return;
      commit(() => {
        if (a.role === 'player') { const pl = s.objects.find(o => (ed.p.assets[o.sprite] || {}).role === 'player'); if (pl) { pl.x = c.x; pl.y = c.y; ed.selId = pl.id; return; } }
        const o = { id: S.uid('o'), sprite: ed.sprite, x: c.x, y: c.y, props: { ...(S.ROLE_PROPS[a.role] || {}) } };
        s.objects.push(o); ed.selId = o.id;
      });
    }
  }
  function move(e) {
    if (!stroke) return;
    if (stroke.pan) {
      const r = view.getBoundingClientRect(), px = r.width / VW;
      ed.camX = Math.round(stroke.cx - (e.clientX - stroke.x) / px); ed.camY = Math.round(stroke.cy - (e.clientY - stroke.y) / px); clampCam(); draw(); return;
    }
    const c = cellFrom(e);
    if (stroke.paint && inScene(c.x, c.y) && (c.x !== ed.cur.x || c.y !== ed.cur.y)) { ed.cur = { x: c.x, y: c.y }; paintAt(c.x, c.y); draw(); }
  }
  function up() { if (stroke && stroke.paint) { save(); rerender(); } stroke = null; }
  function paintAt(x, y) { const t = sd().tiles, k = x + ',' + y; if (ed.tool === 'erase') delete t[k]; else t[k] = ed.tile; }
  function fill(x, y) {
    const t = sd().tiles, target = t[x + ',' + y], q = [[x, y]], seen = {}; let n = 0;
    if (target === ed.tile) return;
    while (q.length && n < 600) {
      const [cx, cy] = q.shift(), k = cx + ',' + cy;
      if (seen[k] || !inScene(cx, cy) || t[k] !== target) continue;
      seen[k] = 1; t[k] = ed.tile; n++;
      q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  function tapBay(ux, uy) {
    const b = bay(), ev = ed.p.events, n = b.L.concat(b.R).find(n => ux >= n.x && ux < n.x + b.NW + 3 && uy >= n.y && uy < n.y + b.NH);
    if (!n) { ed.patchFrom = null; rerender(); return; }
    const isW = n.id[0] === 'w';
    if (ed.tool === 'select') { ed.evSel = n.id; rerender(); return; }
    if (ed.tool === 'remove') { commit(() => { ev.when = ev.when.filter(w => w.id !== n.id); ev.do = ev.do.filter(d => d.id !== n.id); ev.cables = ev.cables.filter(c => c[0] !== n.id && c[1] !== n.id); if (ed.evSel === n.id) ed.evSel = null; }); return; }
    if (isW) { ed.patchFrom = ed.patchFrom === n.id ? null : n.id; ed.evSel = n.id; rerender(); return; }
    if (!ed.patchFrom) { ed.evSel = n.id; rerender(); return; }
    const from = ed.patchFrom, has = ev.cables.some(c => c[0] === from && c[1] === n.id);
    commit(() => { ev.cables = has ? ev.cables.filter(c => !(c[0] === from && c[1] === n.id)) : ev.cables.concat([[from, n.id]]); ed.patchFrom = null; ed.evSel = n.id; });
  }

  // ------------------------------------------------------------ bottom panel
  const row = (label, control) => `<div class="irow"><span class="cap" style="color:var(--muted)">${esc(label)}</span>${control}</div>`;
  function trayHtml(which) {
    const tree = which === 'tiles' ? ed.p.library.tiles : ed.p.library.sprites, tp = ed.trayPath[which];
    const list = S.listAt(tree, tp), where = S.folderNameAt(tree, tp), chosen = which === 'tiles' ? ed.tile : ed.sprite;
    const go = (np) => { ed.trayPath[which] = np; rerender(); };
    const cells = [];
    if (tp.length) cells.push({ label: 'Back', art: icon('back', '#fff'), act: A(() => go(tp.slice(0, -1))) });
    list.forEach((n, i) => {
      if (S.isFolder(n)) cells.push({ label: n.folder, art: icon('folder'), act: A(() => go(tp.concat([i]))) });
      else { const a = ed.p.assets[n]; if (!a) return; const on = n === chosen; cells.push({ on, label: a.name, art: svgRows(a.px, on ? GREEN : col(a.color)), act: A(() => { if (which === 'tiles') ed.tile = n; else ed.sprite = n; rerender(); }) }); }
    });
    return `<div style="display:flex;align-items:center;justify-content:space-between;height:40px">
        <span class="cap ell" style="color:var(--muted);padding-left:4px">${esc(where || (which === 'tiles' ? 'Tiles' : 'Objects'))} · <span class="acc">${esc((ed.p.assets[chosen] || {}).name || 'None')}</span></span>
        ${bareBtn('books', 'Library', A(() => { app.ui.tab = 2; app.saveUI(); S.saveProject(ed.p); app.close(); }))}
      </div>
      <div class="tray">${cells.slice(0, 8).map(c => `<button class="${c.on ? 'on' : ''}" ${c.act} aria-pressed="${!!c.on}">${well(40, (c.on ? '<span class="ring"></span>' : '') + c.art)}<span class="cap">${esc(c.label)}</span></button>`).join('')}</div>`;
  }
  function hint(ic, text) { return `<div class="center-note">${well(40, icon(ic, '#fff'))}<span class="sub">${esc(text)}</span></div>`; }
  function objectPanel(o) {
    const a = ed.p.assets[o.sprite] || { name: '?', px: S.BLANK8, role: 'decor' }, P = o.props || (o.props = {});
    const num = (k, label, unit, min, max) => row(label, stepper(String(P[k] ?? min) + (unit ? ' ' + unit : ''), A(() => commit(() => { P[k] = Math.max(min, (P[k] ?? min) - 1); })), A(() => commit(() => { P[k] = Math.min(max, (P[k] ?? min) + 1); })), label));
    const tog = (k, label) => row(label, toggle(P[k] !== false, A(() => commit(() => { P[k] = P[k] === false; })), label));
    let rows = '';
    if (ed.itab === 'props') {
      if (a.role === 'player') rows = num('speed', 'Run speed', '', 1, 9) + num('jump', 'Jump', 'T', 1, 8) + num('lives', 'Lives', '', 1, 9);
      else if (a.role === 'walker') rows = num('speed', 'Speed', '', 0, 9) + num('patrol', 'Patrol', 'T', 1, 20) + tog('edges', 'Turns at edges');
      else if (a.role === 'flyer') rows = num('speed', 'Speed', '', 0, 9) + num('patrol', 'Patrol', 'T', 1, 20);
      else rows = `<div class="irow"><span class="sub" style="white-space:normal">${esc(ROLE_TEXT[a.role] || '')}</span></div>`;
    } else {
      const rules = ed.p.events.when.filter(w => w.who === o.sprite);
      rows = rules.length ? rules.slice(0, 3).map(w => {
        const dos = ed.p.events.cables.filter(c => c[0] === w.id).map(c => ed.p.events.do.find(d => d.id === c[1])).filter(Boolean).map(d => S.tgtLabel(d.tgt) + ' ' + S.doLabel(d, ed.p).toLowerCase());
        return `<div class="irow"><span class="cap" style="color:var(--muted)">${esc(S.WHEN_EVENTS[w.ev])}</span><span class="sub" style="max-width:190px;text-align:right">${esc(dos.join(', ') || 'Nothing yet')}</span></div>`;
      }).join('') : `<div class="irow"><span class="sub">No rules for ${esc(a.name)} yet.</span></div>`;
      rows += `<div style="margin-top:4px">${bareBtn('events', 'Edit in Events', A(() => { ed.layer = 'events'; ed.tool = 'select'; const w = rules[0]; ed.evSel = w ? w.id : null; rerender(); }))}</div>`;
    }
    return `<div style="display:flex;align-items:center;gap:12px;height:40px">
        ${well(40, svgRows(a.px, GREEN))}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell acc">${esc(a.name)}</span><span class="sub">${esc(a.role)} · ${pad2(o.x)},${pad2(o.y)}</span></div>
        ${iconBtn('dup', A(() => commit(() => { let x = o.x + 1; const s = sd(); while (x < s.w && s.objects.some(q => q.x === x && q.y === o.y)) x++; if (x >= s.w || a.role === 'player') return; const n = { ...structuredClone(o), id: S.uid('o'), x }; s.objects.push(n); ed.selId = n.id; })), { label: 'Duplicate' })}
        ${iconBtn('trash', A(() => commit(() => { sd().objects = sd().objects.filter(q => q.id !== o.id); ed.selId = null; })), { label: 'Delete' })}
      </div>
      <div role="tablist" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin:12px 0 4px">
        ${[['props', 'Properties'], ['behavior', 'Behavior']].map(([k, l]) => `<button class="itab${ed.itab === k ? ' on' : ''}" role="tab" aria-selected="${ed.itab === k}" ${A(() => { ed.itab = k; rerender(); })}><span class="dot"></span>${l}${ed.itab === k ? '<span class="selring"></span>' : ''}</button>`).join('')}
      </div>${rows}`;
  }
  function nodePanel() {
    const ev = ed.p.events, w = ev.when.find(x => x.id === ed.evSel), d = ev.do.find(x => x.id === ed.evSel);
    if (!w && !d) return hint('select', 'Tap a WHEN or DO to edit it.');
    const links = ev.cables.filter(c => c[0] === ed.evSel || c[1] === ed.evSel).length;
    const cyc = (label, list, cur, set, fmt) => { const i = Math.max(0, list.indexOf(cur)); return row(label, stepper(fmt(cur), A(() => commit(() => set(list[(i - 1 + list.length) % list.length]))), A(() => commit(() => set(list[(i + 1) % list.length]))), label, true)); };
    let rows = '';
    if (w) {
      const whos = ['game', ...S.flatten(ed.p.library.sprites).filter(id => ed.p.assets[id])];
      rows = cyc('Who', whos, w.who, v => { w.who = v; const evs = S.whenEventsFor(v, ed.p); if (!evs.includes(w.ev)) w.ev = evs[0]; }, v => S.whoLabel(v, ed.p))
        + cyc('Does', S.whenEventsFor(w.who, ed.p), w.ev, v => { w.ev = v; }, v => S.WHEN_EVENTS[v]);
    } else {
      rows = cyc('Who', S.DO_TARGETS, d.tgt, v => { d.tgt = v; d.act = S.actsFor(v, ed.p)[0]; }, S.tgtLabel)
        + cyc('What', S.actsFor(d.tgt, ed.p), d.act, v => { d.act = v; }, v => S.doLabel({ tgt: d.tgt, act: v }, ed.p));
    }
    rows += row('Cables', `<span class="sub" style="color:var(--text);margin-right:6px">${links} ${w ? (links === 1 ? 'DO' : 'DOs') : (links === 1 ? 'WHEN' : 'WHENs')} connected</span>`);
    return `<div style="display:flex;align-items:center;gap:12px;height:40px;margin-bottom:12px">
        ${well(40, icon(w ? 'when' : 'play', GREEN))}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell acc">${esc(w ? S.whoLabel(w.who, ed.p) : S.tgtLabel(d.tgt))}</span><span class="sub">${esc(w ? 'When · ' + S.WHEN_EVENTS[w.ev] : 'Do · ' + S.doLabel(d, ed.p))}</span></div>
        ${iconBtn('trash', A(() => commit(() => { ev.when = ev.when.filter(x => x.id !== ed.evSel); ev.do = ev.do.filter(x => x.id !== ed.evSel); ev.cables = ev.cables.filter(c => c[0] !== ed.evSel && c[1] !== ed.evSel); ed.evSel = null; })), { label: 'Remove' })}
      </div>${rows}`;
  }
  function patchPanel() {
    const ev = ed.p.events, from = ev.when.find(w => w.id === ed.patchFrom);
    const add = (side) => commit(() => {
      const id = (side === 'when' ? 'w' : 'd') + S.uid('').slice(0, 4);
      if (side === 'when') { if (ev.when.length >= 8) return; ev.when.push({ id, who: 'game', ev: 'start' }); } else { if (ev.do.length >= 8) return; ev.do.push({ id, tgt: 'score', act: 'add10' }); }
      ed.evSel = id; ed.tool = 'select';
    });
    return `<div style="display:flex;align-items:center;justify-content:space-between;height:40px">
        <span class="cap" style="color:var(--muted);padding-left:4px">Events · Patch</span>
        <div style="display:flex;gap:4px">${bareBtn('plus', 'When', A(() => add('when')))}${bareBtn('plus', 'Do', A(() => add('do')))}</div>
      </div>
      <div class="center-note"><span class="sub" style="color:var(--text)">${from ? 'Now tap a DO to connect ' + esc((S.whoLabel(from.who, ed.p) + ' ' + S.WHEN_EVENTS[from.ev]).toLowerCase()) + '. Tap one that is already connected to unplug it.' : 'Tap a WHEN to pick up a cable, then tap a DO to plug it in.'}</span>
      <span class="cap" style="color:var(--muted)">${ev.when.length} WHENs · ${ev.do.length} DOs · ${ev.cables.length} cables</span></div>`;
  }
  function scenesPanel() {
    const sp = ed.scenePath, list = S.listAt(ed.p.scenes, sp), fname = S.folderNameAt(ed.p.scenes, sp);
    const rows = (sp.length ? [{ back: true }] : []).concat(list.map((n, i) => ({ n, i })));
    const pg = pageOf(rows, ed.scenePage);
    const edit = (fn) => { ed.p.scenes = S.editAt(ed.p.scenes, sp, fn); };
    const html = pg.slice.map(r => {
      let ic = 'scene', name, meta, on = false, act;
      if (r.back) { ic = 'back'; name = fname; meta = 'Back'; act = A(() => { ed.scenePath = sp.slice(0, -1); ed.scenePage = 0; rerender(); }); }
      else if (S.isFolder(r.n)) { ic = 'folder'; name = r.n.folder; meta = S.flatten(r.n.items).length + ' scenes'; act = A(() => { ed.scenePath = sp.concat([r.i]); ed.scenePage = 0; rerender(); }); }
      else { const s = ed.p.sceneData[r.n]; on = r.n === ed.sceneId; name = s ? s.name : '?'; meta = on ? 'Editing' : (s ? s.objects.length + ' objects' : ''); act = A(() => openScene(r.n)); }
      return `<button ${act} style="position:relative;display:flex;align-items:center;gap:12px;height:44px;padding:0 12px 0 6px;border-radius:12px;text-align:left;width:100%">
        ${well(28, icon(ic, on ? GREEN : r.back ? '#fff' : '#e4e2dc'))}<span class="cap ell" style="flex:1;min-width:0;font-size:12px;color:${on ? GREEN : 'var(--text)'}">${esc(name)}</span><span class="sub" style="color:${on ? GREEN : 'var(--muted)'}">${esc(meta)}</span>${on ? '<span class="selring"></span>' : ''}</button>`;
    }).join('');
    const count = S.flatten(ed.p.scenes).length;
    return `<div style="display:flex;align-items:center;justify-content:space-between;height:40px">
        <div style="display:flex;align-items:center;gap:2px">
          ${iconBtn('folderPlus', A(() => commit(() => edit(l => [{ folder: 'New folder', items: [] }, ...l]))), { label: 'New scene folder' })}
          ${bareBtn('plus', 'Scene', A(() => commit(() => { const id = 'sc_' + S.uid(''); ed.p.sceneData[id] = S.blankScene('Level ' + (count + 1)); edit(l => [...l, id]); ed.sceneId = id; ed.selId = null; ed.camX = 0; ed.hist = []; })))}
          ${count > 1 ? iconBtn('trash', A(() => { if (!confirm('Delete "' + sd().name + '"?')) return; commit(() => { const id = ed.sceneId; ed.p.scenes = S.removeFromTree(ed.p.scenes, id); delete ed.p.sceneData[id]; ed.sceneId = S.flatten(ed.p.scenes)[0]; ed.selId = null; }); }), { label: 'Delete this scene' }) : ''}
        </div>
        <div style="display:flex;align-items:center;gap:2px">${iconBtn('left', A(() => { ed.scenePage = Math.max(0, pg.p - 1); rerender(); }), { color: '#fff', label: 'Previous' })}<span class="cap acc" style="min-width:48px;text-align:center">${pg.range}</span>${iconBtn('right', A(() => { ed.scenePage = Math.min(pg.pages - 1, pg.p + 1); rerender(); }), { color: '#fff', label: 'Next' })}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">${html}</div>`;
  }
  function panel() {
    if (ed.scenesOpen) return scenesPanel();
    if (ed.layer === 'tiles') return ed.tool === 'paint' || ed.tool === 'fill' ? trayHtml('tiles') : ed.tool === 'erase' ? hint('erase', 'Tap or drag across tiles to erase them.') : hint('pan', 'Drag the level to move around it.');
    if (ed.layer === 'objects') {
      if (ed.tool === 'place') return trayHtml('objects');
      if (ed.tool === 'pan') return hint('pan', 'Drag the level to move around it.');
      if (ed.tool === 'move') return hint('move', sel() ? 'Tap an empty spot to move the ' + ((ed.p.assets[sel().sprite] || {}).name || 'object').toLowerCase() + ' there.' : 'Tap an object, then tap where it should go.');
      return sel() ? objectPanel(sel()) : hint('select', 'Tap an object in the level to edit it.');
    }
    if (ed.tool === 'patch') return patchPanel();
    if (ed.tool === 'remove') return hint('remove' in G ? 'remove' : 'trash', 'Tap a WHEN or DO to remove it and its cables.');
    return nodePanel();
  }

  // ------------------------------------------------------------ the screen
  const folderOf = () => { const p = S.pathOf(ed.p.scenes, ed.sceneId); return p && p.length ? S.folderNameAt(ed.p.scenes, p) : ''; };
  const ov = {
    render() {
      const s = sd();
      return `<div class="screen-tool" style="--acc:${GREEN}">
        <h1 class="sr">Studio · ${esc(ed.p.name)} · ${esc(s.name)}</h1>
        <div class="plate bar">
          ${iconBtn('back', A(() => { S.saveProject(ed.p); app.close(); }), { color: '#fff', label: 'Back to Studio' })}
          <button ${A(() => { const n = prompt('Scene name', s.name); if (n && n.trim()) commit(() => { s.name = n.trim().slice(0, 24); }); })} style="flex:1;min-width:0;display:flex;flex-direction:column;text-align:left" aria-label="Rename scene">
            <span class="title ell">${esc(s.name)}</span><span class="sub">${esc(ed.p.name + (folderOf() ? ' · ' + folderOf() : ''))}</span></button>
          ${iconBtn('scene', A(() => { ed.scenesOpen = !ed.scenesOpen; const p = S.pathOf(ed.p.scenes, ed.sceneId); ed.scenePath = p || []; ed.scenePage = 0; rerender(); }), { on: ed.scenesOpen, label: 'Scenes', pressed: ed.scenesOpen })}
          ${bareBtn('play', 'Play', A(() => { S.saveProject(ed.p); openPlayer(app, ed.p, ed.sceneId, ov); }))}
        </div>
        <div class="plate bar" role="tablist" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px">
          ${[['tiles', 'Tiles'], ['objects', 'Objects'], ['events', 'Events']].map(([k, l]) => `<button class="seg${ed.layer === k ? ' on' : ''}" role="tab" aria-selected="${ed.layer === k}" ${A(() => setLayer(k))}>${well(28, svgRows(G[k], ed.layer === k ? GREEN : '#e4e2dc'))}${l}${ed.layer === k ? '<span class="selring"></span>' : ''}</button>`).join('')}
        </div>
        <div class="screen gap20" style="flex:none;height:304px;display:flex;align-items:center;justify-content:center"><canvas class="pix" id="lvl" style="width:320px;height:288px;cursor:crosshair" aria-label="Level editor canvas" role="img"></canvas></div>
        <div class="plate bar" role="toolbar" aria-label="Tools">
          <div style="display:flex;gap:6px">${TOOLS[ed.layer].map(([k, l]) => iconBtn(k in G ? k : 'trash', A(() => setTool(k)), { on: ed.tool === k, label: l, pressed: ed.tool === k })).join('')}</div>
          <div style="display:flex;gap:6px">${iconBtn('undo', A(() => restore(ed.hist, ed.fut)), { color: ed.hist.length ? '#fff' : '#555', label: 'Undo' })}${iconBtn('redo', A(() => restore(ed.fut, ed.hist)), { color: ed.fut.length ? '#fff' : '#555', label: 'Redo' })}</div>
        </div>
        <div class="plate inspector gap20">${panel()}</div>
      </div>`;
    },
    mount(root) {
      view = root.querySelector('#lvl');
      const dpr = window.devicePixelRatio || 1;
      view.width = 320 * dpr; view.height = 288 * dpr;
      if (!off) { off = document.createElement('canvas'); off.width = 160; off.height = 144; octx = off.getContext('2d'); }
      view.addEventListener('pointerdown', down); view.addEventListener('pointermove', move);
      view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
      clampCam(); draw();
    },
    frame() {
      // the editor is for touch; the controller can still test: Start plays this scene, B goes back
      if (input.pressed('start')) { S.saveProject(ed.p); openPlayer(app, ed.p, ed.sceneId, ov); }
      else if (input.pressed('b')) { S.saveProject(ed.p); app.close(); }
    },
    onClose() {
      clearTimeout(saveT); S.saveProject(ed.p);
      if (app.settings.autoPush && app.settings.token) setTimeout(() => { app.refreshProjects(); pushAll(app); }, 0);
    }
  };
  app.open(ov);
}
