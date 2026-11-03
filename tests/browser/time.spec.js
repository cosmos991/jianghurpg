import { test, expect } from "@playwright/test";
const read = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("jianghu-fate-v1")));
async function road(page) {
  if ((await read(page)).journey.pendingEvent)
    await page.locator("[data-road-choice]:enabled").last().click();
}
async function setup(page) {
  await page.goto("/");
  await page.locator("#choose").click();
  await page.locator("#character-name").fill("청명");
  await page.locator("#confirm-character").click();
  await page.locator("#draw-encounter").click();
  await page.locator("#enter-world").click();
  await page.locator("#enroll-academy").click();
  await road(page);
  if (!(await read(page)).journey.arts.basicBreath)
    await page.locator('[data-art="basicBreath"]').click();
  else if ((await read(page)).journey.activeMind !== "basicBreath")
    await page.locator('[data-art="basicBreath"]').click();
  await road(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jianghu-fate-v1"));
    Object.assign(s.journey, {
      turn: 0,
      energy: 100,
      money: 5000,
      food: 1000,
      inner: 0,
      pendingEvent: null,
      lastRoadEventTurn: 0,
    });
    delete s.journey.longTraining;
    s.journey.calendar = { version: 1, scheduledEvents: [] };
    localStorage.setItem("jianghu-fate-v1", JSON.stringify(s));
  });
  await page.reload();
}
for (const width of [1280, 390])
  test(`scheduled interruption, reload and month completion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await setup(page);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("jianghu-fate-v1"));
      s.journey.calendar.scheduledEvents.push({
        id: "story_checkpoint",
        turn: 6,
        type: "road",
      });
      localStorage.setItem("jianghu-fate-v1", JSON.stringify(s));
    });
    await page.reload();
    await page.locator("#long-focus").selectOption("mind");
    await page.locator('[data-long="start"]').click();
    let s = await read(page);
    expect(s.journey.turn).toBe(6);
    expect(s.journey.longTraining.completedTurns).toBe(6);
    expect(s.journey.longTraining.spent).toEqual({ money: 3, food: 3 });
    expect(s.journey.pendingEvent).toBeTruthy();
    await expect(page.locator('[data-long="resume"]')).toBeDisabled();
    const snapshot = s.journey.longTraining;
    await page.reload();
    expect((await read(page)).journey.longTraining).toEqual(snapshot);
    await road(page);
    for (
      let i = 0;
      i < 12 && (await read(page)).journey.longTraining.status === "paused";
      i++
    ) {
      await page.locator('[data-long="resume"]').click();
      await road(page);
    }
    s = await read(page);
    expect(s.journey.longTraining.status).toBe("completed");
    expect(s.journey.turn).toBe(60);
    expect(s.journey.longTraining.spent).toEqual({ money: 30, food: 30 });
    expect(s.journey.longTraining.credited.inner).toBe(
      s.journey.longTraining.rates.inner,
    );
    await expect(page.locator("#world-time")).toContainText("1년 2월 1일");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
test("a full year reaches year two without bypassing encounters or duplicating mastery", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#long-mode").selectOption("year");
  await page.locator("#long-focus").selectOption("mind");
  await page.locator('[data-long="start"]').click();
  let interruptions = 0;
  for (
    let i = 0;
    i < 15 && (await read(page)).journey.longTraining.status === "paused";
    i++
  ) {
    await road(page);
    interruptions++;
    await page.locator('[data-long="resume"]').click();
  }
  await road(page);
  const s = await read(page);
  expect(s.journey.longTraining.status).toBe("completed");
  expect(s.journey.turn).toBe(720);
  expect(interruptions).toBeGreaterThan(0);
  expect(s.journey.longTraining.spent).toEqual({ money: 360, food: 360 });
  expect(s.journey.longTraining.credited.inner).toBe(
    s.journey.longTraining.rates.inner * 12,
  );
  expect(s.journey.arts.basicBreath.xp).toBe(100);
  await expect(page.locator("#world-time")).toContainText("2년 1월 1일");
});
test("resource pause allows work, resumes at the same target and cancellation refunds nothing", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jianghu-fate-v1"));
    s.journey.money = 0;
    s.journey.food = 0;
    localStorage.setItem("jianghu-fate-v1", JSON.stringify(s));
  });
  await page.reload();
  await page.locator("#long-focus").selectOption("mind");
  await page.locator('[data-long="start"]').click();
  let s = await read(page);
  expect(s.journey.longTraining.reason).toBe("resources");
  const id = s.journey.longTraining.id,
    progress = s.journey.longTraining.completedTurns;
  await page.locator('[data-action="work"]').click();
  await road(page);
  expect((await read(page)).journey.longTraining.completedTurns).toBe(progress);
  await page.locator('[data-long="resume"]').click();
  await road(page);
  s = await read(page);
  expect(s.journey.longTraining.id).toBe(id);
  expect(s.journey.longTraining.completedTurns).toBeGreaterThan(progress);
  const before = {
    turn: s.journey.turn,
    inner: s.journey.inner,
    money: s.journey.money,
  };
  await page.locator('[data-long="cancel"]').click();
  s = await read(page);
  expect(s.journey.longTraining.status).toBe("cancelled");
  expect(s.journey.turn).toBe(before.turn);
  expect(s.journey.inner).toBe(before.inner);
  expect(s.journey.money).toBe(before.money);
  expect(s.journey.calendar.scheduledEvents.some((e) => e.source === id)).toBe(
    false,
  );
});
