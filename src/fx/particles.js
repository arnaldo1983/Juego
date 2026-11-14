// PLACEHOLDER — sistema de partículas. Será reemplazado por el subagente de efectos.
import * as THREE from 'three';
/**
 * emit(type, x, y, opts): tipos 'brick' (opts.color), 'coin', 'stomp', 'dust', 'land', 'skid',
 *   'fire' (explosión bola de fuego), 'sparkle', 'powerup', 'firework', 'lava', 'death', 'star' (estela invencible)
 * popup(text, x, y): texto flotante de puntuación.
 */
export class Particles {
  constructor(scene) { this.scene = scene; this.list = []; this.geo = new THREE.BoxGeometry(0.2, 0.2, 0.2); this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); }
  emit(type, x, y, opts = {}) {
    const n = type === 'brick' ? 4 : 6;
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(this.geo, this.mat); m.position.set(x, y, 0.5); this.scene.add(m); this.list.push({ m, vx: (Math.random() - 0.5) * 8, vy: Math.random() * 10, t: 0 }); }
  }
  popup(text, x, y) {}
  update(dt) {
    this.list = this.list.filter((p) => { p.t += dt; p.vy -= 30 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; if (p.t > 1) { this.scene.remove(p.m); return false; } return true; });
  }
  clear() { this.list.forEach((p) => this.scene.remove(p.m)); this.list = []; }
}
