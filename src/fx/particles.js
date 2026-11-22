// Sistema de partículas AAA: billboards instanciados con shader propio (2 draw calls: aditiva + alfa),
// trozos 3D instanciados (1 draw call) y textos de puntuación flotantes.
import * as THREE from 'three';
import { getAtlas, getPopupTexture, FRAME } from './textures.js';

/**
 * new Particles(scene, camera, {quality})
 * emit(type, x, y, opts): 'brick' (opts.theme|opts.color), 'coin', 'sparkle', 'stomp', 'dust' (opts.count),
 *   'land' (opts.strength 0..1), 'skid', 'fire', 'powerup', 'firework' (opts.colors), 'lava', 'death', 'star'
 * popup(text, x, y): texto flotante de puntuación ('1UP' en verde).
 * update(dt), clear()
 */

// ----------------------------------------------------------------- campos por partícula
const X = 0, Y = 1, Z = 2, VX = 3, VY = 4, VZ = 5, T = 6, LIFE = 7, S0 = 8, S1 = 9, ROT = 10, VR = 11,
  R = 12, G = 13, B = 14, R2 = 15, G2 = 16, B2 = 17, A = 18, DRAG = 19, GRAV = 20, STR = 21, FRM = 22,
  FLAGS = 23, OX = 24, OY = 25, ANG = 26, RAD = 27, AV = 28, RV = 29, FIN = 30, SEED = 31, STRIDE = 32;
const F_TWINKLE = 1, F_ORBIT = 2, F_RAINBOW = 4, F_VALIGN = 8, F_FADEPOW = 16, F_SHRINK = 32;

const Z_FX = 0.62;
const SIZE_MUL = 1.3; // escala global de los billboards // plano delante de los bloques

const VERT = /* glsl */`
attribute vec3 iPos; attribute vec4 iCol; attribute vec4 iData;
varying vec2 vUv; varying vec4 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec2 c = position.xy; c.x *= iData.z;
  float s = sin(iData.y), k = cos(iData.y);
  c = vec2(c.x * k - c.y * s, c.x * s + c.y * k);
  mv.xy += c * iData.x;
  gl_Position = projectionMatrix * mv;
  float f = iData.w;
  vec2 cellv = vec2(mod(f, 4.0), floor(f / 4.0 + 0.01));
  vUv = vec2((uv.x + cellv.x) * 0.25, (1.0 - uv.y + cellv.y) * 0.5);
  vCol = iCol;
}`;
const FRAG = /* glsl */`
uniform sampler2D map; uniform float uHot; uniform float uOcc; uniform float uGain;
varying vec2 vUv; varying vec4 vCol;
void main() {
  vec4 t = texture2D(map, vUv);
#ifdef ADDITIVE
  // Mezcla "aditiva con oclusión" premultiplicada: brilla en fondos oscuros y conserva color en cielos claros
  float cov = t.a * vCol.a;
  if (cov < 0.003) discard;
  gl_FragColor = vec4(vCol.rgb * uGain + vec3(t.r * uHot) * (0.5 + 0.5 * dot(vCol.rgb, vec3(0.33))), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * cov, cov * uOcc);
#else
  float a = t.a * vCol.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol.rgb * (0.62 + 0.5 * t.r), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
#endif
}`;

// ----------------------------------------------------------------- caché de módulo
let matAdd = null, matAlpha = null, chunkGeo = null, chunkMat = null;
function materials() {
  if (matAdd) return;
  const map = getAtlas();
  matAdd = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uHot: { value: 0.8 }, uOcc: { value: 0.8 }, uGain: { value: 1.8 } }, vertexShader: VERT, fragmentShader: FRAG,
    defines: { ADDITIVE: 1 }, transparent: true, depthWrite: false, toneMapped: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  matAlpha = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uHot: { value: 0 }, uOcc: { value: 1 }, uGain: { value: 1 } }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending, toneMapped: true,
  });
  // Trozo de ladrillo: caja biselada (bordes suavizados por normales promediadas)
  const g = new THREE.BoxGeometry(1, 0.72, 0.8, 2, 2, 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 - 0.12 * (Math.abs(v.x) > 0.49 && Math.abs(v.y) > 0.35 ? 1 : 0);
    p.setXYZ(i, v.x * k, v.y * (1 - 0.1 * (Math.abs(v.x) > 0.49 ? 1 : 0)), v.z * k);
  }
  g.computeVertexNormals();
  g.userData.shared = true;
  chunkGeo = g;
  chunkMat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.0 });
}

