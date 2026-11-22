// Texturas procedurales (sin imágenes externas) para casillas y terreno.
// Cada generador rellena un "Buf" (altura, color, rugosidad, emisivo, alfa) y se convierte a
// DataTextures: map (sRGB), normalMap (derivado de la altura), roughnessMap y emissiveMap.
// Todo se cachea a nivel de módulo por (nombre, tema, tamaño).
import * as THREE from 'three';

// ------------------------------------------------------------------ utilidades
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }
const wrap = (i, p) => ((i % p) + p) % p;
/** Ruido de valor periódico (px, py en celdas). */
export function vnoise(x, y, px, py, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const x0 = wrap(xi, px), x1 = wrap(xi + 1, px), y0 = wrap(yi, py), y1 = wrap(yi + 1, py);
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fbm periódico exacto (lento). */
export function fbmSlow(u, v, freq, oct = 4, s = 0, fy = freq) {
  let sum = 0, amp = 0.5, tot = 0, f = freq, g = fy;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(u * f, v * g, f, g, s + o * 17); tot += amp; amp *= 0.5; f *= 2; g *= 2; }
  return sum / tot;
}
// Campo de ruido precalculado (periodo 1, 7 octavas) muestreado con desplazamientos por semilla: ~10x más rápido.
const FN = 512; let FIELD = null;
function field() {
  if (FIELD) return FIELD;
  FIELD = new Float32Array(FN * FN);
  for (let y = 0; y < FN; y++) for (let x = 0; x < FN; x++) FIELD[y * FN + x] = fbmSlow(x / FN, y / FN, 4, 6, 999);
  // normalizar contraste a ~0..1
  let mn = 1, mx = 0; for (const v of FIELD) { if (v < mn) mn = v; if (v > mx) mx = v; }
  for (let i = 0; i < FIELD.length; i++) FIELD[i] = 0.5 + ((FIELD[i] - mn) / (mx - mn) - 0.5) * 1.15;
  return FIELD;
}
/** fbm periódico rápido: u,v en [0,1), freq = celdas base (entero para que sea periódico). */
export function fbm(u, v, freq, oct = 4, s = 0, fy = freq) {
  const F = FIELD || field();
  const x = (u * Math.max(1, Math.round(freq * 0.25)) + hash(s, 1, 77)) * FN, y = (v * Math.max(1, Math.round(fy * 0.25)) + hash(s, 2, 77)) * FN;
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fyy = y - yi;
  const x0 = xi & (FN - 1), x1 = (xi + 1) & (FN - 1), y0 = (yi & (FN - 1)) * FN, y1 = ((yi + 1) & (FN - 1)) * FN;
  const a = F[y0 + x0], b = F[y0 + x1], c = F[y1 + x0], d = F[y1 + x1];
  return a + (b - a) * fx + (c - a) * fyy + (a - b - c + d) * fx * fyy;
}
/** Voronoi periódico: devuelve {f1, f2, id, cx, cy} (cx,cy centro de la celda en coords de celda). */
export function voronoi(u, v, n, s = 0, jit = 0.9, out = {}) {
  const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0, cx = 0, cy = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = xi + i, gy = yi + j, wx = wrap(gx, n), wy = wrap(gy, n);
    const px = gx + 0.5 + (hash(wx, wy, s) - 0.5) * jit, py = gy + 0.5 + (hash(wx, wy, s + 7) - 0.5) * jit;
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; id = wx + wy * n; cx = px; cy = py; } else if (d < f2) f2 = d;
  }
  out.f1 = f1; out.f2 = f2; out.id = id; out.cx = cx; out.cy = cy; return out;
}
/** SDF de estrella de 5 puntas (iq). p centrado, r radio exterior, rf ratio interior. */
export function sdStar(px, py, r, rf) {
  const k1x = 0.809016994375, k1y = -0.587785252292, k2x = -k1x, k2y = k1y;
  px = Math.abs(px);
  let d = 2 * Math.max(k1x * px + k1y * py, 0); px -= d * k1x; py -= d * k1y;
  d = 2 * Math.max(k2x * px + k2y * py, 0); px -= d * k2x; py -= d * k2y;
  px = Math.abs(px); py -= r;
  const bx = -k1y * rf, by = k1x * rf - 1;
  const h = clamp((px * bx + py * by) / (bx * bx + by * by), 0, r);
  const qx = px - bx * h, qy = py - by * h;
  return Math.hypot(qx, qy) * Math.sign(py * bx - px * by);
}
/** SDF de rectángulo redondeado centrado. */
export function sdRBox(px, py, hx, hy, r) {
  const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}
export function hex(c) { return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]; }
export function lerp3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }

