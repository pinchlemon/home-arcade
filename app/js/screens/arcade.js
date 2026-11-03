// Arcade: every game in the repo. Pick one to see what it is and when you last changed it; Play it, or Edit it in the Studio.
// Controller: D-pad picks, A plays, X edits.
import { A, esc, row, digits, pager, plateBtn, pageOf, rows } from '../ui.js';
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
    const sel = all[app.ui.sel] || all[0], pg = pageOf(all, app.ui.page);
    const right = `
      <span class="cap acc">${sel.editable ? 'Studio' : 'Code'} · ${String(app.ui.sel + 1).padStart(2, '0')}/${String(all.length).padStart(2, '0')}</span>
      <span class="title clamp2">${esc(sel.name)}</span>
      <span class="sub clamp2" style="white-space:normal">${esc(sel.about || sel.kind)}</span>
      <div class="actions">
        ${plateBtn('play', 'Play', A(() => play(app, sel)))}
        ${plateBtn(sel.editable ? 'edit' : 'code', sel.editable ? 'Edit' : 'View code', A(() => edit(app, sel)))}
      </div>`;
    const rowHtml = pg.slice.map((g, j) => {
      const i = pg.p * rows() + j, on = i === app.ui.sel;
      return row({ art: digits(i + 1, on ? 'var(--acc)' : 'var(--muted)'), artOff: digits(i + 1, 'var(--muted)'), name: g.name, meta: g.editable ? editLine(g) : g.kind + ' · ' + g.size,
        tag: g.editable ? 'Studio' : 'Code', selected: on, tagColor: g.editable ? 'var(--acc)' : 'var(--muted)',
        act: A(() => (on ? play(app, g) : select(app, i))) });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        ${pager('Games ' + pg.range, A(() => { app.ui.page = Math.max(0, pg.p - 1); app.saveUI(); app.render(); }), A(() => { app.ui.page = Math.min(pg.pages - 1, pg.p + 1); app.saveUI(); app.render(); }))}
        <span class="cap" style="color:var(--muted);padding-right:10px">Tap again to play</span>
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
