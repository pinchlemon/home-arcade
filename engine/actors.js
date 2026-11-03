// Actors: things in a level whose behavior comes from the engine's behavior library (see behaviors.json).
// A game object with base "actor" lists behaviors; each placed copy becomes an actor here.
// The game provides: GROUND, crab (x = middle, y = feet), hurtCrab(x), kills (the score), LIFE, sprite colours (INK, CREAM, RED),
// splash(x, y, n, colour), sfx, solidsNear(x), and calls updateActors(), juiceHitsActor(p), drawActors(cx).
const BEH = window.BEHAVIORS || { behaviors: {} };
function behaviorDefaults(type) { const d = {}, p = (BEH.behaviors[type] || {}).params || {}; for (const k in p) d[k] = p[k].default; return d; }
function makeActor(obj, t) {
  const sym = (window.SYMBOLS || {})[obj.symbol] || ['11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111'];
  const s = obj.scale || 2, h = t.h || 0;
  const a = { obj, sym, s, w: sym[0].length * s, h: sym.length * s, x: t.x, y: GROUND - h, hx: t.x, hy: GROUND - h, dir: 1, t: 0, cool: 0, alive: true, hit: 0, b: {} };
  for (const bh of obj.behaviors || []) a.b[bh.type] = { ...behaviorDefaults(bh.type), ...bh };
  a.hp = a.b.health ? a.b.health.hp : 0;
  return a;
}
function placeActors() {
  actors = []; shots = [];
  for (const t of LEVEL_THINGS) { const o = objOf(t); if (o.base === 'actor') actors.push(makeActor(o, t)); }
}
const crabBox = () => ({ x0: crab.x - 9, x1: crab.x + 9, y0: crab.y - 14, y1: crab.y });
const actorBox = (a) => ({ x0: a.x - a.w / 2, x1: a.x + a.w / 2, y0: a.y - a.h, y1: a.y });
const overlap = (p, q) => p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0;
// tops the player can stand on
function actorSolids(wx, range) {
  const out = [];
  for (const a of actors) if (a.alive && a.b.solid && Math.abs(a.x - wx) < range + a.w) out.push({ x0: a.x - a.w / 2, x1: a.x + a.w / 2, top: Math.round(a.y - a.h), who: a });
  return out;
}
function updateActors() {
  if (!actorsPlaced) { actorsPlaced = true; placeActors(); }
  const cb = crabBox();
  for (const a of actors) {
    if (!a.alive) continue;
    a.t++; if (a.hit > 0) a.hit--; if (a.cool > 0) a.cool--;
    const ox = a.x, oy = a.y, top0 = a.y - a.h;
    const riding = a.b.solid && crab.onGround && Math.abs(crab.y - top0) < 1.5 && crab.x > a.x - a.w / 2 - 8 && crab.x < a.x + a.w / 2 + 8;
    const B = a.b, dx = crab.x - a.x, dy = (crab.y - 7) - (a.y - a.h / 2), dist = Math.hypot(dx, dy);
    if (B.mover) {
      const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * a.t / B.mover.period);
      a.x = a.hx + B.mover.dx * k; a.y = a.hy - B.mover.dy * k;
    } else if (B.chase && dist < B.chase.range && !crab.dead) {
      a.x += Math.sign(dx) * Math.min(Math.abs(dx), B.chase.speed);
      if (B.chase.fly) a.y += Math.sign(dy) * Math.min(Math.abs(dy), B.chase.speed);
      a.dir = Math.sign(dx) || a.dir;
    } else if (B.patrol) {
      a.x += a.dir * B.patrol.speed;
      const wall = solidsNear(a.x, a.w).some(r => r.who !== a && a.y > r.top + 1 && a.x + a.w / 2 > r.x0 && a.x - a.w / 2 < r.x1);
      if (Math.abs(a.x - a.hx) > B.patrol.range || wall) { a.dir *= -1; a.x = ox; }
    } else if (B.chase) {   // out of sight: drift back home
      a.x += Math.sign(a.hx - a.x) * Math.min(Math.abs(a.hx - a.x), B.chase.speed * 0.5);
      if (B.chase.fly) a.y += Math.sign(a.hy - a.y) * Math.min(Math.abs(a.hy - a.y), B.chase.speed * 0.5);
    }
    if (B.hover && !B.mover && !(B.chase && B.chase.fly)) a.y = a.hy + Math.sin(a.t * B.hover.bobSpeed) * B.hover.bob;
    if (riding) { crab.x += a.x - ox; crab.y = a.y - a.h; }   // carry whoever is standing on it
    if (B.shooter && a.cool <= 0 && dist < B.shooter.range && !crab.dead) {
      a.cool = B.shooter.every;
      const sp = B.shooter.speed, d = dist || 1;
      shots.push({ x: a.x, y: a.y - a.h / 2, vx: dx / d * sp, vy: dy / d * sp, life: 300 });
      if (sfx.charge) sfx.charge();
    }
    const box = actorBox(a);
    if (!crab.dead && overlap(cb, box)) {
      if (B.collectible) {
        a.alive = false; kills += B.collectible.score; crab.hp = Math.min(LIFE, crab.hp + B.collectible.hearts);
        splash(a.x, a.y - a.h / 2, 5, a.obj.color || CREAM); if (sfx.land) sfx.land(); continue;
      }
      if (B.bouncer && crab.vy > 0 && crab.y - crab.vy <= box.y0 + 3) { crab.vy = -B.bouncer.strength; crab.onGround = false; crab.y = box.y0; if (sfx.jump) sfx.jump(); continue; }
      if (B.touchDamage) hurtCrab(a.x);
    }
  }
  for (const s of shots) {
    s.x += s.vx; s.y += s.vy; s.life--;
    if (s.y >= GROUND) s.life = 0;
    if (!crab.dead && Math.abs(s.x - crab.x) < 7 && s.y > crab.y - 14 && s.y < crab.y) { hurtCrab(s.x); s.life = 0; }
  }
  shots = shots.filter(s => s.life > 0);
}
// the player's shots (Crab Platformer's juice drops) wear down anything that can be defeated
function juiceHitsActor(p) {
  for (const a of actors) {
    if (!a.alive || !a.b.health) continue;
    const b = actorBox(a);
    if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) {
      p.life = 0; a.hp--; a.hit = 6; splash(p.x, p.y, 2);
      if (a.hp <= 0) { a.alive = false; kills++; splash(a.x, a.y - a.h / 2, 8, a.obj.color || RED); if (sfx.melt) sfx.melt(); }
      return true;
    }
  }
  return false;
}
// drawn as its symbol, outlined in ink like the rest of the game's art; it flashes when hit
function drawActors(cx) {
  for (const a of actors) {
    if (!a.alive) continue;
    const x0 = Math.round(a.x - a.w / 2 - cx), y0 = Math.round(a.y - a.h), s = a.s, rows = a.sym, flip = a.dir < 0 && (a.b.patrol || a.b.chase);
    if (x0 > VW || x0 + a.w < 0) continue;
    const on = (r, c) => r >= 0 && r < rows.length && c >= 0 && c < rows[0].length && rows[r][flip ? rows[0].length - 1 - c : c] === '1';
    ctx.fillStyle = INK;
    for (let r = -1; r <= rows.length; r++) for (let c = -1; c <= rows[0].length; c++) if (!on(r, c) && (on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1))) ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
    ctx.fillStyle = a.hit > 0 && a.hit % 2 ? CREAM : (a.obj.color || RED);
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[0].length; c++) if (on(r, c)) ctx.fillRect(x0 + c * s, y0 + r * s, s, s);
  }
  for (const s of shots) { ctx.fillStyle = INK; ctx.fillRect(Math.round(s.x - cx) - 2, Math.round(s.y) - 2, 4, 4); ctx.fillStyle = RED; ctx.fillRect(Math.round(s.x - cx) - 1, Math.round(s.y) - 1, 2, 2); }
}
