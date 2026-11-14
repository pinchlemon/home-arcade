// Night Rack audio engine: every cable carries a full-rate signal (VCV-style voltages).
// Audio ±5V, gates/triggers 0–10V, pitch 1V/oct. Modules run per 128-sample block in
// dependency order, so forward chains are sample-accurate; feedback loops get one block of delay.

const TAU = Math.PI * 2;
export const SCALES = [
  ['Minor Pent', [0, 3, 5, 7, 10]], ['Major Pent', [0, 2, 4, 7, 9]], ['Dorian', [0, 2, 3, 5, 7, 9, 10]],
  ['Lydian', [0, 2, 4, 6, 7, 9, 11]], ['Aeolian', [0, 2, 3, 5, 7, 8, 10]], ['Ionian', [0, 2, 4, 5, 7, 9, 11]],
  ['Hirajoshi', [0, 2, 3, 7, 8]], ['Whole Tone', [0, 2, 4, 6, 8, 10]], ['Chromatic', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]
];
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
class Schmitt { constructor() { this.s = false; } step(v) { if (this.s) { if (v <= 0.1) this.s = false; return false; } if (v >= 1) { this.s = true; return true; } return false; } }
class DLine {
  constructor(n) { this.n = n; this.b = new Float32Array(n); this.w = 0; }
  write(x) { this.b[this.w] = x; if (++this.w >= this.n) this.w = 0; }
  read(d) { let i = this.w - d; if (i < 0) i += this.n; return this.b[i]; } // d >= 1: sample written d writes ago
  readf(d) { const di = d | 0, f = d - di; return this.read(di) * (1 - f) + this.read(di + 1) * f; }
}
class AP {
  constructor(len, g, extra = 0) { this.len = len; this.g = g; this.d = new DLine(len + extra + 4); }
  proc(x) { const dd = this.d.read(this.len), w = x + this.g * dd; this.d.write(w); return dd - this.g * w; }
  procm(x, len) { const dd = this.d.readf(len), w = x - this.g * dd; this.d.write(w); return dd + this.g * w; }
}

class DSP {
  constructor(e) {
    this.e = e; this.sr = e.sr; this.p = {}; this.in = {}; this.has = {}; this.out = {}; this.L = {};
    for (const k of this.constructor.IN) { this.in[k] = e.zero; this.has[k] = false; }
    for (const k of this.constructor.OUT) this.out[k] = new Float32Array(e.N);
  }
  flash(k, v) { if (!(this.L[k] >= v)) this.L[k] = v; }
  peak(k, buf, n, scale = 0.2) { let m = 0; for (let i = 0; i < n; i++) { const a = Math.abs(buf[i]); if (a > m) m = a; } this.flash(k, m * scale); }
  onParam() { }
}

class Clock extends DSP {
  static IN = ['reset']; static OUT = ['x4', 'x2', 'x1', 'd2', 'd4', 'd8'];
  constructor(e) { super(e); this.ph = 0; this.c = 0; this.rs = new Schmitt(); this.O = Clock.OUT.map(k => this.out[k]); }
  process(n) {
    const f = (this.p.tempo || 52) / 60 * 4 / this.sr, O = this.O, D = [1, 2, 4, 8, 16, 32], rst = this.in.reset; this.barAt = -1;
    for (let i = 0; i < n; i++) {
      if (this.rs.step(rst[i])) { this.ph = 0; this.c = 0; }
      this.ph += f; if (this.ph >= 1) { this.ph -= 1; this.c++; if (this.c % 16 === 0 && this.barAt < 0) this.barAt = i; }
      for (let k = 0; k < 6; k++) { const d = D[k]; O[k][i] = ((this.c % d) + this.ph) / d < 0.5 ? 10 : 0; }
    }
    this.flash('beat', ((this.c % 4) + this.ph) / 4 < 0.5 ? 1 : 0); this.L.count = this.c;
  }
}
class Random extends DSP {
  static IN = ['trig']; static OUT = ['gate', 'step', 'smooth'];
  constructor(e) { super(e); this.st = new Schmitt(); this.t = Math.random() * 1.5; this.s = this.t; this.g = 0; }
  process(n) {
    const tr = this.in.trig, G = this.out.gate, S = this.out.step, M = this.out.smooth, range = this.p.range ?? 1.5, ch = this.p.chance ?? 0.8;
    const k = 1 - Math.exp(-1 / (Math.max(0.001, this.p.slew ?? 0.8) * this.sr)), gl = Math.round(0.005 * this.sr);
    for (let i = 0; i < n; i++) {
      if (this.st.step(tr[i]) && Math.random() < ch) { this.t = Math.random() * range; this.g = gl; this.flash('gate', 1); }
      G[i] = this.g > 0 ? 10 : 0; if (this.g > 0) this.g--;
      S[i] = this.t; this.s += (this.t - this.s) * k; M[i] = this.s;
    }
    this.L.val = this.t / Math.max(range, 0.05);
  }
}
class Quant extends DSP {
  static IN = ['in', 'trans']; static OUT = ['out', 'trig'];
  constructor(e) { super(e); this.lv = NaN; this.note = 0; this.tg = 0; }
  onParam() { this.lv = NaN; }
  q(semis) { const sc = (SCALES[this.p.scale | 0] || SCALES[0])[1]; let best = 0, bd = 1e9; const b = Math.floor(semis); for (let n = b - 12; n <= b + 12; n++) { if (sc.includes(((n % 12) + 12) % 12)) { const d = Math.abs(n - semis); if (d < bd) { bd = d; best = n; } } } return best; }
  process(n) {
    const I = this.in.in, T = this.in.trans, O = this.out.out, TG = this.out.trig, gl = Math.round(0.005 * this.sr), root = this.p.root | 0, oct = this.p.oct | 0;
    for (let i = 0; i < n; i++) {
      const v = I[i] + T[i];
      if (!(Math.abs(v - this.lv) < 1e-5)) { this.lv = v; const nn = this.q(v * 12) + root + oct * 12; if (nn !== this.note) { this.note = nn; this.tg = gl; this.flash('trig', 1); } }
      O[i] = this.note / 12; TG[i] = this.tg > 0 ? 10 : 0; if (this.tg > 0) this.tg--;
    }
    this.L.note = this.note;
  }
}
class VCO extends DSP {
  static IN = ['voct', 'fm']; static OUT = ['sin', 'tri', 'saw', 'sqr', 'sub'];
  constructor(e) { super(e); this.ph = Math.random(); this.ph2 = 0; this.dv = 0; this.age = 0; }
  process(n) {
    this.age += n; const warm = (this.p.warm ?? 14) * Math.exp(-this.age / (40 * this.sr));
    const P = this.p, base = 261.63 * Math.pow(2, (P.oct ?? 0) + (P.tune ?? 0) / 12 + ((P.fine ?? 0) + (P.tol ?? 0) + warm) / 1200), trk = P.trk ?? 1;
    this.dv += (Math.random() - 0.5) * 0.35; this.dv *= 0.992;
    const fb = base * Math.pow(2, this.dv * (P.drift ?? 0.35) * 0.0035), amt = (P.fm ?? 0) * fb * 0.2, sr = this.sr;
    const V = this.in.voct, F = this.in.fm, hv = this.has.voct, hf = this.has.fm, o = this.out, SI = o.sin, TR = o.tri, SA = o.saw, SQ = o.sqr, SU = o.sub;
    let f = fb;
    for (let i = 0; i < n; i++) {
      f = hv ? fb * Math.pow(2, V[i] * trk) : fb; if (hf) f += amt * F[i];
      const dt = f / sr, adt = Math.min(0.5, Math.abs(dt) + 1e-9);
      let ph = this.ph + dt; ph -= Math.floor(ph); this.ph = ph;
      let p2 = this.ph2 + dt * 0.5; p2 -= Math.floor(p2); this.ph2 = p2;
      SI[i] = 5 * Math.sin(TAU * ph);
      TR[i] = 5 * (1 - 4 * Math.abs(ph - 0.5));
      SA[i] = 5 * (2 * ph - 1 - blep(ph, adt));
      SQ[i] = 5 * ((ph < 0.5 ? 1 : -1) + blep(ph, adt) - blep((ph + 0.5) % 1, adt));
      SU[i] = 5 * ((p2 < 0.5 ? 1 : -1) + blep(p2, adt * 0.5) - blep((p2 + 0.5) % 1, adt * 0.5));
    }
    this.L.freq = f;
  }
}
class LFO extends DSP {
  static IN = []; static OUT = ['bi1', 'uni1', 'bi2', 'uni2'];
  constructor(e) { super(e); this.ch = [1, 2].map(c => ({ c, ph: Math.random(), a: Math.random() * 2 - 1, b: Math.random() * 2 - 1 })); }
  process(n) {
    for (const ch of this.ch) {
      const r = (this.p['rate' + ch.c] ?? 0.05) / this.sr, s = this.p['shape' + ch.c] | 0, B = this.out['bi' + ch.c], U = this.out['uni' + ch.c]; let v = 0;
      for (let i = 0; i < n; i++) {
        ch.ph += r; if (ch.ph >= 1) { ch.ph -= 1; ch.a = ch.b; ch.b = Math.random() * 2 - 1; }
        const ph = ch.ph;
        v = s === 0 ? Math.sin(ph * TAU) : s === 1 ? 4 * Math.abs(ph - 0.5) - 1 : s === 2 ? 1 - 2 * ph : ch.a + (ch.b - ch.a) * (1 - Math.cos(ph * Math.PI)) / 2;
        B[i] = 5 * v; U[i] = 5 * v + 5;
      }
      this.L['led' + ch.c] = v;
    }
  }
}
class Mixer extends DSP {
  static IN = ['in1', 'in2', 'in3', 'in4']; static OUT = ['out'];
  process(n) {
    const O = this.out.out, g = [1, 2, 3, 4].map(k => this.p['lvl' + k] ?? 0), I = [1, 2, 3, 4].map(k => this.in['in' + k]);
    for (let i = 0; i < n; i++) O[i] = I[0][i] * g[0] + I[1][i] * g[1] + I[2][i] * g[2] + I[3][i] * g[3] + (Math.random() - 0.5) * 0.0012;
    this.peak('vu', O, n);
  }
}
class Noise extends DSP {
  static IN = []; static OUT = ['white', 'pink'];
  constructor(e) { super(e); this.b = new Float32Array(7); }
  process(n) {
    const W = this.out.white, P = this.out.pink, b = this.b;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 2 - 1; W[i] = x * 4;
      b[0] = 0.99886 * b[0] + x * 0.0555179; b[1] = 0.99332 * b[1] + x * 0.0750759; b[2] = 0.969 * b[2] + x * 0.153852; b[3] = 0.8665 * b[3] + x * 0.3104856; b[4] = 0.55 * b[4] + x * 0.5329522; b[5] = -0.7616 * b[5] - x * 0.016898;
      P[i] = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + x * 0.5362) * 0.5; b[6] = x * 0.115926;
    }
  }
}
class Scope extends DSP {
  static IN = ['in']; static OUT = [];
  constructor(e) { super(e); this.ring = new Float32Array(4096); this.w = 0; }
  process(n) { const src = this.has.in ? this.in.in : this.e.oLv; for (let i = 0; i < n; i++) { this.ring[this.w] = src[i]; this.w = (this.w + 1) & 4095; } }
  snap() { const o = new Float32Array(2048); for (let i = 0; i < 2048; i++) o[i] = this.ring[(this.w - 2048 + i) & 4095]; return o; }
}
class Seq extends DSP {
  static IN = ['clk', 'rst']; static OUT = ['eoc', 'cv', 'gate'];
  constructor(e) { super(e); this.cs = new Schmitt(); this.rs = new Schmitt(); this.step = -1; this.v = 0; this.go = false; this.eo = 0; }
  process(n) {
    const C = this.in.clk, R = this.in.rst, E = this.out.eoc, V = this.out.cv, G = this.out.gate, gl = Math.round(0.005 * this.sr), len = Math.max(1, this.p.len | 0 || 8), prob = this.p.prob ?? 0.85;
    for (let i = 0; i < n; i++) {
      if (this.rs.step(R[i])) this.step = -1;
      if (this.cs.step(C[i])) { this.step = (this.step + 1) % len; this.go = Math.random() < prob; if (this.go) this.flash('gate', 1); if (this.step === 0) this.eo = gl; }
      if (this.step >= 0) this.v = (this.p['s' + this.step] ?? 0) / 12;
      V[i] = this.v; G[i] = this.cs.s && this.go ? 10 : 0; E[i] = this.eo > 0 ? 10 : 0; if (this.eo > 0) this.eo--;
    }
    this.L.step = this.step;
  }
}
class VCF extends DSP { // zero-delay-feedback 4-pole ladder with saturating input (self-oscillates at high resonance)
  static IN = ['in', 'cv1', 'cv2']; static OUT = ['lp', 'bp'];
  constructor(e) { super(e); this.s1 = this.s2 = this.s3 = this.s4 = 0; this.lc = Math.log2(900); }
  process(n) {
    const P = this.p, tgt = Math.log2(Math.max(10, P.cutoff ?? 900)) + (P.tol ?? 0), k = (P.res ?? 0.35) * 4.3, drv = 1 + (P.drive ?? 0.2) * 6, dn = 1 / (0.6 * drv + 0.4);
    const a1 = (P.cv1 ?? 0.5) * 0.4, a2 = (P.cv2 ?? 0.2) * 0.4, piSr = Math.PI / this.sr, maxL = Math.log2(this.sr * 0.45);
    const I = this.in.in, C1 = this.in.cv1, C2 = this.in.cv2, LP = this.out.lp, BP = this.out.bp, kin = 1 + k * 0.5;
    let s1 = this.s1, s2 = this.s2, s3 = this.s3, s4 = this.s4, lc = this.lc, pk = 0;
    for (let i = 0; i < n; i++) {
      lc += (tgt - lc) * 0.003;
      let lf = lc + C1[i] * a1 + C2[i] * a2; if (lf > maxL) lf = maxL; else if (lf < 3.3) lf = 3.3;
      const g = Math.tan(piSr * Math.pow(2, lf)), G = g / (1 + g), G2 = G * G, G3 = G2 * G, b = 1 - G;
      const sig = (G3 * s1 + G2 * s2 + G * s3 + s4) * b;
      let u = (I[i] * 0.2 * kin - k * sig) / (1 + k * G2 * G2);
      u = Math.tanh(u * drv) * dn;
      let v = (u - s1) * G; const y1 = v + s1; s1 = y1 + v;
      v = (y1 - s2) * G; const y2 = v + s2; s2 = y2 + v;
      v = (y2 - s3) * G; const y3 = v + s3; s3 = y3 + v;
      v = (y3 - s4) * G; const y4 = v + s4; s4 = y4 + v;
      LP[i] = y4 * 5; BP[i] = (y2 - 2 * y3 + y4) * 20;
      const a = Math.abs(y4); if (a > pk) pk = a;
    }
    if (!isFinite(s1 + s2 + s3 + s4)) { s1 = s2 = s3 = s4 = 0; }
    this.s1 = s1; this.s2 = s2; this.s3 = s3; this.s4 = s4; this.lc = lc; this.flash('led', pk);
  }
}
class Env extends DSP {
  static IN = ['trig1', 'trig2']; static OUT = ['env1', 'env2'];
  constructor(e) { super(e); this.c = [1, 2].map(() => ({ v: 0, st: 0, t: new Schmitt() })); }
  process(n) {
    for (let c = 0; c < 2; c++) {
      const ch = this.c[c], T = this.in['trig' + (c + 1)], O = this.out['env' + (c + 1)], tl = this.p.tol ?? 1, a = Math.max(0.001, (this.p['atk' + (c + 1)] ?? 0.4) * tl), r = Math.max(0.005, (this.p['rel' + (c + 1)] ?? 3) / tl);
      const ai = 1 / (a * this.sr), rc = Math.exp(-4 / (r * this.sr));
      for (let i = 0; i < n; i++) {
        if (ch.t.step(T[i])) ch.st = 1;
        if (ch.st === 1) { ch.v += ai; if (ch.v >= 1) { ch.v = 1; ch.st = 2; } } else if (ch.st === 2) { ch.v *= rc; if (ch.v < 1e-5) { ch.v = 0; ch.st = 0; } }
        O[i] = ch.v * 10;
      }
      this.L['led' + (c + 1)] = ch.v;
    }
  }
}
class VCA extends DSP {
  static IN = ['in1', 'cv1', 'in2', 'cv2']; static OUT = ['out1', 'out2'];
  process(n) {
    for (const c of [1, 2]) {
      const I = this.in['in' + c], C = this.in['cv' + c], O = this.out['out' + c], hc = this.has['cv' + c], b = this.p['bias' + c] ?? 0, lv = this.p['lvl' + c] ?? 1;
      for (let i = 0; i < n; i++) { let g = b + (hc ? C[i] * 0.1 : 0); if (g < 0) g = 0; O[i] = I[i] * g * lv; }
      this.peak('led' + c, O, n);
    }
  }
}
class Delay extends DSP {
  static IN = ['in', 'time']; static OUT = ['L', 'R'];
  constructor(e) { super(e); const N = Math.ceil(e.sr * 3.2); this.dl = new DLine(N); this.dr = new DLine(N); this.ds = 0.8 * e.sr; this.lpL = 0; this.lpR = 0; }
  process(n) {
    const P = this.p, sr = this.sr, I = this.in.in, T = this.in.time, OL = this.out.L, OR = this.out.R, mod = (P.mod ?? 0.2) * 0.004 * sr, base = (P.time ?? 0.8) * sr;
    const fb = (P.fb ?? 0.6) * 0.95, mix = P.mix ?? 0.45, c = 1 - Math.exp(-TAU * (P.tone ?? 2800) / sr), mx = this.dl.n - 4; let pk = 0;
    for (let i = 0; i < n; i++) {
      let tgt = base + T[i] * mod; if (tgt < 2) tgt = 2; else if (tgt > mx) tgt = mx;
      this.ds += (tgt - this.ds) * 0.0004;
      this.lpL += (this.dl.readf(this.ds) - this.lpL) * c; this.lpR += (this.dr.readf(this.ds) - this.lpR) * c;
      const x = I[i];
      this.dl.write(5 * Math.tanh((x + fb * this.lpR) * 0.2)); this.dr.write(5 * Math.tanh(fb * this.lpL * 0.2));
      OL[i] = x * (1 - mix) + this.lpL * mix; OR[i] = x * (1 - mix) + this.lpR * mix;
      const a = Math.abs(this.lpL); if (a > pk) pk = a;
    }
    this.flash('led', pk * 0.2);
  }
}
class Reverb extends DSP { // Dattorro plate; DRY L/R pass straight to the output (keeps drums clean)
  static IN = ['inL', 'inR', 'dryL', 'dryR']; static OUT = ['L', 'R'];
  constructor(e) {
    super(e); const s = e.sr / 29761, D = x => Math.max(2, Math.round(x * s)); this.D = D;
    this.pre = new DLine(Math.ceil(0.3 * e.sr) + 4);
    this.ap = [[142, 0.75], [107, 0.75], [379, 0.625], [277, 0.625]].map(([l, g]) => new AP(D(l), g));
    this.exc = 16 * s;
    this.mL = new AP(D(672), 0.7, Math.ceil(this.exc) + 2); this.d1L = new DLine(D(4453) + 2); this.a2L = new AP(D(1800), 0.5); this.d2L = new DLine(D(3720) + 2);
    this.mR = new AP(D(908), 0.7, Math.ceil(this.exc) + 2); this.d1R = new DLine(D(4217) + 2); this.a2R = new AP(D(2656), 0.5); this.d2R = new DLine(D(3163) + 2);
    this.len = { d1L: D(4453), d2L: D(3720), d1R: D(4217), d2R: D(3163) };
    this.t = [266, 2974, 1913, 1996, 1990, 187, 1066, 353, 3627, 1228, 2673, 2111, 335, 121].map(D);
    this.bw = 0; this.dL = 0; this.dR = 0; this.ph = 0;
  }
  process(n) {
    const P = this.p, sr = this.sr, g = Math.min(0.985, Math.pow(10, -3 * 0.358 / Math.max(0.3, P.decay ?? 8))), dc = 1 - Math.exp(-TAU * (P.damp ?? 5000) / sr);
    const mix = P.mix ?? 0.55, lvl = P.level ?? 1, pre = Math.max(1, Math.round((P.pre ?? 0.03) * sr)), IL = this.in.inL, IR = this.has.inR ? this.in.inR : this.in.inL, OL = this.out.L, OR = this.out.R, DL = this.in.dryL, DR = this.has.dryR ? this.in.dryR : this.in.dryL;
    const t = this.t, ln = this.len, dw = TAU * 0.9 / sr; let pk = 0;
    for (let i = 0; i < n; i++) {
      this.pre.write((IL[i] + IR[i]) * 0.1); let x = this.pre.read(pre);
      this.bw += (x - this.bw) * 0.9995; x = this.bw;
      for (let k = 0; k < 4; k++) x = this.ap[k].proc(x);
      this.ph += dw; if (this.ph > TAU) this.ph -= TAU; const lfo = Math.sin(this.ph) * this.exc;
      const fL = this.d2R.read(ln.d2R), fR = this.d2L.read(ln.d2L);
      let l = this.mL.procm(x + g * fL, this.mL.len + lfo); this.d1L.write(l); l = this.d1L.read(ln.d1L); this.dL += (l - this.dL) * dc; l = this.a2L.proc(this.dL * g); this.d2L.write(l);
      let r = this.mR.procm(x + g * fR, this.mR.len - lfo); this.d1R.write(r); r = this.d1R.read(ln.d1R); this.dR += (r - this.dR) * dc; r = this.a2R.proc(this.dR * g); this.d2R.write(r);
      const yl = this.d1R.read(t[0]) + this.d1R.read(t[1]) - this.a2R.d.read(t[2]) + this.d2R.read(t[3]) - this.d1L.read(t[4]) - this.a2L.d.read(t[5]) - this.d2L.read(t[6]);
      const yr = this.d1L.read(t[7]) + this.d1L.read(t[8]) - this.a2L.d.read(t[9]) + this.d2L.read(t[10]) - this.d1R.read(t[11]) - this.a2R.d.read(t[12]) - this.d2R.read(t[13]);
      const wl = yl * 3.5, wr = yr * 3.5;
      OL[i] = (IL[i] * (1 - mix) + wl * mix) * lvl + DL[i]; OR[i] = (IR[i] * (1 - mix) + wr * mix) * lvl + DR[i];
      const a = Math.abs(wl); if (a > pk) pk = a;
    }
    if (!isFinite(this.dL + this.dR)) { this.dL = this.dR = 0; }
    this.flash('led', pk * 0.25);
  }
}
class Output extends DSP {
  static IN = ['L', 'R']; static OUT = [];
  process(n) {
    const v = this.p.vol ?? 0.75, g = v * v * 2.6 * 0.2, L = this.in.L, R = this.has.R ? this.in.R : this.in.L, oL = this.e.oL, oR = this.e.oR, vL = this.e.oLv; let pl = 0, pr = 0;
    for (let i = 0; i < n; i++) { const l = Math.tanh(L[i] * g), r = Math.tanh(R[i] * g); oL[i] = l; oR[i] = r; vL[i] = L[i]; const al = Math.abs(l), ar = Math.abs(r); if (al > pl) pl = al; if (ar > pr) pr = ar; }
    this.flash('vuL', pl); this.flash('vuR', pr);
  }
}

