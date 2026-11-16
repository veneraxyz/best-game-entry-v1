// NOVADRIFT render: everything the player sees, drawn on one canvas. The
// renderer reads the game state and draws it; it never changes the state.

import { LEVELS, RINGS, SHIP, STAR, VIEW } from './config.js';
import { polarToXY } from './entities.js';
import { shipXY } from './collisions.js';

const TAU = Math.PI * 2;

function paletteFor(level) {
  return LEVELS.palettes[(level - 1) % LEVELS.palettes.length];
}

/** A stable starfield: generated once, drawn every frame. */
export function makeStarfield(count) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * VIEW.width,
      y: Math.random() * VIEW.height,
      r: Math.random() * 1.4 + 0.3,
      tw: Math.random() * TAU,
      depth: 0.3 + Math.random() * 0.7,
    });
  }
  return stars;
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.stars = makeStarfield(170);
    this.time = 0;
  }

  /** Draw one whole frame: world first, then HUD, then the screen overlay. */
  frame(game) {
    const ctx = this.ctx;
    this.time += game.dt;
    ctx.save();
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    this.applyShake(game);
    this.drawBackground();
    this.drawRings();
    this.drawFlares(game);
    this.drawShards(game);
    this.drawPowerups(game);
    this.drawRocks(game);
    this.drawStar(game);
    this.drawShip(game);
    this.drawParticles(game);
    this.drawPopups(game);
    ctx.restore();
    if (game.screen === 'playing' || game.screen === 'paused') this.drawHud(game);
    if (game.screen === 'title') this.drawTitle(game);
    if (game.screen === 'paused') this.drawPaused(game);
    if (game.screen === 'over') this.drawGameOver(game);
  }

  applyShake(game) {
    if (game.shake <= 0.2) return;
    const ctx = this.ctx;
    const m = game.shake;
    ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
  }

  drawBackground() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(
      VIEW.centerX, VIEW.centerY, 60,
      VIEW.centerX, VIEW.centerY, 640,
    );
    grad.addColorStop(0, '#0d1128');
    grad.addColorStop(0.55, '#080b1c');
    grad.addColorStop(1, '#05060f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (const star of this.stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 1.7 + star.tw));
      ctx.globalAlpha = a * star.depth;
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawRings() {
    const ctx = this.ctx;
    for (const ring of RINGS) {
      ctx.strokeStyle = 'rgba(150, 180, 255, 0.13)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.arc(VIEW.centerX, VIEW.centerY, ring.radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawStar(game) {
    const ctx = this.ctx;
    const pal = paletteFor(game.level);
    const pulse = 1 + 0.045 * Math.sin(this.time * 2.3);
    const r = STAR.radius * pulse;
    const glow = ctx.createRadialGradient(
      VIEW.centerX, VIEW.centerY, r * 0.3,
      VIEW.centerX, VIEW.centerY, r * 3.4,
    );
    glow.addColorStop(0, pal.glow);
    glow.addColorStop(0.35, pal.glow + '55');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(VIEW.centerX, VIEW.centerY, r * 3.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.arc(VIEW.centerX, VIEW.centerY, r, 0, TAU);
    ctx.fill();
    // Hot rim and a few surface freckles, so the star feels alive.
    ctx.strokeStyle = pal.ring;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(VIEW.centerX, VIEW.centerY, r * 0.82, this.time * 0.4, this.time * 0.4 + 4.2);
    ctx.stroke();
    ctx.fillStyle = pal.ring;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.9 + this.time * 0.25;
      const d = r * 0.45;
      ctx.beginPath();
      ctx.arc(VIEW.centerX + Math.cos(a) * d, VIEW.centerY + Math.sin(a) * d, 4.5, 0, TAU);
      ctx.fill();
    }
  }

  drawFlares(game) {
    const ctx = this.ctx;
    const flare = game.spawner.flareActive;
    if (!flare) return;
    const warn = flare.phase === 'warn';
    const alpha = warn ? 0.16 + 0.1 * Math.sin(this.time * 14) : 0.55;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = warn ? '#ffcf5c' : '#ff5d3d';
    ctx.beginPath();
    ctx.moveTo(VIEW.centerX, VIEW.centerY);
    ctx.arc(
      VIEW.centerX, VIEW.centerY, 350,
      flare.angle - flare.width / 2, flare.angle + flare.width / 2,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = warn ? 'rgba(255, 207, 92, 0.8)' : 'rgba(255, 120, 70, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      VIEW.centerX, VIEW.centerY, 350,
      flare.angle - flare.width / 2, flare.angle + flare.width / 2,
    );
    ctx.stroke();
    if (warn) {
      // Inside the wedge (radius 300), so the label stays on screen even
      // when the flare points straight up or down.
      const pos = polarToXY(flare.angle, 300);
      ctx.fillStyle = '#ffd166';
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('! FLARE !', pos.x, pos.y);
    }
  }

  drawShards(game) {
    const ctx = this.ctx;
    for (const shard of game.shards) {
      const pos = polarToXY(shard.angle, shard.radius);
      const blink = shard.age > shard.life - 3 ? 0.45 + 0.55 * Math.sin(this.time * 10) : 1;
      const scale = 1 + 0.16 * Math.sin(this.time * 5 + shard.pulse);
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(pos.x, pos.y);
      ctx.rotate(this.time * 1.4 + shard.pulse);
      ctx.scale(scale, scale);
      ctx.fillStyle = shard.hue;
      ctx.shadowColor = shard.hue;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawPowerups(game) {
    const ctx = this.ctx;
    const colors = { shield: '#5ce1ff', magnet: '#ffd166', slow: '#c65dff' };
    const glyphs = { shield: 'S', magnet: 'M', slow: 'T' };
    for (const orb of game.powerups) {
      const pos = polarToXY(orb.angle, orb.radius);
      const blink = orb.age > orb.life - 3 ? 0.5 + 0.5 * Math.sin(this.time * 10) : 1;
      const color = colors[orb.kind] || '#ffffff';
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = 'rgba(8, 10, 28, 0.9)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 14, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyphs[orb.kind] || '?', pos.x, pos.y + 1);
      ctx.restore();
    }
  }

  drawRocks(game) {
    const ctx = this.ctx;
    for (const rock of game.rocks) {
      const pos = game.rockPosition(rock);
      // Crossing rocks carry their size in `radius`; orbiters carry their
      // orbit distance there and their size in `radiusPx`.
      const size = rock.kind === 'orbiter' ? rock.radiusPx : rock.radius;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(rock.rot);
      ctx.fillStyle = '#8d7f9e';
      ctx.strokeStyle = '#5c5170';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const wobble = 1 + 0.22 * Math.sin(rock.seed + i * 2.7);
        const rr = size * wobble;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // A crater or two, so rocks are not flat discs.
      ctx.fillStyle = 'rgba(60, 50, 80, 0.8)';
      ctx.beginPath();
      ctx.arc(-size * 0.3, -size * 0.2, size * 0.24, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  drawShip(game) {
    const ctx = this.ctx;
    const ship = game.ship;
    const pos = shipXY(ship);
    const heading = ship.angle + Math.PI / 2; // tangent to the orbit
    // Engine trail.
    for (let i = 0; i < ship.trail.length; i++) {
      const p = ship.trail[i];
      const f = i / ship.trail.length;
      ctx.globalAlpha = f * 0.5;
      ctx.fillStyle = '#7ec8ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + f * 5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const blink = ship.invulnerable > 0 && Math.floor(this.time * 12) % 2 === 0;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(heading);
    if (blink) ctx.globalAlpha = 0.35;
    // Hull: a swept dart with a glowing cockpit.
    ctx.fillStyle = '#e8f1ff';
    ctx.strokeStyle = '#7ec8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, 11);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Shield bubble.
    if (ship.shield > 0) {
      ctx.strokeStyle = 'rgba(92, 225, 255, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, SHIP.radius + 9, 0, TAU);
      ctx.stroke();
    }
    // Heat halo: the closer to burning, the redder the warning ring.
    if (ship.heat > 0.25) {
      ctx.strokeStyle = `rgba(255, ${Math.floor(120 - ship.heat * 80)}, 40, ${0.35 + ship.heat * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, SHIP.radius + 5, -Math.PI / 2, -Math.PI / 2 + ship.heat * TAU);
      ctx.stroke();
    }
  }

  drawParticles(game) {
    const ctx = this.ctx;
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawPopups(game) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const pop of game.popups) {
      const f = 1 - pop.age / 1.1;
      ctx.globalAlpha = Math.max(0, f);
      ctx.fillStyle = pop.color;
      ctx.font = '700 19px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(pop.text, pop.x, pop.y - pop.age * 34);
    }
    ctx.globalAlpha = 1;
  }

  drawHud(game) {
    const ctx = this.ctx;
    const ship = game.ship;
    // Score, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(game.score).padStart(6, '0'), VIEW.centerX, 44);
    ctx.fillStyle = '#9fb4e8';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('BEST ' + String(game.best).padStart(6, '0'), VIEW.centerX, 64);
    // Hearts, top left.
    ctx.textAlign = 'left';
    for (let i = 0; i < SHIP.hearts; i++) {
      const x = 28 + i * 34;
      const y = 30;
      ctx.fillStyle = i < ship.hearts ? '#ff5d73' : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.bezierCurveTo(x - 9, y - 2, x - 5, y - 10, x, y - 4);
      ctx.bezierCurveTo(x + 5, y - 10, x + 9, y - 2, x, y + 8);
      ctx.fill();
    }
    // Combo, under the hearts.
    if (game.combo > 1) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('COMBO x' + game.combo, 28, 76);
    }
    // Level + progress, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('LEVEL ' + game.level, VIEW.width - 28, 38);
    const into = game.score % LEVELS.pointsPerLevel;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(VIEW.width - 188, 50, 160, 8);
    ctx.fillStyle = '#7ef0c1';
    ctx.fillRect(VIEW.width - 188, 50, 160 * (into / LEVELS.pointsPerLevel), 8);
    ctx.fillStyle = '#9fb4e8';
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('next orbit ' + (LEVELS.pointsPerLevel - into), VIEW.width - 28, 76);
    // Active power-ups, bottom left.
    let py = VIEW.height - 28;
    ctx.textAlign = 'left';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    const pills = [
      ['SHIELD', ship.shield, '#5ce1ff'],
      ['MAGNET', ship.magnet, '#ffd166'],
      ['SLOW', ship.slow, '#c65dff'],
    ];
    for (const [name, seconds, color] of pills) {
      if (seconds <= 0) continue;
      ctx.fillStyle = color;
      ctx.fillText(name + ' ' + Math.ceil(seconds) + 's', 28, py);
      py -= 22;
    }
    // Heat bar, bottom centre — visible only while the star is cooking you.
    if (ship.heat > 0.05) {
      const w = 220;
      const x = VIEW.centerX - w / 2;
      const y = VIEW.height - 34;
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x, y, w, 10);
      ctx.fillStyle = ship.heat > 0.7 ? '#ff3d2e' : '#ff9a3d';
      ctx.fillRect(x, y, w * ship.heat, 10);
      ctx.fillStyle = '#ffd9c4';
      ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HULL HEAT', VIEW.centerX, y - 6);
    }
    // Controls reminder, bottom right.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200, 212, 255, 0.55)';
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('HOLD SPACE / CLICK — thrust out   A D — steer   P — pause   M — mute', VIEW.width - 24, VIEW.height - 16);
  }

  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6, 8, 22, 0.78)';
    ctx.strokeStyle = 'rgba(140, 170, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();
  }

  button(rect, label, sub) {
    const ctx = this.ctx;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.fillStyle = '#1a1206';
    ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + (sub ? -8 : 0));
    if (sub) {
      ctx.fillStyle = 'rgba(26, 18, 6, 0.72)';
      ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(sub, rect.x + rect.w / 2, rect.y + rect.h / 2 + 16);
    }
    ctx.textBaseline = 'alphabetic';
  }

  drawTitle(game) {
    const ctx = this.ctx;
    this.panel(290, 92, 700, 470);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 62px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('NOVADRIFT', VIEW.centerX, 178);
    ctx.fillStyle = '#cfe0ff';
    ctx.font = '600 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Orbit the dying star. Harvest its light. Do not burn.', VIEW.centerX, 214);
    ctx.fillStyle = '#9fb4e8';
    ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
    const lines = [
      'HOLD SPACE or CLICK to thrust outward — let go and gravity pulls you in.',
      'A / D steer along the orbit. Dive close for rich inner-ring shards,',
      'but the heat will cook your hull. Dodge rocks, outrun solar flares.',
      'Chain pickups to raise your combo. Three hull hearts — make them last.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.centerX, 258 + i * 26));
    if (game.best > 0) {
      ctx.fillStyle = '#7ef0c1';
      ctx.font = '700 17px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('BEST  ' + game.best.toLocaleString('en-US'), VIEW.centerX, 384);
    }
    this.button(game.startButton, 'START DRIFT', 'or press SPACE');
    ctx.fillStyle = 'rgba(200, 212, 255, 0.6)';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('M — sound on/off', VIEW.centerX, 540);
  }

  drawPaused(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4, 5, 14, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    this.panel(440, 240, 400, 200);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 38px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW.centerX, 310);
    ctx.fillStyle = '#9fb4e8';
    ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Press P or click RESUME to keep drifting.', VIEW.centerX, 348);
    this.button(game.resumeButton, 'RESUME', null);
  }

  drawGameOver(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4, 5, 14, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    this.panel(340, 110, 600, 470);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5d73';
    ctx.font = '800 46px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('THE STAR CLAIMS YOU', VIEW.centerX, 178);
    if (game.newBest) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('★ NEW BEST ★', VIEW.centerX, 214);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 54px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(game.score.toLocaleString('en-US'), VIEW.centerX, 282);
    ctx.fillStyle = '#9fb4e8';
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('SCORE', VIEW.centerX, 306);
    const stats = [
      ['BEST', game.best.toLocaleString('en-US')],
      ['SHARDS', String(game.shardsCollected)],
      ['MAX COMBO', 'x' + game.maxCombo],
      ['LEVEL', String(game.level)],
      ['GRAZES', String(game.grazes)],
    ];
    ctx.font = '700 17px "Segoe UI", system-ui, sans-serif';
    stats.forEach(([label, value], i) => {
      const x = 400 + (i % 2) * 260;
      const y = 352 + Math.floor(i / 2) * 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9fb4e8';
      ctx.fillText(label, x, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(value, x + 190, y);
    });
    ctx.textAlign = 'center';
    this.button(game.retryButton, 'DRIFT AGAIN', 'or press R');
  }
}
