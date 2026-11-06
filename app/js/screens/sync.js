// Sync: send the changes made on this phone to GitHub. Lives in Settings (the Sync group); the Settings
// tab shows a dot while there is something to push. Each game's changes are applied on top of the
// game.json that is on GitHub at that moment, so anything changed elsewhere (by Claude, or on the computer)
// is kept. Sprites drawn on the phone go up as files (their .aseprite and .png; new ones are added to studio.json).
// Everything goes up in one commit (git data API).
import { icon } from '../pixel.js';
import * as S from '../store.js';
import { row } from '../ui.js';
import * as games from '../games.js';
import { openReview } from './review.js';
import * as store from '../artStore.js';

const BLUE = '#4d7cff';
let busy = false, remoteLog = null, remoteAt = 0;
export const isBusy = () => busy;

export const when = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 172800) return 'Yesterday';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// What would go up on the next push: every game with changes not yet pushed
export function changeList() {
  const out = [];
  for (const g of games.editableGames()) {
    const e = games.getEdits(g.file), n = e.dirty ? games.editCount(g.file) : 0, art = store.dirtyFor(g.file);
    if (!n && !art.length) continue;
    const parts = [n ? n + (n === 1 ? ' change' : ' changes') : '', art.length ? art.length + (art.length === 1 ? ' sprite' : ' sprites') : ''].filter(Boolean);
    const when = Math.max(n ? e.edited : 0, ...art.map(r => r.edited));
    out.push({ game: g, name: g.name, settings: n, art, meta: parts.join(' · ') + ' · edited ' + games.ago(when), act: 'Changed' });
  }
  return out;
}

// The dot on the Settings tab and the Sync group: changes you haven't looked at yet. Opening a game's changes (Review) marks
// what is there as seen; a new change brings the dot back. (The changes themselves stay listed until pushed or discarded.)
// What a game's changes amount to right now (only settings that really differ from GitHub). The dot compares this with what you last
// looked at, so changing something and changing it back leaves it as it was and brings nothing back.
const signature = (file) => { const o = games.getEdits(file).overrides; return JSON.stringify([games.realChanges(file).sort().map(p => [p, o[p]]), store.dirtyFor(file).map(r => [r.itemId, r.edited])]); };
export const unseenCount = () => { const seen = S.getSync().seen || {}; return changeList().filter(c => seen[c.game.file] !== signature(c.game.file)).length; };
export function markSeen(g) { const sy = S.getSync(); sy.seen = { ...(sy.seen || {}), [g.file]: signature(g.file) }; S.setSync(sy); }

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

export async function pushAll(app, quiet) {
  if (busy) return;
  const items = changeList();
  if (!items.length) { if (!quiet) app.toast('Everything is pushed'); return; }
  if (!app.settings.token) { if (!quiet) { app.toast('Add a GitHub token to push'); app.ui.setGroup = 'github'; app.saveUI(); if (app.overlay) app.close(); app.setTab(4); } return; }
  if (!navigator.onLine) { app.toast('Offline. Your changes are saved here and will push later'); return; }
  busy = true; app.toast('Pushing ' + items.length + (items.length === 1 ? ' game…' : ' games…')); app.render();
  try {
    const branch = app.settings.branch, ref = await gh(app, `git/ref/heads/${encodeURIComponent(branch)}`), head = ref.object.sha;
    const base = await gh(app, `git/commits/${head}`), tree = [], pushed = [], art = [], schemaChanged = [];
    for (const it of items) {
      if (it.settings) {
        const path = `${it.game.file}/game.json`, cur = await gh(app, `contents/${path}?ref=${encodeURIComponent(branch)}`);
        const merged = games.applyOverrides(JSON.parse(b64decode(cur.content)), games.getEdits(it.game.file).overrides);
        tree.push({ path, mode: '100644', type: 'blob', content: JSON.stringify(merged, null, 2) + '\n' }); pushed.push(it.game.file);
      }
      // sprites: both files of each, as they are on the phone
      for (const r of it.art) {
        for (const p of [r.png, r.ase]) {
          const f = await store.file(it.game.file + '/' + p); if (!f) continue;
          const b = await gh(app, 'git/blobs', { content: store.toBase64(f.bytes), encoding: 'base64' });
          tree.push({ path: it.game.file + '/' + p, mode: '100644', type: 'blob', sha: b.sha });
        }
        art.push(r);
      }
      // new sprites join the game's Art list (studio.json), in their folder
      const fresh = it.art.filter(r => r.item && r.isNew);
      if (fresh.length) {
        const path = `${it.game.file}/studio.json`, cur = await gh(app, `contents/${path}?ref=${encodeURIComponent(branch)}`), schema = JSON.parse(b64decode(cur.content));
        schema.art = schema.art || { folders: [] }; schema.art.folders = schema.art.folders || [];
        for (const r of fresh) {
          let f = schema.art.folders.find(x => x.id === r.folder);
          if (!f) schema.art.folders.push(f = { id: r.folder, name: r.folder[0].toUpperCase() + r.folder.slice(1), items: [] });
          const i = f.items.findIndex(x => x.id === r.item.id);
          if (i >= 0) f.items[i] = r.item; else f.items.push(r.item);
        }
        tree.push({ path, mode: '100644', type: 'blob', content: JSON.stringify(schema, null, 2) + '\n' }); schemaChanged.push(it.game.file);
      }
    }
    const t = await gh(app, 'git/trees', { base_tree: base.tree.sha, tree });
    const what = (i) => [i.settings ? 'settings' : '', i.art.length ? i.art.map(r => r.name).slice(0, 3).join(', ') + (i.art.length > 3 ? '…' : '') : ''].filter(Boolean).join(' and ');
    const message = items.length === 1 ? `Studio: update ${items[0].name} (${what(items[0])})` : `Studio: update ${items.length} games (${items.slice(0, 3).map(i => i.name).join(', ')}${items.length > 3 ? '…' : ''})`;
    const c = await gh(app, 'git/commits', { message: message + '\n\nPushed from Hedron on the phone.', tree: t.sha, parents: [head] });
    await gh(app, `git/refs/heads/${encodeURIComponent(branch)}`, { sha: c.sha }, 'PATCH');
    for (const f of pushed) { const e = games.getEdits(f); e.dirty = false; games.setEdits(f, e); games.forgetGame(f); }
    if (art.length) await store.markPushed(art);
    schemaChanged.forEach(f => games.forgetGame(f));
    const sy = S.getSync();
    sy.history = [{ msg: message, files: tree.length, hash: c.sha.slice(0, 7), when: Date.now() }, ...(sy.history || [])].slice(0, 30);
    sy.lastSync = 'Pushed ' + new Date().toISOString(); sy.lastAt = Date.now(); S.setSync(sy); remoteAt = 0;
    app.toast('Pushed to GitHub');
  } catch (e) {
    app.toast('Push failed: ' + e.message);
  } finally { busy = false; app.render(); }
}

