import { discipleRanks } from "../game/sect-test.js";
import { compareGrowth } from "../game/growth-simulation.js";
import { eventStatNames } from "../game/era-events.js";
export function mountGrowthSimulation() {
  const $ = (s) => document.querySelector(s);
  const node = (tag, text) => {
    const n = document.createElement(tag);
    n.textContent = text;
    return n;
  };
  const fields = [
    "trainingDays",
    "sectBonus",
    "fortuneChance",
    "fortuneGain",
    "trainingCost",
    "fortuneCost",
    "workIncome",
    "startingMoney",
    "missionInterval",
    "missionOuterDays",
    "missionInnerDays",
    "missionCoreDays",
    "missionCost",
  ];
  function ratio() {
    const work =
      100 -
      Number($("#growth-training").value) -
      Number($("#growth-fortune").value);
    $("#growth-work").textContent = "生計 · 생계 " + work + "%";
  }
  $("#growth-training").oninput = ratio;
  $("#growth-fortune").oninput = ratio;
  ratio();
  document.querySelectorAll("[data-growth-plan]").forEach(
    (button) =>
      (button.onclick = () => {
        const plans = {
          training: [80, 5],
          balanced: [60, 20],
          fortune: [35, 40],
        };
        const [training, fortune] = plans[button.dataset.growthPlan];
        $("#growth-training").value = training;
        $("#growth-fortune").value = fortune;
        ratio();
      }),
  );
  $("#growth-run").onclick = () => {
    try {
      const read = (id) => {
        if ($(id).value === "") throw Error("빈 설정을 채워주세요.");
        return Number($(id).value);
      };
      const input = {
        seed: $("#growth-seed").value,
        sectMode: $("#growth-mode").value,
        missionPolicy: $("#growth-policy").value,
        focus: $("#growth-focus").value,
        typeId: $("#growth-era").value,
        start: read("#growth-start"),
        training: read("#growth-training"),
        fortune: read("#growth-fortune"),
        rules: Object.fromEntries(fields.map((k) => [k, read("#growth-" + k)])),
      };
      const result = compareGrowth(input),
        host = $("#growth-results");
      host.replaceChildren();
      for (const run of result.runs) {
        const card = node("article", "");
        card.className = "growth-run-card";
        card.append(
          node(
            "h3",
            run.name +
              (run.career ? " · " + discipleRanks[run.career.rank].name : "") +
              " · 최대 수련 보정 +" +
              run.bonus +
              "%",
          ),
        );
        const table = document.createElement("table");
        const head = document.createElement("thead"),
          hr = document.createElement("tr");
        for (const text of [
          "시점",
          eventStatNames[input.focus],
          "주요 선택 가능",
          "은전",
        ])
          hr.append(node("th", text));
        head.append(hr);
        table.append(head);
        const body = document.createElement("tbody");
        for (const point of run.checkpoints) {
          const row = document.createElement("tr");
          for (const text of [
            point.year + "년",
            point.stats[input.focus],
            point.access.open +
              "/" +
              point.access.total +
              " (" +
              Math.round(point.access.percent) +
              "%)",
            point.money,
          ])
            row.append(node("td", text));
          body.append(row);
        }
        table.append(body);
        card.append(table);
        card.append(
          node(
            "p",
            "실제 활동: 수련 " +
              run.actual.training +
              "일 · 기연 " +
              run.actual.fortune +
              "일 · 생계 " +
              run.actual.work +
              "일",
          ),
        );
        card.append(
          node(
            "p",
            "은전 부족으로 생계 전환 " +
              run.forcedWork +
              "일 · 기연 발견 " +
              run.fortunes +
              "회",
          ),
        );
        card.append(
          node(
            "p",
            [30, 60, 90]
              .map(
                (n) =>
                  n +
                  " 도달: " +
                  (run.reached[n] === null
                    ? "20년 내 미도달"
                    : run.reached[n] === 0
                      ? "시작부터"
                      : (run.reached[n] / 360).toFixed(1) + "년"),
              )
              .join(" · "),
          ),
        );
        card.append(
          node(
            "p",
            run.cappedDay === null
              ? "20년 내 능력치 상한 미도달"
              : "상한 100 도달: " +
                  (run.cappedDay / 360).toFixed(1) +
                  "년 · 성장 과속 여부 검토",
          ),
        );
        if (run.career) {
          card.append(
            node(
              "p",
              "승급 기록: " +
                (run.promotions
                  .map((p) => p.name + " " + (p.day / 360).toFixed(1) + "년")
                  .join(" → ") || "20년 내 승급 없음"),
            ),
          );
          if (!run.career.nextPromotion.max)
            card.append(
              node(
                "p",
                "다음 승급 미충족: " +
                  run.career.nextPromotion.missing.join(" · "),
              ),
            );
          card.append(
            node(
              "p",
              "임무 " +
                run.missions.completed +
                "회 완료 · 수행 " +
                run.missions.days +
                "일 · 비용 " +
                run.missions.spent +
                " · 미완료 " +
                run.missions.pendingDays +
                "일",
            ),
          );
          card.append(
            node(
              "p",
              "문파 공헌 " +
                run.career.contribution +
                " · 신임 " +
                run.career.trust +
                " · 경쟁 문파 관계 " +
                run.career.relation +
                " · 임무 시대기여 " +
                run.missions.score +
                "/100",
            ),
          );
          if (run.control)
            card.append(
              node(
                "p",
                "임무 없는 외문 수련 대비: 최종 " +
                  (run.control.difference >= 0 ? "+" : "") +
                  run.control.difference +
                  " (수련만 " +
                  run.control.final +
                  ") · 처음 앞선 시점 " +
                  (run.control.firstLeadDay === null
                    ? "20년 내 없음"
                    : (run.control.firstLeadDay / 360).toFixed(1) + "년"),
              ),
            );
          const details = document.createElement("details");
          details.append(node("summary", "최근 임무 결과"));
          for (const entry of run.missions.log)
            details.append(
              node(
                "p",
                (entry.day / 360).toFixed(1) +
                  "년 · " +
                  entry.title +
                  " / " +
                  entry.choice +
                  " → " +
                  entry.summary,
              ),
            );
          card.append(details);
        }
        host.append(card);
      }
      $("#growth-report-summary").textContent =
        "최근 계산: " +
        {
          fixed: "기존 고정 보정",
          career: "승급·임무 포함",
          training: "임무 없는 외문 수련",
        }[input.sectMode] +
        " · " +
        (input.missionPolicy === "era" ? "시대 기여 우선" : "공헌 우선") +
        " · 시드 " +
        input.seed.trim() +
        " · " +
        eventStatNames[input.focus] +
        " 시작 " +
        input.start +
        " · 수련/기연/생계 " +
        input.training +
        "/" +
        input.fortune +
        "/" +
        (100 - input.training - input.fortune) +
        "% · 수련 " +
        input.rules.trainingDays +
        "일당 +1 · 문파 보정 " +
        input.rules.sectBonus +
        "% · 기연 " +
        input.rules.fortuneChance +
        "% / +" +
        input.rules.fortuneGain;
      $("#growth-report").hidden = false;
      $("#growth-status").textContent =
        "20년 비교 완료. 같은 시드·설정이면 결과가 같습니다. 이 실행은 실제 게임이나 편집 중 문서를 변경하지 않습니다.";
    } catch (e) {
      $("#growth-status").textContent = e.message;
    }
  };
}
