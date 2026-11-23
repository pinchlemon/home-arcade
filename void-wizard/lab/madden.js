// Lab shelf: Passing (Madden). While you hold the Solid, each face button passes to one teammate, the way a football
// game does it. Their button shows over their head:
//   Triangle: the tetrahedron's wizard, Square: the cube's, Cross: the octahedron's, Circle: the icosahedron's,
//   and the dodecahedron's wizard takes the button of whoever holds it (with Own solids off: in order).
//   Tap for a lob (high and soft), hold for a bullet (fast and flat); in between is a touch pass. Let go to throw.
//   The left stick leads the pass: it lands that much ahead of the receiver in the stick's direction.
//   Throwing on the run, or with the demon close, makes it less accurate; holding far past a full bullet too.
//   You move freely while you hold it, so you can throw on the run. R1 (held, then let go) shoots at the demon instead,
//   and with Super shot on, a full shot with enough resonance is a super shot.
//   After the throw you take over the receiver (Take over), so you make the catch yourself.
//   Keyboard: I (Triangle), J (Square), K (Cross), L (Circle), O (shot).
// Ball play reads Square and R1 itself; it stands aside while W.labMadden is set (you holding it with this on).
LAB.shelf('madden', 'Passing', (game) => {
  const T = game.THREE, FX = window.FEATURES, o = game.orb;
  const get = (k, d) => { const v = LAB.get('madden.' + k); return v == null ? d : v; };
  const btn = (gp, i) => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const KEY = { 3: 'KeyI', 2: 'KeyJ', 0: 'KeyK', 1: 'KeyL', 5: 'KeyO' };
  const BTN_OF = { tetrahedron: 3, cube: 2, octahedron: 0, icosahedron: 1 };
  // the buttons' shapes, drawn small, in the usual colours
  const GLYPH = {
    3: '<svg viewBox="0 0 20 20"><path d="M10 3 L17.5 16 H2.5 Z" fill="none" stroke="#5fe0a0" stroke-width="2.6" stroke-linejoin="round"/></svg>',
    1: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#ff6a6a" stroke-width="2.6"/></svg>',
    0: '<svg viewBox="0 0 20 20"><path d="M4.5 4.5 L15.5 15.5 M15.5 4.5 L4.5 15.5" stroke="#7ab8ff" stroke-width="2.8" stroke-linecap="round"/></svg>',
    2: '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" fill="none" stroke="#ff8ad8" stroke-width="2.6"/></svg>'
  };

  const css = document.createElement('style');
  css.textContent = `
  .md-ic{position:fixed;left:0;top:0;width:22px;height:22px;border-radius:50%;background:#000;box-shadow:0 0 0 1.5px #fff3;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:6;transform:translate(-50%,-100%)}
  .md-ic svg{width:16px;height:16px;display:block}
  .md-ic.down{opacity:.3}
  .md-ic.on{box-shadow:0 0 0 2px #fff;background:#222}
  .md-m{position:fixed;left:0;top:0;width:64px;pointer-events:none;z-index:6;transform:translate(-50%,-100%);font-family:var(--font-pixel,monospace);font-size:9px;letter-spacing:1px;color:#fff;text-align:center;text-shadow:0 0 3px #000}
  .md-m .bar{height:5px;background:#000;box-shadow:0 0 0 1px #fff8;position:relative;margin-top:2px}
  .md-m .bar b{position:absolute;left:0;top:0;bottom:0;background:#fff}
  .md-m .bar u{position:absolute;top:-2px;bottom:-2px;width:1px;background:#fff8}`;
  document.head.appendChild(css);
  const icons = new Map();
  function icon(W) { let e = icons.get(W); if (!e) { e = document.createElement('div'); e.className = 'md-ic'; e.style.display = 'none'; document.body.appendChild(e); icons.set(W, e); e.dataset.b = ''; } return e; }
  const meter = document.createElement('div'); meter.className = 'md-m'; meter.style.display = 'none';
  meter.innerHTML = '<span></span><div class="bar"><b></b><u></u></div>'; document.body.appendChild(meter);
  const mLabel = meter.querySelector('span'), mFill = meter.querySelector('b'), mMark = meter.querySelector('u');

  // ---------------------------------------------------------------- who gets which button
  function assign(holder) {
    const byBtn = {}, ofW = new Map(), rest = [];
    const mine = LAB.solidOf && LAB.get('ball.own') ? BTN_OF[LAB.solidOf(holder).name] : undefined;
    for (const W of game.ALL) {
      if (W === holder) continue;
      const S = LAB.solidOf && LAB.get('ball.own') ? LAB.solidOf(W) : null;
      let b = S ? BTN_OF[S.name] : undefined;
      if (S && b === undefined && mine !== undefined) b = mine;   // the dodecahedron takes the holder's button
      if (b === undefined || byBtn[b] !== undefined) { rest.push(W); continue; }
      byBtn[b] = W; ofW.set(W, b);
    }
    for (const W of rest) { const b = [0, 1, 3, 2].find(x => byBtn[x] === undefined); if (b === undefined) break; byBtn[b] = W; ofW.set(W, b); }
    return { byBtn, ofW };
  }

  // ---------------------------------------------------------------- the throw
  const runSpeed = () => 8.5 * (game.MOD.speed || 1);
  function kindOf(h) { const tap = get('tap', 0.15), full = get('bullet', 0.5); return Math.max(0, Math.min(1, (h - tap) / Math.max(0.05, full - tap))); }
  function pass(Y, R, h) {
    const k = kindOf(h), g = game.G * game.solid.grav, st = game.stick, lead = get('lead', 4);
    const lobV = (d) => get('lobSpeed', 9) + d * 0.12, bulV = (d) => get('bulletSpeed', 22) + d * 0.25;
    let tx = R.pos.x, tz = R.pos.z, Tt = 1, d = 1, vh = 10;
    for (let i = 0; i < 3; i++) {   // where the receiver will be when it arrives, plus where you led it
      d = Math.max(0.5, Math.hypot(tx - o.p.x, tz - o.p.z)); vh = lobV(d) + (bulV(d) - lobV(d)) * k; Tt = d / vh;
      tx = R.pos.x + R.vel.x * Tt * get('follow', 0.8) + st.x * lead; tz = R.pos.z + R.vel.z * Tt * get('follow', 0.8) + st.z * lead;
    }
    // accuracy: running, the demon close, and holding far too long all spread it
    const run = Math.min(1, Math.hypot(Y.vel.x, Y.vel.z) / runSpeed());
    let near = 99; if (game.demon.alive && !game.demon.dying) for (const q of game.demonParts()) near = Math.min(near, Math.hypot(q.x - Y.pos.x, q.z - Y.pos.z) - q.r);
    const pressure = near < 6 ? 1 - Math.max(0, near) / 6 : 0, over = Math.max(0, h - get('bullet', 0.5) - 0.6);
    const err = get('runErr', 1.25) * run + get('pressure', 1) * pressure + over * 2.5;
    const a = Math.random() * Math.PI * 2, r = err * Math.sqrt(Math.random());
    tx += Math.cos(a) * r; tz += Math.sin(a) * r;
    d = Math.max(0.5, Math.hypot(tx - o.p.x, tz - o.p.z)); vh = lobV(d) + (bulV(d) - lobV(d)) * k; Tt = d / vh;
    const landY = (R.y || 0) + 1.0, vy = (landY - o.p.y + 0.5 * g * Tt * Tt) / Tt;
    game.throwOrb(Y, k, (tx - o.p.x) / d, (tz - o.p.z) / d, vh, vy, true);
    o.labTo = R; o.labMadden = true;
    FX.emit('pass', Y, R);
    if (get('control', 1) && R !== game.you) game.swapTo(R);
  }
  function shot(Y, h) {
    const p = Math.max(0.25, Math.min(1, h / Math.max(0.1, get('bullet', 0.5))));
    if (!game.demon.alive || game.demon.dying) return;
    Y.charge = p; game.shootAt(Y);
    if (LAB.superShot && LAB.get('ball.super') && (o.res || 0) >= (LAB.get('ball.superRes') ?? 4) && p >= (LAB.get('ball.superPower') ?? 0.75)) LAB.superShot(Y, true);
  }

  // ---------------------------------------------------------------- every frame
  let press = null, stale = null, wasHolding = false, map = null, lastNow = 0;
  function clear() {
    press = null; stale = null; meter.style.display = 'none';
    for (const e of icons.values()) e.style.display = 'none';
    for (const W of game.ALL) W.labMadden = false;
    LAB.skip('madden', null);
  }
  function tick() {
    const now = performance.now() / 1000, rdt = Math.min(0.1, now - (lastNow || now)); lastNow = now;   // real time: slow motion doesn't change the hold
    if (o.state !== 'air') o.labMadden = false;
    const Y = game.you, holding = !!Y && o.state === 'held' && o.holder === Y && Y.downT <= 0 && !game.blockPad && !game.DUEL;
    for (const W of game.ALL) W.labMadden = holding && W === Y;
    if (!holding) { if (wasHolding) clear(); wasHolding = false; return; }
    if (!wasHolding) {   // just got it: buttons already down (the catch) don't count until they're let go
      stale = new Set(); for (const b of [0, 1, 2, 3, 5]) if (btn(Y.gp, b) || game.keys.has(KEY[b])) stale.add(b);
      press = null; Y.charging = false; Y.ctl.castHeld = false;
    }
    wasHolding = true;
    LAB.skip('madden', [0, 1, 2, 3]);   // the game doesn't see the face buttons while you hold it
    map = assign(Y);
    const down = (b) => btn(Y.gp, b) || game.keys.has(KEY[b]);
    for (const b of [0, 1, 2, 3, 5]) {
      const d = down(b);
      if (stale.has(b)) { if (!d) stale.delete(b); continue; }
      if (d && !press) {
        const to = b === 5 ? 'shot' : map.byBtn[b];
        if (to && (to === 'shot' || !(to.downT > 0))) press = { b, t: 0, to };
      }
    }
    if (press) {
      press.t += rdt;
      if (!down(press.b)) { const p = press; press = null; if (p.to === 'shot') shot(Y, p.t); else pass(Y, p.to, p.t); }
    }
  }
  // icons and the meter sit over the heads, placed after the camera has moved
  const at = new T.Vector3();
  function screen(cam, x, y, z) {
    at.set(x, y, z).project(cam);
    const [sx, sy] = LAB.onScreen ? LAB.onScreen((at.x + 1) / 2, (at.y + 1) / 2) : [(at.x + 1) / 2, (at.y + 1) / 2];
    return at.z > 1 || sx < 0 || sx > 1 || sy < 0 || sy > 1 ? null : [sx * innerWidth, (1 - sy) * innerHeight];
  }
  function place(cam) {
    if (!wasHolding || !map) return;
    cam.updateMatrixWorld();
    const show = get('icons', 1);
    for (const W of game.ALL) {
      const e = icon(W), b = map.ofW.get(W);
      if (!show || b === undefined || !W.root.visible) { e.style.display = 'none'; continue; }
      if (e.dataset.b !== String(b)) { e.dataset.b = String(b); e.innerHTML = GLYPH[b]; }
      e.classList.toggle('down', W.downT > 0); e.classList.toggle('on', !!press && press.to === W);
      const s = screen(cam, W.pos.x, W.y + 1.9 * (W.root.scale.y || 1), W.pos.z);   // the same spot as the health bar, then just above it
      if (!s) { e.style.display = 'none'; continue; }
      e.style.display = 'flex'; e.style.transform = `translate(${s[0].toFixed(1)}px,${(s[1] - 4 - (barsOn() ? 10 : 0)).toFixed(1)}px) translate(-50%,-100%)`;
    }
    const Y = game.you;
    if (press && Y) {
      const s = screen(cam, Y.pos.x, Y.y + 1.9 * (Y.root.scale.y || 1), Y.pos.z);
      if (s) {
        s[1] -= 4 + (barsOn() ? 10 : 0);
        const k = press.to === 'shot' ? Math.min(1, press.t / get('bullet', 0.5)) : kindOf(press.t);
        const fill = press.to === 'shot' ? k : Math.min(1, press.t / (get('bullet', 0.5) + 0.6));
        mLabel.textContent = press.to === 'shot' ? (k >= 1 ? 'FULL SHOT' : 'SHOT') : press.t > get('bullet', 0.5) + 0.6 ? 'TOO LONG' : k <= 0 ? 'LOB' : k >= 1 ? 'BULLET' : 'TOUCH';
        mFill.style.width = (fill * 100).toFixed(0) + '%';
        mMark.style.left = press.to === 'shot' ? '100%' : (get('bullet', 0.5) / (get('bullet', 0.5) + 0.6) * 100).toFixed(0) + '%';
        meter.style.display = ''; meter.style.transform = `translate(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px) translate(-50%,-100%)`;
      } else meter.style.display = 'none';
    } else meter.style.display = 'none';
  }
  // placed after every camera move of the frame: hooked on the first frame, so it comes after the Camera and Feel shelves
  // (which hook the camera event when their files load) and the health bars, like they are
  let hooked = false;
  const hook = () => { if (hooked) return; hooked = true; FX.on('camera', (cam) => { if (LAB.get('madden.on')) place(cam); }, 'lab'); };
  const barsOn = () => !!LAB.get('health.on');
  FX.on('catch', () => { o.labMadden = false; }, 'lab');
  return [
    { id: 'on', label: 'Madden passing', help: 'Holding the Solid, each face button passes to one teammate (their button shows over them); R1 shoots', kind: 'onoff', value: 0, dice: false,
      frame: () => { hook(); tick(); }, apply: (v) => { if (!v) { clear(); wasHolding = false; o.labMadden = false; } } },
    { id: 'tap', label: 'Lob below', help: 'A press shorter than this is a lob: high and soft', min: 0.05, max: 0.5, step: 0.05, value: 0.15, dice: false, fmt: (x) => x.toFixed(2) + ' S' },
    { id: 'bullet', label: 'Bullet at', help: 'Hold this long for a full bullet: fast and flat (in between is a touch pass)', min: 0.2, max: 1.5, step: 0.05, value: 0.5, dice: false, fmt: (x) => x.toFixed(2) + ' S' },
    { id: 'lobSpeed', label: 'Lob speed', help: 'How fast a lob travels (slower floats higher)', min: 5, max: 16, step: 0.5, value: 9, dice: false },
    { id: 'bulletSpeed', label: 'Bullet speed', help: 'How fast a bullet travels', min: 12, max: 40, step: 1, value: 22, dice: false },
    { id: 'lead', label: 'Lead', help: 'How far ahead the left stick puts the pass', min: 0, max: 10, step: 0.5, value: 4, dice: false },
    { id: 'follow', label: 'Lead the run', help: 'How much a pass leads where the receiver is already running', min: 0, max: 1.5, step: 0.1, value: 0.8, dice: false },
    { id: 'runErr', label: 'Running spread', help: 'How far off a pass can go when you throw at full run', min: 0, max: 6, step: 0.25, value: 1.25, dice: false },
    { id: 'pressure', label: 'Pressure spread', help: 'How far off a pass can go with the demon right on you', min: 0, max: 6, step: 0.25, value: 1, dice: false },
    { id: 'control', label: 'Take over', help: 'After a pass you control the receiver, so you make the catch', kind: 'onoff', value: 1, dice: false },
    { id: 'icons', label: 'Button icons', help: 'Each teammate\'s button over their head while you hold the Solid', kind: 'onoff', value: 1, dice: false }
  ];
});
