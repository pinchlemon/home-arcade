// Lab shelf: Map. Where the match is played.
//   VOID: the game as it always was, wizards in open space under the stars.
//   PRACTICE DOME: indoors, inside a giant dome. A round, flat field of mowed grass with no obstacles, a concrete
//   curb with a metal trim where the grass meets the wall, and a clean industrial shell: smooth panels with seams,
//   ribs running up to a hub at the top, rows of lights with a soft glow, and a few vents and access hatches.
//   Low-poly, chunky shapes and plain materials, lit softly and evenly from above (a GameCube look). Everything stays
//   inside: wizards stop at the curb, the Solid bounces off the wall and the ceiling, the demon turns back at the edge.
// The dome is built once (and again when its size changes), from a handful of merged meshes so it's cheap to draw.
// Its walls face inward only, so when the camera sits outside the dome, the near wall doesn't hide the field.
LAB.shelf('map', 'Map', (game) => {
  const T = game.THREE, o = game.orb, D = game.demon;
  const get = (k, d) => { const v = LAB.get('map.' + k); return v == null ? d : v; };
  const dome = () => get('pick', 0) === 1;

  // ---------------------------------------------------------------- textures, drawn once on small canvases
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]);
    t.anisotropy = 4; return t;
  }
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // grass: mowed stripes, a little speckle, and a painted centre circle
  const grassTex = () => canvasTex(512, 512, (g, w, h) => {
    const N = 12;
    for (let i = 0; i < N; i++) { g.fillStyle = i % 2 ? '#3f9e30' : '#4aab3a'; g.fillRect(i * w / N, 0, w / N + 1, h); }
    for (let i = 0; i < 2600; i++) { const x = rnd(i) * w, y = rnd(i + 9999) * h, k = rnd(i + 555); g.fillStyle = k < 0.5 ? 'rgba(30,90,20,0.18)' : 'rgba(170,230,120,0.16)'; g.fillRect(x, y, 2, 2); }
    g.strokeStyle = 'rgba(235,242,225,0.7)'; g.lineWidth = 4;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.085, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(235,242,225,0.7)'; g.beginPath(); g.arc(w / 2, h / 2, 5, 0, Math.PI * 2); g.fill();
  });
  // wall panels: light grey with darker seams and four rivets
  const panelTex = (rep) => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#aeb3ba'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#767c85'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    g.fillStyle = '#c6cad0'; g.fillRect(3, 3, w - 3, 1); g.fillRect(3, 3, 1, h - 3);
    g.fillStyle = '#9da2aa'; for (const [x, y] of [[12, 12], [w - 10, 12], [12, h - 10], [w - 10, h - 10]]) g.fillRect(x - 2, y - 2, 4, 4);
  }, rep);
  const concreteTex = (rep) => canvasTex(128, 32, (g, w, h) => {
    g.fillStyle = '#a9a7a2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = rnd(i) < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)'; g.fillRect(rnd(i + 3) * w, rnd(i + 7) * h, 2, 1); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 2, h);   // expansion joints
  }, rep);
  const glowTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,250,235,0.55)'); r.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });

  // ---------------------------------------------------------------- geometry helpers: boxes placed along a path, merged into one mesh
  const parts = [];   // {geo} to merge by material
  const m4 = new T.Matrix4(), q = new T.Quaternion(), s3 = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  function placed(geo, pos, quat, scale) { const g = geo.clone(); m4.compose(pos, quat || q.identity(), scale || s3.set(1, 1, 1)); g.applyMatrix4(m4); return g.index ? g.toNonIndexed() : g; }
  function merge(list) {
    const out = new T.BufferGeometry(), names = ['position', 'normal', 'uv'];
    for (const n of names) {
      const arrs = list.map(g => g.attributes[n]).filter(Boolean); if (arrs.length !== list.length) continue;
      const size = arrs[0].itemSize, total = arrs.reduce((a, b) => a + b.array.length, 0), buf = new Float32Array(total); let k = 0;
      for (const a of arrs) { buf.set(a.array, k); k += a.array.length; }
      out.setAttribute(n, new T.BufferAttribute(buf, size));
    }
    list.forEach(g => g.dispose());
    return out;
  }
  // a box from a to b with a square side of w (a chunky beam)
  const beamBase = new T.BoxGeometry(1, 1, 1);
  function beam(a, b, w, d) {
    const mid = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a), len = dir.length();
    q.setFromUnitVectors(new T.Vector3(0, 0, 1), dir.normalize());
    return placed(beamBase, mid, q, s3.set(w, d || w, len + 0.02));
  }

  // ---------------------------------------------------------------- the cutaway: with the camera outside the dome, the near side of its frame
  // (ribs, lights, hatches, the curb) is cut away so it never stands between you and the field
  const CUT = { uCamDir: { value: new T.Vector2(0, 1) }, uCut: { value: 0 }, uR: { value: 38 } };
  function cutaway(m) {
    m.userData.labKey = (m.userData.labKey || '') + '|dome';
    m.customProgramCacheKey = () => 'lab' + m.userData.labKey;
    const before = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      if (before) before.call(m, sh, r);
      Object.assign(sh.uniforms, CUT);
      sh.vertexShader = 'varying vec3 vDomeW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vDomeW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vDomeW;\nuniform vec2 uCamDir; uniform float uCut; uniform float uR;\n' +
        sh.fragmentShader.replace('void main() {', 'void main() {\n  if (uCut > 0.5 && length(vDomeW.xz) > uR * 0.45 && dot(normalize(vDomeW.xz), uCamDir) > 0.25) discard;');
    };
    return m;
  }

  // ---------------------------------------------------------------- the dome
  let root = null, lights = [], saved = null, blobs = [];
  function build() {
    clear();
    const R = get('size', 38), RW = R + 1.6, H = 9, CAP = R * 0.62, SEG = 48, RIBS = 16;
    root = new T.Group(); root.name = 'practiceDome';
    CUT.uR.value = R;
    const lam = (opts) => cutaway(new T.MeshLambertMaterial(Object.assign({ flatShading: true }, opts)));
    // the field: a ring of rings so it can darken a little toward the wall
    const fieldGeo = new T.CircleGeometry(R + 0.05, 72, 0, Math.PI * 2);
    const gTex = grassTex(); gTex.repeat.set(1, 1);
    const field = new T.Mesh(fieldGeo, new T.MeshLambertMaterial({ map: gTex }));
    field.rotation.x = -Math.PI / 2; field.position.y = -0.03; root.add(field);
    // a soft darker band just inside the curb (ambient occlusion, painted)
    const edgeTex = canvasTex(4, 64, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, 'rgba(10,40,10,0)'); r.addColorStop(1, 'rgba(10,40,10,0.45)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const edge = new T.Mesh(new T.RingGeometry(R - 4, R + 0.05, 72, 1), new T.MeshBasicMaterial({ map: edgeTex, transparent: true, depthWrite: false }));
    { const uv = edge.geometry.attributes.uv, pos = edge.geometry.attributes.position; for (let i = 0; i < uv.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, 0.5, 1 - (r - (R - 4)) / 4); } }
    edge.rotation.x = -Math.PI / 2; edge.position.y = -0.02; root.add(edge);
    // the curb: an inner face, a concrete top, and a metal trim on its edge
    const curbH = 0.32;
    const curbFace = new T.Mesh(new T.CylinderGeometry(R + 0.05, R + 0.05, curbH + 0.03, 72, 1, true), lam({ map: concreteTex([72, 1]), side: T.BackSide, color: 0xd8d6d0 }));
    curbFace.position.y = curbH / 2 - 0.03; root.add(curbFace);
    const curbTop = new T.Mesh(new T.RingGeometry(R + 0.05, RW + 0.1, 72, 1), lam({ color: 0xb8b6b0 }));
    curbTop.rotation.x = -Math.PI / 2; curbTop.position.y = curbH; root.add(curbTop);
    const trim = new T.Mesh(new T.TorusGeometry(R + 0.1, 0.07, 4, 72), cutaway(new T.MeshLambertMaterial({ color: 0x9aa3ad, emissive: 0x23272c })));
    trim.rotation.x = Math.PI / 2; trim.position.y = curbH + 0.02; root.add(trim);
    // the wall and the ceiling: inside faces only, panelled
    const wall = new T.Mesh(new T.CylinderGeometry(RW, RW, H, SEG, 3, true), lam({ map: panelTex([SEG / 2, 3]), side: T.BackSide }));
    wall.position.y = H / 2; root.add(wall);
    const ceil = new T.Mesh(new T.SphereGeometry(RW, SEG, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam({ map: panelTex([SEG / 2, 6]), side: T.BackSide, color: 0xdcdfe4 }));
    ceil.scale.y = CAP / RW; ceil.position.y = H; root.add(ceil);
    // a dark skirting band at the foot of the wall
    const skirt = new T.Mesh(new T.CylinderGeometry(RW - 0.02, RW - 0.02, 1.1, SEG, 1, true), lam({ color: 0x5d636b, side: T.BackSide }));
    skirt.position.y = curbH + 0.55; root.add(skirt);
    // the ribs: up the wall, then along the curve of the ceiling to a hub at the top
    const ribPts = (a) => {
      const pts = [], c = Math.cos(a), s = Math.sin(a), r0 = RW - 0.45;
      pts.push(new T.Vector3(c * r0, curbH, s * r0), new T.Vector3(c * r0, H, s * r0));
      for (let i = 1; i <= 7; i++) { const t = i / 8 * Math.PI / 2 * 0.93, rr = Math.cos(t) * (RW - 0.45), yy = H + Math.sin(t) * (CAP - 0.45); pts.push(new T.Vector3(c * rr, yy, s * rr)); }
      return pts;
    };
    const ribGeos = [];
    for (let k = 0; k < RIBS; k++) { const p = ribPts(k / RIBS * Math.PI * 2 + Math.PI / RIBS); for (let i = 0; i < p.length - 1; i++) ribGeos.push(beam(p[i], p[i + 1], 0.85, 0.6)); }
    // two rings that tie the ribs together: at the top of the wall and partway up the ceiling
    const ringAt = (rr, yy, n, w) => { for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; ribGeos.push(beam(new T.Vector3(Math.cos(a0) * rr, yy, Math.sin(a0) * rr), new T.Vector3(Math.cos(a1) * rr, yy, Math.sin(a1) * rr), w, w)); } };
    ringAt(RW - 0.5, H, SEG, 0.7);
    const t2 = 0.55, rr2 = Math.cos(t2) * (RW - 0.5), yy2 = H + Math.sin(t2) * (CAP - 0.5); ringAt(rr2, yy2, 32, 0.55);
    const ribs = new T.Mesh(merge(ribGeos), lam({ color: 0x7c838c }));
    root.add(ribs);
    // the hub at the top: a chunky ring with a light in it
    const hub = new T.Mesh(new T.CylinderGeometry(4.2, 4.6, 1.2, 16, 1, false), lam({ color: 0x6c727a }));
    hub.position.y = H + CAP - 0.9; root.add(hub);
    // the lights: a row on the wall between the ribs, two rows on the ceiling, and the hub
    const fixGeos = [], housGeos = [], glows = [];
    const fixture = (pos, normal, w) => {
      q.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
      housGeos.push(placed(beamBase, pos.clone().addScaledVector(normal, -0.12), q, s3.set(w + 0.5, 0.75, 0.3)));
      fixGeos.push(placed(beamBase, pos.clone().addScaledVector(normal, 0.05), q, s3.set(w, 0.38, 0.12)));
      glows.push(pos.clone().addScaledVector(normal, 0.6));
    };
    for (let k = 0; k < RIBS; k++) { const a = k / RIBS * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); fixture(new T.Vector3(c * (RW - 0.25), H - 1.6, s * (RW - 0.25)), new T.Vector3(-c, 0, -s), 2.4); }
    for (const [tt, n] of [[0.42, 16], [0.95, 8]]) for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), rr = Math.cos(tt) * (RW - 0.3), yy = H + Math.sin(tt) * (CAP - 0.3);
      const nrm = new T.Vector3(-c * Math.cos(tt) / RW, -Math.sin(tt) / CAP, -s * Math.cos(tt) / RW).normalize(); fixture(new T.Vector3(c * rr, yy, s * rr), nrm, 2);
    }
    root.add(new T.Mesh(merge(housGeos), lam({ color: 0x4f545b })));
    const bulbs = new T.Mesh(merge(fixGeos), cutaway(new T.MeshBasicMaterial({ color: 0xfff6e0 }))); root.add(bulbs);
    const hubLight = new T.Mesh(new T.CircleGeometry(3.4, 16), new T.MeshBasicMaterial({ color: 0xfff6e0, side: T.DoubleSide }));
    hubLight.rotation.x = Math.PI / 2; hubLight.position.y = H + CAP - 1.52; root.add(hubLight); glows.push(new T.Vector3(0, H + CAP - 2.2, 0));
    // bloom: a soft glow sprite on each light (one draw for all of them)
    const gp = new Float32Array(glows.length * 3); glows.forEach((p, i) => p.toArray(gp, i * 3));
    const gGeo = new T.BufferGeometry(); gGeo.setAttribute('position', new T.BufferAttribute(gp, 3));
    const bloom = new T.Points(gGeo, cutaway(new T.PointsMaterial({ map: glowTex, color: 0xfff1d0, size: 9, sizeAttenuation: true, transparent: true, opacity: get('bloom', 0.55), depthWrite: false, blending: T.AdditiveBlending })));
    bloom.name = 'bloom'; root.add(bloom);
    // vents and access hatches at the foot of the wall, between the ribs
    const ventGeos = [], hatchGeos = [], hatchLights = [];
    for (let k = 0; k < RIBS; k++) {
      const a = (k + 0.5) / RIBS * Math.PI * 2 + Math.PI / RIBS, c = Math.cos(a), s = Math.sin(a), nrm = new T.Vector3(-c, 0, -s);
      q.setFromUnitVectors(new T.Vector3(0, 0, 1), nrm);
      const at = (h, out) => new T.Vector3(c * (RW - out), h, s * (RW - out));
      if (k % 4 === 0) {   // a hatch: frame, door, a little status light
        hatchGeos.push(placed(beamBase, at(curbH + 1.5, 0.12), q, s3.set(2.6, 3, 0.2)));
        ventGeos.push(placed(beamBase, at(curbH + 1.45, 0.22), q, s3.set(2.1, 2.6, 0.12)));
        hatchLights.push(placed(beamBase, at(curbH + 3.25, 0.2), q, s3.set(0.35, 0.2, 0.1)));
      } else if (k % 2 === 0) {   // a vent: a frame with slats
        hatchGeos.push(placed(beamBase, at(curbH + 4.2, 0.1), q, s3.set(3.2, 1.4, 0.16)));
        for (let i = 0; i < 4; i++) ventGeos.push(placed(beamBase, at(curbH + 3.75 + i * 0.3, 0.2), q, s3.set(2.8, 0.1, 0.14)));
      }
    }
    if (hatchGeos.length) root.add(new T.Mesh(merge(hatchGeos), lam({ color: 0x6f757d })));
    if (ventGeos.length) root.add(new T.Mesh(merge(ventGeos), lam({ color: 0x3e4349 })));
    if (hatchLights.length) root.add(new T.Mesh(merge(hatchLights), cutaway(new T.MeshBasicMaterial({ color: 0x7dff6a }))));
    // beyond the walls: a wide floor and a quiet grey hall, so the cut-away side never shows the void
    const outFloor = new T.Mesh(new T.RingGeometry(RW, 230, 48, 1), new T.MeshBasicMaterial({ color: 0x55595f }));
    outFloor.rotation.x = -Math.PI / 2; outFloor.position.y = -0.05; root.add(outFloor);
    const hallTex = canvasTex(4, 128, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#8d939c'); r.addColorStop(0.55, '#b4b9c0'); r.addColorStop(1, '#6b7077'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const hall = new T.Mesh(new T.SphereGeometry(235, 24, 12), new T.MeshBasicMaterial({ map: hallTex, side: T.BackSide, fog: false }));
    root.add(hall);
    game.scene.add(root);
    root.traverse(c => c.layers.set(2));   // drawn with the world, like the stars, but left out of the Solid's depth pass, so a wall never hides the Solid
    // grass: soft blades over the whole field
    tufts(R);
    // blob shadows (the void has none): wizards, the Solid, the demon's segments
    const shTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(0.7, 'rgba(0,0,0,0.3)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    const shMat = new T.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }), shGeo = new T.PlaneGeometry(1, 1);
    for (let i = 0; i < 24; i++) { const b = new T.Mesh(shGeo, shMat); b.rotation.x = -Math.PI / 2; b.renderOrder = 1; b.visible = false; b.layers.set(2); root.add(b); blobs.push(b); }
    root.userData.R = R;
  }
  // ---------------------------------------------------------------- grass: soft, dense blades over the whole field, the ground's own green
  // Each instance is a clump of six thin blades. A blade's base takes the colour of the mowed stripe under it and
  // its tip is a little lighter; every blade is lit as if it were the ground (normals straight up), so up close it's
  // blades and from afar it melts into the lawn. A slow breeze rolls across in waves (the tips catch a little light
  // as it passes), and blades bend away from wizards, the Solid and the demon moving through them.
  const GR = { uWind: { value: 0 }, uSway: { value: 1 }, uFlat: { value: new T.Vector3(0, 0, 0) }, uPush: { value: Array.from({ length: 12 }, () => new T.Vector3(0, 0, 0)) } };
  const STRIPES = [new T.Color('#4aab3a'), new T.Color('#3f9e30')];
  function grassMat() {
    const m = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
    m.userData.labKey = '|grass4'; m.customProgramCacheKey = () => 'lab' + m.userData.labKey;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, GR);
      sh.vertexShader = 'uniform float uWind; uniform float uSway; uniform vec3 uFlat; uniform vec3 uPush[12];\n' + sh.vertexShader
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
  {
    float h = position.y;                                   // 0 at the root, about 1 at the tip (before the clump's scale)
    vec3 at = (instanceMatrix * vec4(position, 1.0)).xyz;   // where this point of the blade is on the field
    float k = h * h;
    // the breeze: two long waves crossing the field, and a quick flutter
    float wave = sin(uWind * 0.9 + at.x * 0.16 + at.z * 0.07) * 0.6 + sin(uWind * 1.45 - at.z * 0.21 + at.x * 0.05) * 0.4;
    float flutter = sin(uWind * 4.3 + at.x * 2.1 + at.z * 1.7) * 0.12;
    vec2 bend = vec2(0.85, 0.5) * (0.18 + (wave * 0.22 + flutter) * uSway) * k;   // uSway: Grass sway, 0 holds it still
    // pushed aside by whatever stands in it
    for (int i = 0; i < 12; i++) {
      vec3 p = uPush[i];
      if (p.z <= 0.0) continue;
      vec2 d = at.xz - p.xy; float r = length(d);
      float f = clamp(1.0 - r / p.z, 0.0, 1.0);
      bend += (r > 0.001 ? d / r : vec2(0.0)) * f * f * 0.9 * k;
    }
    // bend in the blade's own frame: undo the clump's turn and scale for the offset
    vec3 wb = vec3(bend.x, -dot(bend, bend) * 0.35, bend.y);
    mat3 im = mat3(instanceMatrix);   // turn and scale only: back into the clump's own frame (works in any GLSL)
    transformed += vec3(dot(im[0], wb) / dot(im[0], im[0]), dot(im[1], wb) / dot(im[1], im[1]), dot(im[2], wb) / dot(im[2], im[2]));
    // pressed flat under the catch ring (uFlat: x, z, radius), so the ring lies on the ground and shows
    if (uFlat.z > 0.0) { float fl = 1.0 - smoothstep(uFlat.z, uFlat.z + 0.35, length(at.xz - uFlat.xy)); transformed.y *= 1.0 - fl * 0.85; transformed.xz *= 1.0 + fl * 0.6; }
    vGrassGust = clamp(wave, 0.0, 1.0) * h * min(uSway, 1.0);
  }
  #endif`)
        .replace('void main() {', 'varying float vGrassGust;\nvoid main() {');
      // both sides of a blade lit like its front (the ground): three.js lights a blade's back with its normal flipped
      // downward, which left every blade turned away from the light nearly black
      sh.fragmentShader = sh.fragmentShader
        .replace('( gl_FrontFacing ) ? vLightFront : vLightBack', 'vLightFront')
        .replace('( gl_FrontFacing ) ? vIndirectFront : vIndirectBack', 'vIndirectFront')
        .replace('void main() {', 'varying float vGrassGust;\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 1.0 + vGrassGust * 0.12;');   // a soft sheen where the breeze passes
    };
    return m;
  }
  function tufts(R) {
    // the clump: six blades, each a narrow triangle, leaning a little and turned every which way
    const pos = [], col = [], nrm = [];
    for (let b = 0; b < 6; b++) {
      const a = rnd(b * 9 + 1) * Math.PI * 2, r = 0.05 + rnd(b * 9 + 2) * 0.28, ox = Math.cos(a) * r, oz = Math.sin(a) * r;
      const turn = rnd(b * 9 + 3) * Math.PI, w = 0.04 + rnd(b * 9 + 4) * 0.025, h = 0.75 + rnd(b * 9 + 5) * 0.5, lean = (rnd(b * 9 + 6) - 0.5) * 0.25;
      const cx = Math.cos(turn) * w, cz = Math.sin(turn) * w;
      pos.push(ox - cx, 0, oz - cz, ox + cx, 0, oz + cz, ox + lean, h, oz + lean * 0.5);
      col.push(0.96, 0.96, 0.96, 0.96, 0.96, 0.96, 1.18, 1.2, 1.08);   // the root a shade under the ground, the tip lighter
      nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
    const N = Math.round(get('grass', 1) * Math.PI * R * R * 5.5);
    if (N <= 0) return;
    const im = new T.InstancedMesh(g, grassMat(), N), m = new T.Matrix4(), qq = new T.Quaternion(), sc = new T.Vector3(), p = new T.Vector3(), c = new T.Color();
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(rnd(i * 3 + 1)) * (R - 0.25), a = rnd(i * 3 + 2) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = 0.17 + rnd(i * 3 + 3) * 0.12;   // ankle height: up to about a third of a wizard's hem
      p.set(x, -0.03, z); qq.setFromAxisAngle(up, rnd(i * 7) * Math.PI * 2); sc.set(1, h, 1);
      m.compose(p, qq, sc); im.setMatrixAt(i, m);
      // the stripe under it, the way the lawn texture lays them out (12 across the field)
      const u = (x / (R + 0.05) + 1) / 2, stripe = Math.floor(u * 12) % 2;
      im.setColorAt(i, c.copy(STRIPES[stripe]).multiplyScalar(0.97 + rnd(i * 11) * 0.06));
    }
    im.frustumCulled = false; im.name = 'grass'; root.add(im);
  }
  LAB.grassFlat = (x, z, r) => GR.uFlat.value.set(x, z, r || 0);   // the catch ring presses the grass flat under it (0 lets it go)
  // what pushes the grass aside this frame
  function pushers() {
    const P = GR.uPush.value; let k = 0;
    const put = (x, z, r) => { if (k < P.length) P[k++].set(x, z, r); };
    for (const W of game.ALL) if (W.root.visible && W.y < 1.2) put(W.pos.x, W.pos.z, 0.9 * (W.root.scale.y || 1));
    if (o.state !== 'held' && o.p.y < 1) put(o.p.x, o.p.z, 0.7);
    if (D.alive && !D.dying && D.scale > 0.3) { const ps = game.demonParts(); for (let i = 0; i < ps.length && k < P.length; i += 3) put(ps[i].x, ps[i].z, ps[i].r * 1.6); }
    for (; k < P.length; k++) P[k].set(0, 0, 0);
  }
  function clear() {
    if (!root) return;
    game.scene.remove(root);
    root.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } });
    root = null; blobs = [];
  }

  // ---------------------------------------------------------------- the dome's light: soft and even from above, no purple rim
  function relight(on) {
    if (on && !saved) {
      saved = game.scene.children.filter(c => c.isLight).map(L => ({ L, c: L.color.clone(), i: L.intensity }));
      for (const s of saved) {
        if (s.L.isAmbientLight) { s.L.color.set(0xf2f0ea); s.L.intensity = 0.5; }
        else if (s.L.isDirectionalLight && s.L.color.getHex() === 0xffffff) { s.L.intensity = 0.5; }
        else if (s.L.isDirectionalLight) { s.L.color.set(0xdfe6ff); s.L.intensity = 0.22; }
      }
      const hemi = new T.HemisphereLight(0xfffaf0, 0x5f9a48, 0.35); hemi.name = 'domeHemi'; game.scene.add(hemi); lights.push(hemi);
    }
    if (!on && saved) {
      for (const s of saved) { s.L.color.copy(s.c); s.L.intensity = s.i; }
      saved = null; for (const L of lights) game.scene.remove(L); lights = [];
    }
  }

  // ---------------------------------------------------------------- staying inside
  function contain(dt) {
    const R = root.userData.R, RW = R + 1.6, TOP = 9 + R * 0.62 - 1.5;
    for (const W of game.ALL) {
      const r = Math.hypot(W.pos.x, W.pos.z), lim = R - 0.55;
      if (r > lim) { W.pos.x *= lim / r; W.pos.z *= lim / r; const vn = (W.vel.x * W.pos.x + W.vel.z * W.pos.z) / lim; if (vn > 0) { W.vel.x -= vn * W.pos.x / lim; W.vel.z -= vn * W.pos.z / lim; } }
    }
    // the Solid: off the curb low down, off the wall higher up, off the ceiling
    if (o.state === 'air' || o.state === 'ground') {
      const r = Math.hypot(o.p.x, o.p.z), lim = (o.p.y < 0.9 ? R : RW - 0.4) - 0.45;
      if (r > lim) {
        const nx = o.p.x / r, nz = o.p.z / r, vn = o.v.x * nx + o.v.z * nz;
        o.p.x = nx * lim; o.p.z = nz * lim;
        if (vn > 0) { const k = 1 + (game.solid.rest || 0.5); o.v.x -= vn * nx * k; o.v.z -= vn * nz * k; if (vn > 4) game.fxBurst(o.p.clone(), 0xffffff, 8, 2); }
      }
      if (o.p.y > TOP * (1 - (r / RW) * (r / RW) * 0.6) && o.v.y > 0) o.v.y = -o.v.y * 0.6;
    }
    if (D.alive) {
      const r = Math.hypot(D.pos.x, D.pos.z), lim = R - 1.2 * (D.scale || 1);
      if (r > lim) { D.pos.x *= lim / r; D.pos.z *= lim / r; const vn = (D.vel.x * D.pos.x + D.vel.z * D.pos.z) / lim; if (vn > 0) { D.vel.x -= vn * D.pos.x / lim; D.vel.z -= vn * D.pos.z / lim; } }
    }
    for (const V of game.venoms) if (V.alive && Math.hypot(V.g.position.x, V.g.position.z) > RW - 0.3) { V.alive = false; V.g.visible = false; }
    // blob shadows
    let k = 0;
    const blob = (x, z, y, size) => { const b = blobs[k++]; if (!b) return; const f = 1 / (1 + Math.max(0, y) * 0.35); b.visible = true; b.position.set(x, 0.005, z); b.scale.setScalar(size * f); b.material.opacity = 1; };
    for (const W of game.ALL) if (W.root.visible) blob(W.pos.x, W.pos.z, W.y, 1.5 * (W.root.scale.y || 1));
    if (o.state !== 'held') blob(o.p.x, o.p.z, o.p.y - 0.4, 1.1);
    if (D.alive && !D.dying && D.scale > 0.3) { const ps = game.demonParts(); for (let i = 0; i < ps.length && k < blobs.length; i += 2) blob(ps[i].x, ps[i].z, 0, ps[i].r * 2.4); }
    for (; k < blobs.length; k++) blobs[k].visible = false;
  }

  // ---------------------------------------------------------------- switching
  let built = null, fogWas = null;
  function set(on) {
    if (on) {
      const key = get('size', 38);
      if (!root || built !== key) { build(); built = key; }
      root.visible = true; relight(true);
      if (game.motes) game.motes.visible = false;
    } else {
      if (root) root.visible = false;
      relight(false); camOut();
      if (fogWas) { fogWas.color.set(0x000000); fogWas = null; }
      if (game.motes) game.motes.visible = true;
    }
  }
  // the camera stays inside: if the wall or the ceiling is between you and it, it comes in along that line and waits
  // there, against the wall, with everything else just getting closer; it eases back out when there's room again.
  // Coming in, its lens widens a little so you still see around you.
  const look0 = new T.Vector3(), want = new T.Vector3(), tryP = new T.Vector3();
  let armK = 1, camT = 0, baseNear = game.camera.near;
  function inside(p, R) {
    const RW = R + 1.6, H = 9, CAP = R * 0.62, r = Math.hypot(p.x, p.z), m = 1.8;
    if (r > RW - m || p.y < 0.5) return false;
    if (p.y <= H) return true;
    const rr = r / (RW - m); if (rr >= 1) return false;
    return p.y < H + (CAP - m) * Math.sqrt(1 - rr * rr);
  }
  function keepIn(cam, look) {
    const R = root.userData.R, now = performance.now() / 1000, dt = camT ? Math.min(0.1, now - camT) : 0; camT = now;
    look0.copy(look); if (!inside(look0, R)) { look0.y = Math.max(0.6, look0.y); }
    want.copy(cam.position);
    let k = 1;
    if (!inside(want, R)) { let lo = 0, hi = 1; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; tryP.lerpVectors(look0, want, mid); if (inside(tryP, R)) lo = mid; else hi = mid; } k = lo; }
    armK = k < armK ? k : Math.min(k, armK + dt * 1.5);   // in at once, out gently
    cam.position.lerpVectors(look0, want, armK);
    // a wider lens when pulled in, so the view around you doesn't shrink to nothing
    const base = LAB.get('camera.fov') ?? 30, f = armK < 0.999 ? Math.min(78, 2 * Math.atan(Math.tan(base * Math.PI / 360) * Math.pow(1 / Math.max(0.05, armK), 0.6)) * 180 / Math.PI) : base;
    if (Math.abs(cam.fov - f) > 0.05 || cam.near !== 0.3) { cam.fov = f; cam.near = 0.3; cam.updateProjectionMatrix(); }
  }
  function camOut() {   // leaving the dome: the lens and near plane as they were
    const c = game.camera; armK = 1; camT = 0;
    c.fov = LAB.get('camera.fov') ?? c.fov; c.near = baseNear; c.updateProjectionMatrix();
  }
  let hooked = false;
  function hook() {
    if (hooked) return; hooked = true;   // after the Camera shelf has moved the camera
    window.FEATURES.on('camera', (cam, look) => {
      if (!dome() || !root) return;
      keepIn(cam, look);
      const x = cam.position.x, z = cam.position.z, r = Math.hypot(x, z);
      CUT.uCut.value = r > root.userData.R + 1 ? 1 : 0;
      if (r > 0.01) CUT.uCamDir.value.set(x / r, z / r);
    }, 'lab');
  }
  function tick(dt) {
    if (!dome()) return;
    hook(); GR.uWind.value = performance.now() / 1000; GR.uSway.value = get('sway', 1); pushers();
    if (!root || built !== get('size', 38)) set(true);
    const b = root.getObjectByName('bloom'); if (b) b.material.opacity = get('bloom', 0.55);
    const F = game.scene.fog; if (F && F.color.getHex() !== 0xc9ced6) { fogWas = F; F.color.set(0xc9ced6); }   // fog in here is a light haze, not the void's black
    contain(dt);
  }
  const NAMES = ['VOID', 'PRACTICE DOME'];
  return [
    { id: 'pick', label: 'Map', help: 'Where the match is played: the Void, or the Practice Dome (an indoor grass field)', min: 0, max: NAMES.length - 1, step: 1, value: 0, dice: false,
      fmt: (v) => NAMES[Math.round(v)] || '?', frame: (dt) => tick(dt), apply: (v) => set(Math.round(v) === 1) },
    { id: 'size', label: 'Dome size', help: 'How far it is from the centre of the field to the curb', min: 24, max: 60, step: 2, value: 38, dice: false, apply: () => { if (dome()) set(true); } },
    { id: 'grass', label: 'Grass detail', help: 'How thick the grass is (0 is a plain mowed lawn)', min: 0, max: 2, step: 0.25, value: 1, dice: false, fmt: (x) => (x ? Math.round(x * 100) + '%' : 'OFF'), apply: () => { if (dome()) { build(); built = get('size', 38); set(true); } } },
    { id: 'sway', label: 'Grass sway', help: 'How much the breeze moves the grass (0 holds it still; it still parts around you)', min: 0, max: 2, step: 0.1, value: 1, dice: false, fmt: (x) => (x ? Math.round(x * 100) + '%' : 'OFF') },
    { id: 'bloom', label: 'Light glow', help: 'How much the dome lights glow', min: 0, max: 1.2, step: 0.05, value: 0.55, dice: false, fmt: (x) => Math.round(x * 100) + '%' }
  ];
});
