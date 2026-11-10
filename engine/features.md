# Features

A feature is a small add-on to a game: a mechanic, an effect or a rule. It lives in one file and comes with its own controls in the Studio, so the owner can switch it on and off and tune it by touch on her phone. Features are how mechanics get prototyped: Claude writes one, she plays it and tunes it, and then keeps it, changes it or switches it off.

Void Wizard is the first game with features: Sparkle trail (off) and Custom text (on; changes the title, score label, tip, mode link and the line under each solid). The Studio's Features tab shows them, and its **Ask Claude** button writes a request that she pastes into a Claude Code session.

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

- **Things:** `THREE`, `scene`, `camera`, `player`, `buddy` and `ALL` (the wizards), `orb` (the Solid), `demon`, and `SOLIDS`.
  - `solid` is the current solid. Its `col` is the colour, and it also has `grav`, `hang`, `speed` and the rest.
- **Time and input:** `time`, `keys` (a Set of the `KeyboardEvent.code` values held down), and `pad` (player 1's raw Gamepad, or null). `DUEL` and `PARTY` say which mode is running.
- **A wizard** has `pos`, `vel`, `y`, `vy`, `yaw`, `grounded`, `downT` (more than 0 while knocked down), `charging`, `charge` and `root` (its three.js group).
- **Effects:**
  - `spark(at, vel, life, size, color, drag, gravity)`, `sparkBurst(at, n, speed, size, drag, color)`, and `spawnPuffs(n, speed, at, size)`.
  - `popup(text, at, cssColor)` and `shake(amount)`.
  - `fxRing(x, z, color, radius, seconds)`, `fxPillar(...)`, `fxSphere(...)`, `fxBurst(...)` and `rumble(wizard, strong, weak, ms)`.
- **Actions:** `knockDown(W, dx, dz, power)` and `pushBack(W, dx, dz, power)`.
- **Multipliers:** `MOD` holds `speed`, `jump`, `gravity` and `time`, all 1 normally. For example, `game.MOD.time = 0.5` is slow motion.
- **Events** (`on(name, fn)`):
  - `frame(dt)`, every frame after the world moves and before it is drawn.
  - `jump(W, inAir)`, `land(W)`, `throw(W, charge)`, `catch(W, caught)` (caught is false for a pick-up), `dive(W)`, `tackle(W)` and `knockdown(W)`.
  - `demonHit(damage)` and `demonDown()`.

If a mechanic needs something that isn't listed here, add it to the `FX.game` object or a new `FX.emit(...)` at the end of `void-wizard/scripts/game.js`, and add it to this list. With every feature off, the game must stay identical frame for frame: an `emit` with no listeners does nothing, and the multipliers are exactly 1.

## Another game

Any game can have features:
- list `"engine/features"` first in its `load` list;
- set `FEATURES.game` to what features may touch;
- call `FEATURES.emit(...)` where things happen;
- give `studio.json` a `features` list (an empty list is fine).
