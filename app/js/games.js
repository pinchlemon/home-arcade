// Games that live in the repo as code (Crab Platformer and friends).
// The ones with a game.json can be adjusted in the Studio: edits are kept on the phone as a list of
// changed settings ("overrides"), applied on top of the game's game.json when it runs, and pushed to
// GitHub from Sync. Changing only what you touched means updates made on GitHub still come through.

export const CODE_GAMES = [
  { name: 'Crab Platformer', path: '../crab-platformer/', kind: '2D · Canvas', size: '97 KB', file: 'crab-platformer', editable: true, mode: 'Waves' },
  { name: 'Void Wizard', path: '../void-wizard/', kind: '3D · three.js', size: '97 KB', file: 'void-wizard' },
  { name: 'Phosphor', path: '../phosphor/', kind: '2D · Canvas', size: '239 KB', file: 'phosphor' },
  { name: 'Purgatory Bowl', path: '../purgatory-bowl/', kind: '3D · three.js + cannon', size: '287 KB', file: 'purgatory-bowl' },
  { name: 'Circuit Crush', path: '../circuit-crush/', kind: '2D · Canvas · study game', size: '371 KB', file: 'circuit-crush' }
];
// games made with New game (newGame.js): the ones on this phone, then (once loaded) the ones listed in games/index.json on GitHub
import * as made from './newGame.js';
const KINDS = { platformer: 'Platformer', topdown: 'Top-down' };
export function addMade(g) {
  if (CODE_GAMES.some(x => x.file === g.file)) return null;
  const e = { name: g.name, path: '../' + g.file + '/', kind: (KINDS[g.template] || 'Tile game') + ' · tile engine', size: 'new', file: g.file, editable: true, made: true, template: g.template };
  CODE_GAMES.push(e); return e;
}
made.local().forEach(addMade);
export const listed = fetch('../games/index.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : { games: [] })).then(j => (j.games || []).map(addMade).filter(Boolean).length).catch(() => 0);
export const editableGames = () => CODE_GAMES.filter(g => g.editable);

// The game you're working on is the one selected in the Arcade; the Studio, Art and Sound tabs all show it.
// Only games with a game.json (editable) can be opened there; the others say so.
export function currentGame(app) { return CODE_GAMES[app.ui.sel] || CODE_GAMES[0] || null; }
export function setCurrentGame(app, g) {
  const i = CODE_GAMES.indexOf(g); if (i < 0) return;
  app.ui.sel = i; app.ui.page = null; app.saveUI();
}

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
  const e = getEdits(g.file), n = realChanges(g.file).length;
  if (!n) return 'No changes';
  return n + (n === 1 ? ' change' : ' changes') + (e.dirty ? ' · not pushed' : ' · pushed');
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
// The settings that really differ from the game.json on GitHub. A setting changed and then changed back
// is still stored, but it isn't a change. (Until the game's file has loaded, every stored setting counts.)
const bases = {};
export function realChanges(folder) {
  const o = getEdits(folder).overrides, b = bases[folder];
  return Object.keys(o).filter(p => !b || JSON.stringify(getPath(b, p)) !== JSON.stringify(o[p]));
}
export const editCount = (folder) => realChanges(folder).length;
// load every editable game's file in the background, so counts and dots are right from the start
export function preload(then) { editableGames().forEach(g => loadGame(g.file).then(() => then && then()).catch(() => {})); }

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
      .then(([data, schema, behaviors, symbols]) => (bases[folder] = data, { data, schema, behaviors: behaviors.behaviors || {}, symbols }))
      .catch(e => { delete cache[folder]; throw e; });
  }
  return cache[folder];
}
export const forgetGame = (folder) => { delete cache[folder]; delete bases[folder]; };

// open a code game; swiping back from it returns to the app
// (and it tells the game whether a controller is in use, so the game doesn't wait for the browser to notice it)
export function launch(g, scene) {
  try { sessionStorage.setItem('ha.return', 'app/'); sessionStorage.setItem('ha.pad', [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(x => x && x.connected) ? '1' : '0'); } catch (e) {} location.href = g.path + (scene ? '?scene=' + encodeURIComponent(scene) : ''); }
