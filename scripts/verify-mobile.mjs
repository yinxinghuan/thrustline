import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const outputRoot = new URL("../_qa/ui/", import.meta.url).pathname;
const browser = await chromium.launch({ headless: true });

async function touchCycle(page, session, id = 1, endType = "touchEnd") {
  const box = await page.locator("canvas").boundingBox();
  assert.ok(box, "canvas must be visible");
  const point = { x: box.x + box.width * 0.52, y: box.y + box.height * 0.42 };
  const before = Number(await page.locator("[data-fuel]").textContent());
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...point, radiusX: 8, radiusY: 8, force: 1, id }],
  });
  await page.waitForTimeout(55);
  assert.equal(await page.locator("[data-state]").textContent(), "THRUST");
  const during = Number(await page.locator("[data-fuel]").textContent());
  assert.ok(during <= before, `fuel should not rise: ${before} -> ${during}`);
  await session.send("Input.dispatchTouchEvent", { type: endType, touchPoints: [] });
  await page.waitForTimeout(35);
  assert.equal(await page.locator("[data-state]").textContent(), "COAST");
  const after = Number(await page.locator("[data-fuel]").textContent());
  await page.waitForTimeout(35);
  assert.equal(Number(await page.locator("[data-fuel]").textContent()), after);
}

async function verifyViewport(width, height, cycles) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const session = await context.newCDPSession(page);
  await page.goto("http://127.0.0.1:5185/", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#alteru-guest-banner{display:none!important}" });

  const layout = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    longPressGuard: getComputedStyle(document.documentElement).webkitUserSelect,
  }));
  assert.deepEqual(layout, {
    width,
    height,
    scrollWidth: width,
    scrollHeight: height,
    longPressGuard: "none",
  });
  await page.screenshot({ path: `${outputRoot}ready-platform-layout-${width}x${height}.png` });

  if (width === 390) {
    const rank = page.getByRole("button", { name: "RANK", exact: true });
    assert.equal(await rank.count(), 1);
    await rank.click();
    const rankText = await page.locator(".tl-rank__list").innerText();
    assert.match(rankText, /实时排行榜仅在 AlterU 内显示/);
    await page.screenshot({ path: `${outputRoot}rank-external-fallback-platform-layout-${width}x${height}.png` });
    await page.getByRole("button", { name: "关闭 / CLOSE", exact: true }).click();
  }

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await touchCycle(page, session, cycle + 1, cycle === cycles - 1 ? "touchCancel" : "touchEnd");
  }
  const beforePause = await page.evaluate(() => window.__THRUSTLINE__.engine.elapsed);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(180);
  assert.equal(await page.locator("[data-state]").textContent(), "PAUSED");
  const afterPause = await page.evaluate(() => window.__THRUSTLINE__.engine.elapsed);
  assert.ok(Math.abs(beforePause - afterPause) < 0.01, "blur must freeze game time");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(35);
  assert.equal(await page.locator("[data-state]").textContent(), "COAST");
  await page.screenshot({ path: `${outputRoot}coast-platform-layout-${width}x${height}.png` });

  if (width === 390) {
    await page.waitForSelector(".tl-result:not([hidden])", { timeout: 10000 });
    const result = await page.locator("[data-result-title]").textContent();
    const reason = await page.locator("[data-result-reason]").textContent();
    assert.ok(["CRASH", "HARD LANDING", "SAFE LANDING"].includes(result));
    assert.ok(reason?.length, "result must expose a concrete reason");
    const retry = page.getByRole("button", { name: "立即重开 / RETRY" });
    assert.equal(await retry.isEnabled(), true);
    await page.screenshot({ path: `${outputRoot}result-platform-layout-${width}x${height}.png` });
    await retry.click();
    assert.equal(await page.locator("[data-state]").textContent(), "READY");
    assert.equal(await page.locator("[data-fuel]").textContent(), "100");
  }

  assert.deepEqual(errors, []);
  await context.close();
  return { width, height, cycles, layout };
}

async function verifyExternalGuest() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5185/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('script[src="https://images.aiwaves.tech/alteru/guest-shell.js"]').count(), 1);
  await page.screenshot({ path: `${outputRoot}external-guest-390x844.png` });
  const bannerVisible = await page.locator("#alteru-guest-banner").isVisible().catch(() => false);
  assert.equal(bannerVisible, true, "external guest banner should be visible");
  await context.close();
  return { bannerVisible, honestLeaderboardFallback: true };
}

async function verifyPlatformBridge() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.addInitScript(() => {
    window.__qaOpenedProfiles = [];
    window.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      if (event.data.startsWith("AW.PROFILE.OPEN-")) {
        const profile = JSON.parse(atob(event.data.slice("AW.PROFILE.OPEN-".length)));
        window.__qaOpenedProfiles.push(profile.id);
        return;
      }
      if (!event.data.startsWith("callAPI-")) return;
      const payload = JSON.parse(decodeURIComponent(escape(atob(event.data.slice("callAPI-".length)))));
      let data = { retcode: 0, data: {} };
      if (payload.url.includes("get/info/by/telegram_id")) {
        data = { retcode: 0, data: { name: "Pilot", head_url: "" } };
      } else if (payload.url.includes("rank/score/list")) {
        data = {
          retcode: 0,
          data: [
            { user_id: "42", rank: "1", score: "1900", user_name: "Pilot", head_url: "" },
            { user_id: "99", rank: "2", score: "1480", user_name: "Wingmate", head_url: "" },
          ],
        };
      }
      const result = { request_id: payload.request_id, success: true, data };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(result))));
      window.postMessage(`callAPIResult-${encoded}`, location.origin);
    });
  });
  const page = await context.newPage();
  const origin = encodeURIComponent("http://127.0.0.1:5185");
  await page.goto(`http://127.0.0.1:5185/?telegram_id=42&api_origin=${origin}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "RANK", exact: true }).click();
  await page.waitForSelector(".tl-rank__row");
  assert.equal(await page.locator(".tl-rank__row").count(), 2);
  assert.match(await page.locator(".tl-rank__row.is-self").innerText(), /你 \/ YOU/);
  const other = page.locator("button.tl-rank__row");
  assert.match(await other.innerText(), /Wingmate/);
  assert.equal(await other.locator(".tl-rank__avatar").innerText(), "W");
  await other.click();
  await page.waitForFunction(() => window.__qaOpenedProfiles.length === 1);
  assert.deepEqual(await page.evaluate(() => window.__qaOpenedProfiles), ["99"]);
  await page.screenshot({ path: `${outputRoot}rank-platform-layout-390x844.png` });
  await context.close();
  return { profile: "Pilot", leaderboardRows: 2, openedProfile: "99" };
}

try {
  const results = [
    await verifyViewport(390, 844, 10),
    await verifyViewport(320, 568, 3),
    await verifyPlatformBridge(),
    await verifyExternalGuest(),
  ];
  console.log("thrustline mobile verification passed", results);
} finally {
  await browser.close();
}
