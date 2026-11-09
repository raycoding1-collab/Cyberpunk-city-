import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, T, RNG, U } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { Prefab } from '../core/prefabs.js';
import { drawCanvas } from '../core/textures.js';

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
  // kind 0: compact sedan · 1: kei wagon · 2: van — lofted bodies with glasshouse, arches, lights, plates
  const key = 'car' + hex + '_' + kind;
  if (CAR_CACHE.has(key)) return CAR_CACHE.get(key);
  const p = new Prefab('car');
  const paint = carPaint(hex);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x06080c, roughness: 0.04, metalness: 0.3, clearcoat: 1 });
  glass.userData.noWeather = true;
  const trim = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.5, metalness: 0.3 });
  const spec = [
    { L: 4.4, W: keys([[-2.2, 0.66], [-2.05, 0.82], [-1.5, 0.85], [1.4, 0.85], [1.95, 0.8], [2.2, 0.6]]), YB: keys([[-2.2, 0.36], [-1.9, 0.22], [1.8, 0.22], [2.2, 0.32]]),
      YT: keys([[-2.2, 0.6], [-2.05, 0.9], [-1.5, 0.96], [-1.2, 0.94], [1.0, 0.91], [1.8, 0.82], [2.2, 0.64]]),
      g: [-1.3, 1.0], GW: keys([[-1.3, 0.68], [-0.8, 0.75], [0.5, 0.75], [1.0, 0.7]]), GT: keys([[-1.3, 0.96], [-0.75, 1.36], [0.25, 1.4], [0.6, 1.33], [1.0, 0.93]]) },
    { L: 3.4, W: keys([[-1.7, 0.66], [-1.6, 0.74], [1.4, 0.74], [1.7, 0.66]]), YB: keys([[-1.7, 0.34], [-1.5, 0.22], [1.45, 0.22], [1.7, 0.34]]),
      YT: keys([[-1.7, 0.82], [-1.6, 0.98], [1.0, 0.98], [1.45, 0.9], [1.7, 0.7]]),
      g: [-1.6, 1.05], GW: keys([[-1.6, 0.7], [-1.4, 0.72], [0.8, 0.72], [1.05, 0.7]]), GT: keys([[-1.6, 1.62], [-1.4, 1.68], [0.6, 1.66], [1.05, 1.0]]) },
    { L: 4.7, W: keys([[-2.35, 0.8], [-2.25, 0.86], [2.0, 0.86], [2.35, 0.76]]), YB: keys([[-2.35, 0.36], [-2.1, 0.24], [2.0, 0.24], [2.35, 0.34]]),
      YT: keys([[-2.35, 0.95], [-2.25, 1.05], [1.5, 1.05], [2.05, 0.95], [2.35, 0.78]]),
      g: [-2.3, 1.55], GW: keys([[-2.3, 0.82], [1.3, 0.82], [1.55, 0.78]]), GT: keys([[-2.3, 1.95], [-2.2, 2.0], [1.1, 1.98], [1.55, 1.08]]) },
  ][kind];
  const { L, W, YB, YT, GW, GT } = spec;
  p.add(loftGeo(48, 32, -L / 2, L / 2, (xx) => ({ w: W(xx), yb: YB(xx), yt: YT(xx), nt: 3.6, nb: 7 })), paint);
  const gb = (xx) => YT(xx) - 0.02;
  p.add(loftGeo(28, 24, spec.g[0], spec.g[1], (xx) => ({ w: GW(xx), yb: gb(xx), yt: GT(xx), nt: 3.4, nb: 8 }), 0, Math.PI), glass);
  // painted roof skin + pillars over the glass
  const rp = (xx) => ({ w: GW(xx) + 0.006, yb: gb(xx), yt: GT(xx) + 0.006, nt: 3.4, nb: 8 });
  const g0 = spec.g[0], g1 = spec.g[1], span = g1 - g0;
  p.add(loftGeo(20, 10, g0 + span * 0.22, g1 - span * 0.2, rp, Math.PI * 0.3, Math.PI * 0.7), paint);
  for (const px of [g0 + span * 0.12, g0 + span * 0.55, g1 - span * 0.06]) for (const side of [0, Math.PI * 0.72]) p.add(loftGeo(3, 6, px - 0.05, px + 0.05, rp, side + 0.02, side + Math.PI * 0.28), paint);
  // wheels in dark arches
  const wx = L / 2 - (kind === 1 ? 0.55 : 0.78);
  for (const x of [-wx, wx]) for (const sz of [-1, 1]) {
    const z = sz * (W(x) - 0.06);
    p.add(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20), trim, T(x, 0.31, z + sz * 0.005, Math.PI / 2, 0, 0));
    p.add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 22), M.rubber, T(x, 0.3, z - sz * 0.06, Math.PI / 2, 0, 0));
    p.add(new THREE.CylinderGeometry(0.19, 0.19, 0.21, 16), M.chrome, T(x, 0.3, z - sz * 0.06, Math.PI / 2, 0, 0));
    for (let k = 0; k < 5; k++) p.add(new THREE.BoxGeometry(0.035, 0.17, 0.02), trim, T(x, 0.3, z + sz * 0.045, 0, 0, (k / 5) * Math.PI * 2).multiply(T(0, 0.08, 0)));
  }
  // lamps, grille, plates, mirrors, door handles
  const fx = L / 2, yl = YT(fx - 0.15) - 0.1;
  for (const sz of [-1, 1]) {
    p.add(new THREE.BoxGeometry(0.06, 0.09, 0.26), glow(0xeef4ff, 0.7), T(fx - 0.06, yl, sz * (W(fx - 0.1) - 0.2)));
    p.add(new THREE.BoxGeometry(0.06, 0.1, 0.22), glow(0xff1424, 1.4), T(-fx + 0.06, YT(-fx + 0.15) - 0.12, sz * (W(-fx + 0.1) - 0.18)));
    p.add(new THREE.BoxGeometry(0.16, 0.09, 0.05), paint, T(spec.g[0] + span * 0.92, gb(g1) + 0.06, sz * (W(g1) + 0.06)));
    p.add(new THREE.BoxGeometry(0.14, 0.02, 0.02), trim, T(0.2, YT(0.2) - 0.12, sz * (W(0.2) + 0.005)));
  }
  p.add(new THREE.BoxGeometry(0.05, 0.12, Math.max(0.5, W(fx - 0.1) * 0.8)), trim, T(fx - 0.03, yl - 0.08, 0));
  const plate = new THREE.MeshStandardMaterial({ color: kind === 1 ? 0xf4e04a : 0xf2f2ee, roughness: 0.4 });
  p.add(new THREE.BoxGeometry(0.02, 0.17, 0.33), plate, T(fx + 0.005, YB(fx - 0.05) + 0.16, 0));
  p.add(new THREE.BoxGeometry(0.02, 0.17, 0.33), plate, T(-fx - 0.005, YB(-fx + 0.05) + 0.2, 0));
  CAR_CACHE.set(key, p);
  return p;
}
const CAR_CACHE = new Map();

