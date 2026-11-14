// HUD y menús (DOM). Paneles con glassmorphism, iconos SVG inline y transiciones tipo iris.
import { audio } from '../audio.js';
import { coinIcon, foxIcon, clockIcon, starIcon, playIcon, soundOnIcon, soundOffIcon, retryIcon } from './icons.js';

const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /[?&]touch=1/.test(location.search);
const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (cls, html = '', tag = 'div') => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function pop(node, big = false) {
  if (!node || !node.animate || reduceMotion) return;
  node.animate(
    big ? [{ transform: 'scale(1)' }, { transform: 'scale(1.45)', offset: 0.3 }, { transform: 'scale(.92)', offset: 0.65 }, { transform: 'scale(1)' }]
        : [{ transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: 0.35 }, { transform: 'scale(1)' }],
    { duration: big ? 420 : 240, easing: 'cubic-bezier(.3,1.6,.5,1)' });
}

/** Logo "KIKO" con letras animadas + subtítulo dorado. */
function logoHTML(size = '') {
  const letters = [...'KIKO'].map((c, i) => `<span class="k-ch" data-c="${c}" style="--i:${i}"><span class="k-fill">${c}</span></span>`).join('');
  return `<div class="k-logo ${size}">
    <div class="k-logo-glow"></div>
    <h1 class="k-logo-main" aria-label="KIKO">${letters}</h1>
    <div class="k-logo-sub"><span class="k-sub-txt" data-c="y las Estrellas Perdidas"><span class="k-fill">y las Estrellas Perdidas</span></span></div>
  </div>`;
}

function sparkles(n) {
  let h = '';
  for (let i = 0; i < n; i++) {
    const x = (i * 37.7 + 11) % 100, y = (i * 53.3 + 7) % 92, s = 10 + ((i * 7) % 18), d = (i * 0.37) % 3;
    h += `<span class="k-spark" style="left:${x}%;top:${y}%;--s:${s}px;--d:${d}s"></span>`;
  }
  return h;
}

export class Hud {
  constructor(root) {
    this.root = root;
    root.classList.add('k-ui');
    if (IS_TOUCH) root.classList.add('is-touch');
    this.cache = {};
    this._keyHandler = null;
    this._timers = [];

    // ---- barra superior
    this.bar = el('k-hud');
    this.bar.innerHTML = `
      <div class="k-group k-left">
        <div class="k-pill k-lives">${foxIcon('ico ico-fox')}<span class="k-x">×</span><b class="k-num" data-k="lives">3</b></div>
        <div class="k-pill k-coins">${coinIcon('ico ico-coin')}<span class="k-x">×</span><b class="k-num" data-k="coins">00</b></div>
      </div>
      <div class="k-group k-center">
        <div class="k-world"><small>MUNDO</small><b data-k="world">1-1</b></div>
        <div class="k-lname" data-k="levelName"></div>
      </div>
      <div class="k-group k-right">
        <div class="k-pill k-score"><small>PUNTOS</small><b class="k-num" data-k="score">0000000</b></div>
        <div class="k-pill k-time">${clockIcon('ico ico-clock')}<b class="k-num" data-k="time">400</b></div>
      </div>`;
    this.n = {};
    this.bar.querySelectorAll('[data-k]').forEach((e) => { this.n[e.dataset.k] = e; });
    this.timePill = this.bar.querySelector('.k-time');
    this.coinIco = this.bar.querySelector('.ico-coin');
    root.appendChild(this.bar);

    // ---- avisos
    this.toasts = el('k-toasts');
    root.appendChild(this.toasts);

    // ---- pantallas (menús)
    this.screen = el('k-screen');
    root.appendChild(this.screen);

    // ---- iris + tarjeta de intro de nivel
    this.iris = el('k-iris', `<div class="k-iris-hole"></div><div class="k-iris-stars">${sparkles(14)}</div><div class="k-intro"></div>`);
    this.irisHole = this.iris.firstChild;
    this.introCard = this.iris.querySelector('.k-intro');
    root.appendChild(this.iris);

    this.setVisible(false);
  }

