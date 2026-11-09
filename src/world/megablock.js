import * as THREE from 'three';
import { Batch, T, RNG, boxGeo } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';
import { Frame, wallWithOpenings } from '../core/facade.js';
import { WIN } from '../core/windows.js';
import { neonSign } from '../core/neon.js';
import { acUnit, plant, dish, trashBag, bicycle, laundryLine, futon } from '../core/prefabs.js';
import { faceMaterial, lightBox, JP, JPM, LAT, vtext, rr, projectingSign } from './signs.js';
import { buildLedScreen } from './ledScreen.js';
import { figure } from './figures.js';

/* =================================================================== */
/*  HOSHINO RESIDENTIAL BLOCK 7 (星野)                                  */
/*  A 57 m brutalist slab: board-formed concrete egg-crate façade with */
/*  deep spandrels and fins; the curved NEURAL//DRIFT screen; a        */
/*  NEKOMART konbini, a loud drugstore and a monumental lobby portal.  */
/* =================================================================== */

const X0 = -30, X1 = -7.5, Z0 = -32, Z1 = -2;
const GF = 5.2, FH = 3.4, NF = 15, TOP = GF + NF * FH; // 56.2

export function productTexture(seed = 1, warm = false) {
  return drawCanvas(1024, 512, (x) => {
    const r = new RNG(seed);
    x.fillStyle = '#e8e8ea'; x.fillRect(0, 0, 1024, 512);
    const rows = 5, rh = 512 / rows;
    for (let j = 0; j < rows; j++) {
      x.fillStyle = '#b9bcc4'; x.fillRect(0, j * rh + rh - 10, 1024, 10);
      x.fillStyle = '#ffde3a'; x.fillRect(0, j * rh + rh - 10, 1024, 4);
      let px = 4;
      while (px < 1020) {
        const w = r.range(18, 44), h = r.range(rh * 0.45, rh * 0.85);
        const hue = warm ? r.pick([0, 15, 45, 200, 330]) : r.range(0, 360);
        x.fillStyle = `hsl(${hue},${r.range(55, 95)}%,${r.range(35, 65)}%)`;
        const n = r.int(2, 5);
        for (let k = 0; k < n && px < 1020; k++) {
          x.fillRect(px, j * rh + rh - 10 - h, w - 2, h);
          x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(px + 3, j * rh + rh - 10 - h * 0.7, w - 8, h * 0.18);
          x.fillStyle = `hsl(${hue},80%,45%)`;
          px += w;
        }
        px += 3;
      }
      // price tags
      for (let k = 0; k < 14; k++) { x.fillStyle = r.chance(0.3) ? '#ff2a2a' : '#ffffff'; x.fillRect(k * 74 + 8, j * rh + rh - 9, 30, 7); }
    }
  });
}

