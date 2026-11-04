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
