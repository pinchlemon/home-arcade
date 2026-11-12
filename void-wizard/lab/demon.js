// Lab shelf: Demon. How the centipede behaves and how it shows it's hurt.
LAB.shelf('demon', 'Demon', (game) => {
  const D = game.demon;
  // aggression: 1 is normal. Higher: shorter rests between attacks, shorter prowling, longer hunts, faster.
  // Lower: longer rests and slower; at 0 it never attacks.
  function rage(dt, a) {
    if (!D.alive || D.dying) return;
    if (a === 0) D.cd = Math.max(D.cd, 0.5);
    else if (a > 1) D.cd = Math.max(0, D.cd - dt * (a - 1) * 1.5);
    else D.cd += dt * (1 - a);
    if (D.state === 'walk') {
      if (D.mode === 'prowl') D.modeT -= dt * (a - 1) * 0.6;
      else if (D.mode === 'hunt') D.modeT += dt * (a - 1) * 0.3;
    }
    const k = 0.6 + 0.4 * a;   // 0.6 at 0, 1 at 1, 1.8 at 3
    if (D.state === 'walk' || D.state === 'recover') D.pos.addScaledVector(D.vel, dt * (k - 1));
  }
  // the whole centipede flashes white when it gets hit
  let mats = null, flashT = 0, flashing = false;
  function collect() {
    const seen = new Set(); mats = [];
    D.g.traverse(o => { const m = o.material; if (m && m.emissive && !seen.has(m)) { seen.add(m); mats.push({ m, base: m.emissive.clone() }); } });
  }
  window.FEATURES.on('demonHit', () => { if (LAB.get('demon.flash')) flashT = LAB.get('demon.flashLen') ?? 0.3; }, 'lab');
  const restore = () => { if (mats) for (const x of mats) x.m.emissive.copy(x.base); flashing = false; };
  function flash(dt, on, now) {
    if (!mats) collect();
    if (flashT > 0) {
      flashT -= dt;
      const lit = flashT > 0 && Math.floor(now * (LAB.get('demon.flashRate') ?? 12) * 2) % 2 === 0;
      for (const x of mats) if (lit) x.m.emissive.setRGB(1, 1, 1); else x.m.emissive.copy(x.base);
      flashing = true;
    } else if (flashing) restore();
  }
  // dissolve: when it's beaten, the centipede burns away from the inside with a glowing edge instead of popping.
  // The noise and the burn are from "Dissolve with Glowing Edge" by Pixel Dreamer (pixeldreamerstudio.itch.io,
  // godotshaders.com, MIT licence), turned into a three.js material patch. The materials are only patched the
  // first time this is switched on; at 0 the patch draws exactly as before.
  const dis = { value: 0 }, edgeCol = { value: new game.THREE.Color(1, 0.45, 0.1) };
  let patched = false, disT = -1;
  const NOISE = `
    varying vec3 vDis; uniform float uDis; uniform vec3 uDisCol;
    float dHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float dNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float dFbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * dNoise(p); p *= 2.03; a *= 0.5; } return v; }
  `;
  const patchedMats = new WeakSet();
  function patchOne(m) {
    if (!m || Array.isArray(m) || !m.isMaterial || patchedMats.has(m)) return;
    patchedMats.add(m);
    // other Lab patches (PS1) may be on the same material: run theirs too, and say which are on so three.js
    // keeps a separate compiled copy for each mix
    const before = m.onBeforeCompile;
    m.userData.labKey = (m.userData.labKey || '') + '|dissolve';
    m.customProgramCacheKey = () => 'lab' + m.userData.labKey;
    m.onBeforeCompile = (sh, r) => {
      before.call(m, sh, r);
      sh.uniforms.uDis = dis; sh.uniforms.uDisCol = edgeCol;
      sh.vertexShader = 'varying vec3 vDis;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDis = position;');
      sh.fragmentShader = NOISE + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float dN = clamp((dFbm(vDis * 6.0) - 0.22) / 0.56, 0.0, 1.0), dD = uDis * 1.08 - 0.08;
        if (dN < dD) discard;
        float dEdge = (1.0 - smoothstep(dD, dD + 0.14, dN)) * step(0.001, uDis);`);
      if (sh.fragmentShader.includes('#include <emissivemap_fragment>'))
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ndiffuseColor.rgb *= 1.0 - dEdge; totalEmissiveRadiance = mix(totalEmissiveRadiance, uDisCol * 1.3, dEdge);');
      else sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, '  gl_FragColor.rgb = mix(gl_FragColor.rgb, uDisCol * 1.3, dEdge);\n}');
    };
    m.needsUpdate = true;
  }
  // every material the demon shows, and the toon ones PS1 soft shading may have swapped out (checked again each time)
  function patch() {
    patched = true;
    const add = (o) => { if (o.material) patchOne(o.material); if (o.userData.labToon) patchOne(o.userData.labToon); };
    D.g.traverse(add);
    for (const S of D.segs) { S.g.traverse(add); for (const L of S.legs) for (const o of [L.femur, L.tibia, L.knee]) if (o) o.traverse(add); }
  }
  LAB.patchDissolve = (m) => { if (patched) patchOne(m); };   // for materials made later (PS1 soft shading)
  // the game hides the body piece by piece as it dies; while it dissolves it stays whole instead
  const parts = () => { const o = [D.g]; for (const S of D.segs) { o.push(S.g); for (const L of S.legs) o.push(L.femur, L.tibia, L.knee); } return o; };
  window.FEATURES.on('demonDown', () => { if (LAB.get('demon.dissolve') && !LAB.get('demon.absorb')) { patch(); disT = performance.now() / 1000; } }, 'lab');

  // absorb: a beaten centipede is pulled into the Solid piece by piece, tail first, each piece spiralling in and
  // shrinking, glowing in the Solid's colour; when the head goes in, the Solid flares. (Takes over from Dissolve.)
  const V = () => new game.THREE.Vector3();
  const tgt = V(), st = V(), sv = V(), glow = new game.THREE.Color();
  let ab = null;
  window.FEATURES.on('demonDown', () => { if (LAB.get('demon.absorb')) startAbsorb(); }, 'lab');
  function startAbsorb() {
    const n = D.segs.length, pieces = [], mats = new Map();
    const keep = (o) => o.traverse(c => { const m = c.material; if (m && m.emissive && !mats.has(m)) mats.set(m, m.emissive.clone()); });
    D.segs.forEach((S, i) => {
      const delay = (n - 1 - i) * 0.07;
      pieces.push({ o: S.g, p0: S.g.position.clone(), s0: S.g.scale.clone(), delay });
      for (const L of S.legs) for (const o of [L.femur, L.tibia, L.knee]) if (o) pieces.push({ o, p0: o.position.clone(), s0: o.scale.clone(), delay: delay + 0.03, leg: true });
      keep(S.g);
    });
    pieces.push({ o: D.g, p0: D.g.position.clone(), s0: D.g.scale.clone(), delay: n * 0.07 + 0.1, head: true });
    keep(D.g);
    ab = { t: 0, pieces, mats, legs: D.segs[0] && D.segs[0].legs[0] ? D.segs[0].legs[0].femur.parent : null };
  }
  function endAbsorb(flare) {
    // when it's done, the pieces are left far too small to see: the game shows the new demon for one frame before it
    // moves and sizes them, which flashed the old body where it died (it sizes them again from the next frame)
    for (const P of ab.pieces) { P.o.position.copy(P.p0); if (flare) { P.o.scale.setScalar(1e-4); P.o.visible = false; } else P.o.scale.copy(P.s0); }
    for (const [m, e] of ab.mats) m.emissive.copy(e);
    if (flare && ab.legs) ab.legs.visible = false;
    ab = null;
  }
  function absorb(dt) {
    if (!ab) return;
    if (D.alive && !D.dying) { endAbsorb(false); return; }   // a new demon already came
    ab.t += dt;
    const F = LAB.get('demon.absorbLen') ?? 0.8, hex = game.solid.color.getHex();
    game.orbMesh.getWorldPosition(tgt);
    // everything still out there glows brighter in the Solid's colour as its turn comes
    glow.copy(game.solid.color).multiplyScalar(Math.min(1, 0.3 + ab.t * 0.8));
    for (const m of ab.mats.keys()) m.emissive.copy(glow);
    let left = 0, legsOut = false;
    for (const P of ab.pieces) {
      const u = (ab.t - P.delay) / F;
      if (u >= 1) {
        if (!P.in) { P.in = true; P.o.visible = false; if (!P.leg) { game.sparkBurst(tgt, P.head ? 30 : 6, P.head ? 5 : 2.5, 0.6, 3, hex); game.orb.flash = Math.max(game.orb.flash || 0, P.head ? 6 : 1.5); } }
        continue;
      }
      left++; P.o.visible = true; if (P.leg) legsOut = true;
      if (u <= 0) {   // waiting its turn: it shudders
        const j = 0.05 * Math.min(1, ab.t * 3);
        P.o.position.set(P.p0.x + (Math.random() - 0.5) * j, P.p0.y + (Math.random() - 0.5) * j, P.p0.z + (Math.random() - 0.5) * j);
        continue;
      }
      const e = u * u, arc = Math.sin(u * Math.PI), a = u * 7 + P.delay * 9;
      st.lerpVectors(P.p0, tgt, e);
      st.x += Math.cos(a) * 0.7 * arc; st.z += Math.sin(a) * 0.7 * arc; st.y += arc * 0.9;
      P.o.position.copy(st);
      P.o.scale.copy(P.s0).multiplyScalar(Math.max(0.02, 1 - e * 0.97));
      P.o.rotation.y += dt * 10 * u;
      if (!P.leg && Math.random() < dt * 40) { sv.subVectors(tgt, st).multiplyScalar(2.5); game.spark(st, sv, 0.35, 0.5, hex, 1); }
    }
    if (ab.legs) ab.legs.visible = legsOut;
    // a swirl of light pulled in around the Solid the whole time
    if (Math.random() < dt * 60) {
      const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 1.2;
      st.set(tgt.x + Math.cos(a) * r, tgt.y + (Math.random() - 0.3) * 1.2, tgt.z + Math.sin(a) * r);
      sv.subVectors(tgt, st).multiplyScalar(2.6); sv.x += Math.sin(a) * 2; sv.z -= Math.cos(a) * 2;
      game.spark(st, sv, 0.38, 0.45, Math.random() < 0.3 ? 0xffffff : hex, 0.5);
    }
    if (!left) {
      game.fxBurst(tgt, hex, 70, 6); game.fxRing(tgt.x, tgt.z, hex, 4, 0.55); game.fxRing(tgt.x, tgt.z, 0xffffff, 2.4, 0.4, 0.06);
      game.shake(0.3); endAbsorb(true);
    }
  }
  window.FEATURES.on('frame', absorb, 'lab');
  function dissolve() {
    if (disT < 0) return;
    const k = (performance.now() / 1000 - disT) / (LAB.get('demon.dissolveLen') ?? 1.5);
    if (k >= 1 || (D.alive && !D.dying)) {   // done (or a new demon already came)
      disT = -1; dis.value = 0;
      if (!D.alive || D.dying) { for (const o of parts()) { o.visible = false; o.scale.setScalar(1e-4); } if (D.segs[0] && D.segs[0].legs[0]) D.segs[0].legs[0].femur.parent.visible = false; }   // tiny: see Absorbed below
      return;
    }
    dis.value = k;
    if (LAB.get('demon.dissolveCol')) edgeCol.value.copy(game.solid.color); else edgeCol.value.setRGB(1, 0.45, 0.1);
    for (const o of parts()) o.visible = true;
    // the game flashes a dying demon white; while it dissolves that is held off so the burn edge shows
    D.g.traverse(o => { const e = o.material && o.material.emissive; if (e && e.r === e.g && e.g === e.b) e.setRGB(0, 0, 0); });
    for (const S of D.segs) S.mat.emissive.setRGB(0, 0, 0);
    if (D.segs[0] && D.segs[0].legs[0]) D.segs[0].legs[0].femur.parent.visible = true;
  }
  window.FEATURES.on('frame', dissolve, 'lab');
  return [
    { id: 'aggression', label: 'Aggression', help: '0 never attacks, 3 relentless', min: 0, max: 3, step: 0.1, value: 1, frame: rage },
    { id: 'flash', label: 'White flash', help: 'The whole centipede flashes when hit', kind: 'onoff', value: 0, dice: true, frame: flash, apply: (v) => { if (!v) { flashT = 0; restore(); } } },
    { id: 'flashLen', label: 'Flash length', help: 'Seconds it flashes for', min: 0.05, max: 1.5, step: 0.05, value: 0.3 },
    { id: 'health', label: 'Demon health', help: 'Times its normal health (Studio Settings sets the normal)', min: 0.1, max: 5, step: 0.1, value: 1, fmt: (x) => '×' + x,
      apply: (x) => { const was = game.MOD.hp; game.MOD.hp = x; if (D.alive && !D.dying) D.hp *= x / was; } },
    { id: 'flashRate', label: 'Flash speed', help: 'Flashes a second', min: 2, max: 30, step: 1, value: 12 },
    { id: 'dissolve', label: 'Dissolve', help: 'A beaten demon burns away with a glowing edge', kind: 'onoff', value: 0, dice: true, apply: (x) => { if (x) patch(); } },
    { id: 'dissolveLen', label: 'Dissolve time', help: 'Seconds it takes to burn away', min: 0.5, max: 3, step: 0.1, value: 1.5, dice: false },
    { id: 'dissolveCol', label: 'Burn colour', help: "Orange, or the solid's colour", kind: 'onoff', value: 0, fmt: (x) => (x ? 'SOLID' : 'ORANGE') },
    { id: 'absorb', label: 'Absorbed', help: 'A beaten demon is sucked into the Solid, tail first', kind: 'onoff', value: 0, dice: true },
    { id: 'absorbLen', label: 'Absorb speed', help: 'Seconds each piece takes to fly in', min: 0.3, max: 2, step: 0.1, value: 0.8, dice: false }
  ];
});
