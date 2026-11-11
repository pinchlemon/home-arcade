# Features

A feature is a small add-on to a game: a mechanic, an effect or a rule. It lives in one file and comes with its own controls in the Studio, so the owner can switch it on and off and tune it by touch on her phone. Features are how mechanics get prototyped: Claude writes one, she plays it and tunes it, and then keeps it, changes it or switches it off.

Void Wizard is the first game with features: the Lab (on, see below), Sparkle trail (off) and Custom text (on; changes the title, score label, tip, mode link and the line under each solid). The Studio's Features tab shows them, and its **Ask Claude** button writes a request that she pastes into a Claude Code session.

## The three parts of a feature (example: `trail` in Void Wizard)

1. **The code**, in `<game>/features/<id>.js`:
   ```js
   feature('trail', ({ game, set, on }) => {
     on('frame', (dt) => { /* runs every frame */ });
   });
   ```
   - `game` is what the game hands over (below).
   - `set('rate', 40)` reads one of the feature's settings, and falls back to the number given if the setting is missing. Give words as the fallback (`set('title', 'VOID WIZARD')`) and it reads words instead.
   - `on(event, fn)` hooks into the game.
   - A feature that throws an error shows a red note in the corner, and the game keeps running.
2. **Its numbers**, in `game.json` under `features`:
   ```json
   "features": { "trail": { "on": 0, "rate": 40, "size": 0.5 } }
   ```
   `on` is 1 or 0. `engine/boot.js` loads `features/<id>.js` only when `on` is 1, so a feature that is off costs nothing and changes nothing.
