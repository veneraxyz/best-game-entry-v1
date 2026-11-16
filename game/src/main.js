// NOVADRIFT boot: find the canvas, build the game, start the loop. If the
// canvas or its 2D context is missing, show the fallback line instead of a
// blank page.

import { Game } from './game.js';

const canvas = document.getElementById('game');
const fallback = document.getElementById('fallback');

if (!canvas || !canvas.getContext) {
  if (fallback) fallback.hidden = false;
} else {
  const game = new Game(canvas);
  game.run();
  // A read-only window into the run, for playtests and screenshots:
  // window.__novadrift.state() returns score, hearts, positions and more.
  // It never writes anything; the game plays the same with or without it.
  window.__novadrift = {
    state: () => game.debugState(),
    version: 'novadrift-1',
  };
}
