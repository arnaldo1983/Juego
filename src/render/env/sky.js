// Cúpula de cielo con degradado, sol/luna con halo, estrellas y bandas de bruma.
import * as THREE from 'three';

const vert = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const frag = /* glsl */`
uniform vec3 uTop, uMid, uHorizon, uBottom, uSunColor, uHaloColor, uSunDir;
uniform float uSunSize, uHalo, uHaloSize, uStars, uMoon, uTime, uHorizonGlow;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash(vec3(i,1.0)), b = hash(vec3(i+vec2(1,0),1.0)), c = hash(vec3(i+vec2(0,1),1.0)), d = hash(vec3(i+vec2(1,1),1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c;
  if (y > 0.0) {
    c = mix(uHorizon, uMid, smoothstep(0.0, 0.1, y));
    c = mix(c, uTop, smoothstep(0.06, 0.32, y));
  } else {
    c = mix(uHorizon, uBottom, smoothstep(0.0, 0.28, -y));
  }
  // brillo en el horizonte
  c += uHaloColor * uHorizonGlow * exp(-abs(y) * 14.0);
  float sd = dot(d, normalize(uSunDir));
  // halo amplio y medio
  c += uHaloColor * uHalo * (pow(max(sd, 0.0), uHaloSize) * 0.9 + pow(max(sd, 0.0), uHaloSize * 8.0) * 1.6);
  // disco
  float ang = acos(clamp(sd, -1.0, 1.0));
  float disc = 1.0 - smoothstep(uSunSize * 0.92, uSunSize, ang);
  if (uMoon > 0.5) {
    // luna con cráteres suaves
    vec3 sdir = normalize(uSunDir);
    vec3 r = normalize(cross(vec3(0,1,0), sdir)); vec3 u = cross(sdir, r);
    vec2 q = vec2(dot(d, r), dot(d, u)) / sin(uSunSize);
    float cr = vnoise(q * 3.5 + 3.0) * 0.6 + vnoise(q * 9.0) * 0.4;
    float limb = sqrt(max(0.0, 1.0 - dot(q,q)));
    c = mix(c, uSunColor * (0.55 + 0.45 * limb) * (0.75 + 0.35 * cr), disc);
  } else {
    c = mix(c, uSunColor, disc);
  }
  // estrellas
  if (uStars > 0.0) {
    vec3 sp = d * 220.0; vec3 cell = floor(sp);
    float h = hash(cell);
    float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
    float star = step(0.985, h) * smoothstep(0.45, 0.0, length(fract(sp) - 0.5)) * tw;
    c += vec3(1.0, 0.92, 0.85) * star * uStars * smoothstep(0.02, 0.3, y) * (1.0 - disc);
  }
  // dither anti-banding
  c += (hash(vec3(gl_FragCoord.xy, uTime)) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() }, uHaloColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 0.3, -1) },
      uSunSize: { value: 0.05 }, uHalo: { value: 1 }, uHaloSize: { value: 6 }, uStars: { value: 0 }, uMoon: { value: 0 }, uTime: { value: 0 }, uHorizonGlow: { value: 0 },
    },
    vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
}
export function applySky(mat, s) {
  const u = mat.uniforms;
  u.uTop.value.set(s.top); u.uMid.value.set(s.mid); u.uHorizon.value.set(s.horizon); u.uBottom.value.set(s.bottom);
  u.uSunColor.value.set(s.sunColor).multiplyScalar(s.sunIntensity ?? 1); u.uHaloColor.value.set(s.haloColor);
  u.uSunDir.value.set(...s.sunDir).normalize();
  u.uSunSize.value = s.sunSize; u.uHalo.value = s.halo; u.uHaloSize.value = s.haloSize; u.uStars.value = s.stars || 0; u.uMoon.value = s.moon ? 1 : 0;
  u.uHorizonGlow.value = s.horizonGlow || 0;
}

let skyGeo = null;
export function skyDome(s) {
  skyGeo ??= Object.assign(new THREE.SphereGeometry(1, 48, 24), {}); skyGeo.userData.shared = true;
  const mat = skyMaterial(); applySky(mat, s);
  const m = new THREE.Mesh(skyGeo, mat);
  m.scale.setScalar(400); m.frustumCulled = false; m.renderOrder = -1000;
  return m;
}
