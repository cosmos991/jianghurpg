import { test, expect } from "./fixtures.js";
const clone = (x) => structuredClone(x);
function catalog() {
  return {
    era: {
      id: "demonic_rise_v1",
      name: "마교의 준동",
      description: "마교의 확산을 막고 지역을 지키는 시대입니다.",
      duration_years: 20,
      version: 1,
      status: "draft",
      updated_at: "2026-11-03T01:00:00.000000+00:00",
    },
    objectives: Array.from({ length: 10 }, (_, i) => ({
      era_id: "demonic_rise_v1",
      id: "task_" + i,
      name: i === 9 ? "핵심 의식 중단" : `조사 과제 ${i + 1}`,
      description: "",
      category: "investigation",
      condition_code: i === 9 ? "RITUAL_STOPPED" : "CLUE_FOUND",
      target_key: "slot_" + i,
      points: 10,
      sort_order: i + 1,
    })),
    outcomes: [
      {
        id: "low",
        name: "일부 지역 방어",
        min_score: 0,
        max_score: 49,
        required_objective_ids: [],
        world_result: "일부 지역을 지켰습니다.",
        fame_reward: 10,
        contribution_reward: 20,
        legacy_reward_code: "NONE",
      },
      {
        id: "high",
        name: "지도부 계획 와해",
        min_score: 50,
        max_score: 100,
        required_objective_ids: ["task_9"],
        world_result: "지도부의 계획을 저지했습니다.",
        fame_reward: 60,
        contribution_reward: 120,
        legacy_reward_code: "SPECIAL_LEGACY_CHOICE",
      },
    ],
  };
}
async function backend(page, { allowed = true } = {}) {
  let data = catalog(),
    saveError = null,
    calls = 0,
    revision = 0;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "owner@example.org",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
  };
  const token =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".test_signature";
  await page.route(/^https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const u = new URL(route.request().url()),
      path = u.pathname;
    const send = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/auth/v1/token")
      return send({
        access_token: token,
        token_type: "bearer",
        refresh_token: "test_refresh",
        expires_in: 3600,
        user,
      });
    if (path === "/auth/v1/user") return send(user);
    if (path === "/auth/v1/logout") return send({});
    if (path === "/rest/v1/rpc/era_admin_access") return send(allowed);
    if (path === "/rest/v1/rpc/era_editor_catalog")
      return allowed
        ? send(data)
        : send({ message: "관리자 권한이 필요합니다." }, 403);
    if (path === "/rest/v1/rpc/save_era_editor_catalog") {
      calls++;
      if (saveError) return send({ message: saveError }, 409);
      const request = route.request().postDataJSON();
      data = clone(request.document);
      data.era.status = request.publish ? "published" : "draft";
      data.era.updated_at = `2026-11-03T01:00:${String(++revision).padStart(2, "0")}.000000+00:00`;
      return send(data);
    }
    return send({ message: "Unexpected test request " + path }, 400);
  });
  return {
    get data() {
      return clone(data);
    },
    get calls() {
      return calls;
    },
    fail: (message) => (saveError = message),
  };
}
async function login(page) {
  await page.goto("/admin/");
  await page.locator("#auth-email").fill("owner@example.org");
  await page.locator("#auth-password").fill("test_password_only");
  await page.locator("#auth-submit").click();
}
for (const width of [1280, 390])
  test(`admin editing, draft save, validation and publish at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await backend(page),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page);
    await expect(page.locator("#catalog-form")).toBeVisible();
    await page
      .locator('[name="era.description"]')
      .fill("직접 수정한 시대 설명");
    const points = page
      .locator('[data-kind="objective"][data-field="points"]')
      .first();
    await points.fill("11");
    await expect(page.locator("#total-score")).toHaveText("101");
    await page.locator("#publish").click();
    await expect(page.locator("#validation-panel")).toContainText("100점");
    expect(api.calls).toBe(0);
    await page.locator("#save-draft").click();
    await expect(page.locator("#save-status")).toContainText(
      "초안을 저장했습니다",
    );
    expect(api.data.era.description).toBe("직접 수정한 시대 설명");
    await page.reload();
    await expect(page.locator('[name="era.description"]')).toHaveValue(
      "직접 수정한 시대 설명",
    );
    await page
      .locator('[data-kind="objective"][data-field="points"]')
      .first()
      .fill("10");
    await page.locator("#publish").click();
    await page.locator("#confirm-ok").click();
    await expect(page.locator("#save-status")).toContainText("적용했습니다");
    expect(api.data.era.status).toBe("published");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/admin-${width}.png`,
      fullPage: true,
    });
  });
