// Games that live in the repo as code (Crab Platformer and friends).
// The ones with a game.json can be adjusted in the Studio: edits are kept on the phone as a list of
// changed settings ("overrides"), applied on top of the game's game.json when it runs, and pushed to
// GitHub from Sync. Changing only what you touched means updates made on GitHub still come through.

export const CODE_GAMES = [
  { name: 'Crab Platformer', path: '../crab-platformer/', kind: '2D · Canvas', size: '97 KB', file: 'crab-platformer', editable: true, mode: 'Waves',
    about: 'A crab with lemon claws squirts juice at eyes on the beach.' },
  { name: 'Void Wizard', path: '../void-wizard/', kind: '3D · three.js', size: '97 KB', file: 'void-wizard', about: 'A wizard adrift in the void.' },
  { name: 'Phosphor', path: '../phosphor/', kind: '2D · Canvas', size: '239 KB', file: 'phosphor', about: 'A glowing-screen arcade game.' },
  { name: 'Purgatory Bowl', path: '../purgatory-bowl/', kind: '3D · three.js + cannon', size: '287 KB', file: 'purgatory-bowl', about: 'Bowling, with physics, in purgatory.' }
];
export const editableGames = () => CODE_GAMES.filter(g => g.editable);

// The game you're working on, shared by the Studio, Art and Sound tabs (and set by Edit in the Arcade)
export function currentGame(app) {
  const list = editableGames();
  return list.find(g => g.file === app.ui.game) || list[0] || null;
}
export function setCurrentGame(app, g) { if (g && g.editable) { app.ui.game = g.file; app.saveUI(); } }

export const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 172800) return 'yesterday';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
// a short line about a game's changes on this phone
export function editLine(g) {
  if (!g.editable) return g.kind;
  const e = getEdits(g.file), n = Object.keys(e.overrides).length;
  if (!n) return 'No changes on this phone';
  return n + (n === 1 ? ' change · ' : ' changes · ') + 'edited ' + ago(e.edited) + (e.dirty ? '' : ' · pushed');
}

const KEY = (folder) => 'ha.game.' + folder;
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };

// { overrides: { 'player.walkMax': 1.7, ... }, dirty: true when there are edits not yet pushed, edited: time }
export const getEdits = (folder) => ({ overrides: {}, dirty: false, edited: 0, ...read(KEY(folder), {}) });
export function setEdits(folder, e) { try { localStorage.setItem(KEY(folder), JSON.stringify(e)); } catch (err) {} }
export function setValue(folder, path, value) {
  const e = getEdits(folder); e.overrides[path] = value; e.dirty = true; e.edited = Date.now(); setEdits(folder, e);
}
export function resetEdits(folder) { try { localStorage.removeItem(KEY(folder)); } catch (e) {} }
export const editCount = (folder) => Object.keys(getEdits(folder).overrides).length;

// paths look like 'eyes.firstShotFrames.0'
export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
export function setPath(obj, path, value) {
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = value;
}
export function applyOverrides(data, overrides) {
  const out = structuredClone(data);
  for (const [p, v] of Object.entries(overrides || {})) { try { setPath(out, p, v); } catch (e) {} }
  return out;
}

// the game's own files, from the site (the service worker keeps a copy for offline)
const cache = {};
export async function loadGame(folder) {
  if (!cache[folder]) {
    const get = (f) => fetch(`../${folder}/${f}`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    const engine = (f) => fetch(`../engine/${f}`, { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}));
    cache[folder] = Promise.all([get('game.json'), get('studio.json'), engine('behaviors.json'), engine('symbols.json')])
      .then(([data, schema, behaviors, symbols]) => ({ data, schema, behaviors: behaviors.behaviors || {}, symbols }))
      .catch(e => { delete cache[folder]; throw e; });
  }
  return cache[folder];
}
export const forgetGame = (folder) => { delete cache[folder]; };

// open a code game; swiping back from it returns to the app
export function launch(g, scene) { try { sessionStorage.setItem('ha.return', 'app/'); } catch (e) {} location.href = g.path + (scene ? '?scene=' + encodeURIComponent(scene) : ''); }
