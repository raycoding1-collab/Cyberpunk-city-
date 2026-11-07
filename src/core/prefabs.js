import * as THREE from 'three';
import { T, U, RNG, roundRectShape, Batch } from './utils.js';
import { M, glow } from './materials.js';
import { drawCanvas } from './textures.js';
export { acUnit, plant, laundryLine, futon, potted } from './props3d.js';

/* =================================================================== */
/*  Designed props. Each is modelled once as a multi-material Prefab   */
/*  and stamped into Batches, so hundreds of them cost few draw calls. */
/* =================================================================== */

export class Prefab {
  constructor(name) { this.name = name; this.parts = []; }
  add(geo, mat, m = new THREE.Matrix4()) { this.parts.push([geo, mat, m]); return this; }
  place(batch, matrix) {
    for (const [g, mt, m] of this.parts) batch.add(g, mt, new THREE.Matrix4().multiplyMatrices(matrix, m));
    return this;
  }
}

/** vertex sway for cloth (noren, laundry, banners): pinned at the top edge */
export function swayMaterial(params, amp = 0.08, freq = 1.6) {
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...params });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp0 = modelMatrix * vec4(position, 1.0);
          float k = 1.0 - uv.y;
          float ph = wp0.x * 0.9 + wp0.z * 0.7;
          transformed.z += (sin(uTime * ${freq.toFixed(2)} + ph) * 0.6 + sin(uTime * ${(freq * 2.3).toFixed(2)} + ph * 2.1) * 0.25) * ${amp.toFixed(3)} * k * k;
          transformed.x += sin(uTime * ${(freq * 0.7).toFixed(2)} + ph * 1.3) * ${(amp * 0.3).toFixed(3)} * k * k;
        }`);
  };
  m.customProgramCacheKey = () => `sway_${amp}_${freq}`;
  m.userData.noShadow = false;
  return m;
}

/* ------------------------------- Textures ------------------------------ */
let _leafMats, _laundryMat, _fanTex;
export function leafMaterials() {
  if (_leafMats) return _leafMats;
  const mk = (seed, kind) => drawCanvas(256, 256, (x) => {
    const r = new RNG(seed);
    x.clearRect(0, 0, 256, 256);
    for (let i = 0; i < (kind === 0 ? 22 : 40); i++) {
      const cx = 128 + r.range(-80, 80), cy = 150 + r.range(-90, 80);
      const a = r.range(-1.2, 1.2) - Math.PI / 2;
      const L = kind === 0 ? r.range(40, 70) : r.range(30, 60), W = kind === 0 ? L * 0.45 : L * 0.16;
      x.save(); x.translate(cx, cy); x.rotate(a);
      const g = x.createLinearGradient(0, -W, 0, W);
      const base = kind === 0 ? [40 + r.range(0, 30), 95 + r.range(0, 50), 35] : [60 + r.range(0, 40), 120 + r.range(0, 40), 40];
      g.addColorStop(0, `rgb(${base[0] * 0.6},${base[1] * 0.6},${base[2] * 0.6})`);
      g.addColorStop(0.5, `rgb(${base[0]},${base[1]},${base[2]})`);
      g.addColorStop(1, `rgb(${base[0] * 0.5},${base[1] * 0.55},${base[2] * 0.5})`);
      x.fillStyle = g;
      x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(L * 0.5, -W, L, 0); x.quadraticCurveTo(L * 0.5, W, 0, 0); x.fill();
      x.strokeStyle = 'rgba(200,230,170,0.35)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, 0); x.lineTo(L * 0.95, 0); x.stroke();
      x.restore();
      // stem
      x.strokeStyle = 'rgba(40,70,30,0.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(128, 250); x.quadraticCurveTo(128 + (cx - 128) * 0.3, 210, cx, cy); x.stroke();
    }
  });
  _leafMats = [0, 1].map((k) => new THREE.MeshStandardMaterial({ map: mk(31 + k, k), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, metalness: 0 }));
  return _leafMats;
}

export function laundryMaterial() {
  if (_laundryMat) return _laundryMat;
  const t = drawCanvas(1024, 256, (x) => {
    x.clearRect(0, 0, 1024, 256);
    const r = new RNG(77);
    const cols = ['#d8d4c8', '#2b4b7e', '#b23a48', '#e6c84f', '#3e7d5a', '#efefef', '#6b3fa0', '#1a1a1a', '#f08a5d', '#5ad1e8'];
    let px = 8;
    while (px < 1000) {
      const kind = r.int(0, 3), c = r.pick(cols);
      x.fillStyle = c;
      if (kind === 0) { // T-shirt
        const w = 110; x.beginPath(); x.moveTo(px, 10); x.lineTo(px + w, 10); x.lineTo(px + w + 20, 50); x.lineTo(px + w - 5, 60);
        x.lineTo(px + w - 10, 200); x.lineTo(px + 10, 200); x.lineTo(px + 5, 60); x.lineTo(px - 20, 50); x.closePath(); x.fill(); px += w + 40;
      } else if (kind === 1) { // towel
        const w = 80, h = r.range(150, 230); x.fillRect(px, 10, w, h);
        x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(px, h - 20, w, 6); x.fillRect(px, 30, w, 4); px += w + 20;
      } else if (kind === 2) { // trousers
        const w = 90; x.beginPath(); x.moveTo(px, 10); x.lineTo(px + w, 10); x.lineTo(px + w, 240); x.lineTo(px + w * 0.58, 240);
        x.lineTo(px + w * 0.5, 70); x.lineTo(px + w * 0.42, 240); x.lineTo(px, 240); x.closePath(); x.fill(); px += w + 26;
      } else { // socks pair
        for (let k = 0; k < 2; k++) { x.fillRect(px + k * 34, 10, 22, 80); x.fillRect(px + k * 34, 70, 36, 22); }
        px += 90;
      }
      // clothes peg
      x.fillStyle = '#ddd'; x.fillRect(px - 30, 2, 6, 16);
    }
    // fabric shading stripes
    x.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 1024; i += 6) { x.fillStyle = `rgba(0,0,0,${0.05 + 0.08 * Math.sin(i * 0.3) ** 2})`; x.fillRect(i, 0, 3, 256); }
  });
  _laundryMat = swayMaterial({ map: t, alphaTest: 0.5, roughness: 0.9 }, 0.06, 1.3);
  return _laundryMat;
}

function fanGrilleTexture() {
  if (_fanTex) return _fanTex;
  _fanTex = drawCanvas(256, 256, (x) => {
    x.clearRect(0, 0, 256, 256);
    x.strokeStyle = '#fff'; x.lineWidth = 4;
    for (let r = 20; r < 126; r += 13) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); }
    x.lineWidth = 5;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126); x.stroke(); }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(128, 128, 18, 0, 7); x.fill();
  }, { srgb: true });
  return _fanTex;
}

/* AC condensers, plants and laundry live in props3d.js (re-exported below) */

/* ----------------------------- Satellite dish -------------------------- */
let _dish;
export function dish() {
  if (_dish) return _dish;
  const p = new Prefab('dish');
  const pts = [];
  for (let i = 0; i <= 10; i++) { const r = (i / 10) * 0.38; pts.push(new THREE.Vector2(r, r * r * 1.1)); }
  const g = new THREE.LatheGeometry(pts, 28);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9c9c4, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
  p.add(g, mat, T(0, 0, 0, -Math.PI / 2 + 0.6, 0, 0));
  p.add(new THREE.CylinderGeometry(0.01, 0.01, 0.42), M.galv, T(0, 0.12, 0.16, 0.95, 0, 0));
  p.add(new THREE.BoxGeometry(0.05, 0.05, 0.08), M.plasticGrey, T(0, 0.27, 0.33, 0.6, 0, 0));
  p.add(new THREE.CylinderGeometry(0.02, 0.02, 0.4), M.galv, T(0, -0.05, -0.18, 0.4, 0, 0));
  return (_dish = p);
}

/* ------------------------------- Lantern ------------------------------- */
const lanternMats = new Map();
export function lanternMaterial(text = 'ラーメン', color = '#c8141e', glowI = 2.4) {
  const key = text + color + glowI;
  if (lanternMats.has(key)) return lanternMats.get(key);
  const light = color === '#e8e2d0' || color === '#f2ead8';
  const paint = (x, glowPass) => {
    // washi paper: fibres, a warmer belly, darker toward the caps, bamboo rib shadows
    const g = x.createLinearGradient(0, 0, 512, 0);
    const base = color;
    g.addColorStop(0, '#2a0204'); g.addColorStop(0.18, base); g.addColorStop(0.5, light ? '#fffaf0' : '#ff5a40'); g.addColorStop(0.82, base); g.addColorStop(1, '#2a0204');
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    const v = x.createLinearGradient(0, 0, 0, 512); v.addColorStop(0, 'rgba(0,0,0,0.55)'); v.addColorStop(0.18, 'rgba(0,0,0,0)'); v.addColorStop(0.82, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    x.fillStyle = v; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${light ? '120,100,70' : '60,0,0'},${Math.random() * 0.08})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 7, 1); }
    for (let y = 0; y < 512; y += 23) { x.fillStyle = 'rgba(30,0,0,0.42)'; x.fillRect(0, y, 512, 3); }
    x.fillStyle = glowPass ? 'rgba(0,0,0,0.92)' : '#120000';
    x.font = `bold 96px "IPAMincho", "Noto Serif CJK JP", "Yu Mincho", serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const chars = [...text];
    const step = Math.min(118, 360 / Math.max(1, chars.length));
    chars.forEach((c, i) => x.fillText(c, 256, 256 - ((chars.length - 1) * step) / 2 + i * step));
  };
  const t = drawCanvas(512, 512, (x) => paint(x, false));
  const te = drawCanvas(512, 512, (x) => paint(x, true));
  const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: te, emissive: 0xffffff, emissiveIntensity: glowI, roughness: 0.75, side: THREE.DoubleSide });
  m.userData.noShadow = true;
  lanternMats.set(key, m);
  return m;
}

