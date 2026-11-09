// New game: a game on the shared tile engine (engine/tiles.js), made on the phone from a template.
// Its files (index.html, game.json, studio.json) live under games/<folder>/ in the phone's IndexedDB (artStore), and the
// service worker serves them there, so the game plays offline before it is pushed. Pushing (Sync) puts them on GitHub and
// adds the game to games/index.json, which every phone reads to list it.
import * as store from './artStore.js';

const LOCAL = 'ha.newgames';   // games made on this phone: [{ file, name, template, made, pushed }]
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || []; } catch (e) { return []; } };
const writeLocal = (l) => { try { localStorage.setItem(LOCAL, JSON.stringify(l)); } catch (e) { /* storage full */ } };
export const local = readLocal;
export function markPushed(file) { writeLocal(readLocal().map(g => (g.file === file ? { ...g, pushed: true } : g))); }
export const isUnpushed = (file) => readLocal().some(g => g.file === file && !g.pushed);
export function forget(file) { writeLocal(readLocal().filter(g => g.file !== file)); }
// games deleted in the Arcade: [{ file, name, pushed }]. One that was on GitHub stays listed (not pushed) until Sync takes it off;
// after that it stays (pushed) so a games/index.json the site has not caught up with yet does not bring it back
const GONE = 'ha.deletedgames';
export const deleted = () => { try { return JSON.parse(localStorage.getItem(GONE)) || []; } catch (e) { return []; } };
const writeGone = (l) => { try { localStorage.setItem(GONE, JSON.stringify(l.slice(-50))); } catch (e) { /* storage full */ } };
export const isDeleted = (file) => deleted().some(g => g.file === file);
export const toDelete = () => deleted().filter(g => !g.pushed);
export function markDeleted(file, name, template) { writeGone([...deleted().filter(g => g.file !== file), { file, name, template, pushed: false }]); }
export function markDeletePushed(files) { writeGone(deleted().map(g => (files.includes(g.file) ? { ...g, pushed: true } : g))); }
export function undelete(file) { writeGone(deleted().filter(g => g.file !== file)); }

