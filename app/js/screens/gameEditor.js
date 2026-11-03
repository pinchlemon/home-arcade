// Editor for a repo game that has a game.json, like Crab Platformer.
// Scene: the whole scene at once, drawn as simple pixel symbols (not the real art).
// Background: the backdrop as a stack of planes, one per layer, spaced evenly; tilt it, tap a layer to adjust it.
// Settings: every number the game exposes, in groups. Universal groups work the same for any game; the rest are this game's extras.
import { well, icon, svgRows, G, drawRows, drawText, textRows, present } from '../pixel.js';
import { A, esc, iconBtn, bareBtn, stepper } from '../ui.js';
import * as games from '../games.js';
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
  const ed = { tab: app.ui.geTab || 'scene', zoom: 1, scene: null, tool: 'select', placeType: 'palm', lsel: null, group: 0, bg: 'city', camX: null, pitch: 58, yaw: -32, dragging: false, sel: null, game: null, error: null };
  let view = null, off = null, octx = null, drag = null, dragged = false;
  const folder = g.file;
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
  // ---- the scene view: 1 game pixel per pixel at 1×; zooming out shows 2× or 4× more of the world, ground kept at the bottom
  const SW = () => VW * ed.zoom, SH = () => VH * ed.zoom, OYZ = () => SH() - VH;
  // a symbol scaled up to about the real size of the thing it stands for, so the map reads like a zoomed-out real one
  function symScale(rows, w, h) { const r = Math.min(w / rows[0].length, h / rows.length); return r >= 1.5 ? Math.max(2, Math.floor(r)) : 1; }
  function drawSym(c, rows, x, bottom, s, color) {
    c.fillStyle = color; const top = bottom - rows.length * s;
    for (let r = 0; r < rows.length; r++) for (let k = 0; k < rows[r].length; k++) if (rows[r][k] === '1') c.fillRect(x + k * s, top + r * s, s, s);
  }
  function dashBox(c, x, top, w, bottom, color) {
    c.fillStyle = color;
    for (let k = 0; k < w; k += 2) { c.fillRect(x + k, top, 1, 1); c.fillRect(x + k, bottom, 1, 1); }
    for (let k = 0; k < bottom - top; k += 2) { c.fillRect(x, top + k, 1, 1); c.fillRect(x + w - 1, top + k, 1, 1); }
  }
  // the position readout stays the same size on screen at any zoom
  function readout(c, txt) {
    const w = textRows(txt)[0].length, t = document.createElement('canvas'); t.width = w + 4; t.height = 8;
    const g2 = t.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, w + 4, 8); drawText(g2, txt, 2, 2, GREEN);
    c.imageSmoothingEnabled = false; c.drawImage(t, SW() - (w + 4) * ed.zoom, 0, (w + 4) * ed.zoom, 8 * ed.zoom);
  }
  // ---- scenes: the first is the endless Waves beach; Level scenes are laid out by hand
  const scenes = () => data().scenes || [{ id: 'main', name: ed.game.schema.scene.name, kind: 'waves' }];
  const scene = () => { const l = scenes(); return l.find(x => x.id === ed.scene) || l[0]; };
  const levelItems = () => ed.game.schema.scene.levelItems || [];
  const itemDef = (type) => levelItems().find(d => d.type === type);
  // every thing in a level as one list: { def, list, index, x, h }
  function itemsOf(L) {
    const out = [];
    (L.props || []).forEach((p, i) => { const d = itemDef(p.type); if (d) out.push({ def: d, list: 'props', index: i, x: p.x }); });
    (L.enemies || []).forEach((p, i) => { const d = itemDef(p.type); if (d) out.push({ def: d, list: 'enemies', index: i, x: p.x, h: p.h }); });
    (L.checkpoints || []).forEach((p, i) => out.push({ def: itemDef('checkpoint'), list: 'checkpoints', index: i, x: p.x }));
    if (L.exit) out.push({ def: itemDef('exit'), list: 'exit', index: 0, x: L.exit.x });
    if (L.start) out.push({ def: itemDef('start'), list: 'start', index: 0, x: L.start.x });
    return out.filter(it => it.def);
  }
  // where a thing sits on screen: props and flags stand on the sand, eyes float h pixels up, the start is centred on its x
  function boxOf(it, GROUND) {
    const d = it.def, x0 = d.list === 'start' ? it.x - d.w / 2 : d.list === 'enemies' ? it.x - d.w / 2 : it.x;
    const y1 = d.list === 'enemies' ? GROUND - it.h + d.h / 2 : GROUND;
    return { x0, y0: y1 - d.h, x1: x0 + d.w, y1 };
  }
  function changeScenes(fn) { const list = structuredClone(scenes()); fn(list); record(); games.setValue(folder, 'scenes', list); }
  function changeLevel(fn) { changeScenes(list => { const L = list.find(x => x.id === scene().id); if (L) fn(L); }); }
  const sameItem = (a, b) => a && b && a.list === b.list && a.index === b.index;
  function hitItem(L, wx, wy, GROUND) {
    let hit = null;
    for (const it of itemsOf(L)) { const b = boxOf(it, GROUND); if (wx >= b.x0 - 2 && wx <= b.x1 + 2 && wy >= b.y0 - 2 && wy <= b.y1 + 2) { if (!hit || (b.x1 - b.x0) < (boxOf(hit, GROUND).x1 - boxOf(hit, GROUND).x0)) hit = it; } }
    return hit;   // the smallest thing under the finger wins, so an eye in front of a palm is easy to pick
  }
  function drawLevel(L) {
    const D = data(), c = octx, GROUND = D.screen.ground, cx = Math.round(ed.camX);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, SW(), SH()); c.translate(0, OYZ());
    // outside the level: hatched
    c.fillStyle = '#1c1c20';
    for (let x = 0; x < SW(); x++) { const wx = x + cx; if (wx < 0 || wx >= L.width) for (let y = (wx & 3) - OYZ(); y < VH; y += 4) c.fillRect(x, y, 1, 1); }
    for (let x = -(((cx % 8) + 8) % 8); x < SW(); x += 8) { if (x + cx < 0 || x + cx >= L.width) continue; drawRows(c, ART.ground, x, GROUND, 'rgba(228,226,220,.55)'); drawRows(c, ART.ground, x, GROUND + 8, 'rgba(228,226,220,.3)'); }
    for (const it of itemsOf(L)) {
      const b = boxOf(it, GROUND), on = sameItem(it, ed.lsel), d = it.def, x = Math.round(b.x0 - cx), w = d.w, h = d.h, top = Math.round(b.y0);
      if (d.list === 'props') {
        const art = ART[d.glyph], k = symScale(art, w, h);
        if (on) dashBox(c, x, top, w, GROUND, GREEN);
        drawSym(c, art, Math.round(x + (w - art[0].length * k) / 2), GROUND, k, on ? GREEN : d.color);
        if (d.solid) for (const s2 of D.beach.castle.solids) { c.fillStyle = on ? GREEN : d.color; c.fillRect(x + s2.x0, GROUND + 1 - D.beach.castle.height + s2.top, s2.x1 - s2.x0, 1); }
      } else if (d.list === 'enemies') {
        // its wake-up range, faintly, then the symbol
        const wr = D.level ? D.level.wakeRange : 110;
        c.fillStyle = on ? 'rgba(125,255,106,.5)' : 'rgba(255,79,216,.35)';
        for (let k = -wr; k <= wr; k += 4) c.fillRect(Math.round(it.x - cx + k), GROUND - 2, 2, 1);
        const art = ART[d.glyph], k = symScale(art, d.w, d.h);
        drawSym(c, art, Math.round(it.x - cx - art[0].length * k / 2), Math.round(GROUND - it.h + art.length * k / 2), k, on ? GREEN : d.color);
      } else {
        const art = ART[d.glyph], k = symScale(art, d.w, d.h);
        drawSym(c, art, Math.round(d.list === 'start' ? it.x - cx - art[0].length * k / 2 : x), GROUND, k, on ? GREEN : d.color);
        if (d.list === 'start') { c.fillStyle = on ? GREEN : 'rgba(255,90,31,.5)'; for (let y = GROUND - 30; y < GROUND - 10; y += 2) c.fillRect(Math.round(it.x - cx), y, 1, 1); }
      }
      if (on) { c.fillStyle = GREEN; c.fillRect(Math.round(b.x0 - cx) - 1, Math.round(b.y1) + 1, Math.round(b.x1 - b.x0) + 2, 1); }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    readout(c, 'X ' + String(Math.round(ed.camX + SW() / 2)).padStart(4, '0') + ' / ' + L.width);
    present(off, view, SW(), SH());
  }
  // keep a level in view: centred when it all fits, otherwise no more than a sliver past either end
  function fitLevel() {
    const L = scene(); if (!L || L.kind !== 'level' || ed.camX == null) return;
    ed.camX = L.width <= SW() ? (L.width - SW()) / 2 : Math.max(-16, Math.min(L.width - SW() + 16, ed.camX));
  }
  function drawScene() {
    if (scene().kind === 'level') { const L = scene(); if (ed.camX == null) ed.camX = Math.max(-16, L.start.x - SW() / 2); return drawLevel(L); }
    const D = data(), sc = ed.game.schema.scene, c = octx, GROUND = D.screen.ground;
    if (ed.camX == null) ed.camX = D.player.startX - SW() / 2;
    const cx = Math.round(ed.camX);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, SW(), SH()); c.translate(0, OYZ());
    // where the eyes hover: a band above the sand
    const [lo, hi] = D.eyes.hoverHeight;
    for (let x = ((-cx % 4) + 4) % 4; x < SW(); x += 4) { c.fillStyle = 'rgba(255,79,216,.45)'; c.fillRect(x, GROUND - hi, 2, 1); c.fillRect(x, GROUND - lo, 2, 1); }
    for (const wx of [D.player.startX + 60, D.player.startX - 70]) drawSym(c, ART.eye, wx - cx - 8, GROUND - (lo + hi) / 2 + 8, 2, '#ff4fd8');
    // props from the scatter rule, each shown at its real size with its symbol at the base
    const SP = D.beach.propSpacing, i0 = Math.floor((cx - 80) / SP) - 1;
    for (let i = i0; i <= i0 + Math.ceil(SW() / SP) + 3; i++) {
      const p = propAt(i, D, sc); if (!p) continue;
      const x = p.x - cx, top = GROUND + 1 - p.h, on = ed.sel && ed.sel.i === i;
      const art = ART[p.glyph], k = symScale(art, p.w, p.h);
      if (on) dashBox(c, x, top, p.w, GROUND, GREEN);
      drawSym(c, art, Math.round(x + (p.w - art[0].length * k) / 2), GROUND, k, on ? GREEN : p.solid ? '#ffd23f' : p.glyph === 'umbrella' ? '#4d7cff' : BONE);
      if (p.solid) for (const s of D.beach.castle.solids) { c.fillStyle = on ? GREEN : '#ffd23f'; c.fillRect(x + s.x0, GROUND + 1 - D.beach.castle.height + s.top, s.x1 - s.x0, 1); }
    }
    // sand
    for (let x = -(((cx % 8) + 8) % 8); x < SW(); x += 8) { drawRows(c, ART.ground, x, GROUND, 'rgba(228,226,220,.55)'); drawRows(c, ART.ground, x, GROUND + 8, 'rgba(228,226,220,.3)'); }
    // where the player starts
    c.fillStyle = 'rgba(255,90,31,.5)'; for (let y = GROUND - 30; y < GROUND - 10; y += 2) c.fillRect(D.player.startX - cx, y, 1, 1);
    drawSym(c, ART.crab, D.player.startX - cx - 8, GROUND, 2, '#ff5a1f');
    c.setTransform(1, 0, 0, 1, 0, 0);
    readout(c, 'X ' + String(Math.round(ed.camX + SW() / 2)).padStart(4, '0'));
    present(off, view, SW(), SH());
  }
  const toWorld = (e) => { const r = view.getBoundingClientRect(); return { wx: (e.clientX - r.left) / r.width * SW() + ed.camX, wy: (e.clientY - r.top) / r.height * SH() - OYZ() }; };
  function levelTap(e) {
    const L = scene(), GROUND = data().screen.ground, { wx, wy } = toWorld(e), hit = hitItem(L, wx, wy, GROUND);
    if (ed.tool === 'erase') { if (hit && hit.list !== 'start') { changeLevel(L2 => { if (hit.list === 'exit') delete L2.exit; else L2[hit.list].splice(hit.index, 1); }); ed.lsel = null; } rerender(); return; }
    if (ed.tool === 'place') {
      const d = itemDef(ed.placeType), x = Math.max(0, Math.min(L.width - 1, Math.round(wx)));
      changeLevel(L2 => {
        if (d.list === 'start') L2.start = { x };
        else if (d.list === 'exit') L2.exit = { x };
        else if (d.list === 'checkpoints') { (L2.checkpoints = L2.checkpoints || []).push({ x }); L2.checkpoints.sort((a, b) => a.x - b.x); }
        else if (d.list === 'enemies') (L2.enemies = L2.enemies || []).push({ type: d.type, x, h: Math.max(d.height[0], Math.min(d.height[1], Math.round(GROUND - wy))) });
        else (L2.props = L2.props || []).push({ type: d.type, x: Math.round(x - d.w / 2) });
      });
      rerender(); return;
    }
    ed.lsel = hit; rerender();
  }
  function sceneTap(e) {
    if (scene().kind === 'level') return levelTap(e);
    const r = view.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * SW() + ed.camX, wy = (e.clientY - r.top) / r.height * SH() - OYZ();
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

  // ---------------------------------------------------------------- the screen
  const TABS = [['scene', 'Scene', 'scene'], ['background', 'Backdrop', 'display'], ['settings', 'Settings', 'controller']];
  const ov = {
    render() {
      if (!ed.game) return `<div class="screen-tool" style="--acc:${GREEN}"><div class="plate bar">${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back' })}<span class="title" style="flex:1">${esc(g.name)}</span></div>
        <div class="center-note"><span class="sub">${ed.error ? 'Could not load the game settings: ' + esc(ed.error) : 'Loading…'}</span></div></div>`;
      const n = games.editCount(folder), schema = ed.game.schema;
      let screen = '', panel = '';
      if (ed.tab === 'scene') {
        const sc = schema.scene, cur = scene(), list = scenes(), si = Math.max(0, list.findIndex(x => x.id === cur.id)), isLevel = cur.kind === 'level';
        const go = (k) => { ed.scene = list[(si + k + list.length) % list.length].id; ed.camX = null; ed.lsel = null; ed.sel = null; rerender(); };
        const zoomBtn = `<button class="btn bare" style="position:absolute;left:8px;top:6px;z-index:2" aria-label="Zoom out, now ${ed.zoom === 1 ? '1' : ed.zoom === 2 ? 'half' : 'quarter'} size" ${A(() => { const mid = ed.camX + SW() / 2; ed.zoom = ed.zoom === 4 ? 1 : ed.zoom * 2; ed.camX = mid - SW() / 2; fitLevel(); rerender(); })}>${well(28, svgRows(G.minus, BONE))}<span>${ed.zoom === 1 ? '1×' : ed.zoom === 2 ? '½×' : '¼×'}</span></button>`;
        screen = `<div class="screen fit gap20" style="position:relative">${zoomBtn}<canvas class="pix" id="scn" style="aspect-ratio:160/144;cursor:grab" aria-label="${isLevel ? 'The level, drawn as symbols. Drag to move along it.' : 'The scene, drawn as symbols. Drag to move along it, tap a prop to see it.'}" role="img"></canvas></div>`;
        const toolbar = `<div class="plate bar" role="toolbar" aria-label="Scenes and tools">
          <div style="display:flex;gap:6px">${isLevel ? [['select', 'Select'], ['place', 'Place'], ['erase', 'Erase']].map(([k, l]) => iconBtn(k, A(() => { ed.tool = k; if (k !== 'select') ed.lsel = null; rerender(); }), { on: ed.tool === k, label: l, pressed: ed.tool === k })).join('') : `<span class="cap" style="color:var(--muted);padding-left:10px">Waves · props by rule</span>`}</div>
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
          body = `<div class="ihead">${well(40, svgRows(ART[itemDef(ed.placeType).glyph], GREEN))}<span class="t"><span class="title acc ell">Place · ${esc(itemDef(ed.placeType).name)}</span><span class="sub">Tap the level to put one there</span></span></div>
            <div class="tray" style="margin-top:4px">${levelItems().map(d => { const on = d.type === ed.placeType; return `<button class="${on ? 'on' : ''}" aria-pressed="${on}" ${A(() => { ed.placeType = d.type; rerender(); })}>${well(40, (on ? '<span class="ring"></span>' : '') + (on ? `<span class="art-on">${svgRows(ART[d.glyph], GREEN)}</span><span class="art-off">${svgRows(ART[d.glyph], d.color)}</span>` : svgRows(ART[d.glyph], d.color)))}<span class="cap">${esc(d.name)}</span></button>`; }).join('')}</div>`;
        } else if (ed.lsel) {
          const it = itemsOf(cur).find(x => sameItem(x, ed.lsel));
          if (!it) { ed.lsel = null; body = ''; }
          else {
            const d = it.def, move = (k, v) => changeLevel(L2 => { const o = it.list === 'start' || it.list === 'exit' ? L2[it.list] : L2[it.list][it.index]; o[k] = v; if (it.list === 'checkpoints') L2.checkpoints.sort((a, b) => a.x - b.x); });
            const num = (label, help, v, step, lo, hi, k) => `<div class="grow"><span class="t"><span class="cap">${label}</span><span class="sub">${help}</span></span>${stepper(String(v), A(() => move(k, Math.max(lo, v - step))), A(() => move(k, Math.min(hi, v + step))), label)}</div>`;
            body = `<div class="ihead">${well(40, svgRows(ART[d.glyph], GREEN))}<span class="t"><span class="title acc ell">${esc(d.name)}</span><span class="sub">Drag it to move it</span></span>
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
      } else if (ed.tab === 'background') {
        screen = `<div class="screen fit gap20 stack" id="stk" style="perspective:1100px;touch-action:none;cursor:grab"><div class="rig${ed.combined ? ' flat' : ''}" style="transform:${ed.combined ? 'rotateX(0deg) rotateZ(0deg) scale(1.3)' : `rotateX(${ed.pitch}deg) rotateZ(${ed.yaw}deg)`}">${bgHtml()}</div>
          <span class="cap" id="stkhint" style="position:absolute;left:18px;top:14px;font-size:9px;color:#6f6d69;pointer-events:none">${ed.combined ? 'All layers together, facing forward' : 'Drag to tilt · tap a layer'}</span>
          <button class="btn bare" id="combine" aria-pressed="${!!ed.combined}" style="position:absolute;right:8px;bottom:6px" ${A(() => { ed.combined = !ed.combined; refreshBg(); })}>${well(28, svgRows(G.grid, BONE))}<span class="lbl">${ed.combined ? 'Spread' : 'Combine'}</span></button></div>`;
        panel = bgPanel();
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
        <div class="plate bar" role="tablist" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px">
          ${TABS.map(([k2, l2, ic]) => `<button class="seg${ed.tab === k2 ? ' on' : ''}" role="tab" aria-selected="${ed.tab === k2}" ${A(() => { ed.tab = k2; ed.fanned = false; app.ui.geTab = k2; app.saveUI(); rerender(); })}>${well(28, svgRows(G[ic], ed.tab === k2 ? GREEN : BONE))}${l2}${ed.tab === k2 ? '<span class="selring"></span>' : ''}</button>`).join('')}
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
        if (!off || off.width !== SW()) { off = document.createElement('canvas'); off.width = SW(); off.height = SH(); octx = off.getContext('2d'); }
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
          const px = view.getBoundingClientRect().width / SW(), dx = e.clientX - drag.x, dy = e.clientY - drag.y;
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
          ed.camX = drag.cam - dx / px; fitLevel(); drawScene();
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
        stk.addEventListener('pointerdown', (e) => { if (ed.combined || e.target.closest('#combine')) return; drag = { x: e.clientX, y: e.clientY, yaw: ed.yaw, pitch: ed.pitch }; dragged = false; });
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
  app.open(ov);
}
