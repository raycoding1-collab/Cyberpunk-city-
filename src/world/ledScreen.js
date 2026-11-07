import * as THREE from 'three';
import { U, T, Batch, GLSL_NOISE } from '../core/utils.js';
import { M, glow } from '../core/materials.js';
import { drawCanvas } from '../core/textures.js';
import { JP, JPM, LAT } from './signs.js';

/* =================================================================== */
/*  Curved LED megascreen. Three procedural "ads" rotate with a        */
/*  datamosh glitch between them; the LED sub-pixel lattice resolves  */
/*  when you get close. A RectAreaLight follows the screen's average   */
/*  colour so the wet street and the tower opposite glow in sync.      */
/* =================================================================== */

function adAtlas() {
  // 3 vertical panels of 1024×820 text/graphics layered over procedural backgrounds
  return drawCanvas(1024, 2460, (x) => {
    x.clearRect(0, 0, 1024, 2460);
    // ---- AD 0: NEURAL//DRIFT
    let o = 0;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ffffff'; x.font = `900 118px ${LAT}`;
    x.shadowColor = '#ff2fd0'; x.shadowBlur = 30;
    x.fillText('NEURAL', 512, o + 300); x.fillText('//DRIFT', 512, o + 430);
    x.shadowBlur = 0;
    x.font = `bold 54px ${JP}`; x.fillStyle = '#ffe6fb'; x.fillText('夢を見る準備はいいか？', 512, o + 560);
    x.font = `600 30px ${LAT}`; x.fillStyle = '#bff8ff'; x.fillText('HOSHINO NEUROTECH  ·  SLEEP IS A FEATURE', 512, o + 640);
    x.fillStyle = '#ffffff'; x.fillRect(312, o + 690, 400, 4);
    x.font = `bold 36px ${LAT}`; x.fillText('¥ 19,800 / MONTH', 512, o + 740);
    // ---- AD 1: 鯉 SYNTH SAKE (vertical calligraphy)
    o = 820;
    x.font = `bold 210px ${JPM}`; x.fillStyle = '#fff5dc'; x.shadowColor = '#ffb000'; x.shadowBlur = 22;
    x.fillText('合', 230, o + 200); x.fillText('成', 230, o + 420); x.fillText('酒', 230, o + 640);
    x.shadowBlur = 0;
    x.font = `900 92px ${LAT}`; x.fillStyle = '#ffd36a'; x.fillText('KOI', 700, o + 250);
    x.font = `300 64px ${LAT}`; x.fillStyle = '#ffffff'; x.fillText('SYNTH-SAKE', 700, o + 340);
    // bottle silhouette
    x.fillStyle = 'rgba(255,240,210,0.95)';
    x.beginPath(); x.moveTo(660, o + 420); x.lineTo(740, o + 420); x.lineTo(740, o + 470); x.bezierCurveTo(800, o + 500, 810, o + 540, 810, o + 600);
    x.lineTo(810, o + 780); x.lineTo(590, o + 780); x.lineTo(590, o + 600); x.bezierCurveTo(590, o + 540, 600, o + 500, 660, o + 470); x.closePath(); x.fill();
    x.fillStyle = '#b00012'; x.fillRect(605, o + 600, 190, 110);
    x.fillStyle = '#fff'; x.font = `bold 70px ${JPM}`; x.fillText('鯉', 700, o + 657);
    x.font = `600 26px ${LAT}`; x.fillStyle = '#ffd36a'; x.fillText('DISTILLED FROM PURE DATA · 15%', 512, o + 805);
    // ---- AD 2: CITY ADVISORY
    o = 1640;
    x.fillStyle = '#ff2b3d'; x.fillRect(0, o + 40, 1024, 120);
    x.fillStyle = '#fff'; x.font = `900 76px ${LAT}`; x.fillText('ACID RAIN ADVISORY', 512, o + 102);
    x.font = `bold 48px ${JP}`; x.fillStyle = '#ffffff'; x.fillText('酸性雨注意報 — 七区', 512, o + 230);
    x.font = `700 40px ${LAT}`; x.fillStyle = '#9ffcff';
    x.fillText('pH 4.2   ·   11.4 mm/h   ·   WIND NE 6 m/s', 512, o + 310);
    x.textAlign = 'left'; x.font = `600 34px ${LAT}`; x.fillStyle = '#ffffff';
    ['02:00  CELL 7  ▮▮▮▮▮▮▯▯', '03:00  CELL 7  ▮▮▮▮▮▮▮▯', '04:00  CELL 7  ▮▮▮▮▯▯▯▯'].forEach((s, i) => x.fillText(s, 120, o + 420 + i * 60));
    x.textAlign = 'center'; x.font = `900 60px ${LAT}`; x.fillStyle = '#ffd400';
    x.fillText('STAY UNDER COVER', 512, o + 720);
  }, { srgb: true, mips: true });
}

