import { test, expect } from "./fixtures.js";
import { catalog } from "../era-fixture.js";
async function enter(page) {
  await page.goto("/");
  await page.locator("#choose").click();
  await page.locator("#character-name").fill("청명");
  await page.locator("#confirm-character").click();
  await page.locator("#draw-encounter").click();
  await page.locator("#enter-world").click();
}
for (const width of [390, 1280])
  test(
    "era introduction, skip, replay and frozen setting at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/rest/v1/rpc/era_public_catalog", (r) =>
        r.fulfill({ json: catalog }),
      );
      await enter(page);
      await expect(page.locator("#era-intro")).toBeVisible();
      await expect(page.locator("#era-intro-title")).toHaveText("마교의 준동");
      await expect(page.locator("#era-intro-duration")).toHaveText("20년");
      await expect(page.locator("#era-intro-sound")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "/tmp/era-" + width + ".png",
        fullPage: false,
      });
      await page.locator("#era-intro-skip").click();
      await expect(page.locator("#era-intro")).not.toBeVisible();
      await page.route("**/rest/v1/rpc/era_public_catalog", (r) =>
        r.fulfill({
          json: { ...catalog, era: { ...catalog.era, name: "변경된 설정" } },
        }),
      );
      await page.reload();
      await expect(page.locator("#era-banner")).toContainText("마교의 준동");
      await expect(page.locator("#era-intro")).not.toBeVisible();
      await page.locator("#era-replay").click();
      await expect(page.locator("#era-intro")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("#era-intro")).not.toBeVisible();
      await expect(page.locator("#era-replay")).toBeFocused();
      expect(errors).toEqual([]);
    },
  );
test("empty catalog can be retried without blocking play", async ({ page }) => {
  await enter(page);
  await expect(page.locator("#era-banner")).toContainText(
    "아직 공개된 시대가 없습니다",
  );
  await page.route("**/rest/v1/rpc/era_public_catalog", (r) =>
    r.fulfill({ json: catalog }),
  );
  await page.locator("#era-retry").click();
  await expect(page.locator("#era-intro")).toBeVisible();
  await page.locator("#era-intro-enter").click();
  await expect(page.locator("#era-banner")).toContainText("1년차 / 20년");
});

test("connection failure retries and long copy stays scrollable on a short mobile screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/rest/v1/rpc/era_public_catalog", (r) =>
    r.fulfill({ status: 503, json: { message: "unavailable" } }),
  );
  await enter(page);
  await expect(page.locator("#era-banner")).toContainText(
    "시대 정보를 불러오지 못했습니다",
  );
  await page.route("**/rest/v1/rpc/era_public_catalog", (r) =>
    r.fulfill({
      json: {
        ...catalog,
        era: {
          ...catalog.era,
          description: "강호의 새로운 이야기가 펼쳐진다. ".repeat(100),
        },
      },
    }),
  );
  await page.locator("#era-retry").click();
  await expect(page.locator("#era-intro")).toBeVisible();
  await expect(page.locator("#era-intro-title")).toHaveCSS("opacity", "1");
  const geometry = await page.locator(".era-intro-main").evaluate((el) => {
    const copy = el.querySelector(".era-intro-copy");
    return {
      scrollable: el.scrollHeight > el.clientHeight,
      top: copy.getBoundingClientRect().top >= el.getBoundingClientRect().top,
    };
  });
  expect(geometry).toEqual({ scrollable: true, top: true });
  await expect(page.locator("#era-intro-enter")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#era-intro-enter").click();
});
