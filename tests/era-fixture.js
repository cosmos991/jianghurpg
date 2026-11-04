export const catalog = {
  era: {
    id: "demonic_rise_v1",
    name: "마교의 준동",
    description: "마교의 세력 확장을 막고 사람들과 지역을 지키는 시대.",
    duration_years: 20,
    version: 1,
    status: "published",
  },
  objectives: [
    {
      id: "a",
      name: "단서",
      points: 100,
      condition_code: "CLUE_FOUND",
      target_key: "clue",
    },
  ],
  outcomes: [
    {
      id: "result",
      name: "기록",
      min_score: 0,
      max_score: 100,
      world_result: "강호에 기록이 남았다.",
      required_objective_ids: [],
      fame_reward: 0,
      contribution_reward: 0,
      legacy_reward_code: "NONE",
    },
  ],
};
