import test from "node:test";
import assert from "node:assert/strict";
import {
  eraEvents,
  eventStatNames,
  eraStage,
  eraStages,
} from "../src/game/era-events.js";
import {
  startEventTest,
  advanceTestDay,
  advanceTestDays,
  resolveTestEvent,
  choiceAvailability,
  eventScore,
  testEnded,
  jumpTestStage,
} from "../src/game/era-event-test.js";
const start = (typeId = "demonic", stats) =>
  startEventTest({ seed: "event-001", typeId, stats });
const next = (s) => {
  for (let i = 0; i < 100 && !s.pending; i++) advanceTestDay(s, "martial");
  assert.ok(s.pending);
  return eraEvents.find((e) => e.id === s.pending.id);
};
test("72 phase-specific scenes have unique ids, valid objective targets and an unconditional exit", () => {
  assert.equal(eraEvents.length, 72);
  assert.equal(new Set(eraEvents.map((e) => e.id)).size, 72);
  for (const type of ["demonic", "manual", "schism"]) {
    const events = eraEvents.filter((e) => e.type === type);
    assert.equal(events.length, 24);
    for (const event of events) {
      assert.ok(event.title && event.body);
      assert.equal(
        new Set(event.choices.map((c) => c.id)).size,
        event.choices.length,
      );
      assert.ok(
        event.choices.some(
          (c) =>
            c.id === "leave" &&
            Object.keys(c.requires).length === 0 &&
            c.effects.money === 0,
        ),
      );
      for (const c of event.choices) {
        assert.ok(c.effects.slot >= 0 && c.effects.slot < 4);
        for (const key of Object.keys(c.requires))
          assert.ok(Object.hasOwn(eventStatNames, key));
      }
    }
  }
});
test("same era seed and actions replay exact days and encounters, excluding four recent scenes", () => {
  for (const type of ["demonic", "manual", "schism"]) {
    const a = start(type),
      b = start(type),
      seen = new Set(),
      recent = [];
    let lastDay = -2;
    for (let i = 0; i < 400; i++) {
      advanceTestDay(a, "martial");
      advanceTestDay(b, "martial");
      if (a.pending) {
        assert.ok(a.day - lastDay >= 2);
        lastDay = a.day;
        assert.ok(!recent.includes(a.pending.id));
        seen.add(a.pending.id);
        recent.unshift(a.pending.id);
        recent.splice(4);
        resolveTestEvent(a, a.pending.token, "leave");
        resolveTestEvent(b, b.pending.token, "leave");
      }
    }
    assert.deepEqual(a, b);
    assert.equal(seen.size, 8);
    assert.equal(eventScore(a), 0);
  }
});
test("seven-day training stops exactly on an encounter and cannot advance while a choice is pending", () => {
  const s = start(),
    single = start();
  let expected = 0;
  while (expected < 7 && !single.pending) {
    advanceTestDay(single, "martial");
    expected++;
  }
  assert.equal(advanceTestDays(s, "martial", 7), expected);
  assert.deepEqual(s, single);
  next(s);
  const before = structuredClone(s);
  assert.throws(() => advanceTestDay(s, "study"), /선택/);
  assert.equal(advanceTestDays(s, "study", 7), 0);
  assert.deepEqual(s, before);
  resolveTestEvent(s, s.pending.token, "leave");
  assert.ok(advanceTestDays(s, "study", 7) > 0);
});
test("requirements and costs are checked before mutation; resolution cannot be duplicated", () => {
  const s = start();
  const event = next(s);
  s.stats = Object.fromEntries(Object.keys(eventStatNames).map((k) => [k, 0]));
  s.money = 0;
  const blocked = event.choices.find((c) => c.id !== "leave");
  assert.equal(choiceAvailability(s, blocked).available, false);
  const before = structuredClone(s),
    token = s.pending.token;
  assert.throws(() => resolveTestEvent(s, token, blocked.id), /필요/);
  assert.deepEqual(s, before);
  assert.throws(() => resolveTestEvent(s, "stale", "leave"));
  assert.deepEqual(s, before);
  resolveTestEvent(s, token, "leave");
  const after = structuredClone(s);
  assert.throws(() => resolveTestEvent(s, token, "leave"));
  assert.deepEqual(s, after);
});
test("growth opens choices, contributions clamp per task, and dark bargains have actual costs", () => {
  const s = start();
  s.pending = { id: "demonic_courier", token: "test" };
  const encounter = eraEvents.find((e) => e.id === "demonic_courier");
  assert.equal(choiceAvailability(s, encounter.choices[0]).available, false);
  s.stats.force = 30;
  assert.equal(choiceAvailability(s, encounter.choices[0]).available, true);
  s.progress[0] = 24;
  resolveTestEvent(s, "test", "0");
  assert.equal(s.progress[0], 25);
  s.pending = { id: "demonic_courier", token: "dark" };
  s.stats.demonic = 15;
  s.progress[0] = 3;
  resolveTestEvent(s, "dark", "2");
  assert.equal(s.progress[0], 0);
  assert.equal(s.money, 32);
  assert.equal(s.stats.demonic, 20);
  assert.equal(s.corruption, 5);
  const poor = start();
  poor.pending = { id: "demonic_ledger", token: "cost" };
  poor.money = 8;
  resolveTestEvent(poor, "cost", "1");
  assert.equal(poor.money, 0);
  assert.equal(poor.progress[0], 4);
  assert.ok(eventScore(s) >= 0 && eventScore(s) <= 100);
});
test("activity gains are bounded and a last-day event must resolve before the era closes", () => {
  const stats = Object.fromEntries(
    Object.keys(eventStatNames).map((k) => [k, 100]),
  );
  const s = start("demonic", stats);
  advanceTestDay(s, "study");
  assert.equal(s.stats.wisdom, 100);
  assert.equal(s.stats.speech, 100);
  s.day = 7200;
  s.pending = { id: "demonic_courier", token: "end" };
  assert.equal(testEnded(s), false);
  resolveTestEvent(s, "end", "leave");
  assert.equal(testEnded(s), true);
  assert.equal(advanceTestDays(s, "study", 7), 0);
  assert.throws(() => advanceTestDay(s, "martial"), /끝/);
  assert.throws(() => start("demonic", { ...stats, force: 101 }), /0~100/);
  const before = structuredClone(start());
  const invalid = structuredClone(before);
  assert.throws(() => advanceTestDay(invalid, "unknown"));
  assert.deepEqual(invalid, before);
});

