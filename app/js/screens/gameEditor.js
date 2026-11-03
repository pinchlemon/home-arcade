// Editor for a repo game that has a game.json, like Crab Platformer.
// Scene: the whole scene at once, drawn as simple pixel symbols (not the real art).
// Scene › Backdrop: the backdrop as a stack of planes, one per layer, spaced evenly; tilt it, tap a layer to adjust it.
// Objects: reusable templates and their behaviors; each one's picture opens in the Art tab.
// Settings: every number the game exposes, in groups. Universal groups work the same for any game; the rest are this game's extras.
import { well, icon, svgRows, G, drawRows, drawText, textRows, present } from '../pixel.js';
import { A, esc, iconBtn, bareBtn, stepper } from '../ui.js';
import * as games from '../games.js';
import { pushAll } from './sync.js';
import * as input from '../input.js';

const GREEN = '#7dff6a', BONE = '#e4e2dc', DIM = '#3a3a3f';
const VW = 160, VH = 144;
const ART = {
  crab: ['01000010', '10000001', '10111101', '01111110', '11111111', '01111110', '10100101', '00000000'],
  eye: ['00111100', '01000010', '10011001', '10111101', '10111101', '10011001', '01000010', '00111100'],
  palm: ['01101100', '11111110', '10111010', '00110000', '00010000', '00011000', '00001000', '00111100'],
  castle: ['10101010', '11111110', '01111100', '01101100', '01111100', '01101100', '11111110', '11111110'],
  umbrella: ['00111000', '01111100', '11111110', '00010000', '00010000', '00010000', '00010000', '00111000'],
  ground: ['11111111', '10000001', '10100101', '10000001', '10010001', '10000101', '10000001', '11111111'],
  sun: ['00111100', '01111110', '11111111', '11111111', '11111111', '11111111', '01111110', '00111100'],
  cloud: ['0001110000', '0111111100', '1111111111', '0111111110'],
  gull: ['10001', '01010', '00100'],
  boat: ['0001000', '0001100', '0001110', '0001000', '1111111', '0111110'],
  wave: ['0011000110001100', '1100111001110011'],
  beach: ['00000000', '00011000', '00111100', '01111110', '00011000', '00011000', '11111111', '11111111'],
  flag: ['11100', '11111', '11100', '10000', '10000', '10000', '10000', '10000'],
  exit: ['1111110', '1101111', '1111110', '1100000', '1000000', '1000000', '1000000', '1100000'],
  level: ['11111111', '10000001', '10110001', '10000001', '10001101', '10000001', '11111111', '00000000']
};
const BG_ART = { sun: ART.sun, cloudsFar: ART.cloud, cloudsNear: ART.cloud, gulls: ART.gull, city: ['1101011', '1101011', '1111111', '1111111', '1111111'], sea: ART.wave.map(r => r.slice(0, 8)), boat: ART.boat, sand: ART.ground };
const BG_COLORS = { sun: '#ffd23f', cloudsFar: BONE, cloudsNear: BONE, gulls: '#ffffff', city: '#8f8d88', sea: '#4d7cff', boat: BONE, sand: BONE };
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// numbers as the person sees them
const decimals = (step) => (String(step).split('.')[1] || '').length;
export function fmt(f, v) {
  if (v == null) return '-';
  if (f.show === 'seconds') return (v / 60).toFixed(2) + ' S';
  if (f.show === 'percent') return Math.round(v * 100) + '%';
  return Number(v).toFixed(decimals(f.step));
}
function nudge(f, v, dir) {
  const d = decimals(f.step), n = Math.round((v + dir * f.step) / f.step) * f.step;
  return +Math.min(f.max, Math.max(f.min, n)).toFixed(d + 2);
}

