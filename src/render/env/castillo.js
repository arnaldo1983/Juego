// Fortaleza volcánica nocturna: suelo de basalto con río de lava, torres y murallas con ventanas encendidas,
// volcanes lejanos con cascadas de lava y humo, luna roja, ceniza y brasas.
import * as THREE from 'three';
import { fbm, rng, col, smooth, shared, paint, jitter, merge, xf, heightStrip, instanced, glowMaterial, lavaTex, softDot, fgTex } from './util.js';
import { cloudLayer, motes, foreground } from './layers.js';

let G = null;
function geos() {
  if (G) return G;
  // Torre: cuerpo, cornisa, almenas, tejado cónico
  const parts = [paint(jitter(new THREE.CylinderGeometry(1, 1.12, 8, 12, 6), 0.03, 2, 1).translate(0, 4, 0), 0x2a2228, { top: 0x3c3238, y0: 0, y1: 8 }),
    paint(new THREE.CylinderGeometry(1.25, 1.1, 0.5, 12).translate(0, 8.2, 0), 0x463a40)];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; parts.push(paint(new THREE.BoxGeometry(0.42, 0.55, 0.3).translate(0, 8.7, 1.1).rotateY(a), 0x463a40)); }
  parts.push(paint(new THREE.ConeGeometry(1.0, 3.2, 12).translate(0, 10.3, 0), 0x4a1a24, { top: 0x6a2030, y0: 9, y1: 11.5 }));
  const tower = merge(parts);
  // Ventanas de la torre (geometría separada, mismas transformaciones)
  const win = [];
  for (const [y, a] of [[2.6, 0.15], [5.0, -0.25], [6.6, 0.35], [5.0, 0.6]]) win.push(paint(new THREE.PlaneGeometry(0.28, 0.55).translate(0, y, 1.13).rotateY(a), 0xffffff));
  const towerWin = merge(win);
  // Muralla (longitud 1 en X) con almenas
  const wparts = [paint(new THREE.BoxGeometry(1, 4, 1.2).translate(0, 2, 0), 0x2c2428, { top: 0x3a3036, y0: 0, y1: 4 })];
  for (let i = 0; i < 2; i++) wparts.push(paint(new THREE.BoxGeometry(0.3, 0.5, 1.2).translate(-0.25 + i * 0.5, 4.25, 0), 0x3a3036));
  const wall = merge(wparts);
  // Volcán (cono truncado, rugoso)
  const volc = jitter(new THREE.CylinderGeometry(0.16, 1, 1, 14, 8, true).translate(0, 0.5, 0), 0.06, 3, 7);
  const vp = volc.attributes.position, vc = new Float32Array(vp.count * 3), t = new THREE.Color(), va = col(0x140c10), vb = col(0x2a1a1c), vg = col(0x6a1a08);
  for (let i = 0; i < vp.count; i++) { const y = vp.getY(i); t.copy(va).lerp(vb, fbm(vp.getX(i) * 3, y * 3, 2, 3) * 0.5 + 0.5).lerp(vg, smooth(0.8, 1.0, y) * 0.8); vc.set([t.r, t.g, t.b], i * 3); }
  volc.setAttribute('color', new THREE.BufferAttribute(vc, 3));
  const spike = paint(jitter(new THREE.ConeGeometry(1, 1, 6, 3).translate(0, 0.5, 0), 0.08, 3, 5), 0x1c1418, { top: 0x2e2226, y0: 0, y1: 1 });
  const rock = paint(jitter(new THREE.IcosahedronGeometry(0.7, 1), 0.2, 1.6, 4), 0x2a2024, { top: 0x40343a, y0: -0.3, y1: 0.6, shadeBottom: 0.4 });
  G = { tower, towerWin, wall, volc, spike, rock };
  for (const k in G) shared(G[k]);
  return G;
}
let M = null;
function mats() {
  if (M) return M;
  const lava = lavaTex();
  M = {
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    basalt: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }),
    win: glowMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }, 2.2),
    lava: new THREE.MeshBasicMaterial({ map: lava, color: new THREE.Color(2.6, 1.25, 0.55), fog: true }),
    lavaFall: new THREE.MeshBasicMaterial({ map: lava, color: new THREE.Color(2.8, 1.2, 0.5), fog: true, transparent: true, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ map: softDot(), color: new THREE.Color(1.6, 0.5, 0.15), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  };
  return M;
}

