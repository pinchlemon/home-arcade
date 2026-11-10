// Studio: the game selected in the Arcade (the Art and Sound tabs show the same one), and its parts.
// Tap a part to open the editor there. Another game is picked in the Arcade.
// Controller: D-pad picks a part, A opens, X plays.
import { icon } from '../pixel.js';
import { A, esc, row, plateBtn, pager, pageOf, emptyRow, rows } from '../ui.js';
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
  const logic = Array.isArray(D.logic) ? D.logic : [];
  return { tiles: !!D.template, logic: !!D.template || (D.load || []).includes('engine/logic'), scenes: sc.length, levels: sc.filter(s => s.kind === 'level').length, objects: Object.keys(D.objects || {}).length, groups: (x.schema.groups || []).length,
    scene: !!x.schema.scene, groupNames: (x.schema.groups || []).map(gr => gr.name.toLowerCase()), graphs: logic.length, boxes: logic.reduce((n, l) => n + ((l && l.nodes) || []).length, 0) };
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

function parts(app, g, k) {
  const edit = (tab) => () => { app.ui.geTab = tab; app.saveUI(); openGameEditor(app, g); };
  // a game with settings only (no scene, like Void Wizard) shows just its Settings
  const only = k && !k.scene;
  return [
    ...(only ? [] : [{ id: 'scene', icon: 'scene', name: 'Scenes', meta: k ? plural(k.scenes, 'scene', 'scenes') + (k.levels ? ' · ' + plural(k.levels, 'level', 'levels') : '') + (k.tiles ? ' · tiles' : ' · backdrop') : '…', tag: 'Edit', go: edit('scene') },
    { id: 'objects', icon: 'objects', name: 'Objects', meta: k ? plural(k.objects, 'object', 'objects') + ' · behaviors' : '…', tag: 'Edit', go: edit('objects') }]),
    // games made with New game have visual logic (the Logic tab)
    ...(k && k.logic ? [{ id: 'logic', icon: 'events', name: 'Logic', meta: k.graphs ? plural(k.graphs, 'graph', 'graphs') + ' · ' + plural(k.boxes, 'box', 'boxes') : 'No boxes yet', tag: 'Edit', go: edit('logic') }] : []),
    { id: 'settings', icon: 'controller', name: 'Settings', meta: k ? plural(k.groups, 'group', 'groups') + ' · ' + k.groupNames.slice(0, 3).join(', ') : '…', tag: 'Edit', go: edit('settings') }
  ];
}

export default {
  render(app) {
    const g = games.currentGame(app);
    if (!g || !g.editable) return notReady(app, g, 'code', 'The Studio');
    const k = info(app, g), all = parts(app, g, k);
    const sel = Math.max(0, Math.min(all.length - 1, app.ui.studioSel | 0)), pg = pageOf(all, Math.floor(sel / rows()));
    const right = `
      <span class="cap acc">Editing</span>
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
      </div>
      ${rowHtml}
    </div>`;
    return { right, body };
  },
  pad(app, input) {
    const g = games.currentGame(app); if (!g || !g.editable) return;
    const all = parts(app, g, info(app, g)), i = app.ui.studioSel | 0;
    const pick = (n) => { app.ui.studioSel = Math.max(0, Math.min(all.length - 1, n)); app.saveUI(); app.render(); };
    if (input.pressed('down')) pick(i + 1);
    else if (input.pressed('up')) pick(i - 1);
    else if (input.pressed('a')) all[Math.min(i, all.length - 1)].go();
    else if (input.pressed('x') || input.pressed('start')) games.launch(g);
  }
};

// what the Studio, Art and Sound tabs show when the game selected in the Arcade can't be edited here (yet)
export function notReady(app, g, iconName, what) {
  const name = g ? g.name : 'No game';
  return {
    right: `<span class="cap acc">Selected</span><span class="title clamp2">${esc(name)}</span><span class="sub">Not in the Studio yet</span>
      <div class="actions">${g ? plateBtn('play', 'Play', A(() => games.launch(g))) : ''}${plateBtn('left', 'Change game', A(() => app.setTab(0)))}</div>`,
    body: `<div class="group">${emptyRow(iconName, what + ' supports games built on the shared engine, such as Crab Platformer. Choose one in the Arcade.')}</div>`
  };
}
