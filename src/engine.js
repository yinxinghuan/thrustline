export const FIELD_W = 360;
export const FIELD_H = 640;
export const ROUND_SECONDS = 30;
export const FIXED_STEP = 1 / 120;

export const SAFE_LIMITS = Object.freeze({ vx: 18, vy: 36, tilt: 13 * Math.PI / 180 });
export const HARD_LIMITS = Object.freeze({ vx: 30, vy: 48, tilt: 22 * Math.PI / 180 });

export const PADS = Object.freeze([
  { id: "A", x1: 68, x2: 146, y: 574, baseScore: 1000, label: "SAFE / 1000" },
  { id: "B", x1: 266, x2: 306, y: 506, baseScore: 1900, label: "RISK / 1900" },
]);

const TERRAIN = Object.freeze([
  [0, 555], [42, 535], [68, 574], [146, 574], [166, 520], [198, 548],
  [232, 516], [250, 540], [266, 506], [306, 506], [330, 548], [360, 522],
]);

const MAX_ANGLE = 34 * Math.PI / 180;
const ANGLE_SPEED = 0.97;
const ANGLE_PHASE = Math.PI + Math.asin(6 / 34);
const GRAVITY = 38;
const THRUST = 78;
const FUEL_BURN = 18;
const WIND_ACCEL = 24;

export const SPAWN = Object.freeze({ x: 160, y: 160, vx: 4, vy: 4 });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function groundY(x) {
  const px = clamp(x, 0, FIELD_W);
  for (let index = 0; index < TERRAIN.length - 1; index += 1) {
    const [x1, y1] = TERRAIN[index];
    const [x2, y2] = TERRAIN[index + 1];
    if (px < x1 || px > x2) continue;
    const t = (px - x1) / Math.max(0.0001, x2 - x1);
    return y1 + (y2 - y1) * t;
  }
  return TERRAIN[TERRAIN.length - 1][1];
}

export function padAt(x, margin = 0) {
  return PADS.find((pad) => x >= pad.x1 + margin && x <= pad.x2 - margin) ?? null;
}

export function inWind(x, y) {
  return x >= 162 && x <= 232 && y >= 145 && y <= 500;
}

export function angleAt(elapsed) {
  return Math.sin(elapsed * ANGLE_SPEED + ANGLE_PHASE) * MAX_ANGLE;
}

export function classifyLanding({ vx, vy, angle }) {
  const ax = Math.abs(vx);
  const ay = Math.max(0, vy);
  const tilt = Math.abs(angle);
  if (ax <= SAFE_LIMITS.vx && ay <= SAFE_LIMITS.vy && tilt <= SAFE_LIMITS.tilt) return "safe";
  if (ax <= HARD_LIMITS.vx && ay <= HARD_LIMITS.vy && tilt <= HARD_LIMITS.tilt) return "hard";
  return "crash";
}

