import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, T, RNG, U, boxGeo, GLSL_NOISE } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';
import { Frame, wallWithOpenings, wallWithWindows } from '../core/facade.js';
import { WIN } from '../core/windows.js';
import { neonSign } from '../core/neon.js';
import { acUnit, plant, lantern, futon, laundryLine, waterTank } from '../core/prefabs.js';
import { lightBox, faceMaterial, chaser, rectPerimeter, JP, JPM, LAT, vtext, rr, projectingSign } from './signs.js';
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
  buildSouthEnd(world, B, root, rng);
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
/**
 * A building with a real façade: walls with openings, recessed framed windows,
 * slab bands and per-building "programs" so no two blocks share a rhythm.
 *  program: 'units'   – residential units: kitchen grille window + door-height slider + bath vent
 *           'paired'  – paired narrow windows separated by solid piers
 *           'ribbon'  – continuous strip windows under deep spandrels
 *           'curtain' – glass curtain wall (office), mullion grid
 *           'balcony' – sliding doors behind balcony slabs with railings
 *           'hotel'   – small punched windows, alternating with AC sleeves
 */
// external steel fire stair hung on the façade between u0 and u0 + 2.6
function fireStair(B, F, u0, floors, floorH, h) {
  const steel = M.metalDark, w = 2.6, out = 1.25;
  for (const y of floors) {
    F.box(B, steel, u0 + w / 2, y, out / 2 + 0.05, w, 0.06, out);                       // landing
    F.box(B, steel, u0 + w / 2, y + 1.05, out + 0.05, w, 0.05, 0.05);                   // top rail
    F.box(B, M.galv, u0 + w / 2, y + 0.55, out + 0.06, w, 0.9, 0.012, 0.5);             // mesh panel
    for (const uu of [u0 + 0.03, u0 + w - 0.03]) F.box(B, steel, uu, y + floorH / 2, out + 0.05, 0.06, floorH, 0.06);
    // two flights per storey, zig-zagging along the wall
    for (const [a, dir] of [[0, 1], [1, -1]]) {
      const run = w - 0.5, rise = floorH / 2;
      const len = Math.hypot(run, rise), ang = Math.atan2(rise, run) * dir;
      const cu = u0 + w / 2, cv = y + rise * (a + 0.5);
      B.add(new THREE.BoxGeometry(len, 0.05, out * 0.46), steel, F.m(cu, cv, out * (a ? 0.27 : 0.75) + 0.05).multiply(T(0, 0, 0, 0, 0, ang)));
      B.add(new THREE.BoxGeometry(len, 0.04, 0.04), steel, F.m(cu, cv + 0.9, out * (a ? 0.04 : 0.98) + 0.05).multiply(T(0, 0, 0, 0, 0, ang)));
    }
  }
  F.box(B, steel, u0 + 0.03, h / 2, out + 0.05, 0.08, h, 0.08);
}
/**
 * A building with a real façade: walls with openings, recessed framed windows,
 * slab bands and per-building "programs" so no two blocks share a rhythm.
 *  program: 'units'   – flats: kitchen window (grille) + living slider, some with enclosed balconies
 *           'paired'  – paired narrow windows separated by solid piers
 *           'ribbon'  – continuous strip windows under deep spandrels
 *           'curtain' – glass curtain wall (office) with mullion fins and transoms
 *           'balcony' – sliding doors behind balcony slabs with railings and partitions
 *           'hotel'   – small punched windows, some with louvred vents
 * Plus what real buildings carry: a steel fire stair, downpipes, projecting
 * signs, roll shutters, and roof plant (stair house, water tank, antennas).
 */