// ------------------------------------------------------------------ buffer
export class Buf {
  constructor(w, h = w) {
    this.w = w; this.h = h; const n = w * h;
    this.H = new Float32Array(n); this.C = new Float32Array(n * 3); this.R = new Float32Array(n).fill(0.8);
    this.E = null; this.A = null; this.M = null;
  }
  emissive() { return (this.E ??= new Float32Array(this.w * this.h * 3)); }
  alpha() { return (this.A ??= new Float32Array(this.w * this.h).fill(1)); }
  metal() { return (this.M ??= new Float32Array(this.w * this.h)); }
  /** fn(u, v, i) por píxel; v=0 abajo. */
  each(fn) { const { w, h } = this; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn((x + 0.5) / w, (y + 0.5) / h, y * w + x); }
  setC(i, c) { this.C[i * 3] = c[0]; this.C[i * 3 + 1] = c[1]; this.C[i * 3 + 2] = c[2]; }
  setE(i, c, k = 1) { const E = this.emissive(); E[i * 3] = c[0] * k; E[i * 3 + 1] = c[1] * k; E[i * 3 + 2] = c[2] * k; }
}

let ANISO = 4;
export function setAnisotropy(a) { ANISO = a; }
function dataTex(arr, w, h, srgb, repeat = true) {
  const t = new THREE.DataTexture(arr, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = ANISO; t.needsUpdate = true;
  return t;
}
const to8 = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0);

/** Convierte un Buf en texturas. opts.normal = intensidad del relieve. */
export function bake(b, opts = {}) {
  const { w, h } = b, n = w * h, ns = opts.normal ?? 4, rep = opts.repeat !== false;
  const col = new Uint8Array(n * 4), nor = new Uint8Array(n * 4), rou = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    col[i * 4] = to8(b.C[i * 3]); col[i * 4 + 1] = to8(b.C[i * 3 + 1]); col[i * 4 + 2] = to8(b.C[i * 3 + 2]);
    col[i * 4 + 3] = b.A ? to8(b.A[i]) : 255;
    const r = to8(b.R[i]); const m = b.M ? to8(b.M[i]) : 0;
    rou[i * 4] = r; rou[i * 4 + 1] = r; rou[i * 4 + 2] = m; rou[i * 4 + 3] = 255; // G = rugosidad, B = metal
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = rep ? wrap(x - 1, w) : Math.max(0, x - 1), xr = rep ? wrap(x + 1, w) : Math.min(w - 1, x + 1);
    const yd = rep ? wrap(y - 1, h) : Math.max(0, y - 1), yu = rep ? wrap(y + 1, h) : Math.min(h - 1, y + 1);
    const dx = (b.H[y * w + xr] - b.H[y * w + xl]) * ns * w / 256, dy = (b.H[yu * w + x] - b.H[yd * w + x]) * ns * h / 256;
    let nx = -dx, ny = -dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    nor[i] = to8(nx * 0.5 + 0.5); nor[i + 1] = to8(ny * 0.5 + 0.5); nor[i + 2] = to8(nz * 0.5 + 0.5); nor[i + 3] = 255;
  }
  const out = { map: dataTex(col, w, h, true, rep), normalMap: dataTex(nor, w, h, false, rep), roughnessMap: dataTex(rou, w, h, false, rep) };
  if (b.M) out.metalnessMap = out.roughnessMap;
  if (b.E) {
    const em = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { em[i * 4] = to8(b.E[i * 3]); em[i * 4 + 1] = to8(b.E[i * 3 + 1]); em[i * 4 + 2] = to8(b.E[i * 3 + 2]); em[i * 4 + 3] = 255; }
    out.emissiveMap = dataTex(em, w, h, true, rep);
  }
  return out;
}

const CACHE = new Map();
export function cached(key, fn) { if (!CACHE.has(key)) CACHE.set(key, fn()); return CACHE.get(key); }

// ------------------------------------------------------------------ paletas por tema
export const PAL = {
  pradera: {
    brick: [0xc8683a, 0xb4532c, 0xd88349, 0xa9492a], mortar: 0xe0cfaa,
    stone: [0xb3a690, 0x9c8f7a], stoneAccent: 0x6f9a3a,
    pillar: [0xc9bea6, 0xa99d86], moss: 0x5e9a2c,
    dirt: [0x8a5530, 0x6e3f22, 0xa26a3c, 0x5a3420], pebble: [0xa69a8a, 0x7d7266],
    capTop: [0x6cc43a, 0x4ea72a, 0x93dc4c], capSide: [0x58b032, 0x3c8a24],
  },
  cueva: {
    brick: [0x4a4f86, 0x3d4072, 0x575d98, 0x34365f], mortar: 0x1c1a30,
    stone: [0x4d4a70, 0x3a3858], stoneAccent: 0x48e6ff,
    pillar: [0x52e0ff, 0x8a5cff], moss: 0x2affd0,
    dirt: [0x34305a, 0x262246, 0x443e70, 0x1c1834], pebble: [0x5a5888, 0x403e66],
    capTop: [0x5a5784, 0x46436c, 0x6e6aa0], capSide: [0x4a4774, 0x34315a],
  },
  cielo: {
    brick: [0xf0d9cf, 0xe6c6bb, 0xf7e7dc, 0xdcb8ad], mortar: 0xc49a6c,
    stone: [0xf2e6dc, 0xd9c8bc], stoneAccent: 0xe0b04a,
    pillar: [0xfaf3ea, 0xe3d6c8], moss: 0xe0b04a,
    dirt: [0xd9a98a, 0xc28b70, 0xe8bfa0, 0xb07a66], pebble: [0xf0e0d0, 0xc9b0a0],
    capTop: [0xffffff, 0xf2eaff, 0xfff4f0], capSide: [0xfdf6ff, 0xe6dcf6],
  },
  castillo: {
    brick: [0x5e2a24, 0x4c211d, 0x6e342b, 0x3e1a18], mortar: 0x161112,
    stone: [0x3e3a40, 0x2c292f], stoneAccent: 0xff6a1a,
    pillar: [0x3a3640, 0x26232b], moss: 0xff5a14,
    dirt: [0x2e2a30, 0x221f25, 0x3a353c, 0x18151a], pebble: [0x4a454e, 0x34303a],
    capTop: [0x3a363e, 0x2c2930, 0x47424b], capSide: [0x34303a, 0x26232b],
  },
};
export const pal = (theme) => PAL[theme] || PAL.pradera;

