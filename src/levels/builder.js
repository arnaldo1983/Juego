// Constructor de niveles: coordenadas con y = 0 en la fila inferior.
export class Builder {
  constructor(w, h = 15) {
    this.w = w; this.h = h;
    this.g = Array.from({ length: h }, () => Array(w).fill(' '));
  }
  put(x, y, ch) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.g[this.h - 1 - y][x] = ch; return this; }
  rect(x, y, w, h, ch) { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) this.put(x + i, y + j, ch); return this; }
  // suelo de x0 a x1 (inclusive) con altura hh
  ground(x0, x1, hh = 2) { return this.rect(x0, 0, x1 - x0 + 1, hh, '#'); }
  // escribe una cadena horizontal empezando en (x,y)
  text(x, y, s) { [...s].forEach((c, i) => c !== '.' && this.put(x + i, y, c)); return this; }
  // columna de 2 de ancho, altura h sobre base y
  pillar(x, y, h) { for (let j = 0; j < h - 1; j++) { this.put(x, y + j, '|'); this.put(x + 1, y + j, '|'); } this.put(x, y + h - 1, 'T'); this.put(x + 1, y + h - 1, 'T'); return this; }
  // escalera de n peldaños; dir 1 = sube a la derecha, -1 = baja
  stairs(x, y, n, dir = 1, ch = 'X') {
    for (let i = 0; i < n; i++) { const hh = dir > 0 ? i + 1 : n - i; this.rect(x + i, y, 1, hh, ch); }
    return this;
  }
  coins(x, y, n, step = 1) { for (let i = 0; i < n; i++) this.put(x + i * step, y, 'C'); return this; }
  rows() { return this.g.map((r) => r.join('')); }
}
