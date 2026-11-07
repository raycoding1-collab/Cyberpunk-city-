import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, T, RNG, U, boxGeo, GLSL_NOISE } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';
import { Frame, wallWithOpenings } from '../core/facade.js';
import { WIN } from '../core/windows.js';
import { neonSign } from '../core/neon.js';
import { acUnit, plant, lantern } from '../core/prefabs.js';
import { lightBox, faceMaterial, chaser, rectPerimeter, JP, JPM, LAT, vtext, rr } from './signs.js';
import { L } from './layout.js';

/* =================================================================== */
/*  The district beyond the block: the cross street with its maglev    */
/*  guideway and signals, the next blocks north (love hotel, glass     */
/*  office, pachinko palace, record store, a tiny Inari shrine), a     */
/*  far skyline in fog, flying traffic lanes and the Tenkū Spire.      */
/* =================================================================== */

export function buildDistrict(world) {
  const root = new THREE.Group(); root.name = 'district';
  world.scene.add(root);
  const B = new Batch('district');
  const rng = new RNG(9001);
  buildMaglev(world, B, root);
  buildSignals(world, B, root);
  buildNorthBlocks(world, B, root, rng);
  buildCrossStreetWalls(world, B, root, rng);
  B.build(root);
  buildSkyline(world, root, rng);
  buildFiller(world, root, rng);
  buildSpire(world, root);
  buildSkyTraffic(world, root, rng);
  return root;
}

/* ------------------------------ Maglev -------------------------------- */
function buildMaglev(world, B, root) {
  const z = L.maglev.z, y = L.maglev.y, X = 170;
  const beamTop = y;
  // box-girder guideway with T-rail, LED lip and maintenance lights
  B.add(boxGeo(X * 2, 1.6, 3.2, 0.25), M.concrete, T(0, beamTop - 0.8, z));
  B.add(boxGeo(X * 2, 0.5, 1.0, 0.25), M.concreteDark, T(0, beamTop + 0.25, z));
  B.add(new THREE.BoxGeometry(X * 2, 0.08, 1.4), M.steel, T(0, beamTop + 0.54, z));
  for (const s of [-1, 1]) {
    B.add(new THREE.BoxGeometry(X * 2, 0.05, 0.05), glow(0x19e6ff, 3.5), T(0, beamTop - 1.55, z + s * 1.62));
    B.add(new THREE.BoxGeometry(X * 2, 0.6, 0.06), M.metalDark, T(0, beamTop + 0.3, z + s * 1.55));
  }
  for (let x = -X; x <= X; x += 6) B.add(new THREE.BoxGeometry(0.4, 0.04, 0.4), glow(0x6fb8ff, 3), T(x, beamTop - 1.62, z));
  // Y-shaped pylons on the cross-street median
  for (const px of [-16, 16, -52, 52, -90, 90]) {
    B.add(boxGeo(1.6, beamTop - 3.2, 1.6, 0.25), M.concrete, T(px, (beamTop - 3.2) / 2, z));
    B.add(boxGeo(4.0, 1.6, 3.2, 0.25), M.concrete, T(px, beamTop - 2.4, z));
    for (const s of [-1, 1]) B.boxR(M.concrete, 0.8, 2.4, 1.4, px + s * 1.2, beamTop - 3.6, z, 0, 0, -s * 0.5, 0.25);
    B.add(new THREE.BoxGeometry(1.7, 0.4, 1.7), M.concreteDark, T(px, 0.2, z));
    // pylon wrapped in a hazard-striped crash barrier and a poster ring
    B.add(new THREE.CylinderGeometry(1.25, 1.25, 1.0, 24, 1, true), M.plasticYellow, T(px, 0.5, z));
  }
  // the train: three articulated cars with lit windows and a glowing band
  const train = new THREE.Group(); root.add(train);
  const TB = new Batch('train');
  const body = new THREE.MeshPhysicalMaterial({ color: 0xe8ecf2, roughness: 0.25, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 });
  const winTex = drawCanvas(1024, 64, (x) => {
    x.fillStyle = '#05060a'; x.fillRect(0, 0, 1024, 64);
    for (let i = 0; i < 16; i++) {
      const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#fff6e4'); g.addColorStop(1, '#ffd9a0');
      x.fillStyle = g; x.fillRect(i * 64 + 6, 8, 52, 48);
      // passengers: standing / seated silhouettes
      x.fillStyle = 'rgba(20,16,24,0.85)';
      for (let k = 0; k < 2; k++) { if ((i * 7 + k * 3) % 5 < 3) { const px = i * 64 + 14 + k * 22; x.beginPath(); x.arc(px, 24, 6, 0, 7); x.fill(); x.fillRect(px - 7, 30, 14, 26); } }
    }
  }, { srgb: true });
  const winMat = new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(2.2, 2.0, 1.8) });
  const carL = 18, carW = 2.9, carH = 3.1;
  for (let c = 0; c < 3; c++) {
    const cx = (c - 1) * (carL + 0.6);
    TB.add(new RoundedBoxGeometry(carL, carH, carW, 4, 0.6), body, T(cx, carH / 2, 0));
    for (const s of [-1, 1]) {
      const w = new THREE.PlaneGeometry(carL - 2.4, 0.9);
      TB.add(w, winMat, T(cx, carH * 0.62, s * (carW / 2 + 0.005), 0, s > 0 ? 0 : Math.PI, 0));
      TB.add(new THREE.BoxGeometry(carL - 1, 0.07, 0.02), glow(0x19e6ff, 7), T(cx, carH * 0.33, s * (carW / 2 + 0.01)));
    }
    TB.add(new THREE.BoxGeometry(carL - 0.4, 0.5, carW - 0.6), M.metalDark, T(cx, -0.1, 0));
  }
  // noses
  for (const s of [-1, 1]) {
    const nose = new THREE.SphereGeometry(1.5, 24, 16, 0, Math.PI);
    TB.add(nose, body, T(s * (1.5 * carL + 0.6), carH * 0.5, 0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 1.0, 1.0, 1.6));
    TB.add(new THREE.BoxGeometry(0.05, 0.12, 2.0), glow(s > 0 ? 0xffffff : 0xff2030, 10), T(s * (1.5 * carL + 0.6 + 2.35), carH * 0.45, 0));
  }
  TB.build(train);
  const tl = new THREE.PointLight(0xbfe6ff, 22, 30, 1.5); tl.position.set(0, -1.5, 0); train.add(tl);
  train.position.set(-400, beamTop + 0.7, z);
  world.updaters.push((t) => {
    const period = 30, c = t % period, dir = Math.floor(t / period) % 2 ? -1 : 1;
    const run = 12;
    const k = Math.min(1, c / run);
    const x = THREE.MathUtils.lerp(-230, 230, k) * dir;
    train.position.x = c < run ? x : 1000;
    tl.intensity = c < run ? 22 : 0;
  });
  world.train = train;
}

