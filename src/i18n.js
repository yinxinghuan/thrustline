const SUPPORTED = new Set(["zh", "en"]);

function normalizeLocale(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("en")) return "en";
  return null;
}

function hostLocale() {
  if (window.parent === window) return null;
  try {
    const root = window.parent.document.documentElement;
    return normalizeLocale(root.dataset.hostLocale)
      || normalizeLocale(root.lang)
      || normalizeLocale(window.parent.document.body?.dataset.locale);
  } catch {
    // A cross-origin host cannot be inspected. Fall through to explicit local signals.
    return null;
  }
}

export function detectLocale() {
  const fromHost = hostLocale();
  if (fromHost) return { locale: fromHost, source: "host" };

  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeLocale(params.get("lang") || params.get("locale"));
  if (fromQuery) return { locale: fromQuery, source: "query" };

  try {
    const fromStorage = normalizeLocale(localStorage.getItem("game_locale"));
    if (fromStorage) return { locale: fromStorage, source: "storage" };
  } catch {
    // Storage can be unavailable in privacy-restricted WebViews.
  }

  const fromNavigator = normalizeLocale(navigator.language);
  return { locale: fromNavigator || "en", source: fromNavigator ? "navigator" : "default" };
}

const MESSAGES = {
  zh: {
    subtitle: "程序 CH-01 · 远程着陆",
    deskTitle: "着陆引导台",
    seconds: "秒",
    canvasLabel: "按住点火，松开滑行",
    hold: "按住点火",
    release: "松开滑行",
    ready: "准备",
    thrust: "点火",
    coast: "滑行",
    paused: "已暂停",
    pauseHint: "松开后继续",
    wind: "气流 +24 →",
    noWind: "无气流",
    result: "结果",
    fieldReturn: "外部摄像输入",
    signalLock: "继电器切换 / 视频同步",
    cameraFeed: "山脊摄像机",
    videoLock: "信号锁定",
    task: "任务",
    soundOff: "声音关",
    soundOnShort: "声音开",
    flightEnded: "飞行结束",
    pad: "着陆区 {id}",
    safeLanding: "安全着陆",
    hardLanding: "硬着陆",
    crash: "坠毁",
    timeout: "超时",
    hSpeed: "水平速度",
    vSpeed: "垂直速度",
    tilt: "倾角",
    fuel: "燃料",
    score: "得分",
    safe: "安全",
    risk: "高风险",
    retry: "立即重开",
    rank: "排行榜",
    mute: "静音",
    soundOn: "开启声音",
    on: "开",
    off: "关",
    flight: "飞行",
    reasonSafe: "速度与倾角均在安全阈值内",
    reasonHard: "已着陆，但超出安全阈值",
    reasonHSpeed: "水平速度 {value} 超过 {limit}",
    reasonVSpeed: "垂直速度 {value} 超过 {limit}",
    reasonTilt: "倾角 {value}° 超过 {limit}°",
    reasonRidge: "撞上山脊",
    reasonWall: "撞上侧壁",
    reasonCeiling: "飞出顶部边界",
    reasonNoLanding: "30.0 秒内未着陆",
    reasonCrash: "飞行器超出安全飞行范围",
    regretNarrow: "尝试 1900 分窄平台",
    regretHSpeed: "水平速度再降低 {value}",
    regretBrake: "再制动 {value}",
    regretBrakeEarlier: "更早开始制动",
    regretAngle: "等待更平的角度",
    regretCommit: "更早选择着陆区",
    regretThrust: "越过山脊前点火",
  },
  en: {
    subtitle: "PROGRAM CH-01 · REMOTE LANDING",
    deskTitle: "THRUSTLINE",
    seconds: "SEC",
    canvasLabel: "Hold to thrust, release to coast",
    hold: "HOLD TO THRUST",
    release: "RELEASE TO COAST",
    ready: "READY",
    thrust: "THRUST",
    coast: "COAST",
    paused: "PAUSED",
    pauseHint: "Release to continue",
    wind: "WIND +24 →",
    noWind: "NO WIND",
    result: "RESULT",
    fieldReturn: "EXTERNAL CAMERA INPUT",
    signalLock: "RELAY CUT / VIDEO SYNC",
    cameraFeed: "RIDGE CAMERA",
    videoLock: "VIDEO LOCK",
    task: "TASK",
    soundOff: "SOUND OFF",
    soundOnShort: "SOUND ON",
    flightEnded: "FLIGHT ENDED",
    pad: "PAD {id}",
    safeLanding: "SAFE LANDING",
    hardLanding: "HARD LANDING",
    crash: "CRASH",
    timeout: "TIMEOUT",
    hSpeed: "H SPEED",
    vSpeed: "V SPEED",
    tilt: "TILT",
    fuel: "FUEL",
    score: "SCORE",
    safe: "SAFE",
    risk: "RISK",
    retry: "RETRY",
    rank: "RANK",
    mute: "MUTE",
    soundOn: "SOUND ON",
    on: "ON",
    off: "OFF",
    flight: "FLIGHT",
    reasonSafe: "SPEED AND TILT WITHIN SAFE LIMITS",
    reasonHard: "LANDED ABOVE SAFE LIMITS",
    reasonHSpeed: "H SPEED {value} > {limit}",
    reasonVSpeed: "V SPEED {value} > {limit}",
    reasonTilt: "TILT {value}° > {limit}°",
    reasonRidge: "RIDGE CONTACT",
    reasonWall: "SIDE WALL",
    reasonCeiling: "CEILING EXIT",
    reasonNoLanding: "30.0s / NO LANDING",
    reasonCrash: "CRAFT LEFT THE SAFE FLIGHT ENVELOPE",
    regretNarrow: "TRY THE NARROW 1900 PAD",
    regretHSpeed: "REDUCE H SPEED BY {value}",
    regretBrake: "BRAKE {value}",
    regretBrakeEarlier: "BRAKE EARLIER",
    regretAngle: "WAIT FOR A FLATTER ANGLE",
    regretCommit: "COMMIT TO A PAD EARLIER",
    regretThrust: "THRUST BEFORE THE RIDGE",
  },
};

