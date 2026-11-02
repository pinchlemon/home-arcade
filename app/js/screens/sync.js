// Sync: Studio games go to GitHub as one JSON file each, in studio/projects/<id>.json.
// Push writes every changed game in one commit (git data API). Pull brings in games changed elsewhere, such as by Claude or on the computer.
import { icon } from '../pixel.js';
import * as S from '../store.js';
import { A, esc, row, pager, plateBtn, iconBtn, pageOf, emptyRow } from '../ui.js';
import * as games from '../games.js';

const BLUE = '#4d7cff', DIR = 'studio/projects';
let busy = false, remoteLog = null, remoteAt = 0;

const when = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 172800) return 'Yesterday';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// What would go up on the next push
export function changeList(app) {
  const sy = S.getSync(), out = [];
  for (const p of app.projects) {
    const n = S.flatten(p.scenes).length, meta = 'Studio game · ' + n + (n === 1 ? ' scene' : ' scenes');
    if (!sy.pushed[p.id]) out.push({ id: p.id, name: p.name, meta, act: 'Added' });
    else if (sy.pushed[p.id] !== p.updated) out.push({ id: p.id, name: p.name, meta, act: 'Changed' });
  }
  for (const id of sy.deleted || []) out.push({ id, name: (sy.names || {})[id] || 'Deleted game', meta: 'Studio game', act: 'Deleted' });
  // repo games whose settings were adjusted in the Studio
  for (const g of games.editableGames()) {
    const e = games.getEdits(g.file), n = Object.keys(e.overrides).length;
    if (e.dirty && n) out.push({ id: 'g:' + g.file, game: g, name: g.name, meta: 'Game settings · ' + n + (n === 1 ? ' change' : ' changes'), act: 'Changed' });
  }
  return out;
}

