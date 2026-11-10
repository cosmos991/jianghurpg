import { test, expect } from "./fixtures.js";
test("desktop hub preserves actions while hiding long panels until requested", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#choose").click();
  await page.locator("#character-name").fill("청명");
  await page.locator("#confirm-character").click();
  await page.locator("#draw-encounter").click();
  await page.locator("#enter-world").click();
  await expect(page.locator("#world-actions button")).toHaveCount(6);
  for (const group of await page.locator("[data-world-group]").all())
    expect(await group.evaluate((el) => el.open)).toBe(false);
  await expect(page.locator("#long-training-panel")).not.toBeVisible();
  await expect(page.locator("#world-profile-details")).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator("#mobile-goal-title")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThan(1600);
  await page.screenshot({ path: "/tmp/desktop-hub.png", fullPage: true });
  await page.locator('.mobile-world-nav a[href="#group-growth"]').click();
  await expect(page.locator("#martial-panel")).toBeVisible();
  await page.locator('.mobile-world-nav a[href="#group-progression"]').click();
  await expect(page.locator("#progression-panel")).toBeVisible();
  await expect(page.locator("#martial-panel")).not.toBeVisible();
  await page.locator('.mobile-world-nav a[href="#world-actions"]').click();
  for (const group of await page.locator("[data-world-group]").all())
    expect(await group.evaluate((el) => el.open)).toBe(false);
  await page.locator("#mobile-goal-open").click();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
