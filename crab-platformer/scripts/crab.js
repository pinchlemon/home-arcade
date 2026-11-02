function update() {
  t++;
  if (shake > 0) shake--;
  if (crab.dead) {
    overT++;
    if (overT > 60 && (pressed.jump || pressed.a || pressed.b)) reset();
    updateParts(); updateEyes();
    pressed.jump = pressed.a = pressed.b = false;
    return;
  }
  const dir = crab.stun > 0 ? 0 : (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  if (crab.stun > 0) crab.stun--;
  if (crab.invuln > 0) crab.invuln--;
  if (dir) {
    crab.face = dir;
    const acc = Math.sign(crab.vx) === -dir ? WALK_ACC + DEC : WALK_ACC;
    crab.vx += dir * acc;
    if (Math.abs(crab.vx) > WALK_MAX) crab.vx = Math.sign(crab.vx) * Math.max(WALK_MAX, Math.abs(crab.vx) - DEC);
  } else if (crab.onGround) {
    crab.vx = Math.sign(crab.vx) * Math.max(0, Math.abs(crab.vx) - DEC);
  }

  if (pressed.jump) crab.buffer = JUMP_BUFFER;
  if (crab.buffer > 0) crab.buffer--;
  if (crab.onGround) crab.coyote = COYOTE; else if (crab.coyote > 0) crab.coyote--;
  if (crab.buffer && crab.coyote && crab.stun === 0) {
    crab.vy = -JUMP_VEL; crab.onGround = false; crab.coyote = 0; crab.buffer = 0; sfx.jump();
  }
  crab.vy += (held('jump') && crab.vy < 0) ? HOLD_GRAV : GRAV;
  if (crab.vy > MAX_FALL) crab.vy = MAX_FALL;

  const wasGround = crab.onGround, HW = 12;   // claws stay mostly outside walls; he can stand nearer an edge
  const solids = solidsNear(crab.x);
  // horizontal: walls of the castle block him, small ledges he just steps up
  const prevX = crab.x;
  crab.x += crab.vx;
  for (const r of solids) {
    if (crab.y <= r.top + 0.5 || crab.x + HW <= r.x0 || crab.x - HW >= r.x1) continue;
    if (crab.y - r.top <= 3 && wasGround) { crab.y = r.top; continue; }
    // push back out the side he came from (or the nearer side if he was already beside it)
    const fromLeft = prevX + HW <= r.x0 + 0.01, fromRight = prevX - HW >= r.x1 - 0.01;
    const left = fromLeft || (!fromRight && crab.x < (r.x0 + r.x1) / 2);
    crab.x = left ? r.x0 - HW : r.x1 + HW;
    if (Math.sign(crab.vx) === (left ? 1 : -1)) crab.vx = 0;
  }
  // vertical: land on the sand or on top of a castle
  const prevY = crab.y;
  crab.y += crab.vy;
  let landed = null;
  if (crab.y >= GROUND) landed = GROUND;
  if (crab.vy >= 0) for (const r of solids) {
    if (crab.x + 8 <= r.x0 || crab.x - 8 >= r.x1) continue;
    if (prevY <= r.top + 0.5 && crab.y >= r.top) landed = landed === null ? r.top : Math.min(landed, r.top);
  }
  if (landed !== null) {
    if (!wasGround) { spawnDust(crab.x, landed); sfx.land(); }
    crab.y = landed; crab.vy = 0; crab.onGround = true; crab.onCastle = landed < GROUND;
  } else crab.onGround = false;

  // A squirts from the right claw, B from the left
  if ((pressed.a || pressed.b) && crab.snapT <= SNAP_FRAMES - SNAP_COOLDOWN) {
    const side = pressed.a ? 1 : -1;
    crab.snapT = SNAP_FRAMES; crab.snapSide = side; crab.recoil = RECOIL_FRAMES;
    startSquirt(side); sfx.squirt(); rumble(70, 0, 0.3);
  }
  emitJuice();
  if (crab.snapT > 0) crab.snapT--;
  if (crab.recoil > 0) crab.recoil--;

  updateParts();
  updateEyes();

  const walking = crab.onGround && dir !== 0;
  if (walking !== crab.walking) { crab.walking = walking; crab.animT = 0; crab.frame = (crab.frame + 1) & 3; }
  if (++crab.animT >= (walking ? WALK_TICKS : IDLE_TICKS)) { crab.animT = 0; crab.frame = (crab.frame + 1) & 3; if (walking && !(crab.frame & 1)) sfx.step(crab.frame & 2, crab.onCastle); }

  // camera is locked to the crab's whole-pixel position; only the look-ahead eases
  look += (crab.face * S.camera.lookAhead - look) * S.camera.lookEase;
  camX = Math.round(crab.x) - VW / 2 + Math.round(look);
  pressed.jump = pressed.a = pressed.b = false;
}

function spawnDust(x, y) {
  for (const d of [-1, 1]) for (let i = 0; i < 2; i++) parts.push({
    kind: 'dust', x: x + d * (8 + i * 3), y: y - 1, vx: d * (0.4 + i * .3), vy: -0.15, life: 14, max: 14 });
}
