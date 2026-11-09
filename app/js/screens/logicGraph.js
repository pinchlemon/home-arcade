// The Studio's Logic tab for games on the tile engine: visual logic as a node graph. Boxes sit on a canvas and wires join
// their dots. White wires carry the flow (what happens next); blue wires carry a number into a box's setting.
// Touch: drag the background to move the view, two fingers to zoom, drag a box to move it, tap a box to change it,
// drag from a dot to another dot to join them (or tap one dot, then the other). The boxes come from engine/logic.json,
// and engine/logic.js runs the graphs in the game. A game keeps its graphs in game.json under "logic".
import { well, svgRows, svgText, G } from '../pixel.js';
import { A, esc, iconBtn, stepper, bareBtn } from '../ui.js';

export const NW = 136, HH = 26, RH = 20;
const GREEN = '#7dff6a', BLUE = '#4d7cff', BONE = '#e4e2dc';
const ICON = { event: 'nodeEvent', flow: 'nodeFlow', action: 'nodeAction', value: 'nodeValue' };
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const blank = (id, name) => ({ id, name, scene: '', nodes: [], wires: [] });
const fmtNum = (v) => String(Math.round((+v || 0) * 100) / 100);
const snap = (v) => Math.round(v / 4) * 4;

// the game's graphs (a game without any shows one empty graph, saved with its first box)
export function graphsOf(D) { const l = D.logic; return Array.isArray(l) && l.length ? l : [blank('g1', 'Logic 1')]; }
// a box's rows under its title: the flow outputs when there are two, then its settings
export function shape(sp) {
  const outs = sp.outs || [], rows = [];
  if (outs.length > 1) outs.forEach((name, i) => rows.push({ kind: 'out', port: 'o' + i, name }));
  for (const p of sp.params || []) rows.push({ kind: 'param', p });
  return { rows, h: HH + rows.length * RH + (rows.length ? 5 : 0), headOut: outs.length === 1 ? 'o0' : sp.value ? 'v' : null, headIn: !!sp.in };
}
// where a box's dots are: flow in on the left of the title, outputs on the right, wireable numbers on the left of their row
export function portsOf(n, sp) {
  const sh = shape(sp), list = [];
  const done = () => { for (const p of list) { p.top = n.y; p.bot = n.y + sh.h; } return list; };
  if (sh.headIn) list.push({ n: n.id, port: 'in', side: 'in', type: 'flow', x: n.x, y: n.y + HH / 2, name: 'In' });
  if (sh.headOut) list.push({ n: n.id, port: sh.headOut, side: 'out', type: sh.headOut === 'v' ? 'num' : 'flow', x: n.x + NW, y: n.y + HH / 2, name: sh.headOut === 'v' ? 'Number' : sp.outs[0] });
  sh.rows.forEach((r, i) => {
    const y = n.y + HH + i * RH + RH / 2;
    if (r.kind === 'out') list.push({ n: n.id, port: r.port, side: 'out', type: 'flow', x: n.x + NW, y, name: r.name });
    else if (r.p.type === 'num' && !r.p.fixed) list.push({ n: n.id, port: r.p.k, side: 'in', type: 'num', x: n.x, y, name: r.p.name });
  });
  return done();
}
const fits = (a, b) => a && b && a.n !== b.n && a.type === b.type && a.side !== b.side;
// can a new box of this kind join the dot that was picked?
function fitsKind(sp, arm) {
  if (!arm) return true;
  if (arm.side === 'out') return arm.type === 'flow' ? !!sp.in : (sp.params || []).some(p => p.type === 'num' && !p.fixed);
  return arm.type === 'flow' ? (sp.outs || []).length > 0 : !!sp.value;
}
const pv = (n, p) => { const v = (n.p || {})[p.k]; return v === undefined || v === null ? p.default : v; };
// the choices of a setting, and how a value reads
function optionsOf(c, p) {
  const D = c.data();
  if (p.type === 'obj') return [...(p.it ? [['@it', 'That one']] : []), ...(p.any ? [['', 'Any thing']] : []), ...Object.entries(D.objects || {}).map(([id, o]) => [id, o.name])];
  if (p.type === 'tile') return [...(p.none ? [['', 'Nothing']] : []), ...Object.entries(D.tiles || {}).map(([ch, t]) => [ch, t.name])];
  if (p.type === 'scene') return [['@next', 'Next'], ['@again', 'This one'], ...c.scenes().filter(s => s.kind === 'tiles').map(s => [s.id, s.name])];
  return p.options || [];
}
function label(c, p, v) {
  if (p.type === 'num') return fmtNum(v);
  if (p.type === 'text' || p.type === 'name') return String(v);
  const o = optionsOf(c, p).find(x => x[0] === v);
  return o ? o[1] : 'None';
}
// a wire from an output dot (a) to an input dot (b): a soft curve when b is to the right; when it is not, the wire
// goes round, through the gap between the two boxes when there is one
function wirePath(a, b) {
  if (b.x >= a.x + 24) { const d = Math.max(24, (b.x - a.x) / 2); return `M${a.x} ${a.y}C${a.x + d} ${a.y} ${b.x - d} ${b.y} ${b.x} ${b.y}`; }
  let my = (a.y + b.y) / 2;
  if (a.bot !== undefined && b.top !== undefined) { if (b.top - a.bot >= 10) my = (a.bot + b.top) / 2; else if (a.top - b.bot >= 10) my = (a.top + b.bot) / 2; }
  const x1 = a.x + 16, x2 = b.x - 16, s1 = my >= a.y ? 1 : -1, s2 = b.y >= my ? 1 : -1;
  const r1 = Math.min(8, Math.abs(my - a.y) / 2), r2 = Math.min(8, Math.abs(b.y - my) / 2);
  return `M${a.x} ${a.y}H${x1 - r1}Q${x1} ${a.y} ${x1} ${a.y + s1 * r1}V${my - s1 * r1}Q${x1} ${my} ${x1 - r1} ${my}H${x2 + r2}Q${x2} ${my} ${x2} ${my + s2 * r2}V${b.y - s2 * r2}Q${x2} ${b.y} ${x2 + r2} ${b.y}H${b.x}`;
}
// every wire as an SVG path (temp: the wire being dragged)
function wiresSvg(gr, spec, S, temp) {
  const ports = {};
  for (const n of gr.nodes) if (spec.nodes[n.t]) for (const p of portsOf(n, spec.nodes[n.t])) ports[p.n + ':' + p.port] = p;
  let out = '';
  gr.wires.forEach((w, i) => {
    const a = ports[w[0] + ':' + w[1]], b = ports[w[2] + ':' + w[3]]; if (!a || !b) return;
    out += `<path data-i="${i}" class="${a.type}${S.wire === i ? ' sel' : ''}" d="${wirePath(a, b)}"/>`;
  });
  if (temp) out += `<path class="${temp.type} temp" d="${temp.rev ? wirePath(temp.b, temp.a) : wirePath(temp.a, temp.b)}"/>`;
  return out;
}
function boundsOf(nodes, spec) {
  if (!nodes.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + NW); y1 = Math.max(y1, n.y + shape(spec.nodes[n.t]).h); }
  return { x0, y0, x1, y1 };
}
function fitView(nodes, spec, CW, CH) {
  const b = boundsOf(nodes, spec); if (!b) return { z: 1, ox: 24, oy: 24 };
  const z = Math.max(0.4, Math.min(1, (CW - 56) / (b.x1 - b.x0), (CH - 56) / (b.y1 - b.y0)));
  return { z, ox: (CW - (b.x1 - b.x0) * z) / 2 - b.x0 * z, oy: (CH - (b.y1 - b.y0) * z) / 2 - b.y0 * z };
}
// a free spot near (x, y) for a box h tall: step down while another box is in the way (leaving room for wires)
function freeSpot(nodes, spec, x, y, h) {
  x = snap(x); y = snap(y);
  for (let k = 0; k < 60; k++) {
    const hit = nodes.find(n => Math.abs(n.x - x) < NW + 16 && y < n.y + shape(spec.nodes[n.t]).h + 16 && y + h + 16 > n.y);
    if (!hit) break;
    y = snap(hit.y + shape(spec.nodes[hit.t]).h + 20);
  }
  return { x, y };
}

