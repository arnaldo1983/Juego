// Instrumentos sintetizados para la música. Cada voz se crea por nota y se libera sola.
import { mtof } from './theory.js';

function vibrato(E, oscs, t, end, rate = 5.4, cents = 11, delay = 0.18) {
  const ctx = E.ctx;
  const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
  const depth = ctx.createGain(); depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(cents, t + delay + 0.25);
  lfo.connect(depth); for (const o of oscs) depth.connect(o.detune);
  lfo.start(t); lfo.stop(end);
}

export const INST = {
  // Bajo: sierra + sub senoidal, filtro con envolvente (pegada redonda).
  bass(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const lp = E.filter('lowpass', 1400, 5, vca);
    lp.frequency.setValueAtTime(380 + 1500 * v, t); lp.frequency.setTargetAtTime(300, t + 0.005, 0.07);
    const end = E.adsr(vca, t, { a: 0.004, d: 0.18, s: 0.7, r: 0.06, peak: 0.3 * v, dur });
    E.osc('sawtooth', f, t, end, lp);
    const sub = E.gain(0.9, vca); const o = E.osc('sine', f, t, end, sub);
    E.cleanup(o, vca, lp, sub);
  },
  // Sub grave suave (cueva, cielo).
  sub(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const end = E.adsr(vca, t, { a: 0.03, d: 0.4, s: 0.8, r: 0.25, peak: 0.42 * v, dur });
    E.osc('sine', f, t, end, vca);
    const tri = E.gain(0.22, vca); const lp = E.filter('lowpass', 700, 0.5, tri);
    const o = E.osc('triangle', f * 2, t, end, lp);
    E.cleanup(o, vca, tri, lp);
  },
  // Pad de cuerdas: 3 sierras desafinadas, filtro cálido, ataque lento.
  pad(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const lp = E.filter('lowpass', 1100, 0.6, vca);
    lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1500, t + Math.min(dur, 1.2));
    const end = E.adsr(vca, t, { a: 0.28, d: 0.5, s: 0.85, r: 0.55, peak: 0.055 * v, dur });
    let o; for (const dt of [-9, 0, 9]) o = E.osc('sawtooth', f, t, end, lp, dt);
    E.cleanup(o, vca, lp);
  },
  // Pad aéreo: triángulos + octava, muy suave (cielo, cueva).
  air(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const end = E.adsr(vca, t, { a: 0.7, d: 0.8, s: 0.9, r: 1.1, peak: 0.075 * v, dur });
    E.osc('triangle', f, t, end, vca, -6);
    E.osc('triangle', f, t, end, vca, 6);
    const hi = E.gain(0.25, vca); const o = E.osc('sine', f * 2, t, end, hi, 3);
    E.cleanup(o, vca, hi);
  },
  // Acorde staccato (órgano/guitarra rítmica) para la pradera.
  stab(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const lp = E.filter('lowpass', 2400, 1, vca);
    lp.frequency.setValueAtTime(3200, t); lp.frequency.setTargetAtTime(900, t, 0.06);
    const end = E.perc(vca, t, 0.07 * v, 0.22);
    E.osc('square', f, t, end, lp);
    const o = E.osc('triangle', f * 2, t, end, lp, 4);
    E.cleanup(o, vca, lp);
  },
  // Pluck: triángulo + pulso suave con filtro que se cierra.
  pluck(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const lp = E.filter('lowpass', 4000, 2, vca);
    lp.frequency.setValueAtTime(4500, t); lp.frequency.setTargetAtTime(700, t, 0.08);
    const end = E.perc(vca, t, 0.12 * v, 0.38);
    E.osc('triangle', f, t, end, lp);
    const sq = E.gain(0.3, lp); const o = E.osc('square', f, t, end, sq, 5);
    E.cleanup(o, vca, lp, sq);
  },
  // Arpa: triángulo con brillo del 2º armónico.
  harp(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const end = E.perc(vca, t, 0.1 * v, 0.9);
    E.osc('triangle', f, t, end, vca);
    const h = E.gain(0.18, vca); const o = E.osc('sine', f * 2, t, end, h);
    E.cleanup(o, vca, h);
  },
  // Lead principal: cuadrada filtrada + triángulo, vibrato retardado.
  lead(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const lp = E.filter('lowpass', 2600, 1.2, vca);
    lp.frequency.setValueAtTime(3800, t); lp.frequency.setTargetAtTime(2200, t, 0.1);
    const end = E.adsr(vca, t, { a: 0.008, d: 0.18, s: 0.62, r: 0.09, peak: 0.12 * v, dur });
    const sq = E.gain(0.55, lp);
    const o1 = E.osc('square', f, t, end, sq);
    const o2 = E.osc('triangle', f, t, end, lp, 3);
    if (dur > 0.2) vibrato(E, [o1, o2], t, end);
    E.cleanup(o2, vca, lp, sq);
  },
  // Lead brillante y rápido (estrella).
  bright(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const lp = E.filter('lowpass', 4200, 1, vca);
    const end = E.adsr(vca, t, { a: 0.004, d: 0.12, s: 0.55, r: 0.06, peak: 0.1 * v, dur });
    const o1 = E.osc('square', f, t, end, lp, -5);
    const o2 = E.osc('sawtooth', f, t, end, E.gain(0.35, lp), 5);
    if (dur > 0.25) vibrato(E, [o1, o2], t, end, 6, 14, 0.12);
    E.cleanup(o1, vca, lp);
  },
  // Metales: dos sierras desafinadas, filtro que se abre (swell), vibrato.
  brass(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const lp = E.filter('lowpass', 600, 1.5, vca);
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2900 * (0.7 + 0.3 * v), t + 0.07);
    lp.frequency.setTargetAtTime(1700, t + 0.07, 0.25);
    const end = E.adsr(vca, t, { a: 0.035, d: 0.3, s: 0.78, r: 0.13, peak: 0.105 * v, dur });
    const o1 = E.osc('sawtooth', f, t, end, lp, -7);
    const o2 = E.osc('sawtooth', f, t, end, lp, 7);
    if (dur > 0.25) vibrato(E, [o1, o2], t, end, 5, 9, 0.25);
    E.cleanup(o2, vca, lp);
  },
  // Campana FM (relación inarmónica 3.5), cola larga.
  bell(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const end = E.perc(vca, t, 0.13 * v, Math.max(1.6, dur * 1.2), 0.003);
    const car = E.osc('sine', f, t, end, vca);
    const mi = E.ctx.createGain(); mi.gain.setValueAtTime(f * 2.2, t); mi.gain.setTargetAtTime(f * 0.15, t, 0.25); mi.connect(car.frequency);
    E.osc('sine', f * 3.5, t, end, mi);
    const h = E.gain(0.22, vca); E.osc('sine', f * 2, t, end, h);
    E.cleanup(car, vca, mi, h);
  },
  // Marimba FM (relación 4, índice muy breve).
  marimba(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const end = E.perc(vca, t, 0.2 * v, 0.7, 0.002);
    const car = E.osc('sine', f, t, end, vca);
    const mi = E.ctx.createGain(); mi.gain.setValueAtTime(f * 1.6, t); mi.gain.setTargetAtTime(0, t, 0.025); mi.connect(car.frequency);
    E.osc('sine', f * 4, t, end, mi);
    E.cleanup(car, vca, mi);
  },
  // Flauta: seno + triángulo con soplo de ruido y vibrato.
  flute(E, dst, t, m, dur, v) {
    const f = mtof(m);
    const vca = E.gain(0, dst);
    const end = E.adsr(vca, t, { a: 0.07, d: 0.3, s: 0.8, r: 0.25, peak: 0.15 * v, dur });
    const o1 = E.osc('sine', f, t, end, vca);
    const o2 = E.osc('triangle', f, t, end, E.gain(0.3, vca));
    const br = E.gain(0.05, vca); const bp = E.filter('bandpass', f * 2, 2, br); E.noise(t, end, bp);
    vibrato(E, [o1, o2], t, end, 5, 12, 0.2);
    E.cleanup(o1, vca, br, bp);
  },
};

