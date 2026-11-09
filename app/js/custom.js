// The app's customizations (redrawn icons, your own icons, icon names, button pictures, button text, button order).
// They are kept on the phone in localStorage, and can be pushed to GitHub as app/custom.json, which is the starting
// point for any phone or browser that has none of its own yet (a new phone, cleared Safari data, Claude's test browser).
// Loaded before anything reads them: pixel.js imports this module, and its top-level await finishes first.
export const KEYS = {
  'ha.icons': 'Redrawn icons',
  'ha.icons.mine': 'Your icons',
  'ha.icons.names': 'Icon names',
  'ha.icons.slots': 'Button pictures',
  'ha.text.slots': 'Button text',
  'ha.order': 'Button order'
};
const PUSHED = 'ha.custom.pushed';   // what was last pushed from this phone (the site may still serve the older file for a minute or two)
const parse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const clean = (o) => { const out = {}; for (const k of Object.keys(KEYS)) if (o && o[k] && Object.keys(o[k]).length) out[k] = o[k]; return out; };

let site = {};
try {
  const res = await Promise.race([fetch(new URL('../custom.json', import.meta.url), { cache: 'no-cache' }), new Promise(r => setTimeout(r, 2000))]);
  if (res && res.ok) site = clean(await res.json());
} catch (e) { /* offline with no saved copy: start from nothing */ }
// a phone that has never had any of these starts from the file
for (const k of Object.keys(KEYS)) if (localStorage.getItem(k) === null && site[k]) localStorage.setItem(k, JSON.stringify(site[k]));

export const snapshot = () => { const o = {}; for (const k of Object.keys(KEYS)) o[k] = parse(localStorage.getItem(k)) || {}; return clean(o); };
const base = () => clean(parse(localStorage.getItem(PUSHED)) || site);
// how many entries differ from what is on GitHub, by kind
export function changes() {
  const now = snapshot(), was = base(), out = [];
  for (const [k, label] of Object.entries(KEYS)) {
    const a = now[k] || {}, b = was[k] || {};
    const n = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(x => JSON.stringify(a[x]) !== JSON.stringify(b[x])).length;
    if (n) out.push({ key: k, label, n });
  }
  return out;
}
export const count = () => changes().reduce((s, c) => s + c.n, 0);
export const fileText = (o = snapshot()) => JSON.stringify(o, null, 1) + '\n';
export function markPushed(o) { try { localStorage.setItem(PUSHED, JSON.stringify(o)); } catch (e) { /* storage full */ } }
// replace this phone's customizations (import a file, or go back to GitHub's); the app reloads to show them
export function replaceAll(o) {
  o = clean(o);
  for (const k of Object.keys(KEYS)) { if (o[k]) localStorage.setItem(k, JSON.stringify(o[k])); else localStorage.setItem(k, '{}'); }
  location.reload();
}
export const discard = () => replaceAll(base());