/* ---------------------------- Traffic signals -------------------------- */
function signalHead(B, root, x, y, z, ry, lamps) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
  const housing = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.42, 0.25, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6 }));
  g.add(housing);
  const out = [];
  [0x10e8b0, 0xffb000, 0xff1a1a].forEach((c, i) => {
    const lx = -0.4 + i * 0.4;
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.22, 16, 1, true, -Math.PI / 2, Math.PI), M.metalDark);
    visor.rotation.x = Math.PI / 2; visor.rotation.y = Math.PI; visor.position.set(lx, 0.02, 0.2); g.add(visor);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.06) }));
    lens.position.set(lx, 0, 0.13); g.add(lens);
    out.push({ lens, c: new THREE.Color(c) });
  });
  lamps.push(out);
  return g;
}

function buildSignals(world, B, root) {
  const lamps = [];
  const pole = (x, z) => {
    B.add(new THREE.CylinderGeometry(0.11, 0.13, 6.4, 12), M.galv, T(x, 3.2 + 0.18, z));
    B.add(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12), M.galv, T(x, 0.33, z));
  };
  // south-facing heads (toward the camera / north-bound traffic)
  pole(5.7, -31.2); B.rod(M.galv, 0.07, new THREE.Vector3(5.7, 5.9, -31.2), new THREE.Vector3(-1.5, 5.9, -31.2));
  signalHead(B, root, -0.5, 5.6, -31.15, 0, lamps);
  signalHead(B, root, 3.0, 5.6, -31.15, 0, lamps);
  pole(-5.7, -44.6); B.rod(M.galv, 0.07, new THREE.Vector3(-5.7, 5.9, -44.6), new THREE.Vector3(1.5, 5.9, -44.6));
  signalHead(B, root, 0.5, 5.6, -44.65, Math.PI, lamps);
  // pedestrian signals with man icons
  const pedTex = (walk) => drawCanvas(128, 256, (x) => {
    x.fillStyle = '#050505'; x.fillRect(0, 0, 128, 256);
    const c = walk ? '#18e6b4' : '#ff2020';
    x.fillStyle = c;
    const cx = 64, cy = walk ? 196 : 70;
    x.beginPath(); x.arc(cx, cy - 34, 11, 0, 7); x.fill();
    x.fillRect(cx - 9, cy - 20, 18, 34);
    if (walk) { x.save(); x.translate(cx, cy + 12); x.rotate(0.35); x.fillRect(-5, 0, 9, 30); x.restore(); x.save(); x.translate(cx, cy + 12); x.rotate(-0.4); x.fillRect(-4, 0, 9, 30); x.restore(); }
    else { x.fillRect(cx - 8, cy + 12, 7, 30); x.fillRect(cx + 1, cy + 12, 7, 30); }
  });
  const pedR = faceMaterial(pedTex(false), 2.2), pedG = faceMaterial(pedTex(true), 2.2);
  const peds = [];
  for (const [x, z, ry] of [[5.7, -31.2, 0], [-5.7, -44.6, Math.PI], [-5.8, -31.0, 0]]) {
    if (x < 0 && z > -40) pole(x, z);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.28), M.metalDark); box.position.set(x, 2.9, z + (ry === 0 ? 0.25 : -0.25)); box.rotation.y = ry; root.add(box);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.75), pedR); f.position.set(x, 2.9, z + (ry === 0 ? 0.4 : -0.4)); f.rotation.y = ry; root.add(f);
    peds.push(f);
  }
  // signal phase machine (green 11 s → amber 3 s → red 14 s)
  world.updaters.push((t) => {
    const c = t % 28;
    const phase = c < 11 ? 0 : c < 14 ? 1 : 2;
    for (const head of lamps) head.forEach((l, i) => l.lens.material.color.copy(l.c).multiplyScalar(i === phase ? 5.5 : 0.05));
    const walk = phase === 2 && c < 26;
    const blink = phase === 2 && c > 23 && Math.sin(t * 12) < 0;
    for (const p of peds) p.material = walk && !blink ? pedG : pedR;
  });
}

