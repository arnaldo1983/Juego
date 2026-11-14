// Terreno orgánico para las casillas de suelo (#): cuerpo de tierra con estratos teselado y deformado,
// capa superior redondeada que sobresale, franja colgante, mechones/cristales/nubes/basalto según tema.
import * as THREE from 'three';
import { T } from '../../config.js';
import { roundedBox, mergeByMaterial, M4, tint, ensureIndex } from './geometry.js';
import { hash, sstep, mix, rng } from '../textures.js';

export const ZB = -4.2, ZF = 1.0, YB = -12, EXT = 16;

// ruido de valor 3D (no periódico) para deformar vértices de forma continua
function n3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => hash(a + c * 7919, b, s);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}
function disp(x, y, z, amp) {
  const f = 1.35;
  return [x + (n3(x * f, y * f, z * f, 1) - 0.5) * 2 * amp, y + (n3(x * f, y * f, z * f, 2) - 0.5) * 2 * amp * 0.7, z + (n3(x * f, y * f, z * f, 3) - 0.5) * 2 * amp];
}

/** Constructor de malla indexada con deduplicación de vértices por clave. */
class MeshBuf {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.idx = []; this.map = new Map(); }
  v(key, p, uv, c) {
    let i = this.map.get(key);
    if (i === undefined) { i = this.pos.length / 3; this.map.set(key, i); this.pos.push(p[0], p[1], p[2]); this.uv.push(uv[0], uv[1]); this.col.push(c, c, c); }
    return i;
  }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  geometry() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
}

/**
 * Construye el terreno. Devuelve {meshes:[], tops:[{a,b,h}]}
 * @param {import('../../level.js').Level} level
 */
