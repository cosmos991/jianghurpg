import { seededRandom, normalizeSeed } from "./era-draw.js";
import { eraEvents, eraStage, eventStatNames } from "./era-events.js";
import {
  testSects,
  createTestSect,
  discipleRanks,
  sectPromotion,
  promoteTestSect,
  requestSectMission,
} from "./sect-test.js";
import {
  startEventTest,
  resolveTestEvent,
  choiceAvailability,
} from "./era-event-test.js";
export const GROWTH_CAREER_RANKS = discipleRanks.map((rank, i) => ({
  ...rank,
  days: [0, 360, 1200][i],
  contribution: [0, 120, 600][i],
}));

export const GROWTH_DEFAULTS = Object.freeze({
  version: 1,
  trainingDays: 60,
  sectBonus: 20,
  fortuneChance: 0.5,
  fortuneGain: 1,
  trainingCost: 1,
  fortuneCost: 1,
  workIncome: 4,
  startingMoney: 100,
  cap: 100,
  missionInterval: 90,
  missionOuterDays: 3,
  missionInnerDays: 5,
  missionCoreDays: 7,
  missionCost: 1,
});
export function validateGrowthInput(input) {
  const c = { ...GROWTH_DEFAULTS, ...input.rules };
  const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  normalizeSeed(input.seed);
  if (!["fixed", "career", "training"].includes(input.sectMode || "fixed"))
    throw Error("문파 비교 모드를 선택해주세요.");
  if (!["merit", "era"].includes(input.missionPolicy || "merit"))
    throw Error("임무 방침을 선택해주세요.");
  for (const key of ["missionOuterDays", "missionInnerDays", "missionCoreDays"])
    if (!integer(c[key], 1, 7200))
      throw Error("임무 간격·기간은 1~7,200일의 정수여야 합니다.");
  if (!integer(c.missionInterval, 4, 7200))
    throw Error("임무 간격은 4~7,200일이어야 합니다.");
  if (!integer(c.missionCost, 0, 10000))
    throw Error("임무 비용은 0~10,000의 정수여야 합니다.");

  if (!Object.hasOwn(eventStatNames, input.focus) || input.focus === "demonic")
    throw Error("수련할 능력치를 선택해주세요.");
  if (!["demonic", "manual", "schism"].includes(input.typeId))
    throw Error("시대 유형을 선택해주세요.");
  if (!integer(input.start, 0, 100))
    throw Error("시작 능력치는 0~100의 정수여야 합니다.");
  if (
    !integer(input.training, 0, 100) ||
    !integer(input.fortune, 0, 100) ||
    input.training + input.fortune > 100
  )
    throw Error("수련·기연 비율은 정수이며 합계가 100% 이하여야 합니다.");
  if (
    !integer(c.trainingDays, 1, 7200) ||
    !integer(c.sectBonus, 0, 100) ||
    !Number.isFinite(c.fortuneChance) ||
    c.fortuneChance < 0 ||
    c.fortuneChance > 100 ||
    !integer(c.fortuneGain, 0, 10)
  )
    throw Error("성장 설정 범위를 확인해주세요.");
  for (const key of [
    "trainingCost",
    "fortuneCost",
    "workIncome",
    "startingMoney",
  ])
    if (!integer(c[key], 0, 10000))
      throw Error("비용·수입 설정은 0~10,000의 정수여야 합니다.");
  if (c.cap !== 100 || c.version !== 1)
    throw Error("지원하지 않는 성장 규칙입니다.");
  return c;
}
export function majorChoiceAccess(stats, money, typeId, stageId) {
  const choices = eraEvents
    .filter((e) => e.type === typeId && e.stage === stageId)
    .flatMap((e) => e.choices)
    .filter((c) => Object.keys(c.requires).some((k) => k !== "demonic"));
  const open = choices.filter(
    (c) =>
      Object.entries(c.requires).every(([k, v]) => stats[k] >= v) &&
      money >= Math.max(0, -c.effects.money),
  ).length;
  return {
    open,
    total: choices.length,
    percent: choices.length ? (open / choices.length) * 100 : 0,
  };
}
export function simulateGrowth(input, sectId = null) {
  const rules = validateGrowthInput(input),
    seed = normalizeSeed(input.seed);
  if (sectId !== null && !Object.hasOwn(testSects, sectId))
    throw Error("비교할 문파를 확인해주세요.");
  const weights = {
    training: input.training,
    fortune: input.fortune,
    work: 100 - input.training - input.fortune,
  };
  const planned = { training: 0, fortune: 0, work: 0 },
    actual = { training: 0, fortune: 0, work: 0 };
  const stats = { force: 15, wisdom: 15, speech: 15, inner: 10, demonic: 0 };
  stats[input.focus] = input.start;
  let money = rules.startingMoney,
    credit = 0,
    forcedWork = 0,
    fortunes = 0,
    cappedDay = input.start >= 100 ? 0 : null;
  const reached = {
    30: input.start >= 30 ? 0 : null,
    60: input.start >= 60 ? 0 : null,
    90: input.start >= 90 ? 0 : null,
  };
  const mode = input.sectMode || "fixed";
  const context = startEventTest({ seed, typeId: input.typeId, stats, sectId });
  // Shares actual stats and resources with the mission resolver; no fast sandbox gains.
  context.stats = stats;
  context.money = money;
  const promotions = [],
    series = [],
    missionLog = [];
  let activeMission = null,
    missionsCompleted = 0,
    missionDays = 0,
    missionSpent = 0,
    lastMissionEnd = 0;
  const checkpoints = [],
    bonus =
      sectId && testSects[sectId].stat === input.focus ? rules.sectBonus : 0;
  for (let day = 1; day <= 7200; day++) {
    // Deficit scheduling spreads activities through time; each 100 days honors the plan.
    const available = Object.keys(weights).filter((k) => weights[k] > 0);
    const chosen = available.reduce(
      (best, k) =>
        (day * weights[k]) / 100 - planned[k] >
        (day * weights[best]) / 100 - planned[best]
          ? k
          : best,
      available[0],
    );
    planned[chosen]++;
    let activity = chosen;
    const cost =
      chosen === "training"
        ? rules.trainingCost
        : chosen === "fortune"
          ? rules.fortuneCost
          : 0;
    if (activity !== "work" && money < cost) {
      activity = "work";
    }
    if (sectId && mode === "career") {
      context.day = day - 1;
      context.sect.serviceDays = day - 1;
      if (
        !activeMission &&
        chosen === "training" &&
        day - lastMissionEnd >= rules.missionInterval &&
        money >= rules.missionCost
      ) {
        context.money = money;
        const event = requestSectMission(context);
        const preference =
          (input.missionPolicy || "merit") === "merit"
            ? ["pressure", "cooperate", "mediate", "support"]
            : ["cooperate", "mediate", "support"];
        const choice = preference
          .map((id) => event.choices.find((c) => c.id === id))
          .find((c) => choiceAvailability(context, c).available);
        activeMission = {
          remaining: [
            rules.missionOuterDays,
            rules.missionInnerDays,
            rules.missionCoreDays,
          ][context.sect.rank],
          choiceId: choice.id,
          title: event.title,
        };
      }
      if (activeMission && chosen !== "work") {
        if (money >= rules.missionCost) activity = "mission";
        else {
          activity = "work";
        }
      }
    }
    if (activity === "work" && chosen !== "work") forcedWork++;
    if (activity === "mission") {
      money -= rules.missionCost;
      missionSpent += rules.missionCost;
      missionDays++;
      activeMission.remaining--;
      if (activeMission.remaining === 0) {
        context.day = day;
        context.money = money;
        const completed = resolveTestEvent(
          context,
          context.pending.token,
          activeMission.choiceId,
        );
        money = context.money;
        missionsCompleted++;
        lastMissionEnd = day;
        missionLog.unshift({
          day,
          choice: activeMission.choiceId,
          ...completed,
        });
        missionLog.splice(12);
        activeMission = null;
      }
    } else {
      actual[activity]++;
      if (activity === "work") money += rules.workIncome;
      else money -= cost;
      if (activity === "training") {
        credit +=
          10000 +
          (mode === "fixed"
            ? bonus * 100
            : bonus * [25, 60, 100][context.sect?.rank || 0]);
        const gained = Math.floor(credit / (rules.trainingDays * 10000));
        credit %= rules.trainingDays * 10000;
        stats[input.focus] = Math.min(100, stats[input.focus] + gained);
      }
      if (
        activity === "fortune" &&
        seededRandom("growth-v1:" + seed + ":" + day)() * 100 <
          rules.fortuneChance
      ) {
        fortunes++;
        stats[input.focus] = Math.min(
          100,
          stats[input.focus] + rules.fortuneGain,
        );
      }
    }
    if (sectId && mode !== "fixed") {
      if (activity === "training") context.sect.practiceDays++;
      context.day = day;
      if (
        !context.pending &&
        sectPromotion(context, GROWTH_CAREER_RANKS).ready
      ) {
        const name = promoteTestSect(context, GROWTH_CAREER_RANKS);
        promotions.push({
          day,
          name,
          rank: context.sect.rank,
          practiceDays: context.sect.practiceDays,
          contribution: context.sect.contribution,
          trust: context.sect.trust,
          power: stats[testSects[sectId].stat],
        });
      }
    }
    series.push(stats[input.focus]);
    for (const target of [30, 60, 90])
      if (reached[target] === null && stats[input.focus] >= target)
        reached[target] = day;
    if (cappedDay === null && stats[input.focus] >= 100) cappedDay = day;
    if ([1800, 4320, 7200].includes(day)) {
      const stage = eraStage(day - 1);
      checkpoints.push({
        year: day / 360,
        day,
        stage: stage.name,
        stats: { ...stats },
        money,
        actual: { ...actual },
        forcedWork,
        fortunes,
        rank: mode === "fixed" ? null : (context.sect?.rank ?? null),
        missionScore: context.progress.reduce((s, n) => s + n, 0),
        access: majorChoiceAccess(stats, money, input.typeId, stage.id),
      });
    }
  }
  return {
    sectId,
    name: sectId ? testSects[sectId].name : "무소속",
    bonus,
    stats,
    money,
    actual,
    planned,
    forcedWork,
    fortunes,
    reached,
    cappedDay,
    checkpoints,
    mode,
    series,
    promotions,
    career:
      sectId && mode !== "fixed"
        ? {
            ...context.sect,
            nextPromotion: sectPromotion(context, GROWTH_CAREER_RANKS),
          }
        : null,
    missions: {
      completed: missionsCompleted,
      days: missionDays,
      spent: missionSpent,
      pendingDays: activeMission?.remaining || 0,
      progress: [...context.progress],
      score: context.progress.reduce((s, n) => s + n, 0),
      log: missionLog,
    },
  };
}
export function compareGrowth(input) {
  validateGrowthInput(input);
  return {
    version: 1,
    input: structuredClone(input),
    runs: [null, ...Object.keys(testSects)].map((id) => {
      const run = simulateGrowth(input, id);
      if (id && input.sectMode === "career") {
        const control = simulateGrowth({ ...input, sectMode: "training" }, id);
        const lead = run.series.findIndex(
          (value, i) => value > control.series[i],
        );
        run.control = {
          final: control.stats[input.focus],
          difference: run.stats[input.focus] - control.stats[input.focus],
          firstLeadDay: lead < 0 ? null : lead + 1,
          trainingDays: control.actual.training,
        };
      }
      return run;
    }),
  };
}
