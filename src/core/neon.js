import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roundRectShape, U } from './utils.js';
import { drawCanvas } from './textures.js';

/* =================================================================== */
/*  Real bent-glass neon: every glyph is a hand-defined stroke path,   */
/*  swept into a tube with filleted bends, with electrode returns,     */
/*  standoffs, a mounting raceway and a soft light spill on the wall.  */
/* =================================================================== */

const arc = (cx, cy, rx, ry, a0, a1, n = 14) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = THREE.MathUtils.degToRad(a0 + (a1 - a0) * (i / n));
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
};
const ell = (cx, cy, rx, ry, n = 22) => arc(cx, cy, rx, ry, 90, 450, n);

// Glyph grid: 4 wide × 6 tall (y up). [width, strokes[]]
const G = {
  A: [4, [[[0, 0], [0, 4.2], [0.7, 5.5], [2, 6], [3.3, 5.5], [4, 4.2], [4, 0]], [[0, 2.7], [4, 2.7]]]],
  B: [4, [[[0, 3], [0, 6], [2.4, 6], ...arc(2.4, 4.5, 1.5, 1.5, 90, -90, 10), [0, 3]], [[0, 3], [2.6, 3], ...arc(2.6, 1.5, 1.4, 1.5, 90, -90, 10), [0, 0], [0, 3]]]],
  C: [4, [arc(2, 3, 2, 3, 40, 320, 20)]],
  D: [4, [[[0, 0], [0, 6], [1.5, 6], ...arc(1.5, 3, 2.5, 3, 90, -90, 16), [0, 0]]]],
  E: [3.6, [[[3.6, 6], [0, 6], [0, 0], [3.6, 0]], [[0, 3], [2.9, 3]]]],
  F: [3.6, [[[3.6, 6], [0, 6], [0, 0]], [[0, 3], [2.9, 3]]]],
  G: [4, [[...arc(2, 3, 2, 3, 45, 360, 22), [2.1, 3]]]],
  H: [4, [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]]],
  I: [1.2, [[[0.6, 0], [0.6, 6]]]],
  J: [3.6, [[[3.6, 6], ...arc(1.8, 1.7, 1.8, 1.7, 0, -180, 12)]]],
  K: [4, [[[0, 0], [0, 6]], [[4, 6], [0, 2.3]], [[1.4, 3.6], [4, 0]]]],
  L: [3.4, [[[0, 6], [0, 0], [3.4, 0]]]],
  M: [4.6, [[[0, 0], [0, 6], [2.3, 2.4], [4.6, 6], [4.6, 0]]]],
  N: [4, [[[0, 0], [0, 6], [4, 0], [4, 6]]]],
  O: [4, [ell(2, 3, 2, 3, 26)]],
  P: [4, [[[0, 0], [0, 6], [2.4, 6], ...arc(2.4, 4.4, 1.6, 1.6, 90, -90, 12), [0, 2.8]]]],
  Q: [4, [ell(2, 3, 2, 3, 26), [[2.5, 1.3], [4.2, -0.4]]]],
  R: [4, [[[0, 0], [0, 6], [2.4, 6], ...arc(2.4, 4.4, 1.6, 1.6, 90, -90, 12), [0, 2.8]], [[2.1, 2.8], [4, 0]]]],
  S: [4, [[...arc(2, 4.5, 1.9, 1.5, 20, 270, 14), ...arc(2, 1.5, 2, 1.5, 90, -160, 14).slice(1)]]],
  T: [4, [[[0, 6], [4, 6]], [[2, 6], [2, 0]]]],
  U: [4, [[[0, 6], [0, 2], ...arc(2, 2, 2, 2, 180, 360, 12), [4, 6]]]],
  V: [4, [[[0, 6], [2, 0], [4, 6]]]],
  W: [5, [[[0, 6], [1.2, 0], [2.5, 4.2], [3.8, 0], [5, 6]]]],
  X: [4, [[[0, 6], [4, 0]], [[4, 6], [0, 0]]]],
  Y: [4, [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]]],
  Z: [4, [[[0, 6], [4, 6], [0, 0], [4, 0]]]],
  0: [3.6, [ell(1.8, 3, 1.8, 3, 24)]],
  1: [2.6, [[[0.2, 4.8], [1.6, 6], [1.6, 0]]]],
  2: [4, [[...arc(2, 4.2, 2, 1.8, 165, -35, 12), [0, 0], [4, 0]]]],
  3: [4, [[...arc(2, 4.5, 1.8, 1.5, 150, -90, 12), ...arc(2, 1.5, 2, 1.5, 90, -150, 12).slice(1)]]],
  4: [4, [[[3, 0], [3, 6], [0, 1.8], [4, 1.8]]]],
  5: [4, [[[3.8, 6], [0.4, 6], [0.2, 3.3], ...arc(2, 1.9, 2, 1.9, 120, -150, 14)]]],
  6: [4, [ell(2, 1.9, 2, 1.9, 20), [[3.3, 6], [1.4, 4.9], [0.3, 3.2], [0.02, 1.9]]]],
  7: [4, [[[0, 6], [4, 6], [1.4, 0]]]],
  8: [4, [ell(2, 4.6, 1.6, 1.4, 18), ell(2, 1.6, 2, 1.6, 20)]],
  9: [4, [ell(2, 4.1, 2, 1.9, 20), [[3.98, 4.1], [3.7, 2.2], [2.6, 0.6], [0.8, 0]]]],
  '-': [3, [[[0.2, 3], [2.8, 3]]]],
  '.': [1, [[[0.4, 0.05], [0.6, 0.05]]]],
  '!': [1, [[[0.5, 6], [0.5, 1.8]], [[0.5, 0.35], [0.5, 0.05]]]],
  '¥': [4, [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]], [[0.6, 2.6], [3.4, 2.6]], [[0.6, 1.3], [3.4, 1.3]]]],
  '&': [4.2, [[[4, 0], [1, 4.2], ...arc(1.8, 4.8, 1.1, 1.2, 200, -20, 10), [0.4, 1.6], ...arc(1.6, 1.4, 1.4, 1.4, 180, 300, 8), [3.6, 2.6]]]],
  ' ': [2.4, []],
};

