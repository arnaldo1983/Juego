// PLACEHOLDER — controles táctiles. Será reemplazado por el subagente de UI móvil.
export class TouchControls {
  /** Escribe en input.virtual = { left, right, down, up, jump, run } */
  constructor(root, input) { this.root = root; this.input = input; this.enabled = false; }
  static isTouchDevice() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /[?&]touch=1/.test(location.search); }
  show(v) {}
}
