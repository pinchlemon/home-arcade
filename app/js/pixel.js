// Pixel art: bitmaps, the 3x5 font, Platonic solids, and helpers that draw them as SVG or onto a canvas.
// One unit = one pixel. On screen a pixel is 2px and is drawn at 0.88 of its cell so neighbours keep a hairline gap.

export const sq = (x, y) => 'M' + (x + 0.06).toFixed(2) + ' ' + (y + 0.06).toFixed(2) + 'h0.88v0.88h-0.88z';

// which icon a rows array is (filled in once the icon list exists)
const NAMES = new Map();

export function bitmapPath(rows, ox = 0, oy = 0) {
  let d = '';
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '1') d += sq(ox + x, oy + y); });
  return d;
}

export function svgRows(rows, color, scale = 2, extra = '') {
  const w = rows[0].length, h = rows.length, n = NAMES.get(rows);
  if (n) { extra += ` data-icon="${n}"`; note(n); }   // a known icon: hold it to redraw it (iconEditor.js)
  return `<svg viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" aria-hidden="true"${extra}><path d="${bitmapPath(rows)}" fill="${color}"/></svg>`;
}

// ---- 3 x 5 font (M, N, W wider)
export const FONT = {
  A: ['010','101','111','101','101'], B: ['110','101','110','101','110'], C: ['011','100','100','100','011'], D: ['110','101','101','101','110'],
  E: ['111','100','110','100','111'], F: ['111','100','110','100','100'], G: ['011','100','101','101','011'], H: ['101','101','111','101','101'],
  I: ['111','010','010','010','111'], J: ['001','001','001','101','010'], K: ['101','101','110','101','101'], L: ['100','100','100','100','111'],
  M: ['10001','11011','10101','10001','10001'], N: ['1001','1101','1011','1001','1001'], O: ['010','101','101','101','010'], P: ['110','101','110','100','100'],
  Q: ['010','101','101','110','011'], R: ['110','101','110','101','101'], S: ['011','100','010','001','110'], T: ['111','010','010','010','010'],
  U: ['101','101','101','101','111'], V: ['101','101','101','101','010'], W: ['10001','10001','10101','10101','01010'], X: ['101','101','010','101','101'],
  Y: ['101','101','010','010','010'], Z: ['111','001','010','100','111'],
  '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'], '2': ['111','001','111','100','111'], '3': ['111','001','111','001','111'],
  '4': ['101','101','111','001','001'], '5': ['111','100','111','001','111'], '6': ['111','100','111','101','111'], '7': ['111','001','010','010','010'],
  '8': ['111','101','111','101','111'], '9': ['111','101','111','001','111'],
  ',': ['0','0','0','1','1'], '.': ['0','0','0','0','1'], ':': ['0','1','0','1','0'], '-': ['000','000','111','000','000'], '/': ['001','001','010','100','100'],
  '!': ['1','1','1','0','1'], '?': ['111','001','010','000','010'], '+': ['000','010','111','010','000'], '%': ['101','001','010','100','101'], '×': ['000','101','010','101','000'], ' ': ['00','00','00','00','00']
};

export function textRows(str) {
  const rows = ['', '', '', '', ''];
  String(str).toUpperCase().split('').forEach((ch, n) => {
    const g = FONT[ch] || FONT[' '];
    for (let y = 0; y < 5; y++) rows[y] += (n ? '0' : '') + g[y];
  });
  return rows[0].length ? rows : ['0', '0', '0', '0', '0'];
}
export const textWidth = (str) => textRows(str)[0].length;
export const svgText = (str, color, scale = 2) => svgRows(textRows(str), color, scale);

