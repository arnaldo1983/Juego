// Islas flotantes al atardecer: mar de nubes, islas lejanas con cascadas, rocas flotantes, globos y nubes rosadas.
import * as THREE from 'three';
import { fbm, rng, col, smooth, shared, paint, jitter, merge, xf, instanced, streakTex } from './util.js';
import { cloudLayer, motes } from './layers.js';

let G = null;
function geos() {
  if (G) return G;
  // Isla: cuerpo de roca invertido con estratos + tapa de césped + dos árboles redondos
  const body = jitter(new THREE.ConeGeometry(1, 1.8, 10, 6).rotateX(Math.PI).translate(0, -0.9, 0), 0.12, 2.2, 3);
  const bp = body.attributes.position, bc = new Float32Array(bp.count * 3), t = new THREE.Color();
  const s1 = col(0xb8643a), s2 = col(0xe0955a), s3 = col(0x7a3e2e);
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); t.copy(s1).lerp(s2, 0.5 + 0.5 * Math.sin(y * 9)).lerp(s3, smooth(-0.3, -1.8, y)); bc.set([t.r, t.g, t.b], i * 3); }
  body.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const top = paint(jitter(new THREE.SphereGeometry(1.06, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.22, 1), 0.04, 3, 5), 0x6cc04a, { top: 0xa8e070, y0: 0, y1: 0.2 });
  const lip = paint(new THREE.CylinderGeometry(1.08, 1.0, 0.16, 16).translate(0, -0.05, 0), 0x4f9a38);
  const tr = (x, z, s) => [paint(new THREE.CylinderGeometry(0.03 * s, 0.05 * s, 0.4 * s, 5).translate(x, 0.2 * s + 0.15, z), 0x6b4527),
    paint(jitter(new THREE.IcosahedronGeometry(0.22 * s, 1), 0.03, 4, x), 0x5fae3a, { top: 0xb0e070, y0: -0.1, y1: 0.2, shadeBottom: 0.3 }).translate(x, 0.55 * s + 0.15, z)];
  const island = merge([body, top, lip, ...tr(0.35, -0.2, 1.4), ...tr(-0.3, 0.1, 1.0), ...tr(0.0, -0.5, 1.2)]);
  const rock = merge([paint(jitter(new THREE.IcosahedronGeometry(0.6, 1), 0.18, 1.8, 2), 0xc07a4a, { top: 0xe8a868, y0: -0.3, y1: 0.5, shadeBottom: 0.45 }),
    paint(new THREE.SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1).translate(0, 0.32, 0), 0x7cc850)]);
  const puff = paint(jitter(new THREE.IcosahedronGeometry(1, 1), 0.08, 1.3, 8), 0xffffff);
  // Globo aerostático original: envoltura a gajos + cesta
  const env = new THREE.SphereGeometry(1, 12, 10).scale(1, 1.15, 1).translate(0, 1.8, 0);
  const ep = env.attributes.position, ec = new Float32Array(ep.count * 3), ca = col(0xff5a6a), cb = col(0xffd65a);
  for (let i = 0; i < ep.count; i++) { const a = Math.atan2(ep.getZ(i), ep.getX(i)); t.copy(Math.sin(a * 3) > 0 ? ca : cb); ec.set([t.r, t.g, t.b], i * 3); }
  env.setAttribute('color', new THREE.BufferAttribute(ec, 3));
  const balloon = merge([env, paint(new THREE.CylinderGeometry(0.28, 0.22, 0.3, 8).translate(0, 0.15, 0), 0x8a5a32),
    paint(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 3).translate(0.22, 0.6, 0), 0x50402a), paint(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 3).translate(-0.22, 0.6, 0), 0x50402a)]);
  G = { island, rock, puff, balloon };
  for (const k in G) shared(G[k]);
  return G;
}
let M = null;
function mats() {
  if (M) return M;
  M = {
    island: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: false }),
    cloud: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x8a4a78, emissiveIntensity: 0.35 }),
    sea: new THREE.MeshBasicMaterial({ color: 0xf2b0a8, fog: true }),
    fall: new THREE.MeshBasicMaterial({ map: streakTex(), color: 0xfff4f4, transparent: true, depthWrite: false, opacity: 0.85 }),
  };
  return M;
}

