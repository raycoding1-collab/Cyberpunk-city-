import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, glow } from '../core/materials.js';
import { RNG } from '../core/utils.js';

/* =================================================================== */
/*  People. Sculpted with real proportions: lathed torso with waist,   */
/*  chest and shoulders, two-segment limbs with knees and elbows,      */
/*  jaw / nose / ears, shoes with toes. Wardrobe from the seed: long   */
/*  trench, short jacket, hoodie, quilted puffer, suit — wet raincoat  */
/*  fabric on some — plus hair styles, hats, masks, bags, headphones.  */
/* =================================================================== */

const SKIN = [0xc79a7c, 0xb98a6c, 0xa77a5c, 0xd9b090, 0x8a6048];
const cache = new Map();
const mat = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const cloth = (hex, kind = 'cloth') => mat(hex + kind, () => (kind === 'rain'
  ? new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.28, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.15 })
  : kind === 'denim' ? new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 })
    : new THREE.MeshStandardMaterial({ color: hex, roughness: kind === 'wool' ? 0.92 : 0.75 })));
const skinMat = (i) => mat('skin' + i, () => new THREE.MeshStandardMaterial({ color: SKIN[i], roughness: 0.55 }));
const shoeMat = (i) => mat('shoe' + i, () => new THREE.MeshStandardMaterial({ color: [0x0b0b0c, 0x3a2416, 0xe8e8e4, 0x1b1d24][i], roughness: i === 0 ? 0.25 : 0.6 }));

function torsoGeo(scale = 1, puff = 1) {
  const pr = [[0.0, 0.0], [0.155, 0.0], [0.165, 0.06], [0.148, 0.2], [0.17, 0.32], [0.188, 0.4], [0.196, 0.47], [0.15, 0.53], [0.075, 0.56], [0.0, 0.565]];
  const g = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r * scale * puff, y)), 20);
  g.scale(1, 1, 0.64);
  return g;
}
function skirtGeo(len, flare, scale = 1) {
  const pr = [[0.168 * scale, 0.0], [0.19 * scale, -len * 0.45], [(0.2 + flare) * scale, -len]];
  return new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 20, 0, Math.PI * 2);
}
function limbGeo(r0, r1, len) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 10);
  g.translate(0, -len / 2, 0);
  return g;
}
function seg(parentGroup, geo, material, y = 0) {
  const g = new THREE.Group();
  g.position.y = y;
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  g.add(m);
  parentGroup.add(g);
  return g;
}

