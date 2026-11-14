// Efectos de sonido sintetizados (FM, barridos de tono, ruido filtrado). Todo relativo a ctx.currentTime.
import { mtof } from './theory.js';

/** Tono con barrido de frecuencia y envolvente. */
function tone(E, dst, t, { type = 'sine', f0, f1 = f0, sweep = 0.1, a = 0.004, dur = 0.15, peak = 0.3, r = 0.06, s = 1, d = 0.1, detune = 0, curve = 'exp' }) {
  const g = E.gain(0, dst);
  const end = E.adsr(g, t, { a, d, s, r, peak, dur });
  const o = E.osc(type, f0, t, end, g, detune);
  if (f1 !== f0) {
    o.frequency.setValueAtTime(f0, t);
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    else o.frequency.linearRampToValueAtTime(f1, t + sweep);
  }
  E.cleanup(o, g);
  return o;
}
/** Ráfaga de ruido filtrado con barrido opcional del filtro. */
function noise(E, dst, t, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, dur = 0.1, peak = 0.3, sweep = dur, a = 0.002 }) {
  const g = E.gain(0, dst);
  const end = E.perc(g, t, peak, dur, a);
  const f = E.filter(type, f0, q, g);
  if (f1 !== f0) { f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + sweep); }
  const src = E.noise(t, end, f);
  E.cleanup(src, g, f);
}
/** Campana FM brillante. */
function bell(E, dst, t, f, { peak = 0.2, decay = 0.6, ratio = 2, index = 1.2, shimmer = 0.3 } = {}) {
  const g = E.gain(0, dst);
  const end = E.perc(g, t, peak, decay, 0.002);
  const car = E.osc('sine', f, t, end, g);
  const mi = E.ctx.createGain(); mi.gain.setValueAtTime(f * index, t); mi.gain.setTargetAtTime(0, t, decay / 5); mi.connect(car.frequency);
  E.osc('sine', f * ratio, t, end, mi);
  if (shimmer) { const h = E.gain(shimmer, g); E.osc('sine', f * 3, t, end, h, 6); }
  E.cleanup(car, g, mi);
}

const N = (m) => mtof(m);