// ---- percusión ----
export const DRUM = {
  kick(E, dst, t, v) {
    const vca = E.gain(0, dst);
    const end = E.perc(vca, t, 0.85 * v, 0.42);
    const o = E.osc('sine', 150, t, end, vca);
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    const c = E.gain(0, dst); E.perc(c, t, 0.12 * v, 0.012);
    const hp = E.filter('highpass', 1500, 0.7, c); E.noise(t, t + 0.03, hp);
    E.cleanup(o, vca, c, hp);
  },
  snare(E, dst, t, v) {
    const n = E.gain(0, dst); const end = E.perc(n, t, 0.3 * v, 0.2);
    const bp = E.filter('bandpass', 2000, 0.7, n); const hp = E.filter('highpass', 700, 0.5, bp);
    const src = E.noise(t, end, hp);
    const b = E.gain(0, dst); E.perc(b, t, 0.28 * v, 0.1);
    const o = E.osc('triangle', 200, t, t + 0.15, b); o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    E.cleanup(src, n, bp, hp); E.cleanup(o, b);
  },
  hat(E, dst, t, v, open = false) {
    const g = E.gain(0, dst); const end = E.perc(g, t, (open ? 0.07 : 0.085) * v, open ? 0.28 : 0.045, 0.001);
    const hp = E.filter('highpass', 7800, 0.8, g);
    const src = E.noise(t, end, hp); E.cleanup(src, g, hp);
  },
  rim(E, dst, t, v) {
    const g = E.gain(0, dst); const end = E.perc(g, t, 0.18 * v, 0.035, 0.001);
    const bp = E.filter('bandpass', 2700, 4, g); const src = E.noise(t, end, bp);
    const o = E.osc('sine', 820, t, end, E.gain(0.5, g));
    E.cleanup(src, g, bp); void o;
  },
  shaker(E, dst, t, v) {
    const g = E.gain(0, dst); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.02); g.gain.setTargetAtTime(0, t + 0.025, 0.02);
    const bp = E.filter('bandpass', 6500, 1.5, g); const src = E.noise(t, t + 0.15, bp); E.cleanup(src, g, bp);
  },
  tom(E, dst, t, v, m = 45) {
    const f = mtof(m);
    const g = E.gain(0, dst); const end = E.perc(g, t, 0.5 * v, 0.38);
    const o = E.osc('sine', f * 1.5, t, end, g); o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const n = E.gain(0, dst); E.perc(n, t, 0.06 * v, 0.05); const lp = E.filter('lowpass', 1800, 0.5, n); E.noise(t, t + 0.06, lp);
    E.cleanup(o, g, n, lp);
  },
  crash(E, dst, t, v) {
    const g = E.gain(0, dst); const end = E.perc(g, t, 0.08 * v, 1.6, 0.002);
    const hp = E.filter('highpass', 4200, 0.4, g); const pk = E.filter('peaking', 8000, 1, hp); pk.gain.value = 4;
    const src = E.noise(t, end, pk); E.cleanup(src, g, hp, pk);
  },
};