export function openGameEditor(app, g) {
  const ed = { tab: app.ui.geTab || 'scene', obj: app.ui.geObj || null, objPage: 0, addingBehavior: false, scene: null, tool: 'select', placeType: 'palm', lsel: null, group: 0, bg: app.ui.geLayer || 'city', camX: null, pitch: 58, yaw: -32, dragging: false, sel: null, game: null, error: null };
  delete app.ui.geObj; delete app.ui.geLayer; app.saveUI(); // a jump from the Art tab picks these once
  let view = null, off = null, octx = null, drag = null, dragged = false;
  const folder = g.file;
  games.setCurrentGame(app, g);
  games.loadGame(folder).then(x => { ed.game = x; rerender(); }).catch(e => { ed.error = e.message; rerender(); });
  const rerender = () => { if (app.overlay === ov) app.render(); };
  const edits = () => games.getEdits(folder);
  const data = () => games.applyOverrides(ed.game.data, edits().overrides);
  const val = (path) => games.getPath(data(), path);
  // Undo and redo, one change at a time. Each entry is how the edits looked just before a change.
  const hist = [], fut = [];
  const record = () => { hist.push(JSON.stringify(edits())); if (hist.length > 200) hist.shift(); fut.length = 0; };
  function restore(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify(edits()));
    games.setEdits(folder, JSON.parse(from.pop()));
    ed.lsel = null; ed.sel = null;
    if (!scenes().some(x => x.id === ed.scene)) { ed.scene = null; ed.camX = null; }
    if (ed.tab === 'background') { refreshBg(); refreshTitle(); } else rerender();
  }
  const set = (path, v) => { record(); games.setValue(folder, path, v); if (ed.tab === 'background') { refreshBg(); refreshTitle(); } else rerender(); };
  const sceneLabel = () => { const c = scene(); return (c.name || 'Scene') + ' · ' + (c.kind === 'level' ? 'Level' : 'Waves'); };
  function topBar() {
    const n = games.editCount(folder);
    return `<div class="plate bar ge-top">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">${esc(g.name)}</span><span class="sub ge-sub">${esc(sceneLabel())}${n ? ' · ' + n + (n === 1 ? ' change' : ' changes') : ''}</span></span>
          ${iconBtn('undo', A(() => restore(hist, fut)), { color: hist.length ? '#fff' : '#555', label: 'Undo' })}
          ${iconBtn('redo', A(() => restore(fut, hist)), { color: fut.length ? '#fff' : '#555', label: 'Redo' })}
          ${iconBtn('play', A(() => games.launch(g, ed.tab === 'scene' && ed.game ? scene().id : null)), { color: '#fff', label: 'Play' })}
        </div>`;
  }
  const refreshTitle = () => { const el = document.querySelector('.screen-tool .ge-top'); if (el) el.outerHTML = topBar(); };

  // one adjustable setting: its name and what it does, and a stepper
  function field(f) {
    const v = val(f.path), edited = f.path in edits().overrides;
    return `<div class="grow"><span class="t"><span class="cap" style="color:${edited ? GREEN : 'var(--text)'}">${esc(f.label)}</span><span class="sub">${esc(f.help)}</span></span>
      ${stepper(fmt(f, v), A(() => set(f.path, nudge(f, v, -1))), A(() => set(f.path, nudge(f, v, 1))), f.label)}</div>`;
  }

  // ---------------------------------------------------------------- Scene: the whole scene as symbols
  function propAt(i, D, sc) {
    const r = mulberry(i * sc.seedMul + sc.seedAdd);
    if (r() < D.beach.emptyChance) return null;
    let k = r() * sc.props.length | 0, p = sc.props[k];
    const cw = D.beach.castle.width;
    const x = Math.round(i * D.beach.propSpacing + r() * (D.beach.propSpacing - (p.solid ? cw : sc.slotWidth)));
    if (p.solid && Math.abs(x + cw / 2 - D.player.startX) < D.beach.castleKeepAway) p = sc.props.find(q => q.glyph === 'umbrella');
    return { ...p, x, i };
  }
  // ---- objects: reusable templates. Levels place copies; changing an object changes every copy.
  const objects = () => data().objects || {};
  const glyph = (name) => ART[name] || (ed.game.symbols || {})[name] || ART.beach;
  const isActor = (o) => o && o.base === 'actor';
  // how an object is drawn and placed in the editor: built-ins borrow the game's item sizes, others come from their symbol
  function defFor(id) {
    const o = objects()[id]; if (!o) return null;
    if (isActor(o)) { const g2 = glyph(o.symbol), k = o.scale || 2; return { type: id, name: o.name, glyph: o.symbol, color: o.color, w: g2[0].length * k, h: g2.length * k, list: 'enemies', height: [0, 120], actor: true }; }
    const base = (ed.game.schema.scene.levelItems || []).find(d => d.type === o.base); if (!base) return null;
    return { ...base, type: id, name: o.name, color: o.color || base.color };
  }
  const thingsOf = (L) => L.things || [...(L.props || []).map(p => ({ obj: p.type, x: p.x })), ...(L.enemies || []).map(p => ({ obj: p.type, x: p.x, h: p.h }))];
  function changeObjects(fn) { const o = structuredClone(objects()); fn(o); record(); games.setValue(folder, 'objects', o); }
  function placedCount(id) { let n = 0; for (const sc2 of scenes()) if (sc2.kind === 'level') n += thingsOf(sc2).filter(t => t.obj === id).length; return n; }
  // ---- scenes: the first is the endless Waves beach; Level scenes are laid out by hand
  const scenes = () => data().scenes || [{ id: 'main', name: ed.game.schema.scene.name, kind: 'waves' }];
  const scene = () => { const l = scenes(); return l.find(x => x.id === ed.scene) || l[0]; };
  const levelItems = () => ed.game.schema.scene.levelItems || [];
  const itemDef = (type) => levelItems().find(d => d.type === type);
  // what the Place tray offers: every object, then the level's own markers
  const placeList = () => [...Object.keys(objects()).map(defFor).filter(Boolean), ...['checkpoint', 'exit', 'start'].map(itemDef).filter(Boolean)];
  const placeDef = (type) => placeList().find(d => d.type === type);
  // every thing in a level as one list: { def, list, index, x, h }
  function itemsOf(L) {
    const out = [];
    thingsOf(L).forEach((t, i) => { const d = defFor(t.obj); if (d) out.push({ def: d, list: 'things', index: i, x: t.x, h: t.h || 0 }); });
    (L.checkpoints || []).forEach((p, i) => out.push({ def: itemDef('checkpoint'), list: 'checkpoints', index: i, x: p.x }));
    if (L.exit) out.push({ def: itemDef('exit'), list: 'exit', index: 0, x: L.exit.x });
    if (L.start) out.push({ def: itemDef('start'), list: 'start', index: 0, x: L.start.x });
    return out.filter(it => it.def);
  }
  // where a thing sits on screen: props and flags stand on the sand, eyes float h pixels up, the start is centred on its x
  function boxOf(it, GROUND) {
    const d = it.def, x0 = d.list === 'start' ? it.x - d.w / 2 : d.list === 'enemies' ? it.x - d.w / 2 : it.x;
    const y1 = d.actor ? GROUND - it.h : d.list === 'enemies' ? GROUND - it.h + d.h / 2 : GROUND;
    return { x0, y0: y1 - d.h, x1: x0 + d.w, y1 };
  }
  function changeScenes(fn) { const list = structuredClone(scenes()); fn(list); record(); games.setValue(folder, 'scenes', list); }
  // older levels kept props and enemies apart; the first change moves them into one list of placed things
  function changeLevel(fn) { changeScenes(list => { const L = list.find(x => x.id === scene().id); if (!L) return; if (!L.things) { L.things = thingsOf(L); delete L.props; delete L.enemies; } fn(L); }); }
  const sameItem = (a, b) => a && b && a.list === b.list && a.index === b.index;
  function hitItem(L, wx, wy, GROUND) {
    let hit = null;
    for (const it of itemsOf(L)) { const b = boxOf(it, GROUND); if (wx >= b.x0 - 2 && wx <= b.x1 + 2 && wy >= b.y0 - 2 && wy <= b.y1 + 2) { if (!hit || (b.x1 - b.x0) < (boxOf(hit, GROUND).x1 - boxOf(hit, GROUND).x0)) hit = it; } }
    return hit;   // the smallest thing under the finger wins, so an eye in front of a palm is easy to pick
  }
  function drawLevel(L) {
    const D = data(), c = octx, GROUND = D.screen.ground, cx = Math.round(ed.camX);
    c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH);
    // outside the level: hatched
    c.fillStyle = '#1c1c20';
    for (let x = 0; x < VW; x++) { const wx = x + cx; if (wx < 0 || wx >= L.width) for (let y = (wx & 3); y < VH; y += 4) c.fillRect(x, y, 1, 1); }
    for (let x = -(((cx % 8) + 8) % 8); x < VW; x += 8) { if (x + cx < 0 || x + cx >= L.width) continue; drawRows(c, ART.ground, x, GROUND, 'rgba(228,226,220,.55)'); drawRows(c, ART.ground, x, GROUND + 8, 'rgba(228,226,220,.3)'); }
    for (const it of itemsOf(L)) {
      const b = boxOf(it, GROUND), on = sameItem(it, ed.lsel), d = it.def, x = Math.round(b.x0 - cx), w = d.w, h = d.h, top = Math.round(b.y0);
      if (d.list === 'props') {
        c.fillStyle = on ? GREEN : DIM;
        for (let k = 0; k < w; k += 2) { c.fillRect(x + k, top, 1, 1); c.fillRect(x + k, GROUND, 1, 1); }
        for (let k = 0; k < h; k += 2) { c.fillRect(x, top + k, 1, 1); c.fillRect(x + w - 1, top + k, 1, 1); }
        drawRows(c, glyph(d.glyph), Math.round(x + w / 2 - 4), GROUND - 9, on ? GREEN : d.color);
        if (d.solid) for (const s2 of D.beach.castle.solids) { c.fillStyle = on ? GREEN : d.color; c.fillRect(x + s2.x0, GROUND + 1 - D.beach.castle.height + s2.top, s2.x1 - s2.x0, 1); }
      } else if (d.list === 'enemies') {
        // its wake-up range, faintly, then the symbol
        if (!d.actor) {
          const wr = D.level ? D.level.wakeRange : 110;
          c.fillStyle = on ? 'rgba(125,255,106,.5)' : 'rgba(255,79,216,.35)';
          for (let k = -wr; k <= wr; k += 4) c.fillRect(Math.round(it.x - cx + k), GROUND - 2, 2, 1);
        }
        const g2 = glyph(d.glyph);
        drawRows(c, g2, Math.round(it.x - cx - g2[0].length / 2), Math.round(GROUND - it.h - (d.actor ? g2.length : g2.length / 2)), on ? GREEN : d.color);
      } else {
        const art = ART[d.glyph];
        drawRows(c, art, Math.round(d.list === 'start' ? it.x - cx - 4 : x), GROUND - art.length, on ? GREEN : d.color);
        if (d.list === 'start') { c.fillStyle = on ? GREEN : 'rgba(255,90,31,.5)'; for (let y = GROUND - 30; y < GROUND - 10; y += 2) c.fillRect(Math.round(it.x - cx), y, 1, 1); }
      }
      if (on) { c.fillStyle = GREEN; c.fillRect(Math.round(b.x0 - cx) - 1, Math.round(b.y1) + 1, Math.round(b.x1 - b.x0) + 2, 1); }
    }
    const txt = 'X ' + String(Math.round(ed.camX + VW / 2)).padStart(4, '0') + ' / ' + L.width, w = textRows(txt)[0].length;
    c.fillStyle = '#000'; c.fillRect(VW - w - 4, 0, w + 4, 8); drawText(c, txt, VW - w - 2, 2, GREEN);
    present(off, view, VW, VH);
  }
  function drawScene() {
    if (scene().kind === 'level') { const L = scene(); if (ed.camX == null) ed.camX = Math.max(-16, L.start.x - VW / 2); return drawLevel(L); }
    const D = data(), sc = ed.game.schema.scene, c = octx, GROUND = D.screen.ground;
    if (ed.camX == null) ed.camX = D.player.startX - VW / 2;
    const cx = Math.round(ed.camX);
    c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH);
    // where the eyes hover: a band above the sand
    const [lo, hi] = D.eyes.hoverHeight;
    for (let x = ((-cx % 4) + 4) % 4; x < VW; x += 4) { c.fillStyle = 'rgba(255,79,216,.45)'; c.fillRect(x, GROUND - hi, 2, 1); c.fillRect(x, GROUND - lo, 2, 1); }
    for (const wx of [D.player.startX + 60, D.player.startX - 70]) drawRows(c, ART.eye, wx - cx - 4, GROUND - (lo + hi) / 2 - 4, '#ff4fd8');
    // props from the scatter rule, each shown at its real size with its symbol at the base
    const SP = D.beach.propSpacing, i0 = Math.floor((cx - 80) / SP) - 1;
    for (let i = i0; i <= i0 + Math.ceil(VW / SP) + 3; i++) {
      const p = propAt(i, D, sc); if (!p) continue;
      const x = p.x - cx, top = GROUND + 1 - p.h, on = ed.sel && ed.sel.i === i;
      c.fillStyle = on ? GREEN : DIM;
      for (let k = 0; k < p.w; k += 2) { c.fillRect(x + k, top, 1, 1); c.fillRect(x + k, GROUND, 1, 1); }
      for (let k = 0; k < p.h; k += 2) { c.fillRect(x, top + k, 1, 1); c.fillRect(x + p.w - 1, top + k, 1, 1); }
      drawRows(c, ART[p.glyph], Math.round(x + p.w / 2 - 4), GROUND - 9, on ? GREEN : p.solid ? '#ffd23f' : p.glyph === 'umbrella' ? '#4d7cff' : BONE);
      if (p.solid) for (const s of D.beach.castle.solids) { c.fillStyle = on ? GREEN : '#ffd23f'; c.fillRect(x + s.x0, GROUND + 1 - D.beach.castle.height + s.top, s.x1 - s.x0, 1); }
    }
    // sand
    for (let x = -(((cx % 8) + 8) % 8); x < VW; x += 8) { drawRows(c, ART.ground, x, GROUND, 'rgba(228,226,220,.55)'); drawRows(c, ART.ground, x, GROUND + 8, 'rgba(228,226,220,.3)'); }
    // where the player starts
    c.fillStyle = 'rgba(255,90,31,.5)'; for (let y = GROUND - 30; y < GROUND - 10; y += 2) c.fillRect(D.player.startX - cx, y, 1, 1);
    drawRows(c, ART.crab, D.player.startX - cx - 4, GROUND - 8, '#ff5a1f');
    const txt = 'X ' + String(Math.round(ed.camX + VW / 2)).padStart(4, '0'), w = textRows(txt)[0].length;
    c.fillStyle = '#000'; c.fillRect(VW - w - 4, 0, w + 4, 8); drawText(c, txt, VW - w - 2, 2, GREEN);
    present(off, view, VW, VH);
  }
  const toWorld = (e) => { const r = view.getBoundingClientRect(); return { wx: (e.clientX - r.left) / r.width * VW + ed.camX, wy: (e.clientY - r.top) / r.height * VH }; };
  function levelTap(e) {
    const L = scene(), GROUND = data().screen.ground, { wx, wy } = toWorld(e), hit = hitItem(L, wx, wy, GROUND);
    if (ed.tool === 'erase') { if (hit && hit.list !== 'start') { changeLevel(L2 => { if (hit.list === 'exit') delete L2.exit; else L2[hit.list].splice(hit.index, 1); }); ed.lsel = null; } rerender(); return; }
    if (ed.tool === 'place') {
      const d = placeDef(ed.placeType); if (!d) return;
      const x = Math.max(0, Math.min(L.width - 1, Math.round(wx)));
      changeLevel(L2 => {
        if (d.list === 'start') L2.start = { x };
        else if (d.list === 'exit') L2.exit = { x };
        else if (d.list === 'checkpoints') { (L2.checkpoints = L2.checkpoints || []).push({ x }); L2.checkpoints.sort((a, b) => a.x - b.x); }
        else if (d.list === 'enemies') L2.things.push({ obj: d.type, x, h: Math.max(d.height[0], Math.min(d.height[1], Math.round(GROUND - wy - (d.actor ? 0 : 0)))) });
        else L2.things.push({ obj: d.type, x: Math.round(x - d.w / 2) });
      });
      rerender(); return;
    }
    ed.lsel = hit; rerender();
  }
  function sceneTap(e) {
    if (scene().kind === 'level') return levelTap(e);
    const r = view.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * VW + ed.camX, wy = (e.clientY - r.top) / r.height * VH;
    const D = data(), sc = ed.game.schema.scene, SP = D.beach.propSpacing, i0 = Math.floor((wx - 80) / SP) - 1;
    let hit = null;
    for (let i = i0; i <= i0 + 3; i++) { const p = propAt(i, D, sc); if (p && wx >= p.x && wx < p.x + p.w && wy >= D.screen.ground + 1 - p.h) hit = p; }
    ed.sel = hit; rerender();
  }

  // ---------------------------------------------------------------- Background: one plane per layer
  function planeArt(id, D) {
    const c = document.createElement('canvas'); c.width = 120; c.height = 64; const g2 = c.getContext('2d'), col = BG_COLORS[id];
    if (id === 'sun') drawRows(g2, ART.sun, 92, 6, col);
    if (id === 'cloudsFar' || id === 'cloudsNear') {
      const L = D.backdrop.clouds[id === 'cloudsFar' ? 0 : 1], step = Math.max(14, L.spacing / 4), r = mulberry(L.seed);
      for (let x = 4; x < 112; x += step) drawRows(g2, ART.cloud, Math.round(x), 4 + Math.round(r() * (id === 'cloudsFar' ? 10 : 22)), col);
    }
    if (id === 'gulls') for (let k = 0; k < D.backdrop.gulls.count; k++) drawRows(g2, ART.gull, 14 + k * 30 % 96, 12 + k * 7 % 22, col);
    if (id === 'city') {
      const r = mulberry(42); let x = 0;
      while (x < 120) { const w = 4 + (r() * 6 | 0), h = 5 + (r() * 14 | 0); g2.fillStyle = col; g2.fillRect(x, 44 - h, w, h); g2.fillStyle = '#000'; for (let y = 46 - h; y < 42; y += 3) for (let k = x + 1; k < x + w - 1; k += 2) g2.fillRect(k, y, 1, 1); x += w + 1; }
    }
    if (id === 'sea') for (let x = 0; x < 120; x += 16) { drawRows(g2, ART.wave, x, 46, col); drawRows(g2, ART.wave, x + 8, 51, col); }
    if (id === 'boat') drawRows(g2, ART.boat, 40, 39, col);
    if (id === 'sand') for (let x = 0; x < 120; x += 8) drawRows(g2, ART.ground, x, 56, col);
    return c;
  }
  const GAP = 26;
  const planeZ = (i, n, on) => i * GAP - (n - 1) * GAP / 2 + (on ? 8 : 0);
  const tabText = (l, i) => `${String(i + 1).padStart(2, '0')}  ${l.name}  ×${l.fields[0] ? +(+val(l.fields[0].path)).toFixed(2) : 1}`;
  function bgHtml() {
    const layers = ed.game.schema.background, n = layers.length;
    return layers.map((l, i) => {
      const on = l.id === ed.bg;
      return `<button class="plane${on ? ' on' : ''}" data-plane="${l.id}" ${A(() => { if (dragged || ed.combined) return; ed.bg = l.id; refreshBg(); })} aria-pressed="${on}" aria-label="Layer ${i + 1}, ${esc(l.name)}"
        style="transform:translateZ(${ed.fanned && !ed.combined ? planeZ(i, n, on) : 0}px);transition-delay:${i * 28}ms,0ms,0ms,0ms">
        <span class="ptab">${esc(tabText(l, i))}</span><span class="pc" data-layer="${l.id}"></span></button>`;
    }).join('');
  }
  // update the stack in place: planes glide to their new spots, and only the panel below is redrawn
  function refreshBg() {
    const root = document.querySelector('.screen-tool'); if (!root || ed.tab !== 'background') return rerender();
    const layers = ed.game.schema.background, D = data();
    layers.forEach((l, i) => {
      const el = root.querySelector(`[data-plane="${l.id}"]`); if (!el) return;
      const on = l.id === ed.bg;
      el.classList.toggle('on', on); el.setAttribute('aria-pressed', on);
      el.style.transform = ed.combined ? 'translateZ(0px)' : `translateZ(${planeZ(i, layers.length, on)}px)`;
      el.style.transitionDelay = `${(ed.combined ? layers.length - 1 - i : i) * 28}ms,0ms,0ms,0ms`;
      el.querySelector('.ptab').textContent = tabText(l, i);
      const pc = el.querySelector('.pc'); pc.innerHTML = ''; pc.appendChild(planeArt(l.id, D));
    });
    const rig = root.querySelector('.rig');
    if (rig) { rig.classList.toggle('flat', !!ed.combined); rig.style.transform = ed.combined ? 'rotateX(0deg) rotateZ(0deg) scale(1.3)' : `rotateX(${ed.pitch}deg) rotateZ(${ed.yaw}deg)`; }
    const btn = root.querySelector('#combine'); if (btn) { btn.querySelector('.lbl').textContent = ed.combined ? 'Spread' : 'Combine'; btn.setAttribute('aria-pressed', !!ed.combined); }
    const hint = root.querySelector('#stkhint'); if (hint) hint.textContent = ed.combined ? 'All layers together, facing forward' : 'Drag to tilt · tap a layer';
    const panel = root.querySelector('.inspector'); if (panel) panel.outerHTML = bgPanel();
  }

  function bgPanel() {
    const schema = ed.game.schema, l = schema.background.find(x => x.id === ed.bg), i = schema.background.indexOf(l);
    return `<div class="plate inspector gap20">
          <div class="ihead">${well(40, svgRows(BG_ART[l.id] || ART.sun, GREEN))}<span class="t"><span class="title acc ell">${esc(l.name)}</span><span class="sub">Background layer ${i + 1} of ${schema.background.length}</span></span>
            ${iconBtn('down', A(() => { ed.bg = schema.background[Math.max(0, i - 1)].id; refreshBg(); }), { color: '#fff', label: 'Layer behind' })}${iconBtn('up', A(() => { ed.bg = schema.background[Math.min(schema.background.length - 1, i + 1)].id; refreshBg(); }), { color: '#fff', label: 'Layer in front' })}</div>
          ${l.fields.length ? l.fields.map(field).join('') : `<div class="grow"><span class="sub">Moves with the world, like the player.</span></div>`}</div>`;
  }

  // ---------------------------------------------------------------- Objects: the templates, and the behaviors they're made of
  const PALETTE_COLORS = ['#ff5a1f', '#ffd23f', '#7dff6a', '#4d7cff', '#ff4fd8', '#e4e2dc', '#8f8d88', '#d25855', '#6aaa9f', '#e7b44c'];
  const COLOR_NAMES = ['ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PINK', 'BONE', 'GRAY', 'RED', 'TEAL', 'GOLD'];
  const BEH = () => ed.game.behaviors || {};
  // jump to this object's picture in the Art tab (a built-in's own art, or an actor's symbol)
  function artJump(o) {
    const folders = ((ed.game.schema.art || {}).folders || []);
    let f = null, item = null;
    for (const x of folders) for (const it of x.items) if (it.object === o.base) { f = x.id; item = it.id; }
    if (!item && o.symbol && (ed.game.symbols || {})[o.symbol] && isActor(o)) { f = 'symbols'; item = 'sym:' + o.symbol; }
    if (!item) return '';
    return bareBtn('sprites', 'Art', A(() => { app.ui.artFolder = f; app.ui.artSel = item; app.saveUI(); app.setTab(2); }));
  }
  function objectsPanel() {
    const all = objects(), ids = Object.keys(all);
    if (ed.obj && !all[ed.obj]) ed.obj = null;
    if (!ed.obj) {
      // the list: every object, with how many copies are placed
      const per = 5, pages = Math.max(1, Math.ceil(ids.length / per)), pg = Math.min(ed.objPage, pages - 1), slice = ids.slice(pg * per, pg * per + per);
      const rowsHtml = slice.map(id => {
        const o = all[id], k = placedCount(id), kind = isActor(o) ? (o.behaviors || []).length + ' behaviors' : 'Built in · ' + o.base;
        return `<button class="orow" ${A(() => { ed.obj = id; ed.addingBehavior = false; rerender(); })}>${well(40, svgRows(glyph(o.symbol || o.base), o.color || BONE))}<span class="t"><span class="title ell" style="font-size:14px">${esc(o.name)}</span><span class="sub">${esc(kind)}</span></span><span class="cap" style="color:var(--muted)">${k} placed</span></button>`;
      }).join('');
      return `<div class="plate bar gap20" style="flex:none">
          <span class="cap" style="color:var(--muted);padding-left:10px">Objects · ${ids.length}</span>
          <div style="display:flex;align-items:center;gap:2px">
            ${iconBtn('left', A(() => { ed.objPage = Math.max(0, pg - 1); rerender(); }), { color: '#fff', label: 'Previous page' })}<span class="cap acc" style="min-width:30px;text-align:center">${pg + 1}/${pages}</span>${iconBtn('right', A(() => { ed.objPage = Math.min(pages - 1, pg + 1); rerender(); }), { color: '#fff', label: 'Next page' })}
            ${bareBtn('plus', 'New', A(() => {
              let n = 1; while (all['object' + n]) n++;
              const id = 'object' + n;
              changeObjects(o => { o[id] = { name: 'Object ' + n, base: 'actor', symbol: 'blob', color: '#ff5a1f', scale: 2, behaviors: [{ type: 'hover' }, { type: 'touchDamage' }] }; });
              ed.obj = id; rerender();
            }))}
          </div></div>
        <div class="plate inspector" style="margin-top:8px">${rowsHtml}
          <div class="grow"><span class="t"><span class="sub">An object is a template. Place copies in any level; change the object and every copy changes.</span></span></div></div>`;
    }
    // one object
    const id = ed.obj, o = all[id], actor = isActor(o), k = placedCount(id);
    const setObj = (fn) => { changeObjects(all2 => fn(all2[id])); rerender(); };
    const cyc = (label, help, list, cur, show, onPick) => { const i = Math.max(0, list.indexOf(cur)); return `<div class="grow"><span class="t"><span class="cap">${label}</span><span class="sub">${help}</span></span>${stepper(show(cur), A(() => onPick(list[(i - 1 + list.length) % list.length])), A(() => onPick(list[(i + 1) % list.length])), label)}</div>`; };
    const symbols = Object.keys(ed.game.symbols || {});
    let rows = '';
    rows += cyc('Color', 'Its color in the Studio' + (actor ? ' and in the game' : ''), PALETTE_COLORS, o.color, c => COLOR_NAMES[PALETTE_COLORS.indexOf(c)] || 'CUSTOM', c => setObj(x => { x.color = c; }));
    if (actor) {
      rows += cyc('Symbol', 'The pixel shape it uses', symbols, o.symbol, c => c, c => setObj(x => { x.symbol = c; }));
      rows += cyc('Size', 'How many screen pixels per symbol pixel', [1, 2, 3, 4], o.scale || 2, c => c + '×', c => setObj(x => { x.scale = c; }));
      // its behaviors, each with its own settings
      (o.behaviors || []).forEach((bh, bi) => {
        const def = BEH()[bh.type] || { name: bh.type, help: '', params: {} };
        rows += `<div class="bhead"><span class="t"><span class="cap acc">${esc(def.name)}</span><span class="sub">${esc(def.help)}</span></span>${iconBtn('trash', A(() => setObj(x => { x.behaviors.splice(bi, 1); })), { label: 'Remove ' + def.name })}</div>`;
        for (const [pk, pdef] of Object.entries(def.params || {})) {
          const v = bh[pk] ?? pdef.default, f = { ...pdef, path: '' };
          const show = pdef.show === 'onoff' ? (v ? 'ON' : 'OFF') : fmt(f, v);
          rows += `<div class="grow"><span class="t"><span class="cap">${esc(pdef.label)}</span><span class="sub">${esc(pdef.help)}</span></span>${stepper(show, A(() => setObj(x => { x.behaviors[bi][pk] = pdef.show === 'onoff' ? (v ? 0 : 1) : nudge(f, v, -1); })), A(() => setObj(x => { x.behaviors[bi][pk] = pdef.show === 'onoff' ? (v ? 0 : 1) : nudge(f, v, 1); })), pdef.label)}</div>`;
        }
      });
      rows += `<div class="grow"><span class="t"><span class="sub">Its symbol is in Art, under Symbols.</span></span>${artJump(o)}</div>`;
      if (ed.addingBehavior) {
        const have = new Set((o.behaviors || []).map(b => b.type));
        rows += `<div class="bhead"><span class="t"><span class="cap acc">Add a behavior</span><span class="sub">Tap one to add it</span></span>${iconBtn('back', A(() => { ed.addingBehavior = false; rerender(); }), { color: '#fff', label: 'Cancel' })}</div>`;
        for (const [bk, def] of Object.entries(BEH())) if (!have.has(bk)) rows += `<button class="orow" ${A(() => { ed.addingBehavior = false; setObj(x => { (x.behaviors = x.behaviors || []).push({ type: bk }); }); })}><span class="t"><span class="cap">${esc(def.name)}</span><span class="sub" style="white-space:normal">${esc(def.help)}</span></span>${well(28, svgRows(G.plus, BONE))}</button>`;
      } else rows += `<div class="grow">${bareBtn('plus', 'Add behavior', A(() => { ed.addingBehavior = true; rerender(); }))}</div>`;
    } else if (o.base === 'eye') {
      // an eye object can change any of the game's eye settings just for itself
      const grp = ed.game.schema.groups.find(x => x.id === 'eyes');
      rows += `<div class="bhead"><span class="t"><span class="cap acc">Eye settings</span><span class="sub">Green ones differ from the game's usual eye</span></span></div>`;
      for (const f of grp ? grp.fields : []) {
        const key = f.path.replace(/^eyes\./, ''), base = games.getPath(data(), f.path), mine = games.getPath(o.settings || {}, key), v = mine ?? base;
        const put = (nv) => setObj(x => { x.settings = x.settings || {}; const ks = key.split('.'); if (ks.length === 2) { x.settings[ks[0]] = [...(x.settings[ks[0]] || games.getPath(data(), 'eyes.' + ks[0]))]; x.settings[ks[0]][+ks[1]] = nv; } else x.settings[key] = nv; });
        rows += `<div class="grow"><span class="t"><span class="cap" style="color:${mine !== undefined ? GREEN : 'var(--text)'}">${esc(f.label)}</span><span class="sub">${esc(f.help)}</span></span>${stepper(fmt(f, v), A(() => put(nudge(f, v, -1))), A(() => put(nudge(f, v, 1))), f.label)}</div>`;
      }
    } else rows += `<div class="grow"><span class="t"><span class="sub">Built in: the game draws it with its own art${o.base === 'castle' ? ', and the player can stand on it' : ''}.</span></span>${artJump(o)}</div>`;
    return `<div class="plate bar gap20" style="flex:none">
        ${iconBtn('back', A(() => { ed.obj = null; ed.addingBehavior = false; rerender(); }), { color: '#fff', label: 'All objects' })}
        <button style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;text-align:left" ${A(() => { const nm = prompt('Object name', o.name); if (nm && nm.trim()) setObj(x => { x.name = nm.trim().slice(0, 20); }); })} aria-label="Rename ${esc(o.name)}">
          ${well(28, svgRows(glyph(o.symbol || o.base), o.color || BONE))}<span style="display:flex;flex-direction:column;min-width:0"><span class="title ell" style="font-size:14px">${esc(o.name)}</span><span class="sub">${k} placed · tap to rename</span></span></button>
        ${iconBtn('dup', A(() => { let n = 2; while (all[id + n]) n++; changeObjects(a2 => { a2[id + n] = { ...structuredClone(o), name: (o.name + ' ' + n).slice(0, 20) }; }); ed.obj = id + n; rerender(); }), { label: 'Copy ' + o.name })}
        ${iconBtn('trash', A(() => {
          if (!confirm(k ? `Delete ${o.name}? Its ${k} placed ${k === 1 ? 'copy goes' : 'copies go'} too.` : `Delete ${o.name}?`)) return;
          record();
          const list = structuredClone(scenes());
          for (const L of list) if (L.kind === 'level') { L.things = thingsOf(L).filter(t => t.obj !== id); delete L.props; delete L.enemies; }
          const o2 = structuredClone(all); delete o2[id];
          games.setValue(folder, 'scenes', list); games.setValue(folder, 'objects', o2); ed.obj = null; rerender();
        }), { label: 'Delete ' + o.name })}
      </div>
      <div class="plate inspector" style="margin-top:8px">${rows}</div>`;
  }

  // ---------------------------------------------------------------- the screen
  // the Backdrop is a second view of the Scene tab (the switch is in the corner of the screen)
  const TABS = [['scene', 'Scene', 'scene'], ['objects', 'Objects', 'objects'], ['settings', 'Settings', 'controller']];
  const tabOf = () => (ed.tab === 'background' ? 'scene' : ed.tab);
  // switch between the scene and its backdrop layers (a button at the start of the bar under the screen)
  const viewSwitch = (toBg) => iconBtn(toBg ? 'display' : 'scene', A(() => { ed.tab = toBg ? 'background' : 'scene'; ed.fanned = false; app.ui.geTab = ed.tab; app.saveUI(); rerender(); }), { label: toBg ? 'Backdrop' : 'Back to the scene', color: '#fff' });
  const ov = {
    render() {
      if (!ed.game) return `<div class="screen-tool" style="--acc:${GREEN}"><div class="plate bar">${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back' })}<span class="title" style="flex:1">${esc(g.name)}</span></div>
        <div class="center-note"><span class="sub">${ed.error ? 'Could not load the game settings: ' + esc(ed.error) : 'Loading…'}</span></div></div>`;
      const n = games.editCount(folder), schema = ed.game.schema;
      let screen = '', panel = '';
      if (ed.tab === 'scene') {
        const sc = schema.scene, cur = scene(), list = scenes(), si = Math.max(0, list.findIndex(x => x.id === cur.id)), isLevel = cur.kind === 'level';
        const go = (k) => { ed.scene = list[(si + k + list.length) % list.length].id; ed.camX = null; ed.lsel = null; ed.sel = null; rerender(); };
        screen = `<div class="screen fit gap20"><canvas class="pix" id="scn" style="aspect-ratio:160/144;cursor:grab" aria-label="${isLevel ? 'The level, drawn as symbols. Drag to move along it.' : 'The scene, drawn as symbols. Drag to move along it, tap a prop to see it.'}" role="img"></canvas></div>`;
        const toolbar = `<div class="plate bar" role="toolbar" aria-label="Scenes and tools">
          <div style="display:flex;gap:6px;align-items:center">${viewSwitch(true)}<span class="vsep"></span>${isLevel ? [['select', 'Select'], ['place', 'Place'], ['erase', 'Erase']].map(([k, l]) => iconBtn(k, A(() => { ed.tool = k; if (k !== 'select') ed.lsel = null; rerender(); }), { on: ed.tool === k, label: l, pressed: ed.tool === k })).join('') : `<span class="cap" style="color:var(--muted);padding-left:4px">Waves · props by rule</span>`}</div>
          <div style="display:flex;align-items:center;gap:2px">
            ${iconBtn('left', A(() => go(-1)), { color: '#fff', label: 'Previous scene' })}<span class="cap acc" style="min-width:34px;text-align:center" aria-label="Scene ${si + 1} of ${list.length}">${si + 1}/${list.length}</span>${iconBtn('right', A(() => go(1)), { color: '#fff', label: 'Next scene' })}
            ${iconBtn('plus', A(() => {
              const n = list.filter(x => x.kind === 'level').length + 1, id = 'level-' + Date.now().toString(36);
              changeScenes(l2 => l2.push({ id, name: 'Level ' + n, ...structuredClone(sc.newLevel) }));
              ed.scene = id; ed.camX = null; ed.lsel = null; ed.tool = 'select'; rerender();
            }), { label: 'New level' })}
          </div></div>`;
        let body;
        if (!isLevel) {
          const s = ed.sel, grp = schema.groups.find(x => x.id === sc.fieldsGroup);
          body = `<div class="ihead">${well(40, svgRows(s ? ART[s.glyph] : ART.beach, GREEN))}<span class="t"><span class="title acc ell">${esc(s ? s.name : cur.name || sc.name)}</span><span class="sub">${esc(s ? 'Prop slot ' + s.i + ' · placed by the scatter rule' : sc.summary)}</span></span></div>
            ${grp ? grp.fields.map(field).join('') : ''}`;
        } else if (ed.tool === 'place') {
          const pd = placeDef(ed.placeType) || placeList()[0]; if (pd) ed.placeType = pd.type;
          body = `<div class="ihead">${well(40, svgRows(glyph(pd.glyph), GREEN))}<span class="t"><span class="title acc ell">Place · ${esc(pd.name)}</span><span class="sub">Tap the level to put one there</span></span></div>
            <div class="tray" style="margin-top:4px">${placeList().map(d => { const on = d.type === ed.placeType, g2 = glyph(d.glyph); return `<button class="${on ? 'on' : ''}" aria-pressed="${on}" ${A(() => { ed.placeType = d.type; rerender(); })}>${well(40, (on ? '<span class="ring"></span>' : '') + (on ? `<span class="art-on">${svgRows(g2, GREEN)}</span><span class="art-off">${svgRows(g2, d.color)}</span>` : svgRows(g2, d.color)))}<span class="cap">${esc(d.name)}</span></button>`; }).join('')}</div>`;
        } else if (ed.lsel) {
          const it = itemsOf(cur).find(x => sameItem(x, ed.lsel));
          if (!it) { ed.lsel = null; body = ''; }
          else {
            const d = it.def, move = (k, v) => changeLevel(L2 => { const o = it.list === 'start' || it.list === 'exit' ? L2[it.list] : L2[it.list][it.index]; o[k] = v; if (it.list === 'checkpoints') L2.checkpoints.sort((a, b) => a.x - b.x); });
            const num = (label, help, v, step, lo, hi, k) => `<div class="grow"><span class="t"><span class="cap">${label}</span><span class="sub">${help}</span></span>${stepper(String(v), A(() => move(k, Math.max(lo, v - step))), A(() => move(k, Math.min(hi, v + step))), label)}</div>`;
            const isThing = it.list === 'things', tid = isThing ? thingsOf(cur)[it.index].obj : null;
            body = `<div class="ihead">${well(40, svgRows(glyph(d.glyph), GREEN))}<span class="t"><span class="title acc ell">${esc(d.name)}</span><span class="sub">${isThing ? 'A copy · drag it to move it' : 'Drag it to move it'}</span></span>
                ${isThing ? iconBtn('edit', A(() => { ed.tab = 'objects'; ed.obj = tid; app.ui.geTab = 'objects'; app.saveUI(); rerender(); }), { label: 'Edit the ' + d.name + ' object' }) : ''}
                ${it.list !== 'start' ? iconBtn('trash', A(() => { changeLevel(L2 => { if (it.list === 'exit') delete L2.exit; else L2[it.list].splice(it.index, 1); }); ed.lsel = null; rerender(); }), { label: 'Remove ' + d.name }) : ''}</div>
              ${num('Across', 'Pixels from the left of the level', it.x, 4, 0, cur.width - 1, 'x')}
              ${d.height ? num('Height', 'Pixels above the ground', it.h, 2, d.height[0], d.height[1], 'h') : ''}`;
          }
        }
        if (isLevel && !body) {
          const setL = (fn) => { changeLevel(fn); rerender(); };
          body = `<div class="ihead">${well(40, svgRows(ART.level, GREEN))}<span class="t"><span class="title acc ell">${esc(cur.name)}</span><span class="sub">Level · ${itemsOf(cur).length} things · ${cur.width} px</span></span>
              ${iconBtn('rename', A(() => { const n = prompt('Level name', cur.name); if (n && n.trim()) setL(L2 => { L2.name = n.trim().slice(0, 24); }); }), { label: 'Rename level' })}
              ${iconBtn('trash', A(() => { if (!confirm('Delete ' + cur.name + '?')) return; changeScenes(l2 => { const i = l2.findIndex(x => x.id === cur.id); if (i > 0) l2.splice(i, 1); }); ed.scene = null; ed.camX = null; rerender(); }), { label: 'Delete level' })}</div>
            <div class="grow"><span class="t"><span class="cap">Width</span><span class="sub">How long the level is, in pixels</span></span>${stepper(String(cur.width), A(() => setL(L2 => { L2.width = Math.max(160, L2.width - 32); })), A(() => setL(L2 => { L2.width = Math.min(4000, L2.width + 32); })), 'Width')}</div>
            <div class="grow"><span class="t"><span class="cap">Tip</span><span class="sub">Select a thing to move it, Place to add, Erase to remove. Play starts this level.</span></span></div>`;
        }
        panel = `${toolbar}<div class="plate inspector gap20">${body}</div>`;
      } else if (ed.tab === 'objects') {
        panel = objectsPanel(n);
      } else if (ed.tab === 'background') {
        screen = `<div class="screen fit gap20 stack" id="stk" style="perspective:1100px;touch-action:none;cursor:grab"><div class="rig${ed.combined ? ' flat' : ''}" style="transform:${ed.combined ? 'rotateX(0deg) rotateZ(0deg) scale(1.3)' : `rotateX(${ed.pitch}deg) rotateZ(${ed.yaw}deg)`}">${bgHtml()}</div>
          <span class="cap" id="stkhint" style="position:absolute;left:18px;top:14px;font-size:9px;color:#6f6d69;pointer-events:none">${ed.combined ? 'All layers together, facing forward' : 'Drag to tilt · tap a layer'}</span>
          <button class="btn bare" id="combine" aria-pressed="${!!ed.combined}" style="position:absolute;right:8px;bottom:6px" ${A(() => { ed.combined = !ed.combined; refreshBg(); })}>${well(28, svgRows(G.grid, BONE))}<span class="lbl">${ed.combined ? 'Spread' : 'Combine'}</span></button></div>`;
        panel = `<div class="plate bar" role="toolbar" aria-label="Backdrop">
          <div style="display:flex;gap:6px;align-items:center">${viewSwitch(false)}<span class="vsep"></span><span class="cap acc" style="padding-left:4px">Backdrop · ${schema.background.length} layers</span></div></div>${bgPanel()}`;
      } else {
        const groups = schema.groups, k = Math.min(ed.group, groups.length - 1), gr = groups[k];
        panel = `<div class="plate bar gap20" style="flex:none">
            ${iconBtn('left', A(() => { ed.group = (k + groups.length - 1) % groups.length; rerender(); }), { color: '#fff', label: 'Previous group' })}
            <span style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center"><span class="cap acc">${esc(gr.name)}</span><span class="sub" style="font-size:11px">${gr.scope === 'universal' ? 'Every game has these' : esc(g.name) + ' extras'} · ${k + 1}/${groups.length}</span></span>
            ${iconBtn('right', A(() => { ed.group = (k + 1) % groups.length; rerender(); }), { color: '#fff', label: 'Next group' })}
          </div>
          <div class="plate inspector" style="margin-top:8px">${gr.fields.map(field).join('')}
            ${n ? `<div class="grow"><span class="t"><span class="cap">Start over</span><span class="sub">Put all ${n} changes back to the version on GitHub</span></span>${bareBtn('reset', 'Reset', A(() => { if (confirm('Put all ' + n + ' changes to ' + g.name + ' back to the GitHub version? Undo can bring them back.')) { record(); games.resetEdits(folder); rerender(); } }))}</div>` : ''}</div>`;
      }
      return `<div class="screen-tool" style="--acc:${GREEN}">
        <h1 class="sr">Studio · ${esc(g.name)}</h1>
        ${topBar()}
        <div class="plate bar" role="tablist" style="display:grid;grid-template-columns:${TABS.map(([k2]) => (tabOf() === k2 ? '2.4fr' : '1fr')).join(' ')};gap:4px">
          ${TABS.map(([k2, l2, ic]) => { const on = tabOf() === k2; return `<button class="seg${on ? ' on' : ''}" role="tab" aria-selected="${on}" aria-label="${l2}" ${A(() => { ed.tab = k2; ed.fanned = false; app.ui.geTab = k2; app.saveUI(); rerender(); })}>${well(28, svgRows(G[ic], on ? GREEN : BONE))}${on ? l2 + '<span class="selring"></span>' : ''}</button>`; }).join('')}
        </div>
        ${screen}${panel}
      </div>`;
    },
    mount(root) {
      if (!ed.game) return;
      if (ed.tab === 'scene') {
        view = root.querySelector('#scn');
        const r = view.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        view.width = Math.round(r.width * dpr) || 320; view.height = Math.round(r.height * dpr) || 288;
        if (!off) { off = document.createElement('canvas'); off.width = VW; off.height = VH; octx = off.getContext('2d'); }
        view.addEventListener('pointerdown', (e) => {
          view.setPointerCapture(e.pointerId); dragged = false;
          drag = { x: e.clientX, y: e.clientY, cam: ed.camX };
          // grabbing the selected thing moves it
          if (scene().kind === 'level' && ed.tool === 'select' && ed.lsel) {
            const L = scene(), { wx, wy } = toWorld(e), hit = hitItem(L, wx, wy, data().screen.ground);
            if (sameItem(hit, ed.lsel)) drag.item = { it: hit, x: hit.x, h: hit.h };
          }
        });
        view.addEventListener('pointermove', (e) => {
          if (!drag) return;
          const px = view.getBoundingClientRect().width / VW, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (!dragged && Math.abs(dx) + Math.abs(dy) < 5) return;
          dragged = true;
          if (drag.item) {
            const L = scene(), it = drag.item.it, nx = Math.max(0, Math.min(L.width - 1, Math.round(drag.item.x + dx / px)));
            const d = it.def, nh = d.height ? Math.max(d.height[0], Math.min(d.height[1], Math.round(drag.item.h - dy / px))) : undefined;
            drag.item.nx = nx; drag.item.nh = nh;
            // draw the move live, save it when the finger lifts
            const L2 = structuredClone(L);
            if (it.list === 'start' || it.list === 'exit') L2[it.list].x = nx; else { L2[it.list][it.index].x = nx; if (nh !== undefined) L2[it.list][it.index].h = nh; }
            drawLevel(L2); return;
          }
          ed.camX = drag.cam - dx / px; drawScene();
        });
        view.addEventListener('pointerup', (e) => {
          if (drag && drag.item && drag.item.nx !== undefined) {
            const it = drag.item.it, nx = drag.item.nx, nh = drag.item.nh;
            changeLevel(L2 => { if (it.list === 'start' || it.list === 'exit') L2[it.list].x = nx; else { L2[it.list][it.index].x = nx; if (nh !== undefined) L2[it.list][it.index].h = nh; if (it.list === 'checkpoints') L2.checkpoints.sort((a, b) => a.x - b.x); } });
            drag = null; setTimeout(() => { dragged = false; }, 0); rerender(); return;
          }
          if (drag && !dragged) sceneTap(e); drag = null; setTimeout(() => { dragged = false; }, 0);
        });
        drawScene();
      }
      if (ed.tab === 'background') {
        const D = data();
        root.querySelectorAll('[data-layer]').forEach(el => el.appendChild(planeArt(el.dataset.layer, D)));
        if (!ed.fanned) { ed.fanned = true; requestAnimationFrame(() => requestAnimationFrame(() => refreshBg())); }
        const stk = root.querySelector('#stk');
        stk.addEventListener('pointerdown', (e) => { if (ed.combined || e.target.closest('#combine,.viewsw')) return; drag = { x: e.clientX, y: e.clientY, yaw: ed.yaw, pitch: ed.pitch }; dragged = false; });
        stk.addEventListener('pointermove', (e) => {
          if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (!dragged && Math.abs(dx) + Math.abs(dy) < 6) return;
          dragged = true; ed.dragging = true;
          ed.yaw = Math.max(-80, Math.min(80, drag.yaw + dx * 0.35)); ed.pitch = Math.max(15, Math.min(75, drag.pitch - dy * 0.3));
          const rig = stk.querySelector('.rig'); rig.style.transition = 'transform .08s linear'; rig.style.transform = `rotateX(${ed.pitch}deg) rotateZ(${ed.yaw}deg)`;
        });
        const up = () => { drag = null; ed.dragging = false; const rig = stk.querySelector('.rig'); if (rig) rig.style.transition = ''; setTimeout(() => { dragged = false; }, 0); };
        stk.addEventListener('pointerup', up); stk.addEventListener('pointercancel', up); stk.addEventListener('pointerleave', up);
      }
    },
    frame() { if (input.pressed('b')) app.close(); else if (input.pressed('start')) games.launch(g); }
  };
  ov.onClose = () => { if (app.settings.autoPush && games.getEdits(folder).dirty) pushAll(app, true); };
  app.open(ov);
}