test("unauthenticated and non-admin users cannot see the editor", async ({
  page,
}) => {
  await backend(page, { allowed: false });
  await page.goto("/admin/");
  await expect(page.locator("#editor")).toBeHidden();
  await page.locator("#auth-email").fill("owner@example.org");
  await page.locator("#auth-password").fill("test_password_only");
  await page.locator("#auth-submit").click();
  await expect(page.locator("#auth-status")).toContainText("관리자 계정");
  await expect(page.locator("#editor")).toBeHidden();
});
test("failed saves retain inputs and deleting a required task removes its reference", async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  await expect(page.locator("#catalog-form")).toBeVisible();
  await page.locator('[name="era.name"]').fill("변경한 시대");
  api.fail(
    "다른 곳에서 수정된 데이터가 있습니다. 다시 불러온 뒤 저장해주세요.",
  );
  await page.locator("#save-draft").click();
  await expect(page.locator("#save-status")).toContainText("다른 곳");
  await expect(page.locator('[name="era.name"]')).toHaveValue("변경한 시대");
  api.fail(null);
  await page.locator(".remove-objective").last().click();
  await page.locator("#confirm-ok").click();
  await expect(page.locator(".objective-row")).toHaveCount(9);
  await page.locator("#save-draft").click();
  await expect(page.locator("#save-status")).toContainText(
    "초안을 저장했습니다",
  );
  expect(api.data.outcomes[1].required_objective_ids).toEqual([]);
});

for (const width of [1280, 390])
  test(
    "era draw lab replay, type restriction and batch without database writes at " +
      width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const api = await backend(page),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await login(page);
      await expect(page.locator("#catalog-form")).toBeVisible();
      await page.locator("#draw-era-seed").fill("강호-001");
      await page.locator("#draw-era-once").click();
      await expect(page.locator("#draw-era-result")).toBeVisible();
      const first = await page.locator("#draw-era-result").innerText();
      await page.locator("#draw-era-once").click();
      // History is deliberately cumulative; compare the actual selected template.
      const name = await page.locator("#draw-era-name").innerText();
      expect(first).toContain(name);
      await expect(page.locator("#draw-era-odds")).toContainText("16.7%");
      await page.locator("#draw-era-type").selectOption("manual");
      await page.locator("#draw-era-once").click();
      await expect(page.locator("#draw-era-meta")).toContainText("비급의 행방");
      await expect(page.locator("#draw-era-odds")).toContainText("최종 50.0%");
      await page.locator("#draw-era-batch").click();
      await expect(page.locator("#draw-era-batch-summary")).toContainText(
        "총 1000회",
      );
      expect(
        await page
          .locator("#draw-era-distribution meter")
          .evaluateAll((els) => els.reduce((s, e) => s + e.value, 0)),
      ).toBe(1000);
      await expect(page.locator("#draw-era-distribution meter")).toHaveCount(2);
      await page.locator("#draw-era-new").click();
      expect(await page.locator("#draw-era-seed").inputValue()).not.toBe(
        "강호-001",
      );
      await expect(page.locator("#draw-era-meta")).toContainText("비급의 행방");
      await page.locator("#draw-era-seed").fill("");
      await page.locator("#draw-era-once").click();
      await expect(page.locator("#draw-era-status")).toContainText("1~128자");
      await expect(page.locator("#dirty-status")).toHaveText(
        "저장된 상태입니다",
      );
      expect(api.calls).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .locator("#era-draw-section")
        .screenshot({ path: "/tmp/era-draw-" + width + ".png" });
      expect(errors).toEqual([]);
    },
  );