// ------------------------------------------------------------------ generadores de casillas (cara 0..1)

/** Ladrillos biselados con mortero (2 filas por casilla). */
export function brickTex(theme, size) {
  return cached(`brick:${theme}:${size}`, () => {
    const P = pal(theme), b = new Buf(size), mort = hex(P.mortar), cols = P.brick.map(hex);
    const glow = theme === 'castillo', crys = theme === 'cueva';
    b.each((u, v, i) => {
      const row = Math.floor(v * 2), off = row % 2 ? 0.25 : 0, bu = u + off, col = Math.floor(bu * 2);
      const lx = (bu * 2 - col) - 0.5, ly = (v * 2 - row) - 0.5; // -0.5..0.5 en el ladrillo
      const id = wrap(col, 4) + row * 5;
      const warp = (fbm(u, v, 8, 3, 3) - 0.5) * 0.05;
      const d = sdRBox(lx * 1.0 + warp, ly + warp, 0.47, 0.44, 0.07); // <0 dentro
      const inside = sstep(0.0, -0.06, d);
      const bev = sstep(0, -0.16, d);
      const n = fbm(u, v, 16, 4, 11), n2 = fbm(u, v, 48, 2, 29);
      const chip = sstep(0.62, 0.7, fbm(u, v, 10, 3, 41 + id)) * sstep(-0.12, 0, d);
      const hb = hash(id, row, 5), base = cols[(hash(id, row, 9) * cols.length) | 0];
      const tone = 0.86 + hb * 0.24 + (n - 0.5) * 0.35;
      const edgeDark = mix(0.72, 1, bev);
      let c = [base[0] * tone * edgeDark, base[1] * tone * edgeDark, base[2] * tone * edgeDark];
      // sutil quemado en la parte baja del ladrillo
      c = lerp3(c, [c[0] * 0.8, c[1] * 0.78, c[2] * 0.78], sstep(0.1, 0.5, -ly) * 0.5);
      const mn = 0.82 + n2 * 0.3; const m = [mort[0] * mn, mort[1] * mn, mort[2] * mn];
      const fin = lerp3(m, c, inside * (1 - chip * 0.6));
      b.setC(i, fin);
      b.H[i] = inside * (0.55 + bev * 0.45) + n * 0.12 * inside + n2 * 0.06 - chip * 0.25;
      b.R[i] = mix(0.95, 0.68 + n * 0.2, inside);
      if (glow) { const g = (1 - inside) * sstep(0.45, 0.75, fbm(u, v, 6, 3, 77)); b.setE(i, [1, 0.32, 0.06], g * 0.9); }
      if (crys) { const s = hash((u * size) | 0, (v * size) | 0, 3); if (s > 0.996 && inside > 0.5) b.setE(i, [0.4, 0.95, 1], 1); else b.setE(i, [0, 0, 0]); }
    });
    return bake(b, { normal: 5 });
  });
}

