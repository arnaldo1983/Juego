// Gruta de cristales: suelo rocoso, columnas y paredes con niebla violeta, techo con estalactitas,
// cristales emisivos cian/magenta, rayos de luz desde grietas y luciérnagas.
import * as THREE from 'three';
import { fbm, rng, col, smooth, shared, paint, jitter, merge, xf, heightStrip, surface, range, instanced, glowMaterial, fgTex } from './util.js';
import { cloudLayer, motes, rays, foreground } from './layers.js';

let G = null;
function geos() {
  if (G) return G;
  const crystal = (h, r, x, z, rx, rz) => xf(new THREE.OctahedronGeometry(1, 0).scale(r, h, r).translate(0, h * 0.75, 0), { x, z, rx, rz });
  const cluster = merge([crystal(1.4, 0.32, 0, 0, 0, 0), crystal(1.0, 0.26, 0.35, 0.1, 0.1, -0.45), crystal(0.85, 0.22, -0.32, 0.05, -0.1, 0.5),
    crystal(0.6, 0.18, 0.15, 0.3, 0.5, -0.2), crystal(0.55, 0.17, -0.1, -0.3, -0.5, 0.25)].map((g) => paint(g, 0xffffff)));
  const stalactite = paint(jitter(new THREE.ConeGeometry(1, 1, 7, 4).rotateX(Math.PI).translate(0, -0.5, 0), 0.08, 3, 2), 0x2a2848, { top: 0x4b4878, y0: -1, y1: 0 });
  const stalagmite = paint(jitter(new THREE.ConeGeometry(1, 1, 7, 4).translate(0, 0.5, 0), 0.08, 3, 4), 0x45427a, { top: 0x2a2848, y0: 0, y1: 1 });
  const column = paint(jitter(new THREE.CylinderGeometry(0.75, 1.1, 1, 9, 8, true).translate(0, 0.5, 0), 0.12, 4, 6), 0x2c2a4c, { top: 0x3a3762, y0: 0, y1: 1 });
  const rock = paint(jitter(new THREE.IcosahedronGeometry(0.7, 1), 0.2, 1.6, 9), 0x34325a, { top: 0x55527f, y0: -0.3, y1: 0.6, shadeBottom: 0.4 });
  const mushroom = merge([paint(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 5).translate(0, 0.2, 0), 0xdad0ff),
    paint(new THREE.SphereGeometry(0.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.38, 0), 0xffffff)]);
  G = { cluster, stalactite, stalagmite, column, rock, mushroom };
  for (const k in G) shared(G[k]);
  return G;
}
let M = null;
function mats() {
  if (M) return M;
  M = {
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
    floor: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    crystal: glowMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: false }, 1.35),
    shroom: glowMaterial({ vertexColors: true, roughness: 0.5 }, 0.9),
  };
  return M;
}