/* ------------------------------ North blocks --------------------------- */
function tower(world, B, { x0, x1, z0, z1, h, mat, faces, floor = 3.4, bay = 3.2, style = WIN.PLAIN, lit = 0.45, ground = 4.5, bands = true, winW = 0.72, winH = 0.62 }) {
  B.add(boxGeo(x1 - x0, h, z1 - z0, 0.25), mat, T((x0 + x1) / 2, h / 2, (z0 + z1) / 2));
  const frames = {
    '+x': new Frame('+x', x1, 0, z1), '-x': new Frame('-x', x0, 0, z0), '+z': new Frame('+z', x0, 0, z1), '-z': new Frame('-z', x1, 0, z0),
  };
  const lens = { '+x': z1 - z0, '-x': z1 - z0, '+z': x1 - x0, '-z': x1 - x0 };
  for (const f of faces) {
    const F = frames[f], len = lens[f];
    const n = Math.max(1, Math.round(len / bay)), bw = len / n;
    for (let y = ground; y + floor <= h - 0.5; y += floor) {
      for (let i = 0; i < n; i++) {
        const c = F.p(i * bw + bw / 2, y + floor * 0.55, 0.03);
        world.windows.add(c.x, c.y, c.z, F.ry, bw * winW, floor * winH, { style, depth: 3.5, lit, seed: c.x * 1.7 + c.y * 3.1 + c.z * 5.3 });
      }
      if (bands) F.box(B, M.concreteDark, len / 2, y, 0.08, len, 0.18, 0.16);
    }
  }
  return frames;
}

