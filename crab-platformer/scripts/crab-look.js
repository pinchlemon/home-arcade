// The crab is assembled off-screen: base pose first, then (while snapping) the normal claw on that
// side is cleared and the open claw from the project's "shooting" frames is dropped in.
const oc = document.createElement('canvas'); oc.width = 48; oc.height = 20;
const octx = oc.getContext('2d', { willReadFrequently: true });
const PAD = 3;
function ocell(r, c, y, flip = false, sx0 = 0, sx1 = 48) {
  const w = sx1 - sx0;
  if (!flip) { octx.drawImage(sheet, c * 48 + sx0, r * 16, w, 16, sx0, y, w, 16); return; }
  octx.save(); octx.translate(48, y); octx.scale(-1, 1);
  octx.drawImage(sheet, c * 48 + sx0, r * 16, w, 16, sx0, 0, w, 16);
  octx.restore();
}
const tmp = document.createElement('canvas'); tmp.width = 48; tmp.height = 20;
const tctx = tmp.getContext('2d');
function drawCrab(x, y) {
  octx.clearRect(0, 0, oc.width, oc.height);
  const right = crab.face > 0;
  if (!crab.onGround) {
    // jump: his standing frame with both legs splayed; eyes stay exactly as when standing
    ocell(11, right ? 1 : 0, PAD);
    pose = { key: right ? '11,1' : '11,0', flip: false };
  } else {
    const row = crab.walking ? (right ? ROW.moveRight : ROW.moveLeft) : (right ? ROW.idleRight : ROW.idleLeft);
    ocell(row, crab.frame, PAD);
    pose = { key: row + ',' + crab.frame, flip: false };
  }
  // squeeze: the pincers clamp down on the lemon and it squashes flat
  if (crab.snapT > 0) {
    const age = SNAP_FRAMES - crab.snapT;
    const k = age < 1 ? 1 : age < 3 ? 3 : age < 6 ? 2 : age < 9 ? 1 : 0;
    if (k) squeezeClaw(crab.snapSide, k);
  }
  // expressions: straining toward the squirt, or squinting in pain when hit
  const snapAge = SNAP_FRAMES - crab.snapT;
  if (crab.invuln > 60 || crab.dead) moveEyes(0, 1, 0);                              // hurt: eyes drop into a squint, same as when he squeezes
  else if (crab.snapT > 0 && snapAge < 10) moveEyes(crab.snapSide, 1, 0);           // lean toward the squirt; the glare stays put
  else if (!crab.onGround && crab.vy < -1) moveEyes(0, 1, 0);                         // jumping: eyes lag low on the way up...
  else if (!crab.onGround && crab.vy > 1) moveEyes(0, -1, 0);                         // ...and float high on the way down
  if (crab.snapT > SNAP_FRAMES - 9 || crab.invuln > 60 || crab.dead) {
    gritTeeth();
  }
  const strain = crab.snapT > 0 && snapAge >= 1 && snapAge < 5 ? (t % 2 ? 1 : 0) : 0;
  ctx.drawImage(oc, x + strain, y - PAD);
  if (crab.invuln > 45 && !crab.dead) {
    const pop = crab.invuln > 85 ? 0 : (t >> 3) % 2;
    sprite(ANGER, x + 24 + crab.face * 7 - 2, y - 9 - pop);
  }
  if (crab.snapT > 0) drawBurst(crab.snapSide, SNAP_FRAMES - crab.snapT, x, y);
}

