import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, T, RNG, U, catenaryCurve } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';
import { lantern, swayMaterial } from '../core/prefabs.js';
import { faceMaterial, JP, JPM, LAT } from './signs.js';
import { hoverCar } from './vehicles.js';
import { figure } from './figures.js';

/* =================================================================== */
/*  Street furniture & life: utility pole + cable web, LED street      */
/*  lamps, bollards, festival lanterns, road works, a delivery robot,  */
/*  the parked KIRIN-7 hover car, and people under glowing umbrellas.  */
/* =================================================================== */

export function buildProps(world) {
  const root = new THREE.Group(); root.name = 'props';
  world.scene.add(root);
  const B = new Batch('props');
  const rng = new RNG(31337);
  world.lampHeads = [];
  utilityPoles(world, B, root, rng);
  streetLamps(world, B, root);
  bollards(B);
  festivalLanterns(world, root);
  roadWorks(world, B, root);
  deliveryRobot(world, root);
  ramenAFrame(root);
  hoverCar(world, root, { x: 3.55, y: 0.3, z: -2.6, ry: Math.PI / 2, color: 0x15102a, accent: 0xff2a6d });
  people(world, root);
  B.build(root);
  return root;
}

/* ---------------------- Utility poles + cable web ---------------------- */
function utilityPoles(world, B, root, rng) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8e8c86, roughness: 0.75 });
  const poles = [];
  const pole = (x, z, h = 12.5) => {
    B.add(new THREE.CylinderGeometry(0.14, 0.2, h, 14), concrete, T(x, h / 2 + 0.18, z));
    // yellow/black guard sleeve + address plate
    const sleeve = new THREE.MeshStandardMaterial({ map: drawCanvas(64, 256, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#111' : '#e8b400'; c.save(); c.translate(0, i * 32); c.transform(1, 0.5, 0, 1, 0, 0); c.fillRect(-64, 0, 192, 32); c.restore(); } }), roughness: 0.5 });
    B.add(new THREE.CylinderGeometry(0.215, 0.215, 1.8, 14, 1, true), sleeve, T(x, 1.1, z));
    const plate = drawCanvas(64, 256, (c) => { c.fillStyle = '#1b4d9a'; c.fillRect(0, 0, 64, 256); c.fillStyle = '#fff'; c.font = `bold 34px ${JP}`; c.textAlign = 'center'; ['歌', '舞', '伎', '七', '丁', '目'].forEach((ch, i) => c.fillText(ch, 32, 40 + i * 38)); });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.62), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.4 }));
    pm.position.set(x - (x > 0 ? 0.2 : -0.2), 2.6, z); pm.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(pm);
    // cross-arms with porcelain insulators
    for (const [y, w] of [[h - 0.4, 1.8], [h - 1.3, 1.5], [h - 2.3, 1.2]]) {
      B.add(new THREE.BoxGeometry(0.1, 0.1, w), M.galv, T(x, y, z));
      for (let k = -1; k <= 1; k++) {
        B.add(new THREE.CylinderGeometry(0.045, 0.06, 0.16, 10), M.plasticWhite, T(x, y + 0.13, z + k * w * 0.42));
      }
    }
    // pole-mounted transformer + step bolts
    B.add(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 18), new THREE.MeshStandardMaterial({ color: 0x8a9188, roughness: 0.45, metalness: 0.6 }), T(x + (x > 0 ? -0.45 : 0.45), h - 3.6, z));
    B.add(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 18), M.galv, T(x + (x > 0 ? -0.45 : 0.45), h - 3.1, z));
    for (let y = 2.4; y < h - 1; y += 0.45) B.add(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), M.galv, T(x, y, z, 0, (y * 7) % 3, Math.PI / 2));
    poles.push(new THREE.Vector3(x, h, z));
    return poles[poles.length - 1];
  };
  const pE = pole(6.65, 9.6);
  const pE2 = pole(6.65, -33.6);
  const pW = pole(-6.65, 9.0, 11.5);
  const pW2 = pole(-6.65, -29.0);
  const pN = pole(6.65, -60, 12);
  const cable = (a, b, sag, r = 0.014) => {
    const c = catenaryCurve(a, b, sag, Math.max(10, Math.round(a.distanceTo(b) * 1.2)));
    B.add(new THREE.TubeGeometry(c, Math.max(10, Math.round(a.distanceTo(b) * 1.4)), r, 4, false), M.cable);
    return c;
  };
  const jit = (v, k) => v.clone().add(new THREE.Vector3(rng.range(-k, k), rng.range(-k, k), rng.range(-k, k)));
  // along the street (power lines between poles on each side)
  for (let i = 0; i < 4; i++) {
    cable(jit(pE, 0.1).setY(pE.y - 0.3 - i * 0.6), jit(pE2, 0.1).setY(pE2.y - 0.3 - i * 0.6), 1.4 + i * 0.25, i === 0 ? 0.018 : 0.012);
    cable(jit(pW, 0.1).setY(pW.y - 0.3 - i * 0.6), jit(pW2, 0.1).setY(pW2.y - 0.3 - i * 0.6), 1.3 + i * 0.2, 0.013);
    cable(jit(pE2, 0.1).setY(pE2.y - 0.3 - i * 0.6), jit(pN, 0.1).setY(pN.y - 0.3 - i * 0.6), 1.2 + i * 0.3, 0.013);
  }
  // across the street (service drops), pole to facades
  for (let i = 0; i < 7; i++) {
    cable(jit(pE, 0.2).setY(pE.y - 1.0 - i * 0.35), new THREE.Vector3(-7.4, 7 + rng.range(0, 6), rng.range(-2, 16)), rng.range(0.8, 2.0), 0.011);
    cable(jit(pW, 0.2).setY(pW.y - 1.0 - i * 0.35), new THREE.Vector3(7.4 + rng.range(0, 1.8), 6 + rng.range(0, 8), rng.range(4.5, 16)), rng.range(0.8, 2.0), 0.011);
  }
  // building-to-building cables over the street (data trunks, sagging heavily)
  for (let i = 0; i < 16; i++) {
    const z = rng.range(-30, 2);
    const a = new THREE.Vector3(rng.range(6.8, 7.4), rng.range(9, 26), z);
    const b = new THREE.Vector3(-7.45, rng.range(9, 28), z + rng.range(-6, 6));
    cable(a, b, rng.range(1.2, 3.6), rng.range(0.01, 0.028));
  }
  // drop to the alley + to the hero façade
  for (let i = 0; i < 5; i++) cable(jit(pE, 0.2).setY(pE.y - 1.2 - i * 0.3), new THREE.Vector3(7.4, 8 + i * 1.6, 3.6), 0.5 + i * 0.2, 0.012);
  // a pair of sneakers hung on a cable
  const sneaker = new RoundedBoxGeometry(0.11, 0.1, 0.3, 2, 0.04);
  for (const dx of [-0.08, 0.08]) B.add(sneaker, new THREE.MeshStandardMaterial({ color: dx < 0 ? 0xeeeeee : 0xf0f0f0, roughness: 0.6, emissive: 0x111111 }), T(-1.2 + dx, 13.6 - Math.abs(dx) * 2, -12.2, 0.3, 0, dx * 3));
}