  // ------------------------------------------------------------- HUD
  /** stats = { score, coins, world, time, lives, levelName, power } */
  update(s) {
    const c = this.cache;
    const set = (k, v, popIt, big) => {
      if (c[k] === v) return;
      const first = c[k] === undefined; c[k] = v;
      this.n[k].textContent = v;
      if (popIt && !first) pop(this.n[k], big);
    };
    set('score', pad(s.score, 7), false);
    if (c.coinsRaw !== s.coins) {
      const up = c.coinsRaw !== undefined && s.coins > c.coinsRaw; c.coinsRaw = s.coins;
      set('coins', pad(s.coins, 2), true);
      if (up && this.coinIco.animate && !reduceMotion) this.coinIco.animate([{ transform: 'rotateY(0) scale(1.15)' }, { transform: 'rotateY(360deg) scale(1)' }], { duration: 380, easing: 'ease-out' });
    }
    set('lives', String(s.lives), true, true);
    set('world', String(s.world), false);
    set('levelName', s.levelName || '', false);
    const t = Math.max(0, Math.ceil(s.time));
    set('time', pad(t, 3), t <= 100, false);
    const hurry = t <= 100;
    if (hurry !== c.hurry) { c.hurry = hurry; this.timePill.classList.toggle('hurry', hurry); }
    if (c.scoreRaw !== undefined && s.score - c.scoreRaw >= 100 && performance.now() - (c.scorePopT || 0) > 180) { c.scorePopT = performance.now(); pop(this.n.score); }
    c.scoreRaw = s.score;
  }
  setVisible(v) { this.bar.classList.toggle('on', !!v); }

  // ------------------------------------------------------------- pantallas
  _clearTimers() { this._timers.forEach(clearTimeout); this._timers = []; }
  _later(f, ms) { const t = setTimeout(f, ms); this._timers.push(t); return t; }
  _keys(map) {
    if (this._keyHandler) removeEventListener('keydown', this._keyHandler);
    this._keyHandler = null;
    if (!map) return;
    this._keyHandler = (e) => { if (e.repeat) return; const f = map[e.code]; if (f) { e.preventDefault(); f(); } };
    addEventListener('keydown', this._keyHandler);
  }
  _show(cls, html) {
    this.screen.className = `k-screen on ${cls}`;
    this.screen.innerHTML = html;
    this.screen.onclick = null;
    return this.screen;
  }
  _hideScreen() {
    this._keys(null);
    this.screen.onclick = null;
    if (!this.screen.classList.contains('on')) return;
    this.screen.classList.remove('on');
    this.screen.classList.add('off');
    const s = this.screen;
    this._later(() => { if (s.classList.contains('off')) { s.className = 'k-screen'; s.innerHTML = ''; } }, 320);
  }
  hide() {
    this._hideScreen();
    if (this.iris.classList.contains('closed') || this.iris.classList.contains('closing')) this._openIris();
  }