// ---------------------------------------------------------------- GitHub REST
async function gh(app, path, body, method) {
  const st = app.settings, headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (st.token) headers.Authorization = 'Bearer ' + st.token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`https://api.github.com/repos/${st.repo}/${path}`, { method: method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (res.status === 404) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (!res.ok) {
    let msg = res.status + '';
    try { msg = (await res.json()).message || msg; } catch (e) {}
    if (res.status === 401) msg = 'GitHub did not accept the token';
    if (res.status === 403 && /rate limit/i.test(msg)) msg = 'GitHub rate limit reached. Add a token in Settings';
    const e = new Error(msg); e.status = res.status; throw e;
  }
  return res.status === 204 ? null : res.json();
}
const b64decode = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
async function remoteFiles(app) {
  try { return (await gh(app, `contents/${DIR}?ref=${encodeURIComponent(app.settings.branch)}`)).filter(f => f.type === 'file' && f.name.endsWith('.json')); }
  catch (e) { if (e.status === 404) return []; throw e; }
}

export async function pushAll(app) {
  if (busy) return;
  if (!app.settings.token) { app.toast('Add a GitHub token in Settings to push'); app.ui.setGroup = 'github'; app.saveUI(); if (app.overlay) app.close(); app.setTab(4); return; }
  if (!navigator.onLine) { app.toast('Offline. Your games are saved here and will push later'); return; }
  const items = changeList(app); if (!items.length) { app.toast('Everything is pushed'); return; }
  busy = true; app.toast('Pushing ' + items.length + (items.length === 1 ? ' change…' : ' changes…')); app.render();
  try {
    const branch = app.settings.branch, ref = await gh(app, `git/ref/heads/${encodeURIComponent(branch)}`), head = ref.object.sha;
    const base = await gh(app, `git/commits/${head}`), have = new Set((await remoteFiles(app)).map(f => f.name));
    const tree = [], sent = {};
    const pushedGames = [];
    for (const it of items) {
      if (it.game) {
        // apply the phone's changes on top of the game.json that is on GitHub right now, so nothing made elsewhere is lost
        const path = `${it.game.file}/game.json`, cur = await gh(app, `contents/${path}?ref=${encodeURIComponent(branch)}`);
        const merged = games.applyOverrides(JSON.parse(b64decode(cur.content)), games.getEdits(it.game.file).overrides);
        tree.push({ path, mode: '100644', type: 'blob', content: JSON.stringify(merged, null, 2) + '\n' }); pushedGames.push(it.game.file);
        continue;
      }
      const path = `${DIR}/${it.id}.json`;
      if (it.act === 'Deleted') { if (have.has(it.id + '.json')) tree.push({ path, mode: '100644', type: 'blob', sha: null }); continue; }
      const p = app.projects.find(x => x.id === it.id); if (!p) continue;
      tree.push({ path, mode: '100644', type: 'blob', content: JSON.stringify(p, null, 1) + '\n' }); sent[p.id] = p.updated;
    }
    const sy = S.getSync();
    if (tree.length) {
      const t = await gh(app, 'git/trees', { base_tree: base.tree.sha, tree });
      const names = items.filter(i => i.act !== 'Deleted').map(i => i.name);
      const message = items.length === 1 ? `Studio: ${items[0].act === 'Deleted' ? 'delete' : items[0].act === 'Added' ? 'add' : 'update'} ${items[0].name}` : `Studio: update ${items.length} games${names.length ? ' (' + names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') + ')' : ''}`;
      const c = await gh(app, 'git/commits', { message: message + '\n\nPushed from Home Arcade on the phone.', tree: t.sha, parents: [head] });
      await gh(app, `git/refs/heads/${encodeURIComponent(branch)}`, { sha: c.sha }, 'PATCH');
      sy.history = [{ msg: message, files: tree.length, hash: c.sha.slice(0, 7), when: Date.now() }, ...(sy.history || [])].slice(0, 30);
    }
    for (const f of pushedGames) { const e = games.getEdits(f); e.dirty = false; games.setEdits(f, e); games.forgetGame(f); }
    Object.assign(sy.pushed, sent); sy.deleted = []; sy.lastSync = 'Pushed ' + new Date().toISOString(); sy.lastAt = Date.now();
    S.setSync(sy); remoteAt = 0;
    app.toast(tree.length ? 'Pushed to GitHub' : 'Up to date');
  } catch (e) {
    app.toast('Push failed: ' + e.message);
  } finally { busy = false; app.render(); }
}

export async function pullAll(app) {
  if (busy) return;
  if (!navigator.onLine) { app.toast('Offline. Try again when you have a connection'); return; }
  busy = true; app.toast('Checking GitHub…'); app.render();
  try {
    const files = await remoteFiles(app), sy = S.getSync();
    let added = 0, updated = 0, kept = 0;
    for (const f of files) {
      const id = f.name.replace(/\.json$/, '');
      if ((sy.deleted || []).includes(id)) continue;
      const blob = await gh(app, `git/blobs/${f.sha}`);
      let remote; try { remote = JSON.parse(b64decode(blob.content)); } catch (e) { continue; }
      if (!remote || !remote.id || !remote.scenes || !remote.assets) continue;
      remote.id = id;
      const local = S.loadProject(id);
      if (!local) { S.saveProject(remote, false); sy.pushed[id] = remote.updated; added++; continue; }
      if ((remote.updated || 0) <= (local.updated || 0)) { if (sy.pushed[id] === undefined) sy.pushed[id] = remote.updated; continue; }
      if (sy.pushed[id] && sy.pushed[id] !== local.updated) {
        // changed in both places: keep the phone's version as a copy
        const copy = { ...local, id: S.uid('p'), name: (local.name + ' (phone)').slice(0, 28) };
        S.saveProject(copy, false); kept++;
      }
      S.saveProject(remote, false); sy.pushed[id] = remote.updated; updated++;
    }
    sy.lastSync = 'Pulled ' + new Date().toISOString(); sy.lastAt = Date.now(); S.setSync(sy); app.refreshProjects();
    app.toast(added || updated ? `Pulled ${added ? added + ' new' : ''}${added && updated ? ', ' : ''}${updated ? updated + ' updated' : ''}${kept ? '. Kept your copy of ' + kept : ''}` : 'Up to date with GitHub');
  } catch (e) {
    app.toast('Pull failed: ' + e.message);
  } finally { busy = false; app.render(); }
}

async function loadLog(app) {
  if (Date.now() - remoteAt < 60000 || !navigator.onLine) return;
  remoteAt = Date.now();
  try {
    const list = await gh(app, `commits?path=studio&sha=${encodeURIComponent(app.settings.branch)}&per_page=20`);
    remoteLog = list.map(c => ({ msg: c.commit.message.split('\n')[0], who: (c.commit.author || {}).name || '', hash: c.sha.slice(0, 7), when: Date.parse((c.commit.author || {}).date) || 0 }));
    app.render();
  } catch (e) { /* offline or no access: the local history still shows */ }
}

export default {
  render(app) {
    const st = app.settings, sy = S.getSync(), changes = changeList(app), n = changes.length;
    const view = app.ui.syncView || 'changes';
    const [owner, name] = st.repo.split('/');
    const lastText = sy.lastAt ? (sy.lastSync.startsWith('Pulled') ? 'Pulled ' : 'Pushed ') + when(sy.lastAt).toLowerCase() : 'Not synced yet';
    const status = busy ? 'Talking to GitHub…' : !st.token ? 'No token · see Settings' : n ? n + (n === 1 ? ' change' : ' changes') + ' not pushed' : lastText;
    const right = `
      <span class="cap acc">GitHub · ${esc(st.branch)}</span>
      <span class="title clamp2">${esc(owner || '')} / ${esc(name || '')}</span>
      <span class="sub">${esc(status)}</span>
      <div class="actions">
        ${plateBtn('up', n ? 'Push ' + n : 'Pushed', A(() => pushAll(app)))}
        ${plateBtn('down', 'Pull', A(() => pullAll(app)))}
      </div>`;
    let items;
    if (view === 'changes') items = changes.map(c => ({ art: icon(c.act === 'Deleted' ? 'trash' : c.game ? 'code' : 'scene', '#e4e2dc'), name: c.name, meta: c.meta, tag: c.act, tagColor: c.act === 'Added' ? BLUE : 'var(--muted)' }));
    else {
      if (st.repo) loadLog(app);
      const seen = new Set(), log = [];
      for (const h of [...(sy.history || []), ...(remoteLog || [])].sort((a, b) => b.when - a.when)) { if (seen.has(h.hash)) continue; seen.add(h.hash); log.push(h); }
      items = log.map((h, j) => ({ art: icon('history', j === 0 ? BLUE : '#e4e2dc'), name: h.msg.replace(/^Studio: /, ''), meta: when(h.when) + (h.files ? ' · ' + h.files + (h.files === 1 ? ' file' : ' files') : h.who ? ' · ' + h.who : ''), tag: h.hash, tagColor: 'var(--muted)' }));
    }
    const pg = pageOf(items, app.ui.syncPage || 0);
    const setPage = (v) => { app.ui.syncPage = v; app.saveUI(); app.render(); };
    const body = `<div class="group">
      <div class="plate bar">
        <div role="tablist" aria-label="Sync views" style="display:flex;align-items:center;gap:4px">
          ${[['changes', 'Changes'], ['history', 'History']].map(([k, l]) => iconBtn(k, A(() => { app.ui.syncView = k; app.ui.syncPage = 0; app.saveUI(); app.render(); }), { on: view === k, label: l, pressed: view === k })).join('')}
          <span class="cap acc" style="padding-left:6px">${view === 'changes' ? 'Changes' : 'History'}</span>
        </div>
        ${pager(pg.range, A(() => setPage(Math.max(0, pg.p - 1))), A(() => setPage(Math.min(pg.pages - 1, pg.p + 1))))}
      </div>
      ${pg.slice.length ? pg.slice.map(it => row({ ...it, still: true })).join('')
        : view === 'changes' ? emptyRow(st.token ? 'check' : 'github', st.token ? 'Everything is pushed to GitHub.' : 'Add a GitHub token in Settings to push your games. Pull works without one.')
        : emptyRow('history', 'Nothing pushed yet.')}
    </div>`;
    return { right, body };
  },
  pad(app, input) {
    if (input.pressed('a')) pushAll(app);
    else if (input.pressed('x')) pullAll(app);
    else if (input.pressed('left') || input.pressed('right')) { app.ui.syncView = (app.ui.syncView || 'changes') === 'changes' ? 'history' : 'changes'; app.ui.syncPage = 0; app.saveUI(); app.render(); }
  }
};
