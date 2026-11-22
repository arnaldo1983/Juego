// Utilidades compartidas de los modelos procedurales (caché de geometrías/materiales/texturas,
// generadores de geometría, ojos expresivos, brillo aditivo, rim-light estilizado).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const TAU = Math.PI * 2;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);

export function quality() {
  const g = typeof window !== 'undefined' && window.game;
  if (g && g.quality) return g.quality;
  try { return new URLSearchParams(location.search).get('q') || 'high'; } catch { return 'high'; }
}
export const isLow = () => quality() === 'low';
export const isHigh = () => quality() === 'high';
/** Segmentos según calidad. */
export const segs = (hi, mid = Math.round(hi * 0.75), lo = Math.round(hi * 0.5)) => {
  const q = quality(); return q === 'high' ? hi : q === 'medium' ? mid : lo;
};

// ------------------------------------------------------------------ caché
const CACHE = new Map();
/** Cachea cualquier recurso a nivel de módulo. Las geometrías se marcan como compartidas. */
export function cached(key, make) {
  let v = CACHE.get(key);
  if (v === undefined) {
    v = make();
    if (v && v.isBufferGeometry) v.userData.shared = true;
    CACHE.set(key, v);
  }
  return v;
}

// ------------------------------------------------------------------ mapa de entorno (reflejos metálicos)
let envTex = null, envTried = false;
export function getEnv() {
  if (envTex || envTried) return envTex;
  const r = typeof window !== 'undefined' && window.game && window.game.renderer;
  if (!r) return null;
  envTried = true;
  try {
    const pm = new THREE.PMREMGenerator(r);
    const room = new RoomEnvironment();
    // tono cálido de estudio: tinte suave al "techo" del entorno
    envTex = pm.fromScene(room, 0.035).texture;
    room.traverse && room.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    pm.dispose();
  } catch (e) { envTex = null; }
  return envTex;
}

// ------------------------------------------------------------------ rim light estilizado (fresnel emisivo)
function rimCompile(shader) {
  shader.uniforms.uRim = this.userData.rim;
  shader.uniforms.uRimPow = this.userData.rimPow;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uRimPow;')
    .replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n{ float fr = 1.0 - saturate(abs(dot(normalize(vViewPosition), normal)));\n  totalEmissiveRadiance += uRim * pow(fr, uRimPow); }');
}
export function rim(mat, color = 0xfff2d8, strength = 0.35, power = 3.0) {
  mat.userData.rim = { value: new THREE.Color(color).multiplyScalar(strength) };
  mat.userData.rimPow = { value: power };
  mat.onBeforeCompile = rimCompile;
  return mat;
}

/** Material estándar cacheado. opts admite cualquier parámetro de MeshStandard/MeshPhysical y rim:[color,str,pow]. */
export function mat(key, opts = {}) {
  return cached('mat:' + key, () => {
    const { physical, rim: r, env, ...o } = opts;
    const m = physical ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o);
    if (env) { const e = getEnv(); if (e) { m.envMap = e; m.envMapIntensity = env === true ? 1 : env; } }
    if (r) rim(m, r[0], r[1], r[2]);
    return m;
  });
}

// ------------------------------------------------------------------ texturas de canvas
export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}
export function tex(key, w, h, draw, { srgb = true, repeat = true, aniso = 4 } = {}) {
  return cached('tex:' + key, () => {
    const [c, g] = canvas(w, h); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  });
}
// ruido de valor determinista para texturas
let seed = 1337;
export const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export function noiseFill(g, w, h, amount = 18, size = 1) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) {
    const n = (rnd() - 0.5) * amount;
    for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
      const i = ((y + yy) * w + x + xx) * 4; if (i >= d.length) continue;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  g.putImageData(img, 0, 0);
}

