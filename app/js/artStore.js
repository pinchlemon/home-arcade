// Art drawn on the phone, kept on the phone (IndexedDB) until it is pushed.
// Every sprite drawn in the editor is saved as two files: the .aseprite (layers, frames, tags, palette) and the
// .png the game reads (made from it). They are stored under their path in the repo, e.g. crab-platformer/assets/sheet.png,
// and the service worker hands out the phone's copy for those paths (sw.js), so the game and the Art tab show it
// before it is pushed. After a push the copy is kept a while (the site takes a minute to update), then dropped.
//
//   files: { path, bytes: ArrayBuffer, type }
//   art:   { key: 'game/itemId', game, itemId, name, png, ase (paths in the repo), folder, item (for new sprites),
//            isNew, dirty (not pushed), edited, pushedAt }
import { readAse, writeAse, flatten, celKey } from './ase.js';

const DB = 'hedron-art';
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('files', { keyPath: 'path' }); d.createObjectStore('art', { keyPath: 'key' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); };
  });
  return dbp;
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function tx(stores, mode, fn) {
  const d = await db(), t = d.transaction(stores, mode), out = await fn(...stores.map(s => t.objectStore(s)));
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  return out;
}

// ---------------------------------------------------------------- what is on the phone (kept in memory too, for quick lookups)
let index = {};            // key -> art record
const urls = {};           // path -> object URL of the phone's copy
let ready = null;
export function load() {
  if (!ready) ready = tx(['art'], 'readonly', a => req(a.getAll())).then(list => { index = {}; list.forEach(r => { index[r.key] = r; }); return index; }).catch(() => index);
  return ready;
}
export const all = () => Object.values(index);
export const forGame = (game) => all().filter(r => r.game === game);
export const record = (game, itemId) => index[game + '/' + itemId] || null;
export const dirtyFor = (game) => forGame(game).filter(r => r.dirty);

export async function file(path) { return tx(['files'], 'readonly', f => req(f.get(path))); }
// any file kept on the phone under its repo path (games made with New game keep all their files here; see newGame.js)
export async function putFile(path, bytes, type) { return tx(['files'], 'readwrite', f => req(f.put({ path, bytes: bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes, type }))); }
export async function removeFile(path) { return tx(['files'], 'readwrite', f => req(f.delete(path))); }
// a URL for a picture: the phone's copy when there is one, else the file on the site
export async function urlFor(game, path) {
  await load();
  const full = game + '/' + path;
  if (all().some(r => r.game === game && (r.png === path || r.ase === path))) {
    const f = await file(full);
    if (f) { if (urls[full]) URL.revokeObjectURL(urls[full].url); urls[full] = { url: URL.createObjectURL(new Blob([f.bytes], { type: f.type })) }; return urls[full].url; }
  }
  return '../' + full;
}
// the same, without waiting: the phone's copy if it has been looked up already
export const cachedUrl = (game, path) => (urls[game + '/' + path] || {}).url || null;

// ---------------------------------------------------------------- PNG <-> sprite
const aseOf = (png) => png.replace(/\.png$/i, '') + '.aseprite';
export const asePath = aseOf;

function imageData(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height);
}
const loadImage = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Could not load ' + url)); im.src = url; });

// the colours a picture uses, in the order they first appear (at most 256), for its palette
function paletteOf(datas) {
  const seen = new Map();
  for (const d of datas) for (let i = 0; i < d.length && seen.size < 256; i += 4) {
    if (!d[i + 3]) continue;
    const k = (d[i] << 24 | d[i + 1] << 16 | d[i + 2] << 8 | d[i + 3]) >>> 0;
    if (!seen.has(k)) seen.set(k, [d[i], d[i + 1], d[i + 2], d[i + 3]]);
  }
  return [...seen.values()];
}
export const DEFAULT_PALETTE = ['#000000', '#1d1b24', '#4a4654', '#8b8794', '#d6d2dc', '#ffffff', '#7a2e3a', '#d84a4a', '#f08a3c', '#f6d257', '#8fd25a', '#3a9a5c', '#2f6f8f', '#4fb0e0', '#5a4ad0', '#b85ad8', '#f29ac0', '#8a5a3a', '#d6a070', '#f4d4b0']
  .map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]);

export function blankSprite(w, h, name) {
  return { w, h, layers: [{ name: name || 'Layer 1', visible: true, locked: false, opacity: 255, blend: 0, group: false, level: 0, bg: false }], frames: [{ dur: 100 }], cels: new Map(), tags: [], palette: DEFAULT_PALETTE.map(c => c.slice()) };
}

