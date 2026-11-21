// Lab shelf: Sound. Sound effects for Void Wizard, all made by the Web Audio synth on the spot (no files: it works offline).
//   Throws whoosh (bigger with power), catches thock with a chime that climbs a scale as resonance builds, a perfect catch
//   rings, the wind-up hums and rises, resonance fizzles away, the Solid sparkles when it changes shape, hits on the
//   centipede thud (harder hits, deeper), a super shot booms, the centipede spits, splats, roars its fire breath, falls
//   with a boom, and its capture swells into a chord; wizards whoosh into dives, punch tackles, hop, land and grunt when knocked down.
//   Knobs: master volume, a volume for each group, Echo (a delay that trails every sound), Crunch (PS1-style bit crush).
// iOS only lets a page make sound after a touch: while it's still waiting, a small TAP FOR SOUND chip shows. The ringer
// switch doesn't silence it (the page asks for "playback" audio where Safari allows it).
// Nothing is made until Sound is switched on.
LAB.shelf('sound', 'Sound', (game) => {
  const FX = window.FEATURES, o = game.orb, get = (id, n) => LAB.get('sound.' + id) ?? n;
  let ctx = null, out = null, wet = null, crush = null, noiseBuf = null, chip = null;
  const on = () => !!get('on', 0);

  // ---- the mixer: every sound -> its group's volume -> (crunch) -> master -> limiter -> speakers, with an echo send
  const groups = {};
  function make() {
    if (ctx) return true;
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';   // the ringer switch doesn't mute it (iOS 17+)
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 8; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.2;
    out = ctx.createGain(); crush = ctx.createWaveShaper(); crush.oversample = 'none';
    out.connect(crush).connect(lim).connect(ctx.destination);
    // echo: a filtered delay that feeds back into itself
    const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(); wet = ctx.createGain();
    dl.delayTime.value = 0.19; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2600;
    wet.connect(dl); dl.connect(lp).connect(fb).connect(dl); lp.connect(out);
    for (const k of ['ball', 'hits', 'demon', 'wiz', 'magic']) { const g = ctx.createGain(); g.connect(out); g.connect(wet); groups[k] = g; }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    mix(); return true;
  }
  function mix() {
    if (!ctx) return;
    out.gain.value = on() ? get('volume', 0.8) : 0;
    for (const k in groups) groups[k].gain.value = get(k, 1);
    wet.gain.value = get('echo', 0.25);
    const bits = get('crunch', 0), n = 1024, c = new Float32Array(n);   // Crunch: fewer levels the higher it goes
    const steps = bits ? Math.pow(2, 9 - bits * 1.5) : 0;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = steps ? Math.round(x * steps) / steps : x; }
    crush.curve = c;
  }
  // a touch (or key) wakes the sound up; a controller press is tried too, though iOS doesn't count it
  const wake = () => { if (!on()) return; if (make() && ctx.state !== 'running') ctx.resume(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'mousedown']) window.addEventListener(ev, wake, { passive: true, capture: true });
  function showChip() {
    const need = on() && (!ctx || ctx.state !== 'running');
    if (need && !chip) {
      chip = document.createElement('div'); chip.textContent = 'TAP FOR SOUND';
      chip.style.cssText = 'position:fixed;right:10px;top:10px;z-index:30;font:700 11px/1 Saira,system-ui,sans-serif;letter-spacing:.08em;color:#fff;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 10px;pointer-events:none';
      document.body.appendChild(chip);
    }
    if (chip) chip.style.display = need ? '' : 'none';
  }

  // ---- little synth voices
  const live = () => on() && ctx && ctx.state === 'running';
  function tone(f0, f1, dur, { type = 'sine', vol = 0.2, g = 'ball', at = 0.004, delay = 0, lp = 0, q = 0.7 } = {}) {
    if (!live()) return;
    const t = ctx.currentTime + delay, os = ctx.createOscillator(), e = ctx.createGain();
    os.type = type; os.frequency.setValueAtTime(f0, t); if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + at); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = os; if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = q; n = os.connect(f); }
    n.connect(e).connect(groups[g]); os.start(t); os.stop(t + dur + 0.05);
  }
  function noise(dur, { vol = 0.2, g = 'ball', type = 'bandpass', f0 = 1200, f1 = f0, q = 1, at = 0.005, delay = 0 } = {}) {
    if (!live()) return;
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + at); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(e).connect(groups[g]); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const bell = (f, vol, g, delay = 0, dur = 0.5) => { tone(f, f, dur, { vol, g, delay, at: 0.003 }); tone(f * 2.76, f * 2.76, dur * 0.4, { vol: vol * 0.25, g, delay }); tone(f * 5.4, f * 5.4, dur * 0.2, { vol: vol * 0.1, g, delay }); };
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];   // a major pentatonic, so the climbing chimes always sound good together
  const note = (i, base = 523.25) => base * Math.pow(2, SCALE[Math.max(0, Math.min(SCALE.length - 1, i))] / 12);

  // ---- held sounds: the wind-up hum and the fire breath roar
  let hum = null, roar = null;
  function humTick(W) {
    const want = live() && W && W.charging;
    if (want && !hum) {
      const a = ctx.createOscillator(), b = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), e = ctx.createGain();
      a.type = 'sawtooth'; b.type = 'sine'; lfo.frequency.value = 7; lg.gain.value = 6; f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 3;
      lfo.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency); a.connect(f); b.connect(f); f.connect(e).connect(groups.magic);
      e.gain.value = 0.0001; e.gain.setTargetAtTime(0.07, ctx.currentTime, 0.05);
      a.start(); b.start(); lfo.start(); hum = { a, b, lfo, f, e };
    }
    if (hum && want) { const c = W.labAiming ? W.labPower : W.charge, f = 140 + c * 420, t = ctx.currentTime;
      hum.a.frequency.setTargetAtTime(f, t, 0.03); hum.b.frequency.setTargetAtTime(f * 2, t, 0.03); hum.f.frequency.setTargetAtTime(600 + c * 2600, t, 0.05); }
    if (hum && !want) { const h = hum; hum = null; if (ctx) { h.e.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); setTimeout(() => { try { h.a.stop(); h.b.stop(); h.lfo.stop(); } catch (e) {} }, 200); } }
  }
  function roarTick() {
    const want = live() && game.labBreathing;
    if (want && !roar) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 4; lfo.frequency.value = 11; lg.gain.value = 300;
      lfo.connect(lg).connect(f.frequency); s.connect(f).connect(e).connect(groups.demon);
      e.gain.value = 0.0001; e.gain.setTargetAtTime(0.32, ctx.currentTime, 0.08); s.start(); lfo.start(); roar = { s, e, lfo };
      tone(90, 55, 0.6, { type: 'sawtooth', vol: 0.12, g: 'demon', lp: 400 });
    }
    if (roar && !want) { const r = roar; roar = null; if (ctx) { r.e.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12); setTimeout(() => { try { r.s.stop(); r.lfo.stop(); } catch (e) {} }, 600); } }
  }

  // ---- the sounds, on the game's events
  FX.on('throw', (W, c) => {
    if (!live()) return; c = +c || 0;
    noise(0.16 + c * 0.16, { vol: 0.14 + c * 0.16, f0: 500, f1: 2600 + c * 2000, q: 1.4 });
    tone(110, 70, 0.08, { type: 'triangle', vol: 0.12 });
    setTimeout(() => { if (o.fast && !o.labSuper) noise(0.09, { vol: 0.2, type: 'highpass', f0: 3000, q: 0.7, g: 'ball' }); }, 0);   // a hard low shot cracks
  }, 'lab');
  let lastCatch = 0;
  FX.on('catch', (W, caught) => {
    if (!live()) return; const now = performance.now(); if (now - lastCatch < 60) return; lastCatch = now;
    tone(320, 160, 0.07, { type: 'triangle', vol: 0.2 }); noise(0.04, { vol: 0.1, f0: 2500, q: 2 });
    if (o.res > 0) bell(note(o.res), 0.07, 'magic', 0.02, 0.6);   // climbs a note with every level of resonance
  }, 'lab');
  FX.on('perfectCatch', () => { if (!live()) return; bell(note(5, 1046.5), 0.09, 'magic', 0, 0.7); bell(note(7, 1046.5), 0.07, 'magic', 0.07, 0.8); }, 'lab');
  FX.on('throwCancel', () => { tone(500, 220, 0.12, { type: 'square', vol: 0.05, g: 'ball', lp: 1400 }); }, 'lab');
  FX.on('superShot', () => {
    if (!live()) return;
    tone(80, 32, 0.9, { vol: 0.4, g: 'hits' }); noise(0.7, { vol: 0.28, f0: 300, f1: 4000, q: 0.9, at: 0.05, g: 'hits' });
    [0, 4, 7, 12].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12), 0.9, { type: 'triangle', vol: 0.06, g: 'magic', delay: i * 0.03, at: 0.02 }));
  }, 'lab');
  FX.on('demonHit', (dmg) => {
    if (!live()) return; const k = Math.min(1.6, Math.max(0.4, (dmg || 20) / 40)), sup = o.labSuper;
    tone(150 / Math.sqrt(k), 42, 0.22 + k * 0.12, { vol: 0.28 + k * 0.14, g: 'hits' });
    noise(0.1 + k * 0.08, { vol: 0.22 + k * 0.1, type: 'lowpass', f0: 1800, f1: 300, g: 'hits' });
    noise(0.05, { vol: 0.12, type: 'highpass', f0: 4000, g: 'hits' });
    if (sup) { tone(60, 28, 1.2, { vol: 0.45, g: 'hits' }); noise(1, { vol: 0.25, type: 'lowpass', f0: 2500, f1: 150, at: 0.01, g: 'hits' }); }
  }, 'lab');
  FX.on('demonDown', () => {
    if (!live()) return;
    tone(70, 30, 1.4, { vol: 0.42, g: 'demon' }); tone(240, 45, 1.3, { type: 'sawtooth', vol: 0.12, g: 'demon', lp: 700, q: 4 });
    noise(1.4, { vol: 0.25, type: 'lowpass', f0: 1200, f1: 120, at: 0.02, g: 'demon' });
  }, 'lab');
  FX.on('captureBurst', () => {
    if (!live()) return;
    noise(0.9, { vol: 0.18, f0: 400, f1: 6000, at: 0.6, g: 'magic' });   // a rising rush, then the chord
    [0, 4, 7, 11, 14].forEach((s, i) => tone(261.6 * Math.pow(2, s / 12), 261.6 * Math.pow(2, s / 12), 2.2, { type: i % 2 ? 'triangle' : 'sine', vol: 0.07, g: 'magic', at: 0.25, delay: 0.55 + i * 0.04 }));
    bell(1046.5, 0.08, 'magic', 0.6, 1.6);
  }, 'lab');
  FX.on('venomSplash', () => { noise(0.22, { vol: 0.12, type: 'lowpass', f0: 900, f1: 200, g: 'demon' }); }, 'lab');

  // ---- what isn't an event: watched each frame
  const was = new Map(); let prevRes = 0, prevSolid = null, prevSuper = false, spitT = 0, hitT = 0;
  FX.on('demonHit', () => { hitT = performance.now(); }, 'lab');
  FX.on('frame', (dt) => {
    showChip();
    if (!on()) { humTick(null); roarTick(); return; }
    if (!ctx) make();
    humTick(game.you); roarTick();
    // resonance lost (not to a hit, which spends it)
    if (o.res < prevRes && performance.now() - hitT > 150) { tone(900, 160, 0.35, { type: 'square', vol: 0.05, g: 'magic', lp: 1800 }); noise(0.3, { vol: 0.06, f0: 3000, f1: 600, q: 3, g: 'magic' }); }
    prevRes = o.res;
    if (prevSolid && game.solid !== prevSolid) { [0, 4, 7].forEach((s, i) => bell(784 * Math.pow(2, s / 12), 0.05, 'magic', i * 0.05, 0.35)); noise(0.3, { vol: 0.06, type: 'highpass', f0: 5000, g: 'magic' }); }
    prevSolid = game.solid;
    if (o.labSuper && !prevSuper) FX.emit('superShot'); prevSuper = !!o.labSuper;
    // the centipede spitting: a venom drop that wasn't flying last frame
    let spat = 0; for (const V of game.venoms) { if (V.alive && !V.labWas) spat++; V.labWas = V.alive; }
    if (spat && performance.now() - spitT > 120) { spitT = performance.now(); noise(0.09, { vol: 0.18, f0: 900, q: 1.5, g: 'demon' }); tone(280, 110, 0.12, { type: 'triangle', vol: 0.12, g: 'demon' }); }
    // wizards
    for (const W of game.ALL) {
      const p = was.get(W) || {}, now = { down: W.downT > 0, dive: W.diveT > 0, lunge: W.lungeT > 0, ground: !!W.grounded, air: W.grounded ? 0 : (p.air || 0) + dt };
      const near = W === game.you ? 1 : 0.6;
      if (now.down && !p.down) { tone(260, 80, 0.22, { type: 'square', vol: 0.09 * near, g: 'wiz', lp: 900 }); tone(110, 50, 0.2, { vol: 0.25 * near, g: 'wiz' }); }
      if (now.dive && !p.dive) noise(0.28, { vol: 0.16 * near, f0: 1800, f1: 500, q: 1.2, g: 'wiz' });
      if (now.lunge && !p.lunge) { tone(180, 70, 0.1, { vol: 0.25 * near, g: 'wiz' }); noise(0.07, { vol: 0.14 * near, type: 'lowpass', f0: 2000, g: 'wiz' }); }
      if (!now.ground && p.ground && W.vy > 2) tone(320, 640, 0.09, { type: 'triangle', vol: 0.07 * near, g: 'wiz' });
      if (now.ground && p.ground === false && (p.air || 0) > 0.3) { tone(130, 60, 0.09, { vol: 0.16 * near, g: 'wiz' }); noise(0.05, { vol: 0.06 * near, type: 'lowpass', f0: 900, g: 'wiz' }); }
      was.set(W, now);
    }
  }, 'lab');

  const pct = (x) => Math.round(x * 100) + '%';
  return [
    { id: 'on', label: 'Sound', help: 'Sound effects (on an iPhone, tap the screen once to let them play)', kind: 'onoff', value: 0, dice: false, fmt: (x) => (x ? 'ON' : 'OFF'), apply: () => { if (on()) make(); mix(); } },
    { id: 'volume', label: 'Volume', help: 'Everything together', min: 0, max: 1.5, step: 0.05, value: 0.8, dice: false, fmt: pct, apply: mix },
    { id: 'ball', label: 'Throws and catches', help: 'Whooshes, thocks and the cancel blip', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'magic', label: 'Resonance', help: 'The chimes as it builds, the perfect-catch ring, the wind-up hum, fizzles and shape changes', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'hits', label: 'Hits', help: 'The Solid hitting the centipede, and the super shot', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'demon', label: 'Centipede', help: 'Spit, splats, fire breath and its fall', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'wiz', label: 'Wizards', help: 'Dives, tackles, hops, landings and knockdowns', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'echo', label: 'Echo', help: 'A trailing echo on every sound', min: 0, max: 1, step: 0.05, value: 0.25, dice: true, fmt: pct, apply: mix },
    { id: 'crunch', label: 'Crunch', help: 'Crushes the sound down to fewer levels, like an old console', min: 0, max: 4, step: 1, value: 0, dice: true, fmt: (x) => (x ? x + '' : 'OFF'), apply: mix }
  ];
});