export function lantern(group, x, y, z, { r = 0.3, h = 0.85, text = 'ラーメン', color = '#c8141e', glowI = 2.4, swing = 0.04 } = {}) {
  const ribs = Math.max(10, Math.round(h * 30));
  const pts = [];
  const N = ribs * 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const env = r * (0.7 + 0.3 * Math.sin(Math.PI * t));
    const sagK = 1 - 0.022 * (1 - Math.pow(Math.abs(Math.cos(Math.PI * t * ribs)), 4));
    pts.push(new THREE.Vector2(env * sagK, (t - 0.5) * h));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), lanternMaterial(text, color, glowI));
  const pivot = new THREE.Group();
  pivot.position.set(x, y + h / 2 + 0.16, z);
  body.position.y = -h / 2 - 0.16;
  body.rotation.y = Math.PI / 2;
  pivot.add(body);
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x0c0a09, roughness: 0.25, clearcoat: 0.8 });
  const capR = r * 0.72;
  for (const s of [-1, 1]) {
    const cp = [new THREE.Vector2(capR * 0.55, 0), new THREE.Vector2(capR * 1.02, 0), new THREE.Vector2(capR * 1.04, 0.012), new THREE.Vector2(capR * 0.98, 0.05), new THREE.Vector2(capR * 0.6, 0.065), new THREE.Vector2(capR * 0.5, 0.075)];
    const cap = new THREE.Mesh(new THREE.LatheGeometry(cp, 28), lacquer);
    cap.position.y = body.position.y + s * (h / 2 - 0.01);
    if (s < 0) cap.rotation.x = Math.PI;
    pivot.add(cap);
  }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 14), M.brass); hook.position.y = -0.07; pivot.add(hook);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5), M.plasticBlack); cord.position.y = -0.0; pivot.add(cord);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), lacquer); knot.position.y = body.position.y - h / 2 - 0.09; pivot.add(knot);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x150b08, roughness: 0.95, side: THREE.DoubleSide }));
  tassel.position.y = knot.position.y - 0.08; pivot.add(tassel);
  group.add(pivot);
  const seed = x * 3.1 + z;
  return (t) => { pivot.rotation.z = Math.sin(t * 1.3 + seed) * swing; pivot.rotation.x = Math.sin(t * 0.9 + seed * 2) * swing * 0.6; };
}

