// What the visual logic (engine/logic.js) reaches in Crab Platformer. Graphs run in level scenes only:
// the Waves mode never runs them, and nothing here draws or moves anything until a graph asks.
// Things a graph can count, make and remove: eyes (objects with base "eye") and things run by the behavior library
// (base "actor"). The score is the eye count at the top right; hearts are the crab's life.
(function () {
  const SOUND = { coin: 'land', jump: 'jump', land: 'land', hurt: 'hurt', shoot: 'squirt', hit: 'eye', melt: 'melt', win: 'over', charge: 'charge' };
  const CARRY = 'ha.logic.carry.' + location.pathname;
  const fire = (what, it) => { if (LEVEL && window.LOGIC) LOGIC.fire(what, it); };
  window.crabLogicFire = fire;
  const liveEye = (e) => e.st !== 'dying' && !e.gone;
  let touching = new Set();
  // every button that went down since the last frame, however briefly (a quick tap is up again before the frame)
  const taps = {};
  if (LEVEL) { const was = setKey; setKey = function (k, v) { if (v && !keys[k]) taps[k] = true; was(k, v); }; }
  window.LOGIC_HOST = {
    active: !!LEVEL,
    get player() { return crab; },
    T: 8, scenes: SCENES,
    sceneIndex: () => SCENES.indexOf(SCENE), sceneId: () => SCENE.id,
    start: () => ({ x: LEVEL ? LEVEL.start.x : crab.x, y: GROUND }),
    exit: () => (LEVEL && LEVEL.exit ? { x: LEVEL.exit.x, y: GROUND } : null),
    score: (n) => (n === undefined ? kills : (kills = n)),
    hp: () => crab.hp, maxHp: () => LIFE,
    hearts(k) {
      if (crab.dead || !k) return;
      crab.hp = Math.max(0, Math.min(LIFE, crab.hp + k));
      if (k > 0) return;
      shake = 8; splash(crab.x, crab.y - 8, 5, RED); sfx.hurt();
      if (crab.hp <= 0) { crab.dead = true; overT = 0; sfx.over(); for (let i = 0; i < 14; i++) splash(crab.x, crab.y - 8, 1, i % 2 ? RED : YEL); fire('dies'); }
    },
    things(id) {
      const out = [];
      for (const e of eyes) if (liveEye(e) && (!id || e.oid === id)) out.push(e);
      for (const a of actors) if (a.alive && (!id || a.oid === id)) out.push(a);
      return out;
    },
    thingCount() { return eyes.length + actors.length; },
    spawn(id, x, y) {
      const o = (S.objects || {})[id]; if (!o) return;
      const h = Math.max(0, GROUND - y);
      if (o.base === 'eye') placeEye({ obj: id, x, h }, { ...EYE_DEFAULT, ...(o.settings || {}) });
      else if (o.base === 'actor') { if (!actorsPlaced) { actorsPlaced = true; placeActors(); } actors.push(makeActor(o, { obj: id, x, h })); }
    },
    kill(a) {
      if (a.st !== undefined) { if (a.st !== 'dying') { a.hp = 0; a.st = 'dying'; a.t = 0; } }
      else a.alive = false;
    },
    move(x, y) { crab.x = x; crab.y = Math.min(GROUND, y); crab.vx = crab.vy = 0; crab.onGround = crab.y >= GROUND; },
    push(vx, vy) { crab.vx = vx; crab.vy = vy; if (vy < 0) crab.onGround = false; },
    sound(name) { const f = sfx[SOUND[name] || name]; if (f) f(); },
    go(i) { const s = SCENES[i]; if (s) location.replace(location.pathname + '?scene=' + encodeURIComponent(s.id)); },
    win() { if (!cleared && !crab.dead) { cleared = true; clearT = 0; sfx.over(); } },
    buttons: () => ({ jump: !!held('jump'), a: !!held('a'), b: !!held('b'), left: !!held('left'), right: !!held('right') }),
    tapped: (k) => !!(taps[k] || pressed[k]),
    forgetTaps() { for (const k in taps) taps[k] = false; },
    // numbers of your own, kept when a graph or the exit flag goes to another scene
    carry(vars) { try { sessionStorage.setItem(CARRY, JSON.stringify(vars)); } catch (e) { /* private mode */ } },
    carried() { try { const v = JSON.parse(sessionStorage.getItem(CARRY) || '{}'); sessionStorage.removeItem(CARRY); return v; } catch (e) { return {}; } },
    // touching an eye (the crab's box over the eye's middle)
    frame() {
      const now = new Set();
      for (const e of eyes) if (liveEye(e) && Math.abs(e.x - crab.x) < 15 && e.y > crab.y - 22 && e.y < crab.y + 8) { now.add(e); if (!touching.has(e)) fire('touch', e); }
      touching = now;
    },
    say(str) { text(str, Math.round(VW / 2 - str.length * 2), 22); }
  };
})();