export function buildMegablock(world) {
  const root = new THREE.Group(); root.name = 'megablock';
  world.scene.add(root);
  const B = new Batch('mega');
  const rng = new RNG(1717);
  const conc = M.concrete;

  // ---------- core volume (hidden interior faces, rear wall, roof) ----------
  B.add(boxGeo(X1 - X0 - 2.0, TOP - GF, Z1 - Z0 - 2.0, 0.25), M.concreteDark, T((X0 + X1) / 2, GF + (TOP - GF) / 2, (Z0 + Z1) / 2));
  B.add(boxGeo(X1 - X0, 0.5, Z1 - Z0, 0.25), conc, T((X0 + X1) / 2, GF - 0.25, (Z0 + Z1) / 2));

  // ---------- egg-crate façades ----------
  const faces = [
    { F: new Frame('+x', X1, 0, Z1), len: Z1 - Z0, skip: (u, y) => u > 4.6 && u < 25.4 && y > 12.4 && y < 29.6 },
    { F: new Frame('+z', X0, 0, Z1), len: X1 - X0 },
    { F: new Frame('-z', X1, 0, Z0), len: X1 - X0 },
    { F: new Frame('-x', X0, 0, Z0), len: Z1 - Z0, blind: true },
  ];
  const ac = acUnit();
  const netMat = new THREE.MeshStandardMaterial({ color: 0x4a86c0, emissive: 0x0c2440, emissiveIntensity: 0.6, roughness: 0.95, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
  const railBar = new THREE.MeshStandardMaterial({ color: 0x7c8286, roughness: 0.45, metalness: 0.7 });
  faces.forEach(({ F, len, skip, blind }, fi) => {
    const bays = Math.round(len / 3.4);
    const bw = len / bays;
    // each bay column carries a programme over a run of floors, like real refits and owner changes
    const colType = Array.from({ length: bays }, () => { const t = rng.next(); return t < 0.24 ? 'balc' : t < 0.33 ? 'encl' : t < 0.38 ? 'vent' : 'win'; });
    if (!blind && bays > 5) colType[fi === 1 ? 1 : bays - 2] = 'core';
    const runs = colType.map(() => { const a = rng.int(0, 6), b = rng.int(a + 4, NF); return [a, b]; });
    // a section of the south face is under repair: scaffold wrapped in protection netting
    const scaf = fi === 1 ? { b0: 2, b1: 5, f0: 6, f1: 12 } : null;
    for (let f = 0; f < NF; f++) {
      const y = GF + f * FH;
      // spandrel, split where the screen interrupts the façade
      let segStart = 0;
      for (let b = 0; b <= bays; b++) {
        const u = b * bw;
        const hidden = skip && b < bays && skip(u + bw / 2, y + 0.5);
        if (hidden || b === bays) {
          if (u - segStart > 0.01) F.box(B, conc, (segStart + u) / 2, y + 0.5, -0.4, u - segStart, 1.0, 0.8, 0.25);
          segStart = u + bw;
        }
      }
      for (let b = 0; b < bays; b++) {
        const u = b * bw;
        if (skip && skip(u + bw / 2, y + 1.5)) continue;
        F.box(B, conc, u + 0.18, y + FH / 2, -0.4, 0.36, FH, 0.8, 0.25);           // vertical fin
        if (blind && rng.chance(0.7)) { F.box(B, M.concreteDark, u + bw / 2, y + 2.2, -0.75, bw - 0.36, 2.4, 0.1, 0.25); continue; }
        const type = colType[b] === 'core' ? 'core' : f >= runs[b][0] && f <= runs[b][1] ? colType[b] : 'win';
        const cu = u + bw / 2 + 0.09;
        if (type === 'core') {          // stair core: narrow lit slot, cool fluorescent
          const c = F.p(cu, y + 2.0, -0.82);
          world.windows.add(c.x, c.y, c.z, F.ry, 0.8, 2.6, { style: WIN.PLAIN, depth: 2.0, lit: 0.95, seed: c.y * 3.3 + b, kind: 'stair' });
          F.box(B, M.concreteDark, cu, y + 2.0, -0.8, bw - 0.4, 2.6, 0.06, 0.25);
          continue;
        }
        if (type === 'vent') {          // louvred plant room
          F.box(B, M.concreteDark, cu, y + 2.2, -0.82, bw - 0.4, 2.4, 0.06, 0.25);
          for (let k = 0; k < 9; k++) F.box(B, M.galv, cu, y + 1.15 + k * 0.24, -0.72, bw - 0.6, 0.04, 0.16);
          continue;
        }
        const c = F.p(cu, y + 2.2, -0.82);
        const boarded = rng.chance(0.03);
        if (boarded) F.box(B, M.woodLight, cu, y + 2.2, -0.8, bw - 0.4, 2.3, 0.04, 0.5);
        else world.windows.add(c.x, c.y, c.z, F.ry, bw - 0.42, 2.3, { style: type === 'balc' || rng.chance(0.5) ? WIN.SLIDER : WIN.PLAIN, depth: 4.2, lit: 0.42, seed: c.x * 3.1 + c.y * 7.3 + c.z * 1.7 });
        if (type === 'balc') {          // cantilevered balcony with railing + what people keep on it
          F.box(B, conc, cu, y + 0.92, 0.55, bw - 0.38, 0.16, 1.1, 0.25);
          F.box(B, railBar, cu, y + 2.08, 1.08, bw - 0.4, 0.05, 0.06);
          if (rng.chance(0.5)) F.box(B, M.glassFrost, cu, y + 1.55, 1.08, bw - 0.42, 0.95, 0.02);
          else for (let k = 0; k < Math.floor((bw - 0.5) / 0.12); k++) F.box(B, railBar, u + 0.4 + k * 0.12, y + 1.5, 1.08, 0.014, 1.1, 0.014);
          const roll = rng.next();
          if (roll < 0.35) laundryLine(B, F.p(u + 0.5, y + 3.0, 0.8), F.p(u + bw - 0.3, y + 3.0, 0.8), rng, 0.55);
          else if (roll < 0.6) for (let k = 0; k < rng.int(1, 3); k++) plant(B, F.m(u + 0.6 + k * 0.7, y + 1.0, 0.6), rng, { size: 0.85 });
          else if (roll < 0.72) ac.place(B, F.m(u + bw - 0.8, y + 1.0, 0.55), { floor: true, lod: y > 30 });
          else if (roll < 0.8) futon(B, F.m(cu, y + 2.1, 1.1), rng, { width: 1.0 });
        } else if (type === 'encl') {   // glazed-in balcony box
          F.box(B, M.metalDark, cu, y + 0.95, 0.35, bw - 0.38, 0.12, 0.75);
          F.box(B, M.glassFrost, cu, y + 2.15, 0.72, bw - 0.42, 2.3, 0.02);
          for (const du of [-(bw - 0.42) / 2, (bw - 0.42) / 2]) F.box(B, M.glassFrost, cu + du, y + 2.15, 0.35, 0.02, 2.3, 0.74);
          F.box(B, M.metalDark, cu, y + 3.32, 0.35, bw - 0.38, 0.08, 0.75);
        } else {                         // plain bay: occasional plants or an AC on the ledge
          const roll = rng.next();
          if (roll < 0.07) ac.place(B, F.m(u + 0.7 + rng.range(0, bw - 1.6), y + 1.0, -0.4).multiply(T(0, 0, 0, 0, 0, 0, 0.9)), { floor: true, lod: y > 30 });
          else if (roll < 0.14) for (let k = 0; k < rng.int(2, 4); k++) plant(B, F.m(u + 0.6 + k * 0.5, y + 1.0, -0.35), rng, { size: 0.8 });
          else if (roll < 0.17) dish().place(B, F.m(u + bw - 0.6, y + 1.3, -0.3).multiply(T(0, 0, 0, 0, 0.5, 0)));
        }
      }
      if (skip) F.box(B, conc, len - 0.18, y + FH / 2, -0.4, 0.36, FH, 0.8, 0.25);
    }
    if (scaf) {                          // tube scaffold, boards and netting
      const ua = scaf.b0 * bw, ub = (scaf.b1 + 1) * bw, ya = GF + scaf.f0 * FH, yb = GF + (scaf.f1 + 1) * FH;
      for (let u = ua; u <= ub + 0.01; u += 1.8) for (const w of [0.9, 1.9]) F.cyl(B, M.galv, 0.024, yb - ya + 1, u, (ya + yb) / 2 + 0.5, w, 'v', 6);
      for (let y = ya; y <= yb + 0.01; y += 1.7) {
        for (const w of [0.9, 1.9]) F.cyl(B, M.galv, 0.024, ub - ua, (ua + ub) / 2, y, w, 'u', 6);
        F.box(B, M.woodLight, (ua + ub) / 2, y - 0.03, 1.4, ub - ua, 0.04, 0.95, 0.5);
      }
      B.add(new THREE.PlaneGeometry(ub - ua + 0.2, yb - ya + 1.2), netMat, F.m((ua + ub) / 2, (ya + yb) / 2 + 0.6, 2.0));
      const sheet = lightBox({ w: 2.6, h: 1.2, d: 0.05, px: 90, intensity: 0.7, bracket: 0, painter: (x, w, h) => {
        x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a4a8a'; x.font = `bold 44px ${JP}`; x.textAlign = 'center'; x.fillText('外壁改修工事中', w / 2, 52);
        x.fillStyle = '#333'; x.font = `28px ${JP}`; x.fillText('ご迷惑をおかけします', w / 2, 92);
      } });
      sheet.applyMatrix4(F.m((ua + ub) / 2 - 1.3, ya + 1.2, 2.05)); root.add(sheet);
    }
    // parapet
    F.box(B, conc, len / 2, TOP + 0.7, -0.4, len, 1.4, 0.8, 0.25);
    // projecting signs for the businesses on the lower floors (street face only)
    if (fi === 0) for (const [u, v] of [[2.2, GF + 1.6], [27.6, GF + 2.2], [29.2, GF + 5.4]]) projectingSign(root, F, u, v, rng);
  });

  // ---------- ground floor shops ----------
  buildKonbini(world, B, root, rng);
  buildDrugstore(world, B, root, rng);
  buildLobbyPortal(world, B, root);
  // podium band between ground floor and the first egg-crate floor
  const SF = new Frame('+x', X1, 0, Z1);
  SF.box(B, M.concreteDark, 15, GF - 0.22, 0.05, 30, 0.45, 1.0, 0.25);
  // south + north ground floor walls (blind, with a side door and posters)
  const S = new Frame('+z', X0, 0, Z1);
  wallWithOpenings(B, conc, S, 22.5, GF, 0.4, [{ u: 17.5, v: 0.18, w: 1.0, h: 2.2 }], 0.25);
  const N = new Frame('-z', X1, 0, Z0);
  wallWithOpenings(B, conc, N, 22.5, GF, 0.4, [{ u: 2.0, v: 0.18, w: 6.0, h: 4.0 }], 0.25);

  // ---------- LED megascreen ----------
  buildLedScreen(world, root, { cx: X1, zc: -17, y0: 13, h: 16, chord: 20, bulge: 1.5 });

  // ---------- roof: cooling towers, rooftop letters, aviation light ----------
  for (const [x, z] of [[-24, -10], [-24, -16], [-19, -26]]) {
    B.add(new THREE.CylinderGeometry(1.4, 1.7, 2.6, 24), M.galv, T(x, TOP + 1.3, z));
    B.add(new THREE.CylinderGeometry(1.45, 1.45, 0.3, 24), M.metalDark, T(x, TOP + 2.7, z));
    for (let i = 0; i < 5; i++) B.add(new THREE.BoxGeometry(2.6, 0.03, 0.12), M.metalBlack, T(x, TOP + 2.86, z, 0, (i / 5) * Math.PI, 0));
  }
  world.steamSources.push({ p: new THREE.Vector3(-24, TOP + 3.0, -10), rate: 1.8, size: 2.6, rise: 1.6, color: 0x8c7aa8, spread: 1.0, life: 6, max: 8 });
  world.steamSources.push({ p: new THREE.Vector3(-19, TOP + 3.0, -26), rate: 1.4, size: 2.4, rise: 1.4, color: 0x8c7aa8, spread: 1.0, life: 6, max: 8 });
  // giant rooftop channel letters: 星野 HOSHINO
  const letters = lightBox({
    w: 14, h: 3.2, d: 0.5, px: 60, intensity: 1.6, bracket: 0.0, frame: M.metalDark, painter: (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ff2b3d'; x.font = `bold ${h * 0.82}px ${JPM}`; x.textBaseline = 'middle'; x.fillText('星野', 10, h / 2 + 6);
      x.font = `900 ${h * 0.62}px ${LAT}`; x.fillStyle = '#ffffff'; x.fillText('HOSHINO', w * 0.33, h / 2 + 4);
    },
  });
  letters.rotation.y = -Math.PI / 2; letters.position.set(-8.3, TOP + 3.4, -10);
  root.add(letters);
  for (let z = -16; z <= -4; z += 2) B.rod(M.metalDark, 0.05, new THREE.Vector3(-8.6, TOP + 1.4, z), new THREE.Vector3(-8.6, TOP + 1.8, z));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow(0xff1a1a, 14).clone());
  beacon.position.set(-28, TOP + 6.2, -30); root.add(beacon);
  B.rod(M.galv, 0.05, new THREE.Vector3(-28, TOP + 1.4, -30), new THREE.Vector3(-28, TOP + 6.1, -30));
  world.updaters.push((t) => { beacon.visible = ((t + 0.7) % 1.9) < 0.3; });

  B.build(root);
  return root;
}


/* A shop gondola stocked with real 3D goods: runs of boxes, bottles and pouches faced up on each shelf. */
const GOODS = [0xd8322a, 0xf2c230, 0x2a7ad8, 0xf2f2ee, 0x3aa85a, 0xe86a2a, 0x7a3ab0, 0x1a1a1a, 0xf28ab0, 0x8ad8f2];
let _goodsM = null, _railM = null;
function gondola(B, rng, cx, z, len, shelves, { both = true, h0 = 0.32, dh = 0.36 } = {}) {
  _goodsM ||= GOODS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
  _railM ||= new THREE.MeshStandardMaterial({ color: 0xf2f2ee, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5 });
  const x0 = cx - len / 2, x1 = cx + len / 2;
  B.add(new THREE.BoxGeometry(len, 0.12, both ? 0.8 : 0.42), M.plasticWhite, T(cx, 0.26, both ? z : z));
  B.add(new THREE.BoxGeometry(len, h0 + shelves * dh, 0.05), M.steel, T(cx, 0.2 + (h0 + shelves * dh) / 2, z));
  for (const sd of both ? [-1, 1] : [1]) for (let sh = 0; sh < shelves; sh++) {
    const y = h0 + sh * dh, zz = z + sd * 0.2;
    B.add(new THREE.BoxGeometry(len, 0.025, 0.36), M.plasticWhite, T(cx, y, zz));
    B.add(new THREE.BoxGeometry(len, 0.035, 0.012), _railM, T(cx, y + 0.005, z + sd * 0.385));
    let x = x0 + 0.03;
    while (x < x1 - 0.12) {
      const t = rng.next(), m = rng.pick(_goodsM);
      const facing = rng.int(2, 5);
      for (let f = 0; f < facing && x < x1 - 0.12; f++) {
        if (t < 0.4) { const w = 0.09, h = rng.range(0.14, Math.min(0.26, dh - 0.06)); for (let d = 0; d < 2; d++) B.add(new THREE.BoxGeometry(w, h, 0.07), m, T(x + w / 2, y + 0.0125 + h / 2, zz + sd * (0.1 - d * 0.12))); x += w + 0.01; }
        else if (t < 0.7) { const r = 0.033, h = rng.range(0.15, Math.min(0.22, dh - 0.1)); for (let d = 0; d < 2; d++) B.add(new THREE.CylinderGeometry(r, r, h, 10), m, T(x + r, y + 0.0125 + h / 2, zz + sd * (0.1 - d * 0.1))); B.add(new THREE.CylinderGeometry(0.014, r, 0.05, 8), m, T(x + r, y + 0.0125 + h + 0.025, zz + sd * 0.1)); x += 2 * r + 0.008; }
        else { const w = 0.16, h = rng.range(0.16, Math.min(0.24, dh - 0.06)); B.add(new THREE.CapsuleGeometry(0.035, h - 0.07, 3, 8), m, T(x + w / 2, y + 0.0125 + h / 2, zz + sd * 0.06, 0, 0, 0, w / 0.07, 1, 1.6)); x += w + 0.01; }
      }
      x += rng.range(0.0, 0.04);
    }
  }
}

/* ----------------------------- NEKOMART 24 ----------------------------- */
function buildKonbini(world, B, root, rng) {
  const xg = -7.9, xi = -16, z0 = -13.8, z1 = -2.2, ceil = 3.6;
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.2 });
  B.add(boxGeo(xg - xi, 0.04, z1 - z0, 1.2), M.tileWhite, T((xg + xi) / 2, 0.2, (z0 + z1) / 2));
  B.add(new THREE.BoxGeometry(xg - xi, 0.1, z1 - z0), white, T((xg + xi) / 2, ceil + 0.05, (z0 + z1) / 2));
  for (let x = xi + 1; x < xg - 0.5; x += 1.6) B.add(new THREE.BoxGeometry(0.22, 0.03, z1 - z0 - 1), glow(0xf2fbff, 4.5), T(x, ceil - 0.02, (z0 + z1) / 2));
  // walls
  B.add(boxGeo(0.1, ceil, z1 - z0, 0.5), white, T(xi, ceil / 2 + 0.18, (z0 + z1) / 2));
  B.add(boxGeo(xg - xi, ceil, 0.1, 0.5), white, T((xg + xi) / 2, ceil / 2 + 0.18, z0));
  B.add(boxGeo(xg - xi, ceil, 0.1, 0.5), white, T((xg + xi) / 2, ceil / 2 + 0.18, z1));
  // drinks fridges on the back wall: glowing glass doors over bottle rows
  const fridge = drawCanvas(1024, 256, (x) => {
    const r = new RNG(5);
    x.fillStyle = '#dff4ff'; x.fillRect(0, 0, 1024, 256);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 46; i++) {
      x.fillStyle = `hsl(${r.pick([0, 30, 50, 120, 200, 210, 280, 330])},${r.range(60, 95)}%,${r.range(35, 60)}%)`;
      rr(x, 6 + i * 22, 10 + j * 62, 16, 52, 5); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(9 + i * 22, 22 + j * 62, 4, 30);
    }
    x.fillStyle = 'rgba(40,60,80,0.8)'; for (let i = 0; i <= 8; i++) x.fillRect(i * 128 - 3, 0, 6, 256);
  });
  const fm = faceMaterial(fridge, 1.25);
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 2.0), fm); fr.position.set(xi + 0.12, 1.3, (z0 + z1) / 2 - 0.3); fr.rotation.y = Math.PI / 2; root.add(fr);
  B.add(new THREE.BoxGeometry(0.3, 2.4, 10.8), M.steel, T(xi + 0.2, 1.38, (z0 + z1) / 2 - 0.3));
  // gondola shelving rows
  const prodTex = productTexture(7);
  const prod = new THREE.MeshStandardMaterial({ map: prodTex, emissiveMap: prodTex, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.5 });
  // real gondolas: kick plate, steel spine, four shelves with price rails, stocked with 3D goods
  for (const z of [-4.6, -7.2, -9.8]) {
    gondola(B, rng, -12.3, z, 5.2, 4);
    B.add(new THREE.BoxGeometry(0.4, 0.3, 0.02), glow(0xff2b3d, 1.6), T(-9.8, 1.85, z + 0.2));
  }
  // magazine rack along the window
  for (let i = 0; i < 18; i++) {
    const z = -3.2 - i * 0.32;
    B.add(new THREE.BoxGeometry(0.03, 0.32, 0.24), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rng.next(), 0.6, 0.55), roughness: 0.4 }), T(-8.35, 1.0 + (i % 2) * 0.02, z, 0, 0, 0.25));
  }
  // magazine rack: slanted steel shelf with a lip
  B.add(new THREE.BoxGeometry(0.42, 0.04, 6.0), M.steel, T(-8.4, 0.82, -6.0, 0, 0, 0.25));
  B.add(new THREE.BoxGeometry(0.04, 0.12, 6.0), M.steel, T(-8.2, 0.78, -6.0));
  for (const z of [-3.1, -6.0, -8.9]) B.add(new THREE.BoxGeometry(0.04, 0.8, 0.04), M.steel, T(-8.55, 0.6, z));
  // checkout counter: laminate front with a kick recess, worktop, two POS terminals with customer displays,
  // a lit hot-snack case with shelves of karaage, the oden pot with compartments, a donation box, bags
  const lam = new THREE.MeshStandardMaterial({ color: 0xe9e7e0, roughness: 0.4 });
  B.add(new THREE.BoxGeometry(0.9, 0.86, 3.6), lam, T(-11.25, 0.63, -12.4));
  B.add(new THREE.BoxGeometry(0.05, 0.14, 3.6), M.plasticBlack, T(-10.83, 0.27, -12.4));
  B.add(new THREE.BoxGeometry(1.02, 0.04, 3.7), new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.25, metalness: 0.3 }), T(-11.22, 1.08, -12.4));
  B.add(new THREE.BoxGeometry(0.03, 0.18, 3.5), glow(0x00a87a, 1.4), T(-10.82, 0.9, -12.4));
  for (const z of [-11.3, -12.2]) {
    B.add(new THREE.BoxGeometry(0.34, 0.1, 0.42), M.plasticBlack, T(-11.35, 1.15, z));
    B.add(new THREE.BoxGeometry(0.05, 0.28, 0.34), M.plasticBlack, T(-11.5, 1.32, z, 0, 0, -0.35));
    B.add(new THREE.BoxGeometry(0.01, 0.22, 0.3), glow(0x9ae8ff, 1.6), T(-11.47, 1.33, z, 0, 0, -0.35));
    B.add(new THREE.BoxGeometry(0.04, 0.12, 0.18), M.plasticBlack, T(-10.95, 1.2, z, 0, 0, 0.3));
    B.add(new THREE.BoxGeometry(0.005, 0.09, 0.15), glow(0x6effc8, 1.8), T(-10.925, 1.2, z, 0, 0, 0.3));
  }
  const warm = new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: 0xff9a3a, emissiveIntensity: 0.9, roughness: 0.3 });
  B.add(new THREE.BoxGeometry(0.6, 0.06, 0.8), M.steel, T(-11.2, 1.13, -13.05));
  B.add(new THREE.BoxGeometry(0.6, 0.5, 0.8), M.glassClear, T(-11.2, 1.41, -13.05));
  for (const y of [1.2, 1.44]) {
    B.add(new THREE.BoxGeometry(0.55, 0.012, 0.75), warm, T(-11.2, y, -13.05));
    for (let k = 0; k < 6; k++) B.add(new THREE.SphereGeometry(0.035, 7, 5), new THREE.MeshStandardMaterial({ color: 0xb8742a, roughness: 0.75 }), T(-11.2 + rng.range(-0.18, 0.18), y + 0.03, -13.05 + rng.range(-0.3, 0.3), 0, 0, 0, 1.2, 0.8, 1));
  }
  B.add(new THREE.BoxGeometry(0.55, 0.02, 0.75), glow(0xffd08a, 2.2), T(-11.2, 1.65, -13.05));
  B.add(new THREE.BoxGeometry(0.62, 0.18, 0.6), M.steel, T(-11.2, 1.19, -13.85));
  for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) B.add(new THREE.BoxGeometry(0.26, 0.02, 0.26), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.3 }), T(-11.2 + dx, 1.27, -13.85 + dz));
  B.add(new THREE.BoxGeometry(0.16, 0.2, 0.12), M.glassClear, T(-11.0, 1.2, -11.75));
  B.add(new THREE.BoxGeometry(0.3, 0.35, 0.02), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 }), T(-11.55, 0.98, -11.75, 0, 0.2, 0));
  // cigarette wall behind the counter
  B.add(new THREE.BoxGeometry(0.25, 1.4, 3.4), M.plasticBlack, T(-12.6, 1.6, -12.4));
  for (let r2 = 0; r2 < 6; r2++) for (let c2 = 0; c2 < 16; c2++) B.add(new THREE.BoxGeometry(0.03, 0.1, 0.17), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rng.next(), 0.5, 0.5), roughness: 0.4 }), T(-12.46, 1.0 + r2 * 0.22, -13.95 + c2 * 0.205));
  world.steamSources.push({ p: new THREE.Vector3(-11.2, 1.45, -13.4), rate: 0.6, size: 0.35, rise: 0.4, color: 0xffffff, spread: 0.25, life: 2.5, max: 3 });
  figure(root, { x: -11.9, y: 0.2, z: -12.4, ry: Math.PI / 2, pose: 'standing', coat: 0x0c7a52, hair: 0x2a1a10, seed: 21 });
  figure(root, { x: -10.2, y: 0.2, z: -6.0, ry: Math.PI, pose: 'standing', coat: 0x2c2c34, hair: 0x101010, seed: 22, hood: true });
  // storefront: glass, mullions, auto door
  for (let z = z1; z >= z0 - 0.01; z -= 1.45) B.add(new THREE.BoxGeometry(0.08, 3.45, 0.06), M.steel, T(xg, 0.18 + 1.72, z));
  B.add(new THREE.BoxGeometry(0.02, 3.4, z1 - z0), M.glassClear, T(xg + 0.02, 1.9, (z0 + z1) / 2));
  B.add(new THREE.BoxGeometry(0.1, 0.1, z1 - z0), M.steel, T(xg, 3.62, (z0 + z1) / 2));
  // sign band: teal / white / blue stripes + cat
  const band = drawCanvas(2048, 180, (x) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 2048, 180);
    x.fillStyle = '#00a87a'; x.fillRect(0, 0, 2048, 52);
    x.fillStyle = '#ff8a00'; x.fillRect(0, 52, 2048, 18);
    x.fillStyle = '#0d5bd8'; x.fillRect(0, 128, 2048, 52);
    x.fillStyle = '#0d5bd8'; x.font = `900 92px ${LAT}`; x.textBaseline = 'middle'; x.fillText('NEKOMART', 250, 100);
    x.fillStyle = '#ff8a00'; x.font = `900 92px ${LAT}`; x.fillText('24', 770, 100);
    // cat head logo
    x.fillStyle = '#00a87a'; x.beginPath(); x.arc(150, 100, 52, 0, 7); x.fill();
    x.beginPath(); x.moveTo(108, 70); x.lineTo(112, 22); x.lineTo(145, 55); x.fill(); x.beginPath(); x.moveTo(192, 70); x.lineTo(188, 22); x.lineTo(155, 55); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(132, 96, 9, 0, 7); x.arc(168, 96, 9, 0, 7); x.fill();
    x.fillStyle = '#0d5bd8'; x.font = `bold 54px ${JP}`; x.fillText('ねこマート', 1000, 100);
    x.font = `bold 34px ${LAT}`; x.fillText('ATM · COFFEE · ODEN · TICKETS', 1400, 100);
  });
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(11.8, 1.04), faceMaterial(band, 1.1));
  bm.position.set(-7.42, 4.15, (z0 + z1) / 2); bm.rotation.y = Math.PI / 2; root.add(bm);
  B.add(new THREE.BoxGeometry(0.15, 1.14, 11.9), M.metalDark, T(-7.52, 4.15, (z0 + z1) / 2));
  // light spilling out onto the pavement
  const rect = new THREE.RectAreaLight(0xe6f4ff, 5, 11.5, 3.3);
  rect.position.set(-7.75, 1.9, (z0 + z1) / 2); rect.lookAt(0, 1.6, (z0 + z1) / 2);
  root.add(rect);
  // outside: umbrella stand, recycle station, ashtray, bike, a cat
  for (let i = 0; i < 4; i++) {
    const col = [0x1e8a5a, 0x2a5bd8, 0xd8a000, 0xc81e2a][i];
    B.add(new THREE.BoxGeometry(0.42, 0.95, 0.42), new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 }), T(-7.2, 0.66, -14.6 + i * 0.48));
    B.add(new THREE.BoxGeometry(0.2, 0.06, 0.02), M.plasticBlack, T(-6.98, 1.0, -14.6 + i * 0.48, 0, Math.PI / 2, 0));
  }
  B.add(new THREE.CylinderGeometry(0.2, 0.2, 0.75, 16, 1, true), M.steel, T(-7.1, 0.56, -1.0));
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    B.add(new THREE.CylinderGeometry(0.008, 0.008, 0.95, 4), M.chrome, T(-7.1 + Math.cos(a) * 0.08, 0.95, -1.0 + Math.sin(a) * 0.08, Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12));
    B.add(new THREE.ConeGeometry(0.06, 0.6, 8), M.glassClear, T(-7.1 + Math.cos(a) * 0.11, 0.9, -1.0 + Math.sin(a) * 0.11, Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12));
  }
  B.add(new THREE.CylinderGeometry(0.15, 0.13, 0.85, 16), M.steel, T(-6.8, 0.6, -2.6));
  bicycle(root, -6.6, 0.18, -15.8, Math.PI / 2 + 0.1, 0xb8b8b0);
  const cat = new THREE.Group();
  const catM = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), catM); body.scale.set(0.8, 1.1, 1.3); body.position.y = 0.14; cat.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), catM); head.position.set(0, 0.32, 0.08); cat.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 4), catM); e.position.set(s * 0.04, 0.4, 0.07); cat.add(e); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), glow(0xc8ff4a, 6)); eye.position.set(s * 0.028, 0.33, 0.145); cat.add(eye); }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 12, Math.PI), catM); tail.position.set(0.05, 0.05, -0.12); tail.rotation.set(Math.PI / 2, 0, 0.3); cat.add(tail);
  cat.position.set(-6.75, 0.18, -3.4); cat.rotation.y = Math.PI / 2 + 0.4;
  root.add(cat);
  world.updaters.push((t) => { head.rotation.y = Math.sin(t * 0.4) * 0.5; tail.rotation.z = 0.3 + Math.sin(t * 2.0) * 0.3; });
}

