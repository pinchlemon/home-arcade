// Lab shelf: Party. Up to three more wizards and the teammate brain that runs them (with sliders). Passing like a sports game: passes go to the teammate you face, control jumps to whoever the pass
// is for (or whoever gets the Solid), and catching can be automatic. The game does the work (game.js passTarget,
// swapTo, MOD.passCone/passSpeed/autoCatch); this shelf sets it and marks who you are.
LAB.shelf('party', 'Party', (game) => {
  const T = game.THREE, MOD = game.MOD;
  const CONES = [2, 0.8, 0.5, -1.01];   // off, about 37°, 60°, anywhere (still the one you face most)
  // switching: 1 when you pass, 2 also whenever a teammate gets the Solid
  // switching: 1 when you pass, 2 both (when you pass, and whenever a teammate gets the Solid), 3 only when a teammate gets it
  // (the options are in this order because saved mixes remember a choice by its place)
  const sw = () => LAB.get('party.switch') ?? 0;
  window.FEATURES.on('pass', (W, to) => { if ((sw() === 1 || sw() === 2) && W && W.human) game.swapTo(to); }, 'lab');
  window.FEATURES.on('catch', (W) => { if (sw() >= 2 && W && !W.human) game.swapTo(W); }, 'lab');
  // a ring over the wizard you control, while control can move between wizards
  // (made on first use: three.js gives every new object an id from Math.random, so making it early would change the demon's moves)
  let mark = null, pop = 0;
  function made() {
    if (!mark) { mark = new T.Mesh(new T.TorusGeometry(0.2, 0.035, 6, 24), new T.MeshBasicMaterial({ color: 0xffd23f })); mark.rotation.x = Math.PI / 2; game.scene.add(mark); }
    return mark;
  }
  window.FEATURES.on('swap', () => { pop = 1; }, 'lab');
  function marker(dt, v) {
    const W = game.you, mark = made(); pop = Math.max(0, pop - dt * 3);
    mark.visible = !!v; mark.position.set(W.pos.x, W.y + 1.75 * W.root.scale.y + Math.sin(performance.now() / 300) * 0.05, W.pos.z);
    mark.scale.setScalar(1 + pop * 1.2);
  }
  // ---- change player (Triangle, F or the buddy button, while you don't hold the Solid): the teammate the left stick
  // points at, or with the stick let go, the teammate nearest the Solid
  function changePlayer() {
    if (!LAB.get('party.pick')) return false;
    const o = game.orb, you = game.you;
    if (o.state === 'held' && o.holder === you) return false;
    const st = game.stick, sm = Math.hypot(st.x, st.z), mates = game.ALL.filter(W => W !== you && W.downT <= 0);
    if (!mates.length) return true;
    let best = null, bs = -1e9;
    if (sm > 0.3) for (const W of mates) { const dx = W.pos.x - you.pos.x, dz = W.pos.z - you.pos.z, d = Math.hypot(dx, dz) || 1, dot = (dx * st.x + dz * st.z) / (d * sm), sc = dot * 10 - d * 0.05; if (sc > bs) { bs = sc; best = W; } }
    else { game.solidSpot(spot); for (const W of mates) { const sc = -hd(W.pos, spot); if (sc > bs) { bs = sc; best = W; } } }
    game.swapTo(best);
    return true;
  }
  game.changeHook = changePlayer;

  // ---- team orders: the D-pad while playing (1 to 4 on a keyboard), when Team orders is on
  // up presses the attack, down falls back, left surrounds the demon, right groups up on you. With orders on, nobody
  // chases a loose Solid by themselves: up while it's loose sends the teammate nearest to it to pick it up.
  let order = null, grab = null;
  const ORDERS = { up: ['attack', 'ATTACK!'], down: ['hold', 'FALL BACK'], left: ['surround', 'SURROUND'], right: ['regroup', 'GROUP UP'] };
  const loose = () => { const o = game.orb; return o.state === 'ground' || (o.state === 'air' && (o.touched || !o.labTo)); };
  function give(dir) {
    if (dir === 'up' && loose()) {
      game.solidSpot(spot);
      let b = null, bd = 1e9; for (const W of game.ALL) if (W !== game.you && W.downT <= 0) { const d = hd(W.pos, spot); if (d < bd) { bd = d; b = W; } }
      if (b) { grab = b; game.popup('GRAB IT!', b.pos, '#ffd23f', true); game.rumble(game.you, 0.1, 0.4, 60); if (!game.brain) game.popup('TURN ON TEAM BRAIN', game.mate.pos, '#8f8d88', true); return; }
    }
    const [o, say] = ORDERS[dir];
    order = order === o ? null : o;   // the same order again cancels it
    game.popup(order ? say : 'AS YOU WERE', game.you.pos, '#ffd23f', true); game.rumble(game.you, 0.1, 0.4, 60);
    if (order && !game.brain) game.popup('TURN ON TEAM BRAIN', game.mate.pos, '#8f8d88', true);
  }
  function orders(x) {
    LAB.dpad = x ? give : null;
    game.padSkip = x ? new Set([8, 12]) : null;   // the game's own uses of Select (rumble test) and D-pad up (the duel link)
    if (!x) { order = null; grab = null; }
  }

  // ---- more wizards, and the brain that runs every wizard you don't control (game.brain)
  const get = (id, n) => LAB.get('party.' + id) ?? n;
  const WIZ = [[0x2fb85a, 0xe8b64a, 0x40ff80], [0x8a4ad0, 0x6ff2e0, 0xb07aff], [0xe8a33a, 0x3d4fc4, 0xffd23f]];   // green, purple, gold: robe, trim, glow
  const extras = [];   // made the first time they're asked for (making them uses Math.random), then kept
  function crew(n) {
    const you = game.you;
    while (extras.length < n) { const c = WIZ[extras.length], W = game.makeWizard(c[0], c[1], c[2]); W.discBase = c[2]; W.root.visible = false; W.disc.visible = false; extras.push(W); stat(W, WHO[extras.length + 1][0]); }
    let joined = false;
    extras.forEach((W, i) => {
      if (i < n && !game.ALL.includes(W)) {
        const a = Math.random() * Math.PI * 2; W.pos.set(you.pos.x + Math.cos(a) * 4, 0, you.pos.z + Math.sin(a) * 4); W.vel.set(0, 0, 0); W.downT = 0;
        if (!W.labPainted) { W.labPainted = true; if (LAB.paintWizard) LAB.paintWizard(W, ['green', 'purple', 'gold'][i]); }   // its colours from the Colours shelf
        game.joinCrew(W); game.spawnPuffs(10, 2, W.pos); joined = true;
      } else if (i >= n) game.leaveCrew(W);
    });
    if (joined && LAB.ps1Refresh) LAB.ps1Refresh();   // and whatever PS1 looks are on
    sync();
  }
  // stats: each wizard's own speed, jump, catching reach, throwing power and strength (the game reads W.stSpeed and the rest)
  const STATS = [['speed', 'Speed', 'stSpeed', 'How fast they run'], ['jump', 'Jump', 'stJump', 'How high they jump'], ['catch', 'Catching', 'stCatch', 'How far they can reach for a catch'],
    ['throw', 'Throwing', 'stThrow', 'How fast their shots fly and how far they can lob'], ['strength', 'Strength', 'stStrength', 'Damage their hits do to the demon, and how hard they are to knock flying']];
  const WHO = [['blue', 'Blue', () => game.player], ['red', 'Red', () => game.buddy], ['green', 'Green', () => extras[0]], ['purple', 'Purple', () => extras[1]], ['gold', 'Gold', () => extras[2]]];
  const put = (W, f, x) => { W[f] = f === 'stJump' ? Math.sqrt(x) : x; };   // jump: x times as high, so the take-off speed grows by its square root
  const stat = (W, k) => { if (!W) return; for (const [id, , f] of STATS) { const v = LAB.get('stats.' + k + '.' + id); if (v !== undefined) put(W, f, v); } };
  const sync = () => { game.brain = extras.some(W => game.ALL.includes(W)) || get('team', 0) ? think : null; };
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const spot = new T.Vector3(), slot = new T.Vector3(), away = new T.Vector3();
  window.FEATURES.on('throw', () => { game.orb.labTo = null; }, 'lab');
  window.FEATURES.on('pass', (W, to) => { game.orb.labTo = to; }, 'lab');
  // how open a teammate is: room from the demon, nearness, whether the demon sits in the way, and whether it's you
  function bestMate(W) {
    const D = game.demon, live = D.alive && !D.dying, reach = game.LOB_MAX * game.solid.range + 2;
    let best = null, bs = 1;
    for (const c of game.ALL) {
      if (c === W || c.downT > 0) continue;
      const d = hd(c.pos, W.pos); if (d > reach || d < 2.5) continue;
      let sc = (live ? Math.min(game.demonNearest(c.pos).d, 12) : 12) - d * 0.15 + (c === game.you ? get('toYou', 0.7) * (order === 'regroup' ? 16 : 8) : 0);
      if (live) {   // the demon close to the line between them: a risky pass
        const ux = (c.pos.x - W.pos.x) / d, uz = (c.pos.z - W.pos.z) / d, px = D.pos.x - W.pos.x, pz = D.pos.z - W.pos.z, t = Math.max(0, Math.min(d, px * ux + pz * uz));
        if (Math.hypot(px - ux * t, pz - uz * t) < 2) sc -= 8;
      }
      if (sc > bs) { bs = sc; best = c; }
    }
    return best;
  }
  function nearestTo(p) { let b = null, bd = 1e9; for (const W of game.ALL) if (W.downT <= 0) { const d = hd(W.pos, p); if (d < bd) { bd = d; b = W; } } return b; }
  function pass(W, m) {
    const o = game.orb, sp = game.MOD.passSpeed, d0 = hd(m.pos, o.p), Tt = (0.6 + d0 * 0.036) * game.solid.hang / sp;
    const miss = (1 - get('accuracy', 0.7)) * 3 * Math.random(), a = Math.random() * Math.PI * 2;
    game.lobTo(W, W.charge, m.pos.x + m.vel.x * Tt + Math.cos(a) * miss, m.pos.z + m.vel.z * Tt + Math.sin(a) * miss, sp);
    o.labTo = m;
  }
  function shoot(W) {
    game.shootAt(W);
    const v = game.orb.v, r = (1 - get('accuracy', 0.7)) * 0.35 * (Math.random() * 2 - 1), c = Math.cos(r), s = Math.sin(r), x = v.x;
    v.x = x * c - v.z * s; v.z = x * s + v.z * c;
  }
  function think(W, dt) {
    const o = game.orb, D = game.demon, you = game.you, live = D.alive && !D.dying;
    const ai = W.labAI || (W.labAI = { hold: 0, decided: false, shoot: false, goal: 0.5, to: null });
    const inp = { ix: 0, iz: 0, run: false };
    if (W.downT > 0) { ai.hold = 0; ai.decided = false; return inp; }
    // team orders bend the sliders: spread out, regroup on you, attack (close in, shoot more), hold back
    const K = get('keepAway', 4) * (order === 'attack' ? 0.6 : order === 'hold' ? 1.5 : 1),
      S = order === 'spread' ? get('spacing', 9) * 1.7 : order === 'regroup' ? Math.max(2.5, get('spacing', 9) * 0.4) : get('spacing', 9), dn = live ? game.demonNearest(W.pos) : null;
    let target = null, arrive = 0.3, run = true, fetching = false;
    W.faceTarget = null;
    if (o.state === 'held' && o.holder === W) {
      ai.hold += dt;
      const threat = dn && dn.d < K;
      if (!ai.decided && (ai.hold > get('think', 0.6) || (threat && ai.hold > 0.15))) {
        ai.decided = true; ai.to = null;
        const dd = dn ? dn.d : 99, R = get('shotRange', 16) * (order === 'attack' ? 1.2 : 1), sh0 = get('shoot', 0.5);
        const sh = order === 'attack' ? Math.min(1, sh0 + 0.35) : order === 'hold' ? sh0 * 0.4 : order === 'regroup' ? sh0 * 0.5 : sh0;
        ai.shoot = live && dd < R && (Math.random() < sh || (o.res >= 3 && Math.random() < sh + 0.35));
        if (!ai.shoot) { ai.to = bestMate(W); if (!ai.to && live && dd < R * 1.3) ai.shoot = true; }
        ai.goal = ai.shoot ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.3;
        if (ai.shoot || ai.to) { W.charging = true; W.charge = 0; }
      }
      W.faceTarget = ai.shoot && live ? D.pos : ai.to ? ai.to.pos : you.pos;
      if (ai.decided && !ai.shoot && !ai.to) {   // nobody open: carry it toward you, then look again
        if (hd(W.pos, you.pos) > 8) { target = you.pos; arrive = 6; }
        if (ai.hold > get('think', 0.6) + 1.2) { ai.decided = false; ai.hold = 0; }
      }
      if (W.charging) {
        W.charge = Math.min(1, W.charge + dt / 1.1);
        if (W.charge >= ai.goal) { if (ai.shoot && live) shoot(W); else if (ai.to && ai.to.downT <= 0) pass(W, ai.to); else W.charging = false; ai.decided = false; ai.hold = 0; }
      }
    } else {
      ai.hold = 0; ai.decided = false; if (W.charging) W.charging = false;
      game.solidSpot(spot);
      const forMe = o.state === 'air' && o.labTo === W;
      const forOther = o.state === 'air' && o.labTo && o.labTo !== W && o.labTo.downT <= 0;
      if (o.state === 'held' || (grab && (grab.downT > 0 || !game.ALL.includes(grab)))) grab = null;
      const chase = LAB.dpad ? grab === W : nearestTo(spot) === W;   // with orders on, only the one told to (D-pad up)
      if (forMe || (o.state !== 'held' && !forOther && chase)) { target = spot; arrive = 0.1; fetching = true; }
      else {
        // get open: spread out to the sides of whoever has it (or you), so the team fans out around the demon,
        // and move up when the demon is out of shooting range
        const anchor = o.state === 'held' && order !== 'regroup' ? o.holder.pos : you.pos;
        const others = game.ALL.filter(w => w !== you && !(o.state === 'held' && o.holder === w));
        const i = Math.max(0, others.indexOf(W)), n = others.length;
        let cx = anchor.x, cz = anchor.z, base;
        if (!live) {   // no demon: follow you like the buddy does, walking up only once you've got away, and keep apart
          const d = hd(W.pos, you.pos);
          if (d > S * 1.3 || (ai.closing && d > S * 0.75)) { ai.closing = true; target = you.pos; arrive = S * 0.7; run = d > S * 2; }
          else ai.closing = false;
          for (const w of game.ALL) { if (w === W) continue; const dx = W.pos.x - w.pos.x, dz = W.pos.z - w.pos.z, dd = Math.hypot(dx, dz); if (dd < 2.2 && dd > 0.01) { target = away.set(W.pos.x + dx / dd * 1.5, 0, W.pos.z + dz / dd * 1.5); arrive = 0.2; run = false; break; } }
          W.faceTarget = you.pos;
        } else {
          const tx = D.pos.x - anchor.x, tz = D.pos.z - anchor.z, td = Math.hypot(tx, tz) || 1, R = get('shotRange', 16);
          base = Math.atan2(tz, tx);
          const up = order === 'attack' ? Math.max(0, td - R * 0.45) * 0.8 : order === 'hold' ? -4 : order === 'regroup' ? 0 : Math.max(0, td - R * 0.75) * 0.6; cx += tx / td * up; cz += tz / td * up;
          // left and right of the line to the demon, alternating, the later ones a little further back
          const side = i % 2 ? -1 : 1, row = Math.floor(i / 2), ang = base + side * (Math.PI / 2 + row * 0.55);
          slot.set(cx + Math.cos(ang) * S, 0, cz + Math.sin(ang) * S);
          if (order === 'surround') {   // a ring around the demon, evenly spaced, starting from your side of it
            const yours = Math.atan2(you.pos.z - D.pos.z, you.pos.x - D.pos.x), ring = K + 2.5;
            const a2 = yours + (i + 1) * Math.PI * 2 / (n + 1);
            slot.set(D.pos.x + Math.cos(a2) * ring, 0, D.pos.z + Math.sin(a2) * ring);
          }
          const sd = game.demonNearest(slot); if (sd.d < K + 2) { const ax = slot.x - sd.x, az = slot.z - sd.z, ad = Math.hypot(ax, az) || 1; slot.x += ax / ad * (K + 2 - sd.d); slot.z += az / ad * (K + 2 - sd.d); }
          if (hd(W.pos, slot) > 1.2) { target = slot; arrive = 0.8; run = hd(W.pos, slot) > 5; }
          W.faceTarget = o.p;
        }
      }
    }
    // keep out of the demon's reach, unless going for the Solid
    if (dn && dn.d < K && !fetching) { const ax = W.pos.x - dn.x, az = W.pos.z - dn.z, ad = Math.hypot(ax, az) || 1; target = away.set(W.pos.x + ax / ad * 3, 0, W.pos.z + az / ad * 3); arrive = 0.2; run = true; }
    if (target) {
      const dx = target.x - W.pos.x, dz = target.z - W.pos.z, d = Math.hypot(dx, dz);
      if (d > arrive) { const k = Math.min(1, (d - arrive) / 0.6); inp.ix = dx / d * k; inp.iz = dz / d * k; inp.run = run && d > 3; }
    }
    return inp;
  }

  // pass magnet: a pass (helped, or a teammate's) bends toward whoever it's for and arrives as it comes down
  function magnet(dt, v) {
    const o = game.orb, m = o.labTo;
    if (o.state !== 'air' || !m || o.touched || m.downT > 0 || !game.ALL.includes(m)) return;
    const g = 24 * game.solid.grav, h = o.p.y - (m.y + 0.6), vy = o.v.y;
    const t = Math.max(0.12, (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * h))) / g);
    const wx = (m.pos.x + m.vel.x * t * 0.6 - o.p.x) / t, wz = (m.pos.z + m.vel.z * t * 0.6 - o.p.z) / t, k = Math.min(1, v * 5 * dt);
    o.v.x += (wx - o.v.x) * k; o.v.z += (wz - o.v.z) * k;
  }

  return [
    { id: 'aim', label: 'Pass help', help: 'A standing throw goes to the teammate you face, leading them', min: 0, max: 3, step: 1, value: 0, dice: false,
      fmt: (x) => ['OFF', 'A LITTLE', 'LOTS', 'ANY WAY'][x], apply: (x) => { MOD.passCone = CONES[x]; } },
    { id: 'passSpeed', label: 'Pass speed', help: 'Helped passes fly flatter and faster', min: 0.5, max: 2.5, step: 0.1, value: 1, apply: (x) => { MOD.passSpeed = x; } },
    { id: 'magnet', label: 'Pass magnet', help: 'Passes bend toward whoever they are for, so they arrive', min: 0, max: 1, step: 0.1, value: 0, dice: false, frame: magnet },
    { id: 'autoCatch', label: 'Auto catch', help: 'You catch the Solid without pressing anything', kind: 'onoff', value: 0, dice: false, apply: (x) => { MOD.autoCatch = x; } },
    { id: 'switch', label: 'Switch to', help: (x) => ['You always play the same wizard', 'You take over whoever you pass to, as soon as you pass (needs Pass help)',
      'Both: you take over whoever you pass to, and whoever gets the Solid', 'You take over a teammate only once they have the Solid'][x],
      min: 0, max: 3, step: 1, value: 0, dice: false, fmt: (x) => ['OFF', 'WHO YOU PASS TO', 'BOTH', 'WHOEVER HAS IT'][x],
      apply: (x) => { if (!x && mark) mark.visible = false; }, frame: marker },
    { id: 'pick', label: 'Change player', help: 'Triangle (when you are not holding the Solid) takes over the teammate your stick points at, or with the stick let go, the one nearest the Solid. Off: Triangle sets the buddy to follow, stay or wander',
      kind: 'onoff', value: 0, dice: false, frame: (dt) => { if (!LAB.get('party.switch')) marker(dt, 1); }, apply: (x) => { if (!x && mark && !LAB.get('party.switch')) mark.visible = false; } },
    { id: 'orders', label: 'Team orders', help: 'D-pad while playing: up attack (or, with the Solid loose, the nearest teammate grabs it), down fall back, left surround, right group up (again: as you were). Nobody chases a loose Solid unless told. Select opens the Lab, Select + left or right flips presets',
      kind: 'onoff', value: 0, dice: false, setting: true, apply: orders },   // a setting: presets and Reset leave it alone
    { id: 'wizards', label: 'Extra wizards', help: 'Green, purple and gold join your team', min: 0, max: 3, step: 1, value: 0, dice: false, apply: crew },
    { id: 'team', label: 'Team brain', help: 'Your buddy plays like the extra wizards: spreads out, gets open, passes to whoever is free (always on with extra wizards)', kind: 'onoff', value: 0, dice: false, apply: sync },
    { id: 'spacing', label: 'Spacing', help: 'How far apart teammates spread', min: 4, max: 18, step: 1, value: 9 },
    { id: 'keepAway', label: 'Keep away', help: 'How close they let the demon come before backing off', min: 1, max: 10, step: 0.5, value: 4 },
    { id: 'shoot', label: 'Shoot or pass', help: '0 always passes, 1 shoots whenever the demon is in range', min: 0, max: 1, step: 0.05, value: 0.5 },
    { id: 'shotRange', label: 'Shot range', help: 'How near the demon has to be before they shoot', min: 6, max: 28, step: 1, value: 16 },
    { id: 'accuracy', label: 'Accuracy', help: 'How true their passes and shots fly', min: 0, max: 1, step: 0.05, value: 0.7 },
    { id: 'think', label: 'Think time', help: 'Seconds they hold the Solid before throwing', min: 0.1, max: 2.5, step: 0.1, value: 0.6 },
    { id: 'toYou', label: 'Pass to you', help: 'How much they prefer passing to the wizard you control', min: 0, max: 1, step: 0.1, value: 0.7 },
    ...WHO.flatMap(([k, name, W]) => STATS.map(([id, label, f, help]) => ({ id: 'stats.' + k + '.' + id, label, help: name + ' wizard: ' + help.toLowerCase(),
      min: 0.5, max: 2, step: 0.1, value: 1, fmt: (x) => '×' + x.toFixed(1), apply: (x) => { const w = W(); if (w) put(w, f, x); } })))
  ];
});
