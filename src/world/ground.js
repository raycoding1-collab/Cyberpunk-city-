import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Batch, boxGeo, cbox, T, U, GLSL_NOISE, RNG } from '../core/utils.js';
import { M } from '../core/materials.js';
import { drawCanvas, tex } from '../core/textures.js';
import { L } from './layout.js';

/* =================================================================== */
/*  Rain-soaked ground.                                                */
/*  A planar reflector captures the block upside-down; every wet       */
/*  surface samples it with: procedural puddles (mirror), anisotropic  */
/*  vertical streaks on damp asphalt (the classic neon smear), and     */
/*  animated raindrop ripples that bend both normals and reflections.  */
/* =================================================================== */

export const REFLECT = {
  rt: null,
  worldTexMatrix: new THREE.Matrix4(),
  hidden: [], // meshes sampling the reflection texture (hidden while it renders)
  reflector: null,
  quality: { value: 1 },
};

const WET_PARS = /* glsl */`
  uniform sampler2D tReflect; uniform mat4 uReflMat; uniform float uTime; uniform float uRain;
  uniform float uPuddle; uniform float uWetRefl; uniform float uStreak; uniform float uGutter; uniform float uReflQ;
  varying vec3 vWPos;
  ${GLSL_NOISE}
  vec2 rainRipples(vec2 p, float t){
    vec2 acc = vec2(0.0);
    for (int L = 0; L < 3; L++){
      float fl = float(L);
      vec2 q = p * (1.7 + fl * 0.9) + fl * 17.31;
      vec2 cell = floor(q);
      vec2 h = hash22(cell + fl * 3.7);
      float ph = fract(t * (0.9 + h.y * 0.6) + h.x);
      vec2 c = cell + 0.25 + 0.5 * hash22(cell * 1.3 + 7.1 + floor(t * (0.9 + h.y * 0.6) + h.x));
      vec2 d = q - c; float r = length(d) + 1e-4;
      float x = (r - ph * 0.3) * 38.0;
      float prof = -2.0 * x * exp(-x * x) * (1.0 - ph) * (1.0 - ph);
      acc += (d / r) * prof;
    }
    return acc;
  }
  float puddleMask(vec3 wp){
    float pm = fbm(wp.xz * 0.16 + vec2(3.1, 7.7));
    float p = smoothstep(uPuddle, uPuddle + 0.06, pm);
    // gutters collect water along the kerb
    float g = smoothstep(4.25, 4.95, abs(wp.x)) * step(abs(wp.x), 5.0) * smoothstep(0.32, 0.5, fbm(wp.xz * vec2(0.4, 0.15)));
    return max(p, g * uGutter);
  }
`;

