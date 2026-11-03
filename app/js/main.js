// Home Arcade: app shell. Tabs (Arcade, Studio, Art, Sound, Settings) and full-screen tools (the game editor, the art viewer).
// Studio, Art and Sound all work on one game at a time: the one selected in the Arcade (see games.js).
import { well, solidSvg, rasterSolid, paintSolid, icon } from './pixel.js';
import * as S from './store.js';
import * as input from './input.js';
import * as snd from './sound.js';
import * as games from './games.js';
import { A, resetActions, getAction, esc, setRows, rows } from './ui.js';
import arcade from './screens/arcade.js';
import studio from './screens/studio.js';
import art from './screens/art.js';
import sound from './screens/soundTab.js';
import settings from './screens/settings.js';
import { changeList } from './screens/sync.js';

export const SECTIONS = [
  { name: 'Arcade', solid: 'dodeca', color: '#ff5a1f', page: arcade },
  { name: 'Studio', solid: 'cube', color: '#7dff6a', page: studio },
  { name: 'Art', solid: 'icosa', color: '#ff4fd8', page: art },
  { name: 'Sound', solid: 'octa', color: '#4d7cff', page: sound },
  { name: 'Settings', solid: 'tetra', color: '#ffd23f', page: settings }
];

const root = document.getElementById('app');
export const app = {
  ui: S.getUI(),
  settings: S.getSettings(),
  overlay: null,
  busy: false,

  saveUI() { S.setUI(this.ui); },
  setSettings(patch) {
    this.settings = { ...this.settings, ...patch }; S.setSettings(this.settings);
    input.refreshSettings(); snd.refreshSettings(); applySettings(); this.render();
  },
  setTab(i, quiet) {
    i = (i + SECTIONS.length) % SECTIONS.length;
    if (i === this.ui.tab && !this.overlay) return;
    leave(); this.ui.tab = i; this.saveUI();
    if (this.overlay) { const o = this.overlay; this.overlay = null; if (o.onClose) o.onClose(); } // a jump from a full-screen tool to a tab
    if (!quiet) snd.click(); this.render();
  },
  open(overlay) { this.overlay = overlay; this.render(); },
  close() { const o = this.overlay; this.overlay = null; if (o && o.onClose) o.onClose(); this.render(); },
  toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast plate'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(this._tt); this._tt = setTimeout(() => { t.style.opacity = '0'; }, 2600);
  },
  render
};
window.__app = app; // handy for debugging in the browser console
const leave = () => { const pg = SECTIONS[app.ui.tab] && SECTIONS[app.ui.tab].page; if (pg && pg.leave) pg.leave(app); };
if (!SECTIONS[app.ui.tab]) app.ui.tab = 0;

function applySettings() {
  document.documentElement.classList.toggle('large', app.settings.textSize === 'LARGE');
  document.documentElement.classList.toggle('dots', !!app.settings.dots);
  // the color behind sprites in the Art tab (Settings › Display)
  const bg = { CHECKER: '#000 repeating-conic-gradient(#141414 0 25%,#000 0 50%) 0 0/16px 16px', BLACK: '#000', GRAY: '#5a5a5a', LIGHT: '#e8e6df', SKY: '#9dd4cf', GRASS: '#5d8a4e' }[app.settings.spriteBg] || '#000';
  document.documentElement.style.setProperty('--spritebg', bg);
}

function tabBar() {
  const toPush = changeList().length; // a dot on Settings while there are changes to push (Settings › Sync)
  return `<nav class="plate tabbar" aria-label="Sections">${SECTIONS.map((s, i) => {
    const on = i === app.ui.tab, color = on ? s.color : '#ffffff', dot = s.name === 'Settings' && toPush;
    return `<button class="tab" ${A(() => app.setTab(i, true))} ${on ? 'aria-current="page"' : ''} style="color:${color};--acc:${s.color}"${dot ? ` aria-label="Settings, ${toPush} to push"` : ''}>
      ${well(40, (on ? '<span class="ring" style="border-color:currentColor"></span>' : '') + solidSvg(20, 30, color, `data-solid="tab${i}" style="opacity:${on ? 1 : 0.85}"`) + (dot ? '<span class="dot" aria-hidden="true"></span>' : ''))}
      <span class="cap" style="color:${on ? 'var(--text)' : 'var(--muted)'}">${s.name}</span></button>`;
  }).join('')}</nav>`;
}

function render() {
  resetActions();
  if (app.overlay) {
    root.innerHTML = app.overlay.render(app);
    if (app.overlay && app.overlay.mount) app.overlay.mount(root, app);
    return;
  }
  const sec = SECTIONS[app.ui.tab], page = sec.page.render(app);
  root.innerHTML = `<div class="screen-tabs" style="--acc:${sec.color}">
    <h1 class="sr">${sec.name}</h1>
    <div class="plate emblem">${well(164, solidSvg(40, 110, sec.color, 'data-solid="hero"'))}<div class="emblem-info">${page.right}</div></div>
    ${page.body}
    ${tabBar()}
  </div>`;
  if (sec.page.mount) sec.page.mount(root, app);
  paintSolids(lastT, true);
  fitRows();
}