/** Bloque sorpresa original: cristal de ámbar facetado con estrella grabada emisiva. */
export function questionTex(size) {
  return cached(`q:${size}`, () => {
    const b = new Buf(size), vo = {};
    const deep = hex(0xc8620a), mid = hex(0xf2a41c), hi = hex(0xffd75a), rim = hex(0xffe9a0);
    b.each((u, v, i) => {
      const x = u - 0.5, y = v - 0.5;
      const frame = sdRBox(x, y, 0.5, 0.5, 0.0); // borde exterior
      const inner = sdRBox(x, y, 0.4, 0.4, 0.07);
      const rimMask = sstep(0.0, 0.02, inner); // 1 en el marco
      voronoi(u, v, 5, 13, 0.95, vo);
      const fac = hash(vo.id, 1, 3), facEdge = sstep(0.0, 0.05, vo.f2 - vo.f1);
      // plano por faceta -> relieve de cristal tallado
      const ang = fac * 6.283, px = (u * 5 - vo.cx), py = (v * 5 - vo.cy);
      const plane = (Math.cos(ang) * px + Math.sin(ang) * py) * 0.25;
      const star = sdStar(x, y + 0.02, 0.25, 0.46);
      const starIn = sstep(0.012, -0.012, star), starBev = sstep(0.0, -0.05, star), starLip = sstep(0.04, 0.0, star) * (1 - starIn);
      const g = clamp(0.5 + y * 0.9 + plane * 1.5 + (fac - 0.5) * 0.25);
      let c = lerp3(deep, mid, g); c = lerp3(c, hi, sstep(0.55, 1, g) * 0.8);
      c = lerp3(c, [c[0] * 0.7, c[1] * 0.6, c[2] * 0.5], 1 - facEdge);
      // marco dorado metálico
      const rimTone = 0.75 + 0.35 * sstep(-0.5, 0.5, y - x * 0.3);
      c = lerp3(c, [rim[0] * rimTone, rim[1] * rimTone * 0.92, rim[2] * rimTone * 0.6], rimMask);
      // remaches en las esquinas del marco
      const cr = Math.hypot(Math.abs(x) - 0.45, Math.abs(y) - 0.45), riv = sstep(0.035, 0.02, cr);
      c = lerp3(c, [1, 0.95, 0.75], riv * 0.7);
      // estrella: hueco profundo y luminoso
      c = lerp3(c, [1, 0.97, 0.78], starIn); c = lerp3(c, [0.55, 0.25, 0.04], starLip * 0.8);
      b.setC(i, c);
      b.H[i] = (1 - rimMask) * (0.55 + plane * 0.6 - (1 - facEdge) * 0.08) + rimMask * (0.85 - sstep(0.0, 0.08, -frame) * 0) + riv * 0.25 - starBev * 0.45 + starLip * 0.1;
      b.R[i] = mix(0.18 + (1 - facEdge) * 0.2, 0.32, rimMask);
      b.metal()[i] = rimMask * 0.9;
      const eg = starIn * 1 + starBev * 0.4 + (1 - rimMask) * sstep(0.4, 0.95, g) * 0.25 + (1 - facEdge) * (1 - rimMask) * 0.12;
      b.setE(i, [1, 0.72, 0.26], eg);
    });
    return bake(b, { normal: 6, repeat: false });
  });
}

/** Bloque usado: bronce apagado con remaches y panel rehundido. */
export function usedTex(theme, size) {
  return cached(`used:${theme}:${size}`, () => {
    const b = new Buf(size);
    const base = theme === 'cueva' ? hex(0x4a4560) : theme === 'castillo' ? hex(0x3c3030) : theme === 'cielo' ? hex(0xa08a78) : hex(0x8a6a4c);
    b.each((u, v, i) => {
      const x = u - 0.5, y = v - 0.5;
      const panel = sdRBox(x, y, 0.36, 0.36, 0.06), pin = sstep(0.0, -0.03, panel);
      const n = fbm(u, v, 10, 4, 5), sc = fbm(u, v, 40, 2, 9);
      let riv = 0; for (const [rx, ry] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) { const d = Math.hypot(x - rx, y - ry); riv = Math.max(riv, Math.sqrt(clamp(1 - (d / 0.045) ** 2))); }
      const star = sdStar(x, y + 0.02, 0.2, 0.46), sIn = sstep(0.01, -0.01, star) * 0.6;
      const tone = 0.75 + n * 0.4 - (1 - pin) * 0.05 + riv * 0.3 - sIn * 0.15;
      const rust = sstep(0.55, 0.75, fbm(u, v, 6, 3, 21)) * 0.4;
      let c = [base[0] * tone, base[1] * tone, base[2] * tone];
      c = lerp3(c, [c[0] * 0.7, c[1] * 0.85, c[2] * 0.7], rust);
      b.setC(i, c);
      b.H[i] = 0.6 - pin * 0.25 + sstep(0.0, -0.03, panel) * 0 + riv * 0.5 + n * 0.12 + sc * 0.05 - sIn * 0.2;
      b.R[i] = 0.7 + sc * 0.2 - riv * 0.3; b.metal()[i] = 0.35 + riv * 0.5 - rust * 0.4;
    });
    return bake(b, { normal: 5, repeat: false });
  });
}

/** Piedra tallada (escaleras/X). */
export function stoneTex(theme, size) {
  return cached(`stone:${theme}:${size}`, () => {
    const P = pal(theme), b = new Buf(size), c0 = hex(P.stone[0]), c1 = hex(P.stone[1]), acc = hex(P.stoneAccent);
    b.each((u, v, i) => {
      const x = u - 0.5, y = v - 0.5;
      const outer = sdRBox(x, y, 0.47, 0.47, 0.06), inner = sdRBox(x, y, 0.3, 0.3, 0.03);
      const bevO = sstep(0, -0.1, outer);
      const pyr = 1 - Math.max(Math.abs(x), Math.abs(y)) * 2; // pirámide tallada en el centro
      const n = fbm(u, v, 8, 5, 31), cr = sstep(0.04, 0.0, Math.abs(fbm(u, v, 5, 3, 51) - 0.5)) * 0.8;
      const inIn = sstep(0.01, -0.01, inner);
      const tone = 0.78 + n * 0.4 - cr * 0.3;
      let c = lerp3(c1, c0, n); c = [c[0] * tone, c[1] * tone, c[2] * tone];
      c = lerp3(c, [c[0] * 0.78, c[1] * 0.78, c[2] * 0.78], 1 - bevO);
      let em = 0;
      if (theme === 'pradera') { const moss = sstep(0.62, 0.72, fbm(u, v, 6, 4, 61) * 0.7 + sstep(0.15, 0.5, y) * 0.45); c = lerp3(c, [acc[0] * (0.7 + n * 0.5), acc[1] * (0.7 + n * 0.5), acc[2] * 0.7], moss); }
      else if (theme === 'cielo') { const line = sstep(0.012, 0.0, Math.abs(inner)) ; c = lerp3(c, acc, line); em = 0; b.metal()[i] = line; }
      else { em = cr * (theme === 'castillo' ? 1 : 0.7); }
      b.setC(i, c);
      b.H[i] = bevO * 0.6 + inIn * pyr * 0.35 + (1 - inIn) * 0.15 + n * 0.15 - cr * 0.25 + sstep(0.015, 0, Math.abs(inner)) * -0.12;
      b.R[i] = 0.8 + n * 0.15 - (theme === 'cielo' ? 0.35 : 0);
      if (em > 0 || theme === 'castillo' || theme === 'cueva') b.setE(i, acc, em);
    });
    return bake(b, { normal: 5, repeat: false });
  });
}

