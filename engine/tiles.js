// Tile games: the runtime for games made with "New game" in the Studio (template "platformer" or "topdown").
// Everything comes from game.json: a scene is a grid of 8×8 tiles (one character per tile, "." is empty) plus
// things placed on top in pixels, a start and an exit. Tiles can be solid, one-way (stand on them from above)
// or hurt. Things are copies of objects, which mix behaviors from the engine's library (behaviors.json).
// Loaded after engine/screen, engine/audio and engine/input, before engine/loop (which calls update and render).
const T = 8;
const TG = window.GAME, TP = TG.player || {}, TOP = TG.template === 'topdown';
const COL = Object.assign({ sky: '#1d1b24', ink: '#0b0b10', text: '#f4f1ea', hurt: '#ff4f5e' }, TG.colors || {});
const INK = COL.ink, CREAM = COL.text, RED = COL.hurt;
let musicOn = true;
function startMusic() {}   // tile games have no music yet (audio.js asks for it)
const sfx = {
  jump: () => blip(300, 600, 0.12, 'square', 0.04),
  land: () => blip(200, 120, 0.06, 'triangle', 0.05),
  coin: () => { blip(880, 1320, 0.08, 'square', 0.035); blip(1320, 1760, 0.1, 'square', 0.03, 0.06); },
  hurt: () => { blip(220, 80, 0.25, 'sawtooth', 0.05); hiss(0.2, 0.05, 900); },
  shoot: () => blip(700, 300, 0.08, 'square', 0.03),
  hit: () => hiss(0.08, 0.05, 2400),
  melt: () => { blip(500, 60, 0.3, 'square', 0.04); hiss(0.25, 0.04, 600); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.14, 'square', 0.04, i * 0.1)),
  charge: () => blip(200, 260, 0.1, 'triangle', 0.03)
};
// up and down (the engine's input only knows left, right, jump, A and B)
keys.up = keys.down = false;
Object.assign(KEYMAP, { ArrowDown: 'down', KeyS: 'down' });
if (TOP) Object.assign(KEYMAP, { ArrowUp: 'up', KeyW: 'up', Space: 'a' });
function padAxis() {
  const g = gamepad; if (!g) return { up: false, down: false };
  const ay = g.axes[1] || 0, b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
  return { up: b(12) || ay < -0.35, down: b(13) || ay > 0.35 };
}

// ---------------------------------------------------------------- the scene
const SYM = window.SYMBOLS || {};
const symRows = (s) => (Array.isArray(s) ? s : SYM[s]) || ['11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111'];
const TILES = TG.tiles || {};
const SCENES = (TG.scenes || []).filter(s => s.kind === 'tiles');
let sceneIndex = Math.max(0, SCENES.findIndex(s => s.id === new URLSearchParams(location.search).get('scene')));
let SC, MAP, MW, MH, things, player, actors2, shots2, pellets, score = 0, banner = null, won = false;

function darken(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [n >> 16, n >> 8 & 255, n & 255].map(c => Math.round(c * k).toString(16).padStart(2, '0')).join('');
}
// each tile drawn once onto a little canvas: "1" its colour, "2" a darker shade, "0" see-through
const tileArt = {};
function tileCanvas(ch) {
  if (tileArt[ch]) return tileArt[ch];
  const t = TILES[ch], c = document.createElement('canvas'); c.width = c.height = T;
  const x = c.getContext('2d'), rows = symRows(t.symbol), col = t.color || '#8a8a90', shade = t.shade || darken(col, 0.6);
  for (let r = 0; r < T; r++) for (let q = 0; q < T; q++) {
    const v = (rows[r] || '')[q];
    if (v === '1' || v === '2') { x.fillStyle = v === '1' ? col : shade; x.fillRect(q, r, 1, 1); }
  }
  return (tileArt[ch] = c);
}
const tileAt = (tx, ty) => (ty < 0 || ty >= MH ? null : tx < 0 || tx >= MW ? (TOP ? '#wall' : '#wall') : MAP[ty][tx]);
const tileDef = (ch) => (ch === '#wall' ? { solid: true } : TILES[ch] || null);
const solidAt = (px, py) => { const d = tileDef(tileAt(Math.floor(px / T), Math.floor(py / T))); return !!(d && d.solid); };
// every tile a box touches
function tilesIn(x0, y0, x1, y1, fn) {
  for (let ty = Math.floor(y0 / T); ty <= Math.floor((y1 - 0.001) / T); ty++)
    for (let tx = Math.floor(x0 / T); tx <= Math.floor((x1 - 0.001) / T); tx++) { const d = tileDef(tileAt(tx, ty)); if (d && fn(d, tx, ty) === true) return true; }
  return false;
}
const solidIn = (x0, y0, x1, y1) => tilesIn(x0, y0, x1, y1, d => d.solid === true);

