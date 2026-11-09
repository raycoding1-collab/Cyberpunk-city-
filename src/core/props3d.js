import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { T, mulberry32 } from './utils.js';
import { M } from './materials.js';
import { drawCanvas } from './textures.js';
import { Prefab, swayMaterial } from './prefabs.js';

/* =================================================================== */
/*  Modelled small objects. No cut-out cards, no single stamped clone: */
/*  four AC condenser models with their own wear, nine plant species   */
/*  built from real curved leaves in six kinds of container, and       */
/*  laundry that actually drapes — shirts on wire hangers, towels      */
/*  folded over the pole, pinch hangers of socks, futons on railings.  */
/* =================================================================== */

const hpos = (m, k = 0) => { const e = m.elements; const v = Math.sin(e[12] * 12.9898 + e[13] * 78.233 + e[14] * 37.719 + k * 4.1) * 43758.5453; return v - Math.floor(v); };
const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cache = new Map();
const mat = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
function tubeAlong(points, r, seg = 8, radial = 5) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, radial, false);
}

/* =============================== AC UNITS ============================== */
function grilleTex(kind) {
  return mat('grille' + kind, () => {
    const t = drawCanvas(256, 256, (x) => {
      x.clearRect(0, 0, 256, 256); x.strokeStyle = '#fff'; x.fillStyle = '#fff';
      if (kind === 0) {           // spiral round guard
        x.lineWidth = 3.5;
        x.beginPath(); for (let a = 0; a < Math.PI * 2 * 9; a += 0.05) { const r = 14 + a * 2.0; if (r > 124) break; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } x.stroke();
        x.lineWidth = 5; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126); x.stroke(); }
        x.beginPath(); x.arc(128, 128, 20, 0, 7); x.fill();
        x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.stroke();
      } else {                    // square mesh guard
        x.lineWidth = 3; for (let i = 6; i < 256; i += 15) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
      }
    }, { srgb: true });
    return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, color: kind ? 0xa4a8ac : 0x8a8e92, metalness: 0.55, roughness: 0.45, side: THREE.DoubleSide });
  });
}
const acBody = (i) => mat('acb' + i, () => {
  const c = [0xd8d2bf, 0xe9e9e5, 0xadb1b4, 0xc4b79c, 0x9da49a][i];
  const r = [0.5, 0.35, 0.42, 0.68, 0.6][i];
  return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: i === 2 ? 0.3 : 0.08 });
});
const acRust = () => mat('acrust', () => {
  const t = drawCanvas(256, 256, (x) => {
    x.fillStyle = '#b9ae95'; x.fillRect(0, 0, 256, 256);
    const r = mulberry32(5);
    for (let i = 0; i < 60; i++) { const px = r() * 256, len = 30 + r() * 160; const g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, 'rgba(110,52,18,0.7)'); g.addColorStop(1, 'rgba(110,52,18,0)'); x.fillStyle = g; x.save(); x.translate(px, r() * 60); x.fillRect(0, 0, 2 + r() * 6, len); x.restore(); }
    for (let i = 0; i < 25; i++) { x.fillStyle = `rgba(${90 + r() * 40},${40 + r() * 20},10,${0.4 + r() * 0.4})`; x.beginPath(); x.arc(r() * 256, r() * 256, 3 + r() * 12, 0, 7); x.fill(); }
  });
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0.25 });
});
const insul = () => mat('insul', () => new THREE.MeshStandardMaterial({ color: 0xe6e3da, roughness: 0.75 }));
const slimDuct = () => mat('duct', () => new THREE.MeshStandardMaterial({ color: 0xd8d0bb, roughness: 0.5 }));
const coverWood = () => mat('acwood', () => new THREE.MeshStandardMaterial({ map: M.wood.map, color: 0xc8a888, roughness: 0.7 }));

