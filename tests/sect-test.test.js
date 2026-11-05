import test from "node:test";
import assert from "node:assert/strict";
import {
  startEventTest,
  advanceTestDay,
  resolveTestEvent,
  getTestEvent,
  jumpTestStage,
} from "../src/game/era-event-test.js";
import {
  testSects,
  discipleRanks,
  requestSectMission,
  missionReady,
  sectPromotion,
  promoteTestSect,
} from "../src/game/sect-test.js";
const stats = { force: 100, wisdom: 100, speech: 100, inner: 100, demonic: 0 };
const start = (sectId = "huashan", typeId = "demonic") =>
  startEventTest({ seed: "sect-001", sectId, typeId, stats });
function finish(s, id = "cooperate") {
  const e = getTestEvent(s);
  resolveTestEvent(s, s.pending.token, e.mission ? id : "leave");
}
test("membership validation, nonmember baseline and each sect's training bonus", () => {
  assert.equal(startEventTest({ seed: "ok" }).sect, null);
  assert.throws(() => start("fake"));
  for (const id of Object.keys(testSects)) {
    const s = startEventTest({ seed: "ok", sectId: id });
    for (let i = 0; i < 4; i++) {
      advanceTestDay(s, "martial");
      if (s.pending) finish(s, "support");
    }
    const key = testSects[id].stat;
    assert.equal(s.stats[key], key === "force" ? 24 : 15);
    assert.equal(s.sect.practiceDays, 4);
    assert.equal(s.sect.serviceDays, 4);
  }
});
test("promotion needs training, competence, contribution and trust, and never skips ranks", () => {
  const s = start();
  assert.equal(sectPromotion(s).ready, false);
  const before = structuredClone(s);
  assert.throws(() => promoteTestSect(s));
  assert.deepEqual(s, before);
  s.sect.practiceDays = 20;
  s.sect.contribution = 100;
  s.sect.trust = 100;
  assert.equal(promoteTestSect(s), "내문제자");
  assert.equal(s.sect.rank, 1);
  assert.equal(s.sect.contribution, 100);
  assert.equal(promoteTestSect(s), "핵심제자");
  assert.equal(sectPromotion(s).max, true);
  assert.throws(() => promoteTestSect(s));
});
test("every era and rank has a mission linked to an era task with one-shot rewards", () => {
  for (const type of ["demonic", "manual", "schism"])
    for (let rank = 0; rank < 3; rank++) {
      const s = start("huashan", type);
      s.sect.rank = rank;
      const mission = requestSectMission(s),
        token = s.pending.token;
      assert.ok(mission.body.includes(discipleRanks[rank].name));
      assert.ok(
        mission.choices.every((c) => c.effects.slot >= 0 && c.effects.slot < 4),
      );
      assert.throws(() => requestSectMission(s));
      finish(s);
      assert.ok(s.progress.some((p) => p > 0));
      assert.ok(s.sect.contribution > 0);
      assert.equal(s.sect.relation, 12);
      const after = structuredClone(s);
      assert.throws(() => resolveTestEvent(s, token, "cooperate"));
      assert.deepEqual(s, after);
      assert.equal(missionReady(s), false);
    }
});
test("sect pressure can hurt the era and worsen diplomacy; support and refusal remain available", () => {
  const s = start("huashan", "schism");
  s.progress[0] = 10;
  requestSectMission(s);
  finish(s, "pressure");
  assert.equal(s.progress[0], 8);
  assert.equal(s.sect.contribution, 8);
  assert.equal(s.sect.relation, -15);
  s.sect.serviceDays += 3;
  requestSectMission(s);
  finish(s, "pressure");
  assert.equal(s.sect.relation, -30);
  s.sect.serviceDays += 3;
  const hostile = requestSectMission(s);
  assert.equal(
    hostile.choices.find((c) => c.id === "mediate").requires.speech,
    30,
  );
  finish(s, "decline");
  assert.equal(s.sect.trust, 17);
  const poor = startEventTest({
    seed: "poor",
    sectId: "wudang",
    stats: { force: 0, wisdom: 0, speech: 0, inner: 0, demonic: 0 },
  });
  poor.money = 0;
  requestSectMission(poor);
  finish(poor, "support");
  assert.equal(poor.sect.contribution, 2);
  assert.equal(poor.progress[0], 1);
});
test("jumps cannot manufacture training, promotion or a fresh mission cooldown", () => {
  const s = start();
  requestSectMission(s);
  finish(s);
  const before = structuredClone(s.sect);
  jumpTestStage(s, "late");
  finish(s);
  assert.deepEqual(s.sect, before);
  assert.equal(missionReady(s), false);
  assert.throws(() => promoteTestSect(s));
});
test("an actual training and mission loop reaches core disciple without editing rank or awarding free merit", () => {
  const s = start();
  for (let day = 0; day < 70 && s.sect.rank < 2; day++) {
    if (s.pending) finish(s);
    if (missionReady(s)) {
      requestSectMission(s);
      finish(s);
    }
    if (sectPromotion(s).ready) promoteTestSect(s);
    if (s.sect.rank === 2) break;
    advanceTestDay(s, "martial");
    if (s.pending) finish(s);
  }
  assert.equal(s.sect.rank, 2);
  assert.ok(s.sect.practiceDays >= 20);
  assert.ok(s.sect.contribution >= 40);
  assert.ok(s.sect.trust >= 35);
});
