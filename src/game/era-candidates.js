// Step-one fixtures: review these candidates before adding them to the live catalog.
export const ERA_POOL_VERSION = 1;
export const eraTypes = [
  { id: "demonic", name: "마교의 준동", weight: 1 },
  { id: "manual", name: "비급의 행방", weight: 1 },
  { id: "schism", name: "정파의 분열", weight: 1 },
];
const definitions = [
  [
    "demonic",
    "shadow_routes",
    "검은 약재의 길",
    "은밀한 약재 운송망을 따라 마교의 세력이 번진다.",
    [
      "운송망 단서 확보",
      "잠입 조직 확인",
      "피해 마을 보호",
      "보급 거점 무력화",
    ],
    [
      "CLUE_FOUND",
      "INFILTRATORS_EXPOSED",
      "DEFENSE_SUCCESS",
      "SUPPLY_BASE_STOPPED",
    ],
  ],
  [
    "demonic",
    "red_lanterns",
    "붉은 등불의 밤",
    "야밤의 의식과 실종 사건이 여러 지역에서 이어진다.",
    ["실종 사건 단서 확보", "의식의 주체 확인", "주민 보호", "핵심 의식 중단"],
    ["CLUE_FOUND", "INFILTRATORS_EXPOSED", "DEFENSE_SUCCESS", "RITUAL_STOPPED"],
  ],
  [
    "manual",
    "scattered_pages",
    "흩어진 네 장",
    "오래된 비급의 잔편들이 서로 다른 주인의 손에 나타난다.",
    [
      "첫 잔편의 행방 확인",
      "두 번째 잔편 확보",
      "세 번째 잔편 확보",
      "마지막 잔편의 진위 확인",
    ],
    ["CLUE_FOUND", "CLUE_FOUND", "CLUE_FOUND", "CLUE_FOUND"],
  ],
  [
    "manual",
    "buried_archive",
    "묻힌 장서각",
    "사라진 장서각의 위치를 가리키는 기록이 강호에 퍼진다.",
    [
      "옛 지도 확보",
      "장서각 위치 확인",
      "봉인의 단서 확보",
      "전승의 원본 확인",
    ],
    ["CLUE_FOUND", "CLUE_FOUND", "CLUE_FOUND", "CLUE_FOUND"],
  ],
  [
    "schism",
    "broken_oath",
    "갈라진 맹약",
    "맹약을 둘러싼 불신으로 정파 문파들이 서로 등을 돌린다.",
    [
      "분쟁의 단서 확보",
      "첫 문파의 협력 확보",
      "두 번째 문파의 협력 확보",
      "충돌 지역 보호",
    ],
    ["CLUE_FOUND", "ALLIANCE_SECURED", "ALLIANCE_SECURED", "DEFENSE_SUCCESS"],
  ],
  [
    "schism",
    "empty_seat",
    "비어 있는 맹주의 자리",
    "맹주의 공석을 두고 경쟁하는 문파들 사이에 갈등이 깊어진다.",
    [
      "갈등의 배후 조사",
      "중재 문파의 협력 확보",
      "경쟁 문파의 협력 확보",
      "민가의 피해 방지",
    ],
    ["CLUE_FOUND", "ALLIANCE_SECURED", "ALLIANCE_SECURED", "DEFENSE_SUCCESS"],
  ],
];
const resultCopy = {
  demonic: [
    "마교의 세력이 확장되었다.",
    "일부 지역에서 마교의 확장을 막았다.",
    "마교의 주요 계획을 저지했다.",
  ],
  manual: [
    "전승의 행방이 다시 묻혔다.",
    "전승의 일부와 그 흔적을 확보했다.",
    "흩어진 단서를 모아 전승의 진실을 밝혔다.",
  ],
  schism: [
    "문파 간 대립이 깊어졌다.",
    "일부 문파와 지역의 충돌을 막았다.",
    "주요 문파의 협력을 되살려 갈등을 수습했다.",
  ],
};
export const eraTemplates = definitions.map(
  ([typeId, id, name, description, names, codes]) => ({
    id,
    typeId,
    weight: 1,
    enabled: true,
    previewOnly: true,
    catalog: {
      era: {
        id,
        name,
        description,
        duration_years: 20,
        version: 1,
        status: "draft",
      },
      objectives: names.map((name, i) => ({
        id: id + "_task_" + (i + 1),
        era_id: id,
        name,
        description: "",
        condition_code: codes[i],
        target_key: id + "_target_" + (i + 1),
        category: {
          CLUE_FOUND: "investigation",
          INFILTRATORS_EXPOSED: "investigation",
          DEFENSE_SUCCESS: "protection",
          ALLIANCE_SECURED: "cooperation",
          SUPPLY_BASE_STOPPED: "operation",
          RITUAL_STOPPED: "operation",
        }[codes[i]],
        points: 25,
        sort_order: i + 1,
      })),
      outcomes: [
        [0, 39],
        [40, 79],
        [80, 100],
      ].map(([min_score, max_score], i) => ({
        id: id + "_result_" + i,
        era_id: id,
        name: ["미진", "부분 달성", "대성"][i],
        min_score,
        max_score,
        required_objective_ids: [],
        world_result: resultCopy[typeId][i],
        fame_reward: [0, 20, 50][i],
        contribution_reward: [0, 40, 100][i],
        legacy_reward_code: "NONE",
      })),
    },
  }),
);
