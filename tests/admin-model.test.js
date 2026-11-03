import test from "node:test";
import assert from "node:assert/strict";
import { validateDocument } from "../src/admin/model.js";
const make = () => ({
  era: { name: "시대", duration_years: 20, version: 1 },
  objectives: [
    {
      id: "a",
      name: "단서",
      points: 100,
      condition_code: "CLUE_FOUND",
      target_key: "clue_01",
    },
  ],
  outcomes: [
    {
      id: "first",
      name: "결과",
      min_score: 0,
      max_score: 100,
      world_result: "기록",
      required_objective_ids: [],
      fame_reward: 0,
      contribution_reward: 0,
      legacy_reward_code: "NONE",
    },
  ],
});
test("draft accepts unfinished totals, publishing requires 100 and continuous ranges", () => {
  const d = make();
  assert.deepEqual(validateDocument(d, { publish: true }), []);
  d.objectives[0].points = 90;
  assert.deepEqual(validateDocument(d), []);
  assert.ok(
    validateDocument(d, { publish: true }).some((e) => e.includes("100점")),
  );
  d.objectives[0].points = 100;
  d.outcomes[0].min_score = 1;
  assert.ok(validateDocument(d, { publish: true }).length);
});
test("required objectives and malformed values are rejected", () => {
  const d = make();
  d.outcomes[0].required_objective_ids = ["missing"];
  d.outcomes[0].fame_reward = -1;
  d.era.duration_years = 0;
  assert.ok(validateDocument(d).length >= 3);
});
test("duplicate target conditions cannot double-credit one event", () => {
  const d = make();
  d.objectives.push({ ...d.objectives[0], id: "b" });
  assert.ok(validateDocument(d).some((e) => e.includes("대상")));
});
