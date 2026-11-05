import { test, expect } from "./fixtures.js";
import { roadEvents } from "../../src/game/data.js";
test("live game popup survives dismissal and reload then resolves exactly once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#choose").click();
  await page.locator("#character-name").fill("청명");
  await page.locator("#confirm-character").click();
  await page.locator("#draw-encounter").click();
  await page.locator("#enter-world").click();
  await page.evaluate((id) => {
    const s = JSON.parse(localStorage.getItem("jianghu-fate-v1"));
    s.journey.pendingEvent = {
      id,
      token: "popup-regression",
      turn: s.journey.turn,
    };
    localStorage.setItem("jianghu-fate-v1", JSON.stringify(s));
  }, roadEvents[0].id);
  await page.reload();
  const dialog = page.locator("#road-event-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#road-event-title")).toBeFocused();
  await page.screenshot({ path: "/tmp/road-popup-mobile.png" });
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jianghu-fate-v1")),
  );
  await page.locator("#road-event-dismiss").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#road-event-notice")).toBeVisible();
  await expect(page.locator('[data-action="rest"]')).toBeDisabled();
  await page.locator("#road-event-reopen").click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(dialog).toBeVisible();
  await page.locator("[data-road-choice]:enabled").last().click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#road-event-notice")).not.toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jianghu-fate-v1")),
  );
  expect(after.journey.pendingEvent).toBeNull();
  expect(after.journey.turn).toBe(before.journey.turn);
  expect(after.journey.alignmentHistory.length).toBe(
    before.journey.alignmentHistory.length + 1,
  );
  await expect(page.locator('[data-action="rest"]')).toBeEnabled();
  await expect(page.locator('[data-action="rest"]')).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
