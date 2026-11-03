// Changes: everything you changed in one game on this phone, before it's pushed. Each line shows what it
// was on GitHub and what it is now; put one back, or discard them all. Opened from Settings › Sync.
import { well, icon } from '../pixel.js';
import { A, esc, iconBtn, bareBtn } from '../ui.js';
import * as games from '../games.js';
import * as input from '../input.js';
import { makeNav, padFrame } from '../padnav.js';
import { fmt } from './gameEditor.js';
import { pushAll } from './sync.js';

const BLUE = '#4d7cff';

// what a setting is called in the Studio, found from its path in studio.json
function fieldFor(schema, path) {
  const all = [...(schema.groups || []).flatMap(g => g.fields.map(f => ({ ...f, where: g.name }))),
    ...(schema.background || []).flatMap(l => (l.fields || []).map(f => ({ ...f, where: 'Backdrop · ' + l.name })))];
  return all.find(f => f.path === path) || null;
}
const many = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const count = (v) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0);
function describe(schema, base, path, now) {
  const was = games.getPath(base, path);
  if (path === 'scenes') return { label: 'Scenes and levels', where: 'Scene', from: many(count(was), 'scene'), to: many(count(now), 'scene') + (count(now) === count(was) ? ', edited' : '') };
  if (path === 'objects') return { label: 'Objects', where: 'Objects', from: many(count(was), 'object'), to: many(count(now), 'object') + (count(now) === count(was) ? ', edited' : '') };
  const f = fieldFor(schema, path);
  if (f) return { label: f.label, where: f.where, from: fmt(f, was), to: fmt(f, now) };
  const show = (v) => (typeof v === 'object' ? 'edited' : String(v));
  return { label: path, where: 'Setting', from: show(was), to: show(now) };
}

export function openReview(app, g) {
  let game = null, error = null;
  games.loadGame(g.file).then(x => { game = x; rer(); }).catch(e => { error = e.message; rer(); });
  const rer = () => { if (app.overlay === ov) app.render(); };
  // the changes that differ from the game.json the app has (ones already pushed and live are left out)
  const list = () => {
    const o = games.getEdits(g.file).overrides;
    return Object.keys(o).filter(p => JSON.stringify(games.getPath(game.data, p)) !== JSON.stringify(o[p])).map(p => ({ path: p, ...describe(game.schema, game.data, p, o[p]) }));
  };
  function putBack(paths) {
    const e = games.getEdits(g.file);
    for (const p of paths) delete e.overrides[p];
    games.setEdits(g.file, e);
    // nothing left that differs from GitHub: nothing to push
    if (!list().length) { e.dirty = false; games.setEdits(g.file, e); }
    rer();
  }
  const nav = makeNav();
  const ov = {
    render() {
      const items = game ? list() : [], n = items.length;
      const top = `<div class="plate bar">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back to Sync' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">Changes · ${esc(g.name)}</span><span class="sub">${game ? (n ? n + (n === 1 ? ' change' : ' changes') + ' not pushed' : 'Nothing to push') : error ? 'Could not load: ' + esc(error) : 'Loading…'}</span></span>
          ${iconBtn('edit', A(() => { app.close(); import('./gameEditor.js').then(m => m.openGameEditor(app, g)); }), { color: '#fff', label: 'Open in the Studio' })}
        </div>`;
      const rows = items.map(it => `<div class="grow"><span class="t" style="min-width:0"><span class="cap">${esc(it.label)}</span><span class="sub ell">${esc(it.where)} · was ${esc(it.from)} → now <span style="color:var(--acc)">${esc(it.to)}</span></span></span>
          ${iconBtn('undo', A(() => putBack([it.path])), { label: 'Put back ' + it.label })}</div>`).join('');
      return `<div class="screen-tool" style="--acc:${BLUE}">
        <h1 class="sr">Changes to ${esc(g.name)}</h1>
        ${top}
        <div class="plate inspector">${rows || `<div class="center-note">${well(40, icon('check', BLUE))}<span class="sub">${game ? 'No changes left. ' + esc(g.name) + ' matches GitHub.' : 'Loading…'}</span></div>`}</div>
        <div class="plate bar">
          ${bareBtn('trash', 'Discard all', A(() => { if (n && confirm('Discard all ' + n + ' changes to ' + g.name + '? They go back to the version on GitHub.')) putBack(Object.keys(games.getEdits(g.file).overrides)); }))}
          ${bareBtn('up', n ? 'Push' : 'Pushed', A(() => { if (n) pushAll(app).then(() => rer()); }), n ? BLUE : undefined)}
        </div>
      </div>`;
    },
    frame() { if (input.pressed('b')) app.close(); else padFrame(document.getElementById('app'), nav, input); }
  };
  app.open(ov);
}
