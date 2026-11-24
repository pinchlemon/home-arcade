// Lab shelf: Swords. A mode with no abilities: whoever holds the Solid carries a giant laser sword in their solid's
// colour.
//   R1 (or O on a keyboard) swings it, as often as you like. Every swing can hit a few parts of the demon and knocks
//   spit gobs out of the air.
//   L1 (or V) powers it up: each press spends 1 resonance, adds a level of fire (up to 5) and some seconds of charge,
//   with a burst of flame. While it's charged the blade burns and hits harder. When the charge runs out, it's back to
//   a plain blade. The charge belongs to the wizard and keeps running down even when they don't hold the Solid.
//   The captain's Pentacle still comes first: with a full dodecahedron next to a downed teammate, or with the demon at
//   its capture point, L1 is the Pentacle.
// Turning Swords on sets W.labSword on whoever holds the Solid (Ball play leaves R1 alone), turns off the Abilities
// shelf's L1, and takes R1 from Madden passing's shot.
LAB.shelf('swords', 'Swords', (game) => {
  const T = game.THREE, FX = window.FEATURES, o = game.orb, D = game.demon;
  const get = (k, d) => { const v = LAB.get('swords.' + k); return v == null ? d : v; };
  const btn = (gp, i) => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const live = () => D.alive && !D.dying;
  const pop = (text, at, col) => { try { game.popup(text, at, col, true); } catch (e) {} };
  const FIRE = [0xff3a1a, 0xff7a1a, 0xffb02a, 0xffd36a, 0xffffff];

  // ---------------------------------------------------------------- the sword: a hilt, a bright core and a glow, on a pivot at the shoulder
  const pivot = new T.Group(); pivot.rotation.order = 'YXZ'; pivot.visible = false; game.scene.add(pivot);
  const hilt = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.5, 6), new T.MeshBasicMaterial({ color: 0x222228 }));
  hilt.rotation.x = Math.PI / 2; hilt.position.z = 0.1;
  const guard = new T.Mesh(new T.BoxGeometry(0.5, 0.08, 0.08), new T.MeshBasicMaterial({ color: 0x8a8a96 }));
  guard.position.z = 0.36;
  const coreM = new T.MeshBasicMaterial({ color: 0xffffff });
  const glowM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false });
  const fireM = new T.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
  const core = new T.Mesh(new T.BoxGeometry(0.09, 0.09, 1), coreM);
  const glow = new T.Mesh(new T.BoxGeometry(0.26, 0.26, 1), glowM);
  const fire = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 1), fireM);
  const blade = new T.Group(); blade.add(core, glow, fire); blade.position.z = 0.4;
  pivot.add(hilt, guard, blade);
  core.renderOrder = glow.renderOrder = fire.renderOrder = 5;
  function setLen(L) { for (const m of [core, glow, fire]) { m.scale.z = L; m.position.z = L / 2; } }

  // ---------------------------------------------------------------- per-wizard state
  const S = (W) => W.labSwordS || (W.labSwordS = { lvl: 0, t: 0, swingT: -1, cd: 0, hit: new Set(), prevYaw: 0, swingDir: 1 });
  const SWING = 0.24, RECOVER = 0.22, ARC = 1.7;   // seconds, seconds, radians each side
  const len = () => get('length', 3.6);
  function colOf(W) { const s = LAB.solidOf && LAB.get('ball.own') ? LAB.solidOf(W) : game.solid; return (s && s.col) || 0xffffff; }

  function powerUp(W) {
    const s = S(W), at = V3(W.pos.x, W.y + 2.3, W.pos.z);
    if ((o.res || 0) < 1) { pop('NO RESONANCE', at, '#ffffff'); return; }
    o.res -= 1;
    s.lvl = Math.min(get('maxLevel', 5), s.lvl + 1); s.t = Math.min(get('perLevel', 5) * get('maxLevel', 5), s.t + get('perLevel', 5));
    // a burst of fire around the wizard, bigger with every level
    const p = V3(W.pos.x, W.y + 1, W.pos.z), k = s.lvl;
    game.fxRing(W.pos.x, W.pos.z, FIRE[Math.min(4, k - 1)], 1.8 + k * 0.7, 0.45);
    game.fxRing(W.pos.x, W.pos.z, 0xffd36a, 1 + k * 0.4, 0.35, 0.06);
    for (let i = 0; i < 24 + k * 12; i++) { const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * (3 + k); game.spark(p, V3(Math.cos(a) * sp, 1 + Math.random() * (2 + k), Math.sin(a) * sp), 0.5, 0.5 + k * 0.08, FIRE[Math.floor(Math.random() * 4)], 1.5, -2); }
    game.fxPillar(W.pos.x, W.pos.z, FIRE[Math.min(4, k)], 2.5 + k * 0.8, 0.5 + k * 0.1, 0.4);
    game.rumble(W, 0.3 + k * 0.08, 0.5, 140);
    pop('LV ' + s.lvl, at, '#ffb02a');
  }
  function swing(W) {
    const s = S(W); if (s.swingT >= 0 || s.cd > 0) return;
    s.swingT = 0; s.hit.clear(); s.swingDir = -s.swingDir; s.prevYaw = null;
    game.rumble(W, 0.15, 0.3, 80);
  }
  // the sword's angles at this point of the swing: yaw around the wizard, pitch up from level
  function pose(W, s) {
    const rest = { yaw: W.yaw + 0.85 * -s.swingDir, pitch: -1.05 };
    if (s.swingT < 0) return rest;
    if (s.swingT < SWING) { const u = s.swingT / SWING, e = 1 - Math.pow(1 - u, 2.2); return { yaw: W.yaw + s.swingDir * ARC * (1 - 2 * e), pitch: -0.12 - Math.sin(u * Math.PI) * 0.08 }; }
    const u = Math.min(1, (s.swingT - SWING) / RECOVER), end = { yaw: W.yaw - s.swingDir * ARC, pitch: -0.12 };
    return { yaw: end.yaw + (rest.yaw - end.yaw) * u, pitch: end.pitch + (rest.pitch - end.pitch) * u };
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // what the blade swept through this frame, from the last yaw to this one
  function strike(W, s, yaw0, yaw1, pitch) {
    const px = W.pos.x, pz = W.pos.z, py = W.y + 1.05 * (W.root.scale.y || 1), reach = len() * Math.cos(pitch) + 0.4;
    const sweep = wrap(yaw1 - yaw0), between = (a, pad) => { const d0 = wrap(a - yaw0); return sweep >= 0 ? d0 >= -pad && d0 <= sweep + pad : d0 <= pad && d0 >= sweep - pad; };
    const lv = s.t > 0 ? s.lvl : 0, dmg = get('damage', 4) * (1 + lv * get('fireBoost', 0.4)), col = lv ? FIRE[Math.min(4, lv - 1)] : colOf(W);
    if (live()) {
      const parts = game.demonParts();
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i];
        if (s.hit.size >= get('maxHits', 3) || s.hit.has(i)) continue;   // each part once a swing
        const dx = q.x - px, dz = q.z - pz, d = Math.hypot(dx, dz);
        if (d > reach + q.r || d < 0.2 || Math.abs(q.y - py) > q.r + 1.6) continue;
        if (!between(Math.atan2(dx, dz), Math.min(1.2, q.r / Math.max(0.5, d)))) continue;
        s.hit.add(i);
        game.hurtDemon(q, dmg, col);
        const at = V3(q.x - dx / d * q.r, q.y, q.z - dz / d * q.r);
        game.fxBurst(at, col, 18 + lv * 8, 4 + lv); if (lv) for (let i = 0; i < 10 * lv; i++) game.spark(at, V3((Math.random() - .5) * 6, 2 + Math.random() * 4, (Math.random() - .5) * 6), 0.5, 0.6, FIRE[Math.floor(Math.random() * 4)], 1.5, -3);
        game.shake(0.08 + lv * 0.03); game.rumble(W, 0.5, 0.7, 90);
        if (lv && game.hitstop) game.hitstop(0.04);
      }
    }
    // spit in reach is cut out of the air
    for (const V of game.venoms) {
      if (!V.alive) continue;
      const dx = V.g.position.x - px, dz = V.g.position.z - pz, d = Math.hypot(dx, dz);
      if (d > reach + 0.6 || Math.abs(V.g.position.y - py) > 2 || !between(Math.atan2(dx, dz), 0.5)) continue;
      V.alive = false; V.g.visible = false; game.fxBurst(V.g.position.clone(), 0xff5a1a, 14, 4);
    }
  }

  // ---------------------------------------------------------------- every frame
  let l1 = false, r1 = false, shownFor = null;
  const statusEl = document.createElement('div');
  statusEl.style.cssText = 'position:fixed;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);font-family:var(--font-pixel,monospace);font-size:10px;letter-spacing:1px;color:#fff;text-shadow:0 0 4px #000,0 0 2px #000;pointer-events:none;z-index:6;white-space:nowrap;display:none';
  document.body.appendChild(statusEl);
  function tick(dt) {
    for (const W of game.ALL) { const s = S(W); if (s.t > 0) { s.t = Math.max(0, s.t - dt); if (s.t === 0) s.lvl = 0; } s.cd = Math.max(0, s.cd - dt); }
    const H = o.state === 'held' ? o.holder : null, Y = game.you;
    for (const W of game.ALL) W.labSword = W === H && W === Y;
    // buttons: only you, with the Solid in your hands
    const mine = H && H === Y && Y.downT <= 0 && !game.blockPad;
    const l1Now = !!Y && (btn(Y.gp, 4) || game.keys.has('KeyV')), r1Now = !!Y && (btn(Y.gp, 5) || game.keys.has('KeyO'));
    if (mine && l1Now && !l1 && !(LAB.pentacleWants && LAB.pentacleWants())) powerUp(Y);
    if (mine && r1Now && !r1) swing(Y);
    l1 = l1Now; r1 = r1Now;
    // the sword goes with the Solid
    if (!H || H.downT > 0 || !H.root.visible) { pivot.visible = false; statusEl.style.display = 'none'; shownFor = null; return; }
    if (shownFor !== H) { const s = S(H); s.swingT = -1; shownFor = H; }
    const s = S(H), lv = s.t > 0 ? s.lvl : 0, sc = H.root.scale.y || 1;
    if (s.swingT >= 0) { s.swingT += dt; if (s.swingT > SWING + RECOVER) { s.swingT = -1; s.cd = get('cooldown', 0.12); } }
    const p = pose(H, s);
    if (s.swingT >= 0 && s.swingT <= SWING + 0.02) { if (s.prevYaw != null) strike(H, s, s.prevYaw, p.yaw, p.pitch); s.prevYaw = p.yaw; }
    pivot.visible = true;
    pivot.position.set(H.pos.x, H.y + 1.05 * sc, H.pos.z);
    pivot.rotation.set(p.pitch, p.yaw, 0);
    pivot.scale.setScalar(sc);
    setLen(len());
    // colour: the solid's, running hotter with the fire
    const base = new T.Color(colOf(H));
    coreM.color.copy(base).lerp(new T.Color(0xffffff), 0.55 + lv * 0.06);
    glowM.color.copy(base).lerp(new T.Color(0xff9a3a), lv * 0.12);
    glowM.opacity = 0.42 + Math.sin(performance.now() / 70) * 0.05;
    fireM.opacity = lv ? 0.16 + lv * 0.07 + Math.random() * 0.08 : 0;
    fire.scale.x = fire.scale.y = 1 + lv * 0.25 + Math.random() * 0.15;
    // flames along the blade, and a trail while it swings
    if (lv) {
      const n = lv * 2 + (s.swingT >= 0 ? 3 : 0);
      for (let i = 0; i < n; i++) {
        const u = 0.15 + Math.random() * 0.85, at = V3(0, 0, 0.4 + u * len()).applyEuler(pivot.rotation).multiplyScalar(sc).add(pivot.position);
        game.spark(at, V3((Math.random() - .5) * 0.8, 1.2 + Math.random() * 1.6 + lv * 0.3, (Math.random() - .5) * 0.8), 0.35 + lv * 0.05, 0.35 + lv * 0.06, FIRE[Math.floor(Math.random() * Math.min(4, lv + 1))], 0.5, -2);
      }
    }
    if (s.swingT >= 0 && s.swingT <= SWING) for (let i = 0; i < 4; i++) {
      const u = 0.3 + Math.random() * 0.7, at = V3(0, 0, 0.4 + u * len()).applyEuler(pivot.rotation).multiplyScalar(sc).add(pivot.position);
      game.spark(at, V3(0, 0, 0), 0.18, 0.4, lv ? FIRE[Math.min(4, lv)] : colOf(H), 0, 0);
    }
    // the line at the bottom
    if (H === Y) {
      const t = `R1 SWING · L1 POWER UP (1)` + (lv ? `   SWORD LV ${lv} · ${Math.ceil(s.t)}S` : '');
      if (statusEl.textContent !== t) statusEl.textContent = t;
      statusEl.style.display = '';
    } else statusEl.style.display = 'none';
  }
  function off() { pivot.visible = false; statusEl.style.display = 'none'; for (const W of game.ALL) { W.labSword = false; if (W.labSwordS) { W.labSwordS.lvl = 0; W.labSwordS.t = 0; } } }
  return [
    { id: 'on', label: 'Swords', help: 'No abilities: whoever holds the Solid has a laser sword. R1 swings, L1 spends 1 resonance to power it up with fire', kind: 'onoff', value: 0, dice: false,
      frame: (dt) => tick(dt), apply: (v) => { if (!v) off(); } },
    { id: 'length', label: 'Length', help: 'How long the blade is', min: 1.5, max: 7, step: 0.25, value: 3.6, dice: false },
    { id: 'damage', label: 'Damage', help: 'Damage of a plain swing, to each part it hits', min: 1, max: 20, step: 0.5, value: 4, dice: false },
    { id: 'maxHits', label: 'Parts a swing', help: 'How many parts of the demon one swing can hit', min: 1, max: 8, step: 1, value: 3, dice: false },
    { id: 'fireBoost', label: 'Fire boost', help: 'Extra damage for each level of fire (0.4 is +40% a level)', min: 0, max: 1.5, step: 0.05, value: 0.4, dice: false, fmt: (x) => '+' + Math.round(x * 100) + '%' },
    { id: 'perLevel', label: 'Charge a press', help: 'Seconds of fire each L1 press adds', min: 1, max: 20, step: 1, value: 5, dice: false, fmt: (x) => x + ' S' },
    { id: 'maxLevel', label: 'Most levels', help: 'How many times the fire can stack', min: 1, max: 5, step: 1, value: 5, dice: false },
    { id: 'cooldown', label: 'Between swings', help: 'Rest after a swing before the next', min: 0, max: 1, step: 0.02, value: 0.12, dice: false, fmt: (x) => x.toFixed(2) + ' S' }
  ];
});
