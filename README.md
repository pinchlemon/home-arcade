# home-arcade

## Home Arcade app (`app/`)

The new Home Arcade: play every game with a controller, and make small games on the phone with the touchscreen. Open https://pinchlemon.github.io/home-arcade/app/ in Safari and use Add to Home Screen. It works offline.

- **Arcade**: the code games in this repo plus every game made in the Studio. D-pad picks, A plays, X edits.
- **Studio**: the level editor. Tiles, objects and events (WHEN → DO cables), scenes in folders, undo, play from any scene.
- **Library**: each game's sprites, tiles and sounds, in folders. The Studio trays read the same Library.
- **Sync**: pushes Studio games to GitHub and pulls changes made elsewhere. Needs a GitHub token (Settings › GitHub) to push.
- **Settings**: controller labels, vibration, deadzone, swap A/B, GitHub, audio, display.

Studio games are saved as one JSON file each in `studio/projects/<id>.json`, so they can be edited here on GitHub too and pulled onto the phone. The format is described at the top of `app/js/store.js`.
