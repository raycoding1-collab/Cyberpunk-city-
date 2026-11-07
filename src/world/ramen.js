import * as THREE from 'three';
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
  figure(root, { x: 9.42, y: SF + 0.72, z: -3.1, ry: Math.PI / 2, pose: 'seated', coat: 0x1d2433, hair: 0x0a0a0a, seed: 3 });
  figure(root, { x: 9.42, y: SF + 0.72, z: -0.25, ry: Math.PI / 2, pose: 'seated', coat: 0x4a1f2e, hair: 0x2a1a10, seed: 5, hood: true });
  const chef = figure(root, { x: 11.35, y: SF, z: -2.4, ry: -Math.PI / 2, pose: 'chef', coat: 0xe8e4da, hair: 0x101010, seed: 9 });
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
  buildAwning(B, root);

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
  spill.shadow.camera.near = 0.5; spill.shadow.camera.far = 22;
  root.add(spill, spill.target);
  const lanternLight = new THREE.PointLight(0xff3020, 5, 7, 1.8);
  lanternLight.position.set(6.7, 2.6, -2.6);
  root.add(lanternLight);
  updaters.push((t) => { lanternLight.intensity = 5 + Math.sin(t * 7.3) * 0.25 + Math.sin(t * 13.1) * 0.15; });

  B.build(root);
}

function buildAwning(B, root) {
  // red canvas awning, front valance printed with the shop name (texture aspect = valance aspect)
  const valance = (lenM) => {
    const H = 128, W = Math.round((lenM / 0.32) * H);
    const tex = drawCanvas(W, H, (x) => {
      x.fillStyle = '#8f0d16'; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < W; i += 128) x.fillRect(i, 0, 64, H);
      x.fillStyle = '#f5ead6'; x.fillRect(0, 6, W, 4); x.fillRect(0, H - 10, W, 4);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const n = Math.max(1, Math.round(lenM / 3.4));
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * (W / n);
        x.font = `bold 78px ${JPM}`; x.fillText('鯉亭', cx - 250, H / 2 + 4);
        x.font = `900 54px ${LAT}`; x.fillText('KOI-TEI  RAMEN', cx + 110, H / 2 + 4);
      }
    });
    return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.85, side: THREE.DoubleSide });
  };
  const slopeTex = drawCanvas(256, 256, (x) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#7a0b12' : '#9e1420'; x.fillRect(i * 32, 0, 32, 256); }
  });
  slopeTex.wrapS = slopeTex.wrapT = THREE.RepeatWrapping; slopeTex.repeat.set(5, 1);
  const slopeMat = new THREE.MeshStandardMaterial({ map: slopeTex, emissiveMap: slopeTex, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.8, side: THREE.DoubleSide });
  // street side: z -6.2 … 4.0, from wall (x 7.5, y 4.25) out to (x 6.25, y 3.55)
  const len = 10.2, z0 = -6.2;
  const sl = Math.hypot(1.25, 0.7);
  B.add(new THREE.PlaneGeometry(len, sl), slopeMat, basis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1.25, 0.7, 0), new THREE.Vector3(6.875, 3.9, z0 + len / 2)));
  B.add(new THREE.PlaneGeometry(len, 0.32), valance(len), T(6.25, 3.39, z0 + len / 2, 0, -Math.PI / 2, 0));
  // alley side: x 7.5 … 13.1 at z 4 → 5.25
  const len2 = 5.6;
  B.add(new THREE.PlaneGeometry(len2, sl), slopeMat, basis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.7, -1.25), new THREE.Vector3(7.5 + len2 / 2, 3.9, 4.625)));
  B.add(new THREE.PlaneGeometry(len2, 0.32), valance(len2), T(7.5 + len2 / 2, 3.39, 5.25, 0, 0, 0));
  // steel ribs
  for (let z = z0; z <= 4.01; z += 1.7) B.rod(M.metalDark, 0.015, new THREE.Vector3(7.5, 4.25, z), new THREE.Vector3(6.25, 3.55, z));
  B.rod(M.metalDark, 0.02, new THREE.Vector3(6.25, 3.55, z0), new THREE.Vector3(6.25, 3.55, 4.0));
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
