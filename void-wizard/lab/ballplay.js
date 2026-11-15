// Lab shelf: Ball play. Sports-game passing and catching.
//   Buttons: SPORTS gives the controller its own layout: X passes (and catches), Square shoots (and catches), Circle dives,
//     R2 jumps. Square while holding the Solid fires a hard flat shot at the demon, from the ground or the air.
//   Pass slider: how long you hold a pass sets how it flies, from a high floating lob (a tap) to a flat bullet (a full
//     hold), anywhere in between. It goes to the teammate you roughly face, leading them; otherwise straight ahead.
//   Perfect catch: press catch just as the Solid arrives for extra resonance. With Sports buttons, catching with Square
//     on a perfect catch, once the Solid has enough resonance, shoots at once: a one-timer, scored as an alley-oop.
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
  const btn = (gp, i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
  const sports = () => get('buttons', 0) === 1 && !game.DUEL;
  function press(W, k) { const C = W.ctl; if (C.castHeld) return; W.labBtn = k; C.castHeld = true; C.castPressed = true; }
  function release(W, k) { if (W.labBtn === k) W.ctl.castHeld = false; }
  function readButtons() {
    for (const W of game.ALL) {
      const gp = W.human && W.gp; if (!gp) continue;
      const now = [btn(gp, 0), btn(gp, 2), btn(gp, 7)], was = prev[gp.index] || [false, false, false];
      prev[gp.index] = now;
      if (game.blockPad) { if (W.labBtn) W.ctl.castHeld = false; W.jumpHeld = false; continue; }
      if (now[0] && !was[0]) press(W, 'pass'); if (!now[0] && was[0]) release(W, 'pass');
      if (now[1] && !was[1]) press(W, 'shot'); if (!now[1] && was[1]) release(W, 'shot');
      if (now[2] && !was[2]) { W.jumpHeld = true; W.jumpQ = true; } if (!now[2] && was[2]) W.jumpHeld = false;
    }
  }
  let hintWas = null;
  function hint(v) {   // the controller help line under the game says what the buttons do now
    const h = document.getElementById('hint'); if (!h || !/^Stick move/.test(h.textContent)) return;
    if (v) { if (hintWas == null) hintWas = h.textContent;
      h.textContent = hintWas.replace('Cross jump', 'R2 jump').replace('Square catch / hold to throw', 'Cross pass (tap lob, hold bullet) · Square shoot (both catch)'); }
    else if (hintWas != null) { h.textContent = hintWas; hintWas = null; }
  }
  function buttons(v) {
    LAB.skip('ball', v ? [0, 2, 7] : null);   // the game stops seeing X, Square and R2; this shelf reads them instead
    hint(v);
    if (!v) for (const W of game.ALL) { if (W.labBtn) { W.ctl.castHeld = false; W.labBtn = null; } }
  }

  // ---- the pass slider (and the shoot button), as the game's throw
  function mateAhead(W, dx, dz) {
    let m = null, ms = -9; const S = game.solid;
    for (const x of game.ALL) {
      if (x === W || x.downT > 0 || x.capT > 0) continue;
      const mx = x.pos.x - W.pos.x, mz = x.pos.z - W.pos.z, md = Math.hypot(mx, mz) || 1, dot = (mx * dx + mz * dz) / md;
      if (dot > 0.75 && md < game.LOB_MAX * S.range + 4 && dot - md * 0.01 > ms) { ms = dot - md * 0.01; m = x; }
    }
    return m;
  }
  function sliderPass(W) {
    const c = W.charge, S = game.solid, dx = Math.sin(W.yaw), dz = Math.cos(W.yaw);
    const lobK = get('lob', 1.5), bul = get('bullet', 24) * S.speed;
    const classic = (d) => (0.6 + d * 0.036) * S.hang;
    const flight = (d) => { const tl = classic(d) * lobK, tb = Math.min(d / bul, tl); return tl + (tb - tl) * c; };
    const m = mateAhead(W, dx, dz);
    let tx, tz;
    if (m) { tx = m.pos.x; tz = m.pos.z;
      for (let i = 0; i < 3; i++) { const t = flight(Math.hypot(tx - o.p.x, tz - o.p.z)); tx = m.pos.x + m.vel.x * t; tz = m.pos.z + m.vel.z * t; } }
    else { const d = game.LOB_MAX * S.range * (W.stThrow || 1) * (0.55 + 0.45 * c); tx = W.pos.x + dx * d; tz = W.pos.z + dz * d; }
    const d = Math.max(0.5, Math.hypot(tx - o.p.x, tz - o.p.z));
    game.lobTo(W, c, tx, tz, classic(d) / flight(d));
    if (m) FX.emit('pass', W, m);
  }
  function throwHook(W) {
    if (game.DUEL || W.crouchK > 0.5) return false;   // crouched throws still bowl
    if (sports() && W.labBtn === 'shot') { game.playerThrow(W, true); return true; }
    const t = game.time, air = !W.grounded || (t - (W.airCatchT || -9) < 1.4 && t - (W.landT || -9) < 0.22);   // as the game decides a jump throw
    const asPass = sports() ? W.labBtn === 'pass' : !air;   // classic buttons: a throw in the air stays a fastball
    if (get('slider', 0) && asPass) { sliderPass(W); return true; }
    return false;
  }
  const hook = () => { game.throwHook = sports() || get('slider', 0) ? throwHook : null; };

  // ---- perfect catches and one-timers
  let oneTimer = null, perfectFlash = 0;
  FX.on('catch', (W, caught) => {
    if (!get('perfect', 0) || !caught || !W.human || game.DUEL) return;
    const C = W.ctl; if (!(C.catchT > 0 && C.catchT <= 0.2 + 1e-6)) return;   // a dive's long catch window doesn't count
    if (0.2 - C.catchT > get('window', 0.12) + 1 / 60) return;
    o.res = Math.min(5, o.res + get('bonus', 1)); perfectFlash = 1;
    game.popup('PERFECT!', W.pos, '#ffffff', true); game.sparkBurst(o.p, 18, 3.2, 0.7); game.rumble(W, 0.2, 0.7, 90); game.shake(0.08);
    if (sports() && W.labBtn === 'shot' && o.res >= get('oop', 3)) oneTimer = W;
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
  function predict(mode) {   // where and when the Solid comes down: [time, x, z] or null
    if (o.state !== 'air' || o.touched || !o.last) return null;
    const g = game.G * game.solid.grav, h = 1 / 60; sim.copy(o.p); simV.copy(o.v);
    for (let i = 1; i <= 240; i++) {
      simV.y -= g * h; sim.addScaledVector(simV, h);
      for (const W of game.ALL) if (W !== o.last && (mode === 2 || W.human) && W.downT <= 0 && hd(sim, W.pos) < 0.9 && Math.abs(sim.y - (W.y + 0.55)) < 1) return [i * h, sim.x, sim.z];
      if (simV.y < 0 && sim.y < 0.9) {
        if (mode === 1 && !game.ALL.some((W) => W.human && W !== o.last && hd(sim, W.pos) < 3.5)) return null;
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
      uniforms: { t: { value: 0 }, col: { value: new T.Color() }, k: { value: 0 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vU; uniform float t; uniform vec3 col; uniform float k;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          vec2 p = vU; float r = length(p), a = atan(p.y, p.x);
          // tongues of flame around the Solid, licking upward, taller and wilder as k grows; the middle stays clear
          float f = n(vec2(a * 3.0, r * 3.5 - t * 3.2)) * 0.65 + n(vec2(a * 7.0 + 5.0, r * 7.0 - t * 5.3)) * 0.35;
          float reach = 0.34 + 0.22 * k + max(p.y, 0.0) * (0.25 + 0.45 * k) + (f - 0.45) * (0.25 + 0.35 * k);
          float body = smoothstep(reach, reach - 0.2, r) * smoothstep(0.16, 0.36, r);
          float lick = smoothstep(0.35, 0.85, f);
          vec3 c = mix(col, vec3(1.0), 0.15 + 0.35 * lick * k);
          float glow = smoothstep(0.55, 0.15, r) * 0.18;
          gl_FragColor = vec4(c * (body * (0.25 + 0.75 * lick) * (0.45 + 0.55 * k) + col * glow) * min(1.0, 0.35 + k), 1.0);
        }` });
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), mat); m.frustumCulled = false; m.renderOrder = 5; game.scene.add(m);
    const sats = [];
    const geo = new T.IcosahedronGeometry(0.055, 0);
    for (let i = 0; i < 10; i++) { const s = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      s.visible = false; game.scene.add(s); sats.push(s); }
    fire = { m, mat, sats };
  }
  function burn(dt, v) {
    heat += ((v && o.res ? 0.15 + o.res * 0.17 : 0) - heat) * (1 - Math.exp(-5 * dt));   // eases up and down, so a fizzle fades out
    if (!fire && heat < 0.01) return;
    if (!fire) makeFire();
    const k = heat * v, on = k > 0.01 && game.orbMesh.visible;
    fire.m.visible = on; for (const s of fire.sats) s.visible = false;
    if (!on) return;
    const S = game.solid; game.orbMesh.getWorldPosition(at);
    // brighter: light and colour
    game.orbLight.intensity += k * 2.5; if (S.coreMat) S.coreMat.color.lerp(WHITE, Math.min(1, k * 0.5));
    // the aura faces the camera
    fire.m.position.copy(at); fire.m.quaternion.copy(game.camera.quaternion); fire.m.scale.setScalar(1.0 + k * 0.9);
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
    if (oneTimer) fireOneTimer();
    const r = get('ring', 0); if (r || ring) showRing(r, dt);
    const f = get('fire', 0); if (f || fire) burn(dt, f);
    if (perfectFlash > 0) perfectFlash = Math.max(0, perfectFlash - dt * 3);
  }, 'lab');

  const OFFON = (x) => (x ? 'ON' : 'OFF');
  return [
    { id: 'buttons', label: 'Buttons', help: (x) => x ? 'X passes, Square shoots, Circle dives, R2 jumps (both catch)' : 'Cross jumps, Square catches and throws, Circle dives',
      min: 0, max: 1, step: 1, value: 0, dice: false, fmt: (x) => (x ? 'SPORTS' : 'CLASSIC'), apply: (x) => { buttons(x); hook(); } },
    { id: 'slider', label: 'Pass slider', help: 'Tap for a high lob, hold longer for flatter and faster, all the way to a bullet. Goes to the teammate you face, leading them',
      kind: 'onoff', value: 0, dice: false, apply: hook },
    { id: 'lob', label: 'Lob height', help: 'How high a tapped pass floats', min: 0.6, max: 3, step: 0.1, value: 1.5, dice: false },
    { id: 'bullet', label: 'Bullet speed', help: 'How fast a fully held pass flies', min: 10, max: 44, step: 1, value: 24, dice: false },
    { id: 'perfect', label: 'Perfect catch', help: 'Press catch just as the Solid arrives for extra resonance', kind: 'onoff', value: 0, dice: false },
    { id: 'window', label: 'Perfect timing', help: 'How exact it has to be (seconds); bigger is easier', min: 0.04, max: 0.3, step: 0.02, value: 0.12, dice: false, fmt: (x) => x.toFixed(2) + ' S' },
    { id: 'bonus', label: 'Perfect bonus', help: 'Extra resonance from a perfect catch', min: 0, max: 2, step: 1, value: 1, dice: false },
    { id: 'oop', label: 'One-timer from', help: 'With Sports buttons, a perfect catch with Square shoots at once (an alley-oop) when the Solid has this much resonance',
      min: 0, max: 5, step: 1, value: 3, dice: false, fmt: (x) => 'RES ' + x },
    { id: 'ring', label: 'Catch ring', help: 'A ring where the Solid comes down, closing as it arrives; white in the perfect window', min: 0, max: 2, step: 1, value: 0, dice: false,
      fmt: (x) => ['OFF', 'PASSES TO YOU', 'EVERY THROW'][x] },
    { id: 'ringTime', label: 'Ring time', help: 'How long before it arrives the ring starts closing', min: 0.3, max: 2, step: 0.1, value: 0.9, dice: false, fmt: (x) => x.toFixed(1) + ' S' },
    { id: 'fire', label: 'Fire aura', help: 'The Solid burns brighter as resonance builds: light, orbiting sparks, flames, embers', min: 0, max: 2, step: 0.1, value: 0, dice: true }
  ].map((t) => (t.kind === 'onoff' && !t.fmt ? { ...t, fmt: OFFON } : t));
});