// ---- icons
export const G = {
  play: ['1000','1100','1110','1111','1110','1100','1000'],
  left: ['0001','0010','0100','1000','0100','0010','0001'],
  right: ['1000','0100','0010','0001','0010','0100','1000'],
  up: ['00100','01110','10101','00100','00100','00100'],
  down: ['00100','00100','00100','10101','01110','00100'],
  plus: ['00100','00100','11111','00100','00100'],
  minus: ['00000','00000','11111','00000','00000'],
  edit: ['0000011','0000111','0001110','0011100','0111000','1110000','1100000'],
  code: ['0010100','0100010','1000001','0100010','0010100'],
  check: ['0000001','0000010','1000100','0101000','0010000'],
  folder: ['1110000','1111111','1000001','1000001','1000001','1000001','1111111'],
  folderPlus: ['1110000','1111111','1000001','1001001','1011101','1001001','1111111'],
  back: ['0001000','0010000','0111111','1000000','0111111','0010000','0001000'],
  scene: ['1111111','1000001','1000001','1010101','1111111','0000000','0111110'],
  trash: ['011110','111111','010010','010010','010010','011110'],
  dup: ['111100','100100','101111','111001','001001','001111'],
  undo: ['0010000','0110000','1111110','0110001','0010001','0000001','0011110'],
  redo: ['0000100','0000110','0111111','1000110','1000100','1000000','0111100'],
  select: ['0010000','0011000','0011100','0011110','0011110','0011000','0000100'],
  place: ['1111111','1000001','1001001','1011101','1001001','1000001','1111111'],
  move: ['0001000','0011100','0001000','1101011','0001000','0011100','0001000'],
  paint: ['0000011','0000111','0001110','0011100','0111000','1110000','1100000'],
  fill: ['0011000','0100100','1000010','1111111','0111110','0011100','0000001'],
  erase: ['1000001','0100010','0010100','0001000','0010100','0100010','1000001'],
  pan: ['0101010','0101010','0111110','1111110','0111110','0111100','0011100'],
  patch: ['1100000','1100000','0110000','0011100','0000110','0000011','0000011'],
  tiles: ['11011','11011','00000','11011','11011'],
  objects: ['00100','01110','11111','01110','00100'],
  events: ['11000','11000','01110','00011','00011'],
  sprites: ['01110','01110','00100','11111','00100','01010','10001'],
  sounds: ['0001000','0011010','1111001','1111001','1111001','0011010','0001000'],
  controller: ['0111110','1101011','1000001','1101011','0111110'],
  github: ['1000100','1000100','1001000','1110000','1000000','1000000','1000000'],
  display: ['1111111','1000001','1000001','1000001','1111111','0001000','0111110'],
  changes: ['0010000','0111000','0010000','0000000','0000100','0001110','0000100'],
  history: ['0011100','0100010','1001001','1001101','1000001','0100010','0011100'],
  books: ['1100000','1101100','1101100','1101110','1101110','1101110','1111111'],
  when: ['0011100','0100010','1001001','1010101','1001001','0100010','0011100'],
  key: ['0011100','0100010','0100010','1111111','1110111','1110111','1111111'],
  out: ['1111000','1000000','1000100','1001110','1000100','1000000','1111000'],
  mute: ['0001001','0011010','1111100','1111100','1111100','0011010','0001001'],
  reset: ['0011110','0100000','1000000','1000111','1000010','0100100','0011000'],
  pause: ['11011','11011','11011','11011','11011'],
  rename: ['1110111','0100100','0100100','0100100','0100100','0100100','1110111'],
  draw: ['1100000','1100000','0000000','0000000','0000000','0000000','0000000'],
  grid: ['1111111','1001001','1001001','1111111','1001001','1001001','1111111'],
  // the sprite editor's
  eye: ['0000000','0111110','1100011','1011101','1100011','0111110','0000000'],
  eyeOff: ['1000000','0111110','1110011','1011101','1100111','0111110','0000001'],
  lock: ['01110','10001','11111','11011','11111'],
  group: ['1110000','1111111','1000001','1000001','1111111'],
  onion: ['1010100','0000000','0011111','0010001','0010001','0010001','0011111'],
  dots: ['0000000','0000000','1101011','1101011','0000000','0000000','0000000'],
  boxSelect: ['1101011','0000000','1000001','0000000','1000001','0000000','1101011'],
  lasso: ['0011100','0100010','1000001','1000001','0110010','0101100','0010000'],
  wand: ['1010000','0100000','1010000','0001000','0000100','0000010','0000001'],
  merge: ['1111111','1000001','1111111','0001000','0101010','0011100','0001000'],
  paste: ['0011100','1111111','1000001','1011101','1000001','1011101','1111111'],
  cut: ['1000001','0100010','0010100','0001000','0110110','1001001','0110110'],
  invert: ['1111111','1000001','1011101','1010101','1011101','1000001','1111111'],
  flipH: ['0001000','1001001','1101011','1111111','1101011','1001001','0001000'],
  flipV: ['0111110','0011100','0001000','1111111','0001000','0011100','0111110'],
  movePixels: ['0001000','0011100','1001001','1111111','1001001','0011100','0001000'],
  pencil: ['0000011','0000111','0001110','0011100','0111000','1110000','1100000'],
  eraser: ['0001100','0011110','0111111','1111110','1011100','1111000','0000000'],
  picker: ['0000110','0001111','0001111','0011100','0101000','1010000','1100000']
};
export const icon = (name, color = '#e4e2dc') => svgRows(G[name], color);

