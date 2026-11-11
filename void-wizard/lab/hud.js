// Lab shelf: Screen. What's drawn over the game: the words in the corner, the health bars, and the solid's badge.
// Hidden things come back as soon as the switch goes back on. Use the start mix (Saved shelf) to keep them hidden.
LAB.shelf('hud', 'Screen', (game) => {
  const css = document.createElement('style');
  css.textContent = 'body.lab-notext .hud{display:none!important} body.lab-nobadge .solid-name{display:none!important} body.lab-nohp .lab-hp{display:none!important}';
  document.head.appendChild(css);
  const flag = (cls) => (v) => document.body.classList.toggle(cls, !v);
  return [
    { id: 'text', label: 'Words', help: 'Title, score, buddy mode, controls, tips and the mode link', kind: 'onoff', value: 1, dice: false, apply: flag('lab-notext') },
    { id: 'bars', label: 'Health bars', help: "The demon's bar, and the wizards' bars from the Health shelf", kind: 'onoff', value: 1, dice: false,
      apply: flag('lab-nohp'), frame: () => { game.hpBar.visible = false; } },
    { id: 'badge', label: 'Solid badge', help: 'The big spinning solid and its name in the corner', kind: 'onoff', value: 1, dice: false, apply: (v) => { flag('lab-nobadge')(v); game.hudOff = !v; } }   // hidden, it isn't drawn either
  ];
});
