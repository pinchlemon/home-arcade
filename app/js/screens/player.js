// The game player: runs a Studio project on a 160 x 144 pixel screen (20 x 18 tiles of 8 x 8).
import { bitmapCanvas, drawText, drawRows, present, PALETTE, textWidth, well, icon } from '../pixel.js';
import { flatten } from '../store.js';
import * as input from '../input.js';
import * as snd from '../sound.js';
import { A, iconBtn, esc } from '../ui.js';

const W = 160, H = 144, T = 8, GRAV = 0.22, MAXFALL = 4;
const HEART = ['01010', '11111', '01110', '00100'];
const col = (c) => PALETTE[c] || c || '#ffffff';

class Game {
  constructor(project, startScene) {
    this.p = project;
    this.order = flatten(project.scenes).filter(id => project.sceneData[id]);
    this.score = 0; this.lives = 3; this.state = 'card'; this.timer = 0;
    this.load(startScene && this.order.includes(startScene) ? startScene : this.order[0], true);
  }
  asset(id) { return this.p.assets[id] || null; }
  load(id, fresh) {
    this.sceneId = id; const sd = this.p.sceneData[id];
    this.sd = sd; this.tw = sd.w; this.th = sd.h;
    this.tiles = sd.tiles;
    this.ents = []; this.player = null; this.frame = 0;
    for (const o of sd.objects) {
      const a = this.asset(o.sprite); if (!a) continue;
      const e = { o, a, role: a.role, x: o.x * T + 1, y: o.y * T, w: 6, h: 8, vx: 0, vy: 0, dir: 1, sx: o.x * T + 1, sy: o.y * T, props: o.props || {}, alive: true, contact: false, ground: false };
      if (a.role === 'pickup') { e.x = o.x * T + 1; e.y = o.y * T + 1; e.h = 6; }
      if (a.role === 'player' && !this.player) { this.player = e; continue; }
      if (a.role !== 'player') this.ents.push(e);
    }
    if (!this.player) this.player = { a: { px: ['00111100','00111100','00011000','01111110','00011000','00011000','00100100','01000010'], color: 'white' }, role: 'player', x: 9, y: 0, w: 6, h: 8, vx: 0, vy: 0, dir: 1, sx: 9, sy: 0, props: { speed: 6, jump: 4, lives: 3 }, alive: true };
    const pl = this.player;
    if (fresh) this.lives = pl.props.lives || 3;
    pl.inv = 0; pl.coyote = 0; pl.buffer = 0; pl.climb = false;
    this.sceneScore = this.score;
    this.state = 'card'; this.timer = 70; this.cardText = sd.name || 'Scene';
    this.camX = 0; this.camY = 0; this.follow(true);
    this.fire('game', 'start', null);
  }
  tile(tx, ty) { if (tx < 0 || tx >= this.tw) return { solid: true }; const id = this.tiles[tx + ',' + ty]; return id ? this.asset(id) : null; }
  solidAt(px, py) { const t = this.tile(Math.floor(px / T), Math.floor(py / T)); return !!(t && t.solid); }

  // ---- events: WHEN rules lead through cables to DO actions
  fire(who, ev, it) {
    const ws = this.p.events.when.filter(w => w.who === who && w.ev === ev);
    if (!ws.length) return false;
    for (const w of ws) for (const c of this.p.events.cables) if (c[0] === w.id) { const d = this.p.events.do.find(x => x.id === c[1]); if (d) this.act(d, it); }
    return true;
  }
  act(d, it) {
    const pl = this.player;
    if (d.tgt === 'it' && it && it !== pl) { if (d.act === 'remove') it.alive = false; if (d.act === 'turn') it.dir *= -1; }
    else if (d.tgt === 'player') { if (d.act === 'hurt') this.hurt(); if (d.act === 'bounce') pl.vy = -this.jumpV() * 0.75; if (d.act === 'respawn') this.respawn(); }
    else if (d.tgt === 'score') this.score += { add10: 10, add50: 50, add100: 100 }[d.act] || 0;
    else if (d.tgt === 'game') { if (d.act === 'next') this.next(); if (d.act === 'restart') this.restart(); if (d.act === 'win') this.win(); }
    else if (d.tgt === 'sound') snd.play(this.asset(d.act));
  }
  jumpV() { return Math.sqrt(2 * GRAV * ((this.player.props.jump || 4) * T + 3)); }
  hurt() {
    const pl = this.player;
    if (pl.inv > 0 || this.state !== 'play') return;
    this.lives--; input.rumble(160, 0.8);
    if (this.lives <= 0) { this.state = 'over'; this.timer = 30; return; }
    this.respawn(); pl.inv = 90;
  }
  respawn() { const pl = this.player; pl.x = pl.sx; pl.y = pl.sy; pl.vx = pl.vy = 0; pl.climb = false; }
  next() { const i = this.order.indexOf(this.sceneId); if (i >= 0 && i < this.order.length - 1) this.load(this.order[i + 1], false); else this.win(); }
  restart() { this.score = this.sceneScore; this.load(this.sceneId, false); }
  win() { this.state = 'won'; this.timer = 30; }

