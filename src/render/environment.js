// Entorno por tema: luces (sol con sombras que siguen a la cámara, hemisférica, mapa de entorno PMREM),
// cielo con degradado y astro, niebla atmosférica y fondos parallax 3D por capas.
import * as THREE from 'three';
import { T } from '../config.js';
import { preset } from './env/themes.js';
import { skyDome, skyMaterial, applySky } from './env/sky.js';
import { buildPradera } from './env/pradera.js';
import { buildCueva } from './env/cueva.js';
import { buildCielo } from './env/cielo.js';
import { buildCastillo } from './env/castillo.js';

const BUILDERS = { pradera: buildPradera, cueva: buildCueva, cielo: buildCielo, castillo: buildCastillo };

// Cachés de módulo: el nivel se recarga en cada muerte.
const envMaps = new Map();   // tema -> textura PMREM
const worlds = new Map();    // clave -> {group, update}

function envMapFor(renderer, theme, p) {
  if (envMaps.has(theme)) return envMaps.get(theme);
  const pm = new THREE.PMREMGenerator(renderer);
  const sc = new THREE.Scene();
  const mat = skyMaterial(); applySky(mat, { ...p.sky, sunIntensity: Math.min(p.sky.sunIntensity ?? 1, 4) });
  mat.depthTest = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat);
  sc.add(dome);
  // suelo de rebote (color hemisférico de tierra)
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 24).rotateX(-Math.PI / 2).translate(0, -3, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.hemi.ground).multiplyScalar(0.6) }));
  sc.add(ground);
  const rt = pm.fromScene(sc, 0.04);
  dome.geometry.dispose(); mat.dispose(); ground.geometry.dispose(); ground.material.dispose(); pm.dispose();
  envMaps.set(theme, rt.texture);
  return rt.texture;
}

/** Altura más común del suelo (fila superior de GROUND apoyado en y=0). */
function groundTop(level) {
  const hist = new Map();
  for (let x = 0; x < level.w; x++) {
    let y = 0; while (y < level.h && level.get(x, y) === T.GROUND) y++;
    if (y > 0) hist.set(y, (hist.get(y) || 0) + 1);
  }
  let best = 2, n = 0; for (const [k, v] of hist) if (v > n) { n = v; best = k; }
  return best;
}

export class Environment {
  constructor({ renderer, scene, camera, quality = 'high' }) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.quality = quality;
    this.group = new THREE.Group(); this.group.name = 'environment';
    scene.add(this.group);
    this.time = 0;
    this._dir = new THREE.Vector3(); this._x = new THREE.Vector3(); this._y = new THREE.Vector3(); this._t = new THREE.Vector3();
  }

  /** @param {string} theme 'pradera' | 'cueva' | 'cielo' | 'castillo' */
  setTheme(theme, level) {
    if (!BUILDERS[theme]) theme = 'pradera';
    this.theme = theme;
    const p = this.p = preset(theme), q = this.quality, scene = this.scene, R = this.renderer;
    this.group.clear();
    R.toneMappingExposure = p.exposure;
    if (q === 'low') R.shadowMap.type = THREE.PCFShadowMap;

    // Niebla + fondo de reserva
    scene.fog = new THREE.Fog(p.fog.color, p.fog.near, p.fog.far);
    scene.background = new THREE.Color(p.fog.color);

    // Luces
    this.hemi = new THREE.HemisphereLight(p.hemi.sky, p.hemi.ground, p.hemi.i);
    this.sun = new THREE.DirectionalLight(p.sun.color, p.sun.i);
    this._dir.set(...p.sun.dir).normalize();
    const sh = this.sun.shadow, ms = q === 'high' ? 2048 : q === 'medium' ? 1024 : 512;
    this.sun.castShadow = true;
    sh.mapSize.set(ms, ms);
    this.shadowHalf = { w: q === 'low' ? 16 : 19, h: q === 'low' ? 11 : 13 };
    Object.assign(sh.camera, { left: -this.shadowHalf.w, right: this.shadowHalf.w, top: this.shadowHalf.h, bottom: -this.shadowHalf.h, near: 1, far: 110 });
    sh.camera.updateProjectionMatrix();
    sh.bias = -0.0004; sh.normalBias = 0.035; sh.radius = q === 'high' ? 3 : 2;
    this.group.add(this.hemi, this.sun, this.sun.target);
    this.point = null;
    if (p.point && q !== 'low') {
      this.point = new THREE.PointLight(p.point.color, p.point.i, p.point.dist, 1.6);
      this.group.add(this.point);
    }

    // Cielo
    this.sky = skyDome(p.sky);
    this.group.add(this.sky);

    // Mapa de entorno para reflejos PBR
    scene.environment = envMapFor(R, theme, p);
    scene.environmentIntensity = p.env;

    // Mundo de fondo (cacheado por tema + tamaño de nivel + calidad)
    const key = `${theme}|${level.w}|${level.h}|${q}|${level.def && level.def.id}`;
    let world = worlds.get(key);
    if (!world) {
      world = BUILDERS[theme]({ w: level.w, h: level.h, gy: groundTop(level), q, level, preset: p, renderer: R });
      worlds.set(key, world);
      if (worlds.size > 3) { // liberar el más antiguo
        const [k0, w0] = worlds.entries().next().value; worlds.delete(k0);
        if (w0 !== world) disposeWorld(w0);
      }
    }
    this.world = world;
    this.group.add(world.group);
  }

  update(dt, camX, camY, time, player) {
    this.time = time;
    const cam = this.camera;
    if (this.sky) { this.sky.position.copy(cam.position); this.sky.material.uniforms.uTime.value = time; }
    // Sombras: caja ortográfica centrada en la vista, ajustada a texel para evitar parpadeo
    if (this.sun) {
      const d = this._dir, X = this._x, Y = this._y, Tt = this._t;
      X.set(0, 1, 0).cross(d).normalize(); Y.copy(d).cross(X).normalize();
      Tt.set(camX, camY - 1.5, -1.5);
      const unit = (2 * this.shadowHalf.w) / this.sun.shadow.mapSize.x;
      const tx = Math.round(Tt.dot(X) / unit) * unit, ty = Math.round(Tt.dot(Y) / unit) * unit, tz = Tt.dot(d);
      Tt.copy(X).multiplyScalar(tx).addScaledVector(Y, ty).addScaledVector(d, tz);
      this.sun.target.position.copy(Tt);
      this.sun.position.copy(Tt).addScaledVector(d, 55);
      this.sun.target.updateMatrixWorld();
    }
    if (this.point && player) {
      this.point.position.set(player.x, player.y + 1.4, 2.2);
    }
    if (this.world) this.world.update(dt, camX, camY, time, this.renderer.getPixelRatio(), player);
  }

  dispose() {
    // El mundo y las texturas quedan cacheados para la siguiente carga; solo se desengancha de la escena.
    this.group.remove(this.world && this.world.group);
    this.scene.remove(this.group);
    if (this.sun) this.sun.shadow.map && this.sun.shadow.map.dispose();
    if (this.sky) this.sky.material.dispose();
    this.scene.fog = null;
  }
}

function disposeWorld(w) {
  w.group.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
  });
}