// c: { app, ed, g, data, scenes, objects, rerender, spec, changeLogic }
export function logicGraph(c) {
  const { ed } = c, spec = c.spec && c.spec.nodes ? c.spec : { nodes: {}, groups: [] };
  const S = ed.lg || (ed.lg = { graph: null, sel: null, wire: null, arm: null, adding: false, group: 'event', views: {} });
  const D = c.data(), list = graphsOf(D);
  let gr = list.find(x => x.id === S.graph);
  if (!gr) { gr = list[0]; S.graph = gr.id; S.sel = S.wire = S.arm = null; }
  const gi = list.indexOf(gr), nodes = gr.nodes.filter(n => spec.nodes[n.t]);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  if (S.sel && !byId[S.sel]) S.sel = null;
  if (S.wire !== null && !gr.wires[S.wire]) S.wire = null;
  if (S.arm && !byId[S.arm.n]) S.arm = null;
  const groupOf = (id) => spec.groups.find(x => x.id === id) || { name: '', color: BONE };
  const wired = new Set(); gr.wires.forEach(w => { wired.add(w[0] + ':' + w[1]); wired.add(w[2] + ':' + w[3]); });
  const srcOf = (n, k) => { const w = gr.wires.find(x => x[2] === n.id && x[3] === k); return w ? byId[w[0]] : null; };
  // every change goes through here: l is all the graphs, g the one on screen
  const change = (fn) => c.changeLogic(l => { if (!l.length) l.push(blank(gr.id, gr.name)); fn(l.find(x => x.id === gr.id) || l[0], l); });
  const done = () => c.rerender();

  // ---- the canvas
  const nodeHtml = (n) => {
    const sp = spec.nodes[n.t], sh = shape(sp), gp = groupOf(sp.group), armed = S.arm;
    const dots = portsOf(n, sp).map(p => {
      const on = wired.has(p.n + ':' + p.port), isArm = armed && armed.n === p.n && armed.port === p.port, ok = armed && fits(armed, p);
      return `<i class="lg-p ${p.type} ${p.side}${on ? ' on' : ''}${isArm ? ' arm' : ''}${ok ? ' ok' : ''}" style="left:${p.x - n.x}px;top:${p.y - n.y}px"></i>`;
    }).join('');
    const rows = sh.rows.map(r => {
      if (r.kind === 'out') return `<div class="lg-r out">${esc(r.name)}</div>`;
      const src = r.p.type === 'num' && srcOf(n, r.p.k);
      return `<div class="lg-r"><span class="l">${esc(r.p.name)}</span><span class="v${src ? ' w' : ''}">${src ? esc(spec.nodes[src.t].name) : esc(label(c, r.p, pv(n, r.p)))}</span></div>`;
    }).join('');
    return `<div class="lg-node${S.sel === n.id ? ' sel' : ''}" data-n="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px;height:${sh.h}px;--c:${gp.color}"><div class="lg-h">${esc(sp.name)}</div>${rows}${dots}</div>`;
  };
  const v0 = S.views[gr.id];
  const screen = `<div class="screen fit gap20 lg-view${S.adding ? ' small' : ''}" id="lgv" role="application" aria-label="${esc(gr.name)}: ${nodes.length} boxes. Drag a box to move it, drag from a dot to another dot to join them.">
      <div class="lg-world" id="lgw"${v0 ? ` style="transform:translate(${v0.ox}px,${v0.oy}px) scale(${v0.z})"` : ''}>
        <svg class="lg-wires" id="lgs" width="1" height="1">${wiresSvg(gr, spec, S)}</svg>${nodes.map(nodeHtml).join('')}</div>
      ${nodes.length ? '' : '<span class="sub lg-empty">No boxes yet. Tap + BOX and start with an Event.</span>'}
      <button class="se-zoom ts-look on" id="lg-add" ${A(() => { S.adding = !S.adding; done(); })} aria-pressed="${!!S.adding}" aria-label="Add a box">+ BOX</button>
      <button class="se-zoom" id="lg-fit" ${A(() => { delete S.views[gr.id]; done(); })} aria-label="Fit the graph">FIT</button></div>`;

  // ---- adding a box
  function add(t) {
    const sp = spec.nodes[t], arm = S.arm, id = uid('n'), p = {};
    for (const q of sp.params || []) {
      p[q.k] = q.default;
      if (q.type === 'obj' && !q.any && !q.it) p[q.k] = Object.keys(D.objects || {})[0] || '';
      if (q.type === 'tile' && !q.none) p[q.k] = Object.keys(D.tiles || {})[0] || '';
    }
    let at;
    const from = arm && byId[arm.n];
    if (from) { const ap = portsOf(from, spec.nodes[from.t]).find(q => q.port === arm.port) || { y: from.y }; at = { x: from.x + (arm.side === 'out' ? NW + 44 : -NW - 44), y: ap.y - HH / 2 }; }
    else { const v = S.views[gr.id] || { z: 1, ox: 24, oy: 24 }, sz = S.size || { w: 340, h: 280 }; at = { x: (sz.w / 2 - v.ox) / v.z - NW / 2, y: (sz.h / 2 - v.oy) / v.z - 30 }; }
    at = freeSpot(nodes, spec, at.x, at.y, shape(sp).h);
    const n = { id, t, x: at.x, y: at.y, p };
    change(g => {
      g.nodes.push(n);
      if (!from) return;
      const mine = portsOf(n, sp), other = mine.find(q => fits(arm, q));
      if (other) join(g, arm.side === 'out' ? arm : other, arm.side === 'out' ? other : arm);
    });
    S.sel = id; S.wire = null; S.arm = null; S.adding = false; S.reveal = id; done();
  }
  let body;
  if (S.adding) {
    const arm = S.arm, kinds = Object.entries(spec.nodes).filter(([, sp]) => fitsKind(sp, arm));
    const has = (gid) => kinds.some(([, sp]) => sp.group === gid);
    if (!has(S.group)) S.group = (spec.groups.find(x => has(x.id)) || { id: 'event' }).id;
    const gp = groupOf(S.group);
    body = `<div class="ihead">${well(40, svgRows(G[ICON[S.group]] || G.plus, gp.color))}<span class="t"><span class="title ell" style="color:${gp.color}">Add · ${esc(gp.name)}</span><span class="sub">${arm ? 'Boxes that fit the dot you picked' : esc(gp.help || '')}</span></span>
        ${iconBtn('back', A(() => { S.adding = false; done(); }), { label: 'Close the list' })}</div>
      <div class="lg-groups" role="tablist" aria-label="Kinds of box">${spec.groups.map(x => { const on = x.id === S.group, ok = has(x.id); return `<button class="seg${on ? ' on' : ''}" role="tab" aria-selected="${on}"${ok ? '' : ' disabled'} style="--c:${x.color}" ${A(() => { S.group = x.id; done(); })}>${esc(x.name)}</button>`; }).join('')}</div>
      <div class="lg-list">${kinds.filter(([, sp]) => sp.group === S.group).map(([t, sp]) => `<button class="lg-add" ${A(() => add(t))}><span class="cap" style="color:${gp.color}">${esc(sp.name)}</span><span class="sub">${esc(sp.help)}</span></button>`).join('')}</div>`;
  } else if (S.arm) {
    const n = byId[S.arm.n], sp = spec.nodes[n.t], po = portsOf(n, sp).find(q => q.port === S.arm.port) || { name: '' };
    body = `<div class="ihead">${well(40, svgRows(G.events, S.arm.type === 'num' ? BLUE : BONE))}<span class="t"><span class="title acc ell">Join · ${esc(sp.name)}</span><span class="sub">${S.arm.type === 'num' ? 'A number' : 'The flow'} ${S.arm.side === 'out' ? 'out of' : 'into'} ${esc(po.name)}</span></span>
        ${iconBtn('back', A(() => { S.arm = null; done(); }), { label: 'Stop joining' })}</div>
      <div class="grow"><span class="t"><span class="cap">Join a box</span><span class="sub">Tap a ringed dot on another box</span></span></div>
      <div class="grow"><span class="t"><span class="cap">Or a new box</span><span class="sub">Adds one that is already joined</span></span>${bareBtn('plus', 'Add', A(() => { S.adding = true; done(); }))}</div>`;
  } else if (S.wire !== null) {
    const w = gr.wires[S.wire], a = byId[w[0]], b = byId[w[2]], num = w[1] === 'v';
    body = `<div class="ihead">${well(40, svgRows(G.events, num ? BLUE : BONE))}<span class="t"><span class="title acc ell">${num ? 'Number wire' : 'Flow wire'}</span><span class="sub">${a && b ? esc(spec.nodes[a.t].name) + ' to ' + esc(spec.nodes[b.t].name) : ''}</span></span>
        ${iconBtn('trash', A(() => { const i = S.wire; S.wire = null; change(g => { g.wires.splice(i, 1); }); done(); }), { label: 'Cut this wire' })}</div>
      <div class="grow"><span class="t"><span class="cap">${num ? 'Carries a number' : 'Carries the flow'}</span><span class="sub">${num ? 'The box on the right uses the number from the box on the left' : 'When the box on the left is done, the box on the right runs'}</span></span></div>`;
  } else if (S.sel) {
    const n = byId[S.sel], sp = spec.nodes[n.t], gp = groupOf(sp.group);
    const setP = (k, v) => { change(g => { const m = g.nodes.find(x => x.id === n.id); if (m) (m.p = m.p || {})[k] = v; }); done(); };
    const rows = (sp.params || []).map(p => {
      const v = pv(n, p);
      if (p.type === 'num') {
        const src = srcOf(n, p.k);
        if (src) return `<div class="grow"><span class="t"><span class="cap">${esc(p.name)}</span><span class="sub">Wired from ${esc(spec.nodes[src.t].name)}</span></span>${iconBtn('cut', A(() => { change(g => { g.wires = g.wires.filter(w => !(w[2] === n.id && w[3] === p.k)); }); done(); }), { label: 'Cut the wire into ' + p.name })}</div>`;
        const lim = (x) => Math.round(Math.max(p.min === undefined ? -99999 : p.min, Math.min(p.max === undefined ? 99999 : p.max, x)) * 100) / 100, st = p.step || 1;
        return `<div class="grow"><span class="t"><span class="cap">${esc(p.name)}</span>${p.fixed ? '' : '<span class="sub">Or wire a number into its dot</span>'}</span><span class="stepper">${iconBtn('minus', A(() => setP(p.k, lim(+v - st))), { label: 'Less ' + p.name })}
          <button class="vscreen" ${A(() => { const t = prompt(p.name, fmtNum(v)); if (t !== null && t.trim() !== '' && isFinite(+t)) setP(p.k, lim(+t)); })} aria-label="${esc(p.name)} ${fmtNum(v)}: tap to type">${svgText(fmtNum(v), 'var(--acc)')}</button>${iconBtn('plus', A(() => setP(p.k, lim(+v + st))), { label: 'More ' + p.name })}</span></div>`;
      }
      if (p.type === 'text' || p.type === 'name') {
        const ask = () => { let t = prompt(p.name, String(v)); if (t === null) return; t = t.trim().slice(0, p.type === 'name' ? 16 : 38); if (p.type === 'name') t = t.toLowerCase(); if (t) setP(p.k, t); };
        return `<div class="grow"><span class="t"><span class="cap">${esc(p.name)}</span><span class="sub">${p.type === 'name' ? 'Boxes with the same name share it' : 'Tap to type'}</span></span><button class="vscreen wide lg-text" ${A(ask)} aria-label="${esc(p.name)}: ${esc(v)}. Tap to type">${esc(String(v))}</button></div>`;
      }
      const opts = optionsOf(c, p), i = Math.max(0, opts.findIndex(o => o[0] === v)), step = (d) => setP(p.k, opts[(i + d + opts.length) % opts.length][0]);
      if (!opts.length) return `<div class="grow"><span class="t"><span class="cap">${esc(p.name)}</span><span class="sub">Nothing to choose yet</span></span></div>`;
      return `<div class="grow"><span class="t"><span class="cap">${esc(p.name)}</span>${v === 'it' || v === '@it' ? '<span class="sub">The thing the event is about</span>' : ''}</span>${stepper(String(opts[i][1]).slice(0, 13), A(() => step(-1)), A(() => step(1)), p.name, true)}</div>`;
    }).join('');
    body = `<div class="ihead">${well(40, svgRows(G[ICON[sp.group]] || G.events, gp.color))}<span class="t"><span class="title ell" style="color:${gp.color}">${esc(sp.name)}</span><span class="sub" style="white-space:normal">${esc(sp.help)}</span></span>
        ${iconBtn('dup', A(() => { const id = uid('n'), at = freeSpot(nodes, spec, n.x + 16, n.y + shape(sp).h + 20, shape(sp).h); change(g => { g.nodes.push({ ...structuredClone(n), id, x: at.x, y: at.y }); }); S.sel = id; S.reveal = id; done(); }), { label: 'Duplicate this box' })}
        ${iconBtn('trash', A(() => { S.sel = null; change(g => { g.nodes = g.nodes.filter(x => x.id !== n.id); g.wires = g.wires.filter(w => w[0] !== n.id && w[2] !== n.id); }); done(); }), { label: 'Delete this box' })}</div>${rows}`;
  } else {
    const sc = [['', 'All scenes'], ...c.scenes().filter(s => s.kind === 'tiles').map(s => [s.id, s.name])], si = Math.max(0, sc.findIndex(s => s[0] === (gr.scene || '')));
    const runs = (d) => { change(g => { g.scene = sc[(si + d + sc.length) % sc.length][0]; }); done(); };
    body = `<div class="ihead">${well(40, svgRows(G.events, GREEN))}<span class="t"><span class="title acc ell">${esc(gr.name)}</span><span class="sub">${nodes.length} ${nodes.length === 1 ? 'box' : 'boxes'} · ${gr.wires.length} ${gr.wires.length === 1 ? 'wire' : 'wires'}</span></span>
        ${iconBtn('rename', A(() => { const t = prompt('Graph name', gr.name); if (t && t.trim()) { change(g => { g.name = t.trim().slice(0, 24); }); done(); } }), { label: 'Rename graph' })}
        ${iconBtn('trash', A(() => { if (!confirm('Delete ' + gr.name + ' and its ' + nodes.length + ' boxes?')) return; c.changeLogic(l => { const i = l.findIndex(x => x.id === gr.id); if (i >= 0) l.splice(i, 1); }); S.graph = null; done(); }), { label: 'Delete graph' })}</div>
      <div class="grow"><span class="t"><span class="cap">Runs in</span><span class="sub">One scene, or every scene</span></span>${stepper(String(sc[si][1]).slice(0, 13), A(() => runs(-1)), A(() => runs(1)), 'scene', true)}</div>
      ${nodes.length ? `<div class="grow"><span class="t"><span class="cap">Joining boxes</span><span class="sub">Drag from a dot to another dot. White carries the flow, blue carries a number. Tap a wire to cut it.</span></span></div>`
    : `<div class="grow"><span class="t"><span class="cap">Example</span><span class="sub">Joined boxes to try and change</span></span>${bareBtn('plus', 'Add', A(() => { change(g => example(g, D)); delete S.views[gr.id]; done(); }))}</div>`}`;
  }
  const go = (k) => { S.graph = list[(gi + k + list.length) % list.length].id; S.sel = S.wire = S.arm = null; S.adding = false; done(); };
  const graphsBar = `<div class="plate bar" data-pad="pager">
      <span class="cap" style="color:var(--muted);padding-left:10px">Graph</span>
      <div style="display:flex;align-items:center;gap:2px">
        ${iconBtn('left', A(() => go(-1)), { color: '#fff', label: 'Previous graph' })}<span class="cap acc" style="min-width:30px;text-align:center">${gi + 1}/${list.length}</span>${iconBtn('right', A(() => go(1)), { color: '#fff', label: 'Next graph' })}
        ${iconBtn('dup', A(() => { const id = uid('g'); c.changeLogic(l => { if (!l.length) l.push(blank(gr.id, gr.name)); const k = structuredClone(gr); k.id = id; k.name = (gr.name + ' copy').slice(0, 24); l.splice(gi + 1, 0, k); }); S.graph = id; S.sel = S.wire = S.arm = null; done(); }), { label: 'Duplicate graph' })}
        ${iconBtn('plus', A(() => { const id = uid('g'); c.changeLogic(l => { if (!l.length) l.push(blank(gr.id, gr.name)); l.push(blank(id, 'Logic ' + (l.length + 1))); }); S.graph = id; S.sel = S.wire = S.arm = null; S.adding = false; done(); }), { label: 'New graph' })}
      </div></div>`;
  return { screen, panel: `<div class="plate inspector gap20 ts-insp lg-insp">${body}</div>${graphsBar}` };
}
// join an output dot to an input dot: a number input takes one wire, and the same wire is never made twice
function join(g, a, b) {
  if (b.type === 'num') g.wires = g.wires.filter(w => !(w[2] === b.n && w[3] === b.port));
  if (!g.wires.some(w => w[0] === a.n && w[1] === a.port && w[2] === b.n && w[3] === b.port)) g.wires.push([a.n, a.port, b.n, b.port]);
}
// three joined boxes for a first look: collect a thing, get points, see a message
export function example(g, D) {
  const pick = Object.keys(D.objects || {}).find(id => ((D.objects[id].behaviors || []).some(b => b.type === 'collectible'))) || '';
  const a = uid('n'), b = a + 'b', k = a + 'c';
  g.nodes.push({ id: a, t: 'collect', x: 16, y: 16, p: { obj: pick } }, { id: b, t: 'score', x: 196, y: 16, p: { n: 5 } }, { id: k, t: 'say', x: 196, y: 96, p: { text: 'SCORE #', v: 0, secs: 2 } }, { id: a + 'd', t: 'scoreV', x: 16, y: 116, p: {} });
  g.wires.push([a, 'o0', b, 'in'], [b, 'o0', k, 'in'], [a + 'd', 'v', k, 'v']);
}