/** Sprite de brillo radial (aditivo). */
export function glowTex() {
  return tex('glow', 128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, { repeat: false });
}
export function sparkleTex() {
  return tex('sparkle', 128, 128, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.35);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.globalCompositeOperation = 'lighter';
    for (const [len, wd] of [[c, 3.2], [c * 0.55, 2]]) {
      for (let k = 0; k < (len === c ? 2 : 2); k++) {
        g.save(); g.translate(c, c); g.rotate(k * Math.PI / 2 + (len === c ? 0 : Math.PI / 4));
        const lg = g.createLinearGradient(-len, 0, len, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg; g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, -wd); g.lineTo(len, 0); g.lineTo(0, wd); g.closePath(); g.fill();
        g.restore();
      }
    }
  }, { repeat: false });
}
export function glowMat(key, color, opacity = 1, map = glowTex()) {
  return cached('glowmat:' + key, () => new THREE.SpriteMaterial({
    map, color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false,
  }));
}
export function glowSprite(key, color, size, opacity = 1, map) {
  const s = new THREE.Sprite(glowMat(key, color, opacity, map));
  s.scale.setScalar(size); s.renderOrder = 5; s.raycast = () => {};
  return s;
}

// ------------------------------------------------------------------ geometría
/** Normaliza atributos y fusiona (todo no indexado, solo position/normal/uv[/color]). */
export function merge(list, keepColor = false) {
  const prepared = list.map((g0) => {
    let g = g0.index ? g0.toNonIndexed() : g0.clone();
    for (const k of Object.keys(g.attributes)) if (!(k === 'position' || k === 'normal' || k === 'uv' || (keepColor && k === 'color'))) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (keepColor && !g.attributes.color) {
      const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    g.clearGroups();
    return g;
  });
  const m = mergeGeometries(prepared, false);
  prepared.forEach((g) => g.dispose());
  return m;
}
/** Pinta colores por vértice: fn(x,y,z, out:Color). */
export function vcolor(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { col.setRGB(1, 1, 1); fn(p.getX(i), p.getY(i), p.getZ(i), col); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
export function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }

const _up = new THREE.Vector3(0, 1, 0);
/** Cápsula entre dos puntos. */
export function capsuleBetween(a, b, r, cap = 4, rad = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), cap, rad);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, d.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
export function tube(points, r, tSeg = 16, rSeg = 8, taper = null) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, tSeg, r, rSeg, false);
  if (taper) { // estrecha hacia el final
    const p = g.attributes.position, n = rSeg + 1;
    for (let i = 0; i <= tSeg; i++) {
      const t = i / tSeg, c = curve.getPointAt(t), s = taper(t);
      for (let j = 0; j < n; j++) { const k = i * n + j; p.setXYZ(k, c.x + (p.getX(k) - c.x) * s, c.y + (p.getY(k) - c.y) * s, c.z + (p.getZ(k) - c.z) * s); }
    }
    g.computeVertexNormals();
  }
  return g;
}
export function lathe(pts, n = 24) { return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n); }
/** Caja biselada (extrusión de rectángulo redondeado). Centrada en el origen. */
export function roundedBox(w, h, d, r = 0.05, s = 3) {
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const W = w - 2 * r, H = h - 2 * r;
  // rectángulo interior (el bisel añade r en todas direcciones)
  const s2 = new THREE.Shape();
  s2.moveTo(-W / 2, -H / 2); s2.lineTo(W / 2, -H / 2); s2.lineTo(W / 2, H / 2); s2.lineTo(-W / 2, H / 2); s2.closePath();
  const g = new THREE.ExtrudeGeometry(s2, { depth: Math.max(1e-3, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: s, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}
/** Estrella 2D (Shape). */
export function starShape(R, r, n = 5, rot = Math.PI / 2) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n, rr = i % 2 ? r : R;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath(); return s;
}
/** Estrella facetada 3D (sin indexar → sombreado plano). */
export function facetedStar(R, r, depth, n = 5) {
  const pos = [], ring = [];
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; ring.push([Math.cos(a) * rr, Math.sin(a) * rr, 0]); }
  const F = [0, 0, depth], B = [0, 0, -depth];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    pos.push(...F, ...a, ...b, ...B, ...b, ...a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}
export function mesh(geo, material, cast = true, receive = false) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast && !isLow(); m.receiveShadow = receive;
  return m;
}
export function group(...children) { const g = new THREE.Group(); children.forEach((c) => c && g.add(c)); return g; }

// ------------------------------------------------------------------ ojos expresivos
function drawEye(g, w, h, iris, x) {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h);
  const cx = w * 0.25, cy = h * 0.5, R = h * 0.2;
  // sombra suave del párpado superior (oclusión)
  const sh = g.createLinearGradient(0, 0, 0, h * 0.5);
  sh.addColorStop(0, 'rgba(120,110,130,0.55)'); sh.addColorStop(1, 'rgba(120,110,130,0)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h * 0.5);
  if (x) {
    g.strokeStyle = '#2a1608'; g.lineWidth = R * 0.42; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - R, cy - R); g.lineTo(cx + R, cy + R); g.moveTo(cx + R, cy - R); g.lineTo(cx - R, cy + R); g.stroke();
    return;
  }
  const ig = g.createRadialGradient(cx, cy + R * 0.25, R * 0.1, cx, cy, R);
  ig.addColorStop(0, iris[0]); ig.addColorStop(0.7, iris[1]); ig.addColorStop(1, iris[2]);
  g.fillStyle = ig; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.fillStyle = '#0b0606'; g.beginPath(); g.arc(cx, cy, R * 0.52, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(cx - R * 0.32, cy - R * 0.36, R * 0.26, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(cx + R * 0.3, cy + R * 0.34, R * 0.11, 0, TAU); g.fill();
}
const IRIS = {
  brown: ['#c98a3a', '#7a3f12', '#2a1306'],
  green: ['#c8f060', '#3d9a2a', '#123a10'],
  red: ['#ffcf5a', '#d0381c', '#4a0a06'],
  blue: ['#9ef0ff', '#2a7ad8', '#0c2050'],
  violet: ['#f0a0ff', '#8a38c8', '#2a0a48'],
};
export function eyeMat(kind = 'brown', x = false) {
  const key = 'eye:' + kind + (x ? ':x' : '');
  return cached(key, () => {
    const t = tex(key, 256, 128, (g, w, h) => drawEye(g, w, h, IRIS[kind] || IRIS.brown, x), { repeat: false });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.12, metalness: 0, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.18 });
  });
}
export function eyeGeo() { return cached('geo:eye', () => new THREE.SphereGeometry(1, segs(24, 18, 12), segs(16, 12, 8))); }
/** Ojo: grupo con esfera texturizada que mira a +Z. */
export function makeEye(r, kind = 'brown', sx = 1, sy = 1.1, sz = 0.8) {
  const m = mesh(eyeGeo(), eyeMat(kind), false);
  m.scale.set(r * sx, r * sy, r * sz);
  m.userData.kind = kind;
  return m;
}
export function setEyeX(eye, x) { eye.material = eyeMat(eye.userData.kind, x); }
/** Parpadeo pseudoaleatorio estable por instancia. */
export function blink(time, offset = 0) {
  const t = (time + offset) % 3.9;
  return t < 0.13 ? 0.12 + Math.abs(t - 0.065) / 0.065 * 0.88 : 1;
}
/** Giro suave hacia la dirección de marcha (frente del modelo = +Z). */
export function faceDir(state, vx, dt, angle = 1.0) {
  if (vx > 0.05) state.dir = 1; else if (vx < -0.05) state.dir = -1;
  const target = state.dir * angle;
  state.yaw = state.yaw === undefined ? target : damp(state.yaw, target, 12, dt || 0.016);
  return state.yaw;
}
