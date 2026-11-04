import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./era-fixture.js";
import {
  createEraSnapshot,
  validEraCatalog,
  validEraSnapshot,
  eraClock,
  eraDateRange,
  themeForEra,
} from "../src/game/era.js";
test("era snapshot freezes the published catalog and starts at the current turn", () => {
  const doc = structuredClone(catalog),
    s = createEraSnapshot(doc, 720);
  doc.era.name = "편집됨";
  assert.equal(s.catalog.era.name, "마교의 준동");
  assert.equal(s.endTurn, 15120);
  assert.equal(validEraSnapshot(s), true);
  assert.equal(eraDateRange(s), "2년 1월 1일 — 21년 12월 30일");
  assert.equal(eraClock(s, 720).year, 1);
  assert.equal(eraClock(s, 1440).year, 2);
  assert.deepEqual(eraClock(s, 99999), {
    progress: 100,
    year: 20,
    ended: true,
  });
  assert.equal(themeForEra(s.catalog), "demonic");
});
test("draft, malformed and incomplete catalogs cannot start an era", () => {
  assert.equal(
    validEraCatalog({ ...catalog, era: { ...catalog.era, status: "draft" } }),
    false,
  );
  assert.equal(validEraCatalog({ ...catalog, objectives: [] }), false);
  assert.equal(validEraCatalog(null), false);
  assert.throws(() => createEraSnapshot(null, 0));
  assert.equal(validEraSnapshot({}), false);
});