// ---- icons on this phone: redrawn built-ins (ha.icons), icons you made (ha.icons.mine), names (ha.icons.names),
// and the screens each icon has been seen on (ha.icons.seen). None of it is pushed to GitHub.
const ORIGINAL = Object.fromEntries(Object.entries(G).map(([k, v]) => [k, v.slice()]));
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (err) { /* storage full: the change lasts until the app closes */ } };
const same = (a, b) => a.length === b.length && a.every((r, i) => r === b[i]);
const good = (v) => Array.isArray(v) && v.length && v.every(r => typeof r === 'string' && /^[01]+$/.test(r));
for (const [k, v] of Object.entries(read('ha.icons'))) if (ORIGINAL[k] && good(v)) G[k] = v;
for (const [k, v] of Object.entries(read('ha.icons.mine'))) if (!ORIGINAL[k] && good(v)) G[k] = v;
for (const [k, v] of Object.entries(G)) NAMES.set(v, k);
const swap = (name, rows) => { NAMES.delete(G[name]); G[name] = rows; NAMES.set(rows, name); };

export const isMine = (name) => !ORIGINAL[name];
export const originalRows = (name) => ORIGINAL[name];
export function setIcon(name, rows) {
  swap(name, rows);
  if (isMine(name)) { const m = read('ha.icons.mine'); m[name] = rows; write('ha.icons.mine', m); return; }
  const e = read('ha.icons');
  if (same(rows, ORIGINAL[name])) delete e[name]; else e[name] = rows;
  write('ha.icons', e);
}
// a new icon of your own; it is only kept once saved (setIcon), so dropIcon forgets an unsaved one
export function newIcon(w = 7, h = 7) {
  const id = 'my' + Date.now().toString(36);
  swap(id, Array.from({ length: h }, () => '0'.repeat(w)));
  return id;
}
export function dropIcon(name) {
  if (!isMine(name)) return;
  NAMES.delete(G[name]); delete G[name];
  const m = read('ha.icons.mine'); delete m[name]; write('ha.icons.mine', m);
  const n = read('ha.icons.names'); delete n[name]; write('ha.icons.names', n);
}
export const isSaved = (name) => !isMine(name) || name in read('ha.icons.mine');

// names: built-ins start with their code name in words; yours start as "my icon"
export function iconLabel(name) {
  const n = read('ha.icons.names')[name];
  return n || (isMine(name) ? 'my icon' : name.replace(/([A-Z])/g, ' $1').toLowerCase());
}
export function renameIcon(name, label) {
  const n = read('ha.icons.names');
  if (label) n[name] = label; else delete n[name];
  write('ha.icons.names', n);
}

