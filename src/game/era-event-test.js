import { drawEra, seededRandom } from "./era-draw.js";
import {
  eraEvents,
  eventStatNames,
  eraStages,
  eraStage,
} from "./era-events.js";

export const EVENT_RULES = {
  version: 2,
  chance: 0.35,
  minGap: 2,
  recentCount: 4,
};
export function startEventTest({ seed, typeId = "demonic", stats }) {
  const draw = drawEra({ seed, typeId });
  const values = stats || {
    force: 15,
    wisdom: 15,
    speech: 15,
    inner: 10,
    demonic: 0,
  };
  if (
    Object.keys(eventStatNames).some(
      (key) =>
        !Number.isInteger(values[key]) || values[key] < 0 || values[key] > 100,
    )
  )
    throw Error("능력치는 0~100의 정수로 입력해주세요.");
  return {
    version: 2,
    draw,
    stats: { ...values },
    day: 0,
    jumpRevision: 0,
    money: 20,
    corruption: 0,
    progress: [0, 0, 0, 0],
    pending: null,
    lastEventDay: -2,
    recent: [],
    log: [],
    encounters: 0,
    lastResult: null,
  };
}
export function eventScore(state) {
  return state.progress.reduce((sum, n) => sum + n, 0);
}
export function testEnded(state) {
  return (
    state.day >= state.draw.template.catalog.era.duration_years * 360 &&
    !state.pending
  );
}
function log(state, message) {
  state.log.unshift(message);
  state.log.splice(20);
}
export function advanceTestDay(state, activity) {
  if (state.pending) throw Error("먼저 사건의 선택을 마쳐주세요.");
  if (testEnded(state)) throw Error("시대의 시간이 끝났습니다.");
  if (!["martial", "study", "fortune"].includes(activity))
    throw Error("진행할 활동을 선택해주세요.");
  state.day++;
  let message;
  const gain = (key, value) => {
    const old = state.stats[key];
    state.stats[key] = Math.min(100, old + value);
    return state.stats[key] - old;
  };
  if (activity === "martial")
    message =
      "무공 수련 · 무력 +" + gain("force", 2) + ", 내공 +" + gain("inner", 1);
  if (activity === "study")
    message =
      "독서와 교류 · 지혜 +" +
      gain("wisdom", 2) +
      ", 처세 +" +
      gain("speech", 1);
  if (activity === "fortune") {
    const roll = seededRandom(
      "event-test-v1:" + state.draw.seed + ":" + state.day + ":fortune",
    )();
    message =
      roll < 0.25
        ? "기연 탐색 · 오래된 구결 발견, 내공 +" + gain("inner", 4)
        : "기연 탐색 · 오늘은 특별한 발견이 없었다.";
  }
  log(state, state.day + "일 · " + message);
  const roll = seededRandom(
    "event-test-v1:" + state.draw.seed + ":" + state.day + ":arrival",
  )();
  if (
    state.day - state.lastEventDay < EVENT_RULES.minGap ||
    roll >= EVENT_RULES.chance
  )
    return;
  const candidates = eraEvents.filter(
    (e) =>
      e.type === state.draw.type.id &&
      e.stage === eraStage(state.day).id &&
      !state.recent.includes(e.id),
  );
  const pick = seededRandom(
    "event-test-v1:" + state.draw.seed + ":" + state.day + ":pick",
  )();
  const selected = candidates[Math.floor(pick * candidates.length)];
  if (!selected) return;
  state.pending = {
    id: selected.id,
    token: state.jumpRevision + ":" + state.day + ":" + selected.id,
  };
  state.lastEventDay = state.day;
  state.recent.unshift(selected.id);
  state.recent.splice(EVENT_RULES.recentCount);
  state.encounters++;
  log(state, state.day + "일 · 사건 발생: " + selected.title);
}
// Sandbox-only shortcut: replace a scene for comparison, without simulating
// intervening days, training or rewards. Revision prevents stale choices replaying.
export function jumpTestStage(state, stageId) {
  const stage = eraStages.find((s) => s.id === stageId);
  if (!stage) throw Error("비교할 시기를 선택해주세요.");
  const current = eraEvents.find((e) => e.id === state.pending?.id);
  const family =
    current?.sceneId ||
    state.compareSceneId ||
    eraEvents.find((e) => e.type === state.draw.type.id).sceneId;
  const event = eraEvents.find(
    (e) =>
      e.type === state.draw.type.id &&
      e.stage === stage.id &&
      e.sceneId === family,
  );
  state.day = stage.startDay;
  state.jumpRevision++;
  state.compareSceneId = family;
  state.pending = {
    id: event.id,
    token: "preview:" + state.jumpRevision + ":" + event.id,
    preview: true,
  };
  state.recent = [event.id];
  state.lastEventDay = state.day;
  state.lastResult = null;
  state.encounters++;
  log(
    state,
    "시기 비교 · " +
      stage.name +
      " " +
      stage.years +
      " · " +
      event.title +
      " (성장·보상 없이 이동)",
  );
  return event;
}
export function advanceTestDays(state, activity, days = 1) {
  if (![1, 7].includes(days))
    throw Error("하루 또는 7일씩 진행할 수 있습니다.");
  let advanced = 0;
  while (advanced < days && !state.pending && !testEnded(state)) {
    advanceTestDay(state, activity);
    advanced++;
  }
  return advanced;
}
export function choiceAvailability(state, choice) {
  const missing = Object.entries(choice.requires)
    .filter(([key, min]) => state.stats[key] < min)
    .map(
      ([key, min]) =>
        eventStatNames[key] +
        " " +
        min +
        " 필요 (현재 " +
        state.stats[key] +
        ")",
    );
  if (choice.effects.money < 0 && state.money < -choice.effects.money)
    missing.push(
      "은전 " + -choice.effects.money + " 필요 (현재 " + state.money + ")",
    );
  return { available: missing.length === 0, missing };
}
export function resolveTestEvent(state, token, choiceId) {
  if (!state.pending || state.pending.token !== token)
    throw Error("이미 끝났거나 현재 사건이 아닙니다.");
  const event = eraEvents.find((e) => e.id === state.pending.id);
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) throw Error("선택지를 확인해주세요.");
  const allowed = choiceAvailability(state, choice);
  if (!allowed.available) throw Error(allowed.missing.join(" · "));
  const effects = choice.effects,
    old = state.progress[effects.slot];
  state.progress[effects.slot] = Math.max(
    0,
    Math.min(25, old + effects.points),
  );
  state.money += effects.money;
  state.stats.demonic = Math.min(100, state.stats.demonic + effects.dark);
  state.corruption = Math.min(100, state.corruption + effects.dark);
  const delta = state.progress[effects.slot] - old;
  const objective = state.draw.template.catalog.objectives[effects.slot];
  const summary =
    choice.id === "leave"
      ? "개입하지 않고 지나갔다."
      : objective.name +
        " " +
        (delta >= 0 ? "+" : "") +
        delta +
        "점" +
        (effects.money
          ? " · 은전 " + (effects.money > 0 ? "+" : "") + effects.money
          : "") +
        (effects.dark ? " · 마도·타락 +" + effects.dark : "");
  state.lastResult = { title: event.title, choice: choice.label, summary };
  log(state, state.day + "일 · " + choice.label + " → " + summary);
  state.pending = null;
  return state.lastResult;
}
