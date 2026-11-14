// Controles táctiles: joystick flotante (izquierda), botones SALTAR / CORRER (derecha) y pausa.
// Multitouch real con Pointer Events (cada dedo se sigue por pointerId).
import { pauseIcon, phoneIcon } from './icons.js';

const DEAD_X = 0.26;   // zona muerta horizontal (fracción del radio)
const DOWN_Y = 0.5;    // umbral para agacharse
const UP_Y = -0.62;    // umbral para "arriba"

export class TouchControls {
  /** Escribe en input.virtual = { left, right, down, up, jump, run } */
  constructor(root, input) {
    this.root = root; this.input = input; this.enabled = false;
    this.built = false;
  }
  static isTouchDevice() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /[?&]touch=1/.test(location.search); }

  _build() {
    this.built = true;
    const w = this.wrap = document.createElement('div');
    w.className = 'k-touch';
    w.innerHTML = `
      <div class="k-tz k-tz-left">
        <div class="k-joy-base">
          <i class="k-arr l"></i><i class="k-arr r"></i><i class="k-arr d"></i><i class="k-arr u"></i>
          <div class="k-joy-knob"></div>
        </div>
      </div>
      <div class="k-tz k-tz-right">
        <div class="k-tb k-tb-run" data-b="run"><span class="k-tb-l">B</span><small>CORRER</small></div>
        <div class="k-tb k-tb-jump" data-b="jump"><span class="k-tb-l">A</span><small>SALTAR</small></div>
      </div>
      <button class="k-tpause" type="button" aria-label="Pausa">${pauseIcon}</button>
      <div class="k-rotate"><span class="k-rotate-ico">${phoneIcon}</span><span>Gira el móvil para jugar mejor</span><button type="button" aria-label="Cerrar">×</button></div>`;
    this.root.appendChild(w);
    this.left = w.querySelector('.k-tz-left');
    this.rightZone = w.querySelector('.k-tz-right');
    this.base = w.querySelector('.k-joy-base');
    this.knob = w.querySelector('.k-joy-knob');
    this.arrows = { left: w.querySelector('.k-arr.l'), right: w.querySelector('.k-arr.r'), down: w.querySelector('.k-arr.d'), up: w.querySelector('.k-arr.u') };
    this.btns = [...w.querySelectorAll('.k-tb')].map((e) => ({ el: e, name: e.dataset.b, cx: 0, cy: 0, r: 0 }));
    this.joy = null;               // { id, ox, oy }
    this.btnPointers = new Map();  // pointerId -> Set(nombres)
    this.dir = { left: false, right: false, down: false, up: false };

    const opts = { passive: false };
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    // ---- joystick
    this.left.addEventListener('pointerdown', (e) => {
      stop(e);
      if (this.joy) return;
      try { this.left.setPointerCapture(e.pointerId); } catch {}
      const r = this._joyRadius();
      const zr = this.left.getBoundingClientRect();
      // El joystick aparece bajo el dedo (limitado para que quepa entero)
      const ox = Math.min(Math.max(e.clientX, zr.left + r * 0.9), zr.right - r * 0.9);
      const oy = Math.min(Math.max(e.clientY, zr.top + r * 0.9), zr.bottom - r * 0.9);
      this.joy = { id: e.pointerId, ox, oy };
      this.base.classList.add('active');
      this._placeBase(ox - zr.left, oy - zr.top);
      this._joyMove(e.clientX, e.clientY);
    }, opts);
    this.left.addEventListener('pointermove', (e) => { if (this.joy && e.pointerId === this.joy.id) { stop(e); this._joyMove(e.clientX, e.clientY); } }, opts);
    const joyEnd = (e) => { if (this.joy && e.pointerId === this.joy.id) { this.joy = null; this._joyReset(); } };
    this.left.addEventListener('pointerup', joyEnd);
    this.left.addEventListener('pointercancel', joyEnd);
    this.left.addEventListener('lostpointercapture', joyEnd);

    // ---- botones (un dedo puede deslizar de uno a otro, o pulsar ambos en medio)
    const z = this.rightZone;
    z.addEventListener('pointerdown', (e) => {
      stop(e);
      try { z.setPointerCapture(e.pointerId); } catch {}
      this._measureBtns();
      this._btnPointer(e.pointerId, e.clientX, e.clientY, true);
    }, opts);
    z.addEventListener('pointermove', (e) => { if (this.btnPointers.has(e.pointerId)) { stop(e); this._btnPointer(e.pointerId, e.clientX, e.clientY, false); } }, opts);
    const bEnd = (e) => { if (this.btnPointers.delete(e.pointerId)) this._syncBtns(); };
    z.addEventListener('pointerup', bEnd);
    z.addEventListener('pointercancel', bEnd);
    z.addEventListener('lostpointercapture', bEnd);

    // ---- pausa
    const pb = w.querySelector('.k-tpause');
    pb.addEventListener('pointerdown', (e) => { stop(e); pb.classList.add('down'); this._buzz(10); });
    pb.addEventListener('pointerup', (e) => {
      stop(e); pb.classList.remove('down');
      const g = window.game;
      if (g && typeof g.togglePause === 'function') g.togglePause();
      else { dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p' })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyP', key: 'p' })), 60); }
    });
    pb.addEventListener('pointercancel', () => pb.classList.remove('down'));

    // ---- aviso de orientación (no bloquea: el juego sigue siendo jugable en vertical)
    const rot = w.querySelector('.k-rotate');
    rot.querySelector('button').addEventListener('pointerup', (e) => { stop(e); rot.classList.add('dismissed'); });
    const mq = matchMedia('(orientation: portrait)');
    const onOrient = () => { if (mq.matches) { rot.classList.remove('dismissed'); clearTimeout(this._rotT); this._rotT = setTimeout(() => rot.classList.add('dismissed'), 6000); } };
    mq.addEventListener ? mq.addEventListener('change', onOrient) : mq.addListener(onOrient);
    onOrient();

    w.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('resize', () => { this._measureBtns(); if (!this.joy) this._joyReset(); });
    addEventListener('blur', () => this._releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this._releaseAll(); });
    this._joyReset();
  }

  show(v) {
    v = !!v;
    if (v && !this.built) this._build();
    this.enabled = v;
    this.root.classList.toggle('touch-on', v);
    if (this.wrap) this.wrap.classList.toggle('on', v);
    if (!v) this._releaseAll();
  }

  // ------------------------------------------------------------- joystick
  _joyRadius() { return (this.base.offsetWidth || 150) / 2; }
  _placeBase(x, y) { this.base.style.left = `${x}px`; this.base.style.top = `${y}px`; }
  _joyMove(x, y) {
    const j = this.joy, R = this._joyRadius();
    let dx = x - j.ox, dy = y - j.oy;
    const d = Math.hypot(dx, dy);
    // Si el dedo se aleja más del radio, la base le sigue (cambio de dirección inmediato)
    if (d > R * 1.15) {
      const k = (d - R * 1.15) / d;
      j.ox += dx * k; j.oy += dy * k;
      const zr = this.left.getBoundingClientRect();
      this._placeBase(j.ox - zr.left, j.oy - zr.top);
      dx = x - j.ox; dy = y - j.oy;
    }
    const m = Math.min(1, Math.hypot(dx, dy) / R);
    const a = Math.atan2(dy, dx), kx = Math.cos(a) * m * R * 0.62, ky = Math.sin(a) * m * R * 0.62;
    this.knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    const nx = dx / R, ny = dy / R;
    const down = ny > DOWN_Y && Math.abs(ny) > Math.abs(nx) * 0.75;
    this._setDir({
      left: nx < -DEAD_X && !(down && Math.abs(nx) < 0.45),
      right: nx > DEAD_X && !(down && Math.abs(nx) < 0.45),
      down,
      up: ny < UP_Y && Math.abs(ny) > Math.abs(nx) * 0.9,
    });
  }
  _joyReset() {
    if (!this.base) return;
    this.base.classList.remove('active');
    this.base.style.left = ''; this.base.style.top = '';
    this.knob.style.transform = 'translate(-50%,-50%)';
    this._setDir({ left: false, right: false, down: false, up: false });
  }
  _setDir(d) {
    let changed = false;
    for (const k of ['left', 'right', 'down', 'up']) {
      if (this.dir[k] !== d[k]) { changed = true; this.dir[k] = d[k]; this.arrows[k].classList.toggle('on', d[k]); }
      this.input.virtual[k] = d[k];
    }
    if (changed && (d.left || d.right || d.down)) this._buzz(5);
  }

  // ------------------------------------------------------------- botones
  _measureBtns() {
    if (!this.btns) return;
    for (const b of this.btns) {
      const r = b.el.getBoundingClientRect();
      b.cx = r.left + r.width / 2; b.cy = r.top + r.height / 2; b.r = r.width / 2;
    }
  }
  _btnPointer(id, x, y, isDown) {
    const hit = new Set();
    let best = null, bestD = Infinity;
    for (const b of this.btns) {
      const d = Math.hypot(x - b.cx, y - b.cy);
      if (d < b.r * 1.18) hit.add(b.name);
      const nd = d / b.r;
      if (nd < bestD) { bestD = nd; best = b; }
    }
    // Al apoyar el dedo en la zona, siempre activa el botón más cercano
    if (!hit.size && best && (isDown || bestD < 2.2)) hit.add(best.name);
    this.btnPointers.set(id, hit);
    this._syncBtns();
  }
  _syncBtns() {
    const on = { jump: false, run: false };
    for (const s of this.btnPointers.values()) for (const n of s) on[n] = true;
    for (const b of this.btns) {
      const was = b.el.classList.contains('down');
      if (was !== on[b.name]) {
        b.el.classList.toggle('down', on[b.name]);
        if (on[b.name]) this._buzz(b.name === 'jump' ? 12 : 8);
      }
    }
    this.input.virtual.jump = on.jump;
    this.input.virtual.run = on.run;
  }

  _releaseAll() {
    if (!this.built) return;
    this.joy = null; this._joyReset();
    this.btnPointers.clear(); this._syncBtns();
  }
  _buzz(ms) { try { if (navigator.vibrate && !this.noVibrate) navigator.vibrate(ms); } catch { this.noVibrate = true; } }
}
