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
  function patch() {
    if (patched) return; patched = true;
    const seen = new Set(), all = [];
    const add = (m) => { if (m && !seen.has(m)) { seen.add(m); all.push(m); } };
    D.g.traverse(o => add(o.material));
    for (const S of D.segs) for (const L of S.legs) for (const o of [L.femur, L.tibia, L.knee]) if (o) o.traverse(x => add(x.material));
    for (const m of all) {
      if (Array.isArray(m)) continue;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uDis = dis; sh.uniforms.uDisCol = edgeCol;
        sh.vertexShader = 'varying vec3 vDis;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDis = position;');
        sh.fragmentShader = NOISE + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float dN = clamp((dFbm(vDis * 6.0) - 0.22) / 0.56, 0.0, 1.0), dD = uDis * 1.08 - 0.08;
          if (dN < dD) discard;
          float dEdge = (1.0 - smoothstep(dD, dD + 0.08, dN)) * step(0.001, uDis);`);
        if (sh.fragmentShader.includes('#include <emissivemap_fragment>'))
          sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uDisCol * dEdge * 4.0;');
        else sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, '  gl_FragColor.rgb += uDisCol * dEdge * 4.0;\n}');
      };
      m.needsUpdate = true;
    }
  }
  // the game hides the body piece by piece as it dies; while it dissolves it stays whole instead
  const parts = () => { const o = [D.g]; for (const S of D.segs) { o.push(S.g); for (const L of S.legs) o.push(L.femur, L.tibia, L.knee); } return o; };
  window.FEATURES.on('demonDown', () => { if (LAB.get('demon.dissolve')) { patch(); disT = performance.now() / 1000; } }, 'lab');
  function dissolve() {
    if (disT < 0) return;
    const k = (performance.now() / 1000 - disT) / (LAB.get('demon.dissolveLen') ?? 1.5);
    if (k >= 1 || (D.alive && !D.dying)) {   // done (or a new demon already came)
      disT = -1; dis.value = 0;
      if (!D.alive || D.dying) { for (const o of parts()) o.visible = false; if (D.segs[0] && D.segs[0].legs[0]) D.segs[0].legs[0].femur.parent.visible = false; }
      return;
    }
    dis.value = k;
    if (LAB.get('demon.dissolveCol')) edgeCol.value.copy(game.solid.color); else edgeCol.value.setRGB(1, 0.45, 0.1);
    for (const o of parts()) o.visible = true;
    if (D.segs[0] && D.segs[0].legs[0]) D.segs[0].legs[0].femur.parent.visible = true;
  }
  window.FEATURES.on('frame', dissolve, 'lab');
  return [
    { id: 'aggression', label: 'Aggression', help: '0 never attacks, 3 relentless', min: 0, max: 3, step: 0.1, value: 1, frame: rage },
    { id: 'flash', label: 'White flash', help: 'The whole centipede flashes when hit', kind: 'onoff', value: 0, dice: true, frame: flash, apply: (v) => { if (!v) { flashT = 0; restore(); } } },
    { id: 'flashLen', label: 'Flash length', help: 'Seconds it flashes for', min: 0.05, max: 1.5, step: 0.05, value: 0.3 },
    { id: 'flashRate', label: 'Flash speed', help: 'Flashes a second', min: 2, max: 30, step: 1, value: 12 },
    { id: 'dissolve', label: 'Dissolve', help: 'A beaten demon burns away with a glowing edge', kind: 'onoff', value: 0, dice: true, apply: (x) => { if (x) patch(); } },
    { id: 'dissolveLen', label: 'Dissolve time', help: 'Seconds it takes to burn away', min: 0.5, max: 3, step: 0.1, value: 1.5, dice: false },
    { id: 'dissolveCol', label: 'Burn colour', help: "Orange, or the solid's colour", kind: 'onoff', value: 0, fmt: (x) => (x ? 'SOLID' : 'ORANGE') }
  ];
});