function fanAssembly(p, cx, cy, cz, r, guard) {
  p.add(new THREE.CircleGeometry(r, 20), M.metalBlack, T(cx, cy, cz + 0.004));
  const blade = new THREE.Shape(); blade.moveTo(0, 0); blade.quadraticCurveTo(r * 0.55, r * 0.25, r * 0.86, r * 0.1); blade.quadraticCurveTo(r * 0.5, -r * 0.18, 0, 0);
  const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.005, bevelEnabled: false });
  for (let i = 0; i < 3; i++) p.add(bg, M.plasticGrey, T(cx, cy, cz + 0.005, 0, 0, (i / 3) * Math.PI * 2 + 0.3).multiply(T(0, 0, 0, 0.25, 0, 0)));
  p.add(new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.05, 14), M.plasticGrey, T(cx, cy, cz + 0.01, Math.PI / 2, 0, 0));
  if (guard === 'cage') {
    for (const rr of [r * 0.35, r * 0.65, r * 0.98]) p.add(new THREE.TorusGeometry(rr, 0.004, 4, 32), M.galv, T(cx, cy, cz + 0.04));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.add(new THREE.CylinderGeometry(0.003, 0.003, r, 4), M.galv, T(cx + Math.cos(a) * r / 2, cy + Math.sin(a) * r / 2, cz + 0.04, 0, 0, a + Math.PI / 2)); }
  } else {
    p.add(new THREE.CircleGeometry(r * 1.02, 24), grilleTex(guard === 'mesh' ? 1 : 0), T(cx, cy, cz + 0.035));
  }
}
function brackets(p, W, H, D, wall = true) {
  if (wall) {
    for (const sx of [-W * 0.36, W * 0.36]) {
      p.add(new THREE.BoxGeometry(0.035, 0.035, D + 0.3), M.galv, T(sx, -0.02, -0.12));
      p.add(new THREE.BoxGeometry(0.035, 0.45, 0.035), M.galv, T(sx, -0.02 - 0.0, -D / 2 - 0.25));
      p.add(new THREE.BoxGeometry(0.025, 0.025, 0.55), M.galv, T(sx, -0.2, -D / 2 - 0.05, -0.75, 0, 0));
      p.add(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), M.steel, T(sx, -0.02, -D / 2 - 0.25 + 0.02, Math.PI / 2, 0, 0));
    }
  } else {
    for (const sx of [-W * 0.35, W * 0.35]) p.add(new THREE.BoxGeometry(0.07, 0.07, D * 0.9), M.rubber, T(sx, -0.035, 0));
  }
}
function pipes(p, W, H, D, style) {
  const ins = insul();
  if (style === 'duct') {
    // beige slim-duct covering the lines, elbow into the wall
    p.add(new THREE.BoxGeometry(0.075, 0.075, 0.2), slimDuct(), T(W / 2 - 0.05, H * 0.35, -D / 2 - 0.1));
    p.add(new THREE.BoxGeometry(0.075, H * 0.9 + 0.4, 0.075), slimDuct(), T(W / 2 - 0.05, H * 0.35 + (H * 0.9 + 0.4) / 2, -D / 2 - 0.2));
  } else {
    const a = [V(W / 2, H * 0.3, 0), V(W / 2 + 0.1, H * 0.32, -0.04), V(W / 2 + 0.13, H * 0.6, -D / 2), V(W / 2 + 0.13, H + 0.05, -D / 2 - 0.12), V(W / 2 + 0.13, H + 0.12, -D / 2 - 0.25)];
    p.add(tubeAlong(a, 0.024, 9, 5), ins);
    p.add(tubeAlong(a.map((v) => v.clone().add(V(-0.045, -0.01, 0))), 0.016, 9, 4), ins);
    // tape spiral bands
    for (let k = 1; k < 4; k++) { const q = new THREE.CatmullRomCurve3(a).getPoint(k / 4); p.add(new THREE.TorusGeometry(0.026, 0.004, 3, 8), M.plasticGrey, T(q.x, q.y, q.z, Math.PI / 2, 0, 0)); }
  }
  const drain = [V(-W * 0.3, 0.0, 0.03), V(-W * 0.32, -0.15, 0.06), V(-W * 0.25, -0.42, 0.0), V(-W * 0.28, -0.7, 0.02)];
  p.add(tubeAlong(drain, 0.011, 6, 4), M.plasticGrey);
}

