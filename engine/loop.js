let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  const step = 1000 / 60;
  pollPad();
  if (paused) { acc = 0; pressed.jump = pressed.a = pressed.b = false; }
  while (acc >= step) { update(); acc -= step; }
  render();
  requestAnimationFrame(loop);
}
let saved = 0;
try { saved = +localStorage.getItem('crab-zoom') || 0; } catch (e) {}
setZoom(saved >= 0 && saved < ZOOMS.length ? saved : 0);
requestAnimationFrame(loop);
cv.focus({ preventScroll: true });
