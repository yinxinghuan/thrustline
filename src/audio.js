const STORAGE_KEY = "thrustline_muted_v1";
const MASTER_LEVEL = 0.15;
const MAX_TRANSIENT_VOICES = 8;

function savedMuted() {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

export class ThrustlineAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.muted = savedMuted();
    this.burn = null;
    this.noiseBuffer = null;
    this.voices = [];
    this.lastWind = false;
    this.lastPrediction = "flight";
    this.lastOverspeed = false;
    this.lowFuelCrossed = false;
    this.counts = {
      unlock: 0, thrustStart: 0, thrustStop: 0, release: 0,
      wind: 0, fuel: 0, danger: 0, approach: 0,
      safe: 0, hard: 0, crash: 0, fieldReturn: 0, stolen: 0,
    };
  }

  async unlock() {
    if (!this.ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return false;
      this.ctx = new AudioCtor();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 5;
      this.compressor.ratio.value = 14;
      this.compressor.attack.value = 0.002;
      this.compressor.release.value = 0.11;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
      this.compressor.connect(this.master).connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoiseBuffer();
      this.counts.unlock += 1;
    }
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
    return this.ctx.state === "running";
  }

  makeNoiseBuffer() {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    let state = 0x514e17;
    let smoothed = 0;
    for (let index = 0; index < channel.length; index += 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const white = state / 0xffffffff * 2 - 1;
      smoothed = smoothed * 0.55 + white * 0.45;
      channel[index] = smoothed;
    }
    return buffer;
  }

  setMuted(value) {
    this.muted = Boolean(value);
    try { localStorage.setItem(STORAGE_KEY, this.muted ? "1" : "0"); } catch { /* optional */ }
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_LEVEL, now, 0.01);
    }
    if (this.muted) this.silenceAll();
  }

  addVoice(nodes, stopAt) {
    const voice = { nodes, stopAt };
    this.voices.push(voice);
    while (this.voices.length > MAX_TRANSIENT_VOICES) {
      const oldest = this.voices.shift();
      this.stopVoice(oldest);
      this.counts.stolen += 1;
    }
    window.setTimeout(() => {
      this.stopVoice(voice);
      this.voices = this.voices.filter((candidate) => candidate !== voice);
    }, Math.max(20, (stopAt - this.ctx.currentTime) * 1000 + 80));
    return voice;
  }

  stopVoice(voice) {
    if (!voice) return;
    for (const node of voice.nodes) {
      try { node.stop?.(); } catch { /* already stopped */ }
      try { node.disconnect?.(); } catch { /* already disconnected */ }
    }
  }

  tone({ frequency, endFrequency = frequency, duration = 0.08, gain = 0.06, type = "triangle", delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(24, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.012, duration * 0.25));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(this.compressor);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.015);
    this.addVoice([oscillator, envelope], start + duration + 0.015);
  }

  noise({ duration = 0.1, gain = 0.04, frequency = 480, endFrequency = frequency, type = "bandpass", delay = 0, q = 1.1 }) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const start = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const envelope = this.ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(40, frequency), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.012, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope).connect(this.compressor);
    source.start(start, (start * 0.371) % 1.5);
    source.stop(start + duration + 0.015);
    this.addVoice([source, filter, envelope], start + duration + 0.015);
  }

  haptic(pattern) {
    if (this.muted || typeof navigator.vibrate !== "function") return;
    try { navigator.vibrate(pattern); } catch { /* optional enhancement */ }
  }

  startThrust(fuel = 100) {
    if (!this.ctx || this.muted || this.burn) return;
    const now = this.ctx.currentTime;

    // Starter clutch: a dry mechanical knock followed by pressure catching.
    this.tone({ frequency: 118, endFrequency: 62, duration: 0.042, gain: 0.075, type: "square" });
    this.noise({ duration: 0.075, gain: 0.045, frequency: 980, endFrequency: 310, type: "bandpass", q: 0.9 });

    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    const combustion = this.ctx.createBufferSource();
    const combustionFilter = this.ctx.createBiquadFilter();
    const combustionGain = this.ctx.createGain();
    const flutter = this.ctx.createOscillator();
    const flutterGain = this.ctx.createGain();

    body.type = "triangle";
    body.frequency.value = 67 + fuel * 0.055;
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.028, now + 0.032);

    combustion.buffer = this.noiseBuffer;
    combustion.loop = true;
    combustionFilter.type = "bandpass";
    combustionFilter.frequency.value = 360 + fuel * 1.2;
    combustionFilter.Q.value = 0.72;
    combustionGain.gain.setValueAtTime(0.0001, now);
    combustionGain.gain.exponentialRampToValueAtTime(0.028, now + 0.04);

    flutter.type = "square";
    flutter.frequency.value = 17;
    flutterGain.gain.value = 0.0045;
    flutter.connect(flutterGain).connect(combustionGain.gain);
    body.connect(bodyGain).connect(this.compressor);
    combustion.connect(combustionFilter).connect(combustionGain).connect(this.compressor);
    body.start(now);
    combustion.start(now, (now * 0.137) % 1.5);
    flutter.start(now);
    this.burn = { body, bodyGain, combustion, combustionFilter, combustionGain, flutter, flutterGain };
    this.counts.thrustStart += 1;
    this.haptic(8);
  }

  updateThrust(fuel) {
    if (!this.burn || !this.ctx) return;
    const now = this.ctx.currentTime;
    const normalized = Math.max(0, Math.min(1, fuel / 100));
    this.burn.body.frequency.setTargetAtTime(64 + normalized * 8, now, 0.08);
    this.burn.combustionFilter.frequency.setTargetAtTime(350 + normalized * 130, now, 0.08);
    this.burn.combustionGain.gain.setTargetAtTime(0.024 + normalized * 0.005, now, 0.08);
  }

  stopThrust({ tail = true } = {}) {
    if (!this.burn || !this.ctx) return;
    const burn = this.burn;
    this.burn = null;
    const now = this.ctx.currentTime;
    for (const param of [burn.bodyGain.gain, burn.combustionGain.gain]) {
      param.cancelScheduledValues(now);
      param.setTargetAtTime(0.0001, now, 0.009);
    }
    for (const source of [burn.body, burn.combustion, burn.flutter]) {
      try { source.stop(now + 0.045); } catch { /* already stopped */ }
    }
    this.counts.thrustStop += 1;
    if (tail && !this.muted) {
      this.noise({ duration: 0.07, gain: 0.035, frequency: 620, endFrequency: 170, type: "bandpass", q: 0.8 });
      this.tone({ frequency: 92, endFrequency: 55, duration: 0.055, gain: 0.026, type: "triangle" });
      this.counts.release += 1;
    }
  }

  updateTelemetry({ fuel, wind, prediction, elapsed, vx = 0, vy = 0, angle = 0 }) {
    this.updateThrust(fuel);
    if (wind !== this.lastWind && elapsed > 0) {
      this.noise({
        duration: 0.14,
        gain: 0.037,
        frequency: wind ? 260 : 920,
        endFrequency: wind ? 920 : 260,
        type: "bandpass",
        q: 1.35,
      });
      this.tone({ frequency: wind ? 180 : 260, endFrequency: wind ? 260 : 180, duration: 0.09, gain: 0.018, type: "triangle" });
      this.counts.wind += 1;
    }
    this.lastWind = wind;

    const overspeed = Math.abs(vx) > 30 || Math.max(0, vy) > 48 || Math.abs(angle) > 22 * Math.PI / 180;
    if (overspeed && !this.lastOverspeed && elapsed > 0.45) {
      this.tone({ frequency: 410, endFrequency: 205, duration: 0.105, gain: 0.05, type: "square" });
      this.noise({ duration: 0.065, gain: 0.022, frequency: 620, endFrequency: 360 });
      this.counts.danger += 1;
      this.haptic([12, 25, 12]);
    }
    this.lastOverspeed = overspeed;

    if (prediction !== this.lastPrediction && elapsed > 0.45) {
      if (prediction === "crash" && !overspeed) {
        this.tone({ frequency: 360, endFrequency: 190, duration: 0.095, gain: 0.045, type: "square" });
        this.counts.danger += 1;
      } else if (prediction === "safe" || prediction === "hard") {
        this.tone({ frequency: 310, endFrequency: 410, duration: 0.07, gain: 0.034, type: "triangle" });
        this.tone({ frequency: 410, endFrequency: 410, duration: 0.035, gain: 0.025, type: "square", delay: 0.065 });
        this.counts.approach += 1;
      }
    }
    this.lastPrediction = prediction;

    if (fuel <= 22 && !this.lowFuelCrossed) {
      this.tone({ frequency: 290, endFrequency: 240, duration: 0.07, gain: 0.04, type: "square" });
      this.tone({ frequency: 290, endFrequency: 240, duration: 0.07, gain: 0.032, type: "square", delay: 0.13 });
      this.lowFuelCrossed = true;
      this.counts.fuel += 1;
    }
  }

  result(kind) {
    this.stopThrust({ tail: false });
    if (kind === "safe") {
      // Clamp closes, then a stable latch confirms the seal.
      this.tone({ frequency: 190, endFrequency: 150, duration: 0.055, gain: 0.055, type: "square" });
      this.tone({ frequency: 310, endFrequency: 310, duration: 0.07, gain: 0.045, type: "triangle", delay: 0.07 });
      this.tone({ frequency: 465, endFrequency: 465, duration: 0.09, gain: 0.04, type: "triangle", delay: 0.145 });
      this.counts.safe += 1;
      this.haptic(18);
    } else if (kind === "hard") {
      // Heavy skid: low body impact plus dry surface scrape.
      this.tone({ frequency: 105, endFrequency: 58, duration: 0.17, gain: 0.08, type: "square" });
      this.noise({ duration: 0.19, gain: 0.052, frequency: 700, endFrequency: 150, type: "bandpass", q: 0.7 });
      this.counts.hard += 1;
      this.haptic([28, 30, 20]);
    } else {
      // Structural snap and decompression, deliberately not an explosion.
      this.noise({ duration: 0.085, gain: 0.075, frequency: 1450, endFrequency: 540, type: "bandpass", q: 1.4 });
      this.tone({ frequency: 235, endFrequency: 72, duration: 0.18, gain: 0.07, type: "sawtooth", delay: 0.035 });
      this.noise({ duration: 0.24, gain: 0.044, frequency: 820, endFrequency: 110, type: "highpass", delay: 0.07, q: 0.5 });
      this.counts.crash += 1;
      this.haptic([35, 24, 45]);
    }
  }

  fieldReturn(kind) {
    this.tone({ frequency: kind === "safe" ? 610 : 420, endFrequency: kind === "safe" ? 720 : 330, duration: 0.09, gain: 0.026, type: "square", delay: 0.08 });
    this.noise({ duration: 0.12, gain: 0.024, frequency: 1350, endFrequency: 820, type: "bandpass", delay: 0.22, q: 2.4 });
    this.tone({ frequency: 170, endFrequency: 145, duration: 0.045, gain: 0.026, type: "triangle", delay: 0.35 });
    this.counts.fieldReturn += 1;
  }

  click() {
    this.tone({ frequency: 145, endFrequency: 118, duration: 0.038, gain: 0.02, type: "square" });
  }

  silenceAll() {
    this.stopThrust({ tail: false });
    for (const voice of this.voices) this.stopVoice(voice);
    this.voices = [];
    if (typeof navigator.vibrate === "function") {
      try { navigator.vibrate(0); } catch { /* optional */ }
    }
  }

  pause() {
    this.silenceAll();
  }

  reset() {
    this.silenceAll();
    this.lastWind = false;
    this.lastPrediction = "flight";
    this.lastOverspeed = false;
    this.lowFuelCrossed = false;
  }

  debug() {
    return {
      unlocked: Boolean(this.ctx),
      state: this.ctx?.state || "none",
      muted: this.muted,
      thrusting: Boolean(this.burn),
      activeVoices: this.voices.length,
      maxVoices: MAX_TRANSIENT_VOICES,
      masterGain: this.master?.gain.value ?? 0,
      compressor: this.compressor ? {
        threshold: this.compressor.threshold.value,
        ratio: this.compressor.ratio.value,
        attack: this.compressor.attack.value,
        release: this.compressor.release.value,
      } : null,
      counts: { ...this.counts },
    };
  }
}