/* ------------------------------ Street lamps --------------------------- */
function streetLamps(world, B, root) {
  const pos = [[5.75, 15.5], [5.75, -21.0], [-5.75, 22.0], [-5.75, 2.5], [-5.75, -36.5], [5.75, -48], [-5.75, -68], [5.75, -80], [-5.75, -104]];
  pos.forEach(([x, z], i) => {
    const s = x > 0 ? -1 : 1;
    B.add(new THREE.CylinderGeometry(0.075, 0.11, 7.2, 12), M.metalDark, T(x, 0.18 + 3.6, z));
    B.add(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 12), M.metalDark, T(x, 0.43, z));
    const arc = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 7.3, z), new THREE.Vector3(x + s * 0.4, 7.85, z), new THREE.Vector3(x + s * 1.3, 7.95, z), new THREE.Vector3(x + s * 2.0, 7.8, z)]);
    B.add(new THREE.TubeGeometry(arc, 16, 0.06, 8), M.metalDark);
    B.add(new RoundedBoxGeometry(0.9, 0.12, 0.34, 2, 0.05), M.metalDark, T(x + s * 2.2, 7.74, z));
    B.add(new THREE.BoxGeometry(0.76, 0.02, 0.22), glow(0xd8ecff, 5.5), T(x + s * 2.2, 7.67, z));
    // banner bracket with a vertical festival banner on every other lamp
    if (i % 2 === 0) {
      const tex = drawCanvas(128, 512, (c) => { const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#c4001a'); g.addColorStop(1, '#6a0010'); c.fillStyle = g; c.fillRect(0, 0, 128, 512); c.fillStyle = '#fff3d6'; c.font = `bold 72px ${JPM}`; c.textAlign = 'center'; ['夜', '祭', '七', '区'].forEach((ch, k) => c.fillText(ch, 64, 100 + k * 110)); });
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
      bm.position.set(x + s * 0.32, 4.6, z); bm.rotation.y = Math.PI / 2; root.add(bm);
      B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.5), M.galv, T(x + s * 0.25, 5.62, z, 0, 0, Math.PI / 2));
    }
    world.lampHeads.push(new THREE.Vector3(x + s * 2.2, 7.65, z));
  });
  // real lights for the lamps nearest the default view
  world.lampHeads.slice(0, 4).forEach((p, i) => {
    const sp = new THREE.SpotLight(0xcfe4ff, 34, 18, 0.95, 0.75, 1.5);
    sp.position.copy(p); sp.target.position.set(p.x, 0, p.z);
    if (i === 0) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005; sp.shadow.normalBias = 0.03; sp.shadow.camera.near = 1; sp.shadow.camera.far = 14; sp.shadow.radius = 5; sp.shadow.intensity = 0.75; }
    root.add(sp, sp.target);
  });
}