// ---------------------------------------------------------------- tiles: one character each; rows use 1 (colour), 2 (shade), 0 (clear)
const TILESETS = {
  platformer: {
    '#': { name: 'Ground', color: '#7a9a4a', shade: '#5a4632', solid: true, symbol: ['11111111', '12111211', '22222222', '22122222', '22222212', '22222222', '21222222', '22222122'] },
    'B': { name: 'Brick', color: '#b0563c', solid: true, symbol: ['11111112', '11111112', '11111112', '22222222', '11121111', '11121111', '11121111', '22222222'] },
    'S': { name: 'Stone', color: '#8b8794', solid: true, symbol: ['11111112', '12211112', '12111112', '11111112', '11111222', '11112212', '11111112', '22222222'] },
    '=': { name: 'Platform', color: '#d6a35a', oneWay: true, symbol: ['11111111', '21122112', '02000020', '00000000', '00000000', '00000000', '00000000', '00000000'] },
    '^': { name: 'Spikes', color: '#d6d2dc', hurt: true, symbol: ['00000000', '00000000', '00100010', '00100010', '01110111', '01110111', '11111111', '22222222'] },
    '"': { name: 'Grass', color: '#8fd25a', symbol: ['00000000', '00000000', '00000000', '00000000', '00010000', '01010010', '01011010', '11011011'] }
  },
  topdown: {
    'W': { name: 'Wall', color: '#8b8794', solid: true, symbol: ['11111112', '11111112', '11111112', '22222222', '11121111', '11121111', '11121111', '22222222'] },
    'T': { name: 'Tree', color: '#3a9a5c', shade: '#1f5a36', solid: true, symbol: ['00111100', '01111210', '11112111', '11211121', '12111211', '02222220', '00022000', '00022000'] },
    '~': { name: 'Water', color: '#2f6f8f', shade: '#4a9ac0', solid: true, symbol: ['11111111', '11122111', '12211221', '11111111', '11111111', '11221111', '22112211', '11111111'] },
    '"': { name: 'Grass', color: '#4e8a3a', symbol: ['00000000', '01000100', '01001100', '00000000', '00000000', '00100010', '01100010', '00000000'] },
    ':': { name: 'Path', color: '#a08a5c', symbol: ['11111111', '11121111', '11111111', '12111111', '11111121', '11111111', '11211111', '11111111'] },
    '^': { name: 'Spikes', color: '#d6d2dc', hurt: true, symbol: ['00000000', '01000100', '11101110', '00000000', '00100010', '01110111', '00000000', '00000000'] }
  }
};
const OBJECTS = {
  platformer: {
    coin: { name: 'Coin', base: 'actor', symbol: 'coin', color: '#ffd23f', scale: 1, behaviors: [{ type: 'collectible', score: 1, hearts: 0 }, { type: 'hover', bob: 1, bobSpeed: 0.08 }] },
    heart: { name: 'Heart', base: 'actor', symbol: 'heart', color: '#ff4f5e', scale: 1, behaviors: [{ type: 'collectible', score: 0, hearts: 1 }, { type: 'hover', bob: 1, bobSpeed: 0.06 }] },
    blob: { name: 'Blob', base: 'actor', symbol: 'blob', color: '#ff4fd8', scale: 1, behaviors: [{ type: 'patrol', speed: 0.4, range: 40 }, { type: 'touchDamage' }, { type: 'health', hp: 1 }] },
    bat: { name: 'Bat', base: 'actor', symbol: 'bat', color: '#8b5cf6', scale: 1, behaviors: [{ type: 'chase', range: 70, speed: 0.6, fly: true }, { type: 'touchDamage' }, { type: 'health', hp: 2 }] },
    spring: { name: 'Spring', base: 'actor', symbol: 'spring', color: '#7dff6a', scale: 1, behaviors: [{ type: 'bouncer', strength: 6 }] },
    lift: { name: 'Lift', base: 'actor', symbol: 'block', color: '#d6a35a', scale: 1, behaviors: [{ type: 'solid' }, { type: 'mover', dx: 32, dy: 0, period: 180 }] }
  },
  topdown: {
    coin: { name: 'Coin', base: 'actor', symbol: 'coin', color: '#ffd23f', scale: 1, behaviors: [{ type: 'collectible', score: 1, hearts: 0 }] },
    heart: { name: 'Heart', base: 'actor', symbol: 'heart', color: '#ff4f5e', scale: 1, behaviors: [{ type: 'collectible', score: 0, hearts: 1 }] },
    blob: { name: 'Blob', base: 'actor', symbol: 'blob', color: '#ff4fd8', scale: 1, behaviors: [{ type: 'patrol', speed: 0.4, range: 32 }, { type: 'touchDamage' }, { type: 'health', hp: 2 }] },
    skull: { name: 'Skull', base: 'actor', symbol: 'skull', color: '#d6d2dc', scale: 1, behaviors: [{ type: 'shooter', range: 80, every: 100, speed: 1.2 }, { type: 'touchDamage' }, { type: 'health', hp: 3 }] },
    bat: { name: 'Bat', base: 'actor', symbol: 'bat', color: '#8b5cf6', scale: 1, behaviors: [{ type: 'chase', range: 60, speed: 0.5, fly: true }, { type: 'touchDamage' }, { type: 'health', hp: 1 }] },
    rock: { name: 'Rock', base: 'actor', symbol: 'block', color: '#8b8794', scale: 1, behaviors: [{ type: 'solid' }] }
  }
};

// ---------------------------------------------------------------- the first level: a blank slate
// Only what is needed to play it: a floor (platformer) or walls (top-down), the player start and the exit.
// The tiles and objects are there to paint and place.
function grid(w, h, ch = '.') { return Array.from({ length: h }, () => Array(w).fill(ch)); }
const rows = (g) => g.map(r => r.join(''));
function platformerLevel() {
  const w = 40, h = 18, g = grid(w, h), T = 8, ground = 16 * T;
  for (let x = 0; x < w; x++) { g[16][x] = '#'; g[17][x] = '#'; }
  return { id: 'level-1', name: 'Level 1', kind: 'tiles', w, h, map: rows(g), start: { x: 2 * T, y: ground }, exit: { x: (w - 2) * T, y: ground }, things: [] };
}
function topdownLevel() {
  const w = 32, h = 24, g = grid(w, h), T = 8;
  for (let x = 0; x < w; x++) { g[0][x] = 'W'; g[h - 1][x] = 'W'; }
  for (let y = 0; y < h; y++) { g[y][0] = 'W'; g[y][w - 1] = 'W'; }
  return { id: 'level-1', name: 'Level 1', kind: 'tiles', w, h, map: rows(g), start: { x: 3 * T, y: 3 * T }, exit: { x: (w - 3) * T, y: (h - 2) * T }, things: [] };
}

