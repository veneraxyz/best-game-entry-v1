// NOVADRIFT tuning: every number that shapes how the game feels lives here,
// so balancing never means hunting through the update code.

export const VIEW = {
  width: 1280,
  height: 720,
  centerX: 640,
  centerY: 360,
};

export const STAR = {
  radius: 46,
  // The ship may never orbit closer than this; nearer than HEAT_START it burns.
  killRadius: 84,
  heatStart: 132,
  heatRate: 0.38, // heat per second while inside HEAT_START (~2.6s to burn)
  coolRate: 0.42, // heat lost per second while outside it
};

export const SHIP = {
  radius: 14,
  // Orbital speed is Kepler-like: angular velocity = orbitFlow / radius, so
  // diving close is fast and risky, drifting wide is slow and safe.
  orbitFlow: 265,
  minRadius: 92,
  maxRadius: 332,
  thrustOut: 96, // px/s outward while thrusting
  gravityIn: 58, // px/s inward while coasting
  steer: 0.42, // rad/s of angular push from the arrow keys
  steerDecay: 2.4, // how fast the angular push fades back to orbital speed
  hearts: 3,
  invulnerableSeconds: 2.0,
};

// The three shard rings: inner pays best because the star's heat is worst there.
export const RINGS = [
  { radius: 128, value: 50, hue: '#ffd166' },
  { radius: 200, value: 30, hue: '#7ef0c1' },
  { radius: 272, value: 20, hue: '#7ec8ff' },
];

export const SHARDS = {
  radius: 10,
  maxAlive: 14,
  spawnEvery: 0.85, // seconds between spawns while below maxAlive
  lifetime: 14, // seconds before a shard fades away
  drift: 0.05, // rad/s of slow drift along its ring
  comboWindow: 4.0, // seconds to chain the next pickup before the combo drops
  comboMax: 8,
};

export const ASTEROIDS = {
  radiusMin: 12,
  radiusMax: 27,
  speedMin: 62,
  speedMax: 150,
  spawnEvery: 1.55, // seconds at level 1; shrinks as levels rise
  spawnFloor: 0.7, // fastest spawn interval, reached at high levels
  orbiterFromLevel: 3, // slow ring-orbiting rocks join from this level
  orbiterChance: 0.3,
  grazeDistance: 34, // px beyond the rock's edge that still counts as a graze
  grazeScore: 25,
  grazeCooldown: 0.6, // seconds before the same rock can graze again
};

export const FLARES = {
  fromLevel: 2,
  warnSeconds: 1.4, // telegraph before the burst
  burstSeconds: 0.9,
  gapMin: 8,
  gapMax: 14, // seconds between flares, shrinking with level
  gapFloor: 5.5,
  width: 0.95, // radians of the danger wedge
  reach: 350, // the wedge reaches this far from the star's centre
};

export const POWERUPS = {
  spawnEvery: 19, // seconds between power-up orbs
  kinds: ['shield', 'magnet', 'slow'],
  radius: 13,
  lifetime: 11,
  shieldSeconds: 22,
  magnetSeconds: 11,
  magnetRange: 150,
  slowSeconds: 8,
  slowFactor: 0.55,
};

export const LEVELS = {
  pointsPerLevel: 600,
  asteroidSpeedGain: 0.06, // +6% rock speed per level
  spawnGain: 0.07, // spawn interval shrinks 7% per level
  // The star's palette shifts one step per level, so progress is visible.
  palettes: [
    { core: '#fff3c4', glow: '#ffb347', ring: '#ff9a3d' },
    { core: '#ffe9a8', glow: '#ff7a59', ring: '#ff5d73' },
    { core: '#fff0b8', glow: '#ff5da2', ring: '#c65dff' },
    { core: '#eaf6ff', glow: '#5db9ff', ring: '#5d7bff' },
    { core: '#eafff3', glow: '#5dffb0', ring: '#3ddc97' },
    { core: '#fff3c4', glow: '#ffd23d', ring: '#ff9a3d' },
  ],
};

export const JUICE = {
  shakeOnHit: 16,
  shakeOnFlare: 10,
  shakeDecay: 26, // shake pixels lost per second
  pickupParticles: 10,
  hitParticles: 34,
  flareParticles: 26,
  popupRise: 34, // px a score popup floats before fading
  popupSeconds: 1.1,
};

export const STORAGE = {
  bestKey: 'novadrift.best',
  mutedKey: 'novadrift.muted',
};
