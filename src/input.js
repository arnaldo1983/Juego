// Entrada unificada: teclado + mando + controles táctiles (ui/touch.js escribe en virtual).
export class Input {
  constructor() {
    this.keys = new Set();
    this.virtual = { left: false, right: false, down: false, up: false, jump: false, run: false };
    this.state = { left: false, right: false, down: false, up: false, jump: false, run: false, pause: false };
    this.prev = { ...this.state };
    this.pressedPause = false;
    this.anyKeyCallbacks = [];
    addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.anyKeyCallbacks.forEach((f) => f(e.code));
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  onAnyKey(f) { this.anyKeyCallbacks.push(f); }
  poll() {
    this.prev = { ...this.state };
    const k = this.keys, v = this.virtual;
    let gp = null;
    try { gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null; } catch { gp = null; }
    const ax = gp ? gp.axes[0] : 0;
    const b = (i) => !!(gp && gp.buttons[i] && gp.buttons[i].pressed);
    this.state.left = k.has('ArrowLeft') || k.has('KeyA') || v.left || ax < -0.4 || b(14);
    this.state.right = k.has('ArrowRight') || k.has('KeyD') || v.right || ax > 0.4 || b(15);
    this.state.down = k.has('ArrowDown') || k.has('KeyS') || v.down || b(13);
    this.state.up = k.has('ArrowUp') || k.has('KeyW') || v.up || b(12);
    this.state.jump = k.has('Space') || k.has('KeyZ') || k.has('KeyK') || k.has('ArrowUp') || k.has('KeyW') || v.jump || b(0);
    this.state.run = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyX') || k.has('KeyJ') || v.run || b(2) || b(1);
    this.state.pause = k.has('Escape') || k.has('KeyP') || k.has('Enter') || b(9);
  }
  pressed(name) { return this.state[name] && !this.prev[name]; }
}
