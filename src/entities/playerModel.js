// PLACEHOLDER — modelo del protagonista (Kiko). Será reemplazado por el subagente de personaje.
import * as THREE from 'three';
/**
 * Devuelve { root, update(dt, s) }. Pivote = centro de los pies, mirando a +X por defecto.
 * s = { vx, vy, onGround, facing, speed, running, skid, crouch, power(0|1|2), invuln, star, time,
 *       dying, victory, climbing, throwing, growT (0..1 o -1), runMax }
 * Pequeño ≈ 1 casilla de alto, grande ≈ 1.9 casillas.
 */
export function createPlayerModel() {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.3, 4, 12), new THREE.MeshStandardMaterial({ color: 0xff7a1a }));
  body.position.y = 0.5; body.castShadow = true; root.add(body);
  return {
    root,
    update(dt, s) {
      const sc = s.power > 0 ? 1.9 : 1; root.scale.set(1, sc * (s.crouch ? 0.6 : 1), 1);
      root.rotation.y = s.facing > 0 ? 0 : Math.PI;
      root.visible = !(s.invuln && Math.floor(s.time * 20) % 2);
    },
  };
}
