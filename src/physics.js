import { T, isSolidTile } from './config.js';

// Cuerpo: x = centro, y = base (pies). w, h = tamaño.
// Devuelve info de colisión: { ceil: {tx,ty}|null, wall: -1|0|1, landed: bool, landedTile }
export function moveBody(b, level, dt, opts = {}) {
  const res = { ceil: null, wall: 0, landed: false, landedTile: null };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / 0.35));
  const sdt = dt / steps;
  const wasGround = b.onGround;
  b.onGround = false;
  for (let i = 0; i < steps; i++) step(b, level, sdt, res, opts);
  if (b.onGround && !wasGround) res.landed = true;
  return res;
}

function solidAt(level, tx, ty, b) {
  const t = level.get(tx, ty);
  if (isSolidTile(t)) return true;
  if (b.solidCheck) return b.solidCheck(tx, ty, t);
  return false;
}

function step(b, level, dt, res, opts) {
  const hw = b.w / 2;
  // --- Eje X
  b.x += b.vx * dt;
  const y0 = Math.floor(b.y + 0.02), y1 = Math.floor(b.y + b.h - 0.02);
  if (b.vx > 0) {
    const tx = Math.floor(b.x + hw);
    for (let ty = y0; ty <= y1; ty++) if (solidAt(level, tx, ty, b)) { b.x = tx - hw - 0.0005; if (!opts.keepVx) b.vx = 0; res.wall = 1; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x - hw);
    for (let ty = y0; ty <= y1; ty++) if (solidAt(level, tx, ty, b)) { b.x = tx + 1 + hw + 0.0005; if (!opts.keepVx) b.vx = 0; res.wall = -1; break; }
  }
  // --- Eje Y
  const prevBottom = b.y;
  b.y += b.vy * dt;
  const x0 = Math.floor(b.x - hw + 0.02), x1 = Math.floor(b.x + hw - 0.02);
  if (b.vy <= 0) {
    const ty = Math.floor(b.y);
    for (let tx = x0; tx <= x1; tx++) {
      const t = level.get(tx, ty);
      const oneway = t === T.ONEWAY && prevBottom >= ty + 1 - 0.05 && !b.dropThrough;
      if (solidAt(level, tx, ty, b) || oneway) {
        b.y = ty + 1; b.vy = 0; b.onGround = true; res.landedTile = { tx, ty, t }; break;
      }
    }
  } else {
    const ty = Math.floor(b.y + b.h);
    const hits = [];
    for (let tx = x0; tx <= x1; tx++) if (solidAt(level, tx, ty, b)) hits.push(tx);
    if (hits.length) {
      // Corrección de esquina: si solo rozamos un borde, empujamos lateralmente.
      if (opts.cornerCorrect && hits.length === 1) {
        const tx = hits[0];
        const overlapL = (b.x + hw) - tx;          // rozando por la izquierda del bloque
        const overlapR = (tx + 1) - (b.x - hw);    // rozando por la derecha
        const lim = 0.32;
        if (tx === x1 && tx !== x0 && overlapL < lim && !solidAt(level, tx - 1, ty, b)) { b.x = tx - hw - 0.001; return; }
        if (tx === x0 && tx !== x1 && overlapR < lim && !solidAt(level, tx + 1, ty, b)) { b.x = tx + 1 + hw + 0.001; return; }
      }
      // Bloque golpeado: el más cercano al centro
      let best = hits[0], bd = 1e9;
      for (const tx of hits) { const d = Math.abs(tx + 0.5 - b.x); if (d < bd) { bd = d; best = tx; } }
      b.y = ty - b.h; b.vy = 0;
      if (!res.ceil) res.ceil = { tx: best, ty };
    }
  }
}

export function overlap(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y < b.y + b.h && b.y < a.y + a.h;
}
