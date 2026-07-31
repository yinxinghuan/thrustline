import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const requirements = readFileSync(new URL("../doc/requirements.md", import.meta.url), "utf8");

assert.ok(main.includes('addEventListener("pointerdown"'));
assert.ok(main.includes('addEventListener("pointerup"'));
assert.ok(main.includes('addEventListener("pointercancel"'));
assert.ok(main.includes('addEventListener("lostpointercapture"'));
assert.ok(!main.includes("keydown"), "keyboard gameplay path must not exist");
assert.ok(!main.includes("ArrowLeft") && !main.includes("ArrowRight"));
assert.ok(!main.includes("joystick") && !main.includes("direction-button"));
assert.ok(html.includes("alteru-long-press-guard"));
assert.ok(html.includes("guest-shell.js"), "published game must load guest shell");
assert.ok(html.includes('name="game-uuid" content="67bc0e3f-ac83-410f-a802-f4a01d177528"'));
assert.ok(existsSync(new URL("../meta.json", import.meta.url)), "published game needs metadata");
assert.ok(existsSync(new URL("../public/poster.png", import.meta.url)), "published game needs a poster");
assert.ok(main.includes("ThrustlineLeaderboard") && main.includes("resolvePlayerIdentity"));
assert.ok(requirements.includes("按住点火") && requirements.includes("松开滑行"));

console.log("thrustline static verification passed");
