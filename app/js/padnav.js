// Controller navigation for the full-screen tools (the game editor, the art viewer, the changes screen).
// The D-pad (or stick) moves a ring between things you can press, towards where you push it. On a row with a
// stepper or a switch, left and right change its value instead. A presses the thing the ring is on.
// The scene can be focused too; A on it hands the controller over to the scene (see gameEditor.js).

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
    // a pager's previous and next buttons are turned by left and right; anything else on the bar (like New) stays its own stop
    if (el.closest('[data-pad=pager]') && el.matches('[aria-label^="Previous"],[aria-label^="Next"]')) continue;
    const row = el.closest('.grow');
    if (el.matches('.grow')) { if (!el.querySelector('.stepper,[role=switch]')) continue; }
    else if (el !== row && row && row.querySelector('.stepper,[role=switch]')) continue;   // its row stands for its buttons
    // hidden by scrolling inside a panel? still counts, we scroll to it
    out.push(el);
  }
  return out;
}
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// every ring is cleared when this number goes up (the phone turning back upright, say)
let epoch = 0;
export const navEpoch = () => epoch;
export const clearAllNav = () => { epoch++; document.querySelectorAll('.pf').forEach(e => e.classList.remove('pf')); };
export const makeNav = () => ({ i: -1, epoch });
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
    // going sideways stays on the same row: never jump up or down to another plate
    if (dir === 'left' || dir === 'right') { const a = from.getBoundingClientRect(), b = el.getBoundingClientRect(), over = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (over < Math.min(a.height, b.height) * 0.3) continue; }
    // going up or down, a pager bar counts as one stop (its extra button, like New, is reached with A)
    if ((dir === 'up' || dir === 'down') && el.closest('[data-pad=pager]') && !el.matches('[data-pad=pager]')) continue;
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

// Call every frame. hooks: { tap() is A on the scene }.
// Returns true when it used the press.
export function padFrame(root, nav, input, hooks = {}) {
  if (nav.epoch !== epoch) { nav.epoch = epoch; nav.i = -1; }
  const dirs = ['up', 'down', 'left', 'right'].filter(d => input.pressed(d));
  const list = targets(root);
  let cur = nav.i >= 0 ? mark(root, nav) : null;
  if (nav.i >= 0 && !cur) nav.i = -1;
  if (!dirs.length && !input.pressed('a')) return false;
  if (!list.length) return false;
  if (!cur) {
    // the first press just shows where you are: the first thing on screen
    if (!dirs.length) return false;
    nav.i = 0; mark(root, nav); return true;
  }
  const row = cur.matches('.grow'), pager = cur.matches('[data-pad=pager]');
  const turn = (dir) => cur.querySelector(dir < 0 ? '[aria-label^="Previous"]' : '[aria-label^="Next"]')?.click();
  if (input.pressed('a')) {
    if (pager) { (cur.querySelector('.btn.bare:not(.icon)') || cur.querySelector('[aria-label^="Next"]'))?.click(); return true; }
    if (cur.id === 'scn') { hooks.tap && hooks.tap(); return true; }
    if (row) { const sw = cur.querySelector('[role=switch]'); (sw || cur.querySelector('[aria-label^="More"]'))?.click(); }
    else cur.click();
    return true;
  }
  const d = dirs[0];
  if (pager && (d === 'left' || d === 'right')) {
    const extra = cur.querySelector('.btn.bare:not(.icon)'), m = /(\d+)\s*\/\s*(\d+)/.exec(cur.innerText || '');
    if (d === 'right' && extra && m && +m[1] >= +m[2]) { nav.i = list.indexOf(extra); mark(root, nav); return true; }   // last page: on to New
    turn(d === 'left' ? -1 : 1); return true;
  }
  if (row && (d === 'left' || d === 'right')) {
    const el = cur.querySelector(d === 'left' ? '[aria-label^="Less"]' : '[aria-label^="More"]') || cur.querySelector('[role=switch]');
    el?.click(); return true;
  }
  const next = pick(list, cur, d);
  if (next) { nav.i = list.indexOf(next); mark(root, nav); next.scrollIntoView({ block: 'nearest' }); }
  return true;
}
