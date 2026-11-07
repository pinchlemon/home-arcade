// Moving buttons: from the hold editor choose Move, then tap another button in the same group to swap the two.
// A group is the buttons sharing one parent on one screen. Orders are kept on this phone (ha.order) and laid on
// each time the screen is drawn (main.js calls applyOrder).
import { HOST, buttonId } from './iconEditor.js';
import { placeNow, well, svgRows, G } from './pixel.js';
import { iconBtn } from './ui.js';
import * as input from './input.js';
import * as snd from './sound.js';

const KEY = 'ha.order';
let orders = null;
const read = () => orders || (orders = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(orders)); } catch (e) { /* storage full: lasts until the app closes */ } };

// the movable buttons directly inside a parent, and their ids (a repeated id gets a count, so each is its own)
const kids = (p) => [...p.children].filter(c => c.matches(HOST) && !c.hidden);
function ids(list) {
  const seen = {};
  return list.map(k => { const id = buttonId(k); seen[id] = (seen[id] || 0) + 1; return seen[id] > 1 ? id + '~' + seen[id] : id; });
}
// a group is known by its screen and the set of buttons in it, so it is found again however it was drawn
const groupKey = (p) => placeNow() + '|' + [...ids(kids(p))].sort().join(',');
export const canMove = (host) => !!host.parentElement && kids(host.parentElement).length > 1;

function order(p) {
  const list = kids(p);
  if (list.length < 2) return;
  const want = read()[groupKey(p)];
  if (!want) return;
  const id = ids(list), sorted = list.map((k, i) => [k, want.indexOf(id[i])]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  if (sorted.every((k, i) => k === list[i])) return;
  // put the buttons into the places the group's buttons already hold, so anything else in the parent stays put
  const marks = list.map(k => { const m = document.createComment(''); p.insertBefore(m, k); return m; });
  sorted.forEach((k, i) => p.insertBefore(k, marks[i].nextSibling));
  marks.forEach(m => m.remove());
}
export function applyOrder(root) {
  const any = Object.keys(read()).length;
  if (!any && !moving) return;
  const parents = new Set();
  if (root.matches && root.matches(HOST) && root.parentElement) parents.add(root.parentElement);
  for (const h of root.querySelectorAll(HOST)) parents.add(h.parentElement);
  if (any) for (const p of parents) order(p);
  if (moving) mark();
}

// ---- move mode
let moving = null;   // { key, id, bar }
function mark() {
  for (const e of document.querySelectorAll('.mv-zone,.mv-src')) e.classList.remove('mv-zone', 'mv-src');
  const app = document.getElementById('app');
  for (const p of new Set([...app.querySelectorAll(HOST)].map(h => h.parentElement))) {
    if (kids(p).length < 2 || groupKey(p) !== moving.key) continue;
    p.classList.add('mv-zone');
    const list = kids(p), id = ids(list);
    const src = list[id.indexOf(moving.id)];
    if (src) src.classList.add('mv-src');
  }
}
export function startMove(app, host) {
  const p = host.parentElement, list = kids(p);
  moving = { key: groupKey(p), id: ids(list)[list.indexOf(host)], app };
  const bar = moving.bar = document.createElement('div');
  bar.className = 'plate bar mv-bar';
  bar.style.setProperty('--acc', getComputedStyle(host).getPropertyValue('--acc').trim() || '#ffd23f');
  const r = document.getElementById('app').getBoundingClientRect();
  Object.assign(bar.style, { left: r.left + 20 + 'px', width: r.width - 40 + 'px' });
  const saved = !!read()[moving.key];
  bar.innerHTML = `${well(28, svgRows(G.move, 'var(--acc)'))}<span class="ie-name" style="margin-left:8px"><span class="title ell">Move</span><span class="sub ell">Tap a button to swap places</span></span>
    ${saved ? iconBtn('reset', 'data-mv="reset"', { color: '#fff', label: 'Original order' }) : ''}${iconBtn('back', 'data-mv="cancel"', { color: '#fff', label: 'Done' })}`;
  document.body.appendChild(bar);
  mark();
  app.modal = { frame() { if (input.pressed('b') || input.pressed('a')) stop(); } };   // the screen behind ignores the controller meanwhile
  addEventListener('pointerdown', eat, true);
  addEventListener('click', tap, true);
}
function stop(rerender) {
  if (!moving) return;
  const app = moving.app;
  removeEventListener('pointerdown', eat, true);
  removeEventListener('click', tap, true);
  moving.bar.remove();
  for (const e of document.querySelectorAll('.mv-zone,.mv-src')) e.classList.remove('mv-zone', 'mv-src');
  moving = null; app.modal = null;
  if (rerender) app.render();
}
// while moving, nothing on the screen does its usual job
function eat(e) {
  if (e.target.closest('.mv-bar')) return;
  e.stopPropagation(); e.preventDefault();
}
function tap(e) {
  const b = e.target.closest('[data-mv]');
  if (b) {
    e.stopPropagation(); snd.click();
    if (b.dataset.mv === 'reset') { delete read()[moving.key]; write(); stop(true); moving = null; }
    else stop();
    return;
  }
  if (e.target.closest('.mv-bar')) return;
  e.stopPropagation(); e.preventDefault();
  const host = e.target.closest(HOST), p = host && host.parentElement;
  // a button inside one of the group's buttons counts as that button
  let t = host;
  while (t && !(t.parentElement && t.parentElement.classList.contains('mv-zone'))) t = t.parentElement && t.parentElement.closest(HOST);
  if (!t || !p) return;
  const zone = t.parentElement, list = kids(zone), id = ids(list), i = list.indexOf(t);
  if (id[i] === moving.id) { stop(); return; }
  const j = id.indexOf(moving.id);
  const now = read()[moving.key] ? read()[moving.key].slice() : id.slice();
  const a = now.indexOf(id[i]), c = now.indexOf(id[j]);
  [now[a], now[c]] = [now[c], now[a]];
  read()[moving.key] = now; write();
  snd.click();
  order(zone);
  stop();
}
