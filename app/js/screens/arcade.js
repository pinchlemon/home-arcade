// Arcade: every game, code games from the repo and Studio games from this phone. Controller: D-pad picks, A plays, X edits.
import { well, icon } from '../pixel.js';
import { A, esc, row, digits, pager, plateBtn, bareBtn, pageOf, rows } from '../ui.js';
import { newProject, saveProject, flatten } from '../store.js';
import { openPlayer } from './player.js';
import { openEditor } from './editor.js';

const CODE_GAMES = [
  { name: 'Crab Platformer', path: '../crab-platformer/', kind: '2D · Canvas', size: '97 KB', file: 'crab-platformer' },
  { name: 'Void Wizard', path: '../void-wizard/', kind: '3D · three.js', size: '97 KB', file: 'void-wizard' },
  { name: 'Phosphor', path: '../phosphor/', kind: '2D · Canvas', size: '239 KB', file: 'phosphor' },
  { name: 'Purgatory Bowl', path: '../purgatory-bowl/', kind: '3D · three.js + cannon', size: '287 KB', file: 'purgatory-bowl' }
];

export function games(app) {
  const studio = app.projects.map(p => ({ name: p.name, studio: true, id: p.id, kind: 'Studio', size: flatten(p.scenes).length + ' scenes' }));
  return [...studio, ...CODE_GAMES];
}

function play(app, g) {
  if (g.studio) { const p = app.projects.find(x => x.id === g.id); if (p) openPlayer(app, p, null, null); }
  else { try { sessionStorage.setItem('ha.return', 'app/'); } catch (e) {} location.href = g.path; }
}
function edit(app, g) {
  if (g.studio) { app.ui.project = g.id; app.saveUI(); const p = app.projects.find(x => x.id === g.id); if (p) openEditor(app, p); }
  else window.open(`https://github.com/${app.settings.repo}/blob/${app.settings.branch}/${g.file}/index.html`, '_blank');
}
function select(app, i) {
  const list = games(app);
  app.ui.sel = Math.max(0, Math.min(list.length - 1, i));
  app.ui.page = Math.floor(app.ui.sel / rows());
  app.saveUI(); app.render();
}

export default {
  render(app) {
    const list = games(app);
    if (app.ui.sel >= list.length) app.ui.sel = 0;
    const sel = list[app.ui.sel] || list[0], pg = pageOf(list, app.ui.page);
    const right = `
      <span class="cap acc">Selected · ${String(app.ui.sel + 1).padStart(2, '0')}/${String(list.length).padStart(2, '0')}</span>
      <span class="title clamp2">${esc(sel.name)}</span>
      <span class="sub">${esc(sel.kind + ' · ' + sel.size)}</span>
      <div class="actions">
        ${plateBtn('play', 'Play', A(() => play(app, sel)))}
        ${plateBtn(sel.studio ? 'edit' : 'code', sel.studio ? 'Edit' : 'View code', A(() => edit(app, sel)))}
      </div>`;
    const rowHtml = pg.slice.map((g, j) => {
      const i = pg.p * rows() + j, on = i === app.ui.sel;
      return row({ art: digits(i + 1, on ? 'var(--acc)' : 'var(--muted)'), name: g.name, meta: g.kind + ' · ' + g.size, tag: g.studio ? 'Studio' : 'Code',
        selected: on, tagColor: g.studio ? 'var(--acc)' : 'var(--muted)',
        act: A(() => (on ? play(app, g) : select(app, i))) });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        ${pager('Games ' + pg.range, A(() => { app.ui.page = Math.max(0, pg.p - 1); app.saveUI(); app.render(); }), A(() => { app.ui.page = Math.min(pg.pages - 1, pg.p + 1); app.saveUI(); app.render(); }))}
        ${bareBtn('plus', 'New game', A(() => {
          const p = newProject('New game ' + (app.projects.length + 1), false);
          saveProject(p); app.refreshProjects(); app.ui.project = p.id; app.ui.sel = app.projects.findIndex(x => x.id === p.id); app.ui.page = Math.floor(app.ui.sel / rows()); app.saveUI();
          openEditor(app, p);
        }), 'var(--acc)')}
      </div>
      ${rowHtml}
    </div>`;
    return { right, body };
  },
  pad(app, input) {
    const list = games(app);
    if (input.pressed('down')) select(app, app.ui.sel + 1);
    else if (input.pressed('up')) select(app, app.ui.sel - 1);
    else if (input.pressed('right')) select(app, app.ui.sel + rows());
    else if (input.pressed('left')) select(app, app.ui.sel - rows());
    else if (input.pressed('a') || input.pressed('start')) play(app, list[app.ui.sel]);
    else if (input.pressed('x')) edit(app, list[app.ui.sel]);
  }
};