function makeBody(sym, s) { const rows = symRows(sym); return { rows, s, w: rows[0].length * s, h: rows.length * s }; }
function loadScene(i) {
  SC = SCENES[i] || { w: 20, h: 18, map: [], things: [], start: { x: 16, y: 120 } };
  MW = SC.w; MH = SC.h;
  MAP = Array.from({ length: MH }, (_, y) => { const r = SC.map[y] || ''; return Array.from({ length: MW }, (_, x) => (r[x] && r[x] !== '.' && TILES[r[x]] ? r[x] : null)); });
  const pb = makeBody(TP.symbol || 'crab', TP.scale || 1);
  player = { ...pb, x: SC.start.x, y: SC.start.y, vx: 0, vy: 0, dir: 1, face: [1, 0], onGround: false, coyote: 0, buffer: 0, hp: TP.lives || 3, inv: 0, stun: 0, cool: 0, dead: 0, t: 0 };
  player.bw = Math.max(4, player.w - 2); player.bh = Math.max(4, player.h - 1);
  actors2 = []; shots2 = []; pellets = [];
  for (const t of SC.things || []) {
    const o = (TG.objects || {})[t.obj]; if (!o) continue;
    const b = makeBody(o.symbol, o.scale || 1), a = { ...b, obj: o, x: t.x, y: t.y, hx: t.x, hy: t.y, vx: 0, vy: 0, dir: 1, t: 0, cool: 0, alive: true, hit: 0, b: {} };
    for (const bh of o.behaviors || []) a.b[bh.type] = { ...behaviorDefaults2(bh.type), ...bh };
    a.hp = a.b.health ? a.b.health.hp : 0;
    actors2.push(a);
  }
  camX = player.x - VW / 2; camY = player.y - VH / 2;
}
function behaviorDefaults2(type) { const d = {}, p = ((window.BEHAVIORS || {}).behaviors || {})[type]; for (const k in (p && p.params) || {}) d[k] = p.params[k].default; return d; }

// ---------------------------------------------------------------- moving with tiles in the way
// boxes: x is the middle, y the bottom
const boxOf = (o, w = o.bw || o.w, h = o.bh || o.h) => ({ x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - h, y1: o.y });
// standing places that aren't tiles: tops of solid things
function thingTops() { return actors2.filter(a => a.alive && a.b.solid).map(a => ({ x0: a.x - a.w / 2, x1: a.x + a.w / 2, top: a.y - a.h, who: a })); }
function moveX(o, dx, w, h) {
  if (!dx) return false;
  const nx = o.x + dx, b = { x0: nx - w / 2, x1: nx + w / 2, y0: o.y - h + 0.01, y1: o.y - 0.01 };
  if (!solidIn(b.x0, b.y0, b.x1, b.y1) && !(TOP && blockedByThing(o, b))) { o.x = nx; return false; }
  // up against a wall: slide to its edge
  if (dx > 0) o.x = Math.floor(b.x1 / T) * T - w / 2 - 0.01; else o.x = Math.ceil(b.x0 / T) * T + w / 2 + 0.01;
  if (TOP && blockedByThing(o, { x0: o.x - w / 2, x1: o.x + w / 2, y0: b.y0, y1: b.y1 })) o.x -= dx;
  return true;
}
function blockedByThing(o, b) { return thingTops().some(s => s.who !== o && b.x0 < s.x1 && b.x1 > s.x0 && b.y0 < s.who.y && b.y1 > s.top); }
// vertical: lands on solid tiles, one-way tiles from above, and solid things
function moveY(o, dy, w, h) {
  if (!dy) return false;
  const ny = o.y + dy, x0 = o.x - w / 2 + 0.01, x1 = o.x + w / 2 - 0.01;
  if (dy > 0) {
    let land = null;
    tilesIn(x0, o.y - h + 0.01, x1, ny, (d, tx, ty) => {
      const top = ty * T;
      if ((d.solid || (d.oneWay && !TOP)) && o.y <= top + 0.01 && ny >= top && (land === null || top < land)) land = top;
    });
    if (!TOP) for (const s of thingTops()) if (s.who !== o && x1 > s.x0 && x0 < s.x1 && o.y <= s.top + 0.01 && ny >= s.top && (land === null || s.top < land)) { land = s.top; o.on = s.who; }
    if (TOP) { const b = { x0, x1, y0: ny - h, y1: ny }; if (solidIn(b.x0, b.y0, b.x1, b.y1) || blockedByThing(o, b)) { o.y = Math.floor(ny / T) * T - 0.01; if (solidIn(x0, o.y - h, x1, o.y)) o.y -= dy; return true; } o.y = ny; return false; }
    if (land !== null) { o.y = land; return true; }
    o.y = ny; return false;
  }
  const b = { x0, x1, y0: ny - h, y1: o.y - 0.01 };
  if (solidIn(b.x0, b.y0, b.x1, b.y1) || (TOP && blockedByThing(o, b))) { o.y = Math.ceil(b.y0 / T) * T + h + 0.01; return true; }
  o.y = ny; return false;
}
const groundBelow = (o, w) => tilesIn(o.x - w / 2 + 0.5, o.y + 0.5, o.x + w / 2 - 0.5, o.y + 1.5, d => !!(d.solid || d.oneWay));

