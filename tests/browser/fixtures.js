import { test as base, expect } from "@playwright/test";
export const test = base.extend({
  isolateEra: [
    async ({ page }, use) => {
      await page.route("**/rest/v1/rpc/era_public_catalog", (r) =>
        r.fulfill({ json: null }),
      );
      await use();
    },
    { auto: true },
  ],
});
export { expect };

export async function expandGamePanels(page) {
  if (
    !(await page.locator("#world-screen").isVisible()) ||
    (await page.locator("dialog[open]").count())
  )
    return;
  for (const id of [
    "group-growth",
    "group-progression",
    "group-alignment",
    "group-martial",
    "group-records",
  ]) {
    const group = page.locator("#" + id);
    if (!(await group.evaluate((el) => el.open)))
      await group.locator(":scope > summary").click();
  }
}
