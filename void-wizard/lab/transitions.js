// Screen transitions from gl-transitions (https://gl-transitions.com, npm gl-transitions 3.2.0), unchanged.
// Each one's author and license are listed with it (all MIT). The package licence:
// MIT License
// 
// Copyright (c) 2017-present gl-transitions contributors
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// 
// Note: Individual transitions in the transitions/ directory may have their own
// license specified in their file header comments. When no license is specified,
// the transition is covered by this MIT license.
window.LAB_TRANSITIONS = [
 {
  "name": "GravityLens",
  "author": "gre",
  "license": "MIT",
  "types": {
   "center": "vec2",
   "strength": "float",
   "glow": "float",
   "hole": "vec4"
  },
  "params": {
   "center": [
    0.5,
    0.5
   ],
   "strength": 0.6,
   "glow": 0.6,
   "hole": [
    0,
    0,
    0,
    1
   ]
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: A black disk appears and grows, bending the outgoing image around it like a heavy mass bends light: the image is stretched into a bright ring at the disk's edge and swallowed until the frame is black, then the disk shrinks back, unbending the incoming image\n// Tags: distort, lens, space, circular, dark\n\n// Center of the disk\nuniform vec2 center; // = vec2(0.5, 0.5)\n// @range(0, 1.5) How strongly the light bends: radius of the lensed ring beyond the disk's edge, in disk radii\nuniform float strength; // = 0.6\n// @range(0, 1) Brightness of the lensed ring and of the thin ring of light hugging the disk's edge\nuniform float glow; // = 0.6\n// @color Color of the disk\nuniform vec4 hole; // = vec4(0.0, 0.0, 0.0, 1.0)\n\n// how far past the farthest corner the disk grows, so the frame is fully covered for a brief moment\nconst float OVERSHOOT = 0.12;\n// moment the frame is black: the swallow takes a little longer than the release\nconst float PEAK = 0.55;\n// half width of the antialiased edge of the disk, in frame heights\nconst float AA = 0.002;\n// tint of the light piled up around the disk\nconst vec3 WARM = vec3(1.0, 0.86, 0.68);\n\n// fold the coordinates back into the frame, so the image stays filled without smearing its border\nvec2 mirrored(vec2 v) {\n  vec2 m = mod(v, 2.0);\n  return mix(m, 2.0 - m, step(1.0, m));\n}\n\nvec4 transition(vec2 uv) {\n  // the disk grows with an accelerating swallow, then shrinks back a little faster: exactly 0 at both ends\n  bool swallowing = progress < PEAK;\n  float u = swallowing ? progress / PEAK : (1.0 - progress) / (1.0 - PEAK);\n  float u2 = u * u;\n  float k = u2 * (0.6 + 0.4 * u2);\n\n  // measured in frame heights, so the disk is round\n  vec2 aspect = vec2(ratio, 1.0);\n  vec2 far = max(center, 1.0 - center) * aspect;\n  float rh = length(far) * (1.0 + OVERSHOOT) * k;\n  // radius where the light coming from right behind the disk shows up as a ring\n  float re = rh * (1.0 + max(strength, 0.0));\n\n  vec2 d = (uv - center) * aspect;\n  float r = max(length(d), 1e-5);\n  // a point mass deflects the light by an angle falling off as 1/r\n  vec2 q = mirrored(center + d * (1.0 - re * re / (r * r)) / aspect);\n  vec4 c = swallowing ? getFromColor(q) : getToColor(q);\n  // the shading fades in with the disk, so it is exactly 0 at both ends\n  float amount = smoothstep(0.0, 0.04, rh);\n  // the second, flipped image squeezed between the ring and the disk is dimmer\n  float inner = clamp((r - rh) / (re - rh + 1e-4), 0.0, 1.0);\n  c.rgb *= 1.0 - 0.7 * amount * (1.0 - inner * inner * (3.0 - 2.0 * inner));\n\n  // light piles up into a ring where the image is most stretched, and into a thin ring hugging the edge\n  float g = max(glow, 0.0) * amount;\n  float einstein = (r - re) / (0.3 * (re - rh) + 0.01);\n  float photon = max(r - rh, 0.0) / (0.006 + 0.012 * rh);\n  float light = g * (0.7 * exp(-einstein * einstein) + 1.6 * exp(-photon * photon));\n  c.rgb = min(c.rgb * (1.0 + light) + WARM * (0.35 * light * c.a), vec3(1.0));\n\n  // antialiased horizon, kept inside the disk so it vanishes with it\n  float cov = clamp((rh - r) / (2.0 * AA), 0.0, 1.0);\n  return mix(c, hole, cov);\n}\n"
 },
 {
  "name": "Vortex",
  "author": "gre",
  "license": "MIT",
  "types": {
   "grid": "int",
   "center": "vec2",
   "spin": "float",
   "randomness": "float"
  },
  "params": {
   "grid": 24,
   "center": [
    0.5,
    0.5
   ],
   "spin": 1,
   "randomness": 0.2
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: The outgoing image breaks into hundreds of small squares that a tornado carries away along a spiral around the center, from the eye outward, uncovering the incoming image\n// Tags: tiles, spiral, rotation, shatter\n\n// @range(4, 40, 1) Number of rows of squares\nuniform int grid; // = 24\n// Center of the tornado\nuniform vec2 center; // = vec2(0.5, 0.5)\n// @range(-4, 4) Turns each square makes around the center as it flies away (negative turns clockwise)\nuniform float spin; // = 1.0\n// @range(0, 1) How randomly the squares leave: 0 from the center outward, 1 in any order\nuniform float randomness; // = 0.2\n\n// the squares leave in GROUPS waves, each one flying for DURATION of the transition\nconst int GROUPS = 24;\nconst float DURATION = 0.25;\n// half width of the antialiased edge of the squares, in frame heights\nconst float AA = 0.0015;\nconst float TAU = 6.2831853;\n\nfloat hash(vec2 n) {\n  return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453);\n}\n\n// the wave a square (by its cell index) leaves with\nint groupOf(vec2 n, float h, vec2 c, float maxR) {\n  // only the very corners leave last\n  float r = min(length((n + 0.5) * h - c) / (0.85 * maxR), 1.0);\n  float key = clamp(mix(r * sqrt(r), hash(n), clamp(randomness, 0.0, 1.0)), 0.0, 0.9999);\n  return int(floor(key * float(GROUPS)));\n}\n\n// local time of a wave's flight, 0 before it leaves, 1 once it has vanished\nfloat flight(int g) {\n  float delay = float(g) / float(GROUPS) * (1.0 - DURATION);\n  return clamp((progress - delay) / DURATION, 0.0, 1.0);\n}\n\nvec4 premultiplied(vec4 c) {\n  return vec4(c.rgb * c.a, c.a);\n}\n\nvec4 transition(vec2 uv) {\n  if (progress <= 0.0) return getFromColor(uv);\n  if (progress >= 1.0) return getToColor(uv);\n\n  // measured in square pixels, so the squares stay square\n  vec2 aspect = vec2(ratio, 1.0);\n  vec2 p = uv * aspect;\n  vec2 c = center * aspect;\n  float maxR = max(max(length(c), length(c - vec2(ratio, 0.0))), max(length(c - vec2(0.0, 1.0)), length(c - aspect)));\n  float h = 1.0 / float(grid < 1 ? 1 : grid);\n  // how far a square is pushed away from the center by the end of its flight\n  float reach = 0.7 * maxR;\n\n  // the incoming image, under the squares that have not left yet\n  vec2 n0 = floor(p / h);\n  vec4 col = flight(groupOf(n0, h, c, maxR)) <= 0.0 ? premultiplied(getFromColor(uv)) : premultiplied(getToColor(uv));\n\n  // the flying squares, painted from the last wave to leave (lowest) to the first (highest)\n  for (int k = 0; k < GROUPS; k++) {\n    int g = GROUPS - 1 - k;\n    float s = flight(g);\n    if (s <= 0.0 || s >= 1.0) continue;\n    float e = s * s;\n    // like in a tornado, the squares near the eye (the first to leave) spin much faster than\n    // the outer ones; all of them orbit before they are flung out\n    float angle = spin * TAU * e * 2.0 / (1.0 + 6.0 * float(g) / float(GROUPS));\n    float push = reach * e * s;\n    // the squares lift toward the viewer, then shrink away\n    float size = (1.0 + 0.35 * sin(3.1415927 * s)) * (1.0 - s * s * s);\n    float ca = cos(angle);\n    float sa = sin(angle);\n    mat2 rot = mat2(ca, sa, -sa, ca);\n    // undo the wave's spiral to guess which square lands here, then test its neighbors exactly\n    vec2 u = (p - c) * rot;\n    float ru = length(u);\n    vec2 guess = c + (ru > 0.0 ? u / ru : vec2(0.0)) * max(ru - push, 0.0);\n    vec2 ng = floor(guess / h);\n    for (int j = -1; j <= 1; j++) {\n      for (int i = -1; i <= 1; i++) {\n        vec2 n = ng + vec2(float(i), float(j));\n        if (groupOf(n, h, c, maxR) != g) continue;\n        vec2 home = (n + 0.5) * h;\n        vec2 rel = home - c;\n        float rr = length(rel);\n        vec2 dir = rr > 0.0 ? rel / rr : vec2(0.0);\n        vec2 pos = c + rot * (dir * (rr + push));\n        // each square also tumbles on itself\n        float tumble = angle + (hash(n + 17.0) - 0.5) * 3.0 * e * sign(spin);\n        float ct = cos(tumble);\n        float st = sin(tumble);\n        vec2 d = ((p - pos) * mat2(ct, st, -st, ct)) / max(size, 1e-4);\n        float edge = 0.5 * h - max(abs(d.x), abs(d.y));\n        float cov = clamp(edge * size / (2.0 * AA) + 0.5, 0.0, 1.0);\n        vec2 src = home + d;\n        if (cov <= 0.0 || src.x < 0.0 || src.y < 0.0 || src.x > ratio || src.y > 1.0) continue;\n        vec4 piece = premultiplied(getFromColor(src / aspect)) * cov;\n        col = piece + col * (1.0 - piece.a);\n      }\n    }\n  }\n  return col.a > 0.0 ? vec4(col.rgb / col.a, col.a) : vec4(0.0);\n}\n"
 },
 {
  "name": "WarpSpeed",
  "author": "gre",
  "license": "MIT",
  "types": {
   "center": "vec2",
   "streaks": "float",
   "streakColor": "vec4",
   "strength": "float",
   "flash": "float"
  },
  "params": {
   "center": [
    0.5,
    0.5
   ],
   "streaks": 160,
   "streakColor": [
    0.78,
    0.88,
    1,
    1
   ],
   "strength": 0.6,
   "flash": 0.5
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: The camera jumps to light speed: star streaks shoot out from the center and stretch longer and longer while the outgoing image is pulled into a radial smear, then after a flash the incoming image emerges from the center as the streaks shrink back\n// Tags: zoom, radial, light, motion-blur, space\n\n// @param Point the camera flies toward, from (0, 0) at the bottom left to (1, 1) at the top right\nuniform vec2 center; // = vec2(0.5, 0.5)\n// @range(20, 400) Number of star streaks around the center\nuniform float streaks; // = 160.0\n// @color Color of the streaks and of the flash, added as light\nuniform vec4 streakColor; // = vec4(0.78, 0.88, 1.0, 1.0)\n// @range(0, 1) Length of the streaks and of the radial smear\nuniform float strength; // = 0.6\n// @range(0, 1) Brightness of the flash at the peak of the jump\nuniform float flash; // = 0.5\n\nconst float PI = 3.141592653589793;\nconst int TAPS = 12;\n\nfloat hash(vec2 p) {\n  vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n  p3 += dot(p3, p3.yzx + 33.33);\n  return fract((p3.x + p3.y) * p3.z);\n}\n\n// one layer of stars: one per angular cell, flying outward and stretched along its ray\nfloat stars(float a, float r, float n, float layer, float travel, float speed, float reach) {\n  float cell = floor(a * n);\n  float h1 = hash(vec2(cell, layer));\n  float h2 = hash(vec2(cell, layer + 17.0));\n  float h3 = hash(vec2(cell, layer + 31.0));\n  // where the star is in its flight, from near the center to past the corners,\n  // speeding up as it comes closer\n  float life = fract(h1 + travel * (0.6 + 0.8 * h2));\n  float head = reach * (0.05 + 1.05 * pow(life, 1.4));\n  // the streak is the path of the star during the exposure: longer when the camera is faster\n  float tail = head * (1.0 - min(0.9, speed * (0.15 + 0.5 * h3)));\n  float along = clamp((r - tail) / max(head - tail, 1e-4), 0.0, 1.0);\n  float inside = step(tail, r) * (1.0 - smoothstep(head - 0.006, head, r));\n  // brightest at the head, fading toward the tail\n  float profile = inside * along * along;\n  // thin across the ray, a bit wider away from the center, with a faint halo,\n  // faded out before the edges of the cell so that no seam shows between cells\n  float f = fract(a * n);\n  float cellWidth = 2.0 * PI * r / n;\n  float offset = 0.3 + 0.4 * h3;\n  float across = (f - offset) * cellWidth;\n  float width = min(0.0014 + 0.002 * r / reach, 0.15 * cellWidth);\n  float x = across * across / (width * width);\n  float line = (exp(-x) + 0.25 * exp(-x / 9.0)) * smoothstep(0.0, 0.2, min(f, 1.0 - f));\n  // fade in from far away, out past the frame, and only some cells hold a star\n  float fade = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.9, 1.0, life));\n  return profile * line * fade * (0.4 + 0.6 * h2) * step(0.25, hash(vec2(cell, layer + 43.0)));\n}\n\n// an image pulled into a radial smear toward the center: scaled by k, blurred over a fraction b\nvec4 smear(vec2 uv, float k, float b, float jitter, bool incoming) {\n  if (b <= 0.0 && k >= 1.0) {\n    vec4 c = incoming ? getToColor(uv) : getFromColor(uv);\n    return vec4(c.rgb * c.a, c.a);\n  }\n  vec4 sum = vec4(0.0);\n  for (int i = 0; i < TAPS; i++) {\n    float s = k * (1.0 - b * (float(i) + jitter) / float(TAPS));\n    vec2 q = center + (uv - center) * s;\n    vec4 c = incoming ? getToColor(q) : getFromColor(q);\n    sum += vec4(c.rgb * c.a, c.a);\n  }\n  return sum / float(TAPS);\n}\n\nvec4 transition(vec2 uv) {\n  float p = progress;\n  vec2 aspect = vec2(ratio, 1.0);\n  vec2 d = (uv - center) * aspect;\n  float r = length(d);\n  // (nudged off zero, where atan is undefined)\n  float a = atan(d.y, d.x + 1e-6) / (2.0 * PI) + 0.5;\n  // distance from the center to the farthest corner\n  vec2 far = max(center, 1.0 - center) * aspect;\n  float reach = length(far);\n\n  // the camera speeds up to the jump, at the middle, then slows down\n  float speed = sin(PI * p);\n  speed *= speed;\n  float travel = 3.0 * (p - sin(2.0 * PI * p) / (2.0 * PI));\n  float jitter = hash(floor(uv * aspect * 997.0));\n\n  // the outgoing image is pulled forward into the smear; the incoming one arrives\n  // magnified and smeared, and settles\n  float goOut = smoothstep(0.0, 0.55, p);\n  float goIn = 1.0 - smoothstep(0.45, 1.0, p);\n  // the incoming image emerges from the center and spreads out to the corners\n  float soft = 0.35 * reach;\n  float edge = mix(-soft, reach + soft, smoothstep(0.42, 0.78, p));\n  float m = 1.0 - smoothstep(edge - soft, edge, r);\n  vec4 before = vec4(0.0);\n  vec4 after = vec4(0.0);\n  if (m < 1.0) before = smear(uv, 1.0 - 0.3 * strength * goOut * goOut, 0.6 * strength * goOut, jitter, false);\n  if (m > 0.0) after = smear(uv, 1.0 - 0.3 * strength * goIn * goIn, 0.6 * strength * goIn, jitter, true);\n  vec4 c = mix(before, after, m);\n  // darker while in the jump, so that the streaks stand out, and brighter soon after it\n  // so the incoming image comes out clear\n  float dark = p < 0.5 ? speed : speed * speed * speed;\n  c.rgb *= 1.0 - 0.65 * (0.5 + 0.5 * strength) * dark;\n\n  // the streaks: two layers of stars, their length growing with the speed\n  float n = max(floor(streaks), 1.0);\n  float len = speed * (0.5 + 1.5 * strength);\n  float s = stars(a, r, n, 1.0, travel, len, reach);\n  s += stars(fract(a + 0.37), r, max(floor(n * 0.71), 1.0), 2.0, travel * 1.3, len, reach);\n  // the flash, brightest at the center, where the incoming image emerges\n  float core = r / (0.35 * reach);\n  float peak = (p - 0.5) * 9.0;\n  float glow = flash * exp(-peak * peak) * speed * (0.35 + 0.9 * exp(-core * core));\n  vec3 light = streakColor.rgb * streakColor.a * (2.2 * s * speed + glow);\n  // light is added to the image, but adds no opacity\n  return c.a > 0.0 ? vec4(clamp(c.rgb / c.a + light, 0.0, 1.0), c.a) : vec4(0.0);\n}\n"
 },
 {
  "name": "DoomMelt",
  "author": "Zeh Fernando",
  "license": "MIT",
  "types": {
   "bars": "int",
   "amplitude": "float",
   "noise": "float",
   "frequency": "float",
   "dripScale": "float"
  },
  "params": {
   "bars": 30,
   "amplitude": 2,
   "noise": 0.1,
   "frequency": 0.5,
   "dripScale": 0.5
  },
  "glsl": "// Author: Zeh Fernando\n// License: MIT\n// Description: The outgoing image melts down in uneven columns, like the Doom screen wipe\n// Tags: melt, columns, retro\n\n\n// Transition parameters --------\n\n// Number of total bars/columns\nuniform int bars; // = 30\n\n// Multiplier for speed ratio. 0 = no variation when going down, higher = some elements go much faster\nuniform float amplitude; // = 2\n\n// Further variations in speed. 0 = no noise, 1 = super noisy (ignore frequency)\nuniform float noise; // = 0.1\n\n// Speed variation horizontally. the bigger the value, the shorter the waves\nuniform float frequency; // = 0.5\n\n// How much the bars seem to \"run\" from the middle of the screen first (sticking to the sides). 0 = no drip, 1 = curved drip\nuniform float dripScale; // = 0.5\n\n\n// The code proper --------\n\nfloat rand(int num) {\n  return fract(mod(float(num) * 67123.313, 12.0) * sin(float(num) * 10.3) * cos(float(num)));\n}\n\nfloat wave(int num) {\n  float fn = float(num) * frequency * 0.1 * float(bars);\n  return cos(fn * 0.5) * cos(fn * 0.13) * sin((fn+10.0) * 0.3) / 2.0 + 0.5;\n}\n\nfloat drip(int num) {\n  return sin(float(num) / float(bars - 1) * 3.141592) * dripScale;\n}\n\nfloat pos(int num) {\n  return (noise == 0.0 ? wave(num) : mix(wave(num), rand(num), noise)) + (dripScale == 0.0 ? 0.0 : drip(num));\n}\n\nvec4 transition(vec2 uv) {\n  int bar = int(uv.x * (float(bars)));\n  float scale = 1.0 + pos(bar) * amplitude;\n  float phase = progress * scale;\n  float posY = uv.y / vec2(1.0).y;\n  vec2 p;\n  vec4 c;\n  if (phase + posY < 1.0) {\n    p = vec2(uv.x, uv.y + mix(0.0, vec2(1.0).y, phase)) / vec2(1.0).xy;\n    c = getFromColor(p);\n  } else {\n    p = uv.xy / vec2(1.0).xy;\n    c = getToColor(p);\n  }\n\n  // Finally, apply the color\n  return c;\n}\n"
 },
 {
  "name": "CrossZoom",
  "author": "rectalogic",
  "license": "MIT",
  "types": {
   "strength": "float"
  },
  "params": {
   "strength": 0.4
  },
  "glsl": "// License: MIT\n// Author: rectalogic\n// Description: A crossfade through a strong zoom blur\n// Tags: zoom, blur, blend\n// ported by gre from https://gist.github.com/rectalogic/b86b90161503a0023231\n\n// Converted from https://github.com/rectalogic/rendermix-basic-effects/blob/master/assets/com/rendermix/CrossZoom/CrossZoom.frag\n// Which is based on https://github.com/evanw/glfx.js/blob/master/src/filters/blur/zoomblur.js\n// With additional easing functions from https://github.com/rectalogic/rendermix-basic-effects/blob/master/assets/com/rendermix/Easing/Easing.glsllib\n\n// @range(0, 1) Blur strength\nuniform float strength; // = 0.4\n\nconst float PI = 3.141592653589793;\n\nfloat Linear_ease(in float begin, in float change, in float duration, in float time) {\n    return change * time / duration + begin;\n}\n\nfloat Exponential_easeInOut(in float begin, in float change, in float duration, in float time) {\n    if (time == 0.0)\n        return begin;\n    else if (time == duration)\n        return begin + change;\n    time = time / (duration / 2.0);\n    if (time < 1.0)\n        return change / 2.0 * pow(2.0, 10.0 * (time - 1.0)) + begin;\n    return change / 2.0 * (-pow(2.0, -10.0 * (time - 1.0)) + 2.0) + begin;\n}\n\nfloat Sinusoidal_easeInOut(in float begin, in float change, in float duration, in float time) {\n    return -change / 2.0 * (cos(PI * time / duration) - 1.0) + begin;\n}\n\nfloat rand (vec2 co) {\n  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n}\n\nvec4 crossFade(in vec2 uv, in float dissolve) {\n    return mix(getFromColor(uv), getToColor(uv), dissolve);\n}\n\nvec4 transition(vec2 uv) {\n    vec2 texCoord = uv.xy / vec2(1.0).xy;\n\n    // Linear interpolate center across center half of the image\n    vec2 center = vec2(Linear_ease(0.25, 0.5, 1.0, progress), 0.5);\n    float dissolve = Exponential_easeInOut(0.0, 1.0, 1.0, progress);\n\n    // Mirrored sinusoidal loop. 0->strength then strength->0\n    float strength = Sinusoidal_easeInOut(0.0, strength, 0.5, progress);\n\n    vec4 color = vec4(0.0);\n    float total = 0.0;\n    vec2 toCenter = center - texCoord;\n\n    /* randomize the lookup values to hide the fixed number of samples */\n    float offset = rand(uv);\n\n    for (float t = 0.0; t <= 40.0; t++) {\n        float percent = (t + offset) / 40.0;\n        float weight = 4.0 * (percent - percent * percent);\n        color += crossFade(texCoord + toCenter * percent * strength, dissolve) * weight;\n        total += weight;\n    }\n    return color / total;\n}\n"
 },
 {
  "name": "Swirl",
  "author": "Sergey Kosarevsky",
  "license": "MIT",
  "types": {
   "strength": "float",
   "radius": "float",
   "center": "vec2"
  },
  "params": {
   "strength": 1,
   "radius": 0.9,
   "center": [
    0.5,
    0.5
   ]
  },
  "glsl": "// License: MIT\n// Author: Sergey Kosarevsky\n// Description: The image twists into a round swirl around the center that peaks mid-way, where the outgoing image dissolves into the incoming one, then untwists\n// Tags: swirl, rotate, blend\n// ( http://www.linderdaum.com )\n// ported by gre from https://gist.github.com/corporateshark/cacfedb8cca0f5ce3f7c\n\n// @range(-3, 3) Turns of the swirl at its center at the peak (negative turns clockwise)\nuniform float strength; // = 1.0\n// @range(0.1, 2) Radius of the swirl, in frame heights\nuniform float radius; // = 0.9\n// Center of the swirl\nuniform vec2 center; // = vec2(0.5, 0.5)\n\nconst float PI = 3.141592653589793;\nconst float TAU = 6.283185307179586;\n// how much the swirl pulls the image toward its center at the peak\nconst float ZOOM = 0.12;\n// spread of the motion blur, as a fraction of the swirl's speed\nconst float BLUR = 0.05;\nconst int TAPS = 12;\n\n// fold the coordinates back into the frame, so the image stays filled without smearing its border\nvec2 mirrored(vec2 v) {\n  vec2 m = mod(v, 2.0);\n  return mix(m, 2.0 - m, step(1.0, m));\n}\n\nvec4 transition(vec2 uv) {\n  // the swirl eases in and out, and is exactly 0 at both ends\n  float s = sin(PI * progress);\n  float amount = s * s;\n  // its speed, used for the motion blur, also 0 at both ends\n  float speed = PI * sin(TAU * progress);\n  // the switch from the outgoing to the incoming image happens around the peak\n  float reveal = smoothstep(0.3, 0.7, progress);\n\n  // measured in frame heights, so the swirl is round\n  vec2 aspect = vec2(ratio, 1.0);\n  vec2 d = (uv - center) * aspect;\n  float x = clamp(length(d) / max(radius, 1e-3), 0.0, 1.0);\n  // the twist fades out smoothly toward the edge of the swirl\n  float falloff = (1.0 - x) * (1.0 - x);\n  float twist = strength * TAU * falloff;\n  float angle = twist * amount;\n  // capped so the blur taps never spread apart into visible streaks\n  float spread = clamp(twist * speed * BLUR, -1.2, 1.2);\n  // the swirl also slightly pulls the image toward its center\n  d *= 1.0 - ZOOM * amount * falloff;\n\n  vec4 col = vec4(0.0);\n  float total = 0.0;\n  for (int i = 0; i < TAPS; i++) {\n    float k = float(i) / float(TAPS - 1) - 0.5;\n    float w = 1.0 - abs(k);\n    float a = angle + spread * k;\n    float c = cos(a);\n    float sn = sin(a);\n    vec2 q = mirrored(center + vec2(c * d.x - sn * d.y, sn * d.x + c * d.y) / aspect);\n    col += mix(getFromColor(q), getToColor(q), reveal) * w;\n    total += w;\n  }\n  return col / total;\n}\n"
 },
 {
  "name": "Ripple",
  "author": "gre",
  "license": "MIT",
  "types": {
   "amplitude": "float",
   "speed": "float"
  },
  "params": {
   "amplitude": 100,
   "speed": 50
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: Ripples spread from the center while crossfading\n// Tags: ripple, wave, blend\n// @param Frequency of the ripples\nuniform float amplitude; // = 100.0\n// @param Speed of the ripples\nuniform float speed; // = 50.0\n\nvec4 transition (vec2 uv) {\n  vec2 dir = uv - vec2(.5);\n  float dist = length(dir);\n  vec2 offset = dir * (sin(progress * dist * amplitude - progress * speed) + .5) / 30. * progress;\n  return mix(\n    getFromColor(uv + offset),\n    getToColor(uv),\n    smoothstep(0.2, 1.0, progress)\n  );\n}\n"
 },
 {
  "name": "Shatter",
  "author": "lbl",
  "license": "MIT",
  "types": {
   "center": "vec2",
   "shards": "float",
   "gravity": "float",
   "seed": "float"
  },
  "params": {
   "center": [
    0.5,
    0.5
   ],
   "shards": 6,
   "gravity": 1,
   "seed": 0
  },
  "glsl": "// Author: lbl\n// License: MIT\n// Description: The outgoing image cracks like a pane of glass from an impact point, then its shards break loose from the impact outward, tumbling in 3D and falling away with gravity to reveal the incoming image behind\n// Tags: shatter, fragments, glass, 3d\n\n// @param Impact point where the cracks start, from (0, 0) at the bottom left to (1, 1) at the top right\nuniform vec2 center; // = vec2(0.5, 0.5)\n// @range(3, 8) Approximate number of rows of shards across the height of the frame\nuniform float shards; // = 6.0\n// @range(0.5, 3) Strength of the gravity: the shards fall faster, and break loose over a longer time\nuniform float gravity; // = 1.0\n// @param Random seed: another value gives other shards, tumbling another way\nuniform float seed; // = 0.0\n\n// distance from the camera to the pane, as a part of the frame's height\nconst float EYE = 2.5;\n// how far the corners of the shards are moved from a regular grid, as a part of a cell\nconst float JITTER = 0.32;\n// width of the anti-aliased edges, the crack lines and the bevels, as a part of the frame's height\nconst float EDGE = 0.0012;\nconst float CRACK_WIDTH = 0.0025;\nconst float BEVEL = 0.006;\n\nvec3 hash32(vec2 p) {\n  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));\n  p3 += dot(p3, p3.yxz + 33.33);\n  return fract((p3.xxy + p3.yzz) * p3.zyx);\n}\n\nfloat cellSize() {\n  return 1.0 / clamp(shards, 3.0, 8.0);\n}\n\nvec2 seedOffset() {\n  return vec2(37.0, 17.0) * floor(seed);\n}\n\n// a corner of the cracks: the point p of a grid, moved at random\nvec2 corner(vec2 p) {\n  return (p + JITTER * (2.0 * hash32(p + seedOffset()).xy - 1.0)) * cellSize();\n}\n\n// signed distance from q to the line a -> b, positive on its left\nfloat side(vec2 q, vec2 a, vec2 b) {\n  vec2 d = b - a;\n  return (d.x * (q.y - a.y) - d.y * (q.x - a.x)) / length(d);\n}\n\n// the cell c is cut into two triangular shards along one of its diagonals, picked at random\nbool diagonalUp(vec2 c) {\n  return hash32(c + seedOffset() + 0.5).z > 0.5;\n}\n\n// distance from q to the edges of the triangle p0 p1 p2 (counterclockwise), positive inside\nfloat triangleDist(vec2 q, vec2 p0, vec2 p1, vec2 p2) {\n  return min(min(side(q, p0, p1), side(q, p1, p2)), side(q, p2, p0));\n}\n\n// the shard that contains q on the unbroken pane: (its cell, its triangle, the distance from q to its nearest crack)\nvec4 locate(vec2 q) {\n  vec2 c = floor(q / cellSize());\n  // the cells' sides are not straight: step to the neighbor cell when q is beyond one of them\n  vec2 a, b, cc, d;\n  for (int i = 0; i < 2; i++) {\n    a = corner(c);\n    b = corner(c + vec2(1.0, 0.0));\n    cc = corner(c + 1.0);\n    d = corner(c + vec2(0.0, 1.0));\n    c.x += side(q, d, a) < 0.0 ? -1.0 : (side(q, b, cc) < 0.0 ? 1.0 : 0.0);\n    a = corner(c);\n    b = corner(c + vec2(1.0, 0.0));\n    cc = corner(c + 1.0);\n    d = corner(c + vec2(0.0, 1.0));\n    c.y += side(q, a, b) < 0.0 ? -1.0 : (side(q, cc, d) < 0.0 ? 1.0 : 0.0);\n  }\n  a = corner(c);\n  b = corner(c + vec2(1.0, 0.0));\n  cc = corner(c + 1.0);\n  d = corner(c + vec2(0.0, 1.0));\n  bool up = diagonalUp(c);\n  float d0 = up ? triangleDist(q, a, b, cc) : triangleDist(q, a, b, d);\n  float d1 = up ? triangleDist(q, a, cc, d) : triangleDist(q, b, cc, d);\n  return vec4(c, d1 > d0 ? 1.0 : 0.0, abs(max(d0, d1)));\n}\n\n// Rodrigues' rotation of v around the unit axis k\nvec3 rotate(vec3 v, vec3 k, float angle) {\n  float c = cos(angle), s = sin(angle);\n  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);\n}\n\nvec2 impact() {\n  return clamp(center, 0.0, 1.0) * vec2(ratio, 1.0);\n}\n\n// distance from the impact to the farthest corner of the frame\nfloat reach() {\n  vec2 c = impact();\n  return length(max(c, vec2(ratio, 1.0) - c));\n}\n\n// how far below its center a shard must fall to leave the frame\nfloat fallMargin() {\n  return 0.1 + 1.5 * cellSize();\n}\n\n// the time a shard breaks loose: the nearer the impact the sooner, and late enough to fall out of the frame by the end\n// (dn: its distance to the impact, as a part of the reach)\nfloat releaseTime(vec2 mid, float dn, float h, float g, float margin) {\n  float latest = max(0.98 - sqrt(2.0 * (mid.y + margin) / g), 0.04);\n  return 0.04 + (latest - 0.04) * (0.8 * pow(dn, 0.8) + 0.2 * h);\n}\n\n// a flash at the impact, at the start\nfloat flash(vec2 q) {\n  float f = sin(3.141592653589793 * clamp(progress / 0.12, 0.0, 1.0));\n  vec2 d = q - impact();\n  return 0.6 * f * exp(-dot(d, d) / (0.004 + 0.02 * progress));\n}\n\nvec4 transition(vec2 uv) {\n  if (progress <= 0.0) return getFromColor(uv);\n  if (progress >= 1.0) return getToColor(uv);\n  float s = cellSize();\n  vec2 a = vec2(uv.x * ratio, uv.y);\n  vec3 eye = vec3(0.5 * ratio, 0.5, -EYE);\n  vec3 ray = vec3(a, 0.0) - eye;\n  vec3 light = normalize(vec3(-0.35, 0.55, -1.0));\n  vec3 halfway = normalize(light - normalize(ray));\n  float g = 12.0 * clamp(gravity, 0.5, 3.0);\n  vec2 imp = impact();\n  float rch = reach();\n  float margin = fallMargin();\n  // the cracks run from the impact to the farthest corner, before the last shards break loose\n  float crackTime = clamp(0.6 * (0.94 - sqrt(2.0 * (1.0 + margin) / g)), 0.05, 0.22);\n\n  // the part of the pane still in place, behind the loose shards\n  vec4 pane = vec4(0.0);\n  float paneDepth = 1e9;\n  vec4 here = locate(a);\n  vec2 hc = here.xy;\n  vec2 ha = corner(hc), hb = corner(hc + vec2(1.0, 0.0)), hcc = corner(hc + 1.0), hd = corner(hc + vec2(0.0, 1.0));\n  bool hup = diagonalUp(hc);\n  vec2 hcenter = here.z < 0.5 ? (hup ? ha + hb + hcc : ha + hb + hd) : (hup ? ha + hcc + hd : hb + hcc + hd);\n  vec3 hh = hash32(hc + vec2(0.31, 0.57) * (here.z + 1.0) + seedOffset());\n  hcenter /= 3.0;\n  if (progress < releaseTime(hcenter, clamp(length(hcenter - imp) / rch, 0.0, 1.0), hh.x, g, margin)) {\n    vec4 col = getFromColor(uv);\n    float crack = clamp((progress - crackTime * length(a - imp) / rch) / 0.03, 0.0, 1.0);\n    // cracked shards settle at slightly different angles (no change while flat: dot(n, light) = -light.z)\n    vec3 n = rotate(vec3(0.0, 0.0, -1.0), normalize(vec3(hh.yz - 0.5, 0.0) + 1e-4), 0.06 * crack * (hh.x - 0.5));\n    col.rgb *= 1.0 + 1.2 * (dot(n, light) + light.z);\n    col.rgb += crack * 0.35 * pow(max(dot(n, halfway), 0.0), 400.0) * col.a;\n    float line = crack * (1.0 - smoothstep(0.0, CRACK_WIDTH, here.w));\n    col.rgb = mix(col.rgb, vec3(0.95, 0.98, 1.0) * col.a, 0.85 * line);\n    pane = col;\n    paneDepth = 1.0;\n  }\n\n  // the two nearest loose shards: depth along the ray, color, coverage\n  float t1 = 1e9, t2 = 1e9;\n  vec4 c1 = vec4(0.0), c2 = vec4(0.0);\n  float a1 = 0.0, a2 = 0.0;\n  float shadow = 0.0;\n\n  // the shards that broke loose, searched in the cells around and above the pixel since they fall,\n  // looking a bit toward the impact and the middle since they drift away and grow toward the camera\n  vec2 look = a - 0.06 * progress * (a - imp) / rch - (a - eye.xy) * 0.06 * progress;\n  vec2 g0 = floor(look / s) - 1.0;\n  float rows = ceil(1.0 / s);\n  for (int ri = 0; ri < 11; ri++) {\n    float j = g0.y + float(ri);\n    if (j > rows) break;\n    if (j < -1.0) continue;\n    for (int ci = 0; ci < 3; ci++) {\n      vec2 c = vec2(g0.x + float(ci), j);\n      vec2 ca = corner(c), cb = corner(c + vec2(1.0, 0.0)), ccc = corner(c + 1.0), cd = corner(c + vec2(0.0, 1.0));\n      bool up = diagonalUp(c);\n      for (int k = 0; k < 2; k++) {\n        // the corners of the triangle k of the cell, counterclockwise\n        vec2 p0 = (k == 1 && !up) ? cb : ca;\n        vec2 p1 = k == 0 ? cb : ccc;\n        vec2 p2 = (k == 0 && up) ? ccc : cd;\n        vec2 mid = (p0 + p1 + p2) / 3.0;\n        vec3 h1 = hash32(c + vec2(0.31, 0.57) * float(k + 1) + seedOffset());\n        vec2 away = mid - imp;\n        float dist = length(away);\n        float dn = clamp(dist / rch, 0.0, 1.0);\n        float e = progress - releaseTime(mid, dn, h1.x, g, margin);\n        if (e <= 0.0) continue;\n        vec3 h2 = hash32(c + vec2(0.73, 0.19) * float(k + 1) + seedOffset());\n        // pushed away from the impact and toward the camera, spinning around a random axis, falling\n        float near = 1.0 - dn;\n        vec3 vel = vec3(away / max(dist, 1e-3) * (0.03 + 0.08 * h1.y) * (0.4 + near), -(0.05 + 0.2 * near * h1.z));\n        vec3 pos = vec3(mid, 0.0) + vel * e - vec3(0.0, 0.5 * g * e * e, 0.0);\n        // already out of the frame\n        if (pos.y + 1.5 * s < -0.05) continue;\n        vec3 axis = normalize(vec3(h2.x - 0.5, h2.y - 0.5, 0.3 * (h2.z - 0.5)) + 1e-4);\n        float angle = (3.0 + 5.0 * h2.z) * (h2.x < 0.5 ? -1.0 : 1.0) * e;\n        vec3 n = rotate(vec3(0.0, 0.0, -1.0), axis, angle);\n        float rel = smoothstep(0.0, 0.04, e);\n\n        // the camera ray, hidden behind the pane still in place\n        float den = dot(ray, n);\n        float t = dot(pos - eye, n) / (abs(den) > 1e-4 ? den : 1e-4);\n        vec2 q = mid + rotate(eye + t * ray - pos, axis, -angle).xy;\n        float border = min(min(q.x, ratio - q.x), min(q.y, 1.0 - q.y));\n        float inside = triangleDist(q, p0, p1, p2);\n        float ed = min(inside, border);\n        if (t > 0.0 && t < t2 && t < paneDepth && ed > 0.0) {\n          vec3 nf = den > 0.0 ? -n : n;\n          vec4 col = getFromColor(vec2(q.x / ratio, q.y));\n          col.rgb *= mix(1.0, clamp(dot(nf, light) / -light.z, 0.45, 1.1), rel);\n          float glint = max(dot(nf, halfway), 0.0);\n          col.rgb += rel * 0.3 * pow(glint, 60.0) * col.a;\n          // the crack line it carried turns into a bright bevel\n          float line = 0.85 * (1.0 - smoothstep(0.0, CRACK_WIDTH, inside)) * (1.0 - rel);\n          float bevel = 0.8 * rel * (1.0 - smoothstep(0.0, BEVEL, ed)) * (0.3 + 0.7 * pow(glint, 6.0));\n          col.rgb = mix(col.rgb, vec3(0.92, 0.97, 0.97) * col.a, max(line, bevel));\n          float cover = mix(1.0, smoothstep(0.0, 2.0 * EDGE, ed), rel);\n          if (t < t1) {\n            t2 = t1; c2 = c1; a2 = a1;\n            t1 = t; c1 = col; a1 = cover;\n          } else {\n            t2 = t; c2 = col; a2 = cover;\n          }\n        }\n\n        // the shadow on the pane and on the incoming image behind\n        float lden = dot(light, n);\n        float ts = dot(pos - vec3(a, 0.0), n) / (abs(lden) > 1e-4 ? lden : 1e-4);\n        vec2 qs = mid + rotate(vec3(a, 0.0) + ts * light - pos, axis, -angle).xy;\n        float eds = min(triangleDist(qs, p0, p1, p2), min(min(qs.x, ratio - qs.x), min(qs.y, 1.0 - qs.y)));\n        if (ts > 0.0 && eds > 0.0) {\n          shadow = max(shadow, rel * smoothstep(0.0, 0.004 + 0.08 * ts, eds) * 0.45 * (1.0 - smoothstep(0.1, 0.9, ts)));\n        }\n      }\n    }\n  }\n\n  // the incoming image behind, then the pane still in place, then the loose shards in front\n  vec4 back = getToColor(uv);\n  back.rgb *= 1.0 - shadow;\n  pane.rgb *= 1.0 - shadow;\n  if (paneDepth == 1.0) back = pane;\n  vec4 color = c1 * a1 + c2 * min(a2, 1.0 - a1) + back * max(1.0 - a1 - a2, 0.0);\n  color.rgb += flash(a) * color.a;\n  return color;\n}\n"
 },
 {
  "name": "InkBleed",
  "author": "gre",
  "license": "MIT",
  "types": {
   "drops": "float",
   "tendrils": "float",
   "rim": "float",
   "seed": "float"
  },
  "params": {
   "drops": 4,
   "tendrils": 0.7,
   "rim": 0.5,
   "seed": 3
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: The incoming image spreads over the outgoing one like drops of ink in water, blooming from a few points with curling, wispy edges and a darker rim, until it fills the frame\n// Tags: ink, organic, fluid, noise\n\n// @range(1, 8, 1) Number of ink drops\nuniform float drops; // = 4.0\n// @range(0, 1) How far the curling tendrils reach out of the blooms\nuniform float tendrils; // = 0.7\n// @range(0, 1) How dark the rim of ink at the front of the blooms is\nuniform float rim; // = 0.5\n// @param Random seed for the drop positions and the swirls\nuniform float seed; // = 3.0\n\nfloat hash (vec2 p) {\n  vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n  p3 += dot(p3, p3.yzx + 33.33);\n  return fract((p3.x + p3.y) * p3.z);\n}\n\nfloat vnoise (vec2 p) {\n  vec2 i = floor(p);\n  vec2 f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  return mix(\n    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),\n    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),\n    f.y\n  );\n}\n\nfloat fbm (vec2 p) {\n  float v = 0.0;\n  float a = 0.5;\n  for (int i = 0; i < 4; i++) {\n    v += a * vnoise(p);\n    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;\n    a *= 0.5;\n  }\n  return v / 0.9375;\n}\n\nvec2 fold (vec2 p) {\n  return 1.0 - abs(1.0 - mod(p, 2.0));\n}\n\nvec4 transition (vec2 uv) {\n  float p = progress;\n  vec2 q = vec2(uv.x * ratio, uv.y);\n  // swirls: noise warped twice by itself, drifting as the ink spreads\n  vec2 o = vec2(seed * 3.1, seed * 1.7);\n  vec2 sq = q * 2.2 + o;\n  vec2 w1 = vec2(fbm(sq + vec2(0.0, 0.6 * p)), fbm(sq + vec2(5.2, 1.3) - vec2(0.5 * p, 0.0)));\n  vec2 w2 = vec2(fbm(sq + 3.0 * w1 + vec2(1.7, 9.2)), fbm(sq + 3.0 * w1 + vec2(8.3, 2.8)));\n  float swirl = fbm(sq * 0.8 + 2.5 * w2) - 0.5; // marbled, curling pattern\n  vec2 flow = w2 - 0.5;\n  float amp = 0.05 + 0.35 * tendrils;\n  float n = clamp(floor(drops + 0.5), 1.0, 8.0);\n  float rimW = 0.1;\n  float feather = 0.05; // soft, diluted ink around the front\n  float margin = 1.2 * amp + rimW + 0.08; // how far the swirls can pull the front back\n  float f = -1e3; // > 0 inside the ink\n  float fs = -1e3; // the same, only for the drops already fallen, which fades their haze in\n  for (int i = 0; i < 8; i++) {\n    float fi = float(i);\n    if (fi < n) {\n      vec2 hs = vec2(fi * 7.13 + seed, fi * 3.71 - seed);\n      vec2 c = vec2(mix(0.15, 0.85, hash(hs)) * ratio, mix(0.15, 0.85, hash(hs + 19.7)));\n      float start = 0.2 * fi / n;\n      float s = clamp((p - start) / (1.0 - start), 0.0, 1.0);\n      // distance to the farthest corner: each bloom alone covers the frame in the end\n      vec2 m = max(c, vec2(ratio, 1.0) - c);\n      float far = length(m) + margin;\n      float s3 = s * s * s;\n      float r = (far + 0.02) * s * (0.35 + 0.65 * s3 * s3) - 0.02;\n      // a drop starts round, then its front curls more and more as it spreads\n      float reach = amp * min(1.0, max(r, 0.0) * 5.0);\n      float g = r - length(q - c + 1.3 * reach * flow) + reach * 0.9 * swirl;\n      f = max(f, g);\n      fs = max(fs, g - 0.15 * (1.0 - min(1.0, s * 12.0)));\n    }\n  }\n  float aa = 0.003;\n  float inside = smoothstep(-aa, aa, f);\n  // feathered wisps of diluted ink, streaked along the swirls, ahead of the front\n  float wisp = 1.0 - smoothstep(0.0, 0.08, abs(fbm(sq * 2.0 + 5.0 * w2) - 0.5));\n  float soft = smoothstep(-feather, 0.0, fs) * (0.35 + 0.4 * wisp);\n  float haze = 0.35 * wisp * (1.0 - smoothstep(0.0, 0.1, -fs));\n  float cover = max(inside, max(soft, haze));\n  // the ink is denser, and still moving, close to its front\n  float edge = 1.0 - smoothstep(0.0, rimW, f);\n  vec4 to = getToColor(fold(uv - 0.015 * edge * flow / vec2(ratio, 1.0)));\n  to.rgb = mix(to.rgb, to.rgb * to.rgb * 0.7, rim * edge);\n  return mix(getFromColor(uv), to, cover);\n}\n"
 },
 {
  "name": "PerlinDissolve",
  "author": "Rich Harris",
  "license": "MIT",
  "types": {
   "scale": "float",
   "smoothness": "float",
   "seed": "float"
  },
  "params": {
   "scale": 4,
   "smoothness": 0.01,
   "seed": 12.9898
  },
  "glsl": "// Author: Rich Harris\n// License: MIT\n// Description: The incoming image appears through blobs of Perlin noise\n// Tags: noise, dissolve\n\n// @param Scale of the noise; higher values make smaller blobs\nuniform float scale; // = 4.0\n// @param Softness of the blob edges\nuniform float smoothness; // = 0.01\n\n// @param Random seed\nuniform float seed; // = 12.9898\n\n// http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/\nfloat random(vec2 co)\n{\n    float a = seed;\n    float b = 78.233;\n    float c = 43758.5453;\n    float dt= dot(co.xy ,vec2(a,b));\n    float sn= mod(dt,3.14);\n    return fract(sin(sn) * c);\n}\n\n// 2D Noise based on Morgan McGuire @morgan3d\n// https://www.shadertoy.com/view/4dS3Wd\nfloat noise (in vec2 st) {\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n\n    // Four corners in 2D of a tile\n    float a = random(i);\n    float b = random(i + vec2(1.0, 0.0));\n    float c = random(i + vec2(0.0, 1.0));\n    float d = random(i + vec2(1.0, 1.0));\n\n    // Smooth Interpolation\n\n    // Cubic Hermine Curve.  Same as SmoothStep()\n    vec2 u = f*f*(3.0-2.0*f);\n    // u = smoothstep(0.,1.,f);\n\n    // Mix 4 coorners porcentages\n    return mix(a, b, u.x) +\n            (c - a)* u.y * (1.0 - u.x) +\n            (d - b) * u.x * u.y;\n}\n\nvec4 transition (vec2 uv) {\n  vec4 from = getFromColor(uv);\n  vec4 to = getToColor(uv);\n  float n = noise(uv * scale);\n\n  float p = mix(-smoothness, 1.0 + smoothness, progress);\n  float lower = p - smoothness;\n  float higher = p + smoothness;\n\n  float q = smoothstep(lower, higher, n);\n\n  return mix(\n    from,\n    to,\n    1.0 - q\n  );\n}\n"
 },
 {
  "name": "PlasmaDissolve",
  "author": "gre",
  "license": "MIT",
  "types": {
   "scale": "float",
   "smoothness": "float",
   "flow": "float",
   "edgeColor": "vec3",
   "edgeStrength": "float"
  },
  "params": {
   "scale": 3,
   "smoothness": 0.1,
   "flow": 1,
   "edgeColor": [
    1,
    0.45,
    0.9
   ],
   "edgeStrength": 0.6
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: A flowing plasma of sine waves, as in the old demos, draws moving bands through which the incoming image spreads like tendrils, with a glowing edge\n// Tags: wipe, plasma, organic, glow\n\n// @range(0.5, 10) Size of the plasma: higher values make more, thinner bands\nuniform float scale; // = 3.0\n// @range(0, 0.5) Softness of the band edges\nuniform float smoothness; // = 0.1\n// @range(0, 1) How much the plasma flows during the transition (at most 1, so a revealed area never goes back)\nuniform float flow; // = 1.0\n// @color Color of the glow along the edges\nuniform vec3 edgeColor; // = vec3(1.0, 0.45, 0.9)\n// @range(0, 2) Strength of the glow along the edges\nuniform float edgeStrength; // = 0.6\n\nconst float PI = 3.14159265;\n\nvec4 transition(vec2 uv) {\n  vec4 a = getFromColor(uv);\n  vec4 b = getToColor(uv);\n  if (progress <= 0.0) return a;\n  if (progress >= 1.0) return b;\n\n  // measured in square pixels, so the waves are not stretched\n  vec2 p = (uv - 0.5) * vec2(ratio, 1.0) * max(scale, 0.0) * 2.0 * PI;\n  // the phase of the waves; the folded plasma below then changes by at most 0.9 * flow per\n  // unit of progress, slower than the threshold, so the reveal never goes back\n  float t = clamp(flow, 0.0, 1.0) * progress * 0.5;\n  // the classic plasma: sines of x, y, a diagonal and the distance to an off-center point\n  float v = sin(p.x * 0.6 + t)\n    + sin(p.y * 0.8 - t * 0.8)\n    + sin((p.x * 0.5 + p.y * 0.7) * 0.7 + t * 0.6)\n    + sin(length(p - vec2(0.15, -0.1) * max(scale, 0.0) * 2.0 * PI) * 0.9 - t * 1.2);\n  // folded into bands in [0, 1]\n  v = abs(fract(v * 0.25 + 0.5) * 2.0 - 1.0);\n\n  // the soft edge is fully below every band at the start and above every band at the end\n  float s = max(smoothness, 0.001);\n  float threshold = mix(-s, 1.0 + s, progress);\n  // > 0 where the incoming image shows\n  float m = 1.0 - smoothstep(threshold - s, threshold + s, v);\n\n  // mixed premultiplied, so transparent images do not bleed their color\n  vec4 col = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), m);\n  if (col.a <= 0.0) return vec4(0.0);\n  // a light along the edge, adding nothing to the alpha\n  float glow = 4.0 * m * (1.0 - m) * max(edgeStrength, 0.0);\n  return vec4(col.rgb / col.a + edgeColor * glow, col.a);\n}\n"
 },
 {
  "name": "GlitchMemories",
  "author": "Gunnar Roth",
  "license": "MIT",
  "types": {},
  "params": {},
  "glsl": "// Author: Gunnar Roth\n// based on work from natewave\n// License: MIT\n// Description: A crossfade with glitchy, color-shifted blocks\n// Tags: glitch, chromatic, blend\nvec4 transition(vec2 p) {\n  vec2 block = floor(p.xy / vec2(16));\n  vec2 uv_noise = block / vec2(64);\n  uv_noise += floor(vec2(progress) * vec2(1200.0, 3500.0)) / vec2(64);\n  vec2 dist = progress > 0.0 ? (fract(uv_noise) - 0.5) * 0.3 *(1.0 -progress) : vec2(0.0);\n  vec2 red = p + dist * 0.2;\n  vec2 green = p + dist * .3;\n  vec2 blue = p + dist * .5;\n\n  vec4 center = mix(getFromColor(green), getToColor(green), progress);\n  return vec4(mix(getFromColor(red), getToColor(red), progress).r, center.g, mix(getFromColor(blue), getToColor(blue), progress).b, center.a);\n}\n\n"
 },
 {
  "name": "TvTurnOff",
  "author": "gre",
  "license": "MIT",
  "types": {
   "color": "vec4",
   "glow": "float"
  },
  "params": {
   "color": [
    0,
    0,
    0,
    1
   ],
   "glow": 1
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: The outgoing image collapses into a glowing line and a dot, like an old TV turned off, then the incoming image powers on from the dot\n// Tags: retro, vertical, flash\n\n// @color Color of the switched-off screen\nuniform vec4 color; // = vec4(0.0, 0.0, 0.0, 1.0)\n// @range(0, 2) Strength of the glow around the line and the dot\nuniform float glow; // = 1.0\n\nvec4 getColor(vec2 uv, bool isFrom) {\n  return isFrom ? getFromColor(uv) : getToColor(uv);\n}\n\n// The screen at a time t of its power-off: 0 is the full image, 1 is off\nvec4 screen(vec2 uv, float t, bool isFrom) {\n  float collapse = smoothstep(0.0, 0.4, t); // the image squeezes into a line\n  float shrink = smoothstep(0.3, 0.65, t); // the line shrinks into a dot\n  float fade = 0.4 * smoothstep(0.75, 1.0, t); // the dot dims\n  float radius = 0.01 * (1.0 - fade);\n  // half size of the picture, in height units (x is scaled by ratio)\n  vec2 size = vec2(mix(0.5 * ratio, radius, shrink), mix(0.5, radius, collapse));\n  vec2 p = (uv - 0.5) * vec2(ratio, 1.0);\n  vec2 q = clamp(0.5 + 0.5 * p / size, 0.0, 1.0);\n  vec4 c = getColor(q, isFrom);\n  // the squeezed picture gets brighter and burns to white\n  float white = smoothstep(0.4, 1.0, collapse);\n  vec4 light = vec4(mix(min(c.rgb * (1.0 + 2.0 * collapse), 1.0), vec3(1.0), white), c.a);\n  // soft edges, outside the picture so that t = 0 is the exact image\n  vec2 d = abs(p) - size;\n  float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);\n  float inside = clamp(1.0 - dist / 0.004, 0.0, 1.0);\n  // a glow around the line, tinted by the center of the picture, then warm white around the dot\n  vec4 mid = getColor(vec2(0.5), isFrom);\n  vec4 halo = vec4(mix(mix(mid.rgb, vec3(1.0), 0.7), vec3(1.0, 0.92, 0.8), shrink), mid.a);\n  float h = 1.0 - exp(-2.0 * glow * white * exp(-max(dist, 0.0) / (0.02 + 0.04 * shrink)));\n  vec4 col = mix(color, halo, h * (1.0 - fade));\n  return mix(col, light, inside * (1.0 - fade));\n}\n\nvec4 transition(vec2 uv) {\n  if (progress < 0.5) {\n    return screen(uv, 2.0 * progress, true);\n  }\n  return screen(uv, 2.0 - 2.0 * progress, false);\n}\n"
 },
 {
  "name": "Hexagonalize",
  "author": "Fernando Kuteken",
  "license": "MIT",
  "types": {
   "steps": "int",
   "horizontalHexagons": "float"
  },
  "params": {
   "steps": 50,
   "horizontalHexagons": 20
  },
  "glsl": "// Author: Fernando Kuteken\n// License: MIT\n// Description: Both images turn into hexagons, crossfade, then sharpen again\n// Tags: pixelate, hexagon, blend\n// Hexagonal math from: http://www.redblobgames.com/grids/hexagons/\n\nuniform int steps; // = 50\n// @param Number of hexagons across\nuniform float horizontalHexagons; // = 20\n\nstruct Hexagon {\n  float q;\n  float r;\n  float s;\n};\n\nHexagon createHexagon(float q, float r){\n  Hexagon hex;\n  hex.q = q;\n  hex.r = r;\n  hex.s = -q - r;\n  return hex;\n}\n\nHexagon roundHexagon(Hexagon hex){\n  \n  float q = floor(hex.q + 0.5);\n  float r = floor(hex.r + 0.5);\n  float s = floor(hex.s + 0.5);\n\n  float deltaQ = abs(q - hex.q);\n  float deltaR = abs(r - hex.r);\n  float deltaS = abs(s - hex.s);\n\n  if (deltaQ > deltaR && deltaQ > deltaS)\n    q = -r - s;\n  else if (deltaR > deltaS)\n    r = -q - s;\n  else\n    s = -q - r;\n\n  return createHexagon(q, r);\n}\n\nHexagon hexagonFromPoint(vec2 point, float size) {\n  \n  point.y /= ratio;\n  point = (point - 0.5) / size;\n  \n  float q = (sqrt(3.0) / 3.0) * point.x + (-1.0 / 3.0) * point.y;\n  float r = 0.0 * point.x + 2.0 / 3.0 * point.y;\n\n  Hexagon hex = createHexagon(q, r);\n  return roundHexagon(hex);\n  \n}\n\nvec2 pointFromHexagon(Hexagon hex, float size) {\n  \n  float x = (sqrt(3.0) * hex.q + (sqrt(3.0) / 2.0) * hex.r) * size + 0.5;\n  float y = (0.0 * hex.q + (3.0 / 2.0) * hex.r) * size + 0.5;\n  \n  return vec2(x, y * ratio);\n}\n\nvec4 transition (vec2 uv) {\n  \n  float dist = 2.0 * min(progress, 1.0 - progress);\n  dist = steps > 0 ? ceil(dist * float(steps)) / float(steps) : dist;\n  \n  float size = (sqrt(3.0) / 3.0) * dist / horizontalHexagons;\n  \n  vec2 point = dist > 0.0 ? pointFromHexagon(hexagonFromPoint(uv, size), size) : uv;\n\n  return mix(getFromColor(point), getToColor(point), progress);\n  \n}\n"
 },
 {
  "name": "Pixelize",
  "author": "gre",
  "license": "MIT",
  "types": {
   "squaresMin": "ivec2",
   "steps": "int"
  },
  "params": {
   "squaresMin": [
    20,
    20
   ],
   "steps": 50
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: Both images pixelate, crossfade, then sharpen again\n// Tags: pixelate, blend\n// forked from https://gist.github.com/benraziel/c528607361d90a072e98\n\n// minimum number of squares (when the effect is at its higher level)\n// @param Number of squares at the strongest pixelation\nuniform ivec2 squaresMin; // = ivec2(20)\n// zero disable the stepping\n// @param Number of pixelation steps; 0 for a continuous effect\nuniform int steps; // = 50\n\nvec4 transition(vec2 uv) {\n  float d = min(progress, 1.0 - progress);\n  float dist = steps>0 ? ceil(d * float(steps)) / float(steps) : d;\n  vec2 squareSize = 2.0 * dist / vec2(squaresMin);\n  vec2 p = dist>0.0 ? (floor(uv / squareSize) + 0.5) * squareSize : uv;\n  return mix(getFromColor(p), getToColor(p), progress);\n}\n"
 },
 {
  "name": "Kaleidoscope",
  "author": "nwoeanhinnogaehr",
  "license": "MIT",
  "types": {
   "speed": "float",
   "angle": "float",
   "power": "float"
  },
  "params": {
   "speed": 1,
   "angle": 1,
   "power": 1.5
  },
  "glsl": "// Author: nwoeanhinnogaehr\n// License: MIT\n// Description: A crossfade through a spinning kaleidoscope\n// Tags: kaleidoscope, distort, blend\n\nuniform float speed; // = 1.0\nuniform float angle; // = 1.0\nuniform float power; // = 1.5\n\nvec4 transition(vec2 uv) {\n  vec2 p = uv.xy / vec2(1.0).xy;\n  vec2 q = p;\n  float t = pow(progress, power)*speed;\n  p = p -0.5;\n  for (int i = 0; i < 7; i++) {\n    p = vec2(sin(t)*p.x + cos(t)*p.y, sin(t)*p.y - cos(t)*p.x);\n    t += angle;\n    p = abs(mod(p, 2.0) - 1.0);\n  }\n  abs(mod(p, 1.0));\n  return mix(\n    mix(getFromColor(q), getToColor(q), progress),\n    mix(getFromColor(p), getToColor(p), progress), 1.0 - 2.0*abs(progress - 0.5));\n}\n"
 },
 {
  "name": "LightningFlash",
  "author": "gre",
  "license": "MIT",
  "types": {
   "bolts": "int",
   "strike": "float",
   "seed": "float",
   "color": "vec3",
   "glow": "float",
   "flashes": "int"
  },
  "params": {
   "bolts": 2,
   "strike": 0.55,
   "seed": 0,
   "color": [
    0.75,
    0.85,
    1
   ],
   "glow": 0.5,
   "flashes": 3
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: Forked lightning bolts crack down from the top of the frame, the screen flashes white in a few stuttering strobes, and the incoming image appears lit by the last flickers as they fade out\n// Tags: light, flash, weather, strobe\n\n// @range(1, 3, 1) Number of bolts: the main one strikes the ground, the others fork out higher in the sky\nuniform int bolts; // = 2\n// @range(0, 1) Where the main bolt strikes, from the left (0) to the right (1) of the frame\nuniform float strike; // = 0.55\n// @range(0, 100, 1) Changes the shape of the bolts\nuniform float seed; // = 0.0\n// @color Color of the light, added to the images\nuniform vec3 color; // = vec3(0.75, 0.85, 1.0)\n// @range(0, 1) Size and brightness of the glow around the bolts\nuniform float glow; // = 0.5\n// @range(1, 4, 1) Number of strobes; the images switch during the brightest one\nuniform int flashes; // = 3\n\n// the bolts crack down until this time, then the strobes start\nconst float LEADER = 0.3;\n\nfloat hash(vec2 p) {\n  vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n  p3 += dot(p3, p3.yzx + 33.33);\n  return fract((p3.x + p3.y) * p3.z);\n}\n\n// a value noise that is linear between its cells: a jagged polyline, centered on 0\nfloat jag(float s, float k) {\n  float i = floor(s);\n  return mix(hash(vec2(i, k)), hash(vec2(i + 1.0, k)), fract(s)) - 0.5;\n}\n\n// the zigzag of a bolt around its straight line, at height y (narrower in a portrait frame)\nfloat zigzag(float y, float k) {\n  return min(ratio, 1.0) * (0.15 * jag(y * 5.0, k) + 0.06 * jag(y * 13.0, k + 1.0) + 0.03 * jag(y * 31.0, k + 2.0) + 0.012 * jag(y * 67.0, k + 3.0));\n}\n\n// the x of a bolt at height y: from x0 at the top (y = 1) to x1 at its end (y = y1),\n// given z0 and z1, its zigzag at both ends\nfloat boltX(float y, float x0, float x1, float y1, float z0, float z1, float k) {\n  float t = (1.0 - y) / (1.0 - y1);\n  return mix(x0 - z0, x1 - z1, t) + zigzag(y, k);\n}\n\n// the x of a branch at height y: it leaves its bolt at (xb, yb), where its own zigzag is zb,\n// and drifts sideways by dir per unit of height\nfloat branchX(float y, float xb, float yb, float zb, float dir, float k) {\n  return xb + dir * (yb - y) + 0.6 * (zigzag(y, k) - zb);\n}\n\n// distance to a curve x = f(y), knowing its x and its slope at the pixel's height,\n// and how far above or below its ends the pixel is; the slope only corrects the distance\n// close to the curve, so the glow farther away does not streak along the zigzags\nfloat curveDist(vec2 q, float x, float slope, float outside) {\n  float dx = abs(q.x - x);\n  float d = dx * mix(inversesqrt(1.0 + slope * slope), 1.0, smoothstep(0.0, 0.08, dx));\n  return length(vec2(d, max(outside, 0.0)));\n}\n\n// a strobe at time t0: a quick rise, a plateau of length hold, then a decay\nfloat pulse(float p, float t0, float hold, float decay) {\n  float x = p - t0;\n  if (x < 0.0) return smoothstep(-0.012, 0.0, x);\n  return exp(-max(x - hold, 0.0) / decay);\n}\n\nvec4 transition(vec2 uv) {\n  float p = progress;\n  vec2 q = vec2(uv.x * ratio, uv.y);\n  // (seeds far apart, so that neighboring seeds share no hash keys)\n  float k0 = floor(seed) * 61.0;\n  int nb = bolts < 1 ? 1 : (bolts > 3 ? 3 : bolts);\n  int nf = flashes < 1 ? 1 : (flashes > 4 ? 4 : flashes);\n  // the images switch during the brightest strobe, the second one (or the only one)\n  int cut = nf > 1 ? 1 : 0;\n\n  // the strobes, a bit irregular; the bolts are lit by all of them, the screen mostly by the brightest\n  float flash = 0.0;\n  float lit = 0.0;\n  float tCut = LEADER;\n  float tLast = LEADER;\n  float t = LEADER;\n  for (int i = 0; i < 4; i++) {\n    if (i < nf) {\n      bool isCut = i == cut;\n      float amp = isCut ? 1.0 : (i < cut ? 0.55 : 0.7 * pow(0.75, float(i - cut - 1)));\n      float s = amp * pulse(p, t, isCut ? 0.025 : 0.004, isCut ? 0.03 : 0.022);\n      flash = max(flash, s);\n      lit = max(lit, pulse(p, t, 0.01, 0.045));\n      if (isCut) tCut = t;\n      tLast = t;\n      t += (isCut ? 0.12 : 0.08) + 0.04 * hash(vec2(float(i), k0 + 5.0));\n    }\n  }\n  // the stutter: the light jumps from one level to another a few times per strobe\n  float stutter = mix(0.7, 1.0, hash(vec2(floor(p * 70.0), k0 + 9.0)));\n  flash *= stutter;\n  // the brightest strobe whites the screen out while the images switch\n  float whiteout = pulse(p, tCut, 0.025, 0.02);\n  // then a few last flickers, fading out\n  float tail = p > tLast ? exp(-(p - tLast) / 0.1) * smoothstep(0.03, 0.06, p - tLast) : 0.0;\n  flash = max(flash, 0.35 * tail * step(0.45, hash(vec2(floor(p * 40.0), k0 + 13.0))));\n\n  // the bolts crack down in a few jumps while faintly lit, then light up with the strobes and go out\n  float grow = clamp(p / LEADER, 0.0, 1.0);\n  grow = (floor(grow * 7.0) + smoothstep(0.0, 1.0, fract(grow * 7.0))) / 7.0;\n  float faint = 0.5 * mix(0.6, 1.0, hash(vec2(floor(p * 50.0), k0 + 11.0)));\n  float boltLight = p < LEADER ? faint * smoothstep(0.0, 0.06, p) : max(lit * stutter, faint * exp(-(p - LEADER) / 0.12));\n  boltLight = max(boltLight, 0.6 * flash * tail);\n  boltLight *= 1.0 - smoothstep(tLast + 0.1, tLast + 0.3, p);\n\n  // the bolts: the main one strikes the ground at strike, the others stop in the sky\n  float core = 0.0;\n  float halo = 0.0;\n  float near = 10.0;\n  bool lightsOn = boltLight > 0.0 || flash > 0.0;\n  for (int b = 0; b < 3; b++) {\n    if (b < nb && lightsOn) {\n      float fb = float(b);\n      float kb = k0 + fb * 17.0;\n      float x1 = strike * ratio;\n      float y1 = -0.05;\n      float bright = 1.0;\n      if (b > 0) {\n        // the second bolt goes to the roomier side, the third to the other side if there is room there\n        float roomy = strike < 0.5 ? 1.0 : -1.0;\n        bool cramped = min(strike, 1.0 - strike) < 0.25;\n        float side = b == 1 || cramped ? roomy : -roomy;\n        float dist = b == 2 && cramped ? 0.5 : 0.22;\n        x1 = clamp(x1 + side * ratio * (dist + 0.12 * hash(vec2(fb, kb))), 0.08 * ratio, 0.92 * ratio);\n        y1 = 0.25 + 0.25 * hash(vec2(fb, kb + 1.0));\n        bright = 0.7;\n      }\n      float x0 = clamp(x1 + (hash(vec2(fb, kb + 2.0)) - 0.5) * 0.5 * min(ratio, 1.0), 0.1 * ratio, 0.9 * ratio);\n      // the tip of the bolt while it cracks down\n      float tip = mix(1.02, y1, grow);\n      // (the slope is measured over a few pixels, so it changes smoothly at the corners)\n      float e = 0.01;\n      float z0 = zigzag(1.0, kb);\n      float z1 = zigzag(y1, kb);\n      float x = boltX(q.y, x0, x1, y1, z0, z1, kb);\n      float slope = (boltX(q.y + e, x0, x1, y1, z0, z1, kb) - boltX(q.y - e, x0, x1, y1, z0, z1, kb)) / (2.0 * e);\n      float d = curveDist(q, x, slope, max(max(y1, tip) - q.y, q.y - 1.05));\n      near = min(near, d);\n      float w = 0.003 * mix(1.0, 0.7, fb / 2.0);\n      core += bright * exp(-d * d / (w * w));\n      halo += bright * (0.7 * exp(-d * 24.0) + 0.25 * exp(-d * 6.0));\n      // three branches, leaving the bolt on either side and fading toward their ends\n      for (int j = 0; j < 3; j++) {\n        float fj = float(j);\n        float kj = kb + 3.0 + fj * 5.0;\n        float tb = 0.12 + 0.2 * fj + 0.15 * hash(vec2(fj, kj));\n        float yb = mix(1.0, y1, tb);\n        float len = (0.3 + 0.25 * hash(vec2(fj, kj + 1.0))) * (1.0 - tb) * (1.0 - y1);\n        float dir = (j == 1 ? -1.0 : 1.0) * (0.2 + 0.45 * hash(vec2(fj, kj + 2.0))) * min(ratio, 1.0);\n        float xb = boltX(yb, x0, x1, y1, z0, z1, kb);\n        float zb = zigzag(yb, kj);\n        float bx = branchX(q.y, xb, yb, zb, dir, kj);\n        float bs = (branchX(q.y + e, xb, yb, zb, dir, kj) - branchX(q.y - e, xb, yb, zb, dir, kj)) / (2.0 * e);\n        float bd = curveDist(q, bx, bs, max(max(yb - len, tip) - q.y, q.y - yb));\n        near = min(near, bd);\n        float along = clamp((yb - q.y) / len, 0.0, 1.0);\n        float fade = bright * (1.0 - 0.8 * along);\n        float bw = w * mix(0.8, 0.4, along);\n        core += fade * exp(-bd * bd / (bw * bw));\n        halo += fade * 0.6 * (0.7 * exp(-bd * 24.0) + 0.25 * exp(-bd * 6.0));\n      }\n    }\n  }\n\n  // the outgoing image gives way to the incoming one at the brightest strobe, hidden by it\n  float m = smoothstep(tCut, tCut + 0.025, p);\n  vec4 c = vec4(0.0);\n  if (m < 1.0) {\n    vec4 a = getFromColor(uv);\n    c += (1.0 - m) * vec4(a.rgb * a.a, a.a);\n  }\n  if (m > 0.0) {\n    vec4 a = getToColor(uv);\n    c += m * vec4(a.rgb * a.a, a.a);\n  }\n  if (c.a <= 0.0) return vec4(0.0);\n  vec3 col = c.rgb / c.a;\n\n  // the effect fades in at the start and is gone at the end\n  float live = smoothstep(0.0, 0.03, p) * (1.0 - smoothstep(0.85, 1.0, p));\n  // the sky darkens a little as the storm builds, then the strobes overexpose the image,\n  // more around the bolts, and the bolts glow over it\n  float dim = 0.4 * smoothstep(0.0, LEADER, p) * (1.0 - smoothstep(tCut, tLast + 0.15, p));\n  float f = flash * mix(0.6 + 0.4 * exp(-near * 4.0), 1.0, smoothstep(0.6, 1.0, flash));\n  col *= 1.0 - dim * live;\n  col = col * (1.0 + 2.5 * f * live) + color * (1.1 * f * live);\n  float g = 0.4 + 1.2 * glow;\n  vec3 light = mix(color, vec3(1.0), 0.75) * min(core, 1.5) * 1.6 + color * g * halo;\n  col += light * boltLight * live;\n  col = mix(col, vec3(1.0), 0.92 * whiteout * live);\n  return vec4(clamp(col, 0.0, 1.0), c.a);\n}\n"
 },
 {
  "name": "CircleBurst",
  "author": "gre",
  "license": "MIT",
  "types": {
   "center": "vec2",
   "color1": "vec4",
   "color2": "vec4",
   "color3": "vec4",
   "stagger": "float"
  },
  "params": {
   "center": [
    0.5,
    0.5
   ],
   "color1": [
    0.99,
    0.79,
    0.29,
    1
   ],
   "color2": [
    0.95,
    0.38,
    0.33,
    1
   ],
   "color3": [
    0.13,
    0.15,
    0.3,
    1
   ],
   "stagger": 0.3
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: Discs of three solid colors burst out of a point one after another, each covering the last, then a hole bursts open from the same point in the last one to reveal the incoming image\n// Tags: circle, burst, color, reveal, motion-graphics\n\n// @param Point the discs burst out of, in texture coordinates\nuniform vec2 center; // = vec2(0.5, 0.5)\n// @color Color of the first disc\nuniform vec4 color1; // = vec4(0.99, 0.79, 0.29, 1.0)\n// @color Color of the second disc\nuniform vec4 color2; // = vec4(0.95, 0.38, 0.33, 1.0)\n// @color Color of the third disc, which opens onto the incoming image\nuniform vec4 color3; // = vec4(0.13, 0.15, 0.3, 1.0)\n// @range(0, 1) Delay between the discs, relative to the burst of one disc (at 0, they burst as one: a single circle opens onto the incoming image)\nuniform float stagger; // = 0.3\n\n// half width of the antialiased edges, in frame heights\nconst float AA = 0.0015;\n// width and opacity of the soft shadow each disc casts on what is under it\nconst float SW = 0.03;\nconst float SO = 0.32;\n\n// local progress of a layer starting at s and lasting d\nfloat phase(float s, float d) {\n  return clamp((progress - s) / d, 0.0, 1.0);\n}\n\n// radius of the edge of a layer at local progress t: it bursts out of just before the point and\n// leaves the frame still moving, its shadow last\nfloat radius(float t, float R) {\n  float u = 1.0 - t;\n  return mix(-SW - AA, R, mix(t, 1.0 - u * u * u, 0.8));\n}\n\n// fold texture coordinates back into the frame\nvec2 mirror(vec2 v) {\n  return 1.0 - abs(1.0 - mod(abs(v), 2.0));\n}\n\n// a layer of color c and radius r laid over p (premultiplied), with its shadow around it, at distance x\nvec4 layer(vec4 p, vec4 c, float r, float x) {\n  float k = smoothstep(r - AA, r + AA, x);\n  float s = SO * c.a * k * (1.0 - smoothstep(0.0, SW, x - r));\n  p = p * (1.0 - s) + vec4(0.0, 0.0, 0.0, s);\n  k = c.a * (1.0 - k);\n  return p * (1.0 - k) + vec4(c.rgb, 1.0) * k;\n}\n\nvec4 transition(vec2 uv) {\n  vec2 asp = vec2(ratio, 1.0);\n  float x = length((uv - center) * asp);\n  // past the farthest corner, with room for the shadows\n  float R = length(max(center, 1.0 - center) * asp) + SW + AA;\n  float k = clamp(stagger, 0.0, 1.0);\n  float d = 1.0 / (1.0 + 3.0 * k);\n\n  // the outgoing image is pushed in by the first burst\n  float t = phase(0.0, d);\n  vec4 a = getFromColor(mirror(center + (uv - center) / (1.0 + 0.06 * t * (2.0 - t))));\n  vec4 p = vec4(a.rgb * a.a, a.a);\n  p = layer(p, color1, radius(t, R), x);\n  p = layer(p, color2, radius(phase(k * d, d), R), x);\n  float r = radius(phase(2.0 * k * d, d), R);\n  p = layer(p, color3, r, x);\n\n  // the hole in the last disc shows the incoming image, which pops in slightly zoomed, overshoots\n  // and settles, shaded along the hole's rim as much as the disc around it is wide\n  t = phase(3.0 * k * d, d);\n  float h = radius(t, R);\n  float u = 1.0 - t;\n  vec4 b = getToColor(mirror(center + (uv - center) / (1.0 + 0.14 * u * u * (1.0 - 2.4 * t))));\n  float s = SO * color3.a * clamp((r - h) / SW, 0.0, 1.0) * (1.0 - smoothstep(0.0, SW, h - x));\n  vec4 q = vec4(b.rgb * b.a * (1.0 - s), b.a * (1.0 - s) + s);\n  p = mix(p, q, 1.0 - smoothstep(h - AA, h + AA, x));\n  return p.a > 0.0 ? vec4(p.rgb / p.a, p.a) : vec4(0.0);\n}\n"
 },
 {
  "name": "Dreamy",
  "author": "mikolalysenko",
  "license": "MIT",
  "types": {},
  "params": {},
  "glsl": "// Author: mikolalysenko\n// License: MIT\n// Description: A crossfade with a gentle wavy distortion\n// Tags: wave, blend\n\nvec2 offset(float progress, float x, float theta) {\n  float phase = progress*progress + progress + theta;\n  float shifty = 0.03*progress*cos(10.0*(progress+x));\n  return vec2(0, shifty);\n}\nvec4 transition(vec2 p) {\n  return mix(getFromColor(p + offset(progress, p.x, 0.0)), getToColor(p + offset(1.0-progress, p.x, 3.14)), progress);\n}\n"
 },
 {
  "name": "BurnThrough",
  "author": "liubailin2020@gmail.com",
  "license": "MIT",
  "types": {
   "burnColor": "vec3"
  },
  "params": {
   "burnColor": [
    1,
    0.5,
    0
   ]
  },
  "glsl": "// Author: liubailin2020@gmail.com\n// License: MIT\n// Description: The outgoing image burns away in noisy, glowing patches\n// Tags: burn, fire, noise\n\n// @color Color of the burning edges\nuniform vec3 burnColor; // = vec3(1.0, 0.5, 0.0)\n\nfloat random (in vec2 st) {\n    return fract(sin(dot(st.xy,\n                         vec2(12.9898,78.233)))*\n        43758.5453123);\n}\n\n// Based on Morgan McGuire @morgan3d\n// https://www.shadertoy.com/view/4dS3Wd\nfloat noise (in vec2 st) {\n    vec2 i = floor(st);\n    vec2 f = fract(st);\n\n    float a = random(i);\n    float b = random(i + vec2(1.0, 0.0));\n    float c = random(i + vec2(0.0, 1.0));\n    float d = random(i + vec2(1.0, 1.0));\n\n    vec2 u = f * f * (3.0 - 2.0 * f);\n\n    return mix(a, b, u.x) +\n            (c - a)* u.y * (1.0 - u.x) +\n            (d - b) * u.x * u.y;\n}\n\n#define OCTAVES 4\nfloat fbm (in vec2 st) {\n    float value = 0.0;\n    float amplitude = .5;\n    for (int i = 0; i < OCTAVES; i++) {\n        value += amplitude * noise(st);\n        st *= 2.;\n        amplitude *= .5;\n    }\n    return value;\n}\n\nvec4 transition (vec2 uv) {\n    if (progress <= 0.0) return getFromColor(uv);\n    if (progress >= 1.0) return getToColor(uv);\n    vec4 from = getFromColor(uv);\n    vec4 to = getToColor(uv);\n    float n = fbm(uv * 4.);\n    float l = smoothstep(progress, progress + 0.05, n);\n    float edge = (1.0 - l) * l * 5.0;\n    return mix(to, from, l) + vec4(burnColor, 0.0) * edge;\n}\n"
 },
 {
  "name": "Tunnel",
  "author": "gre",
  "license": "MIT",
  "types": {
   "speed": "float",
   "twist": "float"
  },
  "params": {
   "speed": 6,
   "twist": 0.5
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: The camera flies down a tunnel lined with the outgoing image toward the incoming one, which opens at its far end and grows to fill the frame\n// Tags: zoom, 3d, warp, radial\n\n// @range(0.5, 10) How far and fast the camera flies down the tunnel\nuniform float speed; // = 6.0\n// @range(-2, 2) How much the walls spiral as they rush by\nuniform float twist; // = 0.5\n\nvec2 rotate(vec2 v, float a) {\n  float c = cos(a);\n  float s = sin(a);\n  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);\n}\n\nvec4 transition(vec2 uv) {\n  vec2 aspect = vec2(ratio, 1.0);\n  vec2 c = (uv - 0.5) * aspect;\n  float r = length(c);\n  // A tube as wide as the frame's corners runs from the camera to an end wall\n  // at depth `far`; the outgoing image is projected onto it from the starting\n  // point of view, so it looks flat at first. The camera flies to one unit\n  // before the end wall, where the incoming image hangs.\n  float R = length(0.5 * aspect);\n  float far = 1.0 + speed;\n  // the distance to the end wall shrinks geometrically, so the end grows evenly\n  float e = mix(progress, progress * progress * (3.0 - 2.0 * progress), 0.7);\n  float d = pow(far, 1.0 - e);\n  float t = far - d; // distance flown\n  // the end wall covers the center of the view, the tube's walls the rest\n  float k = r * d < R ? d / far : R / (R + t * r); // image scale at that point\n  float a = twist * min(t * r / R, t / d); // spiral, continuous at the end wall\n  vec4 walls = getFromColor(0.5 + rotate(c * k, a) / aspect);\n  walls.rgb *= 0.4 + 0.6 * sqrt(k); // darker where the walls are close\n  // the incoming image opens in the end wall\n  float open = smoothstep(0.0, 0.6, progress);\n  vec2 q = 0.5 + (uv - 0.5) * d / max(open, 1e-4);\n  vec2 inside = step(0.0, q) * step(q, vec2(1.0));\n  return mix(walls, getToColor(q), inside.x * inside.y * step(r * d, R));\n}\n"
 },
 {
  "name": "StaticFade",
  "author": "Ben Lucas",
  "license": "MIT",
  "types": {
   "n_noise_pixels": "float",
   "static_luminosity": "float"
  },
  "params": {
   "n_noise_pixels": 200,
   "static_luminosity": 0.8
  },
  "glsl": "// Author: Ben Lucas\n// License: MIT\n// Description: Cuts to the incoming image halfway, hidden behind a burst of TV static\n// Tags: static, noise, retro\n\nuniform float n_noise_pixels ; // = 200.0\nuniform float static_luminosity ; // = 0.8\n\nfloat rnd (vec2 st) {\n    return fract(sin(dot(st.xy,\n                         vec2(10.5302340293,70.23492931)))*\n        12345.5453123);\n}\n\nvec4 staticNoise (vec2 st, float offset, float luminosity, float alpha) {\n  float staticR = luminosity * rnd(st * vec2(offset * 2.0, offset * 3.0));\n  float staticG = luminosity * rnd(st * vec2(offset * 3.0, offset * 5.0));\n  float staticB = luminosity * rnd(st * vec2(offset * 5.0, offset * 7.0));\n  return vec4(staticR, staticG, staticB, alpha);\n}\n\nfloat staticIntensity(float t)\n{\n  float transitionProgress = abs(2.0*(t-0.5));\n  float transformedThreshold =1.2*(1.0 - transitionProgress)-0.1;\n  return min(1.0, transformedThreshold);\n}\n  \nvec4 transition (vec2 uv) {\n\n  float baseMix = step(0.5, progress);\n  vec4 transitionMix = mix(\n    getFromColor(uv),\n    getToColor(uv),\n    baseMix\n  );\n  \n  vec2 uvStatic = floor(uv * n_noise_pixels)/n_noise_pixels;\n  \n  vec4 staticColor = staticNoise(uvStatic, progress, static_luminosity, transitionMix.a); // static where the image is\n\n  float staticThresh = staticIntensity(progress);\n  float staticMix = step(rnd(uvStatic), staticThresh);\n\n  return mix(transitionMix, staticColor, staticMix);\n}\n"
 },
 {
  "name": "Disintegrate",
  "author": "gre",
  "license": "MIT",
  "types": {
   "particleSize": "float",
   "direction": "vec2",
   "spread": "float"
  },
  "params": {
   "particleSize": 0.008,
   "direction": [
    1,
    -0.15
   ],
   "spread": 0.75
  },
  "glsl": "// Author: gre\n// License: MIT\n// Description: The outgoing image crumbles into fine dust from one side, its grains blown away by the wind and fading out, revealing the incoming image underneath\n// Tags: particles, dust, wind, directional\n\n// @range(0.0075, 0.03) Size of the dust grains, in frame heights\nuniform float particleSize; // = 0.008\n// @param Direction in which the wind blows the dust\nuniform vec2 direction; // = vec2(1.0, -0.15)\n// @range(0, 1) How far the dust flies and scatters before it fades out\nuniform float spread; // = 0.75\n\n// the grains a pixel looks back to, along the wind: every grain up to 16 cells away,\n// one in 2 up to 32 cells, one in 4 up to 64 cells (only those stay visible that far,\n// so the dust thins out as it flies): 35 candidates, without unrolling a long loop\nconst int NEAR = 17;\nconst int CANDIDATES = 35;\n// part of the transition during which a grain flies, from its release to its fade-out\nconst float LIFE = 0.45;\n\nfloat hash12(vec2 p) {\n  vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n  p3 += dot(p3, p3.yzx + 33.33);\n  return fract((p3.x + p3.y) * p3.z);\n}\n\n// smooth value noise, between -1 and 1\nfloat noise(vec2 p) {\n  vec2 i = floor(p);\n  vec2 f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = hash12(i);\n  float b = hash12(i + vec2(1.0, 0.0));\n  float c = hash12(i + vec2(0.0, 1.0));\n  float d = hash12(i + vec2(1.0, 1.0));\n  return 2.0 * mix(mix(a, b, f.x), mix(c, d, f.x), f.y) - 1.0;\n}\n\n// the grains' sideways drift, in gusts along the wind, between -1 and 1: it depends only\n// on where a grain comes from along the wind, so that a pixel knows which row to look in\nfloat gust(float x) {\n  float i = floor(x);\n  float f = fract(x);\n  f = f * f * (3.0 - 2.0 * f);\n  return 2.0 * mix(hash12(vec2(i, 7.0)), hash12(vec2(i + 1.0, 7.0)), f) - 1.0;\n}\n\n// when the grain at this center (in cells) is released, from the downwind side first,\n// along a ragged front\nfloat release(vec2 center, float h, float halfLength, float s) {\n  float front = 1.0 - (center.x + halfLength) / (2.0 * halfLength) + 0.14 * noise(center * s * 6.0) + 0.08 * (h - 0.5);\n  return clamp((front + 0.12) / 1.24, 0.0, 1.0) * (1.0 - LIFE);\n}\n\nvec4 transition(vec2 uv) {\n  vec2 d = length(direction) > 0.0 ? normalize(direction) : vec2(1.0, 0.0);\n  vec2 n = vec2(-d.y, d.x);\n  // grid of grains aligned with the wind: x along it, y across it, in cells\n  vec2 fp = (uv - 0.5) * vec2(ratio, 1.0);\n  float s = particleSize;\n  vec2 g = vec2(dot(fp, d), dot(fp, n)) / s;\n  float halfLength = 0.5 * (ratio * abs(d.x) + abs(d.y)) / s;\n  // the longest flight, in cells (at most 60, within the 64 cells looked back to)\n  float reach = min(spread * 0.45 / s, 60.0);\n  float px = floor(g.x);\n\n  // this pixel's own grain: once it has left, the incoming image shows through\n  vec2 own = floor(g);\n  vec4 under = progress > release(own + 0.5, hash12(own), halfLength, s) ? getToColor(uv) : getFromColor(uv);\n  vec2 grainUV = vec2(0.5);\n  float cover = 0.0;\n  for (int i = 0; i < CANDIDATES; i++) {\n    // the column of the candidate grain\n    float fi = float(i);\n    float cx = px - fi;\n    if (i >= NEAR + 9) {\n      cx = floor(px / 4.0) * 4.0 - 4.0 * (fi - float(NEAR + 9) + 8.0);\n    } else if (i >= NEAR) {\n      cx = floor(px / 2.0) * 2.0 - 2.0 * (fi - float(NEAR) + 8.0);\n    }\n    // how far the grain stays visible (in cells): further when its column is a multiple\n    // of 2, and of 4, as far as the pixels look back to\n    float visible = mod(cx, 4.0) < 0.5 ? 63.0 : mod(cx, 2.0) < 0.5 ? 31.0 : 15.0;\n    float drift = 0.3 * gust(cx * s * 4.0);\n    // the row the grain comes from: its sideways drift is known from its column and how\n    // far it has flown to get here\n    vec2 cell = vec2(cx, floor(g.y - drift * (g.x - cx - 0.5)));\n    vec2 center = cell + 0.5;\n    vec2 cuv = (center.x * d + center.y * n) * s / vec2(ratio, 1.0) + 0.5;\n    if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) continue;\n    float h = hash12(cell);\n    float t = (progress - release(center, h, halfLength, s)) / LIFE;\n    if (t <= 0.0 || t >= 1.0) continue;\n    float r2 = fract(h * 13.7);\n    // the grain speeds up, drifts sideways, shrinks and fades out\n    float travel = reach * (0.4 + 0.6 * r2) * t * (0.2 + 0.8 * t);\n    // it first fills its cell, then crumbles to a smaller speck\n    float crumble = smoothstep(0.0, 0.25, t);\n    vec2 pos = center + vec2(travel + (fract(h * 71.1) - 0.5) * 0.3 * crumble, drift * travel);\n    vec2 local = abs(g - pos);\n    float size = mix(0.5, 0.3 * (1.0 - 0.5 * t) * (0.6 + 0.4 * h), crumble);\n    float feather = 0.001 + 0.12 * crumble;\n    float a = (1.0 - smoothstep(size - feather, size, max(local.x, local.y))) * (1.0 - smoothstep(0.15, 1.0, t))\n      * (1.0 - smoothstep(0.6 * visible, visible, travel));\n    if (a > cover) {\n      cover = a;\n      grainUV = cuv;\n    }\n  }\n  return mix(under, getFromColor(grainUV), cover);\n}\n"
 },
 {
  "name": "CrossWarp",
  "author": "Eke Péter <peterekepeter@gmail.com>",
  "license": "MIT",
  "types": {},
  "params": {},
  "glsl": "// Author: Eke Péter <peterekepeter@gmail.com>\n// License: MIT\n// Description: The outgoing image zooms in while the incoming one zooms out into place, sweeping from right to left\n// Tags: warp, zoom, horizontal\nvec4 transition(vec2 p) {\n  float x = progress;\n  x=smoothstep(.0,1.0,(x*2.0+p.x-1.0));\n  return mix(getFromColor((p-.5)*(1.-x)+.5), getToColor((p-.5)*x+.5), x);\n}\n"
 }
];
