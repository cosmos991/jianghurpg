export const sects = {
  huashan: {
    name: "화산파",
    mark: "華",
    style: "검술 · 초식의 정확성",
    art: "huashanSword",
    mind: "huashanMind",
    exam: "검술 시험",
    story:
      "입문 시험장으로 향하던 길, 다친 짐꾼이 짐을 떨어뜨렸습니다. 시험 시작을 알리는 종이 울립니다.",
    choices: [
      "짐을 함께 나르고 늦은 사정을 설명한다",
      "동료에게 도움을 청하고 함께 시험장으로 간다",
      "짐꾼에게 의원의 위치를 알려주고 먼저 간다",
    ],
    results: [
      "사부는 책임을 다한 마음을 기억합니다. 짐꾼은 당신에게 감사를 전했습니다.",
      "함께 온 지원자와 인연을 맺었습니다. 사부는 협력하는 태도를 보았습니다.",
      "정해진 시각에 도착했습니다. 사부는 시간을 지키는 태도를 보았습니다.",
    ],
  },
  wudang: {
    name: "무당파",
    mark: "武",
    style: "심법 · 공수의 균형",
    art: "wudangSword",
    mind: "wudangMind",
    exam: "호흡 시험",
    story:
      "운기 시험을 앞둔 동료가 무리하게 숨을 참습니다. 얼굴이 창백해지지만 기운을 더 모으겠다고 고집합니다.",
    choices: [
      "시험을 멈추고 천천히 호흡하도록 돕는다",
      "지도 도사를 불러 함께 상태를 살핀다",
      "무리하지 말라고 알리고 자신의 호흡을 정돈한다",
    ],
    results: [
      "도사는 남의 기운까지 살피는 침착함을 기억합니다.",
      "지도 도사가 동료를 돌보았습니다. 당신은 함께 해결하는 법을 보였습니다.",
      "자신의 호흡을 지켰습니다. 도사는 흔들리지 않는 집중을 보았습니다.",
    ],
  },
  shaolin: {
    name: "소림사",
    mark: "少",
    style: "권법 · 외공과 인내",
    art: "shaolinFist",
    mind: "shaolinMind",
    exam: "기본 권법 시험",
    story:
      "공동 운반 과제 도중 한 지원자가 지쳐 뒤처집니다. 일행이 멈추면 제한 시간 안에 마치기 어려울 수 있습니다.",
    choices: [
      "그의 짐을 나누어 들고 함께 간다",
      "일행과 짐을 재분배하고 보폭을 맞춘다",
      "잠시 쉴 곳을 알려주고 먼저 과제를 마친다",
    ],
    results: [
      "사형은 힘을 타인에게 쓰는 태도를 기억합니다.",
      "일행이 함께 도착했습니다. 사형은 협동하는 태도를 높이 샀습니다.",
      "맡은 과제를 끝냈습니다. 사형은 책임을 완수하는 끈기를 보았습니다.",
    ],
  },
};

export const sectArts = {
  huashanSword: {
    name: "화산입문검",
    category: "attack",
    rank: "문파",
    desc: "정확한 검로와 잇는 초식을 배우는 화산의 입문 검법.",
    effect: "화산 수련과 비무로 숙련도가 성장합니다.",
  },
  huashanMind: {
    name: "화산기초심법",
    category: "mind",
    rank: "문파",
    desc: "검로에 맞춰 단전의 기운을 쌓는 기초 심법.",
    effect: "운기조식 내공량 +1.",
  },
  wudangSword: {
    name: "무당유운검",
    category: "attack",
    rank: "문파",
    desc: "흐름을 잇고 빈틈을 살피는 무당의 입문 검법.",
    effect: "무당 수련과 비무로 숙련도가 성장합니다.",
  },
  wudangMind: {
    name: "무당정심공",
    category: "mind",
    rank: "문파",
    desc: "호흡을 고르게 하여 내공을 갈무리하는 심법.",
    effect: "운기조식 내공량 +2.",
  },
  shaolinFist: {
    name: "소림나한권",
    category: "attack",
    rank: "문파",
    desc: "단단한 자세와 곧은 주먹을 익히는 입문 권법.",
    effect: "소림 수련과 비무로 숙련도가 성장합니다.",
  },
  shaolinMind: {
    name: "소림양기공",
    category: "mind",
    rank: "문파",
    desc: "몸을 보호하며 깊은 호흡을 쌓는 기초 내공법.",
    effect: "운기조식 내공량 +1.",
  },
};

