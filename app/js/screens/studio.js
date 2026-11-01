// Studio: the games you make here. Pick one to open the level editor or play it. Controller: D-pad picks, A edits, X plays.
import { icon } from '../pixel.js';
import { A, esc, row, pager, plateBtn, bareBtn, pageOf, emptyRow, rows } from '../ui.js';
import * as S from '../store.js';
import { openEditor } from './editor.js';
import { openPlayer } from './player.js';

const per = () => Math.max(1, rows() - 1); // one row's space goes to the Rename / Copy / Delete bar
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const idx = (app) => Math.max(0, app.projects.findIndex(p => p.id === (app.project() || {}).id));
function pick(app, i) {
  const p = app.projects[Math.max(0, Math.min(app.projects.length - 1, i))]; if (!p) return;
  app.ui.project = p.id; app.ui.studioPage = Math.floor(app.projects.indexOf(p) / per()); app.saveUI(); app.render();
}
function create(app) {
  const p = S.newProject('New game ' + (app.projects.length + 1), false);
  S.saveProject(p); app.refreshProjects(); app.ui.project = p.id; app.ui.studioPage = Math.floor((app.projects.length - 1) / per()); app.saveUI();
  openEditor(app, p);
}

export default {
  render(app) {
    const p = app.project(), list = app.projects, i = idx(app);
    if (!p) {
      return {
        right: `<span class="cap acc">No games yet</span><span class="title clamp2">Make your first game</span><span class="sub">Tiles, objects and events</span>
          <div class="actions">${plateBtn('plus', 'New game', A(() => create(app)))}</div>`,
        body: `<div class="group"><div class="plate bar"><span class="cap" style="color:var(--muted);padding-left:10px">Games 0 / 0</span>${bareBtn('plus', 'New game', A(() => create(app)), 'var(--acc)')}</div>
          ${emptyRow('scene', 'Games you make here show up in the Arcade.')}</div>`
      };
    }
    const scenes = S.flatten(p.scenes).length, sprites = S.flatten(p.library.sprites).length;
    const page = app.ui.studioPage ?? Math.floor(i / per()), pg = pageOf(list, page, per());
    const right = `
      <span class="cap acc">Selected · ${String(i + 1).padStart(2, '0')}/${String(list.length).padStart(2, '0')}</span>
      <span class="title clamp2">${esc(p.name)}</span>
      <span class="sub">${scenes} ${scenes === 1 ? 'scene' : 'scenes'} · ${sprites} sprites</span>
      <div class="actions">
        ${plateBtn('edit', 'Edit', A(() => openEditor(app, p)))}
        ${plateBtn('play', 'Play', A(() => openPlayer(app, p, null, null)))}
      </div>`;
    const rowHtml = pg.slice.map((q, j) => {
      const on = q.id === p.id, n = S.flatten(q.scenes).length;
      return row({ art: icon('scene', on ? 'var(--acc)' : '#e4e2dc'), artOff: icon('scene', '#e4e2dc'), name: q.name, meta: n + (n === 1 ? ' scene · ' : ' scenes · ') + ago(q.updated), tag: on ? 'Open' : '', selected: on,
        act: A(() => (on ? openEditor(app, q) : pick(app, pg.p * per() + j))) });
    }).join('');
    const body = `<div class="group">
      <div class="plate bar">
        ${pager('Games ' + pg.range, A(() => { app.ui.studioPage = Math.max(0, pg.p - 1); app.saveUI(); app.render(); }), A(() => { app.ui.studioPage = Math.min(pg.pages - 1, pg.p + 1); app.saveUI(); app.render(); }))}
        ${bareBtn('plus', 'New game', A(() => create(app)), 'var(--acc)')}
      </div>
      ${rowHtml}
      <div class="plate bar">
        ${bareBtn('rename', 'Rename', A(() => { const n = prompt('Game name', p.name); if (n && n.trim()) { p.name = n.trim().slice(0, 28); S.saveProject(p); app.refreshProjects(); app.render(); } }))}
        ${bareBtn('dup', 'Copy', A(() => {
          const c = structuredClone(p); c.id = S.uid('p'); c.name = (p.name + ' copy').slice(0, 28); c.created = Date.now();
          S.saveProject(c); app.refreshProjects(); app.ui.project = c.id; app.ui.studioPage = Math.floor((app.projects.length - 1) / per()); app.saveUI(); app.toast('Copied ' + p.name); app.render();
        }))}
        ${bareBtn('trash', 'Delete', A(() => {
          if (!confirm('Delete "' + p.name + '"? This removes it from this phone' + (S.getSync().pushed[p.id] ? ' and from GitHub on your next push.' : '.'))) return;
          S.deleteProject(p.id); app.refreshProjects(); app.ui.project = null; app.ui.studioPage = 0; app.saveUI(); app.toast('Deleted ' + p.name); app.render();
        }))}
      </div>
    </div>`;
    return { right, body };
  },
  pad(app, input) {
    const i = idx(app), p = app.project();
    if (input.pressed('down')) pick(app, i + 1);
    else if (input.pressed('up')) pick(app, i - 1);
    else if (p && (input.pressed('a') || input.pressed('start'))) openEditor(app, p);
    else if (p && input.pressed('x')) openPlayer(app, p, null, null);
  }
};