/** Turns a MeshStandardMaterial into a wet, reflective surface. */
export function makeWet(mat, { puddle = 0.55, wetRefl = 0.55, streak = 1, gutter = 0, darken = 0.62 } = {}) {
  mat.userData.wet = { puddle, wetRefl, streak, gutter };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tReflect = { value: REFLECT.rt.texture };
    sh.uniforms.uReflMat = { value: REFLECT.worldTexMatrix };
    sh.uniforms.uTime = U.time;
    sh.uniforms.uRain = U.rain;
    sh.uniforms.uReflQ = REFLECT.quality;
    sh.uniforms.uPuddle = { value: puddle };
    sh.uniforms.uWetRefl = { value: wetRefl };
    sh.uniforms.uStreak = { value: streak };
    sh.uniforms.uGutter = { value: gutter };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + WET_PARS)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float puddle = puddleMask(vWPos) * mix(0.35, 1.0, uRain);
        vec2 rip = rainRipples(vWPos.xz, uTime) * uRain;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(${darken.toFixed(3)}, 0.32, puddle);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor * 0.62, 0.025, puddle);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 nW = normalize(vec3(-rip.x * 0.12 * (0.3 + puddle), 1.0, -rip.y * 0.12 * (0.3 + puddle)));
          vec3 nV = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
          normal = normalize(mix(normal, nV, puddle * 0.85 + 0.1));
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 Vw = normalize(cameraPosition - vWPos);
          float NdV = clamp(Vw.y, 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
          vec4 ruv = uReflMat * vec4(vWPos, 1.0); ruv.w = max(ruv.w, 1e-3);
          vec2 dist = rip * 0.018 * (0.35 + puddle) + (vnoise(vWPos.xz * 9.0) - 0.5) * 0.004 * (1.0 - puddle);
          vec3 sharp = texture2DProj(tReflect, vec4(ruv.xy + dist * ruv.w, ruv.zw)).rgb;
          vec3 blur = vec3(0.0); float ws = 0.0;
          for (int i = -4; i <= 4; i++){
            float fi = float(i); float w = exp(-fi * fi / 8.0);
            vec4 u2 = ruv; u2.xy += (dist + vec2(fi * 0.0016, fi * 0.017) * uStreak * (0.6 + 0.6 * (1.0 - NdV))) * ruv.w;
            blur += texture2DProj(tReflect, u2).rgb * w; ws += w;
          }
          blur /= ws;
          vec3 refl = min(mix(blur, sharp, smoothstep(0.2, 0.9, puddle)), vec3(60.0));
          float amt = mix(uWetRefl * mix(0.5, 1.0, uRain), 0.92, puddle) * F * uReflQ;
          outgoingLight = outgoingLight * (1.0 - amt * 0.6) + refl * amt;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `wet_${puddle}_${wetRefl}_${streak}_${gutter}_${darken}`;
  return mat;
}

function cloneTex(t, r) {
  const c = t.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c;
}