export const MODELS = ['VIRTUAL ANALOG', 'WAVEFOLD', 'FM', 'FORMANT', 'HARMONIC', 'CHORD', 'STRING', 'MODAL BELL'];
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
function quantTo(semis, sc) { let best = 0, bd = 1e9; const b = Math.floor(semis); for (let n = b - 12; n <= b + 12; n++) { if (sc.includes(((n % 12) + 12) % 12)) { const d = Math.abs(n - semis); if (d < bd) { bd = d; best = n; } } } return best; }
const VOWELS = [[730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240]];
const CHORDS = [[0, 12, 19, 24], [0, 7, 12, 19], [0, 5, 7, 12], [0, 3, 7, 10], [0, 4, 7, 11], [0, 3, 7, 14], [0, 4, 7, 14], [0, 7, 14, 21]];
const FM_RATIOS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7];
const BAR = [1, 2.756, 5.404, 8.933, 13.34, 18.64, 24.81, 31.87];

class Macro extends DSP { // Plaits-inspired macro oscillator
  static IN = ['voct', 'trig', 'timbre', 'morph', 'harm']; static OUT = ['out', 'aux'];
  constructor(e) {
    super(e); this.ph = 0; this.ph2 = 0; this.pm = 0; this.fbv = 0; this.cph = [0, 0.25, 0.5, 0.75]; this.ts = new Schmitt(); this.env = 0; this.envT = 0; this.l1 = 0; this.l2 = 0;
    this.ks = new DLine(Math.ceil(e.sr / 15)); this.kl = 0; this.exc = 0; this.exn = 0; this.res = Array.from({ length: 8 }, () => ({ y1: 0, y2: 0, c1: 0, c2: 0, g: 0 }));
    this.sv = [0, 1, 2].map(() => ({ ic1: 0, ic2: 0, a1: 0, a2: 0, a3: 0 })); this.amp = new Float32Array(16); this.ex = 0;
  }
  process(n) {
    const P = this.p, I = this.in, sr = this.sr, m = P.model | 0, ht = this.has.trig, T = I.trig, O = this.out.out, A = this.out.aux;
    const harm = clamp01((P.harm ?? 0.5) + I.harm[0] * 0.1), tim = clamp01((P.timbre ?? 0.5) + I.timbre[0] * 0.1), mor = clamp01((P.morph ?? 0.5) + I.morph[0] * 0.1);
    const f = Math.min(sr * 0.45, 261.63 * Math.pow(2, (P.freq ?? 0) / 12 + (P.tol ?? 0) / 1200 + I.voct[0] * (P.trk ?? 1))), dt = f / sr, adt = Math.min(0.5, dt);
    const dec = P.decay ?? 0.5, color = P.color ?? 0.5, envK = Math.exp(-1 / ((0.04 + dec * dec * 3) * sr));
    // per-model block setup
    let r2 = 1, pw = 0.5, ratio = 1, idx = 0, chord = null, det = 0, norm = 1;
    if (m === 0) { r2 = Math.pow(2, harm * 7 / 12); pw = 0.5 - tim * 0.45; }
    else if (m === 2) { ratio = FM_RATIOS[Math.round(harm * 8)]; idx = tim * tim * 8; }
    else if (m === 3) {
      const vp = tim * 4, vi = Math.min(3, Math.floor(vp)), vf = vp - vi, sh = Math.pow(2, (mor - 0.5) * 1.5), q = 3 + harm * 14;
      for (let k = 0; k < 3; k++) { const fc = Math.min(sr * 0.45, (VOWELS[vi][k] * (1 - vf) + VOWELS[vi + 1][k] * vf) * sh), g = Math.tan(Math.PI * fc / sr), kk = 1 / q, s = this.sv[k]; s.a1 = 1 / (1 + g * (g + kk)); s.a2 = g * s.a1; s.a3 = g * s.a2; }
    }
    else if (m === 4) { const c = 1 + tim * 11, w = 0.6 + harm * 6; let sum = 0; for (let k = 1; k <= 16; k++) { let a = Math.exp(-((k - c) ** 2) / (2 * w * w)); a *= (k % 2 ? 1 - Math.max(0, (mor - 0.5) * 1.6) : 1 - Math.max(0, (0.5 - mor) * 1.6)); if (k * f > sr * 0.45) a = 0; this.amp[k - 1] = a; sum += a; } norm = 1 / Math.max(0.6, sum); }
    else if (m === 5) { chord = CHORDS[Math.min(7, Math.floor(harm * 8))]; det = tim * 0.012; }
    else if (m === 7) {
      for (let k = 0; k < 8; k++) {
        const rr = (k + 1) * (1 - harm) + BAR[k] * harm, fk = f * rr, R = this.res[k];
        if (fk > sr * 0.45) { R.g = 0; continue; }
        const t60 = (0.15 + mor * mor * 9) / (1 + k * 0.45), r = Math.exp(-6.9 / (t60 * sr)), w = TAU * fk / sr;
        R.c1 = 2 * r * Math.cos(w); R.c2 = -r * r; R.g = Math.sin(w) * Math.pow(0.15 + tim * 0.85, k);
      }
    }
    const kL = Math.min(this.ks.n - 3, sr / f), fbk = Math.pow(10, -3 / ((0.3 + mor * mor * 8) * f)), damp = 0.15 + tim * 0.8, bright = 0.1 + harm * 0.9;
    let pk = 0;
    for (let i = 0; i < n; i++) {
      let trig = false; if (this.ts.step(T[i])) { trig = true; this.envT = 1; }
      let o = 0, a = 0;
      this.ph += dt; if (this.ph >= 1) this.ph -= 1; const ph = this.ph;
      switch (m) {
        case 0: {
          this.ph2 += dt * r2; if (this.ph2 >= 1) this.ph2 -= 1; const p2 = this.ph2, adt2 = Math.min(0.5, dt * r2);
          const saw = 2 * ph - 1 - blep(ph, adt), saw2 = 2 * p2 - 1 - blep(p2, adt2);
          const sq2 = (p2 < pw ? 1 : -1) + blep(p2, adt2) - blep((p2 - pw + 1) % 1, adt2);
          o = (saw + saw2 * (1 - mor) + sq2 * mor) * 0.5; a = Math.sin(TAU * ph); break;
        }
        case 1: { const tri = 1 - 4 * Math.abs(ph - 0.5), x = (Math.sin(TAU * ph) * (1 - harm) + tri * harm) * (1 + tim * 12) + (mor - 0.5) * 2; o = Math.sin(x * Math.PI * 0.5) * 0.9; a = Math.tanh(x); break; }
        case 2: { this.pm += dt * ratio; if (this.pm >= 1) this.pm -= Math.floor(this.pm); const md = Math.sin(TAU * this.pm + this.fbv * mor * 3); this.fbv = md; o = Math.sin(TAU * ph + idx * md); a = md; break; }
        case 3: {
          const car = 2 * ph - 1 - blep(ph, adt); let y = 0; const gs = [1, 0.55, 0.3];
          for (let k = 0; k < 3; k++) { const s = this.sv[k], v3 = car - s.ic2, v1 = s.a1 * s.ic1 + s.a2 * v3, v2 = s.ic2 + s.a2 * s.ic1 + s.a3 * v3; s.ic1 = 2 * v1 - s.ic1; s.ic2 = 2 * v2 - s.ic2; y += v1 * gs[k]; }
          o = y * 1.6; a = Math.sin(TAU * ph); break;
        }
        case 4: { let y = 0, y2 = 0; for (let k = 0; k < 16; k++) { const am = this.amp[k]; if (am > 1e-4) { const s = Math.sin(TAU * ((k + 1) * ph % 1)); y += am * s; if (k < 3) y2 += s; } } o = y * norm * 1.6; a = y2 / 3; break; }
        case 5: {
          let y = 0; for (let j = 0; j < 4; j++) { const fr = dt * Math.pow(2, chord[j] / 12) * (1 + det * (j - 1.5)); let q = this.cph[j] + fr; if (q >= 1) q -= 1; this.cph[j] = q; const ad = Math.min(0.5, fr); const sw = 2 * q - 1 - blep(q, ad), sq = (q < 0.5 ? 1 : -1) + blep(q, ad) - blep((q + 0.5) % 1, ad); y += sw * (1 - mor) + sq * mor * 0.8; }
          o = y * 0.4; a = Math.sin(TAU * ph); break;
        }
        case 6: {
          if (trig) this.exc = Math.ceil(kL);
          let x = ht ? 0 : (Math.random() * 2 - 1) * 0.06;
          if (this.exc > 0) { this.exn += ((Math.random() * 2 - 1) - this.exn) * bright; x += this.exn * 0.9; this.exc--; }
          const y = this.ks.readf(kL); this.kl += (y - this.kl) * damp; this.ks.write(x + this.kl * fbk); o = y * 2; a = x; break;
        }
        case 7: {
          let x = ht ? 0 : (Math.random() * 2 - 1) * 0.014; if (trig) { x += 1; this.ex = Math.round(0.002 * sr); }
          if (this.ex > 0) { x += (Math.random() * 2 - 1) * 0.3 * harm; this.ex--; }
          let y = 0; for (let k = 0; k < 8; k++) { const R = this.res[k]; if (!R.g) continue; const v = R.c1 * R.y1 + R.c2 * R.y2 + R.g * x; R.y2 = R.y1; R.y1 = v; y += v; }
          o = y * 0.45; a = x; break;
        }
      }
      if (ht && m < 6) { // internal low-pass gate, struck by TRIG
        this.env += (this.envT - this.env) * (this.envT > this.env ? 0.08 : 1); this.envT *= envK;
        const v = this.env, fc = Math.min(sr * 0.45, 60 * Math.pow(2, v * (4 + color * 6))), g = 1 - Math.exp(-TAU * fc / sr);
        this.l1 += (o - this.l1) * g; this.l2 += (this.l1 - this.l2) * g; o = this.l2 * (v + (1 - v) * color * 0.25) * (1 - color * 0.25) + o * v * (1 - color) * 0.25;
      }
      O[i] = o * 5; A[i] = a * 5; const ab = Math.abs(o); if (ab > pk) pk = ab;
    }
    if (!isFinite(this.kl + this.l1 + this.l2 + this.res[0].y1)) { this.kl = this.l1 = this.l2 = 0; this.ks.b.fill(0); for (const R of this.res) R.y1 = R.y2 = 0; for (const s of this.sv) s.ic1 = s.ic2 = 0; }
    this.flash('led', Math.min(1, pk));
  }
}
class Texture extends DSP { // Clouds-inspired granular processor
  static IN = ['inL', 'inR', 'freeze', 'trig', 'pos', 'pitch']; static OUT = ['L', 'R'];
  constructor(e) {
    super(e); this.N = Math.round(e.sr * 4); this.bL = new Float32Array(this.N); this.bR = new Float32Array(this.N); this.w = 0; this.acc = 0; this.ts = new Schmitt();
    this.v = Array.from({ length: 24 }, () => ({ on: false, ph: 0, S: 1, r: 0, ratio: 1, gl: 1, gr: 1, pw: 1 })); this.bins = new Float32Array(48); this.bs = Math.ceil(this.N / 48); this.cb = -1; this.wl = 0; this.wr = 0;
  }
  spawn(pos, ratio, S, spread, pw) {
    const g = this.v.find(x => !x.on); if (!g) return;
    const span = Math.max(0, this.N - S * Math.max(1, ratio) - 2), back = S * Math.max(1, ratio) + clamp01(pos) * span;
    let r = this.w - back; while (r < 0) r += this.N;
    const pan = (Math.random() * 2 - 1) * spread; Object.assign(g, { on: true, ph: 0, S, r, ratio, gl: Math.sqrt(0.5 - pan * 0.5) * 1.41, gr: Math.sqrt(0.5 + pan * 0.5) * 1.41, pw });
  }
  process(n) {
    const P = this.p, I = this.in, sr = this.sr, N = this.N, bL = this.bL, bR = this.bR, IL = I.inL, IR = this.has.inR ? I.inR : I.inL, OL = this.out.L, OR = this.out.R;
    const size = 0.03 * Math.pow(33, P.size ?? 0.5), S = Math.max(16, Math.round(size * sr)), rate = 0.5 * Math.pow(100, P.dens ?? 0.45), tex = P.tex ?? 0.5, pw = 0.3 + tex * 3;
    const blend = P.blend ?? 0.75, spread = P.spread ?? 0.7, fb = (P.fb ?? 0.25) * 0.9, frzK = (P.frz | 0) === 1;
    const norm = 1 / Math.sqrt(1 + rate * size * 0.6); let act = 0;
    for (let i = 0; i < n; i++) {
      const frozen = frzK !== (I.freeze[i] > 1);
      const ratio = Math.pow(2, (P.pitch ?? 0) / 12 + I.pitch[i]), pos = (P.pos ?? 0.35) + I.pos[i] * 0.1;
      if (this.has.trig) { if (this.ts.step(I.trig[i])) this.spawn(pos, ratio, S, spread, pw); }
      else { this.acc += rate / sr * (0.4 + Math.random() * 1.2); if (this.acc >= 1) { this.acc -= 1; this.spawn(pos + (Math.random() - 0.5) * 0.04, ratio, S, spread, pw); } }
      let wl = 0, wr = 0;
      for (const g of this.v) {
        if (!g.on) continue;
        const t = g.ph / g.S, win = Math.pow(Math.sin(Math.PI * t), g.pw);
        const ri = g.r | 0, fr = g.r - ri, i1 = ri + 1 >= N ? 0 : ri + 1;
        const xl = bL[ri] * (1 - fr) + bL[i1] * fr, xr = bR[ri] * (1 - fr) + bR[i1] * fr;
        wl += xl * win * g.gl; wr += xr * win * g.gr;
        g.r += g.ratio; if (g.r >= N) g.r -= N; if (++g.ph >= g.S) g.on = false;
      }
      wl *= norm; wr *= norm; this.wl = wl; this.wr = wr;
      if (!frozen) {
        const xl = IL[i] + fb * wl, xr = IR[i] + fb * wr; bL[this.w] = 5 * Math.tanh(xl * 0.2); bR[this.w] = 5 * Math.tanh(xr * 0.2);
        const b = (this.w / this.bs) | 0; if (b !== this.cb) { this.cb = b; this.bins[b] = 0; } const a = Math.abs(bL[this.w]); if (a > this.bins[b]) this.bins[b] = a;
        if (++this.w >= N) this.w = 0;
      }
      OL[i] = IL[i] * (1 - blend) + wl * blend; OR[i] = IR[i] * (1 - blend) + wr * blend;
      this.frozen = frozen;
    }
    const gr = []; for (const g of this.v) if (g.on) { act++; gr.push(+((g.r / N).toFixed(3)), +(Math.sin(Math.PI * g.ph / g.S).toFixed(2))); }
    this.L.bins = Array.from(this.bins, x => +(x * 0.2).toFixed(2)); this.L.w = this.w / N; this.L.gr = gr; this.L.frz = this.frozen ? 1 : 0; this.L.act = act;
  }
}
class Folder extends DSP {
  static IN = ['in', 'cv']; static OUT = ['out'];
  constructor(e) { super(e); this.lp = 0; }
  process(n) {
    const P = this.p, I = this.in.in, C = this.in.cv, O = this.out.out, g0 = 1 + (P.fold ?? 0.3) * 7, sym = ((P.symm ?? 0.5) - 0.5) * 1.5, lv = P.level ?? 0.8, c = 1 - Math.exp(-TAU * 9000 / this.sr); let pk = 0;
    for (let i = 0; i < n; i++) { const g = Math.max(0.2, g0 + C[i] * 0.7), x = I[i] * 0.2 * g + sym; this.lp += (Math.sin(x * Math.PI * 0.5) - this.lp) * c; O[i] = this.lp * 5 * lv; const a = Math.abs(this.lp); if (a > pk) pk = a; }
    this.flash('led', pk);
  }
}
class LPG extends DSP { // dual vactrol low-pass gate
  static IN = ['in1', 'cv1', 'in2', 'cv2']; static OUT = ['out1', 'out2'];
  constructor(e) { super(e); this.c = [0, 1].map(() => ({ v: 0, ic1: 0, ic2: 0 })); }
  process(n) {
    const P = this.p, sr = this.sr, atk = 1 - Math.exp(-1 / (0.004 * sr));
    for (let c = 1; c <= 2; c++) {
      const ch = this.c[c - 1], I = this.in['in' + c], C = this.in['cv' + c], O = this.out['out' + c], off = P['off' + c] ?? 0, rs = P['resp' + c] ?? 0.5, td = 0.04 + rs * rs * 2.5, mode = P['mode' + c] ?? 1;
      for (let i = 0; i < n; i++) {
        let tgt = off + C[i] * 0.1; tgt = tgt < 0 ? 0 : tgt > 1 ? 1 : tgt;
        if (tgt > ch.v) ch.v += (tgt - ch.v) * atk; else ch.v += (tgt - ch.v) * (1 - Math.exp(-1 / (td * (1 + 1.5 * (1 - ch.v)) * sr)));
        const x = I[i]; let y = x;
        if (mode > 0) { const g = Math.tan(Math.PI * Math.min(sr * 0.45, 30 * Math.pow(2, ch.v * 9.4)) / sr), k = 1.2, a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2, v3 = x - ch.ic2, v1 = a1 * ch.ic1 + a2 * v3, v2 = ch.ic2 + a2 * ch.ic1 + a3 * v3; ch.ic1 = 2 * v1 - ch.ic1; ch.ic2 = 2 * v2 - ch.ic2; y = v2; }
        O[i] = mode === 0 ? x * ch.v : mode === 1 ? y * ch.v : y;
      }
      if (!isFinite(ch.ic1 + ch.ic2)) ch.ic1 = ch.ic2 = 0;
      this.L['led' + c] = ch.v;
    }
  }
}
const TSC = [null, SCALES[0][1], SCALES[1][1], SCALES[2][1]];
class Turing extends DSP { // looping shift-register random sequencer
  static IN = ['clk', 'chg']; static OUT = ['gate', 'cv'];
  constructor(e) { super(e); this.reg = (Math.random() * 65535) | 0; this.cs = new Schmitt(); this.v = 0; }
  process(n) {
    const P = this.p, len = Math.max(2, P.len | 0 || 8), range = P.range ?? 1.2, sc = P.scale | 0, C = this.in.clk, CH = this.in.chg, G = this.out.gate, V = this.out.cv;
    for (let i = 0; i < n; i++) {
      if (this.cs.step(C[i])) {
        const pr = clamp01((P.chg ?? 0.12) + CH[i] * 0.1); let bit = (this.reg >> (len - 1)) & 1; if (Math.random() < pr) bit ^= 1;
        this.reg = ((this.reg << 1) | bit) & 0xFFFF; let v = (this.reg & 0xFF) / 255 * range; if (sc > 0) v = quantTo(v * 12, TSC[sc]) / 12; this.v = v;
      }
      V[i] = this.v; G[i] = this.cs.s && (this.reg & 1) ? 10 : 0;
    }
    this.L.bits = this.reg & 0xFF;
  }
}
class Atten extends DSP { // quad attenuverter; unpatched input = +10V reference (offset source)
  static IN = ['in1', 'in2', 'in3', 'in4']; static OUT = ['out1', 'out2', 'out3', 'out4'];
  process(n) { for (let k = 1; k <= 4; k++) { const a = this.p['a' + k] ?? 0, I = this.in['in' + k], O = this.out['out' + k], h = this.has['in' + k]; for (let i = 0; i < n; i++) O[i] = (h ? I[i] : 10) * a; } }
}


