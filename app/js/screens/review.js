// Changes: everything you changed in one game on this phone, before it's pushed. Each line shows what it
// was on GitHub and what it is now; put one back, or discard them all. Opened from Settings › Sync.
import { well, icon } from '../pixel.js';
import { A, esc, iconBtn, bareBtn } from '../ui.js';
import * as games from '../games.js';
import * as input from '../input.js';
import { makeNav, padFrame } from '../padnav.js';
import { fmt } from './gameEditor.js';
import { pushAll, markSeen } from './sync.js';
import * as store from '../artStore.js';
import * as custom from '../custom.js';
import * as made from '../newGame.js';

const BLUE = '#4d7cff';

// what a setting is called in the Studio, found from its path in studio.json
function fieldFor(schema, path) {
  const all = [...(schema.groups || []).flatMap(g => g.fields.map(f => ({ ...f, where: g.name }))),
    ...(schema.background || []).flatMap(l => (l.fields || []).map(f => ({ ...f, where: 'Backdrop · ' + l.name }))),
    ...(schema.features || []).flatMap(x => [{ path: 'features.' + x.id + '.on', label: 'On', show: 'onoff', where: 'Feature · ' + x.name }, ...(x.fields || []).map(f => ({ ...f, where: 'Feature · ' + x.name }))])];
  return all.find(f => f.path === path) || null;
}
const many = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const count = (v) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0);
function describe(schema, base, path, now) {
  const was = games.getPath(base, path);
  if (path === 'scenes') return { label: 'Scenes and levels', where: 'Scene', from: many(count(was), 'scene'), to: many(count(now), 'scene') + (count(now) === count(was) ? ', edited' : '') };
  if (path === 'objects') return { label: 'Objects', where: 'Objects', from: many(count(was), 'object'), to: many(count(now), 'object') + (count(now) === count(was) ? ', edited' : '') };
  if (path === 'tiles') return { label: 'Tiles', where: 'Scene', from: many(count(was), 'tile'), to: many(count(now), 'tile') + (count(now) === count(was) ? ', edited' : '') };
  if (path === 'logic') {   // visual logic: counted in boxes over all its graphs
    const boxes = (v) => { const n = (Array.isArray(v) ? v : []).reduce((k, g) => k + ((g && g.nodes) || []).length, 0); return n + (n === 1 ? ' box' : ' boxes'); };
    return { label: 'Visual logic', where: 'Logic', from: boxes(was), to: boxes(now) + (boxes(now) === boxes(was) ? ', edited' : '') };
  }
  if (path === 'lab.prototypes') return { label: 'Lab prototypes', where: 'Lab', from: many(count(was), 'prototype'), to: many(count(now), 'prototype') + (count(now) === count(was) ? ', edited' : '') };
  if (path === 'lab.start') { const n = (v) => Object.keys((v && v.values) || {}).length; return { label: 'Lab start mix', where: 'Lab', from: n(was) ? many(n(was), 'knob') : 'plain', to: n(now) ? many(n(now), 'knob') : 'plain' }; }
  if (path === 'lab.ideas') return { label: 'Lab ideas', where: 'Lab', from: many(count(was), 'idea'), to: many(count(now), 'idea') + (count(now) === count(was) ? ', edited' : '') };
  const f = fieldFor(schema, path);
  if (f) return { label: f.label, where: f.where, from: fmt(f, was), to: fmt(f, now) };
  const show = (v) => (typeof v === 'object' ? 'edited' : String(v));
  return { label: path, where: 'Setting', from: show(was), to: show(now) };
}

