// Features: small add-ons to a game (a mechanic, an effect, a rule), each in its own file, each with an on/off
// switch and its own settings in the Studio. See engine/features.md for how to write one.
// The game lists "engine/features" before its own scripts in game.json's load list, and hands over what features
// may touch as FEATURES.game. engine/boot.js then loads features/<id>.js for every feature that is on.
(function () {
  const hooks = {}, settings = (window.GAME && window.GAME.features) || {};
  // a feature that breaks says so on screen, instead of stopping the game
  function report(err, id) {
    console.error('Feature ' + (id || '') + ':', err);
    let el = document.getElementById('feature-error');
    if (!el) { el = document.createElement('div'); el.id = 'feature-error'; el.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:70vw;z-index:99;font:600 11px/1.3 system-ui,sans-serif;color:#fff;background:rgba(160,20,40,.85);padding:6px 9px;border-radius:6px;pointer-events:none'; document.body.appendChild(el); }
    el.textContent = 'Feature ' + (id ? '"' + id + '" ' : '') + 'went wrong: ' + (err && err.message || err);
  }
  const FX = window.FEATURES = {
    game: null,       // set by the game: what features can reach
    running: [],      // ids of the features that started
    on(name, fn, id) { (hooks[name] = hooks[name] || []).push({ fn, id }); },
    emit(name, a, b, c) { const h = hooks[name]; if (h) for (const x of h) { try { x.fn(a, b, c); } catch (e) { report(e, x.id); } } }
  };
  // features/<id>.js calls feature('<id>', ({ game, set, on }) => { ... })
  window.feature = function (id, make) {
    const s = settings[id]; if (!s || !s.on) return;
    const set = (key, fallback) => (typeof fallback === 'string' ? (typeof s[key] === 'string' ? s[key] : fallback)
      : typeof s[key] === 'number' && isFinite(s[key]) ? s[key] : fallback);   // words for words, numbers for numbers
    try { make({ game: FX.game, set, on: (name, fn) => FX.on(name, fn, id), id }); FX.running.push(id); } catch (e) { report(e, id); }
  };
})();