class TrigSeq extends DSP { // 6 tracks x 16 steps trigger sequencer with swing
  static IN = ['clk', 'rst']; static OUT = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  constructor(e) { super(e); this.cs = new Schmitt(); this.rs = new Schmitt(); this.step = -1; this.per = e.sr * 0.12; this.since = 0; this.wait = -1; this.gt = new Int32Array(6); this.O = TrigSeq.OUT.map(k => this.out[k]); }
  fire() { const s = this.step; for (let r = 0; r < 6; r++) if ((this.p['b' + r + '_' + s] | 0) === 1) { this.gt[r] = Math.round(0.008 * this.sr); this.flash('t' + r, 1); } }
  process(n) {
    const C = this.in.clk, R = this.in.rst, O = this.O, len = Math.max(1, this.p.len | 0 || 16), sw = this.p.swing ?? 0;
    for (let i = 0; i < n; i++) {
      this.since++;
      if (this.rs.step(R[i])) this.step = -1;
      if (this.cs.step(C[i])) { this.per = this.since; this.since = 0; this.step = (this.step + 1) % len; if (this.step % 2 === 1 && sw > 0.001) this.wait = Math.round(this.per * sw * 0.5); else this.fire(); }
      if (this.wait >= 0) { if (this.wait === 0) this.fire(); this.wait--; }
      for (let r = 0; r < 6; r++) { O[r][i] = this.gt[r] > 0 ? 10 : 0; if (this.gt[r] > 0) this.gt[r]--; }
    }
    this.L.step = this.step;
  }
}
const HATF = [205.3, 304.4, 369.6, 522.7, 540, 800];
class Drums extends DSP { // kick, clap, closed hat, open hat (closed chokes open)
  static IN = ['tk', 'tc', 'th', 'to']; static OUT = ['k', 'c', 'h', 'o', 'mix'];
  constructor(e) { super(e); this.st = [0, 1, 2, 3].map(() => new Schmitt()); this.kt = 1e9; this.kph = 0; this.ct = 1e9; this.ic1 = 0; this.ic2 = 0; this.ht = 1e9; this.ot = 1e9; this.hph = new Float32Array(6); this.hx = 0; this.hy = 0; this.lastScale = 1; }
  process(n) {
    const P = this.p, sr = this.sr, dt = 1 / sr, I = this.in, O = this.out;
    const kf = 35 + (P.kTune ?? 0.4) * 55, kd = 0.08 + (P.kDec ?? 0.45) * 0.9, kl = P.kLvl ?? 0.9;
    const cf = 700 + (P.cTune ?? 0.5) * 2000, cd = 0.03 + (P.cDec ?? 0.35) * 0.3, cl = P.cLvl ?? 0.7;
    const hs = 0.8 + (P.hTune ?? 0.5) * 1.2, hd = 0.015 + (P.hDec ?? 0.3) * 0.15, hl = P.hLvl ?? 0.5;
    const os = 0.8 + (P.oTune ?? 0.5) * 1.2, od = 0.1 + (P.oDec ?? 0.4) * 0.8, ol = P.oLvl ?? 0.45;
    const g = Math.tan(Math.PI * cf / sr), kq = 1 / 2.2, a1 = 1 / (1 + g * (g + kq)), a2 = g * a1, a3 = g * a2, hpA = Math.exp(-TAU * 6500 / sr);
    const K = O.k, C = O.c, H = O.h, OH = O.o, M = O.mix;
    for (let i = 0; i < n; i++) {
      if (this.st[0].step(I.tk[i])) { this.kt = 0; this.kph = 0; this.flash('k', 1); }
      if (this.st[1].step(I.tc[i])) { this.ct = 0; this.flash('c', 1); }
      if (this.st[2].step(I.th[i])) { this.ht = 0; this.ot = 1e9; this.lastScale = hs; this.flash('h', 1); }
      if (this.st[3].step(I.to[i])) { this.ot = 0; this.lastScale = os; this.flash('o', 1); }
      let k = 0; if (this.kt < kd * 7) { const t = this.kt; this.kph += kf * (1 + 3.5 * Math.exp(-t * 32)) * dt; k = Math.sin(TAU * this.kph) * Math.exp(-t / kd); if (t < 0.003) k += (Math.random() * 2 - 1) * 0.35 * (1 - t / 0.003); k = Math.tanh(k * 1.7); this.kt += dt; }
      let c = 0; if (this.ct < cd * 7) {
        const t = this.ct; let env = t < 0.032 ? Math.exp(-(t % 0.008) / 0.0022) : 0; if (t >= 0.024) env = Math.max(env, Math.exp(-(t - 0.024) / cd) * 0.8);
        const x = Math.random() * 2 - 1, v3 = x - this.ic2, v1 = a1 * this.ic1 + a2 * v3, v2 = this.ic2 + a2 * this.ic1 + a3 * v3; this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2; c = v1 * env * 3; this.ct += dt;
      }
      let h = 0, o = 0; const hon = this.ht < hd * 7, oon = this.ot < od * 7;
      if (hon || oon) {
        let m = 0; for (let j = 0; j < 6; j++) { let q = this.hph[j] + HATF[j] * this.lastScale * dt; if (q >= 1) q -= 1; this.hph[j] = q; m += q < 0.5 ? 1 : -1; }
        const x = m / 6 * 0.7 + (Math.random() * 2 - 1) * 0.45; this.hy = hpA * (this.hy + x - this.hx); this.hx = x;
        if (hon) { h = this.hy * Math.exp(-this.ht / hd); this.ht += dt; } if (oon) { o = this.hy * Math.exp(-this.ot / od); this.ot += dt; }
      }
      K[i] = k * 5; C[i] = c * 5; H[i] = h * 5; OH[i] = o * 5; M[i] = (k * kl + c * cl + h * hl + o * ol) * 4.5;
    }
  }
}
class Mix6 extends DSP { // 6-channel stereo mixer with equal-power pan
  static IN = ['in1', 'in2', 'in3', 'in4', 'in5', 'in6']; static OUT = ['L', 'R'];
  process(n) {
    const gl = [], gr = [], I = []; for (let k = 1; k <= 6; k++) { const lv = this.p['lvl' + k] ?? 0.7, a = ((this.p['pan' + k] ?? 0) + 1) * Math.PI / 4; gl.push(Math.cos(a) * 1.4142 * lv); gr.push(Math.sin(a) * 1.4142 * lv); I.push(this.in['in' + k]); }
    const m = this.p.master ?? 0.8, OL = this.out.L, OR = this.out.R;
    for (let i = 0; i < n; i++) { let l = 0, r = 0; for (let k = 0; k < 6; k++) { const x = I[k][i]; l += x * gl[k]; r += x * gr[k]; } OL[i] = l * m + (Math.random() - 0.5) * 0.001; OR[i] = r * m + (Math.random() - 0.5) * 0.001; }
    this.peak('vuL', OL, n); this.peak('vuR', OR, n);
  }
}
class Duck extends DSP { // sidechain-style ducker, triggered by a kick
  static IN = ['inL', 'inR', 'trig']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.ts = new Schmitt(); this.env = 0; this.gs = 1; }
  process(n) {
    const d = this.p.depth ?? 0.6, rel = 0.04 + (this.p.rel ?? 0.3) * 0.8, cu = 0.5 + (this.p.shape ?? 0.5) * 2, k = Math.exp(-1 / (rel * this.sr * 0.3));
    const IL = this.in.inL, IR = this.has.inR ? this.in.inR : this.in.inL, T = this.in.trig, OL = this.out.L, OR = this.out.R;
    for (let i = 0; i < n; i++) { if (this.ts.step(T[i])) this.env = 1; else this.env *= k; const g = 1 - d * Math.pow(this.env, 1 / cu); this.gs += (g - this.gs) * 0.03; OL[i] = IL[i] * this.gs; OR[i] = IR[i] * this.gs; }
    this.L.gr = 1 - this.gs;
  }
}

