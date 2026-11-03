// Controller navigation for the full-screen tools (the game editor, the art viewer, the changes screen).
// The D-pad (or stick) moves a ring between things you can press, towards where you push it. On a row with a
// stepper or a switch, left and right change its value instead. A presses the thing the ring is on.
// The scene can be focused too: left and right slide along it, and A taps its middle (where the cross is).

// A pager bar (data-pad="pager": previous, a title, next) is one thing to aim at: left and right turn it, so going down
// from the top bar lands on it first, and down again goes on to the rows under it.

// everything you can aim at, in the order it appears
function targets(root) {
  const scope = root.querySelector('.screen-tool') || root;
  const out = [];
  for (const el of scope.querySelectorAll('button, .grow, #scn, [data-pad=pager]')) {
    if (el.disabled || el.classList.contains('plane')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (el.matches('[data-pad=pager]')) { out.push(el); continue; }
    if (el.closest('[data-pad=pager]')) continue;   // its buttons are turned by left and right
    const row = el.closest('.grow');
    if (el.matches('.grow')) { if (!el.querySelector('.stepper,[role=switch]')) continue; }
    else if (el !== row && row && row.querySelector('.stepper,[role=switch]')) continue;   // its row stands for its buttons
    // hidden by scrolling inside a panel? still counts, we scroll to it
    out.push(el);
  }
  return out;
}
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export const makeNav = () => ({ i: -1 });
export const clearNav = (nav) => { nav.i = -1; };

// put the ring on the chosen thing (called after every redraw too)
export function mark(root, nav) {
  root.querySelectorAll('.pf').forEach(e => e.classList.remove('pf'));
  if (nav.i < 0) return null;
  const list = targets(root), el = list[Math.min(nav.i, list.length - 1)];
  if (!el) return null;
  nav.i = list.indexOf(el); el.classList.add('pf');
  return el;
}

function pick(list, from, dir) {
  const c = center(from.getBoundingClientRect());
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === from) continue;
    const r = el.getBoundingClientRect(), p = center(r), dx = p.x - c.x, dy = p.y - c.y;
    let score = Infinity;
    if (dir === 'down' && dy > 4) score = dy + Math.abs(dx) * 2;
    else if (dir === 'up' && dy < -4) score = -dy + Math.abs(dx) * 2;
    else if (dir === 'right' && dx > 4) score = dx + Math.abs(dy) * 3;
    else if (dir === 'left' && dx < -4) score = -dx + Math.abs(dy) * 3;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

// Call every frame. hooks: { pan(dx) slides the scene, tap() taps the scene's middle }.
// Returns true when it used the press.
export function padFrame(root, nav, input, hooks = {}) {
  const dirs = ['up', 'down', 'left', 'right'].filter(d => input.pressed(d));
  const list = targets(root);
  let cur = nav.i >= 0 ? mark(root, nav) : null;
  if (nav.i >= 0 && !cur) nav.i = -1;
  // holding left or right slides the scene while it is the thing in focus
  if (cur && cur.id === 'scn' && hooks.pan) { if (input.isHeld('left')) hooks.pan(-3); else if (input.isHeld('right')) hooks.pan(3); }
  if (!dirs.length && !input.pressed('a')) return false;
  if (!list.length) return false;
  if (!cur) {
    // the first press just shows where you are: the first thing on screen
    if (!dirs.length) return false;
    nav.i = 0; mark(root, nav); return true;
  }
  const row = cur.matches('.grow'), pager = cur.matches('[data-pad=pager]');
  const turn = (dir) => { const b = cur.querySelectorAll('button'); (dir < 0 ? b[0] : b[b.length - 1])?.click(); };
  if (input.pressed('a')) {
    if (pager) { turn(1); return true; }
    if (cur.id === 'scn') { hooks.tap && hooks.tap(); return true; }
    if (row) { const sw = cur.querySelector('[role=switch]'); (sw || cur.querySelector('[aria-label^="More"]'))?.click(); }
    else cur.click();
    return true;
  }
  const d = dirs[0];
  if (cur.id === 'scn' && (d === 'left' || d === 'right')) return true;   // those slide the scene
  if (pager && (d === 'left' || d === 'right')) { turn(d === 'left' ? -1 : 1); return true; }
  if (row && (d === 'left' || d === 'right')) {
    const el = cur.querySelector(d === 'left' ? '[aria-label^="Less"]' : '[aria-label^="More"]') || cur.querySelector('[role=switch]');
    el?.click(); return true;
  }
  const next = pick(list, cur, d);
  if (next) { nav.i = list.indexOf(next); mark(root, nav); next.scrollIntoView({ block: 'nearest' }); }
  return true;
}