let _acSet = null;
function buildAC(model, bodyI, wall) {
  const p = new Prefab('ac' + model);
  const body = model === 3 ? acRust() : acBody(bodyI);
  if (model === 0) {                    // classic single fan
    const W = 0.8, H = 0.58, D = 0.28;
    p.add(new RoundedBoxGeometry(W, H, D, 1, 0.025), body, T(0, H / 2, 0));
    fanAssembly(p, -0.13, H / 2, D / 2, 0.21, 'spiral');
    p.add(new THREE.BoxGeometry(0.23, 0.44, 0.012), body, T(0.26, H / 2, D / 2 + 0.004));
    for (let i = 0; i < 7; i++) p.add(new THREE.BoxGeometry(0.2, 0.01, 0.025), M.plasticGrey, T(0.26, 0.11 + i * 0.055, D / 2 + 0.012, -0.5, 0, 0));
    p.add(new THREE.BoxGeometry(0.1, 0.03, 0.004), M.chrome, T(0.26, H - 0.06, D / 2 + 0.012));
    for (let i = 0; i < 12; i++) p.add(new THREE.BoxGeometry(0.006, H * 0.72, 0.004), M.galv, T(-W / 2 - 0.003, H / 2, -D / 2 + 0.03 + i * 0.02));
    brackets(p, W, H, D, wall); pipes(p, W, H, D, bodyI % 2 ? 'duct' : 'tape');
  } else if (model === 1) {             // slim wide unit, square mesh guard
    const W = 0.92, H = 0.5, D = 0.26;
    p.add(new RoundedBoxGeometry(W, H, D, 1, 0.04), body, T(0, H / 2, 0));
    fanAssembly(p, -0.18, H / 2, D / 2, 0.19, 'mesh');
    for (let i = 0; i < 9; i++) p.add(new THREE.BoxGeometry(0.34, 0.012, 0.02), body, T(0.25, 0.06 + i * 0.042, D / 2 + 0.006, -0.35, 0, 0));
    p.add(new THREE.BoxGeometry(W, 0.02, D), M.plasticGrey, T(0, H - 0.01, 0));
    brackets(p, W, H, D, wall); pipes(p, W, H, D, 'duct');
  } else if (model === 2) {             // tall twin-fan multi unit
    const W = 0.94, H = 1.3, D = 0.34;
    p.add(new RoundedBoxGeometry(W, H, D, 1, 0.03), body, T(0, H / 2 + 0.06, 0));
    fanAssembly(p, 0, 0.06 + H * 0.28, D / 2, 0.3, 'spiral');
    fanAssembly(p, 0, 0.06 + H * 0.72, D / 2, 0.3, 'spiral');
    for (const sx of [-W / 2, W / 2]) for (let i = 0; i < 18; i++) p.add(new THREE.BoxGeometry(0.01, 0.012, D * 0.8), M.plasticGrey, T(sx, 0.15 + i * 0.065, 0));
    p.add(new THREE.BoxGeometry(W + 0.04, 0.06, D + 0.04), M.galv, T(0, 0.03, 0));
    brackets(p, W, H, D, false); pipes(p, W, H, D, 'tape');
  } else {                              // old boxy unit with an exposed cage fan
    const W = 0.74, H = 0.6, D = 0.3;
    p.add(new THREE.BoxGeometry(W, H, D), body, T(0, H / 2, 0));
    p.add(new THREE.BoxGeometry(W + 0.02, 0.03, D + 0.02), M.galv, T(0, H, 0));
    fanAssembly(p, -0.09, H / 2, D / 2, 0.24, 'cage');
    p.add(new THREE.BoxGeometry(0.18, 0.5, 0.01), M.galv, T(0.26, H / 2, D / 2 + 0.003));
    brackets(p, W, H, D, wall); pipes(p, W, H, D, 'tape');
  }
  return p;
}
function buildCover(inner) {
  // wooden louvred cover box over a floor-standing condenser
  const p = new Prefab('accover');
  for (const part of inner.parts) p.add(...part);
  const W = 1.0, H = 0.72, D = 0.42, w = coverWood();
  p.add(new THREE.BoxGeometry(W + 0.04, 0.03, D + 0.04), w, T(0, H, 0));
  for (const sx of [-W / 2, W / 2]) p.add(new THREE.BoxGeometry(0.03, H, D), w, T(sx, H / 2, 0));
  for (let y = 0.06; y < H - 0.05; y += 0.07) p.add(new THREE.BoxGeometry(W, 0.045, 0.012), w, T(0, y, D / 2 + 0.01, -0.5, 0, 0));
  return p;
}
function buildLodAC(bodyI) {
  // distant-tower version: same silhouette, a fraction of the triangles
  const p = new Prefab('aclod');
  const W = 0.8, H = 0.58, D = 0.28;
  p.add(new THREE.BoxGeometry(W, H, D), acBody(bodyI), T(0, H / 2, 0));
  p.add(new THREE.CircleGeometry(0.21, 12), grilleTex(0), T(-0.13, H / 2, D / 2 + 0.005));
  p.add(new THREE.CircleGeometry(0.2, 12), M.metalBlack, T(-0.13, H / 2, D / 2 + 0.002));
  for (const sx of [-0.28, 0.28]) p.add(new THREE.BoxGeometry(0.035, 0.035, D + 0.3), M.galv, T(sx, -0.02, -0.12));
  p.add(new THREE.BoxGeometry(0.05, 0.05, 0.4), insul(), T(W / 2 + 0.06, H * 0.5, -0.12));
  return p;
}
class ACSet {
  constructor() {
    this.lod = [0, 1, 2, 3, 4].map(buildLodAC);
    this.wall = [];
    this.floor = [];
    for (let m = 0; m < 4; m++) for (let b = 0; b < 5; b++) {
      if (m === 3 && b > 0) continue;
      this.wall.push(buildAC(m, b, true));
      this.floor.push(buildAC(m, b, false));
    }
    this.floor.push(buildCover(buildAC(0, 1, false)), buildCover(buildAC(1, 3, false)));
  }
  place(batch, matrix, { floor = false, lod = false } = {}) {
    const list = lod ? this.lod : floor ? this.floor : this.wall.filter((p) => p.name !== 'ac2');
    const pick = list[Math.floor(hpos(matrix) * list.length) % list.length];
    pick.place(batch, matrix);
    return this;
  }
}
export function acUnit() { return (_acSet ||= new ACSet()); }

/* ================================ PLANTS =============================== */
function leafGeo(len, wid, { segs = 5, bend = 0.25, cup = 0.3, prof = 'lance', twist = 0 } = {}) {
  const g = new THREE.PlaneGeometry(1, 1, 2, segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), t = p.getY(i) + 0.5;
    let w;
    if (prof === 'lance') w = Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.6))) * (1 - 0.1 * t);
    else if (prof === 'oval') w = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.7);
    else if (prof === 'strap') w = t < 0.85 ? 0.9 + 0.1 * Math.sin(t * 9) : (1 - t) / 0.15;
    else if (prof === 'heart') w = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.75))), 0.55);
    else w = Math.max(0, 1 - t);
    const xx = x * wid * Math.max(0.03, w);
    let yy = len * t * (1 - 0.25 * Math.abs(bend) * t * t);
    let zz = bend * len * t * t * 0.55 + cup * wid * (4 * x * x) * w * 0.3;
    const a = twist * t, ca = Math.cos(a), sa = Math.sin(a);
    p.setXYZ(i, xx * ca - zz * sa, yy, xx * sa + zz * ca);
  }
  g.computeVertexNormals();
  return g;
}
const leafMat = (k) => mat('leaf' + k, () => {
  if (k === 'snake') {
    const t = drawCanvas(64, 256, (x) => {
      x.fillStyle = '#d8c548'; x.fillRect(0, 0, 64, 256);
      x.fillStyle = '#21401f'; x.fillRect(7, 0, 50, 256);
      for (let y = 0; y < 256; y += 9) { x.fillStyle = `rgba(150,180,110,${0.25 + (y % 27) / 60})`; x.beginPath(); x.moveTo(7, y); x.quadraticCurveTo(32, y + 6, 57, y); x.lineTo(57, y + 3); x.quadraticCurveTo(32, y + 9, 7, y + 3); x.fill(); }
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.42, side: THREE.DoubleSide });
  }
  const c = { dark: 0x1d3c1b, mid: 0x2e5b23, light: 0x55862d, succ: 0x7d9c8c, dry: 0x6b5232, pine: 0x1d3520, onion: 0x4b8a35, red: 0x5a1f2a, pothos: 0x3f7a2a }[k];
  return new THREE.MeshStandardMaterial({ color: c, roughness: k === 'succ' ? 0.65 : k === 'dry' ? 0.85 : 0.45, side: THREE.DoubleSide });
});
const stemMat = () => mat('stem', () => new THREE.MeshStandardMaterial({ color: 0x3a4a22, roughness: 0.7 }));
const barkMat = () => mat('bark', () => new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.9 }));

