// Audio procedural con WebAudio: efectos sintetizados y música original secuenciada (sin archivos).
// API: audio.unlock(), sfx(name), playMusic(name, {resume}), stopMusic(), setMusicRate(r), setMuted(m), muted
// sfx: jump, jumpBig, coin, bump, break, powerAppear, powerUp, powerDown, stomp, kick, fireball, fireHit,
//      die, oneUp, flag, clear, gameover, pause, star, checkpoint, hurry, tick, select, land
// música: 'title', 'pradera', 'cueva', 'cielo', 'castillo', 'star', 'clear', 'gameover', 'victory'
import { createEngine } from './audio/engine.js';
import { Sequencer } from './audio/sequencer.js';
import { SONGS } from './audio/songs.js';
import { SFX } from './audio/sfx.js';

const KEY = 'kiko.muted';
const LEVEL_THEMES = new Set(['pradera', 'cueva', 'cielo', 'castillo', 'title', 'victory']);
// Intervalo mínimo entre repeticiones del mismo efecto (evita saturar con monedas/ticks en ráfaga).
const COOLDOWN = { tick: 0.045, coin: 0.035, land: 0.08, bump: 0.05, stomp: 0.03, kick: 0.03, fireHit: 0.04 };

function loadMuted() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
function saveMuted(m) { try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* sin almacenamiento */ } }

export const audio = {
  muted: loadMuted(),
  ctx: null,
  E: null,
  seq: null,
  _want: null,        // música solicitada antes de desbloquear
  _saved: {},         // posición guardada de cada tema de nivel (para {resume})
  _last: {},
  _ducked: false,

  _init() {
    if (this.ctx) return true;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { try { this.ctx = new AC(); } catch { return false; } }
    this.E = createEngine(this.ctx);
    this.seq = new Sequencer(this.E);
    this.E.master.gain.value = this.muted ? 0 : 0.85;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else if (this._unlocked) this.ctx.resume().catch(() => {});
    });
    return true;
  },

  /** Llamar desde un gesto del usuario: crea/reanuda el AudioContext (iOS: buffer vacío). */
  unlock() {
    if (!this._init()) return;
    const ctx = this.ctx;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!this._unlocked) {
      try {
        const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
      } catch { /* nada */ }
      this._unlocked = true;
    }
    if (this._want) { const w = this._want; this._want = null; this.playMusic(w.name, w.opts); }
  },

  sfx(name) {
    if (name === 'pause' && this._ducked) this._duck(false);
    if (!this.ctx || !this._unlocked) return;
    const fn = SFX[name]; if (!fn) return;
    const t = this.ctx.currentTime;
    const cd = COOLDOWN[name];
    if (cd && t - (this._last[name] ?? -1) < cd) return;
    this._last[name] = t;
    try { fn(this.E, this.E.sfxIn, t + 0.005); } catch (e) { console.debug('sfx', name, e); }
  },

  playMusic(name, opts = {}) {
    const song = SONGS[name]; if (!song) return;
    if (!this.ctx || !this._unlocked) { this._want = { name, opts }; return; }
    if (this._ducked) this._duck(false);
    const seq = this.seq;
    if (seq.playing && seq.name === name && !opts.resume) return;
    // guarda la posición del tema que suena para poder reanudarlo (p. ej. tras la estrella)
    if (seq.song && seq.song.loop && LEVEL_THEMES.has(seq.name)) this._saved[seq.name] = seq.step;
    let start = 0;
    if (opts.resume && this._saved[name] != null) start = this._saved[name];
    else delete this._saved[name];
    seq.play(name, song, start);
  },

  stopMusic() {
    this._want = null;
    if (!this.seq) return;
    this.seq.stop(0.12);
    this.seq.rate = 1;
    this._saved = {};
  },

  /** Multiplica el tempo de la música en bucle (prisa por tiempo). */
  setMusicRate(r) { if (this.seq) this.seq.rate = Math.max(0.5, Math.min(2, r || 1)); },

  /** setMuted(m, pausa): con el 2º argumento a true baja la música mientras el juego está en pausa. */
  setMuted(m, pausing = false) {
    this.muted = !!m; saveMuted(this.muted);
    if (pausing) this._duck(true);
    if (this.E) {
      const g = this.E.master.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t); g.setTargetAtTime(this.muted ? 0 : 0.85, t, 0.03);
    }
  },

  _duck(on) {
    this._ducked = on;
    if (!this.E) return;
    const g = this.E.musicBus.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(on ? 0.62 * 0.3 : 0.62, t, 0.08);
  },
};

// Desbloqueo automático en el primer gesto (además de la llamada explícita del juego).
if (typeof window !== 'undefined') {
  const ev = ['pointerdown', 'touchend', 'keydown', 'mousedown'];
  const once = () => { audio.unlock(); if (audio.ctx && audio.ctx.state === 'running') ev.forEach((e) => window.removeEventListener(e, once, true)); };
  ev.forEach((e) => window.addEventListener(e, once, true));
}
