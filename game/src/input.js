// NOVADRIFT input: one place that turns keys, mouse and touch into the
// three things the ship cares about — thrust, steering, and clicks. The game
// polls this each frame; nothing here knows about screens or scoring.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.touchDown = false;
    // Clicks the game has not consumed yet: {x, y} in canvas coordinates.
    this.clickQueue = [];
    // Keys pressed since the last poll, for one-shot actions (pause, restart).
    this.pressedQueue = [];
    this.canvas = canvas;
    this.attach(canvas);
  }

  attach(canvas) {
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
      }
      if (!this.keys.has(key)) this.pressedQueue.push(key);
      this.keys.add(key);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.touchDown = false;
    });

    const toCanvas = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      };
    };
    canvas.addEventListener('pointerdown', (event) => {
      const point = toCanvas(event.clientX, event.clientY);
      this.mouseX = point.x;
      this.mouseY = point.y;
      this.mouseDown = true;
      this.clickQueue.push(point);
    });
    window.addEventListener('pointerup', () => {
      this.mouseDown = false;
    });
    window.addEventListener('pointermove', (event) => {
      const point = toCanvas(event.clientX, event.clientY);
      this.mouseX = point.x;
      this.mouseY = point.y;
    });
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.touchDown = true;
    }, { passive: false });
    canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.touchDown = false;
    }, { passive: false });
  }

  /** True while the player holds thrust: Space, W, Up, mouse or touch. */
  get thrusting() {
    return (
      this.keys.has(' ') ||
      this.keys.has('w') ||
      this.keys.has('arrowup') ||
      this.mouseDown ||
      this.touchDown
    );
  }

  /** -1 to brake the orbit, +1 to push it faster, 0 to coast. */
  get steer() {
    const left = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  /** Was this key pressed since the last poll? Consumes the press. */
  wasPressed(key) {
    const at = this.pressedQueue.indexOf(key);
    if (at < 0) return false;
    this.pressedQueue.splice(at, 1);
    return true;
  }

  /** Drain the click queue (canvas coordinates). */
  takeClicks() {
    const clicks = this.clickQueue;
    this.clickQueue = [];
    return clicks;
  }

  /** Drop queued presses (used when switching screens). */
  clearQueues() {
    this.clickQueue = [];
    this.pressedQueue = [];
  }
}
