import { PHYS, T } from '../config.js';
import { moveBody } from '../physics.js';
import { createPlayerModel } from './playerModel.js';
import { audio } from '../audio.js';

const SMALL_H = 0.92, BIG_H = 1.8, CROUCH_H = 1.0, W = 0.72;

export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.x = x; this.y = y; this.w = W; this.h = SMALL_H;
    this.vx = 0; this.vy = 0; this.onGround = false;
    this.facing = 1; this.power = 0;
    this.coyote = 0; this.jumpBuf = 0; this.jumping = false;
    this.invuln = 0; this.star = 0; this.dead = false; this.deadT = 0;
    this.skid = false; this.crouch = false; this.throwT = 0; this.growT = -1;
    this.control = true; this.climbing = false; this.victory = false; this.time = 0;
    this.platform = null; this.stompChain = 0;
    this.model = createPlayerModel();
    game.scene.add(this.model.root);
  }
  setPower(p, anim = true) {
    const prev = this.power;
    this.power = p;
    this.h = p > 0 ? BIG_H : SMALL_H;
    if (anim && p !== prev) this.growT = 0;
    // Evitar quedar atrapado al crecer bajo un techo
    if (p > 0 && prev === 0) {
      const L = this.game.level;
      const x0 = Math.floor(this.x - W / 2 + 0.02), x1 = Math.floor(this.x + W / 2 - 0.02);
      for (let tx = x0; tx <= x1; tx++) if (L.isSolid(tx, Math.floor(this.y + BIG_H - 0.05))) { this.crouch = true; this.h = CROUCH_H; }
    }
  }
  hurt() {
    if (this.invuln > 0 || this.star > 0 || this.dead || this.victory) return;
    if (this.power > 0) {
      this.setPower(this.power === 2 ? 1 : 0);
      this.invuln = 2.2;
      audio.sfx('powerDown');
      this.game.hitStop(0.12);
      this.game.shake(0.25);
    } else this.die();
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.vx = 0; this.vy = 0; this.star = 0; this.invuln = 0;
    this.game.onPlayerDeath();
  }
  get body() { return this; }

  update(dt, input) {
    this.time += dt;
    const g = this.game;
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 0.55) { this.vy -= PHYS.gravity * 0.75 * dt; this.y += this.vy * dt; }
      else if (this.deadT > 0.5 && this.vy === 0) this.vy = 17;
      return;
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.star > 0) { this.star -= dt; if (this.star <= 0) g.onStarEnd(); }
    if (this.throwT > 0) this.throwT -= dt;
    if (this.growT >= 0) { this.growT += dt / 0.7; if (this.growT >= 1) this.growT = -1; }

    let left = false, right = false, down = false, jumpHeld = false, jumpPressed = false, runHeld = false, runPressed = false;
    if (this.control) {
      left = input.state.left; right = input.state.right; down = input.state.down;
      jumpHeld = input.state.jump; jumpPressed = input.pressed('jump');
      runHeld = input.state.run; runPressed = input.pressed('run');
    } else if (this.autoWalk) { right = true; }

    // Agacharse (solo grande y en el suelo)
    const L = g.level;
    const wantCrouch = down && this.onGround && this.power > 0;
    if (wantCrouch && !this.crouch) { this.crouch = true; this.h = CROUCH_H; }
    else if (!down && this.crouch && this.power > 0) {
      // levantarse solo si hay hueco
      const x0 = Math.floor(this.x - W / 2 + 0.02), x1 = Math.floor(this.x + W / 2 - 0.02);
      let free = true;
      for (let tx = x0; tx <= x1; tx++) if (L.isSolid(tx, Math.floor(this.y + BIG_H - 0.05))) free = false;
      if (free) { this.crouch = false; this.h = BIG_H; }
    }
    if (this.power === 0 && this.crouch) { this.crouch = false; this.h = SMALL_H; }

    // Movimiento horizontal
    let dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (this.crouch && this.onGround) dir = 0;
    const max = runHeld ? PHYS.runMax : PHYS.walkMax;
    this.skid = false;
    if (dir !== 0) {
      if (this.onGround && this.vx !== 0 && Math.sign(this.vx) !== dir) {
        this.vx += dir * PHYS.skidDecel * dt; this.skid = Math.abs(this.vx) > 2.5;
        if (this.skid && Math.random() < 0.5) g.particles.emit('skid', this.x - this.facing * 0.2, this.y);
      } else {
        const acc = this.onGround ? (runHeld ? PHYS.accelRun : PHYS.accelGround) : PHYS.accelAir;
        if (Math.abs(this.vx) < max || Math.sign(this.vx) !== dir) this.vx += dir * acc * dt;
        if (Math.abs(this.vx) > max) {
          // al soltar correr, frenar suave hasta la velocidad de paseo
          const over = Math.abs(this.vx) - max;
          this.vx = Math.sign(this.vx) * (max + Math.max(0, over - PHYS.decelGround * 0.5 * dt));
        }
      }
      if (this.onGround || Math.abs(this.vx) < 1) this.facing = dir;
    } else if (this.onGround) {
      const d = PHYS.decelGround * (this.crouch ? 0.6 : 1) * dt;
      this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
    } else {
      this.vx *= 1 - 0.6 * dt;
    }
    if (this.onGround && this.vx !== 0 && dir !== 0 && Math.sign(this.vx) === dir) this.facing = dir;

    // Salto con coyote time y buffer
    if (this.onGround) { this.coyote = PHYS.coyote; this.stompChain = 0; } else this.coyote -= dt;
    if (jumpPressed) this.jumpBuf = PHYS.jumpBuffer; else this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = PHYS.jumpVel + PHYS.jumpRunBonus * Math.min(1, Math.abs(this.vx) / PHYS.runMax);
      this.jumping = true; this.jumpBuf = 0; this.coyote = 0; this.onGround = false; this.platform = null;
      audio.sfx(this.power > 0 ? 'jumpBig' : 'jump');
      g.particles.emit('dust', this.x, this.y, { count: 6 });
    }
    // Gravedad variable
    let grav = PHYS.gravity;
    if (this.vy > 0 && this.jumping && jumpHeld) grav = this.vy < 3.5 ? PHYS.gravityApex : PHYS.gravityHold;
    if (!jumpHeld) this.jumping = false;
    this.vy = Math.max(this.vy - grav * dt, -PHYS.maxFall);

    // Bola de fuego
    if (runPressed && this.power === 2 && !this.crouch && g.countFireballs() < 2) {
      g.spawnFireball(this.x + this.facing * 0.5, this.y + this.h * 0.55, this.facing);
      this.throwT = 0.25;
    }

    // Plataforma móvil: arrastrar
    if (this.platform) { this.x += this.platform.dx; this.y = this.platform.top; }

    const vyBefore = this.vy;
    const res = moveBody(this, L, dt, { cornerCorrect: true });
    if (res.ceil) {
      g.hitBlock(res.ceil.tx, res.ceil.ty, this);
      this.jumping = false;
    }
    if (res.landed && vyBefore < -8) { g.particles.emit('land', this.x, this.y, { strength: Math.min(1, -vyBefore / PHYS.maxFall) }); audio.sfx('land'); }
    g.resolvePlatforms(this);
    // Límite izquierdo de la cámara (no volver atrás fuera de pantalla)
    const minX = g.cam.minVisibleX + W / 2;
    if (this.x < minX) { this.x = minX; if (this.vx < 0) this.vx = 0; }
    if (this.x > L.w - 0.5) this.x = L.w - 0.5;

    // Peligros de casilla
    const tFeet = L.get(Math.floor(this.x), Math.floor(this.y - 0.05));
    const tBody = L.get(Math.floor(this.x), Math.floor(this.y + 0.3));
    if (tBody === T.LAVA || tFeet === T.LAVA && this.y - Math.floor(this.y) < 0.6) { g.particles.emit('lava', this.x, this.y); this.die(); return; }
    if (tBody === T.SPIKES) this.hurt();
    if (this.y < -2.5) { this.die(); return; }
  }

  syncModel(dt) {
    const m = this.model;
    m.root.position.set(this.x, this.y, 0);
    m.update(dt, {
      vx: this.vx, vy: this.vy, onGround: this.onGround, facing: this.facing, speed: Math.abs(this.vx),
      running: Math.abs(this.vx) > PHYS.walkMax + 0.5, skid: this.skid, crouch: this.crouch, power: this.power,
      invuln: this.invuln > 0, star: this.star > 0, time: this.time, dying: this.dead, victory: this.victory,
      climbing: this.climbing, throwing: this.throwT > 0, growT: this.growT, runMax: PHYS.runMax,
    });
  }
  dispose() { this.game.scene.remove(this.model.root); }
}
