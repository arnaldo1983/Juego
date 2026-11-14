// Teoría musical mínima: notas, acordes y notación de pistas por pasos (semicorcheas).
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const acc = (a) => (a === '#' ? 1 : a === 'b' ? -1 : 0);

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function noteToMidi(s) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
  if (!m) return null;
  return 12 * (+m[3] + 1) + PC[m[1]] + acc(m[2]);
}
const pcOf = (s) => (((PC[s[0]] + acc(s[1])) % 12) + 12) % 12;

const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7], sus2: [0, 2, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], dim: [0, 3, 6],
  add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14],
};
const chordCache = new Map();
export function parseChord(s) {
  if (chordCache.has(s)) return chordCache.get(s);
  const m = /^([A-G][#b]?)(maj7|m7|m9|m6|m|7|sus4|sus2|6|add9|dim)?(?:\/([A-G][#b]?))?$/.exec(s);
  if (!m) throw new Error('acorde inválido: ' + s);
  const root = pcOf(m[1]);
  const ivs = QUAL[m[2] || ''];
  const c = { name: s, root, ivs, pcs: ivs.map((i) => (root + i) % 12), bass: m[3] ? pcOf(m[3]) : root };
  chordCache.set(s, c);
  return c;
}
/** Coloca la clase de altura pc en [lo, lo+12). */
export const place = (pc, lo) => lo + ((((pc - lo) % 12) + 12) % 12);

/** Voicing cerrado en una ventana fija → conducción de voces suave entre acordes. */
export function padVoicing(ch, lo = 55) {
  return [...new Set(ch.pcs)].map((pc) => place(pc, lo)).sort((a, b) => a - b);
}
export function arpTones(ch, lo = 60) {
  const r = place(ch.root, lo);
  return ch.ivs.filter((i) => i < 12).map((i) => r + i);
}
/** Nota del acorde más aguda al menos una tercera menor por debajo de m (armonía de 2ª voz). */
export function harmonyBelow(m, ch) {
  for (let x = m - 3; x > m - 12; x--) if (ch.pcs.includes(((x % 12) + 12) % 12)) return x;
  return m - 12;
}
/** "C5 - . E5" → eventos {step, midi, len}. '-' prolonga, '.' silencio, '|' se ignora. */
export function parseLine(str) {
  const toks = str.replace(/\|/g, ' ').trim().split(/\s+/);
  const ev = []; let cur = null;
  toks.forEach((t, i) => {
    if (t === '-') { if (cur) cur.len++; }
    else if (t === '.') cur = null;
    else {
      const midi = noteToMidi(t);
      if (midi == null) throw new Error('nota inválida: ' + t);
      cur = { step: i, midi, len: 1 }; ev.push(cur);
    }
  });
  return { ev, steps: toks.length };
}
