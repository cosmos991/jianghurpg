import { test, expect } from "@playwright/test";

const readState = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("jianghu-fate-v1")));

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`creation, training, choices, reload and week completion at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator("#count")).toHaveText("9");
    await page.locator("#keep").click();
    await page.locator("#roll").click();
    await expect(page.locator("#roll")).toBeEnabled();
    await expect(page.locator("#count")).toHaveText("8");
    await page.locator("#swap").click();
    await page.locator("#choose").click();
    await page.locator("#character-name").fill("청운검객");
    await page.locator('[data-gender="female"]').click();
    await page.locator("#confirm-character").click();
    await page.locator("#draw-encounter").click();
    await expect(page.locator("#enter-world")).toBeVisible();
    await page.locator("#enter-world").click();
    await expect(page.locator("#world-player-name")).toHaveText("청운검객");

    async function resolveEvent() {
      if ((await readState(page)).journey.pendingEvent) {
        await page.locator("[data-road-choice]:enabled").last().click();
      }
    }
    await page.locator("#enroll-academy").click();
    await resolveEvent();
    await page.locator('[data-art="liuhe"]').click();
    await resolveEvent();
    await page.locator('[data-action="train"]').click();
    await resolveEvent();
    expect((await readState(page)).journey.arts.liuhe.xp).toBeGreaterThan(0);
    const before = await readState(page);
    await page.reload();
    await expect(page.locator("#world-screen")).toBeVisible();
    expect((await readState(page)).journey.turn).toBe(before.journey.turn);
    expect((await readState(page)).encounter).toEqual(before.encounter);
    while ((await readState(page)).journey.turn < 14) {
      await page.locator('[data-action="rest"]').click();
      await resolveEvent();
    }
    await expect(page.locator("#world-time")).toContainText("제8일");
    await expect(page.locator('[data-action="rest"]')).toBeEnabled();
    await expect(page.locator('[data-visit="huashan"]')).toBeVisible();
    const portraitLoaded = await page
      .locator("#world-portrait")
      .evaluate(async (el) => {
        const url =
          getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/)?.[1];
        const image = new Image();
        image.src = url;
        await image.decode();
        return image.naturalWidth > 0;
      });
    expect(portraitLoaded).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("ten-draw budget survives reload and cannot be exceeded", async ({
  page,
}) => {
  await page.goto("/");
  for (let i = 0; i < 9; i++) {
    await page.locator("#roll").click();
    await expect(page.locator("#skip")).toBeHidden();
  }
  await expect(page.locator("#count")).toHaveText("0");
  await expect(page.locator("#roll")).toBeDisabled();
  await page.reload();
  await expect(page.locator("#roll")).toBeDisabled();
  expect((await readState(page)).drawsUsed).toBe(10);
});
