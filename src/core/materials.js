import * as THREE from 'three';
import * as TX from './textures.js';

/* =================================================================== */
/*  Shared material library. One instance per surface family keeps    */
/*  draw calls low (geometry is merged per material in Batch).         */
/* =================================================================== */

export const M = {};
const glowCache = new Map();

function std(params, texSet, repeat = 1) {
  const p = { ...params };
  if (texSet) {
    for (const k of ['map', 'roughnessMap', 'bumpMap']) {
      if (texSet[k]) {
        const t = texSet[k].clone();
        t.repeat.set(repeat, repeat);
        t.needsUpdate = true;
        p[k] = t;
      }
    }
  }
  return new THREE.MeshStandardMaterial(p);
}

export function buildMaterials() {
  const concA = TX.concrete({ seed: 11, tone: [0.44, 0.43, 0.42] });
  const concB = TX.concrete({ seed: 12, tone: [0.36, 0.34, 0.33], warm: 1, panels: false });
  const concC = TX.concrete({ seed: 13, tone: [0.27, 0.27, 0.29] });
  const tMint = TX.tiles({ seed: 21, color: [0.42, 0.58, 0.52], cols: 10, rows: 22 });
  const tCream = TX.tiles({ seed: 22, color: [0.74, 0.68, 0.56], cols: 8, rows: 16 });
  const tDark = TX.tiles({ seed: 23, color: [0.07, 0.075, 0.08], cols: 6, rows: 6, grout: [0.02, 0.02, 0.02], vary: 0.2 });
  const tWhite = TX.tiles({ seed: 24, color: [0.8, 0.8, 0.78], cols: 8, rows: 8, grout: [0.4, 0.4, 0.4] });
  const tBrick = TX.tiles({ seed: 25, color: [0.38, 0.17, 0.12], cols: 6, rows: 18, grout: [0.2, 0.19, 0.18], vary: 0.18 });
  const pMint = TX.paintedMetal({ seed: 31, color: [0.36, 0.55, 0.5], rust: 0.55 });
  const pCream = TX.paintedMetal({ seed: 32, color: [0.72, 0.68, 0.58], rust: 0.4 });
  const pRed = TX.paintedMetal({ seed: 33, color: [0.5, 0.1, 0.08], rust: 0.5 });
  const pBlue = TX.paintedMetal({ seed: 34, color: [0.12, 0.22, 0.38], rust: 0.45 });
  const pCorr = TX.paintedMetal({ seed: 35, color: [0.5, 0.52, 0.54], corrugated: true, rust: 0.7 });
  const pCorrO = TX.paintedMetal({ seed: 36, color: [0.62, 0.34, 0.12], corrugated: true, rust: 0.55 });
  const asph = TX.asphalt({ seed: 41 });
  const pav = TX.pavers({ seed: 42 });
  const pav2 = TX.pavers({ seed: 43, n: 8, tone: [0.3, 0.29, 0.28] });
  const tact = TX.tactile();
  const wd = TX.wood({ seed: 51 });
  const wdL = TX.wood({ seed: 52, tone: [0.55, 0.38, 0.22] });

  Object.assign(M, {
    concrete: std({ color: 0xffffff, bumpScale: 2 }, concA, 1),
    concreteWarm: std({ color: 0xffffff, bumpScale: 2 }, concB, 1),
    concreteDark: std({ color: 0xffffff, bumpScale: 2 }, concC, 1),
    tileMint: std({ color: 0xffffff, bumpScale: 1.5 }, tMint, 1),
    tileCream: std({ color: 0xffffff, bumpScale: 1.5 }, tCream, 1),
    tileDark: std({ color: 0xffffff, bumpScale: 1.5 }, tDark, 2),
    tileWhite: std({ color: 0xffffff, bumpScale: 1 }, tWhite, 2),
    brick: std({ color: 0xffffff, bumpScale: 2 }, tBrick, 1),
    paintMint: std({ color: 0xffffff, metalness: 0.35, bumpScale: 1 }, pMint, 1),
    paintCream: std({ color: 0xffffff, metalness: 0.3, bumpScale: 1 }, pCream, 1),
    paintRed: std({ color: 0xffffff, metalness: 0.3, bumpScale: 1 }, pRed, 1),
    paintBlue: std({ color: 0xffffff, metalness: 0.35, bumpScale: 1 }, pBlue, 1),
    corrugated: std({ color: 0xffffff, metalness: 0.5, bumpScale: 3 }, pCorr, 1),
    corrugatedOrange: std({ color: 0xffffff, metalness: 0.4, bumpScale: 3 }, pCorrO, 1),
    asphaltTex: asph,
    paversTex: pav,
    pavers: std({ color: 0xffffff, bumpScale: 1.5 }, pav, 1),
    paversDark: std({ color: 0xffffff, bumpScale: 1.5 }, pav2, 1),
    tactile: std({ color: 0xffffff, bumpScale: 3 }, tact, 1),
    wood: std({ color: 0xffffff, bumpScale: 1 }, wd, 1),
    woodLight: std({ color: 0xffffff, bumpScale: 0.6, roughness: 0.6 }, wdL, 1),

    granite: new THREE.MeshStandardMaterial({ color: 0x55565a, roughness: 0.38, metalness: 0 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.42, metalness: 0.85 }),
    metalBlack: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.5, metalness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.32, metalness: 0.9 }),
    galv: new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.5, metalness: 0.8 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.08, metalness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08a3c, roughness: 0.3, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.85, metalness: 0 }),
    plasticWhite: new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.35, metalness: 0 }),
    plasticGrey: new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.45, metalness: 0 }),
    plasticBlack: new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.3, metalness: 0 }),
    plasticYellow: new THREE.MeshStandardMaterial({ color: 0xe0a800, roughness: 0.4, metalness: 0 }),
    plasticRed: new THREE.MeshStandardMaterial({ color: 0x9a0d12, roughness: 0.4, metalness: 0 }),
    vinylRed: new THREE.MeshStandardMaterial({ color: 0x7a0b10, roughness: 0.25, metalness: 0 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    soil: new THREE.MeshStandardMaterial({ color: 0x1d140d, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x1f4a22, roughness: 0.6, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0x3f7a2c, roughness: 0.55, side: THREE.DoubleSide }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0x7a3a22, roughness: 0.8 }),
    trashBag: new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.18, metalness: 0.1 }),
    trashBagBlue: new THREE.MeshStandardMaterial({ color: 0x24406a, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.92 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.35, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.4, envMapIntensity: 1.6 }),
    glassClear: new THREE.MeshStandardMaterial({ color: 0x9fb3c4, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 2, depthWrite: false }),
    glassFrost: new THREE.MeshStandardMaterial({ color: 0xc9d4d8, roughness: 0.4, metalness: 0, transparent: true, opacity: 0.35 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false }),
  });
  M.glassClear = realGlass({ color: 0xa8b8c4, opacity: 0.08, envMapIntensity: 1.1 }, { droplets: true });
  M.glass = realGlass({ color: 0x0a0f14, opacity: 0.6, envMapIntensity: 1.6 });
  for (const k of Object.keys(M)) if (M[k] && M[k].isMaterial) M[k].name = k;
  M.cable.userData.noShadow = true;
  M.glassClear.userData.noShadow = true;
  return M;
}

