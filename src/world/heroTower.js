import * as THREE from 'three';
import { Batch, T, RNG, U, boxGeo, roundRectShape, roundRectPath, GLSL_NOISE } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';
import { Frame, wallWithOpenings, wallWithWindows } from '../core/facade.js';
import { WIN } from '../core/windows.js';
import { neonSign } from '../core/neon.js';
import { acUnit, plant, laundryLine, dish, waterTank, meterBox, crateStack, trashBag, bicycle, futon } from '../core/prefabs.js';
import { lightBox, chaser, rectPerimeter, JP, JPM, LAT, vtext, rr, faceMaterial } from './signs.js';
import { buildRamen } from './ramen.js';
import { buildKoiHologram } from '../fx/hologram.js';
import { L } from './layout.js';

/* =================================================================== */
/*  KOI-TEI TOWER  (鯉亭ビル)                                           */
/*  0.2–4.6   ramen shop + capsule-hotel lobby                          */
/*  5.2–11.2  capsule hotel: 92 pods, each a lit porthole               */
/*  11.6–36.4 eight floors of hand-placed residential add-on modules:  */
/*            window cages, balconies, a hydroponic greenhouse, AC      */
/*            clusters, a hostess bar, a karaoke box                     */
/*  roof      water tank, lattice mast, rooftop neon, koi hologram     */
/* =================================================================== */

const FLOOR = 3.1, RES0 = 11.6, NFLOORS = 8, ROOF = RES0 + FLOOR * NFLOORS; // 36.4
const CORE_X = 9.2, CORE_Z = 2.3;

export function buildHeroTower(world) {
  const root = new THREE.Group();
  root.name = 'koi-tei';
  world.scene.add(root);
  const B = new Batch('hero');
  const rng = new RNG(4242);

  buildGroundShell(world, B, root);
  buildRamen(world, root);
  buildLobby(world, B, root);
  buildCapsules(world, B, root);
  buildResidences(world, B, root, rng);
  buildCornerAndSigns(world, B, root);
  buildFireEscape(world, B, root);
  buildRoof(world, B, root, rng);
  buildAlleyLife(world, B, root, rng);
  B.build(root);
  return root;
}

/* ===================================================================== */
/*  Ground floor shell (structure around shopfronts)                      */
/* ===================================================================== */
function buildGroundShell(world, B, root) {
  const SF = new Frame('-x', 7.5, 0, -14);       // street face, u = z + 14
  const AF = new Frame('+z', 7.5, 0, 4);         // alley face,  u = x - 7.5
  // columns clad in black glazed tile
  for (const [u0, u1] of [[0, 1.0], [7.0, 7.8], [17.4, 18.0]]) SF.box(B, M.tileDark, (u0 + u1) / 2, 2.3, -0.4, u1 - u0, 4.6, 0.8);
  // fascia band over the shopfronts and the floor slab with its LED lip
  SF.box(B, M.concreteDark, 9, 4.15, -0.3, 18, 0.9, 0.6);
  SF.box(B, M.concreteDark, 9, 4.9, 0.1, 18.4, 0.6, 1.0);
  AF.box(B, M.concreteDark, 7, 4.9, 0.1, 14.4, 0.6, 1.0);
  B.add(new THREE.BoxGeometry(0.03, 0.03, 18.2), glow(0x19e6ff, 5), T(7.42, 4.6, -5.0));
  B.add(new THREE.BoxGeometry(14.2, 0.03, 0.03), glow(0x19e6ff, 5), T(14.6, 4.6, 4.08));
  // alley wall: kitchen window, extractor, back door, utility wall
  const alleyOpen = [
    { u: 3.0, v: 1.25, w: 2.6, h: 1.25 },  // kitchen window
    { u: 8.0, v: 0.18, w: 1.0, h: 2.15 },  // back door
  ];
  wallWithOpenings(B, M.tileCream, AF, 14, 4.6, 0.3, alleyOpen, 0.5);
  // kitchen window: glass + stainless sill + steam-fogged pane glow
  B.add(new THREE.BoxGeometry(2.6, 1.25, 0.02), new THREE.MeshStandardMaterial({ color: 0x302820, emissive: 0xffc890, emissiveIntensity: 0.55, roughness: 0.3, transparent: true, opacity: 0.85 }), T(11.8, 1.875, 3.82));
  for (const x of [10.9, 11.8, 12.7]) B.add(new THREE.BoxGeometry(0.04, 1.25, 0.05), M.steel, T(x, 1.875, 3.84));
  B.add(new THREE.BoxGeometry(2.8, 0.05, 0.25), M.steel, T(11.8, 1.22, 4.05));
  // extractor fan housing with louvres (and its steam plume)
  B.add(new THREE.BoxGeometry(0.7, 0.7, 0.25), M.galv, T(14.3, 3.0, 4.12));
  for (let i = 0; i < 6; i++) B.add(new THREE.BoxGeometry(0.62, 0.02, 0.12), M.metalDark, T(14.3, 2.72 + i * 0.11, 4.27, 0.6, 0, 0));
  world.steamSources = world.steamSources || [];
  world.steamSources.push({ p: new THREE.Vector3(14.3, 3.1, 4.35), rate: 2.2, size: 0.8, rise: 0.55, drift: new THREE.Vector3(0, 0.2, 0.45), color: 0xd8d4e8, spread: 0.2, life: 4.5, max: 4.5 });
  // back door: steel door slab, caged bulkhead lamp, kick plate
  B.add(new THREE.BoxGeometry(0.96, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x3b4a44, roughness: 0.5, metalness: 0.6 }), T(16.0, 1.23, 3.78));
  B.add(new THREE.BoxGeometry(0.94, 0.3, 0.02), M.steel, T(16.0, 0.35, 3.82));
  B.add(new THREE.BoxGeometry(0.06, 0.18, 0.05), M.steel, T(15.62, 1.25, 3.84));
  B.add(new THREE.BoxGeometry(0.22, 0.3, 0.14), M.metalDark, T(16.0, 2.65, 4.08));
  B.add(new THREE.CapsuleGeometry(0.06, 0.12, 4, 8), glow(0x9dffb0, 3.2), T(16.0, 2.62, 4.13));
  const doorLamp = new THREE.PointLight(0x8dffb0, 2.2, 6, 2);
  doorLamp.position.set(16.0, 2.5, 4.5);
  root.add(doorLamp);
  world.updaters.push((t) => { const f = Math.sin(t * 50) > 0.92 && Math.sin(t * 0.7) > 0.6 ? 0.2 : 1; doorLamp.intensity = 2.2 * f; });
  // utility wall: gas + electric meters, breaker cabinet, conduit bundle
  const mb = meterBox();
  for (let i = 0; i < 4; i++) mb.place(B, AF.m(9.8 + i * 0.55, 1.6 + (i % 2) * 0.1, 0.1));
  B.add(new THREE.BoxGeometry(1.1, 1.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x7d8277, roughness: 0.55, metalness: 0.5 }), T(20.0, 1.6, 4.15));
  B.add(new THREE.BoxGeometry(0.2, 0.12, 0.02), glow(0xffd000, 1.5), T(20.0, 2.05, 4.31));
  for (let i = 0; i < 5; i++) B.add(new THREE.CylinderGeometry(0.025, 0.025, 4.0, 6), M.cable, T(19.6 + i * 0.07, 3.0, 4.12));
  // continue the ground floor to the rear (blind wall) and the north wall
  const NF = new Frame('-z', 21.5, 0, -14);
  wallWithOpenings(B, M.concreteWarm, NF, 14, 11.2, 0.3, [], 0.25);
  const EF = new Frame('+x', 21.5, 0, 4);
  wallWithOpenings(B, M.concreteWarm, EF, 18, 11.2, 0.3, [{ u: 3, v: 0.18, w: 1.0, h: 2.1 }], 0.25);
  // interior back-of-house box so open doors never see the void
  B.add(boxGeo(6.4, 4.4, 9.9, 0.25), M.concreteDark, T(18.3, 2.4, -1.25));
}

