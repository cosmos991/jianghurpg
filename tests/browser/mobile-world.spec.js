import { test, expect } from "./fixtures.js";
async function enter(page) {
  await page.goto("/");
  await page.locator("#choose").click();
  await page.locator("#character-name").fill("청명");
  await page.locator("#confirm-character").click();
  await page.locator("#draw-encounter").click();
  await page.locator("#enter-world").click();
}
for (const width of [390, 320])
  test(
    "mobile action hub keeps six actions and reveals grouped information at " +
      width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await enter(page);
      await expect(page.locator("#world-actions button")).toHaveCount(6);
      const portrait = await page.locator("#world-portrait").boundingBox();
      expect(Math.abs(portrait.width - portrait.height)).toBeLessThan(1);

      for (const button of await page.locator("#world-actions button").all())
        await expect(button).toBeVisible();
      await expect(page.locator("#mobile-goal-title")).not.toBeEmpty();
      await expect(page.locator("#world-core-status")).toContainText("입문");
      for (const group of await page.locator("[data-world-group]").all())
        expect(await group.evaluate((el) => el.open)).toBe(false);
      await expect(page.locator("#long-training-panel")).not.toBeVisible();
      await expect(page.locator("#progression-panel")).not.toBeVisible();
      await expect(page.locator("#martial-panel")).not.toBeVisible();
      await page.screenshot({
        path: "/tmp/mobile-hub-" + width + ".png",
        fullPage: true,
      });
      await page.locator("#mobile-goal-open").click();
      await page.locator('.mobile-world-nav a[href="#group-growth"]').click();
      await expect(page.locator("#martial-panel")).toBeVisible();
      await page.locator("#group-martial > summary").click();
      await page
        .locator('.mobile-world-nav a[href="#group-progression"]')
        .click();
      await expect(page.locator("#progression-panel")).toBeVisible();
      await page.locator('.mobile-world-nav a[href="#group-records"]').click();
      await expect(page.locator("#world-log")).toBeVisible();
      await page.locator("#review-encounter-mobile").click();
      await expect(page.locator("#encounter-screen")).toBeVisible();
      await page.locator("#enter-world").click();

      await page.locator('.mobile-world-nav a[href="#world-actions"]').click();
      for (const group of await page.locator("[data-world-group]").all())
        expect(await group.evaluate((el) => el.open)).toBe(false);
      await page.locator('[data-action="rest"]').click();
      if (await page.locator("#road-event-dialog").isVisible())
        await page.locator("[data-road-choice]:enabled").last().click();
      await expect(page.locator("#mobile-latest")).not.toBeEmpty();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 900 });
      for (const group of await page.locator("[data-world-group]").all())
        expect(await group.evaluate((el) => el.open)).toBe(false);
      await expect(
        page.locator("#world-profile-details > summary"),
      ).toBeVisible();
      expect(errors).toEqual([]);
    },
  );

test("pending sect admission opens its group on mobile reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jianghu-fate-v1"));
    s.journey.turn = 14;
    s.journey.pendingEvent = null;
    s.journey.progress.exam = { sect: "huashan", stage: "offer", choice: 0 };
    localStorage.setItem("jianghu-fate-v1", JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator("#progression-panel")).toBeVisible();
  await expect(page.locator('[data-progress="accept"]')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#progression-panel")).toBeVisible();
});