// A game picture becomes a sprite: one layer; a sprite sheet is cut into its frames, and its animations become tags.
export function spriteFromImage(img, item, ticksOf) {
  const all = imageData(img), cw = item.cell ? item.cell[0] : all.width, ch = item.cell ? item.cell[1] : all.height;
  const cols = Math.max(1, Math.floor(all.width / cw)), rows = Math.max(1, Math.floor(all.height / ch));
  const n = item.cell ? Math.min(item.frames || cols * rows, cols * rows) : 1;
  const spr = blankSprite(cw, ch); spr.frames = [];
  const datas = [];
  for (let f = 0; f < n; f++) {
    const d = new Uint8ClampedArray(cw * ch * 4), sx = (f % cols) * cw, sy = Math.floor(f / cols) * ch;
    for (let y = 0; y < ch; y++) d.set(all.data.subarray(((sy + y) * all.width + sx) * 4, ((sy + y) * all.width + sx + cw) * 4), y * cw * 4);
    if (d.some((v, i) => (i & 3) === 3 && v)) spr.cels.set(celKey(0, f), { data: d, opacity: 255 });
    datas.push(d); spr.frames.push({ dur: 100 });
  }
  const COL = [[255, 90, 31], [125, 255, 106], [255, 79, 216], [77, 124, 255], [255, 210, 63]];
  (item.anims || []).forEach((a, i) => {
    const from = Math.min(n - 1, a.from), to = Math.min(n - 1, a.from + a.count - 1), ms = Math.round((ticksOf ? ticksOf(a) : 8) / 60 * 1000);
    spr.tags.push({ name: a.name, from, to, dir: 0, repeat: 0, color: COL[i % COL.length] });
    if (a.count < n) for (let f = from; f <= to; f++) spr.frames[f].dur = ms;   // the "every frame" run doesn't set timings
  });
  const pal = paletteOf(datas); if (pal.length) spr.palette = pal;
  return spr;
}

// open a game's picture for drawing: the phone's copy, else its .aseprite on the site, else the PNG
export async function openSprite(game, item, ticksOf) {
  await load();
  const r = record(game, item.id), ase = aseOf(item.file);
  if (r) { const f = await file(game + '/' + r.ase); if (f) return readAse(f.bytes); }
  try {
    const res = await fetch('../' + game + '/' + ase, { cache: 'no-cache' });
    if (res.ok && (res.headers.get('content-type') || '').indexOf('html') < 0) return await readAse(await res.arrayBuffer());
  } catch (e) { /* offline or not there: start from the picture */ }
  return spriteFromImage(await loadImage('../' + game + '/' + item.file), item, ticksOf);
}

// The PNG the game reads. A sprite sheet keeps its old layout (as many frames across as before); a single picture is frame 1.
async function pngOf(spr, item, sheetCols) {
  const sheet = !!item.cell, n = sheet ? spr.frames.length : 1, cols = sheet ? Math.max(1, Math.min(n, sheetCols || n)) : 1, rows = Math.ceil(n / cols);
  const c = document.createElement('canvas'); c.width = spr.w * cols; c.height = spr.h * rows;
  const x = c.getContext('2d');
  for (let f = 0; f < n; f++) x.putImageData(new ImageData(flatten(spr, f), spr.w, spr.h), (f % cols) * spr.w, Math.floor(f / cols) * spr.h);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

// save a sprite on the phone (both files) and mark it as a change to push
export async function save(game, item, spr, extra = {}) {
  await load();
  const key = game + '/' + item.id, prev = index[key] || {};
  const [aseBytes, pngBytes] = await Promise.all([writeAse(spr), pngOf(spr, item, extra.sheetCols || prev.sheetCols)]);
  const rec = { ...prev, key, game, itemId: item.id, name: item.name, png: item.file, ase: aseOf(item.file), dirty: true, edited: Date.now(), pushedAt: 0, ...extra };
  await tx(['files', 'art'], 'readwrite', (f, a) => {
    f.put({ path: game + '/' + item.file, bytes: pngBytes.buffer, type: 'image/png' });
    f.put({ path: game + '/' + rec.ase, bytes: aseBytes.buffer, type: 'application/octet-stream' });
    a.put(rec);
  });
  index[key] = rec;
  for (const p of [rec.png, rec.ase]) { const u = urls[game + '/' + p]; if (u) { URL.revokeObjectURL(u.url); delete urls[game + '/' + p]; } }
  return rec;
}

// forget the phone's copy (Discard, or after the push has reached the site; then the offline copy of the old file goes too)
export async function discard(game, itemId, afterPush) {
  await load();
  const key = game + '/' + itemId, r = index[key]; if (!r) return;
  await tx(['files', 'art'], 'readwrite', (f, a) => { f.delete(game + '/' + r.png); f.delete(game + '/' + r.ase); a.delete(key); });
  delete index[key];
  for (const p of [r.png, r.ase]) { const u = urls[game + '/' + p]; if (u) { URL.revokeObjectURL(u.url); delete urls[game + '/' + p]; } }
  if (afterPush) await dropCached([r.png, r.ase].map(p => game + '/' + p));
}
export async function markPushed(recs) {
  await tx(['art'], 'readwrite', a => { recs.forEach(r => { r.dirty = false; r.pushedAt = Date.now(); r.isNew = false; a.put(r); index[r.key] = r; }); });
}
// copies pushed a while ago are dropped, so the site's (now matching) files take over again
const KEEP_AFTER_PUSH = 20 * 60 * 1000;
export async function tidy() {
  await load();
  for (const r of all()) if (!r.dirty && r.pushedAt && Date.now() - r.pushedAt > KEEP_AFTER_PUSH) await discard(r.game, r.itemId, true).catch(() => {});
}
// the offline copies of the site's files at these paths (so the next look fetches the new version)
async function dropCached(paths) {
  try {
    const base = new URL('../', location.href).pathname;
    for (const k of await caches.keys()) if (k.startsWith('arcade-')) { const c = await caches.open(k); for (const p of paths) await c.delete(base + p, { ignoreSearch: true }); }
  } catch (e) { /* no caches here */ }
}

export const toBase64 = (bytes) => {
  const u = new Uint8Array(bytes); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