// The page never scrolls, and sits in the middle of the phone's screen: the gap above the top plate
// matches the gap below the tab bar. iOS can give home-screen apps less height than the screen
// (a black band at the bottom), so we centre on the whole screen when that still fits, and
// show as many list rows (1 to 4) as there is room for. The list area is the same height on every tab.
const probe = document.createElement('div'); probe.className = 'safe-probe'; document.body.appendChild(probe);
const listH = (n) => 52 + 8 + n * 64 + (n - 1) * 8;
let fitting = 0;
const LANDSCAPE = matchMedia('(orientation: landscape) and (max-height: 520px)');
function fitRows() {
  const sc = root.querySelector('.screen-tabs'), em = sc && sc.querySelector('.emblem'), tb = sc && sc.querySelector('.tabbar');
  if (!em || !tb) return;
  if (LANDSCAPE.matches) {
    // the top panel and tab bar sit beside the list, so the list can use the whole height
    const avail = innerHeight - Math.max(parseFloat(getComputedStyle(probe).paddingTop) || 0, 16) - 16;
    let k = 4; while (k > 1 && listH(k) > avail) k--;
    if (k !== rows() && fitting < 3) { setRows(k); fitting++; render(); fitting--; return; }
    sc.style.paddingTop = ''; sc.style.paddingBottom = ''; sc.style.setProperty('--list-h', listH(rows()) + 'px');
    return;
  }
  const gap = parseFloat(getComputedStyle(sc).rowGap) || 20, safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  const minTop = safeTop + 16, minBottom = 12, fixed = em.offsetHeight + tb.offsetHeight + gap * 2;
  let n = 4; while (n > 1 && fixed + listH(n) > innerHeight - minTop - minBottom) n--;
  if (n !== rows() && fitting < 3) { setRows(n); fitting++; render(); fitting--; return; }
  const H = fixed + listH(rows());
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const screenH = innerHeight > innerWidth ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const full = standalone ? Math.max(innerHeight, screenH) : innerHeight;
  let top = Math.round((full - H) / 2);
  top = Math.max(minTop, Math.min(top, innerHeight - minBottom - H));
  sc.style.setProperty('--list-h', listH(rows()) + 'px');
  sc.style.paddingTop = top + 'px'; sc.style.paddingBottom = '0px';
}
addEventListener('resize', () => { setRows(4); if (!app.overlay) render(); });

// Taps: one soft thud on touch-down. While held, the button sinks and lights up like a selected one,
// and whatever was selected next to it (same list, tab bar or tool row) steps back so only one thing is lit.
// Let go on the button and it stays lit for a beat, then acts; slide off and everything goes back.
let held = null, dimmed = [], busyTap = false;
const SELECTED = '[aria-pressed="true"],[aria-current="page"],[aria-selected="true"]';
const selectable = (el) => el.hasAttribute('aria-pressed') || el.hasAttribute('aria-selected') || el.classList.contains('tab');
function letGo() {
  if (held && !held._firing) held.classList.remove('pressed');
  held = null; dimmed.forEach(x => x.classList.remove('unsel')); dimmed = [];
}
root.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-a],.pbtn');
  if (!el || el.disabled || busyTap) return;
  letGo(); held = el; el.classList.add('pressed');
  if (selectable(el)) {
    const BOX = '[role="tablist"],[role="toolbar"],nav,.tray,.group';
    const box = el.closest(BOX) || el.parentElement;
    dimmed = [...box.querySelectorAll(SELECTED)].filter(x => x !== el && (x.closest(BOX) || x.parentElement) === box);
    dimmed.forEach(x => x.classList.add('unsel'));
  }
  if (!el.classList.contains('pbtn')) snd.click();
});
addEventListener('pointerup', (e) => {
  if (!held || held.classList.contains('pbtn')) { letGo(); return; }
  const over = document.elementFromPoint(e.clientX, e.clientY);
  if (!over || !held.contains(over)) letGo(); // slid off: no click is coming
});
addEventListener('pointercancel', letGo);
root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled || busyTap) return;
  const fn = getAction(+el.dataset.a); if (!fn) return;
  el.classList.add('pressed'); el._firing = true; busyTap = true;
  setTimeout(() => {
    busyTap = false; el._firing = false;
    fn(e);
    // if the action did not redraw the screen, put the button back
    el.classList.remove('pressed'); if (held === el) letGo();
  }, 90);
});

// ---- spinning solids and controller, once a frame
let lastT = 0, lastPaint = 0;
function paintSolids(t, force) {
  if (app.overlay) return;
  if (!force && app.settings.reduceMotion) return;
  const tt = app.settings.reduceMotion ? 0.6 : t;
  const hero = root.querySelector('[data-solid="hero"]');
  if (hero) paintSolid(hero, rasterSolid(SECTIONS[app.ui.tab].solid, tt * 0.45, 0.42 + Math.sin(tt * 0.3) * 0.22, 40));
  SECTIONS.forEach((s, i) => {
    const el = root.querySelector(`[data-solid="tab${i}"]`);
    if (el) paintSolid(el, rasterSolid(s.solid, tt * (0.55 + i * 0.08) + i * 1.3, 0.45 + Math.sin(tt * 0.3 + i) * 0.15, 20));
  });
}
function frame(ms) {
  const t = ms / 1000;
  input.poll();
  if (app.overlay) { if (app.overlay.frame) app.overlay.frame(t, app); }
  else {
    if (input.pressed('lb')) app.setTab(app.ui.tab - 1);
    else if (input.pressed('rb')) app.setTab(app.ui.tab + 1);
    else { const pg = SECTIONS[app.ui.tab].page; if (pg.pad) pg.pad(app, input); }
    if (ms - lastPaint > 50) { lastPaint = ms; paintSolids(t); }
  }
  lastT = t;
  requestAnimationFrame(frame);
}
input.onConnection(() => { if (!app.overlay) render(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); else if (!app.overlay) render(); });

// a new version on GitHub reloads the app the next time you come back to it (never mid-edit or mid-game)
let version = null;
function checkVersion() {
  fetch('../version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(j => {
    if (!j.v) return;
    if (version === null) version = j.v;
    else if (j.v !== version && !app.overlay) location.reload();
  }).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

applySettings();
render();
games.preload(() => { if (!app.overlay) render(); });
checkVersion();
requestAnimationFrame(frame);
