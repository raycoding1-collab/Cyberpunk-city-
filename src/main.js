import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { buildMaterials, M, weatherizeScene } from './core/materials.js';
import { setAnisotropy } from './core/textures.js';
import { WindowSystem } from './core/windows.js';
import { U } from './core/utils.js';
import { buildGround, REFLECT } from './world/ground.js';
import { buildSky } from './world/sky.js';
import { buildHeroTower } from './world/heroTower.js';
import { buildMegablock } from './world/megablock.js';
import { buildNeighbors } from './world/neighbors.js';
import { buildDistrict } from './world/district.js';
import { buildProps } from './world/props.js';
import { buildAtmosphere } from './fx/atmosphere.js';
import { createPost } from './fx/post.js';
import { createDirector, SHOTS } from './ui.js';
import { filmAt, FILM, FILM_DURATION } from './film.js';

/* =================================================================== */
/*  KOI-TEI BLOCK — entry point                                         */
/* =================================================================== */

const params = new URLSearchParams(location.search);
const RECORD = params.has('record');
const CAPTURE = params.has('capture') || RECORD;
const bootbar = document.getElementById('bootbar');
const tick = () => new Promise((r) => setTimeout(r, 0));

// Robust bump mapping: three's derivative-based bump can emit NaN on
// edge-on pixels, which bloom would then smear across the whole frame.
THREE.ShaderChunk.bumpmap_pars_fragment = THREE.ShaderChunk.bumpmap_pars_fragment
  .replace('vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );', `vec3 dpx_ = dFdx( surf_pos.xyz ); vec3 dpy_ = dFdy( surf_pos.xyz );
    if ( dot( dpx_, dpx_ ) < 1e-24 || dot( dpy_, dpy_ ) < 1e-24 ) return surf_norm;
    vec3 vSigmaX = normalize( dpx_ );`)
  .replace('vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );', 'vec3 vSigmaY = normalize( dpy_ );')
  .replace('return normalize( abs( fDet ) * surf_norm - vGrad );', 'vec3 rN_ = abs( fDet ) * surf_norm - vGrad; return dot( rN_, rN_ ) > 1e-20 ? normalize( rN_ ) : surf_norm;');

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
  const DPR = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(DPR, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.prepend(renderer.domElement);
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e0a1e, 0.0088);
  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.08, 1500);
  camera.position.set(-1.4, 1.65, 19);
  camera.lookAt(3.2, 7, -12);
  camera.layers.enable(1);

  const world = { scene, camera, renderer, updaters: [], windows: new WindowSystem(), lights: [], steamSources: [], M, params };
  const steps = [
    ['materials', () => buildMaterials()],
    ['sky', () => buildSky(scene)],
    ['ground', () => buildGround(scene)],
    ['koi-tei tower', () => buildHeroTower(world)],
    ['hoshino block', () => buildMegablock(world)],
    ['neighbours', () => buildNeighbors(world)],
    ['district', () => buildDistrict(world)],
    ['street life', () => buildProps(world)],
    ['weather', () => { world.fx = buildAtmosphere(world); }],
  ];
  const label = document.querySelector('#boot .t');
  for (let i = 0; i < steps.length; i++) {
    if (label) label.textContent = `Assembling · ${steps[i][0]}`;
    const t0 = performance.now();
    steps[i][1]();
    if (CAPTURE) console.log('step', steps[i][0], (performance.now() - t0).toFixed(0) + 'ms');
    bootbar.style.width = `${((i + 1) / (steps.length + 1)) * 100}%`;
    await tick();
  }
  world.windows.build(scene);
  const nW = weatherizeScene(scene);
  if (CAPTURE) console.log('weathered materials', nW);
  if (params.get('tris')) {
    const by = new Map();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1) * (g.isInstancedBufferGeometry ? g.instanceCount : 1);
      let p = o; while (p.parent && p.parent !== scene) p = p.parent;
      const key = (p.name || p.type) + ' / ' + (o.name || o.parent?.name || '') + ' / ' + (o.material?.name || o.material?.type);
      by.set(key, (by.get(key) || 0) + n);
    });
    [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log('TRIS', Math.round(v), k));
  }

  /* ------------------------------ lighting ----------------------------- */
  // sky fill: violet light-pollution dome, near-black bounce from the wet street
  scene.add(new THREE.HemisphereLight(0x2c2454, 0x07060c, 0.5));
  // moon/rim key through thin cloud — a cool edge on rooftops and rain
  const moon = new THREE.DirectionalLight(0x8090ff, 0.2);
  moon.position.set(-40, 80, 30);
  scene.add(moon);
  for (const l of world.lights) {
    const p = new THREE.PointLight(l.color, l.intensity, l.distance, l.decay ?? 1.7);
    p.position.copy(l.pos);
    scene.add(p);
    l.light = p;
  }

  /* --------------------------- environment ----------------------------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  REFLECT.reflector.visible = false;
  for (const m of REFLECT.hidden) m.visible = false;
  const env = pmrem.fromScene(scene, 0.03, 0.5, 900, { position: new THREE.Vector3(0, 7, -4), size: 256 });
  REFLECT.reflector.visible = true;
  for (const m of REFLECT.hidden) m.visible = true;
  scene.environment = env.texture;
  scene.environmentIntensity = 0.9;

  /* ----------------------- post + quality levels ----------------------- */
  const post = createPost(renderer, scene, camera);
  for (const k of (params.get('np') || '').split(',').filter(Boolean)) post[k].enabled = false;
  let reflScale = 0.5;
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    post.setSize(w, h, renderer.getPixelRatio());
    const pr = renderer.getPixelRatio();
    REFLECT.rt.setSize(Math.max(64, Math.round(w * pr * reflScale)), Math.max(64, Math.round(h * pr * reflScale)));
  };
  const quality = {
    levels: ['Ultra', 'High', 'Medium', 'Low'], i: 1,
    name() { return this.levels[this.i]; },
    set(i) {
      this.i = i;
      const cfg = [
        { pr: Math.min(DPR, 2.0), refl: 0.6, rq: 1, shadows: true, streak: true, ao: true },
        { pr: Math.min(DPR, 1.5), refl: 0.5, rq: 1, shadows: true, streak: true, ao: true },
        { pr: Math.min(DPR, 1.0), refl: 0.35, rq: 1, shadows: true, streak: false, ao: false },
        { pr: Math.min(DPR, 0.75), refl: 0.25, rq: 0, shadows: false, streak: false, ao: false },
      ][i];
      const shadowChange = renderer.shadowMap.enabled !== cfg.shadows;
      renderer.setPixelRatio(cfg.pr);
      reflScale = cfg.refl;
      REFLECT.quality.value = cfg.rq;
      renderer.shadowMap.enabled = cfg.shadows;
      if (shadowChange) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
      post.streak.enabled = cfg.streak;
      post.ao.enabled = cfg.ao;
      resize();
    },
    cycle() { this.set((this.i + 1) % this.levels.length); },
  };
  const qp = params.get('q');
  quality.set(qp ? Math.max(0, quality.levels.findIndex((l) => l.toLowerCase() === qp.toLowerCase())) : 1);
  window.addEventListener('resize', resize);

  /* ------------------------------ director ----------------------------- */
  const director = createDirector(world, post, quality);
  const shotId = params.get('shot');
  if (shotId || CAPTURE) {
    const idx = Math.max(0, SHOTS.findIndex((s) => s.id === shotId));
    director.state.cinematic = false;
    director.state.shot = idx;
    director.applyShot(SHOTS[idx], +(params.get('k') || 0));
  } else {
    director.applyShot(SHOTS[0], 0);
  }
  const cam = params.get('cam');
  if (cam) {
    const [px, py, pz, tx, ty, tz, fov] = cam.split(',').map(Number);
    camera.position.set(px, py, pz); director.controls.target.set(tx, ty, tz); camera.lookAt(tx, ty, tz);
    if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
  director.updateButtons();
  for (const n of (params.get('hide') || '').split(',').filter(Boolean)) scene.traverse((o) => { if (o.name === n) o.visible = false; });
  if (params.get('rain') === '0') U.rain.value = 0;

  bootbar.style.width = '100%';
  document.getElementById('boot').classList.add('done');
  if (CAPTURE) { document.getElementById('boot').remove(); window.__dbg = { Raycaster: THREE.Raycaster, Vector2: THREE.Vector2, scene, camera }; }
  if (params.get('hud') === '0') document.getElementById('hud').remove();

  /* -------------------------------- loop ------------------------------- */
  const clock = new THREE.Timer();
  let t = CAPTURE ? +(params.get('t') || 14) : 0;
  let frames = 0, perfAcc = 0, perfN = 0, perfStage = 0;
  renderer.info.autoReset = false;
  if (RECORD) {
    // deterministic film renderer: frame i → camera/world state → JPEG
    const fps = +(params.get('fps') || 24);
    const st = {};
    let last = null;
    window.__film = {
      fps, frames: Math.round(FILM_DURATION * fps), shots: FILM.map((f) => ({ name: f.name, dur: f.dur })),
      /** advance the world to frame i (camera + simulation) without drawing; lets a resumed render re-sync */
      step(i) {
        filmAt(i / fps, st);
        const wt = st.world;
        U.time.value = wt;
        const dtw = last === null || last.index !== st.index ? 1 / fps : Math.max(0, wt - last.world);
        for (const u of world.updaters) u(wt, dtw || 1 / fps);
        camera.position.copy(st.pos);
        if (camera.fov !== st.fov) { camera.fov = st.fov; camera.updateProjectionMatrix(); }
        camera.lookAt(st.target);
        last = { index: st.index, world: wt };
      },
      render(i, quality = 0.93) {
        this.step(i);
        renderer.info.reset();
        post.render();
        return renderer.domElement.toDataURL('image/jpeg', quality);
      },
    };
    window.__captureReady = true;
    return;
  }
  const loop = () => {
    renderer.info.reset();
    clock.update();
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    if (!CAPTURE) t += dt;
    U.time.value = t;
    for (const u of world.updaters) u(t, CAPTURE ? 1 / 30 : dt);
    if (!CAPTURE) director.update(t, dt);
    if (params.get('post') === '0') renderer.render(scene, camera); else post.render();
    frames++;
    // adaptive quality: step down (at most twice) if the GPU struggles
    if (!CAPTURE && !qp && frames > 40 && perfStage < 2) {
      perfAcc += rawDt; perfN++;
      if (perfN >= 90) {
        const avg = perfAcc / perfN;
        if (avg > 1 / 28) { quality.set(Math.min(3, quality.i + 1)); director.updateButtons(); perfStage++; } else perfStage = 2;
        perfAcc = 0; perfN = 0;
      }
    }
    if (CAPTURE && frames === 3) {
      window.__stats = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, lights: world.lights.length, windows: world.windows.items.length };
      window.__captureReady = true;
      return;
    }
    requestAnimationFrame(loop);
  };
  loop();
}

boot().catch((e) => { console.error(e); const el = document.querySelector('#boot .t'); if (el) el.textContent = 'BOOT FAILURE: ' + e.message; });
