// PLACEHOLDER — será reemplazado por el subagente de entorno/iluminación.
import * as THREE from 'three';
export class Environment {
  constructor({ renderer, scene, camera }) {
    this.scene = scene; this.camera = camera;
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5a4020, 1.2); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.5); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); Object.assign(this.sun.shadow.camera, { left: -20, right: 20, top: 15, bottom: -15, near: 1, far: 80 });
    scene.add(this.sun, this.sun.target);
  }
  /** @param {string} theme 'pradera' | 'cueva' | 'cielo' | 'castillo' ... */
  setTheme(theme, level) { this.scene.background = new THREE.Color(0x7ec8ff); }
  update(dt, camX, camY, time) { this.sun.position.set(camX - 10, camY + 25, 20); this.sun.target.position.set(camX, camY - 4, 0); }
  dispose() {}
}
