// Aseprite files (.aseprite / .ase): read and write, so sprites drawn on the phone open in desktop Aseprite and back.
// Format: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
//
// A sprite in memory:
//   { w, h,
//     layers: [{ name, visible, locked, opacity 0-255, blend, group, level, bg }]   bottom first, like the file
//     frames: [{ dur }]                                                              milliseconds
//     cels:   Map 'layer:frame' -> { data: Uint8ClampedArray (w*h*4, the whole canvas), opacity 0-255 }
//     tags:   [{ name, from, to, dir 0 forward / 1 reverse / 2 ping-pong, repeat, color: [r,g,b] }]
//     palette: [[r,g,b,a], ...] }
// Cels are treated as read-only once made: anything that changes one makes a new cel (undo keeps the old one).
// Reading keeps 32-bit, 16-bit grey and 8-bit indexed files (all become RGBA); writing is always 32-bit RGBA.
// Linked cels become copies, and pixels outside the canvas are dropped.

export const celKey = (l, f) => l + ':' + f;

async function inflate(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function deflate(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function readAse(buf) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const u8 = new Uint8Array(dv.buffer);
  if (dv.getUint16(4, true) !== 0xA5E0) throw new Error('Not an Aseprite file');
  const nFrames = dv.getUint16(6, true), w = dv.getUint16(8, true), h = dv.getUint16(10, true), depth = dv.getUint16(12, true);
  const transparent = u8[28];
  const spr = { w, h, layers: [], frames: [], cels: new Map(), tags: [], palette: [] };
  const str = (o) => { const n = dv.getUint16(o, true); return [new TextDecoder().decode(u8.subarray(o + 2, o + 2 + n)), o + 2 + n]; };
  const bpp = depth === 32 ? 4 : depth === 16 ? 2 : 1;
  const raw = []; // [layer, frame, x, y, opacity, w, h, pixels | link]
  let oldPal = null;
  let p = 128;
  for (let f = 0; f < nFrames; f++) {
    const fsize = dv.getUint32(p, true), oldN = dv.getUint16(p + 6, true), dur = dv.getUint16(p + 8, true), newN = dv.getUint32(p + 12, true);
    spr.frames.push({ dur: dur || 100 });
    const nChunks = newN || oldN;
    let c = p + 16;
    for (let k = 0; k < nChunks; k++) {
      const csize = dv.getUint32(c, true), type = dv.getUint16(c + 4, true), d = c + 6;
      if (type === 0x2004) {
        const flags = dv.getUint16(d, true), lt = dv.getUint16(d + 2, true), level = dv.getUint16(d + 4, true), blend = dv.getUint16(d + 10, true), op = u8[d + 12];
        const [name] = str(d + 16);
        spr.layers.push({ name, visible: !!(flags & 1), locked: !(flags & 2), opacity: op, blend, group: lt === 1, tilemap: lt === 2, level, bg: !!(flags & 8) });
      } else if (type === 0x2005) {
        const li = dv.getUint16(d, true), x = dv.getInt16(d + 2, true), y = dv.getInt16(d + 4, true), op = u8[d + 6], ct = dv.getUint16(d + 7, true);
        if (ct === 0 || ct === 2) {
          const cw = dv.getUint16(d + 16, true), ch = dv.getUint16(d + 18, true), data = u8.subarray(d + 20, c + csize);
          raw.push({ li, f, x, y, op, cw, ch, data, z: ct === 2 });
        } else if (ct === 1) raw.push({ li, f, x, y, op, link: dv.getUint16(d + 16, true) });
      } else if (type === 0x2018) {
        const n = dv.getUint16(d, true); let o = d + 10;
        for (let t = 0; t < n; t++) {
          const from = dv.getUint16(o, true), to = dv.getUint16(o + 2, true), dir = u8[o + 4], repeat = dv.getUint16(o + 5, true);
          const color = [u8[o + 13], u8[o + 14], u8[o + 15]];
          const [name, e] = str(o + 17); o = e;
          spr.tags.push({ name, from, to, dir: dir > 2 ? 0 : dir, repeat, color });
        }
      } else if (type === 0x2019) {
        const size = dv.getUint32(d, true), first = dv.getUint32(d + 4, true), last = dv.getUint32(d + 8, true); let o = d + 20;
        for (let i = 0; i < size && spr.palette.length < size; i++) spr.palette.push([0, 0, 0, 255]);
        for (let i = first; i <= last; i++) {
          const fl = dv.getUint16(o, true); spr.palette[i] = [u8[o + 2], u8[o + 3], u8[o + 4], u8[o + 5]]; o += 6;
          if (fl & 1) o = str(o)[1];
        }
      } else if ((type === 0x0004 || type === 0x0011) && !oldPal) {
        oldPal = []; const packets = dv.getUint16(d, true); let o = d + 2, idx = 0;
        for (let q = 0; q < packets; q++) {
          idx += u8[o]; let n = u8[o + 1] || 256; o += 2;
          for (let i = 0; i < n; i++, o += 3) { const s = type === 0x0011 ? 4 : 1; oldPal[idx++] = [Math.min(255, u8[o] * s), Math.min(255, u8[o + 1] * s), Math.min(255, u8[o + 2] * s), 255]; }
        }
      }
      // tilesets, slices, user data, colour profiles, masks and anything newer are skipped
      c += csize;
    }
    p += fsize;
  }
  if (!spr.palette.length && oldPal) spr.palette = oldPal.filter(Boolean);
  const pal = spr.palette;
  for (const r of raw) {
    if (r.link !== undefined) continue;
    const px = r.z ? await inflate(r.data) : r.data, out = new Uint8ClampedArray(w * h * 4), bg = spr.layers[r.li] && spr.layers[r.li].bg;
    for (let yy = 0; yy < r.ch; yy++) {
      const ty = r.y + yy; if (ty < 0 || ty >= h) continue;
      for (let xx = 0; xx < r.cw; xx++) {
        const tx = r.x + xx; if (tx < 0 || tx >= w) continue;
        const s = (yy * r.cw + xx) * bpp, t = (ty * w + tx) * 4;
        if (bpp === 4) { out[t] = px[s]; out[t + 1] = px[s + 1]; out[t + 2] = px[s + 2]; out[t + 3] = px[s + 3]; }
        else if (bpp === 2) { out[t] = out[t + 1] = out[t + 2] = px[s]; out[t + 3] = px[s + 1]; }
        else { const i = px[s]; if (i === transparent && !bg) continue; const c = pal[i] || [0, 0, 0, 255]; out[t] = c[0]; out[t + 1] = c[1]; out[t + 2] = c[2]; out[t + 3] = c[3]; }
      }
    }
    r.out = out;
  }
  for (const r of raw) if (r.link === undefined) spr.cels.set(celKey(r.li, r.f), { data: r.out, opacity: r.op });
  for (const r of raw) if (r.link !== undefined) { const src = spr.cels.get(celKey(r.li, r.link)); if (src) spr.cels.set(celKey(r.li, r.f), { data: src.data.slice(), opacity: r.op }); }
  if (!spr.layers.length) spr.layers.push({ name: 'Layer 1', visible: true, locked: false, opacity: 255, blend: 0, group: false, level: 0, bg: false });
  return spr;
}

// ---------------------------------------------------------------- writing
class Out {
  constructor() { this.a = new Uint8Array(1024); this.n = 0; }
  room(k) { if (this.n + k > this.a.length) { const b = new Uint8Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; } }
  u8(v) { this.room(1); this.a[this.n++] = v & 255; }
  u16(v) { this.u8(v); this.u8(v >> 8); }
  i16(v) { this.u16(v & 0xffff); }
  u32(v) { this.u16(v & 0xffff); this.u16((v >>> 16) & 0xffff); }
  zeros(k) { for (let i = 0; i < k; i++) this.u8(0); }
  bytes(b) { this.room(b.length); this.a.set(b, this.n); this.n += b.length; }
  str(s) { const b = new TextEncoder().encode(s); this.u16(b.length); this.bytes(b); }
  put32(at, v) { const n = this.n; this.n = at; this.u32(v); this.n = n; }
  done() { return this.a.slice(0, this.n); }
}

// the smallest box holding every visible pixel of a cel, or null when it is empty
export function bounds(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export async function writeAse(spr) {
  const { w, h } = spr, o = new Out();
  o.zeros(128);
  const head = o.a; // filled in at the end
  for (let f = 0; f < spr.frames.length; f++) {
    const start = o.n; let chunks = 0;
    o.u32(0); o.u16(0xF1FA); o.u16(0); o.u16(Math.max(1, Math.min(65535, Math.round(spr.frames[f].dur || 100)))); o.zeros(2); o.u32(0);
    const chunk = (type, body) => { const s = o.n; o.u32(0); o.u16(type); body(); o.put32(s, o.n - s); chunks++; };
    if (f === 0) {
      chunk(0x2007, () => { o.u16(1); o.u16(0); o.u32(0); o.zeros(8); }); // sRGB
      const pal = spr.palette.length ? spr.palette : [[0, 0, 0, 255]];
      chunk(0x2019, () => { o.u32(pal.length); o.u32(0); o.u32(pal.length - 1); o.zeros(8); pal.forEach(c => { o.u16(0); o.u8(c[0]); o.u8(c[1]); o.u8(c[2]); o.u8(c[3] === undefined ? 255 : c[3]); }); });
      spr.layers.forEach(l => chunk(0x2004, () => {
        o.u16((l.visible ? 1 : 0) | (l.locked ? 0 : 2) | (l.bg ? 8 : 0)); o.u16(l.group ? 1 : 0); o.u16(l.level || 0); o.u16(0); o.u16(0);
        o.u16(l.blend || 0); o.u8(l.opacity === undefined ? 255 : l.opacity); o.zeros(3); o.str(l.name || 'Layer');
      }));
      if (spr.tags.length) chunk(0x2018, () => {
        o.u16(spr.tags.length); o.zeros(8);
        spr.tags.forEach(t => { o.u16(t.from); o.u16(t.to); o.u8(t.dir || 0); o.u16(t.repeat || 0); o.zeros(6); const c = t.color || [0, 0, 0]; o.u8(c[0]); o.u8(c[1]); o.u8(c[2]); o.u8(0); o.str(t.name || 'Tag'); });
      });
    }
    for (let l = 0; l < spr.layers.length; l++) {
      if (spr.layers[l].group) continue;
      const cel = spr.cels.get(celKey(l, f)); if (!cel) continue;
      const b = bounds(cel.data, w, h); if (!b) continue;
      const px = new Uint8Array(b.w * b.h * 4);
      for (let y = 0; y < b.h; y++) px.set(cel.data.subarray(((b.y + y) * w + b.x) * 4, ((b.y + y) * w + b.x + b.w) * 4), y * b.w * 4);
      const z = await deflate(px);
      chunk(0x2005, () => { o.u16(l); o.i16(b.x); o.i16(b.y); o.u8(cel.opacity === undefined ? 255 : cel.opacity); o.u16(2); o.i16(0); o.zeros(5); o.u16(b.w); o.u16(b.h); o.bytes(z); });
    }
    o.put32(start, o.n - start);
    const n = o.n; o.n = start + 6; o.u16(Math.min(chunks, 0xffff)); o.n = start + 12; o.u32(chunks); o.n = n;
  }
  const end = o.n; o.n = 0;
  o.u32(end); o.u16(0xA5E0); o.u16(spr.frames.length); o.u16(w); o.u16(h); o.u16(32); o.u32(1); o.u16(100); o.u32(0); o.u32(0);
  o.u8(0); o.zeros(3); o.u16(Math.min(spr.palette.length, 65535)); o.u8(1); o.u8(1); o.i16(0); o.i16(0); o.u16(16); o.u16(16);
  o.n = end; void head;
  return o.done();
}

// ---------------------------------------------------------------- pictures
// every visible layer of one frame, blended, as RGBA (normal blending; other blend modes are kept in the file but drawn as normal)
export function flatten(spr, f, opts = {}) {
  const { w, h } = spr, out = new Uint8ClampedArray(w * h * 4);
  const shown = visibleLayers(spr);
  for (let l = 0; l < spr.layers.length; l++) {
    if (!shown[l] && !(opts.layer === l)) continue;
    if (spr.layers[l].group) continue;
    const cel = spr.cels.get(celKey(l, f)); if (!cel) continue;
    const a0 = (spr.layers[l].opacity === undefined ? 255 : spr.layers[l].opacity) * (cel.opacity === undefined ? 255 : cel.opacity) / 65025, d = cel.data;
    for (let i = 0; i < d.length; i += 4) {
      const sa = d[i + 3] / 255 * a0; if (!sa) continue;
      const da = out[i + 3] / 255, oa = sa + da * (1 - sa);
      out[i] = (d[i] * sa + out[i] * da * (1 - sa)) / oa; out[i + 1] = (d[i + 1] * sa + out[i + 1] * da * (1 - sa)) / oa; out[i + 2] = (d[i + 2] * sa + out[i + 2] * da * (1 - sa)) / oa; out[i + 3] = oa * 255;
    }
  }
  return out;
}
// a layer shows when it and every group it sits in are visible
export function visibleLayers(spr) {
  const out = [], stack = [];
  spr.layers.forEach((l, i) => {
    stack.length = l.level || 0;
    out[i] = l.visible && stack.every(Boolean);
    stack[l.level || 0] = l.visible && stack.slice(0, l.level || 0).every(Boolean);
  });
  return out;
}
