// ---- state ----
let crab, parts, eyes, kills, spawnT, shake, over, overT, camX = 0, look = S.camera.lookAhead, t = 0;
function reset() {
  crab = { x: crab ? crab.x : P.startX, y: GROUND, vx: 0, vy: 0, onGround: true, face: 1, walking: false,
    animT: 0, frame: 0, snapT: 0, snapSide: 1, recoil: 0, coyote: 0, buffer: 0,
    hp: LIFE, invuln: 0, stun: 0, squirt: null, dead: false };
  parts = []; eyes = []; kills = 0; spawnT = S.spawning.startDelay; shake = 0; over = false; overT = 0;
}
reset();

const rnd = (a, b) => a + Math.random() * (b - a);
const onScreen = (x, m = 0) => x > camX - m && x < camX + VW + m;
