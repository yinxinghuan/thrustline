import assert from "node:assert/strict";
import {
  HARD_LIMITS,
  PADS,
  SAFE_LIMITS,
  ThrustlineEngine,
  classifyLanding,
  groundY,
  inWind,
} from "../src/engine.js";

assert.equal(classifyLanding({ vx: SAFE_LIMITS.vx, vy: SAFE_LIMITS.vy, angle: SAFE_LIMITS.tilt }), "safe");
assert.equal(classifyLanding({ vx: SAFE_LIMITS.vx + 0.01, vy: SAFE_LIMITS.vy, angle: 0 }), "hard");
assert.equal(classifyLanding({ vx: HARD_LIMITS.vx, vy: HARD_LIMITS.vy, angle: HARD_LIMITS.tilt }), "hard");
assert.equal(classifyLanding({ vx: HARD_LIMITS.vx + 0.01, vy: 20, angle: 0 }), "crash");
assert.equal(groundY(90), PADS[0].y);
assert.equal(groundY(280), PADS[1].y);
assert.notEqual(groundY(180), groundY(90));
assert.equal(inWind(190, 240), true);
assert.equal(inWind(120, 240), false);

const fuel = new ThrustlineEngine();
fuel.setThrust(true);
for (let index = 0; index < 60; index += 1) fuel.advance(1 / 60);
assert.ok(fuel.fuel < 83 && fuel.fuel > 81, `unexpected fuel ${fuel.fuel}`);
const afterBurn = fuel.fuel;
fuel.setThrust(false);
for (let index = 0; index < 30; index += 1) fuel.advance(1 / 60);
assert.ok(Math.abs(fuel.fuel - afterBurn) < 1e-7);

const wind = new ThrustlineEngine();
wind.phase = "playing";
wind.x = 190; wind.y = 220; wind.vx = 0; wind.vy = 0;
for (let index = 0; index < 60; index += 1) wind.advance(1 / 60);
const still = new ThrustlineEngine();
still.phase = "playing";
still.x = 120; still.y = 220; still.vx = 0; still.vy = 0;
for (let index = 0; index < 60; index += 1) still.advance(1 / 60);
assert.ok(wind.vx - still.vx > 23, `wind delta ${wind.vx - still.vx}`);

const paused = new ThrustlineEngine();
paused.setThrust(true);
for (let index = 0; index < 30; index += 1) paused.advance(1 / 60);
paused.setPaused(true);
const pauseSnapshot = { elapsed: paused.elapsed, fuel: paused.fuel, x: paused.x, y: paused.y };
for (let index = 0; index < 120; index += 1) paused.advance(1 / 60);
assert.deepEqual({ elapsed: paused.elapsed, fuel: paused.fuel, x: paused.x, y: paused.y }, pauseSnapshot);
assert.equal(paused.thrusting, false);
paused.setPaused(false);
assert.equal(paused.phase, "playing");

function simulate(fps) {
  const engine = new ThrustlineEngine();
  const dt = 1 / fps;
  const segments = [
    [true, 0.8],
    [false, 0.7],
    [true, 0.6],
    [false, 0.9],
    [true, 0.5],
    [false, 1.5],
  ];
  for (const [active, duration] of segments) {
    engine.setThrust(active);
    const frames = Math.round(duration * fps);
    for (let frame = 0; frame < frames && engine.phase === "playing"; frame += 1) {
      engine.advance(dt);
    }
    if (engine.phase !== "playing") break;
  }
  return engine;
}

const at30 = simulate(30);
const at60 = simulate(60);
for (const key of ["x", "y", "vx", "vy", "fuel", "elapsed"]) {
  assert.ok(Math.abs(at30[key] - at60[key]) < 0.015, `${key}: ${at30[key]} vs ${at60[key]}`);
}
assert.equal(at30.phase, at60.phase);

const predictor = new ThrustlineEngine();
predictor.phase = "playing";
predictor.x = 105;
predictor.y = 520;
predictor.vx = 0;
predictor.vy = 28;
predictor.elapsed = 1.2;
predictor.angle = 0;
const forecast = predictor.predict(2);
assert.ok(forecast.collision, "forecast should contact the large pad");
assert.equal(forecast.collision.pad?.id, "A");
assert.ok(Math.abs(forecast.points.at(-1).y - groundY(forecast.points.at(-1).x)) < 18);

console.log("thrustline engine verification passed", {
  fuelAfterOneSecond: fuel.fuel.toFixed(2),
  windDelta: (wind.vx - still.vx).toFixed(2),
  deterministic: at30.phase,
  prediction: forecast.outcome,
});
