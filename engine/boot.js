// Starts a Studio game: reads the game's settings (game.json, next to the page), then runs the engine
// modules and the game's own scripts in the order the settings list them. Everything shares one scope,
// so a game script can use the engine's helpers and the engine can call the game's update and render.
(function () {
  const here = document.currentScript.src.replace(/boot\.js(\?.*)?$/, '');   // the engine folder
  fetch('game.json', { cache: 'no-cache' }).then(r => r.json()).then(game => {
    window.GAME = game;
    for (const name of game.load) {
      const s = document.createElement('script');
      s.src = name.startsWith('engine/') ? here + name.slice(7) + '.js' : 'scripts/' + name + '.js';
      s.async = false;   // keep the listed order
      document.body.appendChild(s);
    }
  });
})();
