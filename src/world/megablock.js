import * as THREE from 'three';
import { Batch, T, RNG, boxGeo } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';
import { Frame, wallWithOpenings } from '../core/facade.js';
import { WIN } from '../core/windows.js';
import { neonSign } from '../core/neon.js';
import { acUnit, plant, dish, trashBag, bicycle, laundryLine } from '../core/prefabs.js';
import { faceMaterial, lightBox, JP, JPM, LAT, vtext, rr } from './signs.js';
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
  for (const { F, len, skip, blind } of faces) {
    const bays = Math.round(len / 3.4);
    const bw = len / bays;
    for (let f = 0; f < NF; f++) {
      const y = GF + f * FH;
      // spandrel
      if (!skip || !skip(len / 2, y + 0.5) || true) {
        // split the spandrel so it can stop at the screen
        let segStart = 0;
        for (let b = 0; b <= bays; b++) {
          const u = b * bw;
          const hidden = skip && b < bays && skip(u + bw / 2, y + 0.5);
          if (hidden || b === bays) {
            if (u - segStart > 0.01) F.box(B, conc, (segStart + u) / 2, y + 0.5, -0.4, u - segStart, 1.0, 0.8, 0.25);
            segStart = u + bw;
          }
        }
      }
      for (let b = 0; b < bays; b++) {
        const u = b * bw;
        if (skip && skip(u + bw / 2, y + 1.5)) continue;
        // vertical fin
        F.box(B, conc, u + 0.18, y + FH / 2, -0.4, 0.36, FH, 0.8, 0.25);
        if (blind && rng.chance(0.7)) { F.box(B, M.concreteDark, u + bw / 2, y + 2.2, -0.75, bw - 0.36, 2.4, 0.1, 0.25); continue; }
        const boarded = rng.chance(0.035);
        const c = F.p(u + bw / 2 + 0.09, y + 2.2, -0.82);
        if (boarded) {
          F.box(B, M.woodLight, u + bw / 2 + 0.09, y + 2.2, -0.8, bw - 0.4, 2.3, 0.04, 0.5);
        } else {
          world.windows.add(c.x, c.y, c.z, F.ry, bw - 0.42, 2.3, { style: rng.chance(0.5) ? WIN.SLIDER : WIN.PLAIN, depth: 4.2, lit: 0.42, seed: c.x * 3.1 + c.y * 7.3 + c.z * 1.7 });
        }
        // life on the ledges
        const roll = rng.next();
        if (roll < 0.22) ac.place(B, F.m(u + 0.7 + rng.range(0, bw - 1.6), y + 1.0, -0.4).multiply(T(0, 0, 0, 0, 0, 0, 0.9)), { floor: true, lod: y > 30 });
        else if (roll < 0.3) for (let k = 0; k < rng.int(2, 4); k++) plant(B, F.m(u + 0.6 + k * 0.5, y + 1.0, -0.35), rng, { size: 0.8 });
        else if (roll < 0.34) dish().place(B, F.m(u + bw - 0.6, y + 1.3, -0.3).multiply(T(0, 0, 0, 0, 0.5, 0)));
        else if (roll < 0.38) laundryLine(B, F.p(u + 0.4, y + 3.1, -0.15), F.p(u + bw - 0.2, y + 3.1, -0.15), rng, 0.6);
      }
      if (skip) F.box(B, conc, len - 0.18, y + FH / 2, -0.4, 0.36, FH, 0.8, 0.25);
    }
    // parapet
    F.box(B, conc, len / 2, TOP + 0.7, -0.4, len, 1.4, 0.8, 0.25);
  }

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
  for (const z of [-4.6, -7.2, -9.8]) {
    B.add(new THREE.BoxGeometry(5.2, 1.45, 0.75), M.plasticWhite, T(-12.3, 0.92, z));
    const g = new THREE.PlaneGeometry(5.0, 1.3);
    B.add(g, prod, T(-12.3, 0.95, z + 0.38));
    B.add(g, prod, T(-12.3, 0.95, z - 0.38, 0, Math.PI, 0));
    B.add(new THREE.BoxGeometry(0.4, 0.3, 0.02), glow(0xff2b3d, 1.6), T(-9.8, 1.85, z + 0.2));
  }
  // magazine rack along the window
  for (let i = 0; i < 18; i++) {
    const z = -3.2 - i * 0.32;
    B.add(new THREE.BoxGeometry(0.03, 0.32, 0.24), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rng.next(), 0.6, 0.55), roughness: 0.4 }), T(-8.35, 1.0 + (i % 2) * 0.02, z, 0, 0, 0.25));
  }
  B.add(new THREE.BoxGeometry(0.4, 0.9, 6.0), M.plasticWhite, T(-8.4, 0.63, -6.0));
  // checkout counter with register + hot snack warmer + oden
  B.add(new THREE.BoxGeometry(1.0, 1.0, 3.4), white, T(-11.2, 0.68, -12.4));
  B.add(new THREE.BoxGeometry(0.6, 0.45, 0.7), M.plasticBlack, T(-11.2, 1.4, -11.4));
  B.add(new THREE.BoxGeometry(0.02, 0.25, 0.4), glow(0x6effc8, 2), T(-10.88, 1.48, -11.4));
  B.add(new THREE.BoxGeometry(0.7, 0.55, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: 0xff8a2a, emissiveIntensity: 1.2, roughness: 0.2 }), T(-11.2, 1.45, -12.6));
  B.add(new THREE.BoxGeometry(0.75, 0.2, 0.9), M.steel, T(-11.2, 1.28, -13.4));
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
  for (const z of [-21, -19, -17]) {
    B.add(new THREE.BoxGeometry(4.4, 1.6, 0.8), M.plasticWhite, T(-11.0, 1.0, z));
    B.add(new THREE.PlaneGeometry(4.2, 1.4), prod, T(-11.0, 1.0, z + 0.41));
    B.add(new THREE.PlaneGeometry(4.2, 1.4), prod, T(-11.0, 1.0, z - 0.41, 0, Math.PI, 0));
  }
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
