// Projects, settings and sync bookkeeping, saved on the phone (localStorage).
//
// A Studio game is ONE project file. Its Library is the one source of sprites, tiles and sounds:
// the Library screen, the Studio trays and the game player all read project.assets through project.library.
//
// project = {
//   v: 1, id, name, created, updated,
//   assets:  { [id]: sprite | tile | sound },
//            sprite: { kind:'sprite', name, px:[8 rows of '0'/'1'], color, role:'player'|'walker'|'flyer'|'pickup'|'goal'|'decor' }
//            tile:   { kind:'tile',   name, px, color, solid, oneway, hurts, climb }
//            sound:  { kind:'sound',  name, wave:'square'|'triangle'|'saw'|'noise', pitch:0..9, slide:-4..4, len:1..9 }
//   library: { sprites: tree, tiles: tree, sounds: tree }   tree = [ assetId | { folder, items: tree } ]
//   scenes:  tree of scene ids, the same folder shape;  sceneData: { [id]: { name, w, h, tiles: { 'x,y': tileId }, objects: [{ id, sprite, x, y, props }] } }
//   events:  { when: [{ id, who: spriteId|'game', ev }], do: [{ id, tgt, act }], cables: [[whenId, doId]] }
//   nextId
// }

const K = { list: 'ha.projects', proj: (id) => 'ha.p.' + id, settings: 'ha.settings', sync: 'ha.sync', ui: 'ha.ui' };
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 8);

// ---------------------------------------------------------------- trees (Library and scenes share this shape)
export const isFolder = (n) => n && typeof n === 'object' && 'folder' in n;
export function listAt(tree, path) { return path.reduce((l, i) => (l[i] && l[i].items) || [], tree); }
export function folderNameAt(tree, path) { let l = tree, n = ''; for (const i of path) { if (!l[i]) break; n = l[i].folder; l = l[i].items; } return n; }
export function editAt(tree, path, fn) {
  if (!path.length) return fn(tree);
  return tree.map((n, i) => (i === path[0] ? { ...n, items: editAt(n.items, path.slice(1), fn) } : n));
}
export function flatten(tree) { const out = []; (function walk(l) { for (const n of l) isFolder(n) ? walk(n.items) : out.push(n); })(tree); return out; }
export function pathOf(tree, id) {
  let found = null;
  (function walk(l, p) { l.forEach((n, i) => { if (found) return; if (isFolder(n)) walk(n.items, p.concat([i])); else if (n === id) found = p; }); })(tree, []);
  return found;
}
export function removeFromTree(tree, id) { return tree.filter(n => n !== id).map(n => (isFolder(n) ? { ...n, items: removeFromTree(n.items, id) } : n)); }
export const countItems = (n) => (isFolder(n) ? flatten(n.items).length : 1);

// ---------------------------------------------------------------- starter content
const SPR = {
  player: ['00111100','00111100','00011000','01111110','00011000','00011000','00100100','01000010'],
  crab:   ['01000010','10000001','10111101','01111110','11111111','01111110','10100101','00000000'],
  bat:    ['10000001','11000011','11111111','01011010','00111100','00011000','00000000','00000000'],
  coin:   ['00111100','01000010','10011001','10010001','10010001','10011001','01000010','00111100'],
  goal:   ['01111000','01111110','01111000','01000000','01000000','01000000','01000000','11100000'],
  ground: ['11111111','10000001','10100101','10000001','10010001','10000101','10000001','11111111'],
  brick:  ['11111111','10010001','10010001','11111111','11000101','10000101','10000101','11111111'],
  ledge:  ['11111111','10101011','11111111','00000000','00000000','00000000','00000000','00000000'],
  spike:  ['00000000','00011000','00011000','00111100','00111100','01111110','01111110','11111111'],
  ladder: ['10000001','11111111','10000001','10000001','11111111','10000001','10000001','11111111']
};
export const BLANK8 = ['00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000'];
export const ROLE_PROPS = {
  player: { speed: 6, jump: 4, lives: 3 },
  walker: { speed: 3, patrol: 4, edges: true },
  flyer: { speed: 3, patrol: 5 },
  pickup: {}, goal: {}, decor: {}
};

