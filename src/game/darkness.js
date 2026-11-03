// Demonic alignment describes choices. Erosion describes the cost of forbidden power.
export const darkSects = {
  bloodmoon: {
    name: "혈월교",
    mark: "血",
    dark: true,
    style: "혈기 · 빠른 내공 성장과 육체 침식",
    art: "bloodPalm",
    mind: "bloodMind",
    exam: "혈기 입문 의식",
    story:
      "교관이 봉인된 혈기를 내밉니다. “필요한 만큼만 취할 것인가, 지금의 한계를 부술 것인가?” 사람을 해치지 않아도 입교할 수 있지만, 힘의 대가는 피할 수 없습니다.",
    choices: [
      "봉인을 지키고 배운 힘부터 다스린다",
      "안전한 운기법을 물으며 동료와 함께 익힌다",
      "대가를 듣고 봉인을 더 열어 힘을 받아들인다",
    ],
    results: [
      "교관은 힘을 절제하는 태도를 기억합니다.",
      "함께 입교한 동료와 기운을 다스릴 방법을 약속했습니다.",
      "봉인의 혈기를 더 받아들였습니다. 내공량 +12 · 침식 +10 · 마도 +6.",
    ],
  },
  blacklotus: {
    name: "흑련문",
    mark: "蓮",
    dark: true,
    style: "금기 초식 · 강한 일격과 정신 침식",
    art: "lotusBlade",
    mind: "lotusMind",
    exam: "흑련 입문 의식",
    story:
      "문주는 상대의 빈틈을 꿰뚫는 금기 구결을 보여줍니다. 마지막 장에는 자신의 정신을 날카롭게 벼리는 위험한 운기가 적혀 있습니다.",
    choices: [
      "기초 구결만 익히고 마지막 장은 덮는다",
      "동료와 서로의 이상 징후를 살피며 익힌다",
      "위험을 이해하고 마지막 장까지 받아들인다",
    ],
    results: [
      "문주는 선을 정한 당신에게 기초 전승을 맡겼습니다.",
      "동료와 서로의 정신을 살피기로 약속했습니다.",
      "금기 구결이 깊이 새겨졌습니다. 내공량 +12 · 침식 +10 · 마도 +6.",
    ],
  },
};
export const darkArts = {
  forbiddenBreath: {
    name: "역맥토납법",
    category: "mind",
    rank: "금기",
    dark: true,
    desc: "기맥의 흐름을 거슬러 적은 자질로도 내공을 빠르게 쌓습니다.",
    effect: "운기·호흡 수련 내공량 +5 · 사용마다 침식 +4, 마도 +1.",
  },
  bloodPalm: {
    name: "혈월장",
    category: "attack",
    rank: "마공",
    dark: true,
    desc: "혈기를 실어 일격의 위력을 높이는 혈월교의 입문 장법.",
    effect: "무공 초식 위력 2.2배 · 수련·초식 사용마다 침식 +2, 마도 +1.",
  },
  bloodMind: {
    name: "혈해심공",
    category: "mind",
    rank: "마공",
    dark: true,
    desc: "혈기의 파동으로 내공을 빠르게 축적하는 심법.",
    effect: "운기·호흡 수련 내공량 +7 · 사용마다 침식 +5, 마도 +1.",
  },
  lotusBlade: {
    name: "흑련도결",
    category: "attack",
    rank: "마공",
    dark: true,
    desc: "정신을 날카롭게 벼려 빈틈을 가르는 금기 도법.",
    effect: "무공 초식 위력 2.2배 · 수련·초식 사용마다 침식 +2, 마도 +1.",
  },
  lotusMind: {
    name: "흑련명심공",
    category: "mind",
    rank: "마공",
    dark: true,
    desc: "고요 속의 집착으로 내공을 빠르게 쌓는 심법.",
    effect: "운기·호흡 수련 내공량 +5 · 사용마다 침식 +4, 마도 +1.",
  },
};
export const temptationTiers = [
  {
    min: 0,
    name: "금기 구결의 속삭임",
    inner: 8,
    erosion: 6,
    demonic: 6,
    energy: 4,
    words: "수련이 더딘가? 이 구결 한 줄이면 오늘 밤 달라질 수 있다.",
  },
  {
    min: 20,
    name: "봉인된 혈기의 제안",
    inner: 20,
    erosion: 12,
    demonic: 10,
    energy: 8,
    words: "이제 기운을 알아보는군. 봉인 하나를 열면 더 큰 힘이 네 것이 된다.",
  },
  {
    min: 45,
    name: "심연의 전승",
    inner: 40,
    erosion: 22,
    demonic: 15,
    energy: 12,
    words: "작은 구결로 만족할 셈인가? 네 안의 갈망을 채울 전승을 받아라.",
  },
  {
    min: 70,
    name: "금단의 개방",
    inner: 70,
    erosion: 35,
    demonic: 20,
    energy: 16,
    words: "문 너머의 힘은 이미 너를 부른다. 무엇을 감수할지는 네가 정해라.",
  },
];
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
export function ensureDarkness(j) {
  j.darkness ??= {
    erosion: 0,
    accepted: 0,
    losses: 0,
    nextOfferTurn: 0,
    offer: null,
    history: [],
  };
  j.darkness.erosion = clamp(j.darkness.erosion);
  return j.darkness;
}
export function temptationTier(demonic) {
  return (
    temptationTiers.findLast((tier) => demonic >= tier.min) ||
    temptationTiers[0]
  );
}
export function erosionEffects(erosion) {
  const stage = erosion >= 85 ? 3 : erosion >= 60 ? 2 : erosion >= 30 ? 1 : 0;
  return {
    stage,
    label: ["기운 안정", "기맥 불안", "침식 심화", "주화입마의 문턱"][stage],
    hpPenalty: [0, 8, 20, 35][stage],
    restPenalty: [0, 5, 10, 15][stage],
    backlash: [0, 2, 5, 9][stage],
  };
}
export function updateTemptation(j, fate) {
  const d = ensureDarkness(j),
    demonic = j.alignment?.demonic || 0;
  if (
    d.offer ||
    j.turn < d.nextOfferTurn ||
    j.progress?.battle?.status === "active" ||
    j.progress?.drill
  )
    return false;
  const weak = fate.stats.reduce((sum, n) => sum + n, 0) / 4 < 50;
  const early = weak || d.losses > 0 || demonic >= 20;
  if (j.turn < (early ? 2 : 8)) return false;
  const tier = temptationTier(demonic);
  d.offer = {
    ...tier,
    token: crypto.randomUUID(),
    turn: j.turn,
    reason:
      d.losses > 0
        ? "패배 뒤 찾아온 낯선 인연"
        : weak
          ? "더딘 수련을 지켜본 낯선 인연"
          : "당신의 기운을 알아본 낯선 인연",
  };
  return true;
}
export function resolveTemptation(j, token, accept) {
  const d = ensureDarkness(j),
    offer = d.offer;
  if (!offer || offer.token !== token || (accept && j.energy < offer.energy))
    return null;
  const beforeErosion = d.erosion,
    beforeDemonic = j.alignment?.demonic || 0;
  if (accept) {
    j.energy -= offer.energy;
    j.inner += offer.inner;
    d.erosion = clamp(d.erosion + offer.erosion);
    d.accepted++;
    j.alignment ??= { righteous: 0, black: 0, demonic: 0 };
    j.alignment.demonic = clamp(beforeDemonic + offer.demonic);
    j.arts.forbiddenBreath ??= {
      status: "learned",
      xp: 0,
      decodeProgress: 100,
      chapter: 1,
    };
    if (!j.activeMind) j.activeMind = "forbiddenBreath";
  }
  const entry = {
    turn: j.turn,
    name: offer.name,
    accepted: accept,
    inner: accept ? offer.inner : 0,
    erosion: d.erosion - beforeErosion,
    demonic: (j.alignment?.demonic || 0) - beforeDemonic,
  };
  d.history.unshift(entry);
  d.history = d.history.slice(0, 8);
  d.offer = null;
  d.nextOfferTurn = j.turn + (accept ? 5 : 6);
  return entry;
}
export function darkPractice(j, artId) {
  const art = darkArts[artId];
  if (!art) return 0;
  const d = ensureDarkness(j);
  d.erosion = clamp(
    d.erosion + (artId === "bloodMind" ? 5 : art.category === "mind" ? 4 : 2),
  );
  j.alignment ??= { righteous: 0, black: 0, demonic: 0 };
  j.alignment.demonic = clamp(j.alignment.demonic + 1);
  return art.category === "mind" ? (artId === "bloodMind" ? 7 : 5) : 0;
}
export function canVisitSect(j, sect) {
  return (
    !j.progress?.sect &&
    (j.turn >= 14 || (sect.dark && ensureDarkness(j).accepted > 0))
  );
}
export function purify(j) {
  const d = ensureDarkness(j);
  if (!d.erosion || j.energy < 12 || j.inner < 3) return false;
  j.energy -= 12;
  j.inner -= 3;
  d.erosion = Math.max(0, d.erosion - 12);
  return true;
}
