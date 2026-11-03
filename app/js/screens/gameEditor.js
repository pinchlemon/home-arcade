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
  beach: ['00000000', '00011000', '00111100', '01111110', '00011000', '00011000', '11111111', '11111111']
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
  const ed = { tab: app.ui.geTab || 'scene', group: 0, bg: 'city', camX: null, pitch: 58, yaw: -32, dragging: false, sel: null, game: null, error: null };
  let view = null, off = null, octx = null, drag = null, dragged = false;
  const folder = g.file;
  games.loadGame(folder).then(x => { ed.game = x; rerender(); }).catch(e => { ed.error = e.message; rerender(); });
  const rerender = () => { if (app.overlay === ov) app.render(); };
  const edits = () => games.getEdits(folder);
  const data = () => games.applyOverrides(ed.game.data, edits().overrides);
  const val = (path) => games.getPath(data(), path);
  const set = (path, v) => { games.setValue(folder, path, v); if (ed.tab === 'background') { refreshBg(); refreshTitle(); } else rerender(); };
  const refreshTitle = () => { const n = games.editCount(folder), el = document.querySelector('.screen-tool .ge-sub'); if (el) el.textContent = g.mode + (n ? ' · ' + n + (n === 1 ? ' change' : ' changes') : ''); };

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
  function drawScene() {
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
  function sceneTap(e) {
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

  // ---------------------------------------------------------------- the screen
  const TABS = [['scene', 'Scene', 'scene'], ['background', 'Backdrop', 'display'], ['settings', 'Settings', 'controller']];
  const ov = {
    render() {
      if (!ed.game) return `<div class="screen-tool" style="--acc:${GREEN}"><div class="plate bar">${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back' })}<span class="title" style="flex:1">${esc(g.name)}</span></div>
        <div class="center-note"><span class="sub">${ed.error ? 'Could not load the game settings: ' + esc(ed.error) : 'Loading…'}</span></div></div>`;
      const n = games.editCount(folder), schema = ed.game.schema;
      let screen = '', panel = '';
      if (ed.tab === 'scene') {
        const s = ed.sel, sc = schema.scene, grp = schema.groups.find(x => x.id === sc.fieldsGroup);
        screen = `<div class="screen fit gap20"><canvas class="pix" id="scn" style="aspect-ratio:160/144;cursor:grab" aria-label="The scene, drawn as symbols. Drag to move along it, tap a prop to see it." role="img"></canvas></div>`;
        panel = `<div class="plate inspector gap20">
          <div class="ihead">${well(40, svgRows(s ? ART[s.glyph] : ART.beach, GREEN))}<span class="t"><span class="title acc ell">${esc(s ? s.name : sc.name)}</span><span class="sub">${esc(s ? 'Prop slot ' + s.i + ' · placed by the scatter rule' : sc.summary)}</span></span></div>
          ${grp ? grp.fields.map(field).join('') : ''}</div>`;
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
          <div class="plate inspector" style="margin-top:8px">${gr.fields.map(field).join('')}</div>`;
      }
      return `<div class="screen-tool" style="--acc:${GREEN}">
        <h1 class="sr">Studio · ${esc(g.name)}</h1>
        <div class="plate bar">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">${esc(g.name)}</span><span class="sub ge-sub">${esc(g.mode)}${n ? ' · ' + n + (n === 1 ? ' change' : ' changes') : ''}</span></span>
          ${n ? iconBtn('reset', A(() => { if (confirm('Undo all ' + n + ' changes to ' + g.name + ' on this phone?')) { games.resetEdits(folder); rerender(); } }), { label: 'Undo all changes' }) : ''}
          ${bareBtn('play', 'Play', A(() => games.launch(g)))}
        </div>
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
        if (!off) { off = document.createElement('canvas'); off.width = VW; off.height = VH; octx = off.getContext('2d'); }
        view.addEventListener('pointerdown', (e) => { view.setPointerCapture(e.pointerId); drag = { x: e.clientX, cam: ed.camX }; dragged = false; });
        view.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (!dragged && Math.abs(dx) < 5) return; dragged = true; ed.camX = drag.cam - dx / (view.getBoundingClientRect().width / VW); drawScene(); });
        view.addEventListener('pointerup', (e) => { if (drag && !dragged) sceneTap(e); drag = null; setTimeout(() => { dragged = false; }, 0); });
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
