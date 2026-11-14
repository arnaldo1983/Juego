// Geometría propia: caja redondeada (biselada) con UV por cara, y fusión por material.
import * as THREE from 'three';

// Cara: [eje normal, signo, eje u, signo u, eje v, signo v]
const FACES = [
  [0, 1, 2, -1, 1, 1], // +x
  [0, -1, 2, 1, 1, 1], // -x
  [1, 1, 0, 1, 2, -1], // +y
  [1, -1, 0, 1, 2, 1], // -y
  [2, 1, 0, 1, 1, 1], // +z
  [2, -1, 0, -1, 1, 1], // -z
];

function coords(half, r, seg, maxStep) {
  const inner = half - r, out = [];
  for (let k = seg; k >= 1; k--) out.push(-inner - r * Math.tan((k / seg) * Math.PI / 4));
  const span = 2 * inner, n = Math.max(1, Math.ceil(span / maxStep - 1e-6));
  for (let k = 0; k <= n; k++) out.push(-inner + (span * k) / n);
  for (let k = 1; k <= seg; k++) out.push(inner + r * Math.tan((k / seg) * Math.PI / 4));
  return out;
}

/**
 * Caja redondeada. size=[sx,sy,sz], r radio de bisel, seg segmentos del bisel.
 * opts.worldUV: escala de UV en unidades de mundo (u,v = coordenadas/escala); si no, 0..1 por cara.
 * opts.maxStep: subdivisión máxima de las caras planas. opts.faceMat: índice de material por cara (6).
 * opts.offset: [x,y,z] traslación. opts.vRange: para caras laterales, v en 0..1 a lo alto (ignora worldUV en v).
 */
export function roundedBox(sx, sy, sz, r = 0.08, seg = 3, opts = {}) {
  const half = [sx / 2, sy / 2, sz / 2];
  r = Math.min(r, half[0] - 1e-3, half[1] - 1e-3, half[2] - 1e-3);
  const maxStep = opts.maxStep ?? 1e9, wuv = opts.worldUV, off = opts.offset || [0, 0, 0];
  const faceMat = opts.faceMat || [0, 0, 0, 0, 0, 0];
  const pos = [], nor = [], uv = [], idx = [], groups = [];
  const C = half.map((h) => coords(h, r, seg, maxStep));
  const p = [0, 0, 0], inner = [0, 0, 0];
  FACES.forEach(([na, ns, ua, us, va, vs], f) => {
    const cu = C[ua], cv = C[va], base = pos.length / 3, start = idx.length;
    for (let j = 0; j < cv.length; j++) for (let i = 0; i < cu.length; i++) {
      p[na] = ns * half[na]; p[ua] = us * cu[i]; p[va] = vs * cv[j];
      for (let a = 0; a < 3; a++) { const lim = half[a] - r; inner[a] = Math.max(-lim, Math.min(lim, p[a])); }
      let dx = p[0] - inner[0], dy = p[1] - inner[1], dz = p[2] - inner[2]; const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      pos.push(inner[0] + dx * r + off[0], inner[1] + dy * r + off[1], inner[2] + dz * r + off[2]); nor.push(dx, dy, dz);
      let u, v;
      if (wuv) { u = (us * cu[i] + off[ua]) / wuv; v = (vs * cv[j] + off[va]) / wuv; if (opts.vRange && na !== 1) v = (cv[j] + half[va]) / (2 * half[va]); }
      else { u = (cu[i] + half[ua]) / (2 * half[ua]); v = (cv[j] + half[va]) / (2 * half[va]); }
      uv.push(u, v);
    }
    const nu = cu.length;
    for (let j = 0; j < cv.length - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const a = base + j * nu + i, b = a + 1, c = a + nu, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
    groups.push({ start, count: idx.length - start, materialIndex: faceMat[f] });
  });
  // corregir orientación por cara (CCW hacia fuera)
  const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  for (const g of groups) {
    // buscar un triángulo no degenerado
    for (let t = g.start; t < g.start + g.count; t += 3) {
      const a = P(idx[t]), b = P(idx[t + 1]), c = P(idx[t + 2]);
      const n = b.clone().sub(a).cross(c.clone().sub(a)); if (n.lengthSq() < 1e-10) continue;
      const k = idx[t]; const nn = new THREE.Vector3(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
      if (n.dot(nn) < 0) for (let s = g.start; s < g.start + g.count; s += 3) { const tmp = idx[s + 1]; idx[s + 1] = idx[s + 2]; idx[s + 2] = tmp; }
      break;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);
  return geo;
}

/**
 * Fusiona geometrías indexadas (position, normal, uv y opcionales color/aux) agrupando por materialIndex.
 * Cada geometría puede tener grupos; si no, usa materialIndex 0. attrs = nombres de atributos a copiar.
 */
export function mergeByMaterial(geos, attrs = ['position', 'normal', 'uv']) {
  const out = {}; for (const a of attrs) out[a] = [];
  const buckets = new Map(); let base = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    for (const a of attrs) {
      const at = g.attributes[a]; const arr = out[a];
      if (at) for (let i = 0; i < at.array.length; i++) arr.push(at.array[i]);
      else { const sz = a === 'uv' ? 2 : a === 'aux' ? 1 : 3; for (let i = 0; i < n * sz; i++) arr.push(a === 'color' ? 1 : 0); }
    }
    const index = g.index ? g.index.array : [...Array(n).keys()];
    const gs = g.groups.length ? g.groups : [{ start: 0, count: index.length, materialIndex: 0 }];
    for (const gr of gs) {
      const m = gr.materialIndex ?? 0; if (!buckets.has(m)) buckets.set(m, []);
      const bk = buckets.get(m); for (let k = gr.start; k < gr.start + gr.count; k++) bk.push(index[k] + base);
    }
    base += n;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  const sizes = { position: 3, normal: 3, uv: 2, color: 3, aux: 1 };
  for (const a of attrs) geo.setAttribute(a, new THREE.Float32BufferAttribute(out[a], sizes[a] ?? 3));
  const idx = []; const keys = [...buckets.keys()].sort((a, b) => a - b);
  for (const k of keys) { const s = idx.length; const bk = buckets.get(k); for (let i = 0; i < bk.length; i++) idx.push(bk[i]); geo.addGroup(s, bk.length, k); }
  geo.setIndex(base > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}

/** Aplica una matriz a una geometría (posiciones y normales). */
export function xform(geo, m) { geo.applyMatrix4(m); return geo; }
export const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sy = s, sz = s) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, sy, sz));

/** Añade atributo color constante (para fusionar con vertexColors). */
export function tint(geo, c) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}

/** Convierte geometría no indexada a indexada simple (para mergeByMaterial). */
export function ensureIndex(geo) {
  if (!geo.index) { const n = geo.attributes.position.count; geo.setIndex([...Array(n).keys()]); }
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  return geo;
}
