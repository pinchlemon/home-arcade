// Settings, sync bookkeeping and where you were in the app, saved on the phone (localStorage).
// Games themselves live in the repo (each with its game.json); changes made on the phone are kept by games.js.

const K = { settings: 'ha.settings', sync: 'ha.sync', ui: 'ha.ui' };
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

// the old Studio game format (and its sample game, Tide Pool) is gone; tidy up what it left on the phone
try { for (const k of Object.keys(localStorage)) if (k === 'ha.projects' || k.startsWith('ha.p.')) localStorage.removeItem(k); } catch (e) {}

export const DEFAULT_SETTINGS = { labels: 'XBOX', rumble: true, deadzone: 2, swapAB: false, autoPush: false, sfx: 7, menuSounds: true, reduceMotion: false, dots: true, textSize: 'NORMAL', spriteBg: 'CHECKER', repo: 'pinchlemon/home-arcade', branch: 'main', token: '' };
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(K.settings, {}) });
export const setSettings = (s) => write(K.settings, s);

export const getSync = () => ({ history: [], lastSync: '', ...read(K.sync, {}) });
export const setSync = (s) => write(K.sync, s);

export const getUI = () => ({ tab: 0, sel: 0, page: 0, game: null, ...read(K.ui, {}) });
export const setUI = (u) => write(K.ui, u);