// Pictograms (own coordinate frames; height given in grid units)
const ICONS = {
  ramen: {
    w: 10, h: 9.4,
    strokes: [
      [[0, 4], [9, 4]],
      [...arc(4.5, 4, 4.3, 3.4, 185, 355, 18)],
      [[3, 0.3], [6, 0.3]],
      [[5.2, 4.6], [9.4, 9.2]], [[6.2, 4.6], [10, 8.6]],
      [[2.2, 5], [1.7, 6.1], [2.4, 7.2], [1.9, 8.3]],
      [[3.6, 5], [3.1, 6.1], [3.8, 7.2], [3.3, 8.3]],
      [[1, 2.6], [8, 2.6]],
    ],
  },
  koi: (() => {
    const top = [], bot = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const x = t * 9;
      const sway = Math.sin(t * Math.PI * 1.4) * 0.7;
      const w = 1.7 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.9) + 0.12;
      top.push([x, 3 + sway + w]); bot.push([x, 3 + sway - w]);
    }
    const tailBase = [9, 3 + Math.sin(1.4 * Math.PI) * 0.7];
    return {
      w: 12, h: 6.4,
      strokes: [
        [...top.reverse(), [0, 3], ...bot.slice(1).reverse().reverse()],
        [tailBase, [11.6, 5.6], [10.6, 3.2], [12, 0.8], tailBase],
        [[3.4, 5.1], [5.2, 6.2], [6.2, 4.8]],
        [[3.6, 1.4], [4.6, 0.2], [5.6, 1.3]],
        ell(1.4, 3.4, 0.25, 0.25, 8),
      ],
    };
  })(),
  arrow: { w: 7, h: 4, strokes: [[[0, 2], [6.6, 2]], [[4.8, 3.8], [6.6, 2], [4.8, 0.2]]] },
  cocktail: { w: 6, h: 8, strokes: [[[0, 8], [6, 8], [3, 4], [0, 8]], [[3, 4], [3, 0.4]], [[1.4, 0.2], [4.6, 0.2]], [[4.2, 9.2], [3.4, 7]], ell(4.6, 9.6, 0.5, 0.5, 8)] },
  heart: { w: 6, h: 5.6, strokes: [[[3, 0], ...arc(1.5, 4, 1.5, 1.5, -40, 180, 10), [3, 4], ...arc(4.5, 4, 1.5, 1.5, 0, 220, 10), [3, 0]]] },
  cross: { w: 6, h: 6, strokes: [[[2, 0], [4, 0], [4, 2], [6, 2], [6, 4], [4, 4], [4, 6], [2, 6], [2, 4], [0, 4], [0, 2], [2, 2], [2, 0]]] },
};