for (const width of [1280, 390])
  test(
    "short event sandbox gates choices, interrupts days and updates era tasks at " +
      width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const api = await backend(page),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await login(page);
      await expect(page.locator("#catalog-form")).toBeVisible();
      await page.locator("#event-test-start").click();
      await expect(page.locator("#event-test-seed")).toBeDisabled();
      for (
        let i = 0;
        i < 10 && !(await page.locator("#event-test-encounter").isVisible());
        i++
      )
        await page.locator('[data-event-days="7"]').click();
      await expect(page.locator("#event-test-encounter")).toBeVisible();
      await expect(page.locator('[data-event-days="1"]')).toBeDisabled();
      expect(
        await page.locator("#event-test-choices button:disabled").count(),
      ).toBeGreaterThan(0);
      await expect(page.locator('[data-event-choice="leave"]')).toBeEnabled();
      const title = await page.locator("#event-test-title").innerText(),
        day = await page.locator("#event-test-day").innerText();
      await page
        .locator("#era-event-section")
        .screenshot({ path: "/tmp/era-event-" + width + ".png" });
      await page.locator('[data-event-choice="leave"]').click();
      await expect(page.locator("#event-test-encounter")).not.toBeVisible();
      await expect(page.locator('[data-event-days="1"]')).toBeEnabled();
      await expect(page.locator("#event-test-score")).toHaveText("0 / 100점");
      await page.locator("#event-test-reset").click();
      await page.locator('[data-event-preset="strong"]').click();
      await page.locator("#event-test-start").click();
      for (
        let i = 0;
        i < 10 && !(await page.locator("#event-test-encounter").isVisible());
        i++
      )
        await page.locator('[data-event-days="7"]').click();
      await expect(page.locator("#event-test-title")).toHaveText(title);
      await expect(page.locator("#event-test-day")).toHaveText(day);
      await page.locator("#event-test-choices button:enabled").first().click();
      await expect(page.locator("#event-test-result")).toBeVisible();
      const score = Number(
        (await page.locator("#event-test-score").innerText()).split(" /")[0],
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(25);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(api.calls).toBe(0);
      await expect(page.locator("#dirty-status")).toHaveText(
        "저장된 상태입니다",
      );
      expect(errors).toEqual([]);
    },
  );

for (const width of [1280, 390])
  test(
    "phase comparison changes encounters and gates without granting growth at " +
      width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const api = await backend(page),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await login(page);
      await expect(page.locator("#catalog-form")).toBeVisible();
      await page.locator('[data-event-preset="strong"]').click();
      await page.locator("#event-test-start").click();
      const stats = await page
        .locator("#event-test-stats span")
        .allTextContents();
      const money = await page.locator("#event-test-resources").innerText();
      await page.locator('[data-event-stage="early"]').click();
      const early = await page.locator("#event-test-title").innerText();
      const easyLocked = await page
        .locator("#event-test-choices button:disabled")
        .count();
      await page.locator("#event-test-dismiss").click();
      await page.locator('[data-event-stage="middle"]').click();
      await expect(page.locator("#event-test-phase")).toContainText("35~60");
      expect(await page.locator("#event-test-title").innerText()).not.toBe(
        early,
      );
      await page.keyboard.press("Escape");
      await expect(page.locator("#event-test-dialog")).not.toBeVisible();
      await page.locator('[data-event-stage="late"]').click();
      await expect(page.locator("#event-test-phase")).toContainText("65~90");
      await expect(page.locator("#event-test-day")).toContainText("13년");
      expect(
        await page.locator("#event-test-choices button:disabled").count(),
      ).toBeGreaterThan(easyLocked);
      await expect(page.locator("#event-test-stats span")).toHaveText(stats);
      await expect(page.locator("#event-test-resources")).toHaveText(money);
      await expect(page.locator("#event-test-score")).toHaveText("0 / 100점");
      await expect(page.locator('[data-event-choice="support"]')).toBeEnabled();
      await page
        .locator("#event-test-encounter")
        .screenshot({ path: "/tmp/era-event-late-" + width + ".png" });
      await page.locator('[data-event-choice="support"]').click();
      await expect(page.locator("#event-test-score")).toHaveText("1 / 100점");
      await expect(page.locator("#event-test-result")).toContainText("+1점");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(api.calls).toBe(0);
      expect(errors).toEqual([]);
    },
  );

