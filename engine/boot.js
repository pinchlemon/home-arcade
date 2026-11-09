// Starts a Studio game: reads the game's settings (game.json, next to the page), then runs the engine
// modules and the game's own scripts in the order the settings list them. Everything shares one scope,
// so a game script can use the engine's helpers and the engine can call the game's update and render.
// Settings changed in the Studio on this phone are applied on top of game.json (only the ones you changed).
(function () {
  const here = document.currentScript.src.replace(/boot\.js(\?.*)?$/, '');   // the engine folder
  const folder = location.pathname.replace(/\/(index\.html)?$/, '').split('/').pop();
  function phoneEdits() {
    // games made with New game live in games/<folder>, and their edits are kept under that path
    const key = /\/games\/[^/]+\/?(index\.html)?$/.test(location.pathname) ? 'games/' + folder : folder;
    try { const e = JSON.parse(localStorage.getItem('ha.game.' + key) || 'null'); return (e && e.overrides) || {}; } catch (err) { return {}; }
  }
  function apply(game, overrides) {
    for (const path in overrides) {
      const ks = path.split('.'); let o = game;
      try { for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; if (o && ks[ks.length - 1] in o) o[ks[ks.length - 1]] = overrides[path]; } catch (err) {}
    }
    return game;
  }
  const json = (u) => fetch(u, { cache: 'no-cache' }).then(r => r.json());
  // the shared behavior library and symbols come with the engine; a game that doesn't use them simply ignores them
  Promise.all([json('game.json'), json(here + 'behaviors.json').catch(() => ({ behaviors: {} })), json(here + 'symbols.json').catch(() => ({}))]).then(([game, behaviors, symbols]) => {
    window.BEHAVIORS = behaviors; window.SYMBOLS = symbols;
    window.GAME = apply(game, phoneEdits());
    for (const name of game.load) {
      const s = document.createElement('script');
      s.src = name.startsWith('engine/') ? here + name.slice(7) + '.js' : 'scripts/' + name + '.js';
      s.async = false;   // keep the listed order
      document.body.appendChild(s);
    }
  });
})();
