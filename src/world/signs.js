import * as THREE from 'three';
import { drawCanvas } from '../core/textures.js';
import { M, glow } from '../core/materials.js';
import { U, roundRectShape } from '../core/utils.js';

/* =================================================================== */
/*  Sign painting: light boxes, blade signs, marquee chaser bulbs.     */
/*  Every sign face is painted on a canvas with its own typography.    */
/* =================================================================== */

export const JP = '"IPAGothic", "Noto Sans CJK JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
export const JPM = '"IPAMincho", "Noto Serif CJK JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
export const LAT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

/** Back-lit acrylic face material (emissive canvas, slightly glossy). */
export function faceMaterial(tex, intensity = 1.6) {
  const m = new THREE.MeshStandardMaterial({
    color: 0x080808, roughness: 0.22, metalness: 0, map: null,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: intensity,
  });
  m.userData.noShadow = true;
  return m;
}

/**
 * Double-sided projecting light box (faces ±Z in local space).
 * painter(ctx, w, h) paints the face. Returns a Group, origin at the
 * wall-side mounting edge (box extends toward +X, faces ±Z).
 */
export function lightBox({ w = 0.9, h = 2.4, d = 0.22, px = 140, painter, intensity = 1.6, frame = M.metalDark, bracket = 0.35 }) {
  const g = new THREE.Group();
  const tex = drawCanvas(Math.round(w * px), Math.round(h * px), painter);
  const fm = faceMaterial(tex, intensity);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, d), frame);
  body.position.set(bracket + w / 2, 0, 0);
  body.castShadow = true;
  g.add(body);
  for (const s of [1, -1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fm);
    f.position.set(bracket + w / 2, 0, s * (d / 2 + 0.003));
    if (s < 0) f.rotation.y = Math.PI;
    g.add(f);
  }
  // brackets to the wall
  for (const y of [-h * 0.38, h * 0.38]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bracket + 0.05, 0.05, 0.05), M.galv);
    b.position.set(bracket / 2, y, 0); g.add(b);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03 + Math.hypot(bracket, 0.3)), M.galv);
    s.position.set(bracket * 0.5, y + 0.15, 0); s.rotation.z = Math.atan2(0.3, bracket); s.rotation.y = Math.PI / 2;
    g.add(s);
  }
  g.userData.face = fm;
  return g;
}

/** Instanced chaser bulbs around a rectangle (marquee). */
export function chaser(points, { color = 0xffd27a, r = 0.035, speed = 9, gap = 3, intensity = 7 } = {}) {
  const n = points.length;
  const geo = new THREE.SphereGeometry(r, 8, 6);
  const idx = new Float32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  geo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(color) }, uSpeed: { value: speed }, uGap: { value: gap }, uI: { value: intensity } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute float aIdx; varying float vIdx; uniform float uTime;
      void main(){ vIdx = aIdx; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor; uniform float uSpeed; uniform float uGap; uniform float uI; uniform float uTime; varying float vIdx;
      void main(){ float on = step(0.5, fract((vIdx - uTime * uSpeed) / uGap) ) ;
        vec3 c = uColor * mix(0.12, uI, on);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  mat.uniforms.uTime = U.time;
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  points.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, m); });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function rectPerimeter(w, h, step, z = 0) {
  const pts = [];
  const nx = Math.round(w / step), ny = Math.round(h / step);
  for (let i = 0; i < nx; i++) pts.push(new THREE.Vector3(-w / 2 + (i / nx) * w, h / 2, z));
  for (let i = 0; i < ny; i++) pts.push(new THREE.Vector3(w / 2, h / 2 - (i / ny) * h, z));
  for (let i = 0; i < nx; i++) pts.push(new THREE.Vector3(w / 2 - (i / nx) * w, -h / 2, z));
  for (let i = 0; i < ny; i++) pts.push(new THREE.Vector3(-w / 2, -h / 2 + (i / ny) * h, z));
  return pts;
}

/** Vertical Japanese text helper. */
export function vtext(x, chars, cx, y0, step, font, fill, stroke, lw = 0) {
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  [...chars].forEach((c, i) => {
    if (stroke) { x.lineWidth = lw; x.strokeStyle = stroke; x.strokeText(c, cx, y0 + i * step); }
    x.fillStyle = fill; x.fillText(c, cx, y0 + i * step);
  });
}

/** Rounded-rect helper for canvas. */
export function rr(x, X, Y, W, H, R) {
  x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R);
  x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath();
}

export { glow, roundRectShape };
