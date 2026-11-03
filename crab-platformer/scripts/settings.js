// ---- physics: the project's engine values (1/4096 px units), plus a little forgiveness ----
// All of these now come from game.json, so the Studio can change them. (Physics there is already in pixels per frame.)
const S = GAME, P = S.player;
const WALK_ACC = P.walkAccel, DEC = P.stopDecel, WALK_MAX = P.walkMax;
const GRAV = P.gravity, HOLD_GRAV = P.holdJumpGravity, JUMP_VEL = P.jumpSpeed, MAX_FALL = P.maxFall;
const COYOTE = P.coyoteFrames, JUMP_BUFFER = P.jumpBufferFrames;
const IDLE_TICKS = P.idleFrameTicks, WALK_TICKS = P.walkFrameTicks;
const SNAP_FRAMES = S.squirt.snapFrames, SNAP_COOLDOWN = S.squirt.cooldownFrames, RECOIL_FRAMES = S.squirt.recoilFrames;
const LIFE = P.lives;                 // "Life Points" variable in the project
const EYE_HP = S.eyes.hp, CHARGE = S.eyes.chargeFrames, AIM_LOCK = S.eyes.aimLockFrames, FIRE = S.eyes.fireFrames;

const ROW = { moveLeft: 0, moveRight: 1, idleLeft: 2, idleRight: 3 };

// Which scene is playing: ?scene=<id> (the Studio's Play button), else the first one in game.json.
// A "waves" scene is the endless beach; a "level" scene is laid out by hand in the Studio.
const SCENES = S.scenes || [{ id: 'beach', kind: 'waves' }];
const SCENE = SCENES.find(s => s.id === new URLSearchParams(location.search).get('scene')) || SCENES[0];
const LEVEL = SCENE.kind === 'level' ? SCENE : null;
// Objects: reusable templates in game.json; a level places copies by object id. Older levels listed props and enemies.
const objOf = (t) => (S.objects || {})[t.obj] || { base: t.obj };
const LEVEL_THINGS = LEVEL ? (LEVEL.things || [...(LEVEL.props || []).map(p => ({ obj: p.type, x: p.x })), ...(LEVEL.enemies || []).map(p => ({ obj: p.type, x: p.x, h: p.h }))]) : null;
// an eye's numbers: the game's eye settings, with any changes made for that object on top
const EYE_DEFAULT = S.eyes;

// outer tip of the lemon in each claw, per frame: [leftX, leftY, rightX, rightY]
const TIPS = {"0,0": [6, 7, 40, 7], "0,1": [6, 8, 40, 6], "0,2": [6, 7, 40, 7], "0,3": [6, 6, 40, 8], "1,0": [6, 8, 40, 6], "1,1": [6, 7, 40, 7], "1,2": [6, 6, 40, 8], "1,3": [6, 7, 40, 7], "2,0": [6, 7, 40, 7], "2,1": [6, 8, 40, 6], "2,2": [6, 7, 40, 7], "2,3": [6, 6, 40, 8], "3,0": [6, 8, 40, 6], "3,1": [6, 7, 40, 7], "3,2": [6, 6, 40, 8], "3,3": [6, 7, 40, 7], "11,0": [6, 7, 40, 7], "11,1": [6, 7, 40, 7]};
const SPARK = [".y.", "yky", ".y."];
const DROP = ["hj", "jd"];
const HEART = [".kk.kk.", "krrkrrk", "krrrrrk", ".krrrk.", "..krk..", "...k..."];
const HEART_EMPTY = [".kk.kk.", "k..k..k", "k.....k", ".k...k.", "..k.k..", "...k..."];
const EYE_ICON = ["..kkk..", ".kwwwk.", "kwwiiwk", "kwwikwk", ".kwwwk.", "..kkk.."];
const COLS = { k: INK, y: YEL, r: RED, p: PINK, w: CREAM, i: IRIS, d: JUICE_DK, j: JUICE, h: JUICE_HI };
const FONT = {
  A: [".#.","#.#","###","#.#","#.#"], E: ["###","#..","##.","#..","###"], G: [".##","#..","#.#","#.#",".##"],
  J: ["..#","..#","..#","#.#",".#."], M: ["#.#","###","###","#.#","#.#"], O: [".#.","#.#","#.#","#.#",".#."],
  P: ["##.","#.#","##.","#..","#.."], R: ["##.","#.#","##.","#.#","#.#"], S: [".##","#..",".#.","..#","##."],
  U: ["#.#","#.#","#.#","#.#","###"], V: ["#.#","#.#","#.#","#.#",".#."], X: ["#.#","#.#",".#.","#.#","#.#"],
  0: ["###","#.#","#.#","#.#","###"], 1: [".#.","##.",".#.",".#.","###"], 2: ["##.","..#",".#.","#..","###"],
  3: ["##.","..#",".#.","..#","##."], 4: ["#.#","#.#","###","..#","..#"], 5: ["###","#..","##.","..#","##."],
  6: [".##","#..","###","#.#","###"], 7: ["###","..#",".#.",".#.",".#."], 8: ["###","#.#","###","#.#","###"],
  9: ["###","#.#","###","..#","##."], D: ["##.","#.#","#.#","#.#","##."],
  C: [".##","#..","#..","#..",".##"], L: ["#..","#..","#..","#..","###"], I: ["###",".#.",".#.",".#.","###"], N: ["##.","#.#","#.#","#.#","#.#"],
  T: ["###",".#.",".#.",".#.",".#."], W: ["#.#","#.#","###","###","#.#"], H: ["#.#","#.#","###","#.#","#.#"], Y: ["#.#","#.#",".#.",".#.",".#."],
  K: ["#.#","#.#","##.","#.#","#.#"], B: ["##.","#.#","##.","#.#","##."], '!': [".#.",".#.",".#.","...",".#."], ' ': ["...","...","...","...","..."],
};
