// Lab shelf: Attacks. Makes the centipede's ranged attack harder to dodge: more spit, wider, bigger gobs,
// puddles that burn, or fire breath like a dragon in place of the spit. Nothing here is made until a knob is
// turned (three.js uses Math.random to name new things, which would change the demon's moves).
LAB.shelf('attacks', 'Attacks', (game) => {
  const T = game.THREE, D = game.demon, V3 = () => new T.Vector3();
  const get = (k, n) => LAB.get('attacks.' + k) ?? n;
  const mouth = V3(), at = V3(), vv = V3();

  // ---- spit: more gobs, a wider fan, bigger gobs that splash further
  const extra = [];   // gobs added to the game's own nine, made the first time more are needed
  function gobs(n) {
    const pool = game.venoms;
    while (pool.length < n * 2 + 3) {
      const src = pool[0], g = src.g.clone(), puddle = new T.Mesh(src.puddle.geometry, src.puddle.material.clone());
      puddle.rotation.copy(src.puddle.rotation); puddle.layers.mask = src.puddle.layers.mask; puddle.material.opacity = 0;
      g.visible = false; game.scene.add(g); game.scene.add(puddle);
      const V = { g, v: V3(), alive: false, acc: 0, puddle }; pool.push(V); extra.push(V);
    }
  }
  let spitNext = 0;
  function spit(W) {
    const n = Math.round(get('spitCount', 3)), spread = get('spitSpread', 1), size = get('spitSize', 1);
    gobs(n);
    game.headCenter(mouth); mouth.y += 0.05;
    const flight = 0.75, tx = W.pos.x + W.vel.x * flight * 0.6, tz = W.pos.z + W.vel.z * flight * 0.6;
    const ax = tx - mouth.x, az = tz - mouth.z, ad = Math.hypot(ax, az) || 1, base = Math.atan2(ax, az);
    const fan = 0.52 * spread * (1 + (n - 3) * 0.12), pool = game.venoms;
    for (let i = 0; i < n; i++) {
      const V = pool[spitNext]; spitNext = (spitNext + 1) % pool.length;
      const k = n > 1 ? i / (n - 1) - 0.5 : 0, mid = Math.abs(k) < 0.01;
      const ang = base + k * fan + (Math.random() - 0.5) * 0.06;
      const dist = ad * (mid ? 1 : n > 3 ? 0.7 + Math.random() * 0.45 : 0.9), t = flight * (0.92 + Math.random() * 0.16);
      V.v.set(Math.sin(ang) * dist / t, (0 - mouth.y + 0.5 * 18 * t * t) / t, Math.cos(ang) * dist / t);
      V.g.position.copy(mouth); V.g.scale.setScalar(size); V.r = size; V.g.visible = true; V.alive = true;
    }
    for (let i = 0; i < 36 + n * 4; i++) {
      const ang = base + (Math.random() - 0.5) * (0.9 + fan * 0.5), sp = 3 + Math.random() * 6;
      vv.set(Math.sin(ang) * sp, 1 + Math.random() * 3.5, Math.cos(ang) * sp);
      game.spark(mouth, vv, 0.35 + Math.random() * 0.35, (0.25 + Math.random() * 0.35) * size, Math.random() < 0.7 ? 0xff5a1a : 0xffc890, 0.6, 14);
    }
    game.shake(0.12);
  }
  // a big gob's splash knocks over anyone close; the puddle is bigger and, with Burning puddles, stays hot
  window.FEATURES.on('venomSplash', (V) => {
    const r = V.r || 1;
    if (r > 1) {
      V.puddle.scale.setScalar(0.6 * r);
      for (const W of game.ALL) {
        if (W.downT > 0 || W.diveT > 0 || W.y > 1) continue;
        const dx = W.pos.x - V.g.position.x, dz = W.pos.z - V.g.position.z, d = Math.hypot(dx, dz);
        if (d < 0.8 * r) game.knockDown(W, dx / (d || 1), dz / (d || 1), 6);
      }
    }
    if (get('puddles', 0)) { V.puddle.material.opacity = 0.95; V.labHot = 1.2 + get('puddles', 0) * 0.8; }
  }, 'lab');
  function puddles(dt) {
    for (const V of game.venoms) {
      if (!(V.labHot > 0)) continue;
      V.labHot -= dt; V.puddle.material.opacity = Math.max(V.puddle.material.opacity, Math.min(0.9, V.labHot));
      if (V.puddle.scale.x > 1.4 * (V.r || 1)) V.puddle.scale.setScalar(1.4 * (V.r || 1));   // the game lets a puddle spread as it fades
      const p = V.puddle.position, r = 0.45 * V.puddle.scale.x;
      if (Math.random() < dt * 14) { at.set(p.x + (Math.random() - 0.5) * r, 0.05, p.z + (Math.random() - 0.5) * r); vv.set(0, 1 + Math.random(), 0); game.spark(at, vv, 0.4, 0.4, Math.random() < 0.6 ? 0xff5a1a : 0xffc890, 1, -2); }
      for (const W of game.ALL) {
        if (W.downT > 0 || W.diveT > 0 || W.y > 0.4 || W.labBurnT > 0) continue;
        const dx = W.pos.x - p.x, dz = W.pos.z - p.z, d = Math.hypot(dx, dz);
        if (d < r) { W.labBurnT = 1; game.knockDown(W, dx / (d || 1), dz / (d || 1), 5); }
      }
    }
    for (const W of game.ALL) if (W.labBurnT > 0) W.labBurnT -= dt;
  }

  // ---- fire breath: it holds its head low and pours a cone of flame at you, turning to follow
  const COLS = [
    ['FIRE', [0xfff0c0, 0xffb040, 0xff5a1a, 0x801010]], ['BLUE', [0xe0f4ff, 0x6fc8ff, 0x2f5cff, 0x101060]],
    ['GREEN', [0xf0ffd0, 0xa6ff4a, 0x2fb83a, 0x0a3a10]], ['PURPLE', [0xffe0ff, 0xd07aff, 0x7a3aff, 0x200a50]], ['SOLID', null]
  ];
  const ramp = [new T.Color(), new T.Color(), new T.Color(), new T.Color()];
  function setRamp() {
    const c = COLS[get('breathCol', 0)] || COLS[0];
    if (c[1]) c[1].forEach((h, i) => ramp[i].setHex(h));
    else { const s = game.solid.color; ramp[0].setRGB(1, 1, 1).lerp(s, 0.25); ramp[1].copy(s); ramp[2].copy(s).multiplyScalar(0.6); ramp[3].copy(s).multiplyScalar(0.15); }
  }
  let flames = null, fNext = 0, breath = null;
  function makeFlames() {
    flames = [];
    const tex = game.venoms[0].puddle.material.map;
    for (let i = 0; i < 140; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      s.visible = false; s.layers.set(2); game.scene.add(s);
      flames.push({ s, v: V3(), age: 0, life: 1 });
    }
  }
  const col = new T.Color();
  function flameTick(dt) {
    if (!flames) return;
    for (const f of flames) {
      if (!f.s.visible) continue;
      f.age += dt; const u = f.age / f.life;
      if (u >= 1) { f.s.visible = false; continue; }
      f.v.multiplyScalar(Math.exp(-1.6 * dt)); f.v.y += dt * 2.2;   // slows and rises as it burns out
      f.s.position.addScaledVector(f.v, dt);
      const k = u * 3, i = Math.min(2, Math.floor(k));
      col.copy(ramp[i]).lerp(ramp[i + 1], k - i);
      f.s.material.color.copy(col); f.s.material.opacity = (1 - u * u) * (u < 0.1 ? u * 10 : 1);
      f.s.scale.setScalar(f.size * (0.35 + u * 1.6));
    }
  }
  function startBreath(W) {
    if (!flames) makeFlames();
    breath = { t: 0, len: get('breathLen', 1.4), W, acc: 0, hit: new Set() };
    return true;
  }
  function breathe(dt) {
    if (!breath) return;
    const B = breath;
    if (!D.alive || D.dying || D.stunT > 0 || B.t >= B.len) { breath = null; return; }
    B.t += dt;
    D.state = 'recover'; D.atkT = Math.max(D.atkT, 0.35);   // it stays put (head low) until the breath ends
    // turn toward the target: the game turns it a little; Sweep adds more (or holds it still at 0)
    const sweep = get('breathSweep', 1), ty = Math.atan2(B.W.pos.x - D.pos.x, B.W.pos.z - D.pos.z);
    let dd = ty - D.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    D.yaw += Math.max(-1, Math.min(1, dd * 3)) * 0.8 * (sweep - 1) * dt;
    D.pinch = 1.1;
    setRamp();
    const reach = get('breathReach', 6), wide = get('breathWidth', 0.3), grow = Math.min(1, B.t / 0.3), fade = Math.min(1, (B.len - B.t) / 0.25);
    const fx = Math.sin(D.yaw), fz = Math.cos(D.yaw), sc = D.scale || 1;
    game.headCenter(mouth); mouth.x += fx * 0.45 * sc; mouth.z += fz * 0.45 * sc;
    const life = 0.55, sp = reach * 2.6;   // with the drag, a flame travels about its reach before it burns out
    B.acc += dt * 110 * (0.4 + 0.6 * grow);
    while (B.acc > 1) {
      B.acc -= 1;
      const f = flames[fNext]; fNext = (fNext + 1) % flames.length;
      const a = Math.atan2(fx, fz) + (Math.random() - 0.5) * 2 * wide * 0.9, s = sp * (0.8 + Math.random() * 0.3);
      f.s.position.copy(mouth); f.v.set(Math.sin(a) * s, (0.55 - mouth.y) / life + (Math.random() - 0.3) * 1.2, Math.cos(a) * s);
      f.age = 0; f.life = life * (0.8 + Math.random() * 0.4); f.size = (0.7 + wide * 1.5) * (0.8 + Math.random() * 0.5); f.s.visible = true;
    }
    if (Math.random() < dt * 30) { vv.set(fx * 6 + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, fz * 6 + (Math.random() - 0.5) * 3); game.spark(mouth, vv, 0.6, 0.5, ramp[1].getHex(), 1.5, 4); }
    game.shake(0.03 * fade);
    // anyone in the cone is knocked flying (a dive roll or a jump over it gets you through)
    const r = reach * Math.min(1, B.t / 0.4) * fade;   // the flames take a moment to get there
    for (const W of game.ALL) {
      if (B.hit.has(W) || W.downT > 0 || W.diveT > 0 || W.y > 1.3) continue;
      const dx = W.pos.x - mouth.x, dz = W.pos.z - mouth.z, d = Math.hypot(dx, dz);
      if (d > r || d < 0.01) continue;
      const cosA = (dx * fx + dz * fz) / d;
      if (cosA > Math.cos(wide + 0.25 / Math.max(1, d)) || d < 0.8) {
        B.hit.add(W); game.knockDown(W, dx / d * 0.5 + fx * 0.6, dz / d * 0.5 + fz * 0.6, 10);
        at.set(W.pos.x, W.y + 0.7, W.pos.z); game.fxBurst(at, ramp[1].getHex(), 24, 4);
      }
    }
  }

  // the game asks before it spits: breathe fire instead, or a bigger spit, or (all normal) let it spit
  game.spitHook = (W) => {
    const mode = get('attack', 0);
    if (mode === 1 || (mode === 2 && Math.random() < 0.5)) return startBreath(W);
    if (get('spitCount', 3) !== 3 || get('spitSpread', 1) !== 1 || get('spitSize', 1) !== 1) { spit(W); return true; }
    return false;
  };
  window.FEATURES.on('frame', (dt) => { breathe(dt); flameTick(dt); puddles(dt); }, 'lab');

  const MODES = ['SPIT', 'FIRE BREATH', 'BOTH'];
  return [
    { id: 'attack', label: 'Ranged attack', help: 'Spit, breathe fire like a dragon, or either', min: 0, max: 2, step: 1, value: 0, dice: true, fmt: (x) => MODES[x] },
    { id: 'spitCount', label: 'More spit', help: 'Gobs in each spit (3 is normal)', min: 1, max: 15, step: 1, value: 3, dice: true },
    { id: 'spitSpread', label: 'Spit spread', help: 'How wide the gobs fan out', min: 0.3, max: 3, step: 0.1, value: 1, fmt: (x) => '×' + x },
    { id: 'spitSize', label: 'Spit size', help: 'Bigger gobs hit more easily and splash over you', min: 1, max: 3, step: 0.1, value: 1, fmt: (x) => '×' + x, dice: true },
    { id: 'puddles', label: 'Burning puddles', help: 'Where spit lands burns for a while: stepping in knocks you over', min: 0, max: 5, step: 0.5, value: 0, fmt: (x) => (x ? x * 0.8 + 1.2 + ' S' : 'OFF') },
    { id: 'breathLen', label: 'Breath time', help: 'Seconds it breathes fire for', min: 0.5, max: 4, step: 0.1, value: 1.4 },
    { id: 'breathReach', label: 'Breath reach', help: 'How far the flames go', min: 2, max: 14, step: 0.5, value: 6 },
    { id: 'breathWidth', label: 'Breath width', help: 'How wide the cone of flame is', min: 0.1, max: 0.9, step: 0.05, value: 0.3 },
    { id: 'breathSweep', label: 'Breath turning', help: 'How fast it turns to follow you while breathing (0 holds still)', min: 0, max: 4, step: 0.1, value: 1, fmt: (x) => '×' + x },
    { id: 'breathCol', label: 'Flame colour', help: "Fire, blue, green, purple, or the Solid's colour", min: 0, max: COLS.length - 1, step: 1, value: 0, fmt: (x) => COLS[x][0] }
  ];
});
