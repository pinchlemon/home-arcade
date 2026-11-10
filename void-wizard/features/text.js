// Custom text: change the words the game shows (title, score label, tip, mode link, and the line under each solid).
// Each setting replaces what the game writes; left at the game's own words, nothing changes.
feature('text', ({ game, set, on }) => {
  const $ = (id) => document.getElementById(id);
  // [element, what the game starts it with, what to show instead]. The game rewrites some of these while you
  // play (the score after every demon), so the start is swapped again whenever the game changes the text.
  const lines = [
    [document.querySelector('.hud h1'), 'VOID WIZARD', set('title', 'VOID WIZARD')],
    [$('score'), 'DEMONS DOWN', set('score', 'DEMONS DOWN')],
    [$('modeLink'), 'TRY THE PARTY RELAY', set('link', 'TRY THE PARTY RELAY')]
  ];
  const written = new Map();
  function swap(el, from, to) {
    if (!el || from === to) return;
    const t = el.textContent;
    if (written.get(el) === t || !t.startsWith(from)) return;
    let rest = t.slice(from.length);
    if (!to) rest = rest.replace(/^[\s:·]+/, '');   // an empty label drops its colon too
    el.textContent = to + rest; written.set(el, el.textContent);
    if (!el.textContent) el.style.display = 'none';   // nothing left to show: no empty box either
  }

  // the tip under the controls (only the main demon mode has this one; Duel and Party write their own)
  const tip = $('tip'), tipText = set('tip', tip ? tip.textContent : '');
  if (tip && !game.DUEL && !game.PARTY && tipText !== tip.textContent) { tip.textContent = tipText; if (!tipText) tip.style.display = 'none'; }

  // the line under each solid's name in the corner badge: the game redraws the badge from these whenever the
  // solid changes, so swapping them is enough; the badge as the page first shows it is fixed once here
  // (the game writes the badge as HTML, so the words are made safe for that first)
  const safe = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const before = game.solid && game.solid.tag;
  ['fire', 'earth', 'air', 'aether', 'water'].forEach((k, i) => { const S = game.SOLIDS[i]; if (S && set(k, S.tag) !== S.tag) S.tag = safe(set(k, S.tag)); });
  const badgeLine = document.querySelector('#solidName span');
  if (badgeLine && before && game.solid.tag !== before) badgeLine.innerHTML = game.solid.tag;

  on('frame', () => { for (const [el, from, to] of lines) swap(el, from, to); });
});
