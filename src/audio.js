// PLACEHOLDER — audio procedural (WebAudio). Será reemplazado por el subagente de audio.
// sfx: jump, jumpBig, coin, bump, break, powerAppear, powerUp, powerDown, stomp, kick, fireball, fireHit,
//      die, oneUp, flag, clear, gameover, pause, star, checkpoint, hurry, tick, select
// música: 'title', 'pradera', 'cueva', 'cielo', 'castillo', 'star', 'clear', 'gameover', 'victory'
export const audio = {
  muted: false,
  unlock() {},
  sfx(name) {},
  playMusic(name, opts) {},
  stopMusic() {},
  setMusicRate(r) {},
  setMuted(m) { this.muted = m; },
};
