import { eraStage } from "./era-events.js";

export const testSects = {
  huashan: {
    name: "화산",
    rival: "청성",
    stat: "force",
    bonus: "무력",
    guide: "검술 수련 지원",
  },
  wudang: {
    name: "무당",
    rival: "공동",
    stat: "inner",
    bonus: "내공",
    guide: "심법 수련 지원",
  },
  shaolin: {
    name: "소림",
    rival: "아미",
    stat: "inner",
    bonus: "내공",
    guide: "기초 내공 수련 지원",
  },
};
export const discipleRanks = [
  { name: "외문제자", days: 0, contribution: 0, power: 0, trust: 0 },
  { name: "내문제자", days: 8, contribution: 12, power: 30, trust: 15 },
  { name: "핵심제자", days: 20, contribution: 40, power: 55, trust: 35 },
];
export function createTestSect(id) {
  if (id === null || id === "") return null;
  if (!testSects[id]) throw Error("문파를 선택해주세요.");
  return {
    id,
    rank: 0,
    contribution: 0,
    trust: 10,
    relation: 0,
    practiceDays: 0,
    serviceDays: 0,
    bonusUnits: 0,
    lastMissionDay: -3,
    missionSerial: 0,
  };
}
export function sectPromotion(state, ranks = discipleRanks) {
  const s = state.sect;
  if (!s) return { ready: false, missing: ["먼저 문파에 소속되어야 합니다."] };
  const next = ranks[s.rank + 1];
  if (!next) return { ready: false, missing: [], max: true };
  const power = state.stats[testSects[s.id].stat];
  const missing = [];
  if (s.practiceDays < next.days)
    missing.push("문파 수련 " + s.practiceDays + "/" + next.days + "일");
  if (s.contribution < next.contribution)
    missing.push("공헌 " + s.contribution + "/" + next.contribution);
  if (power < next.power)
    missing.push(testSects[s.id].bonus + " " + power + "/" + next.power);
  if (s.trust < next.trust) missing.push("신임 " + s.trust + "/" + next.trust);
  return { ready: !missing.length, missing, next };
}
export function promoteTestSect(state, ranks = discipleRanks) {
  if (state.pending) throw Error("먼저 진행 중인 사건을 마쳐주세요.");
  const status = sectPromotion(state, ranks);
  if (!status.ready)
    throw Error(
      status.max ? "최고 제자 등급입니다." : status.missing.join(" · "),
    );
  state.sect.rank++;
  return ranks[state.sect.rank].name;
}
export function trainTestSect(state, activity) {
  const s = state.sect;
  if (!s) return "";
  s.serviceDays++;
  if (activity !== "martial") return "";
  s.practiceDays++;
  s.bonusUnits += [3, 4, 6][s.rank];
  const gain = Math.floor(s.bonusUnits / 12);
  s.bonusUnits %= 12;
  const stat = testSects[s.id].stat,
    old = state.stats[stat];
  state.stats[stat] = Math.min(100, old + gain);
  return state.stats[stat] > old
    ? " · 문파 지원 " + testSects[s.id].bonus + " +" + (state.stats[stat] - old)
    : "";
}
export function missionReady(state) {
  return (
    !!state.sect &&
    !state.pending &&
    state.day < 7200 &&
    state.sect.serviceDays - state.sect.lastMissionDay >= 3
  );
}
const scenes = {
  demonic: [
    [
      "수상한 약재 수레",
      "경쟁 문파의 표식이 붙은 수레에서 마교의 약재가 발견됐다. 순찰 중인 당신에게 처리를 맡겼다.",
    ],
    [
      "밀수 의혹과 문파의 체면",
      "마교의 밀수에 두 문파가 연루됐다는 소문이 돈다. 내문제자로서 의혹을 조사하라는 명령을 받았다.",
    ],
    [
      "결전을 앞둔 연합 작전",
      "마교의 핵심 계획을 막으려면 경쟁 문파와 힘을 합쳐야 한다. 문파는 핵심제자인 당신에게 교섭을 맡겼다.",
    ],
  ],
  manual: [
    [
      "전승의 소문 수집",
      "경쟁 문파가 전승의 단서를 찾았다고 한다. 소문을 확인하고 문파에 보고하라는 임무다.",
    ],
    [
      "갈라진 기록의 소유권",
      "두 문파가 서로 다른 기록을 확보했다. 내문제자인 당신에게 회수와 조정을 맡겼다.",
    ],
    [
      "전승 공개를 둘러싼 협상",
      "전승의 진실을 밝히려면 양측 기록을 함께 확인해야 한다. 핵심제자인 당신이 문파를 대표한다.",
    ],
  ],
  schism: [
    [
      "경계 순찰의 시비",
      "경계 순찰 중 두 문파 제자들이 다투고 있다. 문파는 먼저 상황을 파악하라고 명했다.",
    ],
    [
      "문파 간 보복의 불씨",
      "경쟁 문파의 책임을 묻자는 강경파와 중재를 원하는 제자들이 맞선다. 내문제자인 당신에게 처리를 맡겼다.",
    ],
    [
      "회맹을 결정할 특사",
      "두 문파의 주력 병력이 대치한다. 문파는 핵심제자인 당신을 마지막 특사로 보냈다.",
    ],
  ],
};
export function requestSectMission(state) {
  if (!missionReady(state))
    throw Error(
      state.pending
        ? "먼저 진행 중인 사건을 마쳐주세요."
        : "문파 임무는 활동 3일 간격으로 받을 수 있습니다.",
    );
  const s = state.sect,
    type = state.draw.type.id,
    rank = s.rank,
    stage = eraStage(state.day);
  const offset = { early: 0, middle: 10, late: 20 }[stage.id];
  const threshold = Math.min(90, [20, 40, 65][rank] + offset);
  const diplomacy = s.relation <= -30 ? 10 : s.relation >= 30 ? -5 : 0;
  const slot =
    type === "demonic"
      ? [0, 1, 3][rank]
      : type === "manual"
        ? [0, 2, 3][rank]
        : [0, 1, 2][rank];
  const make = (
    id,
    label,
    requires,
    points,
    contribution,
    trust,
    relation,
    money = 0,
  ) => ({
    id,
    label,
    requires,
    effects: { slot, points, contribution, trust, relation, money, dark: 0 },
  });
  const event = {
    id: "sect_" + type + "_" + rank,
    mission: true,
    title: scenes[type][rank][0],
    body:
      testSects[s.id].name +
      " · " +
      discipleRanks[rank].name +
      " 임무\n" +
      scenes[type][rank][1] +
      " 상대 문파: " +
      testSects[s.id].rival +
      ".",
    choices: [
      make(
        "cooperate",
        "공동 조사로 시대의 위협에 대응한다",
        { wisdom: Math.min(95, threshold + 5 + diplomacy) },
        [6, 9, 13][rank],
        [6, 10, 16][rank],
        3,
        12,
      ),
      make(
        "pressure",
        "경쟁 문파를 압박해 우리 문파의 이익을 챙긴다",
        { [testSects[s.id].stat]: threshold },
        type === "schism" ? -[2, 4, 6][rank] : [2, 4, 6][rank],
        [8, 12, 18][rank],
        5,
        -15,
        [4, 6, 8][rank],
      ),
      make(
        "mediate",
        "양측의 체면을 살려 협력을 이끈다",
        { speech: Math.max(10, Math.min(95, threshold + diplomacy)) },
        [4, 7, 11][rank],
        [5, 9, 14][rank],
        2,
        8,
      ),
      make("support", "현장 정보를 정리해 피해를 줄인다", {}, 1, 2, 1, 2),
      make("decline", "문파의 명령을 거절한다", {}, 0, 0, -3, -2),
    ],
  };
  s.missionSerial++;
  s.lastMissionDay = s.serviceDays;
  state.pending = {
    id: event.id,
    event,
    token: "sect:" + state.jumpRevision + ":" + s.missionSerial,
  };
  state.encounters++;
  state.lastEventDay = state.day;
  return event;
}
export function applySectMission(state, choice) {
  const s = state.sect,
    e = choice.effects;
  s.contribution = Math.max(0, s.contribution + e.contribution);
  s.trust = Math.max(0, Math.min(100, s.trust + e.trust));
  s.relation = Math.max(-100, Math.min(100, s.relation + e.relation));
  return (
    " · 문파 공헌 +" +
    e.contribution +
    " · 신임 " +
    (e.trust >= 0 ? "+" : "") +
    e.trust +
    " · " +
    testSects[s.id].rival +
    " 관계 " +
    (e.relation >= 0 ? "+" : "") +
    e.relation
  );
}
