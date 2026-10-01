export const AudioBus = {
  ctx: null,
  master: null,
  muted: false,
  installed: false,

  install() {
    if (this.installed) return;
    this.installed = true;
    const kick = () => this.ensure();
    globalThis.addEventListener('pointerdown', kick);
    globalThis.addEventListener('keydown', kick);
  },

  ensure() {
    if (this.muted) return null;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  play(build) {
    const ctx = this.ensure();
    if (!ctx) return;
    const run = () => {
      try { build(ctx, this.master || ctx.destination); }
      catch { /* un sonido no debe cortar el juego */ }
    };
    if (ctx.state === 'running') run();
    else ctx.resume().then(run).catch(() => {});
  },

  tone(freq, dur, type, gain, slide) {
    this.play((ctx, out) => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f0 = Math.max(40, freq);
      const f1 = Math.max(40, slide || f0);
      o.type = type || 'square';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f1, t + Math.max(0.02, dur));
      const vol = Math.max(0.0008, gain ?? 0.06);
      g.gain.setValueAtTime(vol, t);
      g.gain.linearRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur + 0.03);
    });
  },

  noise(dur, gain) {
    this.play((ctx, out) => {
      const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.value = gain ?? 0.15;
      src.connect(filter);
      filter.connect(g);
      g.connect(out);
      src.start();
    });
  },

  jump() { this.tone(640, 0.11, 'square', 0.05, 260); },
  stomp(combo) {
    this.noise(0.07, 0.18);
    this.tone(150 + (combo || 1) * 28, 0.09, 'square', 0.06, 70);
  },
  coffee() {
    this.tone(880, 0.07, 'square', 0.045);
    this.tone(1180, 0.1, 'square', 0.04);
  },
  good() {
    this.tone(523, 0.09, 'square', 0.05);
    this.tone(659, 0.09, 'square', 0.05);
    this.tone(784, 0.16, 'square', 0.055);
  },
  bad() { this.tone(180, 0.2, 'sawtooth', 0.045, 70); },
  hurt() {
    this.noise(0.1, 0.16);
    this.tone(110, 0.18, 'square', 0.05, 55);
  },
  turbo() { this.tone(280, 0.14, 'square', 0.04, 760); },
  pound() { this.noise(0.12, 0.22); this.tone(90, 0.12, 'square', 0.06); },
  land() { this.noise(0.045, 0.07); this.tone(120, 0.05, 'square', 0.035, 70); },
  click() { this.tone(500, 0.04, 'square', 0.03); },
  win() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 0.13, 'square', 0.05), i * 90);
    });
  },
};
