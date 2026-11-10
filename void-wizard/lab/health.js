// Lab shelf: Health. Wizards get health, shown as a small bar over each head. Touching the centipede and
// being knocked down cost health. At zero a wizard goes down hard and gets up with full health.
LAB.shelf('health', 'Health', (game) => {
  const T = game.THREE, at = new T.Vector3();
  const css = document.createElement('style');
  css.textContent = `.lab-hp{position:fixed;left:0;top:0;display:flex;gap:2px;pointer-events:none;z-index:5;transform:translate(-50%,-100%)}
  .lab-hp i{display:block;width:5px;height:5px;background:currentColor;box-shadow:0 0 0 1px #000}
  .lab-hp i.off{background:#000;box-shadow:0 0 0 1px currentColor;opacity:.6}
  .lab-hp.hurt i{background:#fff}`;
  document.head.appendChild(css);
  const bars = new Map();
  const maxOf = (W) => (W === game.player ? LAB.get('health.you') : LAB.get('health.buddy')) ?? 5;
  const colOf = (W) => '#' + new T.Color(W.discBase || 0xffffff).getHexString();
  function bar(W) {
    let b = bars.get(W);
    if (!b) { b = document.createElement('div'); b.className = 'lab-hp'; document.body.appendChild(b); bars.set(W, b); b.dataset.k = ''; }
    return b;
  }
  const on = () => !!LAB.get('health.on');
  function hurt(W, n) {
    if (!on() || !(n > 0) || W.labDown) return;
    W.labHp = Math.max(0, (W.labHp ?? maxOf(W)) - n); W.labHurt = 0.25;
    if (W.labHp <= 0) {
      W.labDown = true;
      const a = Math.random() * Math.PI * 2; W.downT = 0;   // make sure the knockdown lands
      game.knockDown(W, Math.sin(a), Math.cos(a), 12);
    }
  }
  // knocked down by anything: costs health
  window.FEATURES.on('knockdown', (W) => { if (!W.labDown) hurt(W, LAB.get('health.knock') ?? 1); }, 'lab');
  function tick(dt) {
    for (const W of game.ALL) {
      const m = maxOf(W);
      if (W.labMax !== m) { W.labMax = m; W.labHp = m; }
      W.labHurt = Math.max(0, (W.labHurt || 0) - dt); W.labSafe = Math.max(0, (W.labSafe || 0) - dt);
      // back up after going down at zero: full health again
      if (W.labDown && W.downT <= 0) { W.labDown = false; W.labHp = m; W.labSafe = 1.5; }
      // touching the centipede
      if (LAB.get('health.contact') && game.demon.alive && !game.demon.dying && game.demon.scale > 0.5 && W.labSafe <= 0 && W.downT <= 0 && !W.labDown) {
        for (const q of game.demonParts()) {
          const dx = W.pos.x - q.x, dz = W.pos.z - q.z, dy = (W.y + 0.6) - q.y, d = Math.hypot(dx, dy, dz);
          if (d < q.r + 0.45) {
            W.labSafe = 1;
            const h = Math.hypot(dx, dz) || 1;
            hurt(W, LAB.get('health.contactDmg') ?? 1);
            if (!W.labDown) game.pushBack(W, dx / h, dz / h, 6);
            break;
          }
        }
      }
    }
  }
  // the bars sit over the heads; placed once the camera has moved this frame
  function place(cam) {
    cam.updateMatrixWorld();
    const W2 = innerWidth, H2 = innerHeight;
    for (const W of game.ALL) {
      const b = bar(W), m = W.labMax || maxOf(W), hp = Math.round(W.labHp ?? m);
      const k = m + ':' + hp + ':' + (W.labHurt > 0 ? 1 : 0);
      if (b.dataset.k !== k) { b.dataset.k = k; b.innerHTML = Array.from({ length: m }, (_, i) => `<i${i < hp ? '' : ' class="off"'}></i>`).join(''); b.classList.toggle('hurt', W.labHurt > 0); }
      b.style.color = colOf(W);
      at.set(W.pos.x, W.y + 1.9 * (W.root.scale.y || 1), W.pos.z).project(cam);
      const hide = at.z > 1 || !W.root.visible;
      b.style.display = hide ? 'none' : 'flex';
      if (!hide) b.style.transform = `translate(${((at.x + 1) / 2 * W2).toFixed(1)}px,${((1 - at.y) / 2 * H2 - 4).toFixed(1)}px) translate(-50%,-100%)`;
    }
  }
  function off() { for (const b of bars.values()) b.style.display = 'none'; for (const W of game.ALL) { W.labDown = false; W.labHp = W.labMax = undefined; } }
  return [
    { id: 'on', label: 'Health', help: 'Health bars over the wizards', kind: 'onoff', value: 0, dice: true,
      frame: (dt) => tick(dt), camera: (cam) => place(cam), apply: (v) => { if (!v) off(); } },
    { id: 'you', label: 'Your health', help: 'Hits you can take', min: 1, max: 20, step: 1, value: 5 },
    { id: 'buddy', label: 'Buddy health', help: 'Your buddy (and the party wizards)', min: 1, max: 20, step: 1, value: 5 },
    { id: 'contact', label: 'Centipede hurts', help: 'Touching it costs health (with Health on)', kind: 'onoff', value: 0, dice: true },
    { id: 'contactDmg', label: 'Touch damage', help: 'Health lost per touch', min: 1, max: 5, step: 1, value: 1 },
    { id: 'knock', label: 'Knockdown damage', help: 'Health lost when knocked over', min: 0, max: 5, step: 1, value: 1 }
  ];
});