// ---------------------------------------------------------------- house-beat row
// GROOVE: Grids-style pattern generator. Each style has two maps (A/B); a digit is how important a step is (0-9).
// A step fires when its weight beats the density threshold, so turning a density knob adds or removes notes in a musical order.
export const GROOVES = [
  ['HOUSE', { k: '9000900090009000', s: '0000000000000000', c: '0000900000009000', h: '2525252525252525', o: '0080008000800080', p: '0000003000020000' },
            { k: '9000900090009040', s: '0000000300000002', c: '0000900000009040', h: '5355535553555355', o: '0070007000700070', p: '0040040000400400' }],
  ['DEEP', { k: '9000900090009000', s: '0000000000000300', c: '0000700000007000', h: '4646464646464646', o: '0050000000500000', p: '0050005000500050' },
           { k: '9000900090009003', s: '0000000200000300', c: '0000700000007000', h: '3636363636363636', o: '0000006000000060', p: '0030503000305030' }],
  ['TECH', { k: '9000900090009000', s: '0000700000007000', c: '0000600000006000', h: '7777777777777777', o: '0090009000900090', p: '3060036030600360' },
           { k: '9000900090009060', s: '0000700000007000', c: '0000600000006003', h: '7575757575757575', o: '0090009000900090', p: '6006006006006006' }],
  ['GARAGE', { k: '9000000000900000', s: '0000900000009000', c: '0000700000007000', h: '0050505000505050', o: '0000000500000005', p: '0300000300300000' },
             { k: '9000000090900000', s: '0000900300009000', c: '0000700000007000', h: '5050505050505050', o: '0000000600000006', p: '0030000300300030' }],
  ['DISCO', { k: '9000900090009000', s: '0000900000009000', c: '0000500000005000', h: '0606060606060606', o: '0090009000900090', p: '0000000000000000' },
            { k: '9000900090009000', s: '0000900000009030', c: '0000500000005000', h: '6666666666666666', o: '0090009000900090', p: '0000000000005573' }],
  ['BREAKS', { k: '9090000000990000', s: '0000900505009005', c: '0000000000000000', h: '7575757575757575', o: '0000000000000000', p: '0000000000000000' },
             { k: '9090000000900000', s: '0000900505009060', c: '0000000000000000', h: '7575757575757575', o: '0000000000000060', p: '0000030000000300' }],
  ['DNB', { k: '9000000000900000', s: '0000900000009000', c: '0000000000000000', h: '6363636363636363', o: '0000000000000000', p: '0000003000000030' },
          { k: '9000000000500900', s: '0000900300009030', c: '0000000000000000', h: '6464646464646464', o: '0060000000000000', p: '0300003003000300' }],
  ['DUSTY', { k: '9000000590300000', s: '0000900000009000', c: '0000000000000000', h: '5252525252525252', o: '0000000000000000', p: '4545454545454545' },
            { k: '9000003090000040', s: '0000900000009003', c: '0000000000000000', h: '5353535353535353', o: '0000000000000050', p: '3535353535353535' }]
];
const GR_KEYS = ['k', 's', 'c', 'h', 'o', 'p'], GR_DEN = ['kDen', 'sDen', 'sDen', 'hDen', 'hDen', 'pDen'];
export function grooveWeight(style, v, inst, step) {
  const g = GROOVES[Math.max(0, Math.min(GROOVES.length - 1, style | 0))], a = +g[1][inst][step % 16], b = +g[2][inst][step % 16];
  return a + (b - a) * v;
}
class Groove extends DSP {
  static IN = ['clk', 'rst']; static OUT = ['kick', 'snare', 'clap', 'hat', 'open', 'perc'];
  constructor(e) { super(e); this.cs = new Schmitt(); this.rs = new Schmitt(); this.step = -1; this.per = e.sr * 0.12; this.since = 0; this.wait = -1; this.gt = new Int32Array(6); this.jit = new Float32Array(96); this.O = Groove.OUT.map(k => this.out[k]); }
  fire() {
    const P = this.p, s = this.step, st = P.style | 0, v = P.var ?? 0;
    if (s === 0) { const ch = P.chaos ?? 0; for (let i = 0; i < 96; i++) this.jit[i] = (Math.random() * 2 - 1) * ch * 4.5; }
    let hatFired = false;
    for (let r = 0; r < 6; r++) {
      const w = grooveWeight(st, v, GR_KEYS[r], s) + this.jit[r * 16 + s], d = P[GR_DEN[r]] ?? 0.5;
      if (w > 0.5 && w / 9 > 1 - d) { if (r === 4 && hatFired) continue; this.gt[r] = Math.round(0.008 * this.sr); this.flash(GR_KEYS[r], 1); if (r === 3) hatFired = true; }
    }
  }
  process(n) {
    const C = this.in.clk, R = this.in.rst, O = this.O, sw = this.p.swing ?? 0;
    for (let i = 0; i < n; i++) {
      this.since++;
      if (this.rs.step(R[i])) this.step = -1;
      if (this.cs.step(C[i])) { this.per = this.since; this.since = 0; this.step = (this.step + 1) % 16; if (this.step % 2 === 1 && sw > 0.001) this.wait = Math.round(this.per * sw * 0.5); else this.fire(); }
      if (this.wait >= 0) { if (this.wait === 0) this.fire(); this.wait--; }
      for (let r = 0; r < 6; r++) { O[r][i] = this.gt[r] > 0 ? 10 : 0; if (this.gt[r] > 0) this.gt[r]--; }
    }
    this.L.step = this.step;
  }
}
// PERC: snare, rim, shaker, tom
class Perc extends DSP {
  static IN = ['ts', 'tr', 'tsh', 'tt']; static OUT = ['s', 'r', 'sh', 't', 'mix'];
  constructor(e) { super(e); this.st = [0, 1, 2, 3].map(() => new Schmitt()); this.T = [1e9, 1e9, 1e9, 1e9]; this.ph = [0, 0, 0, 0, 0]; this.f = { s1: 0, s2: 0, h1: 0, h2: 0, b1: 0, b2: 0 }; }
  process(n) {
    const P = this.p, sr = this.sr, dt = 1 / sr, I = this.in, O = this.out, T = this.T, ph = this.ph, f = this.f;
    const sT = 0.7 + (P.sTune ?? 0.5) * 0.8, sD = 0.06 + (P.sDec ?? 0.4) * 0.35, sL = P.sLvl ?? 0.7;
    const rT = 0.7 + (P.rTune ?? 0.5) * 0.8, rD = 0.012 + (P.rDec ?? 0.3) * 0.06, rL = P.rLvl ?? 0.6;
    const shC = 3000 + (P.shTune ?? 0.5) * 6000, shD = 0.025 + (P.shDec ?? 0.35) * 0.18, shL = P.shLvl ?? 0.5;
    const tF = 70 + (P.tTune ?? 0.4) * 330, tD = 0.08 + (P.tDec ?? 0.4) * 0.6, tL = P.tLvl ?? 0.6;
    const g1 = Math.tan(Math.PI * Math.min(0.45 * sr, 1800 * sT) / sr), g2 = Math.tan(Math.PI * Math.min(0.45 * sr, shC) / sr), g3 = Math.tan(Math.PI * 1700 * rT / sr);
    const ins = [I.ts, I.tr, I.tsh, I.tt], S = O.s, R = O.r, SH = O.sh, TO = O.t, M = O.mix, keys = ['s', 'r', 'sh', 't'];
    for (let i = 0; i < n; i++) {
      for (let v = 0; v < 4; v++) if (this.st[v].step(ins[v][i])) { T[v] = 0; if (v === 3) ph[3] = 0; this.flash(keys[v], 1); }
      let s = 0; if (T[0] < sD * 7) { const t = T[0]; ph[0] += 185 * sT * (1 + 0.5 * Math.exp(-t * 60)) * dt; ph[1] += 330 * sT * dt; const body = (Math.sin(TAU * ph[0]) * 0.6 + Math.sin(TAU * ph[1]) * 0.35) * Math.exp(-t / (sD * 0.45));
        const x = Math.random() * 2 - 1; f.s1 += g1 * (x - f.s1); const hp = x - f.s1; s = Math.tanh((body + hp * 1.1 * Math.exp(-t / sD)) * 1.4); T[0] += dt; }
      let r = 0; if (T[1] < rD * 7) { const t = T[1]; ph[2] += 1700 * rT * dt; r = (Math.sin(TAU * ph[2]) * 0.7 + Math.sin(TAU * ph[2] * 0.29) * 0.4) * Math.exp(-t / rD); if (t < 0.0015) r += (Math.random() * 2 - 1) * 0.6; T[1] += dt; }
      let sh = 0; if (T[2] < shD * 7) { const t = T[2], x = Math.random() * 2 - 1; f.h1 += g2 * (x - f.h1); const hp = x - f.h1; f.h2 += g2 * 0.6 * (hp - f.h2); sh = (hp - f.h2 * 0.5) * Math.min(1, t / 0.006) * Math.exp(-t / shD) * 1.3; T[2] += dt; }
      let to = 0; if (T[3] < tD * 7) { const t = T[3]; ph[3] += tF * (1 + 0.45 * Math.exp(-t * 22)) * dt; to = Math.tanh(Math.sin(TAU * ph[3]) * 1.3) * Math.exp(-t / tD); if (t < 0.002) to += (Math.random() * 2 - 1) * 0.2; T[3] += dt; }
      if (ph[0] > 1e6) ph[0] = ph[1] = ph[2] = 0;
      S[i] = s * 5; R[i] = r * 3.2; SH[i] = sh * 5; TO[i] = to * 5; M[i] = (s * sL + r * rL * 0.65 + sh * shL + to * tL) * 4.2;
    }
  }
}
// STAB: chord synth (detuned saw pairs → resonant low-pass with its own envelope), stereo
export const STAB_CHORDS = [[0, 3, 7, 10], [0, 3, 7, 10, 14], [0, 4, 7, 11], [0, 4, 7, 11, 14], [0, 3, 7, 10, 17], [0, 5, 7, 10], [0, 4, 7, 10, 14], [0, 4, 7, 14], [0, 3, 7, 12], [0, 7, 12],
  [0, 4, 10, 14, 21], [0, 4, 7, 10, 13], [0, 3, 6, 10], [0, 4, 9, 14], [0, 3, 9, 14], [0, 5, 10, 14], [0, 4, 7, 11, 18]];
