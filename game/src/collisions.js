// NOVADRIFT collisions: pure geometry, no game state. Every check answers
// one question about two shapes; the game decides what a "yes" costs.

import { ASTEROIDS, FLARES, SHIP, STAR, VIEW } from './config.js';

/** Circle against circle. */
export function circlesHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

/** Is the ship close enough to a rock to graze it (near miss, no touch)? */
export function isGraze(shipX, shipY, rockX, rockY, rockRadius) {
  const dx = shipX - rockX;
  const dy = shipY - rockY;
  const dist = Math.hypot(dx, dy);
  return dist < rockRadius + SHIP.radius + ASTEROIDS.grazeDistance;
}

/** Smallest angular distance between two angles, in radians. */
function angleGap(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/** Is the ship inside a bursting flare's wedge? */
export function inFlareWedge(shipAngle, shipRadius, flare) {
  if (flare.phase !== 'burst') return false;
  if (shipRadius > FLARES.reach) return false;
  return angleGap(shipAngle, flare.angle) < flare.width / 2;
}

/** Has the ship fallen into the star itself? */
export function hitStar(shipRadius) {
  return shipRadius <= STAR.killRadius;
}

/** Is a point inside a screen rectangle (for canvas buttons)? */
export function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** The ship's screen position from its orbit. */
export function shipXY(ship) {
  return {
    x: VIEW.centerX + Math.cos(ship.angle) * ship.radius,
    y: VIEW.centerY + Math.sin(ship.angle) * ship.radius,
  };
}
