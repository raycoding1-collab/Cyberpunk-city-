import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, T, RNG, U, boxGeo } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';
import { neonSign } from '../core/neon.js';
import { lantern, swayMaterial, Prefab } from '../core/prefabs.js';
import { faceMaterial, JP, JPM, LAT, rr, vtext } from './signs.js';
import { figure } from './figures.js';

/* =================================================================== */
/*  鯉亭 KOI-TEI — the ramen counter at the foot of the tower.         */
/*  Interior: L-counter, eight chrome stools, two late customers, the  */
/*  taishō at the stockpots, menu tags, shelves, a waving maneki-neko. */
/*  Exterior: kōshi lattice, noren, chōchin lanterns, red awning,      */
/*  bent-glass neon, ticket machine. All on X≈8.1 (shop front).        */
/* =================================================================== */

const SF = 0.18; // shop floor level (sidewalk height)

export function buildRamen(world, root) {
  const { updaters } = world;
  const B = new Batch('ramen');
  const rng = new RNG(808);
  const plaster = new THREE.MeshStandardMaterial({ color: 0xcdbb98, roughness: 0.85 });
  const steelBrushed = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.28, metalness: 0.95 });
  const counterTop = new THREE.MeshStandardMaterial({ map: M.woodLight.map, color: 0xffffff, roughness: 0.22, metalness: 0 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.15 });
  const ceramicRed = new THREE.MeshStandardMaterial({ color: 0x9e1c1c, roughness: 0.2 });
  const soy = new THREE.MeshStandardMaterial({ color: 0x1a0c05, roughness: 0.08 });

  /* ------------------------------ shell ------------------------------ */
  B.add(boxGeo(6.9, 0.04, 9.9, 1.4), M.tileDark, T(11.55, SF + 0.02, -1.25));                // floor
  B.add(boxGeo(6.9, 0.12, 9.9, 0.5), M.wood, T(11.55, 3.66, -1.25));                         // ceiling
  for (let z = -6.0; z <= 3.6; z += 0.9) B.add(boxGeo(6.9, 0.14, 0.12, 0.5), M.wood, T(11.55, 3.56, z)); // beams
  B.add(boxGeo(0.12, 1.4, 9.9, 0.5), M.woodLight, T(15.04, SF + 0.7, -1.25));               // back wall wainscot
  B.add(boxGeo(0.12, 2.1, 9.9, 0.5), plaster, T(15.04, SF + 2.45, -1.25));                  // back wall plaster
  B.add(boxGeo(6.9, 3.5, 0.12, 0.5), plaster, T(11.55, SF + 1.75, -6.26));                 // partition to lobby

  /* ---------------------------- counter ------------------------------ */
  B.add(boxGeo(0.6, 0.97, 8.1, 0.5), M.wood, T(10.25, SF + 0.485, -1.65));
  B.add(boxGeo(0.78, 0.06, 8.2, 0.5), counterTop, T(10.2, SF + 1.0, -1.65));
  B.add(boxGeo(0.12, 0.28, 8.1, 0.5), M.woodLight, T(10.55, SF + 1.17, -1.65));             // raised pass
  B.add(boxGeo(0.14, 0.02, 8.1, 0.5), steelBrushed, T(10.55, SF + 1.32, -1.65));
  B.add(boxGeo(0.04, 0.05, 8.1, 0.5), M.brass, T(9.88, SF + 0.18, -1.65));                  // foot rail
  // condiments and bowls along the counter
  for (let i = 0; i < 8; i++) {
    const z = -5.2 + i * 0.95;
    B.add(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 10), soy, T(10.45, SF + 1.38, z + 0.25));
    B.add(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 10), ceramicRed, T(10.45, SF + 1.37, z + 0.33));
    B.add(new THREE.BoxGeometry(0.12, 0.1, 0.08), M.woodLight, T(10.45, SF + 1.37, z + 0.43));      // chopstick box
    B.add(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 10), M.glassClear, T(10.0, SF + 1.08, z - 0.25)); // water cup
  }
  // stools (chrome, oxblood vinyl)
  for (let i = 0; i < 8; i++) {
    const z = -5.0 + i * 0.95;
    B.add(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 20), M.chrome, T(9.42, SF + 0.015, z));
    B.add(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 10), M.chrome, T(9.42, SF + 0.33, z));
    B.add(new THREE.TorusGeometry(0.15, 0.012, 6, 20), M.chrome, T(9.42, SF + 0.28, z, Math.PI / 2, 0, 0));
    B.add(new THREE.CylinderGeometry(0.19, 0.18, 0.09, 20), M.vinylRed, T(9.42, SF + 0.68, z));
    B.add(new THREE.TorusGeometry(0.185, 0.02, 6, 22), M.vinylRed, T(9.42, SF + 0.72, z, Math.PI / 2, 0, 0));
  }

  /* ----------------------------- kitchen ----------------------------- */
  B.add(boxGeo(1.0, 0.85, 9.2, 0.5), steelBrushed, T(14.45, SF + 0.425, -1.5));
  B.add(boxGeo(1.05, 0.05, 9.3, 0.5), M.chrome, T(14.43, SF + 0.87, -1.5));
  // range with three stockpots (tonkotsu, shoyu, dashi)
  const pots = [[14.3, -4.7, 0.3, 0.52], [14.3, -3.6, 0.27, 0.46], [14.3, -2.55, 0.24, 0.4]];
  for (const [x, z, r, h] of pots) {
    B.add(new THREE.CylinderGeometry(r, r * 0.97, h, 28, 1, false), steelBrushed, T(x, SF + 0.9 + h / 2, z));
    B.add(new THREE.TorusGeometry(r, 0.015, 6, 28), M.chrome, T(x, SF + 0.9 + h, z, Math.PI / 2, 0, 0));
    B.add(new THREE.CylinderGeometry(r * 0.96, r * 0.96, 0.01, 28), new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.05, emissive: 0x3a2008 }), T(x, SF + 0.88 + h, z));
    B.add(new THREE.TorusGeometry(r * 0.7, 0.012, 6, 24), glow(0x3a7bff, 6), T(x, SF + 0.905, z, Math.PI / 2, 0, 0)); // gas flame ring
    B.add(new THREE.BoxGeometry(0.05, 0.04, 0.3), M.metalBlack, T(x - r - 0.02, SF + 0.9 + h * 0.8, z));
  }
  world.steamSources = world.steamSources || [];
  pots.forEach(([x, z, r, h]) => world.steamSources.push({ p: new THREE.Vector3(x, SF + 0.95 + h, z), rate: 0.8, size: 0.5, rise: 0.55, color: 0xffe0c0, spread: r * 0.6, life: 3.2, max: 3.6 }));
  // noodle boiler (tebo baskets)
  B.add(boxGeo(0.8, 0.9, 1.2, 0.5), steelBrushed, T(12.7, SF + 0.45, -0.2));
  for (let i = 0; i < 4; i++) {
    const z = -0.6 + (i % 2) * 0.55, x = 12.55 + Math.floor(i / 2) * 0.32;
    B.add(new THREE.CylinderGeometry(0.09, 0.07, 0.2, 14, 1, true), M.galv, T(x, SF + 0.95, z));
    B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), M.wood, T(x - 0.2, SF + 1.15, z, 0, 0, 0.9));
  }
  world.steamSources.push({ p: new THREE.Vector3(12.7, SF + 1.0, -0.2), rate: 1.4, size: 0.45, rise: 0.6, color: 0xfff0e0, spread: 0.4, life: 2.6, max: 3.4 });
  // hood + duct
  B.add(boxGeo(1.1, 0.5, 3.4, 0.5), steelBrushed, T(14.45, 2.9, -3.6));
  B.add(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 18), M.galv, T(14.6, 3.4, -3.6));
  // back shelves: bowls, bottles, sake, a maneki-neko
  for (const y of [1.75, 2.25, 2.75]) B.add(boxGeo(0.32, 0.04, 6.0, 0.5), M.wood, T(14.82, y, 0.2));
  for (let i = 0; i < 26; i++) {
    const y = [1.77, 2.27, 2.77][i % 3], z = -2.6 + rng.range(0, 5.6);
    const stack = rng.int(2, 5);
    if (rng.chance(0.55)) {
      for (let k = 0; k < stack; k++) B.add(new THREE.CylinderGeometry(0.11, 0.06, 0.07, 18, 1, true), rng.chance(0.3) ? ceramicRed : ceramic, T(14.82, y + 0.04 + k * 0.045, z));
    } else {
      const hgt = rng.range(0.2, 0.34);
      const bm = rng.chance(0.5) ? new THREE.MeshStandardMaterial({ color: rng.pick([0x0e3b1a, 0x3b1406, 0xd8d0c0, 0x182640]), roughness: 0.08, metalness: 0.1 }) : soy;
      B.add(new THREE.CylinderGeometry(0.04, 0.045, hgt, 10), bm, T(14.8, y + 0.02 + hgt / 2, z));
      B.add(new THREE.CylinderGeometry(0.015, 0.02, 0.06, 8), bm, T(14.8, y + 0.05 + hgt, z));
    }
  }
  const neko = manekiNeko();
  neko.group.position.set(14.78, 2.79, 2.2); neko.group.rotation.y = -Math.PI / 2;
  root.add(neko.group); updaters.push(neko.update);

  /* -------------------------- menu tags ------------------------------ */
  const items = [['醤油', '¥980'], ['味噌', '¥1050'], ['塩', '¥950'], ['豚骨', '¥1100'], ['担々麺', '¥1200'], ['つけ麺', '¥1150'],
    ['餃子', '¥480'], ['唐揚', '¥520'], ['炒飯', '¥680'], ['麦酒', '¥600'], ['酎ハイ', '¥550'], ['替玉', '¥150']];
  const tagTex = drawCanvas(1536, 384, (x) => {
    x.clearRect(0, 0, 1536, 384);
    items.forEach(([n, p], i) => {
      const X = i * 128 + 8;
      const g = x.createLinearGradient(X, 0, X + 112, 0); g.addColorStop(0, '#d9b98a'); g.addColorStop(0.5, '#efd5a8'); g.addColorStop(1, '#c9a676');
      x.fillStyle = g; x.fillRect(X, 6, 112, 372);
      x.strokeStyle = '#5a3a1a'; x.lineWidth = 3; x.strokeRect(X + 4, 10, 104, 364);
      vtext(x, n, X + 56, 70, n.length > 2 ? 70 : 90, `bold 64px ${JPM}`, '#160c04');
      x.font = `bold 30px ${LAT}`; x.fillStyle = '#9a1010'; x.textAlign = 'center'; x.fillText(p, X + 56, 350);
    });
  });
  tagTex.wrapS = THREE.ClampToEdgeWrapping;
  const tagMat = new THREE.MeshStandardMaterial({ map: tagTex, alphaTest: 0.5, roughness: 0.7, side: THREE.DoubleSide });
  const tags = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), tagMat);
  tags.position.set(10.62, 2.95, -1.65); tags.rotation.y = -Math.PI / 2;
  root.add(tags);
  B.add(new THREE.CylinderGeometry(0.015, 0.015, 5.0, 6), M.brass, T(10.63, 3.57, -1.65, Math.PI / 2, 0, 0));

  /* -------------------------- pendant lamps -------------------------- */
  const shade = new THREE.MeshStandardMaterial({ color: 0x1b120c, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide });
  for (const z of [-4.4, -1.65, 1.1]) {
    B.add(new THREE.CylinderGeometry(0.006, 0.006, 0.95, 4), M.cable, T(9.95, 3.12, z));
    B.add(new THREE.ConeGeometry(0.26, 0.24, 24, 1, true), shade, T(9.95, 2.58, z));
    B.add(new THREE.SphereGeometry(0.075, 12, 10), glow(0xffb36b, 9), T(9.95, 2.5, z));
    B.add(new THREE.CircleGeometry(0.25, 24), glow(0xff9a4a, 1.6, { side: THREE.DoubleSide }), T(9.95, 2.465, z, Math.PI / 2, 0, 0));
  }
  // warm light strip under the pass shelf
  B.add(new THREE.BoxGeometry(0.03, 0.02, 8.0), glow(0xffc27a, 4), T(10.5, SF + 1.31, -1.65));

  /* --------------------------- people -------------------------------- */
  figure(root, { x: 9.42, y: SF + 0.72, z: -3.1, ry: Math.PI / 2, pose: 'seated', coat: 0x1d2433, hair: 0x0a0a0a, seed: 3 , hi: true });
  figure(root, { x: 9.42, y: SF + 0.72, z: -0.25, ry: Math.PI / 2, pose: 'seated', coat: 0x4a1f2e, hair: 0x2a1a10, seed: 5, hood: true , hi: true });
  const chef = figure(root, { x: 11.35, y: SF, z: -2.4, ry: -Math.PI / 2, pose: 'chef', coat: 0xe8e4da, hair: 0x101010, seed: 9 , hi: true });
  updaters.push((t) => { chef.rotation.y = -Math.PI / 2 + Math.sin(t * 0.6) * 0.35; chef.position.z = -2.4 + Math.sin(t * 0.23) * 0.9; });

  /* -------------------------- shop front ----------------------------- */
  // kōshi lattice with glowing frosted glass behind it  (z -6.2 … -3.8)
  const frost = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.6, emissive: 0xffa456, emissiveIntensity: 0.9, transparent: true, opacity: 0.96 });
  B.add(new THREE.BoxGeometry(0.03, 3.3, 2.3), frost, T(8.12, SF + 1.85, -5.0));
  for (let z = -6.12; z <= -3.86; z += 0.07) B.add(new THREE.BoxGeometry(0.06, 3.35, 0.03), M.wood, T(8.0, SF + 1.85, z));
  for (const y of [SF + 0.12, SF + 1.1, SF + 3.45]) B.add(new THREE.BoxGeometry(0.1, 0.07, 2.4), M.wood, T(8.0, y, -5.0));
  // entrance (z -3.8 … -1.4): sliding door frame (open), threshold, noren
  B.add(new THREE.BoxGeometry(0.16, 3.4, 0.12), M.wood, T(8.05, SF + 1.7, -3.78));
  B.add(new THREE.BoxGeometry(0.16, 3.4, 0.12), M.wood, T(8.05, SF + 1.7, -1.42));
  B.add(new THREE.BoxGeometry(0.2, 0.14, 2.5), M.wood, T(8.05, SF + 3.37, -2.6));
  B.add(new THREE.BoxGeometry(0.3, 0.03, 2.4), M.granite, T(8.1, SF + 0.015, -2.6));
  // the slid-open door panel tucked behind the lattice (glass + wood muntins)
  B.add(new THREE.BoxGeometry(0.04, 2.9, 1.15), M.glassClear, T(8.22, SF + 1.5, -4.4));
  for (const zz of [-4.95, -3.85]) B.add(new THREE.BoxGeometry(0.06, 2.95, 0.05), M.wood, T(8.22, SF + 1.5, zz));
  // display window (z -1.4 … 3.4)
  B.add(new THREE.BoxGeometry(0.12, 0.72, 4.8), M.wood, T(8.06, SF + 0.36, 1.0));      // kick panel
  B.add(new THREE.BoxGeometry(0.02, 2.55, 4.7), M.glassClear, T(8.1, SF + 2.0, 1.0));   // glass
  for (const z of [-1.4, 1.0, 3.4]) B.add(new THREE.BoxGeometry(0.12, 3.3, 0.08), M.wood, T(8.06, SF + 1.75, z));
  B.add(new THREE.BoxGeometry(0.14, 0.08, 4.8), M.wood, T(8.06, SF + 0.74, 1.0));
  B.add(new THREE.BoxGeometry(0.14, 0.1, 4.8), M.wood, T(8.06, SF + 3.35, 1.0));
  // window lettering: らーめん (white, hand-painted)
  const letterTex = drawCanvas(1024, 256, (x) => {
    x.clearRect(0, 0, 1024, 256);
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.font = `bold 150px ${JPM}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('らーめん', 512, 120);
    x.font = `600 30px ${LAT}`; x.fillText('TONKOTSU · SHOYU · MISO  —  OPEN TILL 4AM', 512, 225);
  });
  const letters = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: letterTex, transparent: true, depthWrite: false, color: 0xcfcfcf }));
  letters.position.set(8.085, SF + 1.32, 1.0); letters.rotation.y = -Math.PI / 2;
  root.add(letters);

  // ticket machine (shokkenki) just inside the window
  const tmTex = drawCanvas(256, 512, (x) => {
    x.fillStyle = '#0a0a10'; x.fillRect(0, 0, 256, 512);
    x.fillStyle = '#1f6fff'; x.fillRect(16, 16, 224, 60);
    x.fillStyle = '#fff'; x.font = `bold 34px ${JP}`; x.textAlign = 'center'; x.fillText('食券', 128, 60);
    const cols = ['#ff3355', '#ffb000', '#ffe14a', '#3dff9a', '#3dd6ff', '#ffffff'];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) {
      x.fillStyle = cols[(r + c) % cols.length]; rr(x, 20 + c * 56, 96 + r * 44, 48, 36, 6); x.fill();
      x.fillStyle = '#000'; x.font = `bold 13px ${JP}`; x.fillText(items[(r * 4 + c) % items.length][0], 44 + c * 56, 120 + r * 44);
    }
    x.fillStyle = '#222'; x.fillRect(40, 420, 176, 70); x.fillStyle = '#39ff14'; x.font = `22px ${LAT}`; x.fillText('¥ 0000', 128, 462);
  });
  B.add(new THREE.BoxGeometry(0.55, 1.75, 0.6), M.plasticGrey, T(8.5, SF + 0.875, 2.9));
  const tm = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), faceMaterial(tmTex, 1.3));
  tm.position.set(8.22, SF + 1.15, 2.9); tm.rotation.y = -Math.PI / 2; root.add(tm);

  /* ------------------------------ noren ------------------------------ */
  const norenTex = drawCanvas(1024, 512, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#0f1a3d'); g.addColorStop(1, '#1b2c5c');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 1024; i += 4) x.fillRect(i, 0, 1, 512); // weave
    // white koi circling
    x.save(); x.translate(512, 230); x.fillStyle = '#f2efe6';
    for (const s of [1, -1]) {
      x.save(); x.rotate(s > 0 ? 0 : Math.PI); x.beginPath();
      x.moveTo(-170, -40); x.bezierCurveTo(-90, -130, 90, -120, 150, -40); x.lineTo(190, -95); x.lineTo(175, -20); x.lineTo(205, 30);
      x.bezierCurveTo(140, -10, 90, -40, 40, -50); x.bezierCurveTo(-60, -60, -120, -20, -170, -40); x.fill();
      x.restore();
    }
    x.restore();
    x.font = `bold 120px ${JPM}`; x.fillStyle = '#f2efe6'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('鯉', 300, 400); x.fillText('亭', 724, 400);
    // panel splits are slits in the cloth: draw darker seams
    x.fillStyle = '#05080f'; for (let i = 1; i < 4; i++) x.fillRect(i * 256 - 3, 70, 6, 442);
  });
  const norenMat = swayMaterial({ map: norenTex, roughness: 0.95 }, 0.09, 1.1);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.PlaneGeometry(0.56, 1.05, 4, 8);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 4);
    const m = new THREE.Mesh(g, norenMat);
    m.position.set(7.92, SF + 2.75, -3.48 + i * 0.6 + 0.02);
    m.rotation.y = -Math.PI / 2;
    m.castShadow = true;
    root.add(m);
  }
  B.add(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 8), M.wood, T(7.92, SF + 3.29, -2.6, Math.PI / 2, 0, 0));

  /* ------------------------ lanterns + awning ------------------------ */
  updaters.push(lantern(root, 6.95, 2.42, -4.15, { r: 0.33, h: 0.9 }));
  updaters.push(lantern(root, 6.95, 2.42, -1.05, { r: 0.33, h: 0.9, text: '鯉亭' }));
  for (let i = 0; i < 6; i++) updaters.push(lantern(root, 8.3 + i * 0.85, 2.85, 5.05, { r: 0.16, h: 0.42, text: '祭', glowI: 2.0, swing: 0.07 }));
  buildAwning(B, root, world);

  /* ------------------------------- neon ------------------------------ */
  const ramenNeon = neonSign({ text: 'RAMEN', height: 0.46, color: 0xff2650, intensity: 7, materials: M, halo: 0.9, tube: 0.07 });
  ramenNeon.group.position.set(7.27, 4.66, -1.8); ramenNeon.group.rotation.y = -Math.PI / 2;
  root.add(ramenNeon.group);
  const bowl = neonSign({ icon: 'ramen', height: 0.56, color: 0x30f0ff, intensity: 6.5, materials: M, halo: 0.9, raceway: false });
  bowl.group.position.set(7.27, 4.62, 1.4); bowl.group.rotation.y = -Math.PI / 2;
  root.add(bowl.group);
  const open = neonSign({ text: 'OPEN', height: 0.2, color: 0x7dff4a, intensity: 6, materials: M, halo: 0.6, flicker: 0.9, raceway: false, backing: { pad: 0.05 } });
  open.group.position.set(8.06, SF + 2.3, 2.6); open.group.rotation.y = -Math.PI / 2;
  root.add(open.group);

  /* ------------------------------ lights ----------------------------- */
  const warm = new THREE.PointLight(0xff9a50, 16, 13, 1.6);
  warm.position.set(11.6, 3.1, -1.4);
  root.add(warm);
  const spill = new THREE.SpotLight(0xffa55c, 13, 20, 0.82, 0.9, 1.6);
  spill.position.set(13.6, 3.45, -1.5);
  spill.target.position.set(3.0, 0, -1.6);
  spill.castShadow = true;
  spill.shadow.mapSize.set(1024, 1024);
  spill.shadow.bias = -0.0004;
  spill.shadow.normalBias = 0.02;
  spill.shadow.radius = 6;
  spill.shadow.intensity = 0.6;
  spill.shadow.camera.near = 0.5; spill.shadow.camera.far = 22;
  root.add(spill, spill.target);
  const lanternLight = new THREE.PointLight(0xff3020, 5, 7, 1.8);
  lanternLight.position.set(6.7, 2.6, -2.6);
  root.add(lanternLight);
  updaters.push((t) => { lanternLight.intensity = 5 + Math.sin(t * 7.3) * 0.25 + Math.sin(t * 13.1) * 0.15; });

  ramenDetails(world, B, root);
  B.build(root);
}

function buildAwning(B, root, world) {
  // ---- materials: striped canvas (stripes run wall → front), scalloped printed valance ----
  const slopeTex = drawCanvas(256, 256, (x) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#7a0b12' : '#a3151f'; x.fillRect(i * 32, 0, 32, 256); }
    for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }   // weave
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(20,0,0,0.0)'); g.addColorStop(1, 'rgba(20,0,0,0.25)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  });
  slopeTex.wrapS = slopeTex.wrapT = THREE.RepeatWrapping;
  const canvasMat = new THREE.MeshStandardMaterial({ map: slopeTex, emissiveMap: slopeTex, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.78, side: THREE.DoubleSide });
  const valance = (lenM) => {
    const H = 128, W = Math.round((lenM / 0.34) * H);
    const tex = drawCanvas(W, H, (x) => {
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#8f0d16'; x.fillRect(0, 0, W, H - 18);
      const sc = 64;
      for (let i = 0; i < W; i += sc) { x.beginPath(); x.arc(i + sc / 2, H - 18, sc / 2, 0, Math.PI); x.fill(); }
      x.fillStyle = '#4a0408'; x.fillRect(0, 0, W, 5);
      x.strokeStyle = '#f0e2c8'; x.lineWidth = 3; x.beginPath();
      for (let i = 0; i < W; i += sc) x.arc(i + sc / 2, H - 18, sc / 2 - 4, 0, Math.PI);
      x.stroke();
      x.fillStyle = '#f5ead6'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const n = Math.max(1, Math.round(lenM / 3.4));
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * (W / n);
        x.font = `bold 66px ${JPM}`; x.fillText('鯉亭', cx - 230, 52);
        x.font = `900 46px ${LAT}`; x.fillText('KOI-TEI  RAMEN', cx + 100, 54);
      }
    });
    return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.85, alphaTest: 0.5, side: THREE.DoubleSide });
  };
  const span = ({ o, dir, out, len, depth = 1.25, drop = 0.7, bay = 1.7 }) => {
    const up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3().copy(up).multiplyScalar(depth).addScaledVector(out, drop).normalize();
    const nl = Math.round(len * 14), ns = 12;
    const pos = [], uv = [], idx = [];
    const P = (l, s2) => {
      const sag = 0.045 * Math.sin(Math.PI * ((l / bay) % 1)) * Math.pow(Math.sin(Math.PI * s2), 0.7)
        + 0.006 * Math.sin(l * 23 + s2 * 7) * Math.sin(Math.PI * s2);
      return o.clone().addScaledVector(dir, l).addScaledVector(out, depth * s2).addScaledVector(up, -drop * s2).addScaledVector(n, -sag);
    };
    for (let i = 0; i <= nl; i++) for (let j = 0; j <= ns; j++) {
      const l = (i / nl) * len, s2 = j / ns, p = P(l, s2);
      pos.push(p.x, p.y, p.z); uv.push(l, s2);
    }
    for (let i = 0; i < nl; i++) for (let j = 0; j < ns; j++) { const a2 = i * (ns + 1) + j, b2 = a2 + ns + 1; idx.push(a2, b2, a2 + 1, b2, b2 + 1, a2 + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    B.add(g, canvasMat);
    // valance hanging from the front edge, gently waving
    const vl = new THREE.PlaneGeometry(len, 0.34, Math.round(len * 8), 2);
    const vp = vl.attributes.position;
    for (let k = 0; k < vp.count; k++) {
      const l = vp.getX(k) + len / 2, yy = vp.getY(k);
      const f = P(l, 1);
      const p = f.clone().addScaledVector(up, yy - 0.17).addScaledVector(out, 0.012 * Math.sin(l * 5.3) * (0.17 - yy) * 3);
      vp.setXYZ(k, p.x, p.y, p.z);
    }
    vl.computeVertexNormals();
    B.add(vl, valance(len));
    // frame: wall rail, front bar, rafters under the canvas, diagonal struts
    const front0 = P(0, 1), front1 = P(len, 1);
    B.rod(M.metalDark, 0.022, front0.clone().addScaledVector(n, -0.03), front1.clone().addScaledVector(n, -0.03), 8);
    B.add(new THREE.BoxGeometry(1, 1, 1), M.metalDark, new THREE.Matrix4().compose(o.clone().addScaledVector(dir, len / 2).addScaledVector(up, 0.03).addScaledVector(out, 0.03), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir), new THREE.Vector3(len, 0.08, 0.06)));
    for (let l = 0; l <= len + 1e-3; l += bay) {
      const a2 = o.clone().addScaledVector(dir, l).addScaledVector(n, -0.03), b2 = P(l, 1).addScaledVector(n, -0.03);
      B.rod(M.metalDark, 0.014, a2, b2, 6);
      if (Math.round(l / bay) % 2 === 0) B.rod(M.metalDark, 0.012, o.clone().addScaledVector(dir, l).addScaledVector(up, -0.6), b2.clone().addScaledVector(out, -0.35).addScaledVector(up, 0.12), 6);
    }
    // fabric end caps
    for (const l of [0, len]) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(depth, -drop); sh.lineTo(depth, -drop - 0.3); sh.lineTo(depth - 0.08, -drop - 0.3); sh.lineTo(0, -0.05); sh.lineTo(0, 0);
      const cg = new THREE.ShapeGeometry(sh);
      const m = new THREE.Matrix4().makeBasis(out, up, new THREE.Vector3().crossVectors(out, up)).setPosition(o.clone().addScaledVector(dir, l));
      B.add(cg, canvasMat, m);
    }
    // where rain runs off the scallops
    world.drips = world.drips || [];
    for (let l = 0.2; l < len; l += 0.42) world.drips.push(P(l, 1).addScaledVector(up, -0.32));
  };
  span({ o: new THREE.Vector3(7.5, 4.25, -6.2), dir: new THREE.Vector3(0, 0, 1), out: new THREE.Vector3(-1, 0, 0), len: 10.2 });
  span({ o: new THREE.Vector3(7.5, 4.25, 4.0), dir: new THREE.Vector3(1, 0, 0), out: new THREE.Vector3(0, 0, 1), len: 5.6 });
}

function basis(X, Y, pos) {
  X = X.clone().normalize(); Y = Y.clone().normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(pos);
}

/* -------------------------- Maneki-neko ------------------------------ */
function manekiNeko() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.25 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8141e, roughness: 0.3 });
  const gold = M.brass;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), white); body.scale.set(1, 1.1, 0.85); body.position.y = 0.1; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), white); head.position.y = 0.25; head.scale.set(1.1, 0.95, 0.9); g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 4), white); ear.position.set(s * 0.05, 0.33, 0); ear.rotation.z = -s * 0.3; g.add(ear);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16), red); collar.position.y = 0.18; collar.rotation.x = Math.PI / 2; g.add(collar);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), gold); bell.position.set(0, 0.165, 0.07); g.add(bell);
  const koban = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 16), gold); koban.scale.set(0.7, 1, 1); koban.rotation.x = Math.PI / 2; koban.position.set(0.04, 0.1, 0.085); g.add(koban);
  const armPivot = new THREE.Group(); armPivot.position.set(-0.08, 0.2, 0.02); g.add(armPivot);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.07, 4, 8), white); arm.position.y = 0.05; armPivot.add(arm);
  return { group: g, update: (t) => { armPivot.rotation.z = -0.3 + Math.sin(t * 3.2) * 0.35; } };
}

/* --------------------- what makes it a working shop --------------------- */
function ramenDetails(world, B, root) {
  const SFL = 0.18;
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.12 });
  const bowlOut = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.18 });
  const broth = new THREE.MeshStandardMaterial({ color: 0xc9933e, roughness: 0.04, emissive: 0x2a1404 });
  const noodle = new THREE.MeshStandardMaterial({ color: 0xf0d58a, roughness: 0.35 });
  const chashu = new THREE.MeshStandardMaterial({ color: 0x9a5a3a, roughness: 0.5 });
  const egg = new THREE.MeshStandardMaterial({ color: 0xe8b450, roughness: 0.3 });
  const nori = new THREE.MeshStandardMaterial({ color: 0x0c140c, roughness: 0.6, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.25, metalness: 0.95 });
  // bowls of ramen in front of the two customers
  const bowlProf = [[0, 0], [0.045, 0], [0.05, 0.012], [0.11, 0.07], [0.125, 0.085], [0.12, 0.09], [0.105, 0.078], [0.045, 0.018]].map(([r, y]) => new THREE.Vector2(r, y));
  for (const z of [-3.1, -0.25]) {
    const x = 9.95, y = SFL + 1.03;
    B.add(new THREE.LatheGeometry(bowlProf, 28), bowlOut, T(x, y, z));
    B.add(new THREE.CircleGeometry(0.105, 24), broth, T(x, y + 0.07, z, -Math.PI / 2, 0, 0));
    for (let k = 0; k < 9; k++) B.add(new THREE.TorusGeometry(0.03 + k * 0.006, 0.004, 4, 12, Math.PI), noodle, T(x + Math.sin(k) * 0.02, y + 0.072, z + Math.cos(k * 1.7) * 0.02, -Math.PI / 2, 0, k));
    B.add(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), chashu, T(x + 0.03, y + 0.075, z + 0.03, 0.15, 0, 0.1));
    B.add(new THREE.SphereGeometry(0.022, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), egg, T(x - 0.04, y + 0.07, z + 0.03, 0.3, 0, 0, 1, 0.7, 1));
    B.add(new THREE.PlaneGeometry(0.06, 0.08), nori, T(x - 0.06, y + 0.11, z - 0.04, 0, 0.6, 0.15));
    for (const dz of [-0.01, 0.01]) B.add(new THREE.BoxGeometry(0.22, 0.005, 0.005), M.woodLight, T(x - 0.02, y + 0.095, z + 0.1 + dz, 0, 0.3, 0.05));
    world.steamSources.push({ p: new THREE.Vector3(x, y + 0.1, z), rate: 0.6, size: 0.18, rise: 0.25, color: 0xfff2e0, spread: 0.06, life: 2.2, max: 1.6 });
  }
  // pitchers, napkin boxes along the counter
  for (const z of [-4.6, -1.7, 1.2]) {
    B.add(new THREE.CylinderGeometry(0.055, 0.065, 0.2, 18), steel, T(10.45, SFL + 1.13, z));
    B.add(new THREE.TorusGeometry(0.04, 0.008, 6, 10, Math.PI), steel, T(10.45, SFL + 1.15, z + 0.07, 0, Math.PI / 2, Math.PI / 2));
    B.add(new THREE.BoxGeometry(0.12, 0.07, 0.1), M.plasticWhite, T(10.42, SFL + 1.06, z + 0.4));
    B.add(new THREE.BoxGeometry(0.04, 0.02, 0.06), ceramic, T(10.42, SFL + 1.105, z + 0.4));
  }
  // wall TV with the night game, a clock and a paper calendar on the partition
  const tv = drawCanvas(320, 180, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 180); g.addColorStop(0, '#0a1a30'); g.addColorStop(0.45, '#1a5a2a'); g.addColorStop(1, '#2a7a3a');
    x.fillStyle = g; x.fillRect(0, 0, 320, 180);
    x.fillStyle = '#b08a5a'; x.beginPath(); x.moveTo(160, 120); x.lineTo(220, 160); x.lineTo(160, 178); x.lineTo(100, 160); x.fill();
    x.fillStyle = '#fff'; for (const [px, py] of [[160, 140], [120, 100], [205, 98], [158, 70]]) { x.fillRect(px, py, 3, 9); }
    x.fillStyle = 'rgba(0,0,0,0.75)'; x.fillRect(8, 8, 120, 34);
    x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.fillText('鯉 3 - 2 鷹', 16, 31); x.fillStyle = '#ffd400'; x.fillText('9回裏', 96, 31);
  });
  B.add(new RoundedBoxGeometry(0.06, 0.38, 0.66, 2, 0.015), M.plasticBlack, T(14.84, 3.05, 3.1));
  B.add(new THREE.PlaneGeometry(0.62, 0.35), faceMaterial(tv, 1.4), T(14.805, 3.05, 3.1, 0, -Math.PI / 2, 0));
  B.add(new THREE.BoxGeometry(0.2, 0.04, 0.04), M.metalDark, T(14.93, 3.05, 3.1));
  B.add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 28), M.plasticWhite, T(11.6, 3.05, -6.18, Math.PI / 2, 0, 0));
  B.add(new THREE.CircleGeometry(0.145, 28), new THREE.MeshStandardMaterial({ map: drawCanvas(128, 128, (x) => { x.fillStyle = '#f6f4ee'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#111'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.fillRect(64 + Math.cos(a) * 52 - 2, 64 + Math.sin(a) * 52 - 2, 4, 4); } x.strokeStyle = '#111'; x.lineWidth = 5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + 20, 64 - 26); x.stroke(); x.lineWidth = 3; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 - 42, 64 + 8); x.stroke(); x.strokeStyle = '#c00'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + 10, 64 + 48); x.stroke(); }), roughness: 0.3 }), T(11.6, 3.05, -6.155));
  const cal = drawCanvas(160, 240, (x) => { x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, 160, 240); x.fillStyle = '#c00'; x.font = 'bold 44px sans-serif'; x.fillText('11', 12, 50); x.fillStyle = '#333'; x.font = '14px sans-serif'; x.fillText('NOVEMBER 2087', 64, 40); for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { x.fillStyle = c === 0 ? '#c00' : '#333'; x.fillText(String(r * 7 + c + 1), 10 + c * 21, 90 + r * 28); } x.fillStyle = 'rgba(220,40,40,0.8)'; x.beginPath(); x.arc(126, 142, 12, 0, 7); x.lineWidth = 2; x.strokeStyle = '#d00'; x.stroke(); });
  B.add(new THREE.PlaneGeometry(0.32, 0.48), new THREE.MeshStandardMaterial({ map: cal, roughness: 0.9 }), T(13.0, 2.6, -6.19));
  // fire extinguisher, exposed duct + extract fan on the ceiling
  B.add(new THREE.CylinderGeometry(0.075, 0.075, 0.45, 16), M.plasticRed, T(8.45, SFL + 0.3, -5.85));
  B.add(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 10), M.metalBlack, T(8.45, SFL + 0.56, -5.85));
  B.add(new THREE.TorusGeometry(0.06, 0.008, 5, 12, Math.PI), M.metalBlack, T(8.5, SFL + 0.48, -5.85, 0, 0, -Math.PI / 2));
  B.add(new THREE.CylinderGeometry(0.16, 0.16, 9.0, 16, 1, true), M.galv, T(13.6, 3.42, -1.4, Math.PI / 2, 0, 0));
  for (let z = -5.5; z < 3.2; z += 1.4) B.add(new THREE.TorusGeometry(0.162, 0.01, 4, 16), M.galv, T(13.6, 3.42, z));
  B.add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), M.metalDark, T(13.6, 3.3, 0.8));
  // kitchen kit: rice cooker, hanging ladles, cutting board with a knife
  B.add(new THREE.CylinderGeometry(0.17, 0.15, 0.26, 20), M.plasticWhite, T(14.5, SFL + 1.02, 2.5));
  B.add(new THREE.SphereGeometry(0.17, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.plasticWhite, T(14.5, SFL + 1.15, 2.5, 0, 0, 0, 1, 0.35, 1));
  B.add(new THREE.BoxGeometry(0.03, 0.012, 0.03), glow(0xff5030, 3), T(14.34, SFL + 1.05, 2.5));
  B.add(new THREE.BoxGeometry(0.02, 0.02, 1.6), M.steel, T(14.95, 2.42, -2.8));
  for (let i = 0; i < 6; i++) {
    const z = -3.5 + i * 0.28;
    B.add(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 5), M.steel, T(14.92, 2.26, z));
    B.add(new THREE.SphereGeometry(0.04, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.steel, T(14.92, 2.1, z));
  }
  B.add(new THREE.BoxGeometry(0.42, 0.03, 0.3), M.woodLight, T(14.3, SFL + 0.9, 0.9));
  B.add(new THREE.BoxGeometry(0.22, 0.004, 0.035), M.chrome, T(14.28, SFL + 0.92, 0.85, 0, 0.3, 0));
  // ---- storefront dressing ----
  const eig = drawCanvas(96, 220, (x) => { x.fillStyle = '#c9a77a'; x.fillRect(0, 0, 96, 220); x.strokeStyle = '#5a3a1a'; x.lineWidth = 4; x.strokeRect(5, 5, 86, 210); x.fillStyle = '#1a0c04'; x.font = 'bold 50px "IPAMincho", serif'; x.textAlign = 'center'; ['営', '業', '中'].forEach((c, i) => x.fillText(c, 48, 62 + i * 62)); });
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.16), [M.wood, M.wood, M.wood, M.wood, new THREE.MeshStandardMaterial({ map: eig, roughness: 0.7 }), new THREE.MeshStandardMaterial({ map: eig, roughness: 0.7 })]);
  plaque.position.set(7.88, 2.12, -1.2); plaque.rotation.y = Math.PI / 2; root.add(plaque);
  B.rod(M.cable, 0.003, new THREE.Vector3(7.88, 2.3, -1.25), new THREE.Vector3(7.95, 2.62, -1.2));
  B.rod(M.cable, 0.003, new THREE.Vector3(7.88, 2.3, -1.15), new THREE.Vector3(7.95, 2.62, -1.2));
  for (const z of [-3.95, -1.25]) {
    B.add(new THREE.CylinderGeometry(0.06, 0.05, 0.012, 16), ceramic, T(7.72, SFL + 0.006, z));
    B.add(new THREE.ConeGeometry(0.035, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0xfbfbf6, roughness: 0.95 }), T(7.72, SFL + 0.047, z));
  }
  B.add(new THREE.BoxGeometry(0.03, 0.22, 0.03), M.brass, T(8.19, SFL + 1.4, -3.88));
  const stick = drawCanvas(512, 256, (x) => {
    x.clearRect(0, 0, 512, 256);
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.fillRect(10, 20, 200, 110);
    x.fillStyle = '#111'; x.font = 'bold 24px sans-serif'; x.fillText('営業時間', 30, 56); x.font = '22px sans-serif'; x.fillText('18:00 – 4:00', 30, 90); x.fillText('定休日 水曜', 30, 118);
    x.fillStyle = '#c8141e'; x.fillRect(240, 30, 120, 120); x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText('現金', 270, 80); x.fillText('のみ', 270, 112);
    x.fillStyle = '#fff'; x.fillRect(390, 30, 100, 100); x.fillStyle = '#111'; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3 + i * j) % 3 === 0) x.fillRect(400 + i * 9, 40 + j * 9, 8, 8);
    x.fillStyle = '#111'; x.font = 'bold 15px sans-serif'; x.fillText('QR決済OK', 404, 148);
  });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: stick, transparent: true, depthWrite: false, color: 0xbfbfbf }));
  sm.position.set(8.08, SFL + 1.05, 2.75); sm.rotation.y = -Math.PI / 2; root.add(sm);
}
