import { PHYS, SCORE } from '../config.js';
import { moveBody } from '../physics.js';
import { audio } from '../audio.js';
import { Entity } from './enemies.js';
import * as M from './models.js';

export class Coin extends Entity {
  constructor(game, x, y) { super(game, x, y, 0.6, 0.8); this.attach(M.createCoinModel()); }
  update(dt) { this.time += dt; }
  collect() { this.game.collectCoin(this.x, this.y + 0.5); this.game.particles.emit('coin', this.x, this.y + 0.5); this.remove(); }
  syncModel(dt) { this.sync(dt, { time: this.time, popping: false }); }
}

// Moneda que salta de un bloque
export class PopCoin extends Entity {
  constructor(game, x, y) { super(game, x, y, 0.6, 0.8); this.vy = 15; this.attach(M.createCoinModel()); this.y0 = y; }
  update(dt) {
    this.time += dt; this.vy -= 50 * dt; this.y += this.vy * dt;
    if (this.vy < 0 && this.y < this.y0 + 1.2) { this.game.particles.emit('sparkle', this.x, this.y + 0.4); this.game.addScore(SCORE.coin, this.x, this.y + 0.6); this.remove(); }
  }
  syncModel(dt) { this.sync(dt, { time: this.time * 3, popping: true }); }
}

// Objetos de poder: 'fruit' | 'flower' | 'star' | 'oneup'
export class PowerItem extends Entity {
  constructor(game, x, y, kind) {
    super(game, x, y, 0.8, 0.8); this.kind = kind; this.emerge = 0; this.y0 = y;
    const f = { fruit: M.createFruitModel, flower: M.createFlowerModel, star: M.createStarModel, oneup: M.createOneUpModel }[kind];
    this.attach(f());
    this.moving = kind !== 'flower';
    audio.sfx('powerAppear');
  }
  update(dt) {
    this.time += dt;
    if (this.emerge < 1) {
      this.emerge = Math.min(1, this.emerge + dt / 0.75); this.y = this.y0 + this.emerge * 1.0 - 1.0 + 0.0;
      if (this.emerge >= 1) { this.y = this.y0; if (this.moving) this.vx = this.kind === 'star' ? 4 : 3.2; }
      return;
    }
    if (!this.moving) return;
    this.vy = Math.max(this.vy - PHYS.gravity * (this.kind === 'star' ? 0.55 : 1) * dt, -PHYS.maxFall);
    const res = moveBody(this, this.game.level, dt, { keepVx: true });
    if (res.wall) this.vx = -res.wall * Math.abs(this.vx);
    if (this.kind === 'star' && this.onGround) this.vy = 13;
    if (this.y < -3) this.remove();
  }
  bounce() { if (this.emerge >= 1 && this.moving) this.vy = 10; }
  syncModel(dt) { this.sync(dt, { time: this.time, emerge: this.emerge }); }
}

export class Fireball extends Entity {
  constructor(game, x, y, dir) { super(game, x, y - 0.2, 0.4, 0.4); this.vx = dir * 13; this.vy = -6; this.attach(M.createFireballModel()); this.bounces = 0; audio.sfx('fireball'); }
  update(dt) {
    this.time += dt;
    this.vy = Math.max(this.vy - 60 * dt, -14);
    const res = moveBody(this, this.game.level, dt, { keepVx: true });
    if (this.onGround) { this.vy = 9.5; this.bounces++; }
    if (res.wall || res.ceil || this.bounces > 8 || this.y < -2 || this.time > 3 || Math.abs(this.x - this.game.cam.x) > 16) this.explode(!!(res.wall || res.ceil));
    for (const e of this.game.enemies) {
      if (e.alive && !e.dead && !e.immune && Math.abs(e.x - this.x) < (e.w + this.w) / 2 && this.y < e.y + e.h && e.y < this.y + this.h) {
        e.flipKill(Math.sign(this.vx), SCORE.fire); this.explode(true); break;
      }
    }
  }
  explode(fx) { if (!this.alive) return; if (fx) { this.game.particles.emit('fire', this.x, this.y + 0.2); audio.sfx('fireHit'); } this.remove(); }
  syncModel(dt) { if (this.model) { this.model.root.position.set(this.x, this.y + 0.2, 0.2); this.model.update(dt, { time: this.time, vx: this.vx }); } }
}

// Plataforma móvil (sólida por arriba)
export class Platform extends Entity {
  constructor(game, x, y, axis) {
    super(game, x, y + 0.5, 3, 0.4); this.axis = axis; this.x0 = this.x; this.y0 = this.y; this.dx = 0; this.dy = 0;
    this.range = axis === 'h' ? 3.5 : 3; this.attach(M.createPlatformModel(3));
  }
  get top() { return this.y; }
  update(dt) {
    this.time += dt;
    const px = this.x, py = this.y;
    const s = Math.sin(this.time * 0.9);
    if (this.axis === 'h') this.x = this.x0 + s * this.range; else this.y = this.y0 + s * this.range;
    this.dx = this.x - px; this.dy = this.y - py;
  }
  syncModel(dt) { this.sync(dt, { time: this.time }); }
}

export class Goal extends Entity {
  constructor(game, x, y) { super(game, x, y, 0.4, 10); this.flagY = 1; this.attach(M.createGoalModel()); }
  update(dt) { this.time += dt; }
  syncModel(dt) { this.sync(dt, { time: this.time, flagY: this.flagY, raised: this.flagY > 0.99 }); }
}

export class Checkpoint extends Entity {
  constructor(game, x, y) { super(game, x, y, 0.5, 2); this.activeFlag = false; this.attach(M.createCheckpointModel()); }
  update(dt) { this.time += dt; }
  syncModel(dt) { this.sync(dt, { time: this.time, active: this.activeFlag }); }
}
