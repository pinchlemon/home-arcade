// Visual logic for tile games: runs the node graphs made in the Studio's Logic tab (game.json "logic").
// A graph is boxes joined by wires. An Event box starts a chain; white wires carry the flow from box to box;
// blue wires carry a number from a Value box into another box's setting. The boxes are listed in logic.json.
// Loaded after engine/tiles (it uses the scene, the player and the things from there), before engine/loop.
window.LOGIC = (function () {
  const SPEC = (window.LOGIC_NODES || {}).nodes || {};
  // each graph once: its boxes by id, where each flow output leads, and which Value box feeds each setting
  const ALL = (Array.isArray(TG.logic) ? TG.logic : []).filter(g => g && Array.isArray(g.nodes)).map(g => {
    const byId = {}, outs = {}, ins = {};
    for (const n of g.nodes) if (n && SPEC[n.t]) byId[n.id] = n;
    for (const w of g.wires || []) {
      const [a, ap, b, bp] = w; if (!byId[a] || !byId[b]) continue;
      if (ap === 'v') ins[b + ':' + bp] = byId[a]; else (outs[a + ':' + ap] = outs[a + ':' + ap] || []).push(byId[b]);
    }
    return { id: g.id, scene: g.scene || '', outs, ins, nodes: Object.values(byId) };
  });
  const vars = {};                      // the game's own numbers, kept between scenes
  let live = [], state = {}, waits = [], sigQ = [], frames = 0, budget = 0, busy = 0, fresh = false, before = {}, nextScene = null, note = null;
  const st = (G, n) => state[G.id + ':' + n.id] || (state[G.id + ':' + n.id] = {});
  // a setting: what the box says, else the list's default
  function P(n, k) {
    const v = (n.p || {})[k]; if (v !== undefined && v !== null) return v;
    const d = (SPEC[n.t].params || []).find(q => q.k === k); return d ? d.default : undefined;
  }
  // a number setting: from its wire when it has one
  function num(G, n, k, ctx, depth) {
    const src = G.ins[n.id + ':' + k], v = src ? value(G, src, ctx, (depth || 0) + 1) : +P(n, k);
    return isFinite(v) ? v : 0;
  }
  const thingsOf = (id) => actors2.filter(a => a.alive && (!id || a.oid === id));
  function value(G, n, ctx, depth) {
    if (depth > 24) return 0;           // wires in a ring
    const N = (k) => num(G, n, k, ctx, depth);
    switch (n.t) {
      case 'var': return +vars[P(n, 'name')] || 0;
      case 'scoreV': return score;
      case 'heartsV': return player.hp;
      case 'count': return thingsOf(P(n, 'obj')).length;
      case 'time': return frames / 60;
      case 'playerV': { const w = P(n, 'what'), p = player; return w === 'y' ? p.y : w === 'tx' ? Math.floor(p.x / T) : w === 'ty' ? Math.floor((p.y - 1) / T) : w === 'vx' ? p.vx : w === 'vy' ? p.vy : p.x; }
      case 'random': { const a = Math.ceil(Math.min(N('min'), N('max'))), b = Math.floor(Math.max(N('min'), N('max'))); return a + Math.floor(Math.random() * (b - a + 1)); }
      case 'math': {
        const a = N('a'), b = N('b');
        switch (P(n, 'op')) { case '-': return a - b; case '*': return a * b; case '/': return b ? a / b : 0; case '%': return b ? a % b : 0; case 'min': return Math.min(a, b); case 'max': return Math.max(a, b); default: return a + b; }
      }
    }
    return 0;
  }
  // carry on from one of a box's flow outputs
  function go(G, n, out, ctx) { for (const t of G.outs[n.id + ':o' + out] || []) exec(G, t, ctx); }
  function place(at, ctx) {
    const p = player, it = ctx.it;
    if (at === 'it' && it) return { x: it.x, y: it.y };
    if (at === 'start') return { x: SC.start.x, y: SC.start.y };
    if (at === 'exit' && SC.exit) return { x: SC.exit.x, y: SC.exit.y };
    if (at === 'corner') return { x: 0, y: 0 };
    return { x: p.x, y: p.y };
  }
  function exec(G, n, ctx) {
    if (--budget < 0) return;           // a chain that never ends is cut off for this frame
    const N = (k) => num(G, n, k, ctx), p = player;
    switch (n.t) {
      // ---- flow
      case 'if': {
        const a = N('a'), b = N('b'), op = P(n, 'op'), eq = Math.abs(a - b) < 1e-9;
        const yes = op === '=' ? eq : op === '!=' ? !eq : op === '<' ? a < b && !eq : op === '>' ? a > b && !eq : op === '<=' ? a < b || eq : a > b || eq;
        return go(G, n, yes ? 0 : 1, ctx);
      }
      case 'wait': { const t = Math.round(N('secs') * 60); if (t <= 0) return go(G, n, 0, ctx); if (waits.length < 500) waits.push({ G, n, ctx, t }); return; }
      case 'repeat': { const k = Math.max(0, Math.min(200, Math.round(N('times')))); for (let i = 0; i < k && budget > 0; i++) go(G, n, 0, ctx); return go(G, n, 1, ctx); }
      case 'once': { const s = st(G, n); if (s.done) return; s.done = true; return go(G, n, 0, ctx); }
      case 'chance': return go(G, n, Math.random() * 100 < N('pct') ? 0 : 1, ctx);
      // ---- actions
      case 'score': score = Math.max(0, Math.round(score + N('n'))); break;
      case 'hearts': {
        const k = Math.round(N('n')); if (p.dead) break;
        p.hp = Math.max(0, Math.min(P2.lives, p.hp + k));
        if (k < 0) { sfx.hurt(); p.inv = Math.max(p.inv, 30); if (p.hp <= 0) die(); }
        break;
      }
      case 'setVar': { const k = String(P(n, 'name')); vars[k] = (P(n, 'how') === 'set' ? 0 : +vars[k] || 0) + N('v'); break; }
      case 'spawn': {
        const at = place(P(n, 'at'), ctx);
        if (actors2.filter(a => a.alive).length < 300) { const a = makeThing(P(n, 'obj'), at.x + N('x'), at.y + N('y')); if (a) actors2.push(a); }
        break;
      }
      case 'remove': { const o = P(n, 'obj'); if (o === '@it') { if (ctx.it) ctx.it.alive = false; } else if (o) for (const a of thingsOf(o)) a.alive = false; break; }
      case 'swapTiles': {
        const a = P(n, 'from'), b = P(n, 'to'), to = TILES[b] ? b : null;
        if (a && TILES[a]) for (const row of MAP) for (let x = 0; x < row.length; x++) if (row[x] === a) row[x] = to;
        break;
      }
      case 'setTile': { const tx = Math.round(N('tx')), ty = Math.round(N('ty')), ch = P(n, 'tile'); if (ty >= 0 && ty < MH && tx >= 0 && tx < MW) MAP[ty][tx] = TILES[ch] ? ch : null; break; }
      case 'move': { const at = place(P(n, 'at'), ctx); p.x = at.x + N('x'); p.y = at.y + N('y'); p.vx = p.vy = 0; break; }
      case 'push': p.vx = N('vx'); p.vy = N('vy'); p.onGround = false; if (TOP) p.stun = Math.max(p.stun, 10); break;
      case 'setPlayer': {
        const k = { speed: TOP ? 'speed' : 'walkMax', jump: 'jumpSpeed', gravity: 'gravity', shoot: 'shoot', cooldown: 'shotCooldown' }[P(n, 'what')];
        if (k) P2[k] = Math.max(0, (P(n, 'how') === 'add' ? +P2[k] || 0 : 0) + N('v'));
        break;
      }
      case 'say': {
        const v = Math.round(N('v') * 100) / 100;
        note = { text: String(P(n, 'text')).replace(/#/g, String(v)).toUpperCase().slice(0, 38), t: Math.max(6, Math.round(N('secs') * 60)) };
        break;
      }
      case 'sound': { const f = sfx[P(n, 'snd')]; if (f) f(); break; }
      case 'goScene': {
        const s = P(n, 'scene'), i = s === '@next' ? (sceneIndex + 1) % SCENES.length : s === '@again' ? sceneIndex : SCENES.findIndex(x => x.id === s);
        if (i >= 0) nextScene = i;
        return;
      }
      case 'win': if (!won && !p.dead) clearScene(); return;
      case 'send': if (sigQ.length < 200) sigQ.push({ k: String(P(n, 'name')), it: ctx.it }); break;
      default: return;                   // an Event or Value box is not something to run
    }
    go(G, n, 0, ctx);
  }
  // an event happened: run every matching Event box (signals sent on the way run right after)
  function dispatch(type, it, key) {
    for (const G of live) for (const n of G.nodes) {
      if (n.t !== type) continue;
      if (type === 'touch' || type === 'collect' || type === 'defeat') { const o = P(n, 'obj'); if (o && (!it || it.oid !== o)) continue; }
      if (type === 'signal' && String(P(n, 'name')) !== key) continue;
      if (type === 'press' && P(n, 'btn') !== key) continue;
      go(G, n, 0, { it: it || null });
    }
  }
  function top(fn) {
    busy++; try { fn(); } finally { busy--; }
    if (busy) return;
    while (sigQ.length && budget > 0) { const s = sigQ.shift(); busy++; try { dispatch('signal', s.it, s.k); } finally { busy--; } }
    sigQ.length = 0;
  }
  const fire = (type, it, key) => { if (live.length) top(() => dispatch(type, it, key)); };
  function buttons() {
    const ax = padAxis();
    return { jump: !!held('jump'), a: !!held('a'), b: !!held('b'), left: !!held('left'), right: !!held('right'), up: !!(keys.up || ax.up), down: !!(keys.down || ax.down) };
  }
  // the kinds of tile the player is touching (standing on one counts)
  function tilesTouched() {
    const b = boxOf(player), set = new Set();
    for (let ty = Math.floor((b.y0 - 1) / T); ty <= Math.floor((b.y1 + 1) / T); ty++)
      for (let tx = Math.floor((b.x0 - 1) / T); tx <= Math.floor((b.x1 + 1) / T); tx++) { const ch = ty >= 0 && ty < MH && tx >= 0 && tx < MW ? MAP[ty][tx] : null; if (ch) set.add(ch); }
    return set;
  }
  return {
    vars, fire,
    // a scene was loaded
    begin() {
      live = ALL.filter(G => !G.scene || G.scene === SC.id);
      state = {}; waits = []; sigQ = []; frames = 0; fresh = true; note = null; nextScene = null; before = buttons();
      for (const k in tapped) tapped[k] = false;
    },
    // once a frame, before the player and the things move
    tick() {
      if (nextScene !== null) { const i = nextScene; nextScene = null; sceneIndex = i; loadScene(i); }
      budget = 3000;
      if (note && --note.t <= 0) note = null;
      if (actors2.length > 400) actors2 = actors2.filter(a => a.alive);
      if (!live.length) return;
      if (fresh) { fresh = false; fire('start'); }
      frames++;
      if (waits.length) {
        const due = []; waits = waits.filter(w => (--w.t > 0 ? true : (due.push(w), false)));
        for (const w of due) top(() => go(w.G, w.n, 0, w.ctx));
      }
      const now = buttons();
      for (const k in now) { if (tapped[k] || (now[k] && !before[k])) fire('press', null, k); tapped[k] = false; }
      before = now;
      let touched = null;
      for (const G of live) for (const n of G.nodes) {
        if (n.t === 'always') top(() => go(G, n, 0, { it: null }));
        else if (n.t === 'timer') { const s = st(G, n); s.t = (s.t || 0) + 1; if (s.t >= Math.max(1, Math.round(+P(n, 'secs') * 60))) { s.t = 0; top(() => go(G, n, 0, { it: null })); } }
        else if (n.t === 'gone') { const s = st(G, n), c = thingsOf(P(n, 'obj')).length; if (s.c > 0 && c === 0) top(() => go(G, n, 0, { it: null })); s.c = c; }
        else if (n.t === 'tile') { const s = st(G, n); touched = touched || tilesTouched(); const on = touched.has(P(n, 'tile')); if (on && !s.on) top(() => go(G, n, 0, { it: null })); s.on = on; }
      }
    },
    // the Show text box, over the game
    draw() { if (note) say(note.text, Math.round(VW / 2 - note.text.length * 2), 22, CREAM); }
  };
})();
LOGIC.begin();
