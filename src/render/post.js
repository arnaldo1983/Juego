// Postprocesado: RenderPass (MSAA, HalfFloat) + UnrealBloom sutil + OutputPass + gradación/viñeta por tema.
// En calidad 'low' se renderiza directamente (sin composer).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { preset } from './env/themes.js';

const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3() },
    uSat: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: 0.3 }, uAspect: { value: 1.77 }, uTime: { value: 0 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform vec3 uTint, uLift; uniform float uSat, uContrast, uVignette, uAspect, uTime;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  vec3 col = c.rgb * uTint;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  col += uLift * (1.0 - col);
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0) / max(1.0, uAspect * 0.62);
  float v = 1.0 - smoothstep(0.35, 1.05, length(q));
  col *= mix(1.0, v, uVignette);
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}`,
};

// El composer se reutiliza entre cargas de nivel (se recrea Post en cada muerte).
let cache = null;

export class Post {
  constructor(renderer, scene, camera, { quality = 'high' } = {}) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.quality = quality;
    this.direct = quality === 'low';
    if (this.direct) return;
    if (!cache || cache.renderer !== renderer || cache.quality !== quality) {
      cache && cache.composer.dispose();
      const samples = quality === 'high' ? 4 : 2;
      const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples });
      rt.texture.name = 'Post.rt';
      const composer = new EffectComposer(renderer, rt);
      // el segundo buffer no necesita MSAA
      composer.renderTarget2.samples = 0;
      const renderPass = new RenderPass(scene, camera);
      const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.55, 0.9);
      // bloom a media resolución en 'medium' (móvil)
      if (quality === 'medium') { const set = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => set(Math.round(w * 0.6), Math.round(h * 0.6)); }
      const output = new OutputPass();
      const grade = new ShaderPass(GradeShader);
      composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output); composer.addPass(grade);
      cache = { renderer, quality, composer, renderPass, bloom, grade };
    }
    this.c = cache;
    this.c.renderPass.scene = scene; this.c.renderPass.camera = camera;
    this.time = 0;
  }
  setSize(w, h, pixelRatio) {
    this.aspect = w / h;
    if (this.direct) return;
    this.c.composer.setPixelRatio(pixelRatio);
    this.c.composer.setSize(w, h);
    this.c.grade.uniforms.uAspect.value = w / h;
  }
  setTheme(theme) {
    const p = preset(theme);
    if (this.direct) return;
    const u = this.c.grade.uniforms, g = p.grade;
    u.uTint.value.set(...g.tint); u.uLift.value.set(...g.lift); u.uSat.value = g.sat; u.uContrast.value = g.contrast; u.uVignette.value = g.vignette;
    const b = this.c.bloom; b.strength = p.bloom.strength; b.radius = p.bloom.radius; b.threshold = p.bloom.threshold;
  }
  render(dt) {
    if (this.direct) { this.renderer.render(this.scene, this.camera); return; }
    this.time += dt || 0;
    this.c.grade.uniforms.uTime.value = this.time % 10;
    this.c.composer.render(dt);
  }
  dispose() { /* composer cacheado a nivel de módulo */ }
}
