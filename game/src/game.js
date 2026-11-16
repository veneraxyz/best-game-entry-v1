// NOVADRIFT game: the state machine and the main loop. It owns the score,
// the screens (title / playing / paused / over), the juice (shake, popups,
// particles) and the rules that turn collisions into consequences.

import {
  ASTEROIDS, JUICE, LEVELS, POWERUPS, SHARDS, SHIP, STORAGE, VIEW,
} from './config.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { Spawner } from './spawner.js';
import {
  asteroidGone, asteroidPosition, makeParticle, makePopup, makeShip,
  polarToXY, shardPosition, stepShip,
} from './entities.js';
import { circlesHit, hitStar, inFlareWedge, inRect, isGraze, shipXY } from './collisions.js';

const TAU = Math.PI * 2;

function loadBest() {
  try {
    return Number(window.localStorage.getItem(STORAGE.bestKey)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(STORAGE.bestKey, String(score));
  } catch {
    // No storage, no persistence — the run still counts.
  }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.render = new Renderer(this.ctx);
    this.spawner = new Spawner();
    this.screen = 'title';
    this.dt = 0;
    this.time = 0;
    this.best = loadBest();
    this.newBest = false;
    // Buttons, in canvas coordinates (the renderer draws them here).
    this.startButton = { x: VIEW.centerX - 150, y: 414, w: 300, h: 62 };
    this.resumeButton = { x: VIEW.centerX - 130, y: 372, w: 260, h: 52 };
    this.retryButton = { x: VIEW.centerX - 150, y: 472, w: 300, h: 62 };
    this.resetRun();
    this.lastStamp = 0;
    this.raf = 0;
  }

  /** Fresh run state; the title screen also runs on this (attract mode). */
  resetRun() {
    this.ship = makeShip();
    this.shards = [];
    this.rocks = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.level = 1;
    this.shardsCollected = 0;
    this.maxCombo = 0;
    this.grazes = 0;
    this.shake = 0;
    this.slowFactor = 1;
    this.newBest = false; // a previous run's badge must never leak into this one
    this.spawner.reset();
    this.spawner.seedOpening(this.shards);
  }

  start() {
    this.resetRun();
    this.screen = 'playing';
    this.sound.unlock();
    this.sound.start();
    this.input.clearQueues();
  }

  togglePause() {
    if (this.screen === 'playing') {
      this.screen = 'paused';
    } else if (this.screen === 'paused') {
      this.screen = 'playing';
      this.input.clearQueues();
    }
  }

  endRun() {
    this.screen = 'over';
    this.ship.alive = false;
    this.burst(shipXY(this.ship), 40, '#ffd166');
    this.burst(shipXY(this.ship), 24, '#ff5d73');
    this.shake = JUICE.shakeOnHit;
    this.sound.gameOver();
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      saveBest(this.best);
    }
  }

  /** The loop: fixed wall-clock steps, clamped so a tab switch cannot jump the world. */
  loop = (stamp) => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.lastStamp) this.lastStamp = stamp;
    const rawDt = Math.min(0.05, (stamp - this.lastStamp) / 1000);
    this.lastStamp = stamp;
    this.dt = rawDt;
    this.time += rawDt;
    this.update(rawDt);
    this.render.frame(this);
  };

  run() {
    this.raf = requestAnimationFrame(this.loop);
  }

  update(rawDt) {
    this.handleGlobalKeys();
    if (this.screen === 'title') {
      this.updateAttract(rawDt);
      this.updateFx(rawDt);
      return;
    }
    if (this.screen === 'paused') {
      this.handlePauseClicks();
      return;
    }
    if (this.screen === 'over') {
      this.handleOverInput();
      this.updateFx(rawDt);
      return;
    }
    // Playing: slow-time bends the world, not the clock.
    const dt = rawDt * (this.ship.slow > 0 ? POWERUPS.slowFactor : 1);
    this.updatePlaying(dt, rawDt);
  }

  handleGlobalKeys() {
    if (this.input.wasPressed('m')) this.sound.toggleMuted();
    if (this.input.wasPressed('p') || this.input.wasPressed('escape')) {
      if (this.screen === 'playing' || this.screen === 'paused') this.togglePause();
    }
  }

  /** Title screen: the world drifts behind the panel — an attract mode. */
  updateAttract(dt) {
    const ship = this.ship;
    // A gentle sine autopilot: the ship breathes in and out on its own.
    ship.radius = 205 + Math.sin(this.time * 0.45) * 55;
    ship.angle += (SHIP.orbitFlow / ship.radius) * dt;
    const pos = shipXY(ship);
    ship.trail.push({ x: pos.x, y: pos.y });
    if (ship.trail.length > 22) ship.trail.shift();
    for (const shard of this.shards) shardPosition(shard, dt);
    this.shards = this.shards.filter((s) => s.age < s.life);
    if (this.shards.length < 9) {
      this.spawner.shardTimer -= dt;
      if (this.spawner.shardTimer <= 0) {
        this.spawner.shardTimer = 0.9;
        this.shards.push(makeAttractShard());
      }
    }
    if (this.input.wasPressed(' ') || this.input.wasPressed('enter')) this.start();
    for (const click of this.input.takeClicks()) {
      this.sound.unlock();
      if (inRect(click.x, click.y, this.startButton)) this.start();
    }
  }

  handlePauseClicks() {
    for (const click of this.input.takeClicks()) {
      if (inRect(click.x, click.y, this.resumeButton)) this.togglePause();
    }
  }

  handleOverInput() {
    if (this.input.wasPressed('r') || this.input.wasPressed(' ') || this.input.wasPressed('enter')) {
      this.start();
      return;
    }
    for (const click of this.input.takeClicks()) {
      if (inRect(click.x, click.y, this.retryButton)) this.start();
    }
  }

  updatePlaying(dt, rawDt) {
    const ship = this.ship;
    this.spawner.step(this, dt);
    const shipPos = stepShip(ship, this.input, dt);
    this.slowFactor = ship.slow > 0 ? POWERUPS.slowFactor : 1;

    // Combo decay.
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.collectShards(shipPos);
    this.collectPowerups(shipPos);
    this.checkRocks(shipPos, dt);
    this.checkFlare();
    if (ship.heat >= 1) {
      ship.heat = 0;
      this.damageShip(shipPos, 'BURNED');
    }
    if (hitStar(ship.radius)) {
      this.damageShip(shipPos, 'TOO CLOSE');
    }

    // Level-ups: every 400 points the orbit rises.
    const level = 1 + Math.floor(this.score / LEVELS.pointsPerLevel);
    if (level > this.level) {
      this.level = level;
      this.sound.levelUp();
      this.addPopup(VIEW.centerX, 150, 'ORBIT RISES — LEVEL ' + level, '#7ef0c1');
    }

    this.updateFx(rawDt);
    this.shake = Math.max(0, this.shake - JUICE.shakeDecay * rawDt);
  }

  collectShards(shipPos) {
    const ship = this.ship;
    const kept = [];
    for (const shard of this.shards) {
      const pos = shardPosition(shard, this.dt);
      // Magnet bends nearby shards toward the ship: nudge their ring
      // radius and their angle toward the ship's own orbit.
      if (ship.magnet > 0) {
        const dx = shipPos.x - pos.x;
        const dy = shipPos.y - pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < POWERUPS.magnetRange && dist > 1) {
          const pull = (1 - dist / POWERUPS.magnetRange) * 240 * this.dt;
          shard.radius += Math.sign(ship.radius - shard.radius) * pull;
          let gap = ship.angle - shard.angle;
          while (gap > Math.PI) gap -= TAU;
          while (gap < -Math.PI) gap += TAU;
          shard.angle += Math.sign(gap) * Math.min(Math.abs(gap), (pull / Math.max(60, shard.radius)));
        }
      }
      const hit = circlesHit(shipPos.x, shipPos.y, SHIP.radius + 4, pos.x, pos.y, shard.radiusPx);
      if (hit) {
        this.combo = Math.min(SHARDS.comboMax, this.combo + 1);
        this.comboTimer = SHARDS.comboWindow;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const gained = shard.value * this.combo;
        this.score += gained;
        this.shardsCollected++;
        this.sound.pickup(this.combo);
        this.burst(pos, JUICE.pickupParticles, shard.hue);
        this.addPopup(pos.x, pos.y - 18, '+' + gained + (this.combo > 1 ? '  x' + this.combo : ''), shard.hue);
        continue;
      }
      if (shard.age < shard.life) kept.push(shard);
    }
    this.shards = kept;
  }

  collectPowerups(shipPos) {
    const ship = this.ship;
    const kept = [];
    for (const orb of this.powerups) {
      const pos = polarToXY(orb.angle, orb.radius);
      orb.age += this.dt;
      if (circlesHit(shipPos.x, shipPos.y, SHIP.radius + 4, pos.x, pos.y, orb.radiusPx)) {
        this.sound.powerup();
        if (orb.kind === 'shield') {
          ship.shield = POWERUPS.shieldSeconds;
          this.addPopup(pos.x, pos.y - 18, 'SHIELD UP', '#5ce1ff');
        } else if (orb.kind === 'magnet') {
          ship.magnet = POWERUPS.magnetSeconds;
          this.addPopup(pos.x, pos.y - 18, 'MAGNET', '#ffd166');
        } else {
          ship.slow = POWERUPS.slowSeconds;
          this.addPopup(pos.x, pos.y - 18, 'SLOW TIME', '#c65dff');
        }
        this.burst(pos, 14, '#ffffff');
        continue;
      }
      if (orb.age < orb.life) kept.push(orb);
    }
    this.powerups = kept;
  }

  checkRocks(shipPos, dt) {
    const ship = this.ship;
    const kept = [];
    for (const rock of this.rocks) {
      const pos = asteroidPosition(rock, dt);
      const radius = rock.kind === 'orbiter' ? rock.radiusPx : rock.radius;
      if (ship.invulnerable <= 0 && circlesHit(shipPos.x, shipPos.y, SHIP.radius, pos.x, pos.y, radius)) {
        this.damageShip(shipPos, 'HULL HIT');
        // The rock shatters too — the hit always costs the rock.
        this.burst(pos, 18, '#8d7f9e');
        continue;
      }
      if (
        ship.invulnerable <= 0 &&
        this.time - rock.grazeAt > ASTEROIDS.grazeCooldown &&
        isGraze(shipPos.x, shipPos.y, pos.x, pos.y, radius)
      ) {
        rock.grazeAt = this.time;
        this.grazes++;
        this.score += ASTEROIDS.grazeScore;
        this.sound.graze();
        this.addPopup(shipPos.x, shipPos.y - 24, 'GRAZE +' + ASTEROIDS.grazeScore, '#7ec8ff');
      }
      if (!asteroidGone(rock)) kept.push(rock);
    }
    this.rocks = kept;
  }

  checkFlare() {
    const flare = this.spawner.flareActive;
    if (!flare || flare.phase !== 'burst') return;
    const ship = this.ship;
    if (ship.invulnerable > 0) return;
    if (inFlareWedge(ship.angle, ship.radius, flare)) {
      this.damageShip(shipXY(ship), 'FLARE BURN');
    }
  }

  /** Called by the spawner when a flare starts warning. */
  onFlareWarn() {
    this.sound.flareWarn();
  }

  /** Called by the spawner when a flare bursts. */
  onFlareBurst(flare) {
    this.sound.flareBurst();
    this.shake = Math.max(this.shake, JUICE.shakeOnFlare);
    const pos = polarToXY(flare.angle, 240);
    this.burst(pos, JUICE.flareParticles, '#ff7a59');
  }

  damageShip(shipPos, why) {
    const ship = this.ship;
    if (ship.invulnerable > 0 || !ship.alive) return;
    if (ship.shield > 0) {
      ship.shield = 0;
      ship.invulnerable = 1.2;
      this.sound.shieldBreak();
      this.burst(shipPos, 22, '#5ce1ff');
      this.addPopup(shipPos.x, shipPos.y - 24, 'SHIELD DOWN', '#5ce1ff');
      return;
    }
    ship.hearts -= 1;
    ship.invulnerable = SHIP.invulnerableSeconds;
    this.combo = 0;
    this.shake = JUICE.shakeOnHit;
    this.sound.hit();
    this.burst(shipPos, JUICE.hitParticles, '#ff5d73');
    this.addPopup(shipPos.x, shipPos.y - 24, why, '#ff5d73');
    if (ship.hearts <= 0) this.endRun();
  }

  /** Where a rock is drawn: orbiters need their polar position. */
  rockPosition(rock) {
    if (rock.kind === 'orbiter') return polarToXY(rock.angle, rock.radius);
    return { x: rock.x, y: rock.y };
  }

  burst(pos, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const speed = 30 + Math.random() * 190;
      this.particles.push(makeParticle(
        pos.x, pos.y,
        Math.cos(a) * speed, Math.sin(a) * speed,
        0.4 + Math.random() * 0.6,
        color,
        1.5 + Math.random() * 3,
      ));
    }
  }

  addPopup(x, y, text, color) {
    this.popups.push(makePopup(x, y, text, color));
    if (this.popups.length > 12) this.popups.shift();
  }

  updateFx(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.6 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const pop of this.popups) pop.age += dt;
    this.popups = this.popups.filter((pop) => pop.age < 1.1);
  }

  /** A small read-only snapshot for playtests and screenshots. */
  debugState() {
    return {
      screen: this.screen,
      score: this.score,
      best: this.best,
      hearts: this.ship.hearts,
      combo: this.combo,
      level: this.level,
      shipRadius: Math.round(this.ship.radius),
      shipAngle: this.ship.angle,
      ship: shipXY(this.ship),
      heat: this.ship.heat,
      shards: this.shards.length,
      shardPositions: this.shards.slice(0, 14).map((s) => ({
        angle: s.angle,
        radius: Math.round(s.radius),
        value: s.value,
      })),
      rocks: this.rocks.length,
      rockPositions: this.rocks.slice(0, 12).map((r) => {
        const p = this.rockPosition(r);
        return { x: Math.round(p.x), y: Math.round(p.y), r: r.kind === 'orbiter' ? r.radiusPx : r.radius };
      }),
      flare: this.spawner.flareActive
        ? { phase: this.spawner.flareActive.phase, angle: this.spawner.flareActive.angle }
        : null,
      shield: this.ship.shield,
      magnet: this.ship.magnet,
      slow: this.ship.slow,
    };
  }
}

function makeAttractShard() {
  // Title-screen shards: same factory shape, spawned by the attract loop.
  return {
    kind: 'shard',
    angle: Math.random() * Math.PI * 2,
    radius: 128 + Math.floor(Math.random() * 3) * 72,
    value: 30,
    hue: '#7ef0c1',
    age: 0,
    life: 14,
    radiusPx: 10,
    pulse: Math.random() * Math.PI * 2,
  };
}