function potGeo(kind, r, h) {
  const pts = [];
  if (kind === 'terracotta') { pts.push(V(0, 0, 0), V(r * 0.72, 0, 0), V(r * 0.92, h * 0.82, 0), V(r * 1.04, h * 0.84, 0), V(r * 1.04, h, 0), V(r * 0.94, h, 0), V(r * 0.9, h * 0.86, 0)); }
  else if (kind === 'nursery') { pts.push(V(0, 0, 0), V(r * 0.78, 0, 0), V(r * 0.97, h * 0.95, 0), V(r * 1.02, h, 0), V(r * 0.95, h, 0)); }
  else if (kind === 'glazed') { pts.push(V(0, 0, 0), V(r * 0.6, 0, 0), V(r * 0.68, h * 0.06, 0), V(r * 1.0, h * 0.45, 0), V(r * 0.95, h * 0.85, 0), V(r * 0.82, h, 0), V(r * 0.76, h * 0.96, 0)); }
  else { pts.push(V(0, 0, 0), V(r, 0, 0), V(r, h, 0), V(r * 0.96, h, 0)); }
  return new THREE.LatheGeometry(pts.map((v) => new THREE.Vector2(v.x, v.y)), 22);
}
const potMat = (kind, k) => mat('pot' + kind + k, () => {
  if (kind === 'terracotta') return new THREE.MeshStandardMaterial({ color: [0x8a4428, 0x9a5634, 0x7a3a22][k % 3], roughness: 0.85 });
  if (kind === 'nursery') return new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.35 });
  if (kind === 'glazed') return new THREE.MeshStandardMaterial({ color: [0x1d3f8a, 0x7fa89a, 0xe9e5da, 0x3a2418][k % 4], roughness: 0.12 });
  return new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.35, metalness: 0.8 });
});

function addPot(batch, m, r, kind, k, h) {
  if (kind === 'styro') {
    const w = r * 3.2, d = r * 1.9;
    batch.add(new RoundedBoxGeometry(w, h, d, 2, 0.015), mat('styro', () => new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.9 })), mul(m, T(0, h / 2, 0)));
    batch.add(new THREE.BoxGeometry(w - 0.04, 0.01, d - 0.04), M.soil, mul(m, T(0, h - 0.025, 0)));
    return { top: h - 0.02, w, d };
  }
  if (kind === 'tray') {
    batch.add(new RoundedBoxGeometry(r * 2.6, h * 0.35, r * 1.8, 2, 0.01), potMat('glazed', k), mul(m, T(0, h * 0.175, 0)));
    batch.add(new THREE.BoxGeometry(r * 2.4, 0.01, r * 1.6), M.soil, mul(m, T(0, h * 0.33, 0)));
    return { top: h * 0.33 };
  }
  batch.add(potGeo(kind, r, h), potMat(kind, k), m);
  batch.add(new THREE.CircleGeometry(r * 0.9, 18), M.soil, mul(m, T(0, h * 0.9, 0, -Math.PI / 2, 0, 0)));
  return { top: h * 0.9 };
}