export function buildGround(scene, { reflectScale = 0.5 } = {}) {
  const rw = Math.round(window.innerWidth * reflectScale * Math.min(devicePixelRatio, 1.5));
  const rh = Math.round(window.innerHeight * reflectScale * Math.min(devicePixelRatio, 1.5));
  const geo = new THREE.PlaneGeometry(420, 420);
  const reflector = new Reflector(geo, { textureWidth: rw, textureHeight: rh, clipBias: 0.002, multisample: 0 });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(0, 0, -40);
  reflector.updateMatrixWorld(true);
  REFLECT.rt = reflector.getRenderTarget();
  REFLECT.reflector = reflector;
  const texMat = reflector.material.uniforms.textureMatrix.value;
  const inv = reflector.matrixWorld.clone().invert();
  reflector.material.dispose();

  const A = M.asphaltTex;
  const asphalt = makeWet(new THREE.MeshStandardMaterial({
    map: cloneTex(A.map, 420 / 7), roughnessMap: cloneTex(A.roughnessMap, 420 / 7), bumpMap: cloneTex(A.bumpMap, 420 / 7),
    bumpScale: 2.2, envMapIntensity: 0.25,
  }), { puddle: 0.56, wetRefl: 0.62, streak: 1, gutter: 1 });
  reflector.material = asphalt;
  reflector.receiveShadow = true;
  reflector.renderOrder = -100;

  const orig = reflector.onBeforeRender;
  reflector.onBeforeRender = function (renderer, sc, camera, ...rest) {
    if (REFLECT.quality.value <= 0 || REFLECT.suspend) return;
    for (const m of REFLECT.hidden) m.visible = false;
    orig.call(this, renderer, sc, camera, ...rest);
    for (const m of REFLECT.hidden) m.visible = true;
    REFLECT.worldTexMatrix.multiplyMatrices(texMat, inv);
  };
  scene.add(reflector);

  /* --------------------------- Sidewalks ------------------------------ */
  const walkMat = makeWet(M.pavers.clone(), { puddle: 0.62, wetRefl: 0.42, streak: 0.8 });
  walkMat.envMapIntensity = 0.35;
  const curbMat = makeWet(M.granite.clone(), { puddle: 0.9, wetRefl: 0.5, streak: 0.6, darken: 0.8 });
  const tactMat = M.tactile;
  const B = new Batch('sidewalks');
  const curbB = new Batch('curbs');
  const h = L.curbH;
  const walk = (x0, x1, z0, z1) => {
    const g = cbox(x1 - x0, h, z1 - z0, 0.5, x0 * 0.5, z0 * 0.5, 0.012);
    B.add(g, walkMat, T((x0 + x1) / 2, h / 2, (z0 + z1) / 2));
  };
  // main street sidewalks (gaps for the alley mouth are paved as a driveway apron)
  walk(5.15, 7.5, -32, 45); walk(-7.5, -5.15, -32, 45);
  walk(5.15, 7.5, -130, -44); walk(-7.5, -5.15, -130, -44);
  // cross street
  walk(5.15, 90, -44, -41.65); walk(5.15, 90, -34.35, -32);
  walk(-90, -5.15, -44, -41.65); walk(-90, -5.15, -34.35, -32);
  // kerbs (granite, chamfered by a second thin box)
  const kerb = (x0, x1, z0, z1) => {
    curbB.add(cbox(x1 - x0, h + 0.02, z1 - z0, 0.5, 0, 0, 0.035), curbMat, T((x0 + x1) / 2, (h + 0.02) / 2 - 0.01, (z0 + z1) / 2));
  };
  kerb(5.0, 5.15, -32, 45); kerb(-5.15, -5.0, -32, 45);
  kerb(5.0, 5.15, -130, -44); kerb(-5.15, -5.0, -130, -44);
  kerb(5.0, 90, -41.65, -41.5); kerb(5.0, 90, -34.5, -34.35);
  kerb(-90, -5.0, -41.65, -41.5); kerb(-90, -5.0, -34.5, -34.35);
  // tactile guide strips (tenji blocks) — run parallel to the kerb, warning tiles at crossings
  const tact = (x0, x1, z0, z1) => B.add(boxGeo(x1 - x0, 0.012, z1 - z0, 1 / 0.6), tactMat, T((x0 + x1) / 2, h + 0.006, (z0 + z1) / 2));
  tact(5.7, 6.0, -31.5, 44); tact(-6.0, -5.7, -31.5, 44);
  tact(5.4, 6.6, -31.6, -30.6); tact(-6.6, -5.4, -31.6, -30.6);
  tact(5.4, 6.6, 6.3, 7.1); tact(-6.6, -5.4, 6.3, 7.1);
  const walkGroup = B.build(scene, { cast: false });
  const kerbGroup = curbB.build(scene, { cast: false });
  walkGroup.children.forEach((m) => { if (m.material === walkMat) REFLECT.hidden.push(m); });
  kerbGroup.children.forEach((m) => REFLECT.hidden.push(m));

  // alley floor: poured concrete with a central drainage channel
  const alleyMat = makeWet(M.concreteDark.clone(), { puddle: 0.5, wetRefl: 0.5, streak: 0.9, darken: 0.55 });
  const alley = new THREE.Mesh(boxGeo(L.alley.x1 - 7.5, 0.1, 5, 0.3), alleyMat);
  alley.position.set((7.5 + L.alley.x1) / 2, 0.05, (L.alley.z0 + L.alley.z1) / 2);
  alley.receiveShadow = true;
  scene.add(alley);
  REFLECT.hidden.push(alley);

  buildMarkings(scene);
  buildStreetHardware(scene);
  return { reflector, asphalt };
}

/* ------------------------------ Road paint ------------------------------ */
function paintMaterial(alpha, color = 0xa9a8a2) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.32, metalness: 0, alphaMap: alpha, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 0.6,
  });
}

function wornAlpha(w, h, seed, painter) {
  return drawCanvas(w, h, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.strokeStyle = '#fff';
    painter(x, w, h);
    // wear: knock out speckles and tyre-worn bands
    const r = new RNG(seed);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < w * h * 0.004; i++) {
      x.globalAlpha = r.range(0.2, 0.9);
      x.beginPath(); x.arc(r.range(0, w), r.range(0, h), r.range(0.5, 3.5), 0, 7); x.fill();
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    // re-tint so destination-out holes become black, keep alpha=1 (alphaMap reads green)
    x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  }, { srgb: false });
}