  /** Pantalla de título. onStart() al tocar/pulsar. */
  title(onStart) {
    this._clearTimers();
    const ctrls = IS_TOUCH
      ? `<div class="k-ctrl"><span class="k-chip"><i class="k-joy"></i>Joystick: mover</span><span class="k-chip"><i class="k-dot a">A</i>Saltar</span><span class="k-chip"><i class="k-dot b">B</i>Correr / Fuego</span></div>`
      : `<div class="k-ctrl"><span class="k-chip"><kbd>←</kbd><kbd>→</kbd>Mover</span><span class="k-chip"><kbd>Espacio</kbd>Saltar</span><span class="k-chip"><kbd>Shift</kbd>Correr / Fuego</span><span class="k-chip"><kbd>P</kbd>Pausa</span><span class="k-chip"><kbd>M</kbd>Sonido</span></div>`;
    const s = this._show('k-s-title', `
      <div class="k-vignette"></div>
      <div class="k-sparks">${sparkles(18)}</div>
      <div class="k-title-col">
        ${logoHTML()}
        <button class="k-btn k-btn-play" type="button"><span class="k-btn-ico">${playIcon}</span>JUGAR</button>
        <div class="k-press">${IS_TOUCH ? 'Toca para empezar' : 'Pulsa <kbd>Enter</kbd> para empezar'}</div>
        ${ctrls}
      </div>
      <div class="k-credits">Kiko y las Estrellas Perdidas · Un juego de plataformas hecho con Three.js · © 2026</div>`);
    let done = false;
    const go = (e) => { if (e) e.stopPropagation(); if (done) return; done = true; s.querySelector('.k-btn-play')?.classList.add('pressed'); onStart && onStart(); };
    s.querySelector('.k-btn-play').addEventListener('click', go);
    s.onclick = () => go();
  }

  /** Intro de nivel con iris. */
  levelIntro(world, name, lives) {
    this._clearTimers();
    this._keys(null);
    this.introCard.innerHTML = `
      <div class="k-intro-world"><span class="k-line"></span>MUNDO ${esc(world)}<span class="k-line"></span></div>
      <div class="k-intro-name">${esc(name)}</div>
      <div class="k-intro-lives">${foxIcon('ico ico-fox')}<span class="k-x">×</span><b>${esc(lives)}</b></div>`;
    this.introCard.classList.remove('on');
    const alreadyClosed = this.iris.classList.contains('closed');
    this.iris.className = 'k-iris active';
    void this.iris.offsetWidth;
    this.iris.classList.add(alreadyClosed ? 'closed' : 'closing');
    this._later(() => {
      this.iris.classList.remove('closing'); this.iris.classList.add('closed');
      // la pantalla anterior (título, fin de nivel...) se retira detrás del iris
      this.screen.className = 'k-screen'; this.screen.innerHTML = ''; this.screen.onclick = null;
      this.introCard.classList.add('on');
    }, alreadyClosed ? 0 : 420);
  }
  _openIris() {
    this._clearTimers();
    this.introCard.classList.remove('on');
    this.iris.classList.remove('closing', 'closed');
    this.iris.classList.add('opening');
    this._later(() => { this.iris.className = 'k-iris'; }, 800);
  }

  pause(show, onResume) {
    if (!show) { this._hideScreen(); return; }
    const s = this._show('k-s-pause', `
      <div class="k-panel k-pause-panel">
        <div class="k-panel-title">PAUSA</div>
        <div class="k-btns">
          <button class="k-btn k-btn-play" data-a="resume" type="button"><span class="k-btn-ico">${playIcon}</span>Continuar</button>
          <button class="k-btn k-btn-alt" data-a="mute" type="button"><span class="k-btn-ico"></span><span class="k-lbl"></span></button>
        </div>
        <div class="k-press">${IS_TOUCH ? '' : '<kbd>P</kbd> o <kbd>Esc</kbd> para continuar · <kbd>M</kbd> sonido'}</div>
      </div>`);
    const muteBtn = s.querySelector('[data-a="mute"]');
    const paint = () => {
      muteBtn.querySelector('.k-btn-ico').innerHTML = audio.muted ? soundOffIcon : soundOnIcon;
      muteBtn.querySelector('.k-lbl').textContent = audio.muted ? 'Activar sonido' : 'Silenciar';
    };
    paint();
    s.querySelector('[data-a="resume"]').addEventListener('click', (e) => { e.stopPropagation(); onResume && onResume(); });
    muteBtn.addEventListener('click', (e) => { e.stopPropagation(); audio.setMuted(!audio.muted); paint(); });
    this._keys({ KeyM: () => this._later(paint, 0) });
  }

