// Studio: the game you're working on (shared with the Art and Sound tabs). Its parts are listed below;
// tap one to open it: Scenes, Objects and Settings open the editor there, Art and Sound jump to those tabs.
// Controller: D-pad picks a part, left and right switch games, A opens, X plays.
import { icon } from '../pixel.js';
import { A, esc, row, plateBtn, iconBtn, pager, pageOf, emptyRow, rows } from '../ui.js';
import * as games from '../games.js';
import { openGameEditor } from './gameEditor.js';

const loaded = {};
function info(app, g) {
  if (!loaded[g.file]) {
    loaded[g.file] = 'loading';
    games.loadGame(g.file).then(x => { loaded[g.file] = x; if (!app.overlay) app.render(); }).catch(() => { loaded[g.file] = null; });
  }
  const x = loaded[g.file];
  if (!x || x === 'loading') return null;
  const D = games.applyOverrides(x.data, games.getEdits(g.file).overrides), sc = D.scenes || [];
  return { scenes: sc.length, levels: sc.filter(s => s.kind === 'level').length, objects: Object.keys(D.objects || {}).length, groups: (x.schema.groups || []).length,
    art: ((x.schema.art || {}).folders || []).reduce((n, f) => n + f.items.length, 0), sounds: ((x.schema.sound || {}).effects || []).length, music: ((x.schema.sound || {}).music || []).length };
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

function parts(app, g, k) {
  const edit = (tab) => () => { app.ui.geTab = tab; app.saveUI(); openGameEditor(app, g); };
  return [
    { id: 'scene', icon: 'scene', name: 'Scenes', meta: k ? plural(k.scenes, 'scene', 'scenes') + (k.levels ? ' · ' + plural(k.levels, 'level', 'levels') : '') + ' · backdrop' : '…', tag: 'Edit', go: edit('scene') },
    { id: 'objects', icon: 'objects', name: 'Objects', meta: k ? plural(k.objects, 'object', 'objects') + ' and their behaviors' : '…', tag: 'Edit', go: edit('objects') },
    { id: 'settings', icon: 'controller', name: 'Settings', meta: k ? plural(k.groups, 'group', 'groups') + ' · movement, jump and more' : '…', tag: 'Edit', go: edit('settings') },
    { id: 'art', icon: 'sprites', name: 'Art', meta: k ? plural(k.art, 'picture', 'pictures') + ' · sprites, props, backdrop' : '…', tag: 'Art', go: () => app.setTab(2) },
    { id: 'sound', icon: 'sounds', name: 'Sound', meta: k ? plural(k.sounds, 'effect', 'effects') + ' · ' + plural(k.music, 'song', 'songs') : '…', tag: 'Sound', go: () => app.setTab(3) }
  ];
}
function switchGame(app, d) {
  const list = games.editableGames(), cur = games.currentGame(app); if (!cur) return;
  games.setCurrentGame(app, list[(list.indexOf(cur) + d + list.length) % list.length]); app.render();
}

export default {
  render(app) {
    const g = games.currentGame(app);
    if (!g) return { right: `<span class="cap acc">Studio</span><span class="title clamp2">No games to edit</span><span class="sub">A game needs a game.json to open here</span>`, body: `<div class="group">${emptyRow('code', 'No game in the repo has Studio settings yet.')}</div>` };
    const list = games.editableGames(), gi = list.indexOf(g), k = info(app, g), all = parts(app, g, k);
    const sel = Math.max(0, Math.min(all.length - 1, app.ui.studioSel | 0)), pg = pageOf(all, Math.floor(sel / rows()));
    const right = `
      <span class="cap acc">Game · ${String(gi + 1).padStart(2, '0')}/${String(list.length).padStart(2, '0')}</span>
      <span class="title clamp2">${esc(g.name)}</span>
      <span class="sub">${esc(games.editLine(g))}</span>
      <div class="actions">
        ${plateBtn('edit', 'Edit', A(() => openGameEditor(app, g)))}
        ${plateBtn('play', 'Play', A(() => games.launch(g)))}
      </div>`;
    const pick = (i) => { app.ui.studioSel = i; app.saveUI(); app.render(); };
    const rowHtml = pg.slice.map((x, j) => {
      const i = pg.p * rows() + j, on = i === sel;
      return row({ art: icon(x.icon, on ? 'var(--acc)' : '#e4e2dc'), artOff: icon(x.icon, '#e4e2dc'), name: x.name, meta: x.meta, tag: x.tag, selected: on,
        act: A(() => (on ? x.go() : pick(i))) });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        ${pager('Parts ' + pg.range, A(() => pick(Math.max(0, pg.p - 1) * rows())), A(() => pick(Math.min(pg.pages - 1, pg.p + 1) * rows())))}
        ${list.length > 1 ? `<div style="display:flex;align-items:center;gap:2px">${iconBtn('left', A(() => switchGame(app, -1)), { color: '#fff', label: 'Previous game' })}<span class="cap" style="color:var(--muted)">Game</span>${iconBtn('right', A(() => switchGame(app, 1)), { color: '#fff', label: 'Next game' })}</div>` : '<span class="cap" style="color:var(--muted);padding-right:10px">Tap again to open</span>'}
      </div>
      ${rowHtml}
    </div>`;
    return { right, body };
  },
  pad(app, input) {
    const g = games.currentGame(app); if (!g) return;
    const all = parts(app, g, info(app, g)), i = app.ui.studioSel | 0;
    const pick = (n) => { app.ui.studioSel = Math.max(0, Math.min(all.length - 1, n)); app.saveUI(); app.render(); };
    if (input.pressed('down')) pick(i + 1);
    else if (input.pressed('up')) pick(i - 1);
    else if (input.pressed('left')) switchGame(app, -1);
    else if (input.pressed('right')) switchGame(app, 1);
    else if (input.pressed('a')) all[Math.min(i, all.length - 1)].go();
    else if (input.pressed('x') || input.pressed('start')) games.launch(g);
  }
};