/* ------------------------------ Water tank ----------------------------- */
let _tank;
export function waterTank() {
  if (_tank) return _tank;
  const p = new Prefab('tank');
  const shell = new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.45, metalness: 0.7 });
  p.add(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 28), shell, T(0, 3.4, 0));
  p.add(new THREE.ConeGeometry(1.26, 0.45, 28), shell, T(0, 4.82, 0));
  for (const y of [2.5, 3.4, 4.3]) p.add(new THREE.TorusGeometry(1.215, 0.035, 6, 32), M.metalDark, T(0, y, 0, Math.PI / 2, 0, 0));
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) p.add(new THREE.BoxGeometry(0.12, 2.2, 0.12), M.rustBeam || M.metalDark, T(x, 1.1, z));
  p.add(new THREE.BoxGeometry(2.2, 0.14, 0.14), M.metalDark, T(0, 2.2, -0.9)); p.add(new THREE.BoxGeometry(2.2, 0.14, 0.14), M.metalDark, T(0, 2.2, 0.9));
  p.add(new THREE.BoxGeometry(0.14, 0.14, 2.2), M.metalDark, T(-0.9, 2.2, 0)); p.add(new THREE.BoxGeometry(0.14, 0.14, 2.2), M.metalDark, T(0.9, 2.2, 0));
  for (const [x, z, ry] of [[0, -0.9, 0], [0, 0.9, 0]]) p.add(new THREE.BoxGeometry(2.4, 0.05, 0.05), M.galv, T(x, 1.1, z, 0, ry, 0.75));
  // caged ladder
  for (let y = 0.3; y < 4.6; y += 0.3) p.add(new THREE.CylinderGeometry(0.015, 0.015, 0.45), M.galv, T(0, y, 1.32, 0, 0, Math.PI / 2));
  for (const sx of [-0.22, 0.22]) p.add(new THREE.BoxGeometry(0.03, 4.6, 0.03), M.galv, T(sx, 2.3, 1.32));
  // pipes
  p.add(new THREE.CylinderGeometry(0.07, 0.07, 2.4), M.galv, T(0.5, 1.2, 0.3));
  p.add(new THREE.TorusGeometry(0.2, 0.07, 8, 12, Math.PI / 2), M.galv, T(0.3, 2.4, 0.3, 0, 0, 0));
  return (_tank = p);
}

