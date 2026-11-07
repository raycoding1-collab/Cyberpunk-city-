import * as THREE from 'three';
import { U, RNG, GLSL_NOISE, Batch, T } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { puffSprite } from '../core/textures.js';

/* =================================================================== */
/*  Weather & air: lit rain streaks that pick up nearby neon, splash   */
/*  crowns on the asphalt, steam plumes (kitchens, manholes, cooling   */
/*  towers), volumetric lamp cones, and drones patrolling the canyon.  */
/* =================================================================== */

export function buildAtmosphere(world) {
  const { scene, camera } = world;
  const api = {};
  api.rain = buildRain(world);
  api.splash = buildSplashes(world);
  api.steam = buildSteam(world);
  buildCones(world);
  buildDrones(world);
  return api;
}

/* -------------------------------- Rain --------------------------------- */
function buildRain(world) {
  const N = 16000;
  const pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2 * 2);
  const r = new RNG(77);
  for (let i = 0; i < N; i++) {
    const x = r.next(), y = r.next(), z = r.next(), s = r.next();
    for (let e = 0; e < 2; e++) {
      pos.set([x, y, z], (i * 2 + e) * 3);
      seed.set([s, e], (i * 2 + e) * 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  // brightest light sources, so drops passing them glint in their colour
  const L = [
    [7.0, 3.0, -2.4, 0xffa060], [6.4, 14.0, 3.5, 0xff2030], [-6.0, 21.0, -17.0, 0xff40c0], [-7.0, 2.0, -8.0, 0xdff0ff],
    [-6.8, 2.0, -19.0, 0xfff2c0], [7.2, 2.0, 20.0, 0xff4ab8], [3.6, 7.6, 15.5, 0xd8ecff], [-3.6, 7.6, 2.5, 0xd8ecff],
  ];
  const lp = L.map((l) => new THREE.Vector3(l[0], l[1], l[2]));
  const lc = L.map((l) => new THREE.Color(l[3]));
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(44, 30, 44) },
      uSpeed: { value: 11.5 }, uWind: { value: new THREE.Vector2(1.4, 0.6) }, uLen: { value: 0.3 },
      uLP: { value: lp }, uLC: { value: lc }, uAmt: { value: 1 },
    }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec2 aSeed; uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform float uSpeed; uniform vec2 uWind; uniform float uLen;
      uniform vec3 uLP[8]; uniform vec3 uLC[8]; uniform float uAmt;
      varying vec3 vCol; varying float vA;
      void main(){
        float sp = uSpeed * (0.85 + aSeed.x * 0.3);
        vec3 p = position * uBox;
        p.y -= uTime * sp;
        p.xz += uWind * uTime;
        vec3 o = uCam - uBox * 0.5; o.y = uCam.y - uBox.y * 0.35;
        p = mod(p - o, uBox) + o;
        vec3 vel = normalize(vec3(uWind.x, -sp, uWind.y));
        p += vel * aSeed.y * uLen * (0.7 + aSeed.x * 0.6);
        vec3 c = vec3(0.33, 0.36, 0.48);
        for (int i = 0; i < 8; i++) { vec3 d = p - uLP[i]; c += uLC[i] * 7.0 / (1.0 + dot(d, d) * 0.9); }
        vCol = c;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        float dist = -mvPosition.z;
        vA = smoothstep(0.3, 1.5, dist) * (1.0 - smoothstep(14.0, 24.0, dist)) * (0.35 + 0.65 * aSeed.y) * step(aSeed.x, uAmt) * step(0.0, p.y);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      varying vec3 vCol; varying float vA;
      void main(){
        gl_FragColor = vec4(vCol * vA * 0.24, 1.0);
        #include <fog_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  mat.uniforms.uTime = U.time;
  const rain = new THREE.LineSegments(geo, mat);
  rain.frustumCulled = false;
  rain.layers.set(1);
  world.scene.add(rain);
  world.updaters.push(() => { mat.uniforms.uCam.value.copy(world.camera.position); mat.uniforms.uAmt.value = U.rain.value; });
  return rain;
}

/* ------------------------------- Splashes ------------------------------ */
function buildSplashes(world) {
  const N = 900;
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1); base.rotateX(-Math.PI / 2);
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const s = new Float32Array(N * 4); const r = new RNG(5);
  for (let i = 0; i < N; i++) s.set([r.next(), r.next(), r.next(), r.next()], i * 4);
  geo.setAttribute('aS', new THREE.InstancedBufferAttribute(s, 4));
  geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCam: { value: new THREE.Vector3() }, uAmt: { value: 1 } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aS; uniform float uTime; uniform vec3 uCam; uniform float uAmt; varying vec2 vUv; varying float vPh; varying float vOn;
      void main(){
        float rate = 1.6 + aS.w;
        float cyc = uTime * rate + aS.z * 10.0;
        float ph = fract(cyc); float id = floor(cyc);
        vec2 rnd = fract(sin(vec2(id * 12.9898 + aS.x * 78.233, id * 39.346 + aS.y * 11.135)) * 43758.5453);
        vec2 xz = uCam.xz + (rnd - 0.5) * 36.0;
        float ax = abs(xz.x);
        float y = (ax > 5.15 && ax < 7.5) ? 0.19 : 0.012;
        if (ax > 7.5 && !(xz.y > 4.0 && xz.y < 9.0)) y = -10.0;   // inside buildings → hidden
        if (xz.y > 4.0 && xz.y < 9.0 && xz.x > 7.5) y = 0.11;
        float sz = 0.06 + ph * 0.22;
        vec3 p = vec3(xz.x, y, xz.y) + position * sz;
        vUv = uv; vPh = ph; vOn = step(aS.x, uAmt);
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      varying vec2 vUv; varying float vPh; varying float vOn;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.12, 0.0, abs(d - 0.75)) * (1.0 - vPh);
        float crown = smoothstep(0.35, 0.0, d) * smoothstep(0.25, 0.0, vPh) * 1.5;
        gl_FragColor = vec4(vec3(0.55, 0.6, 0.75) * (ring + crown) * 0.5 * vOn, 1.0);
        #include <fog_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  mat.uniforms.uTime = U.time;
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.layers.set(1);
  world.scene.add(m);
  world.updaters.push(() => { mat.uniforms.uCam.value.copy(world.camera.position); mat.uniforms.uAmt.value = U.rain.value; });
  return m;
}

/* --------------------------------- Steam ------------------------------- */
function buildSteam(world) {
  const srcs = world.steamSources;
  // manhole + grate vents in the street
  srcs.push({ p: new THREE.Vector3(-2.2, 0.03, 4), rate: 2.4, size: 1.6, rise: 0.7, color: 0xdcd6f0, spread: 0.3, life: 6, max: 6 });
  srcs.push({ p: new THREE.Vector3(2.6, 0.03, -9), rate: 2.0, size: 1.5, rise: 0.6, color: 0xdcd6f0, spread: 0.3, life: 6, max: 6 });
  srcs.push({ p: new THREE.Vector3(-6.4, 0.2, -27.5), rate: 1.4, size: 1.0, rise: 0.5, color: 0xd0e0ff, spread: 0.2, life: 5, max: 4 });
  const per = srcs.map((s) => Math.ceil(s.rate * s.life) + 2);
  const N = per.reduce((a, b) => a + b, 0);
  const pos = new Float32Array(N * 3), data = new Float32Array(N * 4), col = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aD', new THREE.BufferAttribute(data, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aC', new THREE.BufferAttribute(col, 3));
  const parts = [];
  let k = 0;
  const r = new RNG(3);
  srcs.forEach((s, si) => {
    const c = new THREE.Color(s.color);
    for (let i = 0; i < per[si]; i++) {
      parts.push({ s, age: -i / s.rate, life: s.life * r.range(0.8, 1.2), off: new THREE.Vector3(), vel: new THREE.Vector3(), rot: r.range(0, 6.28), k });
      col.set([c.r, c.g, c.b], k * 3);
      k++;
    }
  });
  const tex = puffSprite(128, 21);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tPuff: { value: tex }, uScale: { value: 820 } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aD; attribute vec3 aC; uniform float uScale; varying float vA; varying float vRot; varying vec3 vC;
      void main(){
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = aD.x * uScale / max(0.5, -mvPosition.z);
        vA = aD.y; vRot = aD.z; vC = aC;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D tPuff; varying float vA; varying float vRot; varying vec3 vC;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float s = sin(vRot), co = cos(vRot);
        vec2 uv = vec2(co * c.x - s * c.y, s * c.x + co * c.y) + 0.5;
        float a = texture2D(tPuff, uv).a * vA;
        gl_FragColor = vec4(vC * 0.62, a * 0.72);
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  world.scene.add(pts);
  let lastT = null;
  world.updaters.push((t, dt) => {
    if (lastT === null) {
      // pre-warm so plumes are already established at first frame
      for (const p of parts) p.age = (p.age % p.life + p.life) % p.life;
    }
    lastT = t;
    const step = Math.min(dt || 0.016, 0.05);
    for (const p of parts) {
      p.age += step;
      const s = p.s;
      if (p.age > p.life) {
        p.age -= p.life;
        p.off.set((Math.random() - 0.5) * s.spread, 0, (Math.random() - 0.5) * s.spread);
        p.vel.set((Math.random() - 0.5) * 0.15, s.rise * (0.8 + Math.random() * 0.4), (Math.random() - 0.5) * 0.15);
        if (s.drift) p.vel.add(s.drift);
      }
      const a = Math.max(0, p.age);
      const k = a / p.life;
      const x = s.p.x + p.off.x + p.vel.x * a + Math.sin(a * 0.9 + p.rot) * 0.12 * a + 0.25 * a * a * 0.05;
      const y = s.p.y + p.vel.y * a + 0.04 * a * a;
      const z = s.p.z + p.off.z + p.vel.z * a + Math.cos(a * 0.7 + p.rot) * 0.1 * a;
      pos[p.k * 3] = x; pos[p.k * 3 + 1] = y; pos[p.k * 3 + 2] = z;
      const alpha = p.age < 0 ? 0 : Math.sin(Math.PI * Math.min(1, k)) * Math.min(1, s.max / 4) * (1 - k * 0.5);
      data[p.k * 4] = s.size * (0.35 + k * 1.6); data[p.k * 4 + 1] = alpha; data[p.k * 4 + 2] = p.rot + a * 0.3;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aD.needsUpdate = true;
  });
  return pts;
}

/* --------------------------- Volumetric cones -------------------------- */
function coneMaterial(color, strength = 1) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uColor: { value: new THREE.Color(color) }, uS: { value: strength } },
    vertexShader: /* glsl */`varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uColor; uniform float uS; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float along = vUv.y;
        float fade = smoothstep(0.0, 0.25, along) * pow(along, 0.6);
        float n = 0.65 + 0.7 * fbm(vec2(vW.x * 0.6 + vW.z * 0.6, vW.y * 0.8 + uTime * 0.7));
        float streak = 0.85 + 0.3 * vnoise(vec2(atan(vN.z, vN.x) * 8.0, vW.y * 2.0 - uTime * 6.0));
        gl_FragColor = vec4(uColor * f * fade * n * streak * 0.085 * uS, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  m.userData.noShadow = true;
  return m;
}

function buildCones(world) {
  const g = new THREE.Group(); g.name = 'volumetrics'; world.scene.add(g);
  for (const p of world.lampHeads || []) {
    const h = p.y - 0.05;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 3.3, h, 32, 1, true), coneMaterial(0xcfe4ff, 1.0));
    cone.position.set(p.x, h / 2, p.z);
    g.add(cone);
  }
  // shafts out of the ramen door + konbini window (box volumes)
  const shaft = (x, y, z, w, h, d, color, s) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.72, h, 4, 1, true), coneMaterial(color, s));
    m.position.set(x, y, z); m.rotation.y = Math.PI / 4; m.scale.set(1, 1, d / w);
    g.add(m);
  };
  shaft(6.8, 1.6, -2.4, 3.0, 3.2, 3.0, 0xffa050, 0.9);
  shaft(-6.8, 1.8, -8.0, 3.0, 3.4, 11.0, 0xdff0ff, 0.6);
  // haze in front of the LED screen
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), new THREE.ShaderMaterial({
    uniforms: { uTime: U.time },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vW; ${GLSL_NOISE}
      void main(){ vec2 c = vUv - 0.5; float a = smoothstep(0.5, 0.0, length(c * vec2(1.0, 1.2)));
        float cyc = uTime / 9.0; float k = mod(floor(cyc), 3.0);
        vec3 col = k < 0.5 ? vec3(0.8, 0.25, 0.9) : (k < 1.5 ? vec3(1.0, 0.5, 0.15) : vec3(0.3, 0.7, 0.8));
        float n = fbm(vUv * 3.0 + vec2(uTime * 0.05, uTime * 0.02));
        gl_FragColor = vec4(col * a * (0.4 + n * 0.6) * 0.12, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  haze.position.set(-4.0, 21, -17); haze.rotation.y = Math.PI / 2;
  g.add(haze);
  g.traverse((o) => { o.layers.set(1); });
}

/* -------------------------------- Drones ------------------------------- */
function buildDrones(world) {
  const mk = (accent) => {
    const g = new THREE.Group();
    const B = new Batch('drone');
    B.add(new THREE.BoxGeometry(0.34, 0.1, 0.34), M.metalBlack);
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      B.rod(M.metalDark, 0.015, new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0.03, z));
      B.add(new THREE.TorusGeometry(0.14, 0.012, 6, 20), M.metalDark, T(x, 0.05, z, Math.PI / 2, 0, 0));
      B.add(new THREE.CircleGeometry(0.13, 16), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }), T(x, 0.06, z, -Math.PI / 2, 0, 0));
    }
    B.add(new THREE.SphereGeometry(0.06, 10, 8), M.glass, T(0, -0.06, 0.12));
    B.build(g);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), glow(0xff2020, 14)); red.position.set(-0.3, 0.02, -0.3); g.add(red);
    const grn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), glow(0x20ff60, 14)); grn.position.set(0.3, 0.02, -0.3); g.add(grn);
    const acc = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.02), glow(accent, 8)); acc.position.set(0, 0.0, 0.18); g.add(acc);
    g.userData.blink = [red, grn];
    world.scene.add(g);
    return g;
  };
  const drones = [
    { g: mk(0x3af2ff), path: (t) => new THREE.Vector3(Math.sin(t * 0.21) * 3.5, 15 + Math.sin(t * 0.5) * 2, -12 + Math.cos(t * 0.21) * 14) },
    { g: mk(0xff2a8a), path: (t) => new THREE.Vector3(-2 + Math.sin(t * 0.33 + 2) * 2.5, 24 + Math.cos(t * 0.4) * 1.5, -20 + Math.sin(t * 0.17) * 20) },
    { g: mk(0xffb000), path: (t) => new THREE.Vector3(14 + Math.cos(t * 0.27) * 6, 42 + Math.sin(t * 0.6) * 1.0, -4 + Math.sin(t * 0.27) * 7) },
  ];
  // police drone with a searchlight sweeping the street
  const pol = mk(0x3060ff);
  const beamMat = coneMaterial(0xdfe8ff, 2.2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 2.4, 14, 24, 1, true), beamMat);
  beam.position.y = -7; pol.add(beam);
  const spot = new THREE.SpotLight(0xe8f0ff, 60, 30, 0.17, 0.5, 1.2); spot.position.set(0, 0, 0); spot.target.position.set(0, -14, 0);
  pol.add(spot, spot.target);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.06), glow(0xff1020, 10)); red.position.set(0, 0.07, 0); pol.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.06), glow(0x2050ff, 10)); blue.position.set(0, 0.07, 0.08); pol.add(blue);
  const tmp = new THREE.Vector3();
  world.updaters.push((t) => {
    for (const d of drones) {
      const p = d.path(t); const q = d.path(t + 0.1);
      d.g.position.copy(p);
      d.g.lookAt(tmp.copy(q).setY(p.y));
      d.g.rotateX(0.12);
      d.g.userData.blink[0].visible = (t % 1) < 0.15; d.g.userData.blink[1].visible = ((t + 0.5) % 1) < 0.15;
    }
    const z = -6 + Math.sin(t * 0.09) * 24;
    pol.position.set(Math.sin(t * 0.23) * 2.0, 17 + Math.sin(t * 0.4) * 0.6, z);
    pol.rotation.set(Math.sin(t * 0.6) * 0.32, 0, Math.cos(t * 0.47) * 0.28);
    const on = Math.sin(t * 10) > 0;
    red.visible = on; blue.visible = !on;
  });
}
