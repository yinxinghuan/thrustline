import { FIELD_H, FIELD_W, PADS, groundY, inWind } from "./engine.js";

const COLORS = {
  paper: "#f4f2ec",
  ink: "#171717",
  muted: "#a9a79f",
  warning: "#d4572a",
  white: "#ffffff",
};

const RETURN = { paper: "#f1eee4", ink: "#171816", red: "#c94b32", cyan: "#6ca99e", gray: "#8d8a80" };

export class ThrustlineRenderer {
  constructor(canvas, engine, translate = (key) => key) {
    this.canvas = canvas;
    this.engine = engine;
    this.t = translate;
    this.dpr = Math.min(devicePixelRatio || 1, matchMedia("(max-width:340px),(max-height:620px)").matches ? 1.15 : 1.5);
    this.canvas.width = Math.round(FIELD_W * this.dpr);
    this.canvas.height = Math.round(FIELD_H * this.dpr);
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.particles = [];
    this.feedback = [];
    this.lastParticleAt = 0;
    this.lastWind = false;
    this.lastPrediction = "flight";
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    this.drawGrid(ctx);
    this.drawWind(ctx);
    this.drawHistory(ctx);
    this.drawPrediction(ctx);
    this.drawTerrain(ctx);
    this.drawCraft(ctx);
    this.drawFeedback(ctx);
  }

  trigger(type, detail = {}) {
    const now = performance.now();
    const duration = this.reducedMotion ? 90 : ({ safe: 380, hard: 320, crash: 480 }[type] || 240);
    this.feedback.push({ type, start: now, duration, x: detail.x ?? this.engine.x, y: detail.y ?? this.engine.y });
    if (this.feedback.length > 8) this.feedback.splice(0, this.feedback.length - 8);
  }

  resetFeedback() {
    this.particles = [];
    this.feedback = [];
    this.lastParticleAt = 0;
    this.lastWind = false;
    this.lastPrediction = "flight";
  }

