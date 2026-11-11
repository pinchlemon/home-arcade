// The Lab: a toy box that opens over the game (and pauses it). Knobs change the game; Dice scrambles some of them;
// presets are whole mixes to flip between while playing; Save keeps a mix as a prototype (game.json lab.prototypes).
// The knobs are made by shelf files, one each in lab/<shelf>.js, listed in game.json lab.shelves. The panel then
// shows them in the groups of LAYOUT below (any knob not in LAYOUT lands on a More shelf). See engine/features.md.
// Controller: D-pad down opens it. Touch: the LAB button.
feature('lab', ({ game, on }) => {
  const GAME = window.GAME, data = GAME.lab || (GAME.lab = {});
  const toys = [], byId = {}, values = {};
  const folder = location.pathname.replace(/\/(index\.html)?$/, '').split('/').pop();

  // ---------------------------------------------------------------- how the panel groups the knobs
  // [shelf id, name, [[heading, 'toy ids'], ...]]. Knob ids never change (saved mixes use them), so moving a knob
  // to another shelf is only a change here.
  const LAYOUT = [
    ['game', 'Game', [['Time', 'time.speed time.wobble time.freeze'], ['Moving', 'world.gravity world.speed world.jump world.endless']]],
    ['party', 'Party', [['Team', 'party.wizards party.team party.orders'], ['Passing', 'party.aim party.passSpeed party.magnet party.autoCatch'], ['Control', 'party.switch party.pick'],
      ['Teammate brains', 'party.spacing party.keepAway party.shoot party.shotRange party.accuracy party.think party.toYou']]],
    ['wizards', 'Wizards', [['Size', 'bodies.wizard bodies.buddy'], ['Health', 'health.on health.you health.buddy health.knock world.safe'],
      ...['Blue', 'Red', 'Green', 'Purple', 'Gold'].map(n => [n + ' wizard', ['speed', 'jump', 'catch', 'throw', 'strength'].map(s => 'stats.' + n.toLowerCase() + '.' + s).join(' ')])]],
    ['solids', 'Solids', [['Flight', 'bodies.solid world.solidGravity world.bounce'], ['Homing', 'throws.homing throws.cone'],
      ['Extra solids', 'spawn.count spawn.size spawn.bounce spawn.kick spawn.pickup spawn.power spawn.damage']]],
    ['demon', 'Demon', [['How it acts', 'bodies.demon demon.aggression demon.health'], ['Hurting you', 'health.contact health.contactDmg'],
      ['When hit', 'demon.flash demon.flashLen demon.flashRate'], ['Spit', 'attacks.attack attacks.spitCount attacks.spitSpread attacks.spitSize attacks.puddles'],
      ['Fire breath', 'attacks.breathLen attacks.breathReach attacks.breathWidth attacks.breathSweep attacks.breathCol'],
      ['When beaten', 'demon.absorb demon.absorbLen demon.dissolve demon.dissolveLen demon.dissolveCol']]],
    ['rules', 'Rules', [1, 2, 3, 4].map(n => ['Rule ' + n, `rules.when${n} rules.then${n} rules.for${n}`])],
    ['colours', 'Colours', [['Wizards', 'colours.youCloak colours.youTrim colours.buddyCloak colours.buddyTrim colours.greenCloak colours.greenTrim colours.purpleCloak colours.purpleTrim colours.goldCloak colours.goldTrim colours.trimH'],
      ['Solids', 'colours.solid0 colours.solid1 colours.solid2 colours.solid3 colours.solid4'],
      ['Centipede', 'colours.shell colours.rim colours.bone colours.legs colours.spots colours.eyes'],
      ['Stars', 'stars.bright stars.amount stars.size stars.colours stars.twinkle']]],
    ['camera', 'Camera', [['Camera', 'camera.stick camera.stickSpeed camera.orbit camera.zoom camera.fov camera.tilt camera.spin'], ['On screen', 'hud.text hud.bars hud.badge']]],
    ['distort', 'Distort', [['Bend', 'look.warp look.warpSpeed look.swirl look.bulge look.mirror look.kaleido look.pixelate'],
      ['Echo', 'look.trails echo.zoom echo.spin echo.hue look.split echo.glitch echo.pulse']]],
    ['grade', 'Colour grade', [['Colour', 'colour.levels colour.dither colour.ditherSize colour.tint colour.hue colour.invert'],
      ['Tone', 'tone.palette tone.sat tone.con tone.bri tone.glow tone.outline']]],
    ['film', 'Film', [['Screen', 'colour.scan screen.crt screen.vignette screen.grain screen.halftone screen.dotSize'],
      ['Glow', 'glow.bloom glow.radius glow.threshold glow.tilt glow.focus glow.glitch'],
      ['Print', 'print.techni print.bleach print.dots print.halftone print.radius print.shape']]],
    ['moments', 'Moments', [['Impact frames', 'moments.impact moments.impactLook moments.impactLen moments.impactMin'], ['Transitions', 'moments.transition moments.transLen moments.onDown']]],
    ['ps1', 'PS1', [['Models', 'ps1.snap ps1.wobble ps1.lowpoly ps1.gouraud'], ['Picture', 'ps1.depth ps1.fog']]],
    ['ps2', 'PS2', [['Console', 'ps2.res ps2.c16 ps2.bloom ps2.wash ps2.rays ps2.blur'], ['TV', 'ps2.inter ps2.comp']]]
  ];

  // ---------------------------------------------------------------- toys and their values
  const decimals = (step) => (String(step).split('.')[1] || '').length;
  // boosts: a rule's short change on top of a knob (LAB.boost). The panel and saved mixes show the knob itself.
  const boosts = {};
  const eff = (id) => (boosts[id] ? boosts[id].v : values[id]);
  const isDefault = (t) => eff(t.id) === t.value;
  const run = (t, v) => { try { if (t.apply) t.apply(v); } catch (e) { console.error('Lab toy ' + t.id, e); } };
  function snap(t, v) {
    if (t.kind === 'onoff') return v ? 1 : 0;
    if (v === t.value) return v;   // the normal value always stays itself, even off the step grid
    const n = Math.round((v - t.min) / t.step) * t.step + t.min;
    return +Math.min(t.max, Math.max(t.min, n)).toFixed(decimals(t.step) + 2);
  }
  // toys marked setting (Dice, pausing) belong to the Lab, not to a mix: loading, saving and Reset leave them alone,
  // and they are remembered on this phone
  function settings() { try { return JSON.parse(localStorage.getItem('ha.lab.settings') || '{}') || {}; } catch (e) { return {}; } }
  function set(id, v, quiet) {
    const t = byId[id]; if (!t) return;
    const n = snap(t, v); if (n === values[id]) return;
    values[id] = n;
    if (t.setting) try { localStorage.setItem('ha.lab.settings', JSON.stringify({ ...settings(), [id]: n })); } catch (e) {}
    if (!boosts[id]) run(t, n);
    if (!quiet) draw();
  }
  const get = (id) => (id in values ? eff(id) : undefined);
  function boost(id, v, seconds) {
    const t = byId[id]; if (!t) return;
    const n = snap(t, v), had = boosts[id];
    boosts[id] = { v: n, until: performance.now() / 1000 + seconds };
    if (!had || had.v !== n) run(t, n);
  }
  function unboost(id) { if (!boosts[id]) return; delete boosts[id]; run(byId[id], values[id]); }
  function setAll(vals) {
    for (const id in boosts) unboost(id); for (const t of toys) if (!t.setting) set(t.id, vals && t.id in vals ? vals[t.id] : t.value, true); draw(); }
  const changed = () => { const o = {}; for (const t of toys) if (!t.setting && !isDefault(t)) o[t.id] = values[t.id]; return o; };
  const fmt = (t, v) => (t.fmt ? t.fmt(v) : t.kind === 'onoff' ? (v ? 'ON' : 'OFF') : v.toFixed(decimals(t.step)));
  const labelsOf = (vals) => { const l = {}; for (const id in vals) l[id] = byId[id].shelf + ' · ' + byId[id].label + ' ' + fmt(byId[id], vals[id]); return l; };

  // a shelf file calls LAB.shelf('time', 'Time', (game) => [ toy, toy, ... ]). A toy:
  //   { id, label, help, min, max, step, value (the normal value), kind: 'onoff' for a switch,
  //     apply(v) when it changes, frame(dt, v, now) every frame while it isn't normal,
  //     camera(camera, lookAt, v, now) after the game places the camera, while it isn't normal,
  //     dice: false to leave it out of Dice, fmt(v) to show the value its own way, help(v) for help that follows the value }
  const made = [];   // the shelves the files made, in order (the panel regroups them)
  window.LAB = {
    game, get, set, boost, base: (id) => values[id],   // base: the knob itself, without a rule's boost
    shelf(id, name, make) {
      let list = [];
      try { list = make(game) || []; } catch (e) { console.error('Lab shelf ' + id, e); }
      const sh = { id, name, toys: [] };
      for (const raw of list) {
        const t = { kind: 'num', step: 1, min: 0, max: 1, value: 0, ...raw, id: raw.id.includes('.') ? raw.id : id + '.' + raw.id, shelf: name };   // an id with a dot keeps its old name after moving shelf
        if (t.kind === 'onoff') { t.min = 0; t.max = 1; t.step = 1; }
        sh.toys.push(t); toys.push(t); byId[t.id] = t; values[t.id] = t.value;
        if (t.setting) { const v = settings()[t.id]; if (typeof v === 'number') values[t.id] = snap(t, v); }
      }
      made.push(sh);
    }
  };

  on('frame', (dt) => {
    const now = performance.now() / 1000;
    pollPad(now);
    for (const id in boosts) if (now >= boosts[id].until) unboost(id);
    for (const t of toys) if (t.frame && !isDefault(t)) { try { t.frame(dt, eff(t.id), now); } catch (e) { console.error('Lab toy ' + t.id, e); } }
  });
  on('camera', (cam, look) => {
    const now = performance.now() / 1000;
    for (const t of toys) if (t.camera && !isDefault(t)) { try { t.camera(cam, look, eff(t.id), now); } catch (e) { console.error('Lab toy ' + t.id, e); } }
  });

  // ---------------------------------------------------------------- pausing: the game's clock reads 0 while the Lab is open
  // (MOD.time keeps what the knobs set; only what the game reads changes, and only while paused)
  let realTime = game.MOD.time, paused = false, open = false;
  Object.defineProperty(game.MOD, 'time', { get: () => (paused ? 0 : realTime), set: (v) => { realTime = v; }, enumerable: true, configurable: true });
  function syncPause() { paused = open && (values['lab.pause'] ?? 1) === 1; }

  // ---------------------------------------------------------------- saved things, kept as phone edits of game.json lab.*
  function keep(path, list) {
    try {
      const k = 'ha.game.' + folder, e = JSON.parse(localStorage.getItem(k) || 'null') || {};
      e.overrides = e.overrides || {}; e.overrides[path] = list; e.dirty = true; e.edited = Date.now();
      localStorage.setItem(k, JSON.stringify(e)); return true;
    } catch (err) { say('Could not save on this phone'); return false; }
  }
  // prototypes: they show in the Studio's Lab tab
  const protos = () => (Array.isArray(data.prototypes) ? data.prototypes : []);
  function keepProtos(list) { data.prototypes = list; keep('lab.prototypes', list); }
  // ideas: jotted down here, they show in the Studio's Lab tab (ones Claude has built are listed in lab.done)
  function idea() {
    const t = prompt('Your idea:', ''); if (!t || !t.trim()) return;
    const done = new Set(data.done || []), list = (Array.isArray(data.ideas) ? data.ideas : []).filter(x => !done.has(x.id));
    list.unshift({ id: 'i' + Date.now().toString(36), text: t.trim().slice(0, 600), made: Date.now() });
    data.ideas = list; if (keep('lab.ideas', list)) say('Idea kept: it is in the Studio, under Lab');
  }
  const ideasNow = () => { const done = new Set(data.done || []); return (Array.isArray(data.ideas) ? data.ideas : []).filter(x => !done.has(x.id)); };
  // the start mix: knobs the game starts with (and Reset goes back to)
  const startVals = () => (data.start && data.start.values) || null;
  function setStart() {
    const vals = changed();
    data.start = Object.keys(vals).length ? { values: vals, labels: labelsOf(vals), made: Date.now() } : {};
    if (keep('lab.start', data.start)) say(Object.keys(vals).length ? 'The game now starts like this' : 'The game now starts plain');
  }
  function clearStart() { data.start = {}; if (keep('lab.start', {})) say('The game now starts plain'); }
  let playing = null;   // the prototype or preset loaded last
  function load(p) { push(); setAll(p.values || {}); playing = p.name; presetAt = -1; say('Playing ' + p.name); }
  function save() {
    const vals = changed();
    if (!Object.keys(vals).length) { say('Turn some knobs first'); return; }
    const name = prompt('Name this prototype', playing ? playing + ' 2' : 'Prototype ' + (protos().length + 1));
    if (name === null || !name.trim()) return;
    keepProtos([...protos(), { id: 'p' + Date.now().toString(36), name: name.trim().slice(0, 40), note: '', made: Date.now(), values: vals, labels: labelsOf(vals) }]);
    playing = name.trim().slice(0, 40); say('Saved ' + playing);
  }

  // presets: whole mixes to flip between while playing. Each stands alone: loading one puts every other knob back
  // to normal (not to the start mix). They are not prototypes and don't show in the Studio.
  const presets = () => (Array.isArray(data.presets) ? data.presets : []);
  function keepPresets(list) { data.presets = list; keep('lab.presets', list); }
  let presetAt = -1;   // the preset loaded last
  function newPreset() {
    const vals = changed();
    if (!Object.keys(vals).length) { say('Turn some knobs first'); return; }
    const name = prompt('Name this preset', 'Preset ' + (presets().length + 1));
    if (name === null || !name.trim()) return;
    const p = { id: 's' + Date.now().toString(36), name: name.trim().slice(0, 40), values: vals, labels: labelsOf(vals), made: Date.now() };
    keepPresets([...presets(), p]); presetAt = presets().length - 1; playing = p.name; say('Preset ' + p.name + ' kept');
  }
  function updatePreset(i) {
    const p = presets()[i], vals = changed(); if (!p) return;
    if (!confirm('Replace ' + p.name + ' with the knobs as they are now?')) return;
    const list = presets().slice(); list[i] = { ...p, values: vals, labels: labelsOf(vals), made: Date.now() };
    keepPresets(list); presetAt = i; playing = p.name; say(p.name + ' updated');
  }
  function dropPreset(i) {
    const p = presets()[i]; if (!p || !confirm('Delete the preset ' + p.name + '?')) return;
    keepPresets(presets().filter((x, k) => k !== i)); if (presetAt === i) presetAt = -1; else if (presetAt > i) presetAt--;
    say(p.name + ' deleted');
  }
  function loadPreset(i) {
    const p = presets()[i]; if (!p) return;
    push(); setAll(p.values || {}); presetAt = i; playing = p.name; say('Preset ' + p.name); toast(p.name, i);
  }
  // D-pad left and right while playing (the game doesn't use them), or [ and ] on a keyboard
  function stepPreset(dir) {
    const n = presets().length; if (!n) { toast('No presets yet', -1); return; }
    loadPreset(presetAt < 0 ? (dir > 0 ? 0 : n - 1) : (presetAt + dir + n) % n);
  }

  // pinned knobs: the ones you reach for, on the first shelf (kept on this phone)
  const pins = () => { try { const l = JSON.parse(localStorage.getItem('ha.lab.pins') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
  function pin(t) {
    if (!t || t.setting) return;
    const l = pins(), i = l.indexOf(t.id);
    if (i >= 0) l.splice(i, 1); else l.push(t.id);
    try { localStorage.setItem('ha.lab.pins', JSON.stringify(l)); } catch (e) {}
    say(i >= 0 ? t.label + ' unpinned' : t.label + ' pinned');
  }

  // ---------------------------------------------------------------- Dice, Undo, Reset, back to normal
  const DICE_ALL = 11;
  const undo = [];
  function push() { undo.push({ ...values }); if (undo.length > 30) undo.shift(); }
  function dice() {
    push(); let n = 0;
    const sh = shelf(), only = (values['dice.from'] ?? 0) === 1 && sh.kind === 'toys';
    const pool = toys.filter(t => !t.setting && t.dice !== false && !(t.kind === 'onoff' && t.dice !== true) && (!only || sh.toys.includes(t)));
    const want = values['dice.count'] ?? 3;
    if (want >= DICE_ALL) {   // the old way: each knob has a fair chance
      for (const t of pool) if (Math.random() < 0.45) { set(t.id, t.min + Math.random() * (t.max - t.min), true); n++; }
    } else {
      for (let k = 0; k < want && pool.length; k++) {
        const t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], was = values[t.id];
        for (let tries = 0; tries < 6 && values[t.id] === was; tries++) set(t.id, t.min + Math.random() * (t.max - t.min), true);   // make it really move
        n++;
      }
    }
    draw(); say('Rolled ' + n + ' knob' + (n === 1 ? '' : 's') + (only ? ' on ' + sh.name : ''));
  }
  function back() { const v = undo.pop(); if (!v) { say('Nothing to undo'); return; } setAll(v); say('Undone'); }
  function reset() { push(); const s = startVals(); setAll(s); playing = null; presetAt = -1; say(s ? 'Back to your start mix' : 'Back to normal'); }
  function normal(t) { if (!t || values[t.id] === t.value) return; push(); set(t.id, t.value); say(t.label + ' back to normal'); }

  // ---------------------------------------------------------------- the shelves the panel shows
  // kind: toys (knobs, maybe with headings), pinned, now (knobs not at normal), presets, saved, ideas
  let shelves = [];
  function build() {
    const placed = new Set(), out = [{ id: 'pinned', name: 'Pinned', kind: 'pinned' }, { id: 'presets', name: 'Presets', kind: 'presets' }, { id: 'now', name: 'On now', kind: 'now' }];
    for (const [id, name, groups] of LAYOUT) {
      const sh = { id, name, kind: 'toys', toys: [], heads: {} };
      for (const [head, ids] of groups) {
        const list = ids.split(' ').map(x => byId[x]).filter(t => t && !placed.has(t.id));   // a setting can sit on a shelf too
        if (!list.length) continue;
        sh.heads[sh.toys.length] = head;
        for (const t of list) { placed.add(t.id); t.shelf = name; sh.toys.push(t); }
      }
      if (sh.toys.length) out.push(sh);
    }
    // knobs LAYOUT doesn't place (from a new shelf file, say), under the name of the shelf that made them
    const more = { id: 'more', name: 'More', kind: 'toys', toys: [], heads: {} };
    for (const m of made) {
      const list = m.toys.filter(t => !t.setting && !placed.has(t.id));
      if (!list.length) continue;
      more.heads[more.toys.length] = m.name; more.toys.push(...list);
    }
    if (more.toys.length) out.push(more);
    out.push({ id: 'saved', name: 'Saved', kind: 'saved' }, { id: 'ideas', name: 'Ideas', kind: 'ideas' });
    const lab = { id: 'lab', name: 'Lab settings', kind: 'toys', toys: toys.filter(t => t.setting && !placed.has(t.id)), heads: { 0: 'Dice', 2: 'Lab', 3: 'Speed' } };
    if (lab.toys.length) out.push(lab);
    shelves = out;
  }
  const shelf = () => shelves[Math.min(shelfAt, shelves.length - 1)] || { kind: 'none', name: '' };
  function rowsOf(sh) {
    if (sh.kind === 'toys') return sh.toys;
    if (sh.kind === 'pinned') return pins().map(id => byId[id]).filter(Boolean);
    if (sh.kind === 'now') return shelves.flatMap(s => (s.kind === 'toys' ? s.toys : [])).filter(t => !t.setting && values[t.id] !== t.value);
    if (sh.kind === 'presets') return [{ add: true }, ...presets()];
    if (sh.kind === 'saved') return [{ start: true }, { add: true }, ...protos()];
    if (sh.kind === 'ideas') return [{ add: true }, ...ideasNow()];
    return [];
  }
  const knobShelf = (sh) => sh.kind === 'toys' || sh.kind === 'pinned' || sh.kind === 'now';
  function turn(t, dir, big) {
    if (t.kind === 'onoff') { set(t.id, values[t.id] ? 0 : 1); return; }
    if (big === 'end') { set(t.id, dir < 0 ? t.min : t.max); return; }
    set(t.id, values[t.id] + dir * t.step * (big ? 5 : 1));
  }

  // ---------------------------------------------------------------- the panel
  // the look follows the app (app/app.css): dark plates, black wells and readouts, Saira, a ring for what's picked
  if (!document.querySelector('link[href*="family=Saira"]')) {
    const f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Saira:wght@400;600;700&display=swap'; document.head.appendChild(f);
  }
  const css = document.createElement('style');
  css.textContent = `
  .lab-btn{position:fixed;top:calc(52px + env(safe-area-inset-top,0px));right:max(16px, env(safe-area-inset-right,0px));font:inherit;font-size:10px;letter-spacing:.08em;color:#ffd36a;background:var(--panel);border:1px solid var(--line);padding:7px 10px;cursor:pointer;z-index:20;max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  body.duel .lab-btn{top:calc(12px + env(safe-area-inset-top,0px));right:auto;left:50%;transform:translateX(-50%)}
  .lab{--acc:#ffd23f;--t:#e4e2dc;--mu:#b8b6b0;--di:#8f8d88;--edge:rgba(255,255,255,.10);
    position:fixed;z-index:30;top:calc(8px + env(safe-area-inset-top,0px));bottom:calc(8px + env(safe-area-inset-bottom,0px));right:max(8px, env(safe-area-inset-right,0px));width:min(330px,82vw);
    display:flex;flex-direction:column;border-radius:10px;overflow:hidden;color:var(--t);font-family:Saira,system-ui,sans-serif;font-size:12px;letter-spacing:0;touch-action:manipulation;
    background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.015) 40%,rgba(0,0,0,.15)),#0f0f12;border:1px solid var(--edge);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 8px 24px rgba(0,0,0,.55)}
  .lab[hidden]{display:none}
  .lab button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;letter-spacing:inherit;-webkit-tap-highlight-color:transparent}
  .lab svg{display:block;flex:none}
  .lab .k{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:30px;min-width:30px;padding:0 8px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;flex:none;
    background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.02)),#16161a;border:1px solid var(--edge);box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
  .lab .k:active,.lab .k.lit{box-shadow:inset 0 0 0 1.5px var(--acc)}
  .lab .k.ic{padding:0;width:30px}
  .lab .k.acc{color:var(--acc)}
  .lab-top{display:flex;align-items:center;gap:5px;padding:8px 8px 7px;border-bottom:1px solid var(--edge)}
  .lab-top .nm{flex:1;min-width:0;height:30px;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;box-shadow:inset 0 4px 6px #000;border:1px solid;border-color:rgba(255,255,255,.3) rgba(255,255,255,.08) rgba(0,0,0,.6) rgba(255,255,255,.18)}
  .lab-top .nm b{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--acc);line-height:1.1;white-space:nowrap}
  .lab-top .nm small{font-size:8px;letter-spacing:.14em;color:var(--di);line-height:1.2;white-space:nowrap}
  .lab-rows{flex:1;overflow-y:auto;padding:4px 6px}
  .lab-head{padding:9px 6px 3px;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--di)}
  .lab-row{position:relative;display:flex;align-items:center;gap:5px;min-height:38px;padding:3px 6px;border-radius:6px}
  .lab-row.on{background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1.5px var(--acc)}
  .lab-row .lb{flex:1;min-width:0;text-align:left}
  .lab-row .lb b{display:block;font-size:12px;font-weight:600;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lab-row.moved .lb b{color:var(--acc)}
  .lab-row{flex-wrap:wrap}
  .lab-row i.help{flex:1 0 100%;font-style:normal;color:var(--mu);font-size:10px;line-height:1.35;padding:0 0 3px}
  .lab-row .lb i{display:block;font-style:normal;color:var(--mu);font-size:10px;line-height:1.35;margin-top:1px}
  .lab-row .lb i.clip{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .lab-row .bar{display:block;height:3px;border-radius:2px;background:rgba(255,255,255,.1);margin-top:4px;position:relative}
  .lab-row .bar span{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:var(--acc)}
  .lab-row .bar em{position:absolute;top:-2px;width:1px;height:7px;background:var(--t)}
  .lab-row .pin{position:absolute;left:1px;top:50%;margin-top:-5px;width:2px;height:10px;background:var(--acc);border-radius:1px}
  .lab .vl{display:inline-flex;align-items:center;justify-content:center;flex:none;height:30px;width:72px;padding:0 4px;border-radius:5px;background:#000;box-shadow:inset 0 4px 6px #000;border:1px solid;border-color:rgba(255,255,255,.3) rgba(255,255,255,.08) rgba(0,0,0,.6) rgba(255,255,255,.18);
    font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--acc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lab .sw{width:136px}
  .lab-empty{padding:14px 8px;color:var(--mu);line-height:1.5;font-size:11px}
  .lab-act{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:7px 8px;border-top:1px solid var(--edge)}
  .lab-act .k{height:32px;padding:0 3px;gap:4px;font-size:9px;letter-spacing:.06em}
  .lab-say{padding:0 10px 5px;min-height:15px;color:#7dff6a;font-size:10px;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lab-hint{padding:0 10px 8px;color:var(--di);font-size:9px;line-height:1.45}
  body:not(.pad) .lab-hint{display:none}
  .lab-grid{position:absolute;top:46px;left:0;right:0;bottom:0;z-index:2;background:#0b0b0e;padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;align-content:start;overflow-y:auto}
  .lab-grid .k{height:34px;justify-content:flex-start;padding:0 10px;font-size:10px}
  .lab-grid .k.here{color:var(--acc)}
  .lab-grid .k small{margin-left:auto;color:var(--acc);font-weight:700}
  .lab.mini{top:auto;left:50%;right:auto;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom,0px));width:min(560px,94vw)}
  .lab-mini{display:flex;align-items:center;gap:5px;padding:7px 8px}
  .lab-mini .lb{flex:1;min-width:0;padding-left:4px}
  .lab-mini .lb small{display:block;font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--di);white-space:nowrap}
  .lab-mini .lb b{display:block;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lab-mini.moved .lb b{color:var(--acc)}
  .lab-toast{position:fixed;z-index:25;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);border-radius:8px;font-family:Saira,system-ui,sans-serif;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;white-space:nowrap;pointer-events:none;color:#ffd23f;
    background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.015) 40%,rgba(0,0,0,.15)),#0f0f12;border:1px solid rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 8px 24px rgba(0,0,0,.55)}
  .lab-toast[hidden]{display:none}`;
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.className = 'lab-btn'; btn.type = 'button'; btn.textContent = 'LAB';
  const panel = document.createElement('div');
  panel.className = 'lab'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Lab');
  const tip = document.createElement('div'); tip.className = 'lab-toast'; tip.hidden = true; let tipT = 0;
  function toast(text, i) {
    tip.textContent = i >= 0 ? text + '  ·  ' + (i + 1) + '/' + presets().length : text; tip.hidden = false;
    clearTimeout(tipT); tipT = setTimeout(() => { tip.hidden = true; }, 1400);
  }
  document.body.append(btn, panel, tip);
  btn.addEventListener('click', () => toggle());
  ['pointerdown', 'pointermove', 'pointerup'].forEach(ev => panel.addEventListener(ev, e => e.stopPropagation()));

  // the app's pixel icons (app/js/pixel.js), with words until they load
  let PX = null;
  import(new URL('../app/js/pixel.js', location.href).href).then(m => { PX = m; draw(); }).catch(() => {});
  const OWN = {
    pin: ['0011100', '0111110', '0011100', '0011100', '1111111', '0001000', '0001000'],
    dice: ['1111111', '1000001', '1010101', '1000001', '1010101', '1000001', '1111111'],
    small: ['0000000', '0000000', '0000000', '0000000', '1111111', '1000001', '1111111'],
    big: ['1111111', '1000001', '1000001', '1000001', '1000001', '1000001', '1111111'],
    x: ['1000001', '0100010', '0010100', '0001000', '0010100', '0100010', '1000001']
  };
  const ic = (name, color = '#e4e2dc', word = '') => {
    if (!PX) return word;
    if (OWN[name]) return PX.svgRows(OWN[name], color);
    return PX.G && PX.G[name] ? PX.icon(name, color) : word;
  };

  let mini = false, shelfAt = 3, sel = 0, sayText = '', sayT = 0, unblockWhenUp = false, grid = false, gridAt = 0;
  function toggle(want) {
    open = want === undefined ? !open : want; panel.hidden = !open; grid = false;
    if (open) { game.blockPad = true; unblockWhenUp = false; draw(); } else unblockWhenUp = true;   // the game gets the controller back once you let go
    syncPause();
  }
  function say(t) { sayText = t; sayT = performance.now(); draw(); }
  function goShelf(i) { shelfAt = (i + shelves.length) % shelves.length; sel = 0; grid = false; draw(); }

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const control = (t) => (t.kind === 'onoff' ? `<button class="k sw acc" data-flip="${t.id}">${esc(fmt(t, values[t.id]))}</button>`
    : `<button class="k ic" data-dec="${t.id}" aria-label="Less ${esc(t.label)}">${ic('minus', '#e4e2dc', '-')}</button><span class="vl">${esc(fmt(t, values[t.id]))}</span><button class="k ic" data-inc="${t.id}" aria-label="More ${esc(t.label)}">${ic('plus', '#e4e2dc', '+')}</button>`);
  function knobRow(t, i, lit) {
    const v = values[t.id], moved = v !== t.value, pinned = pins().includes(t.id);
    const k = (x) => ((x - t.min) / (t.max - t.min) * 100).toFixed(1) + '%';
    const bar = t.kind === 'onoff' ? '' : `<span class="bar"><span style="width:${k(v)}"></span><em style="left:${k(t.value)}"></em></span>`;
    // the knob you're on shows its help, its pin, and (when it isn't normal) a button to put it back
    const help = lit && t.help ? `<i class="help">${esc(typeof t.help === 'function' ? t.help(v) : t.help)}</i>` : '';
    const extra = lit ? (t.setting ? '' : `<button class="k ic${pinned ? ' lit' : ''}" data-pin="${t.id}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${esc(t.label)}">${ic('pin', pinned ? '#ffd23f' : '#8f8d88', 'P')}</button>`)
      + (moved ? `<button class="k ic" data-normal="${t.id}" aria-label="Put ${esc(t.label)} back to normal">${ic('reset', '#e4e2dc', 'N')}</button>` : '') : '';
    return `<div class="lab-row${lit ? ' on' : ''}${moved ? ' moved' : ''}" data-i="${i}">${pinned ? '<span class="pin"></span>' : ''}<span class="lb"><b>${esc(t.label)}</b>${bar}</span>${extra}${control(t)}${help}</div>`;
  }

  function draw() {
    btn.textContent = playing ? 'LAB · ' + playing : 'LAB';
    if (!open || !shelves.length) return;
    const sh = shelf(), list = rowsOf(sh); sel = Math.min(sel, Math.max(0, list.length - 1));
    const lit = (i) => (i === sel ? ' on' : '');
    panel.classList.toggle('mini', mini);
    if (mini) {   // one slim bar: the knob you're on
      const t = knobShelf(sh) ? list[sel] : null;
      panel.innerHTML = `<div class="lab-mini${t && values[t.id] !== t.value ? ' moved' : ''}">
        <button class="k ic" data-row="-1" aria-label="Previous knob">${ic('up', '#e4e2dc', '^')}</button><button class="k ic" data-row="1" aria-label="Next knob">${ic('down', '#e4e2dc', 'v')}</button>
        <span class="lb"><small>${esc(sh.name)}${list.length ? ' · ' + (sel + 1) + '/' + list.length : ''}</small><b>${t ? esc(t.label) : 'Pick a shelf of knobs'}</b></span>
        ${t ? control(t) : ''}<button class="k ic" data-mini aria-label="Full panel">${ic('big', '#e4e2dc', '[]')}</button><button class="k ic" data-close aria-label="Close the Lab">${ic('x', '#e4e2dc', 'X')}</button></div>`;
      return;
    }
    let rows;
    if (sh.kind === 'saved') {
      const st = startVals();
      rows = `<div class="lab-row${lit(0)}" data-i="0"><span class="lb"><b>Start mix</b><i class="clip">${esc(st ? Object.values(data.start.labels || {}).join(' · ') : 'The game starts plain. SET makes it start with the knobs as they are now.')}</i></span><button class="k" data-start="set">SET</button>${st ? '<button class="k" data-start="clear">CLEAR</button>' : ''}</div>`
        + `<div class="lab-row${lit(1)}" data-i="1"><span class="lb"><b>New prototype</b><i>Keeps the knobs as they are now. Prototypes also show in the Studio, under Lab.</i></span><button class="k acc" data-do="save">SAVE</button></div>`
        + (list.length > 2 ? '<div class="lab-head">Prototypes</div>' + list.slice(2).map((p, k) => `<div class="lab-row${lit(k + 2)}" data-i="${k + 2}"><button class="lb" data-load="${k}"><b>${esc(p.name)}</b><i class="clip">${esc(p.note || Object.values(p.labels || {}).join(' · ') || '')}</i></button><button class="k acc" data-load="${k}">${ic('play', '#ffd23f', '')}PLAY</button></div>`).join('') : '');
    } else if (sh.kind === 'presets') {
      rows = `<div class="lab-row${lit(0)}" data-i="0"><span class="lb"><b>New preset</b><i>Keeps the knobs as they are now. While playing, D-pad left and right flip between presets.</i></span><button class="k acc" data-preset="new">SAVE</button></div>`
        + (list.length > 1 ? list.slice(1).map((p, k) => `<div class="lab-row${lit(k + 1)}" data-i="${k + 1}"><button class="lb" data-preset="${k}"><b${k === presetAt ? ' style="color:#7dff6a"' : ''}>${esc(p.name)}</b><i class="clip">${esc(Object.keys(p.values || {}).length + ' knobs: ' + Object.values(p.labels || {}).map(x => x.split(' · ').pop()).join(' · '))}</i></button><button class="k" data-pkeep="${k}" aria-label="Replace ${esc(p.name)} with the knobs as they are now">SET</button><button class="k ic" data-pdrop="${k}" aria-label="Delete ${esc(p.name)}">${ic('trash', '#e4e2dc', 'X')}</button><button class="k acc" data-preset="${k}">LOAD</button></div>`).join('')
          : '<div class="lab-empty">No presets yet. Turn some knobs, then SAVE here. Each preset is the whole mix: loading one puts every other knob back to normal.</div>');
    } else if (sh.kind === 'ideas') {
      rows = `<div class="lab-row${lit(0)}" data-i="0"><span class="lb"><b>New idea</b><i>A mechanic or look to try. Ideas also show in the Studio, under Lab.</i></span><button class="k acc" data-do="idea">ADD</button></div>`
        + list.slice(1).map((it, k) => `<div class="lab-row${lit(k + 1)}" data-i="${k + 1}"><span class="lb"><b>Idea ${list.length - 1 - k}</b><i style="color:var(--t)">${esc(it.text)}</i></span></div>`).join('');
    } else if (!list.length) {
      rows = `<div class="lab-empty">${sh.kind === 'pinned' ? 'Nothing pinned yet. Pick a knob on any shelf and press its pin (L3 on the controller): it shows up here.' : 'Everything is normal. Knobs you turn show up here, so you can see what is on and put things back.'}</div>`;
    } else {
      rows = list.map((t, i) => (sh.heads && sh.heads[i] ? `<div class="lab-head">${esc(sh.heads[i])}</div>` : '') + knobRow(t, i, i === sel)).join('');
    }
    const fresh = performance.now() - sayT < 2500 ? sayText : (playing ? 'Playing ' + playing : '');
    const oldRows = panel.querySelector('.lab-rows'), keepTop = oldRows && panel.dataset.shelf === sh.id ? oldRows.scrollTop : 0;
    panel.dataset.shelf = sh.id;
    const count = (s) => (s.kind === 'now' ? rowsOf(s).length : s.kind === 'pinned' ? pins().length : s.kind === 'presets' ? presets().length : 0);
    const gridHtml = grid ? `<div class="lab-grid">${shelves.map((s, i) => `<button class="k${i === shelfAt ? ' here' : ''}${i === gridAt ? ' lit' : ''}" data-go="${i}">${esc(s.name)}${count(s) ? `<small>${count(s)}</small>` : ''}</button>`).join('')}</div>` : '';
    panel.innerHTML = `<div class="lab-top"><button class="k ic" data-sh="-1" aria-label="Previous shelf">${ic('left', '#e4e2dc', '<')}</button><button class="nm" data-grid aria-label="All shelves"><b>${esc(sh.name)}</b><small>${shelfAt + 1} / ${shelves.length} · ALL SHELVES</small></button><button class="k ic" data-sh="1" aria-label="Next shelf">${ic('right', '#e4e2dc', '>')}</button><button class="k ic" data-mini aria-label="Small panel">${ic('small', '#e4e2dc', '_')}</button><button class="k ic" data-close aria-label="Close the Lab">${ic('x', '#e4e2dc', 'X')}</button></div>
      <div class="lab-rows">${rows}</div>${gridHtml}
      <div class="lab-say">${esc(fresh)}</div>
      <div class="lab-act"><button class="k" data-do="dice">${ic('dice', '#ffd23f', '')}DICE</button><button class="k" data-do="back">${ic('undo', '#e4e2dc', '')}UNDO</button><button class="k" data-do="reset">${ic('reset', '#e4e2dc', '')}RESET</button><button class="k" data-do="save">SAVE</button><button class="k" data-do="idea">IDEA</button></div>
      <div class="lab-hint">Up down pick · Left right turn (hold R2: ×5, L2: to the end) · L1 R1 shelf, hold for all · Cross switch, play · Square back to normal · L3 pin · R3 small · Triangle dice · Select undo · Start idea · Circle close</div>`;
    panel.querySelector('.lab-rows').scrollTop = keepTop;   // a change further down keeps the list where it was
    const onRow = panel.querySelector('.lab-row.on'); if (onRow) onRow.scrollIntoView({ block: 'nearest' });
    const onTile = panel.querySelector('.lab-grid .k.lit'); if (onTile) onTile.scrollIntoView({ block: 'nearest' });
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button,.lab-row'); if (!b) return;
    const d = b.dataset, r = e.target.closest('.lab-row');
    if (r) sel = +r.dataset.i;
    if (d.sh) { goShelf(shelfAt + +d.sh); return; }
    if ('grid' in d) { grid = !grid; gridAt = shelfAt; draw(); return; }
    if (d.go !== undefined) { goShelf(+d.go); return; }
    if ('close' in d) { toggle(false); return; }
    if ('mini' in d) { mini = !mini; draw(); return; }
    if (d.row) { const n = rowsOf(shelf()).length; if (n) sel = (sel + +d.row + n) % n; }
    else if (d.dec) turn(byId[d.dec], -1);
    else if (d.inc) turn(byId[d.inc], 1);
    else if (d.flip) turn(byId[d.flip], 1);
    else if (d.pin) pin(byId[d.pin]);
    else if (d.normal) normal(byId[d.normal]);
    else if (d.load !== undefined) load(protos()[+d.load]);
    else if (d.preset !== undefined) (d.preset === 'new' ? newPreset() : loadPreset(+d.preset));
    else if (d.pkeep !== undefined) updatePreset(+d.pkeep);
    else if (d.pdrop !== undefined) dropPreset(+d.pdrop);
    else if (d.start) (d.start === 'set' ? setStart : clearStart)();
    else if (d.do) ({ dice, back, reset, save, idea })[d.do]();
    draw();
  });

  // ---------------------------------------------------------------- controller
  const prev = [], heldT = [], downAt = [];
  let stickT = 0, gridByHold = false, selUsed = false;
  addEventListener('keydown', (e) => {   // a keyboard on the desktop
    if (e.repeat) return;
    if (e.code === 'KeyL') toggle(); else if (e.code === 'BracketLeft') stepPreset(-1); else if (e.code === 'BracketRight') stepPreset(1);
    else if (LAB.dpad && !open && /^Digit[1-4]$/.test(e.code)) LAB.dpad(['up', 'down', 'left', 'right'][+e.code[5] - 1]);   // team orders on 1 to 4
  });
  function pollPad(now) {
    const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(g => g && g.connected);
    const gp = game.pad || pads[0];
    if (!gp) { if (unblockWhenUp) { game.blockPad = false; unblockWhenUp = false; } return; }
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const down = (i) => b(i) && !prev[i];
    const up = (i) => !b(i) && prev[i];
    const rep = (i) => { if (!b(i)) { heldT[i] = 0; return false; } if (!prev[i]) { heldT[i] = now + 0.35; return true; } if (now >= heldT[i]) { heldT[i] = now + 0.08; return true; } return false; };
    for (const i of [4, 5]) if (down(i)) downAt[i] = now;
    if (!open) {
      if (unblockWhenUp && ![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].some(b)) { game.blockPad = false; unblockWhenUp = false; }
      if (LAB.dpad) {   // the D-pad gives orders (the Party shelf's Team orders): Select opens the Lab, Select + left/right flips presets
        if (down(8)) selUsed = false;
        if (b(8)) { if (down(14)) { stepPreset(-1); selUsed = true; } if (down(15)) { stepPreset(1); selUsed = true; } }
        else for (const [i, d] of [[12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']]) if (down(i)) LAB.dpad(d);
        if (up(8) && !selUsed) toggle(true);
      } else {
        if (down(13)) toggle(true);
        if (down(14)) stepPreset(-1);
        if (down(15)) stepPreset(1);
      }
    } else if (grid) {   // every shelf: the D-pad moves, Cross (or letting go of the held shoulder) goes there
      const n = shelves.length, cols = 2;
      if (rep(12)) { gridAt = (gridAt - cols + n) % n; draw(); }
      if (rep(13)) { gridAt = (gridAt + cols) % n; draw(); }
      if (rep(14)) { gridAt = (gridAt - 1 + n) % n; draw(); }
      if (rep(15)) { gridAt = (gridAt + 1) % n; draw(); }
      if (down(0) || (gridByHold && (up(4) || up(5)))) { gridByHold = false; goShelf(gridAt); }
      else if (down(1)) { grid = false; gridByHold = false; draw(); }
    } else {
      const sh = shelf(), list = rowsOf(sh), t = knobShelf(sh) ? list[sel] : null;
      if (down(1)) toggle(false);
      else {
        if (rep(12) && list.length) { sel = (sel + list.length - 1) % list.length; draw(); }
        if (rep(13) && list.length) { sel = (sel + 1) % list.length; draw(); }
        // L2 held: left and right go to the end; R2 held: five steps at a time
        if (t && t.kind !== 'onoff') {
          if (b(6)) { if (down(14)) turn(t, -1, 'end'); if (down(15)) turn(t, 1, 'end'); }
          else { if (rep(14)) turn(t, -1, b(7)); if (rep(15)) turn(t, 1, b(7)); }
        }
        // the left stick turns a knob too, faster the further you push
        const x = gp.axes[0] || 0;
        if (t && t.kind !== 'onoff' && Math.abs(x) > 0.4) { if (now >= stickT) { turn(t, Math.sign(x), b(7)); stickT = now + 0.16 - Math.min(0.13, (Math.abs(x) - 0.4) * 0.22); } } else stickT = 0;
        if (down(0)) {
          if (sh.kind === 'saved') { if (sel === 0) setStart(); else if (sel === 1) save(); else if (list[sel]) load(list[sel]); }
          else if (sh.kind === 'presets') { if (sel === 0) newPreset(); else loadPreset(sel - 1); }
          else if (sh.kind === 'ideas') { if (sel === 0) idea(); }
          else if (t && t.kind === 'onoff') turn(t, 1);
        }
        // shoulders: a tap changes shelf, holding shows every shelf
        for (const [i, dir] of [[4, -1], [5, 1]]) {
          if (b(i) && downAt[i] && now - downAt[i] > 0.3) { downAt[i] = 0; grid = true; gridByHold = true; gridAt = shelfAt; draw(); }
          else if (up(i) && downAt[i]) { downAt[i] = 0; goShelf(shelfAt + dir); }
        }
        if (down(2) && t) normal(t);
        if (down(10) && t) { pin(t); draw(); }
        if (down(11)) { mini = !mini; draw(); }
        if (down(3)) dice();
        if (down(8)) back();
        if (down(9)) idea();
      }
    }
    for (let i = 0; i < 17; i++) prev[i] = b(i);
  }

  // ---------------------------------------------------------------- speed readout: frames a second, counted over half a second
  let fpsEl = null, fpsN = 0, fpsT = 0, fpsWorst = 0, fpsLast = 0;
  function showFps(x) {
    if (!x) { if (fpsEl) fpsEl.style.display = 'none'; return; }
    if (!fpsEl) { fpsEl = document.createElement('div'); fpsEl.style.cssText = 'position:fixed;top:max(6px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:30;font:700 11px/1 Saira,system-ui,sans-serif;letter-spacing:.06em;color:#ffd23f;background:rgba(0,0,0,.6);padding:4px 8px;border-radius:6px;pointer-events:none'; document.body.appendChild(fpsEl); }
    fpsEl.style.display = ''; fpsEl.textContent = '… FPS'; fpsN = 0; fpsT = 0; fpsWorst = 0; fpsLast = 0;
  }
  on('frame', () => {
    if (!fpsEl || fpsEl.style.display === 'none') return;
    const now = performance.now();
    if (fpsLast) { const d = now - fpsLast; fpsN++; fpsT += d; fpsWorst = Math.max(fpsWorst, d); }
    fpsLast = now;
    if (fpsT >= 500) { fpsEl.textContent = Math.round(fpsN * 1000 / fpsT) + ' FPS · SLOWEST ' + Math.round(fpsWorst) + ' MS'; fpsN = 0; fpsT = 0; fpsWorst = 0; }
  });

  // ---------------------------------------------------------------- the shelves, then a prototype the Studio asked to play
  const names = Array.isArray(data.shelves) ? data.shelves : [];
  let left = names.length;
  const ready = () => {
    LAB.shelf('dice', 'Lab settings', () => [
      { id: 'count', label: 'Knobs per roll', help: 'How many knobs one press of Dice turns. ALL is the old way: about half of them', min: 1, max: DICE_ALL, step: 1, value: 3, dice: false, setting: true, fmt: (x) => (x >= DICE_ALL ? 'ALL' : String(x)) },
      { id: 'from', label: 'Roll from', help: 'Every shelf, or only the shelf you are on', kind: 'onoff', value: 0, dice: false, setting: true, fmt: (x) => (x ? 'THIS SHELF' : 'ALL SHELVES') },
      { id: 'lab.pause', label: 'Pause while open', help: 'The game holds still while the Lab is open', kind: 'onoff', value: 1, dice: false, setting: true, apply: syncPause },
      { id: 'lab.sharp', label: 'Sharpness', help: 'Fewer pixels runs faster: every screen effect costs less. 100% is normal', min: 0.5, max: 1, step: 0.05, value: 1, dice: false, setting: true,
        fmt: (x) => Math.round(x * 100) + '%', apply: (x) => { game.resScale = x; } },
      { id: 'lab.fps', label: 'Show speed', help: 'Frames a second in the top corner (60 is smooth; 30 in Low Power Mode)', kind: 'onoff', value: 0, dice: false, setting: true, apply: showFps }
    ]);
    build(); shelfAt = Math.min(shelfAt, shelves.length - 1);
    for (const t of toys) if (t.setting && values[t.id] !== t.value) run(t, values[t.id]);   // settings remembered on this phone take effect
    let want = null; try { want = sessionStorage.getItem('ha.lab.play'); sessionStorage.removeItem('ha.lab.play'); } catch (e) {}
    const p = want && protos().find(x => x.id === want);
    if (p) { setAll(p.values || {}); playing = p.name; }
    else if (startVals()) setAll(startVals());   // your start mix
    draw();
  };
  if (!left) ready();
  for (const n of names) {
    const s = document.createElement('script');
    s.src = 'lab/' + n + '.js'; s.async = false;
    s.onload = s.onerror = () => { if (--left === 0) ready(); };
    document.body.appendChild(s);
  }
});
