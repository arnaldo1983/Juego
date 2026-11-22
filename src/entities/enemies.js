import { PHYS, SCORE, T, isBumpable } from '../config.js';
import { moveBody, overlap } from '../physics.js';
import { audio } from '../audio.js';
import * as M from './models.js';

class Entity {
  constructor(game, x, y, w, h) {
    this.game = game; this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0; this.onGround = false; this.alive = true; this.time = Math.random() * 10;
    this.model = null; this.dead = false; this.active = false;
  }
  attach(model) { this.model = model; this.game.scene.add(model.root); model.root.position.set(this.x, this.y, 0); }
  remove() { this.alive = false; if (this.model) this.game.scene.remove(this.model.root); }
  // muerte "volteada" (golpe de fuego, caparazón, estrella, bloque)
  flipKill(dir = 1, score = SCORE.stomp) {
    if (this.dead) return;
    this.dead = true; this.vy = 11; this.vx = dir * 2.5;
    this.game.addScore(score, this.x, this.y + this.h);
    this.game.particles.emit('stomp', this.x, this.y + this.h / 2);
    audio.sfx('kick');
  }
  updateDead(dt) {
    this.vy -= PHYS.gravity * 0.8 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.y < -4) this.remove();
  }
  sync(dt, state) { if (this.model) { this.model.root.position.set(this.x, this.y, 0); this.model.update(dt, state); } }
}

export class Walker extends Entity {
  constructor(game, x, y, w, h, speed) { super(game, x, y, w, h); this.vx = -speed; this.speed = speed; this.isEnemy = true; }
  walk(dt) {
    this.vy = Math.max(this.vy - PHYS.gravity * dt, -PHYS.maxFall);
    const res = moveBody(this, this.game.level, dt, { keepVx: true });
    if (res.wall) this.vx = -res.wall * Math.abs(this.vx);
    if (this.y < -3) this.remove();
    return res;
  }
}

export class Acorn extends Walker {
  constructor(game, x, y) { super(game, x, y, 0.82, 0.82, 2.1); this.squashT = -1; this.attach(M.createAcornModel()); }
  update(dt) {
    this.time += dt;
    if (this.dead) return this.updateDead(dt);
    if (this.squashT >= 0) { this.squashT += dt; if (this.squashT > 0.6) this.remove(); return; }
    this.walk(dt);
  }
  stomp(player) {
    this.squashT = 0; this.vx = 0;
    this.game.particles.emit('stomp', this.x, this.y + 0.4);
    return true;
  }
  get harmful() { return !this.dead && this.squashT < 0; }
  syncModel(dt) { this.sync(dt, { vx: this.vx, time: this.time, squashed: this.squashT >= 0, dead: this.dead }); }
}

export class Beetle extends Walker {
  constructor(game, x, y) { super(game, x, y, 0.82, 0.95, 1.9); this.shell = false; this.shellT = 0; this.attach(M.createBeetleModel()); this.kickGrace = 0; this.chain = 0; }
  get spinning() { return this.shell && Math.abs(this.vx) > 1; }
  update(dt) {
    this.time += dt;
    if (this.dead) return this.updateDead(dt);
    if (this.kickGrace > 0) this.kickGrace -= dt;
    if (this.shell && !this.spinning) {
      this.shellT += dt;
      if (this.shellT > 7) { this.shell = false; this.h = 0.95; this.vx = -this.speed * Math.sign(this.game.player.x - this.x || 1) * -1; }
    }
    const prevVx = this.vx;
    const res = this.walk(dt);
    if (this.spinning && res.wall) {
      // golpear bloques con el caparazón
      const tx = Math.floor(this.x + Math.sign(prevVx) * (this.w / 2 + 0.1)), ty = Math.floor(this.y + 0.4);
      if (isBumpable(this.game.level.get(tx, ty))) this.game.hitBlock(tx, ty, null);
      audio.sfx('bump');
      this.game.particles.emit('dust', this.x + Math.sign(prevVx) * 0.4, this.y + 0.3, { count: 4 });
    }
    // caparazón giratorio derriba enemigos
    if (this.spinning) {
      for (const e of this.game.enemies) {
        if (e !== this && e.alive && !e.dead && overlap(this, e)) { this.chain++; e.flipKill(Math.sign(this.vx), SCORE.kick * Math.min(8, this.chain)); }
      }
    }
  }
  stomp(player) {
    if (!this.shell) { this.shell = true; this.vx = 0; this.shellT = 0; this.h = 0.7; this.chain = 0; }
    else if (this.spinning) { this.vx = 0; this.shellT = 0; }
    else { this.kick(player); return true; }
    this.kickGrace = 0.2;
    return true;
  }
  kick(player) {
    const dir = player.x < this.x ? 1 : -1;
    this.vx = dir * 12.5; this.kickGrace = 0.25; this.chain = 0;
    audio.sfx('kick'); this.game.addScore(SCORE.kick, this.x, this.y + 1);
    this.game.particles.emit('stomp', this.x - dir * 0.3, this.y + 0.3);
    this.game.shake(0.15);
  }
  get harmful() { return !this.dead && (!this.shell || this.spinning) && this.kickGrace <= 0; }
  touchIdleShell(player) { if (this.shell && !this.spinning && this.kickGrace <= 0) { this.kick(player); return true; } return false; }
  syncModel(dt) { this.sync(dt, { vx: this.vx, time: this.time, shell: this.shell, shellSpin: this.spinning, waking: this.shell && !this.spinning ? Math.max(0, (this.shellT - 5) / 2) : 0, dead: this.dead }); }
}

