// Lab shelf: Colours. Recolour the two wizards' cloaks, the five solids, and the centipede part by part.
// Each knob steps through a named palette; ORIGINAL (the normal value) puts back the game's own colour.
LAB.shelf('colours', 'Colours', (game) => {
  const T = game.THREE, D = game.demon;
  const PAL = [
    ['RED', 0xff3b30], ['ORANGE', 0xff8a1f], ['GOLD', 0xe8b64a], ['YELLOW', 0xffe14a], ['LIME', 0xa6e36a], ['GREEN', 0x2fb85a],
    ['TEAL', 0x2fb8a0], ['CYAN', 0x6ff2e0], ['SKY', 0x5ab4ff], ['BLUE', 0x3d4fc4], ['INDIGO', 0x3a2f9c], ['PURPLE', 0x8a4ad0],
    ['PINK', 0xff7ac8], ['ROSE', 0xc43d5a], ['BROWN', 0x7a4a2a], ['WHITE', 0xf0f0f0], ['GREY', 0x808890], ['BLACK', 0x151518]
  ];
  const name = (x) => (x ? PAL[x - 1][0] : 'ORIGINAL');
  const pick = (x, orig) => (x ? PAL[x - 1][1] : orig);

  // ---- wizards: the robe is coloured per corner (black bottom edge, trim band, cloak), the hood and its lip by material
  const band = (y) => (y < 0.005 ? 0 : y < 0.05 ? 1 : 2);
  function robeCols(W) {   // the colours the game gave it, read once
    const c = W.robeGeo.attributes.color.array, b = W.robeBase, out = [];
    for (let i = 0; i < b.length / 3 && !(out[1] && out[2]); i++) { const k = band(b[i * 3 + 1]); if (!out[k]) out[k] = new T.Color(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]); }
    return out;
  }
  function hoodMats(W) {
    const out = [], robe = W.robe0[2];
    W.neck.traverse(o => { const m = o.userData.labToon || o.material; if (m && m.isMeshToonMaterial && m.color.getHex() === robe.getHex()) out.push(m); });
    return out;
  }
  for (const W of [game.player, game.buddy]) { W.robe0 = robeCols(W); W.hoodM = hoodMats(W); }
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
  game.player.labKey = 'you'; game.buddy.labKey = 'buddy';

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
    row('buddyCloak', "Buddy's cloak", 'The red wizard', wizard(game.buddy)),
    row('buddyTrim', "Buddy's trim", 'The band at the bottom of his cloak', wizard(game.buddy)),
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
    row('eyes', 'Centipede eyes', 'Its glowing pupils', (x) => D.eyeMat.color.set(pick(x, eye0)))
  ];
});
