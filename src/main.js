import "./style.css";
import { FIELD_H, FIELD_W, HARD_LIMITS, SAFE_LIMITS, ThrustlineEngine } from "./engine.js";
import { ThrustlineRenderer } from "./renderer.js";
import { resolvePlayerIdentity, renderIdentity } from "./identity.js";
import { ThrustlineLeaderboard } from "./leaderboard.js";

const app = document.querySelector("#app");
app.innerHTML = `
  <section class="tl-shell">
    <header class="tl-header">
      <div>
        <small>TL—01 / 30s LANDING RUN</small>
        <h1>THRUSTLINE</h1>
      </div>
      <div class="tl-header__right"><div class="tl-clock"><b data-time>30.0</b><small>SEC</small></div><button class="tl-rank-trigger" type="button">RANK</button></div>
    </header>
    <div class="tl-field">
      <canvas class="tl-canvas" width="${FIELD_W}" height="${FIELD_H}" aria-label="按住点火，松开滑行"></canvas>
      <div class="tl-onboard">
        <span class="tl-onboard__press" aria-hidden="true"></span>
        <strong>按住点火</strong>
        <span>松开滑行 · HOLD / RELEASE</span>
      </div>
      <div class="tl-state" aria-live="polite"><b data-state>READY</b><span data-wind>NO WIND</span></div>
      <section class="tl-result" hidden>
        <small data-result-kicker>RESULT</small>
        <h2 data-result-title>CRASH</h2>
        <p data-result-reason></p>
        <dl>
          <div><dt>H SPEED</dt><dd data-result-vx>0.0</dd></div>
          <div><dt>V SPEED</dt><dd data-result-vy>0.0</dd></div>
          <div><dt>TILT</dt><dd data-result-tilt>0.0°</dd></div>
          <div><dt>FUEL</dt><dd data-result-fuel>0</dd></div>
        </dl>
        <p class="tl-regret" data-result-regret></p>
        <div class="tl-score">SCORE <b data-result-score>0</b></div>
        <div class="tl-player"><img data-player-avatar alt="" draggable="false"><span data-player-name>AlterU</span></div>
        <div class="tl-result__actions">
          <button class="tl-retry" type="button">立即重开 / RETRY</button>
          <button class="tl-result-rank" type="button">排行榜 / RANK</button>
        </div>
      </section>
      <div class="tl-pause" hidden>PAUSED<br><small>松开后继续</small></div>
    </div>
    <footer class="tl-hud">
      <section class="tl-fuel">
        <div><span>FUEL</span><b data-fuel>100</b></div>
        <div class="tl-fuel__track"><i data-fuel-bar></i></div>
      </section>
      <section class="tl-metrics">
        <div><span>H</span><b data-vx>+18.0</b><small>SAFE ≤18</small></div>
        <div><span>V</span><b data-vy>+5.0</b><small>SAFE ≤36</small></div>
        <div><span>TILT</span><b data-tilt>-24.0°</b><small>SAFE ≤13°</small></div>
      </section>
    </footer>
    <section class="tl-rank" role="dialog" aria-modal="true" aria-labelledby="tl-rank-title" hidden>
      <div class="tl-rank__panel">
        <header><small>THRUSTLINE / TOP 50</small><h2 id="tl-rank-title">着陆排行</h2></header>
        <div class="tl-rank__list"></div>
        <button class="tl-rank__close" type="button">关闭 / CLOSE</button>
      </div>
    </section>
  </section>`;

const canvas = app.querySelector(".tl-canvas");
const field = app.querySelector(".tl-field");
const engine = new ThrustlineEngine();
const renderer = new ThrustlineRenderer(canvas, engine);
const gameUuid = document.querySelector('meta[name="game-uuid"]')?.content || "";
const leaderboard = new ThrustlineLeaderboard({
  modal: app.querySelector(".tl-rank"),
  list: app.querySelector(".tl-rank__list"),
  close: app.querySelector(".tl-rank__close"),
  triggers: [app.querySelector(".tl-rank-trigger"), app.querySelector(".tl-result-rank")],
  gameUuid,
});
const onboard = app.querySelector(".tl-onboard");
const result = app.querySelector(".tl-result");
const pause = app.querySelector(".tl-pause");
let pointerId = null;
let previous = performance.now();
let resultShown = false;