export function openReview(app, g) {
  markSeen(g);   // looking at the changes clears the dot
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
    place: 'Review',
    render() {
      const items = game ? list() : [], art = store.dirtyFor(g.file), n = items.length + art.length;
      const top = `<div class="plate bar">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back to Sync' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">Changes · ${esc(g.name)}</span><span class="sub">${game ? (n ? n + (n === 1 ? ' change' : ' changes') + ' not pushed' : 'Nothing to push') : error ? 'Could not load: ' + esc(error) : 'Loading…'}</span></span>
          ${iconBtn('edit', A(() => { app.close(); import('./gameEditor.js').then(m => m.openGameEditor(app, g)); }), { color: '#fff', label: 'Open in the Studio' })}
        </div>`;
      const fresh = made.isUnpushed(g.file) ? `<div class="grow"><span class="t" style="min-width:0"><span class="cap">New game</span><span class="sub ell">Made on this phone · not on GitHub yet</span></span></div>` : '';
      const rows = fresh + items.map(it => `<div class="grow"><span class="t" style="min-width:0"><span class="cap">${esc(it.label)}</span><span class="sub ell">${esc(it.where)} · was ${esc(it.from)} → now <span style="color:var(--acc)">${esc(it.to)}</span></span></span>
          ${iconBtn('undo', A(() => putBack([it.path])), { label: 'Put back ' + it.label })}</div>`).join('')
        + art.map(r => `<div class="grow"><span class="t" style="min-width:0"><span class="cap">${esc(r.name)}</span><span class="sub ell">Art · ${r.item && r.isNew ? 'new sprite' : 'redrawn'}</span></span>
          ${iconBtn('undo', A(() => { if (confirm(r.isNew ? 'Delete the new sprite ' + r.name + '? It has not been pushed.' : 'Restore ' + r.name + ' to the GitHub version?')) store.discard(g.file, r.itemId).then(rer); }), { label: 'Put back ' + r.name })}</div>`).join('');
      return `<div class="screen-tool" style="--acc:${BLUE}">
        <h1 class="sr">Changes to ${esc(g.name)}</h1>
        ${top}
        <div class="plate inspector">${rows || `<div class="center-note">${well(40, icon('check', BLUE))}<span class="sub">${game ? 'No changes. ' + esc(g.name) + ' matches GitHub.' : 'Loading…'}</span></div>`}</div>
        <div class="plate bar">
          ${bareBtn('trash', 'Discard all', A(async () => { if (n && confirm('Discard all ' + n + ' changes and restore the GitHub version of ' + g.name + '?')) { for (const r of art) await store.discard(g.file, r.itemId); putBack(Object.keys(games.getEdits(g.file).overrides)); } }))}
          ${bareBtn('up', n ? 'Push' : 'Pushed', A(() => { if (n) pushAll(app).then(() => rer()); }), n ? BLUE : undefined)}
        </div>
      </div>`;
    },
    frame() { if (input.pressed('b')) app.close(); else padFrame(document.getElementById('app'), nav, input); }
  };
  app.open(ov);
}

// App customizations: what differs from GitHub's app/custom.json, by kind; push them, save them as a file, load a file, or go back
export function openCustomReview(app) {
  markSeen({ file: '_custom' });
  const nav = makeNav();
  async function exportFile() {
    const f = new File([custom.fileText()], 'hedron-customizations.json', { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  }
  const ov = {
    place: 'Review',
    render() {
      const list = custom.changes(), n = list.reduce((x, c) => x + c.n, 0);
      const rows = list.map(c => `<div class="grow"><span class="t" style="min-width:0"><span class="cap">${esc(c.label)}</span><span class="sub ell">${c.n} ${c.n === 1 ? 'change' : 'changes'}</span></span></div>`).join('');
      return `<div class="screen-tool" style="--acc:${BLUE}">
        <h1 class="sr">App customizations</h1>
        <div class="plate bar">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back to Sync' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">App customizations</span><span class="sub">${n ? n + (n === 1 ? ' change' : ' changes') + ' to push' : 'Matches GitHub'}</span></span>
        </div>
        <div class="plate inspector">${rows || `<div class="center-note">${well(40, icon('check', BLUE))}<span class="sub">Nothing to push.</span></div>`}
          <div class="se-btns" style="margin-top:12px">
            <button class="btn bare" ${A(exportFile)}>${well(28, icon('up', '#e4e2dc'))}<span>Export</span></button>
            <label class="btn bare se-file">${well(28, icon('down', '#e4e2dc'))}<span>Import</span><input type="file" id="cu-imp" accept=".json,application/json"></label>
          </div>
        </div>
        <div class="plate bar">
          ${bareBtn('trash', 'Discard', A(() => { if (n && confirm('Discard ' + n + (n === 1 ? ' change' : ' changes') + ' and go back to the customizations on GitHub?')) custom.discard(); }))}
          ${bareBtn('up', n ? 'Push' : 'Pushed', A(() => { if (n) pushAll(app).then(() => { if (app.overlay === ov) app.render(); }); }), n ? BLUE : undefined)}
        </div>
      </div>`;
    },
    mount(root) {
      const inp = root.querySelector('#cu-imp');
      if (inp) inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
        let o; try { o = JSON.parse(await f.text()); } catch (e) { app.toast('Not a customizations file'); return; }
        if (!o || typeof o !== 'object' || !Object.keys(o).some(k => k in custom.KEYS)) { app.toast('Not a customizations file'); return; }
        if (confirm('Replace this phone\'s customizations with ' + f.name + '?')) custom.replaceAll(o);
      });
    },
    frame() { if (input.pressed('b')) app.close(); else padFrame(document.getElementById('app'), nav, input); }
  };
  app.open(ov);
}