/**
 * HDR emissive material (unlit). Intensity > 1 feeds the bloom pass,
 * so neon tubes, LEDs and lit signs glow physically "too bright".
 */
export function glow(hex, intensity = 3, opts = {}) {
  const key = `${hex}_${intensity}_${JSON.stringify(opts)}`;
  if (glowCache.has(key)) return glowCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity), ...opts });
  m.userData.noShadow = true;
  m.userData.baseColor = new THREE.Color(hex);
  m.userData.intensity = intensity;
  glowCache.set(key, m);
  return m;
}

/** Emissive material that still reacts to light (sign faces, LED panels). */
export function litSign(map, intensity = 2, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0x111111, roughness: 0.25, metalness: 0,
    emissive: 0xffffff, emissiveMap: map, emissiveIntensity: intensity,
    map: opts.base || null, ...opts.extra,
  });
}

/* =================================================================== */
/*  Rain weathering, applied to every lit surface after the build:     */
/*  standing water films on ledges, sills and module roofs (mirror-    */
/*  glossy), rivulet streaks running down vertical faces, a darker     */
/*  splash zone at street level, and a general wet sheen.              */
/* =================================================================== */
import { GLSL_NOISE, U } from './utils.js';
const WX_PARS = /* glsl */`
  uniform float uRainW; varying vec3 vWxPos; varying vec3 vWxNrm;
  float wxh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float wxn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(wxh(i), wxh(i + vec2(1, 0)), u.x), mix(wxh(i + vec2(0, 1)), wxh(i + vec2(1, 1)), u.x), u.y); }
`;
export function weatherize(m) {
  if (m.userData.weathered) return;
  m.userData.weathered = true;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey;
  const custom = prevKey !== THREE.Material.prototype.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    sh.uniforms.uRainW = U.rain;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWxPos; varying vec3 vWxNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wxp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wxp = instanceMatrix * wxp;
          #endif
          vWxPos = (modelMatrix * wxp).xyz;
          vWxNrm = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + WX_PARS)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        {
          float wetK = uRainW;
          float up = vWxNrm.y;
          float flatUp = smoothstep(0.78, 0.96, up);
          float film = flatUp * smoothstep(0.25, 0.55, wxn(vWxPos.xz * 2.7) + 0.2) * wetK;
          float vert = 1.0 - smoothstep(0.35, 0.65, abs(up));
          float along = vWxPos.x * 0.83 + vWxPos.z * 0.71;
          float riv = smoothstep(0.6, 0.8, wxn(vec2(along * 5.0, vWxPos.y * 0.22)) * 0.75 + wxn(vec2(along * 13.0, vWxPos.y * 0.6)) * 0.35) * vert * wetK;
          float splash = (1.0 - smoothstep(0.25, 1.0, vWxPos.y)) * vert * wetK;
          diffuseColor.rgb *= 1.0 - 0.35 * film - 0.22 * riv - 0.28 * splash;
          roughnessFactor = mix(roughnessFactor, 0.05, film);
          roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.4, riv);
          roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.6, splash);
          roughnessFactor *= mix(1.0, 0.8, wetK);
        }`);
  };
  m.customProgramCacheKey = function () { return (custom ? prevKey.call(this) : '') + '|wx1'; };
  m.needsUpdate = true;
}
export function weatherizeScene(scene) {
  let n = 0;
  scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const m of [].concat(o.material)) {
      if (!(m.isMeshStandardMaterial) || m.userData.wet || m.userData.noWeather || m.transparent || m.emissiveMap || m.userData.weathered) continue;
      weatherize(m); n++;
    }
  });
  return n;
}

/* =================================================================== */
/*  Physically-behaved glass: reflections are NOT scaled by opacity    */
/*  (premultiplied output), only the view through is attenuated.       */
/*  Optional rain-droplet normal map for shop windows.                 */
/* =================================================================== */
let _dropNormal = null;
export function dropletNormalMap() {
  if (_dropNormal) return _dropNormal;
  const S = 256;
  const h = new Float32Array(S * S);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 230; i++) {
    const cx = rnd() * S, cy = rnd() * S, r = 1.5 + rnd() * rnd() * 7, run = rnd() < 0.08;
    const ry = run ? r * 3.5 : r;
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = (x - cx) / r, dy = (y - cy) / ry, d = dx * dx + dy * dy;
      if (d < 1) { const xx = (x + S) % S, yy = (y + S) % S; h[yy * S + xx] = Math.max(h[yy * S + xx], Math.sqrt(1 - d)); }
    }
  }
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'); const img = x.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const hx = h[y * S + ((xx + 1) % S)] - h[y * S + ((xx - 1 + S) % S)];
    const hy = h[((y + 1) % S) * S + xx] - h[((y - 1 + S) % S) * S + xx];
    const n = new THREE.Vector3(-hx * 2.5, -hy * 2.5, 1).normalize();
    const k = (y * S + xx) * 4;
    img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  _dropNormal = new THREE.CanvasTexture(c);
  _dropNormal.wrapS = _dropNormal.wrapT = THREE.RepeatWrapping;
  _dropNormal.repeat.set(4, 4);
  return _dropNormal;
}
export function realGlass(params = {}, { droplets = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.03, metalness: 0, transparent: true, premultipliedAlpha: true, depthWrite: false, ...params });
  if (droplets) { m.normalMap = dropletNormalMap(); m.normalScale = new THREE.Vector2(0.12, 0.12); }
  m.userData.noWeather = true;
  m.userData.noShadow = true;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <opaque_fragment>', `
        float ga = diffuseColor.a;
        gl_FragColor = vec4(totalDiffuse * ga + totalSpecular + totalEmissiveRadiance, ga);`)
      .replace('#include <premultiplied_alpha_fragment>', '');
  };
  m.customProgramCacheKey = () => 'realglass' + (droplets ? 'd' : '');
  return m;
}
