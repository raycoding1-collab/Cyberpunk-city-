import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, T, RNG, U, boxGeo, GLSL_NOISE } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas, perforated, graffiti } from '../core/textures.js';
import { Frame, wallWithOpenings, wallWithWindows } from '../core/facade.js';
import { WIN } from '../core/windows.js';
import { neonSign } from '../core/neon.js';
import { acUnit, plant, laundryLine, dish, waterTank, crateStack, trashBag, bicycle, lantern, swayMaterial, futon } from '../core/prefabs.js';
import { lightBox, faceMaterial, chaser, rectPerimeter, JP, JPM, LAT, vtext, rr } from './signs.js';
import { parkedCar } from './vehicles.js';
import { figure } from './figures.js';
import { productTexture } from './megablock.js';

/* =================================================================== */
/*  The neighbours — each with its own concept:                         */
/*   • AUTO-PARK 88: steel-frame robotic car stack, glass lift shaft    */
/*   • NET CAFE ZERO-ONE: vending alcove, LED ticker, rooftop idol ad   */
/*   • JUNK 修理: half-open shutter, green fluorescent electronics den   */
/*   • ROBATA 炉端: red-lantern izakaya under a 4-storey mansion         */
/*   • GAME ZONE ∞: crane-game arcade with pixel light bars            */
/* =================================================================== */

export function buildNeighbors(world) {
  const root = new THREE.Group(); root.name = 'neighbors';
  world.scene.add(root);
  const B = new Batch('neighbors');
  const rng = new RNG(5150);
  buildParking(world, B, root, rng);
  buildNetCafe(world, B, root, rng);
  buildJunk(world, B, root, rng);
  buildRobata(world, B, root, rng);
  buildArcade(world, B, root, rng);
  buildRearBlock(world, B, root, rng);
  B.build(root);
  return root;
}