for (const width of [1280, 390])
  test(
    "sect mission changes era progress and diplomacy; promotion is earned at " +
      width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const api = await backend(page),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await login(page);
      await expect(page.locator("#catalog-form")).toBeVisible();
      await page.locator("#event-test-sect").selectOption("huashan");
      await page.locator("#event-test-type").selectOption("schism");
      await page.locator('[data-event-preset="strong"]').click();
      await page.locator("#event-test-start").click();
      await expect(page.locator("#sect-test-name")).toHaveText(
        "화산 · 외문제자",
      );
      await expect(page.locator("#sect-test-promote")).toBeDisabled();
      await page.locator("#sect-test-mission").click();
      await expect(page.locator("#event-test-kind")).toContainText(
        "문파 특수 임무",
      );
      await page.locator('[data-event-choice="cooperate"]').click();
      await expect(page.locator("#event-test-score")).toHaveText("6 / 100점");
      await expect(page.locator("#sect-test-standing")).toContainText("공헌 6");
      await expect(page.locator("#sect-test-relation")).toContainText("+12");
      await expect(page.locator("#sect-test-mission")).toBeDisabled();
      for (
        let i = 0;
        i < 40 && !(await page.locator("#sect-test-promote").isEnabled());
        i++
      ) {
        if (await page.locator("#event-test-encounter").isVisible()) {
          if (
            await page
              .locator('[data-event-choice="cooperate"]:enabled')
              .count()
          )
            await page.locator('[data-event-choice="cooperate"]').click();
          else if (
            await page.locator('[data-event-choice="support"]:enabled').count()
          )
            await page.locator('[data-event-choice="support"]').click();
          else await page.locator('[data-event-choice="leave"]').click();
        }
        if (await page.locator("#sect-test-promote").isEnabled()) break;
        if (await page.locator("#sect-test-mission").isEnabled())
          await page.locator("#sect-test-mission").click();
        else await page.locator('[data-event-days="1"]').click();
      }
      if (await page.locator("#event-test-encounter").isVisible()) {
        const cooperative = page.locator(
          '[data-event-choice="cooperate"]:enabled',
        );
        if (await cooperative.count()) await cooperative.click();
        else await page.locator('[data-event-choice="support"]').click();
      }
      await expect(page.locator("#sect-test-promote")).toBeEnabled();
      await page.locator("#sect-test-promote").click();
      await expect(page.locator("#sect-test-name")).toHaveText(
        "화산 · 내문제자",
      );
      await expect(page.locator("#sect-test-bonus")).toContainText("3일마다");
      await page
        .locator("#sect-test-panel")
        .screenshot({ path: "/tmp/sect-test-" + width + ".png" });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(api.calls).toBe(0);
      expect(errors).toEqual([]);
    },
  );

test("event popup dismiss, reopen and resolve preserve the pending decision", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  const api = await backend(page);
  await login(page);
  await page.locator("#event-test-start").click();
  await page.locator('[data-event-days="7"]').click();
  const popup = page.locator("#event-test-dialog");
  await expect(popup).toBeVisible();
  const title = await page.locator("#event-test-title").innerText();
  await expect(page.locator("#event-test-title")).toBeFocused();
  await page.screenshot({ path: "/tmp/event-popup-mobile.png" });
  await popup.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.keyboard.press("Escape");
  await expect(popup).not.toBeVisible();
  await expect(page.locator("#event-test-notice")).toBeVisible();
  await expect(page.locator('[data-event-days="1"]')).toBeDisabled();
  await expect(page.locator("#event-test-score")).toHaveText("0 / 100점");
  await page.locator("#event-test-reopen").click();
  await expect(popup).toBeVisible();
  expect(await popup.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator("#event-test-title")).toHaveText(title);
  await page.locator('[data-event-choice="support"]').click();
  await expect(popup).not.toBeVisible();
  await expect(page.locator("#event-test-notice")).not.toBeVisible();
  await expect(page.locator("#event-test-score")).toHaveText("3 / 100점");
  expect(api.calls).toBe(0);
});

for (const width of [1280, 390])
  test(
    "growth comparison runs, validates and leaves era edits untouched at " +
      width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const api = await backend(page),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await login(page);
      await expect(page.locator("#catalog-form")).toBeVisible();
      await page.locator("#growth-run").click();
      await expect(page.locator(".growth-run-card")).toHaveCount(4);
      await expect(page.locator(".growth-run-card").first()).toContainText(
        "91",
      );
      await expect(page.locator(".growth-run-card").nth(1)).toContainText(
        "상한 100 도달",
      );
      const before = await page.locator("#growth-results").innerText();
      await page.locator("#growth-run").click();
      await expect(page.locator("#growth-results")).toHaveText(before, {
        useInnerText: true,
      });
      await page.locator("#growth-training").fill("90");
      await page.locator("#growth-run").click();
      await expect(page.locator("#growth-status")).toContainText("합계");
      await page.locator('[data-growth-plan="training"]').click();
      await expect(page.locator("#growth-training")).toHaveValue("80");
      await page.locator("#growth-run").click();
      await expect(page.locator("#growth-report-summary")).toContainText(
        "80/5/15%",
      );
      await page.locator('[data-growth-plan="balanced"]').click();
      await page.locator("#growth-run").click();
      await expect(page.locator("#growth-report-summary")).toContainText(
        "60/20/20%",
      );

      await expect(page.locator("#dirty-status")).toHaveText(
        "저장된 상태입니다",
      );
      expect(api.calls).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .locator("#growth-section")
        .screenshot({ path: "/tmp/growth-" + width + ".png" });
      expect(errors).toEqual([]);
    },
  );
