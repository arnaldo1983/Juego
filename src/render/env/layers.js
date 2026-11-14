// Capas genéricas: nubes estilizadas (sprites instanciados), partículas ambientales (Points), rayos de luz.
import * as THREE from 'three';
import { cloudAtlas, softDot, rayTex, shared, rng } from './util.js';

let planeGeo = null;
const plane = () => { if (!planeGeo) { planeGeo = shared(new THREE.PlaneGeometry(2, 1)); planeGeo.translate(0, 0.5, 0); } return planeGeo; };

/**
 * Nubes: sprites de un atlas 2x2, tintados con color de luz/sombra. Ordenadas atrás→delante.
 * @param {{x:number,y:number,z:number,s:number,cell?:number,flip?:boolean,speed?:number,a?:number}[]} list
 */
export function cloudLayer(list, { lit = 0xffffff, shade = 0x9fb6d8, opacity = 1, x0 = -200, x1 = 400, fog = true, additive = false } = {}) {
  list = list.slice().sort((a, b) => a.z - b.z);
  const geo = new THREE.InstancedBufferGeometry().copy(plane());
  geo.userData.shared = false;
  const r = rng(list.length + 3);
  const cells = new Float32Array(list.length * 3);
  list.forEach((c, i) => { const k = c.cell ?? Math.floor(r() * 4); cells[i * 3] = (k % 2) * 0.5; cells[i * 3 + 1] = (1 - Math.floor(k / 2)) * 0.5 - 0.5 + 0.5; cells[i * 3 + 2] = c.a ?? 1; });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 3));
  const mat = new THREE.MeshBasicMaterial({ map: cloudAtlas(), transparent: true, depthWrite: false, fog, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const uLit = { value: new THREE.Color(lit) }, uShade = { value: new THREE.Color(shade) };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = uLit; sh.uniforms.uShade = uShade;
    sh.vertexShader = 'attribute vec3 aCell;\nvarying float vA;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = vMapUv * 0.5 + aCell.xy; vA = aCell.z;');
    sh.fragmentShader = 'uniform vec3 uLit, uShade;\nvarying float vA;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      'vec4 tx = texture2D(map, vMapUv);\n diffuseColor.rgb *= mix(uShade, uLit, tx.r);\n diffuseColor.a *= tx.a * vA;');
  };
  mat.customProgramCacheKey = () => 'cloud';
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const span = x1 - x0;
  const write = () => {
    list.forEach((c, i) => { p.set(c.x, c.y, c.z); s.set(c.s * (c.flip ? -1 : 1), c.s * (c.sy ?? 1), 1); M.compose(p, q, s); mesh.setMatrixAt(i, M); });
    mesh.instanceMatrix.needsUpdate = true;
  };
  write();
  return {
    mesh, uLit, uShade,
    update(dt) {
      let any = false;
      for (const c of list) if (c.speed) { c.x += c.speed * dt; if (c.x > x1) c.x -= span; any = true; }
      if (any) write();
    },
  };
}

const moteVert = /* glsl */`
attribute vec4 aRnd;
uniform vec3 uCam, uBox, uVel; uniform float uTime, uSize, uPx, uSway;
varying float vA; varying float vF;
void main(){
  vec3 p = position * uBox;
  p += uVel * uTime;
  p.x += sin(uTime * (0.6 + aRnd.x) + aRnd.y * 6.283) * uSway;
  p.y += cos(uTime * (0.5 + aRnd.z) + aRnd.x * 6.283) * uSway * 0.7;
  vec2 c = uCam.xy;
  p.xy = c + mod(p.xy - c + uBox.xy * 0.5, uBox.xy) - uBox.xy * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float flick = 0.5 + 0.5 * sin(uTime * (2.0 + aRnd.w * 3.0) + aRnd.y * 30.0);
  vF = flick;
  vA = smoothstep(uBox.x * 0.5, uBox.x * 0.3, abs(p.x - c.x));
  gl_PointSize = uSize * (0.5 + aRnd.w) * uPx * 300.0 / -mv.z;
}`;
const moteFrag = /* glsl */`
uniform vec3 uColor, uColor2; uniform float uFlicker, uOpacity;
varying float vA; varying float vF;
void main(){
  vec2 q = gl_PointCoord - 0.5; float d = length(q);
  float a = smoothstep(0.5, 0.0, d); a = a * a;
  float core = smoothstep(0.18, 0.0, d);
  float f = mix(1.0, vF, uFlicker);
  vec3 c = mix(uColor2, uColor, f) * (a + core * 1.5);
  gl_FragColor = vec4(c * f, a * f) * vA * uOpacity;
}`;
/** Partículas ambientales alrededor de la cámara (luciérnagas, polen, ceniza, brasas). Un único draw call. */
export function motes({ count = 150, box = [60, 30, 1], z0 = -2, z1 = -20, yOff = 0, vel = [0, 0, 0], sway = 0.6, size = 0.25, color = 0xffffaa, color2 = null, flicker = 1, additive = true, opacity = 1, seed = 5 }) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = r(); pos[i * 3 + 1] = r(); pos[i * 3 + 2] = 0;
    rnd.set([r(), r(), r(), r()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
  // z por partícula
  for (let i = 0; i < count; i++) pos[i * 3 + 2] = 0;
  const zAttr = new Float32Array(count); for (let i = 0; i < count; i++) zAttr[i] = z0 + (z1 - z0) * Math.pow(r(), 0.8);
  for (let i = 0; i < count; i++) pos[i * 3 + 2] = zAttr[i];
  const uniforms = {
    uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(box[0], box[1], 1) }, uVel: { value: new THREE.Vector3(...vel) },
    uTime: { value: 0 }, uSize: { value: size }, uPx: { value: 1 }, uSway: { value: sway },
    uColor: { value: new THREE.Color(color) }, uColor2: { value: new THREE.Color(color2 ?? color) }, uFlicker: { value: flicker }, uOpacity: { value: opacity },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: moteVert.replace('vec3 p = position * uBox;', 'vec3 p = vec3(position.xy * uBox.xy, position.z);'), fragmentShader: moteFrag,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  return {
    mesh: pts,
    update(dt, camX, camY, time, px) { uniforms.uTime.value = time; uniforms.uCam.value.set(camX, camY + yOff, 0); uniforms.uPx.value = px; },
  };
}

/** Rayos de luz (quads aditivos con degradado), animados sutilmente. */
export function rays(list, { color = 0xbfe8ff, opacity = 0.25 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: rayTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  const geo = shared(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0));
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  list.forEach((it, i) => { e.set(0, 0, it.rz || 0); q.setFromEuler(e); p.set(it.x, it.y, it.z); s.set(it.w, it.h, 1); M.compose(p, q, s); mesh.setMatrixAt(i, M); });
  mesh.renderOrder = 8; mesh.frustumCulled = false;
  return { mesh, update(dt, t) { mat.opacity = opacity * (0.8 + 0.2 * Math.sin(t * 0.7)); } };
}

/** Siluetas de primer plano (borrosas y oscuras) cerca de la cámara. */
export function foreground(list, tex, color = 0x0b1408, opacity = 0.9) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, fog: false });
  const mesh = new THREE.InstancedMesh(plane(), mat, list.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  list.forEach((it, i) => { p.set(it.x, it.y, it.z); s.set(it.w * (it.flip ? -1 : 1), it.h, 1); q.setFromEuler(new THREE.Euler(0, 0, it.rz || 0)); M.compose(p, q, s); mesh.setMatrixAt(i, M); });
  mesh.renderOrder = 50; mesh.frustumCulled = false;
  return { mesh };
}
export { softDot };