export const STAB_NAMES = ['MIN 7', 'MIN 9', 'MAJ 7', 'MAJ 9', 'MIN 11', '7 SUS 4', 'DOM 9', 'ADD 9', 'MINOR', 'FIFTHS', 'DOM 13', '7 FLAT 9', 'MIN 7 FLAT 5', '6/9', 'MIN 6/9', '9 SUS 4', 'MAJ 7 #11'];
function leadVoicing(ch, root, prev, home) { // jazz voicing: drop the root (the bass has it) when there are 4+ notes, then choose the inversion and octave that moves least
  let iv = ch.length >= 4 ? ch.filter(x => x % 12 !== 0) : ch.slice(); if (iv.length < 3) iv = ch.slice();
  let best = null, bc = 1e9;
  for (let r = 0; r < iv.length; r++) for (const o of [-24, -12, 0, 12]) {
    const v = iv.map((x, i) => root + x + (i < r ? 12 : 0) + o).sort((a, b) => a - b), mean = v.reduce((a, b) => a + b, 0) / v.length;
    if (v[0] < -7 || v[v.length - 1] > 26) continue;
    let c = Math.abs(mean - home) * (prev ? 0.35 : 1);
    if (prev) for (const x of v) { let d = 99; for (const y of prev) d = Math.min(d, Math.abs(x - y)); c += d; }
    if (c < bc) { bc = c; best = v; } }
  return best || iv.map(x => root + x);
}
class Stab extends DSP {
  static IN = ['voct', 'trig', 'chord']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.ph = new Float32Array(10).map(() => Math.random()); this.ts = new Schmitt(); this.env = 0; this.fenv = 0; this.att = false; this.z = [0, 0, 0, 0]; }
  process(n) {
    const P = this.p, sr = this.sr, I = this.in, OL = this.out.L, OR = this.out.R;
    const cv = this.has.chord ? I.chord[0] : 0, ci = Math.max(0, Math.min(STAB_CHORDS.length - 1, Math.round((P.chord ?? 0) + cv))), ch = STAB_CHORDS[ci];
    const inv = Math.floor((P.voice ?? 0) * ch.length * 0.99), det = (P.detune ?? 0.3) * 0.012; let notes = ch.map((s, i) => (i < inv ? s + 12 : s) - (inv > ch.length / 2 ? 12 : 0));
    let base = 130.81 * Math.pow(2, (this.has.voct ? I.voct[0] : 0) + (P.oct ?? 0));
    if (this.has.chord) { const rs = Math.round(((this.has.voct ? I.voct[0] : 0) + (P.oct ?? 0)) * 12), key = ci + ':' + rs;
      if (key !== this.vkey) { this.vkey = key; this.voicing = leadVoicing(ch, rs, this.voicing, 2 + Math.round((P.voice ?? 0.25) * 8)); }
      notes = this.voicing; base = 130.81; }
    const dec = 0.08 + (P.decay ?? 0.35) * 1.6, atk = 0.002 + (P.attack ?? 0) * 0.4, kd = Math.exp(-1 / (dec * sr)), kfd = Math.exp(-1 / (dec * 0.55 * sr)), ka = 1 - Math.exp(-1 / (atk * sr));
    const cut = P.cutoff ?? 1200, envAmt = (P.env ?? 0.5) * 5, res = (P.res ?? 0.2) * 1.8, gate = this.has.trig, T = I.trig, lvl = P.level ?? 0.8;
    const inc = []; for (let v = 0; v < notes.length; v++) { const f = base * Math.pow(2, notes[v] / 12); inc.push(f * (1 - det) / sr, f * (1 + det) / sr); }
    const z = this.z, ph = this.ph, nv = inc.length, norm = 1 / Math.sqrt(notes.length);
    for (let i = 0; i < n; i++) {
      if (gate) { if (this.ts.step(T[i])) { this.att = true; this.fenv = 1; this.flash('led', 1); } if (this.att) { this.env += (1.05 - this.env) * ka; if (this.env >= 1) { this.env = 1; this.att = false; } } else this.env *= kd; this.fenv *= kfd; }
      else { this.env = 1; this.fenv = 0.3; }
      let l = 0, r = 0;
      for (let v = 0; v < nv; v++) { let p = ph[v] + inc[v]; if (p >= 1) p -= 1; ph[v] = p; const s = 2 * p - 1 - blep(p, inc[v]); if (v & 1) r += s; else l += s; }
      const fc = Math.min(0.45 * sr, cut * Math.pow(2, envAmt * this.fenv)), g = Math.tan(Math.PI * fc / sr), k = 2 - res, a1 = 1 / (1 + g * (g + k));
      // two TPT state-variable low-passes (L, R)
      let v3 = l * norm - z[1], v1 = a1 * z[0] + g * a1 * v3, v2 = z[1] + g * v1; z[0] = 2 * v1 - z[0]; z[1] = 2 * v2 - z[1]; const yl = v2;
      v3 = r * norm - z[3]; v1 = a1 * z[2] + g * a1 * v3; v2 = z[3] + g * v1; z[2] = 2 * v1 - z[2]; z[3] = 2 * v2 - z[3]; const yr = v2;
      OL[i] = Math.tanh(yl * this.env * 0.9) * 5 * lvl; OR[i] = Math.tanh(yr * this.env * 0.9) * 5 * lvl;
    }
    this.L.chord = ci;
  }
}
// BASS: mono bass voice. WAVE morphs sine-sub → saw → square → reese (two detuned saws).
class Bass extends DSP {
  static IN = ['voct', 'gate', 'cut']; static OUT = ['out'];
  constructor(e) { super(e); this.ph = [0, 0.3, 0.6]; this.pv = 0; this.ts = new Schmitt(); this.env = 0; this.fenv = 0; this.z = [0, 0, 0, 0]; }
  process(n) {
    const P = this.p, sr = this.sr, I = this.in, O = this.out.out, wave = P.wave ?? 1, gl = (P.glide ?? 0) * 0.25, kg = gl > 0.001 ? 1 - Math.exp(-1 / (gl * sr)) : 1;
    const dec = 0.06 + (P.decay ?? 0.3) * 1.2, kd = Math.exp(-1 / (dec * sr)), kfd = Math.exp(-1 / (dec * 0.5 * sr)), gate = this.has.gate, G = I.gate;
    const cut = P.cutoff ?? 400, envAmt = (P.env ?? 0.5) * 6, res = (P.res ?? 0.3) * 3.6, drive = 1 + (P.drive ?? 0.2) * 5, cutCv = this.has.cut ? I.cut[0] : 0;
    const V = I.voct, hv = this.has.voct, oct = P.oct ?? -1, ph = this.ph, z = this.z;
    const wS = Math.max(0, 1 - wave), wSaw = Math.max(0, 1 - Math.abs(wave - 1)), wSq = Math.max(0, 1 - Math.abs(wave - 2)), wR = Math.max(0, wave - 2);
    for (let i = 0; i < n; i++) {
      const tv = hv ? V[i] : 0; this.pv += (tv - this.pv) * kg;
      if (gate) { if (this.ts.step(G[i])) { this.env = 1; this.fenv = 1; this.flash('led', 1); } else { this.env *= kd; } this.fenv *= kfd; } else { this.env = 1; this.fenv = 0.25; }
      const f = 65.41 * Math.pow(2, oct + this.pv), d0 = f / sr, d1 = d0 * 1.007, d2 = d0 * 0.993;
      let p = ph[0] + d0; if (p >= 1) p -= 1; ph[0] = p; let q = ph[1] + d1; if (q >= 1) q -= 1; ph[1] = q; let u = ph[2] + d2; if (u >= 1) u -= 1; ph[2] = u;
      const saw = 2 * p - 1 - blep(p, d0); let sq = (p < 0.5 ? 1 : -1) + blep(p, d0); let p2 = p + 0.5; if (p2 >= 1) p2 -= 1; sq -= blep(p2, d0);
      const reese = (saw + (2 * q - 1 - blep(q, d1)) + (2 * u - 1 - blep(u, d2))) / 2.2;
      const sub = Math.sin(TAU * p) * 1.2;
      let x = sub * wS + saw * wSaw + sq * wSq * 0.8 + reese * wR;
      const fc = Math.min(0.45 * sr, cut * Math.pow(2, envAmt * this.fenv + cutCv)), g = Math.tan(Math.PI * fc / sr);
      // 4-pole cascade with feedback (rough ladder)
      const fb = res * Math.tanh(z[3]); x = Math.tanh(x - fb);
      for (let s = 0; s < 4; s++) { const v = (x - z[s]) * g / (1 + g), y = v + z[s]; z[s] = y + v; x = y; }
      O[i] = Math.tanh(x * drive * (1 + res * 0.25) * this.env) * 4.5;
    }
  }
}
// TAPE: wow & flutter (modulated delay), saturation, age (tone), hiss and dust
class Tape extends DSP {
  static IN = ['inL', 'inR', 'wow']; static OUT = ['L', 'R'];
  constructor(e) { super(e); const n = Math.ceil(e.sr * 0.06); this.dl = new DLine(n); this.dr = new DLine(n); this.w = 0; this.wr = 0; this.fp = 0; this.lp = [0, 0]; this.hp = [0, 0, 0, 0]; this.hs = 0; this.pop = 0; this.popv = 0; }
  process(n) {
    const P = this.p, sr = this.sr, I = this.in, OL = this.out.L, OR = this.out.R, IL = I.inL, IR = this.has.inR ? I.inR : I.inL, W = I.wow, hw = this.has.wow;
    const wow = P.wow ?? 0.3, flut = P.flutter ?? 0.2, drv = 0.3 + (P.drive ?? 0.3) * 3, age = P.age ?? 0.3, hiss = (P.hiss ?? 0.15) * 0.08, dust = (P.dust ?? 0.1);
    const lpc = 1 - Math.exp(-TAU * (14000 * Math.pow(1 - age, 2.2) + 1200) / sr), hpc = Math.exp(-TAU * (15 + age * 160) / sr), norm = 1 / Math.tanh(drv);
    const base = 0.012 * sr;
    for (let i = 0; i < n; i++) {
      this.w += (0.35 + 0.25 * Math.sin(this.wr)) / sr; this.wr += 0.07 / sr; if (this.w > 1) this.w -= 1; this.fp += 7.3 / sr; if (this.fp > 1) this.fp -= 1;
      const m = wow * 0.004 * sr * (Math.sin(TAU * this.w) + 0.3 * Math.sin(TAU * this.w * 2.3)) + flut * 0.00025 * sr * Math.sin(TAU * this.fp) + (hw ? W[i] * 0.0008 * sr : 0);
      this.dl.write(IL[i]); this.dr.write(IR[i]);
      const d = Math.max(2, base + m);
      let l = this.dl.readf(d), r = this.dr.readf(d + 0.3);
      l = Math.tanh(l / 5 * drv) * norm * 5; r = Math.tanh(r / 5 * drv) * norm * 5;
      this.lp[0] += lpc * (l - this.lp[0]); this.lp[1] += lpc * (r - this.lp[1]);
      const hl = hpc * (this.hp[1] + this.lp[0] - this.hp[0]); this.hp[0] = this.lp[0]; this.hp[1] = hl;
      const hr = hpc * (this.hp[3] + this.lp[1] - this.hp[2]); this.hp[2] = this.lp[1]; this.hp[3] = hr;
      this.hs += 0.35 * ((Math.random() * 2 - 1) - this.hs);
      if (Math.random() < dust * 0.0004) { this.pop = 1; this.popv = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random()); }
      const pp = this.pop * this.popv; this.pop *= 0.82;
      OL[i] = hl + (this.hs * hiss + pp * dust * 0.6) * 5; OR[i] = hr + (this.hs * hiss * 0.9 + pp * dust * 0.5) * 5;
    }
    this.L.wow = 0.5 + 0.5 * Math.sin(TAU * this.w);
  }
}

// ---------------------------------------------------------------- polish row (master bus): GLUE, EQ, WIDE, LIMIT
class BQ { // RBJ biquad, direct form II transposed
  constructor() { this.z1 = 0; this.z2 = 0; this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.key = ''; }
  set(type, f, q, gdb, sr) {
    const key = type + f + '|' + q + '|' + gdb; if (key === this.key) return; this.key = key;
    f = Math.min(f, sr * 0.45); const w = TAU * f / sr, c = Math.cos(w), sn = Math.sin(w), A = Math.pow(10, gdb / 40); let b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { const al = sn / (2 * q); b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'peak') { const al = sn / (2 * q); b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    else { const be = 2 * Math.sqrt(A) * (sn / 2) * Math.SQRT2;
      if (type === 'low') { b0 = A * ((A + 1) - (A - 1) * c + be); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - be); a0 = (A + 1) + (A - 1) * c + be; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - be; }
      else { b0 = A * ((A + 1) + (A - 1) * c + be); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - be); a0 = (A + 1) - (A - 1) * c + be; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - be; } }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  step(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}
class Glue extends DSP { // stereo bus compressor: soft knee, dB-domain smoothing, makeup and parallel mix; optional sidechain key
  static IN = ['inL', 'inR', 'sc']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.g = 0; }
  process(n) {
    const P = this.p, sr = this.sr, thr = P.thr ?? -14, ratio = P.ratio ?? 3, knee = 6, k1 = 1 - 1 / ratio, mk = Math.exp((P.makeup ?? 3) * 0.11512925), mix = P.mix ?? 1;
    const ac = Math.exp(-1 / (Math.max(0.0003, P.atk ?? 0.01) * sr)), rc = Math.exp(-1 / (Math.max(0.01, P.rel ?? 0.2) * sr));
    const IL = this.in.inL, IR = this.has.inR ? this.in.inR : this.in.inL, S = this.in.sc, hs = this.has.sc, OL = this.out.L, OR = this.out.R;
    for (let i = 0; i < n; i++) {
      const lv = (hs ? Math.abs(S[i]) : Math.max(Math.abs(IL[i]), Math.abs(IR[i]))) * 0.2, db = 8.685889 * Math.log(lv > 1e-5 ? lv : 1e-5), over = db - thr;
      const gr = over <= -knee / 2 ? 0 : over >= knee / 2 ? over * k1 : (over + knee / 2) * (over + knee / 2) / (2 * knee) * k1;
      this.g = gr > this.g ? ac * this.g + (1 - ac) * gr : rc * this.g + (1 - rc) * gr;
      const gain = Math.exp(-this.g * 0.11512925) * mk;
      OL[i] = IL[i] * (1 - mix) + IL[i] * gain * mix; OR[i] = IR[i] * (1 - mix) + IR[i] * gain * mix;
    }
    this.L.gr = Math.min(1, this.g / 10);
  }
}
class EQ extends DSP { // high-pass, low shelf (110 Hz), sweepable peak, high shelf (7.5 kHz)
  static IN = ['inL', 'inR']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.c = [0, 1].map(() => ({ hp: new BQ(), lo: new BQ(), mid: new BQ(), hi: new BQ() })); }
  process(n) {
    const P = this.p, sr = this.sr, IL = this.in.inL, IR = this.has.inR ? this.in.inR : this.in.inL, OL = this.out.L, OR = this.out.R;
    for (const c of this.c) { c.hp.set('hp', P.hp ?? 20, 0.707, 0, sr); c.lo.set('low', 110, 0.7, P.low ?? 0, sr); c.mid.set('peak', P.midf ?? 1000, P.mq ?? 0.9, P.mid ?? 0, sr); c.hi.set('high', 7500, 0.7, P.high ?? 0, sr); }
    const a = this.c[0], b = this.c[1];
    for (let i = 0; i < n; i++) {
      OL[i] = a.hi.step(a.mid.step(a.lo.step(a.hp.step(IL[i]))));
      OR[i] = b.hi.step(b.mid.step(b.lo.step(b.hp.step(IR[i]))));
    }
  }
}
class Wide extends DSP { // ensemble chorus + mid/side width with the bass kept mono
  static IN = ['inL', 'inR']; static OUT = ['L', 'R'];
  constructor(e) { super(e); const n = Math.ceil(e.sr * 0.05); this.dl = new DLine(n); this.dr = new DLine(n); this.ph = 0; this.h = [0, 0, 0, 0]; this.xp = 0; this.xq = 0; }
  process(n) {
    const P = this.p, sr = this.sr, IL = this.in.inL, IR = this.has.inR ? this.in.inR : this.in.inL, OL = this.out.L, OR = this.out.R;
    const wd = P.width ?? 1.2, mono = P.mono ?? 120, cm = P.chorus ?? 0.25, dp = (P.depth ?? 0.4) * 0.004 * sr, rate = P.rate ?? 0.7, base = 0.0125 * sr, hc = Math.exp(-TAU * mono / sr), h = this.h;
    for (let i = 0; i < n; i++) {
      this.ph += rate / sr; if (this.ph > 1) this.ph -= 1;
      this.dl.write(IL[i]); this.dr.write(IR[i]);
      const p = this.ph, tl = (this.dl.readf(base + dp * Math.sin(TAU * p)) + this.dl.readf(base * 1.3 + dp * Math.sin(TAU * (p + 0.33)))) * 0.5, tr = (this.dr.readf(base + dp * Math.sin(TAU * (p + 0.5))) + this.dr.readf(base * 1.3 + dp * Math.sin(TAU * (p + 0.83)))) * 0.5;
      let l = IL[i] * (1 - cm * 0.4) + tl * cm * 0.8, r = IR[i] * (1 - cm * 0.4) + tr * cm * 0.8;
      const m = (l + r) * 0.5, sd = (l - r) * 0.5;
      const y1 = hc * (h[0] + sd - h[1]); h[0] = y1; h[1] = sd; const y2 = hc * (h[2] + y1 - h[3]); h[2] = y2; h[3] = y1;
      const s2 = y2 * wd; OL[i] = m + s2; OR[i] = m - s2;
    }
    this.L.w = Math.min(1, wd / 2);
  }
}
class Limit extends DSP { // drive + high-frequency exciter + look-ahead brick-wall limiter with a soft ceiling
  static IN = ['inL', 'inR']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.D = 40; this.dl = new DLine(64); this.dr = new DLine(64); this.g = 1; this.hl = 0; this.hr = 0; }
  process(n) {
    const P = this.p, sr = this.sr, IL = this.in.inL, IR = this.has.inR ? this.in.inR : this.in.inL, OL = this.out.L, OR = this.out.R;
    const drv = Math.exp((P.drive ?? 3) * 0.11512925), c = 5 * Math.exp((P.ceil ?? -1) * 0.11512925), air = P.air ?? 0.2, ac = 1 - Math.exp(-1 / (0.00012 * sr)), rc = 1 - Math.exp(-1 / (Math.max(0.01, P.rel ?? 0.1) * sr)), lp = 1 - Math.exp(-TAU * 3500 / sr), D = this.D, c8 = 0.8 * c;
    let minG = 1;
    for (let i = 0; i < n; i++) {
      let l = IL[i] * drv, r = IR[i] * drv;
      this.hl += lp * (l - this.hl); this.hr += lp * (r - this.hr);
      l += air * 0.6 * Math.tanh((l - this.hl) * 0.8); r += air * 0.6 * Math.tanh((r - this.hr) * 0.8);
      const pk = Math.max(Math.abs(l), Math.abs(r)), need = pk > c8 ? c8 / pk : 1;
      this.g += need < this.g ? (need - this.g) * ac : (1 - this.g) * rc; if (this.g < minG) minG = this.g;
      this.dl.write(l); this.dr.write(r);
      let yl = this.dl.read(D) * this.g, yr = this.dr.read(D) * this.g;
      const al = Math.abs(yl); if (al > c8) yl = (yl > 0 ? 1 : -1) * (c8 + (c - c8) * Math.tanh((al - c8) / (c - c8)));
      const ar = Math.abs(yr); if (ar > c8) yr = (yr > 0 ? 1 : -1) * (c8 + (c - c8) * Math.tanh((ar - c8) / (c - c8)));
      OL[i] = yl; OR[i] = yr;
    }
    this.L.gr = 1 - minG;
  }
}

