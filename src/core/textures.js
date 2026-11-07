import * as THREE from 'three';
import { mulberry32 } from './utils.js';

/* =================================================================== */
/*  Procedural, tileable surface textures (no external image assets).  */
/*  Every surface family has albedo + roughness + bump, so wet nights  */
/*  read correctly: glossy streaks, dull grout, beaded tar seams …     */
/* =================================================================== */

let ANISO = 8;
export function setAnisotropy(a) { ANISO = a; }

function makeNoise(seed) {
  const r = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const lat = (ix, iy, per) => {
    ix = ((ix % per) + per) % per; iy = ((iy % per) + per) % per;
    return perm[(perm[ix & 255] + iy) & 255] / 255;
  };
  const noise = (x, y, per) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = lat(ix, iy, per), b = lat(ix + 1, iy, per), c = lat(ix, iy + 1, per), d = lat(ix + 1, iy + 1, per);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  // tileable fbm: x,y in [0,1)
  const fbm = (x, y, period = 4, oct = 5, gain = 0.5) => {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) {
      s += a * noise(x * period * f, y * period * f, period * f);
      n += a; a *= gain; f *= 2;
    }
    return s / n;
  };
  return { noise, fbm, r };
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Build three canvases (albedo, rough, bump) from a per-pixel function. */
function synth(size, fn, sizeY = size) {
  const ca = canvas(size, sizeY), cr = canvas(size, sizeY), cb = canvas(size, sizeY);
  const xa = ca.getContext('2d'), xr = cr.getContext('2d'), xb = cb.getContext('2d');
  const ia = xa.createImageData(size, sizeY), ir = xr.createImageData(size, sizeY), ib = xb.createImageData(size, sizeY);
  const out = { r: 0, g: 0, b: 0, rough: 1, h: 0.5 };
  for (let y = 0; y < sizeY; y++) {
    for (let x = 0; x < size; x++) {
      fn(x / size, y / sizeY, x, y, out);
      const k = (y * size + x) * 4;
      ia.data[k] = out.r * 255; ia.data[k + 1] = out.g * 255; ia.data[k + 2] = out.b * 255; ia.data[k + 3] = 255;
      const rr = out.rough * 255; ir.data[k] = rr; ir.data[k + 1] = rr; ir.data[k + 2] = rr; ir.data[k + 3] = 255;
      const hh = out.h * 255; ib.data[k] = hh; ib.data[k + 1] = hh; ib.data[k + 2] = hh; ib.data[k + 3] = 255;
    }
  }
  xa.putImageData(ia, 0, 0); xr.putImageData(ir, 0, 0); xb.putImageData(ib, 0, 0);
  return { ca, cr, cb, xa, xr, xb };
}

export function tex(c, { srgb = true, repeat = true, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = ANISO;
  t.generateMipmaps = mips;
  if (!mips) t.minFilter = THREE.LinearFilter;
  return t;
}

function pack(s) {
  return { map: tex(s.ca), roughnessMap: tex(s.cr, { srgb: false }), bumpMap: tex(s.cb, { srgb: false }) };
}

/** Draw rain/grime streaks onto albedo (darker) and roughness (glossier) canvases. */
function streaks(s, size, count, seed, { dark = 0.35, minLen = 40, maxLen = 260, starts = null } = {}) {
  const r = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * size;
    const y0 = starts ? starts[Math.floor(r() * starts.length)] : r() * size;
    const len = minLen + r() * (maxLen - minLen);
    const w = 1 + r() * r() * 7;
    for (const [ctx, col] of [[s.xa, `rgba(10,10,14,${dark * (0.4 + r() * 0.6)})`], [s.xr, `rgba(40,40,40,${0.5 + r() * 0.4})`]]) {
      const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      // slightly wobbly streak, drawn wrapped for tileability
      for (const oy of [0, -size]) for (const ox of [0, -size, size]) {
        ctx.beginPath();
        ctx.moveTo(x + ox - w / 2, y0 + oy);
        ctx.bezierCurveTo(x + ox - w, y0 + oy + len * 0.3, x + ox + w * 0.3, y0 + oy + len * 0.7, x + ox - w * 0.2, y0 + oy + len);
        ctx.lineTo(x + ox + w * 0.3, y0 + oy + len);
        ctx.bezierCurveTo(x + ox + w, y0 + oy + len * 0.6, x + ox, y0 + oy + len * 0.3, x + ox + w / 2, y0 + oy);
        ctx.fill();
      }
    }
  }
}

