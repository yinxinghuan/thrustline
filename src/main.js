import "./style.css";
import { FIELD_H, FIELD_W, HARD_LIMITS, SAFE_LIMITS, ThrustlineEngine } from "./engine.js";
import { ThrustlineRenderer } from "./renderer.js";
import { ThrustlineAudio } from "./audio.js";
import { formatReason, formatRegret, locale, localeSource, outcomeLabel, phaseLabel, t } from "./i18n.js";
import { resolvePlayerIdentity, renderIdentity } from "./identity.js";
import { ThrustlineLeaderboard } from "./leaderboard.js";

const app = document.querySelector("#app");
const MEDIA = {
  safe: new URL("./media/thrustline-safe.jpg", document.baseURI).href,
  hard: new URL("./media/thrustline-hard.jpg", document.baseURI).href,
  crash: new URL("./media/thrustline-crash.jpg", document.baseURI).href,
};
app.innerHTML = `
  <section class="tl-shell crt-terminal" data-channel="program">
    <header class="tl-header">
      <div>
        <small>${t("subtitle")}</small>
        <h1>${t("deskTitle")}</h1>
      </div>
      <div class="tl-header__tools">
        <button class="tl-rank-trigger" type="button">${t("rank")}</button>
        <button class="tl-sound" type="button" aria-label="${t("mute")}" aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h4l5-4v12l-5-4H4z"/><path class="tl-sound__wave" d="M16 9l3 3-3 3"/></svg>
          <span data-sound-state>${t("on")}</span>
        </button>
        <div class="tl-clock"><b data-time>30.0</b><small>${t("seconds")}</small></div>
      </div>
    </header>
    <div class="tl-field">
      <canvas class="tl-canvas" width="${FIELD_W}" height="${FIELD_H}" aria-label="${t("canvasLabel")}"></canvas>
      <div class="tl-onboard">
        <span class="tl-onboard__press" aria-hidden="true"></span>
        <strong>${t("hold")}</strong>
        <span>${t("release")}</span>
      </div>
      <div class="tl-state" aria-live="polite"><b data-state>${t("ready")}</b><span data-wind>${t("noWind")}</span></div>
      <section class="tl-result" hidden>
        <header class="tl-return__head"><div><small data-result-kicker>${t("fieldReturn")}</small><h2 data-result-title>${t("crash")}</h2></div><p data-result-task></p></header>
        <div class="tl-evidence-wrap"><img class="tl-camera-media" src="${MEDIA.safe}" alt="${t("fieldReturn")}" draggable="false"><canvas class="tl-evidence" width="600" height="360" aria-hidden="true" hidden></canvas><div class="tl-return-lock">${t("signalLock")}</div><span class="tl-camera-label">${t("cameraFeed")}</span></div>
        <p data-result-reason></p>
        <dl class="tl-return__metrics">
          <div><dt>${t("hSpeed")}</dt><dd data-result-vx>0.0</dd></div>
          <div><dt>${t("vSpeed")}</dt><dd data-result-vy>0.0</dd></div>
          <div><dt>${t("tilt")}</dt><dd data-result-tilt>0.0°</dd></div>
          <div><dt>${t("fuel")}</dt><dd data-result-fuel>0</dd></div>
        </dl>
        <div class="tl-return__bottom"><div><p class="tl-regret" data-result-regret></p><div class="tl-score">${t("score")} <b data-result-score>0</b></div><div class="tl-player"><img data-player-avatar alt="" draggable="false"><span data-player-name>AlterU</span></div></div><div class="tl-return__actions"><button class="tl-retry" type="button">${t("retry")}</button><button class="tl-result-sound" type="button"></button></div></div>
      </section>
      <div class="tl-pause" hidden>${t("paused")}<br><small>${t("pauseHint")}</small></div>
    </div>
    <footer class="tl-hud">
      <section class="tl-fuel">
        <div><span>${t("fuel")}</span><b data-fuel>100</b></div>
        <div class="tl-fuel__track"><i data-fuel-bar></i></div>
      </section>
      <section class="tl-metrics">
        <div><span>${locale === "zh" ? "水平" : "H"}</span><b data-vx>+4.0</b><small>${t("safe")} ≤18</small></div>
        <div><span>${locale === "zh" ? "垂直" : "V"}</span><b data-vy>+4.0</b><small>${t("safe")} ≤36</small></div>
        <div><span>${t("tilt")}</span><b data-tilt>-6.0°</b><small>${t("safe")} ≤13°</small></div>
      </section>
    </footer>
    <section class="tl-rank" role="dialog" aria-modal="true" aria-labelledby="tl-rank-title" hidden><div class="tl-rank__panel"><header><small>THRUSTLINE / TOP 50</small><h2 id="tl-rank-title">${t("rank")}</h2></header><div class="tl-rank__list"></div><button class="tl-rank__close" type="button">${t("retry")==="RETRY"?"CLOSE":"关闭"}</button></div></section>
    <div class="crt-optics" aria-hidden="true"></div><div class="crt-vsync" aria-hidden="true"></div>
  </section>`;

