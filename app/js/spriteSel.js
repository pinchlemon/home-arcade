// Selections and floating pixels for the sprite editor (spriteEditor.js). Pure functions: no screen, no state.
//
// A selection is { mask: Uint8Array(w*h) } (1 = selected), treated as read-only (changes make a new one, so undo keeps the old).
// Floating pixels (lifted by the Move tool, pasted, or being flipped/rotated/scaled) are
//   { orig: { data, w, h, mask }, cx, cy, s, r, fx, fy, layer, frame, noSel }
// orig is what was lifted and never changes; the float is drawn from it with: centre (cx, cy) in sprite pixels, scale s,
// r quarter turns clockwise, and fx/fy flips (as seen on screen). Working from the original keeps repeated changes lossless.

export const SCALES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

export function rectMask(w, h, x0, y0, x1, y1) {
  const m = new Uint8Array(w * h), ax = Math.max(0, Math.min(x0, x1)), bx = Math.min(w - 1, Math.max(x0, x1)), ay = Math.max(0, Math.min(y0, y1)), by = Math.min(h - 1, Math.max(y0, y1));
  for (let y = ay; y <= by; y++) m.fill(1, y * w + ax, y * w + bx + 1);
  return m;
}
// the pixels whose centres are inside a hand-drawn loop (points in sprite pixels, not rounded)
export function lassoMask(w, h, pts) {
  const m = new Uint8Array(w * h); if (pts.length < 3) return m;
  for (let y = 0; y < h; y++) {
    const py = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > py) !== (b[1] > py)) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(w - 1, Math.floor(xs[k + 1] - 0.5)); x++) m[y * w + x] = 1;
  }
  // the outline itself counts too, so thin loops still pick something up
  for (let i = 0; i < pts.length; i++) { const x = Math.floor(pts[i][0]), y = Math.floor(pts[i][1]); if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = 1; }
  return m;
}
// pixels of the same colour as the one tapped: touching it (contiguous) or anywhere on the layer
export function wandMask(data, w, h, x, y, contiguous) {
  const m = new Uint8Array(w * h); if (x < 0 || y < 0 || x >= w || y >= h) return m;
  const j0 = (y * w + x) * 4, t = [data[j0], data[j0 + 1], data[j0 + 2], data[j0 + 3]];
  const same = (i) => { const j = i * 4; return t[3] === 0 ? data[j + 3] === 0 : data[j] === t[0] && data[j + 1] === t[1] && data[j + 2] === t[2] && data[j + 3] === t[3]; };
  if (!contiguous) { for (let i = 0; i < w * h; i++) if (same(i)) m[i] = 1; return m; }
  const q = [x, y];
  while (q.length) {
    const yy = q.pop(), xx = q.pop(); if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const i = yy * w + xx; if (m[i] || !same(i)) continue;
    m[i] = 1; q.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1);
  }
  return m;
}
// mode 0 replaces, 1 adds, 2 takes away. Returns null when nothing is left selected.
export function combine(old, m, mode) {
  let out = m;
  if (old && mode === 1) { out = old.mask.slice(); for (let i = 0; i < m.length; i++) if (m[i]) out[i] = 1; }
  else if (mode === 2) { if (!old) return null; out = old.mask.slice(); for (let i = 0; i < m.length; i++) if (m[i]) out[i] = 0; }
  return any(out) ? { mask: out } : null;
}
export const any = (m) => { for (let i = 0; i < m.length; i++) if (m[i]) return true; return false; };
export function invert(sel, w, h) { const m = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) m[i] = sel && sel.mask[i] ? 0 : 1; return any(m) ? { mask: m } : null; }
export function maskBounds(m, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// the selected pixels of a cel, cut out to their box (data + mask); `rest` is the cel's pixels with them taken out
export function cutOut(data, w, h, mask) {
  const b = maskBounds(mask, w, h); if (!b) return null;
  const out = new Uint8ClampedArray(b.w * b.h * 4), om = new Uint8Array(b.w * b.h), rest = data.slice();
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = (b.y + y) * w + b.x + x; if (!mask[i]) continue;
    const o = y * b.w + x; om[o] = 1;
    out.set(data.subarray(i * 4, i * 4 + 4), o * 4); rest[i * 4] = rest[i * 4 + 1] = rest[i * 4 + 2] = rest[i * 4 + 3] = 0;
  }
  return { orig: { data: out, w: b.w, h: b.h, mask: om }, x: b.x, y: b.y, rest };
}

