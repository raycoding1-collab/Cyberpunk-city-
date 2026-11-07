import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, T, RNG, U } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { Prefab } from '../core/prefabs.js';

/* =================================================================== */
/*  Vehicles: parked kei-cars/sedans for the auto-park racks, and the  */
/*  hero hover-car — a lofted, clear-coated wedge on four ducted fans.  */
/* =================================================================== */

const paintCache = new Map();
export function carPaint(hex) {
  if (!paintCache.has(hex)) paintCache.set(hex, new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.32, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 }));
  return paintCache.get(hex);
}

/** Compact parked car (wheel-based, for the parking racks). Origin at floor, faces +X. */
export function parkedCar(hex, kind = 0) {
  const p = new Prefab('car');
  const body = carPaint(hex);
  const glass = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.05, metalness: 0.4 });
  const L = kind === 1 ? 3.4 : 4.3, Wd = 1.7, H = kind === 1 ? 0.75 : 0.62;
  p.add(new RoundedBoxGeometry(L, H, Wd, 3, 0.16), body, T(0, 0.28 + H / 2, 0));
  const cl = kind === 1 ? 2.4 : 2.2, ch = kind === 1 ? 0.75 : 0.5;
  p.add(new RoundedBoxGeometry(cl, ch, Wd - 0.12, 3, 0.18), body, T(kind === 1 ? -0.2 : -0.25, 0.28 + H + ch / 2 - 0.05, 0));
  p.add(new RoundedBoxGeometry(cl - 0.1, ch - 0.12, Wd - 0.06, 2, 0.12), glass, T(kind === 1 ? -0.2 : -0.25, 0.28 + H + ch / 2 - 0.04, 0));
  for (const x of [-L / 2 + 0.7, L / 2 - 0.7]) for (const z of [-Wd / 2 + 0.05, Wd / 2 - 0.05]) {
    p.add(new THREE.CylinderGeometry(0.31, 0.31, 0.2, 18), M.rubber, T(x, 0.31, z, Math.PI / 2, 0, 0));
    p.add(new THREE.CylinderGeometry(0.2, 0.2, 0.21, 12), M.chrome, T(x, 0.31, z, Math.PI / 2, 0, 0));
  }
  p.add(new THREE.BoxGeometry(0.04, 0.08, Wd * 0.8), glow(0xff1020, 1.2), T(-L / 2 - 0.01, 0.28 + H * 0.7, 0));
  p.add(new THREE.BoxGeometry(0.04, 0.06, Wd * 0.7), glow(0xdfefff, 0.6), T(L / 2 + 0.01, 0.28 + H * 0.65, 0));
  return p;
}

/**
 * Hero hover-car "YAMATO KIRIN-7": wedge body lofted from a side profile,
 * glass canopy, four ducted lift fans with glowing rings, light blades.
 */
export function hoverCar(world, parent, { x, y, z, ry = 0, color = 0x1b0f2e, accent = 0xff2a6d }) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const B = new Batch('hovercar');
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0.75, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: new THREE.Color(accent) });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.35, metalness: 0.8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1018, roughness: 0.02, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.72, clearcoat: 1 });
  // side profile (x along length, y up) extruded across the width with a soft bevel
  const s = new THREE.Shape();
  s.moveTo(-2.35, 0.25); s.lineTo(2.2, 0.22); s.quadraticCurveTo(2.5, 0.25, 2.45, 0.42);
  s.lineTo(1.2, 0.72); s.lineTo(-1.9, 0.8); s.quadraticCurveTo(-2.4, 0.78, -2.42, 0.55); s.lineTo(-2.35, 0.25);
  const body = new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 5, curveSegments: 10 });
  body.translate(0, 0, -0.85);
  B.add(body, paint);
  // canopy: a stretched half-capsule
  const can = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  B.add(can, glass, T(-0.35, 0.78, 0, 0, 0, 0, 1.55, 0.55, 0.78));
  B.add(new THREE.TorusGeometry(1, 0.02, 6, 48), trim, T(-0.35, 0.79, 0, Math.PI / 2, 0, 0, 1.55, 0.78, 1));
  // ducted fans
  for (const fx of [-1.55, 1.5]) for (const fz of [-1.18, 1.18]) {
    B.add(new THREE.TorusGeometry(0.42, 0.11, 10, 32), paint, T(fx, 0.3, fz, Math.PI / 2, 0, 0));
    B.add(new THREE.TorusGeometry(0.33, 0.025, 6, 32), glow(0x3ad6ff, 7), T(fx, 0.2, fz, Math.PI / 2, 0, 0));
    B.add(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12), trim, T(fx, 0.3, fz));
    for (let i = 0; i < 7; i++) B.add(new THREE.BoxGeometry(0.3, 0.012, 0.07), trim, T(fx, 0.3, fz, 0, (i / 7) * Math.PI * 2, 0).multiply(T(0.17, 0, 0, 0.35, 0, 0)));
    B.add(new THREE.BoxGeometry(0.5, 0.1, 0.18), trim, T(fx * 0.8, 0.32, fz * 0.75, 0, 0, 0));
  }
  // light blades: front LED bar, rear full-width tail strip, side accent line
  B.add(new THREE.BoxGeometry(0.03, 0.035, 1.5), glow(0xeaf6ff, 9), T(2.47, 0.36, 0));
  B.add(new THREE.BoxGeometry(0.03, 0.05, 1.8), glow(0xff1030, 7), T(-2.55, 0.62, 0));
  for (const sz of [-0.99, 0.99]) B.add(new THREE.BoxGeometry(3.6, 0.018, 0.01), glow(accent, 6), T(0.0, 0.5, sz));
  B.add(new THREE.PlaneGeometry(4.2, 1.6), glow(accent, 1.4, { transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), T(0, 0.1, 0, -Math.PI / 2, 0, 0));
  // license plate (glowing e-ink)
  B.add(new THREE.BoxGeometry(0.02, 0.12, 0.42), glow(0xb8ffd8, 1.2), T(-2.56, 0.4, 0));
  B.build(g);
  parent.add(g);
  // underglow + headlight
  const under = new THREE.PointLight(accent, 3.5, 4.5, 1.6); under.position.set(0, -0.05, 0); g.add(under);
  const head = new THREE.SpotLight(0xe8f2ff, 25, 26, 0.38, 0.6, 1.4); head.position.set(2.5, 0.38, 0); head.target.position.set(9, -0.6, 0);
  g.add(head, head.target);
  const y0 = y;
  world.updaters.push((t) => { g.position.y = y0 + Math.sin(t * 1.4) * 0.035; g.rotation.z = Math.sin(t * 0.9) * 0.008; g.rotation.x = Math.sin(t * 1.1) * 0.006; });
  return g;
}
