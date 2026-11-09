import * as THREE from 'three';
import { M, glow } from '../core/materials.js';
import { RNG } from '../core/utils.js';

/* =================================================================== */
/*  People, sculpted as one continuous surface per layer.               */
/*                                                                     */
/*  Each body, garment, head, hand, hairstyle and shoe is written as a */
/*  signed distance field: round-cone limbs and ellipsoid masses        */
/*  blended with smooth unions, clothing as an offset shell of the     */
/*  body with its own hems, collars, quilting, pleats and creases. The */
/*  fields are polygonised with surface nets (projected to the surface, */
/*  normals from the field gradient, cavity AO baked into vertex        */
/*  colours) and skinned to a 17-bone skeleton, so walkers have a real */
/*  gait: knee flexion in swing, pelvis bob/sway/rotation, counter-     */
/*  rotating shoulders and arms.                                        */
/* =================================================================== */

/* ------------------------------ field kit ------------------------------ */
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
function ell(c, r) {
  const [cx, cy, cz] = c, [rx, ry, rz] = r;
  return (x, y, z) => {
    const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
    const k0 = Math.hypot(px, py, pz);
    const k1 = Math.hypot(px / rx, py / ry, pz / rz);
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  };
}
function rcone(a, b, r1, r2, zs = 1) {        // round cone a→b (iq), optional z squash about the axis
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = (z - a[2]) / zs;
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
}
function torusY(c, R, r, sz = 1) {
  return (x, y, z) => { const qx = Math.hypot(x - c[0], (z - c[2]) / sz) - R; return Math.hypot(qx, y - c[1]) - r; };
}
const fract = (v) => v - Math.floor(v);
const h3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h3(ix, iy, iz), h3(ix + 1, iy, iz), fx), l(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), fx), fy),
    l(l(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), fx), l(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/* -------------------------- surface nets mesher ------------------------- */
// f: field, label: (x,y,z) => [boneA, boneB, wB], color: (x,y,z,nx,ny,nz,ao) => [r,g,b]
function polygonize(f, bmin, bmax, h, label, color) {
  const nx = Math.ceil((bmax[0] - bmin[0]) / h) + 1, ny = Math.ceil((bmax[1] - bmin[1]) / h) + 1, nz = Math.ceil((bmax[2] - bmin[2]) / h) + 1;
  const C = 4, cnx = Math.ceil((nx - 1) / C) + 1, cny = Math.ceil((ny - 1) / C) + 1, cnz = Math.ceil((nz - 1) / C) + 1;
  const coarse = new Float32Array(cnx * cny * cnz);
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    coarse[i + cnx * (j + cny * k)] = f(bmin[0] + i * C * h, bmin[1] + j * C * h, bmin[2] + k * C * h);
  }
  const far = C * h * 2.6;
  const v = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cv = coarse[Math.round(i / C) + cnx * (Math.round(j / C) + cny * Math.round(k / C))];
    v[i + nx * (j + ny * k)] = Math.abs(cv) > far ? cv : f(bmin[0] + i * h, bmin[1] + j * h, bmin[2] + k * h);
  }
  const at = (i, j, k) => v[i + nx * (j + ny * k)];
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv8 = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const d = at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1)); cv8[c] = d; if (d < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      const da = cv8[a], db = cv8[b];
      if ((da < 0) === (db < 0)) continue;
      const t = da / (da - db);
      sx += (a & 1) + t * ((b & 1) - (a & 1)); sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1)); sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1)); n++;
    }
    cell[i + (nx - 1) * (j + (ny - 1) * k)] = P.length / 3;
    P.push(bmin[0] + (i + sx / n) * h, bmin[1] + (j + sy / n) * h, bmin[2] + (k + sz / n) * h);
  }
  const ci = (i, j, k) => cell[i + (nx - 1) * (j + (ny - 1) * k)];
  const idx = [];
  // deterministic surface-nets winding: the listed cell order winds +x, -y, +z respectively
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (!flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const d0 = at(i, j, k), d1 = at(i + 1, j, k); if ((d0 < 0) === (d1 < 0)) continue;
    quad(ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k), d1 < d0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const d0 = at(i, j, k), d1 = at(i, j + 1, k); if ((d0 < 0) === (d1 < 0)) continue;
    quad(ci(i - 1, j, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i - 1, j, k), d1 > d0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const d0 = at(i, j, k), d1 = at(i, j, k + 1); if ((d0 < 0) === (d1 < 0)) continue;
    quad(ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k), d1 < d0);
  }
  // project onto the surface, normals from the gradient, cavity AO, colour and bone labels
  const nV = P.length / 3, e = h * 0.5;
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), col = new Float32Array(nV * 3);
  const si = new Uint16Array(nV * 4), sw = new Float32Array(nV * 4);
  for (let q = 0; q < nV; q++) {
    let x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    let gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    const d = f(x, y, z);
    if (Math.abs(d) < h) { x -= gx * d; y -= gy * d; z -= gz * d; }
    pos.set([x, y, z], q * 3); nor.set([gx, gy, gz], q * 3);
    const ao = Math.min(1, Math.max(0, f(x + gx * 0.018, y + gy * 0.018, z + gz * 0.018) / 0.018));
    col.set(color(x, y, z, gx, gy, gz, 0.45 + 0.55 * Math.pow(ao, 0.8)), q * 3);
    const [ba, bb, wb] = label(x, y, z);
    si.set([ba, bb, 0, 0], q * 4); sw.set([1 - wb, wb, 0, 0], q * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setIndex(idx);
  return g;
}
function mergeGeos(list) {
  const out = new THREE.BufferGeometry();
  const names = ['position', 'normal', 'color', 'skinIndex', 'skinWeight'];
  let vcount = 0; const idx = [];
  for (const g of list) { for (const i of g.index.array) idx.push(i + vcount); vcount += g.attributes.position.count; }
  for (const n of names) {
    const A = list[0].attributes[n];
    const arr = new A.array.constructor(vcount * A.itemSize);
    let o = 0; for (const g of list) { arr.set(g.attributes[n].array, o); o += g.attributes[n].array.length; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, A.itemSize));
  }
  out.setIndex(idx);
  return out;
}

/* ------------------------------- materials ------------------------------ */
const mats = {};
const getMat = (k) => mats[k] ||= ({
  fabric: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
  wool: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  rain: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.25 }),
  leather: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
  skin: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.9, 0.45, 0.35) }),
  hair: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(0.5, 0.45, 0.4) }),
  shoe: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.3 }),
  eye: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, clearcoat: 1 }),
})[k]();

