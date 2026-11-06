// Animated GIF files from RGBA frames (the sprite editor's Export). Loops forever; see-through pixels stay see-through.
// frames: [{ data: Uint8ClampedArray (w*h*4), delay: milliseconds }], all w x h.
// Colour 0 is "see-through"; up to 255 colours are kept exactly. Pictures with more are reduced (fewer shades per channel) until they fit.

export function encodeGif(frames, w, h) {
  // the colours used (half see-through or less counts as see-through)
  let shift = 0, map, colors;
  for (;;) {
    map = new Map(); colors = [];
    const key = (d, i) => ((d[i] >> shift) << 16) | ((d[i + 1] >> shift) << 8) | (d[i + 2] >> shift);
    for (const f of frames) for (let i = 0; i < f.data.length; i += 4) {
      if (f.data[i + 3] < 128) continue;
      const k = key(f.data, i);
      if (!map.has(k)) { map.set(k, colors.length + 1); colors.push(k); if (colors.length > 255) break; }
    }
    if (colors.length <= 255) break;
    shift++;
  }
  let bits = 1; while ((1 << bits) < colors.length + 1) bits++;
  const size = 1 << bits, out = [];
  const u8 = (v) => out.push(v & 255), u16 = (v) => { u8(v); u8(v >> 8); }, str = (s) => { for (const c of s) u8(c.charCodeAt(0)); };
  str('GIF89a'); u16(w); u16(h); u8(0x80 | ((bits - 1) << 4) | (bits - 1)); u8(0); u8(0);
  const up = (c) => Math.min(255, (c << shift) | (shift ? (1 << (shift - 1)) : 0));
  for (let i = 0; i < size; i++) {
    if (i === 0 || i > colors.length) { u8(0); u8(0); u8(0); continue; }
    const k = colors[i - 1]; u8(up(k >> 16 & 255)); u8(up(k >> 8 & 255)); u8(up(k & 255));
  }
  u8(0x21); u8(0xff); u8(11); str('NETSCAPE2.0'); u8(3); u8(1); u16(0); u8(0);   // loop forever
  const minCode = Math.max(2, bits);
  for (const f of frames) {
    u8(0x21); u8(0xf9); u8(4); u8((2 << 2) | 1); u16(Math.max(2, Math.round((f.delay || 100) / 10))); u8(0); u8(0);   // clear to see-through after each frame
    u8(0x2c); u16(0); u16(0); u16(w); u16(h); u8(0);
    const idx = new Uint8Array(w * h), d = f.data;
    for (let p = 0, i = 0; p < idx.length; p++, i += 4) idx[p] = d[i + 3] < 128 ? 0 : map.get(((d[i] >> shift) << 16) | ((d[i + 1] >> shift) << 8) | (d[i + 2] >> shift));
    u8(minCode);
    const data = lzw(idx, minCode);
    for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); u8(n); for (let k = 0; k < n; k++) out.push(data[i + k]); }
    u8(0);
  }
  u8(0x3b);
  return new Uint8Array(out);
}

function lzw(px, minCode) {
  const clear = 1 << minCode, eoi = clear + 1, out = [];
  let size = minCode + 1, next = eoi + 1, table = new Map(), cur = 0, shift = 0;
  const emit = (c) => { cur |= c << shift; shift += size; while (shift >= 8) { out.push(cur & 255); cur >>>= 8; shift -= 8; } };
  emit(clear);
  let code = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = (code << 8) | k, hit = table.get(key);
    if (hit !== undefined) { code = hit; continue; }
    emit(code);
    if (next === 4096) { emit(clear); next = eoi + 1; size = minCode + 1; table = new Map(); }
    else { if (next >= (1 << size)) size++; table.set(key, next++); }
    code = k;
  }
  emit(code); emit(eoi);
  if (shift > 0) out.push(cur & 255);
  return out;
}
