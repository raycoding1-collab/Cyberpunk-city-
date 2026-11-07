import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ */
/*  Deterministic randomness: the block looks identical on every load  */
/* ------------------------------------------------------------------ */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) { this.r = mulberry32(seed); }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  chance(p) { return this.r() < p; }
  sign() { return this.r() < 0.5 ? -1 : 1; }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Shared, frame-updated uniforms used across many shaders. */
export const U = {
  time: { value: 0 },
  rain: { value: 1 },
};

/* ------------------------------------------------------------------ */
/*  Transform helper                                                   */
/* ------------------------------------------------------------------ */
const _uvr = mulberry32(777);
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
export function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
/* ------------------------------------------------------------------ */

/** Box whose UVs are in metres (× s) so tiling textures keep real-world scale. */
export function boxGeo(w, h, d, s = 1, ou = 0, ov = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] * s + ou, uv.getY(k) * dims[f][1] * s + ov);
    }
  }
  return g;
}

/** Plane with metre-scaled UVs. */
export function planeGeo(w, h, s = 1, ou = 0, ov = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * s + ou, uv.getY(i) * h * s + ov);
  return g;
}

/** Rounded-rectangle THREE.Shape (centered). */
export function roundRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function roundRectPath(w, h, r) {
  const p = new THREE.Path();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.quadraticCurveTo(x, y, x, y + r);
  p.lineTo(x, y + h - r);
  p.quadraticCurveTo(x, y + h, x + r, y + h);
  p.lineTo(x + w - r, y + h);
  p.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  p.lineTo(x + w, y + r);
  p.quadraticCurveTo(x + w, y, x + w - r, y);
  p.lineTo(x + r, y);
  return p;
}

/** Tube following a catenary between two points (hanging cable). */
export function catenaryCurve(a, b, sag, segments = 24) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

function normalizeGeo(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

/**
 * Collects many small geometries and merges them per material, so a
 * richly detailed facade costs only a handful of draw calls.
 */
export class Batch {
  constructor(name = 'batch') {
    this.name = name;
    this.buckets = new Map();
  }
  add(geo, material, matrix) {
    const g = normalizeGeo(geo);
    if (matrix) g.applyMatrix4(matrix);
    let b = this.buckets.get(material);
    if (!b) { b = []; this.buckets.set(material, b); }
    b.push(g);
    return this;
  }
  /** axis-aligned box, centre at x,y,z, optional rotation about Y */
  box(material, w, h, d, x, y, z, ry = 0, s = 0.5) {
    return this.add(boxGeo(w, h, d, s, _uvr() * 3, _uvr() * 3), material, T(x, y, z, 0, ry, 0));
  }
  boxR(material, w, h, d, x, y, z, rx, ry, rz, s = 0.5) {
    return this.add(boxGeo(w, h, d, s), material, T(x, y, z, rx, ry, rz));
  }
  cyl(material, rt, rb, h, x, y, z, seg = 12, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), material, T(x, y, z, rx, ry, rz));
  }
  /** cylinder spanning two points */
  rod(material, r, a, b, seg = 6) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(g, material, m);
  }
  build(parent, { cast = true, receive = true, name } = {}) {
    const group = new THREE.Group();
    group.name = name || this.name;
    for (const [material, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast && !material.userData.noShadow;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    this.buckets.clear();
    if (parent) parent.add(group);
    return group;
  }
}

/** Instanced mesh from a list of matrices (+ optional colors). */
export function instanced(geo, material, matrices, colors) {
  const m = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((mt, i) => m.setMatrixAt(i, mt));
  if (colors) colors.forEach((c, i) => m.setColorAt(i, c));
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** GLSL noise library injected into several shaders. */
export const GLSL_NOISE = /* glsl */ `
float hash11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash32(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=.5; } return s; }
`;