/* ----------------------------- Utility box ----------------------------- */
let _meter;
export function meterBox() {
  if (_meter) return _meter;
  const p = new Prefab('meter');
  const grey = new THREE.MeshStandardMaterial({ color: 0x9a9c96, roughness: 0.5, metalness: 0.4 });
  p.add(new THREE.BoxGeometry(0.42, 0.55, 0.18), grey, T(0, 0, 0));
  p.add(new THREE.BoxGeometry(0.3, 0.2, 0.02), M.glassFrost, T(0, 0.1, 0.1));
  p.add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), M.plasticBlack, T(0, 0.1, 0.095, Math.PI / 2, 0, 0));
  p.add(new THREE.CylinderGeometry(0.025, 0.025, 0.5), M.plasticGrey, T(-0.12, -0.5, 0));
  p.add(new THREE.CylinderGeometry(0.025, 0.025, 0.5), M.plasticGrey, T(0.12, -0.5, 0));
  return (_meter = p);
}

/* --------------------------- Beer crate stack --------------------------- */
export function crateStack(batch, matrix, rng, n = 3) {
  const cmat = rng.chance(0.5) ? new THREE.MeshStandardMaterial({ color: 0xc8a000, roughness: 0.5 }) : new THREE.MeshStandardMaterial({ color: 0x9a1418, roughness: 0.5 });
  const bottle = new THREE.MeshStandardMaterial({ color: 0x3a1c06, roughness: 0.1, metalness: 0.1 });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Matrix4().multiplyMatrices(matrix, T(rng.range(-0.03, 0.03), i * 0.3 + 0.15, 0, 0, rng.range(-0.08, 0.08), 0));
    // open-sided crate: frame + slats
    batch.add(new THREE.BoxGeometry(0.46, 0.04, 0.34), cmat, new THREE.Matrix4().multiplyMatrices(m, T(0, -0.13, 0)));
    for (const sz of [-0.165, 0.165]) batch.add(new THREE.BoxGeometry(0.46, 0.28, 0.02), cmat, new THREE.Matrix4().multiplyMatrices(m, T(0, 0, sz)));
    for (const sx of [-0.225, 0.225]) batch.add(new THREE.BoxGeometry(0.02, 0.28, 0.34), cmat, new THREE.Matrix4().multiplyMatrices(m, T(sx, 0, 0)));
    if (i === n - 1) for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 3; bz++) {
      batch.add(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8), bottle, new THREE.Matrix4().multiplyMatrices(m, T(-0.16 + bx * 0.107, 0.0, -0.1 + bz * 0.1)));
    }
  }
}