function tower(world, B, { x0, x1, z0, z1, h, mat, faces, floor = 3.4, lit = 0.45, ground = 4.5, bands = true, program = 'units', kind = 'res', seed = 1, root = null, signs = 1, stair = null }) {
  const r = new RNG(Math.floor((x0 * 31 + z0 * 17 + h) * 13) + seed);
  const inset = 0.3;
  const fx0 = faces.includes('-x') ? x0 + inset : x0, fx1 = faces.includes('+x') ? x1 - inset : x1;
  const fz0 = faces.includes('-z') ? z0 + inset : z0, fz1 = faces.includes('+z') ? z1 - inset : z1;
  B.add(boxGeo(fx1 - fx0, h, fz1 - fz0, 0.25), mat, T((fx0 + fx1) / 2, h / 2, (fz0 + fz1) / 2));
  const frames = {
    '+x': new Frame('+x', x1, 0, z1), '-x': new Frame('-x', x0, 0, z0), '+z': new Frame('+z', x0, 0, z1), '-z': new Frame('-z', x1, 0, z0),
  };
  const lens = { '+x': z1 - z0, '-x': z1 - z0, '+z': x1 - x0, '-z': x1 - x0 };
  const ac = acUnit();
  const hasStair = stair !== null ? stair : program !== 'curtain' && h < 48 && r.chance(0.65);
  faces.forEach((f, fi) => {
    const F = frames[f], len = lens[f];
    const wins = [];
    const floors = [];
    for (let y = ground; y + floor <= h - 0.6; y += floor) floors.push(y);
    const stairHere = hasStair && fi === 0;
    const uEnd = stairHere ? len - 2.9 : len;
    const unitW = program === 'units' ? r.range(5.4, 6.6) : program === 'paired' ? r.range(3.8, 4.6) : program === 'hotel' ? r.range(2.6, 3.2) : program === 'balcony' ? r.range(3.6, 4.4) : 3.0;
    const nU = Math.max(1, Math.floor((uEnd - 0.6) / unitW));
    const pad = (uEnd - nU * unitW) / 2;
    const unitStyle = Array.from({ length: nU }, () => r.next());
    floors.forEach((y, fl) => {
      const v = y;
      for (let k = 0; k < nU; k++) {
        const u0 = pad + k * unitW;
        const s = r.next();
        if (program === 'units') {
          const mir = (k + (unitStyle[k] > 0.5 ? 1 : 0)) % 2;
          const kw = unitStyle[k] > 0.7 ? 1.2 : 0.9, lw = 2.0 + unitStyle[k] * 0.7;
          const ku = mir ? u0 + unitW - 0.5 - kw : u0 + 0.5, lu = mir ? u0 + 0.6 : u0 + unitW - 0.6 - lw;
          wins.push({ u: ku, v: v + 1.15, w: kw, h: 0.9, style: WIN.PLAIN, room: 2, grille: unitStyle[k] < 0.6, lit, kind });
          if (s < 0.1) {            // enclosed balcony: glazed box hung over the living window
            F.box(B, M.metalDark, lu + lw / 2, v + 0.15, 0.4, lw + 0.3, 0.12, 0.8);
            F.box(B, M.glassFrost, lu + lw / 2, v + 1.2, 0.8, lw + 0.25, 1.9, 0.02);
            F.box(B, M.metalDark, lu + lw / 2, v + 2.2, 0.4, lw + 0.3, 0.08, 0.8);
            wins.push({ u: lu, v: v + 0.55, w: lw, h: 1.75, style: WIN.SLIDER, lit: lit * 1.3, kind });
          } else wins.push({ u: lu, v: v + 0.55, w: lw, h: 1.75, style: WIN.SLIDER, lit, kind });
          if (s > 0.85) F.box(B, M.galv, ku + kw + 0.35, v + 2.3, 0.04, 0.18, 0.18, 0.08);
        } else if (program === 'paired') {
          const ww = 0.85 + (unitStyle[k] > 0.75 ? 0.35 : 0), gap = 0.16, cu = u0 + unitW / 2;
          wins.push({ u: cu - gap / 2 - ww, v: v + 0.8, w: ww, h: 1.55, style: WIN.PLAIN, lit, kind });
          wins.push({ u: cu + gap / 2, v: v + 0.8, w: ww, h: 1.55, style: unitStyle[k] > 0.4 ? WIN.PLAIN : WIN.SLIDER, lit, kind, seed: x0 + v * 3 + k });
        } else if (program === 'hotel') {
          if (s < 0.12) { F.box(B, M.galv, u0 + unitW / 2, v + 1.6, 0.04, unitW - 1.6, 0.5, 0.08); continue; }   // louvred vent
          wins.push({ u: u0 + 0.6, v: v + 1.0, w: unitW - 1.2, h: 1.25, style: WIN.PLAIN, lit, kind });
        } else if (program === 'balcony') {
          wins.push({ u: u0 + 0.35, v: v + 0.2, w: unitW - 0.7, h: 2.15, style: WIN.SLIDER, lit, kind });
        }
      }
      if (program === 'ribbon') wins.push({ u: 0.5, v: v + 1.0, w: uEnd - 1.0, h: 1.4, style: WIN.RIBBON, lit, kind });
      if (program === 'curtain') wins.push({ u: 0.15, v: v + 0.35, w: len - 0.3, h: floor - 0.55, style: WIN.RIBBON, lit, kind: 'office', inset: 0.08, glass: 3 });
      if (stairHere) wins.push({ u: len - 2.3, v: v + 0.2, w: 0.85, h: 2.05, style: WIN.PLAIN, lit: 0.15, kind });   // stair door
    });
    wallWithWindows(B, mat, F, len, h - ground, 0.3, wins.map((w) => ({ ...w, v: w.v - ground })), world.windows, { v0: ground, sillMat: program === 'curtain' ? null : M.concreteDark, kind });
    // curtain wall depth: mullion fins + transoms
    if (program === 'curtain') {
      for (let u = 0.15; u <= len - 0.1; u += 1.5) F.box(B, M.metalBlack, u, ground + (h - ground) / 2, 0.12, 0.07, h - ground, 0.24);
      for (const y of floors) F.box(B, M.metalBlack, len / 2, y + 0.2, 0.08, len, 0.32, 0.16);
    }
    // ground floor: a row of tenancies 4–7 m wide behind piers, each a lit shop, a shutter or a lobby door
    {
      const usable = len - 1.0, nb = Math.max(1, Math.round(usable / r.range(4.5, 6.5))), bwid = usable / nb;
      const opens = [], tens = [];
      for (let b = 0; b < nb; b++) {
        const u0 = 0.5 + b * bwid + 0.25, w = bwid - 0.5, t = r.next();
        const kindT = t < 0.45 ? 'shop' : t < 0.75 ? 'shutter' : 'lobby';
        const oh = kindT === 'lobby' ? 2.4 : ground - 1.4;
        const ow = kindT === 'lobby' ? Math.min(2.2, w) : w;
        const ou = kindT === 'lobby' ? u0 + (w - ow) / 2 : u0;
        opens.push({ u: ou, v: 0.2, w: ow, h: oh }); tens.push([kindT, ou, ow, oh]);
      }
      wallWithOpenings(B, r.chance(0.5) ? M.tileDark : M.concreteDark, F, len, ground, 0.3, opens, 0.5);
      for (const [kindT, ou, ow, oh] of tens) {
        const c = F.p(ou + ow / 2, 0.2 + oh / 2, -0.12);
        if (kindT === 'shop') {
          world.windows.add(c.x, c.y, c.z, F.ry, ow, oh, { style: WIN.SHOP, depth: 4, lit: 1, seed: c.x * 1.3 + c.z * 2.1, kind: 'shop' });
          F.box(B, M.metalDark, ou + ow / 2, ground - 0.85, 0.1, ow + 0.3, 0.7, 0.2);                    // fascia
        } else if (kindT === 'shutter') {
          F.box(B, M.corrugated, ou + ow / 2, 0.2 + oh / 2, -0.05, ow, oh, 0.04, 0.5);
          F.box(B, M.metalDark, ou + ow / 2, 0.2 + oh + 0.15, -0.02, ow + 0.1, 0.3, 0.22);
        } else {
          world.windows.add(c.x, c.y, c.z, F.ry, ow, oh, { style: WIN.PLAIN, depth: 5, lit: 0.9, seed: c.x * 2.7 + c.z, kind: 'stair' });
          F.box(B, M.steel, ou + ow / 2, 0.2 + oh + 0.08, 0.35, ow + 0.6, 0.08, 0.8);                      // canopy
          F.box(B, glow(0xfff1d8, 2.2), ou + ow / 2, 0.2 + oh + 0.03, 0.45, 0.5, 0.02, 0.12);
        }
      }
    }
    // slab bands, parapet with coping
    if (bands && program !== 'curtain') for (const y of floors) F.box(B, M.concreteDark, len / 2, y, 0.09, len, 0.2, 0.18);
    F.box(B, mat, len / 2, h + 0.5, -0.15, len, 1.0, 0.3, 0.25);
    F.box(B, M.galv, len / 2, h + 1.03, -0.15, len + 0.04, 0.06, 0.38);
    // downpipes at unit boundaries, with offsets at each slab
    const pipesU = [0.25, len - 0.25, pad + Math.floor(nU / 2) * unitW].filter((u, i) => i < 2 || r.chance(0.6));
    for (const u of pipesU) {
      if (stairHere && u > len - 3.0) continue;
      F.cyl(B, M.plasticGrey, 0.055, h, u, h / 2, 0.09, 'v', 8);
      for (const y of floors) F.box(B, M.plasticGrey, u, y + 0.05, 0.05, 0.14, 0.05, 0.1);
    }
    if (stairHere) fireStair(B, F, len - 2.75, [...floors, h - 0.6].filter((y, i, a) => i < a.length - 1 || false), floor, h);
    if (program === 'units' || program === 'balcony' || program === 'paired') {
      floors.forEach((y) => { for (let k = 0; k < nU; k++) if (r.chance(0.09)) ac.place(B, F.m(pad + k * unitW + r.range(0.6, unitW - 0.8), y + 0.35, 0.38), { lod: true }); });
    }
    if (program === 'balcony') {
      for (const y of floors) {
        F.box(B, M.concrete, len / 2, y + 0.1, 0.65, len, 0.18, 1.3, 0.25);
        F.box(B, M.galv, len / 2, y + 1.15, 1.27, len, 0.05, 0.06);
        for (let u = 0.1; u < len; u += 0.13) F.cyl(B, M.galv, 0.01, 0.95, u, y + 0.68, 1.27, 'v', 4);
        for (let k = 0; k <= nU; k++) F.box(B, M.glassFrost, pad + k * unitW, y + 1.2, 0.65, 0.02, 2.0, 1.25);   // fire-break partitions
        for (let k = 0; k < nU; k++) {
          if (r.chance(0.12)) futon(B, F.m(pad + k * unitW + r.range(0.6, unitW - 0.6), y + 1.2, 1.27), r, { width: 0.95 });
          else if (r.chance(0.22)) laundryLine(B, F.p(pad + k * unitW + 0.3, y + 2.35, 0.9), F.p(pad + (k + 1) * unitW - 0.3, y + 2.35, 0.9), r, 0.6);
          else if (r.chance(0.25)) plant(B, F.m(pad + k * unitW + r.range(0.5, unitW - 0.5), y + 0.2, 1.05), r, { size: 0.9 });
        }
      }
    }
    // projecting signs on the lower floors (only on street faces)
    if (root && fi === 0 && program !== 'curtain') for (let i = 0; i < signs; i++) projectingSign(root, F, 0.9 + i * Math.max(3, uEnd / (signs + 0.5)), ground + 1.8 + r.range(0, 3), r);
  });
  // roof plant
  if (h < 60 && program !== 'curtain') {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = (x1 - x0) / 2 - 2, rz = (z1 - z0) / 2 - 2;
    const sx = cx + rx * r.range(-0.6, 0.6), sz = cz + rz * r.range(-0.6, 0.6);
    B.add(boxGeo(3.0, 2.8, 3.4, 0.25), mat, T(sx, h + 1.4, sz));
    B.add(boxGeo(3.3, 0.2, 3.7, 0.25), M.concreteDark, T(sx, h + 2.9, sz));
    if (r.chance(0.8)) waterTank().place(B, T(cx - rx * 0.5 * Math.sign(sx - cx || 1), h, cz - rz * 0.4, 0, r.range(0, 6), 0, 0.85, 0.85, 0.85));
    const ax = cx + rx * r.range(-0.8, 0.8), az = cz + rz * r.range(-0.8, 0.8);
    B.rod(M.galv, 0.04, new THREE.Vector3(ax, h, az), new THREE.Vector3(ax, h + r.range(4, 7), az));
    for (let i = 0; i < 3; i++) B.add(new THREE.BoxGeometry(1.2 - i * 0.25, 0.03, 0.03), M.galv, T(ax, h + 3.2 + i * 0.6, az, 0, r.range(0, 3), 0));
  }
  return frames;
}