// what a float looks like now: its pixels, its shape (mask), and where its top-left corner is (sprite pixels)
const shown = new WeakMap();
export function floatPixels(F) {
  const hit = shown.get(F); if (hit) return hit;
  const o = F.orig, odd = F.r % 2 === 1, Rw = odd ? o.h : o.w, Rh = odd ? o.w : o.h;
  const W = Math.max(1, Math.round(Rw * F.s)), H = Math.max(1, Math.round(Rh * F.s));
  const data = new Uint8ClampedArray(W * H * 4), mask = new Uint8Array(W * H);
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    const uu = F.fx ? W - 1 - u : u, vv = F.fy ? H - 1 - v : v;
    const a = Math.min(Rw - 1, Math.floor((uu + 0.5) * Rw / W)), b = Math.min(Rh - 1, Math.floor((vv + 0.5) * Rh / H));
    let i, j;   // back from the turned picture to the original
    if (F.r === 1) { i = b; j = o.h - 1 - a; } else if (F.r === 2) { i = o.w - 1 - a; j = o.h - 1 - b; } else if (F.r === 3) { i = o.w - 1 - b; j = a; } else { i = a; j = b; }
    const s = j * o.w + i, d = v * W + u;
    if (!o.mask[s]) continue;
    mask[d] = 1; data.set(o.data.subarray(s * 4, s * 4 + 4), d * 4);
  }
  const out = { data, mask, w: W, h: H, x: Math.round(F.cx - W / 2), y: Math.round(F.cy - H / 2) };
  shown.set(F, out); return out;
}
// the selection a float makes on the canvas
export function floatSel(F, w, h) {
  const p = floatPixels(F), m = new Uint8Array(w * h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const tx = p.x + x, ty = p.y + y; if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
    if (p.mask[y * p.w + x]) m[ty * w + tx] = 1;
  }
  return any(m) ? { mask: m } : null;
}
// put a float down onto a cel's pixels (blended over what is there); returns new pixels
export function drop(F, data, w, h) {
  const p = floatPixels(F), out = data.slice();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const tx = p.x + x, ty = p.y + y; if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
    const s = (y * p.w + x) * 4, d = (ty * w + tx) * 4, sa = p.data[s + 3] / 255; if (!sa) continue;
    const da = out[d + 3] / 255, oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) out[d + k] = Math.round((p.data[s + k] * sa + out[d + k] * da * (1 - sa)) / oa);
    out[d + 3] = Math.round(oa * 255);
  }
  return out;
}

// the outline of a selection, as line pieces along pixel edges (merged into long runs), in sprite pixels
const edges = new WeakMap();
export function outline(sel, w, h) {
  const hit = edges.get(sel); if (hit) return hit;
  const m = sel.mask, on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1, segs = [];
  for (let y = 0; y <= h; y++) {           // edges between row y-1 and row y
    let run = -1;
    for (let x = 0; x <= w; x++) {
      const e = x < w && on(x, y - 1) !== on(x, y);
      if (e && run < 0) run = x; else if (!e && run >= 0) { segs.push([run, y, x, y]); run = -1; }
    }
  }
  for (let x = 0; x <= w; x++) {
    let run = -1;
    for (let y = 0; y <= h; y++) {
      const e = y < h && on(x - 1, y) !== on(x, y);
      if (e && run < 0) run = y; else if (!e && run >= 0) { segs.push([x, run, x, y]); run = -1; }
    }
  }
  edges.set(sel, segs); return segs;
}
