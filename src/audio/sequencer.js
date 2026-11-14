// Compilador de canciones a eventos por paso + secuenciador con lookahead
// (setTimeout para despertar, AudioContext.currentTime para la precisión).
import { parseChord, parseLine, padVoicing, arpTones, harmonyBelow, place } from './theory.js';
import { INST, DRUM } from './instruments.js';

const VEL = { x: 0.85, X: 1.1, s: 0.45, o: 0.8 };
const TOMS = [52, 48, 45, 41];

const cache = new Map();
export function compile(name, song) {
  if (cache.has(name)) return cache.get(name);
  const steps = []; const push = (s, e) => (steps[s] || (steps[s] = [])).push(e);
  const sectionStart = {};
  let base = 0;
  for (const key of song.order) {
    const isVar = key.endsWith('*');
    const sec = song.sections[key.replace('*', '')];
    const bars = sec.ch.length, n = bars * 16;
    if (!isVar && !(key in sectionStart)) sectionStart[key] = base;
    const chordAt = new Array(n);
    // acordes → pad
    sec.ch.forEach((cs, b) => {
      const parts = cs.trim().split(/\s+/), len = 16 / parts.length;
      parts.forEach((p, j) => {
        const ch = parseChord(p), s0 = b * 16 + j * len;
        for (let k = 0; k < len; k++) chordAt[s0 + k] = ch;
        const voicing = padVoicing(ch, song.padLo || 55);
        if (song.padPat) {
          for (let k = 0; k < len; k++) if (song.padPat[(j * len + k) % 16] === 'x') for (const m of voicing) push(base + s0 + k, { i: song.inst.pad, c: 'pad', m, d: 1.5, v: 1 });
        } else for (const m of voicing) push(base + s0, { i: song.inst.pad, c: 'pad', m, d: len, v: 1 });
      });
    });
    // bajo
    for (let b = 0; b < bars; b++) {
      const pat = Array.isArray(sec.bassPat) ? sec.bassPat[b] : (sec.bassPat || song.bassPat);
      for (let k = 0; k < 16; k++) {
        const c = pat[k]; if (c === '-' || c === '.') continue;
        let len = 1; while (k + len < 16 && pat[k + len] === '-') len++;
        const ch = chordAt[b * 16 + k];
        const root = place(ch.bass, 36);
        const m = c === '5' ? place((ch.root + 7) % 12, root) : c === '3' ? place(ch.pcs[1], root) : c === 'O' ? place(ch.root, 36) + 12 : root;
        push(base + b * 16 + k, { i: song.inst.bass, c: 'bass', m, d: len * (len > 2 ? 0.95 : 0.75), v: k % 4 === 0 ? 1 : 0.8 });
      }
    }
    // melodía (+ segunda voz en la variación)
    for (const e of parseLine(sec.mel).ev) {
      const v = e.step % 4 === 0 ? 1 : 0.85;
      push(base + e.step, { i: song.inst.lead, c: 'lead', m: e.midi, d: e.len * 0.92, v });
      if ((isVar || song.harmAlways) && song.mix.harm) push(base + e.step, { i: song.inst.lead, c: 'harm', m: harmonyBelow(e.midi, chordAt[e.step]), d: e.len * 0.92, v: v * 0.9 });
    }
    // arpegio
    if (song.inst.arp && (song.arpWhen === 'always' || isVar)) {
      for (let s = 0; s < n; s++) {
        const c = song.arpPat[s % 16]; if (c === '.') continue;
        const tones = arpTones(chordAt[s], song.arpOct || 60), idx = +c;
        push(base + s, { i: song.inst.arp, c: 'arp', m: tones[idx % tones.length] + 12 * Math.floor(idx / tones.length), d: 2, v: s % 4 === 0 ? 0.95 : 0.75 });
      }
    }
    // percusión
    for (let b = 0; b < bars; b++) {
      const pat = sec.drums ? sec.drums[b] : (isVar && song.drumsVar) || song.drums;
      if (!pat) continue;
      const lastBar = b === bars - 1 && !sec.drums;
      for (let k = 0; k < 16; k++) {
        const s = base + b * 16 + k;
        const ch = (p) => (p && p[k] !== '.' ? p[k] : null);
        let x;
        if ((x = ch(pat.k))) push(s, { dr: 'kick', v: VEL[x] || 0.85 });
        if (lastBar && song.fill === 'toms' && k >= 12) { push(s, { dr: 'tom', v: 0.9, m: TOMS[k - 12] }); continue; }
        if (lastBar && song.fill === 'snare' && k >= 12) { push(s, { dr: 'snare', v: 0.4 + (k - 12) * 0.2 }); continue; }
        if ((x = ch(pat.s))) push(s, { dr: 'snare', v: VEL[x] || 0.85 });
        if ((x = ch(pat.r))) push(s, { dr: 'rim', v: VEL[x] || 0.85 });
        if ((x = ch(pat.sh))) push(s, { dr: 'shaker', v: x === 's' ? 0.7 : 1 });
        if ((x = ch(pat.c))) push(s, { dr: 'crash', v: 1 });
        if ((x = ch(pat.o))) push(s, { dr: 'hat', v: 0.8, open: true });
        else if ((x = ch(pat.h))) push(s, { dr: 'hat', v: VEL[x] || 0.85 });
      }
      if (b === 0 && song.crash) push(base, { dr: 'crash', v: 1 });
    }
    base += n;
  }
  const res = { steps, total: base, sectionStart };
  cache.set(name, res);
  return res;
}

