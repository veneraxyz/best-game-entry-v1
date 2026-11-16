// NOVADRIFT entities: plain objects the game moves, plus the small helpers
// that move them. No drawing here (render.js owns that) and no spawning rules
// (spawner.js owns those) — these are the nouns of the game.

import { ASTEROIDS, FLARES, POWERUPS, RINGS, SHARDS, SHIP, STAR, VIEW } from './config.js';

export function polarToXY(angle, radius) {
  return {
    x: VIEW.centerX + Math.cos(angle) * radius,
    y: VIEW.centerY + Math.sin(angle) * radius,
  };
}

/** The player's ember-ship: an angle, an orbit radius and a radial velocity. */
export function makeShip() {
  return {
    angle: -Math.PI / 2,
    radius: 205,
    steerPush: 0, // extra angular velocity from the arrow keys
    hearts: SHIP.hearts,
    heat: 0, // 0..1; full heat burns a heart
    invulnerable: 0, // seconds of post-hit grace left
    shield: 0, // seconds of shield left
    magnet: 0, // seconds of magnet left
    slow: 0, // seconds of slow-time left
    trail: [], // recent positions, for the engine trail
    alive: true,
  };
}

/** A light shard on one of the three rings. */
export function makeShard() {
  const ring = RINGS[Math.floor(Math.random() * RINGS.length)];
  return {
    kind: 'shard',
    angle: Math.random() * Math.PI * 2,
    radius: ring.radius + (Math.random() * 24 - 12),
    value: ring.value,
    hue: ring.hue,
    age: 0,
    life: SHARDS.lifetime,
    radiusPx: SHARDS.radius,
    pulse: Math.random() * Math.PI * 2,
  };
}

/** A power-up orb: shield, magnet or slow-time. */
export function makePowerup() {
  const ring = RINGS[Math.floor(Math.random() * RINGS.length)];
  const kind = POWERUPS.kinds[Math.floor(Math.random() * POWERUPS.kinds.length)];
  return {
    kind,
    angle: Math.random() * Math.PI * 2,
    radius: ring.radius,
    age: 0,
    life: POWERUPS.lifetime,
    radiusPx: POWERUPS.radius,
    pulse: Math.random() * Math.PI * 2,
  };
}

/** A crossing rock: spawns outside the disc and flies a chord through it. */
export function makeAsteroid(level) {
  const angle = Math.random() * Math.PI * 2;
  const from = polarToXY(angle, 470);
  const aim = polarToXY(angle + Math.PI + (Math.random() * 1.2 - 0.6), Math.random() * 130);
  const dx = aim.x - from.x;
  const dy = aim.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed =
    (ASTEROIDS.speedMin + Math.random() * (ASTEROIDS.speedMax - ASTEROIDS.speedMin)) *
    (1 + (level - 1) * 0.06);
  return {
    kind: 'crossing',
    x: from.x,
    y: from.y,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    radius: ASTEROIDS.radiusMin + Math.random() * (ASTEROIDS.radiusMax - ASTEROIDS.radiusMin),
    spin: Math.random() * 2.4 - 1.2,
    rot: Math.random() * Math.PI * 2,
    grazeAt: -10, // last graze time, so one rock pays once per pass
    seed: Math.random() * 1000, // stable lumpiness for its drawn shape
  };
}

/** A slow rock that circles the star on a fixed orbit. */
export function makeOrbiter(level) {
  const radius = 150 + Math.random() * 160;
  const clockwise = Math.random() < 0.5;
  return {
    kind: 'orbiter',
    angle: Math.random() * Math.PI * 2,
    radius,
    // Orbiters drift against the ship's flow, so meetings are head-on.
    omega: (clockwise ? 1 : -1) * (0.1 + Math.random() * 0.12 + level * 0.008),
    radiusPx: ASTEROIDS.radiusMin + Math.random() * 10,
    spin: Math.random() * 2 - 1,
    rot: Math.random() * Math.PI * 2,
    grazeAt: -10,
    seed: Math.random() * 1000,
  };
}

/** A solar flare: a telegraphed wedge of the star's fire. */
export function makeFlare() {
  return {
    angle: Math.random() * Math.PI * 2,
    width: FLARES.width,
    phase: 'warn', // 'warn' then 'burst' then gone
    timer: FLARES.warnSeconds,
  };
}

/** One spark of a burst: position, velocity, life, colour. */
export function makeParticle(x, y, vx, vy, life, color, size) {
  return { x, y, vx, vy, life, maxLife: life, color, size };
}

/** Floating score text that rises and fades. */
export function makePopup(x, y, text, color) {
  return { x, y, text, color, age: 0 };
}

/** Move the ship one step: thrust pushes out, gravity pulls in, steering bends the orbit. */
export function stepShip(ship, input, dt) {
  if (input.thrusting) {
    ship.radius += SHIP.thrustOut * dt;
  } else {
    ship.radius -= SHIP.gravityIn * dt;
  }
  ship.radius = Math.max(SHIP.minRadius, Math.min(SHIP.maxRadius, ship.radius));

  ship.steerPush += input.steer * SHIP.steer * dt * 3;
  ship.steerPush *= Math.max(0, 1 - SHIP.steerDecay * dt);
  ship.steerPush = Math.max(-SHIP.steer, Math.min(SHIP.steer, ship.steerPush));

  const omega = SHIP.orbitFlow / ship.radius + ship.steerPush;
  ship.angle += omega * dt;

  // Heat: diving close to the star cooks the hull.
  if (ship.radius < STAR.heatStart) {
    ship.heat = Math.min(1, ship.heat + STAR.heatRate * dt);
  } else {
    ship.heat = Math.max(0, ship.heat - STAR.coolRate * dt);
  }

  ship.invulnerable = Math.max(0, ship.invulnerable - dt);
  ship.shield = Math.max(0, ship.shield - dt);
  ship.magnet = Math.max(0, ship.magnet - dt);
  ship.slow = Math.max(0, ship.slow - dt);

  const pos = polarToXY(ship.angle, ship.radius);
  ship.trail.push({ x: pos.x, y: pos.y });
  if (ship.trail.length > 22) ship.trail.shift();
  return pos;
}

/** Where a shard sits right now, drifting slowly along its ring. */
export function shardPosition(shard, dt) {
  shard.age += dt;
  shard.angle += SHARDS.drift * dt;
  return polarToXY(shard.angle, shard.radius);
}

/** Where an asteroid sits right now. */
export function asteroidPosition(rock, dt) {
  if (rock.kind === 'orbiter') {
    rock.angle += rock.omega * dt;
    rock.rot += rock.spin * dt;
    return polarToXY(rock.angle, rock.radius);
  }
  rock.x += rock.vx * dt;
  rock.y += rock.vy * dt;
  rock.rot += rock.spin * dt;
  return { x: rock.x, y: rock.y };
}

/** True when a crossing rock has left the disc for good. */
export function asteroidGone(rock) {
  if (rock.kind === 'orbiter') return false;
  const dx = rock.x - VIEW.centerX;
  const dy = rock.y - VIEW.centerY;
  return Math.hypot(dx, dy) > 560;
}