// ---------------------------------------------------------------- what the Studio shows (studio.json)
function studio(template) {
  const f = (path, label, help, min, max, step, show) => ({ path, label, help, min, max, step, ...(show ? { show } : {}) });
  const move = template === 'topdown'
    ? [f('player.speed', 'Speed', 'How fast the player walks', 0.3, 3, 0.1)]
    : [f('player.walkMax', 'Top speed', 'How fast the player moves', 0.5, 4, 0.05), f('player.walkAccel', 'Speed up', 'How quickly the player reaches top speed', 0.02, 1, 0.01), f('player.stopDecel', 'Slow down', 'How quickly the player stops', 0.02, 1, 0.01)];
  const groups = [{ id: 'movement', name: 'Movement', scope: 'game', fields: move }];
  if (template !== 'topdown') groups.push({ id: 'jump', name: 'Jump', scope: 'game', fields: [
    f('player.jumpSpeed', 'Jump power', 'How hard the player jumps', 1, 8, 0.1), f('player.gravity', 'Gravity', 'How fast the player falls', 0.05, 1, 0.01),
    f('player.holdJumpGravity', 'Held jump', 'Gravity while jump is held (lower floats longer)', 0.05, 1, 0.01), f('player.maxFall', 'Fall speed', 'Fastest fall', 1, 8, 0.1),
    f('player.coyoteFrames', 'Late jump', 'Frames a jump still works after a ledge', 0, 20, 1), f('player.jumpBufferFrames', 'Early jump', 'Frames a jump press is remembered before landing', 0, 20, 1)] });
  groups.push({ id: 'health', name: 'Health', scope: 'game', fields: [
    f('player.lives', 'Hearts', 'Hits the player can take', 1, 9, 1), f('player.hurtInvulnFrames', 'Safe time', 'Frames of safety after a hit', 0, 240, 5), f('player.knockback', 'Knockback', 'How far a hit pushes the player', 0, 5, 0.1)] });
  groups.push({ id: 'attack', name: 'Attack', scope: 'game', fields: [
    f('player.shoot', 'Shooting', 'A shoots (B shoots backward in a platformer)', 0, 1, 1, 'onoff'), f('player.shotSpeed', 'Shot speed', 'How fast shots fly', 1, 8, 0.5), f('player.shotCooldown', 'Fire rate', 'Frames between shots', 2, 60, 1),
    ...(template === 'topdown' ? [] : [f('player.stomp', 'Stomp', 'Jumping on an enemy hurts it', 0, 1, 1, 'onoff')])] });
  groups.push({ id: 'camera', name: 'Camera', scope: 'game', fields: [f('camera.lookAhead', 'Look ahead', 'How far the camera looks the way the player faces', 0, 48, 2), f('camera.lookEase', 'Follow', 'How quickly the camera catches up', 0.02, 0.5, 0.01)] });
  return { about: 'What the Studio shows for this game (made with New game on the tile engine).', template, groups,
    scene: { kind: 'tiles', name: 'Level', levelItems: [] }, background: [], art: { folders: [] }, sound: {} };
}

