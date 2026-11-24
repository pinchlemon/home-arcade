// Lab shelf: Solid look. How the Solid itself is drawn (its colours, size, fire aura and spiral are on other shelf
// files but shown with these on the Solid look shelf). Every solid is drawn the same way: bright edges, a small solid
// core in the middle, a faint see-through shell, a glow on the ground under it, and a light it casts on the wizards.
// The game works out the shell, the light and the ground glow again every frame (they brighten with resonance), so
// these scale what it worked out rather than replace it.
LAB.shelf('solidlook', 'Solid look', (game) => {
  const get = (k, d) => { const v = LAB.get('solid.' + k); return v == null ? d : v; };
  const S = game.SOLIDS, core = (s) => s.g.children[1];
  function shape() {
    const c = get('core', 0.42), e = get('edges', 1);
    for (const s of S) {
      core(s).scale.setScalar(Math.max(0.001, c)); core(s).visible = c > 0;
      s.lineMat.transparent = e < 1; s.lineMat.opacity = e; s.g.children[0].visible = e > 0; s.lineMat.needsUpdate = true;
    }
  }
  // after the game's own update: the shell and the light
  window.FEATURES.on('frame', () => {
    const sh = get('shell', 1), li = get('light', 1);
    if (sh !== 1) for (const s of S) s.fillMat.opacity = Math.min(1, s.fillMat.opacity * sh);
    if (li !== 1) game.orbLight.intensity *= li;
  }, 'lab');
  // the ground glow is set after the frame event, so it's scaled when the camera moves (later in the same frame)
  window.FEATURES.on('camera', () => { const g = get('glow', 1); if (g !== 1) game.orbMark.material.opacity = Math.min(1, game.orbMark.material.opacity * g); }, 'lab');
  const pct = (x) => (x ? Math.round(x * 100) + '%' : 'OFF');
  return [
    { id: 'solid.core', label: 'Core', help: 'The small solid shape in the middle (0 is none: just edges and shell)', min: 0, max: 1, step: 0.02, value: 0.42, dice: true, fmt: pct, apply: shape },
    { id: 'solid.shell', label: 'Shell', help: 'The faint see-through skin; it brightens as resonance builds', min: 0, max: 4, step: 0.25, value: 1, dice: true, fmt: pct },
    { id: 'solid.edges', label: 'Edges', help: 'The bright outline of its faces', min: 0, max: 1, step: 0.1, value: 1, dice: true, fmt: pct, apply: shape },
    { id: 'solid.glow', label: 'Ground glow', help: 'The glow on the ground under it, which also shows where a throw will land', min: 0, max: 3, step: 0.25, value: 1, dice: true, fmt: pct },
    { id: 'solid.light', label: 'Light', help: 'The coloured light it casts on the wizards and the demon close by', min: 0, max: 3, step: 0.25, value: 1, dice: true, fmt: pct }
  ];
});
