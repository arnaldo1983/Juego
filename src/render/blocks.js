// PLACEHOLDER — será reemplazado por el subagente de bloques/terreno.
import * as THREE from 'three';
import { T } from '../config.js';

const COLORS = { [T.GROUND]: 0x8a5a2b, [T.BRICK]: 0xb5502a, [T.QCOIN]: 0xf2b524, [T.QPOWER]: 0xf2b524, [T.QSTAR]: 0xf2b524, [T.Q1UP]: 0xf2b524, [T.MULTICOIN]: 0xb5502a, [T.USED]: 0x7a5a3a, [T.STONE]: 0x8d8d8d, [T.ONEWAY]: 0xa07040, [T.PILLAR]: 0x6aa5a0, [T.PILLAR_TOP]: 0x7ac5b0, [T.SPIKES]: 0xcccccc, [T.LAVA]: 0xff5500 };

export class BlockRenderer {
  /** @param {{scene:THREE.Scene, level:import('../level.js').Level, theme:string}} ctx */
  constructor(ctx) {
    this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group);
    this.meshes = new Map(); this.bumps = [];
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.mats = {};
    const L = ctx.level;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const t = L.get(x, y); if (t) this.add(x, y, t); }
  }
  mat(t) { return this.mats[t] ??= new THREE.MeshStandardMaterial({ color: COLORS[t] ?? 0xff00ff }); }
  add(x, y, t) {
    const m = new THREE.Mesh(this.geo, this.mat(t));
    m.position.set(x + 0.5, y + 0.5, 0); m.castShadow = m.receiveShadow = true;
    if (t === T.GROUND) m.scale.z = 3, m.position.z = -1;
    this.group.add(m); this.meshes.set(y * this.ctx.level.w + x, m);
  }
  /** Llamado cuando cambia una casilla (romper ladrillo, bloque usado...). */
  onTileChange(x, y, oldT, newT) {
    const k = y * this.ctx.level.w + x, m = this.meshes.get(k);
    if (m) { this.group.remove(m); this.meshes.delete(k); }
    if (newT) this.add(x, y, newT);
  }
  /** Animación de golpe desde abajo. */
  bump(x, y) { const m = this.meshes.get(y * this.ctx.level.w + x); if (m) this.bumps.push({ m, t: 0, y0: y + 0.5 }); }
  update(dt, time, camX) {
    this.bumps = this.bumps.filter((b) => { b.t += dt; const p = Math.min(1, b.t / 0.22); b.m.position.y = b.y0 + Math.sin(p * Math.PI) * 0.4; return p < 1; });
  }
  dispose() { this.ctx.scene.remove(this.group); }
}