/** Fuste de columna acanalado: u alrededor, v a lo largo (periódico en v cada 1 unidad). */
export function pillarTex(theme, size) {
  return cached(`pillar:${theme}:${size}`, () => {
    const P = pal(theme), b = new Buf(size), c0 = hex(P.pillar[0]), c1 = hex(P.pillar[1]), moss = hex(P.moss);
    b.each((u, v, i) => {
      const fl = Math.abs(Math.sin(u * Math.PI * 8)); // 8 estrías
      const n = fbm(u, v, 6, 5, 71), n2 = fbm(u, v, 24, 2, 72);
      let c = lerp3(c1, c0, n * 0.6 + fl * 0.4);
      const tone = 0.8 + n * 0.3; c = [c[0] * tone, c[1] * tone, c[2] * tone];
      let h = Math.pow(fl, 0.45) * 0.7 + n * 0.15 + n2 * 0.05, r = 0.78 + n2 * 0.15, e = 0;
      if (theme === 'pradera') {
        const m = sstep(0.55, 0.7, fbm(u, v, 8, 5, 81) * 0.6 + fbmSlow(u, v, 3, 4, 83) * 0.4 + (1 - fl) * 0.06);
        c = lerp3(c, [moss[0] * (0.6 + n2 * 0.6), moss[1] * (0.6 + n2 * 0.6), moss[2] * 0.6], m); h += m * 0.15; r = mix(r, 0.95, m);
      } else if (theme === 'cueva') {
        const band = 0.5 + 0.5 * Math.sin(v * Math.PI * 4 + n * 3); e = (0.3 + 0.7 * fl) * band * 0.6 + sstep(0.7, 0.9, n2) * 0.5;
        c = lerp3([0.12, 0.2, 0.4], c0, fl * 0.6); r = 0.12;
        b.setE(i, lerp3(hex(P.pillar[1]), hex(P.pillar[0]), band), e);
      } else if (theme === 'cielo') {
        const g = sstep(0.03, 0.0, Math.abs(((v * 2) % 1) - 0.5) - 0.44); c = lerp3(c, hex(0xe8b450), g); b.metal()[i] = g; r = mix(0.4, 0.3, g);
      } else {
        const crk = sstep(0.035, 0.0, Math.abs(fbm(u, v, 4, 4, 91) - 0.5)) * (1 - fl * 0.5);
        c = lerp3(c, [0.1, 0.03, 0.02], crk); h -= crk * 0.3; b.setE(i, [1, 0.35, 0.05], crk * 1.2);
      }
      b.setC(i, c); b.H[i] = h; b.R[i] = r;
    });
    return bake(b, { normal: 4 });
  });
}

/** Madera de tablones (veta a lo largo de u). */
export function woodTex(theme, size) {
  return cached(`wood:${theme}:${size}`, () => {
    const b = new Buf(size);
    const base = theme === 'cueva' ? hex(0x6a4a7a) : theme === 'castillo' ? hex(0x5a3a2a) : theme === 'cielo' ? hex(0xc89a6a) : hex(0xa8703c);
    b.each((u, v, i) => {
      const plank = Math.floor(v * 3), pv = v * 3 - plank;
      const gr = fbm(u, v * 3 + plank * 0.37, 2, 4, 101 + plank, 24);
      const rings = 0.5 + 0.5 * Math.sin((gr * 10 + v * 30) * 1.0);
      const knot = sstep(0.06, 0.0, Math.hypot((u - hash(plank, 1, 2)) * 3, (pv - 0.5) * 1)) ;
      const edge = sstep(0.0, 0.1, pv) * sstep(1.0, 0.9, pv);
      const ph = hash(plank, 3, 4);
      const tone = (0.7 + ph * 0.3) * (0.8 + rings * 0.25) * mix(0.6, 1, edge) - knot * 0.3;
      b.setC(i, [base[0] * tone, base[1] * tone, base[2] * tone]);
      b.H[i] = edge * 0.6 + rings * 0.1 - knot * 0.2 + gr * 0.1;
      b.R[i] = 0.75 + rings * 0.15;
      // clavos en los extremos
      const nl = Math.min(Math.hypot((u - 0.06) * 6, (pv - 0.5)), Math.hypot((u - 0.94) * 6, (pv - 0.5)));
      if (nl < 0.12) { b.setC(i, [0.35, 0.33, 0.32]); b.H[i] += 0.3 * (1 - nl / 0.12); b.R[i] = 0.4; b.metal()[i] = 0.9; }
    });
    return bake(b, { normal: 4 });
  });
}