function buildNorthBlocks(world, B, root, rng) {
  // ---- NE: HOTEL LUNA (love hotel with a fairy-tale crown) ----
  const luna = tower(world, B, { x0: 7.5, x1: 20, z0: -60, z1: -44.2, h: 30, mat: M.tileCream, faces: ['-x', '+z'], program: 'hotel', kind: 'hotel', lit: 0.4, floor: 3.2, root, signs: 0, stair: false });
  // the love hotel's discreet screened entrance + a mansard crown in dark slate
  B.add(boxGeo(12.6, 2.4, 16.0, 0.25), new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.55, metalness: 0.2 }), T(13.75, 31.4, -52.1));
  for (let z = -59.5; z < -44.6; z += 1.2) B.add(new THREE.BoxGeometry(0.12, 2.0, 0.08), M.metalBlack, T(7.45, 1.2, z));
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
  tower(world, B, { x0: 7.5, x1: 26, z0: -82, z1: -61, h: 62, mat: M.metalDark, faces: ['-x', '+z'], program: 'curtain', kind: 'office', lit: 0.3, floor: 3.6, bands: false, root });
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
  tower(world, B, { x0: 7.5, x1: 22, z0: -104, z1: -83, h: 22, mat: M.paintRed, faces: ['-x'], program: 'paired', kind: 'office', lit: 0.2, ground: 9, root, signs: 0 });
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
  const rec = tower(world, B, { x0: -22, x1: -7.5, z0: -62, z1: -44.2, h: 24, mat: M.brick, faces: ['+x', '+z'], program: 'paired', lit: 0.5, floor: 3.4, root, signs: 2 });
  const vinylSign = neonSign({ text: 'RECORDS', height: 0.9, color: 0x3af2ff, intensity: 6, materials: M, halo: 0.6, raceway: true, tube: 0.07 });
  vinylSign.group.applyMatrix4(rec['+x'].m(9, 4.6, 0.15)); root.add(vinylSign.group);
  world.windows.add(-7.45, 2.2, -53, Math.PI / 2, 12, 3.4, { style: WIN.SHOP, depth: 6, lit: 1, seed: 77, tint: 2 });

  // ---- W: residential tower (balconies) ----
  const res = tower(world, B, { x0: -26, x1: -7.5, z0: -86, z1: -64, h: 66, mat: M.concrete, faces: ['+x', '+z'], program: 'balcony', lit: 0.5, floor: 3.2, root, signs: 1 });
  for (let y = 4.5; y < 64; y += 3.2) B.add(new THREE.BoxGeometry(1.0, 0.12, 22), M.concreteDark, T(-7.1, y, -75));
  // ---- W: tiny Inari shrine between towers ----
  buildShrine(world, B, root);
  tower(world, B, { x0: -24, x1: -7.5, z0: -126, z1: -98, h: 38, mat: M.tileMint, faces: ['+x', '+z'], program: 'units', lit: 0.45, root, signs: 2 });
  tower(world, B, { x0: 7.5, x1: 24, z0: -128, z1: -106, h: 46, mat: M.concreteWarm, faces: ['-x', '+z'], program: 'ribbon', lit: 0.45, root, signs: 1 });
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
    const faces = [z1 > -40 ? '-z' : '+z', x0 > 0 ? '-x' : '+x'];   // street face + the side seen from the block
    tower(world, B, { x0, x1, z0, z1, h, mat: mats[i % mats.length], faces, program: ['units', 'paired', 'balcony', 'ribbon', 'hotel', 'units', 'paired', 'curtain', 'balcony'][i % 9], lit: 0.45, floor: [3.3, 3.1, 3.0, 3.6, 3.2][i % 5], ground: [4.5, 5.2, 4.2, 6.0][i % 4], seed: i, root, signs: 1 + (i % 3 === 0 ? 1 : 0) });
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