// ---------------------------------------------------------------- the player
const P2 = Object.assign({ walkMax: 1.4, walkAccel: 0.2, stopDecel: 0.3, gravity: 0.3, holdJumpGravity: 0.17, jumpSpeed: 4.1, maxFall: 3.6, coyoteFrames: 6, jumpBufferFrames: 7,
  lives: 3, hurtInvulnFrames: 90, hurtStunFrames: 12, knockback: 2, speed: 1.2, shoot: true, shotSpeed: 3, shotCooldown: 14, stomp: true }, TP);
function hurt(fromX) {
  const p = player; if (p.inv > 0 || p.dead) return;
  p.hp--; p.inv = P2.hurtInvulnFrames; p.stun = P2.hurtStunFrames; sfx.hurt(); if (typeof rumble === 'function') rumble(120, 0.6, 0.3);
  const d = Math.sign(p.x - fromX) || -p.dir;
  if (TOP) { p.vx = d * P2.knockback; } else { p.vx = d * P2.knockback; p.vy = -P2.knockback; p.onGround = false; }
  if (p.hp <= 0) die();
}
function die() { player.dead = 60; player.hp = 0; sfx.melt(); }
function updatePlayer() {
  const p = player, ax = padAxis();
  p.t++; if (p.inv > 0) p.inv--; if (p.cool > 0) p.cool--;
  if (p.dead) { if (--p.dead === 0) { const keep = score; loadScene(sceneIndex); score = keep; } return; }
  const L = held('left'), R = held('right'), U = TOP ? (held('up') || held('jump') || ax.up) : false, D = held('down') || ax.down;
  if (TOP) {
    let dx = (R ? 1 : 0) - (L ? 1 : 0), dy = (D ? 1 : 0) - (U ? 1 : 0);
    if (dx || dy) { p.face = [dx, dy]; if (dx) p.dir = dx; }
    const k = dx && dy ? Math.SQRT1_2 : 1;
    if (p.stun > 0) { p.stun--; p.vx *= 0.85; } else { p.vx = dx * P2.speed * k; p.vy = dy * P2.speed * k; }
    moveX(p, p.vx, p.bw, p.bh); moveY(p, p.stun > 0 ? 0 : p.vy, p.bw, p.bh);
  } else {
    const dx = (R ? 1 : 0) - (L ? 1 : 0);
    if (p.stun > 0) p.stun--;
    else if (dx) { p.vx += dx * P2.walkAccel; p.vx = Math.max(-P2.walkMax, Math.min(P2.walkMax, p.vx)); p.dir = dx; }
    else { const s = Math.sign(p.vx); p.vx -= s * Math.min(Math.abs(p.vx), P2.stopDecel); }
    if (pressed.jump) p.buffer = P2.jumpBufferFrames;
    if (p.onGround) p.coyote = P2.coyoteFrames; else if (p.coyote > 0) p.coyote--;
    if (p.buffer > 0) { p.buffer--; if (p.coyote > 0) { p.vy = -P2.jumpSpeed; p.onGround = false; p.coyote = 0; p.buffer = 0; sfx.jump(); } }
    p.vy = Math.min(P2.maxFall, p.vy + (p.vy < 0 && held('jump') ? P2.holdJumpGravity : P2.gravity));
    if (moveX(p, p.vx, p.bw, p.bh)) p.vx = 0;
    const wasOn = p.onGround; p.on = null;
    const hit = moveY(p, p.vy, p.bw, p.bh);
    if (hit) { if (p.vy > 0) { p.onGround = true; if (!wasOn && p.vy > 1.5) sfx.land(); } p.vy = 0; } else p.onGround = groundBelow(p, p.bw) && p.vy >= 0;
    if (p.on && p.on.dx) p.x += p.on.dx;   // ride a moving thing
    if (p.y - p.bh > MH * T + 16) die();   // fell out of the level
  }
  // shoot: A forward (B backward in a platformer)
  if (P2.shoot && p.cool <= 0 && (pressed.a || pressed.b)) {
    const back = !TOP && pressed.b && !pressed.a, d = back ? -p.dir : p.dir;
    const [fx, fy] = TOP ? (p.face[0] || p.face[1] ? p.face : [p.dir, 0]) : [d, 0], n = Math.hypot(fx, fy) || 1;
    pellets.push({ x: p.x + fx / n * p.w / 2, y: p.y - p.h / 2, vx: fx / n * P2.shotSpeed, vy: fy / n * P2.shotSpeed, life: 60 });
    p.cool = P2.shotCooldown; sfx.shoot();
  }
  pressed.jump = pressed.a = pressed.b = false;
  // hurting tiles
  const b = boxOf(p);
  if (tilesIn(b.x0 + 1, b.y0 + 1, b.x1 - 1, b.y1, d => !!d.hurt)) hurt(p.x - p.dir);
  // the exit
  if (SC.exit && !won) { const e = SC.exit; if (Math.abs(p.x - e.x) < 8 && p.y > e.y - 14 && p.y - p.bh < e.y) clearScene(); }
}
function clearScene() {
  won = true; sfx.win();
  const last = sceneIndex >= SCENES.length - 1;
  banner = { text: last ? 'YOU WIN' : 'CLEAR', t: 120, then: () => { won = false; sceneIndex = last ? 0 : sceneIndex + 1; if (last) score = 0; loadScene(sceneIndex); } };
}

