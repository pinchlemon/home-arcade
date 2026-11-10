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

- **Things:** `THREE`, `scene`, `camera`, `player`, `buddy` and `ALL` (the wizards), `orb` (the Solid), `orbMesh` (the group that draws it), `demon`, `demonParts()` (the demon as spheres `{x, y, z, r}`), and `SOLIDS`.
  - `solid` is the current solid. Its `col` is the colour, and it also has `grav`, `hang`, `speed` and the rest.
- **Time and input:** `time`, `keys` (a Set of the `KeyboardEvent.code` values held down), and `pad` (player 1's raw Gamepad, or null). Set `blockPad = true` to take the controller away from the game (the Lab does while it is open). `DUEL` and `PARTY` say which mode is running.
- **A wizard** has `pos`, `vel`, `y`, `vy`, `yaw`, `grounded`, `downT` (more than 0 while knocked down), `charging`, `charge` and `root` (its three.js group).
- **Effects:**
  - `spark(at, vel, life, size, color, drag, gravity)`, `sparkBurst(at, n, speed, size, drag, color)`, and `spawnPuffs(n, speed, at, size)`.
  - `popup(text, at, cssColor)` and `shake(amount)`.
  - `fxRing(x, z, color, radius, seconds)`, `fxPillar(...)`, `fxSphere(...)`, `fxBurst(...)` and `rumble(wizard, strong, weak, ms)`.
- **Actions:** `knockDown(W, dx, dz, power)`, `pushBack(W, dx, dz, power)` and `hurtDemon(at, damage, color)` (`at` is any `{x, y, z}`, such as one of `demonParts()`).
- **Screen:** set `post` to `{ target(renderer), draw(renderer) }` and the finished picture (world and solid, not the HUD) is drawn into `target`'s render target, then `draw` puts it on the screen. `null` (normal) draws straight to the screen. The Look shelf uses it.
- **Multipliers:** `MOD` holds `speed`, `jump`, `gravity`, `time`, `demon` (the demon's full size) and `knock` (0: nobody gets knocked down), all 1 normally. For example, `game.MOD.time = 0.5` is slow motion.
- **Events** (`on(name, fn)`):
  - `frame(dt)`, every frame after the world moves and before it is drawn.
  - `camera(camera, lookAt)`, after the game places the camera, so a feature can move or turn it.
  - `jump(W, inAir)`, `land(W)`, `throw(W, charge)`, `catch(W, caught)` (caught is false for a pick-up), `dive(W)`, `tackle(W)` and `knockdown(W)`.
  - `demonHit(damage)` and `demonDown()`.

If a mechanic needs something that isn't listed here, add it to the `FX.game` object or a new `FX.emit(...)` at the end of `void-wizard/scripts/game.js`, and add it to this list. With every feature off, the game must stay identical frame for frame: an `emit` with no listeners does nothing, and the multipliers are exactly 1.

## The Lab (Void Wizard)

The Lab is a feature (`features/lab.js`) that opens a toy box over the running game: D-pad down or the LAB button opens it, the D-pad picks and turns knobs, L1 and R1 change shelf, Triangle rolls the Dice, Square saves, Select undoes, Start (or IDEA) jots down an idea, Circle closes. A saved mix is a **prototype**, kept in `game.json` under `lab.prototypes` (a phone edit, pushed like any setting). The Studio's Lab tab lists them (play, rename, note, copy, delete) and holds **ideas** (`lab.ideas`), each with an Ask Claude button.

Knobs are **toys**, kept on **shelves**: one file per shelf in `void-wizard/lab/<shelf>.js`, listed in order in `game.json` `lab.shelves` (and in `PRE` in `sw.js`). Now: time, world, throws (homing), bodies, demon (aggression, white flash), spawn (extra solids you can kick, pick up and throw), camera, look (one file, two shelves: Look and Colour, the screen shaders), health (health bars, centipede touch damage, knockdown damage; it hooks the `camera` event to place the bars, so it stays after the camera shelf). To add a toy, add it to the shelf it belongs on; for a new kind of toy, add a shelf file.
```js
LAB.shelf('time', 'Time', (game) => [
  { id: 'speed', label: 'Game speed', help: 'Below 1 is slow motion', min: 0.1, max: 3, step: 0.1, value: 1,
    apply: (v) => { game.MOD.time = v; } }
]);
```
- `value` is the normal value. At normal values a toy must change nothing.
- `apply(v)` runs when the value changes; `frame(dt, v, now)` every frame and `camera(camera, lookAt, v, now)` after the camera is placed, both only while the value isn't normal (`now` is real seconds, so they work when time is frozen).
- `kind: 'onoff'` makes a switch. `dice: false` keeps a toy out of the Dice (switches stay out unless `dice: true`). `fmt(v)` shows the value its own way.
- `LAB.get('shelf.id')` reads another toy's value, so toys can work together (spawned solids follow World's solid gravity).
- A prototype stores only the values that aren't normal, by `shelf.id`, so renaming a toy's id loses it in saved prototypes.

**Ideas Claude has built**: remove them from `lab.ideas` in `game.json` and add their ids to `lab.done`. Her phone keeps its own copy of the list until she next changes it, so `lab.done` is what hides them in the Studio and in the game.

## Another game

Any game can have features:
- list `"engine/features"` first in its `load` list;
- set `FEATURES.game` to what features may touch;
- call `FEATURES.emit(...)` where things happen;
- give `studio.json` a `features` list (an empty list is fine).
