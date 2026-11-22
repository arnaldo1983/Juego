// Renderizador de casillas y terreno (AAA estilizado, todo procedural).
// Contrato: new BlockRenderer({scene, level, theme, renderer, quality}); onTileChange(x,y,old,new); bump(x,y); update(dt,time,camX); dispose()
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { T } from '../config.js';
import * as TX from './textures.js';
import { roundedBox, mergeByMaterial, M4, tint, ensureIndex } from './blocks/geometry.js';
import { buildTerrain, buildDecor, ZB, ZF, YB } from './blocks/terrain.js';

const THEMES = ['pradera', 'cueva', 'cielo', 'castillo'];
const U = { time: { value: 0 } }; // uniforme de tiempo compartido por todos los materiales animados

// ------------------------------------------------------------------ entorno para metales
let ENV = null;
function envMap(renderer) {
  if (ENV || !renderer) return ENV;
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    ENV = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  } catch (e) { ENV = null; }
  return ENV;
}

// ------------------------------------------------------------------ inyección de shaders
const WORLD_VARY = `
  vec4 bwp = vec4(transformed, 1.0); vec4 bwc = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
    bwp = instanceMatrix * bwp; bwc = instanceMatrix * bwc;
  #endif
  bwp = modelMatrix * bwp; bwc = modelMatrix * bwc; vBW = bwp.xyz; vBC = bwc.xyz;`;
function withWorld(shader) {
  shader.vertexShader = 'varying vec3 vBW; varying vec3 vBC;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + WORLD_VARY);
  shader.fragmentShader = 'varying vec3 vBW; varying vec3 vBC;\nuniform float uTime;\n' + shader.fragmentShader;
  shader.uniforms.uTime = U.time;
}
function patch(mat, key, fn) { mat.onBeforeCompile = fn; mat.customProgramCacheKey = () => key; return mat; }

