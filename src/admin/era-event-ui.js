import {
  startEventTest,
  advanceTestDays,
  resolveTestEvent,
  choiceAvailability,
  eventScore,
  testEnded,
  EVENT_RULES,
} from "../game/era-event-test.js";
import { eraEvents, eventStatNames } from "../game/era-events.js";

export function mountEraEventTest() {
  const $ = (s) => document.querySelector(s);
  let state = null;
  const presets = {
    weak: [15, 15, 15, 10, 0],
    balanced: [30, 30, 30, 25, 10],
    strong: [50, 50, 50, 45, 30],
  };
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const signed = (n) => (n >= 0 ? "+" : "") + n;
  function render() {
    $("#event-test-setup").disabled = !!state;
    $("#event-test-setup").hidden = !!state;
    $("#event-test-start").hidden = !!state;
    $("#event-test-reset").hidden = !state;
    $("#event-test-play").hidden = !state;
    if (!state) return;
    const catalog = state.draw.template.catalog,
      score = eventScore(state),
      ended = testEnded(state);
    $("#event-test-era").textContent =
      state.draw.type.name + " · " + catalog.era.name;
    $("#event-test-day").textContent =
      state.day + "일 경과 · 사건 " + state.encounters + "회";
    $("#event-test-resources").textContent =
      "은전 " + state.money + " · 타락 " + state.corruption + " / 100";
    const stats = $("#event-test-stats");
    stats.replaceChildren();
    Object.entries(eventStatNames).forEach(([key, label]) =>
      stats.append(node("span", label + " " + state.stats[key])),
    );
    $("#event-test-score").textContent = score + " / 100점";
    const outcome = catalog.outcomes.find(
      (o) => score >= o.min_score && score <= o.max_score,
    );
    $("#event-test-rank").textContent =
      (ended ? "최종 결과: " : "현재 점수로 끝나면: ") +
      outcome.name +
      " · " +
      outcome.world_result;
    const tasks = $("#event-test-progress");
    tasks.replaceChildren();
    catalog.objectives.forEach((o, i) => {
      const row = node("div", undefined, "event-task");
      row.append(
        node("span", o.name),
        node("strong", state.progress[i] + " / 25점"),
      );
      const meter = node("meter");
      meter.min = 0;
      meter.max = 25;
      meter.value = state.progress[i];
      meter.setAttribute("aria-label", o.name);
      row.append(meter);
      tasks.append(row);
    });
    $("#event-test-activity").disabled = !!state.pending || ended;
    document
      .querySelectorAll("[data-event-days]")
      .forEach((b) => (b.disabled = !!state.pending || ended));
    const card = $("#event-test-encounter");
    card.hidden = !state.pending;
    if (state.pending) {
      const current = eraEvents.find((e) => e.id === state.pending.id),
        token = state.pending.token;
      $("#event-test-title").textContent = current.title;
      $("#event-test-body").textContent = current.body;
      const choices = $("#event-test-choices");
      choices.replaceChildren();
      current.choices.forEach((c) => {
        const allowed = choiceAvailability(state, c),
          b = node("button", undefined, "event-choice");
        b.type = "button";
        b.dataset.eventChoice = c.id;
        b.disabled = !allowed.available;
        b.append(node("strong", c.label));
        const requirement = Object.entries(c.requires).map(
          ([key, min]) => eventStatNames[key] + " " + min + " 이상",
        );
        if (c.effects.money < 0) requirement.push("은전 " + -c.effects.money);
        b.append(
          node(
            "span",
            allowed.available
              ? requirement.join(" · ") || "조건 없음"
              : allowed.missing.join(" · "),
            "event-choice-condition",
          ),
        );
        const effect = c.effects,
          preview =
            c.id === "leave"
              ? "변화 없음"
              : catalog.objectives[effect.slot].name +
                " " +
                signed(effect.points) +
                "점" +
                (effect.money ? " · 은전 " + signed(effect.money) : "") +
                (effect.dark ? " · 마도·타락 +" + effect.dark : "");
        b.append(node("small", preview));
        b.onclick = () => {
          try {
            resolveTestEvent(state, token, c.id);
            render();
            $("#event-test-status").textContent = state.lastResult.summary;
            $("#event-test-result").focus({ preventScroll: true });
          } catch (e) {
            $("#event-test-status").textContent = e.message;
          }
        };
        choices.append(b);
      });
    }
    $("#event-test-result").hidden = !state.lastResult;
    if (state.lastResult)
      $("#event-test-result").textContent =
        state.lastResult.title +
        " / " +
        state.lastResult.choice +
        " → " +
        state.lastResult.summary;
    const logs = $("#event-test-log");
    logs.replaceChildren();
    state.log.forEach((message) => logs.append(node("li", message)));
  }
  document.querySelectorAll("[data-event-preset]").forEach(
    (b) =>
      (b.onclick = () => {
        Object.keys(eventStatNames).forEach(
          (key, i) =>
            ($("#event-stat-" + key).value = presets[b.dataset.eventPreset][i]),
        );
      }),
  );
  $("#event-test-start").onclick = () => {
    try {
      const stats = Object.fromEntries(
        Object.keys(eventStatNames).map((key) => [
          key,
          Number($("#event-stat-" + key).value),
        ]),
      );
      if (
        Object.keys(eventStatNames).some(
          (key) => $("#event-stat-" + key).value === "",
        )
      )
        throw Error("모든 능력치를 입력해주세요.");
      state = startEventTest({
        seed: $("#event-test-seed").value,
        typeId: $("#event-test-type").value,
        stats,
      });
      render();
      $("#event-test-status").textContent =
        "시대가 시작되었습니다. 활동을 골라 날을 보내세요. 이 테스트는 저장되지 않습니다.";
    } catch (e) {
      $("#event-test-status").textContent = e.message;
    }
  };
  $("#event-test-reset").onclick = () => {
    state = null;
    render();
    $("#event-test-status").textContent =
      "테스트를 초기화했습니다. 설정을 바꾸거나 같은 시드로 다시 시작할 수 있습니다.";
  };
  document.querySelectorAll("[data-event-days]").forEach(
    (b) =>
      (b.onclick = () => {
        try {
          const advanced = advanceTestDays(
            state,
            $("#event-test-activity").value,
            Number(b.dataset.eventDays),
          );
          render();
          $("#event-test-status").textContent = state.pending
            ? advanced +
              "일 진행 후 사건이 발생했습니다. 선택을 마치면 수련을 계속할 수 있습니다."
            : testEnded(state)
              ? "시대가 끝났습니다. 아래에서 최종 성과를 확인하세요."
              : advanced + "일 진행했습니다. 오늘의 활동을 마쳤습니다.";
          if (state.pending) {
            $("#event-test-encounter").scrollIntoView({
              block: "nearest",
              behavior: "instant",
            });
            $("#event-test-title").focus({ preventScroll: true });
          }
        } catch (e) {
          $("#event-test-status").textContent = e.message;
        }
      }),
  );
  $("#event-test-rule").textContent =
    "시대별 사건 8종 · 총 " +
    eraEvents.length +
    "종. 사건 다음 날은 쉬고, 이후 매일 " +
    Math.round(EVENT_RULES.chance * 100) +
    "%로 추첨합니다. 최근 " +
    EVENT_RULES.recentCount +
    "개 사건은 제외합니다. 과제별 0~25점으로 제한되며 선택은 한 번만 처리됩니다.";
  render();
}