/* ------------------------------ Concrete ------------------------------ */
// Board-formed brutalist concrete with form joints, tie holes and rain streaks.
export function concrete({ seed = 1, tone = [0.46, 0.45, 0.44], size = 512, warm = 0, panels = true } = {}) {
  const N = makeNoise(seed);
  const s = synth(size, (u, v, x, y, o) => {
    const low = N.fbm(u, v, 3, 4);
    const mid = N.fbm(u + 0.3, v + 0.7, 12, 3);
    const grain = N.noise(u * 180, v * 180, 180);
    const board = panels ? (0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 16 + N.noise(u * 8, v * 8, 8) * 2)) : 0.5; // board grain
    let k = 0.78 + low * 0.35 + (mid - 0.5) * 0.18 + (grain - 0.5) * 0.08 + (board - 0.5) * 0.04;
    let hh = 0.5 + (grain - 0.5) * 0.35 + (mid - 0.5) * 0.3 + (board - 0.5) * 0.12;
    let rough = 0.82 + (grain - 0.5) * 0.12;
    if (panels) {
      // form joints every 256px horizontally and 128px vertically
      const jx = Math.min(x % 256, 256 - (x % 256));
      const jy = Math.min(y % 128, 128 - (y % 128));
      if (jy < 2) { k *= 0.6; hh = 0.1; rough = 0.95; }
      else if (jx < 1.5) { k *= 0.75; hh = 0.2; }
      // tie holes
      const tx = ((x + 64) % 128) - 64, ty = ((y + 64) % 128) - 64;
      const d = Math.hypot(tx, ty);
      if (d < 5) { k *= 0.35 + d * 0.06; hh = 0.05; rough = 0.6; }
      else if (d < 7) { hh = 0.62; }
    }
    o.r = tone[0] * k * (1 + warm * 0.08); o.g = tone[1] * k; o.b = tone[2] * k * (1 - warm * 0.06);
    o.rough = rough; o.h = hh;
  }, size);
  streaks(s, size, 90, seed + 11, { starts: panels ? [0, 128, 256, 384] : null, dark: 0.45 });
  return pack(s);
}

/* ------------------------------ Mosaic tile --------------------------- */
// Small rectangular glazed tiles in running bond, very typical of
// Japanese mid-rise façades. Glaze is glossy → beautiful when wet.
export function tiles({ seed = 2, color = [0.62, 0.66, 0.62], size = 512, cols = 10, rows = 20, grout = [0.25, 0.25, 0.26], vary = 0.08 } = {}) {
  const N = makeNoise(seed);
  const tw = size / cols, th = size / rows;
  const s = synth(size, (u, v, x, y, o) => {
    const row = Math.floor(y / th);
    const xo = x + (row % 2) * tw * 0.5;
    const col = Math.floor(xo / tw) % cols;
    const fx = (xo % tw), fy = (y % th);
    const edge = Math.min(fx, tw - fx, fy, th - fy);
    const id = N.noise(col * 7.13 + 0.5, row * 3.71 + 0.5, 256);
    const grime = N.fbm(u, v, 4, 4);
    if (edge < 1.6) {
      o.r = grout[0] * (0.8 + grime * 0.4); o.g = grout[1] * (0.8 + grime * 0.4); o.b = grout[2] * (0.8 + grime * 0.4);
      o.rough = 0.92; o.h = 0.15;
    } else {
      const k = 1 - vary + id * vary * 2 - grime * 0.18;
      const bev = Math.min(1, edge / 4);
      o.r = color[0] * k; o.g = color[1] * k; o.b = color[2] * k;
      o.rough = 0.18 + grime * 0.3 + (1 - bev) * 0.2; o.h = 0.55 + bev * 0.4;
    }
  }, size);
  streaks(s, size, 60, seed + 5, { dark: 0.4 });
  return pack(s);
}