/* ------------------------------ South end ------------------------------ */
// The street ends the way Tokyo streets do: under a riveted plate-girder rail
// bridge (gādo), with a T-junction of buildings behind it.
function buildSouthEnd(world, B, root, rng) {
  const zc = 47, y0 = 7.6, X = 70;
  const green = new THREE.MeshStandardMaterial({ color: 0x2c3a36, roughness: 0.55, metalness: 0.55 });
  // deck + two plate girders with stiffeners and bottom flanges
  B.add(boxGeo(X * 2, 0.6, 7.4, 0.25), M.concreteDark, T(0, y0 + 1.8, zc));
  for (const dz of [-3.7, 3.7]) {
    B.add(new THREE.BoxGeometry(X * 2, 2.2, 0.08), green, T(0, y0 + 1.1, zc + dz));
    B.add(new THREE.BoxGeometry(X * 2, 0.06, 0.55), green, T(0, y0, zc + dz));
    B.add(new THREE.BoxGeometry(X * 2, 0.06, 0.45), green, T(0, y0 + 2.2, zc + dz));
    for (let x = -X + 0.8; x < X; x += 1.6) B.add(new THREE.BoxGeometry(0.06, 2.1, 0.22), green, T(x, y0 + 1.1, zc + dz + Math.sign(dz) * 0.13));
  }
  // piers on the far kerbs with cross-heads, and abutment walls
  for (const px of [-9.6, 9.6]) {
    B.add(boxGeo(1.2, y0, 7.0, 0.25), M.concrete, T(px, y0 / 2, zc));
    B.add(boxGeo(1.8, 0.6, 8.0, 0.25), M.concrete, T(px, y0 - 0.3, zc));
  }
  // catenary masts, noise-barrier panels and a parapet on top
  for (let x = -X + 4; x < X; x += 12) {
    B.add(new THREE.BoxGeometry(0.25, 6.0, 0.25), green, T(x, y0 + 5.1, zc - 3.3));
    B.add(new THREE.BoxGeometry(0.15, 0.15, 7.2), green, T(x, y0 + 7.8, zc));
  }
  B.add(new THREE.BoxGeometry(X * 2, 0.02, 0.02), M.metalBlack, T(0, y0 + 7.2, zc - 1.0));
  B.add(new THREE.BoxGeometry(X * 2, 1.4, 0.1), M.galv, T(0, y0 + 2.8, zc - 3.6));
  // under-bridge lighting: tube fittings along the girder soffit
  for (let x = -7.5; x <= 7.5; x += 2.5) B.add(new THREE.BoxGeometry(1.2, 0.06, 0.12), glow(0xfff1d8, 4), T(x, y0 - 0.06, zc + rng.range(-2.5, 2.5)));
  world.lights.push({ pos: new THREE.Vector3(0, y0 - 0.6, zc), color: 0xffe2b8, intensity: 6, distance: 16 });
  // clearance sign + a lit ad panel on the girder face
  const clr = lightBox({ w: 1.5, h: 0.6, d: 0.12, px: 120, intensity: 1.1, bracket: 0, painter: (x, w, h) => {
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c8141e'; x.lineWidth = 10; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = '#111'; x.font = `bold 34px ${JP}`; x.textAlign = 'center'; x.fillText('高さ制限', w / 2, 30); x.font = `900 46px ${LAT}`; x.fillText('3.8 m', w / 2, 66);
  } });
  clr.rotation.y = Math.PI; clr.position.set(0.75, y0 - 0.45, zc - 3.85); root.add(clr);
  const ad = lightBox({ w: 6.0, h: 1.6, d: 0.15, px: 70, intensity: 1.3, bracket: 0, painter: (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#0b1a3a'); g.addColorStop(1, '#3a0b3a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff'; x.font = `900 52px ${LAT}`; x.fillText('JR NEO-KABUKICHŌ', 22, 62);
    x.fillStyle = '#ffd400'; x.font = `bold 34px ${JP}`; x.fillText('新歌舞伎町駅 ← 120 m', 24, 100);
  } });
  ad.rotation.y = Math.PI; ad.position.set(-4.0, y0 + 1.1, zc - 3.86); root.add(ad);
  // three buildings across the end of the street, facing north
  tower(world, B, { x0: -40, x1: -12.5, z0: 55, z1: 74, h: 27, mat: M.tileCream, faces: ['-z'], program: 'balcony', lit: 0.45, floor: 3.0, ground: 4.4, seed: 71, root, signs: 2, stair: false });
  tower(world, B, { x0: -12.5, x1: 10.5, z0: 55, z1: 74, h: 41, mat: M.brick, faces: ['-z'], program: 'paired', lit: 0.5, floor: 3.4, ground: 5.0, seed: 72, root, signs: 2 });
  tower(world, B, { x0: 10.5, x1: 40, z0: 55, z1: 74, h: 21, mat: M.concreteWarm, faces: ['-z'], program: 'units', lit: 0.45, floor: 3.1, ground: 4.6, seed: 73, root, signs: 2 });
}

