// Settings: Controller, Sync, GitHub, Audio, Display. Every row changes something real and is saved on the phone.
import { well, icon, svgText } from '../pixel.js';
import * as S from '../store.js';
import { A, esc, plateBtn, iconBtn, stepper, toggle, rows as rowCount } from '../ui.js';
import { syncGroup, changeList, pushAll } from './sync.js';
import * as input from '../input.js';
import * as snd from '../sound.js';

const YELLOW = '#ffd23f';
export const BUILD = '0.1';
const GROUPS = [['controller', 'Controller', 'controller'], ['sync', 'Sync', 'changes'], ['github', 'GitHub', 'github'], ['audio', 'Audio', 'sounds'], ['display', 'Display', 'display']];

const srow = (label, sub, control) => `<div class="plate setrow">
  <span style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="title ell" style="font-size:14px">${esc(label)}</span><span class="sub">${esc(sub)}</span></span>${control}</div>`;
const info = (text, act, label) => `<span style="display:flex;align-items:center;gap:2px;flex:none;min-width:0"><span class="sub" style="color:var(--text);max-width:170px">${esc(text)}</span>${act ? iconBtn('rename', act, { label }) : '<span style="width:6px"></span>'}</span>`;

function setToken(app) {
  const t = prompt('Paste a GitHub token with Contents read and write access to ' + app.settings.repo + '. It stays on this phone.', '');
  if (t === null) return;
  app.setSettings({ token: t.trim() });
  app.toast(t.trim() ? 'Token saved' : 'Token removed');
}

