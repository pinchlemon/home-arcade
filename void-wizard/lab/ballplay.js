// Lab shelf: Ball play. Sports-game throwing and catching.
//   Buttons: SPORTS gives the controller its own layout: Square throws (and catches), holding L1 throws it higher and
//     holding R1 lower; Circle dives, R2 runs, L2 tackles; X does nothing unless Jump is on (then it jumps).
//   Hold to throw: how long you hold the throw sets only how fast it leaves your hand (so how far it goes); the arc is
//     set apart from that: normal, higher with L1, lower with R1 (Sports buttons). A tap with R1 barely goes anywhere.
//   Switch on throw: after a throw you take over whoever is nearest where it comes down (you stay if that's you).
//   Perfect catch: press catch just as the Solid arrives for extra resonance. With Sports buttons, a perfect catch with
//     R1 held, once the Solid has enough resonance, shoots at the demon at once: a one-timer, scored as an alley-oop.
//   Catch ring: a ring on the ground where the Solid will come down, closing as it arrives (it flashes in the perfect window).
//   Fire aura: the Solid burns brighter as resonance builds: light, orbiting sparks, a flame aura, embers at the top.
// Nothing here runs or is made until one of these is switched on (new three.js objects use Math.random).
LAB.shelf('ball', 'Ball play', (game) => {
  const T = game.THREE, FX = window.FEATURES, o = game.orb;
  const get = (id, n) => LAB.get('ball.' + id) ?? n;
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const v1 = new T.Vector3(), v2 = new T.Vector3(), at = new T.Vector3(), WHITE = new T.Color(1, 1, 1);

  // ---- buttons
  const prev = {};
  const btn = (gp, i) => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
  const sports = () => get('buttons', 0) === 1 && !game.DUEL;
  const modOf = (W) => { const hi = btn(W.gp, 4), lo = btn(W.gp, 5); return hi === lo ? 0 : hi ? 1 : -1; };   // L1 higher, R1 lower
  function readButtons() {   // Square: the game's throw-and-catch button, pressed and let go
    for (const W of game.ALL) {
      const gp = W.human && W.gp; if (!gp) continue;
      const now = btn(gp, 2), was = !!prev[gp.index]; prev[gp.index] = now;
      const C = W.ctl;
      if (game.blockPad) { if (W.labBtn) { C.castHeld = false; W.labBtn = null; } continue; }
      if (now && !was && !C.castHeld) { W.labBtn = 'throw'; C.castHeld = true; C.castPressed = true; }
      if (!now && was && W.labBtn) { C.castHeld = false; W.labBtn = null; }
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
    const S = game.solid, mod = sports() ? modOf(W) : 0;
    const deg = mod > 0 ? get('high', 62) : mod < 0 ? get('low', 14) : get('arc', 38), a = deg * Math.PI / 180;
    const tap = get('tap', 12), sp = (tap + (get('full', 22) - tap) * c) * (W.stThrow || 1) * Math.sqrt(S.grav * S.range);   // every solid goes about as far
    return { dx: Math.sin(W.yaw), dz: Math.cos(W.yaw), vh: sp * Math.cos(a), vy: sp * Math.sin(a), mod };
  }
  function holdThrow(W) {
    const c = W.charge, L = launch(W, c);
    game.throwOrb(W, c, L.dx, L.dz, L.vh, L.vy, true);
    if (L.mod < 0 && c >= 0.6) o.fast = true;   // a hard low throw is a shot: it streaks and hits harder
    if (get('super', 0) && L.mod < 0 && c >= 0.95 && o.res >= get('superRes', 5)) superShot(W);
    FX.emit('holdThrow', W, c, L.mod);
  }

  // ---- super shot: a full low throw at full resonance. Faster, it bends onto the centipede, hits much harder, and bursts
  let superHit = false;
  function superShot(W) {
    o.labSuper = true; o.labMul = get('superDmg', 2.5); o.fast = true; o.v.multiplyScalar(1.4);
    const col = game.solid.col;
    game.popup('SUPER SHOT!', W.pos, '#ffd36a', true); game.shake(0.25); game.rumble(W, 0.5, 1, 260);
    game.fxRing(W.pos.x, W.pos.z, col, 4.5, 0.45); game.fxRing(W.pos.x, W.pos.z, 0xffffff, 2.6, 0.3, 0.05); game.sparkBurst(o.p, 30, 6, 0.9);
  }
  const aim = new T.Vector3();
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
    const show = get('path', 0) && get('slider', 0) && !game.DUEL && W.charging && o.state === 'held' && o.holder === W && W.crouchK <= 0.5;
    if (!show) { if (dots) for (const d of dots) d.visible = false; return; }
    if (!dots) makeDots();
    const L = launch(W, W.charge), g = game.G * game.solid.grav, gap = 0.6, col = game.solid.color, h = 1 / 120;
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

  // ---- switch on throw: take over whoever is nearest where it will come down
  let switchFrom = null;
  FX.on('throw', (W) => { if (get('switch', 0) && W.human && !game.DUEL) switchFrom = W; }, 'lab');
  function doSwitch() {
    const W = switchFrom; switchFrom = null;
    if (o.state !== 'air' || o.last !== W || W !== game.you) return;
    const p = predict(2, true); if (!p) return;
    let best = null, bd = 1e9;
    for (const x of game.ALL) { if (x.downT > 0 || x.capT > 0) continue; const d = Math.hypot(x.pos.x - p[1], x.pos.z - p[2]); if (d < bd) { bd = d; best = x; } }
    if (best && best !== W) game.swapTo(best);
  }

  // ---- perfect catches and one-timers
  let oneTimer = null, perfectFlash = 0;
  FX.on('catch', (W, caught) => {
    if (!get('perfect', 0) || !caught || !W.human || game.DUEL) return;
    const C = W.ctl; if (!(C.catchT > 0 && C.catchT <= 0.2 + 1e-6)) return;   // a dive's long catch window doesn't count
    if (0.2 - C.catchT > get('window', 0.12) + 1 / 60) return;
    o.res = Math.min(5, o.res + get('bonus', 1)); perfectFlash = 1;
    game.popup('PERFECT!', W.pos, '#ffffff', true); game.sparkBurst(o.p, 18, 3.2, 0.7); game.rumble(W, 0.2, 0.7, 90); game.shake(0.08);
    if (sports() && modOf(W) < 0 && o.res >= get('oop', 3)) oneTimer = W;
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

  // ---- the catch ring
  let ring = null;
  function makeRing() {
    const mat = (op) => new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    const g = new T.Group(), inner = new T.Mesh(new T.RingGeometry(0.46, 0.56, 48), mat(0.5)), outer = new T.Mesh(new T.RingGeometry(0.92, 1, 64), mat(0.8));
    inner.rotation.x = outer.rotation.x = -Math.PI / 2; g.add(inner, outer); g.visible = false; game.scene.add(g);
    ring = { g, inner, outer };
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
    if (!p) { if (ring) ring.g.visible = false; return; }
    if (!ring) makeRing();
    const [t, x, z] = p, lead = get('ringTime', 0.9), u = Math.min(1, t / lead);
    const col = game.solid.color, hot = get('perfect', 0) && t <= get('window', 0.12);
    ring.g.visible = true; ring.g.position.set(x, 0.04, z);
    ring.outer.scale.setScalar(0.56 + 1.9 * u);
    ring.outer.material.color.copy(hot ? WHITE : col); ring.inner.material.color.copy(hot ? WHITE : col);
    ring.outer.material.opacity = t > lead ? 0.35 : 0.85; ring.inner.material.opacity = hot ? 0.9 : 0.45;
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
    for (let i = 0; i < 10; i++) { const s = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      s.visible = false; game.scene.add(s); sats.push(s); }
    fire = { m, mat, sats };
  }
  function burn(dt, v) {
    heat += ((o.labSuper ? 1.2 : v && o.res ? 0.15 + o.res * 0.17 : 0) - heat) * (1 - Math.exp(-5 * dt));   // eases up and down, so a fizzle fades out
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
    const n = Math.min(10, Math.round(o.res * 2 * Math.min(1, v))); spin += dt * (1.6 + o.res * 1.5) * Math.max(0.5, v);
    for (let i = 0; i < n; i++) {
      const s = fire.sats[i], a = spin * (i % 2 ? 1 : -0.8) + i * 2.399, tilt = i * 0.7, r = 0.42 + o.res * 0.05;
      s.visible = true; s.position.set(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r * Math.sin(tilt), at.z + Math.sin(a) * r * Math.cos(tilt));
      s.material.color.copy(S.color).lerp(WHITE, 0.4 + 0.1 * (i % 3)); s.scale.setScalar(0.8 + k * 0.8);
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
    if (get('path', 0) || dots) preview(dt);
    if (oneTimer) fireOneTimer();
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
    { id: 'arc', label: 'Normal arc', help: 'The angle a plain throw leaves at', min: 10, max: 70, step: 2, value: 38, dice: false, fmt: (x) => x + '°' },
    { id: 'high', label: 'High arc (L1)', help: 'The angle with L1 held', min: 30, max: 85, step: 2, value: 62, dice: false, fmt: (x) => x + '°' },
    { id: 'low', label: 'Low arc (R1)', help: 'The angle with R1 held', min: 0, max: 30, step: 2, value: 14, dice: false, fmt: (x) => x + '°' },
    { id: 'tap', label: 'Tap speed', help: 'How fast a quick tap throws it', min: 4, max: 20, step: 1, value: 12, dice: false },
    { id: 'full', label: 'Full speed', help: 'How fast a full hold throws it', min: 14, max: 44, step: 1, value: 22, dice: false },
    { id: 'path', label: 'Flight arc', help: 'A dotted line showing where the throw will go while you hold it (with Hold to throw)', kind: 'onoff', value: 0, dice: false },
    { id: 'switch', label: 'Switch on throw', help: 'You take over whoever is nearest where it comes down (you stay if that is you)', kind: 'onoff', value: 0, dice: false },
    { id: 'perfect', label: 'Perfect catch', help: 'Press catch just as the Solid arrives for extra resonance', kind: 'onoff', value: 0, dice: false },
    { id: 'window', label: 'Perfect timing', help: 'How exact it has to be (seconds); bigger is easier', min: 0.04, max: 0.3, step: 0.02, value: 0.12, dice: false, fmt: (x) => x.toFixed(2) + ' S' },
    { id: 'bonus', label: 'Perfect bonus', help: 'Extra resonance from a perfect catch', min: 0, max: 2, step: 1, value: 1, dice: false },
    { id: 'oop', label: 'One-timer from', help: 'With Sports buttons, a perfect catch with R1 held shoots at the demon at once (an alley-oop) when the Solid has this much resonance',
      min: 0, max: 5, step: 1, value: 3, dice: false, fmt: (x) => 'RES ' + x },
    { id: 'ring', label: 'Catch ring', help: 'A ring where the Solid comes down, closing as it arrives; white in the perfect window', min: 0, max: 2, step: 1, value: 0, dice: false,
      fmt: (x) => ['OFF', 'PASSES TO YOU', 'EVERY THROW'][x] },
    { id: 'ringTime', label: 'Ring time', help: 'How long before it arrives the ring starts closing', min: 0.3, max: 2, step: 0.1, value: 0.9, dice: false, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'super', label: 'Super shot', help: 'A full low throw (R1, held all the way) at full resonance: faster, bends onto the centipede, hits much harder', kind: 'onoff', value: 0, dice: false },
    { id: 'superRes', label: 'Super needs', help: 'Resonance needed for a super shot', min: 1, max: 5, step: 1, value: 5, dice: false, fmt: (x) => 'RES ' + x },
    { id: 'superDmg', label: 'Super damage', help: 'How many times harder a super shot hits', min: 1, max: 5, step: 0.5, value: 2.5, dice: false, fmt: (x) => x.toFixed(1) + '×' },
    { id: 'fire', label: 'Fire aura', help: 'The Solid burns brighter as resonance builds: light, orbiting sparks, flames, embers', min: 0, max: 2, step: 0.1, value: 0, dice: true }
  ].map((t) => (t.kind === 'onoff' && !t.fmt ? { ...t, fmt: OFFON } : t));
});