/** Programa en el contexto todos los eventos de un paso. */
export function scheduleStep(E, group, ev, t, stepDur) {
  if (!ev) return;
  for (const e of ev) {
    const dst = group.ch[e.dr ? 'drums' : e.c] || group.ch.lead;
    if (e.dr) DRUM[e.dr](E, dst, t, e.v, e.open ?? e.m);
    else INST[e.i](E, dst, t, e.m, e.d * stepDur, e.v);
  }
}

export class Sequencer {
  constructor(E) { this.E = E; this.rate = 1; this.timer = 0; this.song = null; this.group = null; this.onEnd = null; }
  get stepDur() { return 60 / (this.song.bpm * this.rate) / 4; }
  play(name, song, startStep = 0) {
    this.stop(0.05);
    const E = this.E, ctx = E.ctx;
    this.name = name; this.song = song; this.comp = compile(name, song);
    this.step = startStep % this.comp.total; this.ended = false;
    this.group = E.makeGroup(song.mix);
    if (song.delay) E.setDelay(song.delay * 60 / song.bpm / 4, song.delayFb ?? 0.36);
    const t0 = ctx.currentTime + 0.06;
    this.group.fade(song.gain ?? 1, t0 - 0.02, 0.01);
    this.nextTime = t0;
    this._tick();
  }
  stop(fade = 0.08) {
    clearTimeout(this.timer); this.timer = 0;
    if (this.group) { this.group.kill(this.E.ctx.currentTime + Math.max(0, fade - 0.06)); this.group = null; }
    this.song = null;
  }
  get playing() { return !!this.song && !this.ended; }
  _tick() {
    if (!this.song) return;
    const ctx = this.E.ctx, ahead = 0.16;
    if (this.nextTime < ctx.currentTime - 0.25) this.nextTime = ctx.currentTime + 0.03; // tras suspensión
    while (this.nextTime < ctx.currentTime + ahead) {
      if (this.step >= this.comp.total) {
        if (this.song.loop) this.step = 0;
        else { this.ended = true; return; }
      }
      const rate = this.song.loop ? this.rate : 1;
      const sd = 60 / (this.song.bpm * rate) / 4;
      scheduleStep(this.E, this.group, this.comp.steps[this.step], this.nextTime, sd);
      this.nextTime += sd; this.step++;
    }
    this.timer = setTimeout(() => this._tick(), 25);
  }
  /** Renderizado síncrono (para OfflineAudioContext). */
  renderAll(name, song, seconds, startStep = 0) {
    this.name = name; this.song = song; this.comp = compile(name, song);
    this.group = this.E.makeGroup(song.mix); this.group.fade(song.gain ?? 1, 0, 0.001);
    if (song.delay) this.E.setDelay(song.delay * 60 / song.bpm / 4, song.delayFb ?? 0.36);
    let t = 0.02, step = startStep; const sd = 60 / song.bpm / 4;
    while (t < seconds) {
      if (step >= this.comp.total) { if (!song.loop) break; step = 0; }
      scheduleStep(this.E, this.group, this.comp.steps[step], t, sd);
      t += sd; step++;
    }
  }
}