/* ------------------------------ Asphalt ------------------------------- */
export function asphalt({ seed = 3, size = 1024 } = {}) {
  const N = makeNoise(seed);
  const s = synth(size, (u, v, x, y, o) => {
    const low = N.fbm(u, v, 3, 4);
    const agg = N.noise(u * 420, v * 420, 420);
    const agg2 = N.noise(u * 160 + 3, v * 160 + 9, 160);
    const patch = N.fbm(u + 0.5, v + 0.2, 2, 3);
    let k = 0.085 + low * 0.05 + (agg > 0.78 ? (agg - 0.78) * 0.5 : 0) + (agg2 - 0.5) * 0.02;
    let rough = 0.74 - (agg > 0.8 ? 0.2 : 0) + (low - 0.5) * 0.15;
    let hh = 0.45 + agg * 0.4 + agg2 * 0.15;
    // repaired patch rectangle (slightly darker, smoother)
    if (patch > 0.62) { k *= 0.78; rough -= 0.12; hh -= 0.05; }
    o.r = k * 0.98; o.g = k; o.b = k * 1.06;
    o.rough = rough; o.h = hh;
  }, size);
  // tar snakes: glossy, black crack sealant lines
  const r = mulberry32(seed + 1);
  for (let i = 0; i < 22; i++) {
    let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
    const w = 3 + r() * 6;
    const pts = [[x, y]];
    for (let j = 0; j < 30; j++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; pts.push([x, y]); }
    for (const [ctx, col] of [[s.xa, 'rgba(4,4,6,0.9)'], [s.xr, 'rgba(20,20,20,1)'], [s.xb, 'rgba(160,160,160,0.8)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
  }
  // oil stains
  for (let i = 0; i < 9; i++) {
    const x = r() * size, y = r() * size, rad = 20 + r() * 70;
    const g = s.xa.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(10,6,14,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    s.xa.fillStyle = g; s.xa.beginPath(); s.xa.ellipse(x, y, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); s.xa.fill();
    const g2 = s.xr.createRadialGradient(x, y, 0, x, y, rad);
    g2.addColorStop(0, 'rgba(30,30,30,0.9)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    s.xr.fillStyle = g2; s.xr.beginPath(); s.xr.arc(x, y, rad, 0, Math.PI * 2); s.xr.fill();
  }
  return pack(s);
}

/* ------------------------------ Sidewalk pavers ----------------------- */
export function pavers({ seed = 4, size = 512, n = 4, tone = [0.36, 0.35, 0.36] } = {}) {
  const N = makeNoise(seed);
  const cell = size / n;
  const s = synth(size, (u, v, x, y, o) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const fx = x % cell, fy = y % cell;
    const e = Math.min(fx, cell - fx, fy, cell - fy);
    const id = N.noise(cx * 5.3 + 0.5, cy * 9.1 + 0.5, 256);
    const grain = N.noise(u * 300, v * 300, 300);
    const stain = N.fbm(u, v, 3, 4);
    if (e < 2.2) {
      o.r = o.g = o.b = 0.07; o.rough = 0.35; o.h = 0.05;
    } else {
      const k = 0.82 + id * 0.3 - stain * 0.25 + (grain - 0.5) * 0.12;
      const bev = Math.min(1, (e - 2.2) / 5);
      o.r = tone[0] * k; o.g = tone[1] * k; o.b = tone[2] * k * 1.03;
      o.rough = 0.55 + grain * 0.2 - stain * 0.2; o.h = 0.4 + bev * 0.4 + grain * 0.2;
    }
  }, size);
  // chewing gum spots & cracks
  const r = mulberry32(seed + 3);
  for (let i = 0; i < 40; i++) {
    const x = r() * size, y = r() * size;
    s.xa.fillStyle = `rgba(${40 + r() * 30},${40 + r() * 30},${44 + r() * 30},0.7)`;
    s.xa.beginPath(); s.xa.ellipse(x, y, 2 + r() * 3, 2 + r() * 2, r() * 3, 0, 7); s.xa.fill();
  }
  for (let i = 0; i < 6; i++) {
    let x = r() * size, y = r() * size, a = r() * 6.28;
    s.xa.strokeStyle = 'rgba(10,10,10,0.6)'; s.xa.lineWidth = 1;
    s.xa.beginPath(); s.xa.moveTo(x, y);
    for (let j = 0; j < 8; j++) { a += (r() - 0.5); x += Math.cos(a) * 9; y += Math.sin(a) * 9; s.xa.lineTo(x, y); }
    s.xa.stroke();
  }
  return pack(s);
}

/* --------------------- Tactile paving (tenji blocks) ------------------ */
export function tactile({ size = 256 } = {}) {
  const N = makeNoise(9);
  const s = synth(size, (u, v, x, y, o) => {
    const c = size / 2;
    const fx = x % c, fy = y % c;
    const e = Math.min(fx, c - fx, fy, c - fy);
    const d = c / 5;
    const dx = (fx % d) - d / 2, dy = (fy % d) - d / 2;
    const r = Math.hypot(dx, dy) / (d * 0.36);
    const grime = N.fbm(u, v, 2, 3);
    const k = 0.85 - grime * 0.3;
    if (e < 1.5) { o.r = 0.12; o.g = 0.1; o.b = 0.05; o.h = 0.1; o.rough = 0.8; return; }
    o.r = 0.86 * k; o.g = 0.62 * k; o.b = 0.07 * k;
    o.h = r < 1 ? 0.5 + Math.sqrt(1 - r * r) * 0.5 : 0.45;
    o.rough = r < 1 ? 0.35 : 0.55;
  }, size);
  return pack(s);
}

/* ------------------------------ Dark wood ----------------------------- */
export function wood({ seed = 5, size = 512, tone = [0.23, 0.13, 0.07] } = {}) {
  const N = makeNoise(seed);
  const s = synth(size, (u, v, x, y, o) => {
    const w = N.noise(u * 6, v * 1, 6);
    const ring = Math.sin((u * 40 + w * 6 + N.noise(u * 20, v * 3, 20) * 1.5) * Math.PI);
    const fine = N.noise(u * 200, v * 8, 200);
    const k = 0.75 + ring * 0.12 + (fine - 0.5) * 0.3;
    o.r = tone[0] * k; o.g = tone[1] * k; o.b = tone[2] * k;
    o.rough = 0.55 + fine * 0.25; o.h = 0.5 + ring * 0.15 + (fine - 0.5) * 0.3;
  }, size);
  return pack(s);
}

/* -------------------- Painted / corrugated metal ---------------------- */
export function paintedMetal({ seed = 6, size = 512, color = [0.32, 0.5, 0.46], corrugated = false, rust = 0.5, seams = 4 } = {}) {
  const N = makeNoise(seed);
  const s = synth(size, (u, v, x, y, o) => {
    const rustN = N.fbm(u, v, 4, 5);
    const chip = N.fbm(u + 0.4, v + 0.1, 16, 3);
    const isRust = rustN > 1 - rust * 0.45 || chip > 0.82 - rust * 0.06;
    const wave = corrugated ? Math.sin(u * Math.PI * 2 * 24) : 0;
    const seam = !corrugated && (Math.min(x % (size / seams), size / seams - (x % (size / seams))) < 1.5);
    const rivet = !corrugated && (() => {
      const cs = size / seams; const fx = (x % cs), fy = (y % 64);
      return (Math.hypot(fx - 6, fy - 32) < 2.2) || (Math.hypot(fx - cs + 6, fy - 32) < 2.2);
    })();
    const k = 0.85 + (N.noise(u * 50, v * 50, 50) - 0.5) * 0.1 + wave * 0.06;
    if (isRust) {
      const rr = 0.7 + rustN * 0.4;
      o.r = 0.36 * rr; o.g = 0.17 * rr; o.b = 0.08 * rr; o.rough = 0.85;
    } else {
      o.r = color[0] * k; o.g = color[1] * k; o.b = color[2] * k; o.rough = 0.42 + (1 - k) * 0.6;
    }
    if (seam) { o.r *= 0.5; o.g *= 0.5; o.b *= 0.5; }
    o.h = 0.5 + wave * 0.45 - (seam ? 0.4 : 0) + (rivet ? 0.4 : 0) - (isRust ? 0.05 : 0);
  }, size);
  streaks(s, size, 50, seed + 9, { dark: 0.5 });
  return pack(s);
}

/* ------------------------- Alpha patterns ------------------------------ */
export function grating({ size = 128 } = {}) {
  const c = canvas(size); const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, size, size);
  x.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) x.fillRect(i * 16, 0, 3, size); // bearing bars
  for (let j = 0; j < 4; j++) x.fillRect(0, j * 32, size, 2); // cross rods
  return tex(c, { srgb: false });
}

export function perforated({ size = 256, holes = 16, r = 0.32 } = {}) {
  const c = canvas(size); const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size);
  x.fillStyle = '#000';
  const s = size / holes;
  for (let j = 0; j < holes; j++) {
    for (let i = 0; i < holes; i++) {
      const ox = (j % 2) * s * 0.5;
      x.beginPath(); x.arc(i * s + ox + s / 2, j * s + s / 2, s * r, 0, 7); x.fill();
      if (ox) { x.beginPath(); x.arc(i * s + ox + s / 2 - size, j * s + s / 2, s * r, 0, 7); x.fill(); }
    }
  }
  return tex(c, { srgb: false });
}

/* --------------------------- Soft sprites ------------------------------ */
export function glowSprite(size = 128, falloff = 2.2) {
  const c = canvas(size); const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const d = Math.hypot(i - size / 2 + 0.5, j - size / 2 + 0.5) / (size / 2);
      const a = Math.pow(Math.max(0, 1 - d), falloff);
      const k = (j * size + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = a * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}

export function puffSprite(size = 128, seed = 12) {
  const N = makeNoise(seed);
  const c = canvas(size); const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size, v = j / size;
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const n = N.fbm(u, v, 4, 5);
      const a = Math.max(0, 1 - d) ** 1.5 * (0.35 + n * 0.9);
      const k = (j * size + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.min(1, a) * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}

/* ----------------------------- Graffiti -------------------------------- */
export function graffiti({ seed = 21, w = 1024, h = 512, words = ['KOI', '2087', 'NO SIGNAL'] } = {}) {
  const r = mulberry32(seed);
  const c = canvas(w, h); const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);
  const palettes = [['#ff2f8f', '#ffd400', '#111'], ['#18e0ff', '#7a2bff', '#050505'], ['#f7f7f2', '#ff4f00', '#101010'], ['#a6ff00', '#004cff', '#000']];
  // wheat-paste poster remnants
  for (let i = 0; i < 5; i++) {
    const px = r() * w, py = h * 0.15 + r() * h * 0.5, pw = 70 + r() * 110, ph = 100 + r() * 120;
    x.save(); x.translate(px, py); x.rotate((r() - 0.5) * 0.12);
    x.fillStyle = `hsla(${r() * 360},${20 + r() * 30}%,${55 + r() * 25}%,0.85)`;
    x.fillRect(0, 0, pw, ph);
    x.fillStyle = 'rgba(0,0,0,0.75)'; x.font = `bold ${18 + r() * 14}px "Arial Black", Impact, sans-serif`;
    x.fillText(['集会', 'RIOT', '解放', 'LOST CAT', '再起動'][i % 5], 8, 34);
    x.fillRect(8, 44, pw - 16, 3); x.fillRect(8, 54, pw * 0.6, 3);
    // torn lower edge
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.moveTo(0, ph);
    for (let t = 0; t <= pw; t += 8) x.lineTo(t, ph - r() * ph * 0.35);
    x.lineTo(pw, ph); x.closePath(); x.fill();
    x.restore(); x.globalCompositeOperation = 'source-over';
  }
  // spray tags
  words.forEach((word, i) => {
    const pal = palettes[(i + seed) % palettes.length];
    const fs = 90 + r() * 60;
    const px = 40 + (i / words.length) * w * 0.85 + r() * 30, py = h * 0.35 + r() * h * 0.45;
    x.save(); x.translate(px, py); x.rotate((r() - 0.5) * 0.3); x.transform(1, 0, -0.25, 1, 0, 0);
    x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`;
    x.lineJoin = 'round';
    x.shadowColor = pal[0]; x.shadowBlur = 6;
    x.lineWidth = 14; x.strokeStyle = pal[2]; x.strokeText(word, 0, 0);
    const g = x.createLinearGradient(0, -fs, 0, 0); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    x.fillStyle = g; x.fillText(word, 0, 0);
    x.shadowBlur = 0; x.lineWidth = 3; x.strokeStyle = '#fff'; x.globalAlpha = 0.5; x.strokeText(word, -2, -3); x.globalAlpha = 1;
    // paint drips
    x.fillStyle = pal[1];
    const tw = x.measureText(word).width;
    for (let d = 0; d < 7; d++) { const dx = r() * tw; x.fillRect(dx, -4, 2.5, 10 + r() * 40); }
    x.restore();
  });
  // overspray speckle
  for (let i = 0; i < 2500; i++) {
    x.fillStyle = `rgba(${200 + r() * 55},${r() * 255},${r() * 255},${r() * 0.25})`;
    x.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
  return tex(c, { repeat: false });
}

/* ------------------------- Generic canvas helper ----------------------- */
export function drawCanvas(w, h, painter, opts) {
  const c = canvas(w, h);
  painter(c.getContext('2d'), w, h);
  return tex(c, { repeat: false, ...opts });
}
