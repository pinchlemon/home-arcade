// ---------- music: an original chiptune bossa nova loop (16 bars in F) ----------
// Game Boy-style voices: pulse-wave lead and chords, triangle bass (like the wave channel), noise percussion.
let musicOn = true, musicGain = null, nextNoteTime = 0, mStep = 0, musicTimer = null, pulse25 = null, pulse12 = null;
const BPM = 132, EIGHTH = 60 / BPM / 2;
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
// chords: [bass root, voicing]; one per bar
const CHORDS = [
  [41, [57, 60, 64]], [38, [54, 60, 63]], [43, [58, 62, 65]], [36, [58, 62, 64]],   // Fmaj7  D7b9  Gm7  C9
  [45, [55, 60, 64]], [38, [54, 60, 64]], [43, [58, 62, 65]], [36, [58, 62, 64]],   // Am7    D9    Gm7  C9
  [46, [57, 62, 65]], [46, [55, 61, 65]], [45, [55, 60, 64]], [38, [54, 60, 63]],   // Bbmaj7 Bbm6  Am7  D7b9
  [43, [58, 62, 65]], [36, [58, 62, 64]], [41, [57, 60, 64]], [36, [58, 62, 64]],   // Gm7    C9    Fmaj7 C9
];
// melody per bar: [eighth, note, length in eighths]
const MELODY = [
  [[0, 69, 3], [3, 67, 1], [4, 69, 2], [6, 72, 2]],
  [[0, 72, 2], [2, 70, 1], [3, 69, 3], [6, 66, 2]],
  [[0, 67, 3], [3, 70, 1], [4, 74, 3], [7, 72, 1]],
  [[0, 70, 4], [4, 69, 2], [6, 67, 2]],
  [[0, 72, 3], [3, 76, 1], [4, 72, 2], [6, 69, 2]],
  [[0, 74, 2], [2, 72, 1], [3, 66, 3], [6, 69, 2]],
  [[0, 70, 3], [3, 69, 1], [4, 67, 2], [6, 65, 2]],
  [[0, 64, 4], [4, 67, 2], [6, 70, 2]],
  [[0, 69, 3], [3, 72, 1], [4, 74, 4]],
  [[0, 73, 3], [3, 72, 1], [4, 70, 4]],
  [[0, 72, 2], [2, 69, 1], [3, 67, 1], [4, 64, 4]],
  [[0, 66, 2], [2, 69, 2], [4, 72, 2], [6, 75, 2]],
  [[0, 74, 3], [3, 72, 1], [4, 70, 2], [6, 69, 2]],
  [[0, 67, 3], [3, 70, 1], [4, 69, 2], [6, 67, 2]],
  [[0, 65, 6]],
  [[4, 67, 1], [5, 69, 1], [6, 70, 1], [7, 72, 1]],
];
const CLAVE = [[0, 3, 6], [2, 5]];            // bossa clave over two bars: 1, 2&, 4 | 2, 3&
function pulseWave(duty) {
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return actx.createPeriodicWave(re, im);
}
function mNote(freq, t0, dur, vol, wave, opts = {}) {
  const o = actx.createOscillator(), g = actx.createGain();
  if (typeof wave === 'string') o.type = wave; else o.setPeriodicWave(wave);
  o.frequency.setValueAtTime(freq, t0);
  if (opts.vibrato && dur > 0.3) {                // gentle vibrato on held notes
    const l = actx.createOscillator(), lg = actx.createGain();
    l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(freq * 0.006, t0 + 0.25);
    l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05);
  }
  const a = opts.attack ?? 0.008, sus = opts.sustain ?? 0.6;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * sus), t0 + a + (opts.decay ?? 0.12));
  g.gain.setValueAtTime(Math.max(0.0002, vol * sus), t0 + Math.max(a + 0.01, dur - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(musicGain); o.start(t0); o.stop(t0 + dur + 0.02);
}
function mNoise(t0, dur, vol, type, freq, q = 1) {
  const sN = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  sN.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  sN.connect(f).connect(g).connect(musicGain); sN.start(t0, Math.random() * 0.4); sN.stop(t0 + dur + 0.01);
}
function playStep(step, t0) {
  const bar = (step >> 3) % 16, e = step & 7, [root, voicing] = CHORDS[bar];
  // bass: root, a pushed fifth, fifth, and a pickup back to the root
  const bassPat = { 0: [root, 3], 3: [root + 7, 1], 4: [root + 7, 3], 7: [root, 1] };
  if (bassPat[e]) mNote(midi(bassPat[e][0]), t0, bassPat[e][1] * EIGHTH * 0.92, 0.11, 'triangle', { sustain: 0.7 });
  // chord stabs on the clave
  if (CLAVE[bar & 1].includes(e)) for (const n of voicing) mNote(midi(n), t0, EIGHTH * 1.1, 0.018, pulse12, { decay: 0.08, sustain: 0.35 });
  // melody
  for (const [st, n, len] of MELODY[bar]) if (st === e) mNote(midi(n), t0, len * EIGHTH * 0.95, 0.04, pulse25, { vibrato: true, sustain: 0.55 });
  // percussion: shaker on every eighth, rim click on the clave, a soft kick
  mNoise(t0, 0.035, e % 2 ? 0.018 : 0.03, 'highpass', 7000);
  if (CLAVE[bar & 1].includes(e)) mNoise(t0, 0.025, 0.05, 'bandpass', 1800, 6);
  if (e === 0 || e === 4) { const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    g.gain.setValueAtTime(0.12, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    o.connect(g).connect(musicGain); o.start(t0); o.stop(t0 + 0.16); }
}
function startMusic() {
  if (!actx || musicTimer) return;
  pulse25 = pulseWave(0.25); pulse12 = pulseWave(0.125);
  musicGain = actx.createGain(); musicGain.gain.value = 0.8; musicGain.connect(actx.destination);
  nextNoteTime = actx.currentTime + 0.15;
  musicTimer = setInterval(() => {
    // hold the song in place while paused, muted, or switched off; pick up where it left off
    if (paused || muted || !musicOn || actx.state !== 'running') { nextNoteTime = actx.currentTime + 0.06; return; }
    while (nextNoteTime < actx.currentTime + 0.12) { playStep(mStep, nextNoteTime); nextNoteTime += EIGHTH; mStep = (mStep + 1) % 128; }
  }, 25);
}
