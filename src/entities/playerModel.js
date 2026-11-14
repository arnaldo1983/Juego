// Modelo del protagonista: KIKO, el pequeño zorro aventurero (ver ./player/).
import { createKiko } from './player/kikoRig.js';
/**
 * Devuelve { root, update(dt, s) }. Pivote = centro de los pies, mirando a +X por defecto
 * (girado ~25° hacia la cámara para mostrar la cara).
 * s = { vx, vy, onGround, facing, speed, running, skid, crouch, power(0|1|2), invuln, star, time,
 *       dying, victory, climbing, throwing, growT (0..1 o -1), runMax }
 * Pequeño ≈ 0.95 de alto, grande ≈ 1.8.
 */
export function createPlayerModel() {
  return createKiko();
}
