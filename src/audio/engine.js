// Motor WebAudio: cadena maestra (compresor + limitador), reverb por convolución con IR generada,
// delay con realimentación filtrada, grupos de canales para la música y utilidades de síntesis.
import { mtof } from './theory.js';

function makeIR(ctx, seconds = 2.4, decay = 3.2) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds), pre = Math.floor(sr * 0.012);
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / (len - pre);
      // ruido que se oscurece con el tiempo (paso bajo de un polo cada vez más cerrado)
      const k = 0.85 - 0.75 * x;
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - x, decay) * (i - pre < sr * 0.004 ? (i - pre) / (sr * 0.004) : 1);
    }
  }
  return buf;
}

export function createEngine(ctx) {
  const E = { ctx };
  const now = () => ctx.currentTime;

  // ---- cadena maestra ----
  const master = ctx.createGain(); master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  const out = ctx.createGain(); out.gain.value = 0.72;
  master.connect(comp); comp.connect(lim); lim.connect(out); out.connect(ctx.destination);
  E.master = master; E.out = out;

  E.musicBus = ctx.createGain(); E.musicBus.gain.value = 0.62; E.musicBus.connect(master);
  E.sfxBus = ctx.createGain(); E.sfxBus.gain.value = 0.8; E.sfxBus.connect(master);

  // ---- reverb ----
  E.revIn = ctx.createGain();
  const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = makeIR(ctx);
  const revHP = ctx.createBiquadFilter(); revHP.type = 'highpass'; revHP.frequency.value = 180;
  const revOut = ctx.createGain(); revOut.gain.value = 0.55;
  E.revIn.connect(revHP); revHP.connect(conv); conv.connect(revOut); revOut.connect(master);

  // ---- delay (eco) ----
  E.dlyIn = ctx.createGain();
  const dly = ctx.createDelay(2); dly.delayTime.value = 0.36;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
  const dOut = ctx.createGain(); dOut.gain.value = 0.6;
  E.dlyIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly);
  dlp.connect(dOut); dOut.connect(master); dOut.connect(E.revIn);
  E.setDelay = (time, feedback = 0.38) => {
    dly.delayTime.setTargetAtTime(Math.min(1.9, time), now(), 0.05);
    fb.gain.setTargetAtTime(feedback, now(), 0.05);
  };

  // ---- ruido blanco compartido ----
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  E.noiseBuf = nb;

  // ---- canal de efectos ----
  const sfxRev = ctx.createGain(); sfxRev.gain.value = 0.16;
  E.sfxIn = ctx.createGain(); E.sfxIn.connect(E.sfxBus); E.sfxIn.connect(sfxRev); sfxRev.connect(E.revIn);

  /** Grupo de canales para una canción (se funde y se desconecta al cambiar de tema). */
  E.makeGroup = (mix) => {
    const g = { out: ctx.createGain(), rev: ctx.createGain(), dly: ctx.createGain(), ch: {} };
    g.out.gain.value = 0; g.rev.gain.value = 0; g.dly.gain.value = 0;
    g.out.connect(E.musicBus); g.rev.connect(E.revIn); g.dly.connect(E.dlyIn);
    for (const [name, [gain, pan = 0, rev = 0, dl = 0]] of Object.entries(mix)) {
      const inp = ctx.createGain(); inp.gain.value = gain;
      let node = inp;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; inp.connect(p); node = p; }
      node.connect(g.out);
      if (rev) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s); s.connect(g.rev); }
      if (dl) { const s = ctx.createGain(); s.gain.value = dl; node.connect(s); s.connect(g.dly); }
      g.ch[name] = inp;
    }
    g.fade = (target, t, tc = 0.02) => { for (const n of [g.out, g.rev, g.dly]) { n.gain.cancelScheduledValues(t); n.gain.setTargetAtTime(target, t, tc); } };
    g.kill = (t) => {
      g.fade(0, t, 0.06);
      setTimeout(() => { for (const n of [g.out, g.rev, g.dly]) n.disconnect(); }, 1500);
    };
    return g;
  };

  // ---- utilidades de síntesis ----
  E.osc = (type, f, t, end, dst, detune = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    o.connect(dst); o.start(t); o.stop(end); return o;
  };
  E.noise = (t, end, dst) => {
    const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
    s.connect(dst); s.start(t, Math.random() * 1.5); s.stop(end); return s;
  };
  E.gain = (v, dst) => { const g = ctx.createGain(); g.gain.value = v; if (dst) g.connect(dst); return g; };
  E.filter = (type, f, q, dst) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (dst) b.connect(dst); return b; };
  /** Envolvente ADSR sobre un GainNode. Devuelve el instante en que la voz es inaudible. */
  E.adsr = (g, t, { a = 0.005, d = 0.1, s = 0.7, r = 0.1, peak = 1, dur = 0.2 }) => {
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (s < 1) p.setTargetAtTime(peak * s, t + a, d / 3);
    const rel = Math.max(t + a, t + dur);
    p.setTargetAtTime(0, rel, r / 3);
    return rel + r * 1.6 + 0.02;
  };
  /** Decaimiento percusivo exponencial. */
  E.perc = (g, t, peak, decay, a = 0.002) => {
    const p = g.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(0, t + a, decay / 4.6);
    return t + a + decay * 1.1 + 0.02;
  };
  E.cleanup = (src, ...nodes) => { src.onended = () => { for (const n of nodes) n.disconnect(); }; };
  E.mtof = mtof;
  return E;
}
