// NOVADRIFT spawner: when things appear, and how the pressure grows with
// the level. The game owns the arrays; this owns the timers and the odds.

import { ASTEROIDS, FLARES, POWERUPS, SHARDS } from './config.js';
import { makeAsteroid, makeFlare, makeOrbiter, makePowerup, makeShard } from './entities.js';

export class Spawner {
  constructor() {
    this.shardTimer = 0;
    this.rockTimer = 1.2;
    this.flareTimer = 7;
    this.powerTimer = 12;
    this.flareActive = null; // the flare currently warning or bursting
  }

  reset() {
    this.shardTimer = 0;
    this.rockTimer = 1.2;
    this.flareTimer = 7;
    this.powerTimer = 12;
    this.flareActive = null;
  }

  /** Seed the opening board so the first seconds already have a goal. */
  seedOpening(shards) {
    for (let i = 0; i < 9; i++) shards.push(makeShard());
  }

  /** One step: maybe spawn shards, rocks, a flare or a power-up. */
  step(state, dt) {
    const level = state.level;

    this.shardTimer -= dt;
    if (this.shardTimer <= 0 && state.shards.length < SHARDS.maxAlive) {
      state.shards.push(makeShard());
      this.shardTimer = SHARDS.spawnEvery;
    }

    this.rockTimer -= dt;
    if (this.rockTimer <= 0) {
      const fromOrbiters =
        level >= ASTEROIDS.orbiterFromLevel && Math.random() < ASTEROIDS.orbiterChance;
      state.rocks.push(fromOrbiters ? makeOrbiter(level) : makeAsteroid(level));
      const interval = Math.max(
        ASTEROIDS.spawnFloor,
        ASTEROIDS.spawnEvery * Math.pow(1 - 0.07, level - 1),
      );
      this.rockTimer = interval * (0.75 + Math.random() * 0.5);
    }

    // Flares: one at a time, warned before they burst.
    if (this.flareActive) {
      this.flareActive.timer -= dt;
      if (this.flareActive.phase === 'warn' && this.flareActive.timer <= 0) {
        this.flareActive.phase = 'burst';
        this.flareActive.timer = FLARES.burstSeconds;
        state.onFlareBurst(this.flareActive);
      } else if (this.flareActive.phase === 'burst' && this.flareActive.timer <= 0) {
        this.flareActive = null;
      }
    } else if (level >= FLARES.fromLevel) {
      this.flareTimer -= dt;
      if (this.flareTimer <= 0) {
        this.flareActive = makeFlare();
        state.onFlareWarn(this.flareActive);
        const gap = Math.max(
          FLARES.gapFloor,
          FLARES.gapMax - (level - FLARES.fromLevel) * 0.8,
        );
        this.flareTimer = FLARES.gapMin + Math.random() * (gap - FLARES.gapMin);
      }
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      state.powerups.push(makePowerup());
      this.powerTimer = POWERUPS.spawnEvery * (0.8 + Math.random() * 0.4);
    }
  }
}
