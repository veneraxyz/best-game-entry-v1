// NOVADRIFT sound: every effect is synthesized with WebAudio — no audio
// files, no network. The context is created lazily on the first user gesture
// (browsers block audio before one), and every call is guarded so a missing
// or denied AudioContext can never break the game.

import { STORAGE } from './config.js';

function loadMuted() {
  try {
    return window.localStorage.getItem(STORAGE.mutedKey) === '1';
  } catch {
    return false;
  }
}

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = loadMuted();
  }

  /** Create (or resume) the context. Call from a click or key handler. */
  unlock() {
    try {
      if (!this.context) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        this.context = new Ctor();
        this.master = this.context.createGain();
        this.master.gain.value = 0.42;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      // Audio is decoration; silence is always acceptable.
    }
  }

  toggleMuted() {
    this.muted = !this.muted;
    try {
      window.localStorage.setItem(STORAGE.mutedKey, this.muted ? '1' : '0');
    } catch {
      // Storage may be unavailable; the toggle still works for this session.
    }
    return this.muted;
  }

  /** One oscillator blip with a pitch glide and an exponential fade. */
  blip(fromHz, toHz, seconds, type, volume) {
    if (this.muted || !this.context || !this.master) return;
    try {
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(fromHz, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), now + seconds);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    } catch {
      // Ignore one failed blip; the game goes on.
    }
  }

  /** A short filtered noise burst, for impacts and flares. */
  noise(seconds, volume, cutoffHz) {
    if (this.muted || !this.context || !this.master) return;
    try {
      const now = this.context.currentTime;
      const length = Math.max(1, Math.floor(this.context.sampleRate * seconds));
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = this.context.createBufferSource();
      src.buffer = buffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoffHz;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(now);
    } catch {
      // Ignore; silence is fine.
    }
  }

  /** Pickup chime: the pitch climbs the combo ladder. */
  pickup(combo) {
    const base = 520 * Math.pow(1.059, Math.min(combo, 12));
    this.blip(base, base * 1.5, 0.16, 'sine', 0.5);
    this.blip(base * 2, base * 2.4, 0.1, 'triangle', 0.18);
  }

  graze() {
    this.blip(880, 1320, 0.09, 'sine', 0.28);
  }

  hit() {
    this.noise(0.28, 0.7, 900);
    this.blip(160, 46, 0.32, 'sawtooth', 0.5);
  }

  shieldBreak() {
    this.blip(1200, 240, 0.22, 'square', 0.3);
    this.noise(0.12, 0.3, 3200);
  }

  powerup() {
    this.blip(660, 990, 0.12, 'triangle', 0.4);
    window.setTimeout(() => this.blip(990, 1480, 0.14, 'triangle', 0.35), 90);
  }

  flareWarn() {
    this.blip(220, 440, 0.5, 'sawtooth', 0.16);
  }

  flareBurst() {
    this.noise(0.5, 0.5, 1600);
  }

  levelUp() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((hz, i) => {
      window.setTimeout(() => this.blip(hz, hz * 1.01, 0.18, 'triangle', 0.4), i * 95);
    });
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((hz, i) => {
      window.setTimeout(() => this.blip(hz, hz * 0.97, 0.3, 'triangle', 0.38), i * 170);
    });
  }

  start() {
    this.blip(392, 784, 0.2, 'triangle', 0.4);
  }
}