function buildMarkings(scene) {
  const g = new THREE.Group(); g.name = 'markings';
  const flat = (mat, w, d, x, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.004, z); m.receiveShadow = true; g.add(m); return m;
  };
  const line = paintMaterial(wornAlpha(32, 512, 3, (x, w, h) => x.fillRect(4, 0, w - 8, h)));
  line.alphaMap.wrapT = THREE.RepeatWrapping;
  // edge lines
  for (const sx of [-1, 1]) {
    const m = flat(line.clone(), 0.15, 175, sx * 4.7, -42.5);
    m.material.alphaMap = line.alphaMap.clone(); m.material.alphaMap.repeat.set(1, 18); m.material.alphaMap.needsUpdate = true;
  }
  // dashed centre line
  const dash = paintMaterial(wornAlpha(32, 256, 5, (x, w, h) => x.fillRect(4, 0, w - 8, h * 0.5)));
  dash.alphaMap.wrapT = THREE.RepeatWrapping; dash.alphaMap.repeat.set(1, 175 / 10);
  flat(dash, 0.15, 175, 0, -42.5);
  // zebra crossings (Japanese style: bars parallel to traffic)
  const zebra = paintMaterial(wornAlpha(512, 256, 7, (x, w, h) => { for (let i = 0; i < 10; i++) x.fillRect(i * (w / 10) + 6, 0, w / 10 * 0.5, h); }));
  flat(zebra, 9.6, 4, 0, 9);
  flat(zebra, 9.6, 4, 0, -30);
  const zebraX = paintMaterial(wornAlpha(512, 256, 8, (x, w, h) => { for (let i = 0; i < 6; i++) x.fillRect(i * (w / 6) + 6, 0, w / 6 * 0.5, h); }));
  flat(zebraX, 6.6, 4, 9.5, -38, Math.PI / 2);
  flat(zebraX, 6.6, 4, -9.5, -38, Math.PI / 2);
  // stop line + 止まれ (tomare) + crossing-ahead diamond
  flat(line, 4.6, 0.45, -2.45, 12.2);
  const tomare = paintMaterial(wornAlpha(256, 768, 9, (x, w, h) => {
    x.save(); x.translate(w / 2, h / 2); x.scale(1, 2.6);
    x.font = 'bold 150px "IPAGothic", "Noto Sans CJK JP", "Hiragino Sans", "Yu Gothic", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('止', 0, -110); x.fillText('ま', 0, 0); x.fillText('れ', 0, 110);
    x.restore();
  }));
  flat(tomare, 1.6, 4.8, -2.5, 16.4, 0);
  const dia = paintMaterial(wornAlpha(256, 512, 10, (x, w, h) => {
    x.lineWidth = 22; x.beginPath(); x.moveTo(w / 2, 14); x.lineTo(w - 14, h / 2); x.lineTo(w / 2, h - 14); x.lineTo(14, h / 2); x.closePath(); x.stroke();
  }));
  flat(dia, 1.5, 3.6, -2.5, 30);
  flat(dia, 1.5, 3.6, 2.5, -15);
  scene.add(g);
}

