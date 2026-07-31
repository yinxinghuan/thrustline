import { callAigramAPI, isInAigram, openAigramProfile, telegramId } from "./shared/runtime/bridge.ts";

const ALTERU_APP_URL = "https://alteru.app";
const canUsePlatformRank = isInAigram && telegramId !== "__alteru_guest__";
const initial = (name) => ((name || "?").trim().charAt(0) || "?").toUpperCase();

function rowsFrom(response) {
  const rows = Array.isArray(response) ? response : response?.data;
  return Array.isArray(rows)
    ? rows.map((row) => ({ ...row, rank: Number(row.rank) || 0, score: Number(row.score) || 0 }))
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    : [];
}

export class ThrustlineLeaderboard {
  constructor({ modal, list, close, triggers, gameUuid }) {
    Object.assign(this, { modal, list, closeButton: close, triggers, gameUuid, lastFocused: null });
    triggers.forEach((trigger) => trigger.addEventListener("click", () => this.open()));
    close.addEventListener("click", () => this.close());
    modal.addEventListener("click", (event) => { if (event.target === modal) this.close(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) this.close();
    });
  }

  state(message, className = "") {
    this.list.replaceChildren();
    const node = document.createElement("div");
    node.className = `tl-rank__state ${className}`.trim();
    node.textContent = message;
    this.list.appendChild(node);
  }

  external() {
    this.list.replaceChildren();
    const node = document.createElement("div");
    node.className = "tl-rank__state tl-rank__external";
    const title = document.createElement("b");
    title.textContent = "RANK / ALTERU";
    const copy = document.createElement("p");
    copy.textContent = "实时排行榜仅在 AlterU 内显示。当前成绩仍可在本机试玩。";
    const link = document.createElement("a");
    link.href = ALTERU_APP_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "打开 AlterU";
    node.append(title, copy, link);
    this.list.appendChild(node);
  }

  render(rows) {
    if (!rows.length) return this.state("还没有着陆成绩 / NO LANDINGS YET");
    this.list.replaceChildren();
    rows.forEach((row) => {
      const self = telegramId && String(row.user_id) === String(telegramId);
      const item = document.createElement(self ? "div" : "button");
      item.className = `tl-rank__row${self ? " is-self" : ""}`;
      if (!self) {
        item.type = "button";
        item.addEventListener("click", () => {
          if (canUsePlatformRank && row.user_id) openAigramProfile(String(row.user_id));
        });
        item.setAttribute("aria-label", `打开 ${row.user_name || "玩家"} 的资料`);
      }
      const rank = document.createElement("span");
      rank.className = "tl-rank__number";
      rank.textContent = `#${row.rank || "—"}`;
      item.append(rank);
      if (self) {
        const you = document.createElement("span");
        you.className = "tl-rank__you";
        you.textContent = "你 / YOU";
        item.append(you);
      } else {
        const avatar = document.createElement("span");
        avatar.className = "tl-rank__avatar";
        avatar.setAttribute("aria-hidden", "true");
        if (row.head_url) {
          const image = document.createElement("img");
          image.src = row.head_url;
          image.alt = "";
          image.draggable = false;
          image.addEventListener("error", () => avatar.replaceChildren(initial(row.user_name)), { once: true });
          avatar.append(image);
        } else avatar.textContent = initial(row.user_name);
        const name = document.createElement("span");
        name.className = "tl-rank__name";
        name.textContent = row.user_name || "?";
        item.append(avatar, name);
      }
      const score = document.createElement("b");
      score.className = "tl-rank__score";
      score.textContent = String(row.score);
      item.append(score);
      this.list.append(item);
    });
  }

  async refresh() {
    const response = await callAigramAPI(
      `/note/aigram/ai/game/rank/score/list/by/session_id?session_id=${encodeURIComponent(this.gameUuid)}`,
      "GET",
    );
    this.render(rowsFrom(response));
  }

  open() {
    this.lastFocused = document.activeElement;
    this.modal.hidden = false;
    if (!canUsePlatformRank || !this.gameUuid) this.external();
    else {
      this.state("正在读取着陆记录… / READING LANDINGS…");
      this.refresh().catch(() => this.state("排行榜暂不可用 / RANK UNAVAILABLE"));
    }
    requestAnimationFrame(() => this.closeButton.focus({ preventScroll: true }));
  }

  close() {
    this.modal.hidden = true;
    this.lastFocused?.focus?.({ preventScroll: true });
  }

  async submit(score) {
    const value = Math.max(0, Math.round(score));
    if (!canUsePlatformRank || !this.gameUuid || value <= 0) return;
    try {
      await callAigramAPI("/note/aigram/ai/game/rank/score/save", "POST", { session_id: this.gameUuid, score: value });
    } catch {
      // Ranking never blocks results or replay.
    }
  }
}