/* ------------------------------ Trash bags ----------------------------- */
export function trashBag(batch, matrix, rng) {
  const g = new THREE.IcosahedronGeometry(0.32, 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 1 + Math.sin(x * 9 + rng.next()) * 0.06 + Math.sin(z * 11) * 0.05;
    pos.setXYZ(i, x * n, y * (y < 0 ? 0.55 : 0.9) * n, z * n);
  }
  g.computeVertexNormals();
  batch.add(g, rng.chance(0.25) ? M.trashBagBlue : M.trashBag, new THREE.Matrix4().multiplyMatrices(matrix, T(0, 0.2, 0, 0, rng.range(0, 6), 0, rng.range(0.85, 1.2))));
  batch.add(new THREE.ConeGeometry(0.06, 0.16, 6), M.trashBag, new THREE.Matrix4().multiplyMatrices(matrix, T(0, 0.52, 0)));
}

/* ------------------------------ Bicycle -------------------------------- */
export function bicycle(group, x, y, z, ry, color = 0x1d6b74) {
  const B = new Batch('bike');
  const frame = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 });
  const wheel = (cx) => {
    B.add(new THREE.TorusGeometry(0.33, 0.022, 8, 32), M.rubber, T(cx, 0.35, 0));
    B.add(new THREE.TorusGeometry(0.3, 0.008, 6, 32), M.chrome, T(cx, 0.35, 0));
    for (let i = 0; i < 12; i++) B.add(new THREE.CylinderGeometry(0.002, 0.002, 0.6, 3), M.chrome, T(cx, 0.35, 0, 0, 0, (i / 12) * Math.PI));
    B.add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), M.chrome, T(cx, 0.35, 0, Math.PI / 2, 0, 0));
  };
  wheel(-0.52); wheel(0.52);
  const v = (a, b, c) => new THREE.Vector3(a, b, c);
  const tubes = [[v(-0.52, 0.35, 0), v(-0.05, 0.38, 0)], [v(-0.05, 0.38, 0), v(-0.15, 0.85, 0)], [v(-0.52, 0.35, 0), v(-0.15, 0.82, 0)],
    [v(-0.05, 0.38, 0), v(0.4, 0.82, 0)], [v(-0.15, 0.8, 0), v(0.4, 0.82, 0)], [v(0.52, 0.35, 0), v(0.42, 0.95, 0)]];
  tubes.forEach(([a, b]) => B.rod(frame, 0.018, a, b, 8));
  B.add(new THREE.BoxGeometry(0.24, 0.05, 0.1), M.plasticBlack, T(-0.17, 0.9, 0, 0, 0, 0.05));
  B.rod(M.chrome, 0.012, v(0.42, 0.98, -0.25), v(0.42, 0.98, 0.25));
  // front basket (mamachari!)
  B.add(new THREE.BoxGeometry(0.34, 0.24, 0.36), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4, wireframe: true }), T(0.62, 0.92, 0));
  B.add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), M.chrome, T(-0.05, 0.38, 0.06, Math.PI / 2, 0, 0));
  const g = B.build(null, { cast: true });
  g.position.set(x, y, z); g.rotation.y = ry; g.rotation.x = 0; g.rotation.z = 0.12;
  group.add(g);
  return g;
}

export { glow, roundRectShape };
