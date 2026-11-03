import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureDarkness,
  temptationTier,
  updateTemptation,
  resolveTemptation,
  erosionEffects,
  darkPractice,
  purify,
  canVisitSect,
  darkSects,
} from "../src/game/darkness.js";
import {
  combatStats,
  createBattle,
  combatTurn,
} from "../src/game/progression.js";
const make = () => ({
  turn: 2,
  energy: 100,
  inner: 0,
  alignment: { righteous: 0, black: 0, demonic: 0 },
  arts: {},
  progress: { realm: 0, sect: null },
});
const weak = { stats: [20, 20, 20, 20] },
  strong = { stats: [80, 80, 80, 80] };

test("higher demonic alignment increases reward and cost at every threshold", () => {
  const tiers = [0, 20, 45, 70].map(temptationTier);
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(tiers[i].inner > tiers[i - 1].inner);
    assert.ok(tiers[i].erosion > tiers[i - 1].erosion);
  }
  assert.equal(temptationTier(19).min, 0);
  assert.equal(temptationTier(44).min, 20);
  assert.equal(temptationTier(69).min, 45);
  assert.equal(temptationTier(100).min, 70);
});
test("weakness or defeat introduces the temptation earlier, without changing morality", () => {
  const j = make();
  assert.equal(updateTemptation(j, weak), true);
  assert.equal(j.alignment.demonic, 0);
  assert.equal(j.inner, 0);
  const strongJ = make();
  assert.equal(updateTemptation(strongJ, strong), false);
  ensureDarkness(strongJ).losses = 1;
  assert.equal(updateTemptation(strongJ, strong), true);
  const token = j.darkness.offer.token;
  updateTemptation(j, weak);
  assert.equal(j.darkness.offer.token, token);
});
test("accept gives real power, separate erosion, a learned mind and exactly one resolution", () => {
  const j = make();
  j.alignment.demonic = 45;
  updateTemptation(j, weak);
  const offer = j.darkness.offer;
  const result = resolveTemptation(j, offer.token, true);
  assert.equal(j.inner, 40);
  assert.equal(j.darkness.erosion, 22);
  assert.equal(j.energy, 88);
  assert.equal(j.alignment.demonic, 60);
  assert.equal(j.arts.forbiddenBreath.status, "learned");
  assert.equal(result.inner, 40);
  assert.equal(resolveTemptation(j, offer.token, true), null);
  assert.equal(j.inner, 40);
  assert.equal(updateTemptation(j, weak), false);
});
test("insufficient resources preserve the offer; refusal has no resource penalty and a cooldown", () => {
  const j = make();
  updateTemptation(j, weak);
  const token = j.darkness.offer.token;
  j.energy = 0;
  assert.equal(resolveTemptation(j, token, true), null);
  assert.ok(j.darkness.offer);
  assert.equal(resolveTemptation(j, token, false).accepted, false);
  assert.equal(j.inner, 0);
  assert.equal(j.darkness.erosion, 0);
  assert.equal(j.alignment.demonic, 0);
  assert.equal(updateTemptation(j, weak), false);
});
test("erosion penalties and purification preserve learned arts and affiliation", () => {
  const j = make();
  j.inner = 10;
  j.progress.sect = "bloodmoon";
  j.arts.bloodMind = { status: "learned", xp: 0 };
  ensureDarkness(j).erosion = 90;
  assert.equal(erosionEffects(90).stage, 3);
  assert.equal(erosionEffects(29).hpPenalty, 0);
  assert.ok(purify(j));
  assert.equal(j.darkness.erosion, 78);
  assert.equal(j.inner, 7);
  assert.equal(j.progress.sect, "bloodmoon");
  assert.ok(j.arts.bloodMind);
});
test("dark practice accelerates inner growth but creates bounded erosion", () => {
  const j = make();
  assert.equal(darkPractice(j, "bloodMind"), 7);
  assert.equal(j.darkness.erosion, 5);
  assert.equal(darkPractice(j, "sword"), 0);
  j.darkness.erosion = 99;
  j.alignment.demonic = 100;
  darkPractice(j, "bloodPalm");
  assert.equal(j.darkness.erosion, 100);
  assert.equal(j.alignment.demonic, 100);
});
test("forbidden patronage opens early dark sects but never switches existing membership", () => {
  const j = make();
  assert.equal(canVisitSect(j, darkSects.bloodmoon), false);
  ensureDarkness(j).accepted = 1;
  assert.equal(canVisitSect(j, darkSects.bloodmoon), true);
  assert.equal(canVisitSect(j, { dark: false }), false);
  j.progress.sect = "huashan";
  assert.equal(canVisitSect(j, darkSects.bloodmoon), false);
});
test("dark skills hit harder with erosion backlash and lower next-battle health", () => {
  const j = make();
  j.inner = 20;
  j.trainingArt = "bloodPalm";
  j.arts.bloodPalm = { status: "learned", xp: 10 };
  ensureDarkness(j).erosion = 60;
  const cat = { bloodPalm: { category: "attack", dark: true } };
  const stats = combatStats(j, weak, cat);
  assert.equal(stats.maxHp, 65);
  const b = createBattle(j, weak, cat);
  const next = combatTurn(b, "skill");
  assert.ok(next.enemyHp < b.enemyHp);
  assert.ok(next.hp < b.hp);
  assert.equal(j.inner, 20);
});
