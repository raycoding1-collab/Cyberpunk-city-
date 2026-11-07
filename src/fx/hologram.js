import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, T, GLSL_NOISE, Batch } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';

/* =================================================================== */
/*  Rooftop koi hologram: two koi (kōhaku + asagi) chase each other    */
/*  in a yin-yang orbit above an emitter. Volumetric light column,     */
/*  rotating glyph rings, scan-line fresnel shader, data sparkles.     */
/* =================================================================== */

function koiGeometry() {
  // body: lathe around +X (head at x=0, tail at x=1), length 1
  const prof = [];
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = 0.17 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.55) * 1.02)), 0.85) + (t > 0.85 ? 0.012 : 0.0);
    prof.push(new THREE.Vector2(Math.max(0.004, r), t));
  }
  const body = new THREE.LatheGeometry(prof, 24);
  body.rotateZ(-Math.PI / 2);          // axis Y → X
  body.scale(1, 0.85, 1.0);
  // tail fin (fan), dorsal fin, pectorals, whiskers
  const tail = new THREE.Shape();
  tail.moveTo(0, 0); tail.bezierCurveTo(0.12, 0.08, 0.26, 0.2, 0.34, 0.24); tail.quadraticCurveTo(0.24, 0.02, 0.33, -0.22);
  tail.bezierCurveTo(0.24, -0.18, 0.12, -0.07, 0, 0);
  const tg = new THREE.ShapeGeometry(tail, 10); tg.translate(0.96, 0, 0);
  const tail2 = tg.clone(); tail2.rotateX(Math.PI / 2);
  const dorsal = new THREE.Shape();
  dorsal.moveTo(0, 0); dorsal.quadraticCurveTo(0.12, 0.11, 0.38, 0.06); dorsal.lineTo(0.42, 0); dorsal.lineTo(0, 0);
  const dg = new THREE.ShapeGeometry(dorsal, 8); dg.translate(0.3, 0.12, 0);
  const pec = new THREE.Shape();
  pec.moveTo(0, 0); pec.quadraticCurveTo(0.06, -0.14, 0.16, -0.12); pec.quadraticCurveTo(0.1, -0.04, 0, 0);
  const pg1 = new THREE.ShapeGeometry(pec, 6); pg1.rotateX(Math.PI / 2 + 0.6); pg1.translate(0.2, -0.06, 0.09);
  const pg2 = new THREE.ShapeGeometry(pec, 6); pg2.rotateX(-Math.PI / 2 - 0.6); pg2.translate(0.2, -0.06, -0.09);
  const parts = [body, tg, tail2, dg, pg1, pg2].map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); if (!n.attributes.normal) n.computeVertexNormals(); return n; });
  const geo = mergeGeometries(parts);
  // along-body coordinate for the swim wave
  const pos = geo.attributes.position;
  const along = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) along[i] = Math.min(1.3, Math.max(0, pos.getX(i)));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  return geo;
}

function holoMaterial(colA, colB) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color(colB) }, uPhase: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aAlong; uniform float uTime; uniform float uPhase;
      varying vec3 vN; varying vec3 vV; varying float vAlong; varying vec3 vW; varying vec3 vL;
      void main(){
        vec3 p = position;
        float w = sin(aAlong * 6.0 - uTime * 6.5 + uPhase) * 0.09 * pow(aAlong, 1.6);
        p.z += w;
        vAlong = aAlong; vL = position;
        vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uPhase;
      varying vec3 vN; varying vec3 vV; varying float vAlong; varying vec3 vW; varying vec3 vL;
      ${GLSL_NOISE}
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 1.6);
        // kōhaku patches: koi pattern from noise on body coords
        float pat = smoothstep(0.45, 0.55, vnoise(vL.xz * vec2(9.0, 14.0) + uPhase * 3.0) * 0.7 + vnoise(vL.xy * 6.0) * 0.4);
        vec3 col = mix(uA, uB, pat);
        float scan = 0.65 + 0.35 * sin(vW.y * 90.0 - uTime * 14.0);
        float band = smoothstep(0.98, 1.0, sin(vW.y * 3.0 - uTime * 2.3)) * 1.5;
        float flick = 0.88 + 0.12 * step(0.5, vnoise(vec2(uTime * 22.0, uPhase)));
        float scale = 0.6 + 0.4 * smoothstep(0.0, 0.3, 1.0 - abs(fract(vAlong * 8.0) - 0.5) * 2.0);
        vec3 c = col * (0.25 + rim * 2.6) * scan * flick * scale + col * band;
        gl_FragColor = vec4(c * 1.1, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  m.userData.noShadow = true;
  return m;
}