function starterAssets() {
  return {
    sp_player: { kind: 'sprite', name: 'Player', px: SPR.player, color: 'white', role: 'player' },
    sp_crab: { kind: 'sprite', name: 'Crab', px: SPR.crab, color: 'orange', role: 'walker' },
    sp_bat: { kind: 'sprite', name: 'Bat', px: SPR.bat, color: 'pink', role: 'flyer' },
    sp_coin: { kind: 'sprite', name: 'Coin', px: SPR.coin, color: 'yellow', role: 'pickup' },
    sp_goal: { kind: 'sprite', name: 'Goal', px: SPR.goal, color: 'green', role: 'goal' },
    tl_ground: { kind: 'tile', name: 'Ground', px: SPR.ground, color: 'bone', solid: true, oneway: false, hurts: false, climb: false },
    tl_brick: { kind: 'tile', name: 'Brick', px: SPR.brick, color: 'gray', solid: true, oneway: false, hurts: false, climb: false },
    tl_ledge: { kind: 'tile', name: 'Ledge', px: SPR.ledge, color: 'bone', solid: false, oneway: true, hurts: false, climb: false },
    tl_spike: { kind: 'tile', name: 'Spike', px: SPR.spike, color: 'orange', solid: false, oneway: false, hurts: true, climb: false },
    tl_ladder: { kind: 'tile', name: 'Ladder', px: SPR.ladder, color: 'gray', solid: false, oneway: false, hurts: false, climb: true },
    sd_jump: { kind: 'sound', name: 'Jump', wave: 'square', pitch: 5, slide: 3, len: 2 },
    sd_coin: { kind: 'sound', name: 'Coin', wave: 'square', pitch: 8, slide: 2, len: 3 },
    sd_hurt: { kind: 'sound', name: 'Hurt', wave: 'noise', pitch: 3, slide: -3, len: 4 },
    sd_win: { kind: 'sound', name: 'Win', wave: 'triangle', pitch: 6, slide: 4, len: 8 }
  };
}
function starterLibrary() {
  return {
    sprites: [{ folder: 'Enemies', items: ['sp_crab', 'sp_bat'] }, 'sp_player', 'sp_coin', 'sp_goal'],
    tiles: [{ folder: 'Hazards', items: ['tl_spike'] }, 'tl_ground', 'tl_brick', 'tl_ledge', 'tl_ladder'],
    sounds: ['sd_jump', 'sd_coin', 'sd_hurt', 'sd_win']
  };
}
const TILECH = { '#': 'tl_ground', B: 'tl_brick', '=': 'tl_ledge', '^': 'tl_spike', H: 'tl_ladder' };
function sceneFrom(name, rows, objs) {
  const tiles = {};
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (TILECH[r[x]]) tiles[x + ',' + y] = TILECH[r[x]]; });
  const objects = objs.map(([sprite, x, y, props]) => {
    const role = starterAssets()[sprite].role;
    return { id: uid('o'), sprite, x, y, props: { ...ROLE_PROPS[role], ...(props || {}) } };
  });
  return { name, w: rows[0].length, h: rows.length, tiles, objects };
}
function starterScenes() {
  const L1 = [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..............................====......',
    '........................................',
    '..........====..........................',
    '........................................',
    '........................HBBBB...........',
    '.....====.........=====.H...............',
    '........................H...............',
    '........................H...............',
    '........................H...............',
    '#############..###########..############',
    '#############..###########^^############'];
  const L2 = [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..............................=====.....',
    '........................................',
    '..........====..........................',
    '........................................',
    '....====................====............',
    '........................................',
    '........................................',
    '........................................',
    '#########..#########..########...#######',
    '#########^^#########^^########^^^#######'];
  const BOSS = [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    'B......................................B',
    'B................======................B',
    'B......................................B',
    'B......................................B',
    'B.......=======..........=======.......B',
    'B......................................B',
    'B......................................B',
    'B......................................B',
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'];
  return {
    tree: [{ folder: 'World 1', items: ['sc_1', 'sc_2', 'sc_boss'] }],
    data: {
      sc_1: sceneFrom('Level 1', L1, [['sp_player', 2, 15], ['sp_coin', 6, 11], ['sp_coin', 7, 11], ['sp_coin', 11, 8], ['sp_coin', 12, 8], ['sp_coin', 20, 11],
        ['sp_coin', 26, 10], ['sp_coin', 31, 6], ['sp_coin', 32, 6], ['sp_crab', 18, 15], ['sp_crab', 34, 15], ['sp_goal', 38, 15]]),
      sc_2: sceneFrom('Level 2', L2, [['sp_player', 2, 15], ['sp_coin', 5, 11], ['sp_coin', 11, 9], ['sp_coin', 12, 9], ['sp_coin', 25, 11], ['sp_coin', 31, 7],
        ['sp_coin', 33, 7], ['sp_crab', 15, 15, { speed: 4 }], ['sp_crab', 26, 15], ['sp_bat', 20, 10], ['sp_goal', 38, 15]]),
      sc_boss: sceneFrom('Boss', BOSS, [['sp_player', 2, 15], ['sp_crab', 12, 15, { speed: 4, patrol: 6 }], ['sp_crab', 20, 15, { speed: 5, patrol: 8 }], ['sp_crab', 29, 15, { speed: 4, patrol: 6 }],
        ['sp_bat', 12, 7], ['sp_bat', 28, 7, { speed: 4 }], ['sp_coin', 18, 8], ['sp_coin', 19, 8], ['sp_coin', 20, 8], ['sp_coin', 21, 8], ['sp_goal', 37, 15]])
    }
  };
}
export function starterEvents() {
  return {
    when: [
      { id: 'w1', who: 'sp_crab', ev: 'touch' }, { id: 'w2', who: 'sp_crab', ev: 'stomp' }, { id: 'w3', who: 'sp_coin', ev: 'touch' },
      { id: 'w4', who: 'sp_goal', ev: 'touch' }, { id: 'w5', who: 'sp_bat', ev: 'touch' }, { id: 'w6', who: 'sp_player', ev: 'pressA' }, { id: 'w7', who: 'sp_player', ev: 'falls' }],
    do: [
      { id: 'd1', tgt: 'player', act: 'hurt' }, { id: 'd2', tgt: 'it', act: 'remove' }, { id: 'd3', tgt: 'score', act: 'add50' }, { id: 'd4', tgt: 'score', act: 'add10' },
      { id: 'd5', tgt: 'player', act: 'bounce' }, { id: 'd6', tgt: 'game', act: 'next' }, { id: 'd7', tgt: 'sound', act: 'sd_jump' }, { id: 'd8', tgt: 'sound', act: 'sd_coin' }],
    cables: [['w1', 'd1'], ['w2', 'd2'], ['w2', 'd3'], ['w2', 'd5'], ['w3', 'd4'], ['w3', 'd2'], ['w3', 'd8'], ['w4', 'd6'], ['w5', 'd1'], ['w6', 'd7'], ['w7', 'd1']]
  };
}

// WHEN / DO vocabulary, shared by the editor and the player
export const WHEN_EVENTS = { touch: 'Touches player', stomp: 'Is stomped', pressA: 'Presses A', falls: 'Falls off', start: 'Starts', second: 'Every second' };
export function whenEventsFor(who, project) {
  if (who === 'game') return ['start', 'second'];
  const a = project.assets[who];
  if (a && a.role === 'player') return ['pressA', 'falls'];
  return ['touch', 'stomp'];
}
export const DO_TARGETS = ['it', 'player', 'score', 'game', 'sound'];
export const DO_ACTS = { it: ['remove', 'turn'], player: ['hurt', 'bounce', 'respawn'], score: ['add10', 'add50', 'add100'], game: ['next', 'restart', 'win'] };
export const DO_LABEL = { remove: 'Is removed', turn: 'Turns around', hurt: 'Loses a life', bounce: 'Bounces', respawn: 'Respawns', add10: 'Add 10', add50: 'Add 50', add100: 'Add 100', next: 'Next scene', restart: 'Restart scene', win: 'Wins' };
export const actsFor = (tgt, project) => (tgt === 'sound' ? flatten(project.library.sounds) : DO_ACTS[tgt]);
export const doLabel = (d, project) => (d.tgt === 'sound' ? 'Plays ' + ((project.assets[d.act] || {}).name || 'sound') : DO_LABEL[d.act] || d.act);
export const whoLabel = (who, project) => (who === 'game' ? 'Game' : ((project.assets[who] || {}).name || '?'));
export const tgtLabel = (t) => ({ it: 'It', player: 'Player', score: 'Score', game: 'Game', sound: 'Sound' }[t]);

export function newProject(name, sample = true) {
  const now = Date.now(), sc = starterScenes();
  const p = { v: 1, id: uid('p'), name, created: now, updated: now, assets: starterAssets(), library: starterLibrary(), scenes: sc.tree, sceneData: sc.data, events: starterEvents(), nextId: 100 };
  if (!sample) {
    const rows = Array.from({ length: 18 }, (_, y) => (y >= 16 ? '#'.repeat(40) : '.'.repeat(40)));
    p.scenes = ['sc_1']; p.sceneData = { sc_1: sceneFrom('Level 1', rows, [['sp_player', 2, 15], ['sp_goal', 37, 15]]) };
  }
  return p;
}
export const blankScene = (name) => {
  const rows = Array.from({ length: 18 }, (_, y) => (y >= 16 ? '#'.repeat(40) : '.'.repeat(40)));
  return sceneFrom(name, rows, [['sp_player', 2, 15]]);
};

// ---------------------------------------------------------------- persistence
export function listProjects() {
  let ids = read(K.list, null);
  if (!ids) {
    const p = newProject('Tide Pool');
    ids = [p.id]; write(K.proj(p.id), p); write(K.list, ids);
  }
  return ids.map(id => read(K.proj(id), null)).filter(Boolean);
}
export const loadProject = (id) => read(K.proj(id), null);
export function saveProject(p, touch = true) {
  if (touch) p.updated = Date.now();
  const ok = write(K.proj(p.id), p);
  const ids = read(K.list, []);
  if (!ids.includes(p.id)) { ids.push(p.id); write(K.list, ids); }
  return ok;
}
export function deleteProject(id) {
  const name = (read(K.proj(id), {}) || {}).name;
  write(K.list, read(K.list, []).filter(x => x !== id));
  try { localStorage.removeItem(K.proj(id)); } catch (e) {}
  const s = getSync(); if (s.pushed[id]) { s.deleted = [...new Set([...(s.deleted || []), id])]; s.names = { ...(s.names || {}), [id]: name }; } delete s.pushed[id]; setSync(s);
}

export const DEFAULT_SETTINGS = { labels: 'XBOX', rumble: true, deadzone: 2, swapAB: false, autoPush: false, sfx: 7, menuSounds: true, reduceMotion: false, dots: true, textSize: 'NORMAL', repo: 'pinchlemon/home-arcade', branch: 'main', token: '' };
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(K.settings, {}) });
export const setSettings = (s) => write(K.settings, s);

export const getSync = () => ({ pushed: {}, deleted: [], history: [], lastSync: '', ...read(K.sync, {}) });
export const setSync = (s) => write(K.sync, s);

export const getUI = () => ({ tab: 0, sel: 0, page: 0, project: null, ...read(K.ui, {}) });
export const setUI = (u) => write(K.ui, u);