export const realms = [
  { name: "입문", inner: 0, mastery: 0 },
  { name: "삼류", inner: 15, mastery: 20 },
  { name: "이류", inner: 60, mastery: 50 },
  { name: "일류", inner: 150, mastery: 80 },
];
export function ensureProgress(j) {
  j.progress ??= {
    realm: 0,
    sect: null,
    contribution: 0,
    wins: 0,
    exam: null,
    battle: null,
    drill: null,
    trainingRecord: 0,
  };
  return j.progress;
}
export function breakthroughStatus(j) {
  const p = ensureProgress(j),
    next = realms[p.realm + 1];
  return {
    next,
    ready: !!next && j.inner >= next.inner && j.mastery >= next.mastery,
  };
}
export function combatStats(j, fate, catalog) {
  const p = ensureProgress(j),
    art = j.arts[j.trainingArt],
    category = catalog[j.trainingArt]?.category;
  const skill = category === "attack" && art?.status === "learned" ? art.xp : 0;
  const best = (kind) =>
    Math.max(
      0,
      ...Object.entries(j.arts)
        .filter(
          ([id, a]) => a.status === "learned" && catalog[id]?.category === kind,
        )
        .map(([, a]) => a.xp),
    );
  const body = best("body"),
    movement = best("move");
  return {
    maxHp:
      75 +
      Math.floor(fate.stats[0] / 2) +
      p.realm * 15 +
      (p.sect === "shaolin" ? 12 : 0) +
      Math.floor(body / 5),
    attack:
      9 +
      Math.floor(fate.stats[0] / 14) +
      Math.floor(skill / 8) +
      p.realm * 2 +
      (category === "attack" ? 2 : 0) +
      (p.sect === "huashan" ? 2 : 0),
    defense:
      2 +
      Math.floor(fate.stats[3] / 25) +
      p.realm +
      Math.floor(body / 25) +
      Math.floor(movement / 40),
    maxQi: Math.max(0, j.inner),
    skillKnown: category === "attack" && art?.status === "learned",
  };
}
export function createBattle(j, fate, catalog, mode = "practice", sect = null) {
  const stats = combatStats(j, fate, catalog);
  return {
    ...stats,
    hp: stats.maxHp,
    qi: stats.maxQi,
    enemyHp:
      mode === "exam"
        ? sect === "shaolin"
          ? 100
          : sect === "wudang"
            ? 75
            : 85
        : 65,
    enemyMaxHp:
      mode === "exam"
        ? sect === "shaolin"
          ? 100
          : sect === "wudang"
            ? 75
            : 85
        : 65,
    enemyAttack:
      mode === "exam"
        ? sect === "huashan"
          ? 17
          : sect === "wudang"
            ? 14
            : 15
        : 11,
    round: 1,
    intent: "attack",
    status: "active",
    mode,
    sect,
    art: j.trainingArt,
    log: [
      "비무 시작 · 상대의 예고를 살피세요. 강공은 방어·반격으로 대응할 수 있습니다.",
    ],
    rewardClaimed: false,
  };
}
export function combatTurn(battle, action) {
  const b = structuredClone(battle);
  if (b.status !== "active") return b;
  if (!["attack", "skill", "guard", "breathe", "retreat"].includes(action))
    return b;
  if (action === "skill" && (!b.skillKnown || b.qi < 6)) return b;
  if (action === "retreat") {
    b.status = "retreat";
    b.log.unshift("당신은 예를 갖추어 비무를 중단했습니다.");
    return b;
  }
  let damage = 0,
    guard = 0;
  if (action === "attack") damage = b.attack;
  if (action === "skill") {
    b.qi -= 6;
    damage = Math.floor(b.attack * 1.8);
  }
  if (action === "guard") {
    guard = 0.8;
    if (b.intent === "heavy") damage = Math.floor(b.attack * 0.8);
  }
  if (action === "breathe")
    b.qi = Math.min(b.maxQi, b.qi + Math.max(3, Math.ceil(b.maxQi / 4)));
  if (b.intent === "guard") damage = Math.floor(damage * 0.45);
  b.enemyHp = Math.max(0, b.enemyHp - damage);
  const labels = {
    attack: "기본 공격",
    skill: "무공 초식",
    guard: "방어·반격",
    breathe: "호흡 정돈",
  };
  let message = `${b.round}합 · ${labels[action]}${damage ? `, 상대 체력 −${damage}` : ""}.`;
  if (b.enemyHp === 0) {
    b.status = "won";
    message += " 비무에서 승리했습니다.";
  } else {
    const power = b.intent === "heavy" ? 1.8 : b.intent === "guard" ? 0.4 : 1;
    const received = Math.max(
      0,
      Math.floor((b.enemyAttack * power - b.defense) * (1 - guard)),
    );
    b.hp = Math.max(0, b.hp - received);
    message += ` 받은 피해 ${received}${b.intent === "heavy" && action === "guard" ? " · 강공을 막고 반격했습니다" : ""}.`;
    if (b.hp === 0) {
      b.status = "lost";
      message += " 상대가 검을 거두었습니다. 휴식과 수련 후 다시 도전하세요.";
    }
  }
  b.round++;
  b.intent = ["attack", "heavy", "guard"][(b.round - 1) % 3];
  b.log.unshift(message);
  b.log = b.log.slice(0, 12);
  return b;
}

export const drills = {
  stance: {
    name: "초식 수련",
    desc: "초식 세 동작을 기억하고 순서대로 재현하세요. 속도 제한은 없습니다.",
    cues: ["찌르기", "막기", "베기"],
    options: ["찌르기", "막기", "베기"],
    cost: 12,
  },
  breath: {
    name: "호흡 수련",
    desc: "들이쉬기 → 머무르기 → 내쉬기. 호흡의 순서를 맞춰 기운을 정돈하세요.",
    cues: ["들이쉬기", "머무르기", "내쉬기"],
    options: ["들이쉬기", "머무르기", "내쉬기"],
    cost: 10,
  },
};
export function drillStep(drill, answer) {
  const next = structuredClone(drill),
    def = drills[next.kind];
  if (next.finished || !def || !def.options.includes(answer)) return next;
  if (answer === (next.sequence || def.cues)[next.step]) next.correct++;
  next.step++;
  next.finished = next.step === def.cues.length;
  return next;
}