test("phase boundaries select the intended years and natural daily progression changes pools", () => {
  for (const [day, id] of [
    [0, "early"],
    [1799, "early"],
    [1800, "middle"],
    [4319, "middle"],
    [4320, "late"],
    [7199, "late"],
  ])
    assert.equal(eraStage(day).id, id);
  for (const type of ["demonic", "manual", "schism"]) {
    for (const stage of eraStages) {
      const s = start(type);
      s.day = stage.startDay;
      s.lastEventDay = s.day - 2;
      for (let i = 0; i < 200; i++) {
        advanceTestDay(s, "study");
        if (s.pending) {
          const e = eraEvents.find((e) => e.id === s.pending.id);
          assert.equal(e.stage, stage.id);
          assert.equal(e.type, type);
          resolveTestEvent(s, s.pending.token, "leave");
        }
      }
      assert.ok(s.encounters > 0);
    }
  }
  const s = start();
  s.day = 1799;
  advanceTestDay(s, "martial");
  assert.equal(eraStage(s.day).id, "middle");
});
test("phase variants change the story, raise major requirements and retain small free contributions", () => {
  for (const early of eraEvents.filter((e) => e.stage === "early")) {
    const middle = eraEvents.find(
      (e) => e.sceneId === early.sceneId && e.stage === "middle",
    );
    const late = eraEvents.find(
      (e) => e.sceneId === early.sceneId && e.stage === "late",
    );
    assert.notEqual(early.title, middle.title);
    assert.notEqual(middle.title, late.title);
    assert.notEqual(early.body, middle.body);
    assert.notEqual(middle.body, late.body);
    for (const c of early.choices.filter(
      (c) => Object.keys(c.requires).length,
    )) {
      const m = middle.choices.find((x) => x.id === c.id),
        l = late.choices.find((x) => x.id === c.id);
      for (const key of Object.keys(c.requires)) {
        assert.ok(
          c.requires[key] < m.requires[key] &&
            m.requires[key] < l.requires[key],
        );
        if (key !== "demonic") {
          assert.ok(c.requires[key] >= 15 && c.requires[key] <= 30);
          assert.ok(m.requires[key] >= 35 && m.requires[key] <= 60);
          assert.ok(l.requires[key] >= 65 && l.requires[key] <= 90);
        }
      }
    }
    const support = late.choices.find((c) => c.id === "support");
    assert.deepEqual(support.requires, {});
    assert.equal(support.effects.money, 0);
    assert.equal(support.effects.points, 1);
  }
});
test("phase jumps preserve stats and resources, replace pending encounters and invalidate old choices", () => {
  const s = start("demonic", {
    force: 45,
    wisdom: 45,
    speech: 45,
    inner: 45,
    demonic: 0,
  });
  s.progress = [3, 4, 5, 6];
  s.corruption = 7;
  const stats = structuredClone(s.stats),
    progress = [...s.progress],
    money = s.money;
  const unlocked = [];
  let priorToken;
  for (const stage of eraStages) {
    const e = jumpTestStage(s, stage.id);
    assert.equal(s.day, stage.startDay);
    assert.deepEqual(s.stats, stats);
    assert.deepEqual(s.progress, progress);
    assert.equal(s.money, money);
    assert.equal(s.corruption, 7);
    assert.equal(e.sceneId, "demonic_courier");
    unlocked.push(
      e.choices.filter((c) => choiceAvailability(s, c).available).length,
    );
    if (priorToken)
      assert.throws(() => resolveTestEvent(s, priorToken, "leave"));
    priorToken = s.pending.token;
  }
  assert.ok(unlocked[0] > unlocked[1] && unlocked[1] > unlocked[2]);
  resolveTestEvent(s, s.pending.token, "support");
  assert.equal(s.progress[0], 4);
  const before = structuredClone(s);
  assert.throws(() => jumpTestStage(s, "unknown"));
  assert.deepEqual(s, before);
});
