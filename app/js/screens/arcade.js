// Arcade: every game in the repo. The one you select here is the game the Studio, Art and Sound tabs work on.
// Controller: D-pad picks, A plays, X edits.
import { A, esc, row, digits, pager, plateBtn, bareBtn, pageOf, rows, iconBtn } from '../ui.js';
import { svgRows, G } from '../pixel.js';
import * as made from '../newGame.js';
import * as games from '../games.js';
import { CODE_GAMES, launch, setCurrentGame, editLine } from '../games.js';
import { openGameEditor } from './gameEditor.js';

const list = () => CODE_GAMES;

function play(app, g) { launch(g); }
function edit(app, g) {
  if (g.editable) { setCurrentGame(app, g); openGameEditor(app, g); }
  else window.open(`https://github.com/${app.settings.repo}/blob/${app.settings.branch}/${g.file}/index.html`, '_blank');
}
function select(app, i) {
  const all = list();
  app.ui.sel = Math.max(0, Math.min(all.length - 1, i));
  app.ui.page = Math.floor(app.ui.sel / rows());
  app.saveUI(); app.render();
}

export default {
  render(app) {
    const all = list();
    if (app.ui.sel >= all.length) app.ui.sel = 0;
    const sel = all[app.ui.sel] || all[0], pg = pageOf(all, app.ui.page ?? Math.floor(app.ui.sel / rows()));
    const right = `
      <span class="cap acc">${sel.editable ? 'Editing' : 'Selected'} · ${String(app.ui.sel + 1).padStart(2, '0')}/${String(all.length).padStart(2, '0')}</span>
      <span class="title clamp2" data-of="${esc(sel.name)}" data-f="title">${esc(sel.name)}</span>
      <span class="sub clamp2" style="white-space:normal">${esc(sel.editable ? editLine(sel) : 'Not in the Studio yet')}</span>
      <div class="actions">
        ${plateBtn('play', 'Play', A(() => play(app, sel)))}
        ${plateBtn(sel.editable ? 'edit' : 'code', sel.editable ? 'Edit' : 'View code', A(() => edit(app, sel)))}
      </div>`;
    const rowHtml = pg.slice.map((g, j) => {
      const i = pg.p * rows() + j, on = i === app.ui.sel;
      return row({ art: digits(i + 1, on ? 'var(--acc)' : 'var(--muted)'), artOff: digits(i + 1, 'var(--muted)'), name: g.name, meta: g.kind + ' · ' + g.size,
        tag: g.editable ? (on ? 'Editing' : 'Studio') : 'Code', selected: on, tagColor: g.editable ? 'var(--acc)' : 'var(--muted)',
        act: A(() => (on ? play(app, g) : select(app, i))) });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        ${pager('Games ' + pg.range, A(() => { app.ui.page = Math.max(0, pg.p - 1); app.saveUI(); app.render(); }), A(() => { app.ui.page = Math.min(pg.pages - 1, pg.p + 1); app.saveUI(); app.render(); }))}
        ${bareBtn('plus', 'New game', A(() => newGame(app)))}
      </div>
      ${rowHtml}
    </div>`;
    return { right, body };
  },
  pad(app, input) {
    const all = list();
    if (input.pressed('down')) select(app, app.ui.sel + 1);
    else if (input.pressed('up')) select(app, app.ui.sel - 1);
    else if (input.pressed('right')) select(app, app.ui.sel + rows());
    else if (input.pressed('left')) select(app, app.ui.sel - rows());
    else if (input.pressed('a') || input.pressed('start')) play(app, all[app.ui.sel]);
    else if (input.pressed('x')) edit(app, all[app.ui.sel]);
  }
};

// New game: pick a template, name it; it is made on this phone (newGame.js) and opens in the Studio
export function newGame(app) {
  const ov = {
    place: 'New game',
    render() {
      const opts = made.TEMPLATES.map(t => row({ art: svgRows(G[t.id === 'topdown' ? 'move' : 'up'], '#e4e2dc'), name: t.name, meta: t.help, tag: 'Make', tagColor: 'var(--acc)', act: A(() => make(t)) })).join('');
      return `<div class="screen-tool" style="--acc:#ff5a1f">
        <h1 class="sr">New game</h1>
        <div class="plate bar">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Cancel' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">New game</span><span class="sub">Choose a template</span></span>
        </div>
        <div class="group">${opts}</div>
        <div class="plate row-empty"><span class="sub" style="white-space:normal">Made on this phone and playable offline. Push it from Settings › Sync to put it on GitHub.</span></div>
      </div>`;
    },
    frame() {}
  };
  async function make(t) {
    const name = (prompt('Game name', 'My ' + t.name.toLowerCase()) || '').trim().slice(0, 32);
    if (!name) return;
    try {
      const g = await made.create(name, t.id), e = games.addMade(g) || games.CODE_GAMES.find(x => x.file === g.file);
      games.setCurrentGame(app, e); app.close(); app.setTab(1); app.toast(name + ' is ready. Play it or edit it.');
    } catch (err) { app.toast('Could not make the game: ' + (err.message || err)); }
  }
  app.open(ov);
}