/* ============================ AUTO-PARK 88 ============================ */
function buildParking(world, B, root, rng) {
  const x0 = 7.5, x1 = 22, z0 = -32, z1 = -14.0, H = 27.2;
  const F = new Frame('-x', x0, 0, z0);        // u = z + 32
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.45, metalness: 0.85 });
  const perfA = perforated({ holes: 24, r: 0.3 });
  perfA.repeat.set(3, 2);
  const perfMat = new THREE.MeshStandardMaterial({ color: 0x5d646c, metalness: 0.85, roughness: 0.35, alphaMap: perfA, alphaTest: 0.5, side: THREE.DoubleSide });
  const backGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x1aa8ff).multiplyScalar(1.3) });
  const levels = [];
  for (let y = 4.2; y < H - 0.1; y += 2.3) levels.push(y);
  const cols = [0, 4.5, 9, 13.5, 18];
  // H-beam columns
  for (const u of cols) {
    F.box(B, steel, u, H / 2, -0.15, 0.36, H, 0.12);
    F.box(B, steel, u, H / 2, -0.35, 0.08, H, 0.36);
    F.box(B, steel, u, H / 2, -0.55, 0.36, H, 0.12);
  }
  // inner volume + back walls
  B.add(boxGeo(x1 - 11.0, H - 4.2, z1 - z0 - 0.4, 0.25), M.concreteDark, T((11.0 + x1) / 2, 4.2 + (H - 4.2) / 2, (z0 + z1) / 2));
  B.add(boxGeo(0.3, 4.2, z1 - z0, 0.25), M.concreteDark, T(x1 - 0.3, 2.1, (z0 + z1) / 2));
  const palette = [0xb0b6bd, 0x101114, 0xe8e8e8, 0x8a1c1c, 0x1c3a6a, 0x3a3f45, 0xc8a24a, 0x2e5a3a, 0x6a1c5a, 0xd8d8d0];
  const lift = { u: 6.75 };
  levels.forEach((y, li) => {
    F.box(B, steel, 9, y - 0.12, -0.3, 18.4, 0.24, 0.5);           // floor beam
    for (let b = 0; b < 4; b++) {
      const u0 = cols[b] + 0.2, u1 = cols[b + 1] - 0.2, uc = (u0 + u1) / 2;
      if (b === 1) continue; // glass lift shaft bay
      const open = ((li + b) % 3 === 0) || (li % 4 === 1 && b === 3);
      if (open) {
        // open bay: dark slab, fluorescent tube, a parked car on a pallet
        F.box(B, M.galv, uc, y + 0.02, -1.6, u1 - u0, 0.06, 2.6);
        F.box(B, glow(0xdff6ff, 3.5), uc, y + 2.1, -1.2, u1 - u0 - 0.4, 0.03, 0.05);
        if (rng.chance(0.85)) parkedCar(rng.pick(palette), rng.chance(0.3) ? 1 : 0).place(B, F.m(uc, y + 0.05, -1.6).multiply(T(0, 0, 0, 0, Math.PI / 2, 0, 0.95)));
      } else {
        const g = new THREE.PlaneGeometry(u1 - u0, 2.06);
        B.add(g, perfMat, F.m(uc, y + 1.05, -0.05));
        B.add(new THREE.PlaneGeometry(u1 - u0, 2.06), backGlow, F.m(uc, y + 1.05, -0.4));
      }
    }
  });
  // glass lift shaft in the middle bay, with a moving platform + car + amber beacon
  const liftG = new THREE.Group(); root.add(liftG);
  const pal = new THREE.Group(); liftG.add(pal);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 5.0), M.galv); pal.add(plat);
  const carB = new Batch('liftcar');
  parkedCar(0xe6b400, 1).place(carB, T(0, 0.06, 0, 0, Math.PI / 2, 0));
  carB.build(pal);
  const bea = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 10), glow(0xffa000, 10)); bea.position.set(0, 2.2, -2.3); pal.add(bea);
  pal.position.set(x0 + 1.4, 4.2, z0 + lift.u);
  B.add(new THREE.BoxGeometry(0.03, H - 4.2, 3.9), M.glassClear, T(x0 - 0.05, 4.2 + (H - 4.2) / 2, z0 + lift.u));
  B.add(boxGeo(0.2, H - 4.2, 4.1, 0.25), M.concreteDark, T(11.2, 4.2 + (H - 4.2) / 2, z0 + lift.u));
  for (let y = 4.2; y < H; y += 2.3) B.add(new THREE.BoxGeometry(0.06, 0.04, 3.9), glow(0xffb000, 2.5), T(x0 + 0.1, y + 0.02, z0 + lift.u));
  world.updaters.push((t) => {
    const c = (t % 24) / 24;
    const k = c < 0.4 ? THREE.MathUtils.smootherstep(c / 0.4, 0, 1) : c < 0.5 ? 1 : c < 0.9 ? 1 - THREE.MathUtils.smootherstep((c - 0.5) / 0.4, 0, 1) : 0;
    pal.position.y = 4.2 + k * (H - 7.4);
    const on = Math.sin(t * 9) > 0;
    bea.visible = on;
  });
  // ground floor: entry/exit lanes with barrier gates, turntable, ticket machine
  B.add(boxGeo(x1 - x0, 0.04, z1 - z0, 0.5), M.concreteDark, T((x0 + x1) / 2, 0.02, (z0 + z1) / 2));
  B.add(new THREE.CylinderGeometry(2.2, 2.2, 0.06, 48), M.steel, T(x0 + 4.5, 0.05, z0 + 9));
  B.add(new THREE.TorusGeometry(2.2, 0.03, 6, 48), glow(0xffc400, 3), T(x0 + 4.5, 0.09, z0 + 9, Math.PI / 2, 0, 0));
  for (let x = x0 + 1; x < x1 - 1; x += 2.2) B.add(new THREE.BoxGeometry(0.15, 0.03, z1 - z0 - 2), glow(0xe0f4ff, 3), T(x, 4.0, (z0 + z1) / 2));
  const gate = (u, up) => {
    const p = F.p(u, 0, 0.4);
    B.add(new THREE.BoxGeometry(0.3, 1.0, 0.3), M.plasticYellow, T(p.x, 0.5, p.z));
    const arm = new THREE.Group(); arm.position.set(p.x, 0.95, p.z);
    const armM = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 3.2), new THREE.MeshStandardMaterial({ map: drawCanvas(256, 16, (x) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#e00010'; x.fillRect(i * 32, 0, 32, 16); } }), roughness: 0.4 }));
    armM.position.z = up * 1.6; arm.add(armM);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), glow(0xff2020, 6)); tip.position.z = up * 3.1; arm.add(tip);
    root.add(arm);
    return arm;
  };
  const g1 = gate(1.0, 1), g2 = gate(17.0, -1);
  world.updaters.push((t) => { g1.rotation.x = -Math.max(0, Math.sin(t * 0.35)) * 1.3; g2.rotation.x = Math.max(0, Math.sin(t * 0.35 + 2)) * 1.3; });
  const tm = F.p(5.0, 0, 0.5);
  B.add(new RoundedBoxGeometry(0.6, 1.5, 0.5, 2, 0.06), M.plasticGrey, T(tm.x, 0.75, tm.z));
  B.add(new THREE.BoxGeometry(0.02, 0.35, 0.3), glow(0x7affd0, 2), T(tm.x - 0.31, 1.2, tm.z));
  // P blade sign at the corner (toward the hero tower)
  const P = lightBox({
    w: 1.25, h: 6.0, d: 0.3, px: 110, intensity: 1.5, painter: (x, w, h) => {
      x.fillStyle = '#0a49c8'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.font = `900 ${w * 0.9}px ${LAT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('P', w / 2, w * 0.6);
      vtext(x, 'パーキング', w / 2, w * 1.35, 70, `bold 62px ${JP}`, '#ffffff');
      x.fillStyle = '#071a3a'; x.fillRect(12, h - 150, w - 24, 120);
      x.fillStyle = '#22ff66'; x.font = `bold 84px ${JPM}`; x.fillText('空', w / 2, h - 88);
      x.font = `900 30px ${LAT}`; x.fillStyle = '#9fd0ff'; x.fillText('88', w / 2, h - 175);
    },
  });
  P.rotation.y = Math.PI; P.position.set(x0, 9.5, z1 - 0.6); root.add(P);
  // rooftop billboard: YAMATO HOVERWORKS, lit by three floodlights
  const bb = drawCanvas(1600, 640, (x) => {
    const g = x.createLinearGradient(0, 0, 1600, 640); g.addColorStop(0, '#0b0f24'); g.addColorStop(1, '#3a0b3d');
    x.fillStyle = g; x.fillRect(0, 0, 1600, 640);
    // stylised hover car wedge
    x.fillStyle = '#e8e6f2'; x.beginPath(); x.moveTo(380, 420); x.lineTo(1230, 400); x.quadraticCurveTo(1290, 405, 1280, 360); x.lineTo(1010, 300); x.lineTo(520, 285); x.quadraticCurveTo(420, 290, 380, 340); x.closePath(); x.fill();
    x.fillStyle = '#1b2a4a'; x.beginPath(); x.ellipse(780, 300, 210, 52, 0, Math.PI, 0); x.fill();
    x.fillStyle = '#3ad6ff'; for (const cx of [520, 1120]) { x.beginPath(); x.ellipse(cx, 440, 95, 18, 0, 0, 7); x.fill(); }
    x.strokeStyle = '#ff2a6d'; x.lineWidth = 6; x.beginPath(); x.moveTo(420, 380); x.lineTo(1240, 368); x.stroke();
    x.fillStyle = '#ffffff'; x.font = `900 92px ${LAT}`; x.fillText('FLY THE RAIN.', 80, 140);
    x.font = `300 46px ${LAT}`; x.fillStyle = '#9fe6ff'; x.fillText('YAMATO HOVERWORKS  ·  KIRIN-7', 84, 210);
    x.font = `bold 44px ${JP}`; x.fillStyle = '#ff7ab8'; x.fillText('雨を、飛べ。', 1180, 590);
  });
  const bbm = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.8), new THREE.MeshStandardMaterial({ map: bb, emissiveMap: bb, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 }));
  bbm.position.set(x0 + 1.2, H + 4.2, (z0 + z1) / 2); bbm.rotation.y = -Math.PI / 2 + 0.35; root.add(bbm);
  const bc = bbm.position;
  for (let i = -1; i <= 1; i++) {
    const zz = bc.z + i * 4.2;
    B.rod(steel, 0.08, new THREE.Vector3(bc.x + 1.5, H, zz), new THREE.Vector3(bc.x + 1.5 + Math.sin(0.35) * 0.1, H + 6.6, zz));
    B.add(new THREE.BoxGeometry(0.3, 0.2, 0.4), M.metalBlack, T(bc.x - 1.1, H + 1.5, zz + 0.5));
    B.add(new THREE.BoxGeometry(0.02, 0.15, 0.32), glow(0xffffff, 6), T(bc.x - 1.25, H + 1.55, zz + 0.5));
  }
  const fl = new THREE.SpotLight(0xfff1dc, 30, 12, 0.7, 0.6, 1.2); fl.position.set(bc.x - 1.6, H + 1.2, bc.z); fl.target.position.copy(bc); root.add(fl, fl.target);
  // north face (to the cross street): full perforated skin with blue glow
  const NF = new Frame('-z', x1, 0, z0);
  for (const y of levels) {
    B.add(new THREE.PlaneGeometry(x1 - x0 - 0.6, 2.06), perfMat, NF.m((x1 - x0) / 2, y + 1.05, 0.02));
    B.add(new THREE.PlaneGeometry(x1 - x0 - 0.6, 2.06), backGlow, NF.m((x1 - x0) / 2, y + 1.05, -0.3));
    NF.box(B, steel, (x1 - x0) / 2, y - 0.12, -0.1, x1 - x0, 0.24, 0.3);
  }
  world.lights.push({ pos: new THREE.Vector3(5.5, 8, -24), color: 0x2aa8ff, intensity: 6, distance: 14 });
}

/* ========================== NET CAFE ZERO-ONE ========================= */
function vendingFront(seed, theme) {
  return drawCanvas(256, 470, (x) => {
    const r = new RNG(seed);
    const bg = theme === 0 ? '#e9f3ff' : theme === 1 ? '#ffece6' : theme === 2 ? '#f2f2f2' : '#101830';
    x.fillStyle = bg; x.fillRect(0, 0, 256, 470);
    x.fillStyle = theme === 3 ? '#ff2a8a' : ['#1450c8', '#d81e1e', '#2a2a2a'][theme]; x.fillRect(0, 0, 256, 54);
    x.fillStyle = '#fff'; x.font = `900 30px ${LAT}`; x.textAlign = 'center'; x.fillText(['BOSS·COFFEE', 'C.C.KOI', 'O-CHA', 'NOODLE·BOT'][theme], 128, 38);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        const cx = 22 + i * 42, cy = 80 + row * 105;
        x.fillStyle = `hsl(${r.pick([0, 20, 45, 120, 200, 220, 280])},${r.range(60, 90)}%,${r.range(35, 60)}%)`;
        rr(x, cx - 14, cy, 28, 70, 6); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(cx - 9, cy + 14, 5, 40);
        x.fillStyle = r.chance(0.3) ? '#ff2020' : '#1e64ff'; x.fillRect(cx - 14, cy + 76, 28, 10); // HOT/COLD tag
        x.fillStyle = '#ffd400'; x.beginPath(); x.arc(cx, cy + 96, 4, 0, 7); x.fill();
      }
    }
    x.fillStyle = '#20242c'; x.fillRect(16, 400, 224, 56);
    x.fillStyle = '#39ff14'; x.font = `bold 22px ${LAT}`; x.fillText('¥ 160', 70, 436);
    x.fillStyle = '#f0f0f0'; x.fillRect(150, 410, 70, 36);
  });
}

function buildNetCafe(world, B, root, rng) {
  // x -7.5 face, z -2 … 8, height 13.6
  const F = new Frame('+x', -7.5, 0, 8);   // u = 8 - z
  const len = 10, H = 13.6, GF = 4.0;
  B.add(boxGeo(9.0, H, len, 0.25), M.concreteDark, T(-7.5 - 0.6 - 4.5, H / 2, 3));
  // vending alcove (u 0 … 4.2), recessed 1.2
  F.box(B, M.tileWhite, 2.1, 0.02, -0.6, 4.2, 0.04, 1.2, 1);
  F.box(B, M.concreteDark, 2.1, GF - 0.1, -0.6, 4.2, 0.2, 1.2);
  const themes = [0, 1, 3, 2];
  themes.forEach((th, i) => {
    const u = 0.6 + i * 1.02;
    const body = [0x1450c8, 0xd81e1e, 0x2a2a2a, 0xe8e8e8][th];
    const c = F.p(u, 0.2, -0.85);
    const m = F.m(u, 0.2 + 0.92, -0.85);
    B.add(new RoundedBoxGeometry(0.98, 1.84, 0.78, 2, 0.04), new THREE.MeshStandardMaterial({ color: body, roughness: 0.35, metalness: 0.3 }), m);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.58), faceMaterial(vendingFront(30 + i, th), 1.4));
    face.applyMatrix4(F.m(u, 0.2 + 1.0, -0.455));
    root.add(face);
    B.add(new THREE.BoxGeometry(0.7, 0.18, 0.06), M.plasticBlack, F.m(u, 0.38, -0.44));
  });
  world.lights.push({ pos: F.p(2.1, 2.2, 0.6), color: 0xdfeeff, intensity: 5, distance: 7 });
  // net cafe entrance: glass door, stair, A-frame sign
  wallWithOpenings(B, M.tileCream, F, len, GF, 0.3, [{ u: 0, v: 0, w: 4.3, h: 4.0 }, { u: 5.2, v: 0.0, w: 1.6, h: 2.6 }, { u: 7.4, v: 0.9, w: 2.2, h: 1.9 }], 0.5);
  world.windows.add(...F.p(8.5, 1.85, -0.12).toArray(), F.ry, 2.2, 1.9, { style: WIN.SHOP, depth: 3, lit: 1, seed: 801, tint: 2 });
  B.add(new THREE.BoxGeometry(0.02, 2.5, 1.5), new THREE.MeshStandardMaterial({ color: 0x0b0b14, emissive: 0x6a5aff, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }), F.m(6.0, 1.3, -0.2).multiply(T(0, 0, 0, 0, Math.PI / 2, 0)));
  const aframe = drawCanvas(256, 384, (x) => {
    x.fillStyle = '#120a24'; x.fillRect(0, 0, 256, 384);
    x.fillStyle = '#b48cff'; x.font = `900 44px ${LAT}`; x.textAlign = 'center'; x.fillText('NET', 128, 70);
    x.fillStyle = '#fff'; x.font = `bold 36px ${JP}`; x.fillText('漫画 · ダーツ', 128, 130);
    x.fillStyle = '#ffd400'; x.font = `900 52px ${LAT}`; x.fillText('1H ¥400', 128, 210);
    x.fillStyle = '#7af6ff'; x.font = `bold 30px ${LAT}`; x.fillText('SHOWER · 24H', 128, 270);
    x.fillStyle = '#ff2a8a'; x.fillText('▲ 2F', 128, 340);
  });
  const af = F.p(6.0, 0, 1.0);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.85), faceMaterial(aframe, 1.2));
    p.position.set(af.x + s * 0.12, 0.62, af.z); p.rotation.set(0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0); p.rotateX(-0.14);
    root.add(p);
  }
  // upper floors: tiles with blinded windows
  const wins = [];
  for (let f = 0; f < 3; f++) for (const u of [0.6, 3.8, 7.0]) wins.push({ u, v: f * 3.2 + 0.9, w: 2.4, h: 1.5, style: WIN.SLIDER, lit: 0.7 });
  wallWithWindows(B, M.tileCream, F, len, H - GF, 0.3, wins, world.windows, { v0: GF, sillMat: M.concreteDark });
  // LED dot-matrix ticker band between ground and first floor
  const ticker = drawCanvas(2048, 64, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, 2048, 64);
    x.fillStyle = '#ff9a1a'; x.font = `bold 46px ${JP}`; x.textBaseline = 'middle';
    x.fillText('ようこそ ネットカフェ ZERO-ONE ★ 1時間 ¥400 ★ シャワー完備 ★ WELCOME ★ 夜間パック ¥1500 ★ ', 10, 34);
  }, { srgb: true });
  ticker.wrapS = THREE.RepeatWrapping; ticker.repeat.set(0.35, 1);
  const tm = new THREE.ShaderMaterial({
    uniforms: { tTex: { value: ticker }, uTime: U.time },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tTex; uniform float uTime; varying vec2 vUv;
      void main(){ vec2 grid = vec2(240.0, 12.0); vec2 cell = floor(vUv * grid); vec2 f = fract(vUv * grid) - 0.5;
        vec2 suv = (cell + 0.5) / grid; suv.x = fract(suv.x * 0.35 + uTime * 0.04);
        float on = step(0.35, texture2D(tTex, suv).r);
        float dotm = smoothstep(0.5, 0.25, length(f));
        gl_FragColor = vec4(mix(vec3(0.05, 0.015, 0.0), vec3(1.0, 0.55, 0.08) * 4.0, on) * dotm, 1.0); }`,
  });
  const tk = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 0.5), tm); tk.applyMatrix4(F.m(5, GF + 0.3, 0.04)); root.add(tk);
  F.box(B, M.metalBlack, 5, GF + 0.3, -0.02, 9.8, 0.62, 0.1);
  // vertical sign 電脳カフェ
  const vs = lightBox({
    w: 0.95, h: 7.6, d: 0.3, px: 110, intensity: 1.5, painter: (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b0a5c'); g.addColorStop(1, '#0a0730'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#b48cff'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
      vtext(x, '電脳', w / 2, 100, 115, `bold 96px ${JPM}`, '#e8dcff', '#7a2bff', 6);
      vtext(x, 'カフェ', w / 2, 340, 100, `bold 84px ${JP}`, '#ffffff', '#7a2bff', 6);
      x.font = `900 40px ${LAT}`; x.fillStyle = '#7af6ff'; x.textAlign = 'center';
      x.save(); x.translate(w / 2, 690); x.rotate(Math.PI / 2); x.fillText('ZERO-ONE', 0, 14); x.restore();
    },
  });
  vs.position.copy(F.p(9.6, 8.6, 0)); vs.rotation.y = 0; root.add(vs);
  world.lights.push({ pos: F.p(9.0, 8.0, 1.4), color: 0x9a5aff, intensity: 6, distance: 11 });
  // roof billboard: NEON☆KOI idol live
  const ad = drawCanvas(1024, 512, (x) => {
    const g = x.createLinearGradient(0, 0, 1024, 512); g.addColorStop(0, '#ff5fa2'); g.addColorStop(0.5, '#ffb35f'); g.addColorStop(1, '#5fd6ff');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.1 + (i % 5) * 0.06})`; x.beginPath(); x.arc((i * 137) % 1024, (i * 89) % 512, 6 + (i % 7) * 4, 0, 7); x.fill(); }
    // idol silhouette: long twin-tail hair, headset mic, raised arm
    x.fillStyle = '#1a0b2a';
    x.beginPath(); x.ellipse(760, 205, 58, 68, 0, 0, 7); x.fill();
    for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(760 + sx * 40, 170); x.bezierCurveTo(760 + sx * 150, 190, 760 + sx * 120, 380, 760 + sx * 165, 470); x.bezierCurveTo(760 + sx * 95, 420, 760 + sx * 80, 300, 760 + sx * 30, 200); x.fill(); }
    x.beginPath(); x.moveTo(680, 512); x.quadraticCurveTo(705, 300, 760, 288); x.quadraticCurveTo(815, 300, 850, 512); x.fill();
    x.strokeStyle = '#1a0b2a'; x.lineWidth = 18; x.lineCap = 'round'; x.beginPath(); x.moveTo(805, 320); x.lineTo(890, 200); x.stroke();
    x.lineWidth = 5; x.beginPath(); x.moveTo(712, 210); x.quadraticCurveTo(715, 250, 742, 252); x.stroke();
    x.fillStyle = '#fff6'; x.beginPath(); x.arc(890, 190, 14, 0, 7); x.fill();
    x.fillStyle = '#ffffff'; x.font = `900 84px ${LAT}`; x.fillText('NEON☆KOI', 50, 150);
    x.font = `bold 52px ${JP}`; x.fillText('武道館ライブ決定!!', 50, 240);
    x.font = `900 46px ${LAT}`; x.fillStyle = '#1a0b2a'; x.fillText('12.24  LIVE  2087', 50, 330);
  });
  const adm = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshStandardMaterial({ map: ad, emissiveMap: ad, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.5 }));
  adm.applyMatrix4(F.m(5, H + 3.0, -1.5).multiply(T(0, 0, 0, 0, 0.25, 0)));
  root.add(adm);
  for (const du of [1.8, 8.2]) B.rod(M.metalDark, 0.07, F.p(du, H, -2.0), F.p(du, H + 5.0, -1.8));
  for (const du of [2.5, 5, 7.5]) {
    B.add(new THREE.BoxGeometry(0.3, 0.2, 0.3), M.metalBlack, F.m(du, H + 0.6, 0.6));
    B.add(new THREE.BoxGeometry(0.2, 0.02, 0.2), glow(0xffffff, 7), F.m(du, H + 0.72, 0.6));
  }
  // side wall toward the megablock: graffiti + pipes
  const gt = graffiti({ seed: 3, words: ['ZERO', '2087', '鯉'] });
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshStandardMaterial({ map: gt, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  gm.position.set(-12, 2.3, -2.05); gm.rotation.y = Math.PI; root.add(gm);
}

/* ============================== JUNK 修理 ============================== */
function buildJunk(world, B, root, rng) {
  const F = new Frame('+x', -7.5, 0, 17);  // u = 17 - z  (0 … 9)
  const len = 9, H = 10.4, GF = 3.6;
  B.add(boxGeo(8, H - GF, len, 0.25), M.concreteDark, T(-7.5 - 0.6 - 4, GF + (H - GF) / 2, 12.5));
  B.add(boxGeo(8, GF, len, 0.25), M.concreteDark, T(-7.5 - 4.2 - 4, GF / 2, 12.5));
  for (const u of [0.65, 8.35]) F.box(B, M.concreteDark, u, GF / 2, -2.1, 0.1, GF, 4.2);
  F.box(B, M.concreteDark, 4.5, GF - 0.3, -2.1, 7.8, 0.1, 4.2);
  wallWithOpenings(B, M.brick, F, len, GF, 0.3, [{ u: 0.8, v: 0, w: 7.4, h: 3.1 }], 0.5);
  // shop interior: green fluorescent, shelves of junk, CRT stack
  const inner = new THREE.MeshStandardMaterial({ color: 0x2a332c, roughness: 0.7 });
  F.box(B, inner, 4.5, 1.6, -4.0, 7.6, 3.2, 0.1);
  F.box(B, M.tileDark, 4.5, 0.02, -2.0, 7.6, 0.04, 4.0);
  for (let i = 0; i < 3; i++) F.box(B, glow(0x9dffb4, 4), 1.8 + i * 2.4, 3.0, -1.6, 1.4, 0.04, 0.06);
  const junkTex = drawCanvas(512, 256, (x) => {
    const r = new RNG(9);
    x.fillStyle = '#1a1f1a'; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 90; i++) {
      x.fillStyle = r.chance(0.2) ? `hsl(${r.range(80, 200)},70%,55%)` : `hsl(0,0%,${r.range(15, 45)}%)`;
      x.fillRect(r.range(0, 500), r.range(0, 240), r.range(12, 60), r.range(10, 40));
    }
    for (let j = 0; j < 4; j++) { x.fillStyle = '#555'; x.fillRect(0, j * 64 + 60, 512, 4); }
  });
  const jm = new THREE.MeshStandardMaterial({ map: junkTex, emissiveMap: junkTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 });
  B.add(new THREE.PlaneGeometry(7.4, 3.0), jm, F.m(4.5, 1.6, -3.94));
  // CRT stack with static (shader)
  const crtMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; ${GLSL_NOISE}
      void main(){ vec2 p = vUv * vec2(160.0, 120.0); float n = hash12(floor(p) + floor(uTime * 24.0) * 7.3);
        float roll = smoothstep(0.0, 0.08, abs(fract(vUv.y - uTime * 0.3) - 0.5));
        vec2 c = vUv - 0.5; float vig = 1.0 - dot(c, c) * 2.2;
        gl_FragColor = vec4(vec3(0.55, 0.85, 0.75) * (0.4 + n * 0.8) * roll * vig * 1.6, 1.0); }`,
  });
  for (let i = 0; i < 6; i++) {
    const u = 6.2 + (i % 2) * 0.62, v = 0.3 + Math.floor(i / 2) * 0.52;
    B.add(new RoundedBoxGeometry(0.58, 0.5, 0.5, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0xbdb6a2, roughness: 0.5 }), F.m(u, v + 0.25, -1.6));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.34), crtMat); s.applyMatrix4(F.m(u, v + 0.26, -1.34)); root.add(s);
  }
  figure(root, { ...F.p(3.5, 0.0, -2.2), x: F.p(3.5, 0, -2.2).x, y: 0.02, z: F.p(3.5, 0, -2.2).z, ry: Math.PI / 2, pose: 'standing', coat: 0x3a4a2a, hair: 0xb0b0b0, seed: 61 });
  B.add(new THREE.BoxGeometry(2.4, 0.95, 0.7), M.wood, F.m(3.0, 0.5, -2.8));
  // half-open roller shutter
  const shutTex = drawCanvas(256, 256, (x) => { x.fillStyle = '#8b9196'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 256; i += 16) { x.fillStyle = '#5c6268'; x.fillRect(0, i, 256, 3); x.fillStyle = '#b8bec4'; x.fillRect(0, i + 3, 256, 2); } });
  shutTex.wrapS = shutTex.wrapT = THREE.RepeatWrapping; shutTex.repeat.set(3, 2);
  const gt = graffiti({ seed: 8, w: 1024, h: 512, words: ['JUNK', 'ゴミ', 'R.I.P'] });
  const sm = new THREE.MeshStandardMaterial({ map: shutTex, roughness: 0.4, metalness: 0.7 });
  B.add(new THREE.PlaneGeometry(7.4, 1.7), sm, F.m(4.5, 3.1 - 0.85, 0.02));
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.6), new THREE.MeshStandardMaterial({ map: gt, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
  gp.applyMatrix4(F.m(4.5, 2.25, 0.03)); root.add(gp);
  F.box(B, M.galv, 4.5, 3.25, 0.15, 7.8, 0.35, 0.35);
  world.lights.push({ pos: F.p(4.5, 1.6, 0.8), color: 0x7dffa8, intensity: 5, distance: 8 });
  // sidewalk junk: crates of cables, monitors
  crateStack(B, F.m(1.2, 0.18, 0.7), rng, 2);
  for (let i = 0; i < 3; i++) B.add(new RoundedBoxGeometry(0.5, 0.42, 0.45, 2, 0.04), new THREE.MeshStandardMaterial({ color: 0xa9a28f, roughness: 0.6 }), F.m(8.2, 0.4 + i * 0.42, 0.6).multiply(T(0, 0, 0, 0, rng.range(-0.2, 0.2), 0)));
  // upper floors: aluminium balconies
  const wins = [];
  for (let f = 0; f < 2; f++) wins.push({ u: 0.8, v: f * 3.4 + 0.25, w: 3.4, h: 2.1, style: WIN.SLIDER, lit: 0.7 }, { u: 4.8, v: f * 3.4 + 0.25, w: 3.4, h: 2.1, style: WIN.SLIDER, lit: 0.6 });
  wallWithWindows(B, M.tileWhite, F, len, H - GF, 0.3, wins, world.windows, { v0: GF });
  const ac = acUnit();
  for (let f = 0; f < 2; f++) {
    const y = GF + f * 3.4;
    F.box(B, M.concreteDark, 4.5, y + 0.06, 0.6, len, 0.12, 1.2);
    for (let u = 0.05; u <= len; u += 0.12) F.cyl(B, M.galv, 0.012, 1.0, u, y + 0.62, 1.15, 'v', 4);
    F.cyl(B, M.galv, 0.025, len, 4.5, y + 1.12, 1.15, 'u', 6);
    F.box(B, M.glassFrost, 4.5, y + 1.6, 0.6, 0.03, 3.0, 1.2);
    ac.place(B, F.m(2.0 + f * 4.0, y + 0.12, 0.5), { floor: true });
    laundryLine(B, F.p(0.4, y + 2.4, 0.9), F.p(len - 0.4, y + 2.4, 0.9), rng, 0.6);
    plant(B, F.m(7.6, y + 0.12, 0.8), rng, { size: 1.2 });
  }
  const js = lightBox({
    w: 0.7, h: 2.6, d: 0.24, px: 140, intensity: 1.4, painter: (x, w, h) => {
      x.fillStyle = '#ffd400'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#111'; x.fillRect(0, 0, w, 110);
      x.fillStyle = '#ffd400'; x.font = `900 46px ${LAT}`; x.textAlign = 'center'; x.fillText('JUNK', w / 2, 72);
      vtext(x, 'ジャンク', w / 2, 175, 66, `bold 58px ${JP}`, '#111');
      x.fillStyle = '#d00010'; x.font = `bold 62px ${JPM}`; x.fillText('買取', w / 2, h - 40);
    },
  });
  js.position.copy(F.p(0.3, 5.6, 0)); root.add(js);
  waterTank().place(B, T(-12, H, 13, 0, 0, 0, 0.6));
}

/* ============================== ROBATA 炉端 ============================ */
function buildRobata(world, B, root, rng) {
  const F = new Frame('+x', -7.5, 0, 40);  // u = 40 - z  (0 … 23)
  const len = 23, H = 17.6, GF = 4.0;
  B.add(boxGeo(10, H, len, 0.25), M.concreteDark, T(-7.5 - 0.6 - 5, H / 2, 28.5));
  // izakaya front u 12 … 21 (z 28 … 19): dark timber, shoji glow, red lanterns
  wallWithOpenings(B, M.wood, F, len, GF, 0.3, [{ u: 12.4, v: 0, w: 8.4, h: 2.9 }, { u: 2.0, v: 0, w: 2.2, h: 2.6 }, { u: 5.2, v: 0.9, w: 5.0, h: 1.8 }], 0.5);
  world.windows.add(...F.p(7.7, 1.8, -0.12).toArray(), F.ry, 5.0, 1.8, { style: WIN.GRID, depth: 3, lit: 1, seed: 901, tint: 0 });
  world.windows.add(...F.p(3.1, 1.3, -0.12).toArray(), F.ry, 2.2, 2.6, { style: WIN.SHOP, depth: 4, lit: 0.0, seed: 902 });
  const shoji = new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: 0xffb469, emissiveIntensity: 1.05, roughness: 0.8 });
  F.box(B, shoji, 16.6, 1.45, -0.25, 8.3, 2.8, 0.04);
  for (let u = 12.5; u <= 20.8; u += 0.34) F.box(B, M.wood, u, 1.45, -0.2, 0.035, 2.8, 0.04);
  for (let v = 0.2; v <= 2.85; v += 0.42) F.box(B, M.wood, 16.6, v, -0.2, 8.3, 0.035, 0.04);
  for (const u of [12.4, 14.5, 16.6, 18.7, 20.8]) F.box(B, M.wood, u, 1.45, -0.15, 0.09, 2.9, 0.09);
  // red noren over the door section
  const nt = drawCanvas(512, 256, (x) => {
    x.fillStyle = '#9a0f14'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#fff3e0'; x.font = `bold 120px ${JPM}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('炉', 128, 130); x.fillText('端', 384, 130);
    x.fillStyle = '#300'; x.fillRect(254, 40, 4, 216);
  });
  const nm = swayMaterial({ map: nt, roughness: 0.95 }, 0.07, 1.2);
  for (let i = 0; i < 2; i++) {
    const g = new THREE.PlaneGeometry(0.8, 0.9, 3, 6);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 2);
    const m = new THREE.Mesh(g, nm); m.applyMatrix4(F.m(15.9 + i * 0.82, 2.45, 0.1)); m.castShadow = true; root.add(m);
  }
  // akachōchin row
  for (let i = 0; i < 7; i++) {
    const p = F.p(12.8 + i * 1.3, 0, 0.45);
    world.updaters.push(lantern(root, p.x, 3.05, p.z, { r: 0.24, h: 0.62, text: i % 2 ? '酒' : '焼鳥', glowI: 2.2, swing: 0.05 }));
  }
  F.box(B, M.wood, 16.6, 3.55, 0.3, 9.0, 0.14, 0.7);
  world.lights.push({ pos: F.p(16.6, 2.4, 1.3), color: 0xff4a28, intensity: 7, distance: 10 });
  // sake barrels (komodaru) stacked by the door
  const taruTex = drawCanvas(512, 256, (x) => {
    x.fillStyle = '#d9c9a6'; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 512; i += 6) { x.fillStyle = 'rgba(120,90,40,0.25)'; x.fillRect(i, 0, 2, 256); }
    x.fillStyle = '#7a0a10'; x.font = `bold 110px ${JPM}`; x.textAlign = 'center'; x.fillText('鯉正宗', 256, 160);
    x.fillStyle = '#1a1a1a'; x.fillRect(0, 20, 512, 12); x.fillRect(0, 224, 512, 12);
  });
  const taru = new THREE.MeshStandardMaterial({ map: taruTex, roughness: 0.85 });
  for (const [du, dv, dw] of [[21.4, 0.0, 0.5], [22.3, 0.0, 0.5], [21.85, 0.56, 0.5]]) B.add(new THREE.CylinderGeometry(0.29, 0.29, 0.56, 20), taru, F.m(du, dv + 0.18 + 0.28, dw).multiply(T(0, 0, 0, 0, 0.6, 0)));
  // chalk menu board
  const cb = drawCanvas(256, 384, (x) => {
    x.fillStyle = '#1b2a22'; x.fillRect(0, 0, 256, 384);
    x.fillStyle = '#f3efe0'; x.font = `bold 34px ${JP}`; x.textAlign = 'center';
    ['本日のおすすめ', '鮎の塩焼', 'ねぎま ¥180', 'つくね ¥200', '冷酒 ¥700', 'ハイボール ¥450'].forEach((s, i) => x.fillText(s, 128, 50 + i * 58));
  });
  const cbm = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshStandardMaterial({ map: cb, roughness: 0.9 }));
  cbm.applyMatrix4(F.m(11.6, 0.95, 0.5).multiply(T(0, 0, 0, -0.12, 0, 0))); root.add(cbm);
  // outdoor beer-crate seating with two patrons under the eave
  crateStack(B, F.m(10.8, 0.18, 1.2), rng, 1);
  crateStack(B, F.m(9.8, 0.18, 1.2), rng, 1);
  B.add(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 18), M.wood, F.m(10.3, 0.82, 1.3));
  B.add(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 8), M.metalDark, F.m(10.3, 0.5, 1.3));
  figure(root, { x: F.p(10.8, 0, 1.25).x, y: 0.5, z: F.p(10.8, 0, 1.25).z, ry: 0.4, pose: 'seated', coat: 0x283a5a, hair: 0x1a1a1a, seed: 71 });
  // upper floors: mansion with partitioned balconies
  const wins = [];
  for (let f = 0; f < 4; f++) for (let k = 0; k < 5; k++) wins.push({ u: 0.6 + k * 4.5, v: f * 3.4 + 0.3, w: 3.4, h: 2.1, style: WIN.SLIDER, lit: 0.55 });
  wallWithWindows(B, M.tileCream, F, len, H - GF, 0.3, wins, world.windows, { v0: GF });
  const ac = acUnit();
  for (let f = 0; f < 4; f++) {
    const y = GF + f * 3.4;
    F.box(B, M.concrete, len / 2, y + 0.08, 0.65, len, 0.16, 1.3);
    F.box(B, M.concrete, len / 2, y + 0.65, 1.27, len, 1.0, 0.08);           // solid balustrade
    F.box(B, M.galv, len / 2, y + 1.2, 1.27, len, 0.06, 0.1);
    for (let k = 1; k < 5; k++) F.box(B, M.glassFrost, k * 4.5 + 0.1, y + 1.5, 0.65, 0.04, 2.6, 1.25); // fire partitions
    for (let k = 0; k < 5; k++) {
      const r = rng.next();
      if (r < 0.6) ac.place(B, F.m(0.9 + k * 4.5 + rng.range(0, 2.4), y + 0.16, 0.8), { floor: true });
      if (rng.chance(0.55)) laundryLine(B, F.p(0.3 + k * 4.5, y + 2.4, 0.9), F.p(4.2 + k * 4.5, y + 2.4, 0.9), rng, rng.range(0.5, 0.8));
      if (rng.chance(0.5)) plant(B, F.m(3.8 + k * 4.5, y + 1.2, 1.27), rng, { size: 0.7 });
      if (rng.chance(0.25)) futon(B, F.m(1.6 + k * 4.5, y + 1.25, 1.27), rng, { width: 1.0 });
    }
  }
  // mansion name plate + rooftop billboard frame (empty, rusted: "広告募集")
  const mp = lightBox({ w: 2.8, h: 0.7, d: 0.15, px: 100, intensity: 1.0, bracket: 0.0, painter: (x, w, h) => { x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a2a2a'; x.font = `bold 46px ${JPM}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('メゾン中野', w / 2, h / 2 + 4); } });
  mp.rotation.y = -Math.PI / 2; mp.position.copy(F.p(6.0, GF - 0.45, 0.1)); root.add(mp);
  const empty = drawCanvas(1024, 384, (x) => {
    x.fillStyle = '#d8d2c4'; x.fillRect(0, 0, 1024, 384);
    for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(90,60,30,${0.05 + (i % 4) * 0.04})`; x.fillRect((i * 97) % 1024, 0, 18 + (i % 5) * 9, 384); }
    x.fillStyle = '#c0141e'; x.font = `bold 110px ${JP}`; x.textAlign = 'center'; x.fillText('広告募集', 512, 190);
    x.fillStyle = '#222'; x.font = `bold 46px ${LAT}`; x.fillText('AD SPACE  ·  03-2087-7777', 512, 300);
  });
  const em = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshStandardMaterial({ map: empty, roughness: 0.8 }));
  em.applyMatrix4(F.m(14, H + 2.6, -0.5)); root.add(em);
  for (const du of [10, 18]) B.rod(M.rustBeam || M.metalDark, 0.08, F.p(du, H, -0.9), F.p(du, H + 4.4, -0.7));
}

/* ============================== GAME ZONE ∞ =========================== */
function buildArcade(world, B, root, rng) {
  const F = new Frame('-x', 7.5, 0, 9);   // u = z - 9  (0 … 31)
  const len = 31, H = 16, GF = 5.0;
  B.add(boxGeo(16, H - GF, len, 0.25), M.concreteDark, T(7.5 + 0.6 + 8, GF + (H - GF) / 2, 9 + len / 2));
  B.add(boxGeo(0.3, GF, len, 0.25), M.concreteDark, T(18.2, GF / 2, 9 + len / 2));
  B.add(boxGeo(10.5, GF, 0.3, 0.25), M.concreteDark, T(13, GF / 2, 9.4));
  B.add(boxGeo(10.5, GF, 0.3, 0.25), M.concreteDark, T(13, GF / 2, 30.4));
  // full-glass ground floor with crane games
  wallWithOpenings(B, M.metalDark, F, len, GF, 0.3, [{ u: 1.0, v: 0, w: 20.0, h: 4.2 }], 0.5);
  B.add(boxGeo(10, 0.04, 20, 1), M.tileDark, T(13, 0.2, 9 + 11));
  B.add(new THREE.BoxGeometry(10, 0.1, 20), M.plasticBlack, T(13, 4.25, 20));
  const stripCols = [0xff2a8a, 0x2af3ff, 0xffd400, 0x8a2aff];
  for (let i = 0; i < 6; i++) B.add(new THREE.BoxGeometry(9.5, 0.04, 0.06), glow(stripCols[i % 4], 5), T(13, 4.15, 11 + i * 3.4));
  B.add(new THREE.BoxGeometry(0.03, 4.2, 20), M.glassClear, T(7.85, 2.3, 20));
  for (let u = 1.0; u <= 21.01; u += 2.5) F.box(B, M.chrome, u, 2.3, -0.35, 0.06, 4.2, 0.06);
  // crane-game cabinets (UFO catchers): coloured base, glass box of plushies, lit marquee
  const plushCols = [0xffa0c8, 0xfff0a0, 0xa0e8ff, 0xc8a0ff, 0xffffff, 0xff8a6a, 0x9affb4];
  const marquee = (txt, c1, c2) => drawCanvas(256, 96, (x) => { const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 256, 96); x.fillStyle = '#fff'; x.font = `900 40px ${LAT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 52); });
  const mqs = [marquee('UFO★CATCH', '#ff2a8a', '#ffb000'), marquee('NEKO-PON', '#2a8aff', '#2af3ff'), marquee('KOI GRAB', '#ff3b2a', '#ffd400'), marquee('MEGA ∞', '#8a2aff', '#ff2ad4')];
  let k = 0;
  for (const row of [8.6, 10.6]) for (let u = 1.9; u < 20.5; u += 1.55) {
    const base = F.p(u, 0, -(row - 7.5));
    const col = new THREE.MeshStandardMaterial({ color: [0xff2a8a, 0x2a8aff, 0xffd400, 0x8a2aff][k % 4], roughness: 0.25, metalness: 0.3 });
    B.add(new RoundedBoxGeometry(1.2, 0.95, 1.1, 2, 0.06), col, T(base.x, 0.2 + 0.475, base.z));
    B.add(new THREE.BoxGeometry(1.15, 1.05, 1.05), M.glassClear, T(base.x, 0.2 + 0.95 + 0.52, base.z));
    for (const [a, b] of [[-0.57, -0.52], [-0.57, 0.52], [0.57, -0.52], [0.57, 0.52]]) B.add(new THREE.BoxGeometry(0.05, 1.05, 0.05), M.chrome, T(base.x + a, 1.67, base.z + b));
    for (let p = 0; p < 9; p++) B.add(new THREE.SphereGeometry(rng.range(0.1, 0.16), 10, 8), new THREE.MeshStandardMaterial({ color: rng.pick(plushCols), roughness: 0.9 }), T(base.x + rng.range(-0.4, 0.4), 1.25 + rng.range(0, 0.15), base.z + rng.range(-0.38, 0.38)));
    B.add(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), M.chrome, T(base.x + rng.range(-0.2, 0.2), 1.95, base.z));
    B.add(new THREE.BoxGeometry(1.15, 0.03, 1.05), glow(0xffffff, 3), T(base.x, 2.2, base.z));
    const mq = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.42), faceMaterial(mqs[k % 4], 1.8));
    mq.position.set(base.x - 0.53, 2.45, base.z); mq.rotation.y = -Math.PI / 2; root.add(mq);
    B.add(new THREE.BoxGeometry(1.0, 0.45, 1.15), M.plasticBlack, T(base.x + 0.05, 2.45, base.z));
    k++;
  }
  const pink = new THREE.RectAreaLight(0xff4ab8, 4.5, 20, 4);
  pink.position.set(7.4, 2.2, 20); pink.lookAt(0, 1.5, 20); root.add(pink);
  // façade above: GAME neon + pixel light bars + chasers
  const game = neonSign({ text: 'GAME', height: 2.0, color: 0xffd400, intensity: 6, materials: M, halo: 0.8, raceway: true, tube: 0.06, backing: { pad: 0.35, radius: 0.4 } });
  game.group.applyMatrix4(F.m(9.5, GF + 0.6, 0.15)); root.add(game.group);
  const zone = neonSign({ text: 'ZONE', height: 1.1, color: 0xff2a8a, intensity: 6, materials: M, halo: 0.8, raceway: false, tube: 0.07 });
  zone.group.applyMatrix4(F.m(9.5, GF + 2.85, 0.15)); root.add(zone.group);
  const inf = neonSign({ text: '8', height: 1.5, color: 0x2af3ff, intensity: 6, materials: M, halo: 0.6, raceway: false, tube: 0.08 });
  inf.group.applyMatrix4(F.m(15.2, GF + 1.8, 0.15).multiply(T(0, 0, 0, 0, 0, Math.PI / 2))); root.add(inf.group);
  const pts = rectPerimeter(14.5, 4.6, 0.3, 0).map((p) => F.p(9.5 - p.x, GF + 2.0 + p.y, 0.12));
  root.add(chaser(pts, { color: 0xffe08a, r: 0.045, speed: 10, gap: 3, intensity: 5 }));
  F.box(B, M.metalBlack, 9.5, GF + 2.0, -0.02, 15, 5.2, 0.12);
  // pixel bars: vertical LED columns cycling colour
  const pixMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vW;
      vec3 hsv(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){ float px = floor(vUv.y * 48.0); float f = fract(vUv.y * 48.0);
        float h = fract(px / 48.0 * 0.6 - uTime * 0.25 + vW.z * 0.03);
        float wave = 0.35 + 0.65 * step(0.5, fract(px / 12.0 - uTime * 0.8 + vW.z * 0.1));
        gl_FragColor = vec4(hsv(h) * 3.5 * wave * smoothstep(0.5, 0.2, abs(f - 0.5)), 1.0); }`,
  });
  for (let u = 18.5; u < 30.5; u += 1.6) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, H - GF - 1), pixMat);
    m.applyMatrix4(F.m(u, GF + (H - GF) / 2, 0.06)); root.add(m);
  }
  // upper cladding: big vinyl graphic panels
  const vinyl = drawCanvas(1024, 512, (x) => {
    x.fillStyle = '#0a0a14'; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 12; i++) { x.fillStyle = ['#ff2a8a', '#2af3ff', '#ffd400', '#8a2aff'][i % 4]; x.beginPath(); x.moveTo(i * 110 - 200, 512); x.lineTo(i * 110, 0); x.lineTo(i * 110 + 40, 0); x.lineTo(i * 110 - 160, 512); x.fill(); }
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, 0, 1024, 512);
    x.fillStyle = '#fff'; x.font = `900 120px ${LAT}`; x.fillText('PLAY', 60, 200);
    x.font = `900 120px ${LAT}`; x.fillStyle = '#ffd400'; x.fillText('ALL NIGHT', 60, 330);
    x.font = `bold 60px ${JP}`; x.fillStyle = '#2af3ff'; x.fillText('ゲームセンター 24時間', 60, 440);
  });
  const vm = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshStandardMaterial({ map: vinyl, emissiveMap: vinyl, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.55 }));
  vm.applyMatrix4(F.m(9.5, GF + 6.8, 0.02)); root.add(vm);
  wallWithOpenings(B, M.metalDark, F, len, H - GF, 0.3, [], 0.5, 0, GF);
  // alley-facing side (north, z = 9): pipes, back door, AC, graffiti
  const N = new Frame('-z', 24, 0, 9);
  wallWithOpenings(B, M.concrete, N, 16.5, H, 0.3, [{ u: 4, v: 0.1, w: 1.0, h: 2.2 }], 0.25);
  const gt = graffiti({ seed: 11, words: ['GAME', 'OVER', '∞'] });
  const gg = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ map: gt, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  gg.position.set(16.5, 2.4, 9.02); root.add(gg);
  const ac = acUnit();
  for (let i = 0; i < 5; i++) ac.place(B, N.m(2 + i * 2.6, 6 + (i % 2) * 2.2, 0.38));
  for (const u of [1.2, 9.5, 14.0]) N.cyl(B, M.plasticGrey, 0.06, H, u, H / 2, 0.1, 'v');
  roofKit(world, B, root, rng, 7.5, 24, 9, 40, H, { skylights: true });
  // rooftop sign readable from the air
  const top = lightBox({ w: 9, h: 2.2, d: 0.4, px: 70, intensity: 1.4, bracket: 0, painter: (x, w, h) => {
    x.fillStyle = '#12051e'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffd400'; x.font = `900 ${h * 0.6}px ${LAT}`; x.textBaseline = 'middle'; x.fillText('GAME', 18, h / 2 + 4);
    x.fillStyle = '#ff2a8a'; x.fillText('ZONE', w * 0.5, h / 2 + 4);
  } });
  top.rotation.y = Math.PI / 2; top.position.set(9.0, H + 1.6, 33); root.add(top);
  for (const z of [26, 32]) B.rod(M.metalDark, 0.06, new THREE.Vector3(9.2, H, z), new THREE.Vector3(9.2, H + 1.0, z));
}

/* ------------------------------ Roof kit ------------------------------- */
// HVAC condensers, exhaust stacks, glowing skylights and a water tank —
// so flat roofs read as working machinery from the air.
function roofKit(world, B, root, rng, x0, x1, z0, z1, H, { skylights = false } = {}) {
  const pad = 1.2;
  B.add(boxGeo(x1 - x0, 0.9, 0.25, 0.5), M.concreteDark, T((x0 + x1) / 2, H + 0.45, z0 + 0.12));
  B.add(boxGeo(x1 - x0, 0.9, 0.25, 0.5), M.concreteDark, T((x0 + x1) / 2, H + 0.45, z1 - 0.12));
  B.add(boxGeo(0.25, 0.9, z1 - z0, 0.5), M.concreteDark, T(x0 + 0.12, H + 0.45, (z0 + z1) / 2));
  B.add(boxGeo(0.25, 0.9, z1 - z0, 0.5), M.concreteDark, T(x1 - 0.12, H + 0.45, (z0 + z1) / 2));
  const fan = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.4, metalness: 0.7 });
  const n = Math.round(((x1 - x0) * (z1 - z0)) / 45);
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0 + pad + 1, x1 - pad - 1), z = rng.range(z0 + pad + 1, z1 - pad - 1);
    const k = rng.next();
    if (k < 0.45) {
      B.add(new RoundedBoxGeometry(1.8, 1.1, 1.1, 2, 0.06), fan, T(x, H + 0.55, z));
      for (const dx of [-0.45, 0.45]) { B.add(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 20), M.metalBlack, T(x + dx, H + 1.11, z)); B.add(new THREE.BoxGeometry(0.7, 0.02, 0.06), M.galv, T(x + dx, H + 1.14, z, 0, rng.range(0, 3), 0)); }
    } else if (k < 0.65) {
      B.add(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 12), M.galv, T(x, H + 1.1, z));
      B.add(new THREE.ConeGeometry(0.4, 0.3, 12), M.galv, T(x, H + 2.35, z));
    } else if (k < 0.8 && skylights) {
      B.add(new THREE.BoxGeometry(3.2, 0.25, 1.4), M.metalDark, T(x, H + 0.12, z));
      B.add(new THREE.BoxGeometry(3.0, 0.02, 1.2), glow(rng.pick([0xff2a8a, 0x2af3ff, 0xffd400]), 2.2), T(x, H + 0.26, z));
    } else {
      B.add(new THREE.BoxGeometry(rng.range(1, 2.5), rng.range(0.6, 1.4), rng.range(1, 2.5)), M.concreteWarm, T(x, H + 0.5, z));
    }
  }
  // duct runs
  B.add(new THREE.BoxGeometry(0.5, 0.5, (z1 - z0) * 0.6), M.galv, T(x0 + (x1 - x0) * 0.7, H + 0.4, (z0 + z1) / 2));
}

/* ========================== Rear block (alley end) ===================== */
function buildRearBlock(world, B, root, rng) {
  // a tired 1970s walk-up closing the back alley: tiled wall, steel doors,
  // a lonely vending machine, AC units stacked up the wall, a hanging cable mess
  const x0 = 24, x1 = 34, z0 = -14, z1 = 16, H = 20;
  B.add(boxGeo(x1 - x0, H, z1 - z0, 0.25), M.concreteWarm, T((x0 + x1) / 2, H / 2, (z0 + z1) / 2));
  const F = new Frame('-x', x0, 0, 3.0);   // u = z - 3  (alley mouth spans u 1 … 6)
  const wins = [];
  for (let f = 0; f < 5; f++) for (const u of [0.6, 4.4]) if (f > 0) wins.push({ u, v: f * 3.6 + 1.0, w: 1.4, h: 1.5, style: WIN.SLIDER, lit: 0.5 });
  wallWithWindows(B, M.brick, F, 7.0, H, 0.25, wins, world.windows, { sillMat: M.concreteDark });
  F.box(B, new THREE.MeshStandardMaterial({ color: 0x4a3e36, roughness: 0.5, metalness: 0.6 }), 2.0, 1.15, 0.03, 0.95, 2.1, 0.06);
  F.box(B, glow(0xfff0c8, 2.5), 2.0, 2.45, 0.08, 0.3, 0.1, 0.06);
  const vm = F.m(4.6, 0.11 + 0.92, 0.42);
  B.add(new RoundedBoxGeometry(0.98, 1.84, 0.78, 2, 0.04), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35, metalness: 0.3 }), vm);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.58), faceMaterial(vendingFront(41, 1), 1.3));
  face.applyMatrix4(F.m(4.6, 1.21, 0.815)); root.add(face);
  const ac = acUnit();
  for (let i = 0; i < 5; i++) ac.place(B, F.m(1.2 + (i % 2) * 3.4, 4.2 + i * 2.9, 0.38));
  roofKit(world, B, root, rng, x0, x1, z0, z1, H);
  const gt = graffiti({ seed: 17, words: ['KOI', 'LOVE', '7区'] });
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), new THREE.MeshStandardMaterial({ map: gt, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  gm.applyMatrix4(F.m(3.4, 1.9, 0.01)); root.add(gm);
  for (const u of [0.25, 6.7]) F.cyl(B, M.plasticGrey, 0.06, H, u, H / 2, 0.08, 'v');
}
