// Sound: the current game's sound effects and music (from its studio.json "sound" list), played by the
// game's own code so they sound exactly as they do in the game (engine/listen.html, in a hidden frame).
// Tap one to select it, tap again to hear it. Making and changing sounds comes with the sound editor.
// Controller: D-pad picks, left and right switch between Effects and Music, A plays.
import { icon } from '../pixel.js';
import { A, esc, row, pager, plateBtn, iconBtn, pageOf, emptyRow, rows } from '../ui.js';
import * as games from '../games.js';
import { notReady } from './studio.js';
import * as snd from '../sound.js';

const loaded = {};
let frame = null, frameGame = null, ready = false, playing = null; // playing: id of the song that's on

function load(app, g) {
  if (!loaded[g.file]) {
    loaded[g.file] = 'loading';
    games.loadGame(g.file).then(x => { loaded[g.file] = x; if (!app.overlay) app.render(); }).catch(() => { loaded[g.file] = null; });
  }
  const x = loaded[g.file]; return x && x !== 'loading' ? x : null;
}
// the hidden frame that holds the game's sound code; made the first time it's needed, remade for another game
function listener(g) {
  if (frame && frameGame === g.file) return frame;
  stopMusic();
  if (frame) frame.remove();
  ready = false; frameGame = g.file;
  frame = document.createElement('iframe');
  frame.hidden = true; frame.title = 'Game sounds'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  frame.src = '../engine/listen.html?game=' + encodeURIComponent(g.file);
  document.body.appendChild(frame);
  return frame;
}
addEventListener('message', (e) => { if (frame && e.source === frame.contentWindow && e.data && e.data.listen === 'ready') ready = true; });
function HA(app, g) {
  listener(g);
  const ha = ready && frame.contentWindow && frame.contentWindow.HA;
  if (!ha) { app.toast('Getting the sounds ready…'); return null; }
  const ctx = snd.context();
  if (!ctx) { app.toast('Sound effects are off in Settings'); return null; }
  ha.use(ctx); return ha;
}
function stopMusic() {
  if (playing && frame && frame.contentWindow && frame.contentWindow.HA) frame.contentWindow.HA.music(playing, false);
  playing = null;
}

const lists = (x) => {
  const s = (x && x.schema.sound) || {};
  return [
    { id: 'effects', name: 'Effects', icon: 'sounds', items: (s.effects || []).map(e => ({ ...e, kind: 'effect' })) },
    { id: 'music', name: 'Music', icon: 'play', items: (s.music || []).map(m => ({ ...m, kind: 'music' })) }
  ];
};
function state(app) {
  const g = games.currentGame(app); if (!g || !g.editable) return { g, off: true };
  const x = load(app, g); if (!x) return { g };
  const L = lists(x), fi = Math.max(0, L.findIndex(f => f.id === app.ui.soundFolder)), f = L[fi];
  const si = Math.max(0, f.items.findIndex(it => it.id === app.ui.soundSel));
  return { g, L, fi, f, si, it: f.items[si] };
}
function hear(app, g, it) {
  const ha = HA(app, g); if (!ha) return;
  if (it.kind === 'effect') ha.play(it.id);
  else if (playing === it.id) stopMusic();
  else { stopMusic(); ha.music(it.id, true); playing = it.id; }
  app.render();
}
function setFolder(app, fi) { const s = state(app), f = s.L[(fi + s.L.length) % s.L.length]; app.ui.soundFolder = f.id; app.ui.soundSel = f.items[0] && f.items[0].id; app.saveUI(); app.render(); }
function setSel(app, i, andHear) {
  const s = state(app), it = s.f.items[(i + s.f.items.length) % s.f.items.length]; if (!it) return;
  app.ui.soundSel = it.id; app.saveUI(); if (andHear) hear(app, s.g, it); else app.render();
}

export default {
  render(app) {
    const s = state(app);
    if (s.off) return notReady(app, s.g, 'sounds', 'Sound');
    if (!s.L) return { right: `<span class="cap acc">Sound</span><span class="title clamp2">${esc(s.g.name)}</span><span class="sub">Loading…</span>`, body: `<div class="group">${emptyRow('sounds', 'Loading the sounds…')}</div>` };
    const { g, L, fi, f, si, it } = s;
    listener(g); // start loading the game's sound code now, so the first tap plays
    const on = it && it.kind === 'music' && playing === it.id;
    const right = it ? `
      <span class="cap acc ell">${esc(g.name)}</span>
      <span class="title clamp2">${esc(it.name)}</span>
      <span class="sub clamp2" style="white-space:normal">${esc(f.name + ' · ' + it.help)}</span>
      <div class="actions">
        ${plateBtn(on ? 'pause' : 'play', on ? 'Stop' : 'Play', A(() => hear(app, g, it)))}
        ${plateBtn('right', 'Next', A(() => setSel(app, si + 1, true)))}
      </div>` : `<span class="cap acc">${esc(g.name)}</span><span class="title clamp2">${esc(f.name)}</span><span class="sub">Nothing here yet</span>`;
    const per = rows(), pg = pageOf(f.items, Math.floor(si / per));
    const rowHtml = pg.slice.map((x, j) => {
      const i = pg.p * per + j, sel = i === si, ic = x.kind === 'music' ? (playing === x.id ? 'pause' : 'play') : 'sounds';
      return row({ art: icon(ic, sel ? 'var(--acc)' : '#e4e2dc'), artOff: icon(ic, '#e4e2dc'), name: x.name, meta: x.help, tag: x.kind === 'music' && playing === x.id ? 'On' : sel ? 'Play' : '', selected: sel,
        act: A(() => (sel ? hear(app, g, x) : setSel(app, i))) });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        <div role="tablist" aria-label="Kinds of sound" style="display:flex;align-items:center;gap:4px">
          ${L.map((x, k) => iconBtn(x.icon, A(() => setFolder(app, k)), { on: k === fi, label: x.name, pressed: k === fi })).join('')}
          <span class="cap acc" style="padding-left:6px">${esc(f.name)}</span>
        </div>
        ${pager(pg.range, A(() => setSel(app, Math.max(0, pg.p - 1) * per)), A(() => setSel(app, Math.min(pg.pages - 1, pg.p + 1) * per)))}
      </div>
      ${rowHtml || emptyRow('sounds', 'No ' + f.name.toLowerCase() + ' in this game yet.')}
    </div>`;
    return { right, body };
  },
  // leaving the tab (or the app) stops the music
  leave() { stopMusic(); },
  pad(app, input) {
    const s = state(app); if (!s || s.off || !s.L) return;
    if (input.pressed('down')) setSel(app, s.si + 1);
    else if (input.pressed('up')) setSel(app, s.si - 1);
    else if (input.pressed('right')) setFolder(app, s.fi + 1);
    else if (input.pressed('left')) setFolder(app, s.fi - 1);
    else if (input.pressed('a') && s.it) hear(app, s.g, s.it);
  }
};
