// PLACEHOLDER — modelos de enemigos, objetos y decorado de meta. Serán reemplazados por el subagente de modelos.
// Contrato: cada fábrica devuelve { root: THREE.Object3D, update(dt, s) }. Pivote = centro de la base.
import * as THREE from 'three';
const box = (w, h, d, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c })); m.position.y = h / 2; m.castShadow = true; return m; };
const simple = (o) => { const root = new THREE.Group(); root.add(o); return { root, update() {} }; };

/** Bellotín: bellota enfadada que camina. s = { vx, time, squashed(bool), dead(bool) } */
export function createAcornModel() { const r = simple(box(0.8, 0.8, 0.8, 0x8b5a2b)); r.update = (dt, s) => { r.root.scale.y = s.squashed ? 0.25 : 1; r.root.rotation.z = s.dead ? Math.PI : 0; }; return r; }
/** Escarabajo: camina; al pisarlo se esconde en su caparazón. s = { vx, time, shell(bool), shellSpin(bool), waking(0..1), dead } */
export function createBeetleModel() { const r = simple(box(0.85, 0.9, 0.8, 0x2a9d5a)); r.update = (dt, s) => { r.root.scale.y = s.shell ? 0.6 : 1; r.root.rotation.z = s.dead ? Math.PI : 0; }; return r; }
/** Avispón: vuela. s = { vx, time, dead } */
export function createWaspModel() { return simple(box(0.8, 0.7, 0.6, 0xffcc00)); }
/** Planta ígnea dentro de una columna. s = { time, out(0..1), dead } */
export function createFirePlantModel() { return simple(box(0.8, 1.4, 0.8, 0xcc2244)); }
/** Moneda estelar. s = { time, popping(bool) } */
export function createCoinModel() { const r = simple(box(0.6, 0.6, 0.15, 0xffd700)); r.root.children[0].position.y = 0.5; r.update = (dt, s) => { r.root.rotation.y = s.time * 4; }; return r; }
/** Fruta Solar (crecer). */
export function createFruitModel() { return simple(box(0.8, 0.8, 0.8, 0xff3030)); }
/** Flor Ígnea (fuego). */
export function createFlowerModel() { return simple(box(0.8, 0.9, 0.3, 0xff8800)); }
/** Estrella de cristal (invencible). */
export function createStarModel() { return simple(box(0.8, 0.8, 0.3, 0xffff60)); }
/** Trébol de vida (1UP). */
export function createOneUpModel() { return simple(box(0.8, 0.8, 0.8, 0x30d050)); }
/** Bola de fuego del jugador. Pivote en el centro. */
export function createFireballModel() { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xff8a00 })); return simple(m); }
/** Plataforma móvil de anchura w casillas. Pivote = centro de la cara superior. */
export function createPlatformModel(w) { const m = box(w, 0.4, 1, 0xc08040); m.position.y = -0.2; return simple(m); }
/** Meta: mástil (10 casillas de alto) + estandarte + torre/castillo a +7 casillas. s = { flagY (0..1, 1=arriba), time, raised(bool) } */
export function createGoalModel() {
  const root = new THREE.Group(); const pole = box(0.15, 10, 0.15, 0xdddddd); root.add(pole);
  const flag = box(1.2, 0.8, 0.05, 0x22aa55); flag.position.x = -0.6; root.add(flag);
  const castle = box(5, 5, 3, 0x9a7a5a); castle.position.x = 7; castle.position.z = -1; root.add(castle);
  return { root, update(dt, s) { flag.position.y = 1 + s.flagY * 8.4; } };
}
/** Banderín de punto de control. s = { active(bool), time } */
export function createCheckpointModel() { const r = simple(box(0.15, 2, 0.15, 0xaaaaaa)); return r; }
