// The Lab: a toy box that opens over the running game. Knobs change the game while you play; Dice scrambles them;
// Save keeps the mix as a prototype (game.json lab.prototypes, edited on the phone like any setting).
// The knobs live on shelves, one file each in lab/<shelf>.js, listed in game.json lab.shelves. See engine/features.md.
// Controller: D-pad down opens it. Touch: the LAB button. The game keeps running underneath.
feature('lab', ({ game, on }) => {
  const GAME = window.GAME, data = GAME.lab || (GAME.lab = {});
  const shelves = [], toys = [], byId = {}, values = {};
  const listeners = [];
  const folder = location.pathname.replace(/\/(index\.html)?$/, '').split('/').pop();

  // ---------------------------------------------------------------- toys and their values
  const decimals = (step) => (String(step).split('.')[1] || '').length;
  const isDefault = (t) => values[t.id] === t.value;
  function snap(t, v) {
    if (t.kind === 'onoff') return v ? 1 : 0;
    const n = Math.round((v - t.min) / t.step) * t.step + t.min;
    return +Math.min(t.max, Math.max(t.min, n)).toFixed(decimals(t.step) + 2);
  }
  function set(id, v, quiet) {
    const t = byId[id]; if (!t) return;
    const n = snap(t, v); if (n === values[id]) return;
    values[id] = n;
    try { if (t.apply) t.apply(n); } catch (e) { console.error('Lab toy ' + id, e); }
    if (!quiet) draw();
  }
  const get = (id) => (id in values ? values[id] : undefined);
  function setAll(vals) { for (const t of toys) set(t.id, vals && t.id in vals ? vals[t.id] : t.value, true); draw(); }
  const changed = () => { const o = {}; for (const t of toys) if (!isDefault(t)) o[t.id] = values[t.id]; return o; };
  const fmt = (t, v) => (t.fmt ? t.fmt(v) : t.kind === 'onoff' ? (v ? 'ON' : 'OFF') : v.toFixed(decimals(t.step)));

  // a shelf file calls LAB.shelf('time', 'Time', (game) => [ toy, toy, ... ]). A toy:
  //   { id, label, help, min, max, step, value (the normal value), kind: 'onoff' for a switch,
  //     apply(v) when it changes, frame(dt, v, now) every frame while it isn't normal,
  //     camera(camera, lookAt, v, now) after the game places the camera, while it isn't normal,
  //     dice: false to leave it out of Dice, fmt(v) to show the value its own way }
  window.LAB = {
    game, get, set,
    shelf(id, name, make) {
      let list = [];
      try { list = make(game) || []; } catch (e) { console.error('Lab shelf ' + id, e); }
      const sh = { id, name, toys: [] };
      for (const raw of list) {
        const t = { kind: 'num', step: 1, min: 0, max: 1, value: 0, ...raw, id: id + '.' + raw.id, shelf: name };
        if (t.kind === 'onoff') { t.min = 0; t.max = 1; t.step = 1; }
        sh.toys.push(t); toys.push(t); byId[t.id] = t; values[t.id] = t.value;
      }
      shelves.splice(shelves.length - 1, 0, sh);   // keep Saved last
      draw();
    }
  };
  shelves.push({ id: 'saved', name: 'Saved', toys: [] });

  on('frame', (dt) => {
    const now = performance.now() / 1000;
    pollPad(now);
    for (const t of toys) if (t.frame && !isDefault(t)) { try { t.frame(dt, values[t.id], now); } catch (e) { console.error('Lab toy ' + t.id, e); } }
  });
  on('camera', (cam, look) => {
    const now = performance.now() / 1000;
    for (const t of toys) if (t.camera && !isDefault(t)) { try { t.camera(cam, look, values[t.id], now); } catch (e) { console.error('Lab toy ' + t.id, e); } }
  });

  // ---------------------------------------------------------------- prototypes: kept as a phone edit of lab.prototypes
  const protos = () => (Array.isArray(data.prototypes) ? data.prototypes : []);
  function keepProtos(list) {
    data.prototypes = list;
    try {
      const k = 'ha.game.' + folder, e = JSON.parse(localStorage.getItem(k) || 'null') || {};
      e.overrides = e.overrides || {}; e.overrides['lab.prototypes'] = list; e.dirty = true; e.edited = Date.now();
      localStorage.setItem(k, JSON.stringify(e));
    } catch (err) { say('Could not save on this phone'); }
  }
  let playing = null;   // the prototype loaded last
  function load(p) { push(); setAll(p.values || {}); playing = p.name; say('Playing ' + p.name); }
  function save() {
    const vals = changed(), n = Object.keys(vals).length;
    if (!n) { say('Turn some knobs first'); return; }
    const name = prompt('Name this prototype', playing ? playing + ' 2' : 'Prototype ' + (protos().length + 1));
    if (name === null || !name.trim()) return;
    const labels = {}; for (const id in vals) labels[id] = byId[id].shelf + ' · ' + byId[id].label + ' ' + fmt(byId[id], vals[id]);
    keepProtos([...protos(), { id: 'p' + Date.now().toString(36), name: name.trim().slice(0, 40), note: '', made: Date.now(), values: vals, labels }]);
    playing = name.trim().slice(0, 40); say('Saved ' + playing);
  }

  // ---------------------------------------------------------------- Dice, Undo, Reset
  const undo = [];
  function push() { undo.push({ ...values }); if (undo.length > 30) undo.shift(); }
  function dice() {
    push(); let n = 0;
    for (const t of toys) {
      if (t.dice === false || (t.kind === 'onoff' && t.dice !== true)) continue;
      if (Math.random() < 0.45) { set(t.id, t.min + Math.random() * (t.max - t.min), true); n++; }   // the rest stay as they are
    }
    draw(); say('Rolled ' + n + ' knob' + (n === 1 ? '' : 's'));
  }
  function back() { const v = undo.pop(); if (!v) { say('Nothing to undo'); return; } setAll(v); say('Undone'); }
  function reset() { push(); setAll(null); playing = null; say('Back to normal'); }

  // ---------------------------------------------------------------- the panel
  const css = document.createElement('style');
  css.textContent = `
  .lab-btn{position:fixed;top:calc(52px + env(safe-area-inset-top,0px));right:max(16px, env(safe-area-inset-right,0px));font:inherit;font-size:10px;letter-spacing:.08em;color:#ffd36a;background:var(--panel);border:1px solid var(--line);padding:7px 10px;cursor:pointer;z-index:20;max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  body.duel .lab-btn{top:calc(12px + env(safe-area-inset-top,0px));right:auto;left:50%;transform:translateX(-50%)}
  .lab{position:fixed;z-index:30;top:calc(10px + env(safe-area-inset-top,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));right:max(10px, env(safe-area-inset-right,0px));width:min(270px,78vw);
    display:flex;flex-direction:column;background:#0a0b18;border:1px solid var(--line);font-size:10px;letter-spacing:.06em;color:var(--ink);touch-action:manipulation}
  .lab[hidden]{display:none}
  .lab button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;letter-spacing:inherit}
  .lab-top{display:flex;align-items:center;gap:6px;padding:6px 8px 5px;border-bottom:1px solid var(--line)}
  .lab-top .nm{flex:1;text-align:center;color:#ffd36a;font-size:11px;letter-spacing:.12em}
  .lab-top .nm small{display:block;color:var(--dim);font-size:8px;margin-top:2px}
  .lab-top button{width:26px;height:26px;border:1px solid var(--line)}
  .lab-rows{flex:1;overflow-y:auto;padding:2px 0}
  .lab-row{display:flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid transparent}
  .lab-row.on{border-color:#ffd36a;background:rgba(255,211,106,.07)}
  .lab-row .lb{flex:1;min-width:0}
  .lab-row .lb b{display:block;font-weight:400;color:var(--ink)}
  .lab-row.moved .lb b{color:#7dff6a}
  .lab-row .lb i{display:block;font-style:normal;color:var(--dim);font-size:8px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lab-row .bar{display:block;height:3px;background:rgba(120,128,220,.2);margin-top:4px;position:relative}
  .lab-row .bar span{position:absolute;left:0;top:0;bottom:0;background:#ffd36a}
  .lab-row .bar em{position:absolute;top:-2px;width:1px;height:7px;background:var(--ink)}
  .lab-row .st{width:24px;height:24px;border:1px solid var(--line);flex:none}
  .lab-row .vl{min-width:42px;text-align:center;color:#ffd36a}
  .lab-row .sw{min-width:90px;height:24px;border:1px solid var(--line);color:#ffd36a}
  .lab-empty{padding:12px 10px;color:var(--dim);line-height:1.6}
  .lab-act{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:6px 8px;border-top:1px solid var(--line)}
  .lab-act button{height:26px;border:1px solid var(--line);color:#ffd36a}
  .lab-say{padding:0 8px 6px;min-height:12px;color:#7dff6a;font-size:8px}
  .lab-hint{padding:0 8px 7px;color:var(--dim);font-size:8px;line-height:1.5}
  body:not(.pad) .lab-hint{display:none}`;
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.className = 'lab-btn'; btn.type = 'button'; btn.textContent = 'LAB';
  const panel = document.createElement('div');
  panel.className = 'lab'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Lab');
  document.body.append(btn, panel);
  btn.addEventListener('click', () => toggle());
  ['pointerdown', 'pointermove', 'pointerup'].forEach(ev => panel.addEventListener(ev, e => e.stopPropagation()));

  let open = false, shelfAt = 0, sel = 0, sayText = '', sayT = 0, unblockWhenUp = false;
  function toggle(want) {
    open = want === undefined ? !open : want; panel.hidden = !open;
    if (open) { game.blockPad = true; unblockWhenUp = false; draw(); } else unblockWhenUp = true;   // the game gets the controller back once you let go
  }
  function say(t) { sayText = t; sayT = performance.now(); draw(); }
  const shelf = () => shelves[Math.min(shelfAt, shelves.length - 1)];
  const rowsOf = (sh) => (sh.id === 'saved' ? protos() : sh.toys);
  function turn(t, dir) { set(t.id, t.kind === 'onoff' ? (values[t.id] ? 0 : 1) : values[t.id] + dir * t.step); }

  function draw() {
    btn.textContent = playing ? 'LAB · ' + playing : 'LAB';
    if (!open) return;
    const sh = shelf(), list = rowsOf(sh); sel = Math.min(sel, Math.max(0, list.length - 1));
    const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let rows;
    if (sh.id === 'saved') {
      rows = list.length ? list.map((p, i) => `<div class="lab-row${i === sel ? ' on' : ''}" data-i="${i}"><button class="lb" data-load="${i}" style="text-align:left"><b>${esc(p.name)}</b><i>${esc(p.note || Object.values(p.labels || {}).join(' · ') || '')}</i></button><button class="sw" data-load="${i}">PLAY</button></div>`).join('')
        : '<div class="lab-empty">Nothing saved yet. Turn some knobs, then SAVE. Saved prototypes also show in the Studio, under Lab.</div>';
    } else {
      rows = list.map((t, i) => {
        const v = values[t.id], moved = v !== t.value;
        const ctl = t.kind === 'onoff' ? `<button class="sw" data-flip="${t.id}">${fmt(t, v)}</button>`
          : `<button class="st" data-dec="${t.id}" aria-label="Less ${esc(t.label)}">-</button><span class="vl">${fmt(t, v)}</span><button class="st" data-inc="${t.id}" aria-label="More ${esc(t.label)}">+</button>`;
        const k = (x) => ((x - t.min) / (t.max - t.min) * 100).toFixed(1) + '%';
        const bar = t.kind === 'onoff' ? '' : `<span class="bar"><span style="width:${k(v)}"></span><em style="left:${k(t.value)}"></em></span>`;
        return `<div class="lab-row${i === sel ? ' on' : ''}${moved ? ' moved' : ''}" data-i="${i}"><span class="lb"><b>${esc(t.label)}</b>${t.help ? `<i>${esc(t.help)}</i>` : ''}${bar}</span>${ctl}</div>`;
      }).join('');
    }
    const fresh = performance.now() - sayT < 2500 ? sayText : (playing ? 'Playing ' + playing : '');
    panel.innerHTML = `<div class="lab-top"><button data-sh="-1" aria-label="Previous shelf">&lt;</button><span class="nm">${esc(sh.name.toUpperCase())}<small>LAB · ${shelfAt + 1}/${shelves.length}</small></span><button data-sh="1" aria-label="Next shelf">&gt;</button><button data-close aria-label="Close the Lab">X</button></div>
      <div class="lab-rows">${rows}</div>
      <div class="lab-say">${esc(fresh)}</div>
      <div class="lab-act"><button data-do="dice">DICE</button><button data-do="back">UNDO</button><button data-do="reset">RESET</button><button data-do="save">SAVE</button></div>
      <div class="lab-hint">D-pad pick and turn · L1 R1 shelf · Cross switch / play · Triangle dice · Square save · Select undo · Circle close</div>`;
    const on = panel.querySelector('.lab-row.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button,.lab-row'); if (!b) return;
    const d = b.dataset, r = e.target.closest('.lab-row');
    if (r) sel = +r.dataset.i;
    if (d.sh) { shelfAt = (shelfAt + +d.sh + shelves.length) % shelves.length; sel = 0; }
    else if ('close' in d) { toggle(false); return; }
    else if (d.dec) turn(byId[d.dec], -1);
    else if (d.inc) turn(byId[d.inc], 1);
    else if (d.flip) turn(byId[d.flip], 1);
    else if (d.load !== undefined) load(protos()[+d.load]);
    else if (d.do) ({ dice, back, reset, save })[d.do]();
    draw();
  });

  // ---------------------------------------------------------------- controller
  const prev = [], heldT = [];
  let stickT = 0;
  addEventListener('keydown', (e) => { if (e.code === 'KeyL' && !e.repeat) toggle(); });   // a keyboard on the desktop
  function pollPad(now) {
    const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(g => g && g.connected);
    const gp = game.pad || pads[0];
    if (!gp) { if (unblockWhenUp) { game.blockPad = false; unblockWhenUp = false; } return; }
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const down = (i) => b(i) && !prev[i];
    const rep = (i) => { if (!b(i)) { heldT[i] = 0; return false; } if (!prev[i]) { heldT[i] = now + 0.35; return true; } if (now >= heldT[i]) { heldT[i] = now + 0.08; return true; } return false; };
    if (!open) {
      if (unblockWhenUp && ![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].some(b)) { game.blockPad = false; unblockWhenUp = false; }
      if (down(13)) toggle(true);
    } else {
      const sh = shelf(), list = rowsOf(sh), t = sh.id === 'saved' ? null : list[sel];
      if (down(1)) toggle(false);
      else {
        if (rep(12) && list.length) { sel = (sel + list.length - 1) % list.length; draw(); }
        if (rep(13) && list.length) { sel = (sel + 1) % list.length; draw(); }
        if (t && t.kind !== 'onoff') { if (rep(14)) turn(t, -1); if (rep(15)) turn(t, 1); }
        // the left stick turns a knob too, faster the further you push
        const x = gp.axes[0] || 0;
        if (t && t.kind !== 'onoff' && Math.abs(x) > 0.4) { if (now >= stickT) { turn(t, Math.sign(x)); stickT = now + 0.16 - Math.min(0.13, (Math.abs(x) - 0.4) * 0.22); } } else stickT = 0;
        if (down(0)) { if (sh.id === 'saved') { if (list[sel]) load(list[sel]); } else if (t) { if (t.kind === 'onoff') turn(t, 1); } }
        if (down(4)) { shelfAt = (shelfAt + shelves.length - 1) % shelves.length; sel = 0; draw(); }
        if (down(5)) { shelfAt = (shelfAt + 1) % shelves.length; sel = 0; draw(); }
        if (down(3)) dice();
        if (down(2)) save();
        if (down(8)) back();
      }
    }
    for (let i = 0; i < 17; i++) prev[i] = b(i);
  }

  // ---------------------------------------------------------------- the shelves, then a prototype the Studio asked to play
  const names = Array.isArray(data.shelves) ? data.shelves : [];
  let left = names.length;
  const ready = () => {
    let want = null; try { want = sessionStorage.getItem('ha.lab.play'); sessionStorage.removeItem('ha.lab.play'); } catch (e) {}
    const p = want && protos().find(x => x.id === want);
    if (p) { setAll(p.values || {}); playing = p.name; draw(); }
  };
  if (!left) ready();
  for (const n of names) {
    const s = document.createElement('script');
    s.src = 'lab/' + n + '.js'; s.async = false;
    s.onload = s.onerror = () => { if (--left === 0) ready(); };
    document.body.appendChild(s);
  }
});
