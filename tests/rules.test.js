import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAW_RULES,
  roadEvents,
  alignments,
  encounterTypes,
} from "../src/game/data.js";
import {
  generate,
  valid,
  statFromTicket,
  kindFromTicket,
} from "../src/game/rules.js";
import { loadSave, saveGame, SAVE_KEY } from "../src/game/storage.js";

test("all 100 tickets map to the advertised stat band", () => {
  assert.equal(
    DRAW_RULES.bands.reduce((sum, band) => sum + band.weight, 0),
    100,
  );
  let ticket = 0;
  for (const band of DRAW_RULES.bands) {
    for (let i = 0; i < band.weight; i++, ticket++) {
      const value = statFromTicket(ticket);
      assert.ok(value >= band.min && value <= band.max);
    }
  }
});

test("generated characters are valid and malformed stats are rejected", () => {
  for (let i = 0; i < 100; i++) assert.ok(valid(generate()));
  const fate = generate();
  assert.ok(!valid({ ...fate, stats: [101, 50, 50, 50] }));
  assert.ok(!valid({ ...fate, stats: [50, 50, 50] }));
  assert.ok(!valid({ ...fate, origin: -1 }));
});

test("starting encounters have exactly 10/20/70 ticket distribution", () => {
  const counts = { major: 0, minor: 0, ordinary: 0 };
  for (let ticket = 0; ticket < 100; ticket++) counts[kindFromTicket(ticket)]++;
  assert.deepEqual(counts, { major: 10, minor: 20, ordinary: 70 });
  for (const kind of Object.keys(counts))
    assert.ok(encounterTypes[kind].variants.length);
});

test("road events have unique ids, valid alignments and a resource-free escape", () => {
  assert.equal(
    new Set(roadEvents.map((event) => event.id)).size,
    roadEvents.length,
  );
  for (const event of roadEvents) {
    assert.ok(
      event.choices.some((choice) =>
        ["money", "food", "energy"].every((key) => !(choice[key] < 0)),
      ),
      event.id,
    );
    for (const choice of event.choices) {
      for (const key of Object.keys(choice.delta))
        assert.ok(alignments[key], key);
    }
  }
});

test("save roundtrip keeps the legacy key and corrupt JSON can recover", () => {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const state = { current: generate(), drawsUsed: 3 };
  saveGame(state, storage);
  assert.deepEqual(loadSave(storage), state);
  entries.set(SAVE_KEY, "{broken");
  assert.equal(loadSave(storage), null);
  assert.throws(() =>
    saveGame(state, {
      setItem() {
        throw Error("quota");
      },
    }),
  );
});