// ------------------------------------------------------------------ materiales (cache por tema+calidad)
const MATS = new Map();
function std(tex, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap, roughness: 1, metalness: 0, ...extra });
  if (tex.metalnessMap) { m.metalnessMap = tex.metalnessMap; m.metalness = extra.metalness ?? 1; }
  if (tex.emissiveMap) { m.emissiveMap = tex.emissiveMap; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = extra.emissiveIntensity ?? 1; }
  return m;
}
function getMats(theme, quality, renderer) {
  const key = theme + ':' + quality;
  if (MATS.has(key)) return MATS.get(key);
  const ts = quality === 'low' ? 128 : 256, ds = quality === 'high' ? 512 : 256;
  const env = envMap(renderer);
  const M = {};
  // --- casillas
  M.brick = std(TX.brickTex(theme, ts), { emissiveIntensity: theme === 'castillo' ? 1.2 : 1 });
  M.brick.normalScale.set(1.2, 1.2);
  M.q = std(TX.questionTex(ts), { metalness: 1, envMap: env, envMapIntensity: 0.9, emissiveIntensity: 1.25 });
  M.q.normalScale.set(1.3, 1.3);
  patch(M.q, 'qblock', (s) => {
    withWorld(s);
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float qp = 0.62 + 0.38 * sin(uTime * 3.2 + vBC.x * 0.9);
      float qb = fract((vBW.x * 0.8 + vBW.y * 0.55) * 0.4 - uTime * 0.38);
      float qs = smoothstep(0.0, 0.05, qb) * smoothstep(0.14, 0.06, qb);
      totalEmissiveRadiance = totalEmissiveRadiance * qp + vec3(1.0, 0.82, 0.5) * qs * 0.55;`);
  });
  M.used = std(TX.usedTex(theme, ts), { envMap: env, envMapIntensity: 0.5 });
  M.stone = std(TX.stoneTex(theme, ts), { envMap: theme === 'cielo' ? env : null, emissiveIntensity: 1.2 });
  M.pillar = std(TX.pillarTex(theme, ts), { envMap: theme === 'cueva' || theme === 'cielo' ? env : null, envMapIntensity: 0.8, emissiveIntensity: theme === 'cueva' ? 1.1 : 1.3 });
  if (theme === 'cueva') M.pillar.color.set(0xa0c8ff);
  M.trim = std(TX.stoneTex(theme, ts), { envMap: theme === 'cielo' ? env : null, emissiveIntensity: 1.2 });
  M.wood = std(TX.woodTex(theme, ts), { envMap: env, envMapIntensity: 0.25 });
  M.rope = std(TX.ropeTex(quality === 'low' ? 64 : 128));
  M.spike = new THREE.MeshStandardMaterial({ color: theme === 'castillo' ? 0xb8a8a8 : 0xd8dee8, metalness: 1, roughness: 0.28, envMap: env, envMapIntensity: 1.1, vertexColors: true });
  // --- terreno
  const dirt = TX.dirtTex(theme, ds);
  M.body = std(dirt, { vertexColors: true, emissiveIntensity: theme === 'castillo' ? 1.6 : 1 });
  M.body.normalScale.set(1.4, 1.4);
  M.capTop = std(TX.capTopTex(theme, ds), { emissiveIntensity: 1.2 });
  M.capSide = std(TX.capSideTex(theme, ts), { emissiveIntensity: 1.2 });
  if (theme === 'cielo') { M.capTop.emissive = M.capSide.emissive = new THREE.Color(0x3a3048); M.capTop.emissiveIntensity = M.capSide.emissiveIntensity = 1; }
  if (theme !== 'castillo') M.fringe = std(TX.fringeTex(theme, ts), { alphaTest: 0.5, side: THREE.DoubleSide, emissiveIntensity: 1 });
  if (M.fringe && theme === 'cielo') { M.fringe.emissive = new THREE.Color(0x3a3048); }
  const tuft = TX.tuftTex(theme, ts);
  M.tuft = new THREE.MeshStandardMaterial({ map: tuft.map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  patch(M.tuft, 'tuft', (s) => {
    s.uniforms.uTime = U.time;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 tw = vec4(0.0, 0.0, 0.0, 1.0);
      #ifdef USE_INSTANCING
        tw = instanceMatrix * tw;
      #endif
      float sw = sin(uTime * 1.9 + tw.x * 0.55 + tw.z * 0.4) * 0.6 + sin(uTime * 3.3 + tw.x * 1.7) * 0.3;
      transformed.x += sw * 0.12 * position.y * position.y * 6.0;`);
  });
  M.flower = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  patch(M.flower, 'flower', (s) => {
    s.uniforms.uTime = U.time;
    s.vertexShader = 'attribute float aux;\nuniform float uTime;\n' + s.vertexShader.replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      #ifdef USE_COLOR
        vColor = color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        vColor = mix(vColor, vColor * instanceColor, aux);
      #endif`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 fw = vec4(0.0, 0.0, 0.0, 1.0);
      #ifdef USE_INSTANCING
        fw = instanceMatrix * fw;
      #endif
      transformed.x += sin(uTime * 2.1 + fw.x * 0.8) * 0.05 * position.y * 3.0;`);
  });
  M.crystal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 1.1, flatShading: true, envMap: env, envMapIntensity: 1 });
  patch(M.crystal, 'crystal', (s) => {
    withWorld(s);
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        totalEmissiveRadiance *= vColor * (0.55 + 0.45 * sin(uTime * 1.7 + vBC.x * 1.3 + vBC.z));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1), 0.5);
      #endif`);
  });
  M.puff = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x4a3c5a, emissiveIntensity: 1 });
  M.hex = new THREE.MeshStandardMaterial({ color: 0x2c2830, roughness: 0.7, flatShading: true, emissive: 0xff4a10, emissiveIntensity: 0 });
  // --- lava
  const lt = TX.lavaTex(quality === 'low' ? 128 : 256).map;
  lt.colorSpace = THREE.NoColorSpace;
  M.lava = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.time, uTex: { value: lt } },
    fog: true,
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      attribute float aTop; attribute float aDepth; uniform float uTime; varying vec3 vP; varying float vTop; varying float vDepth;
      void main() {
        vec3 transformed = position;
        transformed.y += aTop * (sin(position.x * 1.9 + uTime * 1.6) * 0.035 + sin(position.z * 2.3 - uTime * 1.1 + position.x) * 0.03);
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vP = (modelMatrix * vec4(transformed, 1.0)).xyz; vTop = aTop; vDepth = aDepth;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform float uTime; uniform sampler2D uTex; varying vec3 vP; varying float vTop; varying float vDepth;
      void main() {
        vec2 uv = vTop > 0.5 ? vP.xz * vec2(0.22, 0.3) : vec2(vP.x * 0.22, vP.y * 0.18 + uTime * 0.02);
        float h1 = texture2D(uTex, uv + vec2(uTime * 0.03, uTime * 0.012)).r;
        float h2 = texture2D(uTex, uv * 1.7 + vec2(-uTime * 0.021, uTime * 0.027)).r;
        float heat = h1 * 0.62 + h2 * 0.55 - 0.18 + 0.1 * sin(uTime * 2.0 + vP.x * 0.8);
        heat = mix(heat, heat * 0.45 - 0.05, smoothstep(0.2, 5.0, vDepth));
        vec3 crust = vec3(0.16, 0.02, 0.01), mid = vec3(1.0, 0.25, 0.02), hot = vec3(1.0, 0.8, 0.3);
        vec3 col = mix(crust, mid, smoothstep(0.12, 0.5, heat));
        col = mix(col, hot, smoothstep(0.58, 0.95, heat));
        col *= 1.0 + 1.6 * smoothstep(0.5, 1.0, heat);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  MATS.set(key, M);
  return M;
}

// ------------------------------------------------------------------ geometrías compartidas
const GEOS = new Map();
const STATIC_CACHE = new WeakMap(); // level.def -> Map(tema:calidad -> objetos estáticos)
function sharedGeo(key, fn) { if (!GEOS.has(key)) { const g = fn(); g.userData.shared = true; GEOS.set(key, g); } return GEOS.get(key); }
const seg = (q) => (q === 'low' ? 2 : 3);
const blockGeo = (q, r = 0.08) => sharedGeo('block' + q + r, () => roundedBox(0.99, 0.99, 0.99, r, q === 'low' ? 1 : 2));
function plankGeo(q) {
  return sharedGeo('plank' + q, () => {
    const p = roundedBox(1.0, 0.2, 1.24, 0.05, seg(q), { offset: [0, 0.4, 0] });
    const l1 = ensureIndex(new THREE.CylinderGeometry(0.075, 0.075, 1.02, 8)); l1.rotateZ(Math.PI / 2); l1.translate(0, 0.24, 0.42);
    const l2 = l1.clone(); l2.translate(0, 0, -0.84);
    return mergeByMaterial([p, l1, l2]);
  });
}
function ropeGeo(q) {
  return sharedGeo('rope' + q, () => {
    const gs = [];
    for (const x of [-0.42, 0.42]) {
      for (const z of [-0.42, 0.42]) {
        const t = new THREE.TorusGeometry(0.11, 0.028, 5, 10); t.scale(0.55, 1.35, 1); t.rotateY(Math.PI / 2 * 0); t.translate(x, 0.33, z);
        gs.push(ensureIndex(t));
      }
    }
    return mergeByMaterial(gs);
  });
}
function spikeGeo(q) {
  return sharedGeo('spike' + q, () => {
    const gs = [];
    const base = tint(roundedBox(0.96, 0.16, 0.92, 0.05, 2, { offset: [0, -0.42, 0] }), [0.35, 0.33, 0.36]);
    gs.push(base);
    const cones = [[-0.32, 0.22, 0.66], [0, 0.22, 0.74], [0.32, 0.22, 0.66], [-0.16, -0.2, 0.62], [0.16, -0.2, 0.7]];
    for (const [x, z, h] of cones) {
      const c = new THREE.ConeGeometry(0.15, h, q === 'low' ? 6 : 10, 1); c.translate(x, -0.34 + h / 2, z);
      tint(ensureIndex(c), [1, 1, 1]); gs.push(c);
      const ring = new THREE.CylinderGeometry(0.16, 0.17, 0.06, q === 'low' ? 6 : 10); ring.translate(x, -0.33, z); tint(ensureIndex(ring), [0.5, 0.45, 0.4]); gs.push(ring);
    }
    return mergeByMaterial(gs, ['position', 'normal', 'uv', 'color']);
  });
}

// ------------------------------------------------------------------ pool instanciado con crecimiento
class Pool {
  constructor(group, geo, mat, cap, opts = {}) {
    this.group = group; this.geo = geo; this.mat = mat; this.opts = opts;
    this.keys = []; this.index = new Map(); this.colors = opts.colors;
    this.make(Math.max(4, cap));
  }
  make(cap) {
    const old = this.mesh;
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.count = this.keys.length; m.castShadow = this.opts.cast !== false; m.receiveShadow = true; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (old) {
      m.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.keys.length * 16));
      if (old.instanceColor) { m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.array.set(old.instanceColor.array.subarray(0, this.keys.length * 3)); }
      this.group.remove(old); old.dispose();
    }
    this.mesh = m; this.cap = cap; this.group.add(m);
  }
  add(key, mx, color) {
    if (this.index.has(key)) this.remove(key);
    if (this.keys.length >= this.cap) this.make(this.cap * 2);
    const i = this.keys.length; this.keys.push(key); this.index.set(key, i);
    this.mesh.setMatrixAt(i, mx); if (color) this.mesh.setColorAt(i, color);
    this.mesh.count = this.keys.length; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  remove(key) {
    const i = this.index.get(key); if (i === undefined) return;
    const last = this.keys.length - 1, m = this.mesh;
    if (i !== last) {
      const lk = this.keys[last]; this.keys[i] = lk; this.index.set(lk, i);
      m.instanceMatrix.array.copyWithin(i * 16, last * 16, last * 16 + 16);
      if (m.instanceColor) m.instanceColor.array.copyWithin(i * 3, last * 3, last * 3 + 3);
    }
    this.keys.pop(); this.index.delete(key); m.count = this.keys.length;
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  set(key, mx) { const i = this.index.get(key); if (i === undefined) return; this.mesh.setMatrixAt(i, mx); this.mesh.instanceMatrix.needsUpdate = true; }
  dispose() { this.group.remove(this.mesh); this.mesh.dispose(); }
}

const POOL_OF = {
  [T.BRICK]: ['brick'], [T.MULTICOIN]: ['brick'], [T.QCOIN]: ['q'], [T.QPOWER]: ['q'], [T.QSTAR]: ['q'], [T.Q1UP]: ['q'],
  [T.USED]: ['used'], [T.STONE]: ['stone'], [T.ONEWAY]: ['plank', 'rope'], [T.SPIKES]: ['spike'],
};
const STATIC = new Set([T.GROUND, T.PILLAR, T.PILLAR_TOP, T.LAVA]);

// ------------------------------------------------------------------ renderer
export class BlockRenderer {
  /** @param {{scene:THREE.Scene, level:import('../level.js').Level, theme:string, renderer?:THREE.WebGLRenderer, quality?:string}} ctx */
  constructor(ctx) {
    this.ctx = ctx; this.level = ctx.level;
    this.theme = THEMES.includes(ctx.theme) ? ctx.theme : 'pradera';
    this.quality = ctx.quality || 'high';
    if (ctx.renderer) TX.setAnisotropy(Math.min(this.quality === 'low' ? 2 : 8, ctx.renderer.capabilities.getMaxAnisotropy()));
    this.group = new THREE.Group(); this.group.name = 'blocks'; ctx.scene.add(this.group);
    this.mats = getMats(this.theme, this.quality, ctx.renderer);
    this.bumps = new Map();
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.buildPools();
    this.buildStatic();
  }

  buildPools() {
    const L = this.level, q = this.quality, M = this.mats;
    const counts = {}; let bumpables = 0;
    for (let i = 0; i < L.tiles.length; i++) {
      const t = L.tiles[i]; const ps = POOL_OF[t]; if (ps) for (const p of ps) counts[p] = (counts[p] || 0) + 1;
      if (t === T.BRICK || t === T.MULTICOIN || (t >= T.QCOIN && t <= T.QPOWER) || t === T.QSTAR || t === T.Q1UP) bumpables++;
    }
    const g = this.group;
    this.pools = {
      brick: new Pool(g, blockGeo(q, 0.07), M.brick, counts.brick || 4),
      q: new Pool(g, blockGeo(q, 0.1), M.q, counts.q || 4),
      used: new Pool(g, blockGeo(q, 0.1), M.used, (counts.used || 0) + bumpables),
      stone: new Pool(g, blockGeo(q, 0.06), M.stone, counts.stone || 4),
      plank: new Pool(g, plankGeo(q), M.wood, counts.plank || 4),
      rope: new Pool(g, ropeGeo(q), M.rope, counts.rope || 4, { cast: false }),
      spike: new Pool(g, spikeGeo(q), M.spike, counts.spike || 4),
    };
    this.where = new Map();
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const t = L.tiles[y * L.w + x]; if (t && !STATIC.has(t)) this.addTile(x, y, t); }
  }
  baseMatrix(x, y, t, out = this._m) {
    const r = TX.hash(x, y, 77);
    if (t === T.ONEWAY) return out.compose(this._v.set(x + 0.5, y + 0.5, 0), this._q.setFromAxisAngle(this._s.set(0, 1, 0), (r - 0.5) * 0.06), this._s.set(1, 1, 1));
    if (t === T.SPIKES) return out.compose(this._v.set(x + 0.5, y + 0.5, 0), this._q.identity(), this._s.set(r < 0.5 ? 1 : -1, 1, 1).set(1, 1, 1));
    return out.compose(this._v.set(x + 0.5, y + 0.5, 0), this._q.identity(), this._s.set(1, 1, 1));
  }
  addTile(x, y, t) {
    let ps = POOL_OF[t];
    if (!ps) { if (!t) return; ps = ['stone']; } // tipo estático añadido en caliente
    const key = y * this.level.w + x, mx = this.baseMatrix(x, y, t);
    const r = TX.hash(x, y, 13), col = new THREE.Color().setScalar(0.9 + r * 0.18);
    for (const p of ps) this.pools[p].add(key, mx, p === 'brick' || p === 'stone' || p === 'plank' ? col : null);
    this.where.set(key, { ps, x, y, t });
  }
  removeTile(key) { const w = this.where.get(key); if (!w) return; for (const p of w.ps) this.pools[p].remove(key); this.where.delete(key); }

  buildStatic() {
    // Terreno, decorado, columnas y lava no cambian en juego: se cachean por definición de nivel
    // (loadLevel se repite en cada muerte) y se reutilizan los mismos objetos.
    const L = this.level, M = this.mats, q = this.quality, ck = this.theme + ':' + q;
    let per = STATIC_CACHE.get(L.def); if (!per) { per = new Map(); STATIC_CACHE.set(L.def, per); }
    let objs = per.get(ck);
    if (!objs) {
      objs = [];
      const { meshes, tops } = buildTerrain(L, this.theme, q, M);
      objs.push(...meshes, ...buildDecor(tops, this.theme, q, M, L));
      const p = this.buildPillars(); if (p) objs.push(p);
      const lv = this.buildLava(); if (lv) objs.push(lv);
      for (const o of objs) o.geometry.userData.shared = true;
      per.set(ck, objs);
    }
    for (const o of objs) this.group.add(o);
  }

  // --- columnas de 2 casillas de ancho con capitel
  buildPillars() {
    const L = this.level, W = L.w, used = new Uint8Array(L.tiles.length), q = this.quality;
    const isP = (x, y) => x >= 0 && x < W && y >= 0 && y < L.h && (L.tiles[y * W + x] === T.PILLAR || L.tiles[y * W + x] === T.PILLAR_TOP);
    const geos = [];
    const make = (x0, wd, yb, yt, capital) => {
      const cx = x0 + wd / 2, s = seg(q);
      const D = wd > 1 ? 1.35 : 0.95;
      const add = (g, mi) => { for (const gr of g.groups) gr.materialIndex = mi; geos.push(g); return g; };
      // ¿hay algo sólido debajo? si no (columna sobre abismo), el fuste baja hasta el fondo sin plinto
      let support = false; for (let yy = yb - 1; yy >= 0 && !support; yy--) for (let k = 0; k < wd; k++) { const t = L.tiles[yy * W + x0 + k]; if (t && t !== T.LAVA && t !== T.SPIKES) support = true; }
      if (support || yb > 0 && L.tiles[(yb - 1) * W + x0] === T.LAVA) {
        add(roundedBox(wd + 0.04, 0.34, D + 0.3, 0.07, s, { offset: [cx, yb + 0.12, 0] }), 1);
        add(roundedBox(wd - 0.06, 0.14, D + 0.14, 0.06, s, { offset: [cx, yb + 0.35, 0] }), 1);
      } else yb = YB - 0.4;
      const top = capital ? yt + 0.2 : yt + 1, bot = yb + 0.4, h = top - bot;
      if (h > 0.05) {
        const sh = roundedBox(wd - 0.24, h, D, Math.min(0.42, (wd - 0.24) / 2 - 0.02), q === 'low' ? 3 : 5, { offset: [cx, bot + h / 2, 0], maxStep: 0.5 });
        const p = sh.attributes.position, uv = sh.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const a = Math.atan2(p.getZ(i), p.getX(i) - cx) / (Math.PI * 2) + 0.25;
          uv.setXY(i, a * (wd > 1 ? 2 : 1), p.getY(i) * 0.5);
        }
        add(sh, 0);
      }
      if (capital) {
        add(roundedBox(wd - 0.1, 0.12, D + 0.1, 0.05, s, { offset: [cx, yt + 0.24, 0] }), 1);
        add(roundedBox(wd + 0.0, 0.22, D + 0.24, 0.09, s, { offset: [cx, yt + 0.41, 0] }), 1);
        add(roundedBox(wd + 0.16, 0.48, D + 0.42, 0.1, s, { offset: [cx, yt + 0.76, 0] }), 1);
      }
    };
    for (let y = L.h - 1; y >= 0; y--) for (let x = 0; x < W; x++) {
      if (!isP(x, y) || used[y * W + x]) continue;
      // tramo horizontal superior
      let x1 = x; while (isP(x1 + 1, y) && !used[y * W + x1 + 1]) x1++;
      for (let a = x; a <= x1; a += 2) {
        const wd = Math.min(2, x1 - a + 1);
        let yb = y; const colOk = (yy) => { for (let k = 0; k < wd; k++) if (!isP(a + k, yy) || used[yy * W + a + k]) return false; return true; };
        while (yb - 1 >= 0 && colOk(yb - 1)) yb--;
        for (let yy = yb; yy <= y; yy++) for (let k = 0; k < wd; k++) used[yy * W + a + k] = 1;
        make(a, wd, yb, y, L.tiles[y * W + a] === T.PILLAR_TOP);
      }
    }
    if (!geos.length) return null;
    const g = mergeByMaterial(geos);
    const m = new THREE.Mesh(g, [this.mats.pillar, this.mats.trim]); m.castShadow = m.receiveShadow = true;
    return m;
  }

  // --- lava animada
  buildLava() {
    const L = this.level, W = L.w, pos = [], top = [], dep = [], idx = [];
    const isL = (x, y) => x >= 0 && x < W && y >= 0 && y < L.h && L.tiles[y * W + x] === T.LAVA;
    const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
    const v = (x, y, z, t, d) => { pos.push(x, y, z); top.push(t); dep.push(d); return pos.length / 3 - 1; };
    for (let x = 0; x < W; x++) for (let y = 0; y < L.h; y++) {
      if (!isL(x, y) || isL(x, y + 1)) continue;
      const sy = y + 0.78;
      let by = y; while (by - 1 >= 0 && (isL(x, by - 1) || L.tiles[(by - 1) * W + x] === T.EMPTY)) by--;
      const bottom = by === 0 ? YB : by;
      // superficie
      const zs = []; for (let z = ZB; z < ZF + 0.01; z += 0.5) zs.push(Math.min(z, ZF));
      for (let k = 0; k < zs.length - 1; k++) for (let i = 0; i < 4; i++) {
        const x0 = x + i / 4, x1 = x + (i + 1) / 4;
        const a = v(x0, sy, zs[k + 1], 1, 0), b = v(x1, sy, zs[k + 1], 1, 0), c = v(x1, sy, zs[k], 1, 0), d = v(x0, sy, zs[k], 1, 0);
        quad(a, d, c, b);
      }
      // frente (las aristas superiores siguen la ola: aTop=1)
      for (let i = 0; i < 4; i++) {
        const x0 = x + i / 4, x1 = x + (i + 1) / 4;
        const a = v(x0, bottom, ZF, 0, sy - bottom), b = v(x1, bottom, ZF, 0, sy - bottom), c = v(x1, sy, ZF, 1, 0), d = v(x0, sy, ZF, 1, 0);
        quad(a, b, c, d);
      }
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
    g.setIndex(idx); g.computeBoundingSphere();
    return new THREE.Mesh(g, this.mats.lava);
  }

  /** Llamado cuando cambia una casilla (romper ladrillo, bloque usado...). */
  onTileChange(x, y, oldT, newT) {
    const key = y * this.level.w + x;
    this.removeTile(key);
    if (newT) this.addTile(x, y, newT);
    const b = this.bumps.get(key); if (b && !newT) this.bumps.delete(key);
  }

  /** Animación de golpe desde abajo (elástica, squash & stretch). */
  bump(x, y) { const key = y * this.level.w + x; if (this.where.has(key)) this.bumps.set(key, { t: 0, x, y }); }

  update(dt, time, camX) {
    U.time.value = time;
    if (!this.bumps.size) return;
    const m = this._m;
    for (const [key, b] of this.bumps) {
      b.t += dt; const t = b.t;
      const w = this.where.get(key); if (!w) { this.bumps.delete(key); continue; }
      if (t > 0.7) { this.baseMatrix(b.x, b.y, w.t, m); for (const p of w.ps) this.pools[p].set(key, m); this.bumps.delete(key); continue; }
      const dy = 0.72 * Math.exp(-7 * t) * Math.sin(Math.PI * t / 0.22);
      const sy = 1 - 0.16 * Math.exp(-6.5 * t) * Math.cos(t * Math.PI * 2 / 0.2), sx = 1 / Math.sqrt(sy);
      const tilt = Math.exp(-8 * t) * Math.sin(t * 38) * 0.035 * (TX.hash(b.x, b.y, 3) < 0.5 ? -1 : 1);
      m.compose(this._v.set(b.x + 0.5, b.y + 0.5 + Math.max(-0.06, dy), 0), this._q.setFromAxisAngle(this._s.set(0, 0, 1), tilt), this._s.set(sx, sy, sx));
      for (const p of w.ps) this.pools[p].set(key, m);
    }
  }

  dispose() {
    for (const p of Object.values(this.pools)) p.dispose();
    this.ctx.scene.remove(this.group);
    this.group.clear(); // los objetos estáticos cacheados se reutilizan en la próxima carga
    this.bumps.clear();
  }
}
