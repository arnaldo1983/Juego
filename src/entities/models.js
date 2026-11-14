// Modelos procedurales de enemigos, objetos y decorado de meta (estilo AAA estilizado).
// Contrato: cada fábrica devuelve { root: THREE.Object3D, update(dt, s) }. Pivote = centro de la base
// (salvo la bola de fuego: centro). Implementación en src/entities/models/*.
export { createAcornModel, createBeetleModel, createWaspModel, createFirePlantModel } from './models/creatures.js';
export { createCoinModel, createFruitModel, createFlowerModel, createStarModel, createOneUpModel, createFireballModel } from './models/pickups.js';
export { createPlatformModel, createGoalModel, createCheckpointModel } from './models/world.js';
