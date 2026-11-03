import { darkArts, ensureDarkness, erosionEffects } from "./darkness.js";

export const TURNS_PER_DAY = 2;
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 360;
export const trainingModes = {
  month: { name: "집중 수련", days: 30, intervalMin: 10, intervalMax: 20 },
  year: { name: "폐관 수련", days: 360, intervalMin: 60, intervalMax: 100 },
};
export function calendarDate(turn) {
  const day = Math.floor(Math.max(0, turn) / 2);
  return {
    year: Math.floor(day / 360) + 1,
    month: Math.floor((day % 360) / 30) + 1,
    day: (day % 30) + 1,
    period: turn % 2 ? "오후" : "오전",
    elapsedDays: day,
  };
}
export function formatDate(turn) {
  const d = calendarDate(turn);
  return `강호력 ${d.year}년 ${d.month}월 ${d.day}일 · ${d.period}`;
}
export function formatDuration(turns) {
  const days = Math.floor(turns / 2),
    months = Math.floor(days / 30),
    remaining = days % 30;
  return (
    [
      months ? `${months}개월` : "",
      remaining ? `${remaining}일` : "",
      turns % 2 ? "반나절" : "",
    ]
      .filter(Boolean)
      .join(" ") || "0일"
  );
}
export function ensureCalendar(j) {
  j.calendar ??= { version: 1, scheduledEvents: [] };
  j.calendar.scheduledEvents ??= [];
  j.calendar.scheduledEvents.sort((a, b) => a.turn - b.turn);
  return j.calendar;
}
export function scheduleEvent(j, event) {
  const c = ensureCalendar(j);
  if (!Number.isSafeInteger(event.turn) || event.turn < 0 || !event.id)
    throw Error("사건의 날짜와 식별자가 필요합니다.");
  if (c.scheduledEvents.some((e) => e.id === event.id)) return false;
  c.scheduledEvents.push({ ...event });
  c.scheduledEvents.sort((a, b) => a.turn - b.turn);
  return true;
}
export function dispatchDueEvent(j, onEvent) {
  const c = ensureCalendar(j);
  if (
    j.pendingEvent ||
    !c.scheduledEvents.length ||
    c.scheduledEvents[0].turn > j.turn
  )
    return false;
  const event = c.scheduledEvents.shift();
  if (j.longTraining && event.source === j.longTraining.id)
    j.longTraining.nextEventTurn = null;
  onEvent(event);
  return true;
}
export function trainingRates(fate, artId, catalog) {
  const art = catalog[artId],
    mind = art?.category === "mind";
  const aptitude = mind
    ? fate.stats[1]
    : art?.category === "body"
      ? fate.stats[0]
      : art?.category === "move"
        ? fate.stats[3]
        : (fate.stats[0] + fate.stats[1]) / 2;
  return {
    xp: 12 + Math.floor(aptitude / 8) + (fate.trait === "천무지체" ? 2 : 0),
    inner: mind
      ? 6 +
        Math.floor(fate.stats[2] / 10) +
        (artId === "wudangMind" || artId === "qingxu"
          ? 2
          : ["huashanMind", "shaolinMind"].includes(artId)
            ? 1
            : 0) +
        (fate.trait === "명경지수" ? 1 : 0) +
        (darkArts[artId] ? (artId === "bloodMind" ? 18 : 12) : 0)
      : 0,
    erosion: darkArts[artId] ? (mind ? (artId === "bloodMind" ? 8 : 6) : 4) : 0,
    demonic: darkArts[artId] ? 1 : 0,
  };
}
export function trainingBudget(j, turns) {
  const nights = Math.floor((j.turn + turns) / 2) - Math.floor(j.turn / 2);
  const food = Math.min(j.food, nights),
    money = nights + Math.max(0, nights - food) * 2;
  return { nights, food, money, sufficient: j.money >= money };
}
export function planTraining(j, fate, catalog, mode, focus) {
  if (!["art", "mind"].includes(focus))
    throw Error("수련 대상을 선택해주세요.");
  if (!trainingModes[mode]) throw Error("수련 기간을 선택해주세요.");
  const art = focus === "mind" ? j.activeMind : j.trainingArt;
  if (!art || j.arts[art]?.status !== "learned" || !catalog[art])
    throw Error(
      focus === "mind"
        ? "심법을 배우고 운용해주세요."
        : "수련할 무공을 배우고 선택해주세요.",
    );
  if (catalog[art].category !== "mind" && j.arts[art].xp >= 100)
    throw Error("이미 대성한 무공입니다. 다른 무공을 선택해주세요.");
  return {
    mode,
    focus,
    art,
    rates: trainingRates(fate, art, catalog),
    totalTurns: trainingModes[mode].days * 2,
  };
}
function setNextEncounter(j, task, random) {
  const c = ensureCalendar(j);
  if (c.scheduledEvents.some((e) => e.source === task.id)) return;
  const mode = trainingModes[task.mode],
    turn =
      j.turn +
      (mode.intervalMin + random(mode.intervalMax - mode.intervalMin + 1)) * 2;
  task.nextEventTurn = turn;
  scheduleEvent(j, {
    id: crypto.randomUUID(),
    turn,
    type: "road",
    source: task.id,
  });
}
export function beginTraining(j, plan, random) {
  if (j.longTraining?.status === "paused")
    throw Error("진행하던 수련을 계속하거나 종료해주세요.");
  if (j.energy < 8)
    throw Error("장기 수련을 시작하려면 기력 8 이상이 필요합니다.");
  const task = {
    ...structuredClone(plan),
    id: crypto.randomUUID(),
    startedTurn: j.turn,
    completedTurns: 0,
    status: "paused",
    reason: "ready",
    earned: { xp: 0, inner: 0, erosion: 0, demonic: 0 },
    spent: { money: 0, food: 0 },
    credited: { xp: 0, inner: 0, erosion: 0, demonic: 0 },
  };
  j.longTraining = task;
  setNextEncounter(j, task, random);
  return task;
}
export function cancelTraining(j) {
  const task = j.longTraining;
  if (task?.status !== "paused") return false;
  task.status = "cancelled";
  task.reason = "cancelled";
  ensureCalendar(j).scheduledEvents = ensureCalendar(j).scheduledEvents.filter(
    (e) => e.source !== task.id,
  );
  return true;
}
export function advanceTraining(j, { random, onEvent, gainMartial }) {
  const task = j.longTraining;
  if (!task || task.status !== "paused")
    return { advanced: 0, reason: task?.status || "none" };
  if (j.pendingEvent) return { advanced: 0, reason: "event" };
  if (j.progress?.battle?.status === "active" || j.progress?.drill)
    return { advanced: 0, reason: "busy" };
  if (j.arts[task.art]?.status !== "learned")
    return { advanced: 0, reason: "missingArt" };
  const from = task.completedTurns,
    startTurn = j.turn;
  const pause = (reason) => {
    task.reason = reason;
    return { advanced: task.completedTurns - from, reason, startTurn };
  };
  if (dispatchDueEvent(j, onEvent)) return pause("event");
  setNextEncounter(j, task, random);
  while (task.completedTurns < task.totalTurns) {
    if (j.arts[task.art].xp >= 100 && task.rates.inner === 0) {
      task.status = "completed";
      return finish("mastered");
    }
    if (j.energy < 4) return pause("energy");
    const night = (j.turn + 1) % 2 === 0;
    const food = night && j.food > 0 ? 1 : 0,
      money = night ? 1 + (food ? 0 : 2) : 0;
    if (j.money < money) return pause("resources");
    const erosionBefore = erosionEffects(ensureDarkness(j).erosion).stage;
    j.energy -= 4;
    j.food -= food;
    j.money -= money;
    task.spent.food += food;
    task.spent.money += money;
    j.turn++;
    task.completedTurns++;
    for (const key of ["xp", "inner", "erosion", "demonic"]) {
      const cumulative = Math.floor(
          (task.rates[key] * task.completedTurns) / 60,
        ),
        amount = cumulative - task.credited[key];
      task.credited[key] = cumulative;
      if (!amount) continue;
      if (key === "xp") {
        const beforeInner = j.inner;
        task.earned.xp += gainMartial(task.art, amount);
        task.earned.inner += j.inner - beforeInner;
      } else if (key === "inner") {
        j.inner += amount;
        task.earned.inner += amount;
      } else if (key === "erosion") {
        const d = ensureDarkness(j),
          before = d.erosion;
        d.erosion = Math.min(100, d.erosion + amount);
        task.earned.erosion += d.erosion - before;
      } else {
        j.alignment ??= { righteous: 0, black: 0, demonic: 0 };
        const before = j.alignment.demonic || 0;
        j.alignment.demonic = Math.min(100, before + amount);
        task.earned.demonic += j.alignment.demonic - before;
      }
    }
    if (night)
      j.energy = Math.min(
        100,
        j.energy +
          Math.max(
            0,
            10 - erosionEffects(ensureDarkness(j).erosion).restPenalty,
          ),
      );
    const interrupted = dispatchDueEvent(j, onEvent);
    if (task.completedTurns === task.totalTurns) {
      task.status = "completed";
      return finish(interrupted ? "completed_event" : "completed");
    }
    if (interrupted) return pause("event");
    if (erosionEffects(ensureDarkness(j).erosion).stage > erosionBefore)
      return pause("erosion");
  }
  task.status = "completed";
  return finish("completed");
  function finish(reason) {
    ensureCalendar(j).scheduledEvents = ensureCalendar(
      j,
    ).scheduledEvents.filter((e) => e.source !== task.id);
    task.reason = reason;
    return { advanced: task.completedTurns - from, reason, startTurn };
  }
}