  drawGrid(ctx) {
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 0.5;
    for (let x = 30; x < FIELD_W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FIELD_H); ctx.stroke();
    }
    for (let y = 80; y < FIELD_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD_W, y); ctx.stroke();
    }
  }

  drawWind(ctx) {
    ctx.save();
    ctx.strokeStyle = COLORS.warning;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(162, 145, 70, 355);
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.warning;
    ctx.font = "700 8px ui-monospace, monospace";
    ctx.fillText(this.t("wind"), 240, 159);
    for (let y = 188; y < 490; y += 42) {
      const bend = this.engine.windActive ? Math.sin(this.engine.elapsed * 8 + y * 0.07) * 5 : 0;
      ctx.beginPath(); ctx.moveTo(174, y); ctx.lineTo(195, y + bend); ctx.lineTo(218, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(218, y); ctx.lineTo(210, y - 4); ctx.lineTo(210, y + 4); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawHistory(ctx) {
    const history = this.engine.history;
    if (history.length < 2) return;
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(history[0].x, history[0].y);
    for (const point of history.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  drawPrediction(ctx) {
    if (this.engine.phase === "ready") return;
    const prediction = this.engine.predict();
    const danger = prediction.outcome === "crash";
    ctx.strokeStyle = danger ? COLORS.warning : COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(prediction.points[0].x, prediction.points[0].y);
    for (const point of prediction.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const end = prediction.points[prediction.points.length - 1];
    ctx.fillStyle = danger ? COLORS.warning : COLORS.ink;
    ctx.fillRect(end.x - 3, end.y - 3, 6, 6);
    ctx.font = "700 8px ui-monospace, monospace";
    const predictionLabel = this.t({ safe: "safe", hard: "hardLanding", crash: "crash", flight: "flight" }[prediction.outcome] || "flight");
    ctx.fillText(predictionLabel, Math.min(FIELD_W - 64, end.x + 6), Math.max(88, end.y - 5));
  }

  drawTerrain(ctx) {
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(0, groundY(0));
    for (let x = 2; x <= FIELD_W; x += 2) ctx.lineTo(x, groundY(x));
    ctx.lineTo(FIELD_W, FIELD_H);
    ctx.lineTo(0, FIELD_H);
    ctx.closePath();
    ctx.fill();

    for (const pad of PADS) {
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(pad.x1, pad.y - 3, pad.x2 - pad.x1, 6);
      ctx.fillStyle = COLORS.ink;
      ctx.font = "700 8px ui-monospace, monospace";
      const label = `${this.t(pad.id === "A" ? "safe" : "risk")} / ${pad.baseScore}`;
      const labelWidth = ctx.measureText(label).width;
      ctx.fillText(label, (pad.x1 + pad.x2 - labelWidth) / 2, pad.y - 10);
      ctx.strokeStyle = COLORS.warning;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pad.x1, pad.y - 8); ctx.lineTo(pad.x1, pad.y + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.x2, pad.y - 8); ctx.lineTo(pad.x2, pad.y + 2); ctx.stroke();
    }
  }

  drawCraft(ctx) {
    const engine = this.engine;
    ctx.save();
    ctx.translate(engine.x, engine.y);
    ctx.rotate(engine.angle);
    this.drawRocketGlyph(ctx, engine.thrusting && engine.fuel > 0);
    ctx.restore();

    if (inWind(engine.x, engine.y)) {
      ctx.fillStyle = COLORS.warning;
      ctx.font = "700 8px ui-monospace, monospace";
      ctx.fillText(this.t("wind").split(" ")[0], engine.x + 16, engine.y - 12);
    }

    if (engine.thrusting && engine.fuel > 0) this.emitThrustDebris();
    this.drawThrustDebris(ctx);
    this.drawGroundDust(ctx);
  }

  drawRocketGlyph(ctx, thrusting = false) {
    if (thrusting) {
      ctx.fillStyle = COLORS.warning;
      ctx.beginPath();
      ctx.moveTo(-3, 11);
      ctx.lineTo(-1, 20);
      ctx.lineTo(0, 25);
      ctx.lineTo(3, 13);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.warning;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 15); ctx.lineTo(-7, 21);
      ctx.moveTo(6, 15); ctx.lineTo(7, 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-9, 17); ctx.lineTo(-13, 22);
      ctx.moveTo(9, 17); ctx.lineTo(13, 22);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(-5, 1); ctx.lineTo(-12, 11); ctx.lineTo(-4, 8); ctx.closePath();
    ctx.moveTo(5, 2); ctx.lineTo(12, 10); ctx.lineTo(4, 8); ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(6, -7);
    ctx.lineTo(7, 6);
    ctx.lineTo(4, 9);
    ctx.lineTo(-4, 9);
    ctx.lineTo(-7, 5);
    ctx.lineTo(-6, -7);
    ctx.closePath();
    ctx.fill();

    ctx.fillRect(-4, 8, 8, 5);
    ctx.fillStyle = COLORS.paper;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(3, -4); ctx.lineTo(0, -1); ctx.lineTo(-3, -4); ctx.closePath();
    ctx.fill();
    ctx.fillRect(-2, 8, 4, 1.5);
    ctx.strokeStyle = COLORS.paper;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, 4); ctx.lineTo(2, 1);
    ctx.stroke();
  }

  drawResultCraft(canvas, event) {
    const size = 58;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, 27);
    const angle = Math.max(-0.42, Math.min(0.42, event.angle || 0));
    ctx.rotate(angle);
    ctx.scale(1.35, 1.35);
    this.drawRocketGlyph(ctx, false);
    ctx.restore();
    ctx.strokeStyle = COLORS.warning;
    ctx.lineWidth = 2;
    if (event.kind === "safe" || event.kind === "hard") {
      ctx.beginPath(); ctx.moveTo(12, 49); ctx.lineTo(46, 49); ctx.stroke();
      if (event.kind === "safe") {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(17, 45); ctx.lineTo(17, 52);
        ctx.moveTo(41, 45); ctx.lineTo(41, 52);
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(16, 43); ctx.lineTo(12, 39); ctx.moveTo(42, 43); ctx.lineTo(47, 38); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, 47); ctx.lineTo(3, 44); ctx.moveTo(49, 47); ctx.lineTo(55, 43); ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(10, 42); ctx.lineTo(18, 36);
      ctx.moveTo(39, 40); ctx.lineTo(49, 34);
      ctx.moveTo(14, 49); ctx.lineTo(22, 45);
      ctx.stroke();
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(6, 32, 5, 4);
      ctx.fillRect(48, 43, 4, 6);
      ctx.fillRect(20, 51, 6, 3);
    }
  }

  drawFieldReturn(canvas, snapshot) {
    const ctx = canvas.getContext("2d", { alpha: false });
    const width = canvas.width, height = canvas.height;
    const mapX = (x) => 28 + x / FIELD_W * (width - 56);
    const mapY = (y) => 18 + y / FIELD_H * (height - 46);
    ctx.fillStyle = RETURN.paper; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = RETURN.gray; ctx.lineWidth = 1;
    for (let y = 34; y < height - 30; y += 34) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(width - 18, y); ctx.stroke(); }

    const history = snapshot.history.slice(-22);
    if (history.length > 1) {
      ctx.strokeStyle = RETURN.gray; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(mapX(history[0].x), mapY(history[0].y));
      for (const point of history.slice(1)) ctx.lineTo(mapX(point.x), mapY(point.y));
      ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.strokeStyle = RETURN.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mapX(0), mapY(groundY(0)));
    for (let x = 3; x <= FIELD_W; x += 3) ctx.lineTo(mapX(x), mapY(groundY(x)));
    ctx.stroke();
    for (const pad of PADS) {
      ctx.strokeStyle = pad.id === snapshot.pad ? RETURN.cyan : RETURN.gray; ctx.lineWidth = pad.id === snapshot.pad ? 6 : 2;
      ctx.beginPath(); ctx.moveTo(mapX(pad.x1), mapY(pad.y)); ctx.lineTo(mapX(pad.x2), mapY(pad.y)); ctx.stroke();
      ctx.fillStyle = RETURN.ink; ctx.font = "800 13px ui-monospace,monospace"; ctx.fillText(`PAD ${pad.id}`, mapX(pad.x1), mapY(pad.y) - 9);
    }

    const cx = mapX(snapshot.x), cy = Math.min(height - 42, mapY(snapshot.y));
    if (snapshot.kind === "safe" || snapshot.kind === "hard") {
      ctx.save(); ctx.translate(cx, cy - 7); ctx.rotate(snapshot.angle); ctx.scale(2.35, 2.35); this.drawRocketGlyph(ctx, false); ctx.restore();
      if (snapshot.kind === "safe") {
        ctx.strokeStyle = RETURN.cyan; ctx.lineWidth = 5; ctx.strokeRect(cx - 32, cy - 52, 64, 62);
        ctx.fillStyle = RETURN.cyan; ctx.font = "900 18px Arial Narrow,sans-serif"; ctx.fillText("LOCK", cx + 38, cy - 22);
      } else {
        const direction = Math.sign(snapshot.vx || 1); ctx.strokeStyle = RETURN.red; ctx.lineWidth = 4;
        for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.moveTo(cx - direction * (16 + i * 12), cy + 8 + i * 2); ctx.lineTo(cx - direction * (28 + i * 13), cy + 2 + i * 3); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(cx - 26, cy + 12); ctx.lineTo(cx - 12, cy - 1); ctx.moveTo(cx + 9, cy + 10); ctx.lineTo(cx + 29, cy - 7); ctx.stroke();
      }
    } else {
      const dx = Math.max(-46, Math.min(46, snapshot.vx * 1.4));
      const dy = Math.max(-20, Math.min(42, snapshot.vy * .8));
      ctx.strokeStyle = RETURN.red; ctx.fillStyle = RETURN.ink; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(cx - 28, cy + 10); ctx.lineTo(cx + 30, cy - 18); ctx.moveTo(cx - 20, cy - 24); ctx.lineTo(cx + 26, cy + 18); ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const p = i / 5; const x = cx + dx * p + (i % 2 ? 12 : -9); const y = cy + dy * p - i * 4;
        ctx.save(); ctx.translate(x, y); ctx.rotate(snapshot.angle + i * .42); ctx.fillRect(-7, -4, 14, 8); ctx.restore();
      }
      ctx.fillStyle = RETURN.red; ctx.font = "900 18px Arial Narrow,sans-serif"; ctx.fillText(snapshot.kind === "timeout" ? "NO CONTACT" : "STRUCTURE LOST", Math.max(24, cx - 82), Math.max(32, cy - 56));
    }

    ctx.strokeStyle = snapshot.kind === "safe" ? RETURN.cyan : RETURN.red; ctx.lineWidth = 7; ctx.strokeRect(8, 8, width - 16, height - 16);
    ctx.fillStyle = RETURN.ink; ctx.font = "800 14px ui-monospace,monospace";
    ctx.fillText(`${snapshot.mission}  X${snapshot.x.toFixed(0)} Y${snapshot.y.toFixed(0)}  F${Math.ceil(snapshot.fuel)}`, 22, height - 15);
    ctx.fillText(`VX${snapshot.vx.toFixed(1)} VY${snapshot.vy.toFixed(1)} A${(snapshot.angle * 180 / Math.PI).toFixed(1)}°`, width - 270, 28);
  }

  emitThrustDebris() {
    const now = performance.now();
    const interval = this.reducedMotion ? 95 : 38;
    if (now - this.lastParticleAt < interval) return;
    this.lastParticleAt = now;
    const angle = this.engine.angle;
    const directionX = -Math.sin(angle);
    const directionY = Math.cos(angle);
    const sideX = Math.cos(angle);
    const sideY = Math.sin(angle);
    const count = this.reducedMotion ? 1 : 2;
    for (let index = 0; index < count; index += 1) {
      const side = index ? 2.5 : -2.5;
      this.particles.push({
        born: now,
        life: 190 + index * 45,
        x: this.engine.x + directionX * 15 + sideX * side,
        y: this.engine.y + directionY * 15 + sideY * side,
        vx: directionX * (24 + index * 7) + sideX * side * 2,
        vy: directionY * (24 + index * 7) + sideY * side * 2,
      });
    }
    if (this.particles.length > 36) this.particles.splice(0, this.particles.length - 36);
  }

  drawThrustDebris(ctx) {
    const now = performance.now();
    this.particles = this.particles.filter((particle) => now - particle.born < particle.life);
    ctx.save();
    ctx.strokeStyle = COLORS.warning;
    ctx.lineWidth = 1.5;
    for (const particle of this.particles) {
      const age = (now - particle.born) / 1000;
      const x = particle.x + particle.vx * age;
      const y = particle.y + particle.vy * age;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - particle.vx * 0.055, y - particle.vy * 0.055);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGroundDust(ctx) {
    if (!this.engine.thrusting || this.engine.fuel <= 0) return;
    const ground = groundY(this.engine.x);
    const gap = ground - this.engine.y;
    if (gap <= 18 || gap >= 105) return;
    const strength = 1 - (gap - 18) / 87;
    const spread = 12 + strength * 25;
    ctx.save();
    ctx.strokeStyle = COLORS.warning;
    ctx.lineWidth = 1;
    const tick = Math.floor(this.engine.elapsed * 18);
    const count = this.reducedMotion ? 2 : 5;
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 ? 1 : -1;
      const x = this.engine.x + side * (8 + ((tick * 7 + index * 11) % Math.max(9, spread)));
      const y = groundY(x) - 2 - ((tick + index * 3) % 4);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * (4 + index), y - 2); ctx.stroke();
    }
    ctx.restore();
  }

  drawFeedback(ctx) {
    const now = performance.now();
    const prediction = this.engine.phase === "playing" ? this.engine.predict() : null;
    const predictionType = prediction?.outcome || "flight";
    if (this.engine.windActive !== this.lastWind && this.engine.elapsed > 0) {
      this.trigger(this.engine.windActive ? "wind-enter" : "wind-exit");
    }
    if (predictionType !== this.lastPrediction && this.engine.elapsed > 0.45) {
      if (["safe", "hard", "crash"].includes(predictionType)) {
        const end = prediction.points.at(-1);
        this.trigger(`window-${predictionType}`, end);
      }
    }
    this.lastWind = this.engine.windActive;
    this.lastPrediction = predictionType;

    this.feedback = this.feedback.filter((effect) => now - effect.start < effect.duration);
    ctx.save();
    ctx.strokeStyle = COLORS.warning;
    ctx.fillStyle = COLORS.warning;
    for (const effect of this.feedback) {
      const progress = Math.max(0, Math.min(1, (now - effect.start) / effect.duration));
      if (effect.type.startsWith("wind-")) {
        const direction = effect.type === "wind-enter" ? 1 : -1;
        for (let index = 0; index < 4; index += 1) {
          const y = effect.y - 18 + index * 11;
          const length = (1 - progress) * (18 + index * 3);
          ctx.beginPath(); ctx.moveTo(effect.x - direction * 12, y); ctx.lineTo(effect.x + direction * length, y + direction * 3); ctx.stroke();
        }
      } else if (effect.type.startsWith("window-")) {
        const radius = 7 + progress * 10;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(effect.x - radius, effect.y - radius, radius * 2, radius * 2);
        ctx.setLineDash([]);
      } else if (effect.type === "hard" || effect.type === "crash") {
        const rays = effect.type === "crash" ? 8 : 5;
        const reach = 10 + progress * (effect.type === "crash" ? 34 : 22);
        for (let index = 0; index < rays; index += 1) {
          const angle = (Math.PI * 2 * index) / rays + 0.2;
          ctx.beginPath();
          ctx.moveTo(effect.x + Math.cos(angle) * 9, effect.y + Math.sin(angle) * 9);
          ctx.lineTo(effect.x + Math.cos(angle) * reach, effect.y + Math.sin(angle) * reach);
          ctx.stroke();
        }
      } else if (effect.type === "safe") {
        const width = 24 + progress * 13;
        ctx.beginPath();
        ctx.moveTo(effect.x - width, effect.y + 15); ctx.lineTo(effect.x - 8, effect.y + 15);
        ctx.moveTo(effect.x + 8, effect.y + 15); ctx.lineTo(effect.x + width, effect.y + 15);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  debug() {
    return {
      particleCount: this.particles.length,
      particleBudget: 36,
      feedbackCount: this.feedback.length,
      reducedMotion: this.reducedMotion,
    };
  }
}