function bollards(B) {
  const refl = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: 0x666666 });
  for (let z = 4.6; z <= 8.6; z += 1.0) {
    B.add(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 14), M.metalDark, T(7.1, 0.6, z));
    B.add(new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.metalDark, T(7.1, 1.02, z));
    B.add(new THREE.CylinderGeometry(0.083, 0.083, 0.05, 14), refl, T(7.1, 0.9, z));
  }
  for (let z = 10.5; z < 30; z += 2.5) {
    B.add(new THREE.CylinderGeometry(0.1, 0.12, 0.9, 16), M.steel, T(5.45, 0.63, z));
    B.add(new THREE.TorusGeometry(0.105, 0.012, 6, 20), glow(0xff2ad4, 6), T(5.45, 0.98, z, Math.PI / 2, 0, 0));
  }
  // bike rack + parked bikes are added by the arcade; add ramen-side planter
  B.add(new THREE.BoxGeometry(0.5, 0.45, 1.6), M.concreteDark, T(7.15, 0.4, -8.9));
}

/* --------------------- Festival lanterns across street ----------------- */
function festivalLanterns(world, root) {
  const a = new THREE.Vector3(7.2, 7.4, -6.0), b = new THREE.Vector3(-7.4, 7.9, -7.0);
  const c = catenaryCurve(a, b, 1.1, 30);
  const B = new Batch('fest');
  B.add(new THREE.TubeGeometry(c, 40, 0.012, 4), M.cable);
  B.build(root);
  for (let i = 1; i < 12; i++) {
    const p = c.getPoint(i / 12);
    world.updaters.push(lantern(root, p.x, p.y - 0.62, p.z, { r: 0.17, h: 0.42, text: i % 3 === 0 ? '鯉' : '祭', color: i % 2 ? '#f2ead8' : '#d81e2a', glowI: 2.3, swing: 0.06 }));
  }
}