/* ===================================================================== */
/*  Capsule hotel lobby                                                    */
/* ===================================================================== */
function buildLobby(world, B, root) {
  const SFL = 0.18;
  const white = new THREE.MeshStandardMaterial({ color: 0xeeeef2, roughness: 0.12 });
  // floor, ceiling glow, walls
  B.add(boxGeo(5.0, 0.04, 6.0, 1), M.tileWhite, T(10.6, SFL + 0.02, -10.0));
  B.add(new THREE.BoxGeometry(4.8, 0.03, 5.6), glow(0xd9c9ff, 1.25), T(10.6, 3.62, -10.0));
  B.add(boxGeo(0.1, 3.5, 6.0, 0.5), white, T(13.1, SFL + 1.75, -10.0));
  B.add(boxGeo(5.0, 3.5, 0.1, 0.5), white, T(10.6, SFL + 1.75, -13.0));
  // shoe lockers: 8 × 6 small doors with wooden key tags
  const lockerDoor = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.35, metalness: 0.5 });
  const tag = new THREE.MeshStandardMaterial({ color: 0x9c6b3c, roughness: 0.6 });
  for (let c = 0; c < 8; c++) for (let r = 0; r < 6; r++) {
    const z = -12.45 + c * 0.36, y = SFL + 0.3 + r * 0.36;
    B.add(new THREE.BoxGeometry(0.04, 0.33, 0.33), lockerDoor, T(13.02, y, z));
    B.add(new THREE.BoxGeometry(0.02, 0.09, 0.04), tag, T(12.99, y + 0.08, z + 0.1));
  }
  // reception counter + hologram concierge glyph
  B.add(boxGeo(0.7, 1.05, 2.6, 0.5), white, T(11.6, SFL + 0.525, -8.3));
  B.add(new THREE.BoxGeometry(0.02, 0.06, 2.5), glow(0xb18cff, 4), T(11.24, SFL + 0.9, -8.3));
  const holo = new THREE.Mesh(new THREE.TorusKnotGeometry(0.16, 0.035, 80, 8, 2, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7af6ff).multiplyScalar(2.2), wireframe: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  holo.position.set(11.6, SFL + 1.45, -8.3);
  root.add(holo);
  world.updaters.push((t) => { holo.rotation.y = t * 0.8; holo.rotation.x = Math.sin(t * 0.5) * 0.4; holo.position.y = SFL + 1.45 + Math.sin(t * 1.7) * 0.03; });
  // glass front with automatic doors, frosted bands
  for (const z of [-13.0, -11.2, -9.6, -8.8, -7.0]) B.add(new THREE.BoxGeometry(0.08, 3.5, 0.06), M.steel, T(8.1, SFL + 1.75, z));
  B.add(new THREE.BoxGeometry(0.08, 0.08, 6.0), M.steel, T(8.1, SFL + 3.5, -10.0));
  B.add(new THREE.BoxGeometry(0.02, 3.4, 5.9), M.glassClear, T(8.12, SFL + 1.75, -10.0));
  B.add(new THREE.BoxGeometry(0.025, 0.12, 5.9), M.glassFrost, T(8.14, SFL + 1.1, -10.0));
  // light-box over the entrance
  const sign = drawCanvas(1200, 160, (x) => {
    const g = x.createLinearGradient(0, 0, 1200, 0); g.addColorStop(0, '#f4ecff'); g.addColorStop(1, '#d9ccff');
    x.fillStyle = g; x.fillRect(0, 0, 1200, 160);
    x.fillStyle = '#4b2a8c'; x.font = `900 70px ${LAT}`; x.textBaseline = 'middle'; x.fillText('CAPSULE', 40, 82);
    x.font = `bold 110px ${JPM}`; x.fillStyle = '#c8148c'; x.fillText('夢', 455, 86);
    x.font = `900 70px ${LAT}`; x.fillStyle = '#4b2a8c'; x.fillText('YUME', 600, 82);
    x.font = `bold 34px ${JP}`; x.fillStyle = '#6a4aa8'; x.fillText('カプセルホテル 24H · ¥3800〜', 830, 60); x.fillText('WOMEN FLOOR 3F · SAUNA', 830, 112);
  });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.75), faceMaterial(sign, 0.85));
  sm.position.set(7.18, 3.95, -10.0); sm.rotation.y = -Math.PI / 2; root.add(sm);
  B.add(new THREE.BoxGeometry(0.2, 0.85, 5.75), M.metalDark, T(7.3, 3.95, -10.0));
  const lav = new THREE.PointLight(0xc4a8ff, 7, 11, 1.8);
  lav.position.set(10.2, 3.1, -10.0);
  root.add(lav);
}