const SPECIES = ['snake', 'ficus', 'pothos', 'palm', 'bonsai', 'cactus', 'echeveria', 'negi', 'herbs', 'dead'];
function grow(batch, m, rr, species, top, size) {
  const R = () => rr();
  const at = (x, y, z, rx, ry, rz) => mul(m, T(x, y, z, rx, ry, rz));
  if (species === 'snake') {
    const n = 6 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rad = R() * 0.05 * size;
      batch.add(leafGeo((0.35 + R() * 0.35) * size, 0.06 * size, { prof: 'strap', bend: 0.12 + R() * 0.15, cup: 0.5, twist: (R() - 0.5) * 1.2 }), leafMat('snake'), at(Math.cos(a) * rad, top, Math.sin(a) * rad, (R() - 0.5) * 0.25, a, 0));
    }
  } else if (species === 'ficus') {
    const hgt = (0.45 + R() * 0.4) * size;
    batch.add(tubeAlong([V(0, top, 0), V(0.02, top + hgt * 0.5, 0.01), V(-0.01, top + hgt, 0)], 0.012 * size, 6, 5), stemMat(), m);
    let ang = R() * 6;
    for (let y = top + hgt * 0.25; y < top + hgt; y += 0.055 * size) {
      ang += 2.4;
      const k = (y - top) / hgt;
      batch.add(leafGeo((0.13 + 0.08 * (1 - k)) * size, 0.08 * size, { prof: 'oval', bend: -0.35, cup: 0.25 }), leafMat(R() < 0.5 ? 'dark' : 'mid'), at(0, y, 0, 0, ang, 0).multiply(T(0, 0, 0, 0.7 + R() * 0.5, 0, 0)));
    }
  } else if (species === 'pothos') {
    const vines = 3 + Math.floor(R() * 3);
    for (let v = 0; v < vines; v++) {
      const a = R() * Math.PI * 2, out = 0.12 * size + R() * 0.05, drop = (0.3 + R() * 0.6) * size;
      const pts = [V(0, top + 0.02, 0), V(Math.cos(a) * out * 0.8, top + 0.08, Math.sin(a) * out * 0.8), V(Math.cos(a) * out * 1.2, top - 0.05, Math.sin(a) * out * 1.2), V(Math.cos(a) * out * 1.25, top - drop, Math.sin(a) * out * 1.25)];
      const curve = new THREE.CatmullRomCurve3(pts);
      batch.add(new THREE.TubeGeometry(curve, 16, 0.004, 4), stemMat(), m);
      for (let k = 0.08; k < 1; k += 0.09) {
        const q = curve.getPoint(k), tg = curve.getTangent(k);
        const side = (Math.floor(k * 11) % 2 ? 1 : -1);
        batch.add(leafGeo(0.075 * size, 0.06 * size, { prof: 'heart', bend: -0.3, cup: 0.3 }), leafMat('pothos'), at(q.x, q.y, q.z, 0, Math.atan2(tg.x, tg.z) + side * 1.3, 0).multiply(T(0, 0, 0, 1.1, 0, 0)));
      }
    }
    for (let i = 0; i < 6; i++) batch.add(leafGeo(0.08 * size, 0.065 * size, { prof: 'heart', bend: -0.2, cup: 0.3 }), leafMat('pothos'), at(0, top, 0, 0, i * 1.05, 0).multiply(T(0, 0, 0, 0.6, 0, 0)));
  } else if (species === 'palm') {
    const fronds = 4 + Math.floor(R() * 3);
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * Math.PI * 2 + R() * 0.5, L = (0.5 + R() * 0.3) * size;
      const pts = [V(0, top, 0), V(Math.cos(a) * L * 0.15, top + L * 0.6, Math.sin(a) * L * 0.15), V(Math.cos(a) * L * 0.55, top + L * 0.85, Math.sin(a) * L * 0.55), V(Math.cos(a) * L, top + L * 0.45, Math.sin(a) * L)];
      const c = new THREE.CatmullRomCurve3(pts);
      batch.add(new THREE.TubeGeometry(c, 12, 0.005, 4), stemMat(), m);
      for (let k = 0.25; k < 0.98; k += 0.06) {
        const q = c.getPoint(k), tg = c.getTangent(k);
        const yaw = Math.atan2(tg.x, tg.z);
        for (const s of [-1, 1]) batch.add(leafGeo((0.13 * (1 - k * 0.5)) * size, 0.022 * size, { prof: 'lance', bend: -0.5, cup: 0.6 }), leafMat('mid'), at(q.x, q.y, q.z, 0, yaw + s * 1.25, 0).multiply(T(0, 0, 0, 1.25, 0, 0)));
      }
    }
  } else if (species === 'bonsai') {
    const trunk = [V(0, top, 0), V(0.04 * size, top + 0.08 * size, 0), V(-0.03 * size, top + 0.17 * size, 0.02), V(0.05 * size, top + 0.26 * size, -0.01)];
    batch.add(tubeAlong(trunk, 0.018 * size, 10, 6), barkMat(), m);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.IcosahedronGeometry(0.07 * size, 1);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const s2 = 1 + Math.sin(p.getX(k) * 60 + i) * 0.15; p.setXYZ(k, p.getX(k) * s2 * 1.4, p.getY(k) * 0.45, p.getZ(k) * s2 * 1.2); }
      g.computeVertexNormals();
      const q = trunk[1 + (i % 3)];
      batch.add(g, leafMat('pine'), at(q.x + (i - 1.5) * 0.06 * size, q.y + 0.03 * size + i * 0.015, q.z + (R() - 0.5) * 0.05, 0, R() * 3, 0));
    }
  } else if (species === 'cactus') {
    const n = 1 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const hh = (0.12 + R() * 0.2) * size, rad = (0.035 + R() * 0.02) * size;
      const prof = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; prof.push(new THREE.Vector2(rad * Math.sqrt(Math.max(0.0001, 1 - Math.pow(Math.max(0, t - 0.75) / 0.25, 2))), t * hh)); }
      const g = new THREE.LatheGeometry(prof, 24);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)); const s2 = 1 + 0.12 * Math.cos(a * 8); p.setX(k, p.getX(k) * s2); p.setZ(k, p.getZ(k) * s2); }
      g.computeVertexNormals();
      batch.add(g, leafMat('light'), at((i - (n - 1) / 2) * rad * 1.9, top, (R() - 0.5) * 0.02, 0, R() * 3, 0));
    }
  } else if (species === 'echeveria') {
    const n = 20 + Math.floor(R() * 12);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      batch.add(leafGeo((0.03 + 0.04 * k) * size, 0.03 * size, { prof: 'oval', bend: -0.2 - k * 0.4, cup: 0.8, segs: 3 }), leafMat('succ'), at(0, top + 0.01, 0, 0, i * 2.39996, 0).multiply(T(0, 0, 0, 0.25 + k * 1.0, 0, 0)));
    }
  } else if (species === 'negi') {
    const n = 34 + Math.floor(R() * 20);
    for (let i = 0; i < n; i++) {
      const x = (R() - 0.5) * 0.28 * size, z = (R() - 0.5) * 0.14 * size, hh = (0.18 + R() * 0.17) * size;
      batch.add(new THREE.CylinderGeometry(0.0035, 0.005, hh, 5, 1, true), leafMat('onion'), at(x, top + hh / 2, z, (R() - 0.5) * 0.25, 0, (R() - 0.5) * 0.25));
    }
  } else if (species === 'herbs') {
    for (let i = 0; i < 46; i++) {
      const a = R() * Math.PI * 2, rr2 = Math.sqrt(R()) * 0.11 * size, y = top + (0.03 + R() * 0.14) * size * (1 - rr2 * 3);
      batch.add(leafGeo(0.045 * size, 0.032 * size, { prof: 'oval', bend: -0.3, cup: 0.5, segs: 3 }), leafMat(R() < 0.25 ? 'red' : 'light'), at(Math.cos(a) * rr2, y, Math.sin(a) * rr2, 0, R() * 6.28, 0).multiply(T(0, 0, 0, 0.6 + R() * 0.6, 0, 0)));
    }
  } else {                                   // dead / neglected
    for (let i = 0; i < 5; i++) {
      const a = R() * 6.28, hh = (0.15 + R() * 0.25) * size;
      batch.add(tubeAlong([V(0, top, 0), V(Math.cos(a) * 0.04, top + hh * 0.6, Math.sin(a) * 0.04), V(Math.cos(a) * 0.09, top + hh, Math.sin(a) * 0.09)], 0.004, 6, 4), leafMat('dry'), m);
      batch.add(leafGeo(0.05 * size, 0.025 * size, { prof: 'lance', bend: -0.8, cup: 0.9, twist: 1.2 }), leafMat('dry'), at(Math.cos(a) * 0.09, top + hh, Math.sin(a) * 0.09, 0, a, 0).multiply(T(0, 0, 0, 1.6, 0, 0)));
    }
  }
}