/* -------------------------------- Skyline ------------------------------ */
// Distant city. Each tower is real massing (podium, setback shaft, plant
// room) and its façade is resolved per storey: office floors with mullioned
// glass lit a tenancy at a time, residential bays with balcony slabs and
// curtains, hotel windows; spandrels, shopfront glow at street level and
// faint up-light from the streets. Windows smaller than a pixel resolve to
// their average instead of shimmering.
function skylineMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aB; varying vec3 vW; varying vec3 vN; varying vec4 vB; varying vec3 vSize; varying vec3 vO;
      void main(){ vB = aB; vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vO = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime; varying vec3 vW; varying vec3 vN; varying vec4 vB; varying vec3 vSize; varying vec3 vO;
      ${GLSL_NOISE}
      float box(vec2 f, vec2 lo, vec2 hi, vec2 fw){
        vec2 a = smoothstep(lo - fw, lo + fw, f) * (1.0 - smoothstep(hi - fw, hi + fw, f));
        return a.x * a.y;
      }
      void main(){
        float bid = vB.x * 97.13;
        float type = floor(vB.z * 3.0);                 // 0 office · 1 residential · 2 hotel/mixed
        bool plain = vB.w > 1.5;
        vec3 mat = type < 0.5 ? vec3(0.016, 0.019, 0.026) : mix(vec3(0.026, 0.024, 0.027), vec3(0.04, 0.034, 0.03), vB.y);
        // street up-light and haze glow on the lower façade
        vec3 c = mat * (0.6 + 0.6 * exp(-vW.y / 35.0)) + vec3(0.05, 0.024, 0.038) * exp(-vW.y / 22.0);
        if (abs(vN.y) > 0.5) { c = mat * 0.6; }
        else if (!plain) {
          vec2 p = abs(vN.x) > 0.5 ? vec2(vW.z, vW.y) : vec2(vW.x, vW.y);
          float fh = type < 0.5 ? 3.9 : type < 1.5 ? 3.0 : 3.3;
          float cw = type < 0.5 ? 1.6 : type < 1.5 ? 3.6 : 2.5;
          vec2 g = vec2(p.x / cw, (p.y - 0.3) / fh);
          vec2 id = floor(g), f = fract(g);
          vec2 fw = max(fwidth(g), vec2(1e-4)) * 0.75;
          float tiny = clamp(max(fw.x, fw.y) * 2.2 - 0.25, 0.0, 1.0);
          bool ground = vW.y < 5.2;
          // window mask + lit state per type
          float win, lit, area; vec3 lc;
          float hf = hash12(vec2(id.y * 1.37, bid));
          if (type < 0.5) {
            win = box(f, vec2(0.05, 0.17), vec2(0.95, 0.93), fw); area = 0.68;
            float seg = floor(p.x / (cw * (5.0 + floor(vB.y * 4.0))));
            float on = step(0.6, hash12(vec2(id.y + seg * 7.1, bid + 3.0)));
            lit = on * (0.55 + 0.35 * hash12(vec2(seg, id.y + bid)));
            lc = mix(vec3(0.78, 0.86, 1.0), vec3(1.0, 0.93, 0.8), step(0.5, hash12(vec2(seg + 2.0, bid))));
          } else if (type < 1.5) {
            win = box(f, vec2(0.18, 0.3), vec2(0.82, 0.88), fw); area = 0.37;
            float hw = hash12(id + bid);
            lit = step(0.7, hw) * (0.25 + 0.75 * hash12(id * 1.7 + bid));
            lc = mix(vec3(1.0, 0.66, 0.38), vec3(1.0, 0.82, 0.62), hash12(id + 5.0));
            if (hw > 0.97) lc = vec3(0.45, 0.6, 1.0) * (0.7 + 0.3 * sin(uTime * 7.0 + hw * 50.0));
            // balcony slab edge catches the up-light
            c += vec3(0.03, 0.025, 0.028) * box(f, vec2(-0.1, 0.0), vec2(1.1, 0.07), fw) * (1.0 - tiny);
          } else {
            win = box(f, vec2(0.3, 0.34), vec2(0.7, 0.8), fw); area = 0.18;
            lit = step(0.55, hash12(id + bid * 1.3)) * (0.4 + 0.6 * hash12(id + 9.0));
            lc = vec3(1.0, 0.75, 0.5);
          }
          // interior falloff (brighter under the ceiling), frame shadow at the reveal
          float wy = clamp((f.y - 0.3) / 0.6, 0.0, 1.0);
          float reveal = smoothstep(0.0, 0.08, min(min(f.x - 0.05, 0.95 - f.x), min(f.y - 0.17, 0.93 - f.y)));
          vec3 glass = type < 0.5 ? vec3(0.012, 0.016, 0.026) + vec3(0.01, 0.014, 0.024) * smoothstep(0.0, 200.0, vW.y) : vec3(0.008, 0.008, 0.011);
          vec3 inside = lc * lit * mix(0.65, 1.05, wy) * mix(0.6, 1.0, reveal);
          vec3 detailed = mix(c, glass + inside, win);
          // floor slabs / spandrel line
          detailed += vec3(0.012, 0.011, 0.012) * box(f, vec2(-0.1, 0.0), vec2(1.1, 0.05), fw);
          // sub-pixel windows: average radiance of the façade instead
          float litAvg = type < 0.5 ? 0.4 * 0.7 : type < 1.5 ? 0.3 * 0.6 : 0.45 * 0.7;
          vec3 avgCol = type < 0.5 ? vec3(0.85, 0.88, 0.95) : vec3(1.0, 0.72, 0.45);
          vec3 averaged = mix(c, glass, area) + avgCol * litAvg * area * (0.5 + hf);
          c = mix(detailed, averaged, tiny);
          if (ground) {             // shopfronts and their signs at street level
            float shop = hash12(vec2(floor(p.x / 7.0), bid));
            vec3 sc = shop > 0.8 ? vec3(1.0, 0.25, 0.5) : shop > 0.6 ? vec3(0.3, 0.8, 1.0) : vec3(1.0, 0.8, 0.55);
            c = mix(c, sc * (0.35 + 0.4 * shop), smoothstep(0.4, 0.8, vW.y) * (1.0 - smoothstep(3.2, 3.6, vW.y)) * step(0.25, shop));
            c += sc * 0.9 * smoothstep(3.6, 3.8, vW.y) * (1.0 - smoothstep(4.5, 4.7, vW.y)) * step(0.45, shop);
          }
        }
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  m.uniforms.uTime = U.time;
  return m;
}

// tower → podium + setback shaft + plant room, sharing a façade programme (aB)
function massing(items, rng, x, z, w, d, h, ab) {
  const out = [];
  if (h > 70 && rng.chance(0.75)) {
    const ph = rng.range(12, 24);
    out.push([x, z, w, d, ph, ab]);
    const s1 = rng.range(0.62, 0.85);
    const h1 = h * rng.range(0.55, 0.8);
    out.push([x + rng.range(-1, 1) * w * 0.08, z + rng.range(-1, 1) * d * 0.08, w * s1, d * s1, h1, ab]);
    if (rng.chance(0.7)) out.push([x, z, w * s1 * rng.range(0.6, 0.85), d * s1 * rng.range(0.6, 0.85), h, ab]);
  } else out.push([x, z, w, d, h, ab]);
  const top = out[out.length - 1];
  out.push([top[0] + rng.range(-0.2, 0.2) * top[2], top[1] + rng.range(-0.2, 0.2) * top[3], top[2] * rng.range(0.25, 0.45), top[3] * rng.range(0.25, 0.45), top[4] + rng.range(3, 7), [ab[0], ab[1], ab[2], 2.0]]);
  items.push(...out);
}
function instanceBoxes(root, items) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, skylineMaterial(), items.length);
  const aB = new Float32Array(items.length * 4);
  const m = new THREE.Matrix4();
  items.forEach(([x, z, w, d, h, ab], i) => {
    m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
    mesh.setMatrixAt(i, m);
    aB.set(ab, i * 4);
  });
  geo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  root.add(mesh);
  return mesh;
}