  // ---- movement with tile collision
  moveX(e, dx) {
    e.x += dx; e.hitWall = false;
    const top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 1) / T);
    if (dx > 0) { const tx = Math.floor((e.x + e.w - 1) / T); for (let ty = top; ty <= bot; ty++) { const t = this.tile(tx, ty); if (t && t.solid) { e.x = tx * T - e.w; e.hitWall = true; break; } } }
    else if (dx < 0) { const tx = Math.floor(e.x / T); for (let ty = top; ty <= bot; ty++) { const t = this.tile(tx, ty); if (t && t.solid) { e.x = (tx + 1) * T; e.hitWall = true; break; } } }
  }
  moveY(e, dy, dropThrough) {
    const prevBot = e.y + e.h;
    e.y += dy; e.ground = false;
    const l = Math.floor(e.x / T), r = Math.floor((e.x + e.w - 1) / T);
    if (dy > 0) {
      const ty = Math.floor((e.y + e.h - 1) / T);
      for (let tx = l; tx <= r; tx++) {
        const t = this.tile(tx, ty); if (!t) continue;
        const ladderTop = t.climb && !(this.tile(tx, ty - 1) || {}).climb;
        if (t.solid || ((t.oneway || ladderTop) && !dropThrough && prevBot <= ty * T + 0.01)) { e.y = ty * T - e.h; e.vy = 0; e.ground = true; break; }
      }
    } else if (dy < 0) {
      const ty = Math.floor(e.y / T);
      for (let tx = l; tx <= r; tx++) { const t = this.tile(tx, ty); if (t && t.solid) { e.y = (ty + 1) * T; e.vy = 0; break; } }
    }
  }
  overlapTile(e, key, shrink = 1) {
    for (let ty = Math.floor((e.y + shrink) / T); ty <= Math.floor((e.y + e.h - 1 - shrink) / T); ty++)
      for (let tx = Math.floor((e.x + shrink) / T); tx <= Math.floor((e.x + e.w - 1 - shrink) / T); tx++) { const t = this.tile(tx, ty); if (t && t[key]) return true; }
    return false;
  }

  step() {
    this.frame++;
    if (this.state === 'card') { if (--this.timer <= 0) this.state = 'play'; return; }
    if (this.state === 'over' || this.state === 'won') { if (this.timer > 0) this.timer--; else if (input.pressed('a') || input.pressed('start')) this.reset(); return; }
    if (this.state === 'paused') return;
    const pl = this.player, pr = pl.props, speed = 0.5 + (pr.speed || 6) * 0.12;
    const L = input.isHeld('left'), R = input.isHeld('right'), U = input.isHeld('up'), D = input.isHeld('down');
    if (input.pressed('a')) { pl.buffer = 7; this.fire(pl.o ? pl.o.sprite : '', 'pressA', pl); }
    if (input.pressed('b') && this.p) { /* B is free for games to use later */ }

    // ladders
    const onLadder = this.overlapTile(pl, 'climb', 2);
    const ladderBelow = (this.tile(Math.floor((pl.x + 3) / T), Math.floor((pl.y + pl.h + 1) / T)) || {}).climb;
    if (!pl.climb && ((U && onLadder) || (D && ladderBelow && pl.ground))) { pl.climb = true; pl.x = Math.floor((pl.x + 3) / T) * T + 1; }
    if (pl.climb) {
      pl.vy = U ? -1 : D ? 1 : 0; pl.vx = (R - L) * 0.6;
      this.moveX(pl, pl.vx); this.moveY(pl, pl.vy, true);
      if (!this.overlapTile(pl, 'climb', 1) || pl.buffer > 0) { pl.climb = false; if (pl.buffer > 0) { pl.vy = -this.jumpV() * 0.8; pl.buffer = 0; } }
    } else {
      const target = (R - L) * speed;
      pl.vx += (target - pl.vx) * (pl.ground ? 0.35 : 0.2);
      if (R && !L) pl.dir = 1; if (L && !R) pl.dir = -1;
      pl.coyote = pl.ground ? 6 : Math.max(0, pl.coyote - 1);
      if (pl.buffer > 0 && pl.coyote > 0) { pl.vy = -this.jumpV(); pl.coyote = 0; pl.buffer = 0; }
      if (!input.isHeld('a') && pl.vy < -1.5) pl.vy *= 0.6;
      pl.vy = Math.min(MAXFALL, pl.vy + GRAV);
      this.moveX(pl, pl.vx);
      this.moveY(pl, pl.vy, D && pl.ground);
    }
    if (pl.buffer > 0) pl.buffer--;
    if (pl.inv > 0) pl.inv--;
    if (this.overlapTile(pl, 'hurts', 2)) this.hurt();
    if (pl.y > this.th * T + 24) { if (!this.fire(pl.o ? pl.o.sprite : '', 'falls', pl)) this.hurt(); if (pl.y > this.th * T + 24) this.respawn(); }

    // other things
    for (const e of this.ents) {
      if (!e.alive) continue;
      const sp = e.props.speed == null ? 3 : e.props.speed;
      if (e.role === 'walker') {
        e.vx = e.dir * sp * 0.16; e.vy = Math.min(MAXFALL, e.vy + GRAV);
        this.moveX(e, e.vx); this.moveY(e, e.vy, false);
        const ahead = e.dir > 0 ? e.x + e.w + 1 : e.x - 1, groundAhead = this.tile(Math.floor(ahead / T), Math.floor((e.y + e.h + 1) / T));
        const edge = e.props.edges !== false && e.ground && !(groundAhead && (groundAhead.solid || groundAhead.oneway));
        if (e.hitWall || edge || Math.abs(e.x - e.sx) > (e.props.patrol || 4) * T) { e.dir *= -1; e.x += e.dir; }
      } else if (e.role === 'flyer') {
        e.x += e.dir * sp * 0.14;
        if (Math.abs(e.x - e.sx) > (e.props.patrol || 5) * T) e.dir *= -1;
        e.y = e.sy + Math.sin(this.frame * 0.04 * Math.max(1, sp)) * 6;
      }
      const hit = pl.x < e.x + e.w && pl.x + pl.w > e.x && pl.y < e.y + e.h && pl.y + pl.h > e.y;
      if (hit && !e.contact) {
        e.contact = true;
        const stomp = pl.vy > 0 && pl.y + pl.h - pl.vy <= e.y + 3 && (e.role === 'walker' || e.role === 'flyer');
        if (!(stomp && this.fire(e.o.sprite, 'stomp', e))) this.fire(e.o.sprite, 'touch', e);
      } else if (!hit) e.contact = false;
    }
    this.ents = this.ents.filter(e => e.alive);
    if (this.frame % 60 === 0) this.fire('game', 'second', null);
    this.follow(false);
  }
  follow(snap) {
    const pl = this.player;
    const tx = Math.max(0, Math.min(this.tw * T - W, pl.x + 3 - W / 2)), ty = Math.max(0, Math.min(this.th * T - H, pl.y + 4 - H / 2));
    this.camX = snap ? tx : this.camX + (tx - this.camX) * 0.2; this.camY = snap ? ty : this.camY + (ty - this.camY) * 0.2;
  }
  reset() { this.score = 0; this.load(this.order[0], true); }

  draw(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const cx = Math.round(this.camX), cy = Math.round(this.camY);
    const x0 = Math.floor(cx / T), y0 = Math.floor(cy / T);
    for (let ty = y0; ty <= y0 + 18; ty++) for (let tx = x0; tx <= x0 + 20; tx++) {
      const id = this.tiles[tx + ',' + ty]; if (!id) continue; const a = this.asset(id); if (!a) continue;
      ctx.drawImage(bitmapCanvas(a.px, col(a.color)), tx * T - cx, ty * T - cy);
    }
    for (const e of this.ents) {
      const flip = e.role === 'walker' || e.role === 'flyer' ? e.dir < 0 : false;
      ctx.drawImage(bitmapCanvas(e.a.px, col(e.a.color), flip), Math.round(e.x - 1 - cx), Math.round(e.y - (e.role === 'pickup' ? 1 : 0) - cy));
    }
    const pl = this.player;
    if (!(pl.inv > 0 && (this.frame >> 2) % 2)) ctx.drawImage(bitmapCanvas(pl.a.px, col(pl.a.color), pl.dir < 0), Math.round(pl.x - 1 - cx), Math.round(pl.y - cy));
    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, 9);
    drawText(ctx, 'SCORE ' + String(this.score).padStart(4, '0'), 2, 2, '#e4e2dc');
    for (let i = 0; i < this.lives; i++) drawRows(ctx, HEART, W - 7 - i * 7, 2, '#ff5a1f');
    const centre = (s, y, c) => drawText(ctx, s, Math.round((W - textWidth(s)) / 2), y, c);
    if (this.state === 'card') { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 60, W, 22); centre(this.cardText, 68, '#7dff6a'); }
    if (this.state === 'paused') { ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 54, W, 34); centre('PAUSED', 60, '#ffffff'); centre('START TO GO ON', 74, '#8f8d88'); }
    if (this.state === 'over' || this.state === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 46, W, 50);
      centre(this.state === 'won' ? 'YOU WIN!' : 'GAME OVER', 54, this.state === 'won' ? '#7dff6a' : '#ff5a1f');
      centre('SCORE ' + this.score, 66, '#e4e2dc');
      if (this.timer <= 0) centre('PRESS ' + input.label('a') + ' TO PLAY AGAIN', 80, '#8f8d88');
    }
  }
}

