// Small building blocks shared by every screen, matching the design system's components.
import { well, icon, svgRows, svgText, G } from './pixel.js';

// Actions: render functions register handlers and get back an attribute to put on the element.
let actions = [];
export const resetActions = () => { actions = []; };
export const A = (fn) => { actions.push(fn); return `data-a="${actions.length - 1}"`; };
export const runAction = (i, ev) => { const f = actions[i]; if (f) f(ev); };
export const getAction = (i) => actions[i];

// how many 64px rows fit on this screen; main.js measures and sets it
let per = 4;
export const rows = () => per;
export const setRows = (n) => { per = Math.max(1, Math.min(4, n)); };

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const iconWell = (name, color) => well(28, icon(name, color));
export const plateBtn = (iconName, label, act, color) => `<button class="plate btn" ${act}>${iconWell(iconName, color)}<span>${esc(label)}</span></button>`;
export const bareBtn = (iconName, label, act, color) => `<button class="btn bare" ${act}>${iconWell(iconName, color)}<span>${esc(label)}</span></button>`;
export function iconBtn(name, act, opts = {}) {
  const on = !!opts.on, color = opts.color || (on ? 'var(--acc)' : '#e4e2dc');
  const inner = (on ? '<span class="ring"></span>' : '') + (opts.rows ? svgRows(opts.rows, color) : name ? svgRows(G[name], color) : '');   // opts.rows: an icon of its own
  return `<button class="btn icon bare" ${act} aria-label="${esc(opts.label || name)}"${opts.pressed !== undefined ? ` aria-pressed="${!!opts.pressed}"` : ''}${opts.disabled ? ' disabled' : ''}>${well(28, inner)}</button>`;
}

export function digits(n, color) {
  const s = (n < 10 ? '0' : '') + n;
  return svgText(s, color);
}

export const pager = (range, prev, next) => `<div style="display:flex;align-items:center;gap:2px">${iconBtn('left', prev, { color: '#fff', label: 'Previous page' })}<span class="cap acc" style="min-width:56px;text-align:center">${esc(range)}</span>${iconBtn('right', next, { color: '#fff', label: 'Next page' })}</div>`;

export function row({ art, artOff, name, meta, tag, selected, act, tagColor, nameColor, still }) {
  if (selected && artOff) art = `<span class="art-on">${art}</span><span class="art-off">${artOff}</span>`;
  const el = still ? 'div' : 'button';
  return `<${el} class="plate row" ${still ? '' : (act || '') + ` aria-pressed="${!!selected}"`}>
    ${well(40, art)}
    <span class="txt"><span class="title ell" style="color:${nameColor || (selected ? 'var(--acc)' : 'var(--text)')}">${esc(name)}</span><span class="sub">${esc(meta)}</span></span>
    <span class="cap" style="color:${tagColor || (selected ? 'var(--acc)' : 'var(--muted)')}">${esc(tag || '')}</span>
    ${selected ? '<span class="selring"></span>' : ''}
  </${el}>`;
}
export const emptyRow = (iconName, text) => `<div class="plate row-empty">${well(40, icon(iconName, 'var(--acc)'))}<span class="sub" style="white-space:normal">${esc(text)}</span></div>`;

export const valScreen = (text, color = 'var(--acc)', wide = false) => `<span class="vscreen${wide ? ' wide' : ''}">${svgText(text, color)}</span>`;
export const stepper = (text, dec, inc, label, wide) => `<span class="stepper">${iconBtn('minus', dec, { label: 'Less ' + label })}${valScreen(text, 'var(--acc)', wide)}${iconBtn('plus', inc, { label: 'More ' + label })}</span>`;
export const toggle = (on, act, label) => `<button class="vscreen" role="switch" aria-checked="${on}" aria-label="${esc(label)}" ${act} style="margin-right:6px">${svgText(on ? 'ON' : 'OFF', on ? 'var(--acc)' : '#6f6d69')}</button>`;

export function pageOf(items, page, n) {
  const per = n || rows();
  const pages = Math.max(1, Math.ceil(items.length / per)), p = Math.min(Math.max(0, page || 0), pages - 1);
  return { p, pages, slice: items.slice(p * per, p * per + per), range: items.length ? `${p * per + 1}–${Math.min(items.length, p * per + per)} / ${items.length}` : '0 / 0' };
}