function buildSkyline(world, root, rng) {
  const items = [];
  const tryAdd = (x, z, w, d, h) => {
    if (Math.abs(x) < 14 && z < -128 && z > -420 && h > 30) h = rng.range(14, 30);   // low blocks in the vista, the spire stays clear
    if (x > -95 && x < 95 && z > -132 && z < 70) return;  // the modelled district
    massing(items, rng, x, z, w, d, h, [rng.next(), rng.next(), rng.next(), rng.next() * 0.9]);
  };
  for (let i = 0; i < 520; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(110, 620);
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 120;
    const tall = rng.chance(0.15);
    tryAdd(x, z, rng.range(14, 40), rng.range(14, 40), tall ? rng.range(140, 320) : rng.range(30, 120));
  }
  // the main street continues as a canyon toward the spire, closed by low blocks and overpasses
  for (let z = -140; z > -560; z -= rng.range(24, 40)) {
    for (const s of [-1, 1]) tryAdd(s * rng.range(22, 32), z, rng.range(16, 22), rng.range(18, 30), rng.range(40, 160));
  }
  const ov = [];
  for (const [z, y] of [[-232, 22], [-318, 31], [-405, 18]]) { ov.push([0, z, 70, 5, y, [0.3, 0.5, 0.9, 2.0]]); }
  instanceBoxes(root, items);
  // overpass decks across the canyon (deck only: thin boxes high up)
  const deckGeo = new THREE.BoxGeometry(1, 1, 1);
  const deck = new THREE.InstancedMesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.9 }), ov.length);
  const dm = new THREE.Matrix4();
  ov.forEach(([x, z, w, d, y], i) => { dm.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(w, 2.2, d)); deck.setMatrixAt(i, dm); });
  root.add(deck);
  const dl = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glow(0xffb070, 3), ov.length * 12);
  let k = 0;
  ov.forEach(([x, z, w, d, y]) => { for (let i = 0; i < 12; i++) { dm.compose(new THREE.Vector3(-w / 2 + (i + 0.5) * w / 12, y - 1.15, z + d / 2 + 0.05), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.15, 0.1)); dl.setMatrixAt(k++, dm); } });
  root.add(dl);
  // aviation lights on the tallest
  const tall = items.filter((it) => it[4] > 130);
  const lg = new THREE.SphereGeometry(0.9, 8, 6);
  const lm = new THREE.InstancedMesh(lg, glow(0xff2020, 10), tall.length);
  const m = new THREE.Matrix4();
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
  mesh.name = 'traffic';
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
    [-40, 40, 43, 74],
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
  for (let z = 41; z < 41; z += rng.range(9, 14)) for (const s of [-1, 1]) {
    const w = rng.range(10, 16), d = rng.range(7, 12);
    items.push([s * (7.5 + w / 2), z + d / 2, w, d, rng.range(10, 30)]);
  }
  const boxes = [];
  for (const [x, z, w, d, h] of items) massing(boxes, rng, x, z, w, d, h, [rng.next(), rng.next() * 0.7, 0.34 + rng.next() * 0.66, rng.next() * 0.5]);
  instanceBoxes(root, boxes);
}