// ---------------------------------------------------------------- things that move by themselves (the behavior library)
function updateThings() {
  const p = player, pb = boxOf(p);
  for (const a of actors2) {
    if (!a.alive) continue;
    a.t++; if (a.hit > 0) a.hit--; if (a.cool > 0) a.cool--;
    const B = a.b, ox = a.x, oy = a.y, dx = p.x - a.x, dy = (p.y - p.h / 2) - (a.y - a.h / 2), dist = Math.hypot(dx, dy), flies = TOP || B.hover || B.mover || (B.chase && B.chase.fly);
    if (B.mover) { const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * a.t / B.mover.period); a.x = a.hx + B.mover.dx * k; a.y = a.hy - B.mover.dy * k; }
    else if (B.chase && dist < B.chase.range && !p.dead) {
      moveX(a, Math.sign(dx) * Math.min(Math.abs(dx), B.chase.speed), a.w - 2, a.h - 1);
      if (flies) moveY(a, Math.sign(dy) * Math.min(Math.abs(dy), B.chase.speed), a.w - 2, a.h - 1);
      a.dir = Math.sign(dx) || a.dir;
    } else if (B.patrol) {
      const wall = moveX(a, a.dir * B.patrol.speed, a.w - 2, a.h - 1);
      // turn at walls, at the end of its range, and (on the ground) at ledges
      const ledge = !flies && !TOP && a.onGround && !tilesIn(a.x + a.dir * a.w / 2 - 0.5, a.y + 0.5, a.x + a.dir * a.w / 2 + 0.5, a.y + 1.5, d => !!(d.solid || d.oneWay));
      if (wall || ledge || Math.abs(a.x - a.hx) > B.patrol.range) { a.dir *= -1; if (!wall) a.x = ox; }
    } else if (B.chase) { moveX(a, Math.sign(a.hx - a.x) * Math.min(Math.abs(a.hx - a.x), B.chase.speed * 0.5), a.w - 2, a.h - 1); if (flies) moveY(a, Math.sign(a.hy - a.y) * Math.min(Math.abs(a.hy - a.y), B.chase.speed * 0.5), a.w - 2, a.h - 1); }
    if (B.hover && !B.mover && !(B.chase && B.chase.fly)) a.y = a.hy + Math.sin(a.t * B.hover.bobSpeed) * B.hover.bob;
    if (!flies) {   // things on the ground fall
      a.vy = Math.min(P2.maxFall, a.vy + P2.gravity);
      if (moveY(a, a.vy, a.w - 2, a.h - 1)) { a.onGround = a.vy > 0; a.vy = 0; } else a.onGround = groundBelow(a, a.w - 2);
      if (a.y - a.h > MH * T + 16) a.alive = false;
    }
    a.dx = a.x - ox;
    if (B.shooter && a.cool <= 0 && dist < B.shooter.range && !p.dead) {
      a.cool = B.shooter.every; const d = dist || 1;
      shots2.push({ x: a.x, y: a.y - a.h / 2, vx: dx / d * B.shooter.speed, vy: dy / d * B.shooter.speed, life: 240 }); sfx.charge();
    }
    const ab = boxOf(a, a.w - 2, a.h - 1);
    if (!p.dead && pb.x0 < ab.x1 && pb.x1 > ab.x0 && pb.y0 < ab.y1 && pb.y1 > ab.y0) {
      if (B.collectible) { a.alive = false; score += B.collectible.score || 0; p.hp = Math.min(P2.lives, p.hp + (B.collectible.hearts || 0)); sfx.coin(); continue; }
      const fromAbove = !TOP && p.vy > 0 && p.y - p.vy <= ab.y0 + 3;
      if (B.bouncer && fromAbove) { p.vy = -B.bouncer.strength; p.onGround = false; p.y = ab.y0; sfx.jump(); continue; }
      if (fromAbove && P2.stomp && B.health) { p.vy = -P2.jumpSpeed * 0.7; p.y = ab.y0; damage(a); continue; }
      if (B.touchDamage) hurt(a.x);
    }
  }
  for (const s of shots2) { s.x += s.vx; s.y += s.vy; s.life--; if (solidAt(s.x, s.y)) s.life = 0; if (!p.dead && s.x > pb.x0 && s.x < pb.x1 && s.y > pb.y0 && s.y < pb.y1) { hurt(s.x); s.life = 0; } }
  shots2 = shots2.filter(s => s.life > 0);
  for (const s of pellets) {
    s.x += s.vx; s.y += s.vy; s.life--;
    if (solidAt(s.x, s.y)) { s.life = 0; continue; }
    for (const a of actors2) { if (!a.alive || !a.b.health) continue; const b = boxOf(a); if (s.x >= b.x0 && s.x <= b.x1 && s.y >= b.y0 && s.y <= b.y1) { s.life = 0; damage(a); break; } }
  }
  pellets = pellets.filter(s => s.life > 0);
}
function damage(a) { a.hp--; a.hit = 8; sfx.hit(); if (a.hp <= 0) { a.alive = false; score += 1; sfx.melt(); } }