3. **Its controls**, in `studio.json` under `features`:
   ```json
   "features": [{ "id": "trail", "name": "Sparkle trail", "about": "What it does, in one line",
     "fields": [{ "path": "features.trail.rate", "label": "Amount", "help": "Sparks a second", "min": 5, "max": 200, "step": 5 }] }]
   ```
   - The Studio adds the On switch (`features.<id>.on`) by itself.
   - Fields are the same as settings fields: `show: "seconds"` shows frames as seconds, `show: "percent"` shows a 0 to 1 number as a percent, and `show: "onoff"` makes a switch. `show: "text"` is for words: the row shows the words and a pencil to type new ones (`max` is the most letters, 300 if left out; `min` and `step` aren't needed).
   - Changes are kept on the phone and pushed onto `game.json` like any other setting.

Adding a feature means writing these three parts, adding the new file to `PRE` in `sw.js`, and bumping the version (see CLAUDE.md). Keep the feature's default numbers the same in `game.json` and in its `set()` calls.

## Void Wizard: what `game` has

- **Things:** `THREE`, `scene`, `camera`, `player` and `buddy` (the blue and red wizards), `you` and `mate` (whoever you control now, and the other one: the Lab's Party shelf can move control between wizards), `ALL` (the wizards), `orb` (the Solid), `orbMesh` (the group that draws it), `demon`, `demonParts()` (the demon as spheres `{x, y, z, r}`), and `SOLIDS`.
  - `solid` is the current solid. Its `col` is the colour, and it also has `grav`, `hang`, `speed` and the rest.
- **Time and input:** `time`, `keys` (a Set of the `KeyboardEvent.code` values held down), and `pad` (player 1's raw Gamepad, or null). Set `blockPad = true` to take the controller away from the game (the Lab does while it is open). `DUEL` and `PARTY` say which mode is running.
- **A wizard** has `pos`, `vel`, `y`, `vy`, `yaw`, `grounded`, `downT` (more than 0 while knocked down), `charging`, `charge` and `root` (its three.js group).
- **Effects:**
  - `spark(at, vel, life, size, color, drag, gravity)`, `sparkBurst(at, n, speed, size, drag, color)`, and `spawnPuffs(n, speed, at, size)`.
  - `popup(text, at, cssColor)` and `shake(amount)`.
  - `fxRing(x, z, color, radius, seconds)`, `fxPillar(...)`, `fxSphere(...)`, `fxBurst(...)` and `rumble(wizard, strong, weak, ms)`.
- **Actions:** `swapTo(W)` (you take over that wizard; it fires a `swap` event), `makeWizard(robe, trim, glow)`, `joinCrew(W)` and `leaveCrew(W)` (more wizards in the demon game; the demon then goes for whoever is nearest), `brain` (set a function `(W, dt) => input` to drive the wizards you don't control; null keeps the buddy's own brain), `lobTo(W, charge, x, z, quick)`, `shootAt(W)`, `solidSpot(out)` (where the Solid will come down), `demonNearest(p)`, `demonAim(W)`, `LOB_MAX`, `CATCH_R`, `passTarget(W, dx, dz)` (the teammate a pass from W facing that way would go to, or null), `knockDown(W, dx, dz, power)`, `pushBack(W, dx, dz, power)` and `hurtDemon(at, damage, color)`, `hpBar` (the demon's health bar) (`at` is any `{x, y, z}`, such as one of `demonParts()`).
- **Screen:** set `post` to `{ target(renderer), draw(renderer) }` and the finished picture (world and solid, not the HUD) is drawn into `target`'s render target, then `draw` puts it on the screen. `null` (normal) draws straight to the screen. The Look shelf uses it.
- **Multipliers:** `MOD` holds `speed`, `jump`, `gravity`, `time`, `demon` (the demon's full size), `knock` (0: nobody gets knocked down) and `hp` (the demon's health), all 1 normally, and `turn` (0 normally: turns your controls, in radians, to follow a turned camera). For example, `game.MOD.time = 0.5` is slow motion.
- **Events** (`on(name, fn)`):
  - `frame(dt)`, every frame after the world moves and before it is drawn.
  - `camera(camera, lookAt)`, after the game places the camera, so a feature can move or turn it.
  - `jump(W, inAir)`, `land(W)`, `throw(W, charge)`, `catch(W, caught)` (caught is false for a pick-up), `dive(W)`, `tackle(W)` and `knockdown(W)`.
  - `demonHit(damage)` and `demonDown()`.
  - `pass(W, to)` when a helped pass leaves, and `swap(you, old)` when control moves to another wizard.

If a mechanic needs something that isn't listed here, add it to the `FX.game` object or a new `FX.emit(...)` at the end of `void-wizard/scripts/game.js`, and add it to this list. With every feature off, the game must stay identical frame for frame: an `emit` with no listeners does nothing, and the multipliers are exactly 1.

## The Lab (Void Wizard)

The Lab is a feature (`features/lab.js`) that opens a toy box over the game and pauses it (the game reads `MOD.time` as 0 while it is open; Lab settings has Pause while open). D-pad down or the LAB button opens it. Controller: up and down pick, left and right turn (hold R2 for five steps, L2 to jump to the end), L1 and R1 change shelf and holding either shows every shelf in a grid, Cross switches or plays, Square puts the knob back to normal, L3 pins it, R3 shrinks the panel to one slim bar, Triangle rolls the Dice, Select undoes, Start jots down an idea, Circle closes. The panel looks like the app (plates, black readouts, Saira, a ring around what's picked, the app's pixel icons loaded from `app/js/pixel.js`). **The panel does not show the shelf files as they are**: `LAYOUT` at the top of `features/lab.js` groups their knobs into shelves with headings (Game, Wizards, Solids, Demon, Rules, Colours, Camera, Distort, Colour grade, Film, Moments, PS1), by knob id. A new knob goes into `LAYOUT` where it belongs; one left out lands on a More shelf under its file's shelf name. Around them sit Pinned (first; knobs pinned on this phone, `localStorage` `ha.lab.pins`), Presets, On now (every knob that isn't normal), then Saved, Ideas and Lab settings. Saved's first row is the **start mix**: SET makes the game start with the knobs as they are (game.json `lab.start`, a phone edit), and Reset goes back to it. A saved mix is a **prototype**, kept in `game.json` under `lab.prototypes` (a phone edit, pushed like any setting). The Studio's Lab tab lists them (play, rename, note, copy, delete) and holds **ideas** (`lab.ideas`), each with an Ask Claude button.

Knobs are **toys**, kept on **shelves**: one file per shelf in `void-wizard/lab/<shelf>.js`, listed in order in `game.json` `lab.shelves` (and in `PRE` in `sw.js`). Now: time, world, throws (homing), bodies, demon (aggression, white flash), spawn (extra solids you can kick, pick up and throw), camera (Dice leaves it alone; the right stick turns it and `MOD.turn` turns your controls to match), hud (the Screen shelf: words, health bars, solid badge), colours (cloak and trim of both wizards, each solid, and the centipede part by part, from a named palette (new colours go on the end of it, because saved prototypes remember a colour by its place); ORIGINAL puts the game's colour back; Trim height rebuilds both robes from the game's outline with a crisp trim line, and has PS1 low poly rebuild around it through `LAB.lowPoly` and `W.labTrimY`; it finds the centipede's materials by the colours the game made them with, repaints both robes when PS1 low poly has one set aside, and uses `orbLight`/`orbMark` from the game for the thrown solid's light and ground glow), look (one file, the screen shaders on five shelves: Look, Echo, Colour, Tone, Screen; its top comment says how to add one), ps1 (vertex snap and wobble patch every material in the scene, 15-bit colour, fog, low-poly wizards swapped in by geometry, soft shading by swapping toon materials for Lambert ones kept in step each frame), effects (Glow, Print and Moments: bloom, tilt-shift, digital glitch, film looks, impact frames and transitions, borrowed from three.js, gl-transitions and godotshaders.com under free licences listed at its top; it adds stages after the Look shader through `LAB.screen`), rules ("when this, then that": four rules on two shelves; its top comment says how to add a when or a then; new choices go at the end of its lists, because saved prototypes remember a choice by its place), party (the Party shelf: Extra wizards (up to 3, made the first time they're asked for, then joined to and left from `ALL` with `joinCrew`/`leaveCrew`), and a teammate brain set as `game.brain(W, dt)` that drives every wizard you don't control (holding: think, then shoot or pass to whoever is most open; not holding: go for a pass meant for them or a loose Solid they're nearest to, otherwise fan out to the sides and move up into shooting range, backing off from the demon), with sliders for spacing, keep away, shoot or pass, shot range, accuracy, think time and passing to you; Pass magnet bends a pass (`orb.labTo`) to whoever it's for; Pass help sends a standing throw to the teammate you face, through `MOD.passCone`, `MOD.passSpeed` and the game's `pass` event; Auto catch is `MOD.autoCatch`; Switch to moves control with `swapTo`, on a pass or whenever a teammate gets the Solid, and rings who you are; the old ?party mode was removed, `PARTY` is always false and its leftover code never runs), health (health bars, centipede touch damage, knockdown damage; it hooks the `camera` event to place the bars, so it stays after the camera shelf). To add a toy, add it to the shelf it belongs on; for a new kind of toy, add a shelf file.
```js
LAB.shelf('time', 'Time', (game) => [
  { id: 'speed', label: 'Game speed', help: 'Below 1 is slow motion', min: 0.1, max: 3, step: 0.1, value: 1,
    apply: (v) => { game.MOD.time = v; } }
]);
```
- `value` is the normal value. At normal values a toy must change nothing.
- `setting: true` marks a toy that belongs to the Lab itself, not to a mix (Lab settings: Knobs per roll, Roll from, Pause while open, made in `features/lab.js`): saving, loading, Reset and the start mix leave it alone, and it is remembered on the phone in `localStorage` `ha.lab.settings`.
- **Presets** (the second shelf, `game.json` `lab.presets`, a phone edit like the others): whole mixes to flip between while playing, with D-pad left and right when the Lab is closed (the game doesn't use them) or `[` `]` on a keyboard. Each stands alone: loading one puts every other knob back to normal, not to the start mix. They are not prototypes and don't show in the Studio.
- `apply(v)` runs when the value changes; `frame(dt, v, now)` every frame and `camera(camera, lookAt, v, now)` after the camera is placed, both only while the value isn't normal (`now` is real seconds, so they work when time is frozen).
- `kind: 'onoff'` makes a switch. `dice: false` keeps a toy out of the Dice (switches stay out unless `dice: true`). `fmt(v)` shows the value its own way.
- `LAB.get('shelf.id')` reads another toy's value, so toys can work together (spawned solids follow World's solid gravity).
- `LAB.boost('shelf.id', value, seconds)` changes a knob for a while and then puts it back (the rules use it); `LAB.get` sees the boosted value, `LAB.base` the knob itself. The panel and saved prototypes keep the knob itself.
- `help` can be a function of the value, for knobs that pick from a list.
- Borrowed shaders: only ones whose licence allows it (MIT, CC0, BSD), with the author and licence kept next to the code. Godot and Shadertoy code needs turning into WebGL; three.js's own effects drop in (`lib/three-examples`).
- Post-processing materials need `depthTest: false`, or a picture drawn earlier can hide them.
- Patching game materials (dissolve, PS1): keep the material's earlier `onBeforeCompile` and call it first, add a word to `material.userData.labKey`, and set `customProgramCacheKey` to `'lab' + labKey`, so each mix of patches gets its own compiled program.
- A prototype stores only the values that aren't normal, by `shelf.id`, so renaming a toy's id loses it in saved prototypes. To move a toy to another shelf without losing it, give it its full old id (`id: 'look.trails'` on the Echo shelf).

**Ideas Claude has built**: remove them from `lab.ideas` in `game.json` and add their ids to `lab.done`. Her phone keeps its own copy of the list until she next changes it, so `lab.done` is what hides them in the Studio and in the game.

## Another game

Any game can have features:
- list `"engine/features"` first in its `load` list;
- set `FEATURES.game` to what features may touch;
- call `FEATURES.emit(...)` where things happen;
- give `studio.json` a `features` list (an empty list is fine).