export function buildTerrain(level, theme, quality, mats) {
  const W = level.w, H = level.h;
  const g0 = (x, y) => { const cx = x < 0 ? 0 : x >= W ? W - 1 : x; if (y < YB) return false; if (y < 0) return level.tiles[cx] === T.GROUND; if (y >= H) return false; return level.tiles[y * W + cx] === T.GROUND; };
  const solid = g0;
  const step = quality === 'low' ? 1 : 0.5, amp = 0.085;
  const X0 = -EXT, X1 = W + EXT;
  const topCache = new Map();
  const colTop = (c, y) => { // cima del tramo sólido de la columna c que contiene la cota y
    let cy = Math.floor(y + 1e-4); if (!solid(c, cy)) cy -= 1; if (!solid(c, cy)) return null;
    const k = c * 1000 + cy; let r = topCache.get(k); if (r !== undefined) return r;
    let t = cy; while (solid(c, t + 1)) t++; r = t + 1; topCache.set(k, r); return r;
  };
  const depthAt = (x, y) => {
    const ci = Math.floor(x + 1e-4), cands = Math.abs(x - Math.round(x)) < 1e-4 ? [ci - 1, ci] : [ci];
    let best = null; for (const c of cands) { const t = colTop(c, y); if (t !== null && (best === null || t > best)) best = t; }
    return best === null ? 0 : best - y;
  };
  const shadeFor = (d, zf = 1) => {
    let s = mix(0.42, 1, sstep(0.0, 0.75, d)); // AO bajo la capa superior
    s *= mix(1, 0.32, sstep(1.0, 11, d)); // más oscuro en profundidad
    return s * zf;
  };
  const CH = 24; const chunks = new Map();
  const chunk = (x) => { const k = Math.floor((x - X0) / CH); if (!chunks.has(k)) chunks.set(k, new MeshBuf()); return chunks.get(k); };
  const UVS = 4; // la textura cubre 4 unidades
  const ns = Math.round(1 / step);

  // ---------------- cara frontal (z = ZF)
  for (let x = X0; x < X1; x++) {
    const mb = chunk(x);
    for (let y = YB; y < H; y++) {
      if (!solid(x, y)) continue;
      const big = y < -3 && quality !== 'high';
      const n = big ? 1 : ns, st = 1 / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const vs = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => {
          const px = x + a * st, py = y + b * st, key = `f${Math.round(px * 4)},${Math.round(py * 4)}`;
          const d = depthAt(px, py), p = disp(px, py, ZF, amp * sstep(0.0, 0.25, d) + 0.02);
          return mb.v(key, p, [px / UVS, py / UVS], shadeFor(d));
        });
        mb.quad(vs[0], vs[1], vs[2], vs[3]);
      }
    }
  }
  // ---------------- paredes laterales (abismos y escalones)
  const zsteps = []; for (let z = ZF; z > ZB - 1e-6; z -= 0.6) zsteps.push(z); if (zsteps[zsteps.length - 1] > ZB + 1e-3) zsteps.push(ZB);
  for (let x = X0; x < X1; x++) {
    for (let y = YB; y < H; y++) {
      if (!solid(x, y)) continue;
      for (const side of [-1, 1]) {
        if (solid(x + side, y)) continue;
        const X = side < 0 ? x : x + 1, mb = chunk(x);
        const n = y < -3 && quality !== 'high' ? 1 : ns, st = 1 / n;
        for (let j = 0; j < n; j++) for (let k = 0; k < zsteps.length - 1; k++) {
          const quad = [[k, j], [k + 1, j], [k + 1, j + 1], [k, j + 1]].map(([a, b]) => {
            const z = zsteps[a], py = y + b * st, key = `s${X},${side},${Math.round(z * 100)},${Math.round(py * 4)}`;
            const d = depthAt(X - side * 0.5, py);
            const zf = mix(0.5, 1, (z - ZB) / (ZF - ZB));
            const p = disp(X, py, z, (amp * sstep(0.0, 0.25, d) + 0.02));
            return mb.v(key, p, [z / UVS, py / UVS], shadeFor(d, zf));
          });
          if (side > 0) mb.quad(quad[0], quad[1], quad[2], quad[3]); else mb.quad(quad[0], quad[3], quad[2], quad[1]);
        }
      }
      // cara inferior (suelo flotante)
      if (y > YB && !solid(x, y - 1)) {
        const mb = chunk(x);
        for (let k = 0; k < zsteps.length - 1; k++) {
          const q = [[0, k], [1, k], [1, k + 1], [0, k + 1]].map(([a, b]) => {
            const px = x + a, z = zsteps[b], key = `b${Math.round(px * 4)},${y},${Math.round(z * 100)}`;
            return mb.v(key, disp(px, y, z, 0.05), [px / UVS, z / UVS], 0.35);
          });
          mb.quad(q[0], q[3], q[2], q[1]);
        }
      }
    }
  }
  const meshes = [];
  for (const mb of chunks.values()) {
    const g = mb.geometry(); if (!g) continue;
    const m = new THREE.Mesh(g, mats.body); m.receiveShadow = true; m.castShadow = quality === 'high';
    meshes.push(m);
  }

  // ---------------- capas superiores (tramos con cielo encima)
  const tops = [];
  for (let y = 0; y < H; y++) {
    let a = null;
    for (let x = X0; x <= X1; x++) {
      const ok = x < X1 && solid(x, y) && !solid(x, y + 1);
      if (ok && a === null) a = x;
      if (!ok && a !== null) { tops.push({ a, b: x - 1, h: y + 1, openL: !solid(a - 1, y), openR: !solid(x, y) }); a = null; }
    }
  }
  const capGeos = [], fringe = new MeshBuf(), th = theme === 'cielo' ? 0.5 : 0.42, ovx = 0.1, ovz = 0.2;
  const capMax = quality === 'low' ? 4 : 1;
  for (const t of tops) {
    const x0 = t.a - ovx, x1 = t.b + 1 + ovx, z0 = ZB - 0.1, z1 = ZF + ovz;
    const top = t.h + 0.04, bot = t.h - th + 0.04;
    const g = roundedBox(x1 - x0, top - bot, z1 - z0, theme === 'castillo' ? 0.08 : 0.17, quality === 'low' ? 2 : 3,
      { worldUV: 2, vRange: true, maxStep: capMax, offset: [(x0 + x1) / 2, (top + bot) / 2, (z0 + z1) / 2], faceMat: [1, 1, 0, 1, 1, 1] });
    // ondulación suave del césped
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
      if (Y > top - 0.05) p.setY(i, Y + (n3(X * 0.9, 0, Z * 0.9, 9) - 0.5) * 0.06 * sstep(0.2, -1, Z));
      p.setZ(i, Z + (Z > ZF ? (n3(X * 1.3, Y, 0, 4) - 0.5) * 0.08 : 0));
    }
    g.computeVertexNormals();
    capGeos.push(g);
    // franja colgante frontal
    if (mats.fringe) {
      const fh = theme === 'cielo' ? 0.42 : 0.34, fy = bot + 0.1, zf = ZF + ovz - 0.06;
      const addStrip = (pts, ukey) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const q = [];
          for (const [k, vv] of [[i, 1], [i + 1, 1], [i + 1, 0], [i, 0]]) {
            const [px, pz, u] = pts[k], dy = vv ? 0 : (n3(px * 2, 0, pz * 2, 6) - 0.5) * 0.12;
            q.push(fringe.v(`${ukey}${k},${vv}`, [px, fy - (1 - vv) * fh + dy, pz + (1 - vv) * 0.04], [u / 1.6, vv], 1));
          }
          fringe.quad(q[0], q[3], q[2], q[1]);
        }
      };
      const front = []; for (let x = x0; x <= x1 + 1e-6; x += 0.5) front.push([x, zf + (n3(x, 0, 0, 7) - 0.5) * 0.05, x]);
      addStrip(front, `F${t.a},${t.h},`);
      if (t.openL) { const s = []; for (let z = ZB; z <= zf + 1e-6; z += 0.6) s.push([x0 + 0.06, z, z]); s.push([x0 + 0.06, zf, zf]); addStrip(s.reverse().map(([px, pz, u]) => [px, pz, u]), `L${t.a},${t.h},`); }
      if (t.openR) { const s = []; for (let z = ZB; z <= zf + 1e-6; z += 0.6) s.push([x1 - 0.06, z, z]); s.push([x1 - 0.06, zf, zf]); addStrip(s, `R${t.a},${t.h},`); }
    }
  }
  if (capGeos.length) {
    const cg = mergeByMaterial(capGeos);
    const m = new THREE.Mesh(cg, [mats.capTop, mats.capSide]); m.receiveShadow = true; m.castShadow = true; meshes.push(m);
  }
  const fg = fringe.geometry();
  if (fg) { fg.computeVertexNormals(); const m = new THREE.Mesh(fg, mats.fringe); m.castShadow = true; m.receiveShadow = true; meshes.push(m); }
  return { meshes, tops };
}