/** Fillet a polyline's corners so the swept tube bends like heated glass. */
function filletPath(pts2, unit, z = 0, r = 0.28) {
  const v = pts2.map(([x, y]) => new THREE.Vector3(x * unit, y * unit, z));
  const path = new THREE.CurvePath();
  if (v.length < 2) return null;
  let prev = v[0].clone();
  const rad = r * unit;
  for (let i = 1; i < v.length - 1; i++) {
    const a = v[i - 1], b = v[i], c = v[i + 1];
    const d1 = new THREE.Vector3().subVectors(b, a), d2 = new THREE.Vector3().subVectors(c, b);
    const l1 = d1.length(), l2 = d2.length();
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    d1.divideScalar(l1); d2.divideScalar(l2);
    const k = Math.min(rad, l1 * 0.45, l2 * 0.45);
    const p1 = b.clone().addScaledVector(d1, -k), p2 = b.clone().addScaledVector(d2, k);
    if (prev.distanceTo(p1) > 1e-5) path.add(new THREE.LineCurve3(prev.clone(), p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  const last = v[v.length - 1];
  if (prev.distanceTo(last) > 1e-5) path.add(new THREE.LineCurve3(prev, last.clone()));
  return path;
}

/* ---------------------------- Neon shader ----------------------------- */
const neonMaterials = [];
export function neonMaterial(color, intensity = 5, flicker = 0) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uFlicker: { value: flicker },
      uSeed: { value: Math.random() * 100 },
      uOn: { value: 1 },
    }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor; uniform float uIntensity; uniform float uFlicker; uniform float uSeed; uniform float uTime; uniform float uOn;
      varying vec3 vN; varying vec3 vV;
      float h(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        // white-hot core where the tube faces us, saturated toward the glass edge
        vec3 c = uColor * (0.45 + 0.55 * f) + vec3(1.0) * pow(f, 8.0) * 0.6 * max(max(uColor.r, uColor.g), uColor.b);
        float t = floor(uTime * 24.0 + uSeed);
        float fl = 1.0 - uFlicker * step(0.86, h(t)) * (0.6 + 0.4 * h(t + 7.0));
        fl *= 1.0 - uFlicker * 0.5 * step(0.97, h(floor(uTime * 3.0 + uSeed)));
        gl_FragColor = vec4(c * uIntensity * fl * uOn, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  m.uniforms.uTime = U.time;
  m.userData.noShadow = true;
  neonMaterials.push(m);
  return m;
}

/** Layout text/icon strokes in grid units → list of {pts, off} */
function layout(text, icon) {
  const out = [];
  let x = 0;
  if (icon) {
    const ic = ICONS[icon];
    const k = 6 / ic.h;
    ic.strokes.forEach((s) => out.push(s.map(([a, b]) => [a * k, b * k])));
    x = ic.w * k;
    return { strokes: out, width: x };
  }
  const chars = [...text.toUpperCase()];
  chars.forEach((ch, i) => {
    const g = G[ch] || G[' '];
    g[1].forEach((s) => out.push(s.map(([a, b]) => [a + x, b])));
    x += g[0] + (i < chars.length - 1 ? 1.25 : 0);
  });
  return { strokes: out, width: x };
}

/**
 * Builds a complete neon sign.
 * @returns {{group:THREE.Group, width:number, height:number, material:THREE.ShaderMaterial}}
 */
export function neonSign({
  text = '', icon = null, height = 0.6, color = 0xff2a6d, intensity = 6, flicker = 0,
  tube = 0.065, standoff = 0.06, raceway = true, backing = null, halo = 0.5, haloColor = null,
  materials,
}) {
  const unit = height / 6;
  const { strokes, width } = layout(text, icon);
  const W = width * unit;
  const group = new THREE.Group();
  const r = Math.max(0.006, tube * unit);
  const tubes = [], caps = [], posts = [];
  const ox = -W / 2;
  for (const s of strokes) {
    const shifted = s.map(([a, b]) => [a + ox / unit, b]);
    const path = filletPath(shifted, unit, 0);
    if (!path) continue;
    const len = path.getLength();
    if (len < 1e-4) continue;
    tubes.push(new THREE.TubeGeometry(path, Math.max(4, Math.ceil(len / (unit * 0.25))), r, 7, false));
    // electrode returns: glass bends back into the wall, painted black
    for (const e of [path.getPointAt(0), path.getPointAt(1)]) {
      const g = new THREE.CylinderGeometry(r * 1.25, r * 1.25, standoff + r * 2, 8);
      g.rotateX(Math.PI / 2); g.translate(e.x, e.y, -(standoff) / 2);
      caps.push(g);
    }
    // glass tube supports every ~35 cm
    const n = Math.floor(len / 0.35);
    for (let i = 1; i <= n; i++) {
      const p = path.getPointAt(i / (n + 1));
      const g = new THREE.CylinderGeometry(r * 0.5, r * 0.7, standoff, 6);
      g.rotateX(Math.PI / 2); g.translate(p.x, p.y, -standoff / 2 - r);
      posts.push(g);
    }
  }
  const mat = neonMaterial(color, intensity, flicker);
  if (tubes.length) {
    const tm = new THREE.Mesh(mergeGeometries(tubes), mat);
    group.add(tm);
  }
  const dark = materials.metalBlack;
  if (caps.length) group.add(new THREE.Mesh(mergeGeometries(caps), dark));
  if (posts.length) group.add(new THREE.Mesh(mergeGeometries(posts), materials.steel));
  if (raceway) {
    const rw = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, height * 0.12, standoff * 0.9), materials.metalDark);
    rw.position.set(0, height * 0.45, -standoff * 0.6);
    group.add(rw);
  }
  if (backing) {
    const pad = backing.pad ?? height * 0.22;
    const shape = roundRectShape(W + pad * 2, height + pad * 2, backing.radius ?? pad * 0.6);
    const g = new THREE.ExtrudeGeometry(shape, { depth: backing.depth ?? 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
    g.translate(0, height / 2, -standoff - (backing.depth ?? 0.06) - 0.012);
    const bm = new THREE.Mesh(g, backing.material || materials.metalBlack);
    bm.receiveShadow = true;
    group.add(bm);
  }
  if (halo > 0) {
    const pxPerUnit = 22;
    const pw = Math.ceil(width * pxPerUnit + 120), ph = Math.ceil(6 * pxPerUnit + 120);
    const ht = drawCanvas(pw, ph, (x) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, pw, ph);
      x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
      const draw = (lw, blur, a) => {
        x.filter = `blur(${blur}px)`; x.globalAlpha = a; x.lineWidth = lw;
        for (const s of strokes) {
          x.beginPath();
          s.forEach(([a1, b1], i) => { const px = 60 + a1 * pxPerUnit, py = ph - 60 - b1 * pxPerUnit; i ? x.lineTo(px, py) : x.moveTo(px, py); });
          x.stroke();
        }
      };
      draw(18, 26, 0.9); draw(8, 8, 0.7);
      x.filter = 'none'; x.globalAlpha = 1;
    }, { srgb: false });
    const hc = new THREE.Color(haloColor ?? color).multiplyScalar(halo);
    const hm = new THREE.MeshBasicMaterial({ color: hc, map: ht, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
    hm.userData.noShadow = true;
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(pw / pxPerUnit * unit, ph / pxPerUnit * unit), hm);
    hp.position.set(0, height / 2, backing ? -standoff - 0.005 : -standoff - 0.01);
    hp.renderOrder = 2;
    group.add(hp);
  }
  group.userData.neon = mat;
  return { group, width: W, height, material: mat };
}

export function allNeonMaterials() { return neonMaterials; }
