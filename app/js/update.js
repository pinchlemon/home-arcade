// Updating to the newest version: forget the saved copies of the app and load everything again from GitHub.
// (Your games' changes, settings and token are kept: they are stored separately.)
export async function hardUpdate() {
  try { const r = await navigator.serviceWorker?.getRegistration(); if (r) await r.update(); } catch (e) {}
  try { for (const k of await caches.keys()) if (k.startsWith('arcade-')) await caches.delete(k); } catch (e) {}
  location.reload();
}
// "Nov 3, 10:29 AM": when this build was made, so you can see at a glance whether you have the newest
export const buildDate = (b) => { const t = new Date(+b * 1000); return isNaN(t) ? 'unknown' : t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