/* ------------------------- lofted body surfaces ------------------------- */
// Superellipse cross-sections swept along X: a continuous, curved, automotive skin.
function loftGeo(nS, nA, x0, x1, prof, a0 = 0, a1 = Math.PI * 2) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nS; i++) {
    const t = i / nS, x = x0 + (x1 - x0) * t, p = prof(x, t);
    const yc = (p.yb + p.yt) / 2, h = (p.yt - p.yb) / 2;
    for (let j = 0; j <= nA; j++) {
      const th = a0 + (a1 - a0) * (j / nA), c = Math.cos(th), s = Math.sin(th);
      const n = s >= 0 ? p.nt : p.nb;
      const z = p.w * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = yc + h * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      pos.push(x, y, z); uv.push(t, j / nA);
    }
  }
  for (let i = 0; i < nS; i++) for (let j = 0; j < nA; j++) {
    const a = i * (nA + 1) + j, b = a + nA + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerp = (a, b, t) => a + (b - a) * t;
// piecewise-smooth key curve
function keys(pts) {
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [xa, ya] = pts[i], [xb, yb] = pts[i + 1];
      if (x <= xb) return lerp(ya, yb, sm(xa, xb, x));
    }
    return pts[pts.length - 1][1];
  };
}

/**
 * Hero hover-car "YAMATO KIRIN-7": lofted coupé body with panel gaps, a
 * tumblehome glasshouse with a painted roof and pillars, four integrated
 * ducted lift fans (14 blades + stators each), segmented LED light bars,
 * projector headlamps, camera mirrors, diffuser, and a lit cabin.
 */
