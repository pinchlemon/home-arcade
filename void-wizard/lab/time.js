// Lab shelf: Time. How fast the whole game runs.
LAB.shelf('time', 'Time', (game) => {
  // the three knobs share one clock: speed, held still, or wobbling
  const retime = (now) => {
    const sp = LAB.get('time.speed') ?? 1, wob = LAB.get('time.wobble') ?? 0;
    game.MOD.time = LAB.get('time.freeze') ? 0 : sp * (wob ? 1 + 0.9 * wob * Math.sin((now || 0) * 2.4) : 1);
  };
  return [
    { id: 'speed', label: 'Game speed', help: 'Below 1 is slow motion', min: 0.1, max: 3, step: 0.1, value: 1, apply: () => retime() },
    { id: 'wobble', label: 'Time wobble', help: 'Speeds up and slows down in waves', min: 0, max: 1, step: 0.05, value: 0, apply: () => retime(), frame: (dt, v, now) => retime(now) },
    { id: 'freeze', label: 'Freeze', help: 'Everything holds still', kind: 'onoff', value: 0, dice: false, apply: () => retime() }
  ];
});
