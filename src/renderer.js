import { FIELD_H, FIELD_W, PADS, groundY, inWind } from "./engine.js";

const COLORS = {
  paper: "#f4f2ec",
  ink: "#171717",
  muted: "#a9a79f",
  warning: "#d4572a",
  white: "#ffffff",
};

export class ThrustlineRenderer {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.engine = engine;
    this.dpr = Math.min(devicePixelRatio || 1, matchMedia("(max-width:340px),(max-height:620px)").matches ? 1.15 : 1.5);
    this.canvas.width = Math.round(FIELD_W * this.dpr);
    this.canvas.height = Math.round(FIELD_H * this.dpr);
    this.ctx = canvas.getContext("2d", { alpha: false });
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
    ctx.fillText("WIND +24 →", 168, 159);
    for (let y = 188; y < 490; y += 42) {
      ctx.beginPath(); ctx.moveTo(174, y); ctx.lineTo(218, y); ctx.stroke();
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
    ctx.fillText(prediction.outcome.toUpperCase(), Math.min(FIELD_W - 48, end.x + 6), Math.max(88, end.y - 5));
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
      const labelWidth = ctx.measureText(pad.label).width;
      ctx.fillText(pad.label, (pad.x1 + pad.x2 - labelWidth) / 2, pad.y - 10);
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
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(-8, 7);
    ctx.lineTo(8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 5); ctx.lineTo(-11, 14); ctx.lineTo(-15, 14);
    ctx.moveTo(6, 5); ctx.lineTo(11, 14); ctx.lineTo(15, 14);
    ctx.stroke();
    if (engine.thrusting && engine.fuel > 0) {
      ctx.fillStyle = COLORS.warning;
      ctx.beginPath();
      ctx.moveTo(-5, 8); ctx.lineTo(0, 24); ctx.lineTo(5, 8); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (inWind(engine.x, engine.y)) {
      ctx.fillStyle = COLORS.warning;
      ctx.font = "700 8px ui-monospace, monospace";
      ctx.fillText("WIND", engine.x + 16, engine.y - 12);
    }
  }
}
