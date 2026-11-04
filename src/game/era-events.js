// Short, independent encounters for the step-two sandbox. Slot indexes refer to
// the four fixed objectives in the chosen preview era, never to a random target.
const choice = (id, label, stat, min, slot, points, money = 0, dark = 0) => ({
  id,
  label,
  requires: stat ? { [stat]: min } : {},
  effects: { slot, points, money, dark },
});
const event = (type, id, title, body, slot, approaches) => ({
  id: type + "_" + id,
  type,
  title,
  body,
  choices: [
    ...approaches.map(([label, stat, min, points, money = 0, dark = 0], i) =>
      choice(String(i), label, stat, min, slot, points, money, dark),
    ),
    choice("leave", "지나친다", null, 0, slot, 0),
  ],
});
const baseEvents = [
  event(
    "demonic",
    "courier",
    "쫓기는 운송꾼",
    "검은 옷의 추격자들이 약재 상자를 든 운송꾼을 뒤쫓는다.",
    0,
    [
      ["추격자를 쫓아내고 증언을 듣는다", "force", 30, 8],
      ["운송 표식을 기억한다", "wisdom", 20, 5],
      ["마교에 행방을 팔아넘긴다", "demonic", 15, -5, 12, 5],
    ],
  ),
  event(
    "demonic",
    "ledger",
    "찢어진 거래 장부",
    "장터의 고물상에서 약재 거래 기록이 든 장부를 발견했다.",
    0,
    [
      ["기록의 암호를 해독한다", "wisdom", 35, 10],
      ["장부를 사들여 조사한다", null, 0, 6, -8],
      ["가짜 장부를 마교에 넘긴다", "speech", 30, -4, 10, 3],
    ],
  ),
  event(
    "demonic",
    "inn",
    "주막의 낯선 손님",
    "같은 문양의 반지를 낀 손님들이 주막 뒤편으로 모인다.",
    1,
    [
      ["손님인 척 대화를 유도한다", "speech", 25, 7],
      ["기척을 감추고 대화를 듣는다", "inner", 30, 9],
      ["소문을 은전으로 산다", null, 0, 4, -5],
    ],
  ),
  event(
    "demonic",
    "seal",
    "사라진 인장",
    "관아의 인장이 수상한 상단의 수레에서 발견되었다.",
    1,
    [
      ["상단원을 제압해 정체를 밝힌다", "force", 40, 10],
      ["서류의 모순을 짚는다", "wisdom", 25, 6],
      ["인장을 돌려주고 입막음 돈을 받는다", null, 0, -5, 9, 4],
    ],
  ),
  event(
    "demonic",
    "village",
    "마을 앞의 횃불",
    "무장한 무리가 마을의 식량을 거두겠다며 주민들을 위협한다.",
    2,
    [
      ["주민들 앞에 나서서 막는다", "force", 25, 7],
      ["매복이 있는 척해 물러나게 한다", "speech", 35, 9],
      ["주민들의 피신 비용을 댄다", null, 0, 5, -6],
    ],
  ),
  event(
    "demonic",
    "well",
    "우물에 드리운 그림자",
    "마을 우물 곁에서 수상한 가루가 담긴 주머니를 발견했다.",
    2,
    [
      ["가루의 정체를 밝혀 오염을 막는다", "wisdom", 30, 8],
      ["내공으로 오염된 물길을 정리한다", "inner", 45, 11],
      ["깨끗한 물을 사서 나눈다", null, 0, 4, -5],
    ],
  ),
  event(
    "demonic",
    "valley",
    "계곡의 집결지",
    "깊은 계곡에서 마교의 물자와 인원이 모이는 현장을 목격했다.",
    3,
    [
      ["집결지를 급습한다", "force", 45, 11],
      ["물자를 다른 길로 유도한다", "wisdom", 35, 8],
      ["금단의 기운으로 집결을 흩뜨린다", "demonic", 30, 10, 0, 8],
      ["정찰꾼에게 은전을 주고 위치를 알린다", null, 0, 4, -5],
    ],
  ),
  event(
    "demonic",
    "meeting",
    "야밤의 밀회",
    "폐사찰에 모인 마교도들이 다음 작전을 준비하고 있다.",
    3,
    [
      ["내공으로 장비와 진법을 무너뜨린다", "inner", 40, 10],
      ["가짜 명령으로 계획을 어긋나게 한다", "speech", 40, 9],
      ["준비를 도와주고 대가를 받는다", "demonic", 20, -6, 15, 6],
    ],
  ),
  event(
    "manual",
    "rubbing",
    "비석의 탁본",
    "행상이 오래된 문양이 찍힌 탁본을 펼쳐 보인다.",
    0,
    [
      ["문양의 진위를 알아본다", "wisdom", 20, 7],
      ["탁본을 구입한다", null, 0, 5, -6],
      ["행상을 설득해 사본을 얻는다", "speech", 30, 9],
    ],
  ),
  event(
    "manual",
    "traveler",
    "노인의 기억",
    "찻집의 노인이 잊힌 전승에 관한 이야기를 중얼거린다.",
    0,
    [
      ["차를 대접하고 이야기를 정리한다", null, 0, 4, -3],
      ["옛 지명을 대조한다", "wisdom", 30, 9],
      ["마음을 열도록 대화를 이끈다", "speech", 25, 7],
    ],
  ),
  event(
    "manual",
    "auction",
    "은밀한 경매",
    "작은 경매장에 전승과 관련된 물건이 출품되었다.",
    1,
    [
      ["은전을 내고 낙찰받는다", null, 0, 8, -12],
      ["위작을 밝혀 진품을 찾아낸다", "wisdom", 35, 10],
      ["출품자를 설득한다", "speech", 30, 7],
    ],
  ),
  event(
    "manual",
    "bridge",
    "끊어진 다리",
    "협곡 건너 버려진 짐에서 오래된 기록이 바람에 날린다.",
    1,
    [
      ["경공으로 건너가 기록을 건진다", "inner", 30, 9],
      ["쓰러진 나무로 임시 다리를 놓는다", "force", 25, 7],
      ["길잡이를 고용한다", null, 0, 5, -5],
    ],
  ),
  event(
    "manual",
    "wall",
    "석벽의 문양",
    "산중 석벽에 비급의 행방과 관련된 문양이 남아 있다.",
    2,
    [
      ["문양의 순서를 해독한다", "wisdom", 40, 10],
      ["내공으로 가려진 흔적을 드러낸다", "inner", 35, 8],
      ["탁본 장인을 부른다", null, 0, 5, -7],
    ],
  ),
  event(
    "manual",
    "bandit",
    "도적의 보따리",
    "도적이 낡은 기록이 든 보따리를 들고 도망친다.",
    2,
    [
      ["도적을 제압하고 기록을 되찾는다", "force", 30, 8],
      ["퇴로를 짐작해 앞을 막는다", "wisdom", 30, 8],
      ["기록을 넘기도록 거래한다", "speech", 35, 9],
    ],
  ),
  event(
    "manual",
    "echo",
    "동굴의 메아리",
    "옛 전승의 구절을 읊자 동굴 안에서 묘한 울림이 돌아온다.",
    3,
    [
      ["내공을 울림에 맞춰 숨은 기록을 찾는다", "inner", 45, 11],
      ["구절의 빈칸을 풀어낸다", "wisdom", 40, 9],
      ["금단의 감응으로 흔적을 좇는다", "demonic", 25, 10, 0, 7],
    ],
  ),
  event(
    "manual",
    "duel",
    "전승의 증인",
    "은거한 무인이 기록의 진실을 확인할 자격이 있는지 묻는다.",
    3,
    [
      ["비무로 실력을 증명한다", "force", 45, 11],
      ["전승에 관한 논쟁으로 인정받는다", "wisdom", 45, 11],
      ["신뢰를 얻어 증언을 듣는다", "speech", 40, 9],
    ],
  ),
  event(
    "schism",
    "letter",
    "뒤바뀐 서신",
    "두 문파가 받은 서신의 내용이 서로 다르다는 소문이 돈다.",
    0,
    [
      ["필적과 종이를 비교한다", "wisdom", 25, 8],
      ["전령의 증언을 이끌어낸다", "speech", 25, 7],
      ["서신 사본을 사들인다", null, 0, 5, -5],
    ],
  ),
  event(
    "schism",
    "rumor",
    "객잔의 험담",
    "낯선 자가 문파에 대한 거짓 소문을 퍼뜨리고 있다.",
    0,
    [
      ["이야기의 모순을 밝힌다", "wisdom", 30, 9],
      ["사람들을 설득해 소문을 멈춘다", "speech", 30, 8],
      ["그를 도와 입막음 돈을 받는다", null, 0, -5, 8, 3],
    ],
  ),
  event(
    "schism",
    "escort",
    "습격당한 사절",
    "한 문파의 사절단이 산길에서 습격당했다.",
    1,
    [
      ["습격자를 물리치고 사절을 지킨다", "force", 30, 8],
      ["내공으로 다친 사절을 치료한다", "inner", 30, 8],
      ["안전한 귀환 비용을 지원한다", null, 0, 5, -6],
    ],
  ),
  event(
    "schism",
    "banquet",
    "냉랭한 연회",
    "문파의 연회에서 작은 말다툼이 큰 모욕으로 번지고 있다.",
    1,
    [
      ["체면을 살려주며 화해를 이끈다", "speech", 35, 10],
      ["오해의 원인을 짚어낸다", "wisdom", 30, 7],
      ["양측에 보낼 답례품을 마련한다", null, 0, 4, -5],
    ],
  ),
  event(
    "schism",
    "boundary",
    "경계의 돌무더기",
    "문파 경계에 쌓인 돌무더기를 두고 제자들이 대치한다.",
    2,
    [
      ["옛 경계 기록을 찾아 제시한다", "wisdom", 35, 9],
      ["양측을 설득해 공동 조사를 약속한다", "speech", 40, 10],
      ["힘으로 싸움을 멈추고 중재한다", "force", 40, 8],
    ],
  ),
  event(
    "schism",
    "medicine",
    "약재를 구하는 제자",
    "경쟁 문파의 제자가 스승을 살릴 약재를 구하고 있다.",
    2,
    [
      ["약재 비용을 대신 낸다", null, 0, 6, -8],
      ["내공으로 위급한 상태를 안정시킨다", "inner", 40, 10],
      ["약방 주인을 설득해 지원을 얻는다", "speech", 30, 7],
    ],
  ),
  event(
    "schism",
    "market",
    "시장에 번진 충돌",
    "문파 간 다툼으로 시장 상인들의 좌판이 부서지고 있다.",
    3,
    [
      ["양측의 무기를 거두고 싸움을 막는다", "force", 35, 9],
      ["주민들의 대피를 이끈다", "speech", 25, 6],
      ["피해 상인들에게 구호금을 낸다", null, 0, 5, -6],
    ],
  ),
  event(
    "schism",
    "fire",
    "곡물 창고의 불길",
    "문파의 보복으로 시작된 불길이 마을의 곡물 창고에 번진다.",
    3,
    [
      ["무너지는 문을 들어 주민을 구한다", "force", 40, 10],
      ["내공으로 불길을 밀어내 대피로를 연다", "inner", 45, 11],
      ["마을 사람들을 지휘해 불길을 막는다", "wisdom", 30, 7],
    ],
  ),
];
export const eventStatNames = {
  force: "무력",
  wisdom: "지혜",
  speech: "처세",
  inner: "내공",
  demonic: "마도",
};

