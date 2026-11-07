import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { U, easeInOut } from './core/utils.js';

/* =================================================================== */
/*  Director: hand-composed camera shots, a cinematic auto-tour with   */
/*  slow dolly moves and hard cuts, free orbit, quality + rain toggles */
/* =================================================================== */

export const SHOTS = [
  { id: 'street', name: 'Main Street', cap: 'Main street · 02:47 · rain', p: [-1.4, 1.65, 19], t: [3.2, 7.0, -12], fov: 46, p1: [-0.6, 1.75, 15.5], t1: [3.0, 7.4, -14] },
  { id: 'ramen', name: 'Ramen Counter', cap: '鯉亭 · Koi-Tei ramen counter', p: [2.2, 1.55, 5.2], t: [8.7, 2.0, -2.4], fov: 50, p1: [2.8, 1.5, 1.8], t1: [8.9, 1.9, -3.4] },
  { id: 'alley', name: 'Back Alley', cap: 'Back alley · behind the kitchen', p: [23.2, 1.65, 7.6], t: [9.5, 4.6, 4.6], fov: 56, p1: [21.0, 1.75, 7.2], t1: [9.0, 5.6, 4.6] },
  { id: 'tower', name: 'Koi-Tei Tower', cap: 'KOI-TEI tower · stacked homes', p: [-5.2, 5.5, 13], t: [9, 22, -6], fov: 50, p1: [-5.6, 9.0, 6], t1: [9, 25, -7] },
  { id: 'screen', name: 'Neural Drift', cap: 'NEURAL//DRIFT · Hoshino Block 7', p: [4.6, 8.5, 7], t: [-7, 20, -17], fov: 52, p1: [4.2, 10.5, 0], t1: [-7, 21, -19] },
  { id: 'roof', name: 'Koi Hologram', cap: 'Rooftop · twin koi hologram', p: [-3.5, 45.5, 6], t: [14, 41.5, -5], fov: 50, p1: [-3.5, 47, -13], t1: [14, 41.5, -4.2] },
  { id: 'maglev', name: 'Maglev Line', cap: 'Cross street · maglev line 7', p: [2.5, 3.2, -21], t: [-2, 15.5, -38], fov: 56, p1: [-1.5, 3.6, -25], t1: [-6, 16, -38] },
  { id: 'aerial', name: 'Aerial', cap: 'Sector 7 · Neo-Kabukichō', p: [30, 62, 58], t: [-1, 6, -16], fov: 44, p1: [44, 56, 30], t1: [0, 8, -20] },
];