// ------------------------------------------------------------------ decorado de superficie (instanciado)

/** Geometría de mechón: 3 tarjetas cruzadas. */
function tuftGeo() {
  const gs = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.PlaneGeometry(0.62, 0.42); g.translate(0, 0.21, 0); g.rotateY((k / 3) * Math.PI + 0.3);
    gs.push(g);
  }
  const g = mergeByMaterial(gs); g.userData.shared = true; return g;
}
function crystalGeo() {
  const gs = []; const r = rng(5);
  for (let k = 0; k < 4; k++) {
    const g = new THREE.OctahedronGeometry(0.16, 0); g.scale(0.8, 3.2 - k * 0.5, 0.8); g.translate(0, 0.35, 0);
    const a = r() * 6.28, tilt = 0.15 + r() * 0.45;
    g.applyMatrix4(M4((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25, Math.cos(a) * tilt, r() * 3, Math.sin(a) * tilt, 0.6 + r() * 0.5));
    gs.push(ensureIndex(g));
  }
  const g = mergeByMaterial(gs); g.userData.shared = true; return g;
}
function puffGeo() { const g = new THREE.IcosahedronGeometry(0.5, 2); g.userData.shared = true; return g; }
function hexGeo() { const g = new THREE.CylinderGeometry(0.22, 0.25, 0.5, 6); g.translate(0, 0.25, 0); g.userData.shared = true; return g; }
function flowerGeo() {
  const gs = [];
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.26, 4); stem.translate(0, 0.13, 0); tint(ensureIndex(stem), [0.25, 0.5, 0.15]);
  const aux = (g, v) => { g.setAttribute('aux', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1)); return g; };
  aux(stem, 0); gs.push(stem);
  for (let k = 0; k < 5; k++) {
    const p = new THREE.SphereGeometry(0.055, 6, 4); p.scale(1, 0.35, 0.6); p.translate(0.06, 0, 0); p.rotateY((k / 5) * Math.PI * 2); p.rotateX(0.5); p.translate(0, 0.27, 0);
    tint(p, [1, 1, 1]); aux(p, 1); gs.push(p);
  }
  const c = new THREE.SphereGeometry(0.035, 6, 4); c.rotateX(0.5); c.translate(0, 0.28, 0.01); tint(c, [1, 0.8, 0.15]); aux(c, 0); gs.push(c);
  const g = mergeByMaterial(gs, ['position', 'normal', 'uv', 'color', 'aux']); g.userData.shared = true; return g;
}
const GEO = {};
const geoOf = (k, f) => (GEO[k] ??= f());