function setThrust(active, event) {
  if (active) {
    if (pointerId !== null || resultShown || event.isPrimary === false) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture?.(pointerId);
    engine.setThrust(true);
    onboard.classList.add("is-gone");
  } else {
    if (event.pointerId !== pointerId) return;
    engine.setThrust(false);
    pointerId = null;
  }
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  setThrust(true, event);
});
canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  setThrust(false, event);
});
canvas.addEventListener("pointercancel", (event) => setThrust(false, event));
canvas.addEventListener("lostpointercapture", (event) => setThrust(false, event));

function clearPointerAndPause() {
  if (pointerId !== null) engine.setThrust(false);
  pointerId = null;
  engine.setPaused(true);
  pause.hidden = false;
}

function resumeIfVisible() {
  if (document.hidden) return;
  engine.setPaused(false);
  pause.hidden = true;
  previous = performance.now();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearPointerAndPause();
  else resumeIfVisible();
});
window.addEventListener("blur", clearPointerAndPause);
window.addEventListener("focus", resumeIfVisible);

function signed(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function updateHud() {
  app.querySelector("[data-time]").textContent = engine.timeLeft.toFixed(1);
  app.querySelector("[data-fuel]").textContent = String(Math.ceil(engine.fuel));
  app.querySelector("[data-fuel-bar]").style.transform = `scaleX(${engine.fuel / 100})`;
  app.querySelector("[data-vx]").textContent = signed(engine.vx);
  app.querySelector("[data-vy]").textContent = signed(engine.vy);
  app.querySelector("[data-tilt]").textContent = `${(engine.angle * 180 / Math.PI).toFixed(1)}°`;
  app.querySelector("[data-state]").textContent = engine.phase === "playing"
    ? (engine.thrusting ? "THRUST" : "COAST")
    : engine.phase.toUpperCase();
  app.querySelector("[data-wind]").textContent = engine.windActive ? "WIND +24 →" : "NO WIND";
  app.classList.toggle("is-thrusting", engine.thrusting);
  app.classList.toggle("is-low-fuel", engine.fuel <= 22);
  app.querySelector("[data-vx]").classList.toggle("is-over", Math.abs(engine.vx) > HARD_LIMITS.vx);
  app.querySelector("[data-vy]").classList.toggle("is-over", Math.max(0, engine.vy) > HARD_LIMITS.vy);
  app.querySelector("[data-tilt]").classList.toggle("is-over", Math.abs(engine.angle) > HARD_LIMITS.tilt);
}

function showResult(event) {
  if (resultShown) return;
  resultShown = true;
  const title = {
    safe: "SAFE LANDING",
    hard: "HARD LANDING",
    crash: "CRASH",
    timeout: "TIMEOUT",
  }[event.kind];
  app.querySelector("[data-result-kicker]").textContent = event.pad ? `PAD ${event.pad}` : "FLIGHT ENDED";
  app.querySelector("[data-result-title]").textContent = title;
  app.querySelector("[data-result-reason]").textContent = event.reason;
  app.querySelector("[data-result-vx]").textContent = `${Math.abs(event.vx).toFixed(1)} / ${SAFE_LIMITS.vx}`;
  app.querySelector("[data-result-vy]").textContent = `${Math.max(0, event.vy).toFixed(1)} / ${SAFE_LIMITS.vy}`;
  app.querySelector("[data-result-tilt]").textContent = `${(Math.abs(event.angle) * 180 / Math.PI).toFixed(1)}° / 13°`;
  app.querySelector("[data-result-fuel]").textContent = String(Math.ceil(event.fuel));
  app.querySelector("[data-result-regret]").textContent = event.regret;
  app.querySelector("[data-result-score]").textContent = String(event.score);
  result.hidden = false;
  leaderboard.submit(event.score);
}

function reset() {
  engine.reset();
  resultShown = false;
  pointerId = null;
  result.hidden = true;
  pause.hidden = true;
  onboard.classList.remove("is-gone");
  previous = performance.now();
  updateHud();
  renderer.draw();
}

app.querySelector(".tl-retry").addEventListener("click", reset);

function processEvents() {
  for (const event of engine.consumeEvents()) {
    if (event.type === "finish") showResult(event);
  }
}

function frame(now) {
  const delta = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  if (!document.hidden) {
    engine.advance(delta);
    processEvents();
    updateHud();
    renderer.draw();
  }
  requestAnimationFrame(frame);
}

window.__THRUSTLINE__ = {
  engine,
  reset,
  leaderboard,
  thresholds: { safe: SAFE_LIMITS, hard: HARD_LIMITS },
  input: () => ({ pointerId, thrusting: engine.thrusting }),
};

renderIdentity(app);
resolvePlayerIdentity().then((identity) => renderIdentity(app, identity));
updateHud();
renderer.draw();
requestAnimationFrame(frame);