const canvas = app.querySelector(".tl-canvas");
const field = app.querySelector(".tl-field");
const engine = new ThrustlineEngine();
const renderer = new ThrustlineRenderer(canvas, engine, t);
const audio = new ThrustlineAudio();
const gameUuid = document.querySelector('meta[name="game-uuid"]')?.content || "";
const leaderboard = new ThrustlineLeaderboard({
  modal: app.querySelector(".tl-rank"),
  list: app.querySelector(".tl-rank__list"),
  close: app.querySelector(".tl-rank__close"),
  triggers: [app.querySelector(".tl-rank-trigger")],
  gameUuid,
});
const onboard = app.querySelector(".tl-onboard");
const result = app.querySelector(".tl-result");
const pause = app.querySelector(".tl-pause");
let pointerId = null;
let previous = performance.now();
let resultShown = false;
let lastAudioTelemetry = 0;
let resultSnapshot = null;
let evidenceRenderCount = 0;
const missionBase = "LG-02P";

const soundButton = app.querySelector(".tl-sound");
const resultSoundButton = app.querySelector(".tl-result-sound");
function updateSoundButton() {
  soundButton.classList.toggle("is-muted", audio.muted);
  soundButton.setAttribute("aria-pressed", String(audio.muted));
  soundButton.setAttribute("aria-label", t(audio.muted ? "soundOn" : "mute"));
  soundButton.querySelector("[data-sound-state]").textContent = t(audio.muted ? "off" : "on");
  resultSoundButton.textContent = t(audio.muted ? "soundOff" : "soundOnShort");
  resultSoundButton.setAttribute("aria-pressed", String(audio.muted));
  resultSoundButton.setAttribute("aria-label", t(audio.muted ? "soundOn" : "mute"));
}

soundButton.addEventListener("click", async () => {
  await audio.unlock();
  audio.setMuted(!audio.muted);
  if (!audio.muted && engine.thrusting) audio.startThrust(engine.fuel);
  audio.click();
  updateSoundButton();
});
resultSoundButton.addEventListener("click", async () => {
  await audio.unlock(); audio.setMuted(!audio.muted); audio.click(); updateSoundButton();
});

