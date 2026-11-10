// Lab shelf: Camera. Where you watch from. Moving stays the same, so a turned camera makes the controls feel turned
// (except the right stick: it turns the camera and your controls with it). Dice leaves the camera alone.
LAB.shelf('camera', 'Camera', (game) => {
  const T = game.THREE, off = new T.Vector3(), UP = new T.Vector3(0, 1, 0), fov = game.camera.fov;
  let spin = 0, spinAt = 0;
  // right stick: left and right swing the camera around you (your controls turn with it), up and down zoom.
  // Clicking the stick (R3) puts it back. Not in the duel, where the right stick sets the team's shape.
  let yaw = 0, zoom = 1, last = 0;
  window.FEATURES.on('frame', () => {
    const now = performance.now() / 1000, dt = Math.min(0.1, now - (last || now)); last = now;
    if (!(LAB.get('camera.stick') ?? 1) || game.DUEL) { if (yaw || zoom !== 1) { yaw = 0; zoom = 1; game.MOD.turn = 0; } return; }
    const gp = game.pad; if (!gp) return;
    const dz = (a) => (Math.abs(a) < 0.2 ? 0 : (a - Math.sign(a) * 0.2) / 0.8);
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (rx) yaw -= rx * dt * 2.4 * (LAB.get('camera.stickSpeed') ?? 1);
    if (ry) zoom = Math.min(2.2, Math.max(0.5, zoom * Math.exp(-ry * dt * 1.4)));
    if (gp.buttons[11] && gp.buttons[11].pressed) { yaw = 0; zoom = 1; }
    game.MOD.turn = yaw;
  }, 'lab');
  window.FEATURES.on('camera', (cam, look) => {
    if (!yaw && zoom === 1) return;
    off.subVectors(cam.position, look).applyAxisAngle(UP, yaw).divideScalar(zoom); cam.position.copy(look).add(off);
    cam.lookAt(look);
    cam.rotateZ((LAB.get('camera.tilt') || 0) * Math.PI / 180 + (LAB.get('camera.spin') ? spin : 0));   // Tilt and Spin (applied before) again
  }, 'lab');
  return [
    { id: 'stick', label: 'Right stick', help: 'Turns the camera (and your controls); up and down zoom; click it to reset', kind: 'onoff', value: 1, dice: false },
    { id: 'stickSpeed', label: 'Stick speed', help: 'How fast the right stick turns the camera', min: 0.2, max: 3, step: 0.1, value: 1, dice: false },
    { id: 'orbit', label: 'Orbit', help: 'Swing the camera around', min: -180, max: 180, step: 15, value: 0, dice: false, fmt: (v) => v + '°',
      camera: (cam, look, v) => { off.subVectors(cam.position, look).applyAxisAngle(UP, v * Math.PI / 180); cam.position.copy(look).add(off); cam.lookAt(look); } },
    { id: 'zoom', label: 'Zoom', help: 'Closer or farther', min: 0.4, max: 2.5, step: 0.1, value: 1, dice: false,
      camera: (cam, look, v) => { off.subVectors(cam.position, look).divideScalar(v); cam.position.copy(look).add(off); cam.lookAt(look); } },
    { id: 'fov', label: 'Lens', help: 'Narrow is flat, wide bends the edges', min: 10, max: 120, step: 5, value: fov, dice: false, fmt: (v) => v + '°',
      apply: (v) => { game.camera.fov = v; game.camera.updateProjectionMatrix(); } },
    { id: 'tilt', label: 'Tilt', help: '180 is upside down', min: -180, max: 180, step: 15, value: 0, dice: false, fmt: (v) => v + '°',
      camera: (cam, look, v) => cam.rotateZ(v * Math.PI / 180) },
    { id: 'spin', label: 'Spin', help: 'Keeps turning slowly', min: 0, max: 2, step: 0.1, value: 0, dice: false,
      camera: (cam, look, v, now) => { if (spinAt) spin += (now - spinAt) * v; spinAt = now; cam.rotateZ(spin); },
      apply: (v) => { if (!v) { spin = 0; spinAt = 0; } } }
  ];
});