// ---------------------------------------------------------------- camera, update, drawing
let camX = 0, camY = 0;
function update() {
  if (banner) { if (--banner.t <= 0) { const f = banner.then; banner = null; if (f) f(); } return; }
  updatePlayer(); updateThings();
  const look = TOP ? 0 : player.dir * ((TG.camera || {}).lookAhead || 12), ease = (TG.camera || {}).lookEase || 0.1;
  const tx = player.x + look - VW / 2, ty = player.y - player.h / 2 - VH / 2;
  camX += (tx - camX) * ease * 2; camY += (ty - camY) * ease * 2;
  camX = Math.max(0, Math.min(MW * T - VW, camX)); camY = Math.max(0, Math.min(MH * T - VH, camY));
  if (MW * T < VW) camX = (MW * T - VW) / 2; if (MH * T < VH) camY = (MH * T - VH) / 2;
}
// a symbol, outlined in ink like Crab's art; flashing when hit
function drawSym(o, color, flip) {
  const x0 = Math.round(o.x - o.w / 2 - camX), y0 = Math.round(o.y - o.h - camY), s = o.s, rows = o.rows, W2 = rows[0].length;
  if (x0 > VW || x0 + o.w < 0 || y0 > VH || y0 + o.h < 0) return;
  const on = (r, c) => r >= 0 && r < rows.length && c >= 0 && c < W2 && rows[r][flip ? W2 - 1 - c : c] === '1';
  ctx.fillStyle = INK;
  for (let r = -1; r <= rows.length; r++) for (let c = -1; c <= W2; c++) if (!on(r, c) && (on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1))) ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
  ctx.fillStyle = color;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < W2; c++) if (on(r, c)) ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
}
const DIG = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
  Y: '101101010010010', O: '111101101101111', U: '101101101101111', W: '101101111111101', I: '111010010010111', N: '110101101101101', C: '111100100100111', L: '100100100100111', E: '111100111100111', A: '010101111101101', R: '110101110101101', P: '111101111100100', S: '111100111001111', D: '110101101101110', ' ': '000000000000000' };