export function hoverCar(world, parent, { x, y, z, ry = 0, color = 0x1b0f2e, accent = 0xff2a6d }) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const B = new Batch('hovercar');
  // panel-gap / character-line map (u: rear→front, v: around the section)
  const gaps = drawCanvas(1024, 512, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 1024, 512);
    c.strokeStyle = '#141414'; c.lineWidth = 2.2;
    for (const vc of [0.0, 0.5]) {           // both flanks (θ≈0 and θ≈π)
      const v = (vv) => ((vc + vv + 1) % 1) * 512;
      c.beginPath(); c.moveTo(0.36 * 1024, v(-0.06)); c.lineTo(0.36 * 1024, v(0.12)); c.lineTo(0.66 * 1024, v(0.12)); c.lineTo(0.68 * 1024, v(-0.06)); c.stroke();
      c.fillStyle = '#202020'; c.fillRect(0.6 * 1024, v(0.07), 26, 5);                       // flush handle
      c.strokeRect(0.17 * 1024, v(0.06), 30, 24);                                         // charge flap
    }
    c.beginPath(); c.moveTo(0.78 * 1024, 0.14 * 512); c.lineTo(0.78 * 1024, 0.36 * 512); c.stroke();   // hood seam
    c.beginPath(); c.moveTo(0.08 * 1024, 0.15 * 512); c.lineTo(0.08 * 1024, 0.35 * 512); c.stroke();   // boot lid
    c.fillStyle = 'rgba(255,255,255,0.0)';
  }, { srgb: true });
  const paint = new THREE.MeshPhysicalMaterial({ color, map: gaps, roughness: 0.22, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.3, sheenColor: new THREE.Color(accent) });
  const trim = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.35, metalness: 0.7 });
  const satin = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.55, metalness: 0.5 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x05070c, roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.78, clearcoat: 1, envMapIntensity: 1.6 });
  glassM.userData.noWeather = true;

  // ---- lower body ----
  const W = keys([[-2.3, 0.62], [-2.15, 0.86], [-1.25, 0.96], [0.2, 0.92], [1.35, 0.9], [2.1, 0.66], [2.36, 0.16]]);
  const YB = keys([[-2.3, 0.34], [-2.0, 0.2], [1.6, 0.18], [2.2, 0.27], [2.36, 0.36]]);
  const YT = keys([[-2.3, 0.52], [-2.15, 0.76], [-1.5, 0.82], [-0.2, 0.8], [1.1, 0.72], [1.9, 0.56], [2.3, 0.46], [2.36, 0.4]]);
  const body = loftGeo(64, 40, -2.3, 2.36, (xx) => ({ w: W(xx), yb: YB(xx), yt: YT(xx), nt: xx > 1.8 ? 2.6 : 3.4, nb: 6 }));
  B.add(body, paint);
  // ---- glasshouse (tumblehome) + painted roof + pillars ----
  const GW = keys([[-1.6, 0.62], [-1.1, 0.72], [0.4, 0.72], [1.15, 0.66]]);
  const GT = keys([[-1.6, 0.86], [-0.85, 1.18], [-0.1, 1.24], [0.45, 1.14], [1.15, 0.8]]);
  const gb = (xx) => YT(xx) - 0.03;
  B.add(loftGeo(40, 32, -1.6, 1.15, (xx) => ({ w: GW(xx), yb: gb(xx), yt: GT(xx), nt: 3.2, nb: 8 }), 0, Math.PI), glassM);
  const roofProf = (xx) => ({ w: GW(xx) + 0.006, yb: gb(xx), yt: GT(xx) + 0.006, nt: 3.2, nb: 8 });
  B.add(loftGeo(30, 12, -1.25, 0.32, roofProf, Math.PI * 0.3, Math.PI * 0.7), paint);
  for (const px of [-1.4, -0.32, 0.95]) {
    const span = px > 0.5 ? [0.9, 1.0] : [px - 0.06, px + 0.06];
    for (const side of [0, Math.PI * 0.72]) B.add(loftGeo(4, 8, span[0], span[1], roofProf, side + 0.02, side + Math.PI * 0.28), paint);
  }
  // accent pinstripe along the shoulder + beltline chrome
  for (const sz of [-1, 1]) {
    const pts = [], pts2 = [];
    for (let i = 0; i <= 24; i++) { const xx = -2.1 + (4.2 * i) / 24; pts.push(new THREE.Vector3(xx, YT(xx) - 0.13, sz * (W(xx) + 0.004))); pts2.push(new THREE.Vector3(xx * 0.62 - 0.22, YT(xx * 0.62 - 0.22) - 0.015, sz * (GW(xx * 0.62 - 0.22) + 0.012))); }
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.006, 4), glow(accent, 4));
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 40, 0.008, 4), M.chrome);
    // camera "mirrors"
    B.add(new RoundedBoxGeometry(0.16, 0.06, 0.07, 2, 0.02), satin, T(0.92, YT(0.92) + 0.06, sz * (W(0.92) + 0.05), 0, 0, -0.1));
    B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), satin, T(0.9, YT(0.92) + 0.02, sz * (W(0.92) + 0.01), Math.PI / 2, 0, 0));
    B.add(new THREE.CircleGeometry(0.015, 10), glow(0x30f0ff, 3), T(0.995, YT(0.92) + 0.06, sz * (W(0.92) + 0.05), 0, Math.PI / 2, 0));
  }
  // ---- ducted lift fans, integrated in nacelles ----
  for (const fx of [-1.5, 1.45]) for (const fz of [-0.84, 0.84]) {
    const cy = 0.24, R = 0.36;
    // shroud: a thin aerofoil ring (lip) over a straight duct wall, faired into the body by a pylon
    const lip = [[R + 0.0, 0.11], [R + 0.035, 0.1], [R + 0.05, 0.07], [R + 0.045, -0.06], [R + 0.02, -0.11], [R - 0.005, -0.1], [R - 0.01, 0.08]].map(([r, y]) => new THREE.Vector2(r, y));
    B.add(new THREE.LatheGeometry(lip, 40), paint, T(fx, cy, fz));
    B.add(new THREE.CylinderGeometry(R - 0.008, R - 0.008, 0.2, 40, 1, true), satin, T(fx, cy, fz));
    B.add(new THREE.TorusGeometry(R - 0.012, 0.006, 5, 40), glow(0x3ad6ff, 1.6), T(fx, cy - 0.09, fz, Math.PI / 2, 0, 0));
    B.add(new THREE.CylinderGeometry(0.06, 0.075, 0.14, 16), trim, T(fx, cy, fz));
    B.add(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), trim, T(fx, cy + 0.07, fz));
    for (let i = 0; i < 14; i++) B.add(new THREE.BoxGeometry(0.27, 0.005, 0.05), satin, T(fx, cy + 0.02, fz, 0, (i / 14) * Math.PI * 2, 0).multiply(T(0.2, 0, 0, 0.45, 0, 0)));
    for (let i = 0; i < 4; i++) B.add(new THREE.BoxGeometry(R * 2 - 0.02, 0.04, 0.01), trim, T(fx, cy - 0.06, fz, 0, (i / 4) * Math.PI + 0.4, 0));
    B.add(new RoundedBoxGeometry(0.42, 0.07, 0.36, 2, 0.03), paint, T(fx * 0.9, cy + 0.12, fz * 0.62, 0, 0, 0));
  }
  // ---- light signature ----
  for (let i = 0; i < 26; i++) { const t = i / 25 - 0.5; const zz = t * 1.18; const xx = 2.3 - Math.abs(t) * 0.22; B.add(new THREE.BoxGeometry(0.02, 0.018, 0.036), glow(0xeaf6ff, 8), T(xx, 0.47 - Math.abs(t) * 0.06, zz, 0, -t * 0.6, 0)); }
  for (const sz of [-1, 1]) {
    B.add(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 20), M.chrome, T(2.2, 0.38, sz * 0.55, 0, 0, Math.PI / 2 - 0.25));
    for (let k = 0; k < 3; k++) B.add(new THREE.SphereGeometry(0.022, 10, 8), glow(0xf2f8ff, 7), T(2.235, 0.38, sz * (0.5 + k * 0.045)));
  }
  for (let i = 0; i < 34; i++) { const t = i / 33 - 0.5; B.add(new THREE.BoxGeometry(0.015, 0.03, 0.04), glow(0xff1030, 6), T(-2.28 - Math.abs(t) * 0.05, 0.64, t * 1.5)); }
  for (const sz of [-1, 1]) B.add(new THREE.BoxGeometry(0.015, 0.025, 0.12), glow(0xf0f0f0, 1.4), T(-2.27, 0.44, sz * 0.5));
  B.add(new THREE.BoxGeometry(0.04, 0.12, 0.44), trim, T(-2.28, 0.47, 0));
  B.add(new THREE.BoxGeometry(0.02, 0.1, 0.4), glow(0xb8ffd8, 1.0), T(-2.30, 0.47, 0));
  for (let i = 0; i < 5; i++) B.add(new THREE.BoxGeometry(0.3, 0.12, 0.012), trim, T(-2.15, 0.27, -0.5 + i * 0.25));
  // shark-fin antenna, wiper, side vents
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0.16, 0); fin.quadraticCurveTo(0.05, 0.03, 0.0, 0.07); fin.lineTo(0, 0);
  B.add(new THREE.ExtrudeGeometry(fin, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), paint, T(-0.95, GT(-0.95), -0.015, 0, Math.PI, 0));
  B.add(new THREE.BoxGeometry(0.02, 0.012, 0.9), trim, T(1.05, YT(1.05) + 0.06, 0.05, 0, 0.15, 0.6));
  for (const sz of [-1, 1]) for (let k = 0; k < 4; k++) B.add(new THREE.BoxGeometry(0.12, 0.012, 0.01), trim, T(1.6, 0.5 - k * 0.035, sz * (W(1.6) + 0.002)));
  // ---- cabin (seen through the glass) ----
  const seat = new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: 0.6 });
  for (const sz of [-0.33, 0.33]) {
    B.add(new RoundedBoxGeometry(0.48, 0.12, 0.46, 2, 0.05), seat, T(-0.55, 0.55, sz));
    B.add(new RoundedBoxGeometry(0.12, 0.6, 0.44, 2, 0.05), seat, T(-0.82, 0.86, sz, 0, 0, -0.25));
    B.add(new RoundedBoxGeometry(0.1, 0.16, 0.26, 2, 0.04), seat, T(-0.95, 1.18, sz, 0, 0, -0.2));
  }
  B.add(new RoundedBoxGeometry(0.3, 0.12, 1.3, 2, 0.04), satin, T(0.42, 0.78, 0));
  B.add(new THREE.BoxGeometry(0.02, 0.09, 0.62), glow(0x30d0ff, 1.8), T(0.28, 0.86, -0.25, 0, 0, 0.6));
  B.add(new THREE.TorusGeometry(0.13, 0.016, 6, 16, Math.PI * 1.2), trim, T(0.18, 0.9, -0.33, 0, Math.PI / 2, -Math.PI * 0.6));
  // underglow panel
  B.add(new THREE.PlaneGeometry(4.0, 1.5), glow(accent, 1.2, { transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), T(0, 0.13, 0, -Math.PI / 2, 0, 0));
  B.build(g);
  parent.add(g);
  const under = new THREE.PointLight(accent, 3.5, 4.5, 1.6); under.position.set(0, -0.05, 0); g.add(under);
  const head = new THREE.SpotLight(0xe8f2ff, 25, 26, 0.38, 0.6, 1.4); head.position.set(2.4, 0.4, 0); head.target.position.set(9, -0.6, 0);
  g.add(head, head.target);
  const y0 = y;
  world.updaters.push((t) => { g.position.y = y0 + Math.sin(t * 1.4) * 0.03; g.rotation.z = Math.sin(t * 0.9) * 0.006; g.rotation.x = Math.sin(t * 1.1) * 0.005; });
  return g;
}