/** Cuerda trenzada (rayas diagonales). */
export function ropeTex(size) {
  return cached(`rope:${size}`, () => {
    const b = new Buf(size), c0 = hex(0xc9a86a), c1 = hex(0x8a6a3a);
    b.each((u, v, i) => {
      const s = ((u * 4 + v * 6) % 1 + 1) % 1, tw = Math.sin(s * Math.PI);
      const n = fbm(u, v, 16, 3, 5);
      b.setC(i, lerp3(c1, c0, tw * 0.8 + n * 0.2)); b.H[i] = tw * 0.8 + n * 0.2; b.R[i] = 0.95;
    });
    return bake(b, { normal: 6 });
  });
}

// ------------------------------------------------------------------ terreno (texturas periódicas en mundo)

/** Cuerpo del terreno: estratos + piedras. Cubre 4x4 unidades. */
export function dirtTex(theme, size) {
  return cached(`dirt:${theme}:${size}`, () => {
    const P = pal(theme), b = new Buf(size), cs = P.dirt.map(hex), pb = P.pebble.map(hex), vo = {};
    b.each((u, v, i) => {
      const warp = (fbm(u, v, 3, 4, 201) - 0.5) * 0.12;
      const layer = (v + warp + (fbm(u, v, 2, 2, 205) - 0.5) * 0.05) * 5; // 5 estratos en 4 unidades
      const li = Math.floor(layer), lf = layer - li;
      const lc = cs[wrap(li, 4)], ln = cs[wrap(li + 1, 4)];
      let c = lerp3(lc, ln, sstep(0.78, 1, lf)); c = lerp3(c, [c[0] * 0.72, c[1] * 0.7, c[2] * 0.68], sstep(0.7, 0.78, lf) * sstep(0.86, 0.78, lf));
      const n = fbm(u, v, 12, 5, 211), grain = hash((u * size) | 0, (v * size) | 0, 7);
      const tone = 0.78 + n * 0.4 + (grain - 0.5) * 0.08;
      c = [c[0] * tone, c[1] * tone, c[2] * tone];
      let h = n * 0.35 + sstep(0.85, 1, lf) * -0.1 + grain * 0.03;
      let r = 0.92;
      // piedras incrustadas: pocas, de tamaños variados, ovaladas y medio enterradas
      voronoi(u * 1.0, v, 7, 221, 0.85, vo);
      const sid = vo.id, has = hash(sid, 5, 6) > 0.62, pr = 0.16 + hash(sid, 2, 3) * 0.26;
      const ex = (u * 7 - vo.cx) / (0.8 + hash(sid, 3, 3) * 0.6), ey = (v * 7 - vo.cy) / (0.55 + hash(sid, 4, 3) * 0.35);
      const pd = Math.hypot(ex, ey) * (1 + (n - 0.5) * 0.5);
      if (has && pd < pr) {
        const k = Math.sqrt(1 - (pd / pr) ** 2), pc = pb[(hash(sid, 8, 9) * pb.length) | 0];
        const lit = clamp(0.62 + k * 0.3 + ey * 0.6 + (n - 0.5) * 0.4);
        const sc = lerp3(c, [pc[0] * lit, pc[1] * lit, pc[2] * lit], 0.75 * sstep(0, 0.3, k));
        c = sc; h += k * 0.55; r = 0.6;
      } else if (has && pd < pr + 0.08) { const ao = 1 - sstep(pr + 0.08, pr, pd) * 0.35; c = [c[0] * ao, c[1] * ao, c[2] * ao]; h -= 0.04; }
      // gravilla fina
      const gv = hash((u * size * 0.5) | 0, (v * size * 0.5) | 0, 17);
      if (gv > 0.985) { const gc = pb[1]; c = lerp3(c, gc, 0.5); h += 0.1; }
      if (theme === 'cueva') { const cr = hash((u * size) | 0, (v * size) | 0, 99); if (cr > 0.997) b.setE(i, [0.5, 0.9, 1], 1); else { const vein = sstep(0.02, 0, Math.abs(fbm(u, v, 3, 4, 231) - 0.5)); b.setE(i, [0.6, 0.3, 1], vein * 0.6); c = lerp3(c, [0.5, 0.4, 0.9], vein * 0.5); } }
      if (theme === 'castillo') { const vein = sstep(0.022, 0, Math.abs(fbm(u, v, 3, 4, 241) - 0.5)) * sstep(0.3, 0.7, fbm(u, v, 2, 2, 7)); b.setE(i, [1, 0.32, 0.04], vein * 1.4); c = lerp3(c, [0.2, 0.05, 0.02], vein); h -= vein * 0.3; }
      if (theme === 'pradera') { // raíces finas
        const root = sstep(0.012, 0, Math.abs(fbm(u, v, 4, 3, 251) - 0.5)) * sstep(0.5, 0.95, v); c = lerp3(c, [0.42, 0.28, 0.16], root * 0.7); h += root * 0.15;
      }
      b.setC(i, c); b.H[i] = h; b.R[i] = r;
    });
    return bake(b, { normal: 3 });
  });
}

