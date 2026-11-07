import * as THREE from 'three';
import { GLSL_NOISE, U, mulberry32 } from './utils.js';

/* =================================================================== */
/*  Windows as built objects.                                          */
/*                                                                     */
/*  Geometry (instanced, real 3-D): outer frame, two sliding sashes on */
/*  separate tracks (one often slid open), meeting-rail crescent lock, */
/*  transoms / mullions / muntins, sill flashing, insect-screen frames,*/
/*  bathroom grilles and amado storm-shutter boxes.                    */
/*                                                                     */
/*  Glass (one instanced plane per window): interior-mapped rooms with */
/*  eight room types (living, bedroom, kitchen, office, storage,       */
/*  stair, shop, bath), four lamp types, TV / monitor / bedside light, */
/*  occupants, sill clutter, six curtain types and seven glass types   */
/*  (clear, wired, frosted, tinted, taped, covered, grimy+stickers),   */
/*  plus rain droplets that refract the room behind them.              */
/* =================================================================== */

export const WIN = { PLAIN: 0, SLIDER: 1, RIBBON: 2, SHOP: 3, GRID: 4 };

// weighted pickers per building "kind"
const KINDS = {
  res: {
    frame: [[0, 40], [1, 18], [2, 26], [3, 8], [4, 8]],
    glass: [[0, 52], [1, 14], [2, 8], [4, 4], [5, 6], [6, 16]],
    room: [[0, 33], [1, 25], [2, 19], [4, 8], [7, 9], [5, 6]],
    curtain: [[0, 18], [1, 24], [2, 14], [3, 16], [4, 12], [6, 16]],
    lamp: [[0, 50], [1, 22], [2, 14], [3, 14]],
  },
  office: {
    frame: [[3, 55], [0, 45]], glass: [[3, 55], [0, 33], [6, 12]], room: [[3, 82], [4, 10], [5, 8]],
    curtain: [[0, 35], [5, 35], [4, 30]], lamp: [[1, 92], [3, 8]],
  },
  hotel: {
    frame: [[0, 50], [1, 50]], glass: [[0, 70], [3, 20], [6, 10]], room: [[1, 80], [7, 10], [0, 10]],
    curtain: [[1, 50], [2, 30], [3, 20]], lamp: [[2, 50], [0, 30], [3, 20]],
  },
  shop: { frame: [[0, 50], [3, 50]], glass: [[0, 100]], room: [[6, 100]], curtain: [[0, 100]], lamp: [[1, 100]] },
  stair: { frame: [[0, 60], [4, 40]], glass: [[1, 70], [0, 30]], room: [[5, 100]], curtain: [[0, 100]], lamp: [[1, 100]] },
};
const FRAME_COLORS = [0xb9bdc2, 0x4b3b2b, 0xe9e7e1, 0x1c1c1f, 0x3d5c4c];
const FRAME_METAL = [true, true, false, true, false];

function pick(r, table) {
  let s = 0; for (const [, w] of table) s += w;
  let x = r() * s;
  for (const [v, w] of table) { x -= w; if (x <= 0) return v; }
  return table[table.length - 1][0];
}

export class WindowSystem {
  constructor() {
    this.items = [];
    this.brightness = { value: 1.0 };
  }

  /**
   * @param {number} x,y,z  centre of the glass plane (world)
   * @param {number} ry     rotation: outward normal = (sin ry, 0, cos ry)
   * opts: style, depth (room depth), lit (probability), seed, tint, kind, frame, glass, room,
   *       grille (bool|undefined = random), shutter, screen, flashing (default true)
   */
  add(x, y, z, ry, w, h, opts = {}) {
    this.items.push({ x, y, z, ry, w, h, ...opts, style: opts.style ?? WIN.PLAIN, depth: opts.depth ?? 3.2, lit: opts.lit ?? 0.55, seed: opts.seed ?? Math.random() * 1000, tint: opts.tint ?? 0 });
  }

  static ry(dir) { return { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI }[dir]; }

