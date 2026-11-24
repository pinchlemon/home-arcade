// Lab shelf: Camera. Where you watch from. Moving stays the same, so a turned camera makes the controls feel turned
// (except the right stick: it turns the camera and your controls with it). Dice leaves the camera alone.
LAB.shelf('camera', 'Camera', (game) => {
  const T = game.THREE, off = new T.Vector3(), UP = new T.Vector3(0, 1, 0), fov = game.camera.fov;
  let spin = 0, spinAt = 0;
  // right stick: left and right swing the camera around you (your controls turn with it), up and down zoom (or tilt,
  // with Stick up / down on TILT: raise the camera over you or bring it down low).
  // Clicking the stick (R3) puts it back. Not in the duel, where the right stick sets the team's shape.
  let yaw = 0, zoom = 1, pitch = 0, last = 0;   // pitch: Free tilt's raise or lower of the camera, in radians
  window.FEATURES.on('frame', () => {
    const now = performance.now() / 1000, dt = Math.min(0.1, now - (last || now)); last = now;
    if (!(LAB.get('camera.stick') ?? 1) || game.DUEL) { if (yaw || zoom !== 1 || pitch) { yaw = 0; zoom = 1; pitch = 0; game.MOD.turn = game.labLockTurn || 0; } game.labCamYaw = 0; return; }
    const gp = game.pad; if (!gp) return;
    const dz = (a) => (Math.abs(a) < 0.2 ? 0 : (a - Math.sign(a) * 0.2) / 0.8);
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (rx && !(game.you && game.you.labLocked)) yaw -= rx * dt * 2.4 * (LAB.get('camera.stickSpeed') ?? 1);   // locked on, it picks targets instead
    const aimY = game.you && game.you.labAiming && game.you.labAimStick;
    if (ry && !aimY) {
      if (LAB.get('camera.stickY')) pitch = Math.max(-1.2, Math.min(1.2, pitch - ry * dt * 1.6 * (LAB.get('camera.stickSpeed') ?? 1)));   // TILT: up raises the camera over you, down brings it toward the ground
      else zoom = Math.min(2.2, Math.max(0.5, zoom * Math.exp(-ry * dt * 1.4)));
    }
    if (LAB.btn(game.you || { gp }, 'camReset', 11)) { yaw = 0; zoom = 1; pitch = 0; }
    game.labCamYaw = yaw; game.MOD.turn = yaw + (game.labLockTurn || 0);   // lock-on adds its own turn
  }, 'lab');
  // Ball lean: after everything else, slide the view toward the Solid and back off to keep you both in it.
  // It only moves the camera, never turns it, so tilt, orbit and the right stick all stay as they are.
  let lx = 0, lz = 0, lp = 0, lt = 0;
  const fw = new T.Vector3();
  // last of all: Ball play's lock-on view, when it's on (it sets game.labLockView)
  function finish(cam, look) { lean(cam, look); if (game.labLockView) game.labLockView(cam, look); }
  function lean(cam, look) {
    const v = LAB.get('camera.lean') || 0, now = performance.now() / 1000;
    if (!v || game.DUEL) { lx = lz = lp = 0; lt = 0; return; }
    const dt = lt ? Math.min(0.1, now - lt) : 0; lt = now;
    const p = game.orb.p, dx = p.x - look.x, dz = p.z - look.z, dist = Math.hypot(dx, dz);
    let ox = dx * 0.5 * v, oz = dz * 0.5 * v; const m = Math.hypot(ox, oz); if (m > 7) { ox *= 7 / m; oz *= 7 / m; }
    const pull = Math.min(8, Math.max(0, dist - 5) * 0.4 * v), k = 1 - Math.exp(-3 * dt);
    lx += (ox - lx) * k; lz += (oz - lz) * k; lp += (pull - lp) * k;
    cam.getWorldDirection(fw); cam.position.x += lx; cam.position.z += lz; cam.position.addScaledVector(fw, -lp);
  }
  window.FEATURES.on('camera', (cam, look) => {
    if (!yaw && zoom === 1 && !pitch) return finish(cam, look);
    off.subVectors(cam.position, look).applyAxisAngle(UP, yaw).divideScalar(zoom);
    if (pitch) { const L = off.length(), h = Math.hypot(off.x, off.z) || 1e-6, e = Math.max(0.03, Math.min(1.45, Math.atan2(off.y, h) + pitch));   // the camera's height angle over you
      off.set(off.x / h * Math.cos(e) * L, Math.sin(e) * L, off.z / h * Math.cos(e) * L); }
    cam.position.copy(look).add(off);
    cam.lookAt(look);
    cam.rotateZ((LAB.get('camera.tilt') || 0) * Math.PI / 180 + (LAB.get('camera.spin') ? spin : 0));   // Tilt and Spin (applied before) again
    finish(cam, look);
  }, 'lab');
  return [
    { id: 'stick', label: 'Right stick', help: 'Turns the camera (and your controls); up and down zoom or tilt; click it to reset', kind: 'onoff', value: 1, dice: false },
    { id: 'stickY', label: 'Stick up / down', help: 'ZOOM moves the camera in and out; TILT raises it over you or brings it down low, for full control around you', min: 0, max: 1, step: 1, value: 0, dice: false, fmt: (v) => (v ? 'TILT' : 'ZOOM'),
      apply: (v) => { if (!v) pitch = 0; } },
    { id: 'stickSpeed', label: 'Stick speed', help: 'How fast the right stick turns the camera', min: 0.2, max: 3, step: 0.1, value: 1, dice: false },
    { id: 'height', label: 'Height', help: 'Lower brings the camera down toward the ground', min: 0.2, max: 1.8, step: 0.05, value: 1, dice: false,
      fmt: (v) => Math.round(v * 100) + '%',
      camera: (cam, look, v) => { off.subVectors(cam.position, look); const L = off.length(), h = Math.hypot(off.x, off.z) || 1e-6, e = Math.min(1.5, Math.atan2(off.y, h) * v);
        off.set(off.x / h * Math.cos(e) * L, Math.sin(e) * L, off.z / h * Math.cos(e) * L); cam.position.copy(look).add(off); cam.lookAt(look); } },
    { id: 'lean', label: 'Ball lean', help: 'Leans toward the Solid when it is away from you, and pulls back to keep you both in view', min: 0, max: 1, step: 0.1, value: 0, dice: false,
      fmt: (v) => Math.round(v * 100) + '%' },
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
