import * as THREE from 'three';
import { GLSL_NOISE, U } from './utils.js';

/* =================================================================== */
/*  Interior-mapped windows.                                           */
/*  Each pane ray-marches a fake room behind the glass (walls, floor,  */
/*  ceiling lamp falloff, furniture silhouettes, curtains, blinds,     */
/*  flickering TVs) so every window has real parallax depth while the  */
/*  glass itself stays a reflective PBR surface. One instanced draw.   */
/* =================================================================== */

export const WIN = { PLAIN: 0, SLIDER: 1, RIBBON: 2, SHOP: 3, GRID: 4 };

export class WindowSystem {
  constructor() {
    this.items = [];
    this.brightness = { value: 1.0 };
  }

  /**
   * @param {number} x,y,z  centre of the glass plane (world)
   * @param {number} ry     rotation: outward normal = (sin ry, 0, cos ry)
   */
  add(x, y, z, ry, w, h, { style = WIN.PLAIN, depth = 3.2, lit = 0.55, seed = Math.random() * 1000, tint = 0 } = {}) {
    this.items.push({ x, y, z, ry, w, h, style, depth, lit, seed, tint });
  }

  /** outward helpers for axis-aligned facades */
  static ry(dir) { return { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI }[dir]; }

  build(parent) {
    const n = this.items.length;
    const geo = new THREE.PlaneGeometry(1, 1);
    const aWin = new Float32Array(n * 4);
    const aTint = new Float32Array(n);
    const mat = this.material();
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.items.forEach((it, i) => {
      e.set(0, it.ry, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.w, it.h, 1));
      mesh.setMatrixAt(i, m4);
      aWin.set([it.style, it.depth, it.lit, it.seed], i * 4);
      aTint[i] = it.tint;
    });
    geo.setAttribute('aWin', new THREE.InstancedBufferAttribute(aWin, 4));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 1));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'windows';
    parent.add(mesh);
    this.mesh = mesh;
    return mesh;
  }

  material() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.0, envMapIntensity: 1.2 });
    const bright = this.brightness;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.uniforms.uWinBright = bright;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aWin; attribute float aTint;
          varying vec2 vWinUv; varying vec3 vViewTS; varying vec2 vWinSize; varying vec4 vWin; varying float vTint;`)
        .replace('#include <project_vertex>', `#include <project_vertex>
          {
            mat4 im = modelMatrix * instanceMatrix;
            vec3 Tw = vec3(im[0]); vec3 Bw = vec3(im[1]); vec3 Nw = normalize(vec3(im[2]));
            vWinSize = vec2(length(Tw), length(Bw));
            Tw /= vWinSize.x; Bw /= vWinSize.y;
            vec3 wp = (im * vec4(position, 1.0)).xyz;
            vec3 vd = wp - cameraPosition;
            vViewTS = vec3(dot(vd, Tw), dot(vd, Bw), dot(vd, Nw));
            vWinUv = uv; vWin = aWin; vTint = aTint;
          }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uTime; uniform float uWinBright;
          varying vec2 vWinUv; varying vec3 vViewTS; varying vec2 vWinSize; varying vec4 vWin; varying float vTint;
          ${GLSL_NOISE}
          vec3 roomLight(float h){
            if (h < 0.42) return vec3(1.0, 0.66, 0.36);
            if (h < 0.62) return vec3(1.0, 0.84, 0.64);
            if (h < 0.78) return vec3(0.72, 0.86, 1.0);
            if (h < 0.86) return vec3(0.35, 0.55, 1.0);
            if (h < 0.93) return vec3(1.0, 0.22, 0.62);
            return vec3(0.2, 1.0, 0.82);
          }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          vec3 winEmit = vec3(0.0); float winGlass = 0.0; float winDirt = 0.0;
          {
            vec2 sz = vWinSize;
            vec2 p = vWinUv * sz;
            float style = vWin.x, depth = vWin.y, litP = vWin.z, seed = vWin.w;
            bool ribbon = style > 1.5 && style < 2.5;
            bool shop = style > 2.5 && style < 3.5;
            bool grid = style > 3.5;
            float roomsX = ribbon ? max(1.0, floor(sz.x / 3.4 + 0.5)) : 1.0;
            float roomW = sz.x / roomsX;
            float ri = floor(p.x / roomW);
            vec2 lp = vec2(p.x - ri * roomW, p.y);
            float fw = shop ? 0.04 : 0.055;
            float frame = step(lp.x, fw) + step(roomW - fw, lp.x) + step(p.y, fw * 1.4) + step(sz.y - fw, p.y);
            if (style > 0.5 && style < 1.5) frame += step(abs(lp.x - roomW * 0.5), fw * 0.7);
            if (ribbon) frame += step(abs(p.y - sz.y * 0.8), fw * 0.45) + step(abs(lp.x - roomW * 0.5), fw * 0.35);
            if (grid) { vec2 g = fract(p / vec2(0.5, 0.5)); frame += step(g.x, 0.06) + step(g.y, 0.06); }
            winGlass = 1.0 - clamp(frame, 0.0, 1.0);

            float rs = hash12(vec2(seed * 0.731 + ri * 7.7, seed * 0.113 + ri * 1.9));
            float rs2 = hash12(vec2(rs * 91.7, seed * 0.37 + ri * 1.3));
            float rs3 = hash12(vec2(rs2 * 13.3, rs * 5.1));
            float lit = shop ? 1.0 : step(rs, litP);
            vec3 lc = shop ? vec3(1.0, 0.95, 0.88) : roomLight(rs2);
            if (vTint > 0.5) lc = mix(lc, vTint < 1.5 ? vec3(1.0,0.3,0.7) : vec3(0.3,0.9,1.0), 0.6);
            // TVs & failing tubes
            if (rs2 > 0.78 && rs2 < 0.86) lc *= 0.55 + 0.45 * vnoise(vec2(uTime * 7.0, seed + ri));
            if (rs3 > 0.965) lc *= step(0.25, vnoise(vec2(uTime * 18.0, seed * 3.0)));

            vec3 rd = normalize(vViewTS); rd.z = min(rd.z, -1e-3);
            vec3 ro = vec3(lp, 0.0);
            float sill = shop ? 0.05 : 0.9, head = shop ? 0.4 : 0.35;
            vec3 bmin = vec3(0.0, -sill, -depth), bmax = vec3(roomW, sz.y + head, 0.0);
            vec3 tA = (bmin - ro) / rd, tB = (bmax - ro) / rd;
            vec3 tf = max(tA, tB);
            float t = min(min(tf.x, tf.y), tf.z);
            vec3 hp = ro + rd * t;
            float H = sz.y + head + sill;
            vec3 wallCol = mix(vec3(0.78, 0.72, 0.62), vec3(0.5, 0.58, 0.66), hash11(rs * 31.0));
            wallCol = mix(wallCol, vec3(0.62, 0.66, 0.55), step(0.8, hash11(rs * 17.0)));
            vec3 col;
            float ny = (hp.y + sill) / H;
            if (t == tf.z) {
              float fx = hp.x / roomW;
              col = wallCol;
              // shelf / wardrobe silhouette
              float a0 = 0.08 + 0.4 * rs3, a1 = a0 + 0.18 + 0.25 * rs;
              col *= 1.0 - 0.75 * step(a0, fx) * step(fx, a1) * step(ny, 0.55 + 0.35 * rs2);
              // framed poster / wall screen
              float px0 = 0.55 + 0.2 * rs, py0 = 0.5 + 0.1 * rs3;
              float poster = step(px0, fx) * step(fx, px0 + 0.22) * step(py0, ny) * step(ny, py0 + 0.22);
              col = mix(col, vec3(0.9, 0.3 + rs3 * 0.6, 0.4 + rs * 0.6) * 1.2, poster * step(0.4, rs3));
              // low sofa / bed
              col *= 1.0 - 0.6 * step(ny, 0.28) * step(0.3 * rs2, fx) * step(fx, 0.3 * rs2 + 0.5);
            } else if (t == tf.y) {
              col = rd.y < 0.0 ? wallCol * vec3(0.45, 0.38, 0.32) : wallCol * 1.15;
              // floor planks / ceiling light panel
              if (rd.y < 0.0) col *= 0.85 + 0.15 * step(0.5, fract(hp.x * 3.0));
            } else {
              col = wallCol * 0.82;
              // door frame on side wall
              float dz = -hp.z / depth;
              col *= 1.0 - 0.45 * step(0.55, dz) * step(dz, 0.8) * step(ny, 0.78);
            }
            vec3 lampPos = vec3(roomW * 0.5, sz.y + head - 0.1, -depth * 0.55);
            float dl = length(hp - lampPos);
            float lamp = 1.3 / (1.0 + dl * dl * 0.28);
            float corner = smoothstep(0.0, 0.6, min(min(hp.x, roomW - hp.x), min(hp.y + sill, sz.y + head - hp.y)));
            vec3 interior = col * lc * lamp * (0.55 + 0.45 * corner) * lit;
            interior += col * vec3(0.012, 0.016, 0.03) * (1.0 - lit);
            if (shop) interior *= 1.25;
            // curtains & blinds
            float cur = hash11(rs2 * 17.0 + seed);
            float fxw = lp.x / roomW;
            if (!shop && cur < 0.38) {
              float cl = 0.08 + 0.32 * hash11(rs * 5.0), cr = 0.08 + 0.32 * hash11(rs * 9.0);
              float inC = clamp(step(fxw, cl) + step(1.0 - cr, fxw), 0.0, 1.0);
              vec3 cc = mix(vec3(0.95, 0.62, 0.38), vec3(0.65, 0.78, 0.95), hash11(rs * 3.0));
              cc = mix(cc, vec3(0.9, 0.25, 0.35), step(0.85, hash11(rs * 11.0)));
              float folds = 0.7 + 0.3 * sin(lp.x * 38.0 + sin(lp.y * 3.0));
              interior = mix(interior, cc * lc * (0.5 * lit + 0.008) * folds, inC);
            } else if (!shop && cur < 0.58) {
              float bl = 0.25 + 0.7 * hash11(rs * 7.0);
              float yy = 1.0 - p.y / sz.y;
              if (yy < bl) {
                float slat = smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(p.y * 95.0));
                interior = mix(interior * 0.15, lc * lit * 0.55 * vec3(0.95, 0.92, 0.85), slat * 0.7);
              }
            }
            winDirt = fbm(p * 2.3 + seed) * 0.5 + 0.25 * step(0.6, fbm(p * vec2(4.0, 0.8) + seed));
            winEmit = interior * winGlass * uWinBright;
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb = mix(vec3(0.035, 0.037, 0.04), vec3(0.008), winGlass);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(0.45, 0.03 + winDirt * 0.25, winGlass);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = mix(0.7, 0.0, winGlass);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += winEmit;`);
    };
    mat.customProgramCacheKey = () => 'interior-windows-v1';
    return mat;
  }
}