export function buildLedScreen(world, root, { cx = -7.5, zc = -17, y0 = 13, h = 16, chord = 20, bulge = 1.5 } = {}) {
  const R = (chord * chord / 4 + bulge * bulge) / (2 * bulge);
  const half = Math.asin(chord / 2 / R);
  const centerX = cx + bulge - R;
  const atlas = adAtlas();
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tAtlas: { value: atlas }, uRes: { value: new THREE.Vector2(chord * 16, h * 16) }, uBright: { value: 0.8 } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vWP;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D tAtlas; uniform float uTime; uniform vec2 uRes; uniform float uBright;
      varying vec2 vUv; varying vec3 vWP;
      ${GLSL_NOISE}
      vec3 ad0(vec2 uv, float t){
        vec2 p = uv * vec2(2.4, 2.0);
        float n = fbm(p * 1.3 + vec2(t * 0.15, -t * 0.1)); float m = fbm(p * 2.0 + n * 2.5 - t * 0.2);
        vec3 c = mix(vec3(0.05, 0.0, 0.25), vec3(1.0, 0.15, 0.7), smoothstep(0.3, 0.75, m));
        c = mix(c, vec3(0.1, 0.9, 1.0), smoothstep(0.62, 0.9, n) * 0.8);
        // chrome ring
        vec2 q = (uv - vec2(0.5, 0.55)) * vec2(2.0, 1.6);
        float r = length(q); float a = atan(q.y, q.x) + t * 0.6;
        float ring = smoothstep(0.03, 0.0, abs(r - 0.55 - 0.03 * sin(a * 6.0 + t * 2.0)));
        c += vec3(0.9, 0.95, 1.0) * ring * (0.6 + 0.4 * sin(a * 3.0));
        return c * 0.75;
      }
      vec3 ad1(vec2 uv, float t){
        vec3 c = mix(vec3(0.12, 0.01, 0.0), vec3(0.55, 0.08, 0.02), uv.y);
        float rays = pow(max(0.0, sin(atan(uv.y - 0.6, uv.x - 0.68) * 18.0 + t * 0.4)), 8.0) * 0.25;
        c += vec3(1.0, 0.6, 0.2) * rays;
        // gold particles drifting up
        vec2 g = vec2(uv.x * 40.0, uv.y * 24.0 - t * 1.4);
        vec2 id = floor(g); vec2 f = fract(g) - 0.5;
        float s = step(0.86, hash12(id)) * smoothstep(0.25, 0.0, length(f));
        c += vec3(1.0, 0.8, 0.35) * s * 1.4;
        return c;
      }
      vec3 ad2(vec2 uv, float t){
        vec3 c = vec3(0.0, 0.04, 0.06);
        // radar sweep over a map grid
        vec2 q = (uv - vec2(0.78, 0.38)) * vec2(2.4, 2.0);
        float r = length(q); float a = atan(q.y, q.x);
        float sweep = smoothstep(0.0, 1.0, fract((a + t * 1.5) / 6.2831)) * step(r, 0.42);
        c += vec3(0.0, 0.9, 0.6) * pow(sweep, 6.0) * 0.8;
        c += vec3(0.0, 0.5, 0.4) * step(0.97, fract(r * 14.0)) * step(r, 0.42);
        float cells = smoothstep(0.55, 0.75, fbm(uv * 6.0 + vec2(t * 0.05, 0.0))) * step(r, 0.42);
        c += vec3(1.0, 0.25, 0.2) * cells * 0.6;
        c += vec3(0.0, 0.25, 0.3) * (step(0.985, fract(uv.x * 30.0)) + step(0.985, fract(uv.y * 20.0))) * 0.4;
        return c;
      }
      vec3 adCol(int k, vec2 uv, float t){
        vec3 bg = k == 0 ? ad0(uv, t) : (k == 1 ? ad1(uv, t) : ad2(uv, t));
        vec2 auv = vec2(uv.x, (float(2 - k) + uv.y) / 3.0);
        vec4 tx = texture2D(tAtlas, auv);
        return mix(bg, tx.rgb * 1.25, tx.a);
      }
      void main(){
        vec2 uv = vUv;
        float T = uTime;
        float cyc = T / 9.0;
        int k = int(mod(floor(cyc), 3.0));
        int kn = int(mod(floor(cyc) + 1.0, 3.0));
        float ph = fract(cyc);
        float tr = smoothstep(0.93, 1.0, ph);
        // datamosh glitch near the cut
        float g = step(0.9, ph) * step(0.6, hash12(vec2(floor(uv.y * 40.0), floor(T * 20.0))));
        vec2 guv = uv + vec2((hash12(vec2(floor(uv.y * 40.0), floor(T * 30.0))) - 0.5) * 0.08 * g, 0.0);
        vec3 c = mix(adCol(k, guv, T), adCol(kn, guv, T), tr);
        c.r = mix(c.r, adCol(k, guv + vec2(0.006 * g, 0.0), T).r, g);
        // LED lattice: RGB sub-pixels resolve up close, blur away with distance
        vec2 px = uv * uRes;
        vec2 cell = fract(px);
        float dist = length(cameraPosition - vWP);
        float sub = fract(px.x * 3.0);
        vec3 mask = vec3(step(sub, 0.333), step(0.333, sub) * step(sub, 0.666), step(0.666, sub));
        float dotm = smoothstep(0.5, 0.3, length(cell - 0.5));
        float near = 1.0 - smoothstep(6.0, 30.0, dist);
        c *= mix(vec3(1.0), mask * 2.6 * dotm, near * 0.85);
        // scanline + module seams (each panel 1 m)
        c *= 0.92 + 0.08 * sin(px.y * 3.14159);
        vec2 mod1 = fract(uv * vec2(${chord.toFixed(1)}, ${h.toFixed(1)}));
        c *= 0.85 + 0.15 * step(0.015, min(mod1.x, mod1.y));
        // a dead module + bad column for character
        c *= 1.0 - 0.9 * step(abs(floor(uv.x * ${chord.toFixed(1)}) - 13.0), 0.1) * step(abs(floor(uv.y * ${h.toFixed(1)}) - 4.0), 0.1);
        c.g *= 1.0 - 0.6 * step(abs(px.x - 211.0), 0.5);
        gl_FragColor = vec4(c * uBright, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  mat.uniforms.uTime = U.time;
  mat.userData.noShadow = true;
  const geo = new THREE.CylinderGeometry(R, R, h, 64, 1, true, Math.PI / 2 - half, half * 2);
  const screen = new THREE.Mesh(geo, mat);
  screen.position.set(centerX, y0 + h / 2, zc);
  root.add(screen);

  // structure: curved top/bottom trusses, side caps, catwalk + floodlights
  const B = new Batch('screen-frame');
  const segs = 24;
  for (let i = 0; i <= segs; i++) {
    const a = Math.PI / 2 - half + (i / segs) * half * 2;
    const x = centerX + Math.sin(a) * (R - 0.25), z = zc + Math.cos(a) * (R - 0.25);
    for (const y of [y0 - 0.25, y0 + h + 0.25]) B.add(new THREE.BoxGeometry(0.5, 0.5, chord / segs + 0.05), M.metalDark, T(x, y, z, 0, a - Math.PI / 2, 0));
    if (i % 3 === 0) B.add(new THREE.BoxGeometry(0.12, h, 0.12), M.metalDark, T(x - 0.3, y0 + h / 2, z));
    if (i % 4 === 0) {
      // floodlight on the bottom truss aimed up
      B.add(new THREE.BoxGeometry(0.25, 0.2, 0.35), M.metalBlack, T(x + 0.2, y0 - 0.65, z));
      B.add(new THREE.BoxGeometry(0.02, 0.16, 0.28), glow(0xe8f4ff, 4), T(x + 0.33, y0 - 0.65, z));
    }
  }
  // catwalk below the screen
  for (let i = 0; i < segs; i++) {
    const a = Math.PI / 2 - half + ((i + 0.5) / segs) * half * 2;
    const x = centerX + Math.sin(a) * (R + 0.15), z = zc + Math.cos(a) * (R + 0.15);
    B.add(new THREE.BoxGeometry(0.9, 0.04, chord / segs + 0.02), M.galv, T(x - 0.4, y0 - 0.55, z));
    B.add(new THREE.BoxGeometry(0.03, 1.0, chord / segs), M.galv, T(x + 0.05, y0 - 0.05, z));
  }
  B.build(root);

  // area light following the content
  const rect = new THREE.RectAreaLight(0xff40c0, 3.2, chord, h);
  rect.position.set(cx + bulge + 0.3, y0 + h / 2, zc);
  rect.lookAt(cx + bulge + 10, y0 + h / 2, zc);
  root.add(rect);
  const palette = [new THREE.Color(0.75, 0.25, 0.85), new THREE.Color(0.9, 0.45, 0.12), new THREE.Color(0.35, 0.55, 0.6)];
  const tmp = new THREE.Color();
  world.updaters.push((t) => {
    const cyc = t / 9, k = Math.floor(cyc) % 3, kn = (k + 1) % 3, ph = cyc % 1;
    const tr = THREE.MathUtils.smoothstep(ph, 0.93, 1.0);
    tmp.copy(palette[k]).lerp(palette[kn], tr);
    if (k === 0) tmp.lerp(new THREE.Color(0.25, 0.6, 0.95), 0.5 + 0.5 * Math.sin(t * 0.3));
    rect.color.copy(tmp);
    rect.intensity = 3.2 * (ph > 0.9 && Math.sin(t * 60) > 0 ? 0.6 : 1);
  });
  return { screen, rect };
}
