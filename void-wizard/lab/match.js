// Lab shelf: Match. One fight against one demon, with stakes.
//   The team shares lives (5). A wizard whose health runs out stays down until someone revives them.
//   Pentacle (L1, or V on a keyboard), with a full-resonance dodecahedron in your hands:
//     next to a downed teammate it revives them, and costs a life;
//     anywhere else it arms the Solid, and the next hit on a demon at its capture point (20% health or less) captures it.
//   The demon can't die any other way: its health stops at 1 until it is captured. Capturing it wins the match.
//   The captain (whoever's own solid is the dodecahedron) has the team's lives as health: every hit on the captain
//   takes a life, and every revive takes one from the captain. A revive can't spend the captain's last life.
//   The captain going down, or everyone down at once, loses the match.
//   Dice: every Pentacle rolls the dodecahedron's d12; a 12 revives for free.
//   Uses the Health shelf for health (turns it on), and the game's spawnDemon and demonMax.
LAB.shelf('match', 'Match', (game) => {
  const T = game.THREE, get = (k, d) => { const v = LAB.get('match.' + k); return v == null ? d : v; };
  const on = () => !!LAB.get('match.on');
  const st = { lives: 5, t: 0, over: null, overAt: 0, revives: 0, armed: false, lastL1: false, lastKey: false, lastGo: false, wasCapturable: false };

  // ---------------------------------------------------------------- the HUD: lives, the demon's health, a hint, the end screen
  const css = document.createElement('style');
  css.textContent = `
  .mt-hud{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:6;font-family:var(--font-pixel,monospace)}
  .mt-lives{display:flex;gap:5px}
  .mt-lives i{width:14px;height:14px;background:var(--mt-col,#b07aff);clip-path:polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%);filter:drop-shadow(0 0 3px var(--mt-col,#b07aff))}
  .mt-lives i.off{background:#2a2438;filter:none}
  .mt-lives i.lose{animation:mtLose .9s steps(6) 1}
  @keyframes mtLose{0%,50%{background:#fff}100%{background:#2a2438}}
  .mt-bar{width:160px;height:6px;background:#000;box-shadow:0 0 0 1px #6a5a80;position:relative}
  .mt-bar b{position:absolute;left:0;top:0;bottom:0;background:#ff5a4a}
  .mt-bar u{position:absolute;top:-3px;bottom:-3px;width:2px;background:#fff}
  .mt-bar.weak b{background:var(--mt-col,#b07aff);animation:mtPulse .5s steps(2) infinite}
  @keyframes mtPulse{50%{opacity:.4}}
  .mt-hint{font-size:10px;letter-spacing:1px;color:#fff;text-shadow:0 0 4px #000,0 0 2px #000;min-height:12px;text-align:center}
  .mt-end{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;z-index:8;background:rgba(0,0,0,.62);font-family:var(--font-pixel,monospace);color:#fff;text-align:center;pointer-events:auto}
  .mt-end h1{margin:0;font-size:28px;letter-spacing:2px;font-weight:400}
  .mt-end p{margin:0;font-size:12px;letter-spacing:1px;opacity:.85}
  .mt-end .go{margin-top:8px;font-size:12px;animation:mtPulse 1s steps(2) infinite}
  `;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.className = 'mt-hud'; hud.style.display = 'none';
  hud.innerHTML = '<div class="mt-lives"></div><div class="mt-bar"><b></b><u></u></div><div class="mt-hint"></div>';
  document.body.appendChild(hud);
  const livesEl = hud.querySelector('.mt-lives'), barEl = hud.querySelector('.mt-bar'), barFill = barEl.querySelector('b'), barMark = barEl.querySelector('u'), hintEl = hud.querySelector('.mt-hint');
  let end = null;
  let livesKey = '';
  function drawLives(lost) {
    const max = get('lives', 5), k = max + ':' + st.lives + ':' + (lost || 0);
    if (k === livesKey) return; livesKey = k;
    livesEl.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < st.lives ? '' : 'off'}${lost && i >= st.lives && i < st.lives + lost ? ' lose' : ''}"></i>`).join('');
  }
  function hint(t) { if (hintEl.textContent !== t) hintEl.textContent = t; }

  // ---------------------------------------------------------------- who is who
  const SN = () => game.SOLIDS;
  const OWN = [['ownYou', 4], ['ownMate', 0], ['ownGreen', 1], ['ownPurple', 3], ['ownGold', 2]];   // as on the Ball play shelf
  const KEYS = { you: 0, buddy: 1, green: 2, purple: 3, gold: 4 };
  function ownSolid(W) {
    if (!LAB.get('ball.own')) return null;
    const i = KEYS[W.labKey] ?? game.ALL.indexOf(W), k = OWN[i], S = SN();
    return S[((k ? (LAB.get('ball.' + k[0]) ?? k[1]) : i) % S.length + S.length) % S.length];
  }
  const isDodeca = (S) => !!S && S.name === 'dodecahedron';
  const captain = () => game.ALL.find(W => isDodeca(ownSolid(W))) || null;
  const tmpC = new T.Color(), HSL = {};
  const dodecaCol = () => {   // the dodecahedron's colour, lifted toward white if it's too dark to read on the void
    const S = SN().find(isDodeca); if (!S) return '#b07aff';
    tmpC.copy(S.color); tmpC.getHSL(HSL); if (HSL.l < 0.62) tmpC.setHSL(HSL.h, HSL.s, 0.62);
    return '#' + tmpC.getHexString();
  };
  const standing = () => game.ALL.filter(W => !W.labDown);
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const maxHp = () => game.demonMax || 200;
  const capturable = () => game.demon.alive && !game.demon.dying && game.demon.hp <= maxHp() * get('capture', 0.2);

  // ---------------------------------------------------------------- the pentacle: a five-pointed star in a circle, drawn on the ground
  const marks = [];
  function starGeo(r) {
    const pts = [];
    for (let i = 0; i <= 5; i++) { const a = (i * 2 % 5) / 5 * Math.PI * 2 + Math.PI / 2; pts.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2 + Math.PI / 2; pts.push(new T.Vector3(Math.cos(a) * r * 1.08, 0, Math.sin(a) * r * 1.08)); }
    return new T.BufferGeometry().setFromPoints(pts);
  }
  function pentacle(x, z, r, colHex, life) {
    const m = new T.Line(starGeo(r), new T.LineBasicMaterial({ color: colHex, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending }));
    m.position.set(x, 0.07, z); m.renderOrder = 4; game.scene.add(m);
    marks.push({ m, t: 0, life, spin: 0.6 });
    return m;
  }
  // the armed Solid wears a small star that turns with it
  let badge = null;
  function showBadge(v) {
    if (v && !badge) { badge = new T.Line(starGeo(0.75), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending })); badge.renderOrder = 5; game.scene.add(badge); }
    if (badge) badge.visible = !!v;
  }
  function tickMarks(dt) {
    for (let i = marks.length - 1; i >= 0; i--) {
      const k = marks[i]; k.t += dt; k.m.rotation.y += k.spin * dt;
      const u = k.t / k.life; k.m.material.opacity = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85);
      if (u >= 1) { game.scene.remove(k.m); k.m.geometry.dispose(); k.m.material.dispose(); marks.splice(i, 1); }
    }
    if (badge && badge.visible) {
      const o = game.orb; badge.position.set(o.p.x, o.p.y, o.p.z); badge.rotation.y += dt * 3; badge.rotation.x = Math.sin(performance.now() / 300) * 0.4;
      badge.material.color.set(dodecaCol());
    }
  }
  const pop = (text, at, col) => { try { game.popup(text, at.clone ? at.clone() : new T.Vector3(at.x, at.y || 1.5, at.z), col, true); } catch (e) {} };

  // ---------------------------------------------------------------- staying down, getting up, losing lives
  function standUp(W) {
    W.labDown = false; W.labHp = W.labMax || W.labHp; W.labSafe = 2;
    if (W.downT > 0) W.downT = 0.01;   // the game stands him up next frame
  }
  function loseLives(n) { const before = st.lives; st.lives = Math.max(0, st.lives - n); livesKey = ''; drawLives(before - st.lives); }
  // the captain's health is the lives: a hit on the captain takes a life, a revive takes the captain's health
  function tieCaptain() {
    const C = captain();
    for (const W of game.ALL) W.labMaxOverride = W === C ? get('lives', 5) : undefined;
    if (!C || st.over) return;
    if (C.labDown) { if (st.lives) loseLives(st.lives); st.over = 'lose'; st.why = 'captain'; st.overAt = performance.now(); return; }
    if (C.labHp != null && C.labMax === get('lives', 5) && C.labHp < st.lives) loseLives(st.lives - C.labHp);
    C.labHp = st.lives;
  }
  function roll(n) { return 1 + Math.floor(Math.random() * n); }

  // L1 with the Solid in hand
  // with a full dodecahedron in your hands: is there a teammate down next to you, or a demon to capture?
  LAB.pentacleWants = () => {
    const Y = game.you, o = game.orb;
    if (!on() || st.over || !(o.state === 'held' && o.holder === Y) || !isDodeca(game.solid) || (o.res || 0) < get('res', 5)) return false;
    if (game.ALL.some(W => W !== Y && W.labDown && hd(W.pos, Y.pos) < get('reach', 3))) return true;
    return capturable() && !st.armed;
  };
  function pentacleButton() {
    const Y = game.you, o = game.orb;
    if (!(o.state === 'held' && o.holder === Y)) return;
    const need = get('res', 5), full = (o.res || 0) >= need, dode = isDodeca(game.solid);
    if (!dode) return;   // the other solids' L1 is the Abilities shelf's
    if (LAB.get('swords.on') && !LAB.pentacleWants()) return;   // with Swords, L1 powers up the sword unless there's a revive or a capture to do
    const at = new T.Vector3(Y.pos.x, Y.y + 2.2, Y.pos.z);
    // the nearest downed teammate in reach
    let D = null, dd = get('reach', 3);
    for (const W of game.ALL) if (W !== Y && W.labDown) { const d = hd(W.pos, Y.pos); if (d < dd) { dd = d; D = W; } }
    if (D) {
      const cost = 1;
      if (!dode) { pop('NEEDS THE DODECAHEDRON', at, '#ffffff'); return; }
      if (!full) { pop('RESONANCE ' + (o.res || 0) + ' / ' + need, at, '#ffffff'); return; }
      let pay = cost, face = 0;
      if (dode && get('dice', 1)) { face = roll(12); if (face === 12) pay = 0; }
      if (st.lives - pay < (captain() ? 1 : 0)) { pop(captain() ? 'THE CAPTAIN NEEDS THAT LIFE' : 'NO LIVES LEFT', at, '#ff6a5a'); return; }
      o.res = 0;
      loseLives(pay); st.revives++; tieCaptain();
      const col = dodecaCol(), hex = parseInt(col.slice(1), 16);
      pentacle(D.pos.x, D.pos.z, 1.7, hex, 1.6); pentacle(D.pos.x, D.pos.z, 2.6, 0xffffff, 1.2);
      game.fxPillar(D.pos.x, D.pos.z, hex, 7, 0.9, 0.9); game.fxRing(D.pos.x, D.pos.z, hex, 4, 0.7);
      game.fxBurst(new T.Vector3(D.pos.x, 0.8, D.pos.z), hex, 60, 4);
      game.rumble(Y, 0.6, 0.6, 260);
      standUp(D);
      const dAt = new T.Vector3(D.pos.x, 2.4, D.pos.z);
      if (face) pop('d12 · ' + face + (face === 12 ? ' · FREE!' : ''), new T.Vector3(D.pos.x, 3.1, D.pos.z), face === 12 ? '#ffd36a' : col);
      pop(pay ? 'REVIVED · −' + pay + (pay > 1 ? ' LIVES' : ' LIFE') : 'REVIVED', dAt, col);
      return;
    }
    // nobody down near you: arm the Solid for a capture
    if (!dode) return;
    if (!full) { pop('RESONANCE ' + (o.res || 0) + ' / ' + need, at, '#ffffff'); return; }
    if (st.armed) return;
    st.armed = true; showBadge(true);
    const hex = parseInt(dodecaCol().slice(1), 16);
    pentacle(Y.pos.x, Y.pos.z, 1.4, hex, 0.9);
    game.fxRing(Y.pos.x, Y.pos.z, hex, 3, 0.5);
    pop('PENTACLE', at, dodecaCol());
  }
  // the armed Solid hit the demon (called before the game checks for its death)
  window.FEATURES.on('demonHit', () => {
    if (!on() || st.over) return;
    const d = game.demon, o = game.orb;
    let capturing = false;
    const near = st.armed && o.state === 'air' && o.last && game.demonParts().some(q => Math.hypot(q.x - o.p.x, q.y - o.p.y, q.z - o.p.z) < q.r + 2.5);
    if (near) {
      st.armed = false; showBadge(false);
      const hp = d.hp + 0;   // after the hit
      if (hp <= maxHp() * get('capture', 0.2)) capturing = true;
      else { const p = game.demonParts()[0]; pop('TOO STRONG TO CAPTURE', new T.Vector3(p.x, p.y + 2, p.z), '#ffffff'); }
    }
    if (capturing) {
      d.hp = -1;   // the game sees it beaten and takes it apart (with Absorbed on, into the Solid)
      const p = game.demonParts()[0], hex = parseInt(dodecaCol().slice(1), 16);
      pentacle(d.pos.x, d.pos.z, 4.5 * (game.MOD.demon || 1), hex, 2.6); pentacle(d.pos.x, d.pos.z, 6.5 * (game.MOD.demon || 1), 0xffffff, 2.2);
      pop('CAPTURED!', new T.Vector3(p.x, p.y + 2.5, p.z), dodecaCol());
      st.over = 'win'; st.overAt = performance.now();
    } else if (d.hp < 1) d.hp = 1;   // it can't die any other way
  }, 'lab');
  // a caught or dropped Solid loses its charge
  window.FEATURES.on('catch', () => { if (st.armed) { st.armed = false; showBadge(false); } }, 'lab');

  // ---------------------------------------------------------------- the end screen
  function showEnd(win) {
    if (end) end.remove();
    end = document.createElement('div'); end.className = 'mt-end';
    const m = Math.floor(st.t / 60), s = Math.floor(st.t % 60);
    end.innerHTML = `<h1 style="color:${win ? dodecaCol() : '#ff6a5a'}">${win ? 'DEMON CAPTURED' : st.why === 'captain' ? 'THE CAPTAIN HAS FALLEN' : 'THE TEAM HAS FALLEN'}</h1>`
      + `<p>TIME ${m}:${String(s).padStart(2, '0')} · LIVES LEFT ${st.lives} · REVIVES ${st.revives}</p>`
      + `<p class="go">PRESS X TO PLAY AGAIN</p>`;
    end.addEventListener('pointerdown', (e) => { e.preventDefault(); restart(); });
    document.body.appendChild(end);
    game.blockPad = true;
  }
  function restart() {
    if (end) { end.remove(); end = null; }
    game.blockPad = false;
    st.lives = get('lives', 5); st.why = null; st.t = 0; st.over = null; st.overAt = 0; st.revives = 0; st.armed = false; showBadge(false); livesKey = '';
    for (const W of game.ALL) standUp(W);
    const d = game.demon;
    if (d.alive && !d.dying) game.spawnDemon();   // a fresh demon where it stands
    else d.spawnT = Math.min(d.spawnT || 1, 1);
  }

  // ---------------------------------------------------------------- every frame
  const btn = (gp, i) => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
  function tick(dt) {
    const d = game.demon, Y = game.you;
    st.t += st.over ? 0 : dt;
    tieCaptain();
    // downed wizards stay down
    for (const W of game.ALL) if (W.labDown && W.downT > 0) W.downT = Math.max(W.downT, 0.5);
    // you went down: take over the nearest teammate still standing
    if (Y && Y.labDown && !st.over) {
      let b = null, bd = 1e9; for (const W of standing()) { const dd = hd(W.pos, Y.pos); if (dd < bd) { bd = dd; b = W; } }
      if (b) game.swapTo(b);
    }
    // everyone down: the match is lost
    if (!st.over && game.ALL.length && !standing().length) { st.over = 'lose'; st.overAt = performance.now(); }
    // after a capture, the demon doesn't come back
    if (st.over === 'win' && !d.alive) d.spawnT = 1e9;
    if (st.over) {
      const since = (performance.now() - st.overAt) / 1000;   // real seconds: slow motion doesn't hold up the end screen
      if (!end && since > (st.over === 'win' ? 2.8 : 1.6)) showEnd(st.over === 'win');
      if (end) {
        const gp = game.pad || (Y && Y.gp), go = btn(gp, 0) || btn(gp, 9) || game.keys.has('Enter') || game.keys.has('Space');
        if (go && !st.lastGo && since > 3.6) restart();
        st.lastGo = go;
      }
    }
    // L1 (or V): the pentacle
    if (!st.over && Y) {
      const l1 = LAB.btn(Y, 'pentacle', 4), key = game.keys.has('KeyV');
      if ((l1 && !st.lastL1) || (key && !st.lastKey)) pentacleButton();
      st.lastL1 = l1; st.lastKey = key;
    }
    if (st.armed && game.orb.state === 'ground') { st.armed = false; showBadge(false); }
    tickMarks(dt);
    // the HUD
    hud.style.display = '';
    hud.style.setProperty('--mt-col', dodecaCol());
    drawLives(0);
    const showBar = get('bar', 1) && d.alive && !d.dying;
    barEl.style.display = showBar ? '' : 'none';
    if (showBar) {
      const f = Math.max(0, Math.min(1, d.hp / maxHp()));
      barFill.style.width = (f * 100).toFixed(1) + '%'; barMark.style.left = (get('capture', 0.2) * 100).toFixed(1) + '%';
      barEl.classList.toggle('weak', capturable());
    }
    const cap = capturable();
    if (cap && !st.wasCapturable && d.alive) { const p = game.demonParts()[0]; pop('CAPTURE IT!', new T.Vector3(p.x, p.y + 2.2, p.z), dodecaCol()); }
    st.wasCapturable = cap;
    const o = game.orb, holding = o.state === 'held' && o.holder === Y, need = get('res', 5);
    let h = '';
    if (st.over) h = '';
    else if (holding && isDodeca(game.solid) && (o.res || 0) >= need) {
      const near = game.ALL.some(W => W !== Y && W.labDown && hd(W.pos, Y.pos) < get('reach', 3));
      const L = LAB.btnName('pentacle', 4, Y) || 'L1';   // the button the Controls shelf has it on
      h = near ? L + ' · REVIVE' : st.armed ? 'PENTACLE READY · HIT THE DEMON' : cap ? L + ' · PENTACLE TO CAPTURE' : '';
    } else if (game.ALL.some(W => W.labDown)) h = 'TEAMMATE DOWN · BRING A FULL DODECAHEDRON';
    else if (cap) h = 'CAPTURE IT · FULL DODECAHEDRON + ' + (LAB.btnName('pentacle', 4, Y) || 'L1');
    hint(st.armed && !holding ? 'PENTACLE READY' : h);
  }
  function off() {
    hud.style.display = 'none'; if (end) { end.remove(); end = null; game.blockPad = false; }
    st.armed = false; showBadge(false);
    for (const W of game.ALL) W.labMaxOverride = undefined;
    for (const W of game.ALL) if (W.labDown) { W.labDown = false; if (W.downT > 0) W.downT = 0.01; }
    const d = game.demon; if (!d.alive && !d.dying && d.spawnT > 5) d.spawnT = 1;
    if (d.alive && d.hp < 1) d.hp = 1;
    st.over = null;
  }
  return [
    { id: 'on', label: 'Match', help: 'One fight with stakes: shared lives, revives, and a capture to win', kind: 'onoff', value: 0, dice: false,
      frame: (dt) => tick(dt), apply: (v) => { if (v) { if (!LAB.get('health.on')) LAB.set('health.on', 1); restart(); } else off(); } },
    { id: 'lives', label: 'Lives', help: 'The captain\'s health, shared by the team. A hit on the captain or a revive spends one', min: 1, max: 12, step: 1, value: 5, dice: false, apply: () => { if (on()) { st.lives = Math.min(st.lives, get('lives', 5)); livesKey = ''; } } },
    { id: 'capture', label: 'Capture point', help: 'The demon can be captured at this much health or less', min: 0.05, max: 0.6, step: 0.05, value: 0.2, dice: false, fmt: (x) => Math.round(x * 100) + '%' },
    { id: 'res', label: 'Pentacle needs', help: 'Resonance the Solid needs for a revive or a capture', min: 1, max: 5, step: 1, value: 5, dice: false },
    { id: 'reach', label: 'Revive reach', help: 'How close you stand to a downed teammate', min: 1, max: 8, step: 0.5, value: 3, dice: false },
    { id: 'dice', label: 'd12', help: 'Every pentacle rolls a d12: a 12 revives for free', kind: 'onoff', value: 1, dice: false },
    { id: 'bar', label: 'Match demon bar', help: 'The demon\'s health at the top, with the capture point marked (with Match on)', kind: 'onoff', value: 1, dice: false }
  ];
});