// ---------------------------------------------------------------- making one
export const TEMPLATES = [
  { id: 'platformer', name: 'Platformer', help: 'Side view: run, jump, stomp and shoot', glyph: 'crab' },
  { id: 'topdown', name: 'Top-down', help: 'Seen from above: walk four ways and shoot', glyph: 'skull' }
];
const PADS = {
  platformer: { pad: `  <div class="grp">\n    <button data-k="left" aria-label="Move left">◀</button>\n    <button data-k="jump" aria-label="Jump">▲</button>\n    <button data-k="right" aria-label="Move right">▶</button>\n  </div>\n  <div class="grp">\n    <button class="round b" data-k="b" aria-label="Shoot back">B</button>\n    <button class="round" data-k="a" aria-label="Shoot">A</button>\n  </div>`,
    tip: 'Reach the green flag. Jump on enemies or shoot them.', legend: '<span><kbd>← →</kbd> move</span><span><kbd>↑</kbd> / <kbd>Space</kbd> jump</span><span><kbd>Z</kbd> (A) shoot</span><span><kbd>X</kbd> (B) shoot back</span><span><kbd>P</kbd> pause</span>' },
  topdown: { pad: `  <div class="grp">\n    <button data-k="left" aria-label="Move left">◀</button>\n    <button data-k="up" aria-label="Move up">▲</button>\n    <button data-k="down" aria-label="Move down">▼</button>\n    <button data-k="right" aria-label="Move right">▶</button>\n  </div>\n  <div class="grp">\n    <button class="round" data-k="a" aria-label="Shoot">A</button>\n  </div>`,
    tip: 'Reach the green flag. Shoot the monsters.', legend: '<span><kbd>← ↑ ↓ →</kbd> move</span><span><kbd>Z</kbd> / <kbd>Space</kbd> (A) shoot</span><span><kbd>P</kbd> pause</span>' }
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export async function pageFor(name, template) {
  const t = await (await fetch('../engine/game-template.html', { cache: 'no-cache' })).text(), p = PADS[template];
  return t.replaceAll('{{TITLE}}', esc(name)).replace('{{PAD}}', p.pad).replace('{{TIP}}', p.tip).replace('{{LEGEND}}', p.legend);
}
export function gameJson(name, template) {
  const top = template === 'topdown';
  return {
    title: name, template,
    about: 'A game made with New game in Hedron. Distances are in game pixels, times in frames (60 a second). Tiles are 8×8; a scene map is one character per tile ("." is empty).',
    load: ['engine/screen', 'engine/audio', 'engine/input', 'engine/tiles', 'engine/logic', 'engine/loop'],
    screen: { width: 160, height: 144, ground: 144, zooms: [[160, 144], [240, 216], [320, 288]] },
    colors: { sky: top ? '#2f4a2a' : '#1d2b53', ink: '#0b0b10', text: '#f4f1ea', hurt: '#ff4f5e' },
    player: { symbol: top ? 'skull' : 'crab', color: '#ff5a1f', scale: 1, walkMax: 1.4, walkAccel: 0.2, stopDecel: 0.3, gravity: 0.3, holdJumpGravity: 0.17, jumpSpeed: 4.1, maxFall: 3.6,
      coyoteFrames: 6, jumpBufferFrames: 7, speed: 1.1, lives: 3, hurtInvulnFrames: 90, hurtStunFrames: 12, knockback: 2, shoot: 1, shotSpeed: 3, shotCooldown: 14, stomp: 1 },
    camera: { lookAhead: top ? 0 : 12, lookEase: 0.1 },
    tiles: TILESETS[template], objects: OBJECTS[template],
    scenes: [top ? topdownLevel() : platformerLevel()],
    logic: []   // visual logic (the Studio's Logic tab)
  };
}
const slug = (s) => (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game').slice(0, 24);
export async function create(name, template) {
  const taken = new Set(readLocal().map(g => g.file));
  let file = 'games/' + slug(name), n = 2;
  while (taken.has(file)) file = 'games/' + slug(name) + '-' + n++;
  const enc = (o) => new TextEncoder().encode(typeof o === 'string' ? o : JSON.stringify(o, null, 1) + '\n');
  await store.putFile(file + '/index.html', enc(await pageFor(name, template)), 'text/html');
  await store.putFile(file + '/game.json', enc(gameJson(name, template)), 'application/json');
  await store.putFile(file + '/studio.json', enc(studio(template)), 'application/json');
  const g = { file, name, template, made: Date.now(), pushed: false };
  writeLocal([...readLocal(), g]);
  return g;
}
// every file of a game made on this phone, for pushing
export async function files(file) { return Promise.all(['index.html', 'game.json', 'studio.json'].map(async f => ({ path: file + '/' + f, rec: await store.file(file + '/' + f) }))); }
export async function remove(file) {
  for (const f of ['index.html', 'game.json', 'studio.json']) await store.removeFile(file + '/' + f);
  forget(file);
}