const detection = detectLocale();
export const locale = SUPPORTED.has(detection.locale) ? detection.locale : "en";
export const localeSource = detection.source;

export function t(key, vars = {}) {
  const template = MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

export function phaseLabel(phase, thrusting) {
  if (phase === "playing") return t(thrusting ? "thrust" : "coast");
  const key = { ready: "ready", paused: "paused", safe: "safeLanding", hard: "hardLanding", crash: "crash", timeout: "timeout" }[phase];
  return t(key || "flight");
}

export function outcomeLabel(kind) {
  return t({ safe: "safeLanding", hard: "hardLanding", crash: "crash", timeout: "timeout", flight: "flight" }[kind] || "flight");
}

export function formatReason(event) {
  const reason = String(event.reason || "");
  if (event.kind === "safe" || reason === "safe" || reason === "SAFE") return t("reasonSafe");
  if (event.kind === "hard" || reason === "hard" || reason === "HARD") return t("reasonHard");
  let match = reason.match(/^H SPEED ([\d.]+) > ([\d.]+)$/);
  if (match) return t("reasonHSpeed", { value: match[1], limit: match[2] });
  match = reason.match(/^V SPEED ([\d.]+) > ([\d.]+)$/);
  if (match) return t("reasonVSpeed", { value: match[1], limit: match[2] });
  match = reason.match(/^TILT ([\d.]+)° > ([\d.]+)°$/);
  if (match) return t("reasonTilt", { value: match[1], limit: match[2] });
  if (reason === "RIDGE CONTACT") return t("reasonRidge");
  if (reason === "SIDE WALL") return t("reasonWall");
  if (reason === "CEILING EXIT") return t("reasonCeiling");
  if (reason === "30.0s / NO LANDING") return t("reasonNoLanding");
  return t("reasonCrash");
}

export function formatRegret(value) {
  const regret = String(value || "");
  if (regret === "TRY THE NARROW 1900 PAD") return t("regretNarrow");
  let match = regret.match(/^REDUCE H SPEED BY ([\d.]+)$/);
  if (match) return t("regretHSpeed", { value: match[1] });
  match = regret.match(/^BRAKE ([\d.]+)$/);
  if (match) return t("regretBrake", { value: match[1] });
  if (regret === "BRAKE EARLIER") return t("regretBrakeEarlier");
  if (regret === "WAIT FOR A FLATTER ANGLE") return t("regretAngle");
  if (regret === "COMMIT TO A PAD EARLIER") return t("regretCommit");
  return t("regretThrust");
}

document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
document.documentElement.dataset.locale = locale;
