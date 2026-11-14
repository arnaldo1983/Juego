// Recursos cacheados (geometrías, materiales, texturas) de KIKO, el zorro aventurero.
// Todo procedural. Se crean una única vez por módulo y se marcan como compartidos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ paleta
export const PAL = {
  fur: new THREE.Color(0xf2751f),
  furDeep: new THREE.Color(0xd65a14),
  cream: new THREE.Color(0xfff4e6),
  dark: new THREE.Color(0x3a2219),
  earIn: new THREE.Color(0xffd2c0),
  leather: new THREE.Color(0x8a4f2a),
  leatherDark: new THREE.Color(0x5c321b),
  sole: new THREE.Color(0xf0e2cc),
  brass: new THREE.Color(0xf3c35a),
  roll: new THREE.Color(0x4f9b6a),
};
export const OUTFIT = {
  normal: { scarf: 0xe8262f, scarfSheen: 0xff9aa0, cloth: 0x2d63c8, clothSheen: 0x9cc4ff, rim: 0xffe2bf, rimK: 0.42 },
  fire: { scarf: 0xff9a1f, scarfSheen: 0xffe2a0, cloth: 0xfbf5ec, clothSheen: 0xffffff, rim: 0xffb070, rimK: 0.6 },
};

// ------------------------------------------------------------------ uniforms compartidos
export const U = {
  uRimColor: { value: new THREE.Color(OUTFIT.normal.rim) },
  uRimK: { value: OUTFIT.normal.rimK },
  uStar: { value: 0 },
  uTime: { value: 0 },
  uFlash: { value: new THREE.Color(0, 0, 0) },
  uTipGlow: { value: 0 },
};

function patch(mat, { tip = false, rim = 1 } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.uniforms.uRimScale = { value: rim };
    if (tip) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aTip;\nvarying float vTip;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTip = aTip;');
    }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uRimColor; uniform float uRimK; uniform float uStar; uniform float uTime; uniform vec3 uFlash;
