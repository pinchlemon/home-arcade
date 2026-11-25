// Lab shelf: Ball play. Sports-game throwing and catching.
//   Buttons: SPORTS gives the controller its own layout: Square throws (and catches), holding L1 throws it higher and
//     holding R1 lower; Circle dives, R2 runs, L2 tackles; X does nothing unless Jump is on (then it jumps).
//   Hold to throw: how long you hold the throw sets only how fast it leaves your hand (so how far it goes); the arc is
//     set apart from that: normal, higher with L1, lower with R1 (Sports buttons). A tap with R1 barely goes anywhere.
//   Switch on throw: after a throw you take over whoever is nearest where it comes down (you stay if that's you).
//   Perfect catch: press catch just as the Solid arrives for extra resonance. With Sports buttons, a perfect catch with
//     R1 held, once the Solid has enough resonance, shoots at the demon at once: a one-timer, scored as an alley-oop.
//   Catch ring: a ring on the ground where the Solid will come down, closing as it arrives (it flashes in the perfect window),
//     drawn over the grass. Size, thickness, brightness, colour, a fill that grows as it arrives, a drop line from the
//     Solid down to it, and ticks that speed up (through the Sound shelf's LAB.sfx).
//   Fire aura: the Solid burns brighter as resonance builds: light, orbiting sparks, a flame aura, embers at the top.
// Nothing here runs or is made until one of these is switched on (new three.js objects use Math.random).
LAB.shelf('ball', 'Ball play', (game) => {
  const T = game.THREE, FX = window.FEATURES, o = game.orb;
  const get = (id, n) => LAB.get('ball.' + id) ?? n;
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const v1c = new T.Color(), v1 = new T.Vector3(), v2 = new T.Vector3(), at = new T.Vector3(), WHITE = new T.Color(1, 1, 1);

  // ---- buttons
  const prev = {};
  const btn = (gp, i) => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
  const sports = () => get('buttons', 0) === 1 && !game.DUEL;
  const modOf = (W) => { const hi = LAB.btn(W, 'higher', 4), lo = !get('lock', 0) && LAB.btn(W, 'lower', 5); return hi === lo ? 0 : hi ? 1 : -1; };   // L1 higher, R1 lower (R1 locks on instead, with Lock-on)
  const stickY = (W) => { const a = (W.gp && W.gp.axes[1]) || 0; return Math.abs(a) < 0.15 ? 0 : -(a - Math.sign(a) * 0.15) / 0.85; };   // + up
  function readButtons() {   // Square: the game's throw-and-catch button, pressed and let go
    for (const W of game.ALL) {
      const gp = W.human && W.gp; if (!gp) continue;
      const now = LAB.btn(W, 'throw', 2), was = !!prev[gp.index]; prev[gp.index] = now;
      const C = W.ctl;
      if (game.blockPad) { if (W.labBtn) { C.castHeld = false; W.labBtn = null; } continue; }
      const holding = o.state === 'held' && o.holder === W;
      if (W.labMadden) { if (W.labBtn) { C.castHeld = false; W.labBtn = null; } W.labAiming = false; continue; }   // Madden passing has the face buttons while you hold it
      if (now && !was && W.labAiming) { W.charge = W.labFire = shooting(W) ? W.labShoot || 0 : W.labPower; W.labAiming = false; C.castHeld = false; W.labBtn = null; }   // second tap throws
      else if (now && !was && !C.castHeld) {
        W.labBtn = 'throw'; C.castHeld = true; C.castPressed = true;
        if (holding && get('power', 0)) { W.labAiming = true; W.labPower = lastPower; W.labBtn = 'aim'; }   // Distance: RIGHT STICK, the first tap starts aiming
      }
      // still holding Square from the catch: aim from here, so the triggers (or right stick) set the distance
      if (now && was && holding && W.labBtn === 'throw' && !W.labAiming && get('power', 0)) { W.labAiming = true; W.labPower = lastPower; W.labBtn = 'aim'; C.castHeld = true; C.castPressed = true; }
      if (!now && was && W.labBtn === 'throw') { C.castHeld = false; W.labBtn = null; }
      else if (!now && was && W.labAiming && get('power', 0) === 2) { W.charge = W.labFire = shooting(W) ? W.labShoot || 0 : W.labPower; W.labAiming = false; C.castHeld = false; W.labBtn = null; }   // TRIGGERS: letting go of Square throws
    }
  }
  let hintWas = null;
  function hint(v) {   // the controller help line under the game says what the buttons do now
    const h = document.getElementById('hint'); if (!h || !/^Stick move/.test(h.textContent)) return;
    if (hintWas != null) { h.textContent = hintWas; hintWas = null; }
    if (!v) return;
    hintWas = h.textContent;
    let t = hintWas.replace('R1 run', 'R2 run').replace('L1 tackle', 'L2 tackle')
      .replace('Square catch / hold to throw', 'Square catch / throw (hold: farther; with L1: higher, R1: lower)');
    if (!get('jump', 0)) t = t.replace('Cross jump · ', '');
    h.textContent = t;
  }
  function buttons() {
    const v = sports();
    // the game stops seeing Square (this shelf reads it), L2 and R2; its tackle is read from L2 and its run from R2,
    // which leaves L1 and R1 free to shape the throw. X only jumps when Jump is on.
    LAB.skip('ball', v ? (get('jump', 0) ? [2, 6, 7] : [0, 2, 6, 7]) : null);
    game.padAlias = v ? { 4: 6, 5: 7 } : null;
    hint(v);
    if (!v) for (const W of game.ALL) { if (W.labBtn) { W.ctl.castHeld = false; W.labBtn = null; } }
  }

  // ---- hold to throw: speed from the hold, arc from the shoulder buttons
  function launch(W, c) {   // how a throw would leave the hand now: speed from the hold, angle from the shoulder buttons
    const S = game.solid, by = sports() ? get('arcBy', 0) : 0;
    let mod = sports() ? modOf(W) : 0, deg;
    if (by) {   // Arc by STICK: the left stick's up and down set the arc smoothly, low line to high lob
      const y = stickY(W) * (by === 2 ? -1 : 1), A = get('arc', 38);
      deg = y >= 0 ? A + (get('high', 62) - A) * y : A + (A - get('low', 14)) * y; mod = y > 0.5 ? 1 : y < -0.5 ? -1 : 0;
    } else deg = mod > 0 ? get('high', 62) : mod < 0 ? get('low', 14) : get('arc', 38);
    const a = deg * Math.PI / 180;
    const tap = get('tap', 12), sp = (tap + (get('full', 22) - tap) * c) * (W.stThrow || 1) * Math.sqrt(S.grav * S.range);   // every solid goes about as far
    return { dx: Math.sin(W.yaw), dz: Math.cos(W.yaw), vh: sp * Math.cos(a), vy: sp * Math.sin(a), mod };
  }
  function holdThrow(W) {
    const c = W.labFire != null ? W.labFire : W.charge, L = launch(W, c); W.labFire = null;
    game.throwOrb(W, c, L.dx, L.dz, L.vh, L.vy, true);
    if (shooting(W)) { straightShot(W, c); W.labR1 = false; FX.emit('holdThrow', W, c, -1); return; }
    if (L.mod < 0 && c >= 0.6) o.fast = true;   // a hard low throw is a shot: it streaks and hits harder
    const r1 = L.mod < 0 || W.labR1; W.labR1 = false;   // R1 counts if it was pressed at any point in the wind-up
    if (get('super', 0) && (r1 || get('superHow', 0) === 1) && c >= get('superPower', 0.75) && o.res >= get('superRes', 4)) superShot(W);
    FX.emit('holdThrow', W, c, L.mod);
  }

  // ---- super shot: a full low throw at full resonance. Faster, it bends onto the centipede, hits much harder, and bursts
  let superHit = false;
  function superShot(W, keepDir) {
    o.labSuper = true; o.labMul = get('superDmg', 2.5); o.fast = true;
    if (keepDir) { o.v.multiplyScalar(Math.max(1, 26 / (o.v.length() || 1))); game.popup('SUPER SHOT!', W.pos, '#ffd36a', true); game.shake(0.25); game.rumble(W, 0.5, 1, 260);
      game.fxRing(W.pos.x, W.pos.z, game.solid.col, 4.5, 0.45); game.sparkBurst(o.p, 30, 6, 0.9); return; }
    // it flies flat and fast whatever arc was aimed: straight at the head when that's roughly ahead, otherwise forward
    const sp = Math.max(26, o.v.length() * 1.4), d = game.demon, fx = Math.sin(W.yaw), fz = Math.cos(W.yaw);
    let dir = v1.set(fx, 0.1, fz);
    if (d.alive && !d.dying) { game.headCenter(aim); v2.copy(aim).sub(o.p); const h = Math.hypot(v2.x, v2.z) || 1; if ((v2.x * fx + v2.z * fz) / h > 0.35) dir = v2; }
    o.v.copy(dir.normalize()).multiplyScalar(sp);
    const col = game.solid.col;
    game.popup('SUPER SHOT!', W.pos, '#ffd36a', true); game.shake(0.25); game.rumble(W, 0.5, 1, 260);
    game.fxRing(W.pos.x, W.pos.z, col, 4.5, 0.45); game.fxRing(W.pos.x, W.pos.z, 0xffffff, 2.6, 0.3, 0.05); game.sparkBurst(o.p, 30, 6, 0.9);
  }
  const aim = new T.Vector3();
  LAB.superShot = superShot;   // Madden passing's shot
  function superFly(dt) {
    if (o.state !== 'air' || o.touched || superHit) { o.labSuper = false; o.labMul = undefined; superHit = false; return; }
    const d = game.demon, sp = o.v.length();
    if (d.alive && !d.dying) {   // bend toward the head when it's roughly ahead
      game.headCenter(aim); aim.sub(o.p); const dist = aim.length() || 1; aim.divideScalar(dist);
      if (aim.dot(v1.copy(o.v).divideScalar(sp || 1)) > 0.5) { v1.lerp(aim, Math.min(1, dt * 5)).normalize(); o.v.copy(v1).multiplyScalar(sp); }
    }
    for (let i = 0; i < 4; i++) {   // a comet tail
      v2.copy(o.v).multiplyScalar(-0.12 - Math.random() * 0.1); v2.x += (Math.random() - 0.5) * 1.5; v2.y += (Math.random() - 0.5) * 1.5; v2.z += (Math.random() - 0.5) * 1.5;
      game.spark(o.p, v2, 0.35 + Math.random() * 0.25, 0.8 + Math.random() * 0.6, i % 2 ? game.solid.col : 0xffffff, 2);
    }
  }
  FX.on('demonHit', () => {
    if (!o.labSuper || superHit) return;
    superHit = true; const col = game.solid.col; at.copy(o.p);
    game.fxSphere(at, 0xffffff, 3.2, 0.35); game.fxSphere(at, col, 5.5, 0.6);
    game.fxRing(at.x, at.z, col, 7, 0.6); game.fxRing(at.x, at.z, 0xffffff, 4.5, 0.45, 0.06); game.fxPillar(at.x, at.z, col, 10, 1.3, 0.7);
    game.fxBurst(at, col, 60, 14); game.shake(0.5); game.popup('SUPER!', at, '#ffffff', true);
  }, 'lab');

  // ---- shoot mode (Idea 8): locked onto an enemy (hold R1, or a tap lock when Shoot on tap is on), Square builds up the shot
  // instead of setting distance: the Solid swells and burns brighter, and when it's full it's a super shot. It flies straight.
  const shooting = (W) => !!(get('shoot', 1) && get('lock', 0) && sports() && W === game.you && lock === 'demon' && (held || get('lock', 0) === 2 || get('shootTap', 1)));
  let readyFor = null, straight = false, straightT = 0;
  FX.on('demonHit', () => { straight = false; }, 'lab');   // it bounces off like any throw, and falls again
  function shootTick(dt) {
    const W = game.you; if (!W) return;
    if (!W.charging || !shooting(W)) { W.labShoot = 0; readyFor = null; return; }
    W.labShoot = Math.min(1, (W.labShoot || 0) + dt / get('shootTime', 1.2)); W.charge = W.labShoot;
    const S = game.solid, k = W.labShoot;
    game.orbMesh.scale.multiplyScalar(1 + k * 0.5);   // swells as it builds (on top of the game's own charge swell)
    if (k >= 1) {   // full: a white-hot pulse, and once, a flash and READY
      const pl = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 18);
      S.coreMat.color.copy(WHITE); S.lineMat.color.lerp(WHITE, 0.6 + pl * 0.4); S.fillMat.opacity = Math.min(0.9, S.fillMat.opacity + 0.15 + pl * 0.2); game.orbLight.intensity += 2 + pl * 2;
      if (readyFor !== W) { readyFor = W; game.popup('READY', W.pos, '#ffd36a'); game.fxRing(o.p.x, o.p.z, 0xffffff, 2.2, 0.3, 0.05); game.sparkBurst(o.p, 18, 3, 0.7); }
    } else game.orbLight.intensity += k * 1.5;
  }
  function straightShot(W, c) {
    const d = game.demon; if (!d.alive || d.dying) return;
    game.headCenter(aim); v2.copy(aim).sub(o.p).normalize();
    const lo = get('shootSlow', 16), sp = lo + (get('shootFast', 30) - lo) * c;
    o.v.copy(v2).multiplyScalar(sp); o.fast = c >= 0.5; straight = true; straightT = 0; o.labShot = true;
    if (c >= 1) superShot(W, true);
  }
  function straightFly(dt) {   // no drop: undo gravity, and keep it on the head
    straightT += dt;
    if (o.state !== 'air' || o.touched || straightT > 3) { straight = false; return; }
    o.v.y += game.G * game.solid.grav * dt;
    const d = game.demon; if (!d.alive || d.dying || o.labSuper) return;
    const sp = o.v.length(); game.headCenter(aim); aim.sub(o.p).normalize();
    if (aim.dot(v1.copy(o.v).divideScalar(sp || 1)) > 0.5) { v1.lerp(aim, Math.min(1, dt * 4)).normalize(); o.v.copy(v1).multiplyScalar(sp); }
  }

  // ---- flight arc: a dotted line showing where the throw will go, while you hold it
  let dots = null, march = 0;
  const dc = new T.Color();
  function makeDots() {   // plain meshes (the PS1 shelf's vertex snap doesn't know instanced ones)
    const geo = new T.IcosahedronGeometry(0.15, 0); dots = [];
    for (let i = 0; i < 60; i++) { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.frustumCulled = false; game.scene.add(m); dots.push(m); }
  }
  function preview(dt) {
    const W = game.you;
    const show = get('path', 0) && get('slider', 0) && !game.DUEL && !shooting(W) && W.charging && o.state === 'held' && o.holder === W && W.crouchK <= 0.5;
    if (!show) { if (dots) for (const d of dots) d.visible = false; return; }
    if (!dots) makeDots();
    const L = launch(W, W.labAiming ? W.labPower : W.charge), g = game.G * game.solid.grav, gap = 0.6, col = game.solid.color, h = 1 / 120;
    march = (march + dt * 1.4) % gap;   // the dots creep forward along the path
    sim.copy(o.p); simV.set(L.dx * L.vh, L.vy, L.dz * L.vh);
    let n = 0, acc = gap - march;
    for (let i = 0; i < 900 && n < dots.length; i++) {
      v2.copy(sim); simV.y -= g * h; sim.addScaledVector(simV, h); acc += sim.distanceTo(v2);
      const down = sim.y < 0.08;
      if (acc >= gap || down) { acc = 0; const d = dots[n]; d.visible = true; d.scale.setScalar(down ? 2 : 1); d.position.set(sim.x, Math.max(sim.y, 0.06), sim.z); n++; }
      if (down) break;
    }
    for (let i = 0; i < dots.length; i++) { if (i >= n) { dots[i].visible = false; continue; }
      dots[i].material.color.copy(col).lerp(WHITE, 0.6).multiplyScalar(1 - 0.45 * i / n); }   // fades toward the far end
  }
  function throwHook(W) {
    if (game.DUEL || W.crouchK > 0.5 || !get('slider', 0)) return false;   // crouched throws still bowl
    holdThrow(W); return true;
  }
  const hook = () => { game.throwHook = get('slider', 0) ? throwHook : null; };

  // ---- Distance: RIGHT STICK or TRIGGERS. While aiming, up and down on the right stick (the camera stops zooming), or RT
  // farther and LT shorter (run and tackle wait until you let go), set how far it goes; it remembers the last distance.
  let lastPower = 0.5, skipTrig = false;
  const trig = (gp, i) => { const b = gp && gp.buttons[i]; return b ? Math.max(b.value || 0, b.pressed ? 1 : 0) : 0; };
  function aimPower(dt) {
    const mode = get('power', 0); let needSkip = false;
    for (const W of game.ALL) {
      if (mode === 2 && W.human && W.gp && (W.labAiming || (skipTrig && (trig(W.gp, 6) > 0.1 || trig(W.gp, 7) > 0.1)))) needSkip = true;
      if (!W.labAiming) continue;
      W.labAimStick = mode === 1;
      const holding = o.state === 'held' && o.holder === W;
      if (!W.human || !holding || (!W.charging && !W.ctl.castPressed) || game.blockPad) { W.labAiming = false; W.ctl.castHeld = false; W.labBtn = null; continue; }
      if (shooting(W)) continue;   // shoot mode: the hold builds the shot, the triggers wait
      let push = 0;
      if (mode === 2) push = trig(W.gp, 7) - trig(W.gp, 6);   // RT farther, LT shorter, by how hard they're pressed
      else { const a = (W.gp && W.gp.axes[3]) || 0; push = -(Math.abs(a) < 0.2 ? 0 : (a - Math.sign(a) * 0.2) / 0.8); }   // stick up is farther
      W.labPower = lastPower = Math.min(1, Math.max(0, W.labPower + push * dt * 0.9));
      W.charge = W.labPower;
    }
    if (needSkip !== skipTrig) { skipTrig = needSkip; LAB.skip('aimtrig', needSkip ? [4, 5] : null); }   // the game's tackle and run (read from LT and RT)
  }

  // ---- X cancels a throw you're winding up or aiming: you keep the Solid, and its shape doesn't change
  let circleWas = {}, skipCircle = false;
  function cancelCheck() {
    let need = false;
    for (const W of game.ALL) {
      if (!W.human || !W.gp) continue;
      const i = W.gp.index, now = LAB.btn(W, 'cancel', 0), was = !!circleWas[i]; circleWas[i] = now;
      if (W.charging && now && !was && !game.blockPad) {
        W.charging = false; W.charge = 0; W.labAiming = false; W.labR1 = false; W.labBtn = null; W.ctl.castHeld = false; W.ctl.castPressed = false;
        game.popup('CANCEL', W.pos, '#9aa4b8'); FX.emit('throwCancel', W);
      }
      if (W.charging || (now && (was || skipCircle))) need = true;   // keep X from the game until it's let go, so you don't jump
    }
    if (need !== skipCircle) { skipCircle = need; LAB.skip('cancel', need ? [0] : null); }
  }

  // ---- aiming while you wind up: turn toward the stick at a limited speed (a light push turns slowly), let go to hold the aim
  function aimTurn(W, ix, iz, il, dt) {
    W.aimMove = get('arcBy', 0) && sports() ? 0 : get('aimMove', 1);
    if (!W.human) return null;
    if (lock && W === game.you && lockPos(lock, at)) {   // locked on: face the target
      let d = Math.atan2(at.x - W.pos.x, at.z - W.pos.z) - W.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      return W.yaw + d * Math.min(1, dt * 14);
    }
    if (get('arcBy', 0) && sports()) {   // the stick's up-down is the arc: only its left-right turns (right turns you right)
      const x = (W.gp && W.gp.axes[0]) || 0, xx = Math.abs(x) < 0.15 ? 0 : (x - Math.sign(x) * 0.15) / 0.85;
      return W.yaw - xx * Math.abs(xx) * (get('aim', 0) || 120) * Math.PI / 180 * dt;
    }
    if (!get('aim', 0)) return null;
    const dead = 0.12; if (il < dead) return W.yaw;
    let d = Math.atan2(ix, iz) - W.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    const rate = get('aim', 0) * Math.PI / 180 * Math.pow(Math.min(1, (il - dead) / (1 - dead)), 1.3);
    return W.yaw + Math.sign(d) * Math.min(Math.abs(d), rate * dt);
  }
  const aimOn = () => { game.aimHook = get('aim', 0) || get('arcBy', 0) || get('lock', 0) ? aimTurn : null; if (!game.aimHook) for (const W of game.ALL) W.aimMove = undefined; };

  // ---- lock-on: R1 picks what you're facing (the centipede or a teammate), the right stick flicks to the next one left
  // or right, the camera keeps you both in view, a little triangle bobs over the target, and you aim at it while winding up
  let lockWas = null, lockHas = false;
  let lock = null, lockK = 0, r1Was = false, flick = 0, marker = null, bob = 0, r1T = 0, held = false, before = null;
  const superLock = () => lock === 'demon' && (held || get('lock', 0) === 2);   // the super shot: only while R1 is held on the centipede
  const lockPos = (L, out) => {   // where the target is (the demon's head, or a wizard's chest); false when it's gone
    if (L === 'demon') { const d = game.demon; if (!d.alive || d.dying) return false; game.headCenter(out); return true; }
    if (!game.ALL.includes(L) || L === game.you) return false; out.set(L.pos.x, (L.y || 0) + 1, L.pos.z); return true;
  };
  function targets() { const list = []; const d = game.demon; if (d.alive && !d.dying) list.push('demon'); for (const W of game.ALL) if (W !== game.you) list.push(W); return list; }
  function pickFacing() {   // the target nearest to where you face; the centipede counts a little nearer than it is
    const me = game.you, fx = Math.sin(me.yaw), fz = Math.cos(me.yaw); let best = null, bs = -9;
    for (const L of targets()) { if (!lockPos(L, v2)) continue; const dx = v2.x - me.pos.x, dz = v2.z - me.pos.z, d = Math.hypot(dx, dz) || 1;
      const sc = (dx * fx + dz * fz) / d - d * 0.004 + (L === 'demon' ? 0.15 : 0); if (sc > bs) { bs = sc; best = L; } }
    return best;
  }
  function enemies() { const d = game.demon; return d.alive && !d.dying ? ['demon'] : []; }   // more go here when there are more
  function pickCenter() {   // the enemy nearest the middle of the screen
    let best = null, bs = 9;
    for (const L of enemies()) { if (!lockPos(L, v2)) continue; v2.project(game.camera); if (v2.z > 1) continue; const sc = v2.x * v2.x + v2.y * v2.y; if (sc < bs) { bs = sc; best = L; } }
    return best;
  }
  function cycle(dir) {   // the next target to the right (1) or left (-1) on screen
    const cam = game.camera, me = game.you; if (!lockPos(lock, v2)) return;
    const cur = v2.clone().project(cam).x; let best = null, bd = 9;
    for (const L of targets()) { if (L === lock || !lockPos(L, v1)) continue; const x = v1.clone().project(cam).x, dd = (x - cur) * dir; if (dd > 0.001 && dd < bd) { bd = dd; best = L; } }
    if (!best) { let ex = null, ev = 9 * -dir; for (const L of targets()) { if (L === lock || !lockPos(L, v1)) continue; const x = v1.clone().project(cam).x; if (dir > 0 ? x < ev : x > ev) { ev = x; ex = L; } } best = ex; }   // wrap round
    if (best) { lock = best; game.popup(best === 'demon' ? 'CENTIPEDE' : 'TEAMMATE', me.pos, '#ffd36a'); }
  }
  function lockTick(dt) {
    const mode = get('lock', 0), me = game.you, gp = me && me.gp, r1 = !!gp && LAB.btn(me, 'lock', 5) && !game.blockPad && !(me && (me.labMadden || me.labSword));   // Madden passing: R1 shoots; Swords: R1 swings   // Madden passing: R1 shoots while you hold it
    if (!mode || game.DUEL || !sports()) { lock = null; held = false; before = null; }
    else {
      if (mode === 1) {   // a quick press locks on (press again: off); hold R1 and it locks onto the enemy nearest the middle until you let go
        if (r1 && !r1Was) r1T = 0;
        if (r1) { r1T += dt; if (!held && r1T >= get('holdTime', 0.22)) { const c = pickCenter(); if (c) { before = lock; lock = c; held = true; } } }
        if (!r1 && r1Was) { if (held) { lock = before && lockPos(before, v1) ? before : null; held = false; before = null; } else if (r1T < get('holdTime', 0.22)) lock = lock ? null : pickFacing(); }
      }
      if (mode === 2) { if (r1 && !lock) lock = pickFacing(); if (!r1) lock = null; }   // hold
      if (lock !== lockWas) { lockWas = lock; lockHas = lock !== 'demon' && !!lock && o.state === 'held' && o.holder === lock; }
      if (lock && lock !== 'demon') { const has = o.state === 'held' && o.holder === lock; if ((has && !lockHas) || lock === game.you) { lock = null; held = false; before = null; } lockHas = has; }
      if (lock && !lockPos(lock, at)) lock = lock !== 'demon' && targets().includes('demon') ? 'demon' : null;   // its target's gone
      const rx = (gp && gp.axes[2]) || 0;   // right stick: flick left or right for the next target
      if (lock && !flick && Math.abs(rx) > 0.6) { flick = Math.sign(rx); cycle(flick); } else if (Math.abs(rx) < 0.3) flick = 0;
    }
    r1Was = r1;
    for (const W of game.ALL) W.labLocked = W === me && !!lock;
    lockK += ((lock ? 1 : 0) - lockK) * (1 - Math.exp(-dt * 6));
    // the camera follows a smoothed copy of the target, so switching glides over instead of jumping
    if (lock && lockPos(lock, at)) { if (!spOn) { sp.copy(at); spOn = true; } else sp.lerp(at, 1 - Math.exp(-dt * 7)); }
    else if (!lock && lockK < 0.01) spOn = false;
    // the marker: a little upside-down triangle bobbing over the target
    if (lock && !marker) {
      marker = new T.Mesh(new T.ConeGeometry(0.38, 0.7, 3), new T.MeshBasicMaterial({ color: 0xffd36a, transparent: true, depthTest: false }));
      marker.rotation.x = Math.PI; marker.renderOrder = 20; game.scene.add(marker);
    }
    if (marker) { marker.visible = !!lock && lockPos(lock, at);
      if (marker.visible) { bob += dt; marker.position.set(at.x, at.y + (lock === 'demon' ? 1.6 : 1.4) + Math.abs(Math.sin(bob * 4.5)) * 0.25, at.z); marker.rotation.y += dt * 2; } }
  }
  // the camera, last of all: behind you, looking past you at the target
  const lp = new T.Vector3(), lk = new T.Vector3(), sp = new T.Vector3(); let spOn = false;
  const unturn = () => { if (game.labLockTurn) { game.labLockTurn = 0; game.MOD.turn = game.labCamYaw || 0; } };
  game.labLockView = (cam, look) => {   // the Camera shelf calls this after its own moves
    if (lockK < 0.01 || !spOn) return unturn();
    const me = game.you, off = v1.copy(cam.position).sub(look), hdist = Math.hypot(off.x, off.z), up = off.y, was = Math.atan2(off.x, off.z);
    const dx = sp.x - me.pos.x, dz = sp.z - me.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    lk.set(me.pos.x + dx * 0.3, 1 + (sp.y - 1) * 0.3, me.pos.z + dz * 0.3);   // between you and it, nearer you
    const side = get('lockSide', 0.4) * hdist;   // over the shoulder, so the arc is seen from the side
    lp.set(me.pos.x - ux * hdist * 0.75 - uz * side, lk.y + up * 0.85, me.pos.z - uz * hdist * 0.75 + ux * side);
    cam.position.lerp(lp, lockK); v2.copy(look).lerp(lk, lockK); cam.lookAt(v2);
    // turn the left stick with the camera, so up still means away from you on screen
    let t = Math.atan2(cam.position.x - v2.x, cam.position.z - v2.z) - was; t = Math.atan2(Math.sin(t), Math.cos(t));
    game.labLockTurn = t; game.MOD.turn = (game.labCamYaw || 0) + t;
  };

  // ---- switch on throw: take over whoever is nearest where it will come down
  let switchFrom = null;
  FX.on('throw', (W) => { if (get('switch', 0) && W.human && !game.DUEL) switchFrom = W; }, 'lab');
  function willHitDemon() {   // fly a copy of the Solid forward and see if it meets the centipede before it comes down
    const d = game.demon; if (!d.alive || d.dying) return false;
    const parts = game.demonParts(), g = game.G * game.solid.grav, h = 1 / 60, rr = 0.35;
    sim.copy(o.p); simV.copy(o.v);
    for (let i = 0; i < 240; i++) {
      simV.y -= g * h; sim.addScaledVector(simV, h);
      for (const q of parts) { const dx = sim.x - q.x, dy = sim.y - q.y, dz = sim.z - q.z, r = q.r + rr; if (dx * dx + dy * dy + dz * dz < r * r) return true; }
      if (simV.y < 0 && sim.y < 0.3) return false;
    }
    return false;
  }
  function doSwitch() {
    const W = switchFrom; switchFrom = null;
    if (o.state !== 'air' || o.last !== W || W !== game.you) return;
    if (willHitDemon()) return;   // it's going into the centipede, not to anyone: stay yourself
    const p = predict(2, true); if (!p) return;
    let best = null, bd = 1e9;
    for (const x of game.ALL) { if (x.downT > 0 || x.capT > 0) continue; const d = Math.hypot(x.pos.x - p[1], x.pos.z - p[2]); if (d < bd) { bd = d; best = x; } }
    if (best && best !== W) game.swapTo(best);
  }

  // ---- own solids: every wizard has a solid of their own and a cloak in its colour; whoever catches the Solid turns it into theirs
  const OWN = [['ownYou', 4], ['ownMate', 0], ['ownGreen', 1], ['ownPurple', 3], ['ownGold', 2]];   // blue (you), red, then the extra wizards (Team shelf)'s extra wizards
  const KEYS = { you: 0, buddy: 1, green: 2, purple: 3, gold: 4 };   // the Colours shelf's name for each wizard
  const solidOf = LAB.solidOf = (W) => { const i = KEYS[W.labKey] ?? game.ALL.indexOf(W), S = game.SOLIDS, k = OWN[i];
    return S[(k ? get(k[0], k[1]) : i) % S.length]; };
  let morphFor = null;
  FX.on('catch', (W) => { if (get('own', 0) && !game.DUEL) morphFor = W; }, 'lab');
  function ownPaint() {
    const on = get('own', 0) && !game.DUEL;
    for (const W of game.ALL) {
      const hex = on ? solidOf(W).color.getHex() : null;
      W.labCloakOwn = hex;
    }
    if (on && o.state === 'held' && o.holder) morphFor = o.holder;
  }
  function morph() {
    const W = morphFor; morphFor = null;
    if (!(o.state === 'held' && o.holder === W)) return;
    const S = solidOf(W); if (S !== game.solid) game.setSolid(S);
  }

  // ---- perfect catches and one-timers
  let oneTimer = null, perfectFlash = 0;
  FX.on('catch', (W, caught) => {
    if (!get('perfect', 0) || !caught || !W.human || game.DUEL) return;
    const C = W.ctl; if (!(C.catchT > 0 && C.catchT <= 0.2 + 1e-6)) return;   // a dive's long catch window doesn't count
    if (0.2 - C.catchT > get('window', 0.12) + 1 / 60) return;
    o.res = Math.min(5, o.res + get('bonus', 1)); perfectFlash = 1; FX.emit('perfectCatch', W);
    game.popup('PERFECT!', W.pos, '#ffffff', true); game.sparkBurst(o.p, 18, 3.2, 0.7); game.rumble(W, 0.2, 0.7, 90); game.shake(0.08);
    if (sports() && (get('lock', 0) ? superLock() : modOf(W) < 0) && o.res >= get('oop', 3)) oneTimer = W;
  }, 'lab');
  function fireOneTimer() {
    const W = oneTimer; oneTimer = null;
    if (!(o.state === 'held' && o.holder === W)) return;
    const d = game.demon;
    if (d.alive && !d.dying) { game.headCenter(at); W.yaw = Math.atan2(at.x - W.pos.x, at.z - W.pos.z); }   // turn to the demon
    else { const s = game.stick; if (s.x || s.z) W.yaw = Math.atan2(s.x, s.z); }
    W.charge = 1; game.playerThrow(W, true); o.oop = true;
    game.popup('ONE-TIMER!', W.pos, '#ffd36a', true);
  }

  // ---- the catch ring (drawn over the grass, never hidden by it)
  let ring = null;
  const RING_COLS = [null, 0xffffff, 0xffd23f, 0x6af0ff];
  function makeRing() {
    const mat = (op) => new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, side: T.DoubleSide });
    const g = new T.Group(), inner = new T.Mesh(new T.RingGeometry(0.46, 0.56, 48), mat(0.5)), outer = new T.Mesh(new T.RingGeometry(0.92, 1, 64), mat(0.8));
    const fill = new T.Mesh(new T.CircleGeometry(1, 48), mat(0.3));
    for (const m of [inner, outer, fill]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 50; }
    g.add(fill, inner, outer); g.visible = false; game.scene.add(g); g.traverse((c) => c.layers.set(2));
    // the drop line: from the Solid straight down to the spot
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
    const beam = new T.Line(bg, new T.LineDashedMaterial({ color: 0xffffff, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.8, depthTest: false, blending: T.AdditiveBlending }));
    beam.frustumCulled = false; beam.renderOrder = 50; beam.layers.set(2); beam.visible = false; game.scene.add(beam);
    ring = { g, inner, outer, fill, beam, thick: -1, step: -1 };
  }
  function ringThick(k) {   // rebuild the two rings at this line width
    if (ring.thick === k) return; ring.thick = k;
    ring.inner.geometry.dispose(); ring.outer.geometry.dispose();
    ring.inner.geometry = new T.RingGeometry(Math.max(0.05, 0.56 - 0.1 * k), 0.56, 48);
    ring.outer.geometry = new T.RingGeometry(Math.max(0.05, 1 - 0.08 * k), 1, 64);
  }
  const sim = new T.Vector3(), simV = new T.Vector3();
  function predict(mode, land) {   // where and when the Solid comes down: [time, x, z] or null (land: ignore who's in the way)
    if (o.state !== 'air' || o.touched || !o.last) return null;
    const g = game.G * game.solid.grav, h = 1 / 60; sim.copy(o.p); simV.copy(o.v);
    for (let i = 1; i <= 240; i++) {
      simV.y -= g * h; sim.addScaledVector(simV, h);
      if (!land) for (const W of game.ALL) if (W !== o.last && (mode === 2 || W.human) && W.downT <= 0 && hd(sim, W.pos) < 0.9 && Math.abs(sim.y - (W.y + 0.55)) < 1) return [i * h, sim.x, sim.z];
      if (simV.y < 0 && sim.y < 0.9) {
        if (!land && mode === 1 && !game.ALL.some((W) => W.human && W !== o.last && hd(sim, W.pos) < 3.5)) return null;
        return [i * h, sim.x, sim.z];
      }
    }
    return null;
  }
  function showRing(mode, dt) {
    const p = mode ? predict(mode) : null;
    if (!p) { if (ring) ring.g.visible = ring.beam.visible = false; if (ring) ring.step = -1; return; }
    if (!ring) makeRing();
    const [t, x, z] = p, lead = get('ringTime', 0.9), u = Math.min(1, t / lead);
    const size = get('ringSize', 1), br = get('ringBright', 1), ci = get('ringColour', 0);
    ringThick(get('ringThick', 1));
    const hot = get('perfect', 0) && t <= get('window', 0.12), coming = t <= lead;
    const col = hot ? WHITE : RING_COLS[ci] ? v1c.setHex(RING_COLS[ci]) : game.solid.color;
    ring.g.visible = true; ring.g.position.set(x, 0.06, z); ring.g.scale.setScalar(size);
    ring.outer.scale.setScalar(0.56 + 1.9 * u);
    const op = (a) => Math.min(1, a * br), boost = Math.max(1, br * 0.7);
    for (const m of [ring.outer, ring.inner, ring.fill]) m.material.color.copy(col).multiplyScalar(boost);
    ring.outer.material.opacity = op(coming ? 0.85 : 0.35); ring.inner.material.opacity = op(hot ? 0.9 : 0.45);
    // the fill: grows from the middle and brightens as it arrives, full just as it lands
    const f = get('ringFill', 0); ring.fill.visible = !!f && coming;
    if (ring.fill.visible) { ring.fill.scale.setScalar(Math.max(0.01, 0.56 * (1 - u))); ring.fill.material.opacity = op(0.15 + 0.45 * (1 - u)); }
    // the drop line
    const b = get('ringBeam', 0); ring.beam.visible = !!b;
    if (b) {
      const a = ring.beam.geometry.attributes.position; a.setXYZ(0, o.p.x, o.p.y, o.p.z); a.setXYZ(1, x, 0.06, z); a.needsUpdate = true;
      ring.beam.computeLineDistances(); ring.beam.material.color.copy(col); ring.beam.material.opacity = op(coming ? 0.9 : 0.4);
    }
    // ticks, quicker as it comes (with Sound on)
    if (get('ringTicks', 0) && coming && LAB.sfx) { const st = Math.floor((1 - u) * 8); if (st !== ring.step) { if (ring.step >= 0) LAB.sfx('tick', st + 4); ring.step = st; } }
    else if (!coming) ring.step = -1;
  }

  // ---- the fire aura
  let fire = null, spin = 0, emberAcc = 0, heat = 0;
  function makeFire() {
    const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { t: { value: 0 }, col: { value: new T.Color() }, k: { value: 0 }, rs: { value: 0.26 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vU; uniform float t; uniform vec3 col; uniform float k; uniform float rs;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          // p is in world units from the Solid's middle (the square is 3.2 across); rs is the Solid's size
          vec2 p = vU * 1.6; float r = length(p), a = atan(p.y, p.x);
          // tongues of flame around the Solid, licking upward, taller and wilder as k grows; the Solid itself stays clear
          float f = n(vec2(a * 3.0, r * 6.0 - t * 3.2)) * 0.65 + n(vec2(a * 7.0 + 5.0, r * 12.0 - t * 5.3)) * 0.35;
          float reach = rs * 1.25 + 0.06 + 0.16 * k + max(p.y, 0.0) * (0.15 + 0.3 * k) + (f - 0.45) * (0.12 + 0.22 * k);
          float clear = smoothstep(rs * 0.9, rs * 1.4, r);
          float body = smoothstep(reach, reach - 0.12, r) * clear;
          float lick = smoothstep(0.35, 0.85, f);
          vec3 c = mix(col, vec3(1.0), 0.1 + 0.25 * lick * k);
          float glow = smoothstep(rs * 3.0, rs, r) * clear * 0.12;
          float edge = smoothstep(1.6, 1.25, max(abs(p.x), abs(p.y)));   // never reaches the square's edge
          gl_FragColor = vec4(c * (body * (0.25 + 0.75 * lick) * (0.4 + 0.5 * k) + col * glow) * min(1.0, 0.35 + k) * edge, 1.0);
        }` });
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), mat); m.frustumCulled = false; m.renderOrder = 5; game.scene.add(m);
    const sats = [];
    const geo = new T.IcosahedronGeometry(0.055, 0);
    for (let i = 0; i < 15; i++) { const s = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      s.visible = false; game.scene.add(s); sats.push(s); }
    fire = { m, mat, sats };
  }
  function burn(dt, v) {
    heat += (Math.max(o.labSuper ? 1.2 : v && o.res ? 0.15 + o.res * 0.17 : 0, game.you && game.you.labShoot ? game.you.labShoot : 0) - heat) * (1 - Math.exp(-5 * dt));   // eases up and down, so a fizzle fades out
    if (!fire && heat < 0.01) return;
    if (!fire) makeFire();
    const k = heat * v, on = k > 0.01 && game.orbMesh.visible;
    fire.m.visible = on; for (const s of fire.sats) s.visible = false;
    if (!on) return;
    const S = game.solid; game.orbMesh.getWorldPosition(at);
    // brighter: light and colour
    // the Solid itself burns brighter than its aura: white-hot core and edges, a fuller body, more light
    game.orbLight.intensity += k * 2.5;
    if (S.coreMat) S.coreMat.color.lerp(WHITE, Math.min(1, k * 0.8));
    if (S.lineMat) S.lineMat.color.lerp(WHITE, Math.min(1, k * 0.6));
    if (S.fillMat) S.fillMat.opacity = Math.min(0.85, S.fillMat.opacity + k * 0.3);
    // the aura faces the camera, set just behind the Solid
    game.orbMesh.getWorldScale(v2); fire.mat.uniforms.rs.value = 0.26 * v2.x;
    fire.m.quaternion.copy(game.camera.quaternion); game.camera.getWorldDirection(v1);
    fire.m.position.copy(at).addScaledVector(v1, 0.35 * v2.x); fire.m.scale.setScalar(3.2);
    fire.mat.uniforms.t.value += dt; fire.mat.uniforms.k.value = Math.min(1, k); fire.mat.uniforms.col.value.copy(S.color);
    // sparks orbiting, more and faster as it builds
    // Solid look shelf: how many a resonance level (1 shows the resonance exactly: one spark a level, evenly round
    // one ring), their size, speed and distance
    const per = LAB.get('solid.sparks') ?? 2, sz = LAB.get('solid.sparkSize') ?? 1, sp = LAB.get('solid.sparkSpeed') ?? 1, dist = LAB.get('solid.sparkDist') ?? 1;
    const n = per === 1 ? Math.min(15, o.res) : Math.min(15, Math.round(o.res * per * Math.min(1, v))); spin += dt * (1.6 + o.res * 1.5) * Math.max(0.5, v) * sp;
    for (let i = 0; i < n; i++) {
      const s = fire.sats[i], even = per === 1, a = even ? spin + i * Math.PI * 2 / n : spin * (i % 2 ? 1 : -0.8) + i * 2.399, tilt = even ? 0.45 : i * 0.7, r = (0.42 + o.res * 0.05) * dist;
      s.visible = true; s.position.set(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r * Math.sin(tilt), at.z + Math.sin(a) * r * Math.cos(tilt));
      s.material.color.copy(S.color).lerp(WHITE, 0.4 + 0.1 * (i % 3)); s.scale.setScalar((0.8 + k * 0.8) * sz);
    }
    // embers drifting up once it's really going
    if (o.res >= 3) { emberAcc += dt * (o.res - 2) * 10 * v;
      while (emberAcc > 1) { emberAcc -= 1; v2.set((Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8);
        v1.set(at.x + (Math.random() - 0.5) * 0.4, at.y + 0.15, at.z + (Math.random() - 0.5) * 0.4);
        game.spark(v1, v2, 0.4 + Math.random() * 0.3, 0.35 + k * 0.3, Math.random() < 0.6 ? S.col : 0xfff2c0, 1.5); } }
  }

  FX.on('frame', (dt) => {
    if (sports()) { readButtons(); if (hintWas == null) hint(1); }
    if (switchFrom) doSwitch();
    if (sports()) for (const W of game.ALL) { if (!W.charging) W.labR1 = false; else if (get('lock', 0)) W.labR1 = W.human && W === game.you && superLock() && !shooting(W); else if (W.human && modOf(W) < 0) W.labR1 = true; }
    if (get('lock', 0) || lock) lockTick(dt);
    if (get('power', 0) || skipTrig) aimPower(dt);
    if (lock) shootTick(dt); else if (game.you && game.you.labShoot) { game.you.labShoot = 0; readyFor = null; }
    if (straight) straightFly(dt); else if (o.labShot) o.labShot = false;
    if (get('cancel', 0) || skipCircle) cancelCheck();
    if (get('path', 0) || dots) preview(dt);
    if (morphFor) morph();
    if (oneTimer) fireOneTimer();
    if (get('own', 0) && !game.DUEL) for (const W of game.ALL) { const hex = solidOf(W).color.getHex(); if (W.labCloakOwn !== hex) W.labCloakOwn = hex; }   // follows the solids' colours as they change (Colours shelf, start mix), and new wizards
    if (LAB.repaintWizard) for (const W of game.ALL) if (W.labCloakOwn !== undefined && W.labOwnPainted !== W.labCloakOwn) { W.labOwnPainted = W.labCloakOwn; LAB.repaintWizard(W); }   // the Colours shelf loads after this one
    const r = get('ring', 0); if (r || ring) showRing(r, dt);
    if (o.labSuper) superFly(dt);
    const f = o.labSuper ? Math.max(get('fire', 0), 1.6) : get('fire', 0); if (f || fire) burn(dt, f);
    if (perfectFlash > 0) perfectFlash = Math.max(0, perfectFlash - dt * 3);
  }, 'lab');

  const OFFON = (x) => (x ? 'ON' : 'OFF');
  return [
    { id: 'buttons', label: 'Buttons', help: (x) => x ? 'Square throws and catches (hold L1: higher, R1: lower), Circle dives, R2 runs, L2 tackles' : 'Cross jumps, Square catches and throws, Circle dives, R1 runs, L1 tackles',
      min: 0, max: 1, step: 1, value: 0, dice: false, fmt: (x) => (x ? 'SPORTS' : 'CLASSIC'), apply: buttons },
    { id: 'jump', label: 'Jump', help: 'With Sports buttons, X jumps', kind: 'onoff', value: 0, dice: false, apply: buttons },
    { id: 'slider', label: 'Hold to throw', help: 'How long you hold sets only how fast it goes (so how far); the arc is set by the shoulder buttons',
      kind: 'onoff', value: 0, dice: false, apply: hook },
    { id: 'lock', label: 'Lock-on', help: (x) => x === 1 ? 'Tap R1: lock onto what you face (the centipede or a teammate), tap again to let go. Hold R1: lock onto the enemy nearest the middle of the screen until you let go; throwing then is your super shot. The right stick flicks to the next target'
      : x === 2 ? 'Hold R1: lock onto what you face; on the centipede, throwing is your super shot. The right stick flicks to the next target' : 'R1 throws lower',
      min: 0, max: 2, step: 1, value: 0, dice: false, fmt: (x) => ['OFF', 'TAP + HOLD', 'R1 HOLD'][x], apply: () => { aimOn(); if (!get('lock', 0)) { lock = null; held = false; } } },
    { id: 'shoot', label: 'Shoot mode', help: 'Locked onto the centipede, the throw is a straight shot: hold Square to build it up (the Solid swells and burns brighter), full is a super shot', kind: 'onoff', value: 1, dice: false },
    { id: 'shootTap', label: 'Shoot on tap lock', help: (x) => x ? 'A tap lock on the centipede is shoot mode too' : 'Only holding R1 is shoot mode', kind: 'onoff', value: 1, dice: false },
    { id: 'shootTime', label: 'Shot build-up', help: 'Seconds of holding Square to build a full (super) shot', min: 0.3, max: 3, step: 0.1, value: 1.2, dice: false, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'shootSlow', label: 'Shot speed (tap)', help: 'How fast a barely built straight shot flies', min: 6, max: 30, step: 1, value: 16, dice: false },
    { id: 'shootFast', label: 'Shot speed (full)', help: 'How fast a fully built straight shot flies', min: 12, max: 50, step: 1, value: 30, dice: false },
    { id: 'holdTime', label: 'Lock-on hold', help: 'With TAP + HOLD: how long you hold R1 before it counts as a hold (seconds)', min: 0.1, max: 0.6, step: 0.02, value: 0.22, fmt: (x) => x.toFixed(2) + 's', dice: false },
    { id: 'lockSide', label: 'Lock-on side', help: 'Locked on, the camera sits this far to your right, so you see the throw arc from the side instead of end-on (0: straight behind)', min: 0, max: 1, step: 0.05, value: 0.4, fmt: (x) => x.toFixed(2), dice: false },
    { id: 'arcBy', label: 'Arc by', help: (x) => x ? 'While winding up, the left stick ' + (x === 1 ? 'up throws higher, down lower' : 'down throws higher, up lower') + '; left and right turn you; you stand still' : 'L1 throws higher, R1 lower',
      min: 0, max: 2, step: 1, value: 0, dice: false, fmt: (x) => ['SHOULDERS', 'STICK, UP = HIGH', 'STICK, UP = LOW'][x], apply: aimOn },
    { id: 'power', label: 'Distance', help: (x) => x === 2 ? 'Hold Square to aim, RT throws farther and LT shorter, let go of Square to throw (Sports buttons)'
      : x ? 'Tap Square to aim, right stick up and down sets how far, tap Square again to throw (Sports buttons)' : 'Hold the throw longer to throw farther',
      min: 0, max: 2, step: 1, value: 0, dice: false, fmt: (x) => ['HOLD', 'RIGHT STICK', 'TRIGGERS'][x] },
    { id: 'cancel', label: 'X cancels', help: 'While winding up or aiming a throw, X (Cross) cancels it (you keep the Solid)', kind: 'onoff', value: 0, dice: false },
    { id: 'windup', label: 'Wind up', help: 'How long a full-power throw takes to build, as times the Studio setting (Throwing > Wind up); higher is slower',
      min: 0.3, max: 4, step: 0.1, value: 1, dice: false, fmt: (x) => x.toFixed(1) + '×', apply: (x) => { game.MOD.windup = x; } },
    { id: 'arc', label: 'Normal arc', help: 'The angle a plain throw leaves at', min: 10, max: 70, step: 2, value: 38, dice: false, fmt: (x) => x + '°' },
    { id: 'high', label: 'High arc (L1)', help: 'The angle with L1 held', min: 30, max: 85, step: 2, value: 62, dice: false, fmt: (x) => x + '°' },
    { id: 'low', label: 'Low arc (R1)', help: 'The angle with R1 held', min: 0, max: 30, step: 2, value: 14, dice: false, fmt: (x) => x + '°' },
    { id: 'tap', label: 'Tap speed', help: 'How fast a quick tap throws it', min: 4, max: 20, step: 1, value: 12, dice: false },
    { id: 'full', label: 'Full speed', help: 'How fast a full hold throws it', min: 14, max: 44, step: 1, value: 22, dice: false },
    { id: 'aim', label: 'Aim speed', help: 'While you hold the throw, how fast you turn toward the stick (degrees a second at a full push); a light push turns slowly, letting go holds your aim. OFF snaps to the stick',
      min: 0, max: 360, step: 10, value: 0, dice: false, fmt: (x) => (x ? x + '°/S' : 'OFF'), apply: aimOn },
    { id: 'aimMove', label: 'Move while aiming', help: 'How fast you can still walk while winding up a throw', min: 0, max: 1, step: 0.1, value: 1, dice: false, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'path', label: 'Flight arc', help: 'A dotted line showing where the throw will go while you hold it (with Hold to throw)', kind: 'onoff', value: 0, dice: false },
    { id: 'switch', label: 'Switch on throw', help: 'You take over whoever is nearest where it comes down (you stay if that is you)', kind: 'onoff', value: 0, dice: false },
    { id: 'perfect', label: 'Perfect catch', help: 'Press catch just as the Solid arrives for extra resonance', kind: 'onoff', value: 0, dice: false },
    { id: 'window', label: 'Perfect timing', help: 'How exact it has to be (seconds); bigger is easier', min: 0.04, max: 0.3, step: 0.02, value: 0.12, dice: false, fmt: (x) => x.toFixed(2) + ' S' },
    { id: 'bonus', label: 'Perfect bonus', help: 'Extra resonance from a perfect catch', min: 0, max: 2, step: 1, value: 1, dice: false },
    { id: 'oop', label: 'One-timer from', help: 'With Sports buttons, a perfect catch with R1 held shoots at the demon at once (an alley-oop) when the Solid has this much resonance',
      min: 0, max: 5, step: 1, value: 3, dice: false, fmt: (x) => 'RES ' + x },
    { id: 'ring', label: 'Catch ring', help: 'A ring where the Solid comes down, closing as it arrives; white in the perfect window', min: 0, max: 2, step: 1, value: 0, dice: false,
      fmt: (x) => ['OFF', 'PASSES TO YOU', 'EVERY THROW'][x] },
    { id: 'ringTime', label: 'Ring time', help: 'How long before it arrives the ring starts closing', min: 0.3, max: 3, step: 0.1, value: 0.9, dice: false, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'ringSize', label: 'Ring size', help: 'How big the catch ring is', min: 0.5, max: 3, step: 0.1, value: 1, dice: false, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'ringThick', label: 'Ring thickness', help: 'How thick its lines are', min: 0.5, max: 5, step: 0.25, value: 1, dice: false, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'ringBright', label: 'Ring brightness', help: 'How bright and solid it is', min: 0.5, max: 4, step: 0.25, value: 1, dice: false, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'ringColour', label: 'Ring colour', help: 'The Solid\'s own colour, or one that stands out on the grass', min: 0, max: 3, step: 1, value: 0, dice: false, fmt: (x) => ['SOLID\'S', 'WHITE', 'GOLD', 'CYAN'][x] },
    { id: 'ringFill', label: 'Ring fill', help: 'The middle fills in as the Solid arrives, full just as it lands', kind: 'onoff', value: 0, dice: false },
    { id: 'ringBeam', label: 'Drop line', help: 'A dotted line from the Solid straight down to the ring, so you can see how high it still is', kind: 'onoff', value: 0, dice: false },
    { id: 'ringTicks', label: 'Ring ticks', help: 'Ticks that speed up as it arrives (needs Sound on)', kind: 'onoff', value: 0, dice: false },
    { id: 'super', label: 'Super shot', help: 'A hard throw with R1 (pressed any time in the wind-up) once the Solid has built resonance: flies flat at the centipede, hits much harder', kind: 'onoff', value: 0, dice: false },
    { id: 'superHow', label: 'Super with', help: (x) => x ? 'Any throw at enough power, once the Solid has enough resonance' : 'Press R1 at any point while winding up (or aiming) a throw at enough power',
      min: 0, max: 1, step: 1, value: 0, dice: false, fmt: (x) => (x ? 'ANY HARD THROW' : 'R1') },
    { id: 'superPower', label: 'Super power', help: 'How much power the throw needs for a super shot', min: 0.3, max: 1, step: 0.05, value: 0.75, dice: false, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'superRes', label: 'Super needs', help: 'Resonance needed for a super shot', min: 1, max: 5, step: 1, value: 4, dice: false, fmt: (x) => 'RES ' + x },
    { id: 'superDmg', label: 'Super damage', help: 'How many times harder a super shot hits', min: 1, max: 5, step: 0.5, value: 2.5, dice: false, fmt: (x) => x.toFixed(1) + '×' },
    { id: 'resHold', label: 'Resonance holds', help: 'How long you can hold the Solid before its resonance starts to fade (seconds)', min: 1, max: 15, step: 0.5, value: 3, dice: false,
      fmt: (x) => x + ' S', apply: (x) => { game.MOD.resHold = x / 3; } },
    { id: 'resFade', label: 'Resonance fades', help: 'Once it starts fading, seconds for each level to go', min: 0.3, max: 4, step: 0.1, value: 0.8, dice: false,
      fmt: (x) => x.toFixed(1) + ' S', apply: (x) => { game.MOD.resStep = x / 0.8; } },
    { id: 'resAim', label: 'No fade while aiming', help: 'Resonance does not fade while you wind up or aim a throw', kind: 'onoff', value: 0, dice: false, apply: (x) => { game.MOD.resAim = x; } },
    { id: 'own', label: 'Own solids', help: 'Every player has a solid of their own and a cloak in its colour; the Solid turns into the solid of whoever catches it',
      kind: 'onoff', value: 0, dice: false, apply: ownPaint },
    { id: 'ownYou', label: 'Your solid', help: 'The solid of the wizard you start as', min: 0, max: 4, step: 1, value: 4, dice: false, apply: ownPaint, fmt: (x) => game.SOLIDS[x].name.toUpperCase() },
    { id: 'ownMate', label: "Red teammate's solid", help: 'The solid of the wizard who starts as your teammate (red)', min: 0, max: 4, step: 1, value: 0, dice: false, apply: ownPaint, fmt: (x) => game.SOLIDS[x].name.toUpperCase() },
    { id: 'ownGreen', label: "Green teammate's solid", help: 'The solid of the green extra wizard (Team > Extra wizards)', min: 0, max: 4, step: 1, value: 1, dice: false, apply: ownPaint, fmt: (x) => game.SOLIDS[x].name.toUpperCase() },
    { id: 'ownPurple', label: "Purple teammate's solid", help: 'The solid of the purple extra wizard (Team > Extra wizards)', min: 0, max: 4, step: 1, value: 3, dice: false, apply: ownPaint, fmt: (x) => game.SOLIDS[x].name.toUpperCase() },
    { id: 'ownGold', label: "Gold teammate's solid", help: 'The solid of the gold extra wizard (Team > Extra wizards)', min: 0, max: 4, step: 1, value: 2, dice: false, apply: ownPaint, fmt: (x) => game.SOLIDS[x].name.toUpperCase() },
    { id: 'fire', label: 'Fire aura', help: 'The Solid burns brighter as resonance builds: light, orbiting sparks, flames, embers', min: 0, max: 2, step: 0.1, value: 0, dice: true }
  ].map((t) => (t.kind === 'onoff' && !t.fmt ? { ...t, fmt: OFFON } : t));
});