/* ------------------------------ Road works ----------------------------- */
function roadWorks(world, B, root) {
  const stripe = new THREE.MeshStandardMaterial({ map: drawCanvas(256, 32, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#111' : '#f2c200'; c.save(); c.transform(1, 0, 0.8, 1, 0, 0); c.fillRect(i * 32 - 20, 0, 32, 32); c.restore(); } }), roughness: 0.4 });
  const blinks = [];
  for (const [x, z] of [[-3.6, -23.0], [-1.6, -23.0], [-3.6, -26.0]]) {
    B.add(new THREE.BoxGeometry(1.8, 0.22, 0.05), stripe, T(x, 0.85, z));
    B.add(new THREE.BoxGeometry(1.8, 0.22, 0.05), stripe, T(x, 0.5, z));
    for (const dx of [-0.8, 0.8]) { B.add(new THREE.BoxGeometry(0.05, 1.0, 0.05), M.plasticWhite, T(x + dx, 0.5, z)); B.add(new THREE.BoxGeometry(0.06, 0.04, 0.6), M.plasticGrey, T(x + dx, 0.02, z)); }
    const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 12), glow(0xffa000, 12).clone()); bl.position.set(x, 1.05, z); root.add(bl); blinks.push(bl);
  }
  for (const [x, z] of [[-4.2, -24.5], [-0.9, -24.5], [-2.4, -27.2]]) {
    B.add(new THREE.ConeGeometry(0.18, 0.7, 16), new THREE.MeshStandardMaterial({ color: 0xff3a10, roughness: 0.5 }), T(x, 0.35, z));
    B.add(new THREE.CylinderGeometry(0.11, 0.135, 0.12, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.2, emissive: 0x333333 }), T(x, 0.38, z));
    B.add(new THREE.BoxGeometry(0.45, 0.04, 0.45), M.plasticBlack, T(x, 0.02, z));
  }
  // open manhole with a work tent glow
  B.add(new THREE.CylinderGeometry(0.45, 0.45, 0.02, 24), M.metalBlack, T(-2.6, 0.005, -24.6));
  B.add(new THREE.CylinderGeometry(0.42, 0.42, 0.01, 24), glow(0xffb060, 1.4), T(-2.6, 0.012, -24.6));
  world.steamSources.push({ p: new THREE.Vector3(-2.6, 0.05, -24.6), rate: 3.0, size: 1.4, rise: 0.9, color: 0xe6d8ff, spread: 0.35, life: 5, max: 7 });
  world.lights.push({ pos: new THREE.Vector3(-2.6, 0.8, -24.6), color: 0xffa040, intensity: 3, distance: 6 });
  world.updaters.push((t) => blinks.forEach((b, i) => { b.visible = ((t * 1.6 + i * 0.33) % 1) < 0.45; }));
}

