import * as THREE from 'three';
import { M, glow } from '../core/materials.js';
import { RNG } from '../core/utils.js';

/* =================================================================== */
/*  Stylised people. Read as silhouettes against neon: long coats,     */
/*  hoods, a chef's hachimaki, and the classic LED-shaft umbrella.     */
/* =================================================================== */

const skin = new THREE.MeshStandardMaterial({ color: 0xb98a6c, roughness: 0.55 });
const pants = new THREE.MeshStandardMaterial({ color: 0x121318, roughness: 0.8 });
const shoe = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.35 });
const matCache = new Map();
const cloth = (hex, r = 0.82) => {
  const k = hex + '_' + r;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: r }));
  return matCache.get(k);
};

function cap(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  m.castShadow = true;
  return m;
}

/** Limb pivot: a group at the joint with a capsule hanging down. */
function limb(r, len, mat) {
  const g = new THREE.Group();
  const c = cap(r, len, mat);
  c.position.y = -len / 2 - r * 0.4;
  g.add(c);
  g.userData.len = len;
  return g;
}

export function figure(parent, { x = 0, y = 0, z = 0, ry = 0, pose = 'standing', coat = 0x1a1d26, hair = 0x0c0c0c, seed = 1, hood = false, umbrella = null, scale = 1 } = {}) {
  const rng = new RNG(seed * 31 + 7);
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = ry;
  root.scale.setScalar(scale * rng.range(0.95, 1.05));
  const coatM = cloth(coat);
  const hip = new THREE.Group();
  root.add(hip);
  const seated = pose === 'seated';
  hip.position.y = seated ? 0.05 : 0.94;

  // torso + coat
  const torso = new THREE.Group();
  hip.add(torso);
  const chest = cap(0.15, 0.36, coatM); chest.scale.set(1.12, 1, 0.72); chest.position.y = 0.33; torso.add(chest);
  if (!seated && pose !== 'chef') {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.62, 14, 1, true), coatM);
    skirt.material = coatM; skirt.position.y = -0.18; skirt.scale.z = 0.78; skirt.castShadow = true;
    const inner = skirt.clone(); inner.material = cloth(0x050505); inner.scale.multiplyScalar(0.97);
    torso.add(skirt, inner);
    // collar
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.12, 12), coatM); col.position.y = 0.6; torso.add(col);
  }
  if (pose === 'chef') {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.75, 0.02), cloth(0x1c2a44)); apron.position.set(0, -0.05, 0.13); torso.add(apron);
  }
  // head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8), skin); neck.position.y = 0.66; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), skin); head.scale.set(0.92, 1.08, 1.0); head.position.y = 0.8; head.castShadow = true; torso.add(head);
  const hairM = cloth(hair, 0.6);
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.112, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
  hr.position.y = 0.81; hr.rotation.x = -0.25; hr.scale.set(0.95, 1.05, 1.05); torso.add(hr);
  if (hood) {
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), coatM);
    hd.position.set(0, 0.8, -0.015); hd.rotation.x = -0.45; torso.add(hd);
  }
  if (pose === 'chef') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.103, 0.018, 6, 20), cloth(0xffffff, 0.7)); band.position.y = 0.86; band.rotation.x = Math.PI / 2; torso.add(band);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), cloth(0xc8141e, 0.7)); knot.position.set(0, 0.86, -0.1); torso.add(knot);
  }
  // visor glow (AR glasses) on some people
  if (rng.chance(0.5) && pose !== 'chef') {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.02), glow(rng.pick([0x00f0ff, 0xff2a8a, 0xb6ff3a]), 4));
    v.position.set(0, 0.82, 0.1); torso.add(v);
  }

  // arms
  const armL = limb(0.048, 0.5, coatM), armR = limb(0.048, 0.5, coatM);
  armL.position.set(0.2, 0.55, 0); armR.position.set(-0.2, 0.55, 0);
  torso.add(armL, armR);
  for (const a of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin); hand.position.y = -0.6; a.add(hand);
  }
  // legs
  const legL = limb(0.068, 0.78, pants), legR = limb(0.068, 0.78, pants);
  legL.position.set(0.09, 0, 0); legR.position.set(-0.09, 0, 0);
  hip.add(legL, legR);
  for (const l of [legL, legR]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.26), shoe); s.position.set(0, -0.86, 0.05); l.add(s);
  }

  if (seated) {
    legL.rotation.x = legR.rotation.x = -1.45;
    for (const l of [legL, legR]) { const shin = l.children[0]; shin.scale.y = 0.55; }
    // lower legs hanging down from the knees
    for (const sx of [0.09, -0.09]) {
      const shin = cap(0.06, 0.4, pants); shin.position.set(sx, -0.25, 0.42); hip.add(shin);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), shoe); s.position.set(sx, -0.5, 0.48); hip.add(s);
    }
    torso.rotation.x = 0.32;
    armL.rotation.x = armR.rotation.x = -1.15;
    armL.rotation.z = 0.2; armR.rotation.z = -0.2;
    head.rotation.x = 0.3;
  }
  if (pose === 'chef') { armL.rotation.x = -0.9; armR.rotation.x = -0.6; }

  let umb = null;
  if (umbrella) {
    umb = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.33),
      new THREE.MeshStandardMaterial({ color: 0xbfd8ff, roughness: 0.05, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, emissive: umbrella, emissiveIntensity: 0.1 }));
    canopy.position.y = 0.05; canopy.scale.y = 0.75;
    const rimR = 0.62 * Math.sin(Math.PI * 0.33);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.008, 6, 40), glow(umbrella, 3.2));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.05 + 0.62 * Math.cos(Math.PI * 0.33) * 0.75;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 8), glow(umbrella, 4.5));
    shaft.position.y = 0.05;
    for (let i = 0; i < 8; i++) {
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 4), glow(umbrella, 1.4));
      const a = (i / 8) * Math.PI * 2;
      rib.position.set(Math.cos(a) * rimR * 0.5, rim.position.y + 0.12, Math.sin(a) * rimR * 0.5);
      rib.rotation.set(Math.sin(a) * 1.05, 0, -Math.cos(a) * 1.05);
      umb.add(rib);
    }
    umb.add(canopy, rim, shaft);
    umb.position.set(-0.12, 1.95, 0.12);
    root.add(umb);
    armR.rotation.x = -0.6; armR.rotation.z = 0.35;
    root.userData.umbrellaColor = umbrella;
  }

  parent.add(root);
  root.userData.walk = (phase, speed = 1) => {
    const s = Math.sin(phase);
    legL.rotation.x = s * 0.45 * speed; legR.rotation.x = -s * 0.45 * speed;
    armL.rotation.x = -s * 0.35 * speed;
    if (!umbrella) armR.rotation.x = s * 0.35 * speed;
    hip.position.y = 0.94 + Math.abs(Math.cos(phase)) * 0.025;
    torso.rotation.z = s * 0.03;
  };
  return root;
}