// where icons show: each time a built-in icon is drawn, the screen it is on is noted (main.js says which screen that is)
const USED_ON = Object.fromEntries(Object.entries({
  back: 'Studio editor,Art viewer,New sprite,Sprite editor',
  boxSelect: 'Sprite editor',
  changes: 'Settings',
  check: 'Sprite editor',
  code: 'Arcade,Studio',
  controller: 'Studio,Studio editor,Settings',
  cut: 'Sprite editor',
  display: 'Studio editor,Art,Sprite editor,Settings',
  dots: 'Sprite editor',
  down: 'Studio editor,New sprite,Sprite editor',
  dup: 'Studio editor,Sprite editor',
  edit: 'Arcade,Studio,Art',
  erase: 'Studio editor,Sprite editor',
  eraser: 'Sprite editor',
  events: 'Sprite editor',
  eye: 'Sprite editor',
  eyeOff: 'Sprite editor',
  fill: 'Sprite editor',
  flipH: 'Sprite editor',
  flipV: 'Sprite editor',
  folder: 'Art',
  github: 'Settings',
  grid: 'Studio editor,Art',
  group: 'Sprite editor',
  history: 'Settings',
  invert: 'Sprite editor',
  key: 'Settings',
  lasso: 'Sprite editor',
  left: 'Arcade,Studio,Studio editor,Art,Sprite editor,Sound',
  lock: 'Sprite editor',
  merge: 'Sprite editor',
  minus: 'Studio editor,Art viewer,New sprite,Sprite editor,Settings',
  movePixels: 'Sprite editor',
  mute: 'Settings',
  objects: 'Studio,Studio editor,Art',
  onion: 'Sprite editor',
  out: 'Art viewer,Settings',
  paint: 'Art,Art viewer,Sprite editor',
  pan: 'Sprite editor',
  paste: 'Sprite editor',
  pause: 'Art viewer',
  pencil: 'Sprite editor',
  picker: 'Sprite editor',
  place: 'Studio editor',
  play: 'Arcade,Studio,Studio editor,Art,Art viewer,Sprite editor,Sound,Settings',
  plus: 'Studio editor,Art,Art viewer,New sprite,Sprite editor,Settings',
  redo: 'Studio editor,Sprite editor',
  rename: 'Studio editor,Settings',
  reset: 'Studio editor,Settings',
  right: 'Arcade,Studio,Studio editor,Art,Sprite editor,Sound',
  scene: 'Studio,Studio editor,Sprite editor',
  select: 'Studio editor,Art,Sprite editor',
  sounds: 'Sound,Settings',
  sprites: 'Studio editor,Art,Art viewer',
  tiles: 'Sprite editor',
  trash: 'Studio editor,Sprite editor',
  undo: 'Studio editor,Sprite editor',
  up: 'Studio editor,Sprite editor',
  wand: 'Sprite editor'
}).map(([k, v]) => [k, v.split(',')]));
let seen = null, whereNow = () => '', saveSeen = 0;
export const iconPlace = (fn) => { whereNow = fn; };
function note(name) {
  const at = whereNow();
  if (!at) return;
  if (!seen) seen = read('ha.icons.seen');
  const list = seen[name] || (seen[name] = []);
  if (list.includes(at)) return;
  list.push(at);
  clearTimeout(saveSeen); saveSeen = setTimeout(() => write('ha.icons.seen', seen), 500);
}
// USED_ON: where each icon was found by tapping through every screen in a browser (rebuild it when screens change);
// what this phone notes is added to it
export const seenOn = (name) => {
  if (!seen) seen = read('ha.icons.seen');
  return [...new Set([...(USED_ON[name] || []), ...(seen[name] || [])])];
};
// draw without noting (the icon editor's own list shows every icon)
export function quietly(fn) { const w = whereNow; whereNow = () => ''; try { return fn(); } finally { whereNow = w; } }

// ---- wells: a black screen set into the plate, with the surface sloping up to a lit lip
const MOUNT = { 28: [40, 6], 40: [58, 9], 164: [236, 36] };
export function well(size, inner = '', extraClass = '') {
  const [m, off] = MOUNT[size];
  return `<span class="mount" style="width:${m}px;height:${m}px;margin:-${off}px"><span class="slope"></span><span class="lip" style="width:${size + 4}px;height:${size + 4}px"></span><span class="well ${size === 164 ? 'well-lg' : ''} ${extraClass}" style="width:${size}px;height:${size}px">${inner}</span></span>`;
}

