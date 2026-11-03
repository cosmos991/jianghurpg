import {
  trainingModes,
  formatDate,
  formatDuration,
  trainingBudget,
  planTraining,
  beginTraining,
  advanceTraining,
  cancelTraining,
} from "./game/time.js";

export function mountLongTraining({
  state,
  catalog,
  random,
  locked,
  onEvent,
  gainMartial,
  persist,
  renderWorld,
  addLog,
  syncMartial,
  notify,
}) {
  const host = document.querySelector("#long-training-panel");
  let mode = "month",
    focus = "art";
  const reasons = {
    event: "사건 발생 · 먼저 선택을 마쳐주세요",
    energy: "기력 부족 · 휴식 후 이어갈 수 있습니다",
    resources: "생활비 부족 · 자금을 마련한 뒤 이어갈 수 있습니다",
    erosion: "침식 단계 상승 · 상태를 확인하고 계속할지 결정하세요",
    ready: "수련 준비",
    completed: "예정된 수련 완료",
    completed_event: "수련 완료 · 사건이 기다립니다",
    mastered: "무공 대성 · 수련을 일찍 마쳤습니다",
    cancelled: "수련 종료 · 쌓은 성장은 유지됩니다",
  };
  const refresh = () => {
    persist();
    renderWorld();
  };
  function progress() {
    const j = state.journey;
    if (locked()) {
      notify("진행 중인 사건·비무·수련을 먼저 마쳐주세요.");
      return;
    }
    const task = j.longTraining,
      before = { ...task.earned },
      spent = { ...task.spent };
    const result = advanceTraining(j, { random, onEvent, gainMartial });
    if (result.reason === "missingArt") {
      notify("수련하던 무공을 찾을 수 없습니다. 이 수련을 종료해주세요.");
      return;
    }
    if (result.advanced) {
      const earned = task.earned,
        parts = [`숙련 +${earned.xp - before.xp}`];
      if (earned.inner - before.inner)
        parts.push(`내공량 +${earned.inner - before.inner}`);
      if (earned.erosion - before.erosion)
        parts.push(`침식 +${earned.erosion - before.erosion}`);
      addLog(
        `${catalog[task.art].name} ${trainingModes[task.mode].name} · ${formatDuration(result.advanced)} 진행. ${parts.join(" · ")}. 은전 −${task.spent.money - spent.money} · 식량 −${task.spent.food - spent.food}. ${reasons[result.reason] || ""}`,
        formatDate(j.turn),
      );
      if (result.startTurn < 14 && j.turn >= 14)
        addLog(
          "첫 일주일을 마쳤습니다. 문파를 방문해 입문하거나 독행을 이어갈 수 있습니다.",
          "문파 방문 개방",
        );
    } else if (result.reason !== "event")
      notify(reasons[result.reason] || "수련을 이어갈 수 없습니다.");
    syncMartial(j);
    refresh();
    if (j.pendingEvent) {
      const panel = document.querySelector("#road-event-panel");
      panel.scrollIntoView({ block: "start", behavior: "smooth" });
      panel.focus({ preventScroll: true });
    }
  }
  function start() {
    if (locked()) return notify("진행 중인 사건·비무·수련을 먼저 마쳐주세요.");
    try {
      const j = state.journey;
      beginTraining(
        j,
        planTraining(j, state.chosen, catalog, mode, focus),
        random,
      );
      progress();
    } catch (error) {
      notify(error.message);
    }
  }
  function render() {
    const j = state.journey,
      task = j.longTraining,
      busy = locked();
    let plan, error, budget;
    try {
      plan = planTraining(j, state.chosen, catalog, mode, focus);
      budget = trainingBudget(j, plan.totalTurns);
    } catch (e) {
      error = e.message;
    }
    const paused = task?.status === "paused";
    host.innerHTML = `<div class="long-training-heading"><div><span class="eyebrow">TIME & CULTIVATION · 흐르는 강호</span><h2>오래 쌓는 수련</h2></div><span>${formatDate(j.turn)}</span></div><p class="long-training-intro">한 달은 30일, 한 해는 360일입니다. 긴 수련 중 사건이 찾아오면 그날에 멈추며, 지나간 시간만큼만 비용과 성장을 반영합니다.</p>${paused ? `<div class="long-task"><span class="eyebrow">${trainingModes[task.mode].name} · ${catalog[task.art]?.name || "선택한 무공"}</span><h3>${reasons[task.reason] || "수련 일시 중단"}</h3><div class="long-task-progress"><span>진행 ${formatDuration(task.completedTurns)}</span><strong>남은 기간 ${formatDuration(task.totalTurns - task.completedTurns)}</strong></div><progress aria-label="장기 수련 진행" max="${task.totalTurns}" value="${task.completedTurns}"></progress><div class="long-task-stats"><span>숙련 +${task.earned.xp}</span><span>내공량 +${task.earned.inner}</span><span>사용 은전 ${task.spent.money}</span><span>사용 식량 ${task.spent.food}</span>${task.earned.erosion ? `<span>침식 +${task.earned.erosion}</span>` : ""}</div><p>수련 대상과 성장 효율은 시작할 때 고정됩니다. 중단 중에는 휴식·생업을 하고 다시 이어갈 수 있습니다.</p><div class="long-training-buttons"><button data-long="resume" class="primary" ${busy ? "disabled" : ""}>남은 수련 이어가기</button><button data-long="cancel" class="secondary" ${busy ? "disabled" : ""}>여기서 수련 종료</button></div></div>` : `${task ? `<div class="long-completed" role="status"><strong>${reasons[task.reason] || "지난 수련"}</strong><span>${catalog[task.art]?.name || ""} · ${formatDuration(task.completedTurns)} · 숙련 +${task.earned.xp} · 내공량 +${task.earned.inner}</span></div>` : ""}<div class="long-training-form"><label>수련 기간<select id="long-mode"><option value="month" ${mode === "month" ? "selected" : ""}>집중 수련 · 1개월</option><option value="year" ${mode === "year" ? "selected" : ""}>폐관 수련 · 1년</option></select></label><label>집중할 대상<select id="long-focus"><option value="art" ${focus === "art" ? "selected" : ""}>무공 · ${catalog[j.trainingArt]?.name || "미선택"}</option><option value="mind" ${focus === "mind" ? "selected" : ""}>심법 · ${catalog[j.activeMind]?.name || "미습득"}</option></select></label></div>${plan ? `<div class="long-training-preview"><span>한 달 기준 숙련 +${plan.rates.xp}${plan.rates.inner ? ` · 내공량 +${plan.rates.inner}` : ""}${plan.rates.erosion ? ` · 침식 +${plan.rates.erosion}` : ""}</span><p>전체 기간 예상: 은전 ${budget.money} · 식량 ${budget.food}. 하루 숙박·수련비 1닢과 식량 1을 사용하며, 식량이 없으면 식비 2닢을 추가 지불합니다.</p><p>반나절마다 기력 4를 사용하고, 밤에는 최대 10을 회복합니다. 침식으로 회복량이 줄어들 수 있습니다. ${budget.sufficient ? "" : "자금이 부족해도 시작할 수 있지만 부족해지는 시점에 중단됩니다."}</p>${plan.rates.inner === 0 ? "<p>무공이 대성하면 남은 기간을 소비하지 않고 마칩니다.</p>" : ""}</div>` : `<p class="long-training-unavailable">${error}</p>`}<button data-long="start" class="primary" ${busy || !plan || j.energy < 8 ? "disabled" : ""}>${trainingModes[mode].name} 시작${j.energy < 8 ? " · 기력 8 필요" : ""}</button>`}`;
    host.querySelectorAll("[data-long]").forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.long === "start") start();
          else if (b.dataset.long === "resume") progress();
          else if (!locked() && cancelTraining(j)) {
            addLog(
              "장기 수련을 종료했습니다. 진행한 시간과 쌓은 성장, 사용한 자원은 그대로 남습니다.",
              formatDate(j.turn),
            );
            refresh();
          }
        }),
    );
    const modeSelect = host.querySelector("#long-mode"),
      focusSelect = host.querySelector("#long-focus");
    if (modeSelect)
      modeSelect.onchange = () => {
        mode = modeSelect.value;
        render();
      };
    if (focusSelect)
      focusSelect.onchange = () => {
        focus = focusSelect.value;
        render();
      };
  }
  return { render };
}