export function buildCielo(ctx) {
  const { w, gy, q } = ctx;
  const g = geos(), m = mats(), r = rng(4242 + w), group = new THREE.Group();
  const span = (z) => (22 - z) * 0.78 + 6;
  const dens = q === 'low' ? 0.45 : q === 'medium' ? 0.7 : 1;

  // --- Mar de nubes: plano base + bultos esponjosos
  const seaY = -7.5;
  const sea = new THREE.Mesh(shared(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), m.sea);
  sea.scale.set(w + 1400, 1, 900); sea.position.set(w / 2, seaY + 0.6, -440);
  group.add(sea);
  const puffs = [];
  const tints = [0xffffff, 0xfff0f4, 0xffe6e0, 0xf4e8ff];
  for (let i = 0; i < (w + 300) * 1.6 * dens; i++) {
    const z = -Math.pow(r(), 1.6) * 200 - 2;
    const x = r.range(-span(z), w + span(z)), s = r.range(2.2, 4.5) * (1 + -z * 0.035);
    puffs.push({ x, y: seaY + r.range(-0.6, 0.8) * s * 0.4, z, s, sy: r.range(0.45, 0.7), ry: r() * 6, c: r.pick(tints) });
  }
  group.add(instanced(g.puff, m.cloud, puffs.sort((a, b) => a.z - b.z)));

  // --- Islas lejanas con cascadas (balanceo suave)
  const isl = [];
  for (let x = -span(-80); x < w + span(-80); x += r.range(14, 30) / Math.sqrt(dens)) {
    const z = -r.range(28, 150), s = r.range(2.6, 5.5) * (1 + -z * 0.02);
    isl.push({ x, y: r.range(2, 12) + -z * 0.09, z, s, ry: r() * 6, ph: r() * 6, fall: r() < 0.6 });
  }
  isl.sort((a, b) => a.z - b.z);
  const islMesh = instanced(g.island, m.island, isl);
  const fallList = isl.filter((i) => i.fall);
  const fallGeo = shared(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0));
  const fallMesh = new THREE.InstancedMesh(fallGeo, m.fall, Math.max(1, fallList.length)); fallMesh.count = fallList.length; fallMesh.frustumCulled = false;
  group.add(islMesh, fallMesh);

  // --- Rocas flotantes cercanas
  const rocks = [];
  for (let i = 0; i < (w + 40) * 0.12 * dens + 4; i++) rocks.push({ x: r.range(-20, w + 20), y: r.range(-3, 13), z: -r.range(9, 24), s: r.range(0.5, 1.4), ry: r() * 6, ph: r() * 6 });
  const rockMesh = instanced(g.rock, m.island, rocks);
  group.add(rockMesh);

  // --- Globos aerostáticos a la deriva
  const balloons = [];
  for (let i = 0; i < Math.max(2, w / 60); i++) balloons.push({ x: r.range(0, w), y: r.range(10, 22), z: -r.range(40, 80), s: r.range(1.6, 2.4), ph: r() * 6, v: r.range(0.3, 0.6) });
  const balloonMesh = instanced(g.balloon, m.island, balloons);
  group.add(balloonMesh);

  // --- Nubes rosadas (sprites)
  const W0 = -220, W1 = w + 220, cl = [];
  for (let i = 0; i < (W1 - W0) / 11; i++) cl.push({ x: r.range(W0, W1), y: r.range(14, 55), z: -r.range(120, 240), s: r.range(18, 40), sy: r.range(0.5, 0.9), flip: r() < 0.5, speed: r.range(0.5, 1.0) });
  for (let i = 0; i < (W1 - W0) / 22; i++) cl.push({ x: r.range(W0, W1), y: r.range(-4, 6), z: -r.range(60, 110), s: r.range(14, 26), sy: 0.6, flip: r() < 0.5, speed: r.range(0.6, 1.2) });
  const clouds = cloudLayer(cl, { lit: 0xffe2c8, shade: 0xc0709a, x0: W0, x1: W1 });
  group.add(clouds.mesh);

  // --- Destellos en el aire
  const sparks = motes({ count: Math.round(60 * dens), box: [50, 22], z0: -2, z1: -18, yOff: 1, vel: [0.6, 0.05, 0], sway: 0.6, size: 0.1, color: 0xffe0b0, flicker: 0.8, opacity: 0.7, seed: 21 });
  group.add(sparks.mesh);

  const Mx = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const tex = m.fall.map;
  return {
    group,
    update(dt, camX, camY, time, px) {
      clouds.update(dt); sparks.update(dt, camX, camY, time, px);
      tex.offset.y = (tex.offset.y + dt * 0.9) % 1;
      let k = 0;
      isl.forEach((it, i) => {
        const y = it.y + Math.sin(time * 0.4 + it.ph) * 0.35 * it.s * 0.3;
        e.set(0, it.ry, Math.sin(time * 0.3 + it.ph) * 0.02); qq.setFromEuler(e); p.set(it.x, y, it.z); sc.setScalar(it.s); Mx.compose(p, qq, sc); islMesh.setMatrixAt(i, Mx);
        if (it.fall) {
          qq.identity(); p.set(it.x + it.s * 0.25, y - 0.05 * it.s, it.z + it.s * 0.98); sc.set(it.s * 0.28, Math.max(18, y - seaY + 2), 1); Mx.compose(p, qq, sc); fallMesh.setMatrixAt(k++, Mx);
        }
      });
      islMesh.instanceMatrix.needsUpdate = true; fallMesh.instanceMatrix.needsUpdate = true;
      rocks.forEach((it, i) => { e.set(0, it.ry + time * 0.1, 0); qq.setFromEuler(e); p.set(it.x, it.y + Math.sin(time * 0.8 + it.ph) * 0.3, it.z); sc.setScalar(it.s); Mx.compose(p, qq, sc); rockMesh.setMatrixAt(i, Mx); });
      rockMesh.instanceMatrix.needsUpdate = true;
      balloons.forEach((b, i) => { b.x += b.v * dt; if (b.x > w + 60) b.x = -60; qq.identity(); p.set(b.x, b.y + Math.sin(time * 0.5 + b.ph) * 0.6, b.z); sc.setScalar(b.s); Mx.compose(p, qq, sc); balloonMesh.setMatrixAt(i, Mx); });
      balloonMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