/** A potted plant; species & container chosen deterministically from position. */
export function plant(batch, matrix, rng, { size = 1, species, pot } = {}) {
  const h = hpos(matrix, 3);
  const rr = mulberry32(Math.floor(h * 1e6) + 11);
  const sp = species || SPECIES[Math.floor(hpos(matrix, 7) * SPECIES.length) % SPECIES.length];
  let kind = { negi: 'styro', herbs: rr() < 0.6 ? 'styro' : 'terracotta', bonsai: 'tray', cactus: rr() < 0.5 ? 'tin' : 'glazed', echeveria: 'glazed' }[sp];
  if (!kind) kind = ['terracotta', 'nursery', 'glazed', 'terracotta', 'nursery'][Math.floor(rr() * 5)];
  const r = (sp === 'palm' || sp === 'ficus' ? 0.15 : sp === 'cactus' || sp === 'echeveria' ? 0.07 : 0.11) * size;
  const ph = (sp === 'bonsai' ? 0.18 : kind === 'styro' ? 0.18 : r * 1.9 + 0.04);
  const { top } = addPot(batch, matrix, r, kind, Math.floor(rr() * 12), ph);
  grow(batch, matrix, rr, sp, top, size);
}
export const potted = (batch, matrix, species, size = 1) => plant(batch, matrix, null, { species, size });

