// Rebuilt from Crab_Platformer.gbsproj (sprite frames, palettes with GBC colour correction,
// platformer physics, A/B snap scripts, 4 life points), then polished and extended with eye enemies.
const GAME = window.GAME;   // the game's settings (game.json), read before any script runs
const W = GAME.screen.width, H = GAME.screen.height, GROUND = GAME.screen.ground;   // the original Game Boy screen
// Zoomed-out views show more of the world; pixels are only ever scaled by whole numbers.
const ZOOMS = GAME.screen.zooms;
let zoom = 0, VW = 160, VH = 144, OY = 0;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const LANDSCAPE = matchMedia('(pointer: coarse) and (orientation: landscape)');
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cs = getComputedStyle(document.body);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const bar = document.querySelector('.titlebar').offsetHeight;
  let availW, availH;
  if (document.body.classList.contains('console')) {
    // console mode: fill the display, keep the aspect ratio
    const s = Math.min((document.body.clientWidth - padX) / VW, (document.body.clientHeight - padY) / VH);
    cv.style.width = VW * s + 'px'; cv.style.height = VH * s + 'px';
    document.querySelector('.window').style.width = VW * s + 'px';
    return;
  }
  if (LANDSCAPE.matches) {
    // the screen gets the middle; each side column keeps ~140px for the buttons
    availW = document.documentElement.clientWidth - padX - 2 * 140 - 2 * 20;
    availH = document.body.clientHeight - padY - bar - 4;
  } else {
    availW = Math.min(document.documentElement.clientWidth - 32, 1100);
    availH = window.innerHeight - 190;   // leave room for the controls below
  }
  availW = Math.max(160, availW) * dpr; availH = Math.max(144, availH) * dpr;
  // whole device pixels per game pixel keeps the pixel art crisp
  const scale = Math.max(1, Math.floor(Math.min(availW / VW, availH / VH))) / dpr;
  cv.style.width = VW * scale + 'px'; cv.style.height = VH * scale + 'px';
  document.querySelector('.window').style.width = VW * scale + 'px';
}
LANDSCAPE.addEventListener ? LANDSCAPE.addEventListener('change', fitCanvas) : LANDSCAPE.addListener(fitCanvas);
function setZoom(z) {
  zoom = z; [VW, VH] = ZOOMS[z]; OY = VH - H;
  cv.width = VW; cv.height = VH; ctx.imageSmoothingEnabled = false;
  document.querySelectorAll('.zoom button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.z === z)));
  try { localStorage.setItem('crab-zoom', z); } catch (e) {}
  fitCanvas();
}
addEventListener('resize', fitCanvas);
document.querySelectorAll('.zoom button').forEach(b => b.addEventListener('click', () => setZoom(+b.dataset.z)));
