// One input state for the whole app: controller (standard mapping), keyboard and on-screen touch buttons.
// Call poll() once a frame, then read held(k) and pressed(k) (true only on the frame the button went down).
import { getSettings } from './store.js';

const KEYS = ['left', 'right', 'up', 'down', 'a', 'b', 'x', 'start', 'lb', 'rb'];
const held = Object.fromEntries(KEYS.map(k => [k, false]));
const prev = { ...held };
const edge = { ...held };
const keyboard = { ...held };
export const touch = { ...held };
let pad = null, pads = [], settings = getSettings();
const stickOn = { left: false, right: false, up: false, down: false };   // which directions the stick is already holding (for hysteresis)
const since = {}, again = {};   // when a direction went down / was last repeated
const listeners = new Set();

export const refreshSettings = () => { settings = getSettings(); };
export const onConnection = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const padConnected = () => !!pad;
export const padName = () => (pad ? (pad.id.split('(')[0].trim() || 'Controller') : '');

addEventListener('gamepadconnected', () => { pollPad(); listeners.forEach(f => f()); });
addEventListener('gamepaddisconnected', () => { pad = null; listeners.forEach(f => f()); });

const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'a', z: 'a', Z: 'a', x: 'b', X: 'b', c: 'x', C: 'x', Enter: 'start', Escape: 'b', q: 'lb', Q: 'lb', e: 'rb', E: 'rb' };
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key];
  if (!k || e.target.closest('input,textarea')) return;
  keyboard[k] = true;
  if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keyboard[k] = false; });
addEventListener('blur', () => { for (const k of KEYS) { keyboard[k] = false; touch[k] = false; } });

function pollPad() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  const was = !!pad;
  pad = null; pads = [];
  // some controllers show up as more than one device; use all of them together
  for (const g of list) if (g && g.connected) { pads.push(g); if (!pad) pad = g; }
  if (was !== !!pad) listeners.forEach(f => f());
}

export function poll() {
  pollPad();
  const n = Object.fromEntries(KEYS.map(k => [k, keyboard[k] || touch[k]]));
  // the stick: the strongest push among the connected devices
  let ax = 0, ay = 0;
  for (const g of pads) { const x = g.axes[0] || 0, y = g.axes[1] || 0; if (Math.hypot(x, y) > Math.hypot(ax, ay)) { ax = x; ay = y; } }
  const dz = 0.15 + settings.deadzone * 0.06;
  // it counts as one direction at a time (the stronger way), and a direction it is already holding stays on until the stick eases well back,
  // so a wobbling stick doesn't flicker between directions or fire sideways presses while you push up or down
  const hx = Math.abs(ax), hy = Math.abs(ay), onX = stickOn.left || stickOn.right, onY = stickOn.up || stickOn.down;
  const wantX = hx >= (onX ? dz * 0.7 : dz) && hx >= hy, wantY = !wantX && hy >= (onY ? dz * 0.7 : dz);
  stickOn.left = wantX && ax < 0; stickOn.right = wantX && ax > 0; stickOn.up = wantY && ay < 0; stickOn.down = wantY && ay > 0;
  n.left = n.left || stickOn.left; n.right = n.right || stickOn.right; n.up = n.up || stickOn.up; n.down = n.down || stickOn.down;
  for (const g of pads) {
    const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
    n.left = n.left || b(14); n.right = n.right || b(15); n.up = n.up || b(12); n.down = n.down || b(13);
    const A = settings.swapAB ? b(1) : b(0), B = settings.swapAB ? b(0) : b(1);
    n.a = n.a || A; n.b = n.b || B; n.x = n.x || b(2) || b(3);
    n.start = n.start || b(9); n.lb = n.lb || b(4) || b(6); n.rb = n.rb || b(5) || b(7);
  }
  if (!pads.length) for (const k in stickOn) stickOn[k] = false;
  const now = performance.now();
  for (const k of KEYS) {
    edge[k] = n[k] && !prev[k];
    if (edge[k]) { since[k] = now; again[k] = now; }
    // holding a direction keeps moving after a short wait
    else if (n[k] && 'leftrightupdown'.includes(k) && now - since[k] > 380 && now - again[k] > 120) { edge[k] = true; again[k] = now; }
    prev[k] = n[k]; held[k] = n[k];
  }
}
export const isHeld = (k) => held[k];
export const pressed = (k) => edge[k];

export function rumble(ms = 120, strong = 0.6, force = false) {
  if ((!settings.rumble && !force) || !pad || !pad.vibrationActuator || !pad.vibrationActuator.playEffect) return false;
  try { pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong / 2 }).catch(() => {}); return true; } catch (e) { return false; }
}

// Button names as printed on the controller the person chose in Settings
export function label(k) {
  const L = { XBOX: { a: 'A', b: 'B', x: 'X', start: 'MENU' }, PS: { a: 'X', b: 'O', x: 'SQ', start: 'OPT' }, SWITCH: { a: 'B', b: 'A', x: 'Y', start: '+' } }[settings.labels] || {};
  return L[k] || k.toUpperCase();
}