// Recent commits that touched the games, from GitHub (and this phone's own pushes, when offline)
async function loadLog(app) {
  if (Date.now() - remoteAt < 60000 || !navigator.onLine) return;
  remoteAt = Date.now();
  try {
    const paths = games.editableGames().map(g => g.file + '/game.json');
    const lists = await Promise.all(paths.map(p => gh(app, `commits?path=${encodeURIComponent(p)}&sha=${encodeURIComponent(app.settings.branch)}&per_page=15`).catch(() => [])));
    remoteLog = lists.flat().map(c => ({ msg: c.commit.message.split('\n')[0], who: (c.commit.author || {}).name || '', hash: c.sha.slice(0, 7), when: Date.parse((c.commit.author || {}).date) || 0 }));
    app.render();
  } catch (e) { /* offline or no access: the local history still shows */ }
}

// The Sync group in Settings: heading, two buttons, and the rows (changes or history)
export function syncGroup(app, plateBtn, A, n) {
  const st = app.settings, sy = S.getSync(), changes = changeList(), k = changes.length, view = app.ui.syncView || 'changes';
  const last = sy.lastAt ? 'Pushed ' + when(sy.lastAt).toLowerCase() : 'Not pushed yet';
  const title = busy ? 'Talking to GitHub…' : k ? k + (k === 1 ? ' game to push' : ' games to push') : 'All pushed';
  const sub = !st.token ? 'Add a token under GitHub' : last;
  const a = plateBtn('up', k ? 'Push ' + k : 'Pushed', A(() => pushAll(app)));
  const b = plateBtn(view === 'changes' ? 'history' : 'changes', view === 'changes' ? 'History' : 'Changes', A(() => { app.ui.syncView = view === 'changes' ? 'history' : 'changes'; app.saveUI(); app.render(); }));
  let items;
  if (view === 'changes') items = changes.map(c => ({ art: icon('code', '#e4e2dc'), name: c.name, meta: c.meta, tag: 'Review', tagColor: BLUE, act: A(() => openReview(app, c.game)) }));
  else {
    if (st.repo) loadLog(app);
    const seen = new Set(), log = [];
    for (const h of [...(sy.history || []), ...(remoteLog || [])].sort((x, y) => y.when - x.when)) { if (seen.has(h.hash)) continue; seen.add(h.hash); log.push(h); }
    items = log.map((h, j) => ({ art: icon('history', j === 0 ? BLUE : '#e4e2dc'), name: h.msg.replace(/^Studio: /, ''), meta: when(h.when) + (h.who ? ' · ' + h.who : ''), tag: h.hash, tagColor: 'var(--muted)' }));
  }
  const one = (it) => row({ ...it, still: !it.act });
  let rows = items.slice(0, n).map(one).join('');
  if (items.length > n) rows = items.slice(0, n - 1).map(one).join('') + `<div class="plate row-empty"><span class="sub">And ${items.length - n + 1} more</span></div>`;
  if (!items.length) rows = `<div class="plate row-empty"><span class="sub" style="white-space:normal">${view === 'changes' ? 'Nothing to push. Changes you make in the Studio show up here; tap one to review it.' : 'No history yet.'}</span></div>`;
  return { title, sub, a, b, rows };
}
