import { test, expect } from "./fixtures.js";
const read = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("jianghu-fate-v1")));
async function resolveEvent(page) {
  if ((await read(page)).journey.pendingEvent)
    await page.locator("[data-road-choice]:enabled").last().click();
}
async function createPlayer(page) {
  await page.goto("/");
  await page.locator("#choose").click();
  await page.locator("#character-name").fill("청풍");
  await page.locator("#confirm-character").click();
  await page.locator("#draw-encounter").click();
  await page.locator("#enter-world").click();
  await page.locator("#enroll-academy").click();
  await resolveEvent(page);
  await page.locator('[data-art="liuhe"]').click();
  await resolveEvent(page);
  if ((await read(page)).journey.activeMind !== "basicBreath") {
    await page.locator('[data-art="basicBreath"]').click();
  }
  await resolveEvent(page);
}
async function winBattle(page) {
  for (let i = 0; i < 40; i++) {
    const b = (await read(page)).journey.progress.battle;
    if (b.status !== "active") {
      expect(b.status).toBe("won");
      return;
    }
    const action =
      b.intent === "heavy"
        ? "guard"
        : b.intent === "guard" && b.qi < b.maxQi
          ? "breathe"
          : b.skillKnown && b.qi >= 6
            ? "skill"
            : "attack";
    await page.locator(`[data-battle="${action}"]`).click();
  }
  throw Error("combat did not finish");
}

test("guided training, combat lock, reload, rewards and breakthrough", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createPlayer(page);
  const before = await read(page);
  await page.locator('[data-progress="breath"]').click();
  await expect(page.locator('[data-action="rest"]')).toBeDisabled();
  await page.locator('[data-progress="memorize"]').click();
  for (const answer of ["들이쉬기", "머무르기", "내쉬기"])
    await page.locator(`[data-drill="${answer}"]`).click();
  await resolveEvent(page);
  let state = await read(page);
  expect(state.journey.inner).toBe(
    before.journey.inner + 4 + Math.floor(before.chosen.stats[2] / 40),
  );
  expect(state.journey.turn).toBe(before.journey.turn + 1);
  await page.locator('[data-progress="practice"]').click();
  await expect(page.locator('[data-action="work"]')).toBeDisabled();
  await page.locator('[data-battle="attack"]').click();
  const battle = (await read(page)).journey.progress.battle;
  await page.reload();
  expect((await read(page)).journey.progress.battle).toEqual(battle);
  await winBattle(page);
  await resolveEvent(page);
  const won = await read(page);
  expect(won.journey.progress.wins).toBe(1);
  expect(won.journey.progress.battle.rewardClaimed).toBe(true);
  await page.reload();
  expect((await read(page)).journey.progress.wins).toBe(1);
  // A deterministic boundary fixture verifies the first breakthrough and permanent cap separation.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jianghu-fate-v1"));
    s.journey.inner = 15;
    s.journey.arts.liuhe.xp = 20;
    s.journey.mastery = 20;
    s.journey.energy = 100;
    localStorage.setItem("jianghu-fate-v1", JSON.stringify(s));
  });
  await page.reload();
  await page.locator('[data-progress="breakthrough"]').click();
  expect((await read(page)).journey.progress.realm).toBe(1);
  expect(errors).toEqual([]);
});

for (const sect of ["huashan", "wudang", "shaolin"]) {
  test(`${sect} entrance combat, choice, acceptance, exclusive arts and continued play`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await createPlayer(page);
    // Existing day-seven saves must enter the new chapter without regenerating a character.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("jianghu-fate-v1"));
      Object.assign(s.journey, {
        turn: 14,
        energy: 100,
        inner: 20,
        food: 10,
        money: 50,
        pendingEvent: null,
        lastRoadEventTurn: 14,
      });
      s.journey.arts.liuhe.xp = 30;
      s.journey.mastery = 30;
      delete s.journey.progress;
      localStorage.setItem("jianghu-fate-v1", JSON.stringify(s));
    });
    await page.reload();
    await page.locator(`[data-visit="${sect}"]`).click();
    await page.locator('[data-progress="exam"]').click();
    await winBattle(page);
    await resolveEvent(page);
    await page.locator('[data-exam-choice="1"]').click();
    await expect(page.locator(".entrance-event")).toContainText("입문 제안");
    await page.locator('[data-progress="accept"]').click();
    await resolveEvent(page);
    let s = await read(page);
    expect(s.journey.progress.sect).toBe(sect);
    expect(s.journey.arts[s.journey.activeMind].status).toBe("learned");
    expect(s.journey.arts[s.journey.trainingArt].status).toBe("learned");
    await page.locator('[data-progress="stance"]').click();
    const sequence = (await read(page)).journey.progress.drill.sequence;
    await page.locator('[data-progress="memorize"]').click();
    for (const answer of sequence)
      await page.locator(`[data-drill="${answer}"]`).click();
    await resolveEvent(page);
    expect((await read(page)).journey.progress.contribution).toBe(1);
    await page.reload();
    expect((await read(page)).journey.progress.sect).toBe(sect);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("retreat consumes one world action, grants no reward, and allows retry", async ({
  page,
}) => {
  await createPlayer(page);
  const before = await read(page);
  await page.locator('[data-progress="practice"]').click();
  await page.locator('[data-battle="retreat"]').click();
  await resolveEvent(page);
  const after = await read(page);
  expect(after.journey.turn).toBe(before.journey.turn + 1);
  expect(after.journey.progress.wins).toBe(0);
  expect(after.journey.progress.battle.status).toBe("retreat");
  await expect(page.locator('[data-progress="practice"]')).toBeEnabled();
});