const BRICK_COLORS = { pradera: 0xc8643a, cueva: 0x6670c8, cielo: 0xe0956a, castillo: 0x86707a };
const DUST_TINT = 1.25;
const DUST_COLORS = { pradera: 0xf3e2c4, cueva: 0xb9b6d8, cielo: 0xfff0f0, castillo: 0x9a8a88 };
const FW_PALETTE = [0xff3b6b, 0xffd23a, 0x3ad7ff, 0x8cff4a, 0xc86bff, 0xff8a2a, 0xffffff, 0x4affc8];

function qualityScale(q) { return q === 'low' ? 0.45 : q === 'medium' ? 0.75 : 1; }
function detectQuality() {
  try { const q = new URLSearchParams(location.search).get('q'); if (q) return q; } catch (e) { /* sin URL */ }
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4;
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return lowEnd ? 'low' : touch ? 'medium' : 'high';
}

const rand = (a, b) => a + Math.random() * (b - a);
const easeOut = (k) => 1 - (1 - k) * (1 - k);
function elasticOut(k) { if (k <= 0) return 0; if (k >= 1) return 1; return Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1; }

// ----------------------------------------------------------------- pool de billboards
class BillboardPool {
  constructor(cap, material, renderOrder) {
    this.cap = cap; this.n = 0;
    this.d = new Float32Array(cap * STRIDE);
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.dat = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.pos); geo.setAttribute('iCol', this.col); geo.setAttribute('iData', this.dat);
    geo.instanceCount = 0;
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder;
  }
  push(p) {
    if (this.n >= this.cap) {
      // pool lleno: reemplaza la partícula más vieja aproximada (aleatoria) para no perder el efecto nuevo
      const i = (Math.random() * this.cap) | 0; this.write(i * STRIDE, p); return;
    }
    this.write(this.n++ * STRIDE, p);
  }
  write(o, p) {
    const d = this.d;
    d[o + X] = p.x; d[o + Y] = p.y; d[o + Z] = p.z; d[o + VX] = p.vx; d[o + VY] = p.vy; d[o + VZ] = p.vz;
    d[o + T] = -p.delay; d[o + LIFE] = p.life; d[o + S0] = p.s0; d[o + S1] = p.s1; d[o + ROT] = p.rot; d[o + VR] = p.vr;
    d[o + R] = p.c.r; d[o + G] = p.c.g; d[o + B] = p.c.b; d[o + R2] = p.c2.r; d[o + G2] = p.c2.g; d[o + B2] = p.c2.b;
    d[o + A] = p.a; d[o + DRAG] = p.drag; d[o + GRAV] = p.grav; d[o + STR] = p.str; d[o + FRM] = p.frame;
    d[o + FLAGS] = p.flags; d[o + OX] = p.ox; d[o + OY] = p.oy; d[o + ANG] = p.ang; d[o + RAD] = p.rad;
    d[o + AV] = p.av; d[o + RV] = p.rv; d[o + FIN] = p.fin; d[o + SEED] = Math.random() * 100;
  }
  update(dt, time) {
    const d = this.d, P = this.pos.array, C = this.col.array, D = this.dat.array;
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      let o = i * STRIDE;
      let t = d[o + T] + dt;
      if (t >= d[o + LIFE]) { // muerta: swap-remove
        this.n--;
        if (i < this.n) { d.copyWithin(o, this.n * STRIDE, this.n * STRIDE + STRIDE); i--; }
        continue;
      }
      d[o + T] = t;
      if (t < 0) continue; // retardada
      const flags = d[o + FLAGS];
      const drag = Math.exp(-d[o + DRAG] * dt);
      if (flags & F_ORBIT) {
        d[o + ANG] += d[o + AV] * dt; d[o + RAD] = Math.max(0, d[o + RAD] + d[o + RV] * dt);
        d[o + OY] += d[o + VY] * dt; d[o + VY] *= drag;
        d[o + X] = d[o + OX] + Math.cos(d[o + ANG]) * d[o + RAD];
        d[o + Y] = d[o + OY] + Math.sin(d[o + ANG]) * d[o + RAD] * 0.35;
        d[o + Z] = Z_FX + Math.sin(d[o + ANG]) * d[o + RAD] * 0.5;
      } else {
        d[o + VX] *= drag; d[o + VY] = d[o + VY] * drag - d[o + GRAV] * dt; d[o + VZ] *= drag;
        d[o + X] += d[o + VX] * dt; d[o + Y] += d[o + VY] * dt; d[o + Z] += d[o + VZ] * dt;
      }
      d[o + ROT] += d[o + VR] * dt;
      const k = t / d[o + LIFE];
      // tamaño
      let size = d[o + S0] + (d[o + S1] - d[o + S0]) * easeOut(k);
      if (flags & F_SHRINK) size *= 1 - k * k;
      // alfa: entrada rápida y salida suave
      const fin = d[o + FIN];
      let a = d[o + A] * (fin > 0 ? Math.min(1, k / fin) : 1);
      a *= (flags & F_FADEPOW) ? (1 - k) * (1 - k) : 1 - Math.pow(k, 3);
      if (flags & F_TWINKLE) a *= 0.55 + 0.45 * Math.sin(time * 38 + d[o + SEED] * 7);
      // color
      let r = d[o + R] + (d[o + R2] - d[o + R]) * k, g = d[o + G] + (d[o + G2] - d[o + G]) * k, b = d[o + B] + (d[o + B2] - d[o + B]) * k;
      if (flags & F_RAINBOW) {
        const h = (time * 1.6 + d[o + SEED] * 0.1) % 1;
        _c.setHSL(h, 1, 0.6); r = _c.r * 2; g = _c.g * 2; b = _c.b * 2;
      }
      let rot = d[o + ROT], str = d[o + STR];
      if (flags & F_VALIGN) {
        const vx = d[o + VX], vy = d[o + VY], sp = Math.hypot(vx, vy);
        rot = Math.atan2(vy, vx); str = 1 + Math.min(5, sp * d[o + STR]);
      }
      const p3 = w * 3, p4 = w * 4;
      P[p3] = d[o + X]; P[p3 + 1] = d[o + Y]; P[p3 + 2] = d[o + Z];
      C[p4] = r; C[p4 + 1] = g; C[p4 + 2] = b; C[p4 + 3] = a;
      D[p4] = size * SIZE_MUL; D[p4 + 1] = rot; D[p4 + 2] = str; D[p4 + 3] = d[o + FRM];
      w++;
    }
    this.geo.instanceCount = w;
    if (w) {
      this.pos.clearUpdateRanges(); this.pos.addUpdateRange(0, w * 3); this.pos.needsUpdate = true;
      this.col.clearUpdateRanges(); this.col.addUpdateRange(0, w * 4); this.col.needsUpdate = true;
      this.dat.clearUpdateRanges(); this.dat.addUpdateRange(0, w * 4); this.dat.needsUpdate = true;
    }
    this.mesh.visible = w > 0;
  }
  clear() { this.n = 0; this.geo.instanceCount = 0; this.mesh.visible = false; }
}
const _c = new THREE.Color();