function say(str, x, y, color) {
  for (const pass of [INK, color]) { let cx = x + (pass === INK ? 1 : 0); for (const ch of str) { const g = DIG[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') { ctx.fillStyle = pass; ctx.fillRect(cx + i % 3, y + (pass === INK ? 1 : 0) + Math.floor(i / 3), 1, 1); } cx += 4; } }
}
const FLAG = makeBody(['1111', '1111', '1110', '1000', '1000', '1000', '1000', '1000'], 1);
function render() {
  ctx.fillStyle = COL.sky; ctx.fillRect(0, 0, VW, VH);
  const cx = Math.round(camX), cy = Math.round(camY);
  for (let ty = Math.max(0, Math.floor(cy / T)); ty <= Math.min(MH - 1, Math.floor((cy + VH) / T)); ty++)
    for (let tx = Math.max(0, Math.floor(cx / T)); tx <= Math.min(MW - 1, Math.floor((cx + VW) / T)); tx++) { const ch = MAP[ty][tx]; if (ch) ctx.drawImage(tileCanvas(ch), tx * T - cx, ty * T - cy); }
  if (SC.exit) drawSym({ ...FLAG, x: SC.exit.x, y: SC.exit.y }, (TG.exitColor || '#7dff6a'));
  for (const a of actors2) if (a.alive) drawSym(a, a.hit > 0 && a.hit % 2 ? CREAM : (a.obj.color || RED), a.dir < 0 && (a.b.patrol || a.b.chase));
  const p = player;
  if (!p.dead && !(p.inv > 0 && p.inv % 6 < 3)) drawSym(p, TP.color || '#ff5a1f', p.dir < 0);
  if (p.dead) { ctx.fillStyle = TP.color || '#ff5a1f'; for (let i = 0; i < 6; i++) { const r = (60 - p.dead) * 0.8, an = i * Math.PI / 3; ctx.fillRect(Math.round(p.x - cx + Math.cos(an) * r), Math.round(p.y - p.h / 2 - cy + Math.sin(an) * r), 2, 2); } }
  for (const s of shots2) { ctx.fillStyle = INK; ctx.fillRect(Math.round(s.x - cx) - 2, Math.round(s.y - cy) - 2, 4, 4); ctx.fillStyle = RED; ctx.fillRect(Math.round(s.x - cx) - 1, Math.round(s.y - cy) - 1, 2, 2); }
  for (const s of pellets) { ctx.fillStyle = INK; ctx.fillRect(Math.round(s.x - cx) - 2, Math.round(s.y - cy) - 2, 4, 4); ctx.fillStyle = CREAM; ctx.fillRect(Math.round(s.x - cx) - 1, Math.round(s.y - cy) - 1, 2, 2); }
  // hearts and score
  for (let i = 0; i < P2.lives; i++) { ctx.fillStyle = INK; ctx.fillRect(3 + i * 7, 3, 6, 6); ctx.fillStyle = i < p.hp ? RED : '#3a3a42'; ctx.fillRect(4 + i * 7, 4, 4, 4); }
  say(String(score), VW - 4 - String(score).length * 4, 4, CREAM);
  if (banner) say(banner.text, Math.round(VW / 2 - banner.text.length * 2), Math.round(VH / 2 - 3), CREAM);
  if (paused) say('PAUSED', VW / 2 - 12, VH / 2 - 3, CREAM);
}
loadScene(sceneIndex);