function setThrust(active, event) {
  if (active) {
    if (pointerId !== null || resultShown || event.isPrimary === false) return;
    pointerId = event.pointerId;
    canvas.setPointerCapture?.(pointerId);
    engine.setThrust(true);
    void audio.unlock().then(() => {
      if (pointerId === event.pointerId && engine.thrusting) audio.startThrust(engine.fuel);
    });
    onboard.classList.add("is-gone");
  } else {
    if (event.pointerId !== pointerId) return;
    engine.setThrust(false);
    audio.stopThrust();
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
  audio.pause();
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
  app.querySelector("[data-state]").textContent = phaseLabel(engine.phase, engine.thrusting);
  app.querySelector("[data-wind]").textContent = t(engine.windActive ? "wind" : "noWind");
  app.classList.toggle("is-thrusting", engine.thrusting);
  app.classList.toggle("is-low-fuel", engine.fuel <= 22);
  app.querySelector("[data-vx]").classList.toggle("is-over", Math.abs(engine.vx) > HARD_LIMITS.vx);
  app.querySelector("[data-vy]").classList.toggle("is-over", Math.max(0, engine.vy) > HARD_LIMITS.vy);
  app.querySelector("[data-tilt]").classList.toggle("is-over", Math.abs(engine.angle) > HARD_LIMITS.tilt);
}

function showResult(event) {
  if (resultShown) return;
  resultShown = true;
  resultSnapshot = Object.freeze({ ...event, x: engine.x, y: engine.y, history: engine.history.map((point) => ({ ...point })), mission: `${missionBase}-${event.pad || "R"}-${Math.round(engine.x)}-${Math.ceil(event.fuel)}` });
  app.querySelector("[data-result-kicker]").textContent = event.pad ? t("pad", { id: event.pad }) : t("flightEnded");
  app.querySelector("[data-result-title]").textContent = outcomeLabel(event.kind);
  app.querySelector("[data-result-reason]").textContent = formatReason(event);
  app.querySelector("[data-result-vx]").textContent = `${Math.abs(event.vx).toFixed(1)} / ${SAFE_LIMITS.vx}`;
  app.querySelector("[data-result-vy]").textContent = `${Math.max(0, event.vy).toFixed(1)} / ${SAFE_LIMITS.vy}`;
  app.querySelector("[data-result-tilt]").textContent = `${(Math.abs(event.angle) * 180 / Math.PI).toFixed(1)}° / 13°`;
  app.querySelector("[data-result-fuel]").textContent = String(Math.ceil(event.fuel));
  app.querySelector("[data-result-regret]").textContent = formatRegret(event.regret);
  app.querySelector("[data-result-score]").textContent = String(event.score);
  result.dataset.outcome = event.kind;
  const mediaKind = event.kind === "safe" ? "safe" : event.kind === "hard" ? "hard" : "crash";
  app.querySelector(".tl-camera-media").src = MEDIA[mediaKind];
  app.querySelector(".tl-camera-label").textContent = `${t("cameraFeed")} · ${t("videoLock")}`;
  evidenceRenderCount += 1;
  app.querySelector("[data-result-task]").textContent = `${t("task")} ${resultSnapshot.mission} · T+${event.elapsed.toFixed(1)}`;
  renderer.trigger(event.kind, { x: engine.x, y: engine.y });
  result.hidden = false;
  app.querySelector(".tl-shell").dataset.channel = "camera";
  audio.result(event.kind);
  audio.fieldReturn(event.kind);
  result.classList.toggle("is-locking", !matchMedia("(prefers-reduced-motion: reduce)").matches);
  leaderboard.submit(event.score);
  setTimeout(() => result.classList.remove("is-locking"), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520);
}

function reset() {
  engine.reset();
  resultShown = false;
  resultSnapshot = null;
  evidenceRenderCount = 0;
  pointerId = null;
  result.hidden = true;
  app.querySelector(".tl-shell").dataset.channel = "program";
  pause.hidden = true;
  onboard.classList.remove("is-gone");
  delete result.dataset.outcome;
  renderer.resetFeedback();
  audio.reset();
  audio.click();
  previous = performance.now();
  updateHud();
  renderer.draw();
}

app.querySelector(".tl-retry").addEventListener("click", reset);

function processEvents() {
  for (const event of engine.consumeEvents()) {
    if (event.type === "fuel-empty") audio.stopThrust();
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
    if (engine.phase === "playing" && now - lastAudioTelemetry >= 100) {
      lastAudioTelemetry = now;
      audio.updateTelemetry({
        fuel: engine.fuel,
        wind: engine.windActive,
        prediction: engine.predict().outcome,
        elapsed: engine.elapsed,
        vx: engine.vx,
        vy: engine.vy,
        angle: engine.angle,
      });
    }
  }
  requestAnimationFrame(frame);
}

window.__THRUSTLINE_GRAYBOX__ = {
  engine,
  reset,
  audio,
  renderer,
  locale,
  localeSource,
  thresholds: { safe: SAFE_LIMITS, hard: HARD_LIMITS },
  leaderboard,
  result: () => ({ snapshot: resultSnapshot, evidenceRenderCount }),
  input: () => ({ pointerId, thrusting: engine.thrusting }),
  forceResult: (kind = "safe") => {
    const presets = {
      safe: { vx: 8, vy: 24, angle: 0.08, fuel: 64, pad: "A", score: 2400, regret: "TRY THE NARROW 1900 PAD", reason: "SAFE" },
      hard: { vx: 24, vy: 42, angle: 0.22, fuel: 41, pad: "A", score: 750, regret: "REDUCE H SPEED BY 6.0", reason: "H SPEED 24.0 > 30" },
      crash: { vx: 36, vy: 52, angle: 0.4, fuel: 18, pad: null, score: 0, regret: "BRAKE EARLIER", reason: "RIDGE CONTACT" },
    };
    const preset = presets[kind] || presets.crash;
    showResult({ type: "finish", kind, elapsed: engine.elapsed, x: engine.x, y: engine.y, ...preset });
  },
};

renderIdentity(app);
resolvePlayerIdentity().then((identity) => renderIdentity(app, identity));
updateSoundButton();
updateHud();
renderer.draw();
requestAnimationFrame(frame);