/* ================================ LAUNDRY ============================== */
const FABRIC = [0xd8d4c8, 0x2b4b7e, 0xb23a48, 0xe6c84f, 0x3e7d5a, 0xf2f2ee, 0x6b3fa0, 0x1a1a1c, 0xf08a5d, 0x5ad1e8, 0x8a8f96, 0xe8b4c0];
const fabricMat = (i) => mat('fab' + i, () => {
  let map = null;
  if (i >= FABRIC.length) {
    const k = i - FABRIC.length;
    map = drawCanvas(128, 128, (x) => {
      if (k === 0) { for (let y = 0; y < 128; y += 16) { x.fillStyle = y % 32 ? '#f2f2ee' : '#2b5fa8'; x.fillRect(0, y, 128, 16); } }        // striped towel
      else if (k === 1) { x.fillStyle = '#7a1e22'; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(20,20,20,0.5)'; for (let i2 = 0; i2 < 128; i2 += 32) { x.fillRect(i2, 0, 10, 128); x.fillRect(0, i2, 128, 10); } } // plaid
      else if (k === 2) { x.fillStyle = '#2c3e5c'; x.fillRect(0, 0, 128, 128); for (let i2 = 0; i2 < 400; i2++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 1); } } // denim
      else { x.fillStyle = '#f2e6d8'; x.fillRect(0, 0, 128, 128); for (let i2 = 0; i2 < 20; i2++) { x.fillStyle = ['#d84a6a', '#5aa86a', '#e8b030'][i2 % 3]; x.beginPath(); x.arc((i2 * 37) % 128, (i2 * 53) % 128, 6, 0, 7); x.fill(); } } // floral
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
  }
  return swayMaterial({ color: map ? 0xffffff : FABRIC[i], map, roughness: 0.92 }, 0.05, 1.2);
});
const NFAB = FABRIC.length + 4;

// hanging garment shell: elliptical tube closed at the shoulders by the hanger, open hem, drape folds
function garmentShell(w, len, depth, rr, { flare = 0.06, slope = 0.07, folds = 5 } = {}) {
  const g = new THREE.CylinderGeometry(1, 1, len, 18, 8, true);
  const p = g.attributes.position;
  const ph = rr() * 6;
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i), z0 = p.getZ(i), y0 = p.getY(i);
    const t = 0.5 - y0 / len;                         // 0 at the shoulders → 1 at the hem
    const a = Math.atan2(z0, x0);
    const hw = (w / 2) * (1 + flare * t);
    const dep = depth * Math.min(1, 0.15 + t * 2.2);   // flattened by the hanger at the top
    const fold = 1 + 0.06 * Math.sin(a * folds + ph + t * 2) * t;
    const x = x0 * hw * fold, z = z0 * dep * fold + 0.01 * Math.sin(x0 * 6 + t * 7) * t;
    const y = y0 - slope * Math.abs(x0) * (1 - t) - len / 2 - 0.02 * Math.cos(a * 2) * t;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
function shirtOnHanger(batch, m, rr) {
  batch.add(new THREE.TorusGeometry(0.03, 0.003, 4, 12, Math.PI * 1.4), M.galv, mul(m, T(0, 0.03, 0, 0, 0, -0.2)));
  batch.add(tubeAlong([V(-0.2, -0.1, 0), V(0, -0.02, 0), V(0.2, -0.1, 0)], 0.003, 6, 4), M.galv, m);
  const fm = fabricMat(Math.floor(rr() * NFAB));
  const L = 0.56 + rr() * 0.14, W = 0.4 + rr() * 0.06;
  batch.add(garmentShell(W, L, 0.045, rr), fm, mul(m, T(0, -0.04, 0)));
  // sleeves: short open tubes hanging off the shoulder line
  for (const s of [-1, 1]) {
    const sl = new THREE.CylinderGeometry(0.055, 0.065, 0.22, 10, 1, true);
    batch.add(sl, fm, mul(m, T(s * (W / 2 + 0.02), -0.2, 0, 0, 0, s * 0.42)));
  }
  // collar
  batch.add(new THREE.TorusGeometry(0.06, 0.012, 5, 14, Math.PI), fm, mul(m, T(0, -0.06, 0.0, Math.PI / 2 - 0.25, 0, 0)));
}
function towel(batch, m, rr, len = 0.85) {
  const fm = fabricMat(Math.floor(rr() * NFAB));
  const g = new THREE.PlaneGeometry(0.34, len, 3, 14);
  const p = g.attributes.position, uv = g.attributes.uv;
  const front = 0.42 + rr() * 0.15, rad = 0.018;
  for (let i = 0; i < p.count; i++) {
    const s = (p.getY(i) / len + 0.5) * len;      // 0..len along the cloth
    const x = p.getX(i);
    let y, z;
    if (s < len * front) { y = -(len * front - s); z = rad + 0.004; }
    else if (s < len * front + Math.PI * rad) { const a = (s - len * front) / rad; y = Math.sin(a) * rad; z = Math.cos(a) * rad; }
    else { y = -(s - len * front - Math.PI * rad); z = -rad - 0.004; }
    p.setXYZ(i, x, y, z + 0.01 * Math.sin(x * 20 + s * 8));
    uv.setY(i, 1 + y / len);
  }
  g.computeVertexNormals();
  batch.add(g, fm, m);
}
function pinchHanger(batch, m, rr) {
  const rw = 0.42, rd = 0.28;
  batch.add(new THREE.TorusGeometry(0.03, 0.004, 4, 12, Math.PI * 1.4), M.plasticGrey, mul(m, T(0, 0.02, 0, 0, Math.PI / 2, -0.2)));
  batch.add(tubeAlong([V(0, 0, 0), V(0, -0.12, 0)], 0.003, 2, 4), M.plasticGrey, m);
  for (const [a, b] of [[[-rw / 2, -rd / 2], [rw / 2, -rd / 2]], [[rw / 2, -rd / 2], [rw / 2, rd / 2]], [[rw / 2, rd / 2], [-rw / 2, rd / 2]], [[-rw / 2, rd / 2], [-rw / 2, -rd / 2]]]) {
    batch.add(tubeAlong([V(a[0], -0.13, a[1]), V(b[0], -0.13, b[1])], 0.006, 2, 5), M.plasticWhite, m);
  }
  for (let i = 0; i < 12; i++) {
    const t = i / 12, per = 2 * (rw + rd), d = t * per;
    let x, z;
    if (d < rw) { x = -rw / 2 + d; z = -rd / 2; } else if (d < rw + rd) { x = rw / 2; z = -rd / 2 + d - rw; } else if (d < 2 * rw + rd) { x = rw / 2 - (d - rw - rd); z = rd / 2; } else { x = -rw / 2; z = rd / 2 - (d - 2 * rw - rd); }
    batch.add(new THREE.BoxGeometry(0.012, 0.04, 0.008), [M.plasticWhite, M.plasticYellow, M.plasticRed][i % 3], mul(m, T(x, -0.155, z)));
    if (rr() < 0.6) {
      const kind = rr(), fm2 = fabricMat(Math.floor(rr() * NFAB));
      if (kind < 0.55) {      // sock: leg tube + foot tube
        batch.add(new THREE.CapsuleGeometry(0.025, 0.14, 3, 8), fm2, mul(m, T(x, -0.26, z)));
        batch.add(new THREE.CapsuleGeometry(0.024, 0.07, 3, 8), fm2, mul(m, T(x + 0.03, -0.35, z, 0, 0, Math.PI / 2 - 0.3)));
      } else {                // small towel / underwear: thin rounded slab with a fold
        batch.add(new THREE.CapsuleGeometry(0.06, 0.08, 3, 10), fm2, mul(m, T(x, -0.25, z, 0, Math.atan2(x, z), 0, 1, 1, 0.22)));
      }
    }
  }
}
function trousers(batch, m, rr) {
  const fm = fabricMat(rr() < 0.5 ? FABRIC.length + 2 : Math.floor(rr() * FABRIC.length));
  // folded over a hanger bar: two legs as tubes, the fold at the bar
  batch.add(tubeAlong([V(-0.2, -0.06, 0), V(0.2, -0.06, 0)], 0.004, 2, 4), M.galv, m);
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(0.07, 0.062, 0.7, 12, 6, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = 0.5 - y / 0.7;
      p.setZ(i, p.getZ(i) * 0.55 + 0.012 * Math.sin(t * 9 + s));
      p.setX(i, p.getX(i) * (1 + 0.05 * Math.sin(t * 7 + s * 2)));
    }
    g.computeVertexNormals();
    batch.add(g, fm, mul(m, T(s * 0.08, -0.06 - 0.35, s * 0.012, 0, 0, s * 0.03)));
  }
  batch.add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16, 1, true), fm, mul(m, T(0, -0.07, 0, 0, 0, 0, 1, 1, 0.35)));
}

