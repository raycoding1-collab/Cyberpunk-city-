import * as THREE from 'three';
import { GLSL_NOISE, U } from '../core/utils.js';

/* =================================================================== */
/*  Night sky: sodium/magenta light-pollution dome over the city,      */
/*  low rain clouds lit from beneath, drifting slowly; two sweeping    */
/*  searchlights from the corporate district.                          */
/* =================================================================== */
export function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: U.time },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec3 vDir;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 zenith = vec3(0.004, 0.005, 0.016);
        vec3 mid = vec3(0.03, 0.018, 0.06);
        vec3 horizon = vec3(0.22, 0.07, 0.17);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, zenith, smoothstep(0.15, 0.7, h));
        // warmer glow toward the dense downtown (north, -z)
        float north = pow(max(0.0, -d.z), 3.0);
        col += vec3(0.25, 0.08, 0.05) * north * (1.0 - smoothstep(0.0, 0.25, h)) * 0.6;
        // low cloud deck, lit from below by the city
        vec2 cp = d.xz / max(0.08, d.y + 0.12) * 1.4;
        cp += vec2(uTime * 0.012, uTime * 0.004);
        float c = fbm(cp * 0.6) * 0.65 + fbm(cp * 2.1 + 4.0) * 0.35;
        float cloud = smoothstep(0.38, 0.85, c) * smoothstep(-0.02, 0.12, h);
        vec3 cloudCol = mix(vec3(0.16, 0.05, 0.14), vec3(0.03, 0.025, 0.06), smoothstep(0.05, 0.5, h));
        col = mix(col, cloudCol * (0.6 + c * 0.8), cloud * 0.85);
        // searchlights
        for (int i = 0; i < 2; i++){
          float fi = float(i);
          float a = uTime * (0.11 + fi * 0.04) + fi * 2.4;
          vec3 bd = normalize(vec3(sin(a) * 0.45, 1.0, -0.6 + cos(a * 0.7) * 0.25 + fi * 0.4));
          float beam = pow(max(0.0, dot(d, bd)), 900.0) + pow(max(0.0, dot(d, bd)), 60.0) * 0.08;
          col += vec3(0.5, 0.65, 1.0) * beam * 0.35 * smoothstep(0.02, 0.2, h);
        }
        // sparse stars through cloud gaps
        vec2 sp = d.xz / max(d.y + 1.0, 0.05) * 420.0;
        vec2 sc = floor(sp);
        float star = step(0.9975, hash12(sc)) * smoothstep(0.32, 0.0, length(fract(sp) - 0.5)) * (1.0 - cloud) * smoothstep(0.3, 0.8, h);
        col += star * vec3(0.6, 0.65, 0.8);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  sky.name = 'sky';
  scene.add(sky);
  return sky;
}
