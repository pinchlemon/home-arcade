// lemon squeeze: sharp, wet, squishy, and zesty — about an eighth of a second
function juiceSound() {
  if (!actx || muted || !noiseBuf) return;
  const now = actx.currentTime, out = actx.destination;
  const noise = (t0, dur, type, f0, f1, q, vol, rate = 1) => {
    const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = rate;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(out); s.start(t0, Math.random() * 0.3); s.stop(t0 + dur + 0.01);
  };
  const r = () => 0.92 + Math.random() * 0.16;
  // sharp: the claw bites through the peel
  noise(now, 0.012, 'highpass', 2500, 2500, 0.7, 0.35);
  // wet + squishy: two quick squelches of pulp, sweeping down
  noise(now + 0.004, 0.06, 'bandpass', 1100 * r(), 380, 4, 0.5, 0.8);
  noise(now + 0.03, 0.055, 'bandpass', 850 * r(), 300, 4.5, 0.38, 0.75);
  // zesty: a tiny bright spritz, cut short
  noise(now + 0.018, 0.07, 'bandpass', 7000, 5200, 1.3, 0.11, 1.2);
  // peel squeak
  {
    const t0 = now + 0.01, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(2300 * r(), t0); o.frequency.exponentialRampToValueAtTime(3100, t0 + 0.035);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + 0.05);
  }
  // a little body underneath
  {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130, now); o.frequency.exponentialRampToValueAtTime(70, now + 0.05);
    g.gain.setValueAtTime(0.07, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    o.connect(g).connect(out); o.start(now); o.stop(now + 0.07);
  }
}
// juice on an eye: a crackly sizzle like it's burning, with a tiny pained squeak
let lastSizzle = 0;
function sizzleSound() {
  if (!actx || muted || !noiseBuf) return;
  const now = actx.currentTime, out = actx.destination;
  if (now - lastSizzle < 0.07) return;          // lots of drops land at once; don't stack them
  lastSizzle = now;
  {
    const s = actx.createBufferSource(), hp = actx.createBiquadFilter(), g = actx.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = 1.3;
    hp.type = 'highpass'; hp.frequency.value = 3500;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    s.connect(hp).connect(g).connect(out); s.start(now); s.stop(now + 0.4);
  }
  for (let i = 0; i < 9; i++) {                  // crackles
    const t0 = now + Math.random() * 0.3, s = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
    s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 2500 + Math.random() * 4000; bp.Q.value = 1.5;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.09 * (1 - i / 12), t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.012);
    s.connect(bp).connect(g).connect(out); s.start(t0, Math.random() * 0.4); s.stop(t0 + 0.015);
  }
  {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1500, now); o.frequency.exponentialRampToValueAtTime(950, now + 0.09);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.025, now + 0.01); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    o.connect(g).connect(out); o.start(now); o.stop(now + 0.11);
  }
}
// footsteps: a soft, low "pff" of feet pressing into sand (two per walk cycle); firmer up on a sandcastle
function stepSound(alt, hard) {
  if (!actx || muted || !noiseBuf) return;
  const now = actx.currentTime, s = actx.createBufferSource(), f = actx.createBiquadFilter(), lp = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = hard ? 0.9 : 0.55;
  f.type = 'bandpass'; f.Q.value = hard ? 2.2 : 0.9;
  f.frequency.value = (hard ? 1500 : 850) * (alt ? 0.85 : 1) * (0.92 + Math.random() * 0.16);
  lp.type = 'lowpass'; lp.frequency.value = hard ? 3000 : 1800;
  const dur = hard ? 0.035 : 0.055;
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(hard ? 0.06 : 0.07, now + 0.006); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  s.connect(f).connect(lp).connect(g).connect(actx.destination); s.start(now, Math.random() * 0.4); s.stop(now + dur + 0.01);
}

const sfx = {
  step: stepSound,
  jump: () => blip(320, 720, .14),
  land: () => blip(140, 70, .08, 'triangle', .08),
  squirt: juiceSound,
  charge: () => blip(160, 900, CHARGE / 60, 'sine', .035),
  laser: () => { hiss(.07, .14, 3200); blip(1700, 180, .13, 'square', .055); blip(240, 170, .32, 'sawtooth', .04, .02); blip(900, 860, .3, 'square', .018, .03); },
  eyeHit: sizzleSound,
  melt: () => { blip(520, 60, .7, 'triangle', .07); hiss(.5, .04, 900, .1); },
  hurt: () => { blip(320, 70, .28, 'square', .06); },
  over: () => { blip(440, 430, .18, 'square', .05); blip(330, 320, .18, 'square', .05, .2); blip(220, 110, .5, 'square', .05, .4); },
};
