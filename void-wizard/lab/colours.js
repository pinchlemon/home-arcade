// Lab shelf: Colours. Recolour the two wizards' cloaks, the five solids, and the centipede part by part.
// Each knob steps through a named palette; ORIGINAL (the normal value) puts back the game's own colour.
LAB.shelf('colours', 'Colours', (game) => {
  const T = game.THREE, D = game.demon;
  const PAL = [
    ['RED', 0xff3b30], ['ORANGE', 0xff8a1f], ['GOLD', 0xe8b64a], ['YELLOW', 0xffe14a], ['LIME', 0xa6e36a], ['GREEN', 0x2fb85a],
    ['TEAL', 0x2fb8a0], ['CYAN', 0x6ff2e0], ['SKY', 0x5ab4ff], ['BLUE', 0x3d4fc4], ['INDIGO', 0x3a2f9c], ['PURPLE', 0x8a4ad0],
    ['PINK', 0xff7ac8], ['ROSE', 0xc43d5a], ['BROWN', 0x7a4a2a], ['WHITE', 0xf0f0f0], ['GREY', 0x808890], ['BLACK', 0x151518],
    // added later: new colours go on the end, because saved prototypes remember a colour by its place
    ['CHARCOAL', 0x3c3f47], ['SLATE', 0x5a6478], ['SILVER', 0xc4cad4], ['CREAM', 0xf3e6c4], ['PEACH', 0xffb08a], ['CORAL', 0xff6f5a],
    ['CRIMSON', 0x9c1c2a], ['MAROON', 0x5e1a24], ['AMBER', 0xffb02a], ['OLIVE', 0x7a8a2a], ['MINT', 0x9cf2c0], ['FOREST', 0x1f6e3a],
    ['NAVY', 0x1e2a6e], ['LAVENDER', 0xb9a2f0], ['MAGENTA', 0xe03cc8], ['PLUM', 0x5a2a5e], ['TAN', 0xc8a47a], ['NEON', 0x7dff6a]
  ];
  const name = (x) => (x ? PAL[x - 1][0] : 'ORIGINAL');
  const pick = (x, orig) => (x ? PAL[x - 1][1] : orig);

  // ---- wizards: the robe is coloured per corner (black bottom edge, trim band, cloak), the hood and its lip by material
  let trimY = 0.05;   // corners below this are trim (the game's own robe has one row there)
  const band = (y) => (y < 0.005 ? 0 : y < trimY ? 1 : 2);
  function robeCols(W) {   // the colours the game gave it, read once from its own robe (one trim row, below 0.05)
    const c = W.robeGeo.attributes.color.array, b = W.robeBase, out = [], band0 = (y) => (y < 0.005 ? 0 : y < 0.05 ? 1 : 2);
    for (let i = 0; i < b.length / 3 && !(out[1] && out[2]); i++) { const k = band0(b[i * 3 + 1]); if (!out[k]) out[k] = new T.Color(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]); }
    return out;
  }
  function hoodMats(W) {
    const out = [], robe = W.robe0[2];
    W.neck.traverse(o => { const m = o.userData.labToon || o.material; if (m && m.isMeshToonMaterial && m.color.getHex() === robe.getHex()) out.push(m); });
    return out;
  }
  // every wizard Colours looks after: blue and red, and the Party shelf's extra wizards once they are made
  const wiz = [];
  function prep(W, key) { W.robe0 = robeCols(W); W.hoodM = hoodMats(W); W.labKey = key; W.robeGeo0 = W.robeGeo; W.robeBase0 = W.robeBase; wiz.push(W); }
  prep(game.player, 'you'); prep(game.buddy, 'buddy');
  function paintRobe(geo, base, trim, cloak) {
    const c = geo.attributes.color; if (!c) return;
    for (let i = 0; i < base.length / 3; i++) { const k = band(base[i * 3 + 1]); if (k === 1) trim.toArray(c.array, i * 3); else if (k === 2) cloak.toArray(c.array, i * 3); }
    c.needsUpdate = true;
  }
  function wizard(W, part) {
    return (x) => {
      const cloak = new T.Color(pick(LAB.get('colours.' + W.labKey + 'Cloak'), W.robe0[2].getHex()));
      const trim = new T.Color(pick(LAB.get('colours.' + W.labKey + 'Trim'), W.robe0[1].getHex()));
      paintRobe(W.robeGeo, W.robeBase, trim, cloak);
      if (W.labHi) paintRobe(W.labHi.robe, W.labHi.robeBase, trim, cloak);   // PS1 low poly keeps the full robe aside
      for (const m of W.hoodM) m.color.copy(cloak);
    };
  }
  // trim height: the robe is rebuilt from the game's outline with two extra rows, so the trim ends in a crisp line
  // at the chosen height. PS1 low poly is rebuilt around it (it reads W.labTrimY for where the trim ends).
  const TRIM = [0.04, 0.08, 0.12, 0.16, 0.2, 0.28];
  function robeAt(W, h) {
    const P = W.robeGeo0.parameters.points, out = [], top = h + 0.015;
    const xAt = (y) => { for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (y <= a.y && y >= b.y) return a.x + (b.x - a.x) * (a.y - y) / (a.y - b.y); } return P[P.length - 1].x; };
    for (const p of P) if (p.y > top + 0.005) out.push(p.clone());
    out.push(new T.Vector2(xAt(top), top), new T.Vector2(xAt(h), h));
    for (const p of P) if (p.y < h - 0.005) out.push(p.clone());
    const g = new T.LatheGeometry(out, W.robeGeo0.parameters.segments);
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    return g;
  }
  function trimHeight(x) {
    const lp = !!game.player.labHi && LAB.lowPoly;
    if (lp) LAB.lowPoly(false);
    trimY = x ? TRIM[x] + 0.008 : 0.05;
    for (const W of wiz) trimOf(W, x);
    if (lp) LAB.lowPoly(true);
  }
  function trimOf(W, x) {
    const old = W.robeGeo, g = x ? robeAt(W, TRIM[x]) : W.robeGeo0;
    W.body.traverse(o => { if (o.geometry === old) o.geometry = g; });
    if (old !== W.robeGeo0) old.dispose();
    W.robeGeo = g; W.robeBase = x ? Float32Array.from(g.attributes.position.array) : W.robeBase0;
    W.labTrimY = x ? trimY : 0;
    wizard(W)();
  }
  // the Party shelf calls this when it makes an extra wizard (before PS1 looks are put on it)
  LAB.paintWizard = (W, key) => { prep(W, key); const h = LAB.get('colours.trimH') ?? 0; if (h) trimOf(W, h); else wizard(W)(); };
  const extra = (key) => () => { const W = wiz.find(w => w.labKey === key); if (W) wizard(W)(); };

  // ---- solids: the thrown one, its badge in the corner, its light and ground glow, and its name
  const solid0 = game.SOLIDS.map(S => S.col);
  function solid(i) {
    return (x) => {
      const S = game.SOLIDS[i], hex = pick(x, solid0[i]);
      S.col = hex; S.color.set(hex);
      for (const g of [S.g, S.hg]) g.traverse(o => { if (o.material && o.material.color) o.material.color.set(hex); });
      if (game.solid === S) {
        if (game.orbLight) game.orbLight.color.set(hex);
        if (game.orbMark) game.orbMark.material.color.set(hex);
        const el = document.querySelector('.solid-name'); if (el) el.style.color = '#' + S.color.getHexString();
      }
    };
  }
  // the game sets the light and the name's colour when the solid changes; keep them in step with a recoloured solid
  let lastSolid = game.solid;
  window.FEATURES.on('frame', () => { if (game.solid !== lastSolid) { lastSolid = game.solid; const i = game.SOLIDS.indexOf(lastSolid); if (LAB.get('colours.solid' + i)) solid(i)(LAB.get('colours.solid' + i)); } }, 'lab');

  // ---- centipede: its materials, found by the colours the game made them with
  const PARTS = { shell: 0x261b3d, rim: 0x4a3870, bone: 0xe6dcc8, legs: 0xd9d0e6, spots: 0xff8a3a };
  const found = {}; for (const k in PARTS) found[k] = new Set();
  const look = (o) => { const m = o.userData.labToon || o.material; if (!m || !m.color || Array.isArray(m)) return; for (const k in PARTS) if (m.color.getHex() === PARTS[k]) found[k].add(m); };
  D.g.traverse(look);
  for (const S of D.segs) { S.g.traverse(look); for (const L of S.legs) for (const o of [L.femur, L.tibia, L.knee]) if (o) o.traverse(look); }
  const demonPart = (k) => (x) => { for (const m of found[k]) m.color.set(pick(x, PARTS[k])); };
  const eye0 = D.eyeMat.color.getHex();

  const row = (id, label, help, apply) => ({ id, label, help, min: 0, max: PAL.length, step: 1, value: 0, fmt: name, dice: true, apply });
  return [
    row('youCloak', 'Your cloak', 'The blue wizard', wizard(game.player)),
    row('youTrim', 'Your trim', 'The band at the bottom of your cloak', wizard(game.player)),
    { id: 'trimH', label: 'Trim height', help: 'How tall the band at the bottom of every cloak is', min: 0, max: TRIM.length - 1, step: 1, value: 0, dice: false,
      fmt: (x) => (x ? (TRIM[x] / 0.04) + '×' : 'NORMAL'), apply: trimHeight },
    row('buddyCloak', "Buddy's cloak", 'The red wizard', wizard(game.buddy)),
    row('buddyTrim', "Buddy's trim", 'The band at the bottom of his cloak', wizard(game.buddy)),
    // new knobs go at the end of the list (the panel's LAYOUT puts them with the wizards)

    row('solid0', 'Tetrahedron', 'Fire', solid(0)),
    row('solid1', 'Cube', 'Earth', solid(1)),
    row('solid2', 'Octahedron', 'Air', solid(2)),
    row('solid3', 'Dodecahedron', 'Aether', solid(3)),
    row('solid4', 'Icosahedron', 'Water', solid(4)),
    row('shell', 'Centipede shell', 'Its head and the plates on its back', demonPart('shell')),
    row('rim', 'Centipede rims', 'The edge under each plate, and its jaws', demonPart('rim')),
    row('bone', 'Centipede bone', 'Its face, antlers and jaw hooks', demonPart('bone')),
    row('legs', 'Centipede legs', 'Legs, antennae and tail', demonPart('legs')),
    row('spots', 'Centipede spots', 'The dots along its sides', demonPart('spots')),
    row('eyes', 'Centipede eyes', 'Its glowing pupils', (x) => D.eyeMat.color.set(pick(x, eye0))),
    ...[['green', 'Green'], ['purple', 'Purple'], ['gold', 'Gold']].flatMap(([k, n]) => [
      row(k + 'Cloak', n + ' cloak', 'The ' + n.toLowerCase() + ' wizard (Party shelf, Extra wizards)', extra(k)),
      row(k + 'Trim', n + ' trim', 'The band at the bottom of the ' + n.toLowerCase() + " wizard's cloak", extra(k))])
  ];
});
