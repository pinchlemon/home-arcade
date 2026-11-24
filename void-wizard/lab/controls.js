// Lab shelf: Controls. Your own button layout, and it has the last word: what this screen says a button does is what
// it does. Each button has two jobs: one while you hold the Solid, one while you don't.
//   NORMAL leaves a button doing what the other shelves give it (the screen says what that is right now).
//   Any other job takes the button over: it does that job and nothing else, in that situation. A job can sit on more
//   than one button.
// How it reaches everything: the game reads each of its own jobs (jump, run, catch / throw, the Triangle job, dive,
// tackle) through game.padHook, and the shelves ask LAB.btn(W, job, theirButton) instead of reading a button. A
// button left on NORMAL answers for the job its shelf would give it; a button given a job answers only for that job.
// Start, Select and the D-pad are not on this screen (the Lab, the presets and the team orders keep them).
LAB.shelf('controls', 'Controls', (game) => {
  const o = game.orb;
  const raw = (gp, i) => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
  const on = () => !!LAB.get('controls.on');
  // the jobs, in the order the knob turns through them
  const JOBS = [
    ['normal', 'NORMAL'], ['none', 'NOTHING'],
    ['jump', 'JUMP'], ['dive', 'DIVE / CROUCH'], ['run', 'RUN'], ['tackle', 'TACKLE'],
    ['throw', 'CATCH / THROW'], ['change', 'CHANGE PLAYER'], ['cancel', 'CANCEL THROW'],
    ['lock', 'LOCK ON'], ['higher', 'THROW HIGHER'], ['lower', 'THROW LOWER'],
    ['pass3', 'PASS △ (TETRA)'], ['pass2', 'PASS □ (CUBE)'], ['pass0', 'PASS ✕ (OCTA)'], ['pass1', 'PASS ○ (ICOSA)'], ['shoot', 'SHOOT'],
    ['ability', 'ABILITY (TAP / HOLD)'], ['pentacle', 'PENTACLE'], ['power', 'POWER UP SWORD'], ['swing', 'SWING SWORD'],
    ['camReset', 'RESET CAMERA']
  ];
  const JOB = (v) => JOBS[Math.max(0, Math.min(JOBS.length - 1, Math.round(v || 0)))][0];
  const BUTTONS = [[0, '✕', 'Cross'], [1, '○', 'Circle'], [2, '□', 'Square'], [3, '△', 'Triangle'], [4, 'L1', 'L1'], [5, 'R1', 'R1'], [6, 'L2', 'L2'], [7, 'R2', 'R2'], [10, 'L3', 'L3'], [11, 'R3', 'R3']];
  const key = (b, ctx) => 'controls.' + ctx + b;
  const jobOf = (b, ctx) => JOB(LAB.get(key(b, ctx)));
  const ctxOf = (W) => (o.state === 'held' && o.holder === W ? 'w' : 'f');

  // ---------------------------------------------------------------- what NORMAL is right now, in words
  function normal(b, ctx) {
    const g = (k) => LAB.get(k), sports = g('ball.buttons') === 1, madden = !!g('madden.on'), swords = !!g('swords.on'), abil = !!g('abilities.on'), match = !!g('match.on');
    const jump = !sports || g('ball.jump'), lock = !!g('ball.lock'), arcBy = !!g('ball.arcBy');
    const W = ctx === 'w';
    // (without the Solid, the specials don't apply)
    const l1 = () => { const p = []; if (!W) return sports ? 'nothing' : 'tackle'; if (swords) p.push('power up sword'); else if (abil) p.push('ability'); if (match) p.push('pentacle (dodeca)'); if (sports && W && !arcBy && !swords) p.push('throw higher'); if (!sports) p.push('tackle'); return p.join(' · ') || 'nothing'; };
    const r1 = () => { if (W && swords) return 'swing sword'; if (W && madden) return 'shoot'; if (lock) return 'lock on'; if (sports) return W && !arcBy ? 'throw lower' : 'nothing'; return 'run'; };
    switch (b) {
      case 0: return W && madden ? 'pass ✕ (octa)' : jump ? 'jump' : W ? 'cancel throw' : 'nothing';
      case 1: return W && madden ? 'pass ○ (icosa)' : 'dive / crouch';
      case 2: return W && madden ? 'pass □ (cube)' : W ? 'throw' : 'catch';
      case 3: return W && madden ? 'pass △ (tetra)' : 'change player';
      case 4: return l1();
      case 5: return r1();
      case 6: return sports ? 'tackle' : 'dive / crouch';
      case 7: return sports ? 'run' : W ? 'throw' : 'catch';
      case 10: return 'run';
      case 11: return 'reset camera';
    }
    return 'nothing';
  }

  // ---------------------------------------------------------------- the layer every shelf asks
  // is job `act` down for W? `i` is the button its shelf would read: it counts only while that button is on NORMAL
  LAB.btn = (W, act, i) => {
    const gp = W && W.gp; if (!gp) return false;
    if (!on()) return raw(gp, i);
    const ctx = ctxOf(W);
    if (i != null && jobOf(i, ctx) === 'normal' && raw(gp, i)) return true;
    for (const [b] of BUTTONS) if (jobOf(b, ctx) === act && raw(gp, b)) return true;
    return false;
  };
  // the button a job is on now (for icons): the first button given it, else its own button if that's on NORMAL
  LAB.buttonFor = (act, i, W) => {
    const ctx = W ? ctxOf(W) : 'w';
    if (!on()) return i;
    for (const [b] of BUTTONS) if (jobOf(b, ctx) === act) return b;
    return i != null && jobOf(i, ctx) === 'normal' ? i : null;
  };
  const NAMES = { 0: '✕', 1: '○', 2: '□', 3: '△', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 10: 'L3', 11: 'R3' };
  LAB.btnName = (act, i, W) => { const b = LAB.buttonFor(act, i, W); return b == null ? null : NAMES[b]; };
  // the game's own jobs: which job each of its button slots is
  const SLOT = { 0: 'jump', 5: 'run', 10: 'run', 2: 'throw', 7: 'throw', 3: 'change', 1: 'dive', 6: 'dive', 4: 'tackle' };
  const PRIMARY = { 0: 1, 5: 1, 2: 1, 3: 1, 1: 1, 4: 1 };   // 10, 7 and 6 are second buttons for the same jobs
  function hook(i, b0, alias, W, rawB) {
    const act = SLOT[i]; if (!act) return b0(i);   // Start, Select, the D-pad: as they were
    const ctx = ctxOf(W), phys = alias && alias[i] != null ? alias[i] : i;
    let down = jobOf(phys, ctx) === 'normal' ? b0(i) : false;   // a NORMAL button does what it did
    if (!down && PRIMARY[i]) {
      // Square-style catching and throwing belongs to Ball play when its Sports buttons are on: the game doesn't also get it
      const ballOwns = act === 'throw' && LAB.get('ball.buttons') === 1 && !game.DUEL;
      // aiming with the triggers: the triggers set the distance, they don't run or tackle
      const trig = W.charging && LAB.get('ball.power') === 2 && (act === 'run' || act === 'tackle');
      if (!ballOwns && !trig) for (const [b] of BUTTONS) if (jobOf(b, ctx) === act && rawB(b)) { down = true; break; }
    }
    return down;
  }

  // ---------------------------------------------------------------- the controller picture at the top of the shelf
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = document.createElement('style');
  css.textContent = `
  .ct-pad{position:sticky;top:0;z-index:2;box-shadow:0 4px 8px #000;display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;padding:6px 8px 8px;margin:0 0 4px;background:#0b0b10;border-radius:var(--r-s,6px);font-size:10px;letter-spacing:.5px}
  .ct-pad h4{grid-column:1/-1;margin:0 0 2px;font-size:10px;font-weight:400;opacity:.7;letter-spacing:1px}
  .ct-pad div{display:flex;gap:6px;align-items:baseline;min-width:0}
  .ct-pad b{flex:0 0 22px;text-align:center;font-weight:400;color:#ffd23f}
  .ct-pad span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e4e2dc}
  .ct-pad span.n{opacity:.55}
  .ct-pad .lit{outline:1px solid #ffd23f;border-radius:3px}`;
  document.head.appendChild(css);
  let rowIds = [];
  LAB.tops.controls = (sel) => {
    const t = rowIds[sel] || '', ctx = /\.f\d+$/.test(t) ? 'f' : 'w', litB = +(t.match(/\d+$/) || [-1])[0];
    const cells = BUTTONS.map(([b, sym]) => {
      const j = jobOf(b, ctx), txt = j === 'normal' ? normal(b, ctx) : JOBS.find(x => x[0] === j)[1].toLowerCase();
      return `<div class="${b === litB && t ? 'lit' : ''}"><b>${sym}</b><span class="${j === 'normal' ? 'n' : ''}">${esc(txt)}</span></div>`;
    }).join('');
    return `<div class="ct-pad"><h4>${on() ? '' : 'OFF · '}${ctx === 'w' ? 'HOLDING THE SOLID' : 'WITHOUT THE SOLID'}</h4>${cells}</div>`;
  };

  // ---------------------------------------------------------------- the knobs
  const toys = [{ id: 'on', label: 'Controls', help: 'Your own button layout. When on, this screen decides what every button does (Start, Select and the D-pad stay as they are)', kind: 'onoff', value: 0, dice: false,
    frame: () => { if (game.padHook !== hook) game.padHook = hook; }, apply: (v) => { game.padHook = v ? hook : null; } }];
  for (const ctx of ['w', 'f']) for (const [b, sym, name] of BUTTONS) {
    toys.push({ id: ctx + b, label: sym + ' ' + (ctx === 'w' ? 'holding' : 'free'), min: 0, max: JOBS.length - 1, step: 1, value: 0, dice: false,
      help: () => (ctx === 'w' ? name + ' while you hold the Solid' : name + ' while you don\'t hold it') + (jobOf(b, ctx) === 'normal' ? '. On NORMAL it does: ' + normal(b, ctx) : ''),
      fmt: (v) => (JOB(v) === 'normal' ? 'NORMAL' : JOBS[Math.round(v)][1]) });
  }
  rowIds = toys.map(t => 'controls.' + t.id);
  return toys;
});