/* ===================================================================== */
/*  Capsule hotel façade: 92 lit pods                                      */
/* ===================================================================== */
function podMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uI: { value: 1.6 } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aPod; varying vec4 vPod; varying vec2 vUv;
      void main(){ vPod = aPod; vUv = uv; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uI; varying vec4 vPod; varying vec2 vUv;
      ${GLSL_NOISE}
      vec3 podCol(float k){
        if (k < 0.3) return vec3(1.0, 0.78, 0.55);
        if (k < 0.45) return vec3(1.0, 0.9, 0.8);
        if (k < 0.58) return vec3(0.35, 0.85, 1.0);
        if (k < 0.7) return vec3(1.0, 0.3, 0.75);
        if (k < 0.8) return vec3(0.55, 0.4, 1.0);
        return vec3(0.4, 0.55, 1.0);
      }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float on = vPod.w;
        vec3 base = podCol(vPod.x);
        // looking into a 2 m tube: far wall bright, inner walls fall off
        float d = max(abs(p.x) * 0.92, abs(p.y));
        float farWall = smoothstep(0.62, 0.52, d);
        vec3 col = base * mix(0.32, 1.0, farWall) * (1.0 - d * d * 0.35);
        col += base * 1.6 * smoothstep(0.07, 0.0, abs(p.y - 0.8)) * step(abs(p.x), 0.85);  // LED strip
        // little wall TV
        float isTv = step(0.82, vPod.z);
        float tv = step(abs(p.x - 0.42), 0.16) * step(abs(p.y - 0.3), 0.1);
        col = mix(col, vec3(0.35, 0.6, 1.0) * (0.7 + 0.5 * vnoise(vec2(uTime * 6.0, vPod.z * 50.0))), tv * isTv);
        // futon + sleeper silhouette
        float bed = smoothstep(-0.3, -0.38, p.y);
        float body = smoothstep(0.25, 0.18, length((p - vec2(-0.1, -0.33)) * vec2(0.6, 2.4))) * step(0.5, fract(vPod.z * 7.0));
        col *= 1.0 - 0.45 * bed - 0.55 * body;
        // roller blind
        float blind = vPod.y;
        float inBlind = step(1.0 - blind * 2.0, 1.0 - (p.y * 0.5 + 0.5) * 2.0 + 1.0 - 1.0);
        float by = 1.0 - (p.y * 0.5 + 0.5);
        inBlind = step(by, blind);
        vec3 fabric = base * 0.42 * (0.85 + 0.15 * sin(p.y * 80.0));
        col = mix(col, fabric, inBlind);
        col = mix(vec3(0.012, 0.014, 0.02) * (1.0 - d * 0.5), col, on);
        gl_FragColor = vec4(col * uI, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  m.uniforms.uTime = U.time;
  m.userData.noShadow = true;
  return m;
}

function buildCapsules(world, B, root) {
  const rng = new RNG(77);
  const SF = new Frame('-x', 7.5, 0, -14);
  const AF = new Frame('+z', 7.5, 0, 4);
  const rowsV = [5.45, 6.95, 8.45, 9.95];
  const podW = 0.92, podH = 0.8;
  const pods = [];
  const make = (F, us, len) => {
    const openings = [];
    for (const u of us) for (const v of rowsV) openings.push({ u: u - podW / 2, v: v - 5.2, w: podW, h: podH });
    wallWithOpenings(B, M.paintCream, F, len, 6.0, 0.25, openings, 0.5, 0, 5.2);
    for (const u of us) for (const v of rowsV) {
      const c = F.p(u, v + podH / 2, 0);
      pods.push({ F, u, v, c });
    }
  };
  const usS = Array.from({ length: 13 }, (_, i) => 0.75 + i * 1.3);
  const usA = Array.from({ length: 10 }, (_, i) => 1.0 + i * 1.3);
  make(SF, usS, 18);
  make(AF, usA, 14);
  // pod frames: rounded plastic rings
  const ring = roundRectShape(1.12, 1.0, 0.22);
  ring.holes.push(roundRectPath(podW, podH, 0.17));
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 });
  ringGeo.scale(0.94, 0.94, 1);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0.4 });
  const bezelCols = [0xb4b8bc, 0xe6e2d6, 0xd2c6a6, 0x9aa0a6, 0xe6e2d6];
  const frames = new THREE.InstancedMesh(ringGeo, ringMat, pods.length);
  const inner = new THREE.InstancedMesh(new THREE.PlaneGeometry(podW, podH), podMaterial(), pods.length);
  const aPod = new Float32Array(pods.length * 4);
  pods.forEach((p, i) => {
    const m = p.F.m(p.u, p.v + podH / 2, -0.02);
    frames.setMatrixAt(i, m);
    inner.setMatrixAt(i, p.F.m(p.u, p.v + podH / 2, -0.24));
    const on = rng.chance(0.68) ? 1 : 0;
    aPod.set([rng.next(), rng.chance(0.4) ? rng.range(0.15, 0.85) : 0, rng.next(), on], i * 4);
    frames.setColorAt(i, new THREE.Color(bezelCols[rng.int(0, bezelCols.length - 1)]));
  });
  frames.instanceColor.needsUpdate = true;
  // weathering + hardware per pod: grime streak, louvred vent, numbered plate, the odd sticker
  const streakTex = drawCanvas(128, 256, (x) => {
    x.clearRect(0, 0, 128, 256);
    for (let i = 0; i < 26; i++) {
      const px = 10 + Math.random() * 108, w = 1 + Math.random() * 5, len = 60 + Math.random() * 190;
      const g = x.createLinearGradient(0, 0, 0, len); g.addColorStop(0, `rgba(255,255,255,${0.35 + Math.random() * 0.5})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(px, 0, w, len);
    }
    const g2 = x.createLinearGradient(0, 0, 0, 40); g2.addColorStop(0, 'rgba(255,255,255,0.6)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g2; x.fillRect(4, 0, 120, 40);
  }, { srgb: false });
  const grime = new THREE.MeshBasicMaterial({ color: 0x050403, alphaMap: streakTex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  grime.userData.noShadow = true;
  const grimeIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.95, 0.75), grime, pods.length);
  const ventIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.07, 0.02), M.galv, pods.length);
  const plateIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.035, 0.008), glow(0xcfe6ff, 0.9), pods.length);
  pods.forEach((p, i) => {
    grimeIM.setMatrixAt(i, p.F.m(p.u + rng.range(-0.05, 0.05), p.v - 0.42, 0.003).multiply(T(0, 0, 0, 0, 0, 0, rng.range(0.7, 1.1), rng.range(0.6, 1.2), 1)));
    ventIM.setMatrixAt(i, p.F.m(p.u + 0.42, p.v + podH + 0.12, 0.01));
    plateIM.setMatrixAt(i, p.F.m(p.u - 0.4, p.v + podH + 0.11, 0.006));
  });
  for (const im of [grimeIM, ventIM, plateIM]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); root.add(im); }
  // a few pods with life of their own: taped "故障中" (out of order), stickers, a towel hung in the opening
  const odd = drawCanvas(256, 256, (x) => {
    x.clearRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(220,200,150,0.95)'; x.save(); x.translate(128, 128); x.rotate(0.6); x.fillRect(-150, -12, 300, 24); x.rotate(-1.2); x.fillRect(-150, -12, 300, 24); x.restore();
    x.fillStyle = '#fff'; x.fillRect(70, 96, 116, 64); x.fillStyle = '#d00'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText('故障中', 128, 140);
  });
  const oddM = new THREE.MeshBasicMaterial({ map: odd, transparent: true, depthWrite: false });
  for (const k of [7, 23, 41, 66, 80]) {
    const p = pods[k % pods.length];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(podW * 0.98, podH * 0.98), oddM);
    m.applyMatrix4(p.F.m(p.u, p.v + podH / 2, -0.2)); root.add(m);
  }
  inner.geometry.setAttribute('aPod', new THREE.InstancedBufferAttribute(aPod, 4));
  frames.castShadow = true; frames.receiveShadow = true;
  frames.computeBoundingSphere(); inner.computeBoundingSphere();
  root.add(frames, inner);
  // dark tube interiors behind the openings (so oblique views see depth)
  for (const p of pods) {
    p.F.box(B, M.plasticBlack, p.u, p.v + podH / 2, -0.25, podW + 0.1, podH + 0.1, 0.02);
  }
  // capsule-floor ledge with LED underlight
  SF.box(B, M.concreteDark, 9.0, 11.4, 0.15, 18.3, 0.4, 0.6);
  AF.box(B, M.concreteDark, 7.0, 11.4, 0.15, 14.3, 0.4, 0.6);
  B.add(new THREE.BoxGeometry(0.03, 0.025, 18.2), glow(0xff2ad4, 4.5), T(7.08, 11.19, -5.0));
  B.add(new THREE.BoxGeometry(14.2, 0.025, 0.03), glow(0xff2ad4, 4.5), T(14.6, 11.19, 4.42));
  // vertical capsule sign
  const capSign = lightBox({
    w: 0.8, h: 5.2, d: 0.24, px: 120, intensity: 1.7, painter: (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a0b4d'); g.addColorStop(1, '#4d0b3e');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#ff7ae0'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
      vtext(x, 'カプセル', w / 2, 90, 92, `bold 74px ${JP}`, '#ffffff', '#ff2ad4', 4);
      x.font = `bold 120px ${JPM}`; x.fillStyle = '#ffd6f6'; x.textAlign = 'center'; x.fillText('夢', w / 2, 520);
      x.font = `900 34px ${LAT}`; x.fillStyle = '#b8f6ff'; x.fillText('24H', w / 2, 590);
    },
  });
  capSign.rotation.y = Math.PI; capSign.position.set(7.5, 8.2, -13.4);
  root.add(capSign);
}

/* ===================================================================== */
/*  Residential add-on modules                                            */
/* ===================================================================== */
const STREET_PLAN = [
  [['cage', 3.4, 1.6, 'tileMint'], ['ac', 2.4, 1.0, 'corrugated'], ['balcony', 4.4, 1.9, 'paintCream'], ['green', 3.4, 2.1], ['plain', 2.3, 1.2, 'brick']],
  [['plain', 2.8, 1.3, 'paintBlue'], ['bar', 4.6, 2.3, 'paintRed', 'SNACK', 0xff2a8a], ['cage', 3.6, 1.5, 'paintCream'], ['balcony', 4.8, 1.6, 'tileMint']],
  [['balcony', 4.2, 2.0, 'tileCream'], ['cage', 3.2, 1.2, 'corrugatedOrange'], ['ac', 3.0, 1.7, 'paintRed'], ['plain', 3.0, 1.0, 'tileMint'], ['cage', 2.4, 1.4, 'paintMint']],
  [['cage', 3.6, 2.4, 'paintMint'], ['plain', 2.6, 1.0, 'concreteWarm'], ['balcony', 5.2, 1.4, 'brick'], ['ac', 4.4, 1.9, 'corrugated']],
  [['ac', 2.6, 1.2, 'paintBlue'], ['cage', 3.8, 1.8, 'tileCream'], ['green', 3.2, 2.4], ['balcony', 4.2, 1.5, 'paintCream'], ['plain', 2.0, 1.0, 'tileMint']],
  [['balcony', 4.6, 1.6, 'tileMint'], ['bar', 3.6, 1.9, 'paintBlue', 'KARAOKE', 0x22e5ff], ['cage', 3.4, 1.3, 'paintMint'], ['ac', 4.0, 2.1, 'corrugatedOrange']],
  [['plain', 3.2, 1.4, 'brick'], ['cage', 4.0, 2.0, 'paintCream'], ['balcony', 4.4, 1.2, 'tileCream'], ['cage', 4.0, 1.7, 'corrugated']],
  [['cage', 3.0, 1.1, 'tileMint'], ['balcony', 6.0, 1.5, 'paintBlue'], ['ac', 3.0, 1.6, 'paintMint'], ['plain', 3.6, 1.2, 'tileCream']],
];
const ALLEY_PLAN = [
  [['balcony', 2.8, 1.6, 'paintCream'], ['cage', 2.8, 1.2, 'tileMint']],
  [['ac', 2.2, 1.0, 'corrugated'], ['plain', 3.4, 2.0, 'paintBlue']],
  [['cage', 3.0, 1.7, 'paintMint'], ['ac', 2.6, 1.1, 'corrugatedOrange']],
  [['balcony', 5.6, 1.4, 'tileCream']],
  [['plain', 2.6, 1.2, 'brick'], ['cage', 3.0, 1.9, 'paintCream']],
  [['cage', 3.2, 1.5, 'corrugated'], ['ac', 2.4, 1.0, 'paintRed']],
  [['balcony', 2.9, 1.8, 'tileMint'], ['plain', 2.7, 1.0, 'paintCream']],
  [['ac', 2.0, 1.0, 'paintBlue'], ['cage', 3.6, 1.4, 'tileMint']],
];

function buildResidences(world, B, root, rng) {
  const CSF = new Frame('-x', CORE_X, 0, -14);       // u = z + 14 (0 … 16.3)
  const CAF = new Frame('+z', CORE_X, 0, CORE_Z);    // u = x - 9.2 (0 … 12.3)
  const H = ROOF - RES0;
  // core walls behind the modules, with windows in the gaps
  const coreWin = (len, F, avoid) => {
    const wins = [];
    for (let f = 0; f < NFLOORS; f++) for (let u = 0.6; u < len - 1.2; u += 2.4) {
      if (avoid && avoid(u)) continue;
      wins.push({ u, v: f * FLOOR + 0.95, w: 1.0, h: 1.4, style: WIN.SLIDER, lit: 0.5 });
    }
    return wins;
  };
  wallWithWindows(B, M.concreteWarm, CSF, 16.3, H, 0.3, coreWin(16.3, CSF), world.windows, { v0: RES0, sillMat: M.concreteDark, uvs: 0.25 });
  wallWithWindows(B, M.concreteWarm, CAF, 12.3, H, 0.3, coreWin(12.3, CAF, (u) => u > 5.8), world.windows, { v0: RES0, sillMat: M.concreteDark, uvs: 0.25 });
  // north + east faces above the neighbours
  const NF = new Frame('-z', 21.5, 0, -14);
  const nw = [];
  for (let f = 0; f < NFLOORS; f++) for (let u = 1.0; u < 11.5; u += 2.6) nw.push({ u, v: f * FLOOR + 1.0, w: 1.3, h: 1.4, style: WIN.PLAIN, lit: 0.45 });
  wallWithWindows(B, M.concreteWarm, NF, 12.3, H, 0.3, nw, world.windows, { v0: RES0, sillMat: M.concreteDark, uvs: 0.25 });
  const EF = new Frame('+x', 21.5, 0, CORE_Z);
  const ew = [];
  for (let f = 0; f < NFLOORS; f++) for (let u = 1.0; u < 15.5; u += 2.2) ew.push({ u, v: f * FLOOR + 1.0, w: 1.1, h: 1.3, style: WIN.SLIDER, lit: 0.5 });
  wallWithWindows(B, M.concreteWarm, EF, 16.3, H, 0.3, ew, world.windows, { v0: RES0, sillMat: M.concreteDark, uvs: 0.25 });
  // slab edges at every floor
  for (let f = 0; f <= NFLOORS; f++) {
    CSF.box(B, M.concreteDark, 8.15, RES0 + f * FLOOR, 0.1, 16.3, 0.2, 0.25);
    CAF.box(B, M.concreteDark, 6.15, RES0 + f * FLOOR, 0.1, 12.3, 0.2, 0.25);
  }
  // modules
  STREET_PLAN.forEach((row, f) => placeRow(world, B, root, CSF, row, RES0 + f * FLOOR, 16.3, rng, f));
  ALLEY_PLAN.forEach((row, f) => placeRow(world, B, root, CAF, row, RES0 + f * FLOOR, 5.9, rng, f + 20));
  // drain pipes + conduit risers on the core
  for (const u of [3.6, 8.1, 12.9]) {
    CSF.cyl(B, M.plasticGrey, 0.055, H + 6, u, RES0 + H / 2 - 3, 0.12, 'v', 10);
    for (let f = 0; f < NFLOORS; f++) CSF.box(B, M.galv, u, RES0 + f * FLOOR + 1.5, 0.12, 0.14, 0.04, 0.16);
  }
  for (const u of [5.2, 5.28, 5.36, 5.44]) CSF.cyl(B, M.cable, 0.018, H, u, RES0 + H / 2, 0.2, 'v', 5);
}

function placeRow(world, B, root, F, row, v0, len, rng, seed) {
  const r = new RNG(seed * 97 + 13);
  let u = 0.12;
  for (const spec of row) {
    const [type, w0, proj, matKey, label, color] = spec;
    const w = Math.min(w0, len - u - 0.05);
    if (w < 1.2) break;
    module(world, B, root, F, { type, u0: u, w, v0, h: FLOOR, proj, mat: M[matKey] || M.paintCream, label, color }, r);
    u += w + r.range(0.12, 0.45);
  }
}

function module(world, B, root, F, s, rng) {
  const { type, u0, w, v0, h, proj, mat } = s;
  const uc = u0 + w / 2;
  // shell
  F.box(B, M.concreteDark, uc, v0 + 0.08, proj / 2, w + 0.06, 0.16, proj + 0.06);
  F.box(B, type === 'green' ? M.metalDark : mat, uc, v0 + h - 0.06, proj / 2, w + 0.04, 0.12, proj + 0.04);
  if (type !== 'green') {
    F.box(B, mat, u0 + 0.06, v0 + h / 2 - 0.02, proj / 2, 0.12, h - 0.28, proj);
    F.box(B, mat, u0 + w - 0.06, v0 + h / 2 - 0.02, proj / 2, 0.12, h - 0.28, proj);
  }
  const fw = w - 0.24;
  const front = (depth) => new Frame(F.dir, ...F.p(u0 + 0.12, v0 + 0.16, depth).toArray());
  const fh = h - 0.28;
  const ac = acUnit();
  const seedBase = (u0 * 13.1 + v0 * 7.7 + (F.dir === '-x' ? 0 : 500));

  if (type === 'cage') {
    const ww = Math.min(2.0, fw - 0.7), wh = 1.35, wu = (fw - ww) / 2, wv = 0.8;
    wallWithWindows(B, mat, front(proj), fw, fh, 0.14, [{ u: wu, v: wv, w: ww, h: wh, style: WIN.SLIDER, depth: proj + 2.6, lit: 0.6, seed: seedBase }], world.windows, { sillMat: M.concreteDark });
    // window cage (galvanised bars, sheet roof)
    const cu0 = u0 + 0.12 + wu - 0.12, cu1 = cu0 + ww + 0.24, cv0 = v0 + 0.16 + wv - 0.06, cv1 = cv0 + wh + 0.22, cd = 0.48;
    F.box(B, M.galv, (cu0 + cu1) / 2, cv0, proj + cd / 2, cu1 - cu0, 0.03, cd);
    F.box(B, M.corrugated, (cu0 + cu1) / 2, cv1 + 0.04, proj + cd / 2 + 0.03, cu1 - cu0 + 0.08, 0.025, cd + 0.1);
    for (let uu = cu0; uu <= cu1 + 1e-3; uu += 0.105) F.cyl(B, M.galv, 0.009, cv1 - cv0, uu, (cv0 + cv1) / 2, proj + cd, 'v', 5);
    for (const vv of [cv0 + 0.25, cv0 + 0.8, cv1]) F.cyl(B, M.galv, 0.012, cu1 - cu0, (cu0 + cu1) / 2, vv, proj + cd, 'u', 5);
    for (const uu of [cu0, cu1]) for (let ww2 = 0.1; ww2 < cd; ww2 += 0.12) F.cyl(B, M.galv, 0.008, cv1 - cv0, uu, (cv0 + cv1) / 2, proj + ww2, 'v', 4);
    // plants + laundry inside the cage
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) plant(B, F.m(cu0 + 0.25 + i * ((cu1 - cu0 - 0.5) / Math.max(1, n - 1 || 1)), cv0 + 0.015, proj + 0.24), rng, { size: rng.range(0.7, 1.05), pot: rng.pick(['terracotta', 'white', 'black']) });
    if (rng.chance(0.65)) laundryLine(B, F.p(cu0 + 0.05, cv1 - 0.08, proj + 0.3), F.p(cu1 - 0.05, cv1 - 0.08, proj + 0.3), rng, rng.range(0.35, 0.6));
    // condenser below the cage
    ac.place(B, F.m(u0 + 0.12 + wu + ww * 0.5 + rng.range(-0.3, 0.3), v0 + 0.25, proj + 0.4));
  } else if (type === 'balcony') {
    const rec = Math.min(1.1, proj - 0.3);
    wallWithWindows(B, mat, front(proj - rec), fw, fh, 0.14, [{ u: 0.3, v: 0.12, w: fw - 0.6, h: 2.25, style: WIN.SLIDER, depth: proj + 3, lit: 0.62, seed: seedBase }], world.windows, { sillMat: M.concreteDark });
    // railing: posts, top rail, frosted glass with a warm reflection
    const railH = 1.05;
    for (let uu = u0 + 0.12; uu <= u0 + w - 0.12 + 1e-3; uu += (w - 0.24) / Math.max(1, Math.round((w - 0.24) / 1.0))) F.cyl(B, M.steel, 0.022, railH, uu, v0 + 0.16 + railH / 2, proj - 0.05, 'v', 8);
    F.cyl(B, M.steel, 0.028, w - 0.2, uc, v0 + 0.16 + railH, proj - 0.05, 'u', 8);
    if (rng.chance(0.5)) F.box(B, M.glassFrost, uc, v0 + 0.16 + railH * 0.5, proj - 0.06, w - 0.3, railH * 0.85, 0.012);
    else for (let uu = u0 + 0.2; uu < u0 + w - 0.15; uu += 0.11) F.cyl(B, M.steel, 0.008, railH - 0.05, uu, v0 + 0.16 + railH / 2, proj - 0.05, 'v', 4);
    // stuff on the balcony
    ac.place(B, F.m(u0 + 0.7, v0 + 0.16, proj - rec + 0.45), { floor: true });
    for (let i = 0; i < rng.int(1, 4); i++) plant(B, F.m(u0 + 1.6 + i * 0.45, v0 + 0.16, proj - 0.3), rng, { size: rng.range(0.8, 1.3) });
    laundryLine(B, F.p(u0 + 0.15, v0 + 2.35, proj - 0.55), F.p(u0 + w - 0.15, v0 + 2.35, proj - 0.55), rng, rng.range(0.5, 0.8));
    if (rng.chance(0.4)) futon(B, F.m(u0 + w * (0.3 + rng.range(0, 0.35)), v0 + 0.16 + railH + 0.03, proj - 0.05), rng, { width: Math.min(1.0, w * 0.35) });
    if (rng.chance(0.45)) {
      // folding chair
      const c = F.m(u0 + w - 0.8, v0 + 0.16, proj - 0.6);
      B.add(new THREE.BoxGeometry(0.4, 0.03, 0.4), M.plasticWhite, c.clone().multiply(T(0, 0.45, 0)));
      B.add(new THREE.BoxGeometry(0.4, 0.45, 0.03), M.plasticWhite, c.clone().multiply(T(0, 0.7, -0.2, -0.15, 0, 0)));
      for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.45), M.steel, c.clone().multiply(T(a, 0.225, b)));
    }
    if (rng.chance(0.55)) {
      // fairy lights along the top rail
      const col = rng.pick([0xffc56b, 0xff6bd6, 0x7dfcff]);
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const p = F.p(u0 + 0.15 + t * (w - 0.3), v0 + 0.16 + railH + 0.06 - Math.sin(t * Math.PI * 3) ** 2 * 0.12, proj - 0.03);
        B.add(new THREE.SphereGeometry(0.018, 6, 4), glow(col, 8), T(p.x, p.y, p.z));
      }
    }
  } else if (type === 'green') {
    // hydroponic greenhouse box: thin black frame, frosted glass lit magenta
    const cols = Math.max(2, Math.round(w / 0.8));
    const gm = new THREE.MeshStandardMaterial({ color: 0x1a0a20, roughness: 0.12, transparent: true, opacity: 0.3, emissive: 0xd23cff, emissiveIntensity: 0.22, depthWrite: false });
    F.box(B, gm, uc, v0 + h / 2, proj - 0.02, w - 0.06, h - 0.3, 0.02);
    F.box(B, gm, u0 + 0.03, v0 + h / 2, proj / 2, 0.02, h - 0.3, proj);
    F.box(B, gm, u0 + w - 0.03, v0 + h / 2, proj / 2, 0.02, h - 0.3, proj);
    for (let i = 0; i <= cols; i++) F.box(B, M.metalBlack, u0 + (i / cols) * w, v0 + h / 2, proj, 0.05, h - 0.2, 0.06);
    for (const vv of [v0 + 0.2, v0 + 1.1, v0 + 2.0, v0 + h - 0.15]) F.box(B, M.metalBlack, uc, vv, proj, w, 0.05, 0.07);
    // shelves of greens under grow bars
    for (const vv of [0.35, 1.25, 2.15]) {
      F.box(B, M.metalDark, uc, v0 + vv, proj * 0.5, w - 0.3, 0.03, proj * 0.7);
      F.box(B, glow(0xff3cf0, 6), uc, v0 + vv + 0.68, proj * 0.5, w - 0.4, 0.025, 0.05);
      for (let uu = u0 + 0.4; uu < u0 + w - 0.3; uu += 0.42) {
        plant(B, F.m(uu, v0 + vv + 0.015, proj * 0.5), rng, { size: 0.55, species: ['herbs', 'negi', 'herbs', 'snake'][Math.floor(Math.abs(uu * 7 + vv * 3)) % 4] });
      }
    }
    if (!world._greenLit) { world._greenLit = true; world.lights.push({ pos: F.p(uc, v0 + 1.5, proj + 0.6), color: 0xd23cff, intensity: 3.5, distance: 7 }); }
  } else if (type === 'ac') {
    const ww = fw - 0.4;
    wallWithWindows(B, mat, front(proj), fw, fh, 0.14, [{ u: 0.2, v: 1.85, w: ww, h: 0.55, style: WIN.RIBBON, depth: proj + 2, lit: 0.5, seed: seedBase }], world.windows, { sillMat: M.concreteDark });
    const n = Math.max(1, Math.min(3, Math.floor(fw / 1.0)));
    for (let i = 0; i < n; i++) ac.place(B, F.m(u0 + 0.6 + i * ((fw - 0.6) / n) + 0.2, v0 + 0.35 + (i % 2) * 0.72, proj + 0.38));
    // vent hood and a fat duct
    F.box(B, M.galv, u0 + w - 0.45, v0 + 2.55, proj + 0.15, 0.4, 0.3, 0.3);
    F.cyl(B, M.galv, 0.12, 1.2, u0 + w - 0.45, v0 + 1.7, proj + 0.18, 'v', 12);
  } else if (type === 'bar') {
    const ww = fw - 0.5;
    wallWithWindows(B, mat, front(proj), fw, fh, 0.14, [{ u: 0.25, v: 0.45, w: ww, h: 2.05, style: WIN.SHOP, depth: proj + 2.5, lit: 1, seed: seedBase, tint: s.color === 0x22e5ff ? 2 : 1 }], world.windows, { sillMat: M.concreteDark });
    const ns = neonSign({ text: s.label, height: 0.42, color: s.color, intensity: 6.5, materials: M, halo: 0.6, raceway: false, flicker: s.label === 'SNACK' ? 0.5 : 0, tube: 0.075 });
    const p = F.p(uc, v0 + 1.55, proj - 0.1);
    ns.group.position.copy(p); ns.group.rotation.y = F.ry;
    root.add(ns.group);
    world.lights.push({ pos: F.p(uc, v0 + 1.7, proj + 0.9), color: s.color, intensity: 4, distance: 8 });
  } else {
    // plain: sliding window with a steel hood and a flower box
    const ww = Math.min(1.8, fw - 0.6), wu = (fw - ww) / 2;
    wallWithWindows(B, mat, front(proj), fw, fh, 0.14, [{ u: wu, v: 0.85, w: ww, h: 1.3, style: WIN.SLIDER, depth: proj + 2.5, lit: 0.55, seed: seedBase }], world.windows, { sillMat: M.concreteDark });
    F.box(B, M.metalDark, uc, v0 + 0.16 + 2.3, proj + 0.18, ww + 0.3, 0.05, 0.38);
    F.box(B, M.terracotta, uc, v0 + 0.16 + 0.72, proj + 0.12, ww, 0.18, 0.22);
    for (let i = 0; i < 3; i++) plant(B, F.m(uc - ww / 3 + i * (ww / 3), v0 + 0.16 + 0.7, proj + 0.12), rng, { size: 0.5, pot: 'black' });
  }
  moduleTrim(world, B, root, F, s, rng);
}

/* How an add-on box is actually built: flashing, trims, gutters, fixings. */
function moduleTrim(world, B, root, F, s, rng) {
  const { type, u0, w, v0, h, proj, mat } = s;
  const uc = u0 + w / 2;
  const metal = rng.chance(0.5) ? M.galv : M.metalDark;
  // roof flashing with a drip-edge fascia that overhangs the face
  F.box(B, metal, uc, v0 + h + 0.015, proj / 2 + 0.03, w + 0.1, 0.03, proj + 0.1, 0.5, 0);
  F.box(B, metal, uc, v0 + h - 0.04, proj + 0.075, w + 0.1, 0.12, 0.02, 0.5, 0);
  for (const s2 of [-1, 1]) F.box(B, metal, uc + s2 * (w / 2 + 0.04), v0 + h - 0.04, proj / 2 + 0.03, 0.02, 0.12, proj + 0.1, 0.5, 0);
  if (type === 'green') return;
  // corner angles + base flashing
  for (const uu of [u0 + 0.015, u0 + w - 0.015]) F.box(B, metal, uu, v0 + h / 2, proj - 0.01, 0.05, h - 0.08, 0.05, 0.5, 0);
  F.box(B, metal, uc, v0 + 0.19, proj + 0.01, w, 0.035, 0.035, 0.5, 0);
  // cover battens on painted sheet modules
  if (mat === M.paintMint || mat === M.paintCream || mat === M.paintRed || mat === M.paintBlue) {
    for (let uu = u0 + 0.9; uu < u0 + w - 0.5; uu += 0.92) F.box(B, mat, uu, v0 + h / 2, proj + 0.008, 0.04, h - 0.35, 0.016, 0.5, 0);
    for (let uu = u0 + 0.9; uu < u0 + w - 0.5; uu += 0.92) for (let vv = v0 + 0.45; vv < v0 + h - 0.3; vv += 0.6) F.cyl(B, M.steel, 0.006, 0.01, uu, vv, proj + 0.02, 'w', 6);
  }
  // half-round gutter + downpipe with brackets
  if (rng.chance(0.55)) {
    const g = new THREE.CylinderGeometry(0.055, 0.055, w + 0.06, 10, 1, true, 0, Math.PI);
    g.rotateZ(Math.PI / 2);
    B.add(g, M.plasticGrey, F.m(uc, v0 + h - 0.12, proj + 0.14, 0, 0).multiply(T(0, 0, 0, Math.PI, 0, 0)));
    const du = rng.chance(0.5) ? u0 + 0.12 : u0 + w - 0.12;
    F.cyl(B, M.plasticGrey, 0.04, h - 0.1, du, v0 + h / 2 - 0.08, proj + 0.12, 'v', 8);
    for (let vv = v0 + 0.5; vv < v0 + h - 0.3; vv += 1.0) F.box(B, M.galv, du, vv, proj + 0.07, 0.1, 0.025, 0.1, 0.5, 0);
    world.drips = world.drips || [];
    world.drips.push(F.p(du, v0 + 0.1, proj + 0.12));
  }
  // small bathroom exhaust hood + bulkhead lamp + electricity meter
  F.box(B, M.galv, u0 + (rng.chance(0.5) ? 0.4 : w - 0.4), v0 + h - 0.5, proj + 0.07, 0.2, 0.16, 0.14);
  if (rng.chance(0.35)) {
    const lu = u0 + (rng.chance(0.5) ? 0.35 : w - 0.35), lv = v0 + 2.2;
    F.box(B, M.metalBlack, lu, lv, proj + 0.05, 0.16, 0.22, 0.08);
    F.box(B, glow(rng.chance(0.7) ? 0xffd9a0 : 0xcfe8ff, 2.2), lu, lv, proj + 0.095, 0.11, 0.16, 0.02, 0.5, 0);
    for (const dv of [-0.04, 0.04]) F.box(B, M.metalBlack, lu, lv + dv, proj + 0.1, 0.13, 0.01, 0.015, 0.5, 0);
  }
  if (rng.chance(0.25)) {
    F.box(B, M.plasticGrey, u0 + w - 0.35, v0 + 1.4, proj + 0.07, 0.24, 0.32, 0.1);
    F.box(B, M.glassFrost, u0 + w - 0.35, v0 + 1.45, proj + 0.125, 0.16, 0.1, 0.01, 0.5, 0);
    F.cyl(B, M.cable, 0.012, 1.4, u0 + w - 0.3, v0 + 2.1, proj + 0.07, 'v', 5);
  }
}

/* ===================================================================== */
/*  Corner riser + the giant blade sign + projecting light boxes          */
/* ===================================================================== */
function buildCornerAndSigns(world, B, root) {
  // corner riser (stair/elevator shaft) clad in dark panels with LED seams
  const cx0 = 7.3, cx1 = CORE_X, cz0 = CORE_Z, cz1 = 4.2, y0 = RES0, y1 = ROOF + 3.4;
  B.add(boxGeo(cx1 - cx0, y1 - y0, cz1 - cz0, 0.5), M.metalDark, T((cx0 + cx1) / 2, (y0 + y1) / 2, (cz0 + cz1) / 2));
  for (let y = y0 + 1; y < y1; y += 0.62) B.add(new THREE.BoxGeometry(cx1 - cx0 + 0.02, 0.015, cz1 - cz0 + 0.02), M.metalBlack, T((cx0 + cx1) / 2, y, (cz0 + cz1) / 2));
  for (const [x, z] of [[cx0 - 0.01, cz1 + 0.01], [cx0 - 0.01, cz0 + 0.3]]) B.add(new THREE.BoxGeometry(0.03, y1 - y0, 0.03), glow(0x19e6ff, 2.6), T(x, (y0 + y1) / 2, z));
  // stair windows on the riser (lit landing every floor)
  for (let f = 0; f < NFLOORS; f++) {
    world.windows.add(cx0 - 0.01, RES0 + f * FLOOR + 1.9, (cz0 + cz1) / 2 + 0.15, -Math.PI / 2, 0.5, 1.0, { style: WIN.GRID, depth: 1.2, lit: 0.9, seed: 300 + f, kind: 'stair' });
  }

  // ===== the 鯉亭 blade sign: 15 m double-sided light box with chasers =====
  const W = 1.35, Hs = 15.0, yC = 14.4;
  const sign = lightBox({
    w: W, h: Hs, d: 0.42, px: 110, intensity: 1.3, bracket: 0.32, painter: (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5c0008'); g.addColorStop(0.5, '#b00012'); g.addColorStop(1, '#4a0006');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      // koi crest at the top
      x.save(); x.translate(w / 2, 150);
      x.strokeStyle = '#ffd36a'; x.lineWidth = 8; x.beginPath(); x.arc(0, 0, 58, 0, 7); x.stroke();
      x.fillStyle = '#ffd36a';
      for (const s of [1, -1]) { x.save(); x.rotate(s > 0 ? 0.2 : Math.PI + 0.2); x.beginPath(); x.moveTo(-40, -6); x.bezierCurveTo(-20, -34, 20, -32, 34, -10); x.lineTo(46, -24); x.lineTo(42, -4); x.lineTo(50, 10); x.bezierCurveTo(26, 0, -10, 6, -40, -6); x.fill(); x.restore(); }
      x.restore();
      vtext(x, '鯉亭', w / 2, 340, 150, `bold 128px ${JPM}`, '#ffffff', '#2a0004', 10);
      x.fillStyle = '#ffd36a'; x.fillRect(20, 520, w - 40, 6);
      vtext(x, 'ラーメン', w / 2, 620, 122, `bold 104px ${JP}`, '#fff3d6', '#2a0004', 8);
      x.fillStyle = '#ffd36a'; x.fillRect(20, 1050, w - 40, 6);
      vtext(x, '深夜四時迄', w / 2, 1120, 74, `bold 60px ${JPM}`, '#ffd36a');
      x.fillStyle = '#ffd36a'; x.fillRect(20, 1460, w - 40, 6);
      x.font = `900 26px ${LAT}`; x.fillStyle = '#ffffff'; x.textAlign = 'center';
      x.fillText('KOI-TEI', w / 2, 1530); x.fillText('EST.2041', w / 2, 1575);
    },
  });
  sign.rotation.y = Math.PI;
  sign.position.set(7.3, yC, 3.35);
  root.add(sign);
  // marquee bulbs on both faces
  for (const s of [1, -1]) {
    const pts = rectPerimeter(W + 0.12, Hs + 0.12, 0.24, 0);
    const ch = chaser(pts, { color: 0xffcf6a, r: 0.04, speed: 7, gap: 4, intensity: 4.5 });
    ch.position.set(7.3 - 0.32 - W / 2, yC, 3.35 + s * 0.24);
    root.add(ch);
  }
  world.lights.push({ pos: new THREE.Vector3(6.2, yC - 3, 4.6), color: 0xff2030, intensity: 14, distance: 16 });
  world.lights.push({ pos: new THREE.Vector3(6.2, yC + 4.5, 2.2), color: 0xff2030, intensity: 10, distance: 13 });

  // smaller projecting light boxes along the street face
  const box = (yy, zz, painter, w = 0.7, h = 1.9) => {
    const g = lightBox({ w, h, d: 0.2, px: 140, intensity: 1.5, painter, bracket: 0.3 });
    g.rotation.y = Math.PI; g.position.set(CORE_X - 2.35, yy, zz); root.add(g);
    return g;
  };
  box(19.6, -12.6, (x, w, h) => {
    x.fillStyle = '#f2fff4'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#0b8a3a'; x.fillRect(0, 0, w, 120);
    x.fillStyle = '#fff'; x.font = `900 60px ${LAT}`; x.textAlign = 'center'; x.fillText('✚', w / 2, 84);
    vtext(x, '鍼灸院', w / 2, 190, 74, `bold 66px ${JPM}`, '#0b5a2a');
    x.font = `bold 22px ${LAT}`; x.fillStyle = '#0b5a2a'; x.fillText('ACUPUNCTURE 4F', w / 2, h - 24);
  });
  box(24.9, -6.4, (x, w, h) => {
    x.fillStyle = '#0d1430'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#7ad7ff'; x.lineWidth = 5; x.strokeRect(10, 10, w - 20, h - 20);
    vtext(x, '探偵事務所', w / 2, 70, 50, `bold 46px ${JPM}`, '#e9f6ff');
    x.font = `bold 20px ${LAT}`; x.fillStyle = '#7ad7ff'; x.fillText('DETECTIVE · 5F', w / 2, h - 24);
  }, 0.62, 1.75);
  box(30.8, -10.2, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff3d9a'); g.addColorStop(1, '#7b1fff');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    vtext(x, '雀荘', w / 2, 90, 110, `bold 96px ${JPM}`, '#fff', '#3a0030', 6);
    x.font = `900 30px ${LAT}`; x.fillStyle = '#fff'; x.fillText('MAHJONG', w / 2, h - 60); x.fillText('7F', w / 2, h - 22);
  });
}

/* ===================================================================== */
/*  Fire escape on the alley face                                          */
/* ===================================================================== */
function buildFireEscape(world, B, root) {
  const x0 = 15.3, x1 = 20.9, zIn = CORE_Z, zOut = CORE_Z + 1.35;
  const rail = M.metalDark;
  const grateMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.8, roughness: 0.45, alphaMap: null });
  const grid = drawCanvas(64, 64, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { x.fillRect(i * 8, 0, 2, 64); } for (let j = 0; j < 4; j++) x.fillRect(0, j * 16, 64, 2); }, { srgb: false });
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
  grateMat.alphaMap = grid; grateMat.alphaTest = 0.5; grateMat.side = THREE.DoubleSide;
  for (let f = 0; f <= NFLOORS; f++) {
    const y = RES0 + f * FLOOR;
    // landing (grating) + structure
    const g = new THREE.PlaneGeometry(x1 - x0, zOut - zIn);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) * 3, uv.getY(i) * (zOut - zIn) * 3);
    B.add(g, grateMat, T((x0 + x1) / 2, y + 0.02, (zIn + zOut) / 2, -Math.PI / 2, 0, 0));
    B.add(new THREE.BoxGeometry(x1 - x0, 0.12, 0.06), rail, T((x0 + x1) / 2, y - 0.04, zOut));
    B.add(new THREE.BoxGeometry(0.06, 0.12, zOut - zIn), rail, T(x0, y - 0.04, (zIn + zOut) / 2));
    B.add(new THREE.BoxGeometry(0.06, 0.12, zOut - zIn), rail, T(x1, y - 0.04, (zIn + zOut) / 2));
    // diagonal bracket to the wall
    B.rod(rail, 0.025, new THREE.Vector3(x0 + 0.3, y - 0.05, zOut - 0.05), new THREE.Vector3(x0 + 0.3, y - 1.1, zIn));
    B.rod(rail, 0.025, new THREE.Vector3(x1 - 0.3, y - 0.05, zOut - 0.05), new THREE.Vector3(x1 - 0.3, y - 1.1, zIn));
    // railing
    for (let x = x0; x <= x1 + 1e-3; x += 0.7) B.rod(rail, 0.018, new THREE.Vector3(x, y, zOut), new THREE.Vector3(x, y + 1.05, zOut));
    B.rod(rail, 0.022, new THREE.Vector3(x0, y + 1.05, zOut), new THREE.Vector3(x1, y + 1.05, zOut));
    B.rod(rail, 0.014, new THREE.Vector3(x0, y + 0.55, zOut), new THREE.Vector3(x1, y + 0.55, zOut));
    for (const x of [x0, x1]) { B.rod(rail, 0.018, new THREE.Vector3(x, y + 1.05, zIn), new THREE.Vector3(x, y + 1.05, zOut)); }
    // fire door with lit wired-glass vision panel
    if (f < NFLOORS) {
      B.add(new THREE.BoxGeometry(0.95, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 0.5, metalness: 0.5 }), T(16.0, y + 1.07, zIn + 0.03));
      B.add(new THREE.BoxGeometry(0.22, 0.4, 0.02), glow(0xbfe8ff, 1.2), T(16.0, y + 1.55, zIn + 0.07));
      B.add(new THREE.BoxGeometry(0.3, 0.12, 0.03), glow(0x30ff70, 3), T(16.0, y + 2.35, zIn + 0.06)); // exit sign
    }
    // stairs to the next landing
    if (f < NFLOORS) {
      const dir = f % 2 === 0 ? 1 : -1;
      const sx0 = dir > 0 ? x0 + 1.4 : x1 - 0.2, sx1 = dir > 0 ? x1 - 0.2 : x0 + 1.4;
      const steps = 15;
      const zS = zIn + 0.75;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        B.add(new THREE.BoxGeometry(Math.abs(sx1 - sx0) / steps + 0.02, 0.03, 0.62), grateMat, T(sx0 + (sx1 - sx0) * t, y + FLOOR * t, zS));
      }
      for (const dz of [-0.33, 0.33]) B.rod(rail, 0.03, new THREE.Vector3(sx0, y, zS + dz), new THREE.Vector3(sx1, y + FLOOR, zS + dz));
      B.rod(rail, 0.018, new THREE.Vector3(sx0, y + 1.0, zS + 0.36), new THREE.Vector3(sx1, y + FLOOR + 1.0, zS + 0.36));
    }
  }
  // drop ladder down past the capsule floors
  for (const x of [x1 - 0.55, x1 - 0.15]) B.rod(rail, 0.02, new THREE.Vector3(x, RES0, zOut - 0.1), new THREE.Vector3(x, 5.6, zOut + 1.05));
  for (let i = 1; i < 20; i++) {
    const t = i / 20;
    const p = new THREE.Vector3(x1 - 0.35, RES0 + (5.6 - RES0) * t, zOut - 0.1 + 1.15 * t);
    B.rod(rail, 0.012, new THREE.Vector3(x1 - 0.55, p.y, p.z), new THREE.Vector3(x1 - 0.15, p.y, p.z));
  }
}

/* ===================================================================== */
/*  Roof                                                                  */
/* ===================================================================== */
function buildRoof(world, B, root, rng) {
  const x0 = CORE_X, x1 = 21.5, z0 = -14, z1 = CORE_Z, y = ROOF;
  B.add(boxGeo(x1 - x0, 0.3, z1 - z0, 0.25), M.concreteDark, T((x0 + x1) / 2, y - 0.15, (z0 + z1) / 2));
  // parapet + cap
  const pw = 0.22, ph = 1.1;
  B.add(boxGeo(pw, ph, z1 - z0, 0.5), M.concreteWarm, T(x0 + pw / 2, y + ph / 2, (z0 + z1) / 2));
  B.add(boxGeo(pw, ph, z1 - z0, 0.5), M.concreteWarm, T(x1 - pw / 2, y + ph / 2, (z0 + z1) / 2));
  B.add(boxGeo(x1 - x0, ph, pw, 0.5), M.concreteWarm, T((x0 + x1) / 2, y + ph / 2, z0 + pw / 2));
  B.add(boxGeo(x1 - x0, ph, pw, 0.5), M.concreteWarm, T((x0 + x1) / 2, y + ph / 2, z1 - pw / 2));
  for (const [cx, cz, lx, lz] of [[x0, (z0 + z1) / 2, 0.3, z1 - z0], [x1, (z0 + z1) / 2, 0.3, z1 - z0], [(x0 + x1) / 2, z0, x1 - x0, 0.3], [(x0 + x1) / 2, z1, x1 - x0, 0.3]]) {
    B.add(new THREE.BoxGeometry(lx + 0.02, 0.05, lz + 0.02), M.galv, T(cx + (cx === x0 ? pw / 2 : cx === x1 ? -pw / 2 : 0), y + ph + 0.025, cz + (cz === z0 ? pw / 2 : cz === z1 ? -pw / 2 : 0)));
  }
  // rooftop neon: KOI-TEI on a steel lattice facing the street
  const nt = neonSign({ text: 'KOI-TEI', height: 1.55, color: 0x2af3ff, intensity: 6.5, materials: M, halo: 0.0, raceway: false, tube: 0.06 });
  nt.group.position.set(x0 - 0.05, y + ph + 0.55, -6.6); nt.group.rotation.y = -Math.PI / 2;
  root.add(nt.group);
  for (let z = -11.4; z <= -1.8; z += 1.2) {
    B.rod(M.metalDark, 0.03, new THREE.Vector3(x0 + 0.15, y + ph, z), new THREE.Vector3(x0 + 0.15, y + ph + 2.3, z));
    B.rod(M.metalDark, 0.02, new THREE.Vector3(x0 + 0.15, y + ph, z), new THREE.Vector3(x0 + 0.15, y + ph + 2.3, z + 1.2));
    B.rod(M.metalDark, 0.025, new THREE.Vector3(x0 + 0.15, y + ph + 2.3, z), new THREE.Vector3(x0 + 1.2, y, z));
  }
  B.rod(M.metalDark, 0.03, new THREE.Vector3(x0 + 0.15, y + ph + 0.5, -11.4), new THREE.Vector3(x0 + 0.15, y + ph + 0.5, -1.8));
  B.rod(M.metalDark, 0.03, new THREE.Vector3(x0 + 0.15, y + ph + 2.3, -11.4), new THREE.Vector3(x0 + 0.15, y + ph + 2.3, -1.8));
  world.lights.push({ pos: new THREE.Vector3(x0 - 1.5, y + 2, -6.6), color: 0x2af3ff, intensity: 9, distance: 14 });

  // water tank on its stand
  waterTank().place(B, T(18.6, y, -10.2));
  // elevator machine room with louvres + door
  B.add(boxGeo(3.2, 3.0, 3.2, 0.3), M.concreteWarm, T(19.4, y + 1.5, -4.2));
  B.add(new THREE.BoxGeometry(3.4, 0.15, 3.4), M.concreteDark, T(19.4, y + 3.05, -4.2));
  for (let i = 0; i < 8; i++) B.add(new THREE.BoxGeometry(0.02, 0.06, 1.4), M.galv, T(17.78, y + 1.7 + i * 0.1, -4.2, 0, 0, 0.6));
  B.add(new THREE.BoxGeometry(0.9, 2.0, 0.05), new THREE.MeshStandardMaterial({ color: 0x324048, metalness: 0.6, roughness: 0.45 }), T(19.4, y + 1.0, -2.58));
  B.add(new THREE.BoxGeometry(0.2, 0.1, 0.06), glow(0xff3020, 3), T(19.4, y + 2.25, -2.56));
  // stair penthouse on the corner riser top is the riser itself; add a door light
  B.add(new THREE.BoxGeometry(0.2, 0.12, 0.05), glow(0xfff1c0, 3), T(8.25, ROOF + 2.6, 4.23));

  // lattice antenna mast with blinking aviation light
  const mx = 16.4, mz = 0.4, mh = 13;
  const legs = [[-0.35, -0.35], [0.35, -0.35], [0.35, 0.35], [-0.35, 0.35]];
  for (const [a, b] of legs) B.rod(M.metalDark, 0.035, new THREE.Vector3(mx + a, y, mz + b), new THREE.Vector3(mx + a * 0.3, y + mh, mz + b * 0.3));
  for (let k = 0; k < 10; k++) {
    const t0 = k / 10, t1 = (k + 1) / 10;
    for (let i = 0; i < 4; i++) {
      const [a, b] = legs[i], [c, d] = legs[(i + 1) % 4];
      const s0 = 1 - 0.7 * t0, s1 = 1 - 0.7 * t1;
      B.rod(M.galv, 0.012, new THREE.Vector3(mx + a * s0, y + mh * t0, mz + b * s0), new THREE.Vector3(mx + c * s1, y + mh * t1, mz + d * s1));
    }
  }
  B.rod(M.galv, 0.02, new THREE.Vector3(mx, y + mh, mz), new THREE.Vector3(mx, y + mh + 4, mz));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), glow(0xff1a1a, 12).clone());
  beacon.position.set(mx, y + mh + 4.05, mz); root.add(beacon);
  world.updaters.push((t) => { beacon.visible = (t % 1.6) < 0.25; });
  for (let i = 0; i < 3; i++) dish().place(B, T(mx + Math.cos(i * 2.1) * 0.5, y + 5 + i * 2.2, mz + Math.sin(i * 2.1) * 0.5, 0, i * 2.1 + 0.6, 0, 1.4));
  // rooftop dishes on the parapet + a little garden of styrofoam planters
  for (const [x, z, ry] of [[x1 - 0.5, -12.5, 0.8], [x1 - 0.5, -8, 1.2], [12, z0 + 0.5, -2.6]]) dish().place(B, T(x, y + ph + 0.3, z, 0, ry, 0, 1.3));
  for (let i = 0; i < 6; i++) {
    const px = 11 + (i % 3) * 1.1, pz = -12.6 + Math.floor(i / 3) * 0.8;
    B.add(new THREE.BoxGeometry(0.9, 0.35, 0.55), M.plasticWhite, T(px, y + 0.17, pz));
    for (let k = 0; k < 3; k++) plant(B, T(px - 0.3 + k * 0.3, y + 0.2, pz), rng, { size: 0.6, pot: 'black' });
  }
  laundryLine(B, new THREE.Vector3(11, y + 1.9, -9.3), new THREE.Vector3(15.6, y + 1.9, -9.3), rng, 0.7);
  for (const x of [11, 15.6]) B.rod(M.galv, 0.025, new THREE.Vector3(x, y, -9.3), new THREE.Vector3(x, y + 2.0, -9.3));

  // koi hologram projector
  buildKoiHologram(world, root, new THREE.Vector3(13.6, y, -4.4));
}

/* ===================================================================== */
/*  Alley life: bins, crates, bike, bags, a cat bowl                       */
/* ===================================================================== */
function buildAlleyLife(world, B, root, rng) {
  // dumpster
  const dm = new THREE.MeshStandardMaterial({ color: 0x1f4a3a, roughness: 0.55, metalness: 0.6 });
  B.add(new THREE.BoxGeometry(1.9, 1.15, 1.05), dm, T(23.5, 0.68, 7.6));
  B.add(new THREE.BoxGeometry(1.95, 0.06, 1.1), M.plasticBlack, T(23.5, 1.3, 7.55, -0.25, 0, 0));
  for (const x of [22.7, 24.3]) for (const z of [7.2, 8.0]) B.add(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), M.rubber, T(x, 0.12, z, Math.PI / 2, 0, 0));
  // trash bags piled by the dumpster and under the AC drip
  for (let i = 0; i < 7; i++) trashBag(B, T(21.3 + rng.range(-0.6, 0.8), 0.1, 7.9 + rng.range(-0.5, 0.6)), rng);
  // beer crates + bike against the wall
  crateStack(B, T(13.6, 0.1, 4.45), rng, 4);
  crateStack(B, T(14.1, 0.1, 4.45, 0, 0.3, 0), rng, 2);
  bicycle(root, 18.2, 0.1, 4.55, 0.0, 0x2b6f86);
  // AC drain drip + puddles are handled by the wet ground; add a cat food bowl
  B.add(new THREE.CylinderGeometry(0.09, 0.07, 0.05, 14), M.plasticRed, T(17.2, 0.13, 4.4));
  // alley light: caged fluorescent tube over the back door already; add a string of bulbs across the alley
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const p = new THREE.Vector3(9 + t * 16, 6.2 - Math.sin(t * Math.PI) * 0.9, 4.2 + t * 4.6);
    B.add(new THREE.SphereGeometry(0.05, 8, 6), glow(0xffc779, 7), T(p.x, p.y, p.z));
  }
  B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 15 }, (_, i) => { const t = i / 14; return new THREE.Vector3(9 + t * 16, 6.25 - Math.sin(t * Math.PI) * 0.9, 4.2 + t * 4.6); })), 40, 0.006, 4), M.cable);
  world.lights.push({ pos: new THREE.Vector3(17, 5.4, 6.5), color: 0xffb05a, intensity: 6, distance: 12 });
}