function rotatePoint(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function craftPoints(state) {
  const local = [
    { id: "nose", x: 0, y: -13 },
    { id: "left-body", x: -8, y: 7 },
    { id: "right-body", x: 8, y: 7 },
    { id: "left-foot", x: -11, y: 14 },
    { id: "right-foot", x: 11, y: 14 },
  ];
  return local.map((point) => {
    const rotated = rotatePoint(point.x, point.y, state.angle);
    return { id: point.id, x: state.x + rotated.x, y: state.y + rotated.y };
  });
}

function collisionFor(state) {
  const points = craftPoints(state);
  const terrainPoint = points.find((point) => point.y >= groundY(point.x));
  if (!terrainPoint) return null;
  const leftFoot = points.find((point) => point.id === "left-foot");
  const rightFoot = points.find((point) => point.id === "right-foot");
  const pad = PADS.find((item) => (
    leftFoot.x >= item.x1
    && rightFoot.x <= item.x2
    && Math.abs(groundY(leftFoot.x) - item.y) < 0.1
    && Math.abs(groundY(rightFoot.x) - item.y) < 0.1
  )) ?? null;
  return { point: terrainPoint, pad };
}

function integrate(state, dt, thrusting) {
  state.angle = angleAt(state.elapsed);
  let ax = inWind(state.x, state.y) ? WIND_ACCEL : 0;
  let ay = GRAVITY;
  if (thrusting && state.fuel > 0) {
    ax += Math.sin(state.angle) * THRUST;
    ay -= Math.cos(state.angle) * THRUST;
    state.fuel = Math.max(0, state.fuel - FUEL_BURN * dt);
  }
  state.vx += ax * dt;
  state.vy += ay * dt;
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  state.elapsed += dt;
  state.angle = angleAt(state.elapsed);
}

function landingReason(kind, state) {
  if (kind !== "crash") return kind;
  if (Math.abs(state.vx) > HARD_LIMITS.vx) return `H SPEED ${Math.abs(state.vx).toFixed(1)} > 30`;
  if (Math.max(0, state.vy) > HARD_LIMITS.vy) return `V SPEED ${Math.max(0, state.vy).toFixed(1)} > 48`;
  if (Math.abs(state.angle) > HARD_LIMITS.tilt) {
    return `TILT ${(Math.abs(state.angle) * 180 / Math.PI).toFixed(1)}° > 22°`;
  }
  return "RIDGE CONTACT";
}

export class ThrustlineEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = "ready";
    this.resumePhase = "ready";
    this.accumulator = 0;
    this.elapsed = 0;
    this.thrusting = false;
    this.x = SPAWN.x;
    this.y = SPAWN.y;
    this.vx = SPAWN.vx;
    this.vy = SPAWN.vy;
    this.angle = angleAt(0);
    this.fuel = 100;
    this.score = 0;
    this.result = null;
    this.events = [];
    this.history = [{ x: this.x, y: this.y }];
    this.historyClock = 0;
  }

  setThrust(active) {
    if (["safe", "hard", "crash", "timeout"].includes(this.phase)) return false;
    if (active && this.phase === "ready") {
      this.phase = "playing";
      this.events.push({ type: "start" });
    }
    if (this.phase !== "playing") return false;
    const next = Boolean(active && this.fuel > 0);
    if (next === this.thrusting) return true;
    this.thrusting = next;
    this.events.push({ type: next ? "thrust-on" : "thrust-off", x: this.x, y: this.y });
    return true;
  }

  setPaused(paused) {
    if (paused) {
      if (this.phase === "playing" || this.phase === "ready") {
        this.resumePhase = this.phase;
        this.phase = "paused";
        this.thrusting = false;
        this.accumulator = 0;
        this.events.push({ type: "paused" });
      }
      return;
    }
    if (this.phase === "paused") {
      this.phase = this.resumePhase;
      this.events.push({ type: "resumed" });
    }
  }

  advance(delta) {
    if (this.phase !== "playing") return;
    this.accumulator += Math.min(0.05, Math.max(0, delta));
    while (this.accumulator >= FIXED_STEP && this.phase === "playing") {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
  }

  step(dt) {
    const wasThrusting = this.thrusting && this.fuel > 0;
    integrate(this, dt, wasThrusting);
    if (this.fuel <= 0 && this.thrusting) {
      this.thrusting = false;
      this.events.push({ type: "fuel-empty" });
    }
    this.historyClock += dt;
    if (this.historyClock >= 1 / 30) {
      this.historyClock -= 1 / 30;
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > 120) this.history.shift();
    }

    if (this.x < 9 || this.x > FIELD_W - 9) {
      this.finish("crash", null, "SIDE WALL");
      return;
    }
    if (this.y < -20) {
      this.finish("crash", null, "CEILING EXIT");
      return;
    }

    const collision = collisionFor(this);
    if (collision) {
      if (!collision.pad) {
        this.finish("crash", null, "RIDGE CONTACT");
        return;
      }
      const kind = classifyLanding(this);
      this.finish(kind, collision.pad, landingReason(kind, this));
      return;
    }

    if (this.elapsed >= ROUND_SECONDS) {
      this.elapsed = ROUND_SECONDS;
      this.finish("timeout", null, "30.0s / NO LANDING");
    }
  }

  finish(kind, pad, reason) {
    this.phase = kind;
    this.thrusting = false;
    if (kind === "safe") {
      this.score = pad.baseScore + Math.round(this.fuel * 8 + (ROUND_SECONDS - this.elapsed) * 20);
    } else if (kind === "hard") {
      this.score = Math.round(pad.baseScore * 0.45 + this.fuel * 3);
    }
    this.result = {
      kind,
      pad: pad?.id ?? null,
      reason,
      vx: this.vx,
      vy: this.vy,
      angle: this.angle,
      fuel: this.fuel,
      elapsed: this.elapsed,
      score: this.score,
      regret: this.regret(kind),
    };
    this.events.push({ type: "finish", ...this.result });
  }

  regret(kind) {
    if (kind === "safe") return "TRY THE NARROW 1900 PAD";
    if (Math.abs(this.vx) > (kind === "hard" ? SAFE_LIMITS.vx : HARD_LIMITS.vx)) {
      const target = kind === "hard" ? SAFE_LIMITS.vx : HARD_LIMITS.vx;
      return `REDUCE H SPEED BY ${(Math.abs(this.vx) - target).toFixed(1)}`;
    }
    if (Math.max(0, this.vy) > (kind === "hard" ? SAFE_LIMITS.vy : HARD_LIMITS.vy)) {
      const target = kind === "hard" ? SAFE_LIMITS.vy : HARD_LIMITS.vy;
      return `BRAKE ${Math.max(0, this.vy) - target > 0 ? (Math.max(0, this.vy) - target).toFixed(1) : "EARLIER"}`;
    }
    if (Math.abs(this.angle) > (kind === "hard" ? SAFE_LIMITS.tilt : HARD_LIMITS.tilt)) {
      return "WAIT FOR A FLATTER ANGLE";
    }
    return kind === "timeout" ? "COMMIT TO A PAD EARLIER" : "THRUST BEFORE THE RIDGE";
  }

  predict(seconds = 1.6, interval = 0.1) {
    const state = {
      x: this.x, y: this.y, vx: this.vx, vy: this.vy,
      angle: this.angle, fuel: this.fuel, elapsed: this.elapsed,
    };
    const points = [{ x: state.x, y: state.y }];
    let collision = null;
    let sampleClock = 0;
    for (let time = 0; time < seconds && !collision; time += FIXED_STEP) {
      integrate(state, FIXED_STEP, false);
      sampleClock += FIXED_STEP;
      collision = collisionFor(state);
      if (sampleClock + 0.0001 >= interval || collision) {
        sampleClock = 0;
        points.push({ x: state.x, y: state.y });
      }
      if (state.x < 9 || state.x > FIELD_W - 9 || state.y < -20) {
        collision = { point: { x: state.x, y: state.y }, pad: null };
      }
    }
    let outcome = "flight";
    if (collision) outcome = collision.pad ? classifyLanding(state) : "crash";
    return { points, collision, outcome, state };
  }

  consumeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  get timeLeft() {
    return Math.max(0, ROUND_SECONDS - this.elapsed);
  }

  get windActive() {
    return inWind(this.x, this.y);
  }
}