function buildNorthBlocks(world, B, root, rng) {
  // ---- NE: HOTEL LUNA (love hotel with a fairy-tale crown) ----
  const luna = tower(world, B, { x0: 7.5, x1: 20, z0: -60, z1: -44.2, h: 30, mat: M.tileCream, faces: ['-x', '+z'], style: WIN.PLAIN, lit: 0.35, floor: 3.2, winW: 0.5, winH: 0.5 });
  for (const [x, z] of [[8.5, -45.2], [19, -45.2], [8.5, -59]]) {
    B.add(new THREE.CylinderGeometry(1.0, 1.0, 6, 16), M.tileCream, T(x, 33, z));
    B.add(new THREE.ConeGeometry(1.3, 3.2, 16), new THREE.MeshStandardMaterial({ color: 0x5a1a6a, roughness: 0.4, metalness: 0.3 }), T(x, 37.6, z));
    B.add(new THREE.SphereGeometry(0.12, 8, 6), glow(0xff7ae0, 8), T(x, 39.3, z));
  }
  const lunaSign = neonSign({ text: 'HOTEL LUNA', height: 1.0, color: 0xff5ad8, intensity: 6, materials: M, halo: 0.7, raceway: true, tube: 0.07 });
  lunaSign.group.applyMatrix4(luna['-x'].m(7.8, 20.5, 0.12)); root.add(lunaSign.group);
  const moon = neonSign({ text: 'C', height: 2.2, color: 0xffe9a0, intensity: 6, materials: M, halo: 0.6, raceway: false, tube: 0.07 });
  moon.group.applyMatrix4(luna['-x'].m(7.8, 23.2, 0.12)); root.add(moon.group);
  const rest = lightBox({ w: 0.8, h: 3.2, d: 0.25, px: 120, intensity: 1.4, painter: (x, w, h) => {
    x.fillStyle = '#2a0838'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ff7ae0'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
    vtext(x, '休憩', w / 2, 80, 95, `bold 80px ${JPM}`, '#ffd6f6'); x.font = `bold 44px ${LAT}`; x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('¥4900', w / 2, 300);
    x.font = `bold 34px ${JP}`; x.fillText('空室あり', w / 2, 360);
  } });
  rest.rotation.y = Math.PI; rest.position.set(7.5, 7.0, -45.4); root.add(rest);

  // ---- E: glass office slab with vertical screen ----
  tower(world, B, { x0: 7.5, x1: 26, z0: -82, z1: -61, h: 62, mat: M.metalDark, faces: ['-x', '+z'], style: WIN.GRID, lit: 0.3, floor: 3.6, bay: 3.0, winW: 0.97, winH: 0.88, bands: false });
  const vscreen = new THREE.Mesh(new THREE.PlaneGeometry(4, 30), new THREE.ShaderMaterial({
    uniforms: { uTime: U.time },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; ${GLSL_NOISE}
      void main(){ vec2 p = vUv * vec2(1.0, 7.5); float n = fbm(p * 1.5 + vec2(0.0, -uTime * 0.25));
        vec3 c = mix(vec3(0.02, 0.1, 0.35), vec3(0.1, 0.9, 1.0), smoothstep(0.35, 0.75, n));
        c = mix(c, vec3(1.0, 0.2, 0.6), smoothstep(0.7, 0.9, fbm(p * 3.0 + uTime * 0.1)));
        float ch = step(0.5, hash12(floor(vec2(vUv.x * 8.0, vUv.y * 60.0 - uTime * 6.0)))) * step(0.85, fract(vUv.x * 8.0)) ;
        gl_FragColor = vec4(c * 1.6 + ch * 0.3, 1.0); }`,
  }));
  vscreen.position.set(7.4, 34, -64); vscreen.rotation.y = -Math.PI / 2; root.add(vscreen);

  // ---- E: PACHINKO 銀河 palace ----
  tower(world, B, { x0: 7.5, x1: 22, z0: -104, z1: -83, h: 22, mat: M.paintRed, faces: ['-x'], style: WIN.PLAIN, lit: 0.2, ground: 9 });
  const pach = neonSign({ text: 'PACHINKO', height: 1.6, color: 0xffd400, intensity: 6.5, materials: M, halo: 0.7, raceway: true, tube: 0.07, flicker: 0.0 });
  pach.group.applyMatrix4(new Frame('-x', 7.5, 0, -104).m(10.5, 5.0, 0.2)); root.add(pach.group);
  const ginga = lightBox({ w: 1.6, h: 9, d: 0.4, px: 90, intensity: 1.6, painter: (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff004c'); g.addColorStop(1, '#ffb000'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    vtext(x, '銀河', w / 2, 140, 170, `bold 130px ${JPM}`, '#ffffff', '#600010', 10);
    x.font = `900 46px ${LAT}`; x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('GINGA', w / 2, 520); x.fillText('777', w / 2, 600);
  } });
  ginga.rotation.y = Math.PI; ginga.position.set(7.5, 13, -84); root.add(ginga);
  const gp = rectPerimeter(1.75, 9.15, 0.25, 0);
  const gch = chaser(gp, { color: 0xffffff, r: 0.05, speed: 14, gap: 2, intensity: 5 });
  gch.position.set(7.5 - 0.35 - 0.8, 13, -84 + 0.22); root.add(gch);
  world.lights.push({ pos: new THREE.Vector3(5, 6, -94), color: 0xffa000, intensity: 7, distance: 14 });

  // ---- NW: 夜行 RECORDS & BOOKS ----
  const rec = tower(world, B, { x0: -22, x1: -7.5, z0: -62, z1: -44.2, h: 24, mat: M.brick, faces: ['+x', '+z'], style: WIN.SLIDER, lit: 0.5, floor: 3.4 });
  const vinylSign = neonSign({ text: 'RECORDS', height: 0.9, color: 0x3af2ff, intensity: 6, materials: M, halo: 0.6, raceway: true, tube: 0.07 });
  vinylSign.group.applyMatrix4(rec['+x'].m(9, 4.6, 0.15)); root.add(vinylSign.group);
  world.windows.add(-7.45, 2.2, -53, Math.PI / 2, 12, 3.4, { style: WIN.SHOP, depth: 6, lit: 1, seed: 77, tint: 2 });

  // ---- W: residential tower (balconies) ----
  const res = tower(world, B, { x0: -26, x1: -7.5, z0: -86, z1: -64, h: 66, mat: M.concrete, faces: ['+x', '+z'], style: WIN.SLIDER, lit: 0.5, floor: 3.2, bay: 3.6, winW: 0.8, winH: 0.7 });
  for (let y = 4.5; y < 64; y += 3.2) B.add(new THREE.BoxGeometry(1.0, 0.12, 22), M.concreteDark, T(-7.1, y, -75));
  // ---- W: tiny Inari shrine between towers ----
  buildShrine(world, B, root);
  tower(world, B, { x0: -24, x1: -7.5, z0: -126, z1: -98, h: 38, mat: M.tileMint, faces: ['+x', '+z'], style: WIN.PLAIN, lit: 0.45 });
  tower(world, B, { x0: 7.5, x1: 24, z0: -128, z1: -106, h: 46, mat: M.concreteWarm, faces: ['-x', '+z'], style: WIN.SLIDER, lit: 0.45 });
}

function buildShrine(world, B, root) {
  // a sliver of Shintō calm: torii gates climbing a stone stair to a small hokora
  const vermilion = new THREE.MeshStandardMaterial({ color: 0xc8321e, roughness: 0.45 });
  const black = M.metalBlack;
  const zc = -92, x0 = -7.6;
  B.add(boxGeo(9, 0.3, 7.5, 0.5), M.granite, T(x0 - 4.5, 0.15, zc));
  for (let i = 0; i < 6; i++) B.add(boxGeo(1.8, 0.18, 0.4, 0.5), M.granite, T(x0 - 1.4 - i * 0.4, 0.3 + i * 0.18, zc));
  for (let k = 0; k < 4; k++) {
    const x = x0 - 0.8 - k * 1.6, s = 1 - k * 0.1;
    for (const dz of [-1.1 * s, 1.1 * s]) B.add(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 3.4 * s, 12), vermilion, T(x, 0.3 + 1.7 * s + k * 0.3, zc + dz));
    B.add(new THREE.BoxGeometry(0.28 * s, 0.16 * s, 3.2 * s), black, T(x, 0.3 + 3.45 * s + k * 0.3, zc));
    B.add(new THREE.BoxGeometry(0.22 * s, 0.14 * s, 2.7 * s), vermilion, T(x, 0.3 + 2.9 * s + k * 0.3, zc));
    B.add(new THREE.BoxGeometry(0.24 * s, 0.1 * s, 3.0 * s), vermilion, T(x, 0.3 + 3.3 * s + k * 0.3, zc));
  }
  // hokora (mini shrine) + kitsune guardians + stone lanterns lit warm
  B.add(boxGeo(1.4, 1.2, 1.6, 0.5), M.wood, T(x0 - 7.6, 1.0, zc));
  B.add(new THREE.ConeGeometry(1.35, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x2b3a33, roughness: 0.4, metalness: 0.5 }), T(x0 - 7.6, 2.0, zc, 0, Math.PI / 4, 0));
  B.add(new THREE.BoxGeometry(0.02, 0.5, 0.8), glow(0xffb469, 1.6), T(x0 - 6.89, 1.1, zc));
  for (const dz of [-1.6, 1.6]) {
    B.add(new THREE.BoxGeometry(0.35, 0.35, 0.35), M.granite, T(x0 - 0.9, 0.48, zc + dz));
    B.add(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.6 }), T(x0 - 0.9, 0.82, zc + dz, 0, 0, 0, 0.8, 1.2, 1.0));
    B.add(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 8), M.granite, T(x0 - 3.6, 1.2, zc + dz));
    B.add(new THREE.BoxGeometry(0.4, 0.3, 0.4), M.granite, T(x0 - 3.6, 1.9, zc + dz));
    B.add(new THREE.BoxGeometry(0.2, 0.18, 0.2), glow(0xffa860, 3.5), T(x0 - 3.6, 1.9, zc + dz));
    B.add(new THREE.ConeGeometry(0.36, 0.3, 4), M.granite, T(x0 - 3.6, 2.2, zc + dz, 0, Math.PI / 4, 0));
  }
  world.updaters.push(lantern(root, x0 - 0.4, 2.6, zc, { r: 0.22, h: 0.55, text: '稲荷', color: '#e8e2d0', glowI: 2.2, swing: 0.04 }));
  world.lights.push({ pos: new THREE.Vector3(x0 - 2, 2.4, zc), color: 0xffa860, intensity: 3.5, distance: 8 });
}

function buildCrossStreetWalls(world, B, root, rng) {
  // buildings lining the cross street east & west, for views down the maglev line
  const spans = [[22.5, 40, -32, -14, 34], [40, 60, -32, -10, 50], [60, 84, -32, -8, 28], [-50, -30.5, -32, -6, 44], [-75, -50.5, -32, -12, 30],
    [20.5, 44, -70, -44.2, 40], [44, 66, -64, -44.2, 24], [-48, -22.5, -66, -44.2, 36], [-74, -48.5, -70, -44.2, 52]];
  const mats = [M.concrete, M.tileCream, M.brick, M.tileMint, M.concreteWarm, M.paintBlue];
  spans.forEach(([x0, x1, z0, z1, h], i) => {
    const faces = z1 > -40 ? ['-z'] : ['+z'];
    tower(world, B, { x0, x1, z0, z1, h, mat: mats[i % mats.length], faces, style: i % 2 ? WIN.SLIDER : WIN.PLAIN, lit: 0.45, floor: 3.3 });
  });
  // a few signs down the cross street
  const s1 = neonSign({ text: 'BAR', height: 1.2, color: 0x2af3ff, intensity: 6, materials: M, halo: 0.6, raceway: true });
  s1.group.position.set(34, 6, -44.0); root.add(s1.group);
  const s2 = neonSign({ icon: 'cocktail', height: 1.4, color: 0xff2a8a, intensity: 6, materials: M, halo: 0.6, raceway: false });
  s2.group.position.set(30, 6.2, -44.0); root.add(s2.group);
  const s3 = neonSign({ text: 'HOSTEL', height: 1.0, color: 0xffd400, intensity: 6, materials: M, halo: 0.6, raceway: true });
  s3.group.position.set(-38, 9, -44.0); root.add(s3.group);
  const s4 = neonSign({ icon: 'heart', height: 1.3, color: 0xff3a5a, intensity: 6, materials: M, halo: 0.6, raceway: false, flicker: 0.6 });
  s4.group.position.set(-60, 8, -31.9); s4.group.rotation.y = Math.PI; root.add(s4.group);
}

/* -------------------------------- Skyline ------------------------------ */
function skylineMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aB; varying vec3 vW; varying vec3 vN; varying vec4 vB; varying vec3 vSize;
      void main(){ vB = aB; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime; varying vec3 vW; varying vec3 vN; varying vec4 vB; varying vec3 vSize;
      ${GLSL_NOISE}
      void main(){
        vec3 base = vec3(0.012, 0.012, 0.022) * (0.6 + vB.y * 0.8);
        vec3 c = base;
        if (abs(vN.y) < 0.5) {
          vec2 p = abs(vN.x) > 0.5 ? vec2(vW.z, vW.y) : vec2(vW.x, vW.y);
          vec2 cell = vec2(2.6 + vB.z * 1.2, 3.4);
          vec2 id = floor(p / cell); vec2 f = fract(p / cell);
          float win = step(0.18, f.x) * step(f.x, 0.84) * step(0.25, f.y) * step(f.y, 0.85);
          float h = hash12(id + vB.x * 91.0);
          float lit = step(1.0 - (0.22 + vB.y * 0.3), h);
          vec3 lc = mix(vec3(1.0, 0.72, 0.42), vec3(0.6, 0.8, 1.0), step(0.6, hash12(id * 1.7 + 3.0)));
          lc = mix(lc, vec3(1.0, 0.3, 0.8), step(0.95, hash12(id * 2.3)));
          c += lc * win * lit * (0.6 + 0.6 * hash12(id + 7.0));
          // vertical LED trims on some towers
          float edge = step(0.5, vB.w) * smoothstep(0.08, 0.0, min(abs(fract(p.x / 24.0) - 0.0), abs(fract(p.x / 24.0) - 1.0)));
          c += vec3(0.1, 0.8, 1.0) * edge * 0.7;
          // top crown band
          c += mix(vec3(1.0, 0.2, 0.5), vec3(0.2, 0.9, 1.0), vB.y) * step(vSize.y - 2.0, vW.y) * step(0.6, vB.w) * 2.5;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  m.uniforms.uTime = U.time;
  return m;
}

function buildSkyline(world, root, rng) {
  const items = [];
  const tryAdd = (x, z, w, d, h) => {
    if (Math.abs(x) < 16 && z < -128) return;            // keep the street vista to the spire
    if (x > -95 && x < 95 && z > -132 && z < 70) return;  // the modelled district
    items.push([x, z, w, d, h]);
  };
  for (let i = 0; i < 520; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(110, 620);
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 120;
    const tall = rng.chance(0.15);
    tryAdd(x, z, rng.range(14, 40), rng.range(14, 40), tall ? rng.range(140, 320) : rng.range(30, 120));
  }
  // continue the main street as a canyon toward the spire
  for (let z = -140; z > -560; z -= rng.range(24, 40)) {
    for (const s of [-1, 1]) tryAdd(s * rng.range(22, 32), z, rng.range(16, 22), rng.range(18, 30), rng.range(40, 160));
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, skylineMaterial(), items.length);
  const aB = new Float32Array(items.length * 4);
  const m = new THREE.Matrix4();
  items.forEach(([x, z, w, d, h], i) => {
    m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
    mesh.setMatrixAt(i, m);
    aB.set([rng.next(), rng.next(), rng.next(), rng.next()], i * 4);
  });
  geo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  root.add(mesh);
  // aviation lights on the tallest
  const tall = items.filter((it) => it[4] > 130);
  const lg = new THREE.SphereGeometry(0.9, 8, 6);
  const lm = new THREE.InstancedMesh(lg, glow(0xff2020, 10), tall.length);
  tall.forEach(([x, z, , , h], i) => { m.makeTranslation(x, h + 2, z); lm.setMatrixAt(i, m); });
  lm.frustumCulled = false;
  root.add(lm);
  world.updaters.push((t) => { lm.visible = (t % 2.2) < 0.5; });
}

/* ------------------------------ Tenkū Spire ---------------------------- */
function buildSpire(world, root) {
  const g = new THREE.Group(); g.position.set(0, 0, -520); root.add(g);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vW; varying vec2 vUv;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime; varying vec3 vW; varying vec2 vUv;
      void main(){
        vec3 c = vec3(0.01, 0.012, 0.025);
        float ribs = smoothstep(0.03, 0.0, abs(fract(vUv.x * 16.0) - 0.5) - 0.46);
        float pulse = smoothstep(0.0, 0.02, fract(vW.y / 420.0 - uTime * 0.08)) * smoothstep(0.06, 0.02, fract(vW.y / 420.0 - uTime * 0.08));
        c += vec3(0.15, 0.85, 1.0) * ribs * (0.6 + pulse * 6.0);
        float floors = step(0.92, fract(vW.y / 4.0)) * step(0.5, fract(vUv.x * 64.0 + floor(vW.y / 4.0) * 0.37));
        c += vec3(1.0, 0.75, 0.45) * floors * 0.35;
        gl_FragColor = vec4(c * 1.4, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  mat.uniforms.uTime = U.time;
  const segs = [[34, 28, 160, 0], [26, 18, 140, 160], [16, 9, 110, 300], [8, 2, 60, 410]];
  for (const [rb, rt, h, y] of segs) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 8, 1), mat);
    m.position.y = y + h / 2; m.rotation.y = Math.PI / 8; g.add(m);
  }
  for (const [y, r] of [[300, 30], [410, 16]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.8, 8, 64), glow(0x30f0ff, 6));
    ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
  }
  const tip = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 8), glow(0xff2020, 14));
  tip.position.y = 474; g.add(tip);
  world.updaters.push((t) => { tip.visible = (t % 1.4) < 0.4; });
}

/* ---------------------------- Flying traffic --------------------------- */
function buildSkyTraffic(world, root, rng) {
  const lanes = [];
  for (let i = 0; i < 14; i++) {
    const y = rng.range(55, 160);
    const a = rng.range(0, Math.PI);
    const c = new THREE.Vector3(rng.range(-200, 200), y, rng.range(-500, -120));
    const d = new THREE.Vector3(Math.cos(a), rng.range(-0.02, 0.02), Math.sin(a)).normalize();
    lanes.push({ c, d, len: rng.range(500, 900) });
  }
  const N = 460;
  const geo = new THREE.PlaneGeometry(1, 1);
  const aLane = new Float32Array(N * 4);
  const laneData = new Float32Array(N * 7);
  for (let i = 0; i < N; i++) {
    const l = lanes[i % lanes.length];
    const dir = rng.chance(0.5) ? 1 : -1;
    aLane.set([rng.next(), rng.range(25, 60) * dir, rng.next(), dir], i * 4);
    laneData.set([l.c.x, l.c.y + rng.range(-2, 2) + (dir > 0 ? 3 : -3), l.c.z, l.d.x, l.d.y, l.d.z, l.len], i * 7);
  }
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = geo.index; ig.attributes.position = geo.attributes.position; ig.attributes.uv = geo.attributes.uv;
  ig.setAttribute('aCar', new THREE.InstancedBufferAttribute(aLane, 4));
  ig.setAttribute('aC', new THREE.InstancedBufferAttribute(laneData.filter((_, k) => k % 7 < 3), 3));
  ig.setAttribute('aD', new THREE.InstancedBufferAttribute(laneData.filter((_, k) => k % 7 >= 3 && k % 7 < 6), 3));
  ig.setAttribute('aL', new THREE.InstancedBufferAttribute(laneData.filter((_, k) => k % 7 === 6), 1));
  ig.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aCar; attribute vec3 aC; attribute vec3 aD; attribute float aL; uniform float uTime; varying vec2 vUv; varying float vDir; varying float vK;
      void main(){
        float s = fract(aCar.x + uTime * aCar.y / aL);
        vec3 p = aC + aD * (s - 0.5) * aL;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        vec3 dv = normalize((viewMatrix * vec4(aD * aCar.w, 0.0)).xyz);
        vec2 side = normalize(vec2(-dv.y, dv.x) + 1e-5);
        float len = 5.0 + aCar.z * 4.0;
        mvPosition.xy += dv.xy * position.x * len + side * position.y * 1.1;
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv; vDir = aCar.w; vK = aCar.z;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      varying vec2 vUv; varying float vDir; varying float vK;
      void main(){
        float a = smoothstep(0.5, 0.0, abs(vUv.y - 0.5)) * pow(vUv.x, 2.0);
        vec3 c = vDir > 0.0 ? vec3(1.0, 0.95, 0.85) * 3.0 : vec3(1.0, 0.1, 0.12) * 2.5;
        if (vK > 0.92) c = vec3(0.3, 0.9, 1.0) * 3.0;
        gl_FragColor = vec4(c * a, 1.0);
        #include <fog_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  mat.uniforms.uTime = U.time;
  const mesh = new THREE.Mesh(ig, mat);
  mesh.frustumCulled = false;
  root.add(mesh);
}

/* ------------------------------ Filler city ---------------------------- */
// Low/mid-rise blocks wrapping the modelled district so aerial views read
// as a continuous city. Uses the cheap emissive-window skyline shader.
function buildFiller(world, root, rng) {
  const occ = [
    [7.5, 21.5, -14, 4], [24, 34, -14, 16], [7.5, 22, -32, -14], [7.5, 24, 9, 40], [-30, -7.5, -32, -2], [-24, -7.5, -2, 40],
    [7.5, 20, -60, -44.2], [7.5, 26, -82, -61], [7.5, 22, -104, -83], [-22, -7.5, -62, -44.2], [-26, -7.5, -86, -64], [-17, -7.5, -97, -87],
    [-24, -7.5, -126, -98], [7.5, 24, -128, -106], [22.5, 40, -32, -14], [40, 60, -32, -10], [60, 84, -32, -8], [-50, -30.5, -32, -6],
    [-75, -50.5, -32, -12], [20.5, 44, -70, -44.2], [44, 66, -64, -44.2], [-48, -22.5, -66, -44.2], [-74, -48.5, -70, -44.2],
  ];
  const blocked = (x0, x1, z0, z1) => {
    if (x1 > -8 && x0 < 8) return true;                       // main street
    if (z1 > -44.5 && z0 < -31.5) return true;                 // cross street
    if (x1 > 7.5 && x0 < 30 && z1 > 3.5 && z0 < 9.5) return true; // alley
    return occ.some(([a, b, c, d]) => x0 < b + 0.5 && x1 > a - 0.5 && z0 < d + 0.5 && z1 > c - 0.5);
  };
  const items = [];
  for (let x = -110; x < 110; x += 15) {
    for (let z = -140; z < 110; z += 15) {
      const w = rng.range(9, 13.5), d = rng.range(9, 13.5);
      const x0 = x + rng.range(0, 15 - w), z0 = z + rng.range(0, 15 - d);
      if (blocked(x0, x0 + w, z0, z0 + d)) continue;
      const far = Math.hypot(x0, z0 + 20) / 110;
      items.push([x0 + w / 2, z0 + d / 2, w, d, rng.range(10, 26) + far * rng.range(0, 30)]);
    }
  }
  // the main street continues south behind the camera
  for (let z = 41; z < 120; z += rng.range(9, 14)) for (const s of [-1, 1]) {
    const w = rng.range(10, 16), d = rng.range(7, 12);
    items.push([s * (7.5 + w / 2), z + d / 2, w, d, rng.range(10, 30)]);
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, skylineMaterial(), items.length);
  const aB = new Float32Array(items.length * 4);
  const m = new THREE.Matrix4();
  const clutter = [];
  items.forEach(([x, z, w, d, h], i) => {
    m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
    mesh.setMatrixAt(i, m);
    aB.set([rng.next(), rng.next() * 0.7, rng.next(), rng.next() * 0.55], i * 4);
    for (let k = 0; k < rng.int(2, 5); k++) clutter.push([x + rng.range(-w / 3, w / 3), h, z + rng.range(-d / 3, d / 3), rng.range(0.8, 3), rng.range(0.8, 2.6), rng.range(0.8, 3)]);
  });
  geo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
  mesh.computeBoundingSphere();
  root.add(mesh);
  const cg = new THREE.BoxGeometry(1, 1, 1); cg.translate(0, 0.5, 0);
  const cm = new THREE.InstancedMesh(cg, M.concreteDark, clutter.length);
  clutter.forEach(([x, y, z, a, b, c], i) => { m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(a, b, c)); cm.setMatrixAt(i, m); });
  cm.computeBoundingSphere();
  root.add(cm);
}