/* --------------------------- Delivery robot ---------------------------- */
function deliveryRobot(world, root) {
  // six-wheel sidewalk courier: rocker-bogie, treaded tyres, lidded cargo shell
  const g = new THREE.Group();
  const B = new Batch('robot');
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xf1f0ea, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const chassis = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.08, metalness: 0.2 });
  const tread = drawCanvas(256, 32, (c) => { c.fillStyle = '#151515'; c.fillRect(0, 0, 256, 32); c.fillStyle = '#2c2c2c'; for (let i = 0; i < 256; i += 12) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 6, 16); c.lineTo(i, 32); c.lineTo(i + 4, 32); c.lineTo(i + 10, 16); c.lineTo(i + 4, 0); c.fill(); } }, { srgb: true });
  tread.wrapS = THREE.RepeatWrapping;
  const tyre = new THREE.MeshStandardMaterial({ map: tread, bumpMap: tread, bumpScale: 2, roughness: 0.85 });
  B.add(new RoundedBoxGeometry(0.72, 0.2, 0.5, 3, 0.05), chassis, T(0, 0.22, 0));
  B.add(new RoundedBoxGeometry(0.69, 0.25, 0.52, 3, 0.08), shell, T(-0.01, 0.43, 0));
  B.add(new THREE.BoxGeometry(0.7, 0.008, 0.53), M.metalBlack, T(-0.01, 0.5, 0));            // lid seam
  B.add(new RoundedBoxGeometry(0.62, 0.05, 0.46, 2, 0.03), shell, T(-0.02, 0.565, 0));        // lid
  for (const sz of [-0.12, 0.12]) B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), M.metalDark, T(-0.33, 0.53, sz, Math.PI / 2, 0, 0)); // hinges
  // face: glossy black visor with camera, LED eyes, ultrasonic ring
  B.add(new RoundedBoxGeometry(0.03, 0.13, 0.4, 2, 0.012), black, T(0.355, 0.4, 0));
  B.add(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), M.chrome, T(0.372, 0.43, 0, 0, 0, Math.PI / 2));
  B.add(new THREE.CircleGeometry(0.014, 12), glow(0x203040, 2), T(0.383, 0.43, 0, 0, Math.PI / 2, 0));
  for (const sz of [-0.1, 0.1, -0.18, 0.18]) B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10), M.metalBlack, T(0.36, 0.25, sz, 0, 0, Math.PI / 2));
  B.add(new THREE.BoxGeometry(0.01, 0.012, 0.3), glow(0xeaf4ff, 5), T(0.362, 0.3, 0));
  B.add(new THREE.BoxGeometry(0.01, 0.014, 0.3), glow(0xff1830, 3), T(-0.36, 0.33, 0));
  // rocker-bogie suspension + six wheels
  for (const sz of [-0.29, 0.29]) {
    B.add(new THREE.BoxGeometry(0.5, 0.03, 0.025), chassis, T(0.05, 0.15, sz, 0, 0, 0.12));
    B.add(new THREE.BoxGeometry(0.28, 0.03, 0.025), chassis, T(-0.18, 0.13, sz, 0, 0, -0.18));
    B.add(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 12), M.steel, T(0.0, 0.16, sz, Math.PI / 2, 0, 0));
    for (const xx of [-0.26, 0.0, 0.26]) {
      B.add(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 24), tyre, T(xx, 0.1, sz + Math.sign(sz) * 0.02, Math.PI / 2, 0, 0));
      B.add(new THREE.CylinderGeometry(0.055, 0.055, 0.075, 16), M.plasticGrey, T(xx, 0.1, sz + Math.sign(sz) * 0.021, Math.PI / 2, 0, 0));
      for (let k = 0; k < 5; k++) B.add(new THREE.BoxGeometry(0.008, 0.08, 0.004), M.metalBlack, T(xx, 0.1, sz + Math.sign(sz) * 0.06, 0, 0, (k / 5) * Math.PI));
    }
  }
  // flag pole + pennant
  B.add(new THREE.CylinderGeometry(0.004, 0.007, 1.0, 6), M.plasticBlack, T(-0.3, 1.06, -0.2));
  B.add(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 10), M.plasticBlack, T(-0.3, 0.6, -0.2));
  const pen = new THREE.Shape(); pen.moveTo(0, 0); pen.lineTo(0.22, -0.06); pen.lineTo(0, -0.14); pen.lineTo(0, 0);
  B.add(new THREE.ShapeGeometry(pen), swayMaterial({ color: 0xff6a10, roughness: 0.7 }, 0.03, 3), T(-0.3, 1.55, -0.2));
  B.build(g);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), glow(0xff8a00, 10)); tip.position.set(-0.3, 1.57, -0.2); g.add(tip);
  // livery on both flanks
  const livery = drawCanvas(512, 160, (c) => {
    c.clearRect(0, 0, 512, 160);
    c.fillStyle = '#c8141e'; c.fillRect(0, 108, 512, 10);
    c.fillStyle = '#16161a'; c.font = `900 54px ${LAT}`; c.fillText('KOI-TEI', 20, 72);
    c.fillStyle = '#c8141e'; c.font = `bold 52px ${JP}`; c.fillText('出前', 270, 72);
    c.fillStyle = '#555'; c.font = `600 18px ${LAT}`; c.fillText('UNIT 07 · CAUTION: HOT BROTH', 22, 146);
  });
  const lm = new THREE.MeshStandardMaterial({ map: livery, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const sz of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.155), lm); d.position.set(0.0, 0.43, sz * 0.262); if (sz < 0) d.rotation.y = Math.PI; g.add(d); }
  root.add(g);
  const eyes = [];
  for (const sz of [-0.075, 0.075]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.035, 4, 8), glow(0x3af2ff, 6)); e.rotation.x = Math.PI / 2; e.position.set(0.372, 0.4, sz); g.add(e); eyes.push(e); }
  world.updaters.push((t) => {
    const k = (t * 0.045) % 1;
    g.position.set(6.25, 0.18, 12 - k * 34);
    g.rotation.y = Math.PI / 2;
    g.position.y = 0.18 + Math.abs(Math.sin(t * 9)) * 0.004;
    const v = (t % 4) > 0.12; eyes.forEach((e) => { e.visible = v; });
  });
}

