// PLACEHOLDER — postprocesado (bloom, color grading...) a cargo del subagente de entorno.
export class Post {
  constructor(renderer, scene, camera) { this.renderer = renderer; this.scene = scene; this.camera = camera; }
  setSize(w, h, pixelRatio) {}
  setTheme(theme) {}
  render(dt) { this.renderer.render(this.scene, this.camera); }
}
