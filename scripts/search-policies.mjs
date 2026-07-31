import { ThrustlineEngine } from "../src/engine.js";

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

const found = new Map();
const rng = random(0x54485255);
let bestAPolicy = null;
let bestAPenalty = Infinity;

function runPolicy(decisions) {
  const engine = new ThrustlineEngine();
  for (const active of decisions) {
    engine.setThrust(Boolean(active));
    for (let tick = 0; tick < 15 && engine.phase === "playing"; tick += 1) {
      engine.advance(1 / 120);
    }
    if (["safe", "hard", "crash", "timeout"].includes(engine.phase)) break;
  }
  return engine;
}

function safePenalty(engine) {
  if (!engine.result || engine.result.pad !== "A") return Infinity;
  const tilt = Math.abs(engine.result.angle * 180 / Math.PI);
  return Math.max(0, Math.abs(engine.result.vx) - 18) ** 2
    + Math.max(0, engine.result.vy - 36) ** 2
    + Math.max(0, tilt - 13) ** 2;
}

for (let attempt = 0; attempt < 30000 && found.size < 4; attempt += 1) {
  const engine = new ThrustlineEngine();
  const decisions = [];
  let active = true;
  for (let slice = 0; slice < 240 && engine.phase !== "safe" && engine.phase !== "hard" && engine.phase !== "crash" && engine.phase !== "timeout"; slice += 1) {
    if (slice === 0 || rng() < 0.31) active = rng() < 0.47;
    decisions.push(active ? 1 : 0);
    engine.setThrust(active);
    for (let tick = 0; tick < 15 && engine.phase === "playing"; tick += 1) {
      engine.advance(1 / 120);
    }
  }
  if (!engine.result?.pad || !["safe", "hard"].includes(engine.result.kind)) continue;
  const penalty = safePenalty(engine);
  if (penalty < bestAPenalty) {
    bestAPenalty = penalty;
    bestAPolicy = decisions.slice();
  }
  const key = `${engine.result.pad}-${engine.result.kind}`;
  if (!found.has(key)) {
    found.set(key, {
      attempt,
      elapsed: engine.result.elapsed.toFixed(2),
      fuel: engine.result.fuel.toFixed(1),
      vx: engine.result.vx.toFixed(1),
      vy: engine.result.vy.toFixed(1),
      tilt: (engine.result.angle * 180 / Math.PI).toFixed(1),
      decisions: decisions.join(""),
    });
  }
}

for (let attempt = 0; attempt < 60000 && !found.has("A-safe") && bestAPolicy; attempt += 1) {
  const candidate = bestAPolicy.slice();
  const flips = 1 + Math.floor(rng() * 4);
  for (let flip = 0; flip < flips; flip += 1) {
    const index = Math.floor(rng() * candidate.length);
    candidate[index] = candidate[index] ? 0 : 1;
  }
  const engine = runPolicy(candidate);
  const penalty = safePenalty(engine);
  if (penalty < bestAPenalty) {
    bestAPenalty = penalty;
    bestAPolicy = candidate;
  }
  if (engine.result?.pad === "A" && engine.result.kind === "safe") {
    found.set("A-safe", {
      attempt: `refine-${attempt}`,
      elapsed: engine.result.elapsed.toFixed(2),
      fuel: engine.result.fuel.toFixed(1),
      vx: engine.result.vx.toFixed(1),
      vy: engine.result.vy.toFixed(1),
      tilt: (engine.result.angle * 180 / Math.PI).toFixed(1),
      decisions: candidate.join(""),
    });
  }
}

console.log(JSON.stringify(Object.fromEntries(found), null, 2));
if (!found.has("A-safe")) {
  throw new Error("No deterministic policy found for safe landing on pad A");
}
if (![...found.keys()].some((key) => key.startsWith("B-"))) {
  throw new Error("No deterministic policy found for landing on pad B");
}
