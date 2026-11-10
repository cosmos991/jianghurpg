import { test, expect, expandGamePanels } from "./fixtures.js";
const read = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("jianghu-fate-v1")));
async function road(p) {
  if ((await read(p)).journey.pendingEvent)
    await p.locator("[data-road-choice]:enabled").last().click();
  await expandGamePanels(p);
}
async function setup(p, level = 0) {
  await p.goto("/");
  await p.locator("#choose").click();
  await p.locator("#character-name").fill("월영");
  await p.locator("#confirm-character").click();
  await p.locator("#draw-encounter").click();
  await p.locator("#enter-world").click();
  await expandGamePanels(p);
  await p.evaluate((level) => {
    const s = JSON.parse(localStorage.getItem("jianghu-fate-v1"));
    s.chosen.stats = [20, 20, 20, 20];
    Object.assign(s.journey, {
      turn: 2,
      energy: 100,
      inner: 0,
      pendingEvent: null,
      lastRoadEventTurn: 2,
    });
    s.journey.alignment.demonic = level;
    delete s.journey.darkness;
    localStorage.setItem("jianghu-fate-v1", JSON.stringify(s));
  }, level);
  await p.reload();
  await expandGamePanels(p);
}
test("tiered temptation accepts once, survives reload and can be purified", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page, 45);
  await expect(page.locator(".temptation-offer")).toContainText("심연의 전승");
  const offer = (await read(page)).journey.darkness.offer;
  await page.reload();
  await expandGamePanels(page);
  expect((await read(page)).journey.darkness.offer.token).toBe(offer.token);
  await page.locator("[data-dark-accept]").click();
  await road(page);
  const s = await read(page);
  expect(s.journey.inner).toBe(40);
  expect(s.journey.darkness.erosion).toBe(22);
  expect(s.journey.alignment.demonic).toBe(60);
  expect(s.journey.darkness.accepted).toBe(1);
  await page.reload();
  await expandGamePanels(page);
  expect((await read(page)).journey.inner).toBe(40);
  await expect(page.locator("[data-dark-accept]")).toHaveCount(0);
  await page.locator("[data-purify]").click();
  await road(page);
  expect((await read(page)).journey.darkness.erosion).toBe(10);
  expect((await read(page)).journey.inner).toBe(37);
  expect(errors).toEqual([]);
});
test("refusal keeps resources and affiliation unchanged", async ({ page }) => {
  await setup(page);
  const before = await read(page);
  await page.locator("[data-dark-decline]").click();
  const after = await read(page);
  expect(after.journey.inner).toBe(before.journey.inner);
  expect(after.journey.energy).toBe(before.journey.energy);
  expect(after.journey.turn).toBe(before.journey.turn);
  expect(after.journey.progress.sect).toBe(null);
  await page.reload();
  await expandGamePanels(page);
  await expect(page.locator("[data-dark-accept]")).toHaveCount(0);
});
for (const sect of ["bloodmoon", "blacklotus"])
  test(`${sect} early ritual entrance, choice and forbidden cultivation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await setup(page);
    await page.locator("[data-dark-accept]").click();
    await road(page);
    await page.locator(`[data-visit="${sect}"]`).click();
    await page.locator('[data-progress="ritual"]').click();
    await road(page);
    await page.locator('[data-exam-choice="0"]').click();
    await page.locator('[data-progress="accept"]').click();
    await road(page);
    let s = await read(page);
    expect(s.journey.progress.sect).toBe(sect);
    expect(s.journey.turn).toBeLessThan(14);
    const oldInner = s.journey.inner,
      oldErosion = s.journey.darkness.erosion;
    await page.locator('[data-action="breathe"]').click();
    await road(page);
    s = await read(page);
    expect(s.journey.inner).toBeGreaterThan(oldInner + 5);
    expect(s.journey.darkness.erosion).toBeGreaterThan(oldErosion);
    await page.reload();
    await expandGamePanels(page);
    expect((await read(page)).journey.progress.sect).toBe(sect);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
