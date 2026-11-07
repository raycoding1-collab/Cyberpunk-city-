import * as THREE from 'three';
import { boxGeo, cbox, autoChamfer, T } from './utils.js';
import { WindowSystem } from './windows.js';

/* =================================================================== */
/*  Wall frames: build real walls with real openings (no painted-on    */
/*  windows). Local frame: u → along the wall (to the right when seen  */
/*  from outside), v → up, w → outward normal.                         */
/* =================================================================== */

const UP = new THREE.Vector3(0, 1, 0);
const NORMALS = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };

export class Frame {
  constructor(dir, ox, oy, oz) {
    this.dir = dir;
    this.n = new THREE.Vector3(...NORMALS[dir]);
    this.t = new THREE.Vector3().crossVectors(UP, this.n);
    this.o = new THREE.Vector3(ox, oy, oz);
    this.ry = WindowSystem.ry(dir);
  }
  /** local (u,v,w) → world Vector3 */
  p(u, v, w = 0) {
    return this.o.clone().addScaledVector(this.t, u).addScaledVector(UP, v).addScaledVector(this.n, w);
  }
  /** matrix placing an object whose local +Z is the outward normal */
  m(u, v, w = 0, rx = 0, rz = 0, s = 1) {
    const p = this.p(u, v, w);
    return T(p.x, p.y, p.z, rx, this.ry, rz, s, s, s);
  }
  /** add a box given in local coords: centre (u,v,w) and size (du,dv,dw) */
  box(batch, mat, u, v, w, du, dv, dw, uvs = 0.5, ch = -1) {
    const p = this.p(u, v, w);
    const c = ch < 0 ? autoChamfer(du, dv, dw) : ch;
    const g = c > 0 ? cbox(du, dv, dw, uvs, (u * 0.37) % 1, (v * 0.21) % 1, c) : boxGeo(du, dv, dw, uvs, (u * 0.37) % 1, (v * 0.21) % 1);
    batch.add(g, mat, T(p.x, p.y, p.z, 0, this.ry, 0));
  }
  /** cylinder along local axis: 'u' | 'v' | 'w' */
  cyl(batch, mat, r, len, u, v, w, axis = 'v', seg = 10) {
    const thin = r < 0.02;
    const g = new THREE.CylinderGeometry(r, r, len, thin ? Math.min(seg, 5) : seg, 1, thin);
    if (axis === 'u') g.rotateZ(Math.PI / 2);
    if (axis === 'w') g.rotateX(Math.PI / 2);
    batch.add(g, mat, this.m(u, v, w));
  }
}

/**
 * Solid wall with rectangular openings.
 * openings: [{u, v, w, h}] (u,v = lower-left corner in wall coords)
 */
export function wallWithOpenings(batch, mat, frame, length, height, thick, openings = [], uvs = 0.5, u0 = 0, v0 = 0) {
  const eps = 1e-4;
  const cuts = new Set([0, length]);
  for (const o of openings) { cuts.add(Math.max(0, o.u)); cuts.add(Math.min(length, o.u + o.w)); }
  const us = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < us.length - 1; i++) {
    const ua = us[i], ub = us[i + 1];
    if (ub - ua < eps) continue;
    const cover = openings.filter((o) => o.u < ub - eps && o.u + o.w > ua + eps).sort((a, b) => a.v - b.v);
    let v = 0;
    const solids = [];
    for (const o of cover) {
      if (o.v > v + eps) solids.push([v, o.v]);
      v = Math.max(v, o.v + o.h);
    }
    if (height > v + eps) solids.push([v, height]);
    for (const [va, vb] of solids) {
      frame.box(batch, mat, u0 + (ua + ub) / 2, v0 + (va + vb) / 2, -thick / 2, ub - ua, vb - va, thick, uvs, 0);
    }
  }
}

/**
 * Convenience: wall + recessed interior-mapped glass + sills + lintels.
 * win: {u, v, w, h, style, depth, lit, seed, inset, sill, frameMat}
 */
export function wallWithWindows(batch, mat, frame, length, height, thick, wins, windowSys, opts = {}) {
  wallWithOpenings(batch, mat, frame, length, height, thick, wins, opts.uvs ?? 0.5, opts.u0 ?? 0, opts.v0 ?? 0);
  const u0 = opts.u0 ?? 0, v0 = opts.v0 ?? 0;
  for (const o of wins) {
    const inset = o.inset ?? 0.14;
    const c = frame.p(u0 + o.u + o.w / 2, v0 + o.v + o.h / 2, -inset);
    const { u, v, w, h, inset: _i, sill: _s, ...extra } = o;
    windowSys.add(c.x, c.y, c.z, frame.ry, o.w, o.h, {
      ...extra,
      style: o.style ?? 0, depth: o.depth ?? 3.2, lit: o.lit ?? 0.55, seed: o.seed ?? (c.x * 13.7 + c.y * 7.1 + c.z * 3.3), tint: o.tint ?? 0, kind: o.kind ?? opts.kind,
    });
    if (o.sill !== false && opts.sillMat) {
      frame.box(batch, opts.sillMat, u0 + o.u + o.w / 2, v0 + o.v - 0.03, 0.03, o.w + 0.1, 0.06, 0.12 + inset);
    }
  }
}