// ---------------------------------------------------------------- KEYS: play from MIDI, a computer keyboard or the touch keys
// 8-voice synth with several sounds, mixed over an audio thru, plus mono CV outs (last-note priority). Pitch bend ±2, mod wheel = vibrato.
export const KEY_SOUNDS = ['E.PIANO', 'ORGAN', 'PAD', 'STRINGS', 'PLUCK', 'BELL', 'LEAD', 'SUB BASS'];
class Keys extends DSP {
  static IN = ['inL', 'inR']; static OUT = ['voct', 'gate', 'vel', 'mod', 'L', 'R'];
  constructor(e) { super(e); this.V = Array.from({ length: 8 }, () => ({ n: -1, on: false, a: 0, rel: false, ph: [0, 0, 0], mph: 0, ix: 0, vel: 0, age: 0, l1: 0, l2: 0, ks: null, kp: 0, kl: 0, kz: 0, fe: 0 }));
    this.stack = []; this.cv = 0; this.vl = 0; this.md = 0; this.gap = 0; this.sus = false; this.tp = 0; this.bend = 0; this.vib = 0; }
  note(n, v) {
    if (v > 0) {
      this.stack = this.stack.filter(x => x !== n); this.stack.push(n); this.cv = (n - 60) / 12; this.vl = v / 127 * 10; if (this.stack.length > 1) this.gap = 48;
      let vo = this.V.find(x => x.n === n) || this.V.find(x => x.a < 0.0005 && !x.on) || this.V.reduce((a, b) => (a.age > b.age ? a : b));
      vo.n = n; vo.on = true; vo.rel = false; vo.vel = v / 127; vo.ix = 1; vo.age = 0; vo.fe = 1; if (vo.a < 0.001) { vo.ph = [Math.random(), Math.random(), Math.random()]; vo.mph = 0; vo.l1 = vo.l2 = 0; }
      if ((this.p.sound | 0) === 4) { const f = 440 * Math.pow(2, (n + (this.p.oct | 0) * 12 - 69) / 12), L = Math.max(4, this.sr / f); if (!vo.ks || vo.ks.length < L + 4) vo.ks = new Float32Array(Math.ceil(L) + 8); vo.kl = L; vo.kp = 0; vo.kz = 0; const b = 0.3 + (this.p.tone ?? 0.5) * 0.7; let lp = 0; for (let i = 0; i < vo.ks.length; i++) { const x = Math.random() * 2 - 1; lp += (x - lp) * b; vo.ks[i] = lp * (0.4 + 0.6 * vo.vel); } vo.a = 1; }
      this.flash('act', 1);
    } else {
      this.stack = this.stack.filter(x => x !== n); if (this.stack.length) this.cv = (this.stack[this.stack.length - 1] - 60) / 12;
      for (const vo of this.V) if (vo.n === n) vo.on = false;
    }
  }
  cc(c, v) { if (c === 1) this.md = v / 127 * 10; else if (c === 64) this.sus = v >= 64; else if (c === 123) { this.stack = []; for (const vo of this.V) vo.on = false; } else if (c === 'bend') this.bend = v * 2; }
  process(n) {
    const P = this.p, sr = this.sr, IL = this.in.inL, IR = this.has.inR ? this.in.inR : this.in.inL, O = this.out, oct = (P.oct | 0) * 12, snd = P.sound | 0;
    const tone = P.tone ?? 0.4, atk = 0.002 + Math.pow(P.attack ?? 0, 2) * 2.5, relT = 0.04 + Math.pow(P.decay ?? 0.45, 2) * 4.5, trem = P.trem ?? 0.3, lvl = (P.level ?? 0.7) * 3;
    const decaying = snd === 0 || snd === 5 || snd === 4, decT = snd === 5 ? relT * 2.2 + 0.5 : relT * 1.4 + 0.3;
    const kA = 1 / (atk * sr), kD = Math.exp(-1 / (decT * sr)), kR = Math.exp(-1 / (Math.min(relT, decaying ? relT : relT) * sr)), kI = Math.exp(-1 / (0.35 * sr)), kF = Math.exp(-1 / (0.25 * sr));
    const vibD = this.md / 10 * 0.35 + (snd === 1 || snd === 3 ? trem * 0.12 : 0), held = this.stack.length > 0;
    const fr = this.V.map(v => 440 * Math.pow(2, (v.n + oct - 69) / 12) / sr);
    let act = 0;
    for (let i = 0; i < n; i++) {
      this.tp += 4.5 / sr; if (this.tp > 1) this.tp -= 1; this.vib += 5.6 / sr; if (this.vib > 1) this.vib -= 1;
      const pan = Math.sin(TAU * this.tp) * (snd === 0 ? trem : trem * 0.3), pm = Math.pow(2, (this.bend + Math.sin(TAU * this.vib) * vibD) / 12);
      let l = 0, r = 0;
      for (let k = 0; k < 8; k++) { const v = this.V[k]; if (v.n < 0) continue;
        const hold = v.on || this.sus;
        if (snd !== 4) { if (hold && !v.rel && v.age < atk * sr) v.a = Math.min(1, v.a + kA); else if (hold) v.a *= decaying ? kD : 1; else v.a *= kR; }
        else v.a *= hold ? 1 : kR;
        v.age++; if (v.a < 1e-4 && !v.on && v.age > 64) { v.n = -1; continue; }
        const f = fr[k] * pm; let x = 0;
        if (snd === 0) { v.ix *= kI; v.mph += f; if (v.mph > 1) v.mph -= 1; v.ph[0] += f; if (v.ph[0] > 1) v.ph[0] -= 1; const I = (0.4 + tone * 3.2) * (0.35 + 0.65 * v.vel) * (0.25 + 0.75 * v.ix);
          x = Math.sin(TAU * v.ph[0] + I * Math.sin(TAU * v.mph)) + 0.12 * tone * v.ix * Math.sin(TAU * v.mph * 14); }
        else if (snd === 1) { v.ph[0] += f; if (v.ph[0] > 1) v.ph[0] -= 1; const p = TAU * v.ph[0], d = 0.3 + tone * 0.7; x = (Math.sin(p) + 0.8 * Math.sin(2 * p) + d * 0.6 * Math.sin(3 * p) + d * 0.5 * Math.sin(4 * p) + d * d * 0.35 * Math.sin(6 * p) + d * d * 0.3 * Math.sin(8 * p)) * 0.38 + (v.age < 0.004 * sr ? (Math.random() - 0.5) * 0.25 * tone : 0); }
        else if (snd === 2 || snd === 3 || snd === 6) { const det = snd === 3 ? [0.996, 1.004, 1.0] : snd === 2 ? [0.993, 1.007, 0.5] : [1, 1.002, 0.5]; let s2 = 0;
          for (let o = 0; o < 3; o++) { const fo = f * det[o]; v.ph[o] += fo; if (v.ph[o] > 1) v.ph[o] -= 1; const t = v.ph[o]; s2 += (snd === 6 && o === 1) ? ((t < 0.5 ? 1 : -1) + blep(t, fo) - blep((t + 0.5) % 1, fo)) * 0.6 : (2 * t - 1 - blep(t, fo)); }
          v.fe *= kF; const fc = Math.min(0.45 * sr, (snd === 6 ? 300 + tone * tone * 9000 * (0.3 + v.fe * 1.5 * v.vel) : snd === 2 ? 250 + tone * tone * 5000 : 400 + tone * tone * 7000)), g = 1 - Math.exp(-TAU * fc / sr);
          v.l1 += g * (s2 * 0.4 - v.l1); v.l2 += g * (v.l1 - v.l2); x = v.l2 * (snd === 2 ? 1.1 : 1); }
        else if (snd === 4) { const L = v.kl / pm, len = v.ks.length; let rp = v.kp - L; while (rp < 0) rp += len; const i0 = rp | 0, fr2 = rp - i0, y = v.ks[i0 % len] * (1 - fr2) + v.ks[(i0 + 1) % len] * fr2;
          const out = (y + v.kz) * 0.5 * (0.982 + 0.0175 * (P.decay ?? 0.45)); v.kz = y; v.ks[v.kp % len] = out; v.kp = (v.kp + 1) % len; x = y * 1.4; }
        else if (snd === 5) { v.ix *= kI; v.mph += f * 3.5; if (v.mph > 1) v.mph -= 1; v.ph[0] += f; if (v.ph[0] > 1) v.ph[0] -= 1; x = Math.sin(TAU * v.ph[0] + (0.5 + tone * 2.5) * (0.4 + 0.6 * v.ix) * Math.sin(TAU * v.mph)); }
        else { v.ph[0] += f; if (v.ph[0] > 1) v.ph[0] -= 1; const t = v.ph[0]; x = Math.sin(TAU * t) * 0.9 + tone * 0.35 * (2 * t - 1 - blep(t, f)); x = Math.tanh(x * (1 + tone)); }
        x *= v.a * (0.4 + 0.6 * v.vel); l += x; r += x; act++; }
      l *= lvl * (1 + pan); r *= lvl * (1 - pan);
      O.L[i] = IL[i] + l; O.R[i] = IR[i] + r;
      O.voct[i] = this.cv + (P.oct | 0) + this.bend / 12; O.vel[i] = this.vl; O.mod[i] = this.md;
      O.gate[i] = held && this.gap <= 0 ? 10 : 0; if (this.gap > 0) this.gap--;
    }
    if (act) this.L.act = Math.max(this.L.act || 0, 0.5);
  }
}
// ---------------------------------------------------------------- SAMPLER: 6 one-shot slots (kick, clap, snare, hat, open hat, perc); samples arrive from the page
class Sampler extends DSP {
  static IN = ['tk', 'tc', 'ts', 'th', 'to', 'tp']; static OUT = ['k', 'c', 's', 'h', 'o', 'p', 'mix'];
  constructor(e) { super(e); this.buf = [null, null, null, null, null, null]; this.pos = new Float64Array(6).fill(-1); this.t = new Float64Array(6); this.st = [0, 1, 2, 3, 4, 5].map(() => new Schmitt()); this.fade = new Float32Array(6); this.O = Sampler.OUT.slice(0, 6).map(k => this.out[k]); this.I = Sampler.IN; }
  setSample(i, data) { this.buf[i] = data; this.pos[i] = -1; }
  hit(i) { if (!this.buf[i]) return; this.pos[i] = 0; this.t[i] = 0; if (i === 3) this.pos[4] = -1; this.flash('s' + i, 1); }
  process(n) {
    const P = this.p, sr = this.sr, K = ['k', 'c', 's', 'h', 'o', 'p'], M = this.out.mix; M.fill(0);
    for (let j = 0; j < 6; j++) {
      const o = this.O[j], b = this.buf[j], tr = this.in[this.I[j]], has = this.has[this.I[j]], key = K[j];
      const rate = Math.pow(2, (P[key + 'Tune'] ?? 0) / 12), dec = P[key + 'Dec'] ?? 1, lvl = P[key + 'Lvl'] ?? 0.8, td = 0.015 + dec * dec * 1.6, kd = dec >= 0.99 ? 1 : Math.exp(-1 / (td * sr));
      for (let i = 0; i < n; i++) {
        if (has && this.st[j].step(tr[i])) this.hit(j);
        let y = 0, p = this.pos[j];
        if (p >= 0 && b) { const i0 = p | 0; if (i0 + 1 >= b.length) this.pos[j] = -1; else { const f = p - i0; y = (b[i0] * (1 - f) + b[i0 + 1] * f) * (kd === 1 ? 1 : Math.pow(kd, this.t[j])); this.t[j]++; this.pos[j] = p + rate; } }
        y *= 5; o[i] = y; M[i] += y * lvl * 0.8;
      }
    }
  }
}

// ---------------------------------------------------------------- MBIRA: pitched one-shot sampler (kalimba / marimba multisamples), 4 voices
class Mbira extends DSP {
  static IN = ['voct', 'trig']; static OUT = ['out'];
  constructor(e) { super(e); this.S = []; this.st = new Schmitt(); this.V = [0, 1, 2, 3].map(() => ({ b: null, pos: -1, rate: 1, t: 0, g: 1 })); this.k = 0; }
  setSample(i, data, root) { this.S = this.S.filter(x => x.i !== i); this.S.push({ i, data, root }); this.S.sort((a, b) => a.root - b.root); }
  process(n) {
    const P = this.p, sr = this.sr, V = this.in.voct, T = this.in.trig, O = this.out.out, dec = P.dec ?? 0.8, kd = dec >= 0.99 ? 1 : Math.exp(-1 / ((0.03 + dec * dec * 2.5) * sr)), lvl = (P.lvl ?? 0.8) * 5;
    for (let i = 0; i < n; i++) {
      if (this.st.step(T[i]) && this.S.length) {
        const note = 60 + (V[i] + (P.oct | 0)) * 12; let best = this.S[0]; for (const x of this.S) if (Math.abs(x.root - note) < Math.abs(best.root - note)) best = x;
        const v = this.V[this.k = (this.k + 1) % 4]; v.b = best.data; v.pos = 0; v.t = 0; v.rate = Math.pow(2, (note - best.root) / 12); this.flash('led', 1);
      }
      let y = 0; for (const v of this.V) { if (v.pos < 0) continue; const i0 = v.pos | 0; if (i0 + 1 >= v.b.length) { v.pos = -1; continue; } const f = v.pos - i0; y += (v.b[i0] * (1 - f) + v.b[i0 + 1] * f) * (kd === 1 ? 1 : Math.pow(kd, v.t)); v.t++; v.pos += v.rate; }
      O[i] = y * lvl;
    }
  }
}
// ---------------------------------------------------------------- FIELD: looping nature recording with a soft crossfade, tone and width
class Field extends DSP {
  static IN = ['cv']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.b = null; this.pos = 0; this.lp = [0, 0]; }
  setSample(i, data) { this.b = data; this.pos = 0; }
  process(n) {
    const P = this.p, sr = this.sr, b = this.b, OL = this.out.L, OR = this.out.R; if (!b || b.length < sr) { OL.fill(0); OR.fill(0); return; }
    const L = b.length, xf = Math.min(sr * 1.5, L / 4) | 0, half = L >> 1, lc = 1 - Math.exp(-TAU * (P.tone ?? 9000) / sr), C = this.in.cv, hc = this.has.cv, w = P.width ?? 0.8, lv = (P.lvl ?? 0.6) * 5;
    const rd = p => { p %= (L - xf); const a = b[p]; if (p < xf) { const u = p / xf; return a * u + b[p + L - xf] * (1 - u); } return a; };
    for (let i = 0; i < n; i++) {
      const p = this.pos | 0, m = rd(p), s2 = rd(p + half), g = lv * (hc ? Math.max(0, Math.min(1, C[i] / 10 + 0.5)) : 1);
      const l = m * (1 - w * 0.5) + s2 * w * 0.5, r = s2 * (1 - w * 0.5) + m * w * 0.5;
      this.lp[0] += lc * (l - this.lp[0]); this.lp[1] += lc * (r - this.lp[1]); OL[i] = this.lp[0] * g; OR[i] = this.lp[1] * g; this.pos++;
    }
    if (this.pos > 1e9) this.pos = 0;
    this.peak('led', OL, n, 0.5);
  }
}