  build(parent) {
    const n = this.items.length;
    const geo = new THREE.PlaneGeometry(1, 1);
    const aWin = new Float32Array(n * 4), aWin2 = new Float32Array(n * 4), aWin3 = new Float32Array(n * 4), aTint = new Float32Array(n);
    const glassMesh = new THREE.InstancedMesh(geo, this.material(), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const bars = { metal: [], paint: [] };
    const screens = [];
    const R = new THREE.Matrix4();
    const addBar = (it, base, cx, cy, cz, sx, sy, sz, colorHex, metal) => {
      const lm = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
      (metal ? bars.metal : bars.paint).push({ m: new THREE.Matrix4().multiplyMatrices(base, lm), c: colorHex });
    };

    this.items.forEach((it, i) => {
      const r = mulberry32(Math.floor(Math.abs(it.seed) * 1000) + 17);
      const kind = KINDS[it.kind || (it.style === WIN.SHOP ? 'shop' : 'res')] || KINDS.res;
      const style = it.style;
      let room = it.room ?? pick(r, kind.room);
      let glass = it.glass ?? pick(r, kind.glass);
      let curtain = it.curtain ?? pick(r, kind.curtain);
      const lamp = it.lamp ?? pick(r, kind.lamp);
      const frameT = it.frame ?? pick(r, kind.frame);
      if (room === 7) { glass = 2; curtain = 0; }
      if (room === 5) curtain = 0;
      if (glass === 2 && curtain !== 0 && r() < 0.7) curtain = 0;
      if (style === WIN.SHOP) { room = it.room ?? 6; curtain = 0; }
      if (it.tint) { room = it.room ?? 0; curtain = 0; glass = 0; }
      const isRes = !it.kind || it.kind === 'res' || it.kind === 'hotel';
      const open = style === WIN.SLIDER && isRes && glass !== 5 && r() < 0.32 ? 0.18 + r() * 0.3 : 0;
      let flags = 0;
      if (r() < 0.06) flags |= 1;                       // occupant
      if (isRes && r() < 0.28) flags |= 2;              // sill clutter
      const screen = it.screen ?? (style === WIN.SLIDER && isRes && r() < 0.55);
      if (screen) flags |= 4;
      if (r() < 0.5) flags |= 8;                        // heavier droplets / condensation

      e.set(0, it.ry, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.w, it.h, 1));
      glassMesh.setMatrixAt(i, m4);
      aWin.set([style, it.depth, it.lit, it.seed], i * 4);
      aWin2.set([glass, room, open, curtain], i * 4);
      aWin3.set([lamp, flags, it.kind === 'office' ? 1 : 0, r()], i * 4);
      aTint[i] = it.tint;

      // ---------------------------- frames ----------------------------
      if (it.frames === false) return;
      R.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(1, 1, 1));
      const W = it.w, H = it.h, hw = W / 2, hh = H / 2;
      const col = FRAME_COLORS[frameT], metal = FRAME_METAL[frameT];
      const shop = style === WIN.SHOP;
      const fw = shop ? 0.04 : 0.05, fd = shop ? 0.06 : 0.075, fz = 0.012;
      // outer frame (head, sill rail, jambs)
      addBar(it, R, 0, hh - fw / 2, fz, W, fw, fd, col, metal);
      addBar(it, R, 0, -hh + fw / 2, fz, W, fw * 1.1, fd, col, metal);
      addBar(it, R, -hw + fw / 2, 0, fz, fw, H, fd, col, metal);
      addBar(it, R, hw - fw / 2, 0, fz, fw, H, fd, col, metal);
      // sill flashing with drip edge
      if (it.flashing !== false && !shop) {
        addBar(it, R, 0, -hh - 0.012, 0.055, W + 0.05, 0.018, 0.11, col, metal);
        addBar(it, R, 0, -hh - 0.028, 0.108, W + 0.05, 0.03, 0.008, col, metal);
      }
      const sw = 0.034, sd = 0.028;
      const sash = (x0, x1, y0, y1, z) => {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ww = x1 - x0, hh2 = y1 - y0;
        addBar(it, R, cx, y1 - sw / 2, z, ww, sw, sd, col, metal);
        addBar(it, R, cx, y0 + sw / 2, z, ww, sw, sd, col, metal);
        addBar(it, R, x0 + sw / 2, cy, z, sw, hh2, sd, col, metal);
        addBar(it, R, x1 - sw / 2, cy, z, sw, hh2, sd, col, metal);
      };
      const ix0 = -hw + fw, ix1 = hw - fw, iy0 = -hh + fw, iy1 = hh - fw;
      if (style === WIN.SLIDER) {
        const mid = (ix0 + ix1) / 2, ov = 0.025;
        const slide = open * (ix1 - ix0);
        sash(ix0, mid + ov, iy0, iy1, 0.03);                      // outer track
        sash(mid - ov - slide, ix1 - slide, iy0, iy1, 0.0);      // inner track (slid)
        // crescent lock on the meeting rail
        addBar(it, R, mid + ov - 0.02 - (slide > 0 ? 0 : 0), 0.0, 0.05, 0.03, 0.06, 0.02, 0x9a9da2, true);
        // insect screen frame over the open side
        if (screen) {
          const s0 = mid - ov, s1 = ix1;
          const sx = slide > 0.05 ? ix1 - slide - 0.02 : s0;
          const zz = 0.06;
          addBar(it, R, (sx + s1) / 2, iy1 - 0.015, zz, s1 - sx, 0.03, 0.015, 0x6a6e72, true);
          addBar(it, R, (sx + s1) / 2, iy0 + 0.015, zz, s1 - sx, 0.03, 0.015, 0x6a6e72, true);
          addBar(it, R, sx + 0.015, 0, zz, 0.03, iy1 - iy0, 0.015, 0x6a6e72, true);
          screens.push({ R: R.clone(), x0: sx, x1: s1, y0: iy0, y1: iy1, z: zz });
        }
      } else if (style === WIN.RIBBON) {
        const rooms = Math.max(1, Math.round(W / 3.4));
        const rw = W / rooms;
        for (let k = 1; k < rooms; k++) addBar(it, R, -hw + k * rw, 0, fz, 0.07, H, fd, col, metal);
        for (let k = 0; k < rooms; k++) {
          const c = -hw + (k + 0.5) * rw;
          addBar(it, R, c, 0, fz * 0.5, 0.04, H, fd * 0.7, col, metal);
          addBar(it, R, c, hh - H * 0.22, fz * 0.5, rw, 0.04, fd * 0.7, col, metal);
        }
      } else if (style === WIN.SHOP) {
        const n2 = Math.max(1, Math.round(W / 1.6));
        for (let k = 1; k < n2; k++) addBar(it, R, -hw + (k * W) / n2, 0, fz, 0.045, H, fd, col, metal);
      } else if (style === WIN.GRID) {
        for (let x = ix0 + 0.42; x < ix1 - 0.1; x += 0.42) addBar(it, R, x, 0, 0.005, 0.022, iy1 - iy0, 0.03, col, metal);
        for (let y = iy0 + 0.4; y < iy1 - 0.1; y += 0.4) addBar(it, R, 0, y, 0.005, ix1 - ix0, 0.022, 0.03, col, metal);
      } else {
        // PLAIN: fixed lower light + top-hung awning vent on some
        if (H > 0.9 && r() < 0.55) {
          const ty = iy1 - Math.min(0.42, H * 0.3);
          addBar(it, R, 0, ty, fz, ix1 - ix0, 0.045, fd, col, metal);
          sash(ix0 + 0.01, ix1 - 0.01, ty + 0.025, iy1, 0.02);
        }
      }
      // bathroom / kitchen grille (面格子)
      const grille = it.grille ?? (isRes && (room === 7 || room === 2) && W < 2.2 && r() < 0.75);
      if (grille) {
        const gz = 0.16, gc = r() < 0.5 ? 0xb9bdc2 : 0x5a4a3a;
        addBar(it, R, 0, hh + 0.02, gz, W + 0.1, 0.04, 0.05, gc, true);
        addBar(it, R, 0, -hh - 0.02, gz, W + 0.1, 0.04, 0.05, gc, true);
        for (let x = -hw + 0.06; x <= hw - 0.05; x += 0.105) addBar(it, R, x, 0, gz, 0.022, H + 0.04, 0.03, gc, true);
        for (const x of [-hw - 0.02, hw + 0.02]) for (const y of [hh - 0.1, -hh + 0.1]) addBar(it, R, x, y, gz / 2, 0.03, 0.03, gz, gc, true);
      }
      // amado storm-shutter box (戸袋) beside residential sliders
      const shutter = it.shutter ?? (style === WIN.SLIDER && isRes && !grille && W < 2.6 && r() < 0.22);
      if (shutter) {
        const side = r() < 0.5 ? -1 : 1;
        const bw = Math.min(0.9, W * 0.5);
        const bx = side * (hw + bw / 2 + 0.03);
        const sc = r() < 0.6 ? 0xb9bdc2 : 0x8a7b62;
        addBar(it, R, bx, 0, 0.12, bw, H + 0.12, 0.2, sc, true);
        addBar(it, R, 0, hh + 0.04, 0.12, W + bw + 0.1, 0.05, 0.2, sc, true);   // top rail
        // one shutter panel partly drawn across
        const drawn = r() < 0.5 ? r() * 0.6 : 0;
        if (drawn > 0.05) {
          const pw = W * drawn;
          addBar(it, R, side * (hw - pw / 2), 0, 0.1, pw, H, 0.02, sc, true);
          for (let y = -hh + 0.1; y < hh; y += 0.12) addBar(it, R, side * (hw - pw / 2), y, 0.112, pw, 0.012, 0.006, 0x8f9397, true);
        }
      }
    });

