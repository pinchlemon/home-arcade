# Crab Platformer

The game is split so the Studio can change it without touching its code:

- `game.json`: the settings. Physics, the crab, the lemon squirt, the eyes, spawning, the camera, the beach and the background's scroll speeds. Changing a number here changes the game.
- `assets/`: the art. The crab's sprite sheet, and the palm tree, umbrella, sandcastle, city skyline, sand and cloud as plain images you can redraw.
- `scripts/`: the code that is special to this game, like the claw squeeze, the juice, the eye's veins, eyelids and nerve, the beach backdrop, the sounds and the bossa nova track.
- `../engine/`: the parts every Studio game shares, like starting up, the screen and zoom, the controls and controller, the sound helpers, pixel drawing and the frame loop.

`game.json` lists the order the engine and scripts load in. The split was checked frame by frame against the original, with the same random seed and button presses, and every frame matched.