// ----------------------------------------------------------------- trozos 3D
const CS = 14; // x y z vx vy vz rx ry rz wx wy wz t life  (+ escala y rebotes aparte)
class ChunkPool {
  constructor(cap) {
    this.cap = cap; this.n = 0;
    this.d = new Float32Array(cap * CS); this.s = new Float32Array(cap); this.bn = new Uint8Array(cap);
    this.cr = new Float32Array(cap * 3);
    this.mesh = new THREE.InstancedMesh(chunkGeo, chunkMat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false;
  }
  push(x, y, z, vx, vy, vz, scale, life, color) {
    if (this.n >= this.cap) return;
    const i = this.n++, o = i * CS, d = this.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
    d[o + 6] = rand(0, 6); d[o + 7] = rand(0, 6); d[o + 8] = rand(0, 6);
    d[o + 9] = rand(-14, 14); d[o + 10] = rand(-14, 14); d[o + 11] = rand(-10, 10);
    d[o + 12] = 0; d[o + 13] = life; this.s[i] = scale; this.bn[i] = 0;
    this.cr[i * 3] = color.r; this.cr[i * 3 + 1] = color.g; this.cr[i * 3 + 2] = color.b;
  }
  update(dt, level) {
    const d = this.d;
    for (let i = 0; i < this.n; i++) {
      const o = i * CS;
      d[o + 12] += dt;
      if (d[o + 12] >= d[o + 13] || d[o + 1] < -14) {
        const last = --this.n;
        if (i < last) {
          d.copyWithin(o, last * CS, last * CS + CS); this.s[i] = this.s[last]; this.bn[i] = this.bn[last];
          this.cr.copyWithin(i * 3, last * 3, last * 3 + 3);
        }
        i--; continue;
      }
      d[o + 4] -= 46 * dt;
      const drag = Math.exp(-0.6 * dt);
      d[o + 3] *= drag; d[o + 5] *= drag;
      const py = d[o + 1];
      d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
      d[o + 6] += d[o + 9] * dt; d[o + 7] += d[o + 10] * dt; d[o + 8] += d[o + 11] * dt;
      // rebote contra el suelo/bloques del nivel
      const hs = this.s[i] * 0.36;
      if (level && d[o + 4] < 0 && this.bn[i] < 3 && Math.abs(d[o + 2]) < 1.2) {
        const tx = Math.floor(d[o]), ty = Math.floor(d[o + 1] - hs);
        if (level.isSolid(tx, ty) && !level.isSolid(tx, Math.floor(py - hs + 0.001) + 1)) {
          d[o + 1] = ty + 1 + hs; d[o + 4] = -d[o + 4] * 0.42; d[o + 3] *= 0.6; d[o + 5] *= 0.6;
          d[o + 9] *= 0.5; d[o + 10] *= 0.5; d[o + 11] *= 0.5; this.bn[i]++;
          if (Math.abs(d[o + 4]) < 1.5) { d[o + 4] = 0; this.bn[i] = 3; d[o + 13] = Math.min(d[o + 13], d[o + 12] + 0.5); }
        }
      }
      if (this.bn[i] >= 3 && level && level.isSolid(Math.floor(d[o]), Math.floor(d[o + 1] - hs - 0.02))) {
        d[o + 4] = Math.max(0, d[o + 4]); d[o + 3] *= Math.exp(-8 * dt); d[o + 9] *= 0.9; d[o + 10] *= 0.9; d[o + 11] *= 0.9;
      }
    }
    const m = this.mesh;
    for (let i = 0; i < this.n; i++) {
      const o = i * CS, k = d[o + 12] / d[o + 13];
      const sc = this.s[i] * (k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1);
      _e.set(d[o + 6], d[o + 7], d[o + 8]); _q.setFromEuler(_e);
      _v.set(d[o], d[o + 1], d[o + 2]); _s.set(sc, sc, sc);
      _m.compose(_v, _q, _s); m.setMatrixAt(i, _m);
      _c.setRGB(this.cr[i * 3], this.cr[i * 3 + 1], this.cr[i * 3 + 2]); m.setColorAt(i, _c);
    }
    m.count = this.n;
    if (this.n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    m.visible = this.n > 0;
  }
  clear() { this.n = 0; this.mesh.count = 0; this.mesh.visible = false; }
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

// ----------------------------------------------------------------- plantilla de partícula
const P = { c: new THREE.Color(), c2: new THREE.Color() };
function reset(x, y) {
  P.x = x; P.y = y; P.z = Z_FX + rand(-0.04, 0.04); P.vx = 0; P.vy = 0; P.vz = 0; P.delay = 0; P.life = 0.6;
  P.s0 = 0.3; P.s1 = 0.3; P.rot = Math.random() * 6.283; P.vr = 0; P.c.setRGB(1, 1, 1); P.c2.setRGB(1, 1, 1);
  P.a = 1; P.drag = 0; P.grav = 0; P.str = 1; P.frame = FRAME.GLOW; P.flags = 0; P.ox = x; P.oy = y; P.ang = 0;
  P.rad = 0; P.av = 0; P.rv = 0; P.fin = 0.05;
  return P;
}
function col(hex, mul = 1) { P.c.setHex(hex).multiplyScalar(mul); P.c2.copy(P.c); }
function col2(hex, mul = 1) { P.c2.setHex(hex).multiplyScalar(mul); }

// ----------------------------------------------------------------- clase pública
export class Particles {
  constructor(scene, camera, opts = {}) {
    materials();
    this.scene = scene; this.camera = camera;
    this.quality = opts.quality || detectQuality();
    this.q = qualityScale(this.quality);
    const capMul = this.quality === 'low' ? 0.5 : 1;
    this.alpha = new BillboardPool(Math.round(900 * capMul), matAlpha, 18);
    this.add = new BillboardPool(Math.round(2600 * capMul), matAdd, 19);
    this.chunks = new ChunkPool(this.quality === 'low' ? 48 : 128);
    scene.add(this.chunks.mesh, this.alpha.mesh, this.add.mesh);
    this.popups = [];
    this.time = 0;
    this.level = opts.level || null;
  }
  n(count) { return Math.max(1, Math.round(count * this.q)); }

  emit(type, x, y, opts = {}) {
    const fn = EMIT[type];
    if (fn) fn(this, x, y, opts);
  }

  popup(text, x, y) {
    const e = getPopupTexture(String(text));
    const mat = new THREE.SpriteMaterial({ map: e.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    mat.color.setScalar(1.35); // compensa el tone mapping del postprocesado
    const s = new THREE.Sprite(mat);
    s.geometry.userData.shared = true;
    s.renderOrder = 40;
    s.position.set(x, y, Z_FX + 0.3);
    this.scene.add(s);
    const h = e.oneUp ? 1.1 : 0.85;
    this.popups.push({ s, mat, x, y, t: 0, life: e.oneUp ? 1.25 : 0.95, h, w: h * e.aspect });
    // pequeño destello en el origen del texto
    const p = reset(x, y); p.frame = FRAME.FLARE; p.life = 0.28; p.s0 = 0.2; p.s1 = 1.1; col(e.oneUp ? 0x6aff7a : 0xffd65a, 1.2); p.flags = F_FADEPOW;
    this.add.push(p);
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const level = this.level || (typeof window !== 'undefined' && window.game && window.game.level) || null;
    // Fondos claros: más oclusión para que el color se lea; fondos oscuros: brillo aditivo puro
    const theme = level && level.theme;
    const occ = theme === 'cueva' || theme === 'castillo' ? 0.3 : 0.82;
    matAdd.uniforms.uOcc.value += (occ - matAdd.uniforms.uOcc.value) * Math.min(1, dt * 10 + (this.time < 0.2 ? 1 : 0));
    this.alpha.update(dt, this.time);
    this.add.update(dt, this.time);
    this.chunks.update(dt, level && level.isSolid ? level : null);
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { this.scene.remove(p.s); p.mat.dispose(); this.popups.splice(i, 1); continue; }
      const sc = elasticOut(Math.min(1, p.t / 0.42));
      const sq = 1 + 0.12 * Math.sin(Math.min(1, p.t / 0.42) * Math.PI); // ligero estirado vertical al aparecer
      p.s.scale.set(p.w * sc, p.h * sc * sq, 1);
      p.s.position.y = p.y + 1.25 * easeOut(Math.min(1, k * 1.2));
      p.mat.opacity = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
    }
  }

  clear() {
    this.alpha.clear(); this.add.clear(); this.chunks.clear();
    for (const p of this.popups) { this.scene.remove(p.s); p.mat.dispose(); }
    this.popups.length = 0;
  }
}

// ----------------------------------------------------------------- emisores
function flash(ps, x, y, hex, size, life = 0.22, mul = 1.4) {
  const p = reset(x, y); p.frame = FRAME.GLOW; p.life = life; p.s0 = size * 0.45; p.s1 = size; col(hex, mul); p.a = 0.8; p.flags = F_FADEPOW; p.fin = 0.12;
  ps.add.push(p);
}
function ring(pool, x, y, hex, size, life = 0.4, mul = 1, stretch = 1, a = 1) {
  const p = reset(x, y); p.frame = FRAME.RING; p.life = life; p.s0 = size * 0.15; p.s1 = size; col(hex, mul);
  p.flags = F_FADEPOW; p.rot = 0; p.str = stretch; p.a = a; p.fin = 0.05;
  pool.push(p);
}
function puff(ps, x, y, hex, o) {
  const p = reset(x, y);
  p.frame = Math.random() < 0.5 ? FRAME.SMOKE : FRAME.SMOKE2; p.life = o.life || rand(0.45, 0.8);
  p.s0 = o.s0 || 0.3; p.s1 = o.s1 || 0.8; col(hex, o.additive ? 1 : DUST_TINT); if (o.hex2 !== undefined) col2(o.hex2);
  p.vx = o.vx || 0; p.vy = o.vy || 0; p.drag = o.drag ?? 4; p.grav = o.grav ?? -0.8; p.vr = rand(-2, 2);
  p.a = o.a ?? 0.75; p.fin = 0.12; p.z = Z_FX - 0.08 + rand(-0.05, 0.05);
  (o.additive ? ps.add : ps.alpha).push(p);
}
function sparks(ps, x, y, count, hex, hex2, o = {}) {
  for (let i = 0; i < count; i++) {
    const a = o.dir !== undefined ? o.dir + rand(-o.spread, o.spread) : Math.random() * 6.283;
    const sp = rand(o.min ?? 4, o.max ?? 9);
    const p = reset(x, y); p.frame = FRAME.SPARK; p.flags = F_VALIGN | (o.twinkle ? F_TWINKLE : 0);
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.vz = o.vz ? rand(-o.vz, o.vz) : 0;
    p.life = rand(o.lmin ?? 0.3, o.lmax ?? 0.55); p.s0 = (o.size ?? 0.16) * 1.4; p.s1 = (o.size ?? 0.16) * 0.6;
    p.str = o.str ?? 0.12; p.drag = o.drag ?? 3; p.grav = o.grav ?? 6; col(hex, o.mul ?? 1.6); col2(hex2, o.mul2 ?? 0.9);
    p.delay = o.delay ? rand(0, o.delay) : 0;
    ps.add.push(p);
  }
}
function stars(ps, x, y, count, hex, o = {}) {
  for (let i = 0; i < count; i++) {
    const a = o.dir !== undefined ? o.dir + (count > 1 ? (i / (count - 1) - 0.5) * o.spread * 2 : 0) : (i / count) * 6.283 + rand(-0.3, 0.3);
    const sp = rand(o.min ?? 3, o.max ?? 6);
    const p = reset(x, y); p.frame = FRAME.STAR; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp + (o.up ?? 0);
    p.life = rand(o.lmin ?? 0.45, o.lmax ?? 0.7); p.s0 = (o.size ?? 0.42) * 1.25; p.s1 = (o.size ?? 0.42) * 0.85;
    p.vr = rand(-7, 7); p.drag = o.drag ?? 2.5; p.grav = o.grav ?? 9; col(hex, o.mul ?? 1.2); if (o.hex2 !== undefined) col2(o.hex2, o.mul ?? 1.3);
    p.flags = (o.twinkle ? F_TWINKLE : 0) | F_SHRINK; p.fin = 0.02;
    (o.alpha ? ps.alpha : ps.add).push(p);
  }
}

const EMIT = {
  brick(ps, x, y, o) {
    const base = new THREE.Color(o.color !== undefined ? o.color : BRICK_COLORS[o.theme] ?? BRICK_COLORS.pradera);
    const n = ps.n(12);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const c = base.clone().offsetHSL(rand(-0.015, 0.015), rand(-0.05, 0.05), rand(-0.1, 0.06));
      if (i % 5 === 4) c.setHex(0xd8c8b0).multiplyScalar(0.8); // trozo de mortero
      ps.chunks.push(x + side * rand(0.05, 0.4), y + rand(-0.3, 0.35), rand(-0.2, 0.45),
        side * rand(1.5, 5.5), rand(9, 16), rand(-1.5, 3), rand(0.26, 0.42), rand(1.6, 2.2), c);
    }
    const dust = DUST_COLORS[o.theme] ?? DUST_COLORS.pradera;
    for (let i = 0; i < ps.n(7); i++) {
      const a = Math.random() * 6.283;
      puff(ps, x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3, dust, { vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 + 1, s0: 0.35, s1: 1.0, life: rand(0.45, 0.75), a: 0.7 });
    }
    flash(ps, x, y, 0xfff0d0, 1.7, 0.16, 0.9);
    sparks(ps, x, y, ps.n(8), 0xffe6b0, 0xff8a40, { min: 5, max: 10, size: 0.12, grav: 18 });
  },

  coin(ps, x, y) {
    flash(ps, x, y, 0xffd040, 2.0, 0.22, 1.3);
    ring(ps.add, x, y, 0xffc830, 1.7, 0.32, 1.6);
    const p = reset(x, y); p.frame = FRAME.FLARE; p.life = 0.3; p.s0 = 0.4; p.s1 = 1.8; col(0xfff2b0, 1.6); p.flags = F_FADEPOW; p.rot = 0; p.vr = 2; ps.add.push(p);
    stars(ps, x, y, ps.n(6), 0xffe070, { min: 2.5, max: 4.5, up: 2, size: 0.32, grav: 5, twinkle: true, lmin: 0.5, lmax: 0.8 });
    sparks(ps, x, y, ps.n(10), 0xfff0a0, 0xff9a20, { min: 4, max: 8, size: 0.13, grav: 4 });
  },

  sparkle(ps, x, y) {
    flash(ps, x, y, 0xfff0a0, 1.3, 0.25, 0.9);
    for (let i = 0; i < ps.n(12); i++) {
      const p = reset(x + rand(-0.6, 0.6), y + rand(-0.5, 0.5));
      p.frame = i % 3 ? FRAME.FLARE : FRAME.STAR; p.life = rand(0.4, 0.8); p.delay = rand(0, 0.2);
      p.s0 = rand(0.2, 0.45); p.s1 = 0.05; p.vy = rand(0.8, 2.2); p.vx = rand(-0.8, 0.8); p.drag = 1.5; p.vr = rand(-3, 3);
      col(i % 2 ? 0xffffff : 0xffe27a, 1.5); p.flags = F_TWINKLE; p.fin = 0.2;
      ps.add.push(p);
    }
  },

  stomp(ps, x, y) {
    ring(ps.alpha, x, y, 0xffffff, 2.2, 0.32, 1.1, 1, 0.9);
    ring(ps.add, x, y, 0xffe9a0, 1.6, 0.25, 1.0);
    const f = reset(x, y + 0.05); f.frame = FRAME.FLARE; f.life = 0.18; f.s0 = 0.6; f.s1 = 1.9; f.rot = 0.3; col(0xffffff, 1.4); f.flags = F_FADEPOW; ps.add.push(f);
    stars(ps, x, y + 0.1, ps.n(5), 0xffe14a, { dir: Math.PI / 2, spread: 1.15, min: 4, max: 6, size: 0.42, grav: 14, lmin: 0.5, lmax: 0.65, hex2: 0xffa020 });
    for (let i = 0; i < ps.n(6); i++) {
      const s = i % 2 ? 1 : -1;
      puff(ps, x + s * 0.25, y - 0.2, 0xf6efe4, { vx: s * rand(2, 4.5), vy: rand(0.3, 1.2), s0: 0.28, s1: 0.75, life: rand(0.35, 0.55), a: 0.8, drag: 6 });
    }
  },

  dust(ps, x, y, o) {
    const n = ps.n(o.count || 4);
    for (let i = 0; i < n; i++) {
      puff(ps, x + rand(-0.25, 0.25), y + rand(0, 0.15), 0xf1e6d4, { vx: rand(-1.6, 1.6), vy: rand(0.4, 1.6), s0: rand(0.18, 0.3), s1: rand(0.5, 0.8), life: rand(0.4, 0.65), a: 0.7, drag: 5 });
    }
  },

  land(ps, x, y, o) {
    const s = o.strength ?? 0.6;
    const n = ps.n(4 + Math.round(10 * s));
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      puff(ps, x + side * rand(0.1, 0.4), y + rand(0, 0.12), 0xf1e6d4, { vx: side * rand(2, 6) * (0.5 + s), vy: rand(0.2, 1.4), s0: 0.22, s1: 0.6 + 0.4 * s, life: rand(0.4, 0.7), a: 0.75, drag: 5.5, grav: -0.4 });
    }
    if (s > 0.45) ring(ps.alpha, x, y + 0.04, 0xffffff, 1.8 * s + 0.6, 0.3, 1.05, 3.2, 0.55);
  },

  skid(ps, x, y) {
    puff(ps, x, y + 0.12, 0xe9e3dc, { vx: rand(-0.6, 0.6), vy: rand(0.6, 1.4), s0: 0.18, s1: rand(0.45, 0.7), life: rand(0.35, 0.55), a: 0.6, drag: 3 });
  },

  fire(ps, x, y) {
    flash(ps, x, y, 0xff8a20, 1.8, 0.2, 1.4);
    ring(ps.add, x, y, 0xffa040, 1.3, 0.25, 1.4);
    sparks(ps, x, y, ps.n(12), 0xfff0a0, 0xff3010, { min: 3, max: 8, size: 0.14, grav: 10, lmin: 0.25, lmax: 0.5 });
    for (let i = 0; i < ps.n(5); i++) {
      const a = Math.random() * 6.283;
      puff(ps, x, y, 0xffb040, { additive: true, hex2: 0x801000, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2 + 0.8, s0: 0.3, s1: 0.7, life: rand(0.25, 0.4), a: 0.9, drag: 6, grav: -2 });
    }
    for (let i = 0; i < ps.n(3); i++) puff(ps, x + rand(-0.2, 0.2), y + 0.1, 0x403434, { vy: rand(1, 2), s0: 0.25, s1: 0.8, life: rand(0.5, 0.8), a: 0.45, grav: -1.5 });
  },

  powerup(ps, x, y) {
    flash(ps, x, y, 0xfff3c0, 3.2, 0.5, 1.0);
    ring(ps.add, x, y, 0xffe080, 3.2, 0.5, 1.2);
    ring(ps.add, x, y, 0xffffff, 2.2, 0.35, 0.9);
    const n = ps.n(36), hues = [0xfff2a0, 0xffd040, 0xffffff, 0x9ff0ff];
    for (let i = 0; i < n; i++) {
      const p = reset(x, y); p.flags = F_ORBIT | F_TWINKLE;
      p.ang = (i / n) * 6.283 * 2; p.rad = 1.1; p.rv = -0.9; p.av = 9; p.oy = y - 0.9 + (i / n) * 0.4; p.vy = 3.2; p.drag = 1.2;
      p.frame = i % 4 === 0 ? FRAME.STAR : FRAME.SPARK; p.life = rand(0.7, 1.0); p.delay = (i / n) * 0.25;
      p.s0 = i % 4 === 0 ? 0.32 : 0.2; p.s1 = 0.06; col(hues[i % 4], 1.7); p.fin = 0.1;
      ps.add.push(p);
    }
    for (let i = 0; i < ps.n(10); i++) { // rayos verticales
      const p = reset(x + rand(-0.6, 0.6), y - 0.6); p.frame = FRAME.SPARK; p.flags = F_VALIGN; p.vy = rand(5, 9); p.drag = 2.5; p.str = 0.35;
      p.life = rand(0.4, 0.7); p.s0 = 0.14; p.s1 = 0.05; col(0xfff6c8, 1.5); p.delay = rand(0, 0.25); ps.add.push(p);
    }
  },

  firework(ps, x, y, o) {
    const pick = () => FW_PALETTE[(Math.random() * FW_PALETTE.length) | 0];
    const pal = o.colors || [pick(), pick()];
    const c1 = pal[0], c2 = pal[1] ?? pal[0];
    flash(ps, x, y, 0xffffff, 4, 0.2, 1.2);
    flash(ps, x, y, c1, 9, 0.7, 0.55);
    const n = ps.n(110);
    for (let i = 0; i < n; i++) {
      // esfera proyectada: los bordes concentran chispas -> peonía nítida
      const u = Math.random() * 2 - 1, th = Math.random() * 6.283, rr = Math.sqrt(1 - u * u);
      const inner = i % 4 === 0;
      const sp = (inner ? 5.5 : 9.5) * rand(0.94, 1.04);
      const hc = inner ? c2 : c1;
      for (let k = 0; k < 2; k++) { // cabeza brillante + estela
        const p = reset(x, y); p.frame = FRAME.SPARK; p.flags = F_VALIGN | (k ? 0 : (i % 2 ? F_TWINKLE : 0));
        const f = k ? 0.9 : 1;
        p.vx = Math.cos(th) * rr * sp * f; p.vy = Math.sin(th) * rr * sp * f; p.vz = u * sp * 0.2;
        p.drag = 2.3; p.grav = 3.2; p.life = k ? rand(0.6, 0.9) : rand(1.2, 1.7); p.fin = 0.01;
        if (k) { p.s0 = 0.3; p.s1 = 0.08; p.str = 0.22; col(hc, 1.0); col2(hc, 0.3); p.a = 0.8; }
        else { p.s0 = 0.4; p.s1 = 0.16; p.str = 0.07; col(hc, 2.0); col2(hc, 0.9); }
        ps.add.push(p);
        if (ps.quality === 'low') break;
      }
    }
    // crepitar retardado
    for (let i = 0; i < ps.n(30); i++) {
      const a = Math.random() * 6.283, r = rand(1.8, 4.2);
      const p = reset(x + Math.cos(a) * r, y + Math.sin(a) * r - 0.6); p.frame = FRAME.FLARE; p.flags = F_TWINKLE | F_FADEPOW;
      p.delay = rand(0.55, 1.1); p.life = rand(0.25, 0.45); p.s0 = 0.7; p.s1 = 0.25; p.grav = 1; col(i % 2 ? 0xffffff : 0xfff0b0, 1.5); p.vr = 4;
      ps.add.push(p);
    }
    ring(ps.add, x, y, c2, 5.5, 0.5, 1.2);
  },

  lava(ps, x, y) {
    flash(ps, x, y, 0xff5010, 2.6, 0.35, 1.2);
    for (let i = 0; i < ps.n(18); i++) {
      const a = Math.PI / 2 + rand(-0.9, 0.9), sp = rand(5, 11);
      const p = reset(x + rand(-0.3, 0.3), y); p.frame = FRAME.DROP; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.grav = 30; p.drag = 0.5; p.life = rand(0.6, 1.0); p.s0 = rand(0.18, 0.34); p.s1 = 0.08; col(0xffc040, 1.8); col2(0xff2000, 1.2);
      p.flags = F_VALIGN; p.str = 0.03; ps.add.push(p);
    }
    for (let i = 0; i < ps.n(5); i++) puff(ps, x + rand(-0.4, 0.4), y + 0.2, 0x3a2a2a, { vy: rand(1.5, 3), s0: 0.4, s1: 1.2, life: rand(0.8, 1.2), a: 0.5, grav: -1.5, drag: 1.5 });
    sparks(ps, x, y + 0.2, ps.n(10), 0xffe080, 0xff3000, { dir: Math.PI / 2, spread: 0.8, min: 3, max: 7, size: 0.1, grav: -1, drag: 1.5, lmin: 0.6, lmax: 1.1, twinkle: true });
  },

  death(ps, x, y) {
    flash(ps, x, y, 0xffffff, 3, 0.3, 1.1);
    ring(ps.alpha, x, y, 0xffffff, 2.6, 0.45, 1.1, 1, 0.85);
    stars(ps, x, y, ps.n(8), 0xffe060, { min: 3.5, max: 5.5, size: 0.45, grav: 4, lmin: 0.7, lmax: 0.9, hex2: 0xff6aa0, twinkle: true });
    for (let i = 0; i < ps.n(6); i++) {
      const a = Math.random() * 6.283;
      puff(ps, x, y, 0xf4f0ff, { vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, s0: 0.3, s1: 0.9, life: rand(0.5, 0.8), a: 0.75, drag: 5 });
    }
  },

  star(ps, x, y) {
    const n = ps.quality === 'low' ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const p = reset(x + rand(-0.35, 0.35), y + rand(-0.4, 0.45)); p.frame = Math.random() < 0.35 ? FRAME.STAR : FRAME.FLARE;
      p.flags = F_RAINBOW | F_SHRINK; p.life = rand(0.35, 0.6); p.s0 = rand(0.25, 0.42); p.s1 = p.s0;
      p.vy = rand(0.3, 1.2); p.vx = rand(-0.5, 0.5); p.drag = 2; p.vr = rand(-4, 4); p.fin = 0.1;
      ps.add.push(p);
    }
  },
};
