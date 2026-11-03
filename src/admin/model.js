export const conditions = {
  CLUE_FOUND: { name: "단서 확보", category: "investigation", target: "단서" },
  INFILTRATORS_EXPOSED: {
    name: "잠입 조직 정체 확인",
    category: "investigation",
    target: "조직",
  },
  DEFENSE_SUCCESS: {
    name: "지역 보호 성공",
    category: "protection",
    target: "지역",
  },
  ALLIANCE_SECURED: {
    name: "문파 협력 확보",
    category: "cooperation",
    target: "협력 문파",
  },
  SUPPLY_BASE_STOPPED: {
    name: "보급 거점 무력화",
    category: "operation",
    target: "보급 거점",
  },
  RITUAL_STOPPED: {
    name: "핵심 의식 중단",
    category: "operation",
    target: "의식",
  },
};
export const rewards = {
  NONE: "추가 전승 없음",
  SECT_LEGACY_CHOICE: "문파 전승 선택권",
  SPECIAL_LEGACY_CHOICE: "특별 전승 선택권",
};
export function newObjective() {
  const id = "task_" + crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  return {
    id,
    name: "새 과제",
    description: "",
    condition_code: "CLUE_FOUND",
    category: "investigation",
    target_key: id,
    points: 5,
    sort_order: 0,
  };
}
export function newOutcome() {
  return {
    id: "result_" + crypto.randomUUID().replaceAll("-", "").slice(0, 12),
    name: "새 결과",
    min_score: 0,
    max_score: 0,
    required_objective_ids: [],
    world_result: "",
    fame_reward: 0,
    contribution_reward: 0,
    legacy_reward_code: "NONE",
  };
}
export function validateDocument(doc, { publish = false } = {}) {
  const errors = [];
  const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (!doc.era.name?.trim() || doc.era.name.length > 100)
    errors.push("시대 이름을 1~100자로 입력해주세요.");
  if (!int(doc.era.duration_years, 1, 100))
    errors.push("시대 기간은 1~100년의 정수여야 합니다.");
  if (!int(doc.era.version, 1, 2147483647))
    errors.push("설정 버전은 1 이상의 정수여야 합니다.");
  if (doc.objectives.length > 50 || doc.outcomes.length > 20)
    errors.push("과제는 최대 50개, 결과는 최대 20개까지 작성할 수 있습니다.");
  const ids = new Set(),
    slots = new Set();
  doc.objectives.forEach((o, i) => {
    const title = `과제 ${i + 1}`;
    if (!o.name?.trim() || o.name.length > 100)
      errors.push(`${title}: 이름을 1~100자로 입력해주세요.`);
    if (!int(o.points, 1, 100))
      errors.push(`${title}: 점수는 1~100의 정수여야 합니다.`);
    if (!conditions[o.condition_code])
      errors.push(`${title}: 조건을 선택해주세요.`);
    if (ids.has(o.id)) errors.push(`${title}: 식별자가 중복되었습니다.`);
    ids.add(o.id);
    const key = o.condition_code + ":" + o.target_key;
    if (slots.has(key))
      errors.push(`${title}: 동일한 대상·조건이 중복되었습니다.`);
    slots.add(key);
  });
  doc.outcomes.forEach((o, i) => {
    const title = `결과 ${i + 1}`;
    if (!o.name?.trim() || o.name.length > 100)
      errors.push(`${title}: 이름을 1~100자로 입력해주세요.`);
    if (
      !int(o.min_score, 0, 100) ||
      !int(o.max_score, 0, 100) ||
      o.min_score > o.max_score
    )
      errors.push(`${title}: 점수 범위를 0~100 안에서 입력해주세요.`);
    if (!o.world_result?.trim())
      errors.push(`${title}: 결과 설명을 입력해주세요.`);
    if (!int(o.fame_reward, 0, 10000) || !int(o.contribution_reward, 0, 10000))
      errors.push(`${title}: 보상은 0~10000의 정수여야 합니다.`);
    if (!rewards[o.legacy_reward_code])
      errors.push(`${title}: 전승 보상을 선택해주세요.`);
    if (o.required_objective_ids.some((id) => !ids.has(id)))
      errors.push(`${title}: 삭제된 필수 과제가 있습니다.`);
  });
  if (publish) {
    const total = doc.objectives.reduce((s, o) => s + o.points, 0);
    if (total !== 100)
      errors.push(
        `과제 점수 합계가 ${total}점입니다. 적용하려면 100점이어야 합니다.`,
      );
    let next = 0;
    for (const o of [...doc.outcomes].sort(
      (a, b) => a.min_score - b.min_score,
    )) {
      if (o.min_score !== next)
        errors.push(
          `결과 구간이 ${next}점부터 이어져야 합니다. 빈틈이나 중복을 확인해주세요.`,
        );
      if (next === 0 && o.required_objective_ids.length)
        errors.push("최하위 결과에는 필수 과제를 지정할 수 없습니다.");
      next = o.max_score + 1;
    }
    if (next !== 101)
      errors.push("결과 구간은 0~100점 전체를 포함해야 합니다.");
  }
  return [...new Set(errors)];
}
