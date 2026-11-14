// PLACEHOLDER — HUD y menús (DOM). Será reemplazado por el subagente de UI.
export class Hud {
  constructor(root) {
    this.root = root;
    this.bar = document.createElement('div');
    this.bar.style.cssText = 'position:absolute;top:8px;left:0;right:0;display:flex;justify-content:space-around;font:bold 18px monospace;text-shadow:0 2px 0 #000';
    root.appendChild(this.bar);
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,.6);font:bold 28px sans-serif;pointer-events:auto';
    root.appendChild(this.overlay);
  }
  /** stats = { score, coins, world, time, lives, levelName } */
  update(s) { this.bar.textContent = `PUNTOS ${s.score}  MONEDAS ${s.coins}  MUNDO ${s.world}  TIEMPO ${Math.ceil(s.time)}  VIDAS ${s.lives}`; }
  setVisible(v) { this.bar.style.display = v ? 'flex' : 'none'; }
  _show(html, onClick) { this.overlay.innerHTML = html; this.overlay.style.display = 'flex'; this.overlay.onclick = onClick ? () => onClick() : null; }
  hide() { this.overlay.style.display = 'none'; this.overlay.onclick = null; }
  /** Pantalla de título. onStart() al tocar/pulsar. */
  title(onStart) { this._show('<div>Kiko y las Estrellas Perdidas</div><div style="font-size:16px">Toca o pulsa Enter</div>', onStart); }
  /** Intro de nivel. */
  levelIntro(world, name, lives) { this._show(`<div>MUNDO ${world}</div><div>${name}</div><div>x ${lives}</div>`); }
  pause(show, onResume) { show ? this._show('<div>PAUSA</div>', onResume) : this.hide(); }
  gameOver(onRetry) { this._show('<div>FIN DEL JUEGO</div>', onRetry); }
  levelClear(stats) { this._show(`<div>¡NIVEL SUPERADO!</div>`); }
  victory(stats, onRestart) { this._show('<div>¡VICTORIA!</div>', onRestart); }
  toast(text) {}
  hurry() {}
}