// ---------------------------------------------------------------- touch
export function mountLogicGraph(root, c) {
  const view = root.querySelector('#lgv'); if (!view) return;
  const { ed } = c, S = ed.lg, spec = c.spec && c.spec.nodes ? c.spec : { nodes: {}, groups: [] };
  const world = view.querySelector('#lgw'), svg = view.querySelector('#lgs');
  const list = graphsOf(c.data()), gr = structuredClone(list.find(x => x.id === S.graph) || list[0]);   // moved live under a finger, saved when it lifts
  gr.nodes = gr.nodes.filter(n => spec.nodes[n.t]);
  const box = view.getBoundingClientRect(), CW = box.width, CH = box.height;
  S.size = { w: CW, h: CH };
  const hOf = (n) => shape(spec.nodes[n.t]).h;
  const V = () => S.views[gr.id] || (S.views[gr.id] = fitView(gr.nodes, spec, CW, CH));
  function apply() {
    const v = V();
    world.style.transform = `translate(${v.ox}px,${v.oy}px) scale(${v.z})`;
    view.style.backgroundSize = `${16 * v.z}px ${16 * v.z}px`; view.style.backgroundPosition = `${v.ox}px ${v.oy}px`;
  }
  // bring a new box into view
  if (S.reveal) {
    const n = gr.nodes.find(x => x.id === S.reveal), v = V(); delete S.reveal;
    if (n) {
      const x0 = n.x * v.z + v.ox, y0 = n.y * v.z + v.oy, x1 = x0 + NW * v.z, y1 = y0 + hOf(n) * v.z;
      if (x0 < 12) v.ox += 12 - x0; else if (x1 > CW - 12) v.ox -= x1 - (CW - 12);
      if (y0 < 12) v.oy += 12 - y0; else if (y1 > CH - 40) v.oy -= y1 - (CH - 40);
    }
  }
  apply();
  const at = (e) => { const r = view.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const toWorld = (p) => { const v = V(); return { x: (p.x - v.ox) / v.z, y: (p.y - v.oy) / v.z }; };
  const allPorts = () => gr.nodes.flatMap(n => portsOf(n, spec.nodes[n.t]));
  function portAt(p, only) {
    const v = V(); let best = null, bd = 22;
    for (const q of allPorts()) { if (only && !fits(only, q)) continue; const d = Math.hypot(q.x * v.z + v.ox - p.x, q.y * v.z + v.oy - p.y); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  function nodeAt(w) { for (let i = gr.nodes.length - 1; i >= 0; i--) { const n = gr.nodes[i]; if (w.x >= n.x && w.x <= n.x + NW && w.y >= n.y && w.y <= n.y + hOf(n)) return n; } return null; }
  // the wire under a finger, from the paths as drawn
  function wireAt(p) {
    const v = V(); let best = null, bd = 14;
    for (const el of svg.querySelectorAll('path[data-i]')) {
      const len = el.getTotalLength(), steps = Math.max(8, Math.ceil(len / 6));
      for (let k = 0; k <= steps; k++) { const q = el.getPointAtLength(len * k / steps), d = Math.hypot(q.x * v.z + v.ox - p.x, q.y * v.z + v.oy - p.y); if (d < bd) { bd = d; best = +el.dataset.i; } }
    }
    return best;
  }
  const redraw = (temp) => { svg.innerHTML = wiresSvg(gr, spec, S, temp); };
  const save = (fn) => c.changeLogic(l => { if (!l.length) l.push(blank(gr.id, gr.name)); const g = l.find(x => x.id === gr.id) || l[0]; fn(g); });
  function connect(a, b) {   // either way round
    const out = a.side === 'out' ? a : b, inn = a.side === 'out' ? b : a;
    save(g => join(g, out, inn));
    S.arm = null; S.wire = null; c.rerender();
  }
  const ptrs = new Map(); let act = null, gest = null;
  view.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault(); try { view.setPointerCapture(e.pointerId); } catch (err) { /* not a real pointer */ }
    ptrs.set(e.pointerId, at(e));
    if (ptrs.size === 2) {   // two fingers: drop what one finger started, move and zoom the view
      if (act && act.kind === 'node') { act.n.x = act.x0; act.n.y = act.y0; act.el.style.left = act.x0 + 'px'; act.el.style.top = act.y0 + 'px'; }
      act = null; redraw();
      const [p, q] = [...ptrs.values()];
      gest = { d: Math.hypot(p.x - q.x, p.y - q.y) || 1, m: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, v: { ...V() } };
      return;
    }
    if (ptrs.size > 2) return;
    const p = at(e), port = portAt(p), n = port ? null : nodeAt(toWorld(p));
    if (port) act = { kind: 'wire', from: port, p0: p, moved: false };
    else if (n) act = { kind: 'node', n, el: world.querySelector(`[data-n="${CSS.escape(n.id)}"]`), p0: p, x0: n.x, y0: n.y, moved: false };
    else act = { kind: 'pan', p0: p, v: { ...V() }, moved: false };
  });
  view.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, at(e));
    if (gest && ptrs.size >= 2) {
      const [p, q] = [...ptrs.values()], d = Math.hypot(p.x - q.x, p.y - q.y) || 1, m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, v = V();
      const z = Math.max(0.35, Math.min(2, gest.v.z * d / gest.d));
      v.ox = m.x - (gest.m.x - gest.v.ox) * z / gest.v.z; v.oy = m.y - (gest.m.y - gest.v.oy) * z / gest.v.z; v.z = z;
      apply(); return;
    }
    if (!act) return;
    const p = at(e), dx = p.x - act.p0.x, dy = p.y - act.p0.y, v = V();
    if (!act.moved && Math.hypot(dx, dy) < 7) return;
    act.moved = true;
    if (act.kind === 'pan') { v.ox = act.v.ox + dx; v.oy = act.v.oy + dy; apply(); }
    else if (act.kind === 'node') {
      act.n.x = snap(act.x0 + dx / v.z); act.n.y = snap(act.y0 + dy / v.z);
      if (act.el) { act.el.style.left = act.n.x + 'px'; act.el.style.top = act.n.y + 'px'; act.el.classList.add('drag'); }
      redraw();
    } else if (act.kind === 'wire') {
      const hit = portAt(p, act.from), w = toWorld(p), end = hit ? { x: hit.x, y: hit.y } : w;
      redraw({ type: act.from.type, a: { x: act.from.x, y: act.from.y }, b: end, rev: act.from.side === 'in' });
    }
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const p = at(e); ptrs.delete(e.pointerId);
    if (gest) { if (ptrs.size < 2) gest = null; act = null; return; }
    const a = act; act = null; if (!a || e.type === 'pointercancel') { if (a) c.rerender(); return; }
    if (a.kind === 'wire') {
      if (a.moved) {
        let hit = portAt(p, a.from);
        if (!hit) { const n = nodeAt(toWorld(p)); if (n && n.id !== a.from.n) { const fitting = portsOf(n, spec.nodes[n.t]).filter(q => fits(a.from, q)); if (fitting.length === 1 || (fitting.length && a.from.type === 'flow')) hit = fitting[0]; } }
        if (hit) return connect(a.from, hit);
        redraw(); return;
      }
      // a tap on a dot: join it to the dot picked before, or pick this one
      if (S.arm && fits(S.arm, a.from)) return connect(S.arm, a.from);
      S.arm = S.arm && S.arm.n === a.from.n && S.arm.port === a.from.port ? null : { n: a.from.n, port: a.from.port, side: a.from.side, type: a.from.type, x: a.from.x, y: a.from.y };
      S.sel = null; S.wire = null; S.adding = false; c.rerender(); return;
    }
    if (a.kind === 'node') {
      if (a.moved) { save(g => { const m = g.nodes.find(x => x.id === a.n.id); if (m) { m.x = a.n.x; m.y = a.n.y; } }); c.rerender(); return; }
      S.sel = a.n.id; S.wire = null; S.arm = null; S.adding = false; c.rerender(); return;
    }
    if (a.kind === 'pan' && !a.moved) {
      const w = wireAt(p);
      if (w === null && S.sel === null && S.wire === null && !S.arm && !S.adding) return;
      S.wire = w; S.sel = null; S.arm = null; S.adding = false; c.rerender();
    }
  };
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
}
