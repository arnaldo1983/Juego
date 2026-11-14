// Constantes globales del juego. 1 unidad = 1 casilla.
export const T = {
  EMPTY: 0, GROUND: 1, BRICK: 2, QCOIN: 3, QPOWER: 4, USED: 5, STONE: 6,
  ONEWAY: 7, PILLAR: 8, PILLAR_TOP: 9, MULTICOIN: 10, QSTAR: 11, SPIKES: 12,
  LAVA: 13, Q1UP: 14,
};

// Caracteres del mapa de niveles -> casilla
export const CHAR_TILE = {
  '#': T.GROUND, 'B': T.BRICK, '?': T.QCOIN, 'M': T.QPOWER, 'u': T.USED,
  'X': T.STONE, '=': T.ONEWAY, '|': T.PILLAR, 'T': T.PILLAR_TOP,
  '$': T.MULTICOIN, 'S': T.QSTAR, '^': T.SPIKES, '~': T.LAVA, '1': T.Q1UP,
};
// Caracteres del mapa -> entidades
export const CHAR_ENTITY = {
  '@': 'start', 'C': 'coin', 'e': 'acorn', 'k': 'beetle', 'w': 'wasp',
  'G': 'goal', 'L': 'platformH', 'V': 'platformV', 'f': 'fireplant', 'c': 'checkpoint',
};

const SOLID = new Set([T.GROUND, T.BRICK, T.QCOIN, T.QPOWER, T.USED, T.STONE, T.PILLAR, T.PILLAR_TOP, T.MULTICOIN, T.QSTAR, T.Q1UP]);
export const isSolidTile = (t) => SOLID.has(t);
export const isBumpable = (t) => t === T.BRICK || t === T.QCOIN || t === T.QPOWER || t === T.MULTICOIN || t === T.QSTAR || t === T.Q1UP;
export const isQuestion = (t) => t === T.QCOIN || t === T.QPOWER || t === T.QSTAR || t === T.Q1UP;

export const PHYS = {
  gravity: 70,          // gravedad normal
  gravityHold: 36,      // gravedad al subir manteniendo salto
  gravityApex: 24,      // gravedad cerca del ápice (sensación flotante)
  maxFall: 24,
  walkMax: 6.4,
  runMax: 10.2,
  accelGround: 34,
  accelRun: 26,
  accelAir: 24,
  decelGround: 30,
  skidDecel: 56,
  jumpVel: 17.2,
  jumpRunBonus: 2.0,
  coyote: 0.1,
  jumpBuffer: 0.13,
  stompBounce: 14,
  stompBounceHold: 19,
};

export const SCORE = { coin: 200, stomp: 100, brick: 50, power: 1000, kick: 400, fire: 200 };
export const START_LIVES = 3;
