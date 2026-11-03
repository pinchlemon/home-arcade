# home-arcade

## Hedron app (`app/`)

Hedron (the repo is still called home-arcade, so the web address is unchanged): play every game with a controller, and make small games on the phone with the touchscreen. Open https://pinchlemon.github.io/home-arcade/app/ in Safari and use Add to Home Screen. It works offline.

- **Arcade**: every game in this repo. The game you select here is the one the Studio, Art and Sound tabs work on (marked Editing). D-pad picks, A plays, X edits.
- **Studio**: the selected game and its parts (Change game goes back to the Arcade). Edit opens the game editor: Scene (with a Backdrop view of the background layers), Objects (reusable templates and their behaviors) and Settings.
- **Art**: the current game's pictures in folders (sprites, props, backdrop) and the pixel symbols its objects use. View them big; sprite sheets play their animations.
- **Sound**: the current game's sound effects and music, played by the game's own sound code (`engine/listen.html`).
- **Settings**: controller, Sync (push your changes to GitHub; the tab shows a dot when there is something to push), GitHub token, audio, display.

Studio, Art and Sound share one game: the one selected in the Arcade. A game opens in them when it has a `game.json` and a `studio.json` (see `crab-platformer/`): `studio.json` says which settings the Studio shows and lists the game's art and sound. Changes made on the phone are kept as a list of changed settings and pushed onto `game.json`.