  gameOver(onRetry) {
    let done = false;
    const go = () => { if (done) return; done = true; this._keys(null); onRetry && onRetry(); };
    const s = this._show('k-s-over', `
      <div class="k-over">
        <div class="k-big k-big-red" data-c="FIN DEL JUEGO"><span class="k-fill">FIN DEL JUEGO</span></div>
        <div class="k-over-sub">Kiko necesita tu ayuda para recuperar las estrellas</div>
        <div class="k-stats"><div class="k-stat"><small>PUNTOS</small><b>${esc(this.n.score.textContent)}</b></div></div>
        <button class="k-btn k-btn-play" type="button"><span class="k-btn-ico">${retryIcon}</span>Reintentar</button>
        <div class="k-press">${IS_TOUCH ? '' : 'Pulsa <kbd>Enter</kbd>'}</div>
      </div>`);
    s.querySelector('.k-btn').addEventListener('click', (e) => { e.stopPropagation(); go(); });
    this._later(() => this._keys({ Enter: go, Space: go }), 600);
  }

  levelClear(stats) {
    const s = this._show('k-s-clear', `
      <div class="k-clear">
        <div class="k-clear-stars">${starIcon('ico s1')}${starIcon('ico s2')}${starIcon('ico s3')}</div>
        <div class="k-big" data-c="¡NIVEL SUPERADO!"><span class="k-fill">¡NIVEL SUPERADO!</span></div>
        <div class="k-clear-name">MUNDO ${esc(stats.world)} · ${esc(stats.name)}</div>
        <div class="k-stats">
          <div class="k-stat"><small>PUNTOS</small><b data-count="${+stats.score || 0}">0</b></div>
          <div class="k-stat">${coinIcon('ico')}<b>× ${pad(stats.coins, 2)}</b></div>
        </div>
      </div>`);
    const b = s.querySelector('[data-count]'), target = +b.dataset.count, t0 = performance.now();
    const step = () => {
      if (!b.isConnected) return;
      const k = Math.min(1, (performance.now() - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
      b.textContent = pad(target * e, 7);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  victory(stats, onRestart) {
    let done = false;
    const go = () => { if (done) return; done = true; this._keys(null); onRestart && onRestart(); };
    const s = this._show('k-s-victory', `
      <div class="k-rays"></div>
      <div class="k-sparks">${sparkles(22)}</div>
      <div class="k-victory">
        <div class="k-victory-star">${starIcon('ico')}</div>
        <div class="k-big k-big-xl" data-c="¡VICTORIA!"><span class="k-fill">¡VICTORIA!</span></div>
        <div class="k-over-sub">¡Kiko ha recuperado las Estrellas Perdidas!</div>
        <div class="k-stats">
          <div class="k-stat"><small>PUNTOS</small><b>${pad(stats.score, 7)}</b></div>
          <div class="k-stat">${coinIcon('ico')}<b>× ${pad(stats.coins, 2)}</b></div>
          <div class="k-stat">${foxIcon('ico')}<b>× ${esc(stats.lives)}</b></div>
        </div>
        <button class="k-btn k-btn-play" type="button"><span class="k-btn-ico">${retryIcon}</span>Jugar de nuevo</button>
      </div>`);
    s.querySelector('.k-btn').addEventListener('click', (e) => { e.stopPropagation(); go(); });
    this._later(() => this._keys({ Enter: go, Space: go }), 900);
  }

  // ------------------------------------------------------------- avisos
  toast(text, kind = '') {
    const t = el(`k-toast ${kind}`);
    t.innerHTML = `${kind === 'warn' ? clockIcon('ico') : starIcon('ico')}<span>${esc(text)}</span>`;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), kind === 'warn' ? 2200 : 1800);
    setTimeout(() => t.remove(), kind === 'warn' ? 2700 : 2300);
  }
  hurry() {
    this.timePill.classList.add('hurry');
    this.cache.hurry = true;
    this.toast('¡DATE PRISA!', 'warn');
  }
}