// ---------------------------------------------------------------- HARMONY: writes chord progressions the way jazz and deep house do
// Each chord has a job (T home, S away, D tension that pulls home). Phrases follow patterns those styles use (ii-V-I, turnarounds,
// secondary dominants, tritone subs, borrowed minor chords), always end on a chord that leads back to the start, and change on the
// bar (or a 16th-pair early: the house "push"). Outputs: ROOT (V/oct) + TYPE (chord shape index) for STAB, BASS (root, steady range,
// optional approach notes) and CHG (a trigger on each change). Settings only take effect at the next phrase, so changes are never abrupt.
const HQ = { m7: 0, m9: 1, maj7: 2, maj9: 3, m11: 4, sus: 5, d9: 6, add9: 7, d13: 10, d7b9: 11, hdim: 12, six9: 13, m69: 14, sus9: 15, lyd: 16 };
const HQ_NAME = ['m7', 'm9', 'maj7', 'maj9', 'm11', '7sus', '9', 'add9', 'm', '5', '13', '7b9', 'm7b5', '6/9', 'm6/9', '9sus4', 'maj7#11'];
const NOTE_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// vocabulary per mode: [degree, plain shapes, rich shapes, colour needed]
const HVOC = [
  { T: [[0, ['maj9'], ['six9', 'maj7', 'lyd']], [9, ['m9'], ['m7', 'm11']], [4, ['m7'], ['m9'], 0.4]], S: [[2, ['m9'], ['m11', 'm7']], [5, ['maj9'], ['lyd', 'six9']], [5, ['m69'], ['m9'], 0.55]], D: [[7, ['d9'], ['d13', 'sus9']], [1, ['d9'], ['d13'], 0.5], [10, ['d9'], ['d13'], 0.6]] }, // major
  { T: [[0, ['m9'], ['m11', 'm69']], [3, ['maj9'], ['lyd'], 0.3], [8, ['maj9'], ['lyd'], 0.3]], S: [[5, ['m9'], ['m11']], [2, ['hdim'], ['hdim'], 0.4], [8, ['maj7'], ['lyd']]], D: [[10, ['d9'], ['sus9', 'd13']], [7, ['m9'], ['d7b9'], 0], [1, ['d9'], ['d13'], 0.7]] }, // minor
  { T: [[0, ['m9'], ['m11']], [3, ['maj9'], ['six9'], 0.3]], S: [[5, ['d9'], ['d13']], [2, ['m7'], ['m9']], [10, ['maj9'], ['add9'], 0.2]], D: [[7, ['m9'], ['m11']], [10, ['add9'], ['maj9']], [5, ['sus9'], ['d13'], 0.3]] } // dorian
];
const HFORM = [['T', 'S', 'D', 'D'], ['T', 'T', 'S', 'D'], ['T', 'S', 'S', 'D'], ['S', 'D', 'T', 'T'], ['T', 'D', 'S', 'D'], ['T', 'S', 'T', 'D'], ['S', 'S', 'D', 'T'], ['T', 'T', 'D', 'D']];
function hrand(seed) { let x = (seed * 2654435761) >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const hpick = (r, a) => a[Math.floor(r() * a.length)];
export function harmPhrase(seed, mode, color, move, bars) { // -> [{at (16ths), deg, q, fn}]
  const r = hrand(seed * 7919 + 13), V = HVOC[mode] || HVOC[0], ev = [], halves = bars / 4;
  const pickChord = (fn, prev) => { const opts = V[fn].filter(o => (o[3] ?? 0) <= color + 1e-6 && !(prev && o[0] === prev.deg)); const o = hpick(r, opts.length ? opts : V[fn]); const sh = r() < color ? o[2] : o[1]; return { deg: o[0], q: HQ[hpick(r, sh)], fn }; };
  let prev = null;
  for (let h = 0; h < halves; h++) { const form = hpick(r, HFORM).slice(); if (h === halves - 1) form[3] = 'D'; if (h === 0 && form[0] !== 'T' && r() < 0.75) form[0] = 'T';
    for (let b = 0; b < 4; b++) { const at = (h * 4 + b) * 16;
      if (form[b] && form[b].pre) { ev.push({ at, ...form[b].pre }); prev = form[b].pre; continue; }
      let c = pickChord(form[b], prev); if (h === 0 && b === 0 && form[0] === 'T' && r() < 0.6) { const o = V.T[0]; c = { deg: o[0], q: HQ[hpick(r, r() < color ? o[2] : o[1])], fn: 'T' }; }
      // a ii-V (or V of the next chord) squeezed into the second half of a bar, more often with MOVE
      if (b < 3 && r() < move * 0.5 && form[b + 1] !== 'D' && typeof form[b + 1] === 'string') { const nxt = pickChord(form[b + 1], c); if ((nxt.deg + 7) % 12 === c.deg || nxt.deg === c.deg) { ev.push({ at, ...c }); prev = c; continue; } ev.push({ at, ...c }); form[b + 1] = { pre: nxt };
        ev.push({ at: at + 8, deg: (nxt.deg + 7) % 12, q: r() < color ? HQ.d7b9 : HQ.d9, fn: 'D' }); prev = ev[ev.length - 1]; continue; }
      if (b === 3 && h === halves - 1 && r() < move * 0.6) { const ii = { deg: ((c.deg - 5) % 12 + 12) % 12, q: mode === 1 ? HQ.hdim : HQ.m9, fn: 'S' }; ev.push({ at, ...ii }); ev.push({ at: at + 8, ...c }); prev = c; continue; } // ii-V into the top
      ev.push({ at, ...c }); prev = c; } }
  // the push: some changes land a 16th-pair early (never the first chord)
  for (let i = 1; i < ev.length; i++) if (ev[i].at % 16 === 0 && r() < move * 0.45) ev[i].at -= 2;
  return ev;
}
const hname = (key, e) => NOTE_FLAT[(key + e.deg) % 12] + HQ_NAME[e.q];
class Harmony extends DSP {
  static IN = ['clk', 'rst']; static OUT = ['root', 'type', 'bass', 'chg'];
  constructor(e) { super(e); this.cs = new Schmitt(); this.rs = new Schmitt(); this.step = -1; this.n = 0; this.ev = null; this.cur = -1; this.g = 0; this.bv = 0; }
  phrase() { const P = this.p, bars = (P.len | 0) === 4 ? 4 : 8, ev = (P.evolve ?? 0.3), key = [P.seed | 0, P.mode | 0, Math.round((P.color ?? 0.5) * 20), Math.round((P.move ?? 0.3) * 20), bars, P.key | 0].join();
    if (this.n === 0 || key !== this.k || !this.ev) this.gen = 0; else if (hrand((P.seed | 0) * 31 + this.n)() < ev) this.gen++;
    this.k = key; this.bars = bars; this.ev = harmPhrase((P.seed | 0) * 101 + this.gen, P.mode | 0, P.color ?? 0.5, P.move ?? 0.3, bars); this.n++; }
  process(n) {
    const C = this.in.clk, R = this.in.rst, O = this.out, P = this.p, key = P.key | 0;
    for (let i = 0; i < n; i++) {
      if (this.rs.step(R[i])) { this.step = -1; this.n = 0; }
      if (this.cs.step(C[i])) {
        if (this.step < 0) this.n = 0;
        this.step = this.step + 1; if (!this.ev || this.step >= (this.bars || 8) * 16) { this.step = 0; } if (this.step === 0 || !this.ev) this.phrase();
        // the chord sounding now
        let idx = 0; for (let j = 0; j < this.ev.length; j++) if (this.ev[j].at <= this.step) idx = j;
        if (idx !== this.cur) { this.cur = idx; this.g = Math.round(0.008 * this.sr); this.flash('chg', 1); }
        const e = this.ev[idx], nx = this.ev[idx + 1] || this.ev[0], untilNext = (idx + 1 < this.ev.length ? nx.at : this.bars * 16) - this.step;
        // bass: the root, kept between a fourth below and a fifth above the key so it never leaps; approach notes before a change
        let bs = (e.deg + key) % 12; if (bs > 7) bs -= 12; let nb = (nx.deg + key) % 12; if (nb > 7) nb -= 12;
        if (untilNext <= 2 && untilNext > 0 && hrand(this.n * 977 + this.step)() < (P.walk ?? 0)) bs = nb + (hrand(this.step + 3)() < 0.5 ? -1 : 7) ;
        this.bv = bs / 12; this.rv = ((e.deg + key) % 12) / 12; this.tv = e.q;
        this.info = { name: hname(key, e), next: hname(key, nx), bar: Math.floor(this.step / 16) + 1, bars: this.bars, prog: this.ev.map(x => hname(key, x)).join(' ') };
      }
      O.root[i] = this.rv || 0; O.type[i] = this.tv || 0; O.bass[i] = this.bv; O.chg[i] = this.g > 0 ? 10 : 0; if (this.g > 0) this.g--;
    }
    if (this.info) Object.assign(this.L, this.info);
  }
}


// ---------------------------------------------------------------- BAND: plays a tune from the songbook on recorded instruments
// The page compiles a tune (chords already voiced, comping rhythm, bass line, a sparse lead) into events on a 16th grid; BAND plays
// them against the rack clock with a human touch: chords rolled low to high, velocities and timing that wander a little, laid back.
// Sample zones (one per recorded note) are shared by both decks. A new tune takes over at the next bar (audition) or phrase.
class Band extends DSP {
  static IN = ['clk', 'rst']; static OUT = ['L', 'R', 'bass', 'bgate', 'chg'];
  constructor(e) { super(e); this.cs = new Schmitt(); this.rs = new Schmitt(); this.step = -1; this.v = []; this.tn = null; this.next = null; this.lp = [0, 0, 0, 0]; this.bv = 0; this.bg = 0; this.cg = 0; this.q = []; this.t = 0; }
  setTune(tn, when) { if (!this.tn) { this.tn = tn; return; } this.next = tn; this.nextWhen = when || 'phrase'; }
  zone(inst, midi) { const Z = this.e.zones && this.e.zones[inst]; if (!Z || !Z.length) return null; let best = Z[0]; for (const z of Z) if (Math.abs(z.note - midi) < Math.abs(best.note - midi)) best = z; return best; }
  play(inst, midi, vel, durS, delayS, pan) { const z = this.zone(inst, midi); if (!z) return; if (this.v.length > 40) this.v.shift();
    this.v.push({ d: z.data, pos: 0, inc: Math.pow(2, (midi - z.note) / 12) * z.sr / this.sr, g: vel, wait: Math.max(0, Math.round(delayS * this.sr)), left: Math.round(durS * this.sr), rel: 1, rk: 1 / (0.25 * this.sr), pan: pan ?? 0 }); }
  hit(ev, isLead) { const P = this.p, hu = P.human ?? 0.5, T = this.tn, lofi = T && T.feel === 'lofi', per = 60 / ((this.e.mods.get('clock') || { p: {} }).p.tempo || 100) / 4;
    const lay = (lofi ? 0.012 : 0.004) + Math.random() * 0.012 * hu, roll = (lofi ? 0.018 : 0.01) * hu, notes = ev.notes || [ev.midi];
    const inst = isLead ? ['piano', 'ep', 'vibes'][P.leadInst | 0] || 'vibes' : ['piano', 'ep', 'vibes'][P.inst | 0] || 'piano', dur = ev.len * per;
    notes.forEach((m, i) => this.play(inst, m, (ev.vel ?? 0.8) * (1 - hu * 0.22 * Math.random()) * (isLead ? (P.lead ?? 0.3) * 1.6 : 1), dur + 0.05, lay + i * roll * (0.6 + Math.random() * 0.8), isLead ? 0.25 : (i / Math.max(1, notes.length - 1) - 0.5) * 0.5)); }
  process(n) {
    const C = this.in.clk, R = this.in.rst, OL = this.out.L, OR = this.out.R, P = this.p, B = this.out.bass, BG = this.out.bgate, CH = this.out.chg;
    for (let i = 0; i < n; i++) {
      if (this.rs.step(R[i])) this.step = -1;
      if (this.cs.step(C[i]) && this.tn) {
        let s = this.step + 1, len = this.tn.len;
        if (this.next && (this.nextWhen === 'bar' ? s % 16 === 0 : s >= len)) { this.tn = this.next; this.next = null; s = this.nextWhen === 'bar' ? 0 : s; len = this.tn.len; if (s >= len) s = 0; }
        if (s >= len) s = 0; this.step = s; const T = this.tn;
        for (const ev of T.hits) if (ev.at === s) { this.hit(ev); }
        if ((P.lead ?? 0.3) > 0.02) for (const ev of T.lead) if (ev.at === s && Math.random() < 0.35 + (P.lead ?? 0.3)) this.hit(ev, true);
        for (const ev of T.bass) if (ev.at === s) { this.bv = ev.cv; this.bg = Math.round(Math.min(ev.len * 0.8, 3) * 0.25 * 60 / ((this.e.mods.get('clock') || { p: {} }).p.tempo || 100) * this.sr); }
        for (let j = 0; j < T.chords.length; j++) if (T.chords[j].at === s) { this.cg = Math.round(0.008 * this.sr); this.cur = j; this.flash('chg', 1); }
      }
      // voices
      let l = 0, r = 0;
      for (let k = this.v.length - 1; k >= 0; k--) { const v = this.v[k]; if (v.wait > 0) { v.wait--; continue; }
        const p0 = v.pos | 0; if (p0 + 1 >= v.d.length || v.rel <= 0) { this.v.splice(k, 1); continue; }
        const fr = v.pos - p0, x = (v.d[p0] + (v.d[p0 + 1] - v.d[p0]) * fr) * v.g * v.rel; v.pos += v.inc;
        if (v.left > 0) v.left--; else v.rel -= v.rk; l += x * (1 - v.pan); r += x * (1 + v.pan); }
      // TONE: a soft low-pass (felt, worn), two poles per side
      const c = 1 - Math.exp(-6.2832 * (600 + 9000 * Math.pow(P.tone ?? 0.55, 2)) / this.sr), Lz = this.lp;
      Lz[0] += c * (l - Lz[0]); Lz[1] += c * (Lz[0] - Lz[1]); Lz[2] += c * (r - Lz[2]); Lz[3] += c * (Lz[2] - Lz[3]);
      const g = (P.level ?? 0.8) * 3.2; OL[i] = Lz[1] * g; OR[i] = Lz[3] * g;
      B[i] = this.bv; BG[i] = this.bg > 0 ? 10 : 0; if (this.bg > 0) this.bg--; CH[i] = this.cg > 0 ? 10 : 0; if (this.cg > 0) this.cg--;
    }
    if (this.tn) { const ch = this.tn.chords[this.cur ?? 0]; this.L.name = ch ? ch.name : ''; this.L.bar = Math.floor(Math.max(0, this.step) / 16) + 1; this.L.bars = this.tn.len / 16; this.L.tune = this.tn.name; this.L.sec = ch ? ch.sec : ''; }
    this.peak('vu', OL, n);
  }
}

// ---------------------------------------------------------------- mixing side (right rack): BLEND, SWEEP, ECHO, PUMP (= Duck), SUB
class Blend extends DSP { // two stereo decks, equal-power crossfade, per-deck level, master; MATCH evens out the decks' loudness so a blend never jumps in volume
  static IN = ['aL', 'aR', 'bL', 'bR']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.x = 0; this.ms = [2, 2]; this.g = [1, 1]; }
  process(n) {
    const I = this.in, AL = I.aL, AR = this.has.aR ? I.aR : I.aL, BL = I.bL, BR = this.has.bR ? I.bR : I.bL, OL = this.out.L, OR = this.out.R;
    const la = this.p.lvlA ?? 0.8, lb = this.p.lvlB ?? 0.8, m = this.p.master ?? 0.9, tgt = clamp01(this.p.blend ?? 0), k = 1 - Math.exp(-1 / (0.03 * this.sr)), match = (this.p.match ?? 1) > 0.5;
    // loudness of each deck over ~3 s; gain toward a common level, within +-6 dB, moving slowly
    const S = [[AL, AR], [BL, BR]];
    for (let d = 0; d < 2; d++) { let e = 0; const [l, r] = S[d]; for (let i = 0; i < n; i++) e += l[i] * l[i] + r[i] * r[i]; e /= 2 * n;
      if (e > 1e-5) this.ms[d] += (e - this.ms[d]) * (n / (3 * this.sr));
      const want = match ? Math.min(2, Math.max(0.5, 1.6 / Math.sqrt(this.ms[d] + 1e-9))) : 1; this.g[d] += (want - this.g[d]) * (n / (1.5 * this.sr)); }
    let pa = 0, pb = 0; const lc = 1 - Math.exp(-6.2832 * 170 / this.sr), Z = this.z || (this.z = new Float64Array(8)), swap = (this.p.swap ?? 1) > 0.5;
    for (let i = 0; i < n; i++) { this.x += (tgt - this.x) * k; const x = this.x, ga = Math.cos(x * Math.PI / 2) * la * m * 1.25 * this.g[0], gb = Math.sin(x * Math.PI / 2) * lb * m * 1.25 * this.g[1];
      const t = swap ? Math.min(1, Math.max(0, (x - 0.42) / 0.16)) : x, sw = t * t * (3 - 2 * t), la2 = (1 - sw) * la * m * 1.25 * this.g[0], lb2 = sw * lb * m * 1.25 * this.g[1];
      const ins = [AL[i], AR[i], BL[i], BR[i]]; for (let j = 0; j < 4; j++) { Z[j] += lc * (ins[j] - Z[j]); Z[j + 4] += lc * (Z[j] - Z[j + 4]); }
      // lows (two one-poles, ~170 Hz) follow the bass swap, the rest follows the crossfade
      OL[i] = (AL[i] - Z[4]) * ga + Z[4] * la2 + (BL[i] - Z[6]) * gb + Z[6] * lb2; OR[i] = (AR[i] - Z[5]) * ga + Z[5] * la2 + (BR[i] - Z[7]) * gb + Z[7] * lb2;
      const a = Math.abs(AL[i] * ga), b = Math.abs(BL[i] * gb); if (a > pa) pa = a; if (b > pb) pb = b; }
    this.flash('a', pa * 0.2); this.flash('b', pb * 0.2); this.peak('vu', OL, n); this.L.x = this.x; this.L.g = this.g;
  }
}
class SVF2 { // TPT state-variable filter
  constructor() { this.a = 0; this.b = 0; }
  run(x, g, k) { const h = (x - (k + g) * this.a - this.b) / (1 + g * (k + g)), bp = g * h + this.a, lp = g * bp + this.b; this.a = g * h + bp; this.b = g * bp + lp; this.h = h; this.bp = bp; return lp; }
}
class Sweep extends DSP { // one-knob DJ filter: left = low-pass closing down, right = high-pass opening up, centre = clean
  static IN = ['inL', 'inR', 'cv']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.f = [new SVF2(), new SVF2()]; this.pos = 0; }
  process(n) {
    const I = this.in, IL = I.inL, IR = this.has.inR ? I.inR : I.inL, CV = I.cv, hc = this.has.cv, OL = this.out.L, OR = this.out.R, sr = this.sr;
    const res = this.p.res ?? 0.3, k = 2 - 1.85 * res, sm = 1 - Math.exp(-1 / (0.02 * sr)), base = this.p.pos ?? 0;
    for (let i = 0; i < n; i++) {
      const tgt = Math.max(-1, Math.min(1, base + (hc ? CV[i] * 0.1 : 0))); this.pos += (tgt - this.pos) * sm; const p = this.pos, a = Math.abs(p);
      if (a < 0.02) { OL[i] = IL[i]; OR[i] = IR[i]; this.f[0].a = this.f[0].b = this.f[1].a = this.f[1].b = 0; continue; }
      const fc = p < 0 ? 20000 * Math.pow(110 / 20000, a) : 18 * Math.pow(7000 / 18, a), g = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr), w = Math.min(1, (a - 0.02) * 12);
      const l = this.f[0].run(IL[i], g, k), r = this.f[1].run(IR[i], g, k), yl = p < 0 ? l : this.f[0].h, yr = p < 0 ? r : this.f[1].h;
      OL[i] = IL[i] + (yl - IL[i]) * w; OR[i] = IR[i] + (yr - IR[i]) * w;
    }
    this.L.pos = this.pos;
  }
}
class Echo extends DSP { // tape echo synced to the CLOCK tempo: wobble, darkening repeats, ping-pong spread
  static IN = ['inL', 'inR', 'clock']; static OUT = ['L', 'R'];
  constructor(e) { super(e); const N = Math.ceil(e.sr * 2.6); this.dl = new DLine(N); this.dr = new DLine(N); this.d = e.sr * 0.375; this.ph = 0; this.lp = [0, 0]; this.hp = [0, 0]; }
  process(n) {
    const P = this.p, sr = this.sr, I = this.in, IL = I.inL, IR = this.has.inR ? I.inR : I.inL, OL = this.out.L, OR = this.out.R;
    const ck = this.e.mods.get('clock'), bpm = (ck && ck.p.tempo) || 120, DIV = [0.25, 0.5, 0.75, 1, 1.5, 2], beats = DIV[Math.round(P.div ?? 2)] ?? 0.75, tgt = Math.min(2.5 * sr, beats * 60 / bpm * sr);
    const fb = Math.min(0.92, P.fb ?? 0.4), mix = P.mix ?? 0.25, wow = (P.wow ?? 0.3) * 0.0025 * sr, spread = P.spread ?? 0.6;
    const lc = 1 - Math.exp(-6.2832 * (900 + 9000 * Math.pow(P.tone ?? 0.5, 2)) / sr), hc = 1 - Math.exp(-6.2832 * 180 / sr), sm = 1 - Math.exp(-1 / (0.25 * sr));
    let pk = 0;
    for (let i = 0; i < n; i++) {
      this.d += (tgt - this.d) * sm; this.ph += 0.6 / sr; if (this.ph > 1) this.ph -= 1;
      const dd = Math.max(4, this.d + wow * Math.sin(6.2832 * this.ph)), wl = this.dl.readf(dd), wr = this.dr.readf(dd);
      for (const [j, w] of [[0, wl], [1, wr]]) { this.lp[j] += lc * (w - this.lp[j]); this.hp[j] += hc * (this.lp[j] - this.hp[j]); }
      const yl = Math.tanh((this.lp[0] - this.hp[0]) * 0.25) * 4, yr = Math.tanh((this.lp[1] - this.hp[1]) * 0.25) * 4, inm = (IL[i] + IR[i]) * 0.5, s = spread;
      this.dl.write(IL[i] + (inm - IL[i]) * s + (yl + (yr - yl) * s) * fb); this.dr.write(IR[i] * (1 - s) + (yr + (yl - yr) * s) * fb);
      OL[i] = IL[i] + yl * mix; OR[i] = IR[i] + yr * mix; const a = Math.abs(yl); if (a > pk) pk = a;
    }
    this.flash('led', pk * 0.25 * mix * 4);
  }
}
class Sub extends DSP { // low end: everything below the crossover in mono, a clean octave-down sub, a rumble cut and a low trim
  static IN = ['inL', 'inR']; static OUT = ['L', 'R'];
  constructor(e) { super(e); this.lp = [0, 0, 0, 0]; this.sl = [0, 0, 0]; this.sg = 1; this.prev = 0; this.hp = [0, 0, 0, 0]; this.env = 0; }
  process(n) {
    const P = this.p, sr = this.sr, I = this.in, IL = I.inL, IR = this.has.inR ? I.inR : I.inL, OL = this.out.L, OR = this.out.R;
    const xo = P.xo ?? 120, c = 1 - Math.exp(-6.2832 * xo / sr), sub = P.sub ?? 0, tight = P.tight ?? 30, ht = Math.exp(-6.2832 * tight / sr), low = Math.pow(10, (P.low ?? 0) / 20), sc = 1 - Math.exp(-6.2832 * 70 / sr);
    let pk = 0;
    for (let i = 0; i < n; i++) {
      let l = IL[i], r = IR[i];
      // rumble cut (2-pole high-pass at TIGHT)
      for (let j = 0; j < 2; j++) { const x = j ? r : l, y = ht * (this.hp[j * 2 + 1] + x - this.hp[j * 2]); this.hp[j * 2] = x; this.hp[j * 2 + 1] = y; if (j) r = y; else l = y; }
      // split at XO (two cascaded one-poles), lows summed to mono
      this.lp[0] += c * (l - this.lp[0]); this.lp[1] += c * (this.lp[0] - this.lp[1]); this.lp[2] += c * (r - this.lp[2]); this.lp[3] += c * (this.lp[2] - this.lp[3]);
      const lowM = (this.lp[1] + this.lp[3]) * 0.5;
      // octave-down sub: flip a sign on every rising zero crossing of the low band, follow its level, smooth hard
      const z = this.lp[1] + this.lp[3]; if (this.prev <= 0 && z > 0) this.sg = -this.sg; this.prev = z; this.env += (Math.abs(lowM) - this.env) * 0.002;
      this.sl[0] += sc * (this.sg * this.env * 1.6 - this.sl[0]); this.sl[1] += sc * (this.sl[0] - this.sl[1]); this.sl[2] += sc * (this.sl[1] - this.sl[2]);
      const lo = (lowM + this.sl[2] * sub) * low; OL[i] = l - this.lp[1] + lo; OR[i] = r - this.lp[3] + lo; const a = Math.abs(lo); if (a > pk) pk = a;
    }
    this.flash('led', pk * 0.2);
  }
}

