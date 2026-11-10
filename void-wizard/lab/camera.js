// Lab shelf: Camera. Where you watch from. Moving stays the same, so a turned camera makes the controls feel turned.
LAB.shelf('camera', 'Camera', (game) => {
  const T = game.THREE, off = new T.Vector3(), UP = new T.Vector3(0, 1, 0), fov = game.camera.fov;
  let spin = 0, spinAt = 0;
  return [
    { id: 'orbit', label: 'Orbit', help: 'Swing the camera around', min: -180, max: 180, step: 15, value: 0, fmt: (v) => v + '°',
      camera: (cam, look, v) => { off.subVectors(cam.position, look).applyAxisAngle(UP, v * Math.PI / 180); cam.position.copy(look).add(off); cam.lookAt(look); } },
    { id: 'zoom', label: 'Zoom', help: 'Closer or farther', min: 0.4, max: 2.5, step: 0.1, value: 1,
      camera: (cam, look, v) => { off.subVectors(cam.position, look).divideScalar(v); cam.position.copy(look).add(off); cam.lookAt(look); } },
    { id: 'fov', label: 'Lens', help: 'Narrow is flat, wide bends the edges', min: 10, max: 120, step: 5, value: fov, fmt: (v) => v + '°',
      apply: (v) => { game.camera.fov = v; game.camera.updateProjectionMatrix(); } },
    { id: 'tilt', label: 'Tilt', help: '180 is upside down', min: -180, max: 180, step: 15, value: 0, fmt: (v) => v + '°',
      camera: (cam, look, v) => cam.rotateZ(v * Math.PI / 180) },
    { id: 'spin', label: 'Spin', help: 'Keeps turning slowly', min: 0, max: 2, step: 0.1, value: 0,
      camera: (cam, look, v, now) => { if (spinAt) spin += (now - spinAt) * v; spinAt = now; cam.rotateZ(spin); },
      apply: (v) => { if (!v) { spin = 0; spinAt = 0; } } }
  ];
});
