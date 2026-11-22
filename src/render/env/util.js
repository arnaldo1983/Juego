// Utilidades compartidas del entorno: ruido, RNG, tiras de terreno, instancias, texturas procedurales.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const perlin = new ImprovedNoise();
/** Ruido 2D en [-1,1] aprox. */
export const noise2 = (x, y, s = 0) => perlin.noise(x, y, s * 17.31 + 0.5);
/** fBm 2D en [-1,1] aprox. */
export function fbm(x, y, oct = 4, s = 0) {
  let a = 0.5, f = 1, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * perlin.noise(x * f, y * f, s * 17.31 + i * 3.7 + 0.5); n += a; a *= 0.5; f *= 2.03; }
  return t / n * 1.6;
}
/** RNG determinista (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (a0, a1) => a0 + (a1 - a0) * r();
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  return r;
}
export const col = (hex) => new THREE.Color(hex);
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Marca geometría como compartida (main.js no la libera) y la devuelve. */
export const shared = (g) => { g.userData.shared = true; return g; };

/** Pinta una geometría con un color por vértice (opcionalmente con degradado vertical / por normal). */
export function paint(g, c, { top = null, y0 = 0, y1 = 1, shadeBottom = 0 } = {}) {
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position, n = g.attributes.normal, arr = new Float32Array(p.count * 3);
  const a = col(c), b = top ? col(top) : a, t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    t.copy(a).lerp(b, smooth(y0, y1, p.getY(i)));
    if (shadeBottom && n) t.multiplyScalar(1 - shadeBottom * Math.max(0, -n.getY(i)));
    arr[i * 3] = t.r; arr[i * 3 + 1] = t.g; arr[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
/** Desplaza vértices con ruido (mantiene costuras usando la posición como semilla). */
export function jitter(g, amt, freq = 1.5, seed = 0) {
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.normal) g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = amt * perlin.noise(x * freq + seed, y * freq, z * freq);
    const l = Math.hypot(x, y, z) || 1;
    p.setXYZ(i, x + (x / l) * k, y + (y / l) * k, z + (z / l) * k);
  }
  g.computeVertexNormals();
  return g;
}
export function merge(list) {
  const gs = list.map((g) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; });
  const m = mergeGeometries(gs, false);
  return m;
}
export const xf = (g, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx } = {}) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return g.applyMatrix4(m);
};

/**
 * Tira de terreno (heightfield) en el plano XZ.
 * @param {{x0:number,x1:number,dx:number,zs:number[],h:(x:number,z:number)=>number,c:(x:number,z:number,y:number,ny:number)=>THREE.Color,skirt?:number,skirtColor?:THREE.Color}} o
 */
export function heightStrip(o) {
  const nx = Math.ceil((o.x1 - o.x0) / o.dx) + 1;
  const rows = o.zs.slice();
  const skirt = o.skirt != null;
  if (skirt) rows.unshift(rows[0] + 0.02, rows[0] + 0.01);
  const nz = rows.length;
  const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = o.x0 + i * o.dx, z = rows[j];
    const y = skirt && j === 0 ? o.skirt : skirt && j === 1 ? o.h(x, rows[2]) - (o.lipDepth ?? 1.4) : o.h(x, z);
    const k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (o.flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const v = j * nx + i, k = v * 3;
    const c = skirt && j === 0 ? (o.skirtColor || col(0x000000)) : skirt && j === 1 ? (o.lipColor || o.skirtColor || col(0x000000)) : o.c(pos[k], pos[k + 2], pos[k + 1], n.getY(v));
    colr[k] = c.r; colr[k + 1] = c.g; colr[k + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * Superficie paramétrica genérica (paredes verticales, etc.). fn(u,v) -> [x,y,z]; c(x,y,z,n) -> Color.
 * Las caras miran hacia +Z cuando u crece en X y v crece en Y.
 */
export function surface(us, vs, fn, c) {
  const nu = us.length, nv = vs.length, pos = new Float32Array(nu * nv * 3), colr = new Float32Array(nu * nv * 3);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) pos.set(fn(us[i], vs[j]), (j * nu + i) * 3);
  const idx = [];
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i, b = a + 1, cc = a + nu, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal, nn = new THREE.Vector3();
  for (let v = 0; v < nu * nv; v++) { nn.fromBufferAttribute(n, v); const k = v * 3; const cl = c(pos[k], pos[k + 1], pos[k + 2], nn); colr[k] = cl.r; colr[k + 1] = cl.g; colr[k + 2] = cl.b; }
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.computeBoundingSphere();
  return g;
}
export const range = (a, b, step) => { const out = []; for (let x = a; x < b + step * 0.5; x += step) out.push(Math.min(x, b)); return out; };

/** Crea un InstancedMesh a partir de una lista de transformaciones {x,y,z,s,sx,sy,sz,rx,ry,rz,c}. */
export function instanced(geo, mat, list, { shadow = false, receive = false } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  list.forEach((it, i) => {
    e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e);
    const k = it.s ?? 1; s.set((it.sx ?? 1) * k, (it.sy ?? 1) * k, (it.sz ?? 1) * k); p.set(it.x, it.y, it.z);
    M.compose(p, q, s); m.setMatrixAt(i, M);
    if (it.c != null) m.setColorAt(i, c.set(it.c));
  });
  m.count = list.length;
  m.castShadow = shadow; m.receiveShadow = receive;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  m.computeBoundingBox && m.computeBoundingBox();
  return m;
}

/** Material PBR con brillo emisivo proporcional al color de instancia/vértice (cristales, ventanas, lava). */
export function glowMaterial(opts, glow = 1.5) {
  const m = new THREE.MeshStandardMaterial(opts);
  m.userData.glow = { value: glow };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = m.userData.glow;
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)\n totalEmissiveRadiance += vColor.rgb * uGlow;\n#endif');
  };
  m.customProgramCacheKey = () => 'glow';
  return m;
}