export function buildKoiHologram(world, root, base) {
  const g = new THREE.Group();
  g.position.copy(base);
  root.add(g);
  const B = new Batch('holo-emitter');
  // emitter pedestal: stepped drum, cooling fins, cyan ring
  B.add(new THREE.CylinderGeometry(1.35, 1.5, 0.35, 40), M.metalDark, T(0, 0.175, 0));
  B.add(new THREE.CylinderGeometry(1.05, 1.2, 0.3, 40), M.metalBlack, T(0, 0.5, 0));
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; B.add(new THREE.BoxGeometry(0.03, 0.3, 0.25), M.steel, T(Math.cos(a) * 1.37, 0.18, Math.sin(a) * 1.37, 0, -a, 0)); }
  B.add(new THREE.TorusGeometry(0.95, 0.03, 8, 64), glow(0x30f6ff, 9), T(0, 0.66, 0, Math.PI / 2, 0, 0));
  B.add(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 24), M.chrome, T(0, 0.75, 0));
  B.add(new THREE.SphereGeometry(0.2, 20, 12), glow(0xb8fbff, 10), T(0, 0.9, 0));
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; B.rod(M.galv, 0.03, new THREE.Vector3(Math.cos(a) * 1.3, 0.35, Math.sin(a) * 1.3), new THREE.Vector3(Math.cos(a) * 0.5, 1.2, Math.sin(a) * 0.5)); }
  B.build(g);

  // volumetric column (camera-facing falloff, scrolling noise)
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uColor: { value: new THREE.Color(0x3af2ff) } },
    vertexShader: /* glsl */`varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      ${GLSL_NOISE}
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float core = pow(f, 3.0);
        float n = fbm(vec2(vUv.x * 6.0, vUv.y * 3.0 - uTime * 0.6));
        float fade = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        gl_FragColor = vec4(uColor * core * fade * (0.2 + n * 0.5) * 0.45, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 0.5, 8.5, 48, 1, true), beamMat);
  beam.position.y = 0.9 + 4.25;
  g.add(beam);

  // glyph rings
  const ringTex = drawCanvas(2048, 128, (x) => {
    x.clearRect(0, 0, 2048, 128);
    x.fillStyle = '#fff'; x.font = 'bold 64px "IPAGothic", "Noto Sans CJK JP", sans-serif'; x.textBaseline = 'middle';
    const s = '鯉亭 ・ 恋 ・ 鯉 ・ 滝登り ・ KOI-TEI ・ 夜明け前 ・ 0x7F3A ・ 鯉 ・ 縁 ・ ';
    x.fillText(s + s, 0, 64);
    x.fillRect(0, 4, 2048, 3); x.fillRect(0, 121, 2048, 3);
  }, { srgb: false });
  ringTex.wrapS = THREE.RepeatWrapping;
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), map: ringTex, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const r1 = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.32, 96, 1, true), ringMat(0x3af2ff, 0.9));
  r1.position.y = 4.0; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.22, 96, 1, true), ringMat(0xff6a3d, 0.7));
  r2.position.y = 8.8; g.add(r2);

  // the two koi
  const geo = koiGeometry();
  const fishes = [
    { m: holoMaterial(0xff4a12, 0xd8b8a4), phase: 0 },
    { m: holoMaterial(0x2fd8ff, 0x0a2a8a), phase: Math.PI },
  ].map(({ m, phase }) => {
    m.uniforms.uPhase.value = phase;
    const mesh = new THREE.Mesh(geo, m);
    mesh.scale.setScalar(3.6);
    g.add(mesh);
    return { mesh, phase };
  });

  // data sparkles
  const N = 260;
  const sp = new Float32Array(N * 3), sd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 4.2;
    sp.set([Math.cos(a) * r, 1 + Math.random() * 9, Math.sin(a) * r], i * 3); sd[i] = Math.random();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const pm = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time },
    vertexShader: /* glsl */`attribute float aSeed; uniform float uTime; varying float vA;
      void main(){ vec3 p = position; float a = uTime * (0.2 + aSeed * 0.3); p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz; p.y += mod(uTime * (0.3 + aSeed), 9.0) - 4.0 * aSeed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (1.0 + aSeed * 2.0) * 14.0 / -mv.z * 6.0; vA = 0.5 + 0.5 * sin(uTime * 6.0 + aSeed * 40.0); }`,
    fragmentShader: /* glsl */`varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.5, 0.95, 1.0) * 1.3 * vA * pow(1.0 - d * 2.0, 2.0), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(pg, pm);
  g.add(pts);

  const light = new THREE.PointLight(0x3af2ff, 9, 18, 1.6);
  light.position.set(0, 4, 0);
  g.add(light);

  const _p = new THREE.Vector3();
  world.updaters.push((t) => {
    r1.rotation.y = t * 0.25; r2.rotation.y = -t * 0.15;
    ringTex.offset.x = t * 0.02;
    fishes.forEach(({ mesh, phase }, i) => {
      const a = t * 0.42 + phase;
      const R = 3.3 + Math.sin(t * 0.3 + phase) * 0.5;
      const y = 6.4 + Math.sin(t * 0.55 + phase) * 1.4;
      mesh.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
      // swim tangentially (head first): fish local +X points to tail, so face -velocity
      const ahead = a + 0.2;
      _p.set(Math.cos(ahead) * R, y + Math.cos(t * 0.55 + phase) * 0.15, Math.sin(ahead) * R);
      mesh.lookAt(_p.add(g.position));
      mesh.rotateY(Math.PI / 2);
      mesh.rotateX(Math.sin(t * 0.8 + i) * 0.25);
    });
    light.intensity = 9 + Math.sin(t * 9) * 0.5;
  });
  return g;
}
