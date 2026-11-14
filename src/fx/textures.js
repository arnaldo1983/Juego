// Texturas procedurales (canvas) para el sistema de partículas. Cacheadas a nivel de módulo.
import * as THREE from 'three';

// Atlas 4x2 de celdas 128px. Canal A = forma, canal R = máscara de "núcleo"/sombreado.
export const FRAME = { GLOW: 0, SPARK: 1, STAR: 2, RING: 3, SMOKE: 4, FLARE: 5, DROP: 6, SMOKE2: 7 };
const CELL = 128;
let atlas = null;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Dibuja en una celda con dos pasadas: forma (alpha) y núcleo (rojo) combinadas por píxel.
function cell(ctx, col, row, shapeFn, coreFn) {
  const a = document.createElement('canvas'); a.width = a.height = CELL;
  const ca = a.getContext('2d'); shapeFn(ca);
  const b = document.createElement('canvas'); b.width = b.height = CELL;
  const cb = b.getContext('2d'); (coreFn || shapeFn)(cb);
  const da = ca.getImageData(0, 0, CELL, CELL).data, db = cb.getImageData(0, 0, CELL, CELL).data;
  const out = ctx.createImageData(CELL, CELL), o = out.data;
  for (let i = 0; i < o.length; i += 4) {
    o[i] = db[i + 3]; o[i + 1] = 255; o[i + 2] = 255; o[i + 3] = da[i + 3];
  }
  ctx.putImageData(out, col * CELL, row * CELL);
}

function radial(c, r0, stops) {
  const g = c.createRadialGradient(64, 64, 0, 64, 64, r0);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  c.fillStyle = g; c.fillRect(0, 0, CELL, CELL);
}

function starPath(c, cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r : R, a = rot + (i * Math.PI) / n;
    i ? c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  c.closePath();
}

function smoke(c, seed) {
  const R = rng(seed);
  c.filter = 'blur(5px)';
  for (let i = 0; i < 9; i++) {
    const ang = R() * Math.PI * 2, d = R() * 22;
    const x = 64 + Math.cos(ang) * d, y = 66 + Math.sin(ang) * d * 0.8, r = 18 + R() * 18;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  c.filter = 'none';
}
// Sombreado del humo: claro arriba-izquierda, oscuro abajo (canal R)
function smokeShade(c, seed) {
  smoke(c, seed);
  c.globalCompositeOperation = 'source-in';
  const g = c.createLinearGradient(30, 20, 90, 120);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.25)');
  c.fillStyle = g; c.fillRect(0, 0, CELL, CELL);
  c.globalCompositeOperation = 'source-over';
}

export function getAtlas() {
  if (atlas) return atlas;
  const cv = document.createElement('canvas'); cv.width = CELL * 4; cv.height = CELL * 2;
  const ctx = cv.getContext('2d');
  // 0 GLOW: halo suave
  cell(ctx, 0, 0, (c) => radial(c, 62, [[0, 1], [0.18, 0.75], [0.45, 0.25], [1, 0]]), (c) => radial(c, 30, [[0, 1], [1, 0]]));
  // 1 SPARK: punto caliente (se estira según velocidad)
  cell(ctx, 1, 0, (c) => radial(c, 62, [[0, 1], [0.22, 0.9], [0.5, 0.28], [1, 0]]), (c) => radial(c, 26, [[0, 1], [1, 0]]));
  // 2 STAR: estrella de 5 puntas redondeada con halo
  cell(ctx, 2, 0, (c) => {
    radial(c, 62, [[0, 0.5], [0.5, 0.15], [1, 0]]);
    c.fillStyle = '#fff'; c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = '#fff';
    starPath(c, 64, 67, 44, 19); c.fill(); c.stroke();
  }, (c) => { c.fillStyle = '#fff'; starPath(c, 64, 67, 26, 11); c.filter = 'blur(4px)'; c.fill(); });
  // 3 RING: anillo de onda
  cell(ctx, 3, 0, (c) => {
    c.filter = 'blur(3px)'; c.strokeStyle = '#fff'; c.lineWidth = 9; c.beginPath(); c.arc(64, 64, 46, 0, Math.PI * 2); c.stroke();
    c.filter = 'blur(6px)'; c.globalAlpha = 0.5; c.lineWidth = 14; c.stroke(); c.globalAlpha = 1; c.filter = 'none';
  }, (c) => { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(64, 64, 46, 0, Math.PI * 2); c.filter = 'blur(1px)'; c.stroke(); });
  // 4 SMOKE
  cell(ctx, 0, 1, (c) => smoke(c, 7), (c) => smokeShade(c, 7));
  // 5 FLARE: destello de 4 puntas
  cell(ctx, 1, 1, (c) => {
    radial(c, 40, [[0, 1], [0.3, 0.5], [1, 0]]);
    for (const [w, h] of [[60, 5], [5, 60]]) {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(64, 64, w, h, 0, 0, Math.PI * 2); c.fill();
    }
  }, (c) => radial(c, 22, [[0, 1], [1, 0]]));
  // 6 DROP: gota/brasas de borde suave
  cell(ctx, 2, 1, (c) => radial(c, 40, [[0, 1], [0.6, 0.95], [1, 0]]), (c) => radial(c, 20, [[0, 1], [1, 0]]));
  // 7 SMOKE2 (variante)
  cell(ctx, 3, 1, (c) => smoke(c, 91), (c) => smokeShade(c, 91));
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.premultiplyAlpha = false;
  atlas = tex;
  return tex;
}

// ------------------------------------------------------------ texto flotante
const popupCache = new Map();
export function getPopupTexture(text) {
  let e = popupCache.get(text);
  if (e) return e;
  const oneUp = /UP$/i.test(text);
  const fs = 84, pad = 22;
  const font = `900 ${fs}px "Arial Black", "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`;
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const tw = Math.ceil(m.measureText(text).width);
  const cv = document.createElement('canvas');
  cv.width = THREE.MathUtils.ceilPowerOfTwo(tw + pad * 2); cv.height = 128;
  const c = cv.getContext('2d');
  c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const cx = cv.width / 2, cy = 66;
  // sombra
  c.fillStyle = 'rgba(20,10,40,0.45)'; c.strokeStyle = 'rgba(20,10,40,0.45)'; c.lineWidth = 18;
  c.strokeText(text, cx + 3, cy + 6); c.fillText(text, cx + 3, cy + 6);
  // borde grueso
  c.strokeStyle = oneUp ? '#0f4a1c' : '#5a2a06'; c.lineWidth = 16; c.strokeText(text, cx, cy);
  c.strokeStyle = oneUp ? '#2f9a3a' : '#c4661a'; c.lineWidth = 8; c.strokeText(text, cx, cy);
  // relleno degradado
  const g = c.createLinearGradient(0, cy - fs * 0.45, 0, cy + fs * 0.45);
  if (oneUp) { g.addColorStop(0, '#f2ffe0'); g.addColorStop(0.45, '#9dff6a'); g.addColorStop(1, '#2ed04a'); }
  else { g.addColorStop(0, '#fffbe8'); g.addColorStop(0.45, '#ffe066'); g.addColorStop(1, '#ff9a1a'); }
  c.fillStyle = g; c.fillText(text, cx, cy);
  // brillo superior
  c.save(); c.beginPath(); c.rect(0, 0, cv.width, cy - fs * 0.08); c.clip();
  c.globalAlpha = 0.35; c.fillStyle = '#fff'; c.fillText(text, cx, cy); c.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 2;
  e = { tex, aspect: cv.width / cv.height, oneUp };
  popupCache.set(text, e);
  return e;
}