export function figure(parent, { x = 0, y = 0, z = 0, ry = 0, pose = 'standing', coat = 0x1a1d26, hair = 0x0c0c0c, seed = 1, hood = false, umbrella = null, scale = 1 } = {}) {
  const r = new RNG(seed * 31 + 7);
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = ry;
  root.scale.setScalar(scale * r.range(0.94, 1.06));
  const chef = pose === 'chef', seated = pose === 'seated';
  const outfit = chef ? 'chef' : r.pick(['trench', 'jacket', 'hoodie', 'puffer', 'suit', 'trench', 'jacket']);
  const fabricKind = outfit === 'trench' && r.chance(0.6) ? 'rain' : outfit === 'puffer' ? 'rain' : outfit === 'suit' ? 'wool' : 'cloth';
  const coatM = cloth(chef ? 0xeeeae2 : coat, fabricKind);
  const pantsM = cloth(r.pick([0x15161b, 0x1f2a44, 0x2c3e5c, 0x3a352c, 0x111111]), r.chance(0.4) ? 'denim' : 'cloth');
  const sk = skinMat(r.int(0, SKIN.length - 1));
  const shoe = shoeMat(r.int(0, 3));

  const hip = new THREE.Group();
  hip.position.y = seated ? 0.06 : 0.93;
  root.add(hip);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), pantsM);
  pelvis.scale.set(1.05, 0.62, 0.72); pelvis.castShadow = true; hip.add(pelvis);

  // ---------- torso ----------
  const torso = new THREE.Group(); torso.position.y = 0.02; hip.add(torso);
  const puff = outfit === 'puffer' ? 1.16 : outfit === 'trench' ? 1.05 : 1.0;
  const tm = new THREE.Mesh(torsoGeo(1, puff), coatM); tm.castShadow = true; torso.add(tm);
  if (outfit === 'puffer') for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.175 * puff, 0.012, 5, 22), coatM); b.rotation.x = Math.PI / 2; b.scale.set(1, 0.64, 1); b.position.y = 0.08 + i * 0.09; torso.add(b); }
  if (outfit === 'trench' && !seated) {
    const sk2 = new THREE.Mesh(skirtGeo(0.62, 0.07, puff), coatM); sk2.scale.z = 0.7; sk2.castShadow = true; torso.add(sk2);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.152 * puff, 0.014, 5, 22), cloth(0x1a1410)); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.64, 1); belt.position.y = 0.2; torso.add(belt);
    const lap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.02), coatM); lap.position.set(0, 0.44, 0.115); lap.rotation.x = -0.2; torso.add(lap);
  }
  if (outfit === 'jacket' || outfit === 'suit') {
    const hem = new THREE.Mesh(skirtGeo(0.12, 0.0, 1.02), coatM); hem.scale.z = 0.68; torso.add(hem);
    if (outfit === 'suit') { const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.01), cloth(0x6a1020)); tie.position.set(0, 0.38, 0.122); torso.add(tie); const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.01), cloth(0xe8e8e8)); shirt.position.set(0, 0.45, 0.118); torso.add(shirt); }
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.48, 0.01), M.metalBlack); zip.position.set(0, 0.28, 0.12); torso.add(zip);
  }
  if (outfit === 'hoodie' || hood) {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.02), coatM); pocket.position.set(0, 0.16, 0.105); torso.add(pocket);
  }
  if (chef) { const apron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.7, 0.015), cloth(0x1c2a44)); apron.position.set(0, -0.05, 0.12); torso.add(apron); }
  for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.068 * puff, 12, 8), coatM); sh.position.set(s * 0.19 * puff, 0.47, 0); sh.scale.set(1, 0.9, 0.85); sh.castShadow = true; torso.add(sh); }
  // collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.07, 14, 1, true), coatM); collar.position.y = 0.56; torso.add(collar);

  // ---------- head ----------
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), sk); neck.position.y = 0.6; torso.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.73; torso.add(headG);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), sk); skull.scale.set(0.86, 1.06, 0.98); skull.castShadow = true; headG.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), sk); jaw.position.set(0, -0.05, 0.022); jaw.scale.set(0.95, 0.85, 0.95); headG.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 6), sk); nose.rotation.x = Math.PI / 2 + 0.3; nose.position.set(0, -0.005, 0.098); headG.add(nose);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), sk); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.087, 0.0, 0.0); headG.add(ear); }
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), mat('eye', () => new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.1 }))); eye.position.set(s * 0.032, 0.02, 0.085); headG.add(eye); }
  const hairM = cloth(hair, 'cloth'); hairM.roughness = 0.55;
  const style = chef ? 'band' : (hood || outfit === 'hoodie') && r.chance(0.6) ? 'hood' : r.pick(['short', 'bob', 'pony', 'bun', 'beanie', 'cap', 'short']);
  if (style !== 'hood') {
    const capG = new THREE.Mesh(new THREE.SphereGeometry(0.106, 18, 12, 0, Math.PI * 2, 0, style === 'bob' ? Math.PI * 0.62 : Math.PI * 0.5), hairM);
    capG.position.set(0, 0.012, -0.006); capG.rotation.x = -0.32; capG.scale.set(0.9, 1.06, 1.02); headG.add(capG);
    if (style === 'bob') { const back = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4), hairM); back.position.set(0, -0.02, -0.02); back.scale.set(0.95, 1.1, 1); headG.add(back); }
    if (style === 'pony') { const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.14, 4, 8), hairM); p.position.set(0, -0.06, -0.11); p.rotation.x = 0.35; headG.add(p); }
    if (style === 'bun') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), hairM); b.position.set(0, 0.1, -0.06); headG.add(b); }
    if (style === 'beanie') { const bm = cloth(r.pick([0x2a2a30, 0x8a1c1c, 0x3a5a3a, 0xd8d0c0]), 'wool'); const be = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), bm); be.position.y = 0.02; be.scale.set(0.92, 1.08, 1.02); headG.add(be); const fold = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.016, 6, 20), bm); fold.rotation.x = Math.PI / 2; fold.position.y = 0.025; fold.scale.set(0.92, 1.02, 1); headG.add(fold); }
    if (style === 'cap') { const cm = cloth(r.pick([0x111111, 0x1f2a44, 0xe8e8e8]), 'cloth'); const c = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), cm); c.position.y = 0.025; c.scale.set(0.92, 0.95, 1.02); headG.add(c); const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 16, 1, false, -Math.PI / 2, Math.PI), cm); visor.position.set(0, 0.03, 0.08); visor.rotation.x = 0.12; headG.add(visor); }
  }
  if (style === 'hood') { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), coatM); hd.position.set(0, 0.0, -0.02); hd.rotation.x = -0.42; hd.scale.set(0.95, 1.05, 1.08); headG.add(hd); }
  if (style === 'band') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.097, 0.016, 6, 22), cloth(0xffffff)); band.position.y = 0.05; band.rotation.x = Math.PI / 2; band.scale.set(0.9, 1.0, 1); headG.add(band); const capH = new THREE.Mesh(new THREE.SphereGeometry(0.104, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hairM); capH.position.y = 0.012; headG.add(capH); }
  // accessories
  if (!chef && r.chance(0.35)) { const mask = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.45, Math.PI * 0.32), cloth(r.chance(0.7) ? 0xf0f0ec : 0x18181a)); mask.position.set(0, -0.035, 0.03); mask.rotation.y = Math.PI; mask.rotation.y = 0; mask.scale.set(1, 1, 1.05); headG.add(mask); }
  if (!chef && r.chance(0.3)) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.024, 0.02), glow(r.pick([0x00f0ff, 0xff2a8a, 0xb6ff3a]), 4)); v.position.set(0, 0.025, 0.094); headG.add(v); }
  if (!chef && r.chance(0.2) && style !== 'hood') { const hp = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.008, 5, 18, Math.PI), M.plasticBlack); hp.position.y = 0.01; headG.add(hp); for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12), M.plasticBlack); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.1, 0.0, 0); headG.add(cup); } }
  if (!chef && !seated && r.chance(0.35)) { const bp = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.38, 0.14, 2, 0.04), cloth(r.pick([0x111214, 0x2a3a2a, 0x5a2a1a]), 'rain')); bp.position.set(0, 0.32, -0.19); bp.castShadow = true; torso.add(bp); for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.015), M.plasticBlack); st.position.set(s * 0.1, 0.3, 0.115); torso.add(st); } }
  else if (!chef && !seated && r.chance(0.3)) { const bag = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.2, 0.08, 2, 0.03), cloth(r.pick([0x3a2416, 0x111111, 0x8a6a4a]))); bag.position.set(-0.2, 0.02, 0.02); torso.add(bag); const strap = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.62, 0.012), M.plasticBlack); strap.position.set(0.0, 0.3, 0.115); strap.rotation.z = 0.62; torso.add(strap); }

  // ---------- arms ----------
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.215 * puff, 0.46, 0); torso.add(sh);
    const upper = seg(sh, limbGeo(0.054 * puff, 0.045 * puff, 0.29), coatM);
    const elbow = new THREE.Group(); elbow.position.y = -0.29; upper.add(elbow);
    const fore = seg(elbow, limbGeo(0.046 * puff, 0.038, 0.26), coatM);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 8), sk); cuff.position.y = -0.27; fore.add(cuff);
    const hand = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.1, 0.03, 2, 0.012), sk); hand.position.y = -0.33; fore.add(hand);
    sh.rotation.z = s * 0.06;
    return { sh, elbow };
  };
  const armL = arm(1), armR = arm(-1);
  // ---------- legs ----------
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(s * 0.085, -0.02, 0); hip.add(hp);
    const thigh = seg(hp, limbGeo(0.078, 0.06, 0.44), pantsM);
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    const shin = seg(knee, limbGeo(0.057, 0.043, 0.43), pantsM);
    const sh = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.075, 0.27, 2, 0.03), shoe); sh.position.set(0, -0.45, 0.055); sh.castShadow = true; shin.add(sh);
    return { hp, knee };
  };
  const legL = leg(1), legR = leg(-1);

  if (seated) {
    for (const l of [legL, legR]) { l.hp.rotation.x = -1.5; l.knee.rotation.x = 1.5; }
    torso.rotation.x = 0.28; headG.rotation.x = 0.25;
    for (const a of [armL, armR]) { a.sh.rotation.x = -0.75; a.elbow.rotation.x = -0.9; }
    armL.sh.rotation.z = 0.25; armR.sh.rotation.z = -0.25;
  }
  if (chef) { armL.sh.rotation.x = -0.6; armL.elbow.rotation.x = -1.0; armR.sh.rotation.x = -0.3; armR.elbow.rotation.x = -1.2; }

  // ---------- umbrella ----------
  if (umbrella !== null && umbrella !== undefined) {
    const umb = new THREE.Group();
    const led = umbrella !== 0x000000 && r.chance(0.65);
    const R = 0.62, open = Math.PI * 0.34;
    const canopyMat = led
      ? new THREE.MeshStandardMaterial({ color: 0xbfd8ff, roughness: 0.05, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, emissive: umbrella, emissiveIntensity: 0.08 })
      : new THREE.MeshPhysicalMaterial({ color: r.pick([0x0c0c10, 0x1a2238, 0x3a1018]), roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide });
    // 8-panel canopy: scalloped edge between ribs
    const cg = new THREE.SphereGeometry(R, 32, 8, 0, Math.PI * 2, 0, open);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const sc = 1 - 0.03 * Math.abs(Math.sin(a * 4)) * (1 - p.getY(i) / R); p.setX(i, p.getX(i) * sc); p.setZ(i, p.getZ(i) * sc); }
    cg.computeVertexNormals();
    const canopy = new THREE.Mesh(cg, canopyMat); canopy.scale.y = 0.72; canopy.castShadow = !led;
    const rimR = R * Math.sin(open), rimY = R * Math.cos(open) * 0.72;
    const ribM = led ? glow(umbrella, 1.4) : M.metalDark;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pts = []; for (let k = 0; k <= 6; k++) { const t = (k / 6) * open; pts.push(new THREE.Vector3(Math.cos(a) * R * Math.sin(t), R * Math.cos(t) * 0.72 - 0.005, Math.sin(a) * R * Math.sin(t))); }
      umb.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.004, 3), ribM));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4), led ? glow(umbrella, 3) : M.chrome); tip.position.set(Math.cos(a) * rimR, rimY, Math.sin(a) * rimR); umb.add(tip);
    }
    if (led) { const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.006, 5, 40), glow(umbrella, 3.0)); rim.rotation.x = Math.PI / 2; rim.position.y = rimY; umb.add(rim); }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.9, 8), led ? glow(umbrella, 4.2) : M.chrome); shaft.position.y = 0.3; umb.add(shaft);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI), M.plasticBlack); handle.position.set(0.035, -0.15, 0); handle.rotation.z = Math.PI; umb.add(handle);
    umb.add(canopy);
    umb.position.set(-0.13, 1.95, 0.12);
    root.add(umb);
    armR.sh.rotation.x = -0.65; armR.elbow.rotation.x = -1.2; armR.sh.rotation.z = -0.1;
    root.userData.umbrellaColor = umbrella;
  }

  parent.add(root);
  root.userData.walk = (phase, speed = 1) => {
    const s = Math.sin(phase), c = Math.cos(phase);
    legL.hp.rotation.x = s * 0.42 * speed; legR.hp.rotation.x = -s * 0.42 * speed;
    legL.knee.rotation.x = Math.max(0, -c) * 0.75 * speed; legR.knee.rotation.x = Math.max(0, c) * 0.75 * speed;
    armL.sh.rotation.x = -s * 0.32 * speed; armL.elbow.rotation.x = -0.2 - Math.max(0, s) * 0.25;
    if (umbrella === null || umbrella === undefined) { armR.sh.rotation.x = s * 0.32 * speed; armR.elbow.rotation.x = -0.2 - Math.max(0, -s) * 0.25; }
    hip.position.y = 0.93 + Math.abs(c) * 0.022 - 0.01;
    hip.rotation.y = s * 0.06; torso.rotation.y = -s * 0.09; torso.rotation.x = 0.04;
  };
  return root;
}