/* ---------------- Manholes, storm drains, kerb details ----------------- */
function manholeTextures() {
  // Japanese "design manhole": a koi swirling in a lotus ring.
  const size = 512;
  const paint = (x, mode) => {
    x.fillStyle = mode ? '#808080' : '#2a2b2e'; x.fillRect(0, 0, size, size);
    x.translate(size / 2, size / 2);
    const ring = (r, wdt, c) => { x.strokeStyle = c; x.lineWidth = wdt; x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); };
    ring(246, 14, mode ? '#fff' : '#45474c');
    ring(222, 6, mode ? '#ccc' : '#3a3c40');
    for (let i = 0; i < 48; i++) {
      x.save(); x.rotate((i / 48) * Math.PI * 2);
      x.fillStyle = mode ? '#d0d0d0' : '#3d3f44'; x.fillRect(-4, -236, 8, 12); x.restore();
    }
    // lotus petals
    for (let i = 0; i < 12; i++) {
      x.save(); x.rotate((i / 12) * Math.PI * 2);
      x.fillStyle = mode ? '#b8b8b8' : '#35373b';
      x.beginPath(); x.ellipse(0, -180, 18, 36, 0, 0, 7); x.fill(); x.restore();
    }
    // koi
    x.save(); x.rotate(-0.6);
    x.fillStyle = mode ? '#f0f0f0' : '#4a4d53';
    x.beginPath();
    x.moveTo(-120, 10); x.bezierCurveTo(-60, -70, 60, -80, 110, -10);
    x.bezierCurveTo(130, 10, 140, 30, 170, 60); x.lineTo(150, 0); x.lineTo(180, -50);
    x.bezierCurveTo(140, -20, 120, -30, 110, -10);
    x.bezierCurveTo(60, 60, -60, 70, -120, 10); x.fill();
    x.fillStyle = mode ? '#404040' : '#202124';
    x.beginPath(); x.arc(-80, -6, 8, 0, 7); x.fill();
    for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(-30 + i * 22, 0, 14, 0.3, 2.8); x.strokeStyle = x.fillStyle; x.lineWidth = 3; x.stroke(); }
    x.restore();
    // waves cross-hatch
    x.strokeStyle = mode ? '#9a9a9a' : '#303236'; x.lineWidth = 4;
    for (let i = -4; i <= 4; i++) { x.beginPath(); x.arc(i * 40, 150, 26, Math.PI, 0); x.stroke(); }
    x.font = 'bold 30px sans-serif'; x.fillStyle = mode ? '#e0e0e0' : '#4a4c50'; x.textAlign = 'center';
    x.fillText('下水道  SECTOR-7', 0, 120);
  };
  return {
    map: drawCanvas(size, size, (x) => paint(x, 0)),
    bump: drawCanvas(size, size, (x) => paint(x, 1), { srgb: false }),
  };
}

function buildStreetHardware(scene) {
  const B = new Batch('street-hw');
  const mh = manholeTextures();
  const iron = new THREE.MeshStandardMaterial({ map: mh.map, bumpMap: mh.bump, bumpScale: 4, roughness: 0.38, metalness: 0.75, envMapIntensity: 0.6 });
  const holes = [[-2.2, 4], [2.6, -9], [-1.2, -52], [1.8, 24]];
  for (const [x, z] of holes) {
    const g = new THREE.CylinderGeometry(0.42, 0.42, 0.02, 40);
    B.add(g, iron, T(x, 0.008, z, 0, 0.7 * x, 0));
    B.add(new THREE.TorusGeometry(0.43, 0.02, 6, 40), M.metalDark, T(x, 0.01, z, Math.PI / 2, 0, 0));
  }
  // storm drain grates along the kerb
  const grateT = tex(drawCanvas(128, 64, (x) => {
    x.fillStyle = '#222'; x.fillRect(0, 0, 128, 64);
    x.fillStyle = '#000'; for (let i = 0; i < 12; i++) x.fillRect(6 + i * 10, 6, 5, 52);
  }).image, { repeat: false });
  const grate = new THREE.MeshStandardMaterial({ map: grateT, roughness: 0.45, metalness: 0.8 });
  for (let z = -120; z < 44; z += 11) {
    if (z > -46 && z < -30) continue;
    for (const sx of [-1, 1]) B.add(new THREE.BoxGeometry(0.4, 0.02, 0.9), grate, T(sx * 4.78, 0.006, z + (sx > 0 ? 3 : 0)));
  }
  B.build(scene, { cast: false });
}