/** Rod between a and b, hung with a believable mix of garments. */
export function laundryLine(batch, a, b, rng, drop = 0.55) {
  const len = a.distanceTo(b);
  batch.rod(M.galv, 0.014, a, b, 8);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const yaw = Math.atan2(-dir.z, dir.x);
  const rr = mulberry32(Math.floor(Math.abs(a.x * 131 + a.y * 17 + a.z * 7 + b.x * 3) * 100) + 1);
  let s = 0.15 + rr() * 0.2;
  while (s < len - 0.2) {
    const p = a.clone().addScaledVector(dir, s);
    const m = T(p.x, p.y, p.z, 0, yaw, 0);
    const k = rr();
    if (k < 0.3) { shirtOnHanger(batch, m, rr); s += 0.3 + rr() * 0.15; }
    else if (k < 0.55) { towel(batch, m, rr, Math.min(1.0, drop * 1.6)); s += 0.38 + rr() * 0.1; }
    else if (k < 0.72) { pinchHanger(batch, m, rr); s += 0.5; }
    else if (k < 0.85) { trousers(batch, m, rr); s += 0.4; }
    else s += 0.25 + rr() * 0.3;
  }
}

/** A futon airing over a balcony railing (soft slab bent over the rail). */
export function futon(batch, matrix, rng, { width = 1.0 } = {}) {
  const rr = mulberry32(Math.floor(hpos(matrix, 9) * 1e6));
  const len = 1.5, th = 0.07;
  const g = new THREE.BoxGeometry(width, len, th, 4, 18, 1);
  const p = g.attributes.position;
  const front = 0.42 + rr() * 0.1, rad = 0.06;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), sy = p.getY(i) + len / 2, z0 = p.getZ(i);
    let y, z;
    if (sy < len * front) { y = -(len * front - sy); z = rad + z0 + th / 2; }
    else if (sy < len * front + Math.PI * rad) { const a = (sy - len * front) / rad; y = Math.sin(a) * (rad + z0 + th / 2); z = Math.cos(a) * (rad + z0 + th / 2); }
    else { y = -(sy - len * front - Math.PI * rad); z = -(rad + z0 + th / 2); }
    const puff = 0.02 * Math.sin((x / width + 0.5) * Math.PI) ;
    p.setXYZ(i, x, y, z + Math.sign(z) * puff);
  }
  g.computeVertexNormals();
  const cover = mat('futon' + Math.floor(rr() * 4), () => {
    const k = Math.floor(rr() * 4);
    const t = drawCanvas(128, 256, (x) => {
      x.fillStyle = ['#e9e4d6', '#2a3f6a', '#c8d8e6', '#e6c6b8'][k]; x.fillRect(0, 0, 128, 256);
      x.fillStyle = ['rgba(180,60,60,0.35)', 'rgba(255,255,255,0.25)', 'rgba(40,80,140,0.3)', 'rgba(120,60,40,0.25)'][k];
      if (k % 2) for (let y = 0; y < 256; y += 24) x.fillRect(0, y, 128, 8); else for (let i = 0; i < 30; i++) { x.beginPath(); x.arc((i * 41) % 128, (i * 67) % 256, 7, 0, 7); x.fill(); }
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  });
  batch.add(g, cover, matrix);
  // two futon clips
  for (const s of [-0.3, 0.3]) batch.add(new THREE.BoxGeometry(0.05, 0.12, 0.2), M.plasticYellow, mul(matrix, T(s * width, 0.02, 0)));
}