export function buildCastillo(ctx) {
  const { w, gy, q } = ctx;
  const g = geos(), m = mats(), r = rng(666 + w), group = new THREE.Group();
  const span = (z) => (22 - z) * 0.78 + 6;
  const dens = q === 'low' ? 0.45 : q === 'medium' ? 0.7 : 1;

  // --- Río de lava serpenteante y suelo de basalto con grietas encendidas
  const riverZ = (x) => -15 + 3.5 * Math.sin(x * 0.045) + 1.5 * Math.sin(x * 0.13 + 1);
  const hFloor = (x, z) => {
    const d = -z, rz = riverZ(x);
    const bank = Math.exp(-Math.pow((z - rz) / 2.6, 2));
    return gy - 0.12 + smooth(4, 40, d) * 2.5 + 0.8 * fbm(x * 0.12, d * 0.12, 3, 1) * smooth(3, 8, d) - bank * 1.6 + 7 * Math.pow(Math.max(0, fbm(x * 0.03, d * 0.04, 2, 2)), 1.5) * smooth(22, 40, d);
  };
  const fA = col(0x17111a), fB = col(0x3a2c32), hot = col(0xff5a10);
  const crack = (x, z) => Math.max(0, 1 - Math.abs(fbm(x * 0.18, z * 0.3, 2, 9)) * 9);
  const floor = heightStrip({ x0: -span(-60), x1: w + span(-60), dx: q === 'low' ? 1.6 : 0.9, zs: [-2.6, -3.3, -4.2, -5.5, -7, -9, -11, -13, -15, -17, -19, -22, -27, -34, -44, -58],
    h: hFloor, c: (x, z, y, ny) => {
      const c = fA.clone().lerp(fB, smooth(0.7, 1, ny) * 0.6 + fbm(x * 0.2, z * 0.2, 2, 3) * 0.2);
      const rz = riverZ(x), bank = Math.exp(-Math.pow((z - rz) / 2.2, 2));
      return c.lerp(hot, bank * 0.45 + crack(x, z) * 0.6 * smooth(4, 6, -z));
    },
    skirt: -16, skirtColor: col(0x070406), lipColor: col(0x2a1a1c) });
  // brillo emisivo aprox. de grietas/orillas mediante color de vértice
  const floorMat = glowMaterial({ vertexColors: true, roughness: 0.9 }, 0.0);
  floorMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += max(vec3(0.0), vColor.rgb - vec3(0.12, 0.1, 0.1)) * vec3(1.6, 0.7, 0.3);');
  };
  floorMat.customProgramCacheKey = () => 'lavafloor';
  const floorMesh = new THREE.Mesh(floor, floorMat); floorMesh.receiveShadow = true; group.add(floorMesh);
  // cinta de lava
  const x0 = -span(-20), x1 = w + span(-20);
  const rp = [], ri = [], ruv = [];
  let n = 0;
  for (let x = x0; x <= x1; x += 1.0) {
    const z = riverZ(x), y = gy - 0.12 + smooth(4, 40, -z) * 2.5 - 1.15;
    rp.push(x, y, z + 1.5, x, y, z - 1.5); ruv.push(x * 0.08, 0, x * 0.08, 0.45);
    if (n > 0) { const a = (n - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    n++;
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2)); rg.setIndex(ri);
  group.add(new THREE.Mesh(rg, m.lava));

  // --- Torres y murallas (capa media)
  const towers = [], walls = [];
  for (let x = -span(-40) + r() * 20; x < w + span(-40); x += r.range(28, 48)) {
    const z = -r.range(30, 46), base = hFloor(x, z) - 0.5;
    const nT = 2 + Math.floor(r() * 2);
    let px = x;
    for (let k = 0; k < nT; k++) {
      const s = r.range(1.0, 1.5), tz = z + r.range(-2, 2), tx = px;
      towers.push({ x: tx, y: base, z: tz, s, sy: r.range(0.8, 1.35) * s, ry: r.range(-0.3, 0.3), c: r.pick([0xffd080, 0xffa040, 0xff8a30]) });
      if (k < nT - 1) {
        const gap = r.range(7, 11);
        walls.push({ x: tx + gap / 2, y: base, z: tz - 0.5, sx: gap, s: 1, sy: r.range(0.9, 1.2) });
        px += gap;
      }
    }
  }
  group.add(instanced(g.tower, m.stone, towers), instanced(g.wall, m.stone, walls));
  const winMesh = instanced(g.towerWin, m.win, towers);
  group.add(winMesh);

  // --- Agujas de roca volcánica cercanas
  const spikes = [];
  for (let i = 0; i < (w + 80) * 0.5 * dens; i++) {
    const x = r.range(-span(-30), w + span(-30)), z = -r.range(7, 28);
    if (Math.abs(z - riverZ(x)) < 3) continue;
    const L = r.range(1.5, 6) * (1 + -z * 0.02), rr = L * r.range(0.18, 0.3);
    spikes.push({ x, y: hFloor(x, z) - 0.3, z, sx: rr, sz: rr, sy: L, ry: r() * 6, rz: r.range(-0.12, 0.12) });
  }
  const rocks = [];
  for (let i = 0; i < w * 0.4 + 10; i++) { const x = r.range(-10, w + 10), z = -r.range(3.3, 10); if (Math.abs(z - riverZ(x)) < 2.5) continue; rocks.push({ x, y: hFloor(x, z) - 0.2, z, s: r.range(0.4, 1.3), sy: r.range(0.5, 0.9), ry: r() * 6 }); }
  group.add(instanced(g.spike, m.basalt, spikes), instanced(g.rock, m.basalt, rocks, { receive: true }));

  // --- Volcanes lejanos + cordillera
  const hMt = (x, z) => -4 + 30 * Math.pow(1 - Math.abs(fbm(x * 0.014, z * 0.02 + 7, 4, 8)), 2.2) * smooth(95, 120, -z);
  const ma = col(0x120a0e), mb = col(0x2a1418);
  group.add(new THREE.Mesh(heightStrip({ x0: -span(-160), x1: w + span(-160), dx: q === 'low' ? 6 : 3.5, zs: [-95, -105, -118, -132, -148, -165], h: hMt,
    c: (x, z, y, ny) => ma.clone().lerp(mb, smooth(0.4, 0.9, ny)) }), m.basalt));
  const volcs = [], glows = [], falls = [], smoke = [];
  for (let x = -span(-140) + r() * 40; x < w + span(-140); x += r.range(60, 110)) {
    const z = -r.range(115, 150), s = r.range(22, 34), hh = r.range(26, 40);
    volcs.push({ x, y: -6, z, sx: s, sz: s * 0.8, sy: hh });
    const top = -6 + hh;
    glows.push({ x, y: top + 1, z: z + 2, w: s * 0.9, h: s * 0.6 });
    for (let k = 0; k < 2; k++) falls.push({ x: x + r.range(-0.12, 0.12) * s, top: top - 0.5, z: z + s * 0.45, h: hh * r.range(0.5, 0.8), w: r.range(1.2, 2.4), rz: r.range(-0.18, 0.18) });
    for (let k = 0; k < 3; k++) smoke.push({ x: x - s * 0.3 + k * s * 0.25, y: top + 2 + k * 6, z: z - 3, s: s * (0.8 + k * 0.3), sy: 0.8, flip: r() < 0.5, speed: 0.6 + k * 0.3 });
  }
  group.add(instanced(g.volc, m.basalt, volcs));
  const glowMesh = new THREE.InstancedMesh(shared(new THREE.PlaneGeometry(1, 1)), m.glow, Math.max(1, glows.length));
  const Mx = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  glows.forEach((gl, i) => { p.set(gl.x, gl.y, gl.z); sc.set(gl.w, gl.h, 1); Mx.compose(p, qq.identity(), sc); glowMesh.setMatrixAt(i, Mx); });
  glowMesh.count = glows.length; glowMesh.frustumCulled = false; glowMesh.renderOrder = 6;
  const fallMesh = new THREE.InstancedMesh(shared(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0)), m.lavaFall, Math.max(1, falls.length));
  falls.forEach((f, i) => { e.set(0, 0, f.rz); qq.setFromEuler(e); p.set(f.x, f.top, f.z); sc.set(f.w, f.h, 1); Mx.compose(p, qq, sc); fallMesh.setMatrixAt(i, Mx); });
  fallMesh.count = falls.length; fallMesh.frustumCulled = false;
  group.add(glowMesh, fallMesh);
  const smokeL = cloudLayer(smoke, { lit: 0x6a3a3a, shade: 0x1a0c10, x0: -span(-140), x1: w + span(-140), fog: true });
  group.add(smokeL.mesh);
  // nubes nocturnas finas iluminadas por la luna
  const cl = [];
  for (let i = 0; i < (w + 400) / 30; i++) cl.push({ x: r.range(-200, w + 200), y: r.range(24, 50), z: -r.range(150, 230), s: r.range(20, 36), sy: 0.35, flip: r() < 0.5, speed: r.range(0.4, 0.8), a: 0.6 });
  const night = cloudLayer(cl, { lit: 0x7a3a4a, shade: 0x1c0c18, x0: -200, x1: w + 200, fog: false });
  group.add(night.mesh);

  // --- Ceniza y brasas
  const ash = motes({ count: Math.round(110 * dens), box: [54, 24], z0: -1, z1: -22, yOff: 2, vel: [0.4, -0.7, 0], sway: 0.8, size: 0.07, color: 0x8a7a78, flicker: 0, additive: false, opacity: 0.75, seed: 31 });
  const embers = motes({ count: Math.round(90 * dens), box: [54, 24], z0: -1, z1: -26, yOff: 2, vel: [0.3, 1.1, 0], sway: 0.9, size: 0.12, color: 0xffa040, color2: 0xff3000, flicker: 1, seed: 32 });
  group.add(ash.mesh, embers.mesh);

  // --- Primer plano
  const fg = [];
  for (let x = -10; x < w + 10; x += r.range(10, 20)) if (r() < 0.6) fg.push({ x, y: -1.9, z: r.range(4, 5.5), w: r.range(2.5, 4), h: r.range(1.6, 2.2), flip: r() < 0.5 });
  if (q !== 'low') group.add(foreground(fg, fgTex('rock'), 0x0a0305, 0.95).mesh);

  const lava = m.lava.map;
  return {
    group,
    update(dt, camX, camY, time, px) {
      lava.offset.x = (lava.offset.x + dt * 0.03) % 1;
      lava.offset.y = (lava.offset.y - dt * 0.05) % 1;
      m.win.userData.glow.value = 2.0 + 0.25 * Math.sin(time * 7.0) * Math.sin(time * 2.3);
      m.glow.opacity = 0.85 + 0.15 * Math.sin(time * 1.7);
      smokeL.update(dt); night.update(dt);
      ash.update(dt, camX, camY, time, px); embers.update(dt, camX, camY, time, px);
    },
  };
}
