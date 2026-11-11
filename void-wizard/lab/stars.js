// Lab shelf: Stars. The specks floating in the void (the game's motes): how bright, how many, how big, what colours,
// and whether they twinkle. Their colours are worked out from each star's number, so no random numbers are used up.
LAB.shelf('stars', 'Stars', (game) => {
  const T = game.THREE, M = game.motes, mat = M.material, geo = M.geometry, n = geo.attributes.position.count, base = mat.color.clone();
  const get = (id, d) => LAB.get('stars.' + id) ?? d;
  const hash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const c = new T.Color();
  // each mode: the colour of star i (before brightness)
  const MODES = [
    ['NORMAL', () => c.copy(base)],
    ['RAINBOW', (i) => c.setHSL(hash(i, 1), 0.85, 0.6)],
    ['SOLID', (i) => c.copy(game.solid.color).multiplyScalar(0.5 + hash(i, 2) * 0.7)],
    ['WARM', (i) => c.setHSL(hash(i, 1) * 0.16, 0.9, 0.55 + hash(i, 2) * 0.2)],
    ['COOL', (i) => c.setHSL(0.5 + hash(i, 1) * 0.25, 0.8, 0.55 + hash(i, 2) * 0.2)],
    ['PASTEL', (i) => c.setHSL(hash(i, 1), 0.6, 0.8)],
    ['WHITE', (i) => c.setScalar(0.75 + hash(i, 2) * 0.25)]
  ];
  let cols = null;
  function paint(now) {
    const b = get('bright', 1), mode = get('colours', 0), tw = get('twinkle', 0);
    if (!mode && !tw) {   // one colour for all, as the game has it
      if (mat.vertexColors) { mat.vertexColors = false; mat.needsUpdate = true; }
      mat.color.copy(base).multiplyScalar(b); return;
    }
    if (!cols) { cols = new Float32Array(n * 3); geo.setAttribute('color', new T.BufferAttribute(cols, 3)); }
    if (!mat.vertexColors) { mat.vertexColors = true; mat.needsUpdate = true; }
    mat.color.setScalar(mode ? b * 0.6 : b);   // coloured stars start brighter than the game's dim blue, so they're toned down a little
    const f = MODES[mode][1], t = now || performance.now() / 1000;
    for (let i = 0; i < n; i++) {
      f(i);
      const k = tw ? 1 - tw * 0.95 * (0.5 + 0.5 * Math.sin(t * (1.5 + hash(i, 3) * 4) + hash(i, 4) * 6.28)) : 1;
      cols[i * 3] = c.r * k; cols[i * 3 + 1] = c.g * k; cols[i * 3 + 2] = c.b * k;
    }
    geo.attributes.color.needsUpdate = true;
  }
  let lastSolid = null;
  const twinkle = (dt, v, now) => { lastSolid = game.solid; paint(now); };
  const follow = () => { if (!get('twinkle', 0) && get('colours', 0) === 2 && game.solid !== lastSolid) { lastSolid = game.solid; paint(); } };   // SOLID colours follow the solid
  return [
    { id: 'bright', label: 'Star brightness', help: 'Dim, or bright enough to light up the void', min: 0, max: 5, step: 0.25, value: 1, fmt: (x) => '×' + x, apply: () => paint() },
    { id: 'amount', label: 'How many stars', help: 'From none to all of them', min: 0, max: 1, step: 0.05, value: 1, fmt: (x) => Math.round(x * 100) + '%',
      apply: (x) => { if (x === 1) geo.setDrawRange(0, Infinity); else geo.setDrawRange(0, Math.round(n * x)); } },
    { id: 'size', label: 'Star size', help: 'Pixels across', min: 1, max: 8, step: 0.5, value: 1, apply: (x) => { mat.size = x; } },
    { id: 'colours', label: 'Star colours', help: 'Every star its own colour', min: 0, max: MODES.length - 1, step: 1, value: 0, fmt: (x) => MODES[x][0], apply: () => paint(), frame: follow },
    { id: 'twinkle', label: 'Twinkle', help: 'Stars fade in and out at their own pace', min: 0, max: 1, step: 0.05, value: 0, apply: () => paint(), frame: twinkle }
  ];
});