export class Wasp extends Entity {
  constructor(game, x, y) { super(game, x, y, 0.8, 0.75); this.isEnemy = true; this.baseY = y + 0.5; this.vx = -1.6; this.attach(M.createWaspModel()); this.x0 = x; }
  update(dt) {
    this.time += dt;
    if (this.dead) return this.updateDead(dt);
    this.x += this.vx * dt;
    if (Math.abs(this.x - this.x0) > 4) this.vx = -Math.sign(this.x - this.x0) * Math.abs(this.vx);
    this.y = this.baseY + Math.sin(this.time * 2.2) * 1.6;
  }
  stomp() { this.dead = true; this.vy = 0; this.vx = 0; this.game.particles.emit('stomp', this.x, this.y + 0.4); return true; }
  get harmful() { return !this.dead; }
  syncModel(dt) { this.sync(dt, { vx: this.vx, time: this.time, dead: this.dead }); }
}

// Planta ígnea: emerge de una columna, escupe fuego hacia el jugador.
export class FirePlant extends Entity {
  constructor(game, x, y) {
    super(game, x, y, 0.7, 1.3); this.isEnemy = true; this.baseY = y; this.cycle = Math.random() * 2; this.out = 0; this.shot = false;
    this.attach(M.createFirePlantModel());
    if (this.model.root) this.model.root.renderOrder = -1;
  }
  update(dt) {
    this.time += dt;
    if (this.dead) { this.remove(); return; }
    this.cycle += dt;
    const p = this.game.player;
    const near = Math.abs(p.x - this.x) < 1.6;
    const c = this.cycle % 6;
    let target = c < 1 ? c : c < 3.5 ? 1 : c < 4.5 ? 1 - (c - 3.5) : 0;
    if (near && this.out < 0.05) { target = 0; this.cycle = 5; }
    this.out = target;
    if (c > 2 && c < 2.1 && !this.shot) { this.shot = true; this.game.spawnEnemyFire(this.x, this.y + 1.2, p.x, p.y + 0.6); }
    if (c < 1) this.shot = false;
    this.y = this.baseY - 1.35 * (1 - this.out);
  }
  stomp() { return false; }
  get harmful() { return this.out > 0.2; }
  syncModel(dt) { this.sync(dt, { time: this.time, out: this.out, dead: this.dead, aim: Math.sign(this.game.player.x - this.x) }); }
}

export class EnemyFire extends Entity {
  constructor(game, x, y, tx, ty) {
    super(game, x, y, 0.4, 0.4); this.isEnemy = true; this.immune = true;
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1; this.vx = dx / d * 5; this.vy = dy / d * 5;
    this.attach(M.createFireballModel());
  }
  update(dt) { this.time += dt; this.x += this.vx * dt; this.y += this.vy * dt; if (this.time > 4) this.remove(); }
  stomp() { return false; }
  flipKill() {}
  get harmful() { return true; }
  syncModel(dt) { this.sync(dt, { time: this.time, vx: this.vx }); }
}

export function createEnemy(game, s) {
  switch (s.type) {
    case 'acorn': return new Acorn(game, s.x, s.y);
    case 'beetle': return new Beetle(game, s.x, s.y);
    case 'wasp': return new Wasp(game, s.x, s.y);
    case 'fireplant': return new FirePlant(game, s.x + 0.5, s.y);
  }
  return null;
}
export { Entity };
