// ---- input ----
const keys = { left: false, right: false, jump: false, a: false, b: false };
const pressed = { jump: false, a: false, b: false };
const KEYMAP = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
  ArrowUp:'jump', KeyW:'jump', Space:'jump', KeyZ:'a', KeyJ:'a', KeyX:'b', KeyK:'b' };
function setKey(k, v) {
  if (v && !keys[k] && k in pressed) pressed[k] = true;
  keys[k] = v;
  audioInit();
}
addEventListener('keydown', e => {
  if (e.code === 'KeyM') { muted = !muted; return; }
  if (e.code === 'KeyN') { musicOn = !musicOn; return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { paused = !paused; return; }
  if (e.code === 'KeyC') { setZoom((zoom + 1) % ZOOMS.length); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault(); if (!e.repeat) setKey(k, true);
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { e.preventDefault(); setKey(k, false); } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.querySelectorAll('.pad button').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); b.classList.add('on'); setKey(k, true); };
  const off = e => { e.preventDefault(); b.classList.remove('on'); setKey(k, false); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
cv.addEventListener('pointerdown', () => cv.focus());

// ---- gamepad: PS5 DualSense (or any controller with the standard mapping) ----
// ✕ jump · □ / L1 squirt left · ○ / R1 squirt right · left stick or d-pad move · Options pause
const pad = { left: false, right: false, jump: false, a: false, b: false, pause: false };
let gamepad = null, paused = false;
const held = k => keys[k] || pad[k];
function pollPad() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  gamepad = null;
  for (const g of list) if (g && g.connected) { gamepad = g; break; }
  const n = { left: false, right: false, jump: false, a: false, b: false, pause: false };
  if (gamepad) {
    const b = i => !!(gamepad.buttons[i] && gamepad.buttons[i].pressed);
    const ax = gamepad.axes[0] || 0;
    n.left = b(14) || ax < -0.35; n.right = b(15) || ax > 0.35;
    n.jump = b(0) || b(12);
    n.a = b(1) || b(5) || b(7);
    n.b = b(2) || b(4) || b(6);
    n.pause = b(9);
  }
  for (const k of ['jump', 'a', 'b']) if (n[k] && !pad[k]) { pressed[k] = true; audioInit(); }
  if (n.pause && !pad.pause) paused = !paused;
  Object.assign(pad, n);
}
function rumble(ms, strong, weak) {
  const a = gamepad && gamepad.vibrationActuator;
  if (!a || !a.playEffect) return;
  try { a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); } catch (e) {}
}
const padStatus = document.getElementById('pad-status');
function showPad(on, name) {
  if (!padStatus) return;
  padStatus.hidden = !on;
  if (on) padStatus.textContent = /dualsense|054c|playstation|wireless controller/i.test(name) ? 'PS5 controller connected' : 'Controller connected';
}
function goFull() {
  try {
    const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq && !document.fullscreenElement && !document.webkitFullscreenElement) { const p = rq.call(el); if (p && p.catch) p.catch(() => {}); }
  } catch (e) {}
}
// a connected controller switches to console mode: full-screen game, no touch buttons
function setConsole(on, quiet) {
  if (document.body.classList.contains('console') === on) return;
  document.body.classList.toggle('console', on);
  fitCanvas();
  if (on) goFull();
  else if (!quiet) {
    paused = true;   // controller dropped mid-game: hold the action until it's back
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }
}
function anyPad() { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (e) { return false; } }
addEventListener('gamepadconnected', e => { showPad(true, e.gamepad.id); setConsole(true); });
addEventListener('gamepaddisconnected', () => { const on = anyPad(); showPad(on); setConsole(on); });
// some browsers only report a controller once a button is pressed; catch one that's already awake
if (anyPad()) setTimeout(() => setConsole(true), 0);
// Browsers hide a controller from a freshly opened page until a button is pressed on it. When the Hedron app opened this game it
// said whether a controller was in use (sessionStorage), so start in console mode right away instead of waiting for that first press.
// A touch on the screen before the controller shows up goes back to the touch buttons.
let hinted = false;
try { hinted = sessionStorage.getItem('ha.pad') === '1'; } catch (e) {}
if (hinted) setTimeout(() => setConsole(true, true), 0);
document.addEventListener('pointerdown', e => { if (hinted && e.pointerType === 'touch' && !anyPad()) { hinted = false; setConsole(false, true); } }, { passive: true });
// fullscreen needs a tap in most browsers; one tap on the screen in console mode asks for it
document.addEventListener('pointerdown', () => { if (document.body.classList.contains('console')) goFull(); }, { passive: true });