export function createDirector(world, post, quality) {
  const { camera, renderer } = world;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 1.0;
  controls.maxDistance = 220;
  controls.target.set(3.2, 7, -12);
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.7;

  const state = { cinematic: true, shot: 0, shotT: 0, tween: null, userTouched: false };
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .45s ease;z-index:4';
  document.body.appendChild(fade);
  const caption = document.getElementById('caption');

  const v3 = (a) => new THREE.Vector3(...a);
  function applyShot(s, k) {
    const p = v3(s.p).lerp(v3(s.p1 || s.p), k);
    const t = v3(s.t).lerp(v3(s.t1 || s.t), k);
    camera.position.copy(p);
    controls.target.copy(t);
    if (camera.fov !== s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
    camera.lookAt(t);
  }
  function showCaption(text) {
    if (!caption) return;
    caption.textContent = text;
    caption.classList.add('show');
    clearTimeout(showCaption._t);
    showCaption._t = setTimeout(() => caption.classList.remove('show'), 3800);
  }
  function goTo(i, { cut = false } = {}) {
    const s = SHOTS[i];
    if (cut) {
      fade.style.opacity = '1';
      setTimeout(() => {
        state.shot = i; state.shotT = 0; state.tween = null;
        applyShot(s, 0);
        fade.style.opacity = '0';
        state.cutting = false;
        showCaption(s.cap); updateButtons();
      }, 470);
      return;
    }
    state.shot = i; state.shotT = 0;
    state.tween = { from: camera.position.clone(), fromT: controls.target.clone(), fromFov: camera.fov, s, k: 0 };
    showCaption(s.cap);
    updateButtons();
  }

  // ------------------------------- HUD -------------------------------
  const bar = document.getElementById('controls');
  const btns = [];
  if (bar) {
    SHOTS.forEach((s, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1} · ${s.name}`;
      b.onclick = () => { state.cinematic = false; goTo(i); };
      bar.appendChild(b); btns.push(b);
    });
    const sep = document.createElement('span'); sep.className = 'sep'; bar.appendChild(sep);
    const cin = document.createElement('button'); cin.textContent = 'Cinematic';
    cin.onclick = () => { state.cinematic = !state.cinematic; if (state.cinematic) goTo((state.shot + 1) % SHOTS.length, { cut: true }); updateButtons(); };
    bar.appendChild(cin);
    const rain = document.createElement('button'); rain.textContent = 'Rain';
    rain.onclick = () => { U.rain.value = U.rain.value > 0.5 ? 0 : 1; updateButtons(); };
    bar.appendChild(rain);
    const q = document.createElement('button');
    q.onclick = () => { quality.cycle(); updateButtons(); };
    bar.appendChild(q);
    const hint = document.createElement('span'); hint.className = 'hint';
    hint.textContent = 'drag · orbit   right-drag · pan   wheel · zoom   1–8 shots   C cinematic   R rain   H hide';
    bar.appendChild(hint);
    btns.cin = cin; btns.rain = rain; btns.q = q;
  }
  function updateButtons() {
    btns.forEach((b, i) => b.classList.toggle('on', i === state.shot && !state.cinematic));
    if (btns.cin) btns.cin.classList.toggle('on', state.cinematic);
    if (btns.rain) btns.rain.classList.toggle('on', U.rain.value > 0.5);
    if (btns.q) btns.q.textContent = `Quality · ${quality.name()}`;
  }

  const stopCinematic = () => { if (state.cinematic) { state.cinematic = false; updateButtons(); } state.tween = null; };
  controls.addEventListener('start', stopCinematic);
  window.addEventListener('keydown', (e) => {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= SHOTS.length) { state.cinematic = false; goTo(n - 1); }
    else if (e.key === 'c' || e.key === 'C') { state.cinematic = !state.cinematic; if (state.cinematic) goTo((state.shot + 1) % SHOTS.length, { cut: true }); updateButtons(); }
    else if (e.key === 'r' || e.key === 'R') { U.rain.value = U.rain.value > 0.5 ? 0 : 1; updateButtons(); }
    else if (e.key === 'h' || e.key === 'H') document.getElementById('hud')?.classList.toggle('hidden');
  });

  // clock + telemetry
  const clockEl = document.getElementById('clock'), precip = document.getElementById('precip'), grid = document.getElementById('grid');
  const start = 2 * 3600 + 47 * 60 + 13;
  let acc = 0;

  const SHOT_LEN = 13;
  return {
    controls, state, goTo, updateButtons, applyShot,
    update(t, dt) {
      if (state.tween) {
        const tw = state.tween;
        tw.k = Math.min(1, tw.k + dt / 2.2);
        const e = easeInOut(tw.k);
        camera.position.lerpVectors(tw.from, v3(tw.s.p), e);
        controls.target.lerpVectors(tw.fromT, v3(tw.s.t), e);
        camera.fov = THREE.MathUtils.lerp(tw.fromFov, tw.s.fov, e); camera.updateProjectionMatrix();
        camera.lookAt(controls.target);
        if (tw.k >= 1) state.tween = null;
      } else if (state.cinematic) {
        state.shotT += dt;
        const s = SHOTS[state.shot];
        applyShot(s, easeInOut(Math.min(1, state.shotT / SHOT_LEN)) );
        if (state.shotT > SHOT_LEN - 0.45 && !state.cutting) {
          state.cutting = true;
          goTo((state.shot + 1) % SHOTS.length, { cut: true });
        }
      } else {
        controls.update();
      }
      acc += dt;
      if (acc > 0.25 && clockEl) {
        acc = 0;
        const s = Math.floor(start + t);
        const hh = String(Math.floor(s / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(s / 60) % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
        clockEl.textContent = `${hh}:${mm}:${ss}  JST+2`;
        if (precip) precip.textContent = U.rain.value > 0.5 ? `${(11 + Math.sin(t * 0.13) * 1.8).toFixed(1)} mm/h` : '0.0 mm/h';
        if (grid) grid.textContent = `${Math.round(82 + Math.sin(t * 0.07) * 6)}%`;
      }
    },
  };
}