const LEMON_RGB = new Set(['244,217,74', '216,165,49', '255,244,176', '179,194,58']);
function squeezeClaw(side, k) {
  const x0 = side < 0 ? 0 : 33, w = 15, h = PAD + 13;   // stops above the legs
  const src = octx.getImageData(x0, 0, w, h), S = src.data;
  const out = new ImageData(new Uint8ClampedArray(S), w, h), O = out.data;
  const idx = (x, y) => (y * w + x) * 4;
  const isLemon = i => S[i + 3] && LEMON_RGB.has(S[i] + ',' + S[i + 1] + ',' + S[i + 2]);
  // the claw = everything solid connected to its lemon
  const claw = new Uint8Array(w * h), stack = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isLemon(idx(x, y))) { claw[y * w + x] = 1; stack.push([x, y]); }
  if (!stack.length) return;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || claw[ny * w + nx] || !S[idx(nx, ny) + 3]) continue;
      claw[ny * w + nx] = 1; stack.push([nx, ny]);
    }
  }
  let sy = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isLemon(idx(x, y))) { sy += y; n++; }
  const cy = sy / n, out1 = side > 0 ? 1 : -1;
  for (let i = 0; i < w * h; i++) if (claw[i]) O[i * 4 + 3] = 0;
  const put = (x, y, i) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const o = idx(x, y); O[o] = S[i]; O[o + 1] = S[i + 1]; O[o + 2] = S[i + 2]; O[o + 3] = 255;
  };
  // pincers close 1px: top half moves down, bottom half moves up
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = idx(x, y); if (!claw[y * w + x] || isLemon(i)) continue;
    put(x, y < cy - 0.5 ? y + 1 : y > cy + 0.5 ? y - 1 : y, i);
  }
  // lemon on top, squashed by the same 1px from each side; at the peak it bulges out of the claw
  let tipX = side > 0 ? -1 : w;
  for (let x = 0; x < w; x++) {
    const ys = [];
    for (let y = 0; y < h; y++) if (isLemon(idx(x, y))) ys.push(y);
    if (!ys.length) continue;
    if (side > 0 ? x > tipX : x < tipX) tipX = x;
    const top = ys[0], bot = ys[ys.length - 1];
    for (const y of ys) put(x, bot - top >= 2 ? (y === top ? top + 1 : y === bot ? bot - 1 : y) : y, idx(x, y));
  }
  if (k > 1) for (let y = 0; y < h; y++) {
    const i = idx(tipX, y);
    if (isLemon(i) && Math.abs(y - cy) < 1.2) { put(tipX + out1, y, i); if (k > 2) put(tipX + out1 * 2, y, idx(tipX, y)); }
  }
  octx.putImageData(out, x0, 0);
}

// Eyes on stalks: each eyeball (found by its white highlight) can be moved, with the stalk stretched to follow,
// and its highlight shifted so he looks one way.
function moveEyes(dx, dy, look) {
  for (const [x0, x1] of [[11, 21], [27, 37]]) {
    const w = x1 - x0, hgt = PAD + 7, img = octx.getImageData(x0, 0, w, hgt), d = img.data;
    const at = (x, y) => (y * w + x) * 4;
    const kind = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= hgt) return '.'; const i = at(x, y); return !d[i + 3] ? '.' : d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200 ? 'w' : d[i] < 60 ? 'k' : 'r'; };
    let hx = -1, hy = -1;
    for (let y = 0; y <= PAD + 3 && hy < 0; y++) for (let x = 0; x < w; x++) if (kind(x, y) === 'w') { hx = x; hy = y; break; }
    if (hy < 0) continue;
    // eyeball = dark/white pixels connected to the highlight, within its three rows
    const ball = [], seen = new Set([hx + ',' + hy]), st = [[hx, hy]];
    while (st.length) {
      const [x, y] = st.pop(); ball.push([x, y, kind(x, y)]);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (ny < hy - 1 || ny > hy + 1 || seen.has(nx + ',' + ny)) continue;
        const k = kind(nx, ny); if (k !== 'k' && k !== 'w') continue;
        seen.add(nx + ',' + ny); st.push([nx, ny]);
      }
    }
    const stalkCols = [];
    for (let x = 0; x < w; x++) if (kind(x, hy + 2) === 'k' && ball.some(b => Math.abs(b[0] - x) <= 1)) stalkCols.push(x);
    for (const [x, y] of ball) d[at(x, y) + 3] = 0;
    // stretched stalk under a raised eyeball
    for (let y = hy + 2 + dy; y <= hy + 1; y++) for (const x of stalkCols) if (y >= 0) { const i = at(x, y); d[i] = 23; d[i + 1] = 20; d[i + 2] = 13; d[i + 3] = 255; }
    let wx = null;
    for (const [x, y, k] of ball) if (k === 'w') wx = x;
    for (const [x, y, k] of ball) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= hgt) continue;
      let c = k === 'w' ? [240, 240, 231] : [23, 20, 13];
      if (look) {   // shift the highlight toward where he's looking
        if (k === 'w') c = [23, 20, 13];
        const row = ball.filter(b => b[1] === hy).map(b => b[0]);
        const lx = look > 0 ? Math.max(...row) - 1 : Math.min(...row) + 1;
        if (y === hy && x === lx) c = [240, 240, 231];
      }
      const i = at(nx, ny); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    octx.putImageData(img, x0, 0);
  }
}
function squintEyes() {
  for (const [x0, x1] of [[11, 21], [27, 37]]) {
    const w = x1 - x0, hgt = PAD + 7, img = octx.getImageData(x0, 0, w, hgt), d = img.data;
    const at = (x, y) => (y * w + x) * 4;
    const kind = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= hgt) return '.'; const i = at(x, y); return !d[i + 3] ? '.' : d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200 ? 'w' : d[i] < 60 ? 'k' : 'r'; };
    let hx = -1, hy = -1;
    for (let y = 0; y <= PAD + 3 && hy < 0; y++) for (let x = 0; x < w; x++) if (kind(x, y) === 'w') { hx = x; hy = y; break; }
    if (hy < 0) continue;
    // the eyeball's bottom row: dark pixels directly under the highlight row that belong to the ball
    const row = hy + 1;
    let xl = hx, xr = hx;
    while (kind(xl - 1, hy) === 'k') xl--;
    while (kind(xr + 1, hy) === 'k') xr++;
    for (let x = xl; x <= xr; x++) if (kind(x, row) === 'k') d[at(x, row) + 3] = 0;
    octx.putImageData(img, x0, 0);
  }
}
const ANGER = [".r.r.", "rp.pr", ".....", "rp.pr", ".r.r."];