export function buildCueva(ctx) {
  const { w, gy, q } = ctx;
  const g = geos(), m = mats(), r = rng(777 + w), group = new THREE.Group();
  const span = (z) => (22 - z) * 0.78 + 6;
  const dens = q === 'low' ? 0.3 : q === 'medium' ? 0.55 : 1;
  const CRY = [0x2ee6ff, 0xff4fd8, 0x9b6bff, 0x4fffc1];

  // --- Suelo rocoso
  const hFloor = (x, z) => {
    const d = -z;
    return gy - 0.12 + smooth(4, 40, d) * 3 + 1.2 * fbm(x * 0.15, d * 0.15, 3, 1) * smooth(3, 8, d) + 4 * Math.pow(Math.max(0, fbm(x * 0.04, d * 0.05, 2, 2)), 2) * smooth(8, 25, d);
  };
  const fA = col(0x1c1b33), fB = col(0x4a4680), fC = col(0x163f4a);
  const floor = heightStrip({ x0: -span(-60), x1: w + span(-60), dx: q === 'low' ? 1.6 : 1.0, zs: [-2.6, -3.3, -4.2, -5.5, -7, -9, -12, -16, -21, -28, -36, -46, -60],
    h: hFloor, c: (x, z, y, ny) => { const n = fbm(x * 0.1, z * 0.1, 2, 3); return fA.clone().lerp(fB, smooth(0.75, 1, ny) * 0.55 + n * 0.15).lerp(fC, smooth(0.3, 0.8, fbm(x * 0.05, z * 0.08, 2, 4)) * 0.5); },
    skirt: -16, skirtColor: col(0x0c0b18) });
  const floorMesh = new THREE.Mesh(floor, m.floor); floorMesh.receiveShadow = true; group.add(floorMesh);

  // --- Techo (mira hacia abajo)
  const hCeil = (x, z) => { const d = -z; return 15.5 + d * 0.16 + 3.5 * fbm(x * 0.05, d * 0.05, 3, 5) + 2.5 * Math.abs(fbm(x * 0.12, d * 0.1, 2, 6)); };
  const cA = col(0x14132a), cB = col(0x2e2c56);
  const ceil = heightStrip({ x0: -span(-90), x1: w + span(-90), dx: q === 'low' ? 2.5 : 1.6, zs: [-6, -9, -13, -18, -25, -34, -46, -60, -76, -95], h: hCeil,
    c: (x, z, y, ny) => cA.clone().lerp(cB, smooth(0, 1, fbm(x * 0.08, z * 0.08, 2, 7) + 0.4)), flip: true });
  group.add(new THREE.Mesh(ceil, m.rock));

  // --- Pared del fondo con bolsillos profundos
  const zWall = (x, y) => -70 - 22 * Math.pow(Math.max(0, fbm(x * 0.03, y * 0.04, 3, 8) + 0.1), 1.2) * smooth(-6, 4, y) * (1 - smooth(18, 30, y)) + 5 * fbm(x * 0.1, y * 0.1, 2, 9);
  const wA = col(0x1a1838), wB = col(0x3b3570);
  const wall = surface(range(-span(-110), w + span(-110), q === 'low' ? 4 : 2.5), range(-12, 34, 2.5), (u, v) => [u, v, zWall(u, v)],
    (x, y, z, n) => wA.clone().lerp(wB, smooth(-0.2, 0.9, n.z * 0.6 + n.y * 0.6)));
  group.add(new THREE.Mesh(wall, m.rock));

  // --- Columnas (dos capas de profundidad)
  const columns = [], tites = [], mites = [];
  for (const [z0, z1, step, rad] of [[-13, -22, 11, [1.4, 2.4]], [-30, -48, 8, [2.2, 3.6]]]) {
    for (let x = -span(z1) + r() * step; x < w + span(z1); x += step * r.range(0.6, 1.4)) {
      const z = -r.range(-z0, -z1), base = hFloor(x, z) - 1, top = hCeil(x, z) + 1;
      if (r() < 0.25) continue;
      const rr = r.range(...rad);
      columns.push({ x, y: base, z, sx: rr, sz: rr, sy: top - base, ry: r() * 6 });
    }
  }
  for (let i = 0; i < (w + 120) * 1.1 * dens; i++) {
    const x = r.range(-span(-50), w + span(-50)), z = -r.range(7, 60);
    const L = r.range(1.5, 5) * (1 + (-z) * 0.01), rr = L * r.range(0.16, 0.26);
    tites.push({ x, y: hCeil(x, z) + 0.3, z, sx: rr, sz: rr, sy: L, ry: r() * 6 });
  }
  for (let i = 0; i < (w + 80) * 0.45 * dens; i++) {
    const x = r.range(-span(-40), w + span(-40)), z = -r.range(6, 40);
    const L = r.range(0.8, 3.5), rr = L * r.range(0.22, 0.35);
    mites.push({ x, y: hFloor(x, z) - 0.2, z, sx: rr, sz: rr, sy: L, ry: r() * 6 });
  }
  group.add(instanced(g.column, m.rock, columns), instanced(g.stalactite, m.rock, tites), instanced(g.stalagmite, m.rock, mites));

  // --- Cristales: grupos en el suelo, en columnas y en la pared del fondo
  const crystals = [];
  for (let i = 0; i < (w + 60) * 0.55 * dens + 10; i++) {
    const near = r() < 0.45;
    const x = r.range(-span(-30), w + span(-30)), z = near ? -r.range(3.2, 9) : -r.range(10, 45);
    if (fbm(x * 0.06, z * 0.1, 2, 10) < -0.15) continue;
    const s = near ? r.range(0.45, 0.9) : r.range(0.9, 2.2);
    crystals.push({ x, y: hFloor(x, z) - 0.15, z, s, ry: r() * 6, rz: r.range(-0.3, 0.3), c: r.pick(CRY) });
  }
  for (const c of columns) if (r() < 0.5) crystals.push({ x: c.x + c.sx * 0.9, y: c.y + c.sy * r.range(0.25, 0.6), z: c.z + c.sz * 0.6, s: r.range(0.8, 1.5), rz: -1.2, ry: 0.3, c: r.pick(CRY) });
  for (let i = 0; i < (w + 200) * 0.15; i++) { const x = r.range(-span(-90), w + span(-90)), y = r.range(-2, 22); crystals.push({ x, y, z: zWall(x, y) + 1.5, s: r.range(2.5, 5), rx: 1.2, rz: r.range(-0.6, 0.6), c: r.pick(CRY) }); }
  for (let i = 0; i < (w + 80) * 0.25 * dens; i++) { const x = r.range(-span(-40), w + span(-40)), z = -r.range(8, 40); crystals.push({ x, y: hCeil(x, z) + 0.4, z, s: r.range(0.7, 1.6), rx: Math.PI, c: r.pick(CRY) }); }
  const crystalMesh = instanced(g.cluster, m.crystal, crystals);
  group.add(crystalMesh);

  // --- Hongos luminosos y rocas cerca del plano de juego
  const shrooms = [], rocks = [];
  for (let i = 0; i < w * 0.9 * dens; i++) {
    const x = r.range(-10, w + 10), z = -r.range(2.8, 7);
    if (fbm(x * 0.15, z * 0.2, 2, 11) < 0.05) continue;
    shrooms.push({ x, y: hFloor(x, z) - 0.03, z, s: r.range(0.6, 1.3), ry: r() * 6, c: r.pick([0x60f0ff, 0x9affc8, 0xc0a0ff]) });
  }
  for (let i = 0; i < w * 0.35 + 10; i++) { const x = r.range(-10, w + 10), z = -r.range(3.3, 14); rocks.push({ x, y: hFloor(x, z) - 0.2, z, s: r.range(0.5, 1.6), sy: r.range(0.5, 0.9), ry: r() * 6 }); }
  group.add(instanced(g.mushroom, m.shroom, shrooms), instanced(g.rock, m.rock, rocks, { receive: true }));

  // --- Rayos de luz desde grietas del techo
  const rl = [];
  for (let x = r.range(5, 20); x < w + 20; x += r.range(18, 34)) rl.push({ x, y: 24, z: -r.range(9, 26), w: r.range(2.5, 5), h: r.range(26, 32), rz: r.range(-0.3, -0.12) });
  const rayL = rays(rl, { color: 0x9fd8ff, opacity: 0.22 });
  group.add(rayL.mesh);

  // --- Bruma luminosa baja (nubes tenues aditivas)
  const mist = [];
  for (let x = -100; x < w + 100; x += r.range(14, 26)) mist.push({ x, y: gy - 1.5 + r.range(0, 3), z: -r.range(25, 60), s: r.range(14, 24), sy: 0.5, flip: r() < 0.5, speed: r.range(0.2, 0.4), a: 0.5 });
  const mistL = cloudLayer(mist, { lit: 0x5a48a8, shade: 0x2a2060, x0: -100, x1: w + 100, additive: true });
  group.add(mistL.mesh);

  // --- Luciérnagas
  const flies = motes({ count: Math.round(130 * dens), box: [52, 20], z0: -1, z1: -26, yOff: 1, vel: [0.1, 0.05, 0], sway: 1.2, size: 0.2, color: 0xd8ff7a, color2: 0x3a6a20, flicker: 1, seed: 11 });
  const dust = motes({ count: Math.round(60 * dens), box: [50, 22], z0: -6, z1: -24, yOff: 2, vel: [0.05, -0.1, 0], sway: 0.5, size: 0.08, color: 0x8fdcff, flicker: 0.3, opacity: 0.6, seed: 12 });
  group.add(flies.mesh, dust.mesh);

  // --- Primer plano: estalactitas y rocas desenfocadas
  const fg = [];
  for (let x = -10; x < w + 10; x += r.range(10, 20)) if (r() < 0.6) fg.push({ x, y: -1.9, z: r.range(4, 5.5), w: r.range(2.5, 4), h: r.range(1.6, 2.2), flip: r() < 0.5 });
  if (q !== 'low') group.add(foreground(fg, fgTex('rock'), 0x05040c, 0.95).mesh);

  return {
    group,
    update(dt, camX, camY, time, px) {
      m.crystal.userData.glow.value = 1.25 + 0.2 * Math.sin(time * 1.3);
      rayL.update(dt, time); mistL.update(dt);
      flies.update(dt, camX, camY, time, px); dust.update(dt, camX, camY, time, px);
    },
  };
}