const SKIN = [[0.78, 0.6, 0.49], [0.72, 0.53, 0.41], [0.62, 0.45, 0.34], [0.86, 0.69, 0.57], [0.48, 0.33, 0.24], [0.8, 0.62, 0.5]];
const HAIR = [[0.025, 0.022, 0.02], [0.05, 0.035, 0.025], [0.12, 0.07, 0.04], [0.02, 0.02, 0.025], [0.35, 0.3, 0.27], [0.18, 0.12, 0.08]];
const hexRGB = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map((c) => c * c); // sRGB-ish → linear
const PALETTE = {
  coat: [0x1b1c20, 0x23262c, 0x2b2f38, 0x3b3f46, 0x1c2433, 0x2c3a2a, 0x4a3c2c, 0x7a6248, 0x5a2a2e, 0x8a8478, 0x2a2d3a, 0xa08060],
  accent: [0xc8a020, 0x9a1c24, 0x2a6a8a, 0xd8d0c0],
  pants: [0x16171b, 0x1f2633, 0x2c3a52, 0x3a352c, 0x111111, 0x4a4a4e, 0x26304a],
};

/* -------------------------------- figure -------------------------------- */
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'uaL', 'faL', 'handL', 'uaR', 'faR', 'handR', 'thL', 'shL', 'footL', 'thR', 'shR', 'footR'];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));
const PARENT = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', uaL: 'chest', faL: 'uaL', handL: 'faL', uaR: 'chest', faR: 'uaR', handR: 'faR', thL: 'hips', shL: 'thL', footL: 'shL', thR: 'hips', shR: 'thR', footR: 'shR' };

