import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { U } from '../core/utils.js';
import { REFLECT } from '../world/ground.js';

/* =================================================================== */
/*  Lens & film: HDR bloom, anamorphic streaks (horizontal flares on   */
/*  every hot light), chromatic fringing, split-tone grade, vignette,  */
/*  ACES tonemap, and fine animated grain after display transform.     */
/* =================================================================== */

const VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

class AnamorphicPass extends Pass {
  constructor(w, h, { strength = 0.35, threshold = 1.6, tint = new THREE.Color(0.35, 0.55, 1.0) } = {}) {
    super();
    this.strength = strength;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
    this.bright = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: threshold } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform float uThreshold; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(max(c.r,c.g),c.b);
          gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold * 2.5, l) , 1.0); }`,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uStep: { value: 1 }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform float uStep; uniform vec2 uTexel; varying vec2 vUv;
        void main(){ vec3 s = vec3(0.0); float ws = 0.0;
          for (int i = -6; i <= 6; i++){ float fi = float(i); float w = exp(-fi*fi/18.0);
            s += texture2D(tDiffuse, vUv + vec2(fi * uStep * uTexel.x, 0.0)).rgb * w; ws += w; }
          gl_FragColor = vec4(s / ws, 1.0); }`,
    });
    this.comp = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tStreak: { value: null }, uStrength: { value: strength }, uTint: { value: tint } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform sampler2D tStreak; uniform float uStrength; uniform vec3 uTint; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec3 s = texture2D(tStreak, vUv).rgb;
          float l = dot(s, vec3(0.333));
          gl_FragColor = vec4(c + mix(uTint * l, s, 0.25) * uStrength, 1.0); }`,
    });
    this.quad = new FullScreenQuad(null);
    this.setSize(w, h);
  }
  setSize(w, h) {
    const sw = Math.max(1, Math.round(w / 4)), sh = Math.max(1, Math.round(h / 4));
    this.rtA.setSize(sw, sh); this.rtB.setSize(sw, sh);
    this.blur.uniforms.uTexel.value.set(1 / sw, 1 / sh);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.bright.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.bright;
    renderer.setRenderTarget(this.rtA); this.quad.render(renderer);
    let src = this.rtA, dst = this.rtB;
    for (const step of [1, 3, 8, 20]) {
      this.blur.uniforms.tDiffuse.value = src.texture; this.blur.uniforms.uStep.value = step;
      this.quad.material = this.blur; renderer.setRenderTarget(dst); this.quad.render(renderer);
      [src, dst] = [dst, src];
    }
    this.comp.uniforms.tDiffuse.value = readBuffer.texture;
    this.comp.uniforms.tStreak.value = src.texture;
    this.comp.uniforms.uStrength.value = this.strength;
    this.quad.material = this.comp;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

/* Ground-truth AO computed from a half-res G-buffer, composited so that
   neon / emissive pixels are never darkened (AO only removes ambient). */
class AOPass extends Pass {
  constructor(scene, camera, w, h) {
    super();
    this.scene = scene; this.camera = camera;
    this.gtao = new GTAOPass(scene, camera, Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.gtao.output = GTAOPass.OUTPUT.Off;
    this.gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.2, thickness: 1.2, scale: 1.25, samples: 16, distanceFallOff: 1.0 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.strength = 0.9;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tAO: { value: null }, uS: { value: 0.9 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform sampler2D tAO; uniform float uS; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float ao = texture2D(tAO, vUv).r;
          float l = max(max(c.r, c.g), c.b);
          float k = uS * (1.0 - smoothstep(0.6, 2.2, l));
          gl_FragColor = vec4(c * mix(1.0, ao, k), 1.0); }`,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  setSize(w, h) { this.gtao.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera;
    const had1 = cam.layers.isEnabled(1);
    cam.layers.disable(1);
    REFLECT.suspend = true;
    this.gtao.render(renderer, null, null);
    REFLECT.suspend = false;
    if (had1) cam.layers.enable(1);
    this.mat.uniforms.tDiffuse.value = readBuffer.texture;
    this.mat.uniforms.tAO.value = this.gtao.pdRenderTarget.texture;
    this.mat.uniforms.uS.value = this.strength;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uCA: { value: 0.0035 }, uVig: { value: 0.55 }, uSat: { value: 1.08 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uCA; uniform float uVig; uniform float uSat; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec2 off = c * r2 * uCA * 4.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off * 1.6).b);
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // split-tone: cyan-teal shadows, warm magenta highlights (applied in HDR, before tonemapping)
      col *= mix(vec3(0.86, 0.98, 1.12), vec3(1.0), smoothstep(0.0, 0.35, lum));
      col *= mix(vec3(1.0), vec3(1.06, 0.97, 1.0), smoothstep(0.6, 3.0, lum));
      col = mix(vec3(lum), col, uSat);
      float v = smoothstep(0.95, 0.2, length(c * vec2(1.0, 0.82)));
      col *= mix(1.0, v, uVig);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

const FilmShader = {
  uniforms: { tDiffuse: { value: null }, uTime: U.time, uGrain: { value: 0.045 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 px = floor(vUv * uRes);
      float n = h(px + fract(uTime * 13.7) * 91.0) - 0.5;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c += n * uGrain * (1.0 - l * 0.7);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { samples = 4 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.62, 0.55, 0.98);
  const streak = new AnamorphicPass(size.x, size.y, { strength: 0.11, threshold: 3.2 });
  const grade = new ShaderPass(GradeShader);
  const output = new OutputPass();
  const film = new ShaderPass(FilmShader);
  film.uniforms.uTime = U.time;
  composer.addPass(renderPass);
  const ao = new AOPass(scene, camera, size.x, size.y);
  composer.addPass(ao);
  const nan = new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: VERT,
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); bool ok = c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0 && c.r < 6.0e4 && c.g < 6.0e4 && c.b < 6.0e4; gl_FragColor = ok ? vec4(c.rgb, 1.0) : vec4(0.0, 0.0, 0.0, 1.0); }' });
  composer.addPass(nan);
  composer.addPass(bloom);
  composer.addPass(streak);
  composer.addPass(grade);
  composer.addPass(output);
  composer.addPass(film);
  const api = {
    composer, bloom, streak, grade, film, nan, ao,
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      streak.setSize(w * pr, h * pr);
      ao.setSize(Math.round(w * pr), Math.round(h * pr));
      film.uniforms.uRes.value.set(w * pr, h * pr);
    },
    render() { composer.render(); },
  };
  film.uniforms.uRes.value.copy(size);
  return api;
}
