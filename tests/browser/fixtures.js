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
