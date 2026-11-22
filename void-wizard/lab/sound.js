// Lab shelf: Sound. Sound effects and music for Void Wizard in the style of PS1 and PS2 games, made by a Web Audio synth
// on the spot (no files: it works offline). What makes it sound like that era:
//   - every sound goes through a big console-style reverb (a made-up room the sounds ring out in), and the whole mix is
//     softened at the top and gently driven, like a console's sound chip; Crunch takes it further toward the PS1;
//   - sounds are built in layers, the way sampled effects were: a hit is a deep thump, a body and a crack together;
//   - magic is glassy FM bells and shimmer; voices are breathy formant grunts; whooshes sweep across the speakers.
// Effects: throws whoosh (bigger with power, a hard low shot cracks), catches thump with a bell that climbs a scale as
// resonance builds, a perfect catch rings, the wind-up clicks lightly like a toy being wound, resonance fizzles, the Solid
// shimmers when it changes shape, hits on the centipede land deep (a super shot is huge), the centipede spits, splats,
// roars its fire breath and falls, the capture swells into a choir; wizards dive, tackle, hop, land and grunt.
// Music: a moody loop (pads, bass, breakbeat, bells) that builds with the fight: calm when nothing's going on, drums
// when the centipede is up, bells on top when the Solid is on fire.
// iOS only lets a page make sound after a touch: until then a small TAP FOR SOUND chip shows. The ringer switch doesn't
// silence it (the page asks for "playback" audio where Safari allows it).
// LAB.soundEngine(ctx) makes the same sounds on any audio context (the tests render previews with it).
// Nothing is made until Sound or Music is switched on.
LAB.shelf('sound', 'Sound', (game) => {
  const FX = window.FEATURES, o = game.orb, get = (id, n) => LAB.get('sound.' + id) ?? n;

  // ====== the engine: everything that makes sound, on whatever audio context it's handed ======
  function makeEngine(ctx) {
    const E = { ctx, at: null };   // at: a fixed time to play at (an offline render), otherwise now
    const now = () => (E.at != null ? E.at : ctx.currentTime);
    const R = Math.random;

    // ---- the chain: groups -> master -> console softening -> drive -> crunch -> limiter, with a reverb send
    const master = ctx.createGain(), spu = ctx.createBiquadFilter(), drive = ctx.createWaveShaper(), crush = ctx.createWaveShaper(), lim = ctx.createDynamicsCompressor();
    spu.type = 'lowpass'; spu.frequency.value = 11000; spu.Q.value = 0.4;
    const dc = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 1023 * 2 - 1; dc[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); } drive.curve = dc;
    lim.threshold.value = -8; lim.knee.value = 10; lim.ratio.value = 6; lim.attack.value = 0.004; lim.release.value = 0.25;
    master.connect(spu).connect(drive).connect(crush).connect(lim).connect(ctx.destination);
    E.master = master;
    // the room: a stereo burst of noise that dies away and darkens, like the PS1's own reverb
    const verb = ctx.createConvolver(), verbIn = ctx.createGain(), verbOut = ctx.createGain();
    { const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let y = 0;
        for (let i = 0; i < len; i++) { const u = i / len, x = (R() * 2 - 1) * Math.pow(1 - u, 3.2); const a = 0.55 - 0.48 * u; y += a * (x - y); d[i] = y * (i < ctx.sampleRate * 0.012 ? 0 : 1); }
        for (const ms of [17, 29, 41, 61, 83]) { const k = Math.floor(ctx.sampleRate * (ms + ch * 3) / 1000); d[k] += 0.5 * (1 - ms / 120); }   // early reflections
      }
      verb.buffer = ir; }
    verbIn.connect(verb).connect(verbOut).connect(master); verbOut.gain.value = 0.9;
    // one bus per kind of sound, each with a dry part and a reverb part
    const G = {};
    for (const k of ['ball', 'magic', 'hits', 'demon', 'wiz', 'wind', 'music']) {
      const dry = ctx.createGain(), wet = ctx.createGain(), vol = ctx.createGain();
      vol.connect(dry).connect(master); vol.connect(wet).connect(verbIn); G[k] = { vol, dry, wet };
    }
    E.groups = G;
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
    E.set = ({ volume = 0.8, vols = {}, room = 0.5, crunch = 0 } = {}) => {
      master.gain.value = volume;
      for (const k in G) { G[k].vol.gain.value = vols[k] ?? 1; G[k].wet.gain.value = room * 1.6; }
      const steps = crunch ? Math.pow(2, 10 - crunch * 1.6) : 0, c = new Float32Array(2048);
      for (let i = 0; i < 2048; i++) { const x = i / 2047 * 2 - 1; c[i] = steps ? Math.round(x * steps) / steps : x; } crush.curve = c;
      spu.frequency.value = crunch ? 11000 - crunch * 1800 : 11000;
    };

    // ---- building blocks. Every one ends in out(): a pan, then its group (dry), plus a reverb send
    function out(node, g, rev = 0.3, pan = 0) {
      let n = node;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n = n.connect(p); }
      n.connect(G[g].vol);
      if (rev) { const s = ctx.createGain(); s.gain.value = rev; n.connect(s).connect(G[g].wet); }
    }
    function env(t, at, dur, vol, hold = 0) {   // up fast, (hold), then die away
      const e = ctx.createGain(); e.gain.value = 0.0001; e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + at);   // silent from the start: no pop on the first sample
      if (hold) e.gain.setValueAtTime(vol, t + at + hold);
      e.gain.exponentialRampToValueAtTime(0.0001, t + at + hold + dur); return e;
    }
    function osc(t, type, f0, f1, dur, vol, { at = 0.003, g = 'ball', rev = 0.25, pan = 0, lp = 0, q = 0.7, hold = 0, detune = 0 } = {}) {
      const s = ctx.createOscillator(); s.type = type; s.detune.value = detune;
      s.frequency.setValueAtTime(f0, t); if (f1 !== f0) s.frequency.exponentialRampToValueAtTime(Math.max(15, f1), t + at + hold + dur);
      let n = s; if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = q; n = n.connect(f); }
      const e = env(t, at, dur, vol, hold); out(n.connect(e), g, rev, pan); s.start(t); s.stop(t + at + hold + dur + 0.05);
    }
    function hiss(t, dur, vol, { type = 'bandpass', f0 = 1200, f1 = f0, q = 1, at = 0.004, g = 'ball', rev = 0.25, pan = 0, pan1 = null, hold = 0 } = {}) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(); s.buffer = noiseBuf; s.loop = true;
      f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + at + hold + dur);
      const e = env(t, at, dur, vol, hold); let n = s.connect(f).connect(e);
      if (pan1 != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(pan, t); p.pan.linearRampToValueAtTime(pan1, t + at + dur); n = n.connect(p); pan = 0; }
      out(n, g, rev, pan); s.start(t, R() * 1.5); s.stop(t + at + hold + dur + 0.05);
    }
    // a glassy FM bell: a sine bent by another sine whose bite fades fast
    function bell(t, f, dur, vol, { ratio = 3.5, index = 2.2, g = 'magic', rev = 0.55, pan = 0 } = {}) {
      const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(); c.frequency.value = f; m.frequency.value = f * ratio;
      mg.gain.setValueAtTime(f * ratio * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.5);
      m.connect(mg).connect(c.frequency); const e = env(t, 0.002, dur, vol); out(c.connect(e), g, rev, pan);
      c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
    }
    // a voice: a buzzy pitch through two vowel formants, plus breath
    function grunt(t, f0, f1, dur, vol, { a = 650, b = 1100, g = 'wiz', rev = 0.2, pan = 0 } = {}) {
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const e = env(t, 0.015, dur, vol);
      for (const [f, q, k] of [[a, 7, 1], [b, 9, 0.6]]) { const bp = ctx.createBiquadFilter(), kg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; kg.gain.value = k; s.connect(bp).connect(kg).connect(e); }
      out(e, g, rev, pan); s.start(t); s.stop(t + dur + 0.05);
      hiss(t, dur * 0.8, vol * 0.3, { f0: 1600, q: 1.5, g, rev, pan });
    }
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
    const pitch = (i, base) => base * Math.pow(2, PENTA[Math.max(0, Math.min(PENTA.length - 1, i))] / 12);
    const semis = (base, s) => base * Math.pow(2, s / 12);

    // ====== the effects ======
    const S = E.sfx = {};
    S.throw = (c = 0.5, pan = 0, fast = false) => { const t = now();
      hiss(t, 0.22 + c * 0.22, 0.22 + c * 0.2, { f0: 350, f1: 2200 + c * 2600, q: 1.6, pan: pan - 0.3, pan1: pan + 0.3, rev: 0.25 });   // the whoosh crosses the speakers
      osc(t, 'sine', 150, 60, 0.12, 0.25, { rev: 0.1 });
      if (c > 0.4) for (let i = 0; i < 3; i++) bell(t + 0.04 + i * 0.035, semis(1568, i * 5), 0.35, 0.03 * c, { index: 1.2, rev: 0.6, pan: pan + (i - 1) * 0.3 });   // a little magic on a strong throw
      if (fast) { hiss(t, 0.08, 0.3, { type: 'highpass', f0: 3500, q: 0.8, rev: 0.4, g: 'hits' }); osc(t, 'square', 90, 45, 0.1, 0.08, { lp: 900, rev: 0.2 }); }
    };
    S.catch = (res = 0, pan = 0) => { const t = now();
      osc(t, 'sine', 170, 70, 0.1, 0.38, { rev: 0.12, pan }); hiss(t, 0.05, 0.16, { type: 'lowpass', f0: 2800, pan, rev: 0.1 });   // the thump into the hands
      hiss(t, 0.025, 0.1, { f0: 4200, q: 2, pan });
      if (res > 0) { bell(t + 0.015, pitch(res - 1, 587.3), 1.2, 0.11, { pan }); bell(t + 0.015, pitch(res - 1, 587.3) * 2, 0.6, 0.03, { index: 1, pan }); }   // climbs with resonance
    };
    S.perfect = () => { const t = now();
      [0, 4, 7, 12].forEach((s, i) => bell(t + i * 0.045, semis(1174.7, s), 1.4, 0.07, { ratio: 2.01, index: 1.6, pan: (i - 1.5) * 0.4 }));
      hiss(t, 0.6, 0.06, { type: 'highpass', f0: 6000, at: 0.02, rev: 0.7, g: 'magic' });
    };
    S.cancel = () => { const t = now(); osc(t, 'triangle', 660, 220, 0.18, 0.08, { g: 'magic', rev: 0.4, lp: 2400 }); hiss(t, 0.15, 0.04, { f0: 3000, f1: 800, g: 'magic' }); };
    S.fizzle = () => { const t = now();
      for (let i = 0; i < 6; i++) bell(t + i * 0.05, semis(1760, -i * 2.2), 0.3, 0.035, { index: 3, rev: 0.6, pan: (R() - 0.5) * 1.2 });
      hiss(t, 0.5, 0.07, { f0: 5000, f1: 600, q: 4, g: 'magic', rev: 0.5 });
    };
    S.morph = () => { const t = now();
      hiss(t, 0.45, 0.12, { f0: 600, f1: 5000, q: 2, at: 0.2, g: 'magic', rev: 0.6, pan: -0.6, pan1: 0.6 });
      [0, 7, 12, 19].forEach((s, i) => bell(t + 0.12 + i * 0.05, semis(784, s), 0.9, 0.05, { ratio: 1.5, index: 2.5 }));
    };
    S.hit = (k = 1, sup = false) => { const t = now(); k = Math.max(0.4, Math.min(1.6, k));
      osc(t, 'sine', 120 / Math.sqrt(k), 38, 0.3 + k * 0.15, 0.5 + k * 0.15, { g: 'hits', rev: 0.25 });   // the deep thump
      hiss(t, 0.18 + k * 0.12, 0.4 + k * 0.1, { type: 'lowpass', f0: 1400, f1: 220, g: 'hits', rev: 0.35 });   // the body
      hiss(t, 0.04, 0.3, { type: 'highpass', f0: 3000, g: 'hits', rev: 0.3 });   // the crack
      osc(t, 'square', 75, 50, 0.12, 0.09, { g: 'hits', lp: 700, rev: 0.2 });   // crunch
      if (sup) { osc(t, 'sine', 55, 25, 1.6, 0.6, { g: 'hits', rev: 0.4 }); hiss(t, 1.4, 0.35, { type: 'lowpass', f0: 3000, f1: 100, at: 0.01, g: 'hits', rev: 0.7 }); }
    };
    S.super = () => { const t = now();
      hiss(t, 0.5, 0.3, { f0: 200, f1: 5000, q: 1.2, at: 0.25, g: 'hits', rev: 0.5 });   // rushing up
      choir(t, [0, 7, 12, 16], 220, 1.6, 0.06);
      osc(t + 0.2, 'sine', 70, 30, 0.9, 0.4, { g: 'hits', rev: 0.4 });
    };
    function choir(t, steps, base, dur, vol, g = 'magic') {   // an "aah": detuned saws through vowel formants
      for (const s of steps) for (const d of [-9, 9]) {
        const f = semis(base, s), so = ctx.createOscillator(); so.type = 'sawtooth'; so.frequency.value = f; so.detune.value = d;
        const e = env(t, 0.35, dur, vol, dur * 0.3);
        for (const [ff, q, kk] of [[750, 6, 1], [1150, 8, 0.5], [2600, 10, 0.15]]) { const bp = ctx.createBiquadFilter(), kg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; kg.gain.value = kk; so.connect(bp).connect(kg).connect(e); }
        out(e, g, 0.8, d > 0 ? 0.35 : -0.35); so.start(t); so.stop(t + 0.35 + dur * 1.3 + 0.1);
      }
    }
    S.spit = (pan = 0) => { const t = now();
      hiss(t, 0.12, 0.25, { f0: 1400, f1: 700, q: 2, g: 'demon', rev: 0.25, pan });
      osc(t, 'sine', 380, 110, 0.14, 0.2, { g: 'demon', rev: 0.2, pan });
      osc(t + 0.03, 'triangle', 90, 60, 0.12, 0.12, { g: 'demon', pan });   // a gurgle
    };
    S.splat = (pan = 0) => { const t = now(); hiss(t, 0.25, 0.2, { type: 'lowpass', f0: 1100, f1: 180, g: 'demon', rev: 0.3, pan }); osc(t, 'sine', 160, 60, 0.1, 0.15, { g: 'demon', pan }); };
    S.down = () => { const t = now();
      S.hit(1.6);
      osc(t + 0.05, 'sawtooth', 180, 35, 1.8, 0.16, { g: 'demon', lp: 600, q: 5, rev: 0.6 });   // a long falling growl
      grunt(t + 0.05, 120, 45, 1.4, 0.35, { a: 450, b: 900, g: 'demon', rev: 0.6 });
      hiss(t + 0.1, 1.8, 0.2, { type: 'lowpass', f0: 900, f1: 90, at: 0.05, g: 'demon', rev: 0.7 });   // rumble and debris
    };
    S.burst = () => { const t = now();
      hiss(t, 0.8, 0.16, { f0: 300, f1: 7000, q: 1, at: 0.55, g: 'magic', rev: 0.6 });
      choir(t + 0.5, [0, 4, 7, 11, 14], 261.6, 2.4, 0.05);
      for (let i = 0; i < 8; i++) bell(t + 0.55 + i * 0.07, pitch(i, 1046.5), 1.6, 0.045, { pan: (i % 2 ? 0.5 : -0.5), ratio: 2.01 });
    };
    S.dive = (pan = 0, v = 1) => { const t = now(); hiss(t, 0.32, 0.26 * v, { f0: 900, f1: 280, q: 1.3, g: 'wiz', rev: 0.15, pan, pan1: pan * -1 }); };
    S.tackle = (pan = 0, v = 1) => { const t = now(); osc(t, 'sine', 140, 55, 0.14, 0.4 * v, { g: 'wiz', rev: 0.15, pan }); hiss(t, 0.08, 0.25 * v, { type: 'lowpass', f0: 2500, g: 'wiz', pan }); grunt(t, 180, 150, 0.12, 0.12 * v, { a: 700, b: 1200, pan }); };
    S.jump = (pan = 0, v = 1) => { const t = now(); hiss(t, 0.14, 0.1 * v, { f0: 700, f1: 1800, q: 1.2, g: 'wiz', pan }); grunt(t, 210, 260, 0.1, 0.08 * v, { a: 600, b: 1700, pan }); };
    S.land = (pan = 0, v = 1) => { const t = now(); osc(t, 'sine', 110, 50, 0.12, 0.3 * v, { g: 'wiz', rev: 0.1, pan }); hiss(t, 0.16, 0.1 * v, { type: 'lowpass', f0: 1200, f1: 400, g: 'wiz', pan }); };
    S.knock = (pan = 0, v = 1) => { const t = now(); S.land(pan, v * 1.3); grunt(t + 0.02, 200, 110, 0.3, 0.3 * v, { a: 600, b: 1000, pan }); };   // "oof"

    // ---- the wind-up: tiny, light clicks, like winding a toy; one each time the power steps up, a touch higher each time.
    // Nothing while the power isn't changing.
    E.tick = (k, pan = 0) => { const t = now();
      hiss(t, 0.005, 0.012, { type: 'highpass', f0: 5200 + k * 140, q: 0.8, g: 'wind', rev: 0.06, pan, at: 0.0008 });
      osc(t, 'sine', 2600 + k * 90, 2600 + k * 90, 0.016, 0.004, { g: 'wind', rev: 0.08, pan, at: 0.0008 });
    };
    E.charge = (c) => {   // c: 0..1 while winding up; null stops
      if (c == null) { E._step = null; return; }
      const st = Math.floor(c * 16);
      if (E._step == null) { E._step = st; return; }
      if (st !== E._step) { E.tick(st); E._step = st; }
    };
    E.roar = (on) => {
      if (!on) { if (E._roar) { const r = E._roar; E._roar = null; r.e.gain.setTargetAtTime(0.0001, now(), 0.15); r.stop(now() + 0.8); } return; }
      if (E._roar) return;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), growl = ctx.createOscillator(), gf = ctx.createBiquadFilter(), gg = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2; lfo.frequency.value = 9; lg.gain.value = 400;
      growl.type = 'sawtooth'; growl.frequency.value = 55; gf.type = 'lowpass'; gf.frequency.value = 320; gg.gain.value = 0.5;
      lfo.connect(lg).connect(f.frequency); s.connect(f).connect(e); growl.connect(gf).connect(gg).connect(e); out(e, 'demon', 0.45);
      e.gain.value = 0.0001; e.gain.setTargetAtTime(0.4, now(), 0.1); s.start(); lfo.start(); growl.start();
      E._roar = { e, stop: (t) => { s.stop(t); lfo.stop(t); growl.stop(t); } };
    };

    // ====== the music: D minor, 88 a minute, four bars round and round ======
    const M = E.music = { bpm: 88, step: 0, next: 0, layers: {} };
    const L = M.layers;
    for (const k of ['pad', 'bass', 'drums', 'bells']) { L[k] = ctx.createGain(); L[k].connect(G.music.vol); }
    const lsend = ctx.createGain(); lsend.gain.value = 1; L.pad.connect(lsend); L.bells.connect(lsend); lsend.connect(G.music.wet);   // pads and bells live in the reverb
    const dsend = ctx.createGain(); dsend.gain.value = 0.25; L.drums.connect(dsend).connect(G.music.wet);
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);   // a MIDI note to its pitch
    const CHORDS = [[50, 53, 57, 60, 64], [46, 50, 53, 57, 62], [43, 46, 50, 53, 57], [45, 50, 52, 55, 61]];   // Dm9, Bbmaj7, Gm9, A7sus
    const ROOT = [38, 34, 31, 33];
    const BELLS = [[0, 74], [3, 77], [6, 81], [8, 79], [11, 76], [14, 72]];   // step, note: a little figure over each bar
    M.intensity = (k) => { const t = now(); L.pad.gain.setTargetAtTime(0.9, t, 0.5); L.bass.gain.setTargetAtTime(k >= 1 ? 1 : 0.75, t, 0.5);
      L.drums.gain.setTargetAtTime(k >= 1 ? 1 : 0.0001, t, 0.6); L.bells.gain.setTargetAtTime(k >= 2 ? 1 : 0.0001, t, 0.8); };
    function v(t, type, f, at, dur, vol, layer, { lp = 0, q = 0.7, detune = 0, hold = 0 } = {}) {
      const s = ctx.createOscillator(); s.type = type; s.frequency.value = f; s.detune.value = detune;
      let n = s; if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; n = n.connect(fl); }
      n.connect(env(t, at, dur, vol, hold)).connect(L[layer]); s.start(t); s.stop(t + at + hold + dur + 0.05);
    }
    function drum(t, kind, vol = 1) {
      if (kind === 'k') { const s = ctx.createOscillator(); s.frequency.setValueAtTime(160, t); s.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        s.connect(env(t, 0.002, 0.3, 0.55 * vol)).connect(L.drums); s.start(t); s.stop(t + 0.35); }
      const nz = (dur, vv, type, f, q) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        s.connect(fl).connect(env(t, 0.002, dur, vv)).connect(L.drums); s.start(t, R()); s.stop(t + dur + 0.05); };
      if (kind === 'k') nz(0.01, 0.15 * vol, 'highpass', 2000, 0.5);
      if (kind === 's') { nz(0.2, 0.32 * vol, 'bandpass', 1900, 0.6); const s = ctx.createOscillator(); s.type = 'triangle'; s.frequency.setValueAtTime(200, t); s.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        s.connect(env(t, 0.002, 0.1, 0.18 * vol)).connect(L.drums); s.start(t); s.stop(t + 0.15); }
      if (kind === 'h') nz(0.045, 0.07 * vol, 'highpass', 7500, 0.7);
      if (kind === 'o') nz(0.22, 0.06 * vol, 'highpass', 6500, 0.7);
    }
    M.play = (t, step) => {   // one sixteenth
      const s16 = 60 / M.bpm / 4, i = step % 16, bar = Math.floor(step / 16) % 4, sw = i % 2 ? s16 * 0.12 : 0, tt = t + sw;   // a little swing
      if (i === 0) for (const n of CHORDS[bar]) for (const d of [-7, 7]) v(t, 'sawtooth', N(n), 0.5, s16 * 16, 0.028, 'pad', { lp: 1300, q: 1, detune: d, hold: s16 * 8 });
      if (i === 0 || i === 6 || i === 10) { const n = ROOT[bar] + (i === 10 ? 7 : 0); v(tt, 'sine', N(n), 0.01, s16 * 3.5, 0.32, 'bass'); v(tt, 'triangle', N(n + 12), 0.01, s16 * 2, 0.06, 'bass', { lp: 800 }); }
      if (i === 0 || i === 7 || i === 10) drum(tt, 'k');
      if (i === 4 || i === 12) drum(tt, 's');
      if (i === 15) drum(tt, 's', 0.3);
      if (i % 2 === 0) drum(tt, 'h', i % 4 === 2 ? 1 : 0.6); else drum(tt, 'h', 0.25);
      if (i === 14) drum(tt, 'o');
      for (const [st, n] of BELLS) if (st === i) { const nn = n + (bar === 3 && st > 7 ? 1 : 0); const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain();
        c.frequency.value = N(nn); m.frequency.value = N(nn) * 3.5; mg.gain.setValueAtTime(N(nn) * 6, tt); mg.gain.exponentialRampToValueAtTime(N(nn) * 0.1, tt + 0.4);
        m.connect(mg).connect(c.frequency); c.connect(env(tt, 0.002, 0.9, 0.05)).connect(L.bells); c.start(tt); m.start(tt); c.stop(tt + 1); m.stop(tt + 1); }
    };
    M.tick = (ahead = 0.3) => {   // keep the next few sixteenths booked
      const s16 = 60 / M.bpm / 4; if (M.next < ctx.currentTime) M.next = ctx.currentTime + 0.05;
      while (M.next < ctx.currentTime + ahead) { M.play(M.next, M.step); M.next += s16; M.step++; }
    };
    return E;
  }
  LAB.soundEngine = makeEngine;

  // ====== the shelf: one live engine, woken by a touch ======
  let ctx = null, E = null, chip = null, timer = null;
  const anyOn = () => !!(get('on', 0) || get('music', 0));
  function wantEngine() {
    if (E) return true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; ctx = new (window.AudioContext || window.webkitAudioContext)(); E = makeEngine(ctx); }
    catch (e) { return false; }
    mix(); return true;
  }
  function mix() {
    if (!E) return;
    E.set({ volume: get('volume', 0.8), room: get('room', 0.5), crunch: get('crunch', 0),
      vols: { ball: get('ball', 1), magic: get('magic', 1), hits: get('hits', 1), demon: get('demon', 1), wiz: get('wiz', 1), wind: get('wind', 1), music: get('music', 0) * (get('on', 0) || get('music', 0) ? 1 : 0) } });
    if (!get('on', 0)) for (const k of ['ball', 'magic', 'hits', 'demon', 'wiz', 'wind']) E.groups[k].vol.gain.value = 0;
    music();
  }
  function music() {   // books notes ahead on a timer while Music is up
    const on = E && get('music', 0) > 0;
    if (on && !timer) { E.music.next = 0; timer = setInterval(() => { if (ctx && ctx.state === 'running') E.music.tick(); }, 60); }
    if (!on && timer) { clearInterval(timer); timer = null; }
  }
  const wake = () => { if (!anyOn()) return; if (wantEngine() && ctx.state !== 'running') ctx.resume(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'mousedown']) window.addEventListener(ev, wake, { passive: true, capture: true });
  function showChip() {
    const need = anyOn() && (!ctx || ctx.state !== 'running');
    if (need && !chip) {
      chip = document.createElement('div'); chip.textContent = 'TAP FOR SOUND';
      chip.style.cssText = 'position:fixed;right:10px;top:10px;z-index:30;font:700 11px/1 Saira,system-ui,sans-serif;letter-spacing:.08em;color:#fff;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 10px;pointer-events:none';
      document.body.appendChild(chip);
    }
    if (chip) chip.style.display = need ? '' : 'none';
  }
  const live = () => get('on', 0) && E && ctx.state === 'running';
  const panOf = (p) => { const c = game.camera; if (!c || !p) return 0; const v = p.clone().project(c); return Math.max(-0.8, Math.min(0.8, v.x * 0.8)); };   // where it is on screen
  const nearOf = (W) => (W === game.you ? 1 : 0.6);

  // ---- the game's events
  FX.on('throw', (W, c) => { if (!live()) return; setTimeout(() => E.sfx.throw(+c || 0, panOf(W && W.pos), !!o.fast && !o.labSuper), 0); }, 'lab');
  let lastCatch = 0;
  FX.on('catch', (W) => { if (!live()) return; const t = performance.now(); if (t - lastCatch < 60) return; lastCatch = t; E.sfx.catch(o.res, panOf(W && W.pos)); }, 'lab');
  FX.on('perfectCatch', () => { if (live()) E.sfx.perfect(); }, 'lab');
  FX.on('throwCancel', () => { if (live()) E.sfx.cancel(); }, 'lab');
  FX.on('demonHit', (dmg) => { if (live()) E.sfx.hit((dmg || 20) / 40, !!o.labSuper); hitAt = performance.now(); }, 'lab');
  FX.on('demonDown', () => { if (live()) E.sfx.down(); }, 'lab');
  FX.on('captureBurst', () => { if (live()) E.sfx.burst(); }, 'lab');
  FX.on('venomSplash', (V) => { if (live()) E.sfx.splat(panOf(V && V.g && V.g.position)); }, 'lab');

  // ---- what isn't an event, watched each frame; and the music's mood
  const was = new Map(); let prevRes = 0, prevSolid = null, prevSuper = false, spitAt = 0, hitAt = 0, mood = -1;
  FX.on('frame', (dt) => {
    showChip();
    if (!anyOn()) { if (E) { E.charge(null); E.roar(false); } return; }
    if (!E) wantEngine();
    if (!live()) { E.charge(null); E.roar(false); }
    else {
      const me = game.you; E.charge(me && me.charging ? (me.labAiming ? me.labPower : me.charge) : null);
      E.roar(!!game.labBreathing);
      if (o.res < prevRes && performance.now() - hitAt > 150) E.sfx.fizzle();
      if (prevSolid && game.solid !== prevSolid) E.sfx.morph();
      if (o.labSuper && !prevSuper) E.sfx.super();
      let spat = null; for (const V of game.venoms) { if (V.alive && !V.labWas) spat = V; V.labWas = V.alive; }
      if (spat && performance.now() - spitAt > 120) { spitAt = performance.now(); E.sfx.spit(panOf(spat.g.position)); }
      for (const W of game.ALL) {
        const p = was.get(W) || {}, n = { down: W.downT > 0, dive: W.diveT > 0, lunge: W.lungeT > 0, ground: !!W.grounded, air: W.grounded ? 0 : (p.air || 0) + dt };
        const pan = panOf(W.pos), k = nearOf(W);
        if (n.down && !p.down) E.sfx.knock(pan, k);
        else if (n.dive && !p.dive) E.sfx.dive(pan, k);
        if (n.lunge && !p.lunge) E.sfx.tackle(pan, k);
        if (!n.ground && p.ground && W.vy > 2) E.sfx.jump(pan, k);
        if (n.ground && p.ground === false && (p.air || 0) > 0.3 && !n.down) E.sfx.land(pan, k);
        was.set(W, n);
      }
    }
    prevRes = o.res; prevSolid = game.solid; prevSuper = !!o.labSuper;
    // music: calm with no fight, drums while the centipede is up, bells on top when the Solid is on fire
    if (E && get('music', 0)) { const d = game.demon, k = !(d.alive && !d.dying) ? 0 : o.res >= 3 ? 2 : 1; if (k !== mood) { mood = k; E.music.intensity(k); } }
  }, 'lab');

  const pct = (x) => Math.round(x * 100) + '%';
  return [
    { id: 'on', label: 'Sound', help: 'Sound effects, in the style of PS1 and PS2 games (on an iPhone, tap the screen once to let them play)', kind: 'onoff', value: 0, dice: false,
      fmt: (x) => (x ? 'ON' : 'OFF'), apply: () => { if (anyOn()) wantEngine(); mix(); } },
    { id: 'music', label: 'Music', help: 'A moody loop that builds with the fight: drums when the centipede is up, bells when the Solid is on fire', min: 0, max: 1.5, step: 0.05, value: 0, dice: false,
      fmt: (x) => (x ? pct(x) : 'OFF'), apply: () => { if (anyOn()) wantEngine(); mix(); } },
    { id: 'volume', label: 'Volume', help: 'Everything together', min: 0, max: 1.5, step: 0.05, value: 0.8, dice: false, fmt: pct, apply: mix },
    { id: 'ball', label: 'Throws and catches', help: 'Whooshes and the thump of a catch', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'magic', label: 'Resonance', help: 'The bells as it builds, the perfect-catch chime, fizzles and shape changes', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'wind', label: 'Wind-up clicks', help: 'The light clicks as you wind up or set a throw, like winding a toy', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: (x) => (x ? Math.round(x * 100) + '%' : 'OFF'), apply: mix },
    { id: 'hits', label: 'Hits', help: 'The Solid hitting the centipede, and the super shot', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'demon', label: 'Centipede', help: 'Spit, splats, fire breath and its fall', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'wiz', label: 'Wizards', help: 'Dives, tackles, hops, landings and grunts', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: pct, apply: mix },
    { id: 'room', label: 'Room', help: 'How much the sounds ring out in the console-style reverb', min: 0, max: 1, step: 0.05, value: 0.5, dice: true, fmt: pct, apply: mix },
    { id: 'crunch', label: 'Crunch', help: 'Rougher and duller, toward the PS1', min: 0, max: 4, step: 1, value: 0, dice: true, fmt: (x) => (x ? x + '' : 'OFF'), apply: mix }
  ];
});
