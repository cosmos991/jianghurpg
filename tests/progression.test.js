import test from "node:test";
import assert from "node:assert/strict";
import {
  combatTurn,
  createBattle,
  combatStats,
  breakthroughStatus,
  ensureProgress,
  drillStep,
  sects,
  sectArts,
  realms,
} from "../src/game/progression.js";
const fate = { stats: [60, 60, 60, 60] };
const catalog = { sword: { category: "attack" } };
const journey = () => ({
  inner: 20,
  mastery: 20,
  arts: { sword: { status: "learned", xp: 20 } },
  trainingArt: "sword",
});

test("legacy journey gains defaults without losing resources", () => {
  const j = journey();
  const p = ensureProgress(j);
  p.wins = 2;
  assert.equal(ensureProgress(j).wins, 2);
  assert.equal(j.inner, 20);
  assert.equal(combatStats(j, fate, catalog).maxQi, 20);
});

test("skill consumes current qi only and invalid skills do not advance turns", () => {
  const j = journey(),
    b = createBattle(j, fate, catalog);
  const after = combatTurn(b, "skill");
  assert.equal(after.qi, 14);
  assert.equal(j.inner, 20);
  assert.equal(b.qi, 20);
  const empty = { ...b, qi: 5 };
  assert.deepEqual(combatTurn(empty, "skill"), empty);
  assert.deepEqual(combatTurn(b, "invalid"), b);
});

test("guarding a heavy attack reduces damage and counters", () => {
  const b = { ...createBattle(journey(), fate, catalog), intent: "heavy" };
  const defended = combatTurn(b, "guard"),
    attacked = combatTurn(b, "attack");
  assert.ok(defended.hp > attacked.hp);
  assert.ok(defended.enemyHp < b.enemyHp);
});

test("terminal combat is immutable, defeat and retreat are finite outcomes", () => {
  const b = createBattle(journey(), fate, catalog);
  const win = combatTurn({ ...b, enemyHp: 1 }, "attack");
  assert.equal(win.status, "won");
  assert.deepEqual(combatTurn(win, "attack"), win);
  const loss = combatTurn({ ...b, hp: 1, intent: "heavy" }, "breathe");
  assert.equal(loss.status, "lost");
  assert.equal(loss.hp, 0);
  assert.equal(combatTurn(b, "retreat").status, "retreat");
});

test("beginner can win practice using telegraphed guard strategy without qi", () => {
  let b = createBattle(
    { ...journey(), inner: 0 },
    { stats: [15, 15, 15, 15] },
    catalog,
  );
  for (let i = 0; i < 40 && b.status === "active"; i++)
    b = combatTurn(b, b.intent === "heavy" ? "guard" : "attack");
  assert.equal(b.status, "won");
});

test("breakthrough requires both inner power and attack mastery, max realm stops", () => {
  const j = journey();
  j.inner = 100;
  j.mastery = 19;
  assert.equal(breakthroughStatus(j).ready, false);
  j.mastery = 20;
  assert.equal(breakthroughStatus(j).ready, true);
  j.progress.realm = realms.length - 1;
  assert.equal(breakthroughStatus(j).next, undefined);
});

test("drills finish in three answers and cannot duplicate completion", () => {
  let d = { kind: "breath", step: 0, correct: 0, finished: false };
  for (const answer of ["들이쉬기", "머무르기", "내쉬기"])
    d = drillStep(d, answer);
  assert.equal(d.correct, 3);
  assert.equal(d.finished, true);
  assert.deepEqual(drillStep(d, "들이쉬기"), d);
  const wrong = drillStep({ kind: "stance", step: 0, correct: 0 }, "막기");
  assert.equal(wrong.correct, 0);
  assert.equal(wrong.step, 1);
});

test("each sect has valid arts and a result for every entrance choice", () => {
  for (const sect of Object.values(sects)) {
    assert.ok(sectArts[sect.art]);
    assert.ok(sectArts[sect.mind]);
    assert.equal(sect.choices.length, sect.results.length);
  }
});