export function openPlayer(app, project, sceneId, returnTo) {
  const game = new Game(project, sceneId);
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const octx = off.getContext('2d');
  let view = null, acc = 0, last = 0;
  const quit = () => { for (const k in input.touch) input.touch[k] = false; ov.onClose(); app.overlay = returnTo || null; app.refreshProjects(); app.render(); };
  const ov = {
    game,
    render() {
      const pad = input.padConnected();
      const pb = (k, ic, label) => `<button class="pbtn" data-k="${k}" aria-label="${label}">${well(40, icon(ic, '#e4e2dc'))}</button>`;
      return `<div class="player" style="--acc:#7dff6a">
        <div class="topbar">
          ${iconBtn('back', A(quit), { color: '#fff', label: 'Quit' })}
          <span class="cap" style="color:var(--muted)">${esc(project.name)}</span>
          ${iconBtn('pause', A(() => { game.state = game.state === 'paused' ? 'play' : (game.state === 'play' ? 'paused' : game.state); }), { label: 'Pause' })}
        </div>
        <div class="screen" style="padding:0;border-radius:14px"><canvas class="pix" id="gview"></canvas></div>
        <div class="pad" ${pad ? 'style="opacity:.25"' : ''}>
          <div class="dpad">
            <span></span>${pb('up', 'up', 'Up')}<span></span>
            ${pb('left', 'left', 'Left')}<span></span>${pb('right', 'right', 'Right')}
            <span></span>${pb('down', 'down', 'Down')}<span></span>
          </div>
          <div class="abtns">${pb('b', 'back', 'B')}${pb('a', 'up', 'Jump')}</div>
        </div>
      </div>`;
    },
    mount(root) {
      view = root.querySelector('#gview');
      const fit = () => {
        const dpr = window.devicePixelRatio || 1, land = innerWidth > innerHeight && innerHeight < 500;
        const maxW = innerWidth - (land ? 40 : 24), maxH = innerHeight - (land ? 40 : 300);
        const s = Math.max(1, Math.floor(Math.min(maxW / W, maxH / H) * dpr)) / dpr;
        view.style.width = W * s + 'px'; view.style.height = H * s + 'px';
        view.width = Math.round(W * s * dpr); view.height = Math.round(H * s * dpr);
      };
      fit(); ov._fit = fit; addEventListener('resize', fit);
      root.querySelectorAll('.pbtn').forEach(b => {
        const k = b.dataset.k;
        const on = (e) => { e.preventDefault(); input.touch[k] = true; snd.unlock(); };
        const off2 = (e) => { e.preventDefault(); input.touch[k] = false; };
        b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off2); b.addEventListener('pointercancel', off2); b.addEventListener('pointerleave', off2);
      });
    },
    onClose() { removeEventListener('resize', ov._fit); },
    frame(t) {
      if (!view) return;
      if (input.pressed('start')) game.state = game.state === 'paused' ? 'play' : (game.state === 'play' ? 'paused' : game.state);
      if (game.state === 'paused' && input.pressed('b')) { quit(); return; }
      const dt = last ? Math.min(0.1, t - last) : 1 / 60; last = t; acc += dt;
      let n = 0;
      while (acc >= 1 / 60 && n < 4) { game.step(); acc -= 1 / 60; n++; if (n > 1) input.poll(); }
      game.draw(octx);
      present(off, view, W, H);
    }
  };
  app.open(ov);
  return game;
}
export { Game };
