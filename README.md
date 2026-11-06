# home-arcade

## Hedron app (`app/`)

Hedron (the repo is still called home-arcade, so the web address is unchanged): play every game with a controller, and make small games on the phone with the touchscreen. Open https://pinchlemon.github.io/home-arcade/app/ in Safari and use Add to Home Screen. It works offline.

- **Arcade**: every game in this repo. The game you select here is the one the Studio, Art and Sound tabs work on (marked Editing). D-pad picks, A plays, X edits.
- **Studio**: the selected game and its parts (Change game goes back to the Arcade). Edit opens the game editor: Scene (with a Backdrop view of the background layers), Objects (reusable templates and their behaviors) and Settings.
- **Art**: the current game's pictures in folders (sprites, props, backdrop) and the pixel symbols its objects use. View them big; sprite sheets play their animations. **Draw** opens the sprite editor (Aseprite-style: pencil, eraser, fill, colour picker, palette, layers, frames, onion skin, tags, playback, undo; pinch to zoom, two-finger tap to undo; select by box, lasso or magic wand, move, copy/cut/paste, flip, turn and scale; canvas size, trim, crop, scale and turn the whole sprite; import a picture or an .aseprite file; export PNG, sprite sheet, animated GIF or .aseprite through the share sheet). A new sprite can also start from a file. **+** adds a new sprite to a folder. Drawings are kept on the phone as an `.aseprite` file plus the `.png` the game reads, show up in the game straight away, and go to GitHub from Sync (new sprites are added to `studio.json`).
- **Sound**: the current game's sound effects and music, played by the game's own sound code (`engine/listen.html`).
- **Settings**: controller, Sync (push your changes to GitHub; the tab shows a dot when there is something to push), GitHub token, audio, display.
- **Icons**: hold any pixel icon button for half a second to redraw its icon (draw, resize 3 to 12 pixels, undo, back to the original). Redrawn icons show everywhere and are kept on this phone (`ha.icons`); they are not pushed to GitHub. Controller: D-pad moves, A flips a pixel, X saves, B cancels.

Studio, Art and Sound share one game: the one selected in the Arcade. A game opens in them when it has a `game.json` and a `studio.json` (see `crab-platformer/`): `studio.json` says which settings the Studio shows and lists the game's art and sound. Changes made on the phone are kept as a list of changed settings and pushed onto `game.json`.