/* ------------------------------ Drugstore ------------------------------ */
function buildDrugstore(world, B, root, rng) {
  const z0 = -23.2, z1 = -14.8, xi = -14, xg = -7.7, ceil = 3.7;
  B.add(boxGeo(xg - xi, 0.04, z1 - z0, 1.2), M.tileWhite, T((xg + xi) / 2, 0.2, (z0 + z1) / 2));
  B.add(new THREE.BoxGeometry(xg - xi, 0.1, z1 - z0), M.plasticWhite, T((xg + xi) / 2, ceil + 0.05, (z0 + z1) / 2));
  for (let x = xi + 0.8; x < xg; x += 1.2) B.add(new THREE.BoxGeometry(0.15, 0.03, z1 - z0 - 0.6), glow(0xffffff, 5), T(x, ceil - 0.02, (z0 + z1) / 2));
  const prodTex = productTexture(19, true);
  const prod = new THREE.MeshStandardMaterial({ map: prodTex, emissiveMap: prodTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.5 });
  // walls lined with product
  for (const [px, pz, ry, w] of [[xi + 0.1, (z0 + z1) / 2, Math.PI / 2, z1 - z0], [(xg + xi) / 2, z0 + 0.1, 0, xg - xi], [(xg + xi) / 2, z1 - 0.1, Math.PI, xg - xi]]) {
    B.add(new THREE.PlaneGeometry(w - 0.2, 2.6), prod, T(px, 1.5, pz, 0, ry, 0));
  }
  for (const z of [-21, -19, -17]) gondola(B, rng, -11.0, z, 4.4, 4);
  // open front: sidewalk bins of goods + yellow POP cards
  for (let i = 0; i < 5; i++) {
    const z = z0 + 0.9 + i * 1.6;
    B.add(new THREE.BoxGeometry(0.9, 0.06, 1.2), M.galv, T(-7.25, 0.95, z));
    for (const a of [-0.4, 0.4]) for (const b of [-0.55, 0.55]) B.add(new THREE.CylinderGeometry(0.015, 0.015, 0.8), M.galv, T(-7.25 + a, 0.55, z + b));
    for (let k = 0; k < 14; k++) B.add(new THREE.BoxGeometry(0.14, 0.18, 0.1), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rng.pick([0, 0.08, 0.15, 0.55, 0.6]), 0.8, 0.5), roughness: 0.4 }), T(-7.25 + rng.range(-0.35, 0.35), 1.07, z + rng.range(-0.5, 0.5), 0, rng.range(0, 3), 0));
    B.add(new THREE.BoxGeometry(0.02, 0.3, 0.42), glow(0xffe400, 1.4), T(-6.78, 1.18, z, 0, 0, -0.2));
  }
  // loud yellow sign band
  const band = drawCanvas(1600, 200, (x) => {
    x.fillStyle = '#ffe100'; x.fillRect(0, 0, 1600, 200);
    x.fillStyle = '#e60012'; x.fillRect(0, 0, 220, 200);
    x.fillStyle = '#fff'; x.font = `bold 160px ${JPM}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('薬', 110, 108);
    x.fillStyle = '#0a2fa8'; x.font = `900 110px ${JP}`; x.fillText('マツモト', 590, 100);
    x.fillStyle = '#e60012'; x.font = `900 92px ${LAT}`; x.fillText('DRUG', 1130, 104);
    x.fillStyle = '#0a2fa8'; x.font = `bold 38px ${JP}`; x.fillText('処方箋 · 化粧品 · 24時', 1430, 104);
  });
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 1.08), faceMaterial(band, 1.15));
  bm.position.set(-7.42, 4.15, (z0 + z1) / 2); bm.rotation.y = Math.PI / 2; root.add(bm);
  B.add(new THREE.BoxGeometry(0.15, 1.18, 8.7), M.metalDark, T(-7.52, 4.15, (z0 + z1) / 2));
  const rect = new THREE.RectAreaLight(0xfff6d8, 6, 8.2, 3.4);
  rect.position.set(-7.6, 1.9, (z0 + z1) / 2); rect.lookAt(0, 1.4, (z0 + z1) / 2);
  root.add(rect);
  // columns between shops
  for (const z of [-14.4, -23.6]) B.add(boxGeo(0.9, GF, 0.8, 0.5), M.concrete, T(-7.95, GF / 2, z));
  B.add(boxGeo(0.9, GF, 0.6, 0.5), M.concrete, T(-7.95, GF / 2, -1.9));
}

/* ---------------------------- Lobby portal ---------------------------- */
function buildLobbyPortal(world, B, root) {
  const z0 = -31.6, z1 = -24.0, depth = 3.2, xf = -7.5;
  const granite = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.08, metalness: 0.2 });
  // massive portal frame
  B.add(boxGeo(1.2, GF, 0.9, 0.25), M.concrete, T(xf - 0.6, GF / 2, z1 + 0.45));
  B.add(boxGeo(1.2, GF, 0.9, 0.25), M.concrete, T(xf - 0.6, GF / 2, z0 - 0.0));
  // recess: granite walls, coffered ceiling with downlights
  B.add(boxGeo(depth, 0.04, z1 - z0, 0.5), granite, T(xf - depth / 2, 0.2, (z0 + z1) / 2));
  B.add(boxGeo(depth, 4.4, 0.1, 0.5), granite, T(xf - depth / 2, 2.4, z0 + 0.45));
  B.add(boxGeo(depth, 4.4, 0.1, 0.5), granite, T(xf - depth / 2, 2.4, z1 - 0.05));
  B.add(boxGeo(depth, 0.3, z1 - z0, 0.5), M.concreteDark, T(xf - depth / 2, 4.5, (z0 + z1) / 2));
  for (let x = xf - 0.6; x > xf - depth; x -= 0.9) for (let z = z0 + 1.0; z < z1 - 0.4; z += 1.1) B.add(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), glow(0xffe2b8, 6), T(x, 4.34, z));
  // glass doors at the back of the recess
  B.add(new THREE.BoxGeometry(0.02, 3.6, z1 - z0 - 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: 0xffd2a0, emissiveIntensity: 0.5, roughness: 0.05, transparent: true, opacity: 0.8 }), T(xf - depth, 2.0, (z0 + z1) / 2));
  for (let z = z0 + 0.4; z <= z1 - 0.3; z += 1.7) B.add(new THREE.BoxGeometry(0.08, 3.6, 0.06), M.brass, T(xf - depth + 0.03, 2.0, z));
  // turnstiles + guard booth
  for (let i = 0; i < 3; i++) {
    B.add(new THREE.BoxGeometry(0.9, 1.0, 0.2), M.steel, T(xf - 2.2, 0.7, z0 + 2.2 + i * 1.2));
    B.add(new THREE.BoxGeometry(0.02, 0.12, 0.16), glow(i === 1 ? 0xff2a2a : 0x2aff7a, 3), T(xf - 1.74, 1.1, z0 + 2.2 + i * 1.2));
  }
  B.add(new THREE.BoxGeometry(1.4, 2.4, 1.6), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.3, metalness: 0.6 }), T(xf - 1.6, 1.4, z1 - 1.0));
  B.add(new THREE.BoxGeometry(0.02, 0.9, 1.3), new THREE.MeshStandardMaterial({ color: 0x0a0f10, emissive: 0x7ad7ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 }), T(xf - 0.89, 1.9, z1 - 1.0));
  figure(root, { x: xf - 1.6, y: 0.2, z: z1 - 1.0, ry: -Math.PI / 2, pose: 'standing', coat: 0x10141c, hair: 0x050505, seed: 41 });
  // the big "7" neon on the granite + bronze nameplate
  const seven = neonSign({ text: '7', height: 2.4, color: 0xffd6a0, intensity: 6, materials: M, halo: 0.9, raceway: false, tube: 0.06 });
  seven.group.position.set(xf - 1.6, 1.6, z0 + 0.52); root.add(seven.group);
  const plate = drawCanvas(1024, 256, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#6b4a1e'); g.addColorStop(0.5, '#c79b4a'); g.addColorStop(1, '#5a3c14');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 256);
    x.fillStyle = '#2a1a06'; x.font = `bold 72px ${JPM}`; x.textAlign = 'center'; x.fillText('星野第七住宅棟', 512, 110);
    x.font = `600 40px ${LAT}`; x.fillText('HOSHINO RESIDENTIAL BLOCK 7', 512, 190);
  });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshStandardMaterial({ map: plate, metalness: 0.9, roughness: 0.3 }));
  pm.position.set(xf + 0.01, 3.6, z1 + 0.45); pm.rotation.y = Math.PI / 2;
  // move plate onto the portal pier face
  pm.position.set(xf + 0.005, 4.2, (z0 + z1) / 2); root.add(pm);
  B.add(new THREE.BoxGeometry(0.3, 0.8, z1 - z0 + 1.2), M.concrete, T(xf - 0.15, 4.8, (z0 + z1) / 2));
  const warm = new THREE.PointLight(0xffd2a0, 6, 9, 1.8); warm.position.set(xf - 1.4, 3.6, (z0 + z1) / 2); root.add(warm);
  // security camera with a red tally
  B.add(new THREE.BoxGeometry(0.4, 0.14, 0.14), M.plasticWhite, T(xf + 0.2, 4.0, z0 + 0.8, 0, 0.6, -0.3));
  B.add(new THREE.SphereGeometry(0.02, 6, 4), glow(0xff0000, 10), T(xf + 0.4, 3.95, z0 + 0.75));
}