function ramenAFrame(root) {
  // wooden A-frame chalkboard: framed panels, hinges, spreader chain, rubber feet
  const tex = drawCanvas(256, 384, (c) => {
    c.fillStyle = '#1a2420'; c.fillRect(0, 0, 256, 384);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; c.fillRect(Math.random() * 256, Math.random() * 384, 3, 1); }
    c.fillStyle = '#f2c46d'; c.font = `bold 44px ${JPM}`; c.textAlign = 'center'; c.fillText('本日の', 128, 58); c.fillText('一杯', 128, 110);
    c.fillStyle = '#f2ead8'; c.beginPath(); c.ellipse(128, 196, 84, 25, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c9862a'; c.beginPath(); c.ellipse(128, 194, 74, 19, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f7e7b0'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(90 + i * 15, 192 + (i % 2) * 4, 9, 0, 7); c.fill(); }
    c.fillStyle = '#2a4a1a'; c.fillRect(150, 182, 30, 10); c.fillStyle = '#e8a090'; c.beginPath(); c.arc(110, 186, 16, 0, 7); c.fill();
    c.strokeStyle = '#f2ead8'; c.lineWidth = 3; c.beginPath(); c.moveTo(42, 196); c.quadraticCurveTo(128, 292, 214, 196); c.stroke();
    c.fillStyle = '#fff'; c.font = `bold 38px ${JP}`; c.fillText('特製豚骨', 128, 300);
    c.fillStyle = '#ff7a5a'; c.font = `900 42px ${LAT}`; c.fillText('¥1,280', 128, 352);
  });
  const board = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const B = new Batch('aframe');
  const wood = M.wood;
  const H = 0.95, Wd = 0.58, splay = 0.16;
  for (const s of [-1, 1]) {
    const pm = T(6.6, 0.18, 0.6, 0, 0, 0).multiply(T(0, H, 0, 0, 0, s * splay)).multiply(T(0, -H / 2, 0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0));
    B.add(new THREE.BoxGeometry(Wd, 0.04, 0.03), wood, new THREE.Matrix4().multiplyMatrices(pm, T(0, H / 2 - 0.02, 0)));
    B.add(new THREE.BoxGeometry(Wd, 0.04, 0.03), wood, new THREE.Matrix4().multiplyMatrices(pm, T(0, -H / 2 + 0.12, 0)));
    for (const sx of [-1, 1]) B.add(new THREE.BoxGeometry(0.04, H, 0.03), wood, new THREE.Matrix4().multiplyMatrices(pm, T(sx * (Wd / 2 - 0.02), 0, 0)));
    B.add(new THREE.PlaneGeometry(Wd - 0.08, H - 0.2), board, new THREE.Matrix4().multiplyMatrices(pm, T(0, 0.04, 0.009)));
    for (const sx of [-1, 1]) B.add(new THREE.BoxGeometry(0.05, 0.02, 0.04), M.rubber, new THREE.Matrix4().multiplyMatrices(pm, T(sx * (Wd / 2 - 0.02), -H / 2 + 0.01, 0)));
  }
  for (const sz of [-0.2, 0.2]) B.add(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8), M.brass, T(6.6, 0.18 + H, 0.6 + sz, 0, 0, Math.PI / 2));
  B.rod(M.galv, 0.004, new THREE.Vector3(6.6 - 0.2 * Math.sin(splay) * 2.2, 0.55, 0.6), new THREE.Vector3(6.6 + 0.2 * Math.sin(splay) * 2.2, 0.55, 0.6));
  B.build(root);
}

