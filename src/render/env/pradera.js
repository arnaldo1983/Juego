// Pradera Dorada: prado cercano con flores y matas, colinas onduladas con árboles redondeados,
// molinos y ruinas originales, montañas azuladas con nieve, nubes y polen.
import * as THREE from 'three';
import { fbm, rng, col, smooth, shared, paint, jitter, merge, xf, heightStrip, instanced, fgTex } from './util.js';
import { cloudLayer, motes, foreground } from './layers.js';

let G = null;
function geos() {
  if (G) return G;
  // Árbol redondeado: tronco + 3 copas
  const trunk = paint(new THREE.CylinderGeometry(0.16, 0.26, 1.6, 6).translate(0, 0.8, 0), 0x6b4527);
  const c1 = paint(jitter(new THREE.IcosahedronGeometry(1.05, 1), 0.1, 1.2), 0x4f9a33, { top: 0x9ad65a, y0: -0.8, y1: 1, shadeBottom: 0.35 });
  const c2 = paint(jitter(new THREE.IcosahedronGeometry(0.75, 1), 0.08, 1.6, 3), 0x4f9a33, { top: 0x9ad65a, y0: -0.6, y1: 0.8, shadeBottom: 0.35 });
  const c3 = c2.clone();
  const tree = merge([trunk, xf(c1, { y: 2.3 }), xf(c2, { x: 0.7, y: 1.8, z: 0.15 }), xf(c3, { x: -0.65, y: 1.9, z: -0.1, sx: 0.9 })]);
  // Pino estilizado (capas lejanas)
  const pTrunk = paint(new THREE.CylinderGeometry(0.12, 0.18, 1, 5).translate(0, 0.5, 0), 0x5a3a22);
  const cones = [0, 1, 2].map((i) => paint(new THREE.ConeGeometry(1.0 - i * 0.22, 1.5, 7).translate(0, 1.3 + i * 0.75, 0), 0x2f6e3a, { top: 0x5e9e4a, y0: 0.8 + i * 0.75, y1: 2 + i * 0.75 }));
  const pine = merge([pTrunk, ...cones]);
  // Mata: racimo de esferas
  const b = (r, x, y, z, s) => xf(paint(jitter(new THREE.IcosahedronGeometry(r, 1), 0.06, 2, s), 0x3f8a2e, { top: 0x86c94c, y0: -0.2, y1: 0.7, shadeBottom: 0.4 }), { x, y, z, sy: 0.85 });
  const bush = merge([b(0.6, 0, 0.35, 0, 1), b(0.45, 0.55, 0.25, 0.1, 2), b(0.42, -0.5, 0.22, 0.05, 3)]);
  // Flor: tallo + cabeza (cabeza tintable por instancia)
  const stem = merge([paint(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 4).translate(0, 0.27, 0), 0x3d8a2a),
    paint(new THREE.SphereGeometry(0.09, 5, 3).scale(1.6, 0.35, 0.8).translate(0.1, 0.18, 0), 0x4c9e32)]);
  const petals = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; petals.push(paint(new THREE.SphereGeometry(0.075, 6, 4).scale(1, 1, 0.45).translate(Math.cos(a) * 0.085, 0.56 + Math.sin(a) * 0.085, 0), 0xffffff)); }
  const head = merge([...petals, paint(new THREE.SphereGeometry(0.05, 6, 4).translate(0, 0.56, 0.025), 0xffd23a)]);
  // Mechón de hierba
  const blades = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, h = 0.35 + (i % 3) * 0.12;
    const g = new THREE.ConeGeometry(0.035, h, 3).translate(0, h / 2, 0);
    xf(g, { x: Math.cos(a) * 0.08, z: Math.sin(a) * 0.08, rz: Math.cos(a) * 0.35, rx: Math.sin(a) * 0.35 });
    blades.push(paint(g, 0x3c7f26, { top: 0xa6dc63, y0: 0, y1: 0.45 }));
  }
  const tuft = merge(blades);
  // Molino (torre + tejado + puerta + ventana)
  const tower = merge([
    paint(new THREE.CylinderGeometry(1.0, 1.55, 6, 10).translate(0, 3, 0), 0xf1e6cf, { top: 0xfff7e6, y0: 0, y1: 6 }),
    paint(new THREE.CylinderGeometry(1.6, 1.6, 0.35, 10).translate(0, 0.17, 0), 0x9a8a72),
    paint(new THREE.ConeGeometry(1.35, 2.0, 10).translate(0, 7.0, 0), 0xc4462e, { top: 0xe0603c, y0: 6, y1: 8 }),
    paint(new THREE.BoxGeometry(0.6, 1.1, 0.3).translate(0, 0.65, 1.42), 0x5a3a22),
    paint(new THREE.BoxGeometry(0.4, 0.5, 0.3).translate(0, 3.6, 1.18), 0x3a2a1a),
  ]);
  const bl = [];
  for (let i = 0; i < 4; i++) {
    const g = merge([paint(new THREE.BoxGeometry(0.16, 3.6, 0.1).translate(0, 2.0, 0), 0x7a5232), paint(new THREE.BoxGeometry(0.75, 2.8, 0.04).translate(0.42, 2.3, 0), 0xf6efe0)]);
    bl.push(xf(g, { rz: (i * Math.PI) / 2 }));
  }
  bl.push(paint(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 8).rotateX(Math.PI / 2), 0x6a4a2a));
  const blades4 = merge(bl);
  // Columna en ruinas
  const column = merge([
    paint(new THREE.BoxGeometry(1.1, 0.35, 1.1).translate(0, 0.17, 0), 0xcfc6b0),
    paint(jitter(new THREE.CylinderGeometry(0.38, 0.42, 3.2, 10, 3).translate(0, 1.95, 0), 0.03, 3), 0xe2dac4, { top: 0xf2ecdc, y0: 0, y1: 3.5 }),
    paint(new THREE.BoxGeometry(1.0, 0.3, 1.0).translate(0, 3.65, 0), 0xd8cfb8),
  ]);
  const rock = paint(jitter(new THREE.IcosahedronGeometry(0.6, 1), 0.15, 1.5, 7), 0x8f8a80, { top: 0xb6b0a2, y0: -0.3, y1: 0.5, shadeBottom: 0.3 });
  G = { tree, pine, bush, stem, head, tuft, tower, blades4, column, rock };
  for (const k in G) shared(G[k]);
  return G;
}

