# Hedron (repo: home-arcade)

A no-code game-dev and arcade web app, used on an iPhone 16 Pro (home-screen app, Safari engine) with a GameSir controller. Site: https://pinchlemon.github.io/home-arcade/app/ . Games are played and tested with the controller; development happens by touch on the phone. It must work offline. Function comes before form, with lots of customization. Read `README.md` for what each tab does.

## How we work (the owner's rules)
- Changes go on a branch and are opened as a pull request with `gh api repos/pinchlemon/home-arcade/pulls -f title=... -f head=... -f base=main -F body=@/tmp/prN.md --jq .html_url` (`gh pr create` fails here). The owner merges PRs herself; never push to `main`.
- Commit messages and PR descriptions end with the attribution lines the session gives you.
- **Every change bumps the version in four places**, all to the same new number (`date +%s`): `CACHE` in `sw.js`, `BUILD` in the root `index.html` launcher, `version.json`, and `BUILD` in `app/js/build.js`. The launcher's BUILD must equal version.json or it reload-loops. Without the bump the phone keeps showing the old app.
- New files the app needs offline must be added to the `PRE` list in `sw.js`.
- The GitHub token lives only on the phone (Settings > GitHub, localStorage). Never put it in code.
- Test before opening a PR, and say honestly what was only tested in a browser and not on the phone/controller. Show screenshots of visual work when possible. Keep answers short and plain; she reads on a phone.
- When she names a preference (wording, spacing, colors), match it everywhere, not just in the one place she pointed at.

## Shape of the code
- `app/`: the app. Vanilla ES modules, no build step. `app/js/main.js` is the shell (tabs, press feedback, layout fitting, update check); `screens/` has one file per tab plus `gameEditor.js` (Scene/Backdrop, Objects, Settings, undo/redo), `review.js` (changes before pushing), `sync.js` (push to GitHub, change dots); `games.js` (game list, edits stored on the phone as a list of changed settings, `localStorage` key `ha.game.<folder>`); `padnav.js` (controller ring for full-screen tools); `input.js` (stick/D-pad/keyboard); `ui.js` + `pixel.js` (components and the pixel icon set).
- `engine/`: shared game engine (boot, actors, behaviors, symbols, `listen.html` plays a game's own sounds for the Sound tab).
- `crab-platformer/` is the model game: `game.json` (all numbers/objects/scenes), `studio.json` (what the Studio shows; its art and sound lists), `scripts/` (game code). Its look must never change by accident: the Waves mode was verified frame-for-frame identical after the split. Void Wizard, Phosphor and Purgatory Bowl are plain code games, not yet editable.
- Update flow: the app compares its own `BUILD` with `version.json` on GitHub; idle it reloads itself, inside a full-screen tool it waits until you leave. Settings > Display shows the build time; Update clears saved copies.

## Design system
- Dark plates; round black "wells" with white pixel icons; Saira font; slightly rounded corners (`--r-*` variables in `app/app.css`).
- One color per section: Arcade #ff5a1f (dodecahedron), Studio #7dff6a (cube), Art #ff4fd8 (icosahedron), Sound #4d7cff (octahedron), Settings #ffd23f (tetrahedron).
- Selection uses a ring; pressing a button highlights it like a selected one and only one thing is lit at a time; one soft click sound per press. The page never scrolls; layouts are fit to the screen (rows per page 1 to 4). Landscape has its own layout (tab column left, panel narrow with the shape on top).
- iOS quirks to remember: home-screen apps get less height than the screen (black band), so layout is centered by measurement; iOS Safari hides a controller from a page until a button is pressed (the app tells launched games via `sessionStorage` `ha.pad`); Low Power Mode caps pages at 30 fps.

## Testing
Serve locally with `python3 -m http.server 8765` from the repo root and drive it with Playwright (at 402x874 for portrait, 874x402 or 859x329-395 with side margins for landscape). Fake a controller with an init script that replaces `navigator.getGamepads`. The old test scripts were kept outside the repo and are not available in a fresh session; rewrite what you need.

## Not built yet (ideas the owner approved)
- Pixel and animation editor with bigger sprites (Art tab is view-only today); sound and music editor (Sound tab plays only); "New game" in the Studio (needs a blank template game on the shared engine); tile painting and event cables from the old Studio carried into the new engine; Art and Sound jump links from more places; controller support/hint for the other three games.
- Stated long-term goal: the Studio should recreate her existing games and let her edit them from the app, with simple pixel "symbols" on the phone and the real assets and per-character code kept for the desktop or for Claude.
