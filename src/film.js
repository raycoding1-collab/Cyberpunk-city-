import * as THREE from 'three';
import { easeInOut } from './core/utils.js';

/* =================================================================== */
/*  "KOI-TEI": a 45-second cinematic. Each shot is a camera move       */
/*  (Catmull-Rom path for position and look-at, eased), with its own   */
/*  world-time window so trains, ads and holograms hit their marks.    */
/* =================================================================== */

const V = (a) => new THREE.Vector3(...a);
const arc = (c, r0, r1, a0, a1, h0, h1, n = 6) => Array.from({ length: n }, (_, i) => {
  const k = i / (n - 1), a = a0 + (a1 - a0) * k, r = r0 + (r1 - r0) * k;
  return [c[0] + Math.sin(a) * r, h0 + (h1 - h0) * k, c[2] + Math.cos(a) * r];
});

export const FILM = [
  // 1 · establishing: high crane down the neon canyon, maglev line + spire on the vanishing point
  { name: 'establish', dur: 5.5, wt: 6, fov: [42, 46],
    p: [[-1.0, 24, 21], [-1.2, 22.5, 22.5], [-1.5, 20, 25]], t: [[-0.2, 0, 8.5], [0.8, 6, -12], [2.0, 12, -60]] },
  // 2 · koi: orbit at hologram height from the street side; rooftop neon in the foreground
  { name: 'koi', dur: 4.5, wt: 11, fov: [48, 46],
    p: arc([13.6, 0, -4.4], 8.0, 7.2, -1.95, -1.2, 38.3, 38.8), t: [[13.6, 45.0, -4.4], [13.6, 45.4, -4.4]] },
  // 3 · tower: crane down the stacked façade through the cable web
  { name: 'tower', dur: 5, wt: 20, fov: [48, 48],
    p: [[-1.5, 31, 0.5], [-1.2, 20, 3.8], [-0.8, 10, 7.2]], t: [[9.2, 29, -8.5], [9.2, 18, -8], [8.4, 7.8, -6]] },
  // 4 · street: low tracking shot beside a woman crossing under a clear umbrella, the neon street behind her
  { name: 'street', dur: 5, wt: 16.56, fov: [44, 41],
    p: [[-5.4, 0.6, 13.9], [-2.8, 0.66, 13.6], [-0.2, 0.75, 13.2]], t: [[0.6, 1.55, 6.0], [2.6, 1.6, 5.6], [4.6, 1.62, 5.2]] },
  // 5 · ramen: push-in past the lanterns toward the counter
  { name: 'ramen', dur: 4, wt: 30, fov: [46, 42],
    p: [[3.8, 1.5, 7.0], [4.7, 1.52, 5.0], [5.5, 1.55, 3.2]], t: [[10.4, 2.1, -2.2], [10.6, 2.0, -1.9], [10.8, 1.95, -1.6]] },
  // 6 · car: low three-quarter hero orbit, shop light behind
  { name: 'car', dur: 3.5, wt: 40, fov: [40, 40],
    p: [[1.0, 0.5, 2.8], [0.2, 0.55, 0.8], [-0.1, 0.65, -1.4]], t: [[3.6, 0.85, -2.5], [3.6, 0.85, -2.6], [3.6, 0.8, -2.8]] },
  // 7 · alley: slow dolly down the back alley toward the street glow
  { name: 'alley', dur: 4, wt: 50, fov: [54, 52],
    p: [[23.4, 1.6, 7.6], [22.0, 1.7, 7.3], [20.4, 1.8, 7.0]], t: [[9.6, 4.4, 4.8], [9.4, 4.9, 4.7], [9.2, 5.4, 4.6]] },
  // 8 · screen: tilt up from the konbini to the screen as the ad glitches
  { name: 'screen', dur: 3.5, wt: 59.3, fov: [52, 50],
    p: [[3.4, 5.0, -4.0], [3.3, 5.4, -6.0], [3.2, 5.8, -8.0]], t: [[-7, 11.5, -12], [-7, 16, -15], [-7, 21.5, -17]] },
  // 9 · maglev: low angle under the guideway as the train crosses
  { name: 'maglev', dur: 4, wt: 3.9, fov: [37, 35],
    p: [[1.8, 2.3, -18.6], [1.4, 2.5, -19.4], [1.0, 2.7, -20.2]], t: [[-1.5, 17.4, -38], [-1.2, 17.7, -38], [-0.9, 18.0, -38]] },
  // 10 · finale: from the crosswalk, crane up past the façade over the shophouse roofs to the koi
  { name: 'finale', dur: 6, wt: 72, fov: [44, 42],
    p: [[-1.0, 1.7, 16], [-5.5, 12, 12], [-13, 31, 3]], t: [[6.0, 6.0, -6], [9.0, 22, -7], [12.0, 42, -6]] },
];

const curves = FILM.map((s) => ({
  p: s.p.length > 1 ? new THREE.CatmullRomCurve3(s.p.map(V)) : null,
  t: s.t.length > 1 ? new THREE.CatmullRomCurve3(s.t.map(V)) : null,
}));

export const FILM_DURATION = FILM.reduce((a, s) => a + s.dur, 0);

/** time (s) → { shot index, local 0..1, world time, camera pos, target, fov } */
export function filmAt(time, out = {}) {
  let acc = 0;
  for (let i = 0; i < FILM.length; i++) {
    const s = FILM[i];
    if (time < acc + s.dur || i === FILM.length - 1) {
      const local = Math.min(1, Math.max(0, (time - acc) / s.dur));
      const e = s.name === 'koi' ? local : easeInOut(local) * 0.8 + local * 0.2;
      out.index = i; out.name = s.name; out.local = local; out.shotTime = time - acc;
      out.world = s.wt + (time - acc);
      out.pos = curves[i].p.getPoint(e);
      out.target = curves[i].t.getPoint(e);
      out.fov = s.fov[0] + (s.fov[1] - s.fov[0]) * e;
      return out;
    }
    acc += s.dur;
  }
  return out;
}