// ---- Platonic solids, drawn as pixels on an N x N grid with three brightness levels by depth
const solids = {};
export function solid(kind) {
  if (solids[kind]) return solids[kind];
  const P = (1 + Math.sqrt(5)) / 2, I = 1 / P, pm = [1, -1];
  let v = [];
  if (kind === 'tetra') v = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
  else if (kind === 'octa') v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  else if (kind === 'cube' || kind === 'dodeca') {
    pm.forEach(a => pm.forEach(b => pm.forEach(c => v.push([a, b, c]))));
    if (kind === 'dodeca') pm.forEach(a => pm.forEach(b => { v.push([0, a * I, b * P]); v.push([a * I, b * P, 0]); v.push([a * P, 0, b * I]); }));
  } else pm.forEach(a => pm.forEach(b => { v.push([0, a, b * P]); v.push([a, b * P, 0]); v.push([a * P, 0, b]); }));
  const r = Math.hypot(...v[0]);
  v = v.map(p => p.map(c => c / r));
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let min = Infinity; const e = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) min = Math.min(min, d(v[i], v[j]));
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (d(v[i], v[j]) < min * 1.01) e.push([i, j]);
  return (solids[kind] = { v, e });
}
// The lit cells of a solid as [x, y, level] (level 0 to 2 by depth). roll turns the picture in its own plane (the launch animation uses it).
export function cellsSolid(kind, ay, ax, N, roll = 0) {
  const s = solid(kind), cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), cr = Math.cos(roll), sr = Math.sin(roll);
  const P = s.v.map(q => {
    const x1 = q[0] * cy + q[2] * sy, z1 = -q[0] * sy + q[2] * cy, y2 = q[1] * cx - z1 * sx, z2 = q[1] * sx + z1 * cx, k = 0.95 * 4 / (4 - z2);
    const px = x1 * k, py = -y2 * k;
    return [px * cr - py * sr, px * sr + py * cr, z2];
  });
  const cells = {}, toG = x => (x + 1.25) / 2.5 * N;
  s.e.forEach(([i, j]) => {
    const a = P[i], b = P[j], n = Math.ceil(Math.hypot(toG(b[0]) - toG(a[0]), toG(b[1]) - toG(a[1])) * 1.6) + 1;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const gx = Math.min(N - 1, Math.max(0, Math.floor(toG(a[0] + (b[0] - a[0]) * f))));
      const gy = Math.min(N - 1, Math.max(0, Math.floor(toG(a[1] + (b[1] - a[1]) * f))));
      const z = a[2] + (b[2] - a[2]) * f, l = z > 0.25 ? 2 : (z > -0.35 ? 1 : 0), key = gx + ',' + gy;
      if (cells[key] === undefined || cells[key] < l) cells[key] = l;
    }
  });
  return Object.keys(cells).map(key => { const [x, y] = key.split(','); return [+x, +y, cells[key]]; });
}
export function rasterSolid(kind, ay, ax, N) {
  const out = ['', '', ''];
  cellsSolid(kind, ay, ax, N).forEach(([x, y, l]) => { out[l] += sq(x, y); });
  return out;
}
export function solidSvg(N, size, color, attrs = '') {
  return `<svg viewBox="0 0 ${N} ${N}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true" style="color:${color}" ${attrs}><path fill="currentColor" fill-opacity=".3"/><path fill="currentColor" fill-opacity=".6"/><path fill="currentColor"/></svg>`;
}
export function paintSolid(svg, parts) {
  const ps = svg.querySelectorAll('path');
  for (let i = 0; i < 3; i++) ps[i].setAttribute('d', parts[i]);
}

// ---- canvas drawing at one game pixel per canvas pixel
export function drawRows(ctx, rows, x, y, color, flip = false) {
  ctx.fillStyle = color;
  const w = rows[0].length;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++) if (rows[r][flip ? w - 1 - c : c] === '1') ctx.fillRect(x + c, y + r, 1, 1);
}
export function drawText(ctx, str, x, y, color) { drawRows(ctx, textRows(str), x, y, color); return textWidth(str); }


// Scale a 1:1 pixel canvas onto a display canvas, leaving a hairline gap between pixels (the LCD look).
export function present(src, dst, sw, sh) {
  const ctx = dst.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, dst.width, dst.height);
  ctx.drawImage(src, 0, 0, sw, sh, 0, 0, dst.width, dst.height);
  const s = dst.width / sw;
  if (s >= 3) {
    const gap = Math.max(1, Math.round(s * 0.12));
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    for (let x = 0; x <= sw; x++) ctx.fillRect(Math.round(x * s) - gap, 0, gap, dst.height);
    for (let y = 0; y <= sh; y++) ctx.fillRect(0, Math.round(y * s) - gap, dst.width, gap);
  }
}

export const PALETTE = { white: '#ffffff', bone: '#e4e2dc', gray: '#8f8d88', orange: '#ff5a1f', green: '#7dff6a', pink: '#ff4fd8', blue: '#4d7cff', yellow: '#ffd23f' };
