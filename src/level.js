import { T, CHAR_TILE, CHAR_ENTITY, isSolidTile } from './config.js';

// Nivel: rejilla de casillas. Fila 0 del texto = arriba. Mundo: y crece hacia arriba.
// La casilla (x,y) ocupa [x,x+1] x [y,y+1].
export class Level {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.theme = def.theme;
    this.time = def.time ?? 300;
    const rows = def.rows;
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.tiles = new Uint8Array(this.w * this.h);
    this.spawns = [];
    this.start = { x: 3.5, y: 2 };
    this.goal = null;
    this.checkpoints = [];
    this.contents = new Map(); // contenido especial de bloques (monedas restantes...)
    this.onChange = null;
    for (let r = 0; r < this.h; r++) {
      const row = rows[r];
      const y = this.h - 1 - r;
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] ?? ' ';
        if (CHAR_TILE[ch] !== undefined) {
          this.tiles[y * this.w + x] = CHAR_TILE[ch];
          if (ch === '$') this.contents.set(y * this.w + x, 8);
        } else if (CHAR_ENTITY[ch]) {
          const type = CHAR_ENTITY[ch];
          if (type === 'start') this.start = { x: x + 0.5, y };
          else if (type === 'goal') this.goal = { x: x + 0.5, y };
          else if (type === 'checkpoint') this.checkpoints.push({ x: x + 0.5, y });
          else this.spawns.push({ type, x: x + 0.5, y });
        }
      }
    }
  }
  idx(x, y) { return y * this.w + x; }
  get(x, y) {
    if (x < 0 || x >= this.w) return T.STONE; // paredes invisibles en los límites
    if (y < 0 || y >= this.h) return T.EMPTY;
    return this.tiles[y * this.w + x];
  }
  set(x, y, t) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = y * this.w + x, old = this.tiles[i];
    if (old === t) return;
    this.tiles[i] = t;
    this.onChange && this.onChange(x, y, old, t);
  }
  isSolid(x, y) { return isSolidTile(this.get(x, y)); }
  // Altura del suelo más alto en la columna x por debajo de y (para colocar cosas)
  groundBelow(x, y) {
    for (let ty = Math.floor(y); ty >= 0; ty--) if (this.isSolid(Math.floor(x), ty)) return ty + 1;
    return -10;
  }
}