export default {
  render(app) {
    const st = app.settings, g = app.ui.setGroup || 'controller', put = (patch) => app.setSettings(patch);
    const tog = (k, label, sub) => srow(label, sub, toggle(!!st[k], A(() => put({ [k]: !st[k] })), label));
    const num = (k, label, sub, min, max) => srow(label, sub, stepper(String(st[k]), A(() => put({ [k]: Math.max(min, st[k] - 1) })), A(() => put({ [k]: Math.min(max, st[k] + 1) })), label));
    const cyc = (k, label, sub, list) => { const i = Math.max(0, list.indexOf(st[k])); return srow(label, sub, stepper(st[k], A(() => put({ [k]: list[(i + list.length - 1) % list.length] })), A(() => put({ [k]: list[(i + 1) % list.length] })), label)); };
    const sy = S.getSync(), pad = input.padConnected();
    let title, sub, a, b, rows;
    if (g === 'controller') {
      title = pad ? input.padName() : 'No controller'; sub = pad ? 'Connected' : 'Pair it in Bluetooth';
      a = plateBtn('controller', 'Test', A(() => openTester(app)));
      b = plateBtn('controller', 'Rumble', A(() => { if (!input.rumble(300, 1, true)) app.toast(pad ? 'This controller or browser cannot rumble' : 'No controller connected'); }));
      rows = cyc('labels', 'Button labels', 'Match your controller', ['XBOX', 'PS', 'SWITCH']) + tog('rumble', 'Vibration', 'Rumble when you get hit') + num('deadzone', 'Stick deadzone', 'Ignore small stick drift', 0, 9) + tog('swapAB', 'Swap A and B', 'Jump and confirm with B instead');
    } else if (g === 'sync') {
      ({ title, sub, a, b, rows } = syncGroup(app, plateBtn, A, rowCount()));
    } else if (g === 'github') {
      title = st.token ? 'Token saved' : 'Not signed in'; sub = st.token ? 'Pushing is on' : 'Needed to push';
      a = plateBtn('key', st.token ? 'Change token' : 'Add token', A(() => setToken(app)));
      b = plateBtn('out', 'Sign out', A(() => { if (!st.token) { app.toast('No token saved'); return; } if (confirm('Remove the GitHub token from this phone?')) { put({ token: '' }); app.toast('Signed out'); } }));
      rows = srow('Repository', 'Where games are pushed', info(st.repo, A(() => { const v = prompt('Repository (owner/name)', st.repo); if (v && /^[\w.-]+\/[\w.-]+$/.test(v.trim())) put({ repo: v.trim() }); else if (v) app.toast('Use owner/name, like pinchlemon/home-arcade'); }), 'Change repository'))
        + srow('Branch', 'Pushes go here', info(st.branch, A(() => { const v = prompt('Branch', st.branch); if (v && v.trim()) put({ branch: v.trim() }); }), 'Change branch'))
        + tog('autoPush', 'Auto push', 'Push when you leave the editor')
        + srow('Last sync', 'From this phone', info(sy.lastAt ? new Date(sy.lastAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'));
    } else if (g === 'audio') {
      title = 'Audio'; sub = st.sfx ? 'Sound on · ' + st.sfx + ' of 9' : 'Muted';
      a = plateBtn('play', 'Test sound', A(() => { snd.unlock(); snd.play({ wave: 'square', pitch: 8, slide: 2, len: 3 }); }));
      b = plateBtn('mute', st.sfx ? 'Mute all' : 'Unmute', A(() => (st.sfx ? put({ sfx: 0, lastSfx: st.sfx }) : put({ sfx: st.lastSfx || 7 }))));
      rows = num('sfx', 'Sound effects', 'Game and editor sounds', 0, 9) + tog('menuSounds', 'Menu sounds', 'Clicks as you move around');
    } else {
      title = 'Display'; sub = st.reduceMotion ? 'Motion reduced' : 'Solids spinning';
      a = plateBtn('reset', 'Check update', A(async () => {
        try { const r = await navigator.serviceWorker?.getRegistration(); if (r) await r.update(); } catch (e) {}
        app.toast('Reloading with the newest version'); setTimeout(() => location.reload(), 600);
      }));
      b = plateBtn('reset', 'Reset', A(() => put({ reduceMotion: false, dots: true, textSize: 'NORMAL' })));
      rows = tog('reduceMotion', 'Reduce motion', 'Stop the solids spinning') + tog('dots', 'Dot grid', 'Texture behind the plates') + cyc('textSize', 'Text size', 'Labels and details', ['NORMAL', 'LARGE'])
        + srow('Version', 'Home Arcade', info(BUILD + ' · ' + (navigator.onLine ? 'online' : 'offline')));
    }
    const name = (GROUPS.find(x => x[0] === g) || GROUPS[0])[1];
    const right = `<span class="cap acc">${esc(name)}</span><span class="title clamp2">${esc(title)}</span><span class="sub">${esc(sub)}</span><div class="actions">${a}${b}</div>`;
    const body = `<div class="group">
      <div class="plate bar">
        <div role="tablist" aria-label="Settings groups" style="display:flex;align-items:center;gap:4px">
          ${GROUPS.map(([k, l, ic]) => `<span class="dotwrap">${iconBtn(ic, A(() => { app.ui.setGroup = k; app.saveUI(); app.render(); }), { on: g === k, label: l, pressed: g === k })}${k === 'sync' && changeList().length ? '<span class="dot" aria-hidden="true"></span>' : ''}</span>`).join('')}
        </div>
        <span class="cap acc" style="padding-right:10px">${esc(name)}</span>
      </div>
      ${rows}
    </div>`;
    return { right, body };
  },
  pad(app, input2) {
    const i = GROUPS.findIndex(x => x[0] === (app.ui.setGroup || 'controller')), n = GROUPS.length;
    if (input2.pressed('right')) { app.ui.setGroup = GROUPS[(i + 1) % n][0]; app.saveUI(); app.render(); }
    else if (input2.pressed('left')) { app.ui.setGroup = GROUPS[(i + n - 1) % n][0]; app.saveUI(); app.render(); }
    else if (app.ui.setGroup === 'sync' && input2.pressed('a')) pushAll(app);
  }
};

// A live view of every button, so you can check the controller and the labels match.
function openTester(app) {
  const KEYS = [['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right'], ['a', 'A'], ['b', 'B'], ['x', 'X'], ['start', 'Start'], ['lb', 'LB'], ['rb', 'RB']];
  let root = null, last = '', holdB = 0;
  const ov = {
    render() {
      return `<div class="screen-tool" style="--acc:${YELLOW}">
        <h1 class="sr">Test buttons</h1>
        <div class="plate bar">
          ${iconBtn('back', A(() => app.close()), { color: '#fff', label: 'Back to Settings' })}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="title ell">Test buttons</span><span class="sub">${esc(input.padConnected() ? input.padName() : 'No controller · the keyboard works too')}</span></span>
        </div>
        <div class="plate inspector gap20" style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;align-content:start">
          ${KEYS.map(([k, l]) => `<div class="irow" style="border:0"><span class="cap" style="color:var(--muted)">${esc(k === 'a' || k === 'b' || k === 'x' ? input.label(k) : l)}</span><span class="vscreen" data-key="${k}">${svgText('OFF', '#6f6d69')}</span></div>`).join('')}
        </div>
        <div class="plate bar text-start"><span class="sub" style="white-space:normal">Hold B for two seconds to go back.</span></div>
      </div>`;
    },
    mount(r) { root = r; last = ''; },
    frame() {
      if (!root) return;
      const now = KEYS.map(([k]) => (input.isHeld(k) ? 1 : 0)).join('');
      if (input.isHeld('b')) { if (++holdB > 120) { app.close(); return; } } else holdB = 0;
      if (now === last) return; last = now;
      KEYS.forEach(([k], i) => { const el = root.querySelector(`[data-key="${k}"]`); if (el) el.innerHTML = now[i] === '1' ? svgText('ON', YELLOW) : svgText('OFF', '#6f6d69'); });
      if (now.includes('1') && app.settings.rumble) input.rumble(40, 0.3);
    }
  };
  app.open(ov);
}