const DSPS = { clock: Clock, random: Random, quant: Quant, vcoA: VCO, vcoB: VCO, lfo: LFO, mixer: Mixer, noise: Noise, scope: Scope, seq: Seq, vcfA: VCF, vcfB: VCF, env: Env, vca: VCA, delay: Delay, reverb: Reverb, output: Output, macro: Macro, texture: Texture, folder: Folder, lpg: LPG, turing: Turing, atten: Atten, trigseq: TrigSeq, drums: Drums, mix6: Mix6, duck: Duck, groove: Groove, perc: Perc, stab: Stab, bass: Bass, tape: Tape, glue: Glue, eq: EQ, wide: Wide, limit: Limit, keys: Keys, sampler: Sampler, mbira: Mbira, field: Field, blend: Blend, sweep: Sweep, echo: Echo, pump: Duck, sub: Sub, harm: Harmony, band: Band };

export class Engine {
  constructor(sr, N = 128) { this.sr = sr; this.N = N; this.zero = new Float32Array(N); this.oL = new Float32Array(N); this.oR = new Float32Array(N); this.oLv = new Float32Array(N); this.mods = new Map(); this.cables = new Map(); this.order = []; this.dirty = true; }
  handle(m) {
    if (m.t === 'add') { const C = DSPS[m.type]; if (!C) return; const d = new C(this); d.id = m.id; Object.assign(d.p, m.p || {}); d.onParam(); this.mods.set(m.id, d); this.dirty = true; }
    else if (m.t === 'param') { const d = this.mods.get(m.id); if (d) { d.p[m.k] = m.v; d.onParam(m.k, m.v); } }
    else if (m.t === 'smp') { const d = this.mods.get(m.id); if (d && d.setSample) d.setSample(m.slot, m.data, m.root); }
    else if (m.t === 'hit') { const d = this.mods.get(m.id); if (d && d.hit) d.hit(m.slot); }
    else if (m.t === 'note') { const d = this.mods.get(m.id); if (d && d.note) d.note(m.n, m.v); }
    else if (m.t === 'cc') { const d = this.mods.get(m.id); if (d && d.cc) d.cc(m.c, m.v); }
    else if (m.t === 'con') { this.cables.set(m.c, m); this.dirty = true; }
    else if (m.t === 'dis') { this.cables.delete(m.c); this.dirty = true; }
    else if (m.t === 'zone') { const Z = (this.zones = this.zones || {}); (Z[m.inst] = Z[m.inst] || []).push({ note: m.note, data: m.data, sr: m.sr || this.sr }); }
    else if (m.t === 'tune') { const d = this.mods.get(m.id); if (d && d.setTune) d.setTune(m.tune, m.when); }
    else if (m.t === 'barsync') { const P = this.pend || (this.pend = { wake: new Set(), reset: new Set() }); for (const id of m.wake || []) P.wake.add(id); for (const id of m.reset || []) P.reset.add(id); } // on the next bar: wake a deck and start its sequencers on the downbeat
    else if (m.t === 'sleep') { for (const id of m.ids) { const d = this.mods.get(id); if (!d) continue; d.sleep = m.on; if (m.on) for (const k in d.out) d.out[k].fill(0); } } // a resting deck costs nothing
  }
  rebuild() {
    const deps = new Map();
    for (const d of this.mods.values()) { for (const k of d.constructor.IN) { d.in[k] = this.zero; d.has[k] = false; } deps.set(d, new Set()); }
    for (const c of this.cables.values()) {
      const s = this.mods.get(c.om), d = this.mods.get(c.im); if (!s || !d || !s.out[c.op] || !(c.ip in d.in)) continue;
      d.in[c.ip] = s.out[c.op]; d.has[c.ip] = true; if (s !== d) deps.get(d).add(s);
    }
    const order = [], done = new Set(), all = [...this.mods.values()]; let progress = true;
    while (order.length < all.length && progress) { progress = false; for (const d of all) if (!done.has(d) && [...deps.get(d)].every(s => done.has(s))) { order.push(d); done.add(d); progress = true; } }
    for (const d of all) if (!done.has(d)) order.push(d); // feedback loops: one block of delay
    // scope reads the main output; keep it after the output module
    const sc = order.findIndex(d => d instanceof Scope); if (sc >= 0) order.push(order.splice(sc, 1)[0]);
    this.order = order; this.dirty = false;
  }
  process(n) {
    if (this.dirty) this.rebuild();
    for (const d of this.order) {
      if (d.sleep) continue;
      d.process(n);
      if (this.pend && d.barAt >= 0) { // the clock just started a bar inside this block: sequencers processed after it step to 0 on that downbeat
        for (const id of this.pend.wake) { const m = this.mods.get(id); if (m) m.sleep = false; }
        for (const id of this.pend.reset) { const m = this.mods.get(id); if (!m) continue; if ('step' in m) m.step = -1; if ('wait' in m) m.wait = -1; if (m.cs) m.cs.s = false; }
        this.pend = null; }
      for (const k in d.out) { const o = d.out[k]; for (let i = 0; i < n; i++) { const x = o[i]; if (x > 10 || x < -10) { const a = x > 0 ? x : -x; o[i] = (x > 0 ? 1 : -1) * (10 + 1.8 * Math.tanh((a - 10) / 1.8)); } } }
    }
  }
  telemetry() {
    const t = {}; for (const d of this.mods.values()) { t[d.id] = d.L; d.L = {}; if (d instanceof Scope) t.__scope = d.snap(); }
    return t;
  }
}