const SHELL = [210, 88, 85];
// angry face: his puckered lips part and a white line of teeth shows.
// The lips are a ring with a short dark slit in the middle; find that slit in whatever frame is showing.
function gritTeeth() {
  // his mouth: a short dark slit between puckered lips. Opening it: the slit turns into a row of teeth,
  // the lower lip (its red row and the dark line under it) drops one pixel, and a second row of teeth fills the gap.
  const x0 = 14, w = 20, y0 = PAD + 2, h = 12;
  const img = octx.getImageData(x0, y0, w, h), d = img.data;
  const at = (x, y) => { const i = (y * w + x) * 4; return d[i + 3] ? (d[i] < 60 ? 'k' : d[i] > 200 && d[i + 1] > 200 ? 'w' : 'r') : '.'; };
  const get = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
  const set = (x, y, c) => { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] ?? 255; };
  const TEETH = [240, 240, 231];
  for (let y = 1; y < h - 3; y++) for (let x = 2; x < w - 5; x++) {
    if (at(x - 1, y) === 'r' && at(x, y) === 'k' && at(x + 1, y) === 'k' && at(x + 2, y) === 'k' && at(x + 3, y) === 'r'
        && at(x + 1, y - 1) === 'r' && at(x + 1, y + 1) === 'r') {
      const lipRow = [], lineRow = [];
      for (let i = -2; i <= 4; i++) { lipRow.push(get(x + i, y + 1)); lineRow.push(get(x + i, y + 2)); }
      for (let i = -2; i <= 4; i++) {
        set(x + i, y + 3, lineRow[i + 2]);                       // lower lip line, one pixel lower
        set(x + i, y + 2, lipRow[i + 2]);                        // lower lip, one pixel lower
        set(x + i, y + 1, lipRow[i + 2]);                        // mouth corners stay where they were...
      }
      // on the two teeth rows, the lips' black outline beside the teeth becomes plain shell
      for (const yy of [y, y + 1]) for (let i = -3; i <= 5; i++) if (at(x + i, yy) === 'k') set(x + i, yy, [210, 88, 85]);
      for (let i = 0; i < 3; i++) { set(x + i, y, TEETH); set(x + i, y + 1, TEETH); }   // ...with two rows of teeth inside
      octx.putImageData(img, x0, y0);
      return;
    }
  }
}
