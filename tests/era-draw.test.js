import test from "node:test";
import assert from "node:assert/strict";
import { eraTypes, eraTemplates } from "../src/game/era-candidates.js";
import {
  drawEra,
  sampleEras,
  pickWeighted,
  seededRandom,
} from "../src/game/era-draw.js";
import { validateDocument } from "../src/admin/model.js";

test("all six preview templates obey fixed score and outcome rules", () => {
  assert.equal(eraTypes.length, 3);
  assert.equal(eraTemplates.length, 6);
  for (const t of eraTemplates) {
    assert.deepEqual(validateDocument(t.catalog, { publish: true }), []);
    assert.equal(t.previewOnly, true);
    assert.equal(t.catalog.era.status, "draft");
    assert.equal(t.catalog.era.duration_years, 20);
  }
});
test("seed replay is deterministic and returns an independent snapshot", () => {
  const pinned = drawEra({ seed: "jianghu-001" });
  assert.equal(pinned.algorithm, "era-draw-v1");
  assert.equal(pinned.type.id, "schism");
  assert.equal(pinned.template.id, "broken_oath");
  const first = drawEra({ seed: "  강호-001  " }),
    again = drawEra({ seed: "강호-001" });
  assert.deepEqual(first, again);
  assert.equal(first.seed, "강호-001");
  assert.deepEqual(first.chances, {
    type: 1 / 3,
    template: 1 / 2,
    combined: 1 / 6,
  });
  first.template.catalog.era.name = "변경";
  assert.deepEqual(drawEra({ seed: "강호-001" }), again);
  assert.equal(seededRandom("test")(), seededRandom("test")());
});
test("type selection occurs before template selection and forced types stay inside their pool", () => {
  for (const type of eraTypes) {
    for (let i = 0; i < 100; i++) {
      const result = drawEra({ seed: String(i), typeId: type.id });
      assert.equal(result.type.id, type.id);
      assert.equal(result.template.typeId, type.id);
      assert.deepEqual(result.chances, {
        type: 1,
        template: 1 / 2,
        combined: 1 / 2,
      });
    }
  }
  // One remaining template in a type does not reduce its type probability.
  const templates = eraTemplates.filter(
    (t) => t.typeId !== "demonic" || t.id === "shadow_routes",
  );
  const result = drawEra({ seed: "one", templates });
  assert.equal(result.chances.type, 1 / 3);
});
test("weighted boundary tickets, invalid seeds and unusable pools fail explicitly", () => {
  const options = [
    { id: "a", weight: 1 },
    { id: "b", weight: 3 },
  ];
  assert.equal(pickWeighted(options, () => 0).id, "a");
  assert.equal(pickWeighted(options, () => 0.25).id, "b");
  assert.equal(pickWeighted(options, () => 1 - Number.EPSILON).id, "b");
  for (const seed of ["", " ", null, "a".repeat(129)])
    assert.throws(() => drawEra({ seed }));
  for (const value of [-1, 1, NaN])
    assert.throws(() => pickWeighted(options, () => value));
  assert.throws(() => drawEra({ seed: "ok", templates: [] }));
  assert.throws(() => drawEra({ seed: "ok", typeId: "unknown" }));
  assert.throws(() =>
    drawEra({ seed: "ok", templates: [...eraTemplates, eraTemplates[0]] }),
  );
  assert.throws(() =>
    drawEra({
      seed: "ok",
      templates: eraTemplates.map((t) => ({ ...t, weight: 0 })),
    }),
  );
  const disabled = eraTemplates.map((t) => ({
    ...t,
    enabled: t.typeId !== "manual",
  }));
  assert.throws(() =>
    drawEra({ seed: "ok", typeId: "manual", templates: disabled }),
  );
  for (let i = 0; i < 100; i++)
    assert.notEqual(
      drawEra({ seed: String(i), templates: disabled }).type.id,
      "manual",
    );
});
test("deterministic batch covers every template, approximates equal odds and supports the longest seed", () => {
  const a = sampleEras("distribution-v1", null, 6000);
  assert.deepEqual(a, sampleEras("distribution-v1", null, 6000));
  assert.equal(
    Object.values(a.counts).reduce((s, n) => s + n, 0),
    6000,
  );
  for (const n of Object.values(a.counts))
    assert.ok(n > 850 && n < 1150, "unexpected count " + n);
  const forced = sampleEras("a".repeat(128), "manual", 1000);
  assert.equal(Object.keys(forced.counts).length, 2);
  assert.equal(
    Object.values(forced.counts).reduce((s, n) => s + n, 0),
    1000,
  );
  for (const count of [0, -1, 10001, 1.5])
    assert.throws(() => sampleEras("ok", null, count));
});
