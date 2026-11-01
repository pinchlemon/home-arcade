// One input state for the whole app: controller (standard mapping), keyboard and on-screen touch buttons.
// Call poll() once a frame, then read held(k) and pressed(k) (true only on the frame the button went down).
import { getSettings } from './store.js';

const KEYS = ['left', 'right', 'up', 'down', 'a', 'b', 'x', 'start', 'lb', 'rb'];
const held = Object.fromEntries(KEYS.map(k => [k, false]));
const prev = { ...held };
const edge = { ...held };
const keyboard = { ...held };
export const touch = { ...held };
let pad = null, settings = getSettings();
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
  pad = null;
  for (const g of list) if (g && g.connected) { pad = g; break; }
  if (was !== !!pad) listeners.forEach(f => f());
}

export function poll() {
  pollPad();
  const n = Object.fromEntries(KEYS.map(k => [k, keyboard[k] || touch[k]]));
  if (pad) {
    const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const dz = 0.15 + settings.deadzone * 0.06, ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    n.left = n.left || b(14) || ax < -dz; n.right = n.right || b(15) || ax > dz;
    n.up = n.up || b(12) || ay < -dz; n.down = n.down || b(13) || ay > dz;
    const A = settings.swapAB ? b(1) : b(0), B = settings.swapAB ? b(0) : b(1);
    n.a = n.a || A; n.b = n.b || B; n.x = n.x || b(2) || b(3);
    n.start = n.start || b(9); n.lb = n.lb || b(4) || b(6); n.rb = n.rb || b(5) || b(7);
  }
  for (const k of KEYS) { edge[k] = n[k] && !prev[k]; prev[k] = n[k]; held[k] = n[k]; }
}
export const isHeld = (k) => held[k];
export const pressed = (k) => edge[k];
export const consume = (k) => { const v = edge[k]; edge[k] = false; return v; };

export function rumble(ms = 120, strong = 0.6, force = false) {
  if ((!settings.rumble && !force) || !pad || !pad.vibrationActuator || !pad.vibrationActuator.playEffect) return false;
  try { pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong / 2 }).catch(() => {}); return true; } catch (e) { return false; }
}

// Button names as printed on the controller the person chose in Settings
export function label(k) {
  const L = { XBOX: { a: 'A', b: 'B', x: 'X', start: 'MENU' }, PS: { a: 'X', b: 'O', x: 'SQ', start: 'OPT' }, SWITCH: { a: 'B', b: 'A', x: 'Y', start: '+' } }[settings.labels] || {};
  return L[k] || k.toUpperCase();
}