    const aw = [['aWin', aWin], ['aWin2', aWin2], ['aWin3', aWin3]];
    for (const [k, arr] of aw) geo.setAttribute(k, new THREE.InstancedBufferAttribute(arr, 4));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 1));
    glassMesh.instanceMatrix.needsUpdate = true;
    glassMesh.computeBoundingSphere();
    glassMesh.receiveShadow = true;
    glassMesh.name = 'windows-glass';
    parent.add(glassMesh);

    // frame instancing: metal (anodised alu / bronze / black) + painted (white PVC / old green)
    const box = new THREE.BoxGeometry(1, 1, 1);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.75, roughness: 0.38 });
    const paintMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.05, roughness: 0.42 });
    const tmpC = new THREE.Color();
    for (const [list, mat, name] of [[bars.metal, metalMat, 'frames-metal'], [bars.paint, paintMat, 'frames-paint']]) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(box, mat, list.length);
      list.forEach((b, k) => { im.setMatrixAt(k, b.m); im.setColorAt(k, tmpC.setHex(b.c)); });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true; im.name = name;
      parent.add(im);
    }
    // insect screens: fine grey mesh you can see the room through
    if (screens.length) {
      const mesh = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; for (let i = 0; i < 64; i += 4) { x.fillRect(i, 0, 1, 64); x.fillRect(0, i, 64, 1); } return c; })());
      mesh.wrapS = mesh.wrapT = THREE.RepeatWrapping; mesh.repeat.set(30, 30);
      const sm = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.55, alphaMap: mesh, depthWrite: false });
      const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), sm, screens.length);
      screens.forEach((s, k) => {
        const lm = new THREE.Matrix4().compose(new THREE.Vector3((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.z), new THREE.Quaternion(), new THREE.Vector3(s.x1 - s.x0, s.y1 - s.y0, 1));
        im.setMatrixAt(k, new THREE.Matrix4().multiplyMatrices(s.R, lm));
      });
      im.computeBoundingSphere(); im.name = 'insect-screens';
      parent.add(im);
    }
    this.mesh = glassMesh;
    return glassMesh;
  }

  material() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.0, envMapIntensity: 1.25 });
    const bright = this.brightness;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.uniforms.uRain = U.rain;
      sh.uniforms.uWinBright = bright;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aWin; attribute vec4 aWin2; attribute vec4 aWin3; attribute float aTint;
          varying vec2 vWinUv; varying vec3 vViewTS; varying vec2 vWinSize; varying vec4 vWin; varying vec4 vWin2; varying vec4 vWin3; varying float vTint;
          varying vec3 vTv; varying vec3 vBv;`)
        .replace('#include <project_vertex>', `#include <project_vertex>
          {
            mat4 im = modelMatrix * instanceMatrix;
            vec3 Tw = vec3(im[0]); vec3 Bw = vec3(im[1]); vec3 Nw = normalize(vec3(im[2]));
            vWinSize = vec2(length(Tw), length(Bw));
            Tw /= vWinSize.x; Bw /= vWinSize.y;
            vec3 wp = (im * vec4(position, 1.0)).xyz;
            vec3 vd = wp - cameraPosition;
            vViewTS = vec3(dot(vd, Tw), dot(vd, Bw), dot(vd, Nw));
            vTv = normalize((viewMatrix * vec4(Tw, 0.0)).xyz); vBv = normalize((viewMatrix * vec4(Bw, 0.0)).xyz);
            vWinUv = uv; vWin = aWin; vWin2 = aWin2; vWin3 = aWin3; vTint = aTint;
          }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uTime; uniform float uRain; uniform float uWinBright;
          varying vec2 vWinUv; varying vec3 vViewTS; varying vec2 vWinSize; varying vec4 vWin; varying vec4 vWin2; varying vec4 vWin3; varying float vTint;
          varying vec3 vTv; varying vec3 vBv;
          ${GLSL_NOISE}
          float box2(vec2 p, vec2 a, vec2 b){ return step(a.x, p.x) * step(p.x, b.x) * step(a.y, p.y) * step(p.y, b.y); }
          float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
          // ---- one room, shaded at the hit point -------------------------------------------------
          vec3 roomShade(vec3 hp, float face, float roomW, float H, float sill, float depth, float rt, float lt, vec3 lc,
                         float lit, float rs, float rs2, float rs3, float tvOn, float seed, out vec3 glowAdd){
            glowAdd = vec3(0.0);
            float fx = hp.x / roomW, fy = (hp.y + sill) / H, fz = -hp.z / depth;
            vec3 wall = mix(vec3(0.78, 0.73, 0.64), vec3(0.62, 0.66, 0.68), rs3);
            if (rt > 2.5 && rt < 3.5) wall = vec3(0.7, 0.72, 0.74);
            if (rt > 3.5 && rt < 5.5) wall = vec3(0.42, 0.43, 0.42);
            if (rt > 6.5) wall = vec3(0.72, 0.8, 0.84);
            vec3 c = wall;
            // ---------------- back wall content ----------------
            if (face < 0.5) {
              if (rt < 0.5) {                              // living
                float s0 = 0.08 + 0.3 * rs2;
                float sofa = box2(vec2(fx, fy), vec2(s0, 0.0), vec2(s0 + 0.45, 0.27));
                c = mix(c, mix(vec3(0.16, 0.14, 0.13), vec3(0.32, 0.12, 0.1), rs) * (0.85 + 0.15 * sin(fx * 60.0)), sofa);
                float cush = box2(vec2(fx, fy), vec2(s0 + 0.03, 0.2), vec2(s0 + 0.42, 0.3)) * step(0.5, fract(fx * 7.0 + rs));
                c = mix(c, vec3(0.55, 0.45, 0.3), cush * 0.6);
                float tv0 = 0.6 - 0.25 * rs3;
                float stand = box2(vec2(fx, fy), vec2(tv0 - 0.02, 0.0), vec2(tv0 + 0.26, 0.18));
                c = mix(c, vec3(0.12, 0.09, 0.07), stand);
                float scr = box2(vec2(fx, fy), vec2(tv0, 0.26), vec2(tv0 + 0.24, 0.42));
                vec3 tvc = mix(vec3(0.35, 0.55, 1.0), vec3(1.0, 0.6, 0.4), vnoise(vec2(uTime * 0.7, seed))) * (0.6 + 0.5 * vnoise(vec2(uTime * 9.0, seed)));
                c = mix(c, vec3(0.02), scr);
                glowAdd += tvc * 1.6 * scr * tvOn;
                float shelf = box2(vec2(fx, fy), vec2(0.86, 0.25), vec2(0.99, 0.82));
                vec2 bk = vec2(fx * 90.0, floor(fy * 6.0));
                vec3 books = vec3(hash12(floor(bk)), hash12(floor(bk) + 3.0), hash12(floor(bk) + 7.0)) * 0.6 + 0.1;
                c = mix(c, mix(vec3(0.25, 0.18, 0.12), books, step(0.15, fract(fy * 6.0))), shelf);
                float art = box2(vec2(fx, fy), vec2(0.32, 0.55), vec2(0.5, 0.72)) * step(0.4, rs2);
                c = mix(c, mix(vec3(0.9, 0.5, 0.3), vec3(0.2, 0.5, 0.7), fbm(vec2(fx, fy) * 9.0 + seed)), art);
              } else if (rt < 1.5) {                       // bedroom
                float bed = box2(vec2(fx, fy), vec2(0.05, 0.0), vec2(0.72, 0.24));
                c = mix(c, vec3(0.82, 0.8, 0.76) * (0.9 + 0.1 * sin(fx * 40.0 + fy * 9.0)), bed);
                float pil = smoothstep(0.06, 0.0, sdBox(vec2(fx, fy) - vec2(0.17, 0.27), vec2(0.09, 0.04)));
                c = mix(c, vec3(0.9), pil);
                float head = box2(vec2(fx, fy), vec2(0.04, 0.24), vec2(0.73, 0.4));
                c = mix(c, vec3(0.28, 0.18, 0.11), head * (1.0 - pil));
                float ward = box2(vec2(fx, fy), vec2(0.8, 0.0), vec2(0.99, 0.86));
                c = mix(c, vec3(0.5, 0.38, 0.25) * (1.0 - 0.5 * step(abs(fx - 0.895), 0.004)), ward);
                float lampG = exp(-dot(vec2(fx - 0.76, fy - 0.36) * vec2(6.0, 9.0), vec2(fx - 0.76, fy - 0.36) * vec2(6.0, 9.0)));
                glowAdd += vec3(1.0, 0.62, 0.3) * lampG * 0.9 * step(0.35, rs2);
              } else if (rt < 2.5) {                       // kitchen
                float base = step(fy, 0.32);
                c = mix(c, mix(vec3(0.85, 0.83, 0.78), vec3(0.4, 0.3, 0.22), rs) * (1.0 - 0.5 * step(0.97, fract(fx * 6.0))), base);
                c = mix(c, vec3(0.85), box2(vec2(fx, fy), vec2(0.0, 0.32), vec2(1.0, 0.345)));
                float splash = box2(vec2(fx, fy), vec2(0.0, 0.345), vec2(1.0, 0.56));
                vec2 tl = fract(vec2(fx * 24.0, fy * 30.0));
                c = mix(c, vec3(0.9, 0.92, 0.9) * (1.0 - 0.25 * (step(0.93, tl.x) + step(0.9, tl.y))), splash);
                float upper = box2(vec2(fx, fy), vec2(0.0, 0.6), vec2(0.78, 0.82));
                c = mix(c, mix(vec3(0.8, 0.78, 0.72), vec3(0.45, 0.33, 0.24), rs) * (1.0 - 0.5 * step(0.97, fract(fx * 5.0))), upper);
                float fridge = box2(vec2(fx, fy), vec2(0.82, 0.0), vec2(0.99, 0.74));
                c = mix(c, mix(vec3(0.9), vec3(0.55, 0.57, 0.6), rs2) * (1.0 - 0.6 * step(abs(fy - 0.5), 0.004)), fridge);
                float hood = box2(vec2(fx, fy), vec2(0.36, 0.56), vec2(0.58, 0.66));
                c = mix(c, vec3(0.6, 0.62, 0.64), hood);
              } else if (rt < 3.5) {                       // office
                c = mix(c, vec3(0.86, 0.87, 0.88), box2(vec2(fx, fy), vec2(0.1, 0.42), vec2(0.45, 0.68)) * step(0.5, rs));
                float part = step(fy, 0.42) * step(0.27, fy);
                c = mix(c, vec3(0.32, 0.34, 0.38) * (0.8 + 0.2 * step(0.5, fract(fx * 3.0))), part);
                float desk = box2(vec2(fx, fy), vec2(0.0, 0.25), vec2(1.0, 0.27));
                c = mix(c, vec3(0.75, 0.74, 0.7), desk);
                vec2 mc = vec2(fract(fx * 5.0), fy);
                float mon = box2(mc, vec2(0.25, 0.3), vec2(0.75, 0.4));
                float monOn = step(0.35, hash12(vec2(floor(fx * 5.0), seed)));
                c = mix(c, vec3(0.03), mon);
                glowAdd += mix(vec3(0.4, 0.6, 1.0), vec3(0.8, 0.9, 1.0), hash12(vec2(floor(fx * 5.0), seed + 4.0))) * 1.1 * mon * monOn;
              } else if (rt < 4.5) {                       // storage
                vec2 bc = vec2(fx * 6.0 + floor(fy * 5.0) * 0.5, fy * 5.0);
                float boxes = step(fy, 0.25 + 0.5 * hash12(vec2(floor(bc.x), seed))) * step(0.06, fract(bc.x)) * step(0.06, fract(bc.y));
                c = mix(c * 0.6, vec3(0.5, 0.36, 0.22) * (0.8 + 0.3 * hash12(floor(bc))), boxes);
                c = mix(c, vec3(0.85, 0.8, 0.6), boxes * step(abs(fract(bc.y) - 0.5), 0.04));
              } else if (rt < 5.5) {                       // stairwell
                float line = fy - (0.1 + 0.8 * fx);
                float steps = step(abs(line), 0.12) * (0.6 + 0.4 * step(0.5, fract(fx * 14.0)));
                c = mix(c, vec3(0.3, 0.32, 0.3), steps);
                c = mix(c, vec3(0.08), step(abs(fy - (0.28 + 0.8 * fx)), 0.008));
                float exitS = box2(vec2(fx, fy), vec2(0.06, 0.82), vec2(0.2, 0.88));
                glowAdd += vec3(0.1, 1.0, 0.45) * 1.8 * exitS;
              } else if (rt < 6.5) {                       // shop shelving
                float shelfRow = step(fract(fy * 5.0), 0.12);
                vec3 prod = vec3(hash12(floor(vec2(fx * 40.0, fy * 5.0)) + seed), hash12(floor(vec2(fx * 40.0, fy * 5.0)) + 9.0), hash12(floor(vec2(fx * 40.0, fy * 5.0)) + 4.0));
                c = mix(prod * 0.8 + 0.1, vec3(0.85), shelfRow) * step(fy, 0.8) + c * step(0.8, fy);
              } else {                                     // bath tiles
                vec2 tl = fract(vec2(fx * 14.0, fy * 14.0));
                c = c * (1.0 - 0.3 * (step(0.94, tl.x) + step(0.94, tl.y)));
              }
            } else if (face < 1.5) {                       // floor
              if (rt < 1.5 && rs > 0.55) {                 // tatami
                vec2 tg = fract(vec2(hp.x / 0.9, -hp.z / 1.8));
                c = vec3(0.55, 0.5, 0.3) * (0.85 + 0.15 * sin(hp.x * 140.0)) * (1.0 - 0.6 * (step(0.96, tg.x) + step(0.97, tg.y)));
              } else if (rt > 2.5 && rt < 3.5) {
                c = vec3(0.16, 0.17, 0.2) * (0.9 + 0.2 * vnoise(hp.xz * 30.0));
                float dk = step(abs(fract(fz * 3.0) - 0.5), 0.12);
                c = mix(c, vec3(0.6, 0.6, 0.58), dk);
              } else if (rt > 6.5 || (rt > 1.5 && rt < 2.5)) {
                vec2 tg = fract(hp.xz / 0.3);
                c = vec3(0.7, 0.7, 0.68) * (1.0 - 0.2 * (step(0.95, tg.x) + step(0.95, tg.y)));
              } else {
                c = vec3(0.42, 0.28, 0.16) * (0.8 + 0.2 * step(0.5, fract(hp.x * 6.0 + floor(-hp.z * 0.8) * 0.37))) * (0.85 + 0.15 * vnoise(vec2(hp.x * 6.0, hp.z * 60.0)));
              }
            } else if (face < 2.5) {                       // ceiling with fixture
              c = wall * 1.1;
              vec2 cp = vec2(hp.x - roomW * 0.5, hp.z + depth * 0.5);
              if (lt < 0.5) glowAdd += lc * 3.0 * smoothstep(0.32, 0.28, length(cp)) * lit;
              else if (lt < 1.5) {
                float tubes = step(abs(cp.x - roomW * 0.18), 0.05) + step(abs(cp.x + roomW * 0.18), 0.05);
                glowAdd += lc * 3.0 * tubes * step(abs(cp.y), depth * 0.3) * lit;
                if (rt > 2.5 && rt < 3.5) glowAdd += lc * 2.2 * step(0.8, fract(hp.x * 0.7)) * step(0.7, fract(-hp.z * 0.5)) * lit;
              }
            } else {                                       // side walls
              c = wall * 0.85;
              float door = step(0.55, fz) * step(fz, 0.82) * step(fy, 0.72);
              c = mix(c, vec3(0.4, 0.3, 0.2), door * step(0.4, rs3));
              if (rt < 0.5) c = mix(c, vec3(0.2, 0.3, 0.2), step(0.15, fz) * step(fz, 0.35) * step(0.25, fy) * step(fy, 0.6) * step(0.6, rs2)); // plant
            }
            // ------------- lighting inside the room -------------
            vec3 lampPos = vec3(roomW * 0.5, (H - sill) - 0.15, -depth * 0.5);
            float d2 = dot(hp - lampPos, hp - lampPos);
            float L = lt < 0.5 ? 1.25 / (1.0 + d2 * 0.22) : lt < 1.5 ? 0.95 / (1.0 + d2 * 0.07) : lt < 2.5 ? 1.7 / (1.0 + d2 * 0.55) : 0.0;
            float corner = smoothstep(0.0, 0.55, min(min(hp.x, roomW - hp.x), min(hp.y + sill, H - sill - hp.y)));
            vec3 light = lc * L * lit * (0.55 + 0.45 * corner);
            light += vec3(0.35, 0.5, 1.0) * tvOn * 0.35 / (1.0 + dot(hp - vec3(roomW * 0.6, 0.3, -depth), hp - vec3(roomW * 0.6, 0.3, -depth)) * 0.4);
            light += vec3(0.01, 0.012, 0.022);
            return c * light;
          }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          vec3 winEmit = vec3(0.0); float glassRough = 0.03; float glassMetal = 0.0; vec3 glassDiffuse = vec3(0.008); float noGlass = 0.0;
          vec2 dropN = vec2(0.0);
          {
            vec2 sz = vWinSize;
            vec2 p = vWinUv * sz;
            float style = vWin.x, depth = vWin.y, litP = vWin.z, seed = vWin.w;
            float glassT = vWin2.x, roomT0 = vWin2.y, openA = vWin2.z, curT = vWin2.w;
            float lampT = vWin3.x, flags = vWin3.y, office = vWin3.z, rnd = vWin3.w;
            bool ribbon = style > 1.5 && style < 2.5;
            bool shop = style > 2.5 && style < 3.5;
            float roomsX = ribbon ? max(1.0, floor(sz.x / 3.4 + 0.5)) : 1.0;
            float roomW = sz.x / roomsX;
            float ri = floor(p.x / roomW);
            vec2 lp = vec2(p.x - ri * roomW, p.y);
            float rs = hash12(vec2(seed * 0.731 + ri * 7.7, seed * 0.113 + ri * 1.9));
            float rs2 = hash12(vec2(rs * 91.7, seed * 0.37 + ri * 1.3));
            float rs3 = hash12(vec2(rs2 * 13.3, rs * 5.1));
            float roomT = ri < 0.5 ? roomT0 : (office > 0.5 ? 3.0 : floor(hash12(vec2(seed, ri)) * 3.0));
            float lit = shop ? 1.0 : step(rs, litP);
            float tvOn = (roomT < 0.5) ? step(0.35, rs3) * (lit > 0.5 ? 1.0 : step(0.5, rs2)) : 0.0;
            // colour temperature by room type
            vec3 lc = roomT < 0.5 ? mix(vec3(1.0, 0.68, 0.4), vec3(1.0, 0.85, 0.66), rs2)
                    : roomT < 1.5 ? vec3(1.0, 0.6, 0.32)
                    : roomT < 3.5 ? mix(vec3(0.82, 0.92, 1.0), vec3(0.95, 0.97, 1.0), rs2)
                    : roomT < 5.5 ? vec3(0.78, 1.0, 0.86) : vec3(1.0, 0.96, 0.9);
            if (lampT > 1.5 && lampT < 2.5) lc = vec3(1.0, 0.58, 0.28);
            if (vTint > 0.5) { lc = mix(lc, vTint < 1.5 ? vec3(1.0, 0.3, 0.7) : vec3(0.3, 0.9, 1.0), 0.65); lit = 1.0; }
            if (rs3 > 0.97) lc *= step(0.25, vnoise(vec2(uTime * 18.0, seed * 3.0)));   // dying tube

            // ---- rain on glass: static beads + running drops (fade with distance) ----
            float dist = length(vViewTS);
            float dropAmt = uRain * (1.0 - smoothstep(3.0, 14.0, dist)) * (0.6 + 0.4 * step(7.5, flags));
            if (dropAmt > 0.01) {
              vec2 dp = p * 26.0;
              vec2 cid = floor(dp); vec2 f = fract(dp) - 0.5;
              vec2 h2 = hash22(cid + seed);
              vec2 dc = f - (h2 - 0.5) * 0.6;
              float rad = 0.12 + 0.18 * h2.x;
              float bead = smoothstep(rad, rad * 0.6, length(dc)) * step(0.45, h2.y);
              dropN += dc / rad * bead;
              // running drops sliding down in columns
              float col = floor(p.x * 9.0);
              float hc = hash11(col + seed);
              float yy = fract(p.y * 0.35 + uTime * (0.12 + hc * 0.2) + hc);
              vec2 rd2 = vec2(fract(p.x * 9.0) - 0.5, (yy - 0.5) * 6.0);
              float run = smoothstep(0.3, 0.1, length(rd2)) * step(0.7, hc);
              float trail = smoothstep(0.12, 0.0, abs(rd2.x)) * step(0.0, rd2.y) * step(rd2.y, 2.6) * step(0.7, hc) * 0.35;
              dropN += vec2(rd2.x * 2.0, 0.5) * (run + trail);
              dropN *= dropAmt;
            }

            vec3 rd = normalize(vViewTS); rd.z = min(rd.z, -1e-3);
            vec2 refr = dropN * 0.03;
            vec3 ro = vec3(lp + refr, 0.0);
            float sill = shop ? 0.05 : 0.85, head = shop ? 0.4 : 0.32;
            float H = sz.y + head + sill;
            vec3 bmin = vec3(0.0, -sill, -depth), bmax = vec3(roomW, sz.y + head, 0.0);
            vec3 tA = (bmin - ro) / rd, tB = (bmax - ro) / rd;
            vec3 tf = max(tA, tB);
            float t = min(min(tf.x, tf.y), tf.z);
            vec3 hp = ro + rd * t;
            float face = t == tf.z ? 0.0 : (t == tf.y ? (rd.y < 0.0 ? 1.0 : 2.0) : 3.0);
            vec3 glowAdd;
            vec3 interior = roomShade(hp, face, roomW, H, sill, depth, roomT, lampT, lc, lit, rs, rs2, rs3, tvOn, seed + ri, glowAdd);
            interior += glowAdd;
            if (shop) interior *= 1.5;

            // occupant silhouette on a plane mid-room
            if (mod(flags, 2.0) > 0.5 && (lit > 0.5 || tvOn > 0.5)) {
              float zp = -depth * (0.35 + 0.25 * rs2);
              float to = (zp - ro.z) / rd.z;
              if (to < t) {
                vec2 q = (ro + rd * to).xy;
                float px = roomW * (0.3 + 0.4 * rs3);
                float floorY = -sill;
                float body = sdBox(q - vec2(px, floorY + 0.68), vec2(0.17, 0.66)) - 0.06;
                float headS = length(q - vec2(px, floorY + 1.55)) - 0.11;
                float shoulder = sdBox(q - vec2(px, floorY + 1.3), vec2(0.21, 0.07)) - 0.05;
                float sil = min(min(body, headS), shoulder);
                interior = mix(interior, interior * 0.06 + lc * 0.03, smoothstep(0.01, -0.01, sil));
              }
            }
            // sill clutter: potted plant, bottles, a figurine — backlit silhouettes
            if (mod(floor(flags / 2.0), 2.0) > 0.5) {
              vec2 s = vec2(lp.x / roomW, lp.y);
              float pot = sdBox(s - vec2(0.2 + 0.1 * rs, 0.07), vec2(0.04, 0.07));
              float leaves = length((s - vec2(0.2 + 0.1 * rs, 0.2)) * vec2(1.6, 1.0)) - 0.12 - 0.03 * sin(atan(s.y - 0.2, s.x - 0.2) * 7.0);
              float bot = min(sdBox(s - vec2(0.72, 0.1), vec2(0.012, 0.1)), sdBox(s - vec2(0.76, 0.08), vec2(0.015, 0.08)));
              float shape = min(min(pot, leaves), bot);
              interior = mix(interior, interior * 0.08, smoothstep(0.004, -0.004, shape));
            }

            // ---- curtains & blinds ----
            float fxw = lp.x / roomW, fyw = lp.y / sz.y;
            vec3 fabricLit = lc * (0.45 * lit + 0.12 * tvOn) + vec3(0.006);
            if (curT > 0.5 && curT < 1.5) {                      // side drapes
              float cl = 0.1 + 0.3 * hash11(rs * 5.0), cr = 0.1 + 0.3 * hash11(rs * 9.0);
              float inC = clamp(step(fxw, cl) + step(1.0 - cr, fxw), 0.0, 1.0);
              vec3 cc = mix(vec3(0.92, 0.6, 0.36), vec3(0.6, 0.72, 0.9), hash11(rs * 3.0));
              cc = mix(cc, vec3(0.75, 0.2, 0.25), step(0.82, hash11(rs * 11.0)));
              float pat = step(0.66, hash11(rs * 17.0)) * step(0.5, fract(lp.x * 8.0 + lp.y * 0.0));
              float folds = 0.65 + 0.35 * sin(lp.x * 42.0 + sin(lp.y * 2.0) * 1.5);
              interior = mix(interior, cc * (1.0 - 0.25 * pat) * fabricLit * folds * 1.3, inC);
            } else if (curT < 2.5 && curT > 1.5) {               // sheer lace over everything
              float lace = 0.55 + 0.45 * smoothstep(0.3, 0.7, vnoise(lp * 38.0)) * step(0.3, fract(lp.x * 16.0 + lp.y * 3.0));
              interior = interior * 0.42 + vec3(0.95, 0.94, 0.9) * fabricLit * 0.5 * lace;
            } else if (curT < 3.5 && curT > 2.5) {               // roller blind
              float bl = 0.2 + 0.7 * hash11(rs * 7.0);
              float inB = step(1.0 - fyw, bl);
              vec3 bc = mix(vec3(0.9, 0.88, 0.82), vec3(0.35, 0.38, 0.4), step(0.6, hash11(rs * 13.0)));
              interior = mix(interior, bc * fabricLit * 0.9, inB);
              interior = mix(interior, vec3(0.02), inB * step(abs((1.0 - fyw) - bl), 0.012));
            } else if (curT < 4.5 && curT > 3.5) {               // venetian
              float bl = 0.35 + 0.65 * hash11(rs * 7.0);
              float open2 = 0.25 + 0.6 * hash11(rs * 19.0);
              float slat = step(open2, fract(lp.y * 22.0));
              float inB = step(1.0 - fyw, bl);
              vec3 sc = vec3(0.82, 0.83, 0.82) * fabricLit * 0.75 + vec3(0.01);
              interior = mix(interior, mix(interior, sc, slat), inB);
            } else if (curT < 5.5 && curT > 4.5) {               // vertical office blinds
              float sl = step(0.35, fract(lp.x * 9.0));
              interior = mix(interior, vec3(0.75, 0.76, 0.74) * fabricLit * 0.7, sl * 0.85);
            } else if (curT > 5.5) {                             // shōji screen
              vec2 sg = fract(vec2(lp.x / 0.28, lp.y / 0.24));
              float kumiko = step(0.93, sg.x) + step(0.93, sg.y);
              vec3 paper = vec3(1.0, 0.93, 0.8) * (lc * 0.75 * lit + vec3(0.015)) * (0.9 + 0.1 * vnoise(lp * 40.0));
              interior = mix(paper, vec3(0.05, 0.035, 0.02) * (lit * 0.6 + 0.2), clamp(kumiko, 0.0, 1.0));
            }

            // ---- sashes: open part has no glass; meeting rail double layer ----
            if (style > 0.5 && style < 1.5 && openA > 0.01) {
              float fw = 0.05;
              float mid = roomW * 0.5;
              float slide = openA * (roomW - 2.0 * fw);
              float openStart = roomW - fw - slide;
              noGlass = step(openStart, lp.x);
              if (mod(floor(flags / 4.0), 2.0) > 0.5) interior *= mix(1.0, 0.55, noGlass);   // insect mesh dims the view
            }
            float overlap = (style > 0.5 && style < 1.5) ? step(abs(lp.x - (roomW * 0.5 - openA * roomW)), 0.05) : 0.0;
            interior *= 1.0 - 0.12 * overlap;

            // ---- glass types ----
            float dirt = fbm(p * 2.3 + seed) * 0.5 + 0.25 * step(0.62, fbm(p * vec2(4.0, 0.8) + seed));
            if (glassT > 0.5 && glassT < 1.5) {                  // wired glass
              vec2 wg = fract(lp / 0.032);
              interior *= 1.0 - 0.45 * (step(0.9, wg.x) + step(0.9, wg.y));
              interior *= vec3(0.9, 0.98, 0.94);
            } else if (glassT < 2.5 && glassT > 1.5) {           // frosted: only a soft glow and blurred shapes
              float blob = smoothstep(0.6, 0.3, length((vec2(fxw, fyw) - vec2(0.3 + 0.4 * rs, 0.35)) * vec2(2.0, 1.2)));
              vec3 soft = lc * (0.38 * lit + 0.05) * (0.75 + 0.25 * fyw) * (1.0 - 0.45 * blob * step(0.5, rs2));
              interior = soft + glowAdd * 0.2;
              glassRough = 0.42;
            } else if (glassT < 3.5 && glassT > 2.5) {           // tinted solar glass
              interior *= vec3(0.22, 0.3, 0.32);
              glassMetal = 0.35; glassRough = 0.02;
            } else if (glassT < 4.5 && glassT > 3.5) {           // typhoon tape X
              float a1 = abs((lp.x / roomW) - fyw), a2 = abs((lp.x / roomW) - (1.0 - fyw));
              float tape = step(min(a1, a2), 0.035);
              interior = mix(interior, vec3(0.6, 0.55, 0.4) * (0.03 + lit * 0.25), tape);
              glassDiffuse = mix(glassDiffuse, vec3(0.5, 0.45, 0.32), tape);
            } else if (glassT < 5.5 && glassT > 4.5) {           // covered: newspaper / cardboard / foil
              float k = hash11(seed * 3.1);
              vec3 cover = k < 0.4 ? vec3(0.62, 0.6, 0.55) * (0.85 + 0.15 * step(0.5, fract(lp.y * 40.0)) * step(0.1, fract(lp.x * 3.0)))
                         : k < 0.75 ? vec3(0.45, 0.33, 0.2) * (0.9 + 0.1 * vnoise(lp * 20.0)) : vec3(0.75);
              float leak = smoothstep(0.04, 0.0, min(min(lp.x, roomW - lp.x), min(lp.y, sz.y - lp.y)));
              interior = lc * lit * 0.6 * leak;
              glassDiffuse = cover * 0.7; glassRough = k > 0.75 ? 0.25 : 0.85; glassMetal = k > 0.75 ? 0.9 : 0.0;
            } else if (glassT > 5.5) {                           // grime + stickers
              interior *= 0.75 - 0.3 * dirt;
              glassRough = 0.08 + dirt * 0.35;
              float stk = box2(lp, vec2(roomW - 0.32, 0.12), vec2(roomW - 0.12, 0.26)) * step(0.5, rs2);
              vec3 sc = mix(vec3(0.9, 0.1, 0.1), vec3(0.95, 0.9, 0.1), hash11(seed));
              glassDiffuse = mix(glassDiffuse, sc * 0.6, stk); interior = mix(interior, sc * 0.05, stk);
              float forRent = box2(lp, vec2(0.12, sz.y * 0.5), vec2(0.5, sz.y * 0.5 + 0.28)) * step(0.82, rs3);
              glassDiffuse = mix(glassDiffuse, vec3(0.85), forRent);
              glassDiffuse = mix(glassDiffuse, vec3(0.75, 0.05, 0.05), forRent * box2(lp, vec2(0.16, sz.y * 0.5 + 0.08), vec2(0.46, sz.y * 0.5 + 0.2)));
              interior = mix(interior, vec3(0.0), forRent);
            }
            glassRough = mix(glassRough, 1.0, noGlass);
            glassDiffuse = mix(glassDiffuse, vec3(0.0), noGlass);
            winEmit = interior * uWinBright * (1.0 - 0.06 * (1.0 - noGlass));
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb = glassDiffuse;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = glassRough + length(dropN) * 0.0;`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = glassMetal;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = normalize(normal + (vTv * dropN.x + vBv * dropN.y) * 0.9);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += winEmit;`);
    };
    mat.customProgramCacheKey = () => 'interior-windows-v2';
    mat.userData.noWeather = true;
    return mat;
  }
}