export const SFX = {
  jump(E, o, t) {
    tone(E, o, t, { type: 'triangle', f0: 310, f1: 760, sweep: 0.13, dur: 0.09, r: 0.08, peak: 0.32 });
    tone(E, o, t, { type: 'square', f0: 310, f1: 760, sweep: 0.13, dur: 0.06, r: 0.06, peak: 0.045 });
    noise(E, o, t, { type: 'highpass', f0: 3000, dur: 0.05, peak: 0.04 });
  },
  jumpBig(E, o, t) {
    tone(E, o, t, { type: 'triangle', f0: 200, f1: 560, sweep: 0.16, dur: 0.12, r: 0.1, peak: 0.36 });
    tone(E, o, t, { type: 'square', f0: 200, f1: 560, sweep: 0.16, dur: 0.08, r: 0.08, peak: 0.04, detune: 8 });
    tone(E, o, t, { type: 'sine', f0: 100, f1: 200, sweep: 0.12, dur: 0.06, r: 0.08, peak: 0.25 });
    noise(E, o, t, { type: 'bandpass', f0: 900, f1: 2500, q: 0.8, dur: 0.12, peak: 0.05 });
  },
  coin(E, o, t) {
    bell(E, o, t, N(83), { peak: 0.16, decay: 0.12, ratio: 2, index: 0.9 });
    bell(E, o, t + 0.065, N(88), { peak: 0.2, decay: 0.55, ratio: 2, index: 0.8, shimmer: 0.35 });
    tone(E, o, t + 0.065, { type: 'sine', f0: N(100), dur: 0.02, r: 0.25, peak: 0.03 });
  },
  bump(E, o, t) {
    tone(E, o, t, { type: 'sine', f0: 170, f1: 70, sweep: 0.1, dur: 0.05, r: 0.1, peak: 0.5 });
    tone(E, o, t, { type: 'triangle', f0: 340, f1: 140, sweep: 0.06, dur: 0.02, r: 0.05, peak: 0.12 });
    noise(E, o, t, { type: 'lowpass', f0: 600, q: 0.7, dur: 0.07, peak: 0.25 });
  },
  break(E, o, t) {
    tone(E, o, t, { type: 'sine', f0: 120, f1: 42, sweep: 0.18, dur: 0.08, r: 0.18, peak: 0.6 });
    noise(E, o, t, { type: 'bandpass', f0: 3200, f1: 500, q: 0.9, dur: 0.28, peak: 0.42 });
    noise(E, o, t, { type: 'lowpass', f0: 900, q: 0.5, dur: 0.12, peak: 0.3 });
    for (let i = 0; i < 7; i++) { // crujido: granos de ruido aleatorios
      const dt = 0.02 + i * 0.028 + Math.random() * 0.02;
      noise(E, o, t + dt, { type: 'bandpass', f0: 1500 + Math.random() * 3500, q: 3, dur: 0.025 + Math.random() * 0.03, peak: 0.22 * (1 - i / 8) });
    }
  },
  powerAppear(E, o, t) {
    const g = E.gain(0, o); const end = E.adsr(g, t, { a: 0.03, s: 1, dur: 0.55, r: 0.15, peak: 0.16 });
    const osc = E.osc('triangle', 220, t, end, g); osc.frequency.setValueAtTime(220, t); osc.frequency.exponentialRampToValueAtTime(880, t + 0.6);
    const lg = E.gain(40); E.osc('sine', 14, t, end, lg); lg.connect(osc.frequency);
    const o2 = E.osc('sine', 440, t, end, E.gain(0.4, g)); o2.frequency.setValueAtTime(440, t); o2.frequency.exponentialRampToValueAtTime(1760, t + 0.6);
    E.cleanup(osc, g, lg);
  },
  powerUp(E, o, t) {
    const seq = [60, 64, 67, 72, 76, 79, 84, 88];
    seq.forEach((m, i) => {
      bell(E, o, t + i * 0.045, N(m + 7), { peak: 0.12, decay: 0.3 + i * 0.04, ratio: 2, index: 0.6, shimmer: 0.2 });
      tone(E, o, t + i * 0.045, { type: 'square', f0: N(m), dur: 0.03, r: 0.05, peak: 0.03 });
    });
    noise(E, o, t + 0.2, { type: 'highpass', f0: 6000, dur: 0.5, peak: 0.05, a: 0.2 });
  },
  powerDown(E, o, t) {
    const g = E.gain(0, o); const end = E.adsr(g, t, { a: 0.01, s: 1, dur: 0.6, r: 0.15, peak: 0.2 });
    const osc = E.osc('square', 660, t, end, E.filter('lowpass', 1800, 1, g));
    osc.frequency.setValueAtTime(660, t); osc.frequency.exponentialRampToValueAtTime(130, t + 0.7);
    const lg = E.gain(35); E.osc('sine', 9, t, end, lg); lg.connect(osc.frequency);
    E.cleanup(osc, g, lg);
  },
  stomp(E, o, t) {
    tone(E, o, t, { type: 'sine', f0: 520, f1: 110, sweep: 0.09, dur: 0.04, r: 0.08, peak: 0.45 });
    tone(E, o, t, { type: 'triangle', f0: 900, f1: 300, sweep: 0.05, dur: 0.02, r: 0.04, peak: 0.12 });
    noise(E, o, t, { type: 'lowpass', f0: 1200, f1: 300, q: 2, dur: 0.1, peak: 0.25 });
  },
  kick(E, o, t) {
    noise(E, o, t, { type: 'bandpass', f0: 1400, q: 1.2, dur: 0.06, peak: 0.4 });
    tone(E, o, t, { type: 'sine', f0: 320, f1: 90, sweep: 0.08, dur: 0.04, r: 0.08, peak: 0.45 });
    tone(E, o, t + 0.01, { type: 'triangle', f0: 1200, f1: 1800, sweep: 0.06, dur: 0.03, r: 0.05, peak: 0.07 });
  },
  fireball(E, o, t) {
    noise(E, o, t, { type: 'bandpass', f0: 2600, f1: 700, q: 1.5, dur: 0.18, peak: 0.3 });
    tone(E, o, t, { type: 'triangle', f0: 1100, f1: 380, sweep: 0.1, dur: 0.05, r: 0.06, peak: 0.12 });
  },
  fireHit(E, o, t) {
    noise(E, o, t, { type: 'highpass', f0: 2500, dur: 0.07, peak: 0.25 });
    tone(E, o, t, { type: 'sine', f0: 700, f1: 160, sweep: 0.07, dur: 0.03, r: 0.06, peak: 0.25 });
  },
  die(E, o, t) {
    tone(E, o, t, { type: 'triangle', f0: 520, f1: 880, sweep: 0.12, dur: 0.12, r: 0.05, peak: 0.25 });
    const seq = [76, 75, 74, 71, 70, 67, 64]; // descenso cromático/modal
    seq.forEach((m, i) => {
      const tt = t + 0.3 + i * 0.13;
      tone(E, o, tt, { type: 'triangle', f0: N(m), dur: 0.09, r: 0.08, peak: 0.22 });
      tone(E, o, tt, { type: 'square', f0: N(m), dur: 0.06, r: 0.06, peak: 0.03, detune: 6 });
    });
    tone(E, o, t + 0.3 + 7 * 0.13, { type: 'sine', f0: N(52), f1: N(40), sweep: 0.5, dur: 0.3, r: 0.3, peak: 0.3 });
  },
  oneUp(E, o, t) {
    [72, 79, 84, 88, 91, 96].forEach((m, i) => bell(E, o, t + i * 0.07, N(m), { peak: 0.13, decay: 0.5 + i * 0.08, ratio: 2, index: 0.7, shimmer: 0.3 }));
    tone(E, o, t + 0.42, { type: 'triangle', f0: N(84), dur: 0.3, r: 0.4, peak: 0.08 });
  },
  flag(E, o, t) {
    // glissando por la escala mayor descendente, brillante
    const sc = [0, 2, 4, 5, 7, 9, 11];
    for (let i = 0; i < 18; i++) {
      const deg = 17 - i, m = 67 + 12 * Math.floor(deg / 7) + sc[deg % 7] - 12;
      bell(E, o, t + i * 0.045, N(m + 12), { peak: 0.08, decay: 0.35, ratio: 2, index: 0.5, shimmer: 0 });
    }
    tone(E, o, t, { type: 'sine', f0: 1400, f1: 300, sweep: 0.8, dur: 0.75, r: 0.1, peak: 0.04 });
  },
  clear(E, o, t) {
    [60, 64, 67, 72].forEach((m) => bell(E, o, t, N(m + 12), { peak: 0.09, decay: 1.2, ratio: 2, index: 0.5 }));
  },
  gameover(E, o, t) {
    [64, 60, 57].forEach((m, i) => tone(E, o, t + i * 0.3, { type: 'triangle', f0: N(m), dur: 0.25, r: 0.3, peak: 0.2 }));
  },
  pause(E, o, t) {
    bell(E, o, t, N(88), { peak: 0.1, decay: 0.15, ratio: 2, index: 0.5, shimmer: 0 });
    bell(E, o, t + 0.08, N(83), { peak: 0.1, decay: 0.3, ratio: 2, index: 0.5, shimmer: 0 });
  },
  star(E, o, t) {
    const sc = [0, 4, 7, 11, 14];
    for (let i = 0; i < 12; i++) bell(E, o, t + i * 0.04, N(84 + sc[(i * 3) % 5] + (i > 6 ? 12 : 0)), { peak: 0.07, decay: 0.4, ratio: 3, index: 0.5, shimmer: 0 });
    noise(E, o, t, { type: 'highpass', f0: 5000, f1: 9000, dur: 0.6, peak: 0.06, a: 0.05 });
  },
  checkpoint(E, o, t) {
    bell(E, o, t, N(79), { peak: 0.15, decay: 0.4, ratio: 2, index: 1 });
    bell(E, o, t + 0.1, N(86), { peak: 0.15, decay: 0.5, ratio: 2, index: 1 });
    bell(E, o, t + 0.2, N(91), { peak: 0.15, decay: 1.0, ratio: 2, index: 0.8, shimmer: 0.4 });
  },
  hurry(E, o, t) {
    for (let r = 0; r < 2; r++) [76, 79, 83].forEach((m, i) => {
      const tt = t + r * 0.42 + i * 0.09;
      tone(E, o, tt, { type: 'square', f0: N(m), dur: 0.06, r: 0.04, peak: 0.07 });
      tone(E, o, tt, { type: 'triangle', f0: N(m + 12), dur: 0.06, r: 0.05, peak: 0.1 });
    });
  },
  tick(E, o, t) { tone(E, o, t, { type: 'sine', f0: 2200, f1: 1800, sweep: 0.02, dur: 0.008, r: 0.025, peak: 0.08 }); },
  select(E, o, t) {
    tone(E, o, t, { type: 'sine', f0: 880, f1: 1320, sweep: 0.05, dur: 0.05, r: 0.08, peak: 0.18 });
    bell(E, o, t + 0.04, N(88), { peak: 0.08, decay: 0.3, ratio: 2, index: 0.6, shimmer: 0 });
  },
  land(E, o, t) {
    noise(E, o, t, { type: 'lowpass', f0: 500, q: 0.6, dur: 0.06, peak: 0.16 });
    tone(E, o, t, { type: 'sine', f0: 130, f1: 60, sweep: 0.06, dur: 0.02, r: 0.05, peak: 0.18 });
  },
};