/** Coloca decorado sobre los tramos superiores. Devuelve meshes instanciados. */
export function buildDecor(tops, theme, quality, mats, level) {
  const dens = quality === 'low' ? 0.35 : quality === 'medium' ? 0.7 : 1;
  const r = rng(1234 + level.w);
  const out = [];
  const place = (geo, mat, items, opts = {}) => {
    if (!items.length) return;
    const m = new THREE.InstancedMesh(geo, mat, items.length); const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    items.forEach((it, i) => {
      e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e);
      mx.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.sy ?? it.s, it.sz ?? it.s)); m.setMatrixAt(i, mx);
      if (it.c) m.setColorAt(i, it.c);
    });
    m.castShadow = !!opts.cast; m.receiveShadow = true; m.frustumCulled = false; out.push(m);
  };
  const lane = (z) => Math.abs(z) < 0.62; // carril del jugador: dejar libre
  const zFront = () => 0.62 + r() * 0.5, zBack = () => -1.0 - r() * 3.1;
  if (theme === 'pradera') {
    const tufts = [], flowers = [];
    const pastel = [0xffffff, 0xffe066, 0xff8fb8, 0xb59cff, 0xff6b6b, 0x8fd3ff].map((c) => new THREE.Color(c));
    for (const t of tops) for (let x = t.a; x <= t.b; x++) {
      const nf = 2.2 * dens, nb = 2.6 * dens;
      for (let k = 0; k < nf; k++) if (r() < nf - k) tufts.push({ x: x + r(), y: t.h + 0.02, z: zFront(), ry: r() * 6, s: 0.55 + r() * 0.5 });
      for (let k = 0; k < nb; k++) if (r() < nb - k) tufts.push({ x: x + r(), y: t.h + 0.02, z: zBack(), ry: r() * 6, s: 0.7 + r() * 0.7 });
      if (r() < 0.55 * dens) flowers.push({ x: x + r(), y: t.h + 0.02, z: r() < 0.3 ? zFront() : zBack(), ry: (r() - 0.5) * 0.6, s: 0.8 + r() * 0.6, c: pastel[(r() * pastel.length) | 0] });
    }
    place(geoOf('tuft', tuftGeo), mats.tuft, tufts);
    place(geoOf('flower', flowerGeo), mats.flower, flowers);
  } else if (theme === 'cueva') {
    const cr = [], cols = [0x48e6ff, 0xd060ff, 0x60ffd0, 0x7a8cff].map((c) => new THREE.Color(c));
    for (const t of tops) for (let x = t.a; x <= t.b; x++) {
      if (r() < 0.22 * dens) cr.push({ x: x + r(), y: t.h - 0.05, z: zFront() + 0.1, ry: r() * 6, s: 0.5 + r() * 0.4, c: cols[(r() * 4) | 0] });
      if (r() < 0.5 * dens) cr.push({ x: x + r(), y: t.h - 0.05, z: zBack(), ry: r() * 6, s: 0.7 + r() * 1.1, c: cols[(r() * 4) | 0] });
    }
    place(geoOf('crystal', crystalGeo), mats.crystal, cr, { cast: quality === 'high' });
  } else if (theme === 'cielo') {
    const pf = [];
    for (const t of tops) {
      for (let x = t.a - 0.1; x <= t.b + 1.1; x += 0.45 + r() * 0.3) {
        pf.push({ x, y: t.h - 0.32 + r() * 0.1, z: ZF + 0.12 + r() * 0.1, s: 0.42 + r() * 0.32, sy: 0.32 + r() * 0.2 });
        if (r() < 0.6 * dens) pf.push({ x: x + r() * 0.3, y: t.h + 0.0, z: zBack(), s: 0.4 + r() * 0.6, sy: 0.35 + r() * 0.3 });
      }
      for (const [ex, open] of [[t.a - 0.12, t.openL], [t.b + 1.12, t.openR]]) if (open) for (let z = ZB; z < ZF; z += 0.55) pf.push({ x: ex, y: t.h - 0.3 + r() * 0.1, z: z + r() * 0.2, s: 0.4 + r() * 0.25, sy: 0.32 + r() * 0.15 });
    }
    place(geoOf('puff', puffGeo), mats.puff, pf);
  } else {
    const hx = [];
    for (const t of tops) for (let x = t.a; x <= t.b; x++) {
      if (r() < 0.3 * dens) hx.push({ x: x + r(), y: t.h - 0.38, z: zFront() + 0.2, ry: r(), s: 0.7 + r() * 0.6, sy: 0.6 + r() * 0.6 });
      if (r() < 0.8 * dens) hx.push({ x: x + r(), y: t.h - 0.3, z: zBack(), ry: r(), s: 0.9 + r() * 1.2, sy: 0.5 + r() * 1.6 });
    }
    place(geoOf('hex', hexGeo), mats.hex, hx, { cast: quality === 'high' });
  }
  void lane;
  return out;
}