/** Superficie superior (2x2 unidades): césped / roca / nube / basalto. */
export function capTopTex(theme, size) {
  return cached(`captop:${theme}:${size}`, () => {
    const P = pal(theme), b = new Buf(size), cs = P.capTop.map(hex), vo = {};
    b.each((u, v, i) => {
      const n = fbm(u, v, 6, 5, 301), blades = hash((u * size) | 0, (v * size * 0.5) | 0, 3), fine = fbm(u, v, 64, 2, 302);
      let c, h, r = 0.9;
      if (theme === 'pradera') {
        c = lerp3(cs[1], cs[0], n); c = lerp3(c, cs[2], sstep(0.62, 0.8, fbm(u, v, 4, 3, 303)) * 0.6);
        const t = 0.75 + blades * 0.35 + fine * 0.2; c = [c[0] * t, c[1] * t, c[2] * t];
        const clover = sstep(0.7, 0.75, fbm(u, v, 9, 2, 304)); c = lerp3(c, [0.3, 0.55, 0.16], clover * 0.5);
        h = blades * 0.4 + n * 0.3 + fine * 0.2; r = 0.85;
      } else if (theme === 'cueva') {
        voronoi(u, v, 6, 305, 0.9, vo); const ed = sstep(0.0, 0.06, vo.f2 - vo.f1);
        c = lerp3(cs[1], cs[2], n * 0.8 + hash(vo.id, 1, 1) * 0.3); const t = 0.7 + ed * 0.35 + fine * 0.15; c = [c[0] * t, c[1] * t, c[2] * t];
        h = ed * 0.5 + n * 0.3 + fine * 0.15; r = 0.6 + n * 0.3;
        if (blades > 0.993) b.setE(i, [0.4, 0.95, 1], 1); else b.setE(i, [0, 0, 0]);
      } else if (theme === 'cielo') {
        c = lerp3(cs[1], cs[0], sstep(0.3, 0.7, n)); c = lerp3(c, cs[2], fine * 0.4);
        h = n * 0.8 + fine * 0.2; r = 1;
      } else {
        voronoi(u, v, 4, 306, 0.6, vo); const ed = sstep(0.0, 0.05, vo.f2 - vo.f1);
        c = lerp3(cs[1], cs[2], hash(vo.id, 2, 2) * 0.6 + n * 0.4); const t = 0.6 + ed * 0.45 + fine * 0.15; c = [c[0] * t, c[1] * t, c[2] * t];
        h = ed * 0.6 + n * 0.25 + fine * 0.1; r = 0.75;
        const glow = (1 - ed) * sstep(0.45, 0.6, fbm(u, v, 3, 2, 307)); b.setE(i, [1, 0.3, 0.04], glow * 1.5); c = lerp3(c, [0.25, 0.05, 0.02], glow);
      }
      b.setC(i, c); b.H[i] = h; b.R[i] = r;
    });
    return bake(b, { normal: 4 });
  });
}

/** Lateral de la capa superior: u periódico (2 unidades), v=0 base..1 cima (no periódico). */
export function capSideTex(theme, size) {
  return cached(`capside:${theme}:${size}`, () => {
    const P = pal(theme), b = new Buf(size, size / 2), cs = P.capSide.map(hex), top = hex(P.capTop[0]);
    b.each((u, v, i) => {
      const n = fbm(u, v, 8, 4, 401, 2), col = (u * size * 0.7) | 0, bl = hash(col, 0, 5);
      const tip = 0.15 + bl * 0.35 + n * 0.2; // las briznas cuelgan hasta "tip"
      let c, h, r = 0.9;
      if (theme === 'pradera') {
        const blade = 0.5 + 0.5 * Math.sin(u * size * 0.7 * Math.PI * 2 * 0.5 + n * 4);
        c = lerp3(cs[1], cs[0], clamp(v * 0.9 + blade * 0.25)); c = lerp3(c, top, sstep(0.7, 1, v) * 0.7);
        const t = 0.7 + blade * 0.35; c = [c[0] * t, c[1] * t, c[2] * t];
        h = blade * 0.5 + v * 0.3;
      } else if (theme === 'cielo') {
        c = lerp3(cs[1], cs[0], sstep(0.0, 0.8, v + (n - 0.5) * 0.4)); h = n * 0.7; r = 1;
      } else {
        const vo = voronoi(u, v * 0.5, 6, 402, 0.8); const ed = sstep(0, 0.06, vo.f2 - vo.f1);
        c = lerp3(cs[1], cs[0], n * 0.6 + hash(vo.id, 1, 2) * 0.3); const t = 0.6 + ed * 0.4; c = [c[0] * t, c[1] * t, c[2] * t];
        h = ed * 0.5 + n * 0.3; r = 0.7;
        if (theme === 'castillo') { const g = (1 - ed) * sstep(0.5, 0.65, n); b.setE(i, [1, 0.3, 0.05], g * 1.4); }
        if (theme === 'cueva') { const g = sstep(0.75, 0.85, n) * (1 - ed); b.setE(i, [0.3, 0.9, 1], g * 0.6); }
      }
      void tip;
      b.setC(i, c); b.H[i] = h; b.R[i] = r;
    });
    return bake(b, { normal: 3 });
  });
}

