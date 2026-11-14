// Constructor de niveles: coordenadas con y = 0 en la fila inferior.
export class Builder {
  constructor(w, h = 15) {
    this.w = w; this.h = h;
    this.g = Array.from({ length: h }, () => Array(w).fill(' '));
  }
  put(x, y, ch) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.g[this.h - 1 - y][x] = ch; return this; }
  at(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.g[this.h - 1 - y][x] : ' '; }
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
  // ---- helpers adicionales ----
  // abre un foso de x0 a x1 (inclusive) en las filas 0..hh-1; fill ' ' (abismo) o '~' (lava)
  pit(x0, x1, fill = ' ', hh = 2) { return this.rect(x0, 0, x1 - x0 + 1, hh, fill); }
  // isla/bloque macizo cuya superficie superior queda en y = top (filas top-thick .. top-1)
  island(x0, x1, top, thick = top, ch = '#') { return this.rect(x0, top - thick, x1 - x0 + 1, thick, ch); }
  // techo: rellena las filas superiores (desde h-rows hasta h-1) de x0 a x1
  ceiling(x0, x1, rows = 1, ch = '#') { return this.rect(x0, this.h - rows, x1 - x0 + 1, rows, ch); }
  // monedas en arco (parábola) de n monedas, base y, altura extra hgt
  arc(x, y, n, hgt = 2) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.put(x + i, y + Math.round(hgt * 4 * t * (1 - t)), 'C');
    }
    return this;
  }
  // columna de 2 de ancho con planta ígnea encima (la entidad va en la columna izquierda)
  firePillar(x, y, h) { this.pillar(x, y, h); return this.put(x, y + h, 'f'); }
  rows() { return this.g.map((r) => r.join('')); }
}