/* --------------------------------- People ------------------------------ */
function people(world, root) {
  const walkers = [
    { path: [[6.3, 22], [6.3, -30]], speed: 1.15, umbrella: 0x3af2ff, coat: 0x1c1f2b, seed: 101 },
    { path: [[-6.2, -30], [-6.2, 24]], speed: 1.0, umbrella: 0xff2a8a, coat: 0x2a1820, seed: 102, hood: true },
    { path: [[-6.5, 9.6], [6.5, 9.4]], speed: 0.9, umbrella: 0xffb000, coat: 0x23262c, seed: 103 },
    { path: [[6.0, -40], [6.0, 6]], speed: 1.25, umbrella: null, coat: 0x3a2a1a, seed: 104, hood: true },
    { path: [[-6.8, 20], [-6.8, -6]], speed: 0.8, umbrella: 0xffffff, coat: 0x161616, seed: 105 },
  ];
  walkers.forEach((w, i) => {
    const f = figure(root, { x: w.path[0][0], y: 0.18, z: w.path[0][1], pose: 'standing', coat: w.coat, umbrella: w.umbrella, seed: w.seed, hood: w.hood, hi: w.seed === 103 });
    const a = new THREE.Vector3(w.path[0][0], 0, w.path[0][1]), b = new THREE.Vector3(w.path[1][0], 0, w.path[1][1]);
    const len = a.distanceTo(b);
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const ry = Math.atan2(dir.x, dir.z);
    let light = null;
    world.updaters.push((t) => {
      const d = (t * w.speed + i * 7.3) % (len * 2);
      const fwd = d < len;
      const k = fwd ? d : len * 2 - d;
      const p = a.clone().addScaledVector(dir, k);
      const onRoad = Math.abs(p.x) < 5.1;
      f.position.set(p.x, onRoad ? 0.0 : 0.18, p.z);
      f.rotation.y = fwd ? ry : ry + Math.PI;
      f.userData.walk(t * w.speed * 5.2 + i, 1);
    });
  });
  // still figures: a couple under the ramen awning, someone at the vending machines, a smoker
  figure(root, { x: 6.9, y: 0.18, z: -5.0, ry: -Math.PI / 2 + 0.4, pose: 'standing', coat: 0x101826, seed: 201, prop: 'phone', hi: true });
  figure(root, { x: 6.75, y: 0.18, z: -5.6, ry: -Math.PI / 2 - 0.2, pose: 'standing', coat: 0x4a1a2a, seed: 202, hood: true, umbrella: 0xb46aff, hi: true });
  figure(root, { x: -6.6, y: 0.18, z: 6.4, ry: -Math.PI / 2, pose: 'standing', coat: 0x262a20, seed: 203 });
  const smoker = figure(root, { x: 7.1, y: 0.18, z: 6.0, ry: -2.2, pose: 'standing', coat: 0x15151a, seed: 204, hood: true, prop: 'cigarette', hi: true });
  const ember = smoker.userData.ember;
  if (ember) world.updaters.push((t) => { ember.scale.setScalar(0.8 + 0.5 * Math.sin(t * 3) ** 2); });
  world.steamSources.push({ p: new THREE.Vector3(7.0, 1.72, 6.15), rate: 0.5, size: 0.22, rise: 0.25, color: 0xcfcfdf, spread: 0.05, life: 3.0, max: 2.0 });
}
