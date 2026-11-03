import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarDate,
  ensureCalendar,
  scheduleEvent,
  trainingBudget,
  planTraining,
  beginTraining,
  advanceTraining,
  cancelTraining,
} from "../src/game/time.js";
const fate = { stats: [40, 40, 40, 40], trait: "검심" },
  catalog = {
    sword: { category: "attack" },
    breath: { category: "mind" },
    bloodMind: { category: "mind", dark: true },
  };
const make = () => ({
  turn: 0,
  food: 1000,
  money: 5000,
  energy: 100,
  inner: 0,
  arts: {
    sword: { status: "learned", xp: 0 },
    breath: { status: "learned", xp: 0 },
    bloodMind: { status: "learned", xp: 0 },
  },
  trainingArt: "sword",
  activeMind: "breath",
  progress: { realm: 0 },
  alignment: { righteous: 0, black: 0, demonic: 0 },
});
function dependencies(j, events = []) {
  return {
    random: () => 0,
    onEvent: (e) => {
      events.push(e);
      j.pendingEvent = { id: e.id };
    },
    gainMartial: (id, n) => {
      const a = j.arts[id],
        gain = Math.min(n, 100 - a.xp);
      a.xp += gain;
      return gain;
    },
  };
}
function complete(j) {
  for (let i = 0; i < 30 && j.longTraining.status === "paused"; i++) {
    j.pendingEvent = null;
    const r = advanceTraining(j, dependencies(j));
    if (["energy", "resources", "erosion"].includes(r.reason))
      throw Error(r.reason);
  }
  return j.longTraining;
}
test("calendar uses half-days, 30-day months and 360-day years without migrating old time", () => {
  assert.deepEqual(calendarDate(0), {
    year: 1,
    month: 1,
    day: 1,
    period: "오전",
    elapsedDays: 0,
  });
  assert.equal(calendarDate(59).day, 30);
  assert.equal(calendarDate(60).month, 2);
  assert.equal(calendarDate(720).year, 2);
  const j = make();
  j.turn = 77;
  ensureCalendar(j);
  assert.equal(j.turn, 77);
});
test("an earlier scheduled event interrupts at the exact half-day, charging only elapsed nights", () => {
  const j = make(),
    events = [];
  scheduleEvent(j, { id: "appointment", turn: 5, type: "road" });
  beginTraining(j, planTraining(j, fate, catalog, "month", "art"), () => 0);
  const r = advanceTraining(j, dependencies(j, events));
  assert.equal(r.reason, "event");
  assert.equal(j.turn, 5);
  assert.equal(j.longTraining.completedTurns, 5);
  assert.deepEqual(j.longTraining.spent, { money: 2, food: 2 });
  assert.equal(events[0].id, "appointment");
  assert.equal(j.arts.sword.xp, Math.floor((j.longTraining.rates.xp * 5) / 60));
  assert.equal(advanceTraining(j, dependencies(j)).advanced, 0);
});
test("resuming a month neither duplicates growth nor charges the remaining month at each resume", () => {
  const j = make();
  beginTraining(j, planTraining(j, fate, catalog, "month", "mind"), () => 0);
  const done = complete(j);
  assert.equal(done.status, "completed");
  assert.equal(j.turn, 60);
  assert.equal(j.inner, done.rates.inner);
  assert.equal(j.arts.breath.xp, done.rates.xp);
  assert.deepEqual(done.spent, { money: 30, food: 30 });
  const before = structuredClone(j);
  advanceTraining(j, dependencies(j));
  assert.deepEqual(j, before);
});
test("resource shortages preserve partial progress and retries spend nothing until affordable", () => {
  const j = make();
  j.money = 1;
  j.food = 0;
  beginTraining(j, planTraining(j, fate, catalog, "month", "mind"), () => 0);
  assert.equal(advanceTraining(j, dependencies(j)).reason, "resources");
  assert.equal(j.turn, 1);
  assert.equal(j.money, 1);
  const before = structuredClone(j);
  assert.equal(advanceTraining(j, dependencies(j)).advanced, 0);
  assert.deepEqual(j, before);
  j.money = 500;
  complete(j);
  assert.equal(j.turn, 60);
  assert.deepEqual(j.longTraining.spent, { money: 90, food: 0 });
});
test("cancel keeps earned progress and unrelated scheduled appointments", () => {
  const j = make();
  scheduleEvent(j, { id: "story", turn: 2000, type: "road" });
  beginTraining(j, planTraining(j, fate, catalog, "month", "mind"), () => 0);
  advanceTraining(j, dependencies(j));
  const earned = j.inner,
    turn = j.turn;
  assert.ok(cancelTraining(j));
  assert.equal(j.inner, earned);
  assert.equal(j.turn, turn);
  assert.deepEqual(
    j.calendar.scheduledEvents.map((e) => e.id),
    ["story"],
  );
  assert.equal(advanceTraining(j, dependencies(j)).advanced, 0);
});
test("a year of mind cultivation continues after mastery caps, while attack training ends early", () => {
  const j = make();
  j.arts.breath.xp = 100;
  beginTraining(j, planTraining(j, fate, catalog, "year", "mind"), () => 0);
  const result = complete(j);
  assert.equal(j.turn, 720);
  assert.equal(j.inner, result.rates.inner * 12);
  assert.equal(j.arts.breath.xp, 100);
  const a = make();
  a.arts.sword.xp = 99;
  beginTraining(a, planTraining(a, fate, catalog, "year", "art"), () => 0);
  complete(a);
  assert.equal(a.longTraining.reason, "mastered");
  assert.ok(a.turn < 720);
});
test("dark cultivation pauses when erosion enters a worse stage and does not remove choices", () => {
  const j = make();
  j.activeMind = "bloodMind";
  j.darkness = {
    erosion: 29,
    accepted: 1,
    losses: 0,
    nextOfferTurn: 0,
    offer: null,
    history: [],
  };
  beginTraining(j, planTraining(j, fate, catalog, "month", "mind"), () => 0);
  assert.equal(advanceTraining(j, dependencies(j)).reason, "erosion");
  assert.equal(j.darkness.erosion, 30);
  assert.equal(j.longTraining.status, "paused");
  assert.equal(j.pendingEvent, undefined);
});
test("starting in the afternoon budgets all crossed nights and due events at completion are not skipped", () => {
  const j = make();
  j.turn = 1;
  assert.equal(trainingBudget(j, 60).nights, 30);
  beginTraining(j, planTraining(j, fate, catalog, "month", "mind"), () => 0);
  const task = j.longTraining;
  j.calendar.scheduledEvents = j.calendar.scheduledEvents.filter(
    (e) => e.source !== task.id,
  );
  scheduleEvent(j, { id: "final", turn: 61, type: "road", source: task.id });
  const r = advanceTraining(j, dependencies(j));
  assert.equal(r.reason, "completed_event");
  assert.equal(j.longTraining.status, "completed");
  assert.ok(j.pendingEvent);
  assert.equal(j.turn, 61);
});