// Each phase has its own scene text. Shared sceneId makes phase comparisons possible.
export const eraStages = [
  {
    id: "early",
    name: "초반",
    years: "1~5년",
    startDay: 0,
    range: "15~30",
    support: 3,
  },
  {
    id: "middle",
    name: "중반",
    years: "6~12년",
    startDay: 1800,
    range: "35~60",
    support: 2,
  },
  {
    id: "late",
    name: "후반",
    years: "13~20년",
    startDay: 4320,
    range: "65~90",
    support: 1,
  },
];
export function eraStage(day) {
  return day >= 4320 ? eraStages[2] : day >= 1800 ? eraStages[1] : eraStages[0];
}
const phaseScenes = {
  demonic_courier: [
    [
      "간부의 밀서를 든 운송꾼",
      "마교 간부의 밀서를 품은 운송꾼을 정예 추격대가 뒤쫓는다.",
    ],
    [
      "총공세의 명령서",
      "각지의 공격 지점이 담긴 명령서를 빼돌린 전령이 마교의 척살대에 쫓긴다.",
    ],
  ],
  demonic_ledger: [
    [
      "거점들의 거래 장부",
      "여러 거점의 약재 거래가 연결된 장부가 경비가 삼엄한 암시장에 나왔다.",
    ],
    [
      "전국 보급망의 비밀",
      "마교의 총공세를 뒷받침하는 보급망 원장이 전쟁 물자 경매에 나타났다.",
    ],
  ],
  demonic_inn: [
    [
      "객잔을 점거한 연락책",
      "마교 연락책들이 객잔을 통째로 빌려 지부 간 작전을 조율한다.",
    ],
    [
      "결전 전야의 밀담",
      "수뇌부의 사자들이 비밀 객잔에 모여 최후의 공격 순서를 논의한다.",
    ],
  ],
  demonic_seal: [
    [
      "지부가 훔친 관인",
      "여러 관아의 인장을 도용한 상단이 마교 지부의 이동을 돕고 있다.",
    ],
    [
      "위조된 대피 명령",
      "마교가 관인을 위조해 주민들을 공격 예정지로 유인하려 한다.",
    ],
  ],
  demonic_village: [
    [
      "읍성을 포위한 병력",
      "마교의 정예 부대가 읍성을 둘러싸고 식량과 인질을 요구한다.",
    ],
    [
      "피난민을 에워싼 마교군",
      "대규모 마교군이 마지막 피난 행렬을 가로막았다.",
    ],
  ],
  demonic_well: [
    [
      "읍성의 수로에 퍼진 독",
      "마교가 읍성의 수원에 독을 풀려 한다. 수로 곳곳에 호위가 깔렸다.",
    ],
    [
      "마지막 피난처의 식수",
      "수천 명이 모인 피난처의 식수원이 마교의 독공에 위협받고 있다.",
    ],
  ],
  demonic_valley: [
    [
      "협곡의 전진 기지",
      "마교 간부가 지휘하는 전진 기지에서 대량의 물자와 병력이 모인다.",
    ],
    [
      "총공세의 집결지",
      "마교의 주력군이 천하를 뒤흔들 총공세를 앞두고 깊은 협곡에 집결했다.",
    ],
  ],
  demonic_meeting: [
    [
      "지부 수장들의 회합",
      "여러 지부의 수장들이 폐사찰에서 다음 침공을 준비하고 있다.",
    ],
    [
      "결전의 대진법",
      "폐사찰 일대에 거대한 진법이 펼쳐졌다. 수뇌부가 결전의 준비를 마치려 한다.",
    ],
  ],
  manual_rubbing: [
    [
      "문파가 찾는 탁본",
      "문파들이 수소문하는 탁본을 행상이 감춘 채 경비가 삼엄한 시장을 떠돈다.",
    ],
    [
      "최후의 해석을 담은 탁본",
      "전승을 완성할 해석이 담긴 탁본을 두고 강호의 고수들이 행상을 압박한다.",
    ],
  ],
  manual_traveler: [
    [
      "목격자의 증언",
      "전승의 단서를 아는 노인이 여러 문파의 추적을 피해 찻집에 숨어 있다.",
    ],
    [
      "전승 계보의 마지막 증인",
      "살아남은 마지막 증인이 전승의 진실을 밝힐 기억을 품고 피신해 왔다.",
    ],
  ],
  manual_auction: [
    [
      "문파들의 비밀 경매",
      "여러 문파가 전승과 관련된 물건을 얻으려고 정예 제자들을 경매에 보냈다.",
    ],
    [
      "고수들이 모인 경매",
      "비급의 진위를 결정할 물건이 출품되자 은거한 고수들까지 경매장에 나타났다.",
    ],
  ],
  manual_bridge: [
    [
      "절벽 위의 기록",
      "험한 협곡 건너 기록을 회수하려는 경쟁자들이 좁은 길을 봉쇄했다.",
    ],
    [
      "무너지는 천연 요새",
      "마지막 기록이 놓인 절벽이 무너지고 있다. 주위에는 전승을 노리는 고수들이 버티고 있다.",
    ],
  ],
  manual_wall: [
    [
      "봉인의 석벽",
      "전승의 중요한 기록이 복잡한 봉인 아래 가려져 있다. 수호자들이 접근을 막는다.",
    ],
    [
      "절학을 감춘 석벽",
      "석벽 전체가 하나의 거대한 진식이다. 이를 풀어야 전승의 핵심 기록을 확인할 수 있다.",
    ],
  ],
  manual_bandit: [
    [
      "전승을 가로챈 무리",
      "조직적인 약탈자들이 전승의 기록을 나눠 가진 채 호위를 세우고 달아난다.",
    ],
    [
      "암중 세력의 탈취",
      "강호를 뒤흔드는 암중 세력이 기록을 빼돌렸다. 이를 지키는 자들은 모두 일류 고수다.",
    ],
  ],
  manual_echo: [
    [
      "진식이 깨어난 동굴",
      "전승의 구절에 반응한 진식이 동굴 전체를 울리며 숨은 길을 감춘다.",
    ],
    [
      "전승의 마지막 공명",
      "동굴의 공명을 견디지 못하면 핵심 기록이 무너지는 암벽과 함께 사라진다.",
    ],
  ],
  manual_duel: [
    [
      "은거 고수의 시험",
      "전승을 지킨 은거 고수가 다가와 자격을 시험하겠다고 선언한다.",
    ],
    [
      "전승 수호자의 최종 심문",
      "전승의 진위를 보증할 마지막 수호자가 평생의 무학을 걸고 자격을 묻는다.",
    ],
  ],
  schism_letter: [
    [
      "동맹을 흔드는 서신",
      "여러 문파가 받은 서신이 서로 다르다. 조작된 약속으로 동맹이 무너지기 직전이다.",
    ],
    [
      "개전을 부르는 격문",
      "천하에 뿌려진 격문이 정파의 총력전을 부추긴다. 위조를 밝힐 시간이 얼마 없다.",
    ],
  ],
  schism_rumor: [
    [
      "문파를 갈라놓는 소문",
      "여러 객잔에서 조직적으로 퍼지는 소문이 문파 간 보복을 일으키고 있다.",
    ],
    [
      "천하에 퍼진 배신의 누명",
      "한 문파가 적과 내통했다는 거짓 소문에 정파 전체가 무기를 들려 한다.",
    ],
  ],
  schism_escort: [
    [
      "습격당한 중재 사절단",
      "화해 협상에 나선 사절단이 정예 자객들에게 포위당했다.",
    ],
    [
      "마지막 휴전 사절",
      "전쟁을 멈출 마지막 사절이 결사대의 공격을 받고 있다. 실패하면 협상은 끝난다.",
    ],
  ],
  schism_banquet: [
    [
      "결렬 직전의 회맹",
      "문파 수장들이 모인 연회에서 모욕과 불신이 쌓여 협상이 결렬되려 한다.",
    ],
    [
      "전쟁 전야의 회담",
      "양측의 군세가 대치한 가운데 마지막 연회가 열렸다. 한마디의 실수가 개전으로 이어질 수 있다.",
    ],
  ],
  schism_boundary: [
    [
      "영지를 가른 대치",
      "경계를 둘러싼 분쟁에 문파 장로들과 정예 제자들이 합류했다.",
    ],
    [
      "결전을 앞둔 경계선",
      "두 문파의 주력 병력이 경계에서 대치한다. 첫 공격이 시작되면 돌이킬 수 없다.",
    ],
  ],
  schism_medicine: [
    [
      "장로를 살릴 약재",
      "경쟁 문파의 장로가 쓰러졌다. 약재를 구하는 사절은 적대 세력의 감시를 받고 있다.",
    ],
    [
      "중재자를 살릴 마지막 약",
      "전쟁을 막을 수 있는 중재자가 위독하다. 그를 살리는 일이 문파 간 마지막 신뢰가 될 수 있다.",
    ],
  ],
  schism_market: [
    [
      "교역로를 덮친 충돌",
      "문파 간 무력 충돌로 주요 교역로가 끊기고 상인들이 고립됐다.",
    ],
    [
      "전장이 된 도성",
      "문파의 주력 병력이 도성에서 충돌하며 주민들이 전장 한가운데 갇혔다.",
    ],
  ],
  schism_fire: [
    [
      "연쇄 방화의 위협",
      "문파의 보복이 여러 마을의 곡물 창고를 향한다. 식량 수송도 끊겼다.",
    ],
    [
      "전쟁 속 마지막 구호 창고",
      "피난민을 먹여 살릴 마지막 곡물 창고가 결전의 불길에 휩싸였다.",
    ],
  ],
};
const supportLabels = {
  demonic: [
    "주변의 수상한 흔적을 알려준다",
    "목격한 병력 이동을 전한다",
    "피난민에게 위험한 길을 알려준다",
  ],
  manual: [
    "목격한 단서를 기록해 남긴다",
    "조사한 흔적을 찾는 이에게 전한다",
    "기록을 찾는 이들의 대피를 돕는다",
  ],
  schism: [
    "주변 사람들에게 상황을 알린다",
    "왕래하는 주민에게 안전한 길을 알린다",
    "전란 속 주민의 대피를 돕는다",
  ],
};
export const eraEvents = eraStages.flatMap((stage, index) =>
  baseEvents.map((base) => {
    const copy =
      index === 0 ? [base.title, base.body] : phaseScenes[base.id][index - 1];
    const choices = base.choices.map((original) => {
      const c = structuredClone(original);
      if (c.id === "leave") return c;
      c.requires = Object.fromEntries(
        Object.entries(c.requires).map(([key, min]) => {
          const ratio = Math.max(0, Math.min(1, (min - 15) / 30));
          const normal =
            index === 0
              ? Math.round(15 + ratio * 15)
              : index === 1
                ? Math.round(35 + ratio * 25)
                : Math.round(65 + ratio * 25);
          return [
            key,
            key === "demonic"
              ? Math.round([10, 25, 40][index] + ratio * 10)
              : normal,
          ];
        }),
      );
      if (c.effects.points > 0) {
        const fullPower = Object.keys(c.requires).some(
          (key) => key !== "demonic",
        );
        c.effects.points = fullPower
          ? Math.round(c.effects.points * [0.6, 1, 1.35][index])
          : Math.min([4, 4, 3][index], c.effects.points);
        if (c.effects.dark) c.effects.points = [6, 9, 12][index];
      }
      if (c.effects.money < 0)
        c.effects.money = -Math.ceil(-c.effects.money * [1, 1.5, 2][index]);
      if (c.effects.dark)
        c.effects.dark = Math.min(20, c.effects.dark + index * 3);
      return c;
    });
    choices.splice(
      choices.length - 1,
      0,
      choice(
        "support",
        supportLabels[base.type][index],
        null,
        0,
        base.choices[0].effects.slot,
        stage.support,
      ),
    );
    return {
      ...base,
      id: index === 0 ? base.id : base.id + "_" + stage.id,
      sceneId: base.id,
      stage: stage.id,
      title: copy[0],
      body: copy[1],
      choices,
    };
  }),
);