uniform float uTipGlow; uniform float uRimScale;
${tip ? 'varying float vTip;' : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 vdir = normalize(vViewPosition);
  float fr = 1.0 - saturate(dot(normal, vdir));
  float rimF = pow(fr, 2.6);
  totalEmissiveRadiance += uRimColor * uRimK * uRimScale * rimF;
  vec3 rb = 0.5 + 0.5 * cos(6.2831 * (uTime * 1.6 + vViewPosition.y * 0.9 + vViewPosition.x * 0.4 + vec3(0.0, 0.33, 0.67)));
  totalEmissiveRadiance += uStar * rb * (0.45 + 1.6 * rimF);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.6 + 0.6 * rb), uStar * 0.6);
  totalEmissiveRadiance += uFlash * (0.5 + rimF);
  ${tip ? 'float fl = 0.8 + 0.2 * sin(uTime * 23.0) * sin(uTime * 7.0 + 1.3);\n  totalEmissiveRadiance += vec3(1.0, 0.45, 0.08) * uTipGlow * vTip * fl * 2.2;' : ''}
}`);
  };
  mat.customProgramCacheKey = () => 'kiko' + (tip ? 'T' : '') + rim;
  return mat;
}

// ------------------------------------------------------------------ texturas
function eyeTexture() {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // esclerótica con leve sombreado
  const sg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H * 0.7);
  sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.7, '#f4f1ee'); sg.addColorStop(1, '#d9d2cc');
  g.fillStyle = sg; g.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = 62; // iris (≈ 44° de radio angular)
  const ig = g.createRadialGradient(cx, cy + 8, 4, cx, cy, R);
  ig.addColorStop(0, '#d8f58a'); ig.addColorStop(0.35, '#4ec46a'); ig.addColorStop(0.75, '#1f7d4a'); ig.addColorStop(1, '#0d3a26');
  g.fillStyle = ig; g.beginPath(); g.ellipse(cx, cy, R, R, 0, 0, Math.PI * 2); g.fill();
  // fibras del iris
  g.globalAlpha = 0.22; g.strokeStyle = '#eaffc0'; g.lineWidth = 2;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + Math.sin(i * 3.1) * 0.05;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); g.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6)); g.stroke();
  }
  g.globalAlpha = 1;
  // aro oscuro + sombra del párpado superior
  g.strokeStyle = '#0a2418'; g.lineWidth = 6; g.beginPath(); g.ellipse(cx, cy, R - 2, R - 2, 0, 0, Math.PI * 2); g.stroke();
  const shade = g.createLinearGradient(0, cy - R, 0, cy);
  shade.addColorStop(0, 'rgba(10,20,10,0.55)'); shade.addColorStop(1, 'rgba(10,20,10,0)');
  g.fillStyle = shade; g.beginPath(); g.ellipse(cx, cy, R, R, 0, 0, Math.PI * 2); g.fill();
  // pupila
  const pg = g.createRadialGradient(cx, cy, 2, cx, cy, 34);
  pg.addColorStop(0, '#05090a'); pg.addColorStop(0.8, '#0b1210'); pg.addColorStop(1, 'rgba(11,18,16,0)');
  g.fillStyle = pg; g.beginPath(); g.ellipse(cx, cy, 34, 36, 0, 0, Math.PI * 2); g.fill();
  // brillos pintados (los brillos 3D van aparte)
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.ellipse(cx + 18, cy + 30, 10, 6, 0.4, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ utilidades de geometría
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color();
function paint(geo, fn) {
  const p = geo.attributes.position, nrm = geo.attributes.normal, n = p.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(p, i); _n.fromBufferAttribute(nrm, i);
    const c = fn(_v, _n, _c.setRGB(1, 1, 1)) || _c;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const solid = (geo, color) => paint(geo, (v, n, c) => c.copy(color));
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function xf(geo, { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0] } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
  geo.applyMatrix4(m);
  return geo;
}
// esfera "redondeada-cuadrada" (superelipsoide)
function superSphere(sx, sy, sz, e = 0.45, ws = 20, hs = 14) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = (x) => Math.sign(x) * Math.pow(Math.abs(x), e);
    p.setXYZ(i, f(p.getX(i)) * sx, f(p.getY(i)) * sy, f(p.getZ(i)) * sz);
  }
  g.computeVertexNormals();
  return g;
}
function lathe(profile, seg = 24) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}
// suavizar perfil con spline
function smoothProfile(pts, n = 24) {
  const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getPoints(n).map((v) => [Math.max(0.0001, v.x), v.y]);
}
function capsuleDown(r, len, color, capSeg = 6, radSeg = 14) {
  const g = new THREE.CapsuleGeometry(r, len, capSeg, radSeg);
  g.translate(0, -len / 2, 0);
  return color ? solid(g, color) : g;
}
const merge = (list) => { const g = mergeGeometries(list.map((x) => x.index ? x : x)); return g; };
const shared = (g) => { g.userData.shared = true; g.computeBoundingSphere(); return g; };

// ------------------------------------------------------------------ construcción de recursos
let CACHE = null;
export function getKikoAssets() {
  if (CACHE) return CACHE;
  const G = {}, M = {};

  // ---------- cabeza (cráneo + hocico + mejillas + mechón), todo pelaje con colores por vértice
  {
    const skull = new THREE.SphereGeometry(0.25, 40, 28);
    xf(skull, { s: [0.98, 0.92, 1.05], p: [0, 0.17, 0] });
    paint(skull, (v, n, c) => {
      const ny = (v.y - 0.17) / 0.23, nx = v.x / 0.245, nz = v.z / 0.26;
      // máscara blanca en la parte baja frontal y mejillas (forma de corazón de zorro)
      let w = ss(-0.02, -0.32, ny - Math.abs(nz) * 0.25 + 0.05) * ss(-0.35, 0.25, nx);
      w = Math.max(w, ss(0.55, 0.9, nx) * ss(0.05, -0.2, ny + Math.abs(nz) * 0.4) * 0.0);
      c.copy(PAL.fur).lerp(PAL.furDeep, ss(0.2, 1, ny) * 0.35 + ss(0.2, -0.9, nx) * 0.25);
      return c.lerp(PAL.cream, w);
    });
    const cheekA = xf(new THREE.SphereGeometry(0.085, 20, 14), { s: [0.95, 0.7, 1.0], p: [0.08, 0.08, 0.16], r: [0.3, 0.25, 0] });
    const cheekB = xf(new THREE.SphereGeometry(0.085, 20, 14), { s: [0.95, 0.7, 1.0], p: [0.08, 0.08, -0.16], r: [-0.3, -0.25, 0] });
    // mechones de las mejillas (puntas hacia los lados)
    const tuftA = xf(new THREE.ConeGeometry(0.04, 0.09, 10), { r: [Math.PI / 2 + 0.6, 0, 0.25], p: [0.05, 0.06, 0.225] });
    const tuftB = xf(new THREE.ConeGeometry(0.04, 0.09, 10), { r: [-Math.PI / 2 - 0.6, 0, 0.25], p: [0.05, 0.06, -0.225] });
    [cheekA, cheekB, tuftA, tuftB].forEach((g) => solid(g, PAL.cream));
    const snout = xf(new THREE.SphereGeometry(1, 28, 18), { s: [0.135, 0.085, 0.105], p: [0.215, 0.105, 0], r: [0, 0, -0.12] });
    paint(snout, (v, n, c) => c.copy(PAL.fur).lerp(PAL.cream, ss(0.15, -0.35, n.y + (v.x - 0.25) * 1.2)));
    // flequillo: tres mechones
    const fr = [];
    for (let i = 0; i < 3; i++) {
      const cg = new THREE.ConeGeometry(0.045 - i * 0.008, 0.13 - i * 0.02, 10);
      xf(cg, { r: [(i - 1) * 0.5, 0, -0.9 - i * 0.15], p: [0.1 - i * 0.03, 0.37 - i * 0.005, (i - 1) * 0.05] });
      paint(cg, (v, n, c) => c.copy(PAL.fur));
      fr.push(cg);
    }
    G.head = shared(merge([skull, cheekA, cheekB, tuftA, tuftB, snout, ...fr]));
    G.nose = shared(xf(new THREE.SphereGeometry(0.036, 18, 12), { s: [0.85, 0.7, 1.15], p: [0.345, 0.128, 0] }));
    // boca: sonrisa en "w"
    const mc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.300, 0.072, -0.052), new THREE.Vector3(0.330, 0.058, -0.026), new THREE.Vector3(0.338, 0.068, 0),
      new THREE.Vector3(0.330, 0.058, 0.026), new THREE.Vector3(0.300, 0.072, 0.052)]);
    G.mouth = shared(new THREE.TubeGeometry(mc, 24, 0.0085, 6, false));
    G.mouthO = shared(xf(new THREE.SphereGeometry(0.04, 16, 12), { s: [0.5, 1, 0.9], p: [0.315, 0.05, 0] }));
    G.eye = shared(xf(new THREE.SphereGeometry(0.078, 32, 22), {}));
    G.hl = shared(merge([
      xf(new THREE.SphereGeometry(0.019, 10, 8), { s: [0.5, 1, 1], p: [0.044, 0.032, -0.022] }),
      xf(new THREE.SphereGeometry(0.009, 8, 6), { s: [0.5, 1, 1], p: [0.046, -0.022, 0.022] }),
    ]));
    G.brow = shared(xf(new THREE.CapsuleGeometry(0.013, 0.06, 4, 8), { r: [Math.PI / 2, 0, 0] }));
    // oreja: lathe puntiaguda (exterior naranja con punta oscura) + interior crema
    const earProf = smoothProfile([[0.085, 0], [0.09, 0.05], [0.07, 0.12], [0.035, 0.19], [0.001, 0.235]], 20);
    const earOut = xf(lathe(earProf, 18), { s: [0.5, 1, 1] });
    paint(earOut, (v, n, c) => c.copy(PAL.fur).lerp(PAL.dark, ss(0.13, 0.19, v.y)));
    const inProf = smoothProfile([[0.06, 0.01], [0.062, 0.05], [0.045, 0.12], [0.001, 0.18]], 16);
    const earIn = xf(lathe(inProf, 16), { s: [0.35, 1, 1], p: [0.022, 0, 0] });
    paint(earIn, (v, n, c) => c.copy(PAL.earIn).lerp(PAL.cream, ss(0.02, 0.12, v.y)));
    G.ear = shared(merge([earOut, earIn]));
  }

  // ---------- torso (pecho blanco), pantalón corto, cinturón y mochila
  {
    const tp = smoothProfile([[0.001, -0.02], [0.13, 0.0], [0.158, 0.06], [0.155, 0.13], [0.13, 0.21], [0.085, 0.27], [0.001, 0.29]], 28);
    const torso = xf(lathe(tp, 28), { s: [0.94, 1, 0.97] });
    paint(torso, (v, n, c) => {
      const r = Math.hypot(v.x, v.z) || 1, fx = v.x / r;
      const w = ss(0.62, 0.85, fx + (v.y - 0.17) * 0.9) * ss(0.04, 0.12, v.y);
      return c.copy(PAL.fur).lerp(PAL.cream, w);
    });
    G.torso = shared(torso);
    const sp = smoothProfile([[0.001, -0.03], [0.125, -0.025], [0.158, 0.01], [0.162, 0.07], [0.157, 0.1], [0.001, 0.105]], 18);
    G.shorts = shared(solid(lathe(sp, 26), new THREE.Color(1, 1, 1)));
    // pernera corta alrededor del muslo
    G.cuff = shared(solid(xf(new THREE.CylinderGeometry(0.07, 0.077, 0.07, 16, 1, true), { p: [0, -0.02, 0] }), new THREE.Color(1, 1, 1)));
    const belt = xf(new THREE.TorusGeometry(0.163, 0.016, 8, 32), { r: [Math.PI / 2, 0, 0], p: [0, 0.1, 0], s: [0.94, 0.97, 1] });
    solid(belt, PAL.leatherDark);
    const buckle = solid(xf(superSphere(0.012, 0.03, 0.035, 0.35, 12, 10), { p: [0.155, 0.1, 0] }), PAL.brass);
    // mochila: cuerpo + solapa + saco de dormir + tirantes
    const bag = solid(xf(superSphere(0.075, 0.105, 0.12, 0.4), { p: [-0.175, 0.15, 0] }), PAL.leather);
    const flap = solid(xf(superSphere(0.082, 0.05, 0.126, 0.4), { p: [-0.172, 0.215, 0], r: [0, 0, -0.08] }), PAL.leatherDark);
    const clasp = solid(xf(superSphere(0.01, 0.02, 0.018, 0.4, 10, 8), { p: [-0.25, 0.19, 0] }), PAL.brass);
    const pocket = solid(xf(superSphere(0.03, 0.045, 0.08, 0.4), { p: [-0.245, 0.11, 0] }), PAL.leatherDark);
    const roll = paint(xf(new THREE.CylinderGeometry(0.048, 0.048, 0.26, 16, 1), { r: [Math.PI / 2, 0, 0], p: [-0.16, 0.035, 0] }), (v, n, c) => {
      const band = Math.abs(Math.abs(v.z) - 0.075) < 0.012;
      return c.copy(band ? PAL.leatherDark : PAL.roll);
    });
    const strapA = solid(xf(new THREE.TorusGeometry(0.115, 0.012, 6, 24, Math.PI * 1.15), { p: [-0.02, 0.15, 0.085], r: [0, 0, -0.9], s: [1, 1.15, 1] }), PAL.leatherDark);
    const strapB = solid(xf(new THREE.TorusGeometry(0.115, 0.012, 6, 24, Math.PI * 1.15), { p: [-0.02, 0.15, -0.085], r: [0, 0, -0.9], s: [1, 1.15, 1] }), PAL.leatherDark);
    G.gear = shared(merge([belt, buckle, bag, flap, clasp, pocket, roll, strapA, strapB].map((g) => { if (!g.index) g = g; return g; })));
  }

  // ---------- extremidades
  G.upperArm = shared(capsuleDown(0.042, 0.055, PAL.fur));
  {
    const fore = capsuleDown(0.037, 0.04, null);
    const paw = xf(new THREE.SphereGeometry(0.05, 18, 12), { s: [1, 0.95, 0.9], p: [0.004, -0.075, 0] });
    const thumb = xf(new THREE.SphereGeometry(0.02, 10, 8), { p: [0.04, -0.06, 0] });
    [fore, paw, thumb].forEach((g) => paint(g, (v, n, c) => c.copy(PAL.fur).lerp(PAL.dark, ss(-0.005, -0.035, v.y))));
    G.foreArm = shared(merge([fore, paw, thumb]));
  }
  G.thigh = shared(capsuleDown(0.058, 0.06, PAL.fur));
  G.shin = shared(paint(capsuleDown(0.049, 0.055, null), (v, n, c) => c.copy(PAL.fur).lerp(PAL.dark, ss(-0.01, -0.05, v.y))));
  {
    // bota: superelipsoide con suela plana, puntera redondeada y vuelta de lana
    const b = superSphere(0.075, 0.048, 0.058, 0.6, 24, 16);
    const p = b.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -0.03) p.setY(i, -0.03 - (y + 0.03) * 0.25); }
    b.computeVertexNormals();
    xf(b, { p: [0.022, -0.035, 0] });
    paint(b, (v, n, c) => c.copy(PAL.leather).lerp(PAL.sole, ss(-0.055, -0.062, v.y)).lerp(PAL.leatherDark, ss(0.06, 0.09, v.x) * 0.5));
    const cuff = paint(xf(new THREE.TorusGeometry(0.047, 0.018, 8, 18), { r: [Math.PI / 2, 0, 0], p: [0, -0.002, 0] }), (v, n, c) => c.copy(PAL.cream));
    const lace = solid(xf(new THREE.TorusGeometry(0.022, 0.006, 6, 12), { r: [0, Math.PI / 2, 0], p: [0.065, -0.02, 0], s: [1, 0.7, 1] }), PAL.brass);
    G.boot = shared(merge([b, cuff, lace]));
  }

  // ---------- bufanda: vuelta al cuello + nudo
  {
    const wrap = xf(new THREE.TorusGeometry(0.1, 0.048, 14, 32), { r: [Math.PI / 2, 0, 0], s: [1, 1, 0.85] });
    const knot = xf(new THREE.SphereGeometry(0.045, 14, 10), { p: [-0.125, -0.01, 0], s: [0.8, 1, 1.2] });
    const st = (g) => paint(g, (v, n, c) => c.setRGB(1, 1, 1).multiplyScalar(Math.abs(Math.sin(Math.atan2(v.z, v.x) * 6)) > 0.93 ? 0.82 : 1));
    G.scarf = shared(merge([st(wrap), solid(knot, new THREE.Color(1, 1, 1))]));
  }
  // ---------- cola de la bufanda (piel con huesos)
  {
    const strip = (len, w, z, ang) => {
      const g = new THREE.BoxGeometry(w, len, 0.022, 3, 14, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const f = (len / 2 - p.getY(i)) / len; p.setX(i, p.getX(i) * (0.75 + 0.35 * Math.sin(Math.min(1, f) * 2.6))); }
      g.translate(-w * 0.35, -len / 2, z);
      g.rotateX(ang);
      g.computeVertexNormals();
      return paint(g, (v, n, c) => {
        const f = -v.y / len;
        return c.setRGB(1, 1, 1).multiplyScalar(f > 0.78 && f < 0.86 ? 0.55 : f > 0.9 ? 0.75 : 1);
      });
    };
    const g = mergeGeometries([strip(0.34, 0.095, 0.06, 0.12), strip(0.28, 0.085, -0.06, -0.12)]);
    skinChain(g, 4, 0.34, -1);
    G.scarfTail = shared(g);
  }
  // ---------- cola esponjosa (piel con huesos)
  {
    const prof = smoothProfile([[0.001, -0.02], [0.05, 0.0], [0.09, 0.08], [0.122, 0.19], [0.115, 0.29], [0.075, 0.37], [0.001, 0.42]], 32);
    const g = lathe(prof, 28);
    const p = g.attributes.position;
    const tip = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x), r = Math.hypot(x, z);
      const k = 1 + 0.07 * Math.sin(a * 7 + y * 26) * ss(0.02, 0.15, y) + 0.04 * Math.sin(a * 13 - y * 40);
      p.setXYZ(i, x * k, y + 0.01 * Math.sin(a * 5), z * k);
      tip[i] = ss(0.29, 0.36, y);
      void r;
    }
    g.computeVertexNormals();
    paint(g, (v, n, c) => c.copy(PAL.fur).lerp(PAL.furDeep, ss(0.15, 0.0, v.y) * 0.4).lerp(PAL.cream, ss(0.3, 0.345, v.y)));
    g.setAttribute('aTip', new THREE.BufferAttribute(tip, 1));
    skinChain(g, 4, 0.4, 1);
    G.tail = shared(g);
  }

  // ---------- materiales
  M.fur = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, sheen: 1, sheenColor: new THREE.Color(0xffd0a0), sheenRoughness: 0.45 }));
  M.tail = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, sheen: 1, sheenColor: new THREE.Color(0xffe0b8), sheenRoughness: 0.5 }), { tip: true });
  M.eye = patch(new THREE.MeshPhysicalMaterial({ map: eyeTexture(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 }), { rim: 0.15 });
  M.gloss = patch(new THREE.MeshPhysicalMaterial({ color: 0x1b1210, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }), { rim: 0.4 });
  M.mouth = new THREE.MeshStandardMaterial({ color: 0x3a1712, roughness: 0.6 });
  M.mouthO = new THREE.MeshStandardMaterial({ color: 0x6a1d1d, roughness: 0.5 });
  M.hl = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  M.brow = new THREE.MeshStandardMaterial({ color: 0x5a2a12, roughness: 0.8 });
  M.leather = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.5 }), { rim: 0.6 });
  M.cloth = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, color: OUTFIT.normal.cloth, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(OUTFIT.normal.clothSheen), sheenRoughness: 0.5 }), { rim: 0.8 });
  M.scarf = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, color: OUTFIT.normal.scarf, roughness: 0.75, sheen: 1, sheenColor: new THREE.Color(OUTFIT.normal.scarfSheen), sheenRoughness: 0.4, side: THREE.DoubleSide }), { rim: 0.8 });
  M.scarfTail = M.scarf;
  CACHE = { G, M };
  return CACHE;
}

// Pesos de piel para una cadena de `n` huesos a lo largo de Y (dir=+1 hacia arriba, -1 hacia abajo).
function skinChain(geo, n, len, dir) {
  const p = geo.attributes.position, cnt = p.count;
  const si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
  const seg = len / (n - 1);
  for (let i = 0; i < cnt; i++) {
    const d = Math.max(0, p.getY(i) * dir) / seg;
    const a = Math.min(n - 1, Math.floor(d)), b = Math.min(n - 1, a + 1), f = Math.min(1, d - a);
    si[i * 4] = a; si[i * 4 + 1] = b; sw[i * 4] = 1 - f; sw[i * 4 + 1] = f;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.userData.boneSeg = seg; geo.userData.boneDir = dir; geo.userData.boneN = n;
}