// ---------------------------------------------------------------- texturas
const texCache = new Map();
export function canvasTex(key, w, h, draw, { repeat = false, srgb = true, mip = true } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = mip; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Atlas 2x2 de nubes en escala de grises (R = iluminación, A = cobertura). */
export function cloudAtlas() {
  return canvasTex('cloudAtlas', 1024, 512, (g, W, H) => {
    const r = rng(77);
    for (let cell = 0; cell < 4; cell++) {
      const ox = (cell % 2) * 512, oy = Math.floor(cell / 2) * 256, cw = 512, ch = 256;
      g.save(); g.beginPath(); g.rect(ox, oy, cw, ch); g.clip();
      // Forma: puffs a lo largo de una base
      const puffs = [];
      const n = 7 + Math.floor(r() * 5), base = oy + ch * 0.74;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, px = ox + cw * (0.12 + 0.76 * t) + r.range(-12, 12);
        const bell = Math.sin(t * Math.PI);
        const rad = (28 + 62 * bell * (0.6 + r() * 0.5)) * (cell === 3 ? 0.75 : 1);
        puffs.push([px, base - rad * (0.35 + r() * 0.5), rad]);
      }
      // Capa de sombra (más grande, gris) y luz (blanco desplazado arriba)
      for (const pass of [0, 1, 2]) {
        for (const [px, py, rad] of puffs) {
          const rr = pass === 0 ? rad * 1.04 : pass === 1 ? rad * 0.9 : rad * 0.55;
          const cy = pass === 0 ? py : pass === 1 ? py - rad * 0.12 : py - rad * 0.35;
          const cx = pass === 2 ? px - rad * 0.15 : px;
          const v = pass === 0 ? 120 : pass === 1 ? 205 : 255;
          const gr = g.createRadialGradient(cx, cy, rr * 0.2, cx, cy, rr);
          gr.addColorStop(0, `rgba(${v},${v},${v},1)`);
          gr.addColorStop(0.72, `rgba(${v},${v},${v},${pass === 0 ? 0.95 : 0.6})`);
          gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
          g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
        }
      }
      // base plana difuminada
      const lg = g.createLinearGradient(0, base - 10, 0, base + 26);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = lg; g.fillRect(ox, base - 10, cw, ch);
      g.globalCompositeOperation = 'source-over';
      g.restore();
    }
  });
}
/** Disco suave radial (blanco). */
export function softDot() {
  return canvasTex('softDot', 128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
/** Rayo de luz vertical (degradado en ambos ejes). */
export function rayTex() {
  return canvasTex('ray', 128, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1), a = Math.pow(Math.sin(t * Math.PI), 2.2);
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.35})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x, 0, 1, h);
    }
  });
}
/** Agua cayendo: vetas verticales repetibles. */
export function streakTex() {
  return canvasTex('streak', 64, 256, (g, w, h) => {
    const r = rng(9);
    g.fillStyle = 'rgba(200,235,255,0.55)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = r() * w, y = r() * h, l = 20 + r() * 90, a = 0.3 + r() * 0.7;
      g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, 1 + r() * 2.5, l); g.fillRect(x, y - h, 1 + r() * 2.5, l);
    }
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.18, 'rgba(0,0,0,0)'); gr.addColorStop(0.82, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: true });
}
/** Lava: textura repetible naranja con costra oscura. */
export function lavaTex() {
  return canvasTex('lava', 256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w * Math.PI * 2, v = y / h * Math.PI * 2;
      // ruido periódico (tileable) sobre un toro
      const n = perlin.noise(Math.cos(u) * 1.6 + 5, Math.sin(u) * 1.6 + Math.cos(v) * 1.6, Math.sin(v) * 1.6) +
        0.5 * perlin.noise(Math.cos(u) * 3.2 + 9, Math.sin(u) * 3.2 + Math.cos(v) * 3.2, Math.sin(v) * 3.2 + 4);
      const t = Math.min(1, Math.max(0, n * 1.3 + 0.55));
      const k = (y * w + x) * 4;
      const crust = smooth(0.15, 0.45, 1 - t);
      d[k] = 255 * (1 - crust * 0.82); d[k + 1] = (90 + 150 * t * t) * (1 - crust * 0.9); d[k + 2] = (20 + 60 * t * t * t) * (1 - crust); d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: true });
}
/** Silueta borrosa para primer plano (hierba / rocas) en blanco, alpha suave. */
export function fgTex(kind) {
  return canvasTex('fg_' + kind, 512, 256, (g, w, h) => {
    const r = rng(kind === 'grass' ? 3 : 5);
    g.filter = 'blur(6px)';
    g.fillStyle = '#fff';
    if (kind === 'grass') {
      for (let i = 0; i < 70; i++) {
        const x = r() * w, bh = h * (0.35 + r() * 0.6), bw = 6 + r() * 14, lean = (r() - 0.5) * 80;
        g.beginPath(); g.moveTo(x - bw, h); g.quadraticCurveTo(x + lean * 0.3, h - bh * 0.6, x + lean, h - bh); g.quadraticCurveTo(x + lean * 0.3 + bw * 0.4, h - bh * 0.5, x + bw, h); g.fill();
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const x = r() * w, rad = 50 + r() * 90; g.beginPath(); g.ellipse(x, h, rad, rad * (0.6 + r() * 0.6), 0, 0, Math.PI * 2); g.fill();
      }
    }
    g.filter = 'none';
  });
}