let M = null;
function mats() {
  if (M) return M;
  const veg = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  M = {
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    mountain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
    veg, stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
    petal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x000000 }),
  };
  return M;
}

export function buildPradera(ctx) {
  const { w, gy, q } = ctx;
  const g = geos(), m = mats(), r = rng(1234 + w), group = new THREE.Group();
  const span = (z) => (22 - z) * 0.78 + 6;
  const dens = q === 'low' ? 0.45 : q === 'medium' ? 0.7 : 1;

  // --- Terreno cercano + colinas (una sola malla)
  const hNear = (x, z) => {
    const d = -z, t = smooth(7, 52, d);
    const roll = Math.pow(0.5 + 0.5 * fbm(x * 0.022 + 3, d * 0.035, 3, 1), 1.7);
    return gy - 0.12 + t * 2.0 + 10 * Math.pow(t, 1.4) * roll + 0.22 * fbm(x * 0.25, d * 0.25, 2, 2) * smooth(3, 7, d);
  };
  const grassA = col(0x4f9e30), grassB = col(0x8fd04a), grassC = col(0x2f7428), dry = col(0xc7c25a), tmp = new THREE.Color();
  const terrainC = (x, z, y, ny) => {
    const n = fbm(x * 0.06, z * 0.09, 3, 4), n2 = fbm(x * 0.21, z * 0.3, 2, 5);
    tmp.copy(grassA).lerp(grassB, smooth(-0.4, 0.6, n + (ny - 0.85) * 2)).lerp(grassC, smooth(0.2, 0.9, -n2) * 0.5);
    tmp.lerp(dry, smooth(0.35, 0.75, n2) * 0.35);
    return tmp.clone();
  };
  const near = heightStrip({ x0: -span(-50), x1: w + span(-50), dx: q === 'low' ? 1.6 : 1.0, zs: [-2.6, -3.2, -4, -5, -6.5, -8, -10, -12.5, -15, -18, -22, -27, -33, -40, -48, -56],
    h: hNear, c: terrainC, skirt: -16, skirtColor: col(0x2a2416) });
  const nearMesh = new THREE.Mesh(near, m.terrain); nearMesh.receiveShadow = true; group.add(nearMesh);

  // --- Colinas lejanas
  const hFar = (x, z) => 2 + 22 * Math.pow(0.5 + 0.5 * fbm(x * 0.012 + 11, z * 0.02, 4, 6), 1.5) * smooth(52, 75, -z);
  const farA = col(0x3f8a4a), farB = col(0x7cb85a);
  const far = heightStrip({ x0: -span(-100), x1: w + span(-100), dx: q === 'low' ? 4 : 2.5, zs: [-52, -58, -66, -76, -88, -100],
    h: hFar, c: (x, z, y, ny) => farA.clone().lerp(farB, smooth(0.6, 1, ny) * 0.6 + smooth(10, 24, y) * 0.3) });
  group.add(new THREE.Mesh(far, m.terrain));

  // --- Montañas con nieve
  const hMt = (x, z) => {
    const ridge = 1 - Math.abs(fbm(x * 0.012, z * 0.02 + 40, 4, 8));
    return -4 + 40 * Math.pow(ridge, 2.4) * smooth(112, 135, -z) + 6 * fbm(x * 0.05, z * 0.05, 2, 9);
  };
  const rockC = col(0x5d7392), rockD = col(0x7f93ad), snow = col(0xf4f8ff);
  const mt = heightStrip({ x0: -span(-170), x1: w + span(-170), dx: q === 'low' ? 6 : 3.5, zs: [-112, -122, -134, -146, -160, -175],
    h: hMt, c: (x, z, y, ny) => rockC.clone().lerp(rockD, smooth(0.5, 0.9, ny)).lerp(snow, smooth(20, 27, y + 4 * ny)) });
  group.add(new THREE.Mesh(mt, m.mountain));

  // --- Árboles en las colinas (agrupados en bosquecillos)
  const trees = [], pines = [];
  const treeGreens = [0xe0f0d8, 0xd0ecc0, 0xc4e2b0, 0xe8e8b8, 0xbcdcc0];
  for (let i = 0; i < (w + 120) * 0.9 * dens; i++) {
    const x = r.range(-span(-30), w + span(-30)), z = -r.range(19, 50);
    if (fbm(x * 0.05, z * 0.07, 2, 12) < 0.0 && r() < 0.85) continue;
    const s = r.range(0.9, 1.6) * (1 + (-z - 19) * 0.015);
    trees.push({ x, y: hNear(x, z) - 0.2, z, s, ry: r() * 6.28, c: r.pick(treeGreens) });
  }
  for (let i = 0; i < (w + 200) * 0.9 * dens; i++) {
    const x = r.range(-span(-90), w + span(-90)), z = -r.range(55, 95);
    if (fbm(x * 0.03, z * 0.05, 2, 13) < 0) continue;
    pines.push({ x, y: hFar(x, z) - 0.3, z, s: r.range(1.1, 1.9), ry: r() * 6.28, c: r.pick([0xffffff, 0xd8ecd0, 0xc0e0c8]) });
  }
  const treeMesh = instanced(g.tree, m.veg, trees.sort((a, b) => b.z - a.z));
  treeMesh.castShadow = false; group.add(treeMesh);
  group.add(instanced(g.pine, m.veg, pines));

  // --- Matas, flores, hierba y rocas junto al plano de juego
  const bushes = [], heads = [], stems = [], tufts = [], rocks = [];
  for (let i = 0; i < w * 0.8 * dens + 20; i++) {
    const far = r() < 0.4;
    const x = r.range(-12, w + 12), z = far ? -r.range(9, 20) : -r.range(3.4, 9);
    if (far && fbm(x * 0.07, z * 0.1, 2, 31) < 0) continue;
    bushes.push({ x, y: hNear(x, z) - 0.1, z, s: r.range(0.7, 1.35) * (far ? 1.3 : 1), ry: r.range(-0.5, 0.5), c: r.pick([0xffffff, 0xe0f5c8, 0xf0ffd8]) });
  }
  const petalCols = [0xff6f91, 0xfff4f0, 0xffd640, 0xb685ff, 0xff8a3d, 0x6fb7ff];
  for (let i = 0; i < w * 3.2 * dens; i++) {
    const x = r.range(-10, w + 10), z = -r.range(2.8, 7.5);
    if (fbm(x * 0.12, z * 0.3, 2, 21) < -0.2) continue;
    const it = { x, y: hNear(x, z) - 0.05, z, s: r.range(0.75, 1.2), ry: r.range(-0.6, 0.6), rz: r.range(-0.15, 0.15) };
    stems.push(it); heads.push({ ...it, c: r.pick(petalCols) });
  }
  for (let i = 0; i < w * 3.5 * dens; i++) {
    const x = r.range(-12, w + 12), z = -r.range(2.7, 12);
    tufts.push({ x, y: hNear(x, z) - 0.05, z, s: r.range(0.45, 0.85) * (1 + (-z - 3) * 0.05), ry: r() * 6.28, c: r.pick([0xffffff, 0xe8f8c8, 0xd8f0a0, 0xfff0b0]) });
  }
  for (let i = 0; i < w * 0.12 + 6; i++) {
    const x = r.range(-10, w + 10), z = -r.range(4, 14);
    rocks.push({ x, y: hNear(x, z) - 0.15, z, s: r.range(0.4, 1.2), sy: 0.7, ry: r() * 6, c: 0xffffff });
  }
  const bushMesh = instanced(g.bush, m.veg, bushes.sort((a, b) => a.z - b.z), { receive: true });
  group.add(bushMesh, instanced(g.stem, m.veg, stems), instanced(g.head, m.petal, heads), instanced(g.tuft, m.veg, tufts, { receive: true }), instanced(g.rock, m.stone, rocks, { receive: true }));

  // --- Molinos (aspas animadas) y ruinas
  const mills = [], millBlades = [];
  const nMills = Math.max(2, Math.round(w / 55));
  for (let i = 0; i < nMills; i++) {
    const x = (i + 0.5) * (w / nMills) + r.range(-12, 12), z = -r.range(30, 44);
    const y = hNear(x, z) - 0.3, s = r.range(1.0, 1.3);
    const ry = r.range(-0.35, 0.15);
    mills.push({ x, y, z, s, ry });
    millBlades.push({ x: x + Math.sin(ry) * 1.45 * s, y: y + 5.2 * s, z: z + Math.cos(ry) * 1.45 * s, s, spin: r.range(0.5, 0.9), a: r() * 6 });
  }
  group.add(instanced(g.tower, m.stone, mills));
  const bladesMesh = instanced(g.blades4, m.stone, millBlades);
  group.add(bladesMesh);
  const cols = [];
  const nRuins = Math.max(2, Math.round(w / 70));
  for (let i = 0; i < nRuins; i++) {
    const cx = (i + 0.3) * (w / nRuins) + r.range(-10, 10), cz = -r.range(16, 26);
    for (let k = 0; k < 5; k++) {
      const x = cx + k * 1.9 + r.range(-0.2, 0.2), z = cz + r.range(-0.4, 0.4);
      if (k === 3) { cols.push({ x: x + 0.4, y: hNear(x, z) + 0.3, z: z + 1.2, s: 0.75, rz: Math.PI / 2, ry: 0.3 }); continue; }
      const broken = r() < 0.4;
      cols.push({ x, y: hNear(x, z) - 0.3, z, s: 0.75, sy: broken ? r.range(0.35, 0.7) : 1, rz: r.range(-0.04, 0.04) });
    }
  }
  group.add(instanced(g.column, m.stone, cols));

  // --- Nubes
  const cl = [];
  const W0 = -200, W1 = w + 200;
  for (let i = 0; i < (W1 - W0) / 13; i++) cl.push({ x: r.range(W0, W1), y: r.range(26, 60), z: -r.range(130, 230), s: r.range(20, 38), flip: r() < 0.5, speed: r.range(0.4, 0.9) });
  for (let i = 0; i < (W1 - W0) / 30; i++) cl.push({ x: r.range(W0, W1), y: r.range(16, 26), z: -r.range(65, 100), s: r.range(9, 15), flip: r() < 0.5, speed: r.range(0.6, 1.1) });
  const clouds = cloudLayer(cl, { lit: 0xffffff, shade: 0xa8bedb, x0: W0, x1: W1 });
  group.add(clouds.mesh);

  // --- Polen y mariposas de luz
  const pollen = motes({ count: Math.round(70 * dens), box: [48, 18], z0: -1.5, z1: -14, yOff: 0, vel: [0.35, 0.12, 0], sway: 0.8, size: 0.09, color: 0xfff2b0, flicker: 0.6, opacity: 0.7, seed: 4 });
  group.add(pollen.mesh);

  // --- Primer plano: hierba alta desenfocada
  const fg = [];
  for (let x = -10; x < w + 10; x += r.range(9, 18)) if (r() < 0.6) fg.push({ x, y: -1.9, z: r.range(4, 5.5), w: r.range(2.2, 3.5), h: r.range(1.8, 2.5), flip: r() < 0.5 });
  const fgm = foreground(fg, fgTex('grass'), 0x16260f, 0.92);
  if (q !== 'low') group.add(fgm.mesh);

  const Mx = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  return {
    group,
    update(dt, camX, camY, time, px) {
      clouds.update(dt);
      pollen.update(dt, camX, camY, time, px);
      millBlades.forEach((b, i) => {
        b.a += b.spin * dt; e.set(0, mills[i].ry, b.a); qq.setFromEuler(e); p.set(b.x, b.y, b.z); sc.setScalar(b.s); Mx.compose(p, qq, sc); bladesMesh.setMatrixAt(i, Mx);
      });
      bladesMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