export function figure(parent, { x = 0, y = 0, z = 0, ry = 0, pose = 'standing', coat, hair, seed = 1, hood = false, umbrella = null, scale = 1, outfit: forceOutfit, prop } = {}) {
  const r = new RNG(seed * 7919 + 13);
  const chef = pose === 'chef', seated = pose === 'seated';
  const fem = r.chance(0.48);
  const sw = fem ? r.range(0.86, 0.94) : r.range(0.98, 1.08);   // shoulder width
  const hw = fem ? r.range(1.02, 1.1) : r.range(0.92, 1.0);     // hip width
  const bulk = r.range(0.95, 1.08);
  const H = (fem ? r.range(0.93, 0.99) : r.range(0.98, 1.05)) * scale;

  const outfit = chef ? 'chef' : forceOutfit || r.pick(fem
    ? ['trench', 'puffer', 'coatskirt', 'hoodie', 'parka', 'trench', 'bomber', 'coatskirt']
    : ['trench', 'puffer', 'hoodie', 'suit', 'parka', 'bomber', 'suit', 'trench']);
  const hooded = outfit === 'parka' || outfit === 'hoodie' ? (hood || r.chance(0.35)) : false;
  const coatHex = chef ? 0xeeece6 : coat !== undefined && r.chance(0.5) ? coat : r.chance(0.12) ? r.pick(PALETTE.accent) : r.pick(PALETTE.coat);
  const coatRGB = hexRGB(coatHex);
  const pantsRGB = hexRGB(r.pick(PALETTE.pants));
  const skin = SKIN[r.int(0, SKIN.length - 1)];
  const hairRGB = hair !== undefined && r.chance(0.3) ? hexRGB(hair) : HAIR[r.int(0, HAIR.length - 1)];
  const fabricKind = outfit === 'puffer' || outfit === 'parka' ? 'rain' : outfit === 'trench' && r.chance(0.5) ? 'rain' : outfit === 'bomber' && r.chance(0.5) ? 'leather' : outfit === 'suit' ? 'wool' : 'fabric';

  /* ---- skeleton landmarks (bind pose: relaxed A-pose, facing +z) ---- */
  const L = {
    pelvis: [0, 0.975, 0], spine: [0, 1.09, -0.005], chest: [0, 1.25, -0.01], neck: [0, 1.445, -0.02], head: [0, 1.545, 0.0],
  };
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R';
    L['sh' + k] = [s * 0.172 * sw, 1.425, -0.02];
    L['el' + k] = [s * (0.205 * sw + 0.035), 1.15, -0.035];
    L['wr' + k] = [s * (0.222 * sw + 0.06), 0.9, 0.0];
    L['hp' + k] = [s * 0.088 * hw, 0.95, 0.0];
    L['kn' + k] = [s * 0.098 * hw, 0.52, 0.018];
    L['an' + k] = [s * 0.102 * hw, 0.085, -0.018];
  }

  /* ---- body masses (tagged with bones, used for clothing + skin + weights) ---- */
  const parts = [
    { f: ell([0, 0.965, -0.008], [0.158 * hw, 0.105, 0.112 * bulk]), b: 'hips' },
    { f: ell([0, 1.11, 0.006], [(fem ? 0.128 : 0.142) * bulk, 0.12, 0.098 * bulk]), b: 'spine' },
    { f: ell([0, 1.3, -0.002], [0.158 * sw * bulk, 0.125, 0.106 * bulk]), b: 'chest' },
    { f: rcone([0.15 * sw, 1.415, -0.02], [-0.15 * sw, 1.415, -0.02], 0.058, 0.058), b: 'chest' },
    { f: rcone([0, 1.42, -0.022], [0, 1.535, 0.0], 0.054, 0.048), b: 'neck' },
  ];
  if (fem) for (const s of [1, -1]) parts.push({ f: ell([s * 0.06, 1.285, 0.065], [0.06, 0.055, 0.045]), b: 'chest' });
  const limbs = {};
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    limbs['ua' + k] = { f: rcone(L['sh' + k], L['el' + k], 0.05 * bulk, 0.04 * bulk), b: 'ua' + k };
    limbs['fa' + k] = { f: rcone(L['el' + k], L['wr' + k], 0.041 * bulk, 0.028), b: 'fa' + k };
    limbs['th' + k] = { f: rcone(L['hp' + k], L['kn' + k], (fem ? 0.09 : 0.085) * bulk, 0.054), b: 'th' + k };
    limbs['sn' + k] = { f: rcone(L['kn' + k], L['an' + k], 0.05, 0.032), b: 'sh' + k };
    limbs['cf' + k] = { f: ell([L['kn' + k][0], 0.36, L['kn' + k][2] - 0.025], [0.045, 0.1, 0.045]), b: 'sh' + k };
  }
  const allTagged = [...parts, ...Object.values(limbs)];
  const labelFrom = (set) => (x, y, z) => {
    let b1 = 0, d1 = 1e9, b2 = 0, d2 = 1e9;
    for (const p of set) {
      const d = p.f(x, y, z), b = BI[p.b];
      if (d < d1) { if (b !== b1) { b2 = b1; d2 = d1; } b1 = b; d1 = d; } else if (d < d2 && b !== b1) { b2 = b; d2 = d; }
    }
    const w = 0.5 * Math.pow(Math.max(0, 1 - (d2 - d1) / 0.045), 2);
    return [b1, b2, w];
  };
  const bodyLabel = labelFrom(allTagged);
  const U = (list, k = 0.05) => (x, y, z) => { let d = 1e9; for (const p of list) d = smin(d, p.f(x, y, z), k); return d; };

  const geos = { garment: [], lower: [], skin: [], hair: [], shoe: [] };
  const colorFlat = (rgb, vary = 0.06) => (x, y, z, nx, ny, nz, ao) => {
    const n = 1 + (vnoise(x * 40, y * 40, z * 40) - 0.5) * vary;
    return rgb.map((c) => c * ao * n);
  };

  /* ---------------------------- upper garment ---------------------------- */
  const drape = { f: ell([0, 1.2, -0.004], [0.165 * sw * bulk, 0.3, 0.112 * bulk]), b: 'spine' };
  const torsoSet = [...parts.filter((p) => p.b !== 'neck'), drape];
  const torsoU = U(torsoSet, 0.08);
  const sleeve = (k) => {
    const ua = limbs['ua' + k].f, fa = limbs['fa' + k].f;
    const wr = L['wr' + k], el = L['el' + k];
    const dx = wr[0] - el[0], dy = wr[1] - el[1], dz = wr[2] - el[2], dl = Math.hypot(dx, dy, dz);
    const ux = dx / dl, uy = dy / dl, uz = dz / dl;
    const cuff = outfit === 'puffer' || outfit === 'parka' ? 0.035 : 0.012;
    return (x, y, z) => {
      let d = smin(ua(x, y, z), fa(x, y, z), 0.03);
      const along = (x - wr[0]) * ux + (y - wr[1]) * uy + (z - wr[2]) * uz;   // >0 beyond the wrist
      d = smax(d, along + cuff, 0.006);
      // elbow creases + a little bagginess at the cuff
      const de = Math.hypot(x - el[0], y - el[1], z - el[2]);
      d -= 0.004 * Math.sin(de * 170) * Math.exp(-de * de / 0.004);
      d -= 0.006 * sstep(-0.12, 0, along);
      return d;
    };
  };
  const slL = sleeve('L'), slR = sleeve('R');
  const long = outfit === 'trench' || outfit === 'parka';
  const tieRGB = hexRGB(r.pick([0x5a1018, 0x1c2a4a, 0x2a2a2a]));
  const hemY = outfit === 'trench' ? 0.5 : outfit === 'parka' ? 0.72 : outfit === 'coatskirt' ? 0.78 : outfit === 'suit' ? 0.86 : outfit === 'chef' ? 0.84 : outfit === 'bomber' ? 0.93 : 0.88;
  const thick = outfit === 'puffer' ? 0.03 : outfit === 'parka' ? 0.022 : outfit === 'trench' || outfit === 'coatskirt' ? 0.014 : 0.01;
  const skirtCone = rcone([0, 1.0, -0.005], [0, hemY - 0.02, -0.01], 0.19 * hw, (outfit === 'trench' ? 0.255 : 0.235) * hw, 0.72);
  const skirtIn = rcone([0, 0.95, -0.005], [0, hemY - 0.2, -0.01], 0.17 * hw, 0.25 * hw, 0.7);
  const hoodShell = (() => {
    const outer = ell([0, 1.6, -0.03], [0.118, 0.135, 0.13]), inner = ell([0, 1.6, -0.02], [0.098, 0.118, 0.115]);
    const face = ell([0, 1.585, 0.11], [0.085, 0.1, 0.09]);
    return (x, y, z) => smax(smax(outer(x, y, z), -inner(x, y, z), 0.01), -face(x, y, z), 0.02);
  })();
  const hoodDown = ell([0, 1.47, -0.1], [0.105, 0.06, 0.07]);
  const collarT = outfit === 'trench' ? torusY([0, 1.445, -0.008], 0.085, 0.024, 0.85) : outfit === 'suit' || outfit === 'chef' ? torusY([0, 1.455, -0.012], 0.066, 0.014, 0.9) : torusY([0, 1.45, -0.015], 0.072, outfit === 'puffer' ? 0.03 : 0.02, 0.9);
  const belt = torusY([0, 1.03, -0.003], 0.158 * hw + thick, 0.012, 0.72);
  const zf = (yy) => 0.006 + (yy > 1.2 ? 0.104 * sw * bulk : 0.098 * bulk) + thick;     // approx. front surface depth
  const lapels = outfit === 'trench' || outfit === 'suit' || outfit === 'coatskirt'
    ? [1, -1].flatMap((sx) => [rcone([sx * 0.06, 1.435, zf(1.4) - 0.012], [sx * 0.01, outfit === 'suit' ? 1.17 : 1.2, zf(1.2) + 0.004], 0.009, 0.007), rcone([sx * 0.06, 1.435, zf(1.4) - 0.012], [sx * 0.105, 1.36, zf(1.36) - 0.004], 0.009, 0.008)]) : null;
  const buttons = [];
  if (outfit === 'trench') for (const by of [1.17, 1.08, 0.99]) for (const sx of [0.05, -0.05]) buttons.push([sx, by, zf(by) + 0.002]);
  if (outfit === 'suit') for (const by of [1.13, 1.04]) buttons.push([0.0, by, zf(by)]);
  if (outfit === 'coatskirt') for (const by of [1.3, 1.2, 1.1, 1.0]) buttons.push([0.0, by, zf(by)]);
  const garmentF = (x, y, z) => {
    let d = torsoU(x, y, z);
    if (long || outfit === 'coatskirt') {
      let sk = skirtCone(x, y, z);
      sk = smax(sk, -skirtIn(x, y, z), 0.01);
      if (outfit === 'trench' || outfit === 'parka') sk = smax(sk, -(Math.max(Math.abs(x) - 0.004 - 0.09 * Math.max(0, 0.86 - y), -z, y - 0.88)), 0.008);   // front opening, widening to the hem
      d = smin(d, sk + 0.004 * Math.sin(Math.atan2(z, x) * 9) * sstep(0.95, hemY, y), 0.05);    // drape folds
    }
    d = smax(d, hemY - y, 0.01);                                 // hem
    d = smin(d, smin(slL(x, y, z), slR(x, y, z), 0.001), 0.045);
    // fabric thickness: puffer baffles, creases, noise
    let t = thick;
    if (outfit === 'puffer') t += 0.012 * Math.abs(Math.sin(y * Math.PI / 0.085)) - 0.006;
    if (outfit === 'parka') t += 0.004 * Math.abs(Math.sin(y * Math.PI / 0.16));
    t += 0.0022 * (vnoise(x * 11, y * 5, z * 11) - 0.5);
    t += 0.003 * Math.sin(y * 95 + x * 20) * sstep(1.1, 0.95, y) * sstep(0.85, 0.95, y);   // waist bunching
    d -= t;
    d = smin(d, collarT(x, y, z), 0.02);
    if (hooded) d = smin(d, hoodShell(x, y, z) - 0.002 * vnoise(x * 30, y * 30, z * 30), 0.03);
    else if (outfit === 'hoodie' || outfit === 'parka') d = smin(d, hoodDown(x, y, z), 0.03);
    if (outfit === 'trench') d = smin(d, belt(x, y, z), 0.006);
    if (lapels) for (const lp of lapels) d = smin(d, lp(x, y, z), 0.006);
    for (const b of buttons) d = smin(d, Math.hypot(x - b[0], y - b[1], z - b[2]) - 0.009, 0.003);
    // pockets: flaps at hip height
    if (outfit !== 'chef') for (const s of [1, -1]) {
      const px = x - s * 0.1, py = y - (outfit === 'trench' ? 0.92 : Math.max(hemY + 0.09, 0.95)), pz = z - (long ? 0.15 : 0.105 * bulk + thick);
      d = smin(d, Math.max(Math.abs(px) - 0.055, Math.abs(py) - 0.006, Math.abs(pz) - 0.012) - 0.004, 0.01);
    }
    return d;
  };
  const placket = (x, z) => Math.abs(x) < 0.006 && z > 0.05;
  const garmentColor = (x, y, z, nx, ny, nz, ao) => {
    const base = chef ? hexRGB(0xeeece6) : coatRGB;
    let k = 1 + (vnoise(x * 30, y * 30, z * 30) - 0.5) * 0.12;
    if (placket(x, z) && y < 1.42) k *= outfit === 'suit' ? 1 : 0.55;
    for (const b of buttons) if (Math.hypot(x - b[0], y - b[1], z - b[2]) < 0.011) k *= 0.25;
    if (y < hemY + 0.02) k *= 0.85;
    let c = base.map((v) => v * k * ao);
    if (outfit === 'suit' && z > 0.06 && Math.abs(x) < 0.05 - (1.42 - y) * 0.12 && y > 1.2) c = hexRGB(0xdedcd6).map((v) => v * ao);   // shirt V
    if (outfit === 'suit' && z > 0.06 && Math.abs(x) < 0.012 && y > 1.12 && y < 1.4) c = tieRGB.map((v) => v * ao); // tie
    if (outfit === 'chef' && z > 0.05 && Math.abs(Math.abs(x) - 0.05) < 0.007 && Math.abs(fract(y / 0.07) - 0.5) < 0.12 && y > 1.1) c = [0.02, 0.02, 0.02];   // buttons
    return c;
  };
  const gb = outfit === 'trench' || outfit === 'parka' ? 0.44 : hemY - 0.05;
  const garmentLabel = (x, y, z) => {
    const l = bodyLabel(x, y, z);
    if (y < 0.93 && (l[0] === BI.hips || l[0] === BI.thL || l[0] === BI.thR)) {    // long skirts follow the thighs a little
      const a = 0.55 * sstep(0.93, 0.55, y) * Math.min(1, Math.abs(x) / 0.06);
      return [BI.hips, x > 0 ? BI.thL : BI.thR, a];
    }
    return l;
  };
  geos.garment.push(polygonize(garmentF, [-0.44, gb, -0.27], [0.44, hooded ? 1.76 : 1.56, 0.27], 0.0125, garmentLabel, garmentColor));

  /* -------------------------- lower: trousers / skirt ------------------------- */
  const legSet = [parts[0], limbs.thL, limbs.thR, limbs.snL, limbs.snR, limbs.cfL, limbs.cfR];
  const legU = U(legSet, 0.04);
  const skirted = outfit === 'coatskirt';
  if (!skirted) {
    const trousersF = (x, y, z) => {
      let d = legU(x, y, z) - 0.012 - 0.003 * (vnoise(x * 25, y * 12, z * 25) - 0.5);
      d -= 0.005 * Math.sin(y * 95) * sstep(0.26, 0.1, y);              // stacking at the ankle
      d -= 0.003 * Math.sin(y * 60 + x * 30) * Math.exp(-((y - 0.52) ** 2) / 0.002);   // knee creases
      d = smax(d, 0.075 - y, 0.006);
      d = smax(d, y - 1.04, 0.006);
      return d;
    };
    geos.lower.push(polygonize(trousersF, [-0.25, 0.05, -0.17], [0.25, 1.06, 0.17], 0.013, labelFrom(legSet), colorFlat(pantsRGB, 0.15)));
  } else {
    const tightsF = (x, y, z) => smax(smax(legU(x, y, z) - 0.002, 0.08 - y, 0.004), y - 0.85, 0.004);
    const tights = r.chance(0.6) ? [0.03, 0.028, 0.03] : skin;
    geos.lower.push(polygonize(tightsF, [-0.22, 0.06, -0.15], [0.22, 0.87, 0.15], 0.012, labelFrom(legSet), colorFlat(tights, 0.05)));
  }

  /* --------------------------------- head --------------------------------- */
  const hs = fem ? 0.96 : 1.0;
  const HC = [0, 1.6, -0.004];
  const headParts = [
    ell([0, 1.605, -0.008], [0.074 * hs, 0.093 * hs, 0.09 * hs]),
    ell([0, 1.545, 0.028], [0.057 * hs, 0.05, 0.06]),
    ell([0, 1.515, 0.06], [0.026, 0.02, 0.022]),
    ell([0.041, 1.582, 0.053], [0.024, 0.017, 0.022]), ell([-0.041, 1.582, 0.053], [0.024, 0.017, 0.022]),
    rcone([-0.034, 1.632, 0.074], [0.034, 1.632, 0.074], 0.011, 0.011),
    rcone([0, 1.625, 0.083], [0, 1.584, 0.104], 0.008, 0.0115),
    ell([0.011, 1.583, 0.093], [0.008, 0.007, 0.007]), ell([-0.011, 1.583, 0.093], [0.008, 0.007, 0.007]),
    ell([0, 1.556, 0.083], [0.022, 0.0085, 0.011]),
    ell([0.077, 1.598, -0.004], [0.011, 0.029, 0.019]), ell([-0.077, 1.598, -0.004], [0.011, 0.029, 0.019]),
  ];
  const sockets = [ell([0.031, 1.611, 0.084], [0.017, 0.012, 0.012]), ell([-0.031, 1.611, 0.084], [0.017, 0.012, 0.012])];
  const mouth = rcone([-0.019, 1.553, 0.092], [0.019, 1.553, 0.092], 0.0016, 0.0016);
  const neckF = parts[4].f;
  const headF = (x, y, z) => {
    let d = headParts[0](x, y, z);
    for (let i = 1; i < headParts.length; i++) d = smin(d, headParts[i](x, y, z), i < 5 ? 0.02 : i < 10 ? 0.008 : 0.006);
    for (const s of sockets) d = smax(d, -s(x, y, z), 0.008);
    d = smax(d, -mouth(x, y, z), 0.002);
    d = smin(d, neckF(x, y, z), 0.03);
    return smax(d, 1.42 - y, 0.005);
  };
  const lip = ell([0, 1.556, 0.083], [0.024, 0.011, 0.014]);
  const cheekL = ell([0.045, 1.575, 0.06], [0.03, 0.022, 0.03]), cheekR = ell([-0.045, 1.575, 0.06], [0.03, 0.022, 0.03]);
  const skinColor = (x, y, z, nx, ny, nz, ao) => {
    let c = skin.map((v) => v * (1 + (vnoise(x * 120, y * 120, z * 120) - 0.5) * 0.06));
    if (lip(x, y, z) < 0.002) c = [c[0] * 0.9, c[1] * 0.68, c[2] * 0.66];
    else if (Math.min(cheekL(x, y, z), cheekR(x, y, z)) < 0) c = [c[0] * 1.03, c[1] * 0.9, c[2] * 0.88];
    if (y > 1.636 && y < 1.645 && Math.abs(x) > 0.012 && Math.abs(x) < 0.05 && z > 0.06) c = hairRGB.map((v) => v * 1.2 + 0.01);   // brows
    if (Math.min(sockets[0](x, y, z), sockets[1](x, y, z)) < 0.004) c = c.map((v) => v * 0.7);
    return c.map((v) => v * ao);
  };
  const headLabel = labelFrom([{ f: headParts[0], b: 'head' }, { f: headParts[1], b: 'head' }, parts[4], parts[2]]);
  geos.skin.push(polygonize(headF, [-0.105, 1.41, -0.115], [0.105, 1.72, 0.125], 0.0045, headLabel, skinColor));

  /* ---------------------------------- hair ---------------------------------- */
  const style = chef ? 'band' : hooded ? 'under' : r.pick(fem ? ['bob', 'long', 'pony', 'bun', 'long', 'beanie'] : ['short', 'short', 'crop', 'cap', 'beanie', 'pony', 'short']);
  const scalp = ell([0, 1.608, -0.01], [0.076 * hs, 0.095 * hs, 0.092 * hs]);
  const hairline = (x, y, z) => {        // positive where hair grows
    const front = 1.652 - 0.02 * (Math.abs(x) / 0.07) ** 2, side = 1.598, back = 1.53;
    const lim = z > 0.03 ? front : z > -0.02 ? side + (front - side) * sstep(-0.02, 0.03, z) : back + (side - back) * sstep(-0.09, -0.02, z);
    return y - lim;
  };
  const bangs = r.chance(0.6);
  const strands = (x, y, z) => 0.0012 * Math.sin((x * 0.7 + z * 0.7) * 520 + 30 * vnoise(x * 40, y * 40, z * 40));
  let hairF = null;
  const vol = style === 'crop' ? 0.006 : style === 'short' ? 0.012 : 0.016;
  if (['short', 'crop', 'pony', 'bun', 'bob', 'long', 'under'].includes(style)) {
    hairF = (x, y, z) => {
      let d = scalp(x, y, z) - vol - 0.004 * vnoise(x * 50, y * 50, z * 50);
      let region = hairline(x, y, z);
      if (style === 'bob') region = Math.max(region, Math.min(y - 1.505, 0.03 - z));
      if (style === 'long') region = Math.max(region, Math.min(y - 1.4, 0.02 - z));
      if ((style === 'bob' || style === 'long') && bangs) region = Math.max(region, Math.min(y - 1.626 - 0.012 * Math.abs(x) / 0.07, 0.11 - z));
      d -= (style === 'bob' || style === 'long') ? 0.006 * vnoise(x * 22, y * 10, z * 22) : 0;
      d = smax(d, -region, 0.008);
      if (style === 'bob') d = smin(d, smax(ell([0, 1.575, -0.012], [0.098, 0.088, 0.104])(x, y, z), Math.max(z - 0.035, 1.505 - y), 0.01), 0.02);
      if (style === 'long') d = smin(d, smax(rcone([0, 1.6, -0.06], [0, 1.33, -0.1], 0.092, 0.075, 0.55)(x, y, z), z + 0.02 - 0.0 * y, 0.02), 0.03);
      if (style === 'pony') d = smin(d, rcone([0, 1.635, -0.098], [0, 1.43, -0.125], 0.026, 0.016)(x, y, z), 0.02);
      if (style === 'bun') d = smin(d, ell([0, 1.69, -0.06], [0.04, 0.035, 0.04])(x, y, z), 0.015);
      d = smax(d, -scalp(x, y, z) + 0.001, 0.004);   // never inside the skull
      return d + strands(x, y, z);
    };
  }
  if (style === 'beanie') {
    hairF = (x, y, z) => {
      const a = Math.atan2(z, x);
      let d = scalp(x, y + 0.008, z) - 0.02 - 0.0018 * Math.abs(Math.sin(a * 28));
      d = smax(d, 1.615 - y + (z < -0.03 ? 0.025 : 0), 0.008);
      return smin(d, torusY([0, 1.622, -0.012], 0.084, 0.012)(x, y, z), 0.008);
    };
  }
  if (style === 'cap') {
    hairF = (x, y, z) => {
      let d = smax(scalp(x, y, z) - 0.014, 1.64 - y, 0.006);
      const visor = Math.max(ell([0, 1.645, 0.1], [0.08, 0.006, 0.07])(x, y, z), 0.04 - z);
      return smin(d, visor, 0.01);
    };
  }
  if (style === 'band') {
    hairF = (x, y, z) => smin(smax(scalp(x, y, z) - 0.008, -hairline(x, y, z), 0.008), torusY([0, 1.655, -0.01], 0.084, 0.011, 1.0)(x, y, z), 0.004);
  }
  if (hairF) {
    const hatRGB = style === 'beanie' ? hexRGB(r.pick([0x2a2a30, 0x6a1c1c, 0x2a3a2a, 0xc8c0b0, 0x1a1a1a])) : style === 'cap' ? hexRGB(r.pick([0x111111, 0x1f2a44, 0xd8d8d8])) : null;
    const hc = (x, y, z, nx, ny, nz, ao) => {
      if (style === 'band' && Math.abs(y - 1.655) < 0.014) return [0.85, 0.85, 0.83].map((v) => v * ao);
      const base = hatRGB || hairRGB;
      const s = 1 + (vnoise(x * 200, y * 60, z * 200) - 0.5) * (hatRGB ? 0.1 : 0.5);
      return base.map((v) => v * s * ao);
    };
    geos.hair.push(polygonize(hairF, [-0.115, style === 'long' ? 1.28 : 1.4, -0.2], [0.115, 1.73, 0.18], 0.0045, () => [BI.head, BI.head, 0], hc));
  }

  /* ---------------------------------- hands ---------------------------------- */
  const gripR = !!(umbrella !== null && umbrella !== undefined) || prop === 'phone' || prop === 'cigarette' || (!chef && !seated && false);
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const w = L['wr' + k];
    const fingers = [];
    const grip = k === 'R' && gripR;
    for (let i = 0; i < 4; i++) {
      const zz = w[2] + 0.024 - i * 0.016, len = [0.078, 0.084, 0.079, 0.064][i];
      const kn = [w[0] - s * 0.004, w[1] - 0.088, zz];
      const r0 = 0.0092 - i * 0.0006, r1 = 0.0072 - i * 0.0006;
      if (grip) {        // curled around an axis along z (vertical once the forearm is raised)
        const p1 = [kn[0] - s * 0.004, kn[1] - 0.034, zz];
        const p2 = [kn[0] - s * 0.03, kn[1] - 0.04, zz];
        const p3 = [kn[0] - s * 0.036, kn[1] - 0.014, zz];
        fingers.push(rcone(kn, p1, r0, r0 * 0.95), rcone(p1, p2, r0 * 0.95, r1 * 1.05), rcone(p2, p3, r1 * 1.05, r1));
      } else {
        const mid = [kn[0] - s * 0.006, kn[1] - len * 0.55, zz + 0.012];
        const tip = [kn[0] - s * 0.014, kn[1] - len, zz + 0.02];
        fingers.push(rcone(kn, mid, r0, 0.0085 - i * 0.0006), rcone(mid, tip, 0.0085 - i * 0.0006, r1));
      }
    }
    const palm = ell([w[0] - s * 0.002, w[1] - 0.052, w[2] + 0.002], [0.017, 0.045, 0.041]);
    const thumb1 = rcone([w[0] - s * 0.012, w[1] - 0.03, w[2] + 0.028], [w[0] - s * 0.022, w[1] - 0.062, w[2] + 0.044], 0.012, 0.0095);
    const thumb2 = rcone([w[0] - s * 0.022, w[1] - 0.062, w[2] + 0.044], [w[0] - s * 0.03, w[1] - 0.088, w[2] + 0.046], 0.0095, 0.0078);
    const fa = limbs['fa' + k].f;
    const handF = (x, y, z) => {
      let d = palm(x, y, z);
      for (const f of fingers) d = smin(d, f(x, y, z), 0.006);
      d = smin(d, smin(thumb1(x, y, z), thumb2(x, y, z), 0.006), 0.012);
      d = smin(d, fa(x, y, z) + 0.004, 0.02);
      return smax(d, y - (w[1] + 0.05), 0.005);
    };
    const lab = labelFrom([{ f: palm, b: 'hand' + k }, { f: fa, b: 'fa' + k }]);
    geos.skin.push(polygonize(handF, [w[0] - 0.06, w[1] - 0.2, w[2] - 0.06], [w[0] + 0.06, w[1] + 0.06, w[2] + 0.08], 0.0036, lab, (x, y, z, nx, ny, nz, ao) => skin.map((v) => v * ao)));
  }

  /* ---------------------------------- shoes ---------------------------------- */
  const shoeKind = r.pick(fem ? ['boot', 'sneaker', 'flat', 'boot'] : ['sneaker', 'boot', 'derby', 'sneaker']);
  const upper = hexRGB(shoeKind === 'sneaker' ? r.pick([0xe8e8e4, 0x1a1a1c, 0x5a5a60, 0x2a3a5a]) : r.pick([0x0e0d0c, 0x3a2416, 0x1a1a1c]));
  const sole = shoeKind === 'sneaker' ? [0.85, 0.85, 0.82] : [0.03, 0.03, 0.03];
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const a = L['an' + k];
    const body = rcone([a[0], 0.052, a[2] - 0.035], [a[0] + s * 0.008, 0.036, a[2] + 0.17], 0.046, 0.036, 1);
    const ankle = rcone([a[0], 0.05, a[2] - 0.01], [a[0], shoeKind === 'boot' ? 0.2 : 0.11, a[2] - 0.005], 0.047, 0.042);
    const shoeF = (x, y, z) => {
      let d = smin(body(x, y, z), ankle(x, y, z), 0.03);
      d = smax(d, -y, 0.004);
      if (shoeKind === 'flat') d = smax(d, y - 0.085, 0.01);
      return d;
    };
    const lab = labelFrom([{ f: body, b: 'foot' + k }, { f: limbs['sn' + k].f, b: 'sh' + k }]);
    geos.shoe.push(polygonize(shoeF, [a[0] - 0.07, -0.01, a[2] - 0.1], [a[0] + 0.07, shoeKind === 'boot' ? 0.22 : 0.14, a[2] + 0.23], 0.0065, lab,
      (x, y, z, nx, ny, nz, ao) => (y < 0.018 ? sole : upper).map((v) => v * ao)));
  }

  /* --------------------------------- assemble -------------------------------- */
  const root = new THREE.Group();
  const bones = {};
  for (const b of BONES) bones[b] = new THREE.Bone();
  const at = {
    hips: L.pelvis, spine: L.spine, chest: L.chest, neck: L.neck, head: L.head,
    uaL: L.shL, faL: L.elL, handL: L.wrL, uaR: L.shR, faR: L.elR, handR: L.wrR,
    thL: L.hpL, shL: L.knL, footL: L.anL, thR: L.hpR, shR: L.knR, footR: L.anR,
  };
  for (const b of BONES) {
    const p = at[b], par = PARENT[b] ? at[PARENT[b]] : [0, 0, 0];
    bones[b].position.set(p[0] - par[0], p[1] - par[1], p[2] - par[2]);
    if (PARENT[b]) bones[PARENT[b]].add(bones[b]);
  }
  const rig = new THREE.Group(); rig.scale.setScalar(H); root.add(rig);
  rig.add(bones.hips);
  rig.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((b) => bones[b]));
  const meshes = [];
  const add = (list, matKey, shadow = true) => {
    if (!list.length) return;
    const g = list.length > 1 ? mergeGeos(list) : list[0];
    const m = new THREE.SkinnedMesh(g, getMat(matKey));
    m.castShadow = shadow; m.frustumCulled = false;
    rig.add(m); m.updateMatrixWorld(true); m.bind(skeleton); meshes.push(m);
  };
  add(geos.garment, chef ? 'fabric' : fabricKind);
  add(geos.lower, skirted ? 'fabric' : r.chance(0.3) ? 'wool' : 'fabric');
  add(geos.skin, 'skin');
  add(geos.hair, style === 'beanie' ? 'wool' : style === 'cap' ? 'fabric' : 'hair', false);
  add(geos.shoe, 'shoe', false);
  // eyes (glossy, set in the sockets)
  for (const s of [1, -1]) {
    const eg = new THREE.SphereGeometry(0.0089, 14, 10);
    const ec = []; const ep = eg.attributes.position;
    for (let i = 0; i < ep.count; i++) { const zz = ep.getZ(i) / 0.0089; const c = zz > 0.82 ? [0.012, 0.009, 0.007] : zz > 0.62 ? [0.07, 0.045, 0.03] : [0.62, 0.6, 0.57]; ec.push(...c); }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(ec, 3));
    const e = new THREE.Mesh(eg, getMat('eye'));
    e.position.set(s * 0.031 - at.head[0], 1.61 - at.head[1], 0.0735 - at.head[2]);
    bones.head.add(e);
  }
  // accessories
  const accRoll = r.next();
  if (!chef && !seated && accRoll < 0.28) {            // tote / shoulder bag
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.07, 1, 1, 1), new THREE.MeshPhysicalMaterial({ color: r.pick([0x2a1c14, 0x111111, 0x8a6a4a, 0xd8d0c0]), roughness: 0.6, clearcoat: 0.2 }));
    bag.geometry.translate(0, -0.16, 0); bag.position.set(0.04, -0.12, 0); bag.rotation.z = 0.05;
    bones.uaL.add(bag); bag.position.set(0.05, -0.18, 0.0);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 4, 16, Math.PI), M.plasticBlack); strap.position.set(0.05, -0.02, 0); strap.rotation.y = Math.PI / 2; bones.uaL.add(strap);
  } else if (!chef && !seated && accRoll < 0.5) {      // backpack
    const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.18, 6, 12), new THREE.MeshPhysicalMaterial({ color: r.pick([0x111214, 0x2a3a2a, 0x3a2a1a, 0x1a2238]), roughness: 0.55, clearcoat: 0.5 }));
    pack.scale.set(1.15, 1, 0.5); pack.position.set(0, 0.06, -0.15); pack.castShadow = true; bones.chest.add(pack);
    for (const s of [1, -1]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.009, 4, 12, Math.PI), M.plasticBlack); st.position.set(s * 0.09, 0.08, -0.03); st.rotation.y = Math.PI / 2; st.rotation.z = -Math.PI / 2; bones.chest.add(st); }
  }
  if (!chef && r.chance(0.3) && style !== 'band') {   // face mask
    const maskF = (x, y, z) => smax(smax(headF(x, y, z) - 0.005, Math.max(y - 1.585, 1.508 - y), 0.004), 0.02 - z, 0.01);
    const mg = polygonize(maskF, [-0.1, 1.49, 0.0], [0.1, 1.6, 0.12], 0.0045, () => [BI.head, BI.head, 0], (x, y, z, nx, ny, nz, ao) => [0.82, 0.82, 0.8].map((v) => v * ao));
    const m = new THREE.SkinnedMesh(mg, getMat('fabric')); m.frustumCulled = false; rig.add(m); m.updateMatrixWorld(true); m.bind(skeleton);
  }

  /* ----------------------------------- pose ----------------------------------- */
  const set = (b, x = 0, y = 0, z = 0) => bones[b].rotation.set(x, y, z);
  const rest = () => { set('uaL', 0.04, 0, -0.07); set('uaR', 0.04, 0, 0.07); set('faL', -0.12); set('faR', -0.12); };
  rest();
  let holding = null;
  if (seated) {
    bones.hips.position.y = 0.075;
    for (const k of ['L', 'R']) { set('th' + k, -1.45, 0, 0); set('sh' + k, 1.45); set('foot' + k, 0.05); }
    set('spine', 0.12); set('chest', 0.08); set('head', 0.18);
    set('uaL', -0.55, 0, -0.12); set('faL', -1.1); set('uaR', -0.65, 0, 0.12); set('faR', -1.2, 0.2);
  } else if (chef) {
    set('uaL', -0.5, 0, -0.1); set('faL', -1.25); set('uaR', -0.35, 0, 0.1); set('faR', -1.4, -0.2); set('spine', 0.08); set('head', 0.22);
  } else if (prop === 'phone' || (!umbrella && r.chance(0.28))) {
    holding = 'phone';
    set('uaR', -0.32, 0, 0.18); set('faR', -1.55, 0.3); set('head', 0.38); set('neck', 0.1);
    const ph = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.15, 0.009), M.plasticBlack); ph.add(body);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.138), glow(0xbfe2ff, 2.2)); scr.position.z = 0.0051; ph.add(scr);
    ph.position.set(0.015, -0.11, 0.035); ph.rotation.set(-0.4, 0, 0.1); bones.handR.add(ph);
    ph.rotation.set(Math.PI / 2 - 0.25, 0, 0); ph.position.set(-0.01, -0.1, 0.03);
  } else if (prop === 'cigarette') {
    holding = 'cig';
    set('uaR', -0.2, 0, 0.25); set('faR', -2.2, 0.35);
  }

  /* --------------------------------- umbrella --------------------------------- */
  let umbrellaObj = null;
  if (umbrella !== null && umbrella !== undefined) {
    set('uaR', -0.42, 0, 0.12); set('faR', -1.25, 0.15);
    const umb = new THREE.Group();
    const kind = umbrella === 0xffffff || r.chance(0.45) ? 'vinyl' : r.chance(0.55) ? 'fabric' : 'led';
    const R = 0.56, open = Math.PI * 0.36;
    const cg = new THREE.SphereGeometry(R, 48, 10, 0, Math.PI * 2, 0, open);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), u = 1 - p.getY(i) / R;
      const panel = Math.abs(Math.sin(a * 4));           // 0 on the ribs, 1 mid-panel
      const sc = 1 - 0.045 * panel * Math.min(1, u * 3);
      p.setX(i, p.getX(i) * sc); p.setZ(i, p.getZ(i) * sc); p.setY(i, p.getY(i) - 0.018 * panel * u);
    }
    cg.computeVertexNormals();
    const canopyMat = kind === 'vinyl'
      ? new THREE.MeshPhysicalMaterial({ color: 0xf2f6ff, roughness: 0.12, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 })
      : kind === 'led'
        ? new THREE.MeshPhysicalMaterial({ color: 0x10121a, roughness: 0.3, transparent: true, opacity: 0.8, side: THREE.DoubleSide, clearcoat: 0.8, emissive: umbrella, emissiveIntensity: 0.04 })
        : new THREE.MeshPhysicalMaterial({ color: r.pick([0x0c0c10, 0x1a2238, 0x3a1018, 0x2a2a2a]), roughness: 0.38, clearcoat: 0.6, side: THREE.DoubleSide });
    const canopy = new THREE.Mesh(cg, canopyMat); canopy.scale.y = 0.6; canopy.castShadow = kind !== 'vinyl';
    const rimR = R * Math.sin(open), rimY = R * Math.cos(open) * 0.6;
    const ribM = kind === 'vinyl' ? new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }) : kind === 'led' ? glow(umbrella, 1.2) : M.metalDark;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const pts = []; for (let k = 0; k <= 6; k++) { const t = (k / 6) * open; pts.push(new THREE.Vector3(Math.cos(a) * R * Math.sin(t) * 0.995, R * Math.cos(t) * 0.6 - 0.006, Math.sin(a) * R * Math.sin(t) * 0.995)); }
      umb.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.0035, 4), ribM));
      const stretcher = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.3, 4), ribM);
      stretcher.position.set(Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.14); stretcher.rotation.set(0, -a, Math.PI / 2 - 0.55); umb.add(stretcher);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.007, 5, 4), kind === 'led' ? glow(umbrella, 3) : ribM);
      tip.position.set(Math.cos(a) * rimR, rimY - 0.012, Math.sin(a) * rimR); umb.add(tip);
    }
    if (kind === 'led') { const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.985, 0.005, 5, 48), glow(umbrella, 2.6)); rim.rotation.x = Math.PI / 2; rim.position.y = rimY - 0.01; umb.add(rim); }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.86, 8), kind === 'vinyl' ? ribM : M.chrome); shaft.position.y = 0.0; umb.add(shaft);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.011, 8, 16, Math.PI), kind === 'vinyl' ? new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35 }) : M.plasticBlack);
    handle.position.set(0.034, -0.43, 0); handle.rotation.z = Math.PI; umb.add(handle);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.06, 6), ribM); ferrule.position.y = 0.37; umb.add(ferrule);
    canopy.position.y = 0.43 - R * 0.6; umb.add(canopy);
    umb.children.forEach((c) => { if (c !== canopy && c !== shaft && c !== handle && c !== ferrule) c.position.y += 0.43 - R * 0.6; });
    umbrellaObj = umb;
    root.userData.umbrellaColor = umbrella;
  }
  if (holding === 'cig') {
    const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 6), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.7 }));
    cig.rotation.x = Math.PI / 2; cig.position.set(-0.01, -0.095, 0.04); bones.handR.add(cig);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), glow(0xff5a1a, 18)); ember.position.set(-0.01, -0.095, 0.075); bones.handR.add(ember);
    root.userData.ember = ember;
  }

  root.position.set(x, y, z);
  root.rotation.y = ry;
  parent.add(root);
  root.userData.bones = bones;

  /* ----------------------------------- gait ----------------------------------- */
  const hip0 = bones.hips.position.y;
  const armsFree = !umbrella && holding !== 'phone';
  root.userData.walk = (phase, speed = 1) => {
    const s = Math.sin(phase), c = Math.cos(phase);
    for (const [k, ph] of [['L', 0], ['R', Math.PI]]) {
      const q = phase + ph;
      const hipF = 0.4 * Math.sin(q) * speed;                                   // + = forward
      const knee = (0.08 + 1.0 * Math.pow(Math.max(0, Math.cos(q + 0.45)), 2.2)) * speed;
      set('th' + k, -hipF, 0, 0);
      set('sh' + k, knee);
      set('foot' + k, -0.25 * Math.sin(q - 0.6) * speed + 0.05);
    }
    bones.hips.position.y = hip0 - 0.022 * Math.abs(s) * speed + 0.008;
    bones.hips.position.x = 0.012 * s;
    bones.hips.rotation.set(0.03, 0.09 * s * speed, 0.035 * c);
    set('spine', 0.04, -0.06 * s * speed, -0.02 * c);
    set('chest', 0.0, -0.07 * s * speed, 0);
    set('neck', 0.02, 0.06 * s, 0);
    if (armsFree) {
      set('uaL', 0.32 * s * speed + 0.03, 0, -0.08); set('faL', -0.28 - Math.max(0, s) * 0.3 * speed);
      set('uaR', -0.32 * s * speed + 0.03, 0, 0.08); set('faR', -0.28 - Math.max(0, -s) * 0.3 * speed);
    } else {
      set('uaL', 0.3 * s * speed + 0.03, 0, -0.08); set('faL', -0.3 - Math.max(0, s) * 0.3 * speed);
    }
  };
  if (!seated && !chef) root.userData.walk(0, 0);   // neutral stance
  if (!seated && !chef && holding === 'phone') { set('uaR', -0.32, 0, 0.18); set('faR', -1.55, 0.3); }
  if (holding === 'cig') { set('uaR', -0.2, 0, 0.25); set('faR', -2.2, 0.35); }
  if (umbrellaObj) {
    set('uaR', -0.42, 0, 0.12); set('faR', -1.25, 0.15);
    // grip point in the curled fist (bind-space offset from the wrist), shaft kept world-vertical
    rig.updateMatrixWorld(true);
    const gripW = new THREE.Vector3(0.024, -0.12, 0.0).applyMatrix4(bones.handR.matrixWorld);
    const want = new THREE.Matrix4().compose(gripW.add(new THREE.Vector3(0, 0.33 * H, 0)), new THREE.Quaternion(), new THREE.Vector3(H, H, H));
    const local = new THREE.Matrix4().copy(bones.handR.matrixWorld).invert().multiply(want);
    local.decompose(umbrellaObj.position, umbrellaObj.quaternion, umbrellaObj.scale);
    bones.handR.add(umbrellaObj);
  }
  return root;
}
