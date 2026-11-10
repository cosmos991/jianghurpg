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

const careerInput = {
  ...base,
  sectMode: "career",
  missionPolicy: "merit",
  rules: { fortuneChance: 0.5 },
};
test("career missions consume real days, pay costs, and earn each promotion before its bonus applies", () => {
  const r = simulateGrowth(careerInput, "huashan");
  assert.equal(
    Object.values(r.actual).reduce((sum, n) => sum + n, 0) + r.missions.days,
    7200,
  );
  assert.equal(r.missions.spent, r.missions.days);
  assert.ok(r.actual.training < 4320);
  assert.equal(r.promotions.length, 2);
  const requirements = [
    { days: 360, merit: 120, power: 30, trust: 15 },
    { days: 1200, merit: 600, power: 55, trust: 35 },
  ];
  r.promotions.forEach((p, i) => {
    assert.equal(p.rank, i + 1);
    assert.ok(p.practiceDays >= requirements[i].days);
    assert.ok(p.contribution >= requirements[i].merit);
    assert.ok(p.power >= requirements[i].power);
    assert.ok(p.trust >= requirements[i].trust);
  });
  assert.ok(r.money >= 0);
  assert.ok(r.career.relation >= -100 && r.career.relation <= 100);
});
test("uncompleted missions spend time but grant no merit, era score or free training", () => {
  const r = simulateGrowth(
    {
      ...careerInput,
      rules: { fortuneChance: 0, missionInterval: 4, missionOuterDays: 7200 },
    },
    "huashan",
  );
  assert.equal(r.missions.completed, 0);
  assert.equal(r.career.contribution, 0);
  assert.equal(r.missions.score, 0);
  assert.equal(r.career.rank, 0);
  assert.ok(r.missions.pendingDays > 0);
  assert.ok(r.missions.days > 0);
  assert.equal(
    Object.values(r.actual).reduce((sum, n) => sum + n, 0) + r.missions.days,
    7200,
  );
});
test("career control uses the same outer-disciple conditions and reports the observed difference without assuming recovery", () => {
  const report = compareGrowth(careerInput);
  const r = report.runs[1],
    control = simulateGrowth(
      { ...careerInput, sectMode: "training" },
      "huashan",
    );
  assert.equal(r.control.final, control.stats.force);
  assert.equal(r.control.difference, r.stats.force - control.stats.force);
  assert.equal(r.control.difference, -1);
  assert.equal(r.control.firstLeadDay, null);
  assert.equal(control.career.rank, 0);
  assert.equal(control.missions.completed, 0);
  assert.deepEqual(report, compareGrowth(careerInput));
});
test("mission policy changes sect relations and era contribution, while a mismatched focus blocks promotion", () => {
  const merit = simulateGrowth({ ...careerInput, typeId: "schism" }, "huashan");
  const era = simulateGrowth(
    { ...careerInput, typeId: "schism", missionPolicy: "era" },
    "huashan",
  );
  assert.ok(merit.career.relation < era.career.relation);
  assert.ok(merit.missions.score < era.missions.score);
  const other = simulateGrowth(careerInput, "wudang");
  assert.equal(other.career.rank, 0);
  assert.ok(other.career.nextPromotion.missing.some((s) => s.includes("내공")));
  for (const bad of [
    { sectMode: "unknown" },
    { missionPolicy: "unknown" },
    { rules: { missionInterval: 0 } },
    { rules: { missionCoreDays: 0 } },
  ])
    assert.throws(() => simulateGrowth({ ...careerInput, ...bad }, "huashan"));
});
test("financial shortages cannot pay mission rewards or duplicate days", () => {
  const r = simulateGrowth(
    {
      ...careerInput,
      rules: { startingMoney: 0, workIncome: 0, fortuneChance: 0 },
    },
    "huashan",
  );
  assert.equal(r.missions.completed, 0);
  assert.equal(r.career.contribution, 0);
  assert.equal(r.money, 0);
  assert.equal(r.actual.training, 0);
  const mixed = simulateGrowth(
    {
      ...careerInput,
      rules: {
        trainingCost: 0,
        startingMoney: 3,
        missionCost: 10,
        workIncome: 1,
        missionInterval: 4,
      },
    },
    "huashan",
  );
  assert.ok(mixed.money >= 0);
  assert.ok(mixed.forcedWork <= mixed.actual.work);
  assert.equal(
    Object.values(mixed.actual).reduce((s, n) => s + n, 0) +
      mixed.missions.days,
    7200,
  );
});
