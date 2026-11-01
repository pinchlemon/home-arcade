// Tiny sound synth for Library sounds: a wave, a starting pitch, a pitch slide and a length.
import { getSettings } from './store.js';

let ctx = null, settings = getSettings();
export const refreshSettings = () => { settings = getSettings(); };

export function unlock() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
  if (ctx.state === 'suspended') ctx.resume();
}
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });

let noiseBuf = null;
function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function play(sound, volScale = 1) {
  if (!sound || !ctx || settings.sfx <= 0) return;
  const t = ctx.currentTime, len = 0.05 + sound.len * 0.06;
  const f0 = 110 * Math.pow(2, sound.pitch * 0.5), f1 = f0 * Math.pow(2, sound.slide * 0.25);
  const g = ctx.createGain();
  const v = (settings.sfx / 9) * 0.22 * volScale;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
  g.connect(ctx.destination);
  if (sound.wave === 'noise') {
    const s = ctx.createBufferSource(); s.buffer = noise();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0 * 4, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1 * 4), t + len);
    s.connect(f); f.connect(g); s.start(t); s.stop(t + len);
  } else {
    const o = ctx.createOscillator(); o.type = sound.wave === 'saw' ? 'sawtooth' : sound.wave;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + len);
    o.connect(g); o.start(t); o.stop(t + len);
  }
}

export function click() {
  if (!settings.menuSounds) return;
  play({ wave: 'square', pitch: 7, slide: 1, len: 0 }, 0.35);
}
