import * as THREE from 'three';
import { T, PHYS, SCORE, START_LIVES, isQuestion } from './config.js';
import { overlap } from './physics.js';
import { Input } from './input.js';
import { Level } from './level.js';
import { LEVELS } from './levels/data.js';
import { BlockRenderer } from './render/blocks.js';
import { Environment } from './render/environment.js';
import { Post } from './render/post.js';
import { Particles } from './fx/particles.js';
import { Player } from './entities/player.js';
import { createEnemy, Beetle, EnemyFire } from './entities/enemies.js';
import { Coin, PopCoin, PowerItem, Fireball, Platform, Goal, Checkpoint } from './entities/items.js';
import { audio } from './audio.js';
import { Hud } from './ui/hud.js';
import { TouchControls } from './ui/touch.js';

const params = new URLSearchParams(location.search);
const IS_TOUCH = TouchControls.isTouchDevice();

class Game {
  constructor() {
    const lowEnd = IS_TOUCH && (navigator.hardwareConcurrency || 4) <= 4;
    this.quality = params.get('q') || (lowEnd ? 'low' : IS_TOUCH ? 'medium' : 'high');
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality !== 'high', powerPreference: 'high-performance', stencil: false });
    this.pixelRatio = Math.min(devicePixelRatio, this.quality === 'low' ? 1.25 : this.quality === 'medium' ? 1.75 : 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
    this.input = new Input();
    const ui = document.getElementById('ui');
    this.hud = new Hud(ui);
    this.touch = new TouchControls(ui, this.input);
    this.cam = { x: 0, y: 7, minVisibleX: 0, halfW: 10, halfH: 6.5, look: 0, dist: 18 };
    this.shakeT = 0; this.shakeAmp = 0; this.stopT = 0;
    this.score = 0; this.coins = 0; this.lives = START_LIVES; this.levelIndex = +(params.get('level') || 0);
    this.state = 'boot'; this.time = 0; this.clock = 0;
    this.checkpoint = null;
    addEventListener('resize', () => this.resize());
    this.input.onAnyKey((code) => { if (code === 'KeyM') audio.setMuted(!audio.muted); });
    this.resize();
    window.game = this;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // Garantizar ~13.5 casillas de alto y al menos 15 de ancho (móvil vertical)
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const needH = 6.9 / tanH, needW = 7.5 / (tanH * this.camera.aspect);
    this.cam.dist = Math.max(needH, needW);
    this.cam.halfH = this.cam.dist * tanH;
    this.cam.halfW = this.cam.halfH * this.camera.aspect;
    this.camera.updateProjectionMatrix();
    this.post && this.post.setSize(w, h, this.pixelRatio);
  }

  // ----------------------------------------------------------- nivel
  loadLevel(index, fromCheckpoint = false) {
    this.disposeLevel();
    const def = LEVELS[index];
    this.levelIndex = index;
    this.level = new Level(def);
    this.scene = new THREE.Scene();
    this.env = new Environment({ renderer: this.renderer, scene: this.scene, camera: this.camera, quality: this.quality });
    this.env.setTheme(this.level.theme, this.level);
    this.post = new Post(this.renderer, this.scene, this.camera, { quality: this.quality });
    this.post.setTheme && this.post.setTheme(this.level.theme);
    this.post.setSize(innerWidth, innerHeight, this.pixelRatio);
    this.blocks = new BlockRenderer({ scene: this.scene, level: this.level, theme: this.level.theme, renderer: this.renderer, quality: this.quality });
    this.level.onChange = (x, y, o, n) => this.blocks.onTileChange(x, y, o, n);
    this.particles = new Particles(this.scene, this.camera, { quality: this.quality, level: this.level });
    this.enemies = []; this.items = []; this.platforms = [];
    this.pending = this.level.spawns.slice().sort((a, b) => a.x - b.x);
    // Monedas, plataformas y meta se crean al inicio
    this.pending = this.pending.filter((s) => {
      if (s.type === 'coin') { this.items.push(new Coin(this, s.x, s.y)); return false; }
      if (s.type === 'platformH' || s.type === 'platformV') { this.platforms.push(new Platform(this, s.x + 1, s.y, s.type === 'platformH' ? 'h' : 'v')); return false; }
      return true;
    });
    this.goal = this.level.goal ? new Goal(this, this.level.goal.x, this.level.goal.y) : null;
    this.checkpoints = this.level.checkpoints.map((c) => new Checkpoint(this, c.x, c.y));
    const cp = fromCheckpoint && this.checkpoint && this.checkpoint.level === index ? this.checkpoint : null;
    if (!fromCheckpoint) this.checkpoint = null;
    const sx = cp ? cp.x : this.level.start.x, sy = cp ? cp.y : this.level.start.y;
    if (cp) this.checkpoints.forEach((c) => { if (c.x <= cp.x + 0.1) c.activeFlag = true; });
    this.pending = this.pending.filter((s) => !(cp && s.x < cp.x - 8));
    this.player = new Player(this, +(params.get('x') || sx), sy);
    if (params.get('power')) this.player.setPower(+params.get('power'), false);
    this.goalSeq = null;
    this.timeLeft = this.level.time;
    this.hurried = false;
    this.cam.x = this.player.x; this.cam.y = this.cam.halfH - 1.2; this.cam.look = 0;
    this.updateCamera(0, true);
  }
  disposeLevel() {
    if (!this.scene) return;
    this.env.dispose && this.env.dispose();
    this.post.dispose && this.post.dispose();
    this.blocks.dispose && this.blocks.dispose();
    this.scene.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    this.scene = null;
  }

  // ----------------------------------------------------------- flujo
  start() {
    this.loadLevel(this.levelIndex);
    if (params.get('auto')) { this.beginLevel(true); }
    else {
      this.state = 'title';
      this.hud.setVisible(false);
      audio.playMusic('title');
      this.hud.title(() => this.onTitleStart());
      this.input.onAnyKey((c) => { if (this.state === 'title' && (c === 'Enter' || c === 'Space')) this.onTitleStart(); });
    }
    this.last = performance.now();
    const loop = (t) => { requestAnimationFrame(loop); this.frame(t); };
    requestAnimationFrame(loop);
  }
  onTitleStart() {
    if (this.state !== 'title') return;
    audio.unlock(); audio.sfx('select');
    if (IS_TOUCH) {
      const el = document.documentElement;
      try { (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {}); } catch {}
      try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch {}
    }
    this.score = 0; this.coins = 0; this.lives = START_LIVES;
    this.loadLevel(this.levelIndex);
    this.beginLevel();
  }
  beginLevel(skipIntro = false) {
    audio.stopMusic();
    this.hud.setVisible(true);
    this.touch.show(IS_TOUCH);
    this.updateHud();
    if (skipIntro) { this.hud.hide(); this.state = 'playing'; audio.playMusic(this.level.theme); return; }
    this.state = 'intro';
    this.hud.levelIntro(this.level.def.id, this.level.name, this.lives);
    this.introT = 2.4;
  }
  onPlayerDeath() {
    this.state = 'dying'; this.dyingT = 0;
    audio.stopMusic(); audio.sfx('die');
    this.particles.emit('death', this.player.x, this.player.y + this.player.h / 2);
    this.shake(0.3); this.hitStop(0.35);
  }
  afterDeath() {
    this.lives--;
    if (this.lives <= 0) {
      this.state = 'gameover'; audio.playMusic('gameover');
      this.hud.gameOver(() => { this.score = 0; this.coins = 0; this.lives = START_LIVES; this.checkpoint = null; this.loadLevel(0); this.beginLevel(); });
      return;
    }
    const pow = 0;
    this.loadLevel(this.levelIndex, true);
    this.player.setPower(pow, false);
    this.beginLevel();
  }
  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; audio.sfx('pause'); audio.setMuted(audio.muted, true); this.hud.pause(true, () => this.togglePause()); }
    else if (this.state === 'paused') { this.state = 'playing'; audio.sfx('pause'); this.hud.pause(false); }
  }

  // ----------------------------------------------------------- utilidades de juego
  addScore(n, x, y) { this.score += n; if (x !== undefined) this.particles.popup(String(n), x, y); }
  collectCoin(x, y) {
    this.coins++; this.score += SCORE.coin; audio.sfx('coin');
    if (this.coins >= 100) { this.coins -= 100; this.oneUp(x, y); }
  }
  oneUp(x, y) { this.lives++; audio.sfx('oneUp'); if (x !== undefined) this.particles.popup('1UP', x, y); }
  shake(a) { this.shakeAmp = Math.max(this.shakeAmp, a); this.shakeT = 0.3; }
  hitStop(t) { this.stopT = Math.max(this.stopT, t); }
  countFireballs() { return this.items.filter((i) => i instanceof Fireball && i.alive).length; }
  spawnFireball(x, y, dir) { this.items.push(new Fireball(this, x, y, dir)); }
  spawnEnemyFire(x, y, tx, ty) { if (Math.abs(x - this.cam.x) < this.cam.halfW + 1) this.enemies.push(new EnemyFire(this, x, y, tx, ty)); }

  hitBlock(tx, ty, by) {
    const L = this.level, t = L.get(tx, ty);
    const big = by && by.power > 0;
    const cx = tx + 0.5, top = ty + 1;
    const bumpEffects = () => {
      this.blocks.bump(tx, ty);
      // derribar enemigos y empujar objetos encima del bloque
      for (const e of this.enemies) if (e.alive && !e.dead && Math.abs(e.x - cx) < 0.5 + e.w / 2 && Math.abs(e.y - top) < 0.3) e.flipKill(Math.sign(e.x - cx) || 1);
      for (const it of this.items) {
        if (!it.alive || Math.abs(it.x - cx) > 0.5 + it.w / 2 || Math.abs(it.y - top) > 0.4) continue;
        if (it instanceof Coin) it.collect(); else if (it instanceof PowerItem) it.bounce();
      }
    };
    if (t === T.BRICK) {
      if (big) {
        L.set(tx, ty, T.EMPTY);
        this.particles.emit('brick', cx, ty + 0.5, { theme: L.theme });
        audio.sfx('break'); this.addScore(SCORE.brick); this.shake(0.12);
        for (const e of this.enemies) if (e.alive && !e.dead && Math.abs(e.x - cx) < 0.5 + e.w / 2 && Math.abs(e.y - top) < 0.3) e.flipKill(1);
      } else { audio.sfx('bump'); bumpEffects(); }
      return;
    }
    if (isQuestion(t) || t === T.MULTICOIN) {
      bumpEffects();
      audio.sfx('bump');
      if (t === T.QCOIN) { L.set(tx, ty, T.USED); this.items.push(new PopCoin(this, cx, top)); this.coinFromBlock(cx, top); }
      else if (t === T.MULTICOIN) {
        const k = L.idx(tx, ty); const n = (L.contents.get(k) ?? 1) - 1; L.contents.set(k, n);
        this.items.push(new PopCoin(this, cx, top)); this.coinFromBlock(cx, top);
        if (n <= 0) L.set(tx, ty, T.USED);
      } else {
        L.set(tx, ty, T.USED);
        const kind = t === T.QSTAR ? 'star' : t === T.Q1UP ? 'oneup' : (by && by.power > 0 ? 'flower' : 'fruit');
        this.items.push(new PowerItem(this, cx, top, kind));
      }
      this.particles.emit('sparkle', cx, top);
      return;
    }
    if (by) { audio.sfx('bump'); this.particles.emit('dust', cx, ty, { count: 3 }); }
  }
  coinFromBlock() { this.coins++; audio.sfx('coin'); if (this.coins >= 100) { this.coins -= 100; this.oneUp(); } }

  resolvePlatforms(b) {
    const wasOn = b.platform; b.platform = null;
    for (const p of this.platforms) {
      const within = Math.abs(b.x - p.x) < p.w / 2 + b.w * 0.35;
      if (!within || b.vy > 0.01) continue;
      if (b.y <= p.top + 0.02 && b.y >= p.top - 0.45 - Math.max(0, -p.dy)) {
        b.y = p.top; b.vy = 0; b.onGround = true; b.platform = p;
        if (!wasOn && b === this.player) audio.sfx('land');
        break;
      }
    }
  }

  // ----------------------------------------------------------- bucle
  frame(now) {
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (params.get('fixed')) dt = 1 / 60;
    this.clock += dt;
    this.adaptResolution(now);
    this.input.poll();
    if (this.input.pressed('pause') && (this.state === 'playing' || this.state === 'paused')) this.togglePause();
    if (this.stopT > 0) { this.stopT -= dt; this.render(dt, 0); return; }
    let simDt = 0;
    switch (this.state) {
      case 'title': this.titleUpdate(dt); break;
      case 'intro':
        this.introT -= dt;
        if (this.introT <= 0) { this.hud.hide(); this.state = 'playing'; audio.playMusic(this.level.theme); }
        break;
      case 'playing': simDt = dt; this.update(dt); break;
      case 'dying':
        this.dyingT += dt; simDt = dt;
        this.player.update(dt, this.input);
        this.syncAll(dt);
        if (this.dyingT > 3.2) this.afterDeath();
        break;
      case 'goal': simDt = dt; this.updateGoal(dt); break;
    }
    this.render(dt, simDt);
  }

  // Resolución dinámica: baja/sube el pixelRatio para mantener ~55+ fps en móvil.
  adaptResolution(now) {
    if (params.get('fixed') || params.get('q')) return;
    const a = this.perf ??= { t0: now, n: 0, scale: 1, maxPR: this.pixelRatio };
    a.n++;
    if (now - a.t0 < 2000) return;
    const fps = a.n * 1000 / (now - a.t0); a.t0 = now; a.n = 0;
    if (document.hidden || this.state === 'title' && this.clock < 3) return;
    let s = a.scale;
    if (fps < 48) s = Math.max(0.55, s - 0.15); else if (fps > 58 && s < 1) s = Math.min(1, s + 0.05);
    if (s !== a.scale) {
      a.scale = s;
      this.pixelRatio = Math.max(0.75, a.maxPR * s);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    }
  }

  titleUpdate(dt) {
    this.time += dt;
    this.cam.x = 12 + Math.sin(this.time * 0.12) * 6;
    this.cam.y = this.cam.halfH - 0.8;
    this.updateCamera(dt, true);
    this.player.syncModel(dt);
    this.syncAll(dt, true);
  }

  update(dt) {
    this.time += dt;
    const p = this.player;
    // Tiempo
    this.timeLeft -= dt * 1.0;
    if (this.timeLeft <= 100 && !this.hurried) { this.hurried = true; audio.sfx('hurry'); audio.setMusicRate(1.18); this.hud.hurry(); }
    if (this.timeLeft <= 0) { this.timeLeft = 0; p.die(); return; }
    // Activar enemigos cerca de la cámara
    const edge = this.cam.x + this.cam.halfW + 3;
    while (this.pending.length && this.pending[0].x < edge) {
      const s = this.pending.shift();
      const e = createEnemy(this, s);
      if (e) this.enemies.push(e);
    }
    for (const pl of this.platforms) pl.update(dt);
    p.update(dt, this.input);
    if (p.star > 0 && (this.starFx = (this.starFx || 0) + 1) % 2 === 0) this.particles.emit('star', p.x, p.y + p.h / 2);
    if (this.state !== 'playing') { this.syncAll(dt); return; }
    for (const e of this.enemies) if (e.alive) {
      if (Math.abs(e.x - this.cam.x) < this.cam.halfW + 8 || e.dead) e.update(dt);
    }
    for (const it of this.items) if (it.alive) it.update(dt);
    this.collisions();
    // Puntos de control
    for (const c of this.checkpoints) if (!c.activeFlag && p.x > c.x) {
      c.activeFlag = true; this.checkpoint = { level: this.levelIndex, x: c.x, y: c.y };
      audio.sfx('checkpoint'); this.particles.emit('sparkle', c.x, c.y + 2); this.hud.toast('¡Punto de control!');
    }
    // Meta
    if (this.goal && p.x >= this.goal.x - 0.45 && !p.dead) this.startGoal();
    this.enemies = this.enemies.filter((e) => e.alive);
    this.items = this.items.filter((i) => i.alive);
    this.updateCamera(dt);
    this.syncAll(dt);
    this.updateHud();
  }

  collisions() {
    const p = this.player;
    if (p.dead) return;
    // jugador vs enemigos
    for (const e of this.enemies) {
      if (!e.alive || e.dead || !overlap(p, e)) continue;
      if (p.star > 0 && !e.immune) { e.flipKill(Math.sign(e.x - p.x) || 1, SCORE.kick); audio.sfx('kick'); continue; }
      if (e instanceof Beetle && e.shell && !e.spinning && e.kickGrace <= 0) {
        if (p.vy < 0 && p.y > e.y + e.h * 0.4) { p.vy = PHYS.stompBounce * 0.7; }
        e.kick(p); continue;
      }
      const fromAbove = p.vy < 0 && p.y > e.y + e.h * 0.4;
      if (fromAbove && !e.immune && e.stomp(p)) {
        const hold = this.input.state.jump;
        p.vy = hold ? PHYS.stompBounceHold : PHYS.stompBounce; p.jumping = hold;
        p.stompChain++;
        const pts = [100, 200, 400, 800, 1000, 2000, 4000, 8000][Math.min(7, p.stompChain - 1)];
        if (p.stompChain >= 9) this.oneUp(e.x, e.y + 1); else this.addScore(pts, e.x, e.y + e.h);
        audio.sfx('stomp'); this.hitStop(0.045); this.shake(0.06);
      } else if (e.harmful) p.hurt();
    }
    // enemigos entre sí (darse la vuelta)
    const walkers = this.enemies.filter((e) => e.alive && !e.dead && e.onGround !== undefined && e.vx !== undefined && !(e instanceof Beetle && e.spinning) && e.speed);
    for (let i = 0; i < walkers.length; i++) for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i], b = walkers[j];
      if (overlap(a, b)) { const d = Math.sign(a.x - b.x) || 1; if (a.vx) a.vx = d * Math.abs(a.vx); if (b.vx) b.vx = -d * Math.abs(b.vx); }
    }
    // jugador vs objetos
    for (const it of this.items) {
      if (!it.alive || !overlap(p, it)) continue;
      if (it instanceof Coin) it.collect();
      else if (it instanceof PowerItem && it.emerge >= 0.6) {
        it.remove();
        this.addScore(SCORE.power, it.x, it.y + 1);
        if (it.kind === 'fruit') { if (p.power === 0) p.setPower(1); audio.sfx('powerUp'); this.hitStop(0.1); }
        else if (it.kind === 'flower') { p.setPower(2); audio.sfx('powerUp'); this.hitStop(0.1); }
        else if (it.kind === 'star') { p.star = 10; audio.sfx('star'); audio.playMusic('star'); }
        else if (it.kind === 'oneup') this.oneUp(it.x, it.y + 1);
        this.particles.emit('powerup', p.x, p.y + p.h / 2);
      }
    }
  }
  onStarEnd() { if (this.state === 'playing') audio.playMusic(this.level.theme, { resume: true }); }

  // ----------------------------------------------------------- meta
  startGoal() {
    const p = this.player, g = this.goal;
    this.state = 'goal';
    const h = p.y - g.y;
    const pts = h >= 8 ? 5000 : h >= 6 ? 2000 : h >= 4 ? 800 : h >= 2 ? 400 : 100;
    this.addScore(pts, p.x, p.y + 1);
    p.control = false; p.climbing = true; p.vx = 0; p.vy = 0; p.x = g.x - 0.38; p.facing = 1; p.star = 0;
    audio.stopMusic(); audio.sfx('flag');
    this.goalSeq = { phase: 'slide', t: 0, flagStart: 1, grabY: p.y };
    this.particles.emit('sparkle', p.x, p.y + 1);
  }
  updateGoal(dt) {
    this.time += dt;
    const p = this.player, g = this.goal, s = this.goalSeq;
    s.t += dt;
    const groundY = this.level.groundBelow(g.x + 1, g.y + 2);
    if (s.phase === 'slide') {
      p.y = Math.max(groundY, p.y - 9 * dt);
      g.flagY = Math.max(0, g.flagY - dt * 1.1);
      if (p.y <= groundY && g.flagY <= 0) { s.phase = 'turn'; s.t = 0; p.climbing = false; p.x = g.x + 0.45; p.facing = -1; }
    } else if (s.phase === 'turn') {
      if (s.t > 0.45) { s.phase = 'walk'; s.t = 0; p.facing = 1; p.autoWalk = true; audio.playMusic('clear'); }
    } else if (s.phase === 'walk') {
      p.control = false; p.autoWalk = true;
      p.update(dt, this.input);
      if (p.x >= g.x + 7) { s.phase = 'enter'; s.t = 0; p.victory = true; p.vx = 0; p.autoWalk = false; p.model.root.visible = false; this.hiddenPlayer = true; }
    } else if (s.phase === 'enter') {
      if (s.t > 0.4) {
        const step = Math.min(this.timeLeft, Math.max(1, dt * 120));
        if (this.timeLeft > 0) { this.timeLeft -= step; this.score += Math.round(step) * 50; if (Math.floor(s.t * 30) % 2) audio.sfx('tick'); }
        else { s.phase = 'fireworks'; s.t = 0; s.fw = 0; }
      }
    } else if (s.phase === 'fireworks') {
      if (s.t > s.fw * 0.5 && s.fw < 3) { s.fw++; this.particles.emit('firework', g.x + 4 + Math.random() * 6, g.y + 7 + Math.random() * 3); this.addScore(500); }
      if (s.t > 2) { s.phase = 'done'; s.t = 0; this.hud.levelClear({ score: this.score, coins: this.coins, world: this.level.def.id, name: this.level.name }); }
    } else if (s.phase === 'done') {
      if (s.t > 3) this.nextLevel();
    }
    this.updateCamera(dt);
    this.syncAll(dt);
    this.updateHud();
  }
  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = 'victory'; audio.playMusic('victory');
      this.hud.victory({ score: this.score, coins: this.coins, lives: this.lives }, () => { this.score = 0; this.coins = 0; this.lives = START_LIVES; this.loadLevel(0); this.beginLevel(); });
      return;
    }
    this.checkpoint = null;
    const pow = this.player.power;
    this.loadLevel(this.levelIndex + 1);
    this.player.setPower(pow, false);
    this.beginLevel();
  }

  // ----------------------------------------------------------- cámara y render
  updateCamera(dt, snap = false) {
    const p = this.player, c = this.cam, L = this.level;
    if (this.state !== 'title') {
      const lookTarget = p.dead ? c.look : p.facing * Math.min(1, Math.abs(p.vx) / PHYS.walkMax) * 2.2;
      c.look += (lookTarget - c.look) * Math.min(1, dt * 1.6);
      const tx = p.x + c.look;
      c.x = snap ? tx : c.x + (tx - c.x) * Math.min(1, dt * 6);
      const baseY = c.halfH - 1.2;
      let ty = Math.max(baseY, p.y + 1.0 - c.halfH * 0.25);
      if (p.dead) ty = c.y;
      c.y = snap ? ty : c.y + (ty - c.y) * Math.min(1, dt * 3.5);
    }
    c.x = Math.max(c.halfW, Math.min(L.w - c.halfW, c.x));
    c.minVisibleX = 0;
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT / 0.3);
      sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    this.camera.position.set(c.x + sx, c.y + 1.6 + sy, c.dist);
    this.camera.lookAt(c.x + sx * 0.5, c.y + sy * 0.5, 0);
  }
  syncAll(dt, skipPlayer) {
    if (!skipPlayer) this.player.syncModel(dt);
    for (const e of this.enemies) if (e.alive) e.syncModel(dt);
    for (const it of this.items) if (it.alive) it.syncModel(dt);
    for (const pl of this.platforms) pl.syncModel(dt);
    for (const c of this.checkpoints) c.syncModel(dt);
    if (this.goal) this.goal.syncModel(dt);
  }
  render(dt, simDt) {
    this.env.update(dt, this.cam.x, this.cam.y, this.clock, this.player);
    this.blocks.update(dt, this.clock, this.cam.x);
    this.particles.update(dt);
    this.post.render(dt);
  }
  updateHud() {
    this.hud.update({ score: this.score, coins: this.coins, world: this.level.def.id, time: this.timeLeft, lives: this.lives, levelName: this.level.name, power: this.player.power });
  }
}

const game = new Game();
game.start();