/** Franja colgante (alfa): briznas de césped / musgo / nube. u periódico, v=1 arriba. */
export function fringeTex(theme, size) {
  return cached(`fringe:${theme}:${size}`, () => {
    const w = size, h = size / 4, b = new Buf(w, h), A = b.alpha(), P = pal(theme), cs = P.capSide.map(hex);
    const nb = theme === 'cielo' ? 10 : 46;
    for (let k = 0; k < w * h; k++) A[k] = 0;
    b.each((u, v, i) => {
      let best = 0, shade = 0;
      if (theme === 'cielo') {
        // bultos de nube redondos
        for (let j = 0; j < nb; j++) {
          const cx = (j + hash(j, 1, 3) * 0.5) / nb, rr = 0.35 + hash(j, 2, 3) * 0.45;
          let dx = Math.abs(u - cx); dx = Math.min(dx, 1 - dx); dx *= nb * 0.6;
          const dy = (1 - v) / rr, d = Math.hypot(dx, dy);
          if (d < 1) { best = Math.max(best, 1 - d); shade = Math.max(shade, Math.sqrt(1 - d * d)); }
        }
        A[i] = sstep(0.0, 0.08, best); b.setC(i, lerp3(cs[1], cs[0], 0.4 + shade * 0.6)); b.H[i] = shade; b.R[i] = 1; return;
      }
      for (let j = 0; j < nb; j++) {
        const cx = (j + hash(j, 1, 3)) / nb, len = 0.35 + hash(j, 2, 3) * 0.65, wid = 0.45 / nb * (0.7 + hash(j, 4, 3) * 0.6);
        const bend = (hash(j, 5, 3) - 0.5) * 0.02;
        const t = 1 - v; if (t > len) continue;
        let dx = u - (cx + bend * t * t * 40); dx -= Math.round(dx);
        const ww = wid * (1 - t / len) ** 0.7;
        if (Math.abs(dx) < ww) { const s = 1 - Math.abs(dx) / ww; if (s > best) { best = s; shade = 1 - t / len; } }
      }
      A[i] = best > 0 ? 1 : 0;
      let c = theme === 'pradera' ? lerp3(hex(0x2f7a1c), cs[0], shade) : theme === 'cueva' ? lerp3(hex(0x1a6a7a), hex(0x4af0e0), shade) : lerp3(hex(0x1a1418), hex(0x3a2a2a), shade);
      c = [c[0] * (0.7 + best * 0.4), c[1] * (0.7 + best * 0.4), c[2] * (0.7 + best * 0.4)];
      b.setC(i, c); b.H[i] = best; b.R[i] = 0.85;
      if (theme === 'cueva') b.setE(i, [0.2, 0.9, 0.85], (1 - shade) * 0.8 * best);
    });
    return bake(b, { normal: 2 });
  });
}

/** Mechón de hierba (alfa) para tarjetas cruzadas. */
export function tuftTex(theme, size) {
  return cached(`tuft:${theme}:${size}`, () => {
    const b = new Buf(size), A = b.alpha(); A.fill(0);
    const P = pal(theme), c0 = hex(P.capTop[1]), c1 = hex(P.capTop[2]);
    const N = 22;
    const blades = []; for (let j = 0; j < N; j++) blades.push({ x: 0.5 + (hash(j, 1, 9) - 0.5) * 0.7, len: 0.45 + hash(j, 2, 9) * 0.5, lean: (hash(j, 3, 9) - 0.5) * 0.9, w: 0.025 + hash(j, 4, 9) * 0.03 });
    b.each((u, v, i) => {
      let best = 0, sh = 0;
      for (const bl of blades) {
        if (v > bl.len) continue; const t = v / bl.len;
        const cx = bl.x + bl.lean * t * t * 0.4, ww = bl.w * (1 - t) ** 0.8;
        const d = Math.abs(u - cx); if (d < ww) { const s = 1 - d / ww; if (s > best) { best = s; sh = t; } }
      }
      A[i] = best > 0 ? 1 : 0;
      const c = lerp3([c0[0] * 0.5, c0[1] * 0.55, c0[2] * 0.5], c1, sh);
      b.setC(i, [c[0] * (0.75 + best * 0.35), c[1] * (0.75 + best * 0.35), c[2] * (0.75 + best * 0.35)]);
      b.H[i] = best; b.R[i] = 0.8;
    });
    return bake(b, { normal: 1, repeat: false });
  });
}

/** Lava: color emisivo periódico (para desplazar en el shader). */
export function lavaTex(size) {
  return cached(`lava:${size}`, () => {
    const b = new Buf(size), vo = {};
    b.each((u, v, i) => {
      const n = fbm(u, v, 4, 5, 501); voronoi(u, v, 5, 502, 0.9, vo);
      const cr = sstep(0.0, 0.12, vo.f2 - vo.f1);
      const heat = clamp((1 - cr) * 0.9 + n * 0.5 - 0.15);
      b.setC(i, [heat, heat, heat]); b.H[i] = cr; b.R[i] = 1;
    });
    return bake(b, { normal: 2 });
  });
}
