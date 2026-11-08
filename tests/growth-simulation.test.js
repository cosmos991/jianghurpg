import test from "node:test";
import assert from "node:assert/strict";
import {
  simulateGrowth,
  compareGrowth,
} from "../src/game/growth-simulation.js";
const base = {
  seed: "growth-001",
  start: 15,
  focus: "force",
  typeId: "demonic",
  training: 60,
  fortune: 20,
  rules: { fortuneChance: 0 },
};
test("baseline exactly follows training time and reports five, twelve and twenty years", () => {
  const r = simulateGrowth(base);
  assert.deepEqual(
    r.checkpoints.map((p) => p.stats.force),
    [33, 58, 87],
  );
  assert.deepEqual(
    r.checkpoints.map((p) => p.stage),
    ["초반", "중반", "후반"],
  );
  assert.deepEqual(r.actual, { training: 4320, fortune: 1440, work: 1440 });
  assert.equal(r.forcedWork, 0);
  assert.equal(r.money, 100);
  assert.equal(r.stats.wisdom, 15);
  assert.equal(r.stats.inner, 10);
  assert.equal(r.reached[90], null);
});
test("paired sect comparison only boosts the corresponding focus and preserves costs and fortune samples", () => {
  const input = { ...base, rules: { fortuneChance: 0.5 } };
  const report = compareGrowth(input);
  assert.deepEqual(report, compareGrowth(input));
  const [none, huashan, wudang, shaolin] = report.runs;
  assert.ok(huashan.stats.force > none.stats.force);
  assert.equal(wudang.stats.force, none.stats.force);
  assert.equal(shaolin.stats.force, none.stats.force);
  for (const r of report.runs) {
    assert.equal(r.money, none.money);
    assert.equal(r.fortunes, none.fortunes);
    assert.deepEqual(r.actual, none.actual);
  }
  const inner = compareGrowth({ ...base, focus: "inner" }).runs;
  assert.ok(inner[2].stats.inner > inner[0].stats.inner);
  assert.deepEqual(inner[0].checkpoints, inner[1].checkpoints);
});
test("money shortages change actual activities without negative balances or free training", () => {
  const r = simulateGrowth({
    ...base,
    training: 100,
    fortune: 0,
    rules: { fortuneChance: 0, startingMoney: 0, workIncome: 0 },
  });
  assert.equal(r.actual.training, 0);
  assert.equal(r.forcedWork, 7200);
  assert.equal(r.money, 0);
  assert.equal(r.stats.force, 15);
  const funded = simulateGrowth({ ...base, training: 100, fortune: 0 });
  assert.ok(funded.forcedWork > 0);
  assert.ok(funded.actual.training < 7200);
  assert.equal(
    Object.values(funded.actual).reduce((s, n) => s + n, 0),
    7200,
  );
  assert.ok(funded.checkpoints.every((p) => p.money >= 0));
});
test("guaranteed fortune and caps are counted while never exceeding the stat limit", () => {
  const r = simulateGrowth({
    ...base,
    training: 0,
    fortune: 100,
    rules: { fortuneChance: 100, fortuneGain: 1, fortuneCost: 0 },
  });
  assert.equal(r.fortunes, 7200);
  assert.equal(r.stats.force, 100);
  assert.equal(r.reached[90], 75);
  assert.equal(r.cappedDay, 85);
  assert.equal(simulateGrowth({ ...base, start: 100 }).cappedDay, 0);
});
test("access counts match the selected phase pool and malformed settings fail before simulation", () => {
  const r = simulateGrowth(base);
  for (const p of r.checkpoints) {
    assert.ok(p.access.total > 0);
    assert.ok(p.access.open <= p.access.total);
    assert.ok(p.access.percent >= 0 && p.access.percent <= 100);
  }
  for (const bad of [
    { training: 81, fortune: 20 },
    { seed: "" },
    { start: 101 },
    { focus: "demonic" },
    { rules: { trainingDays: 0 } },
    { rules: { fortuneChance: NaN } },
    { rules: { workIncome: -1 } },
  ])
    assert.throws(() => simulateGrowth({ ...base, ...bad }));
  assert.throws(() => simulateGrowth(base, "unknown"));
});
