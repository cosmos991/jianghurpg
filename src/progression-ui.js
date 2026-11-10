import { revealWorldTarget } from "./mobile-world.js";
import { mountDarkness } from "./darkness-ui.js";
import { canVisitSect, ensureDarkness, darkPractice } from "./game/darkness.js";
import {
  sects,
  realms,
  ensureProgress,
  breakthroughStatus,
  combatStats,
  createBattle,
  combatTurn,
  drills,
  drillStep,
} from "./game/progression.js";

export function mountProgression({
  state,
  catalog,
  persist,
  notify,
  finishTurn,
  gainMartial,
  renderWorld,
}) {
  const panel = document.querySelector("#progression-panel");
  const locked = () => {
    const p = ensureProgress(state.journey);
    return (
      !!state.journey.pendingEvent || p.battle?.status === "active" || !!p.drill
    );
  };
  const blocked = () => {
    if (locked()) {
      notify("먼저 진행 중인 비무·수련·사건을 마쳐주세요.");
      return true;
    }
    return false;
  };
  const refresh = () => {
    persist();
    renderWorld();
  };
  const darkness = mountDarkness({
    state,
    locked,
    persist,
    renderWorld,
    finishTurn,
    notify,
  });
  const learn = (id) => {
    state.journey.arts[id] ??= {
      status: "learned",
      xp: 0,
      decodeProgress: 100,
      chapter: 1,
    };
  };
  function beginBattle(mode, sect = null) {
    if (blocked()) return;
    const j = state.journey,
      p = ensureProgress(j);
    if (
      mode === "exam" &&
      (!p.exam || p.exam.sect !== sect || p.exam.stage !== "test")
    )
      return;
    if (j.energy < 15)
      return notify("비무에 기력 15가 필요합니다. 먼저 휴식하세요.");
    j.energy -= 15;
    p.battle = createBattle(j, state.chosen, catalog, mode, sect);
    refresh();
    revealWorldTarget(panel);
    panel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function battleAction(action) {
    const j = state.journey,
      p = ensureProgress(j),
      previous = p.battle;
    if (!previous || previous.status !== "active") return;
    p.battle = combatTurn(previous, action);
    const b = p.battle;
    if (
      action === "skill" &&
      previous.skillKnown &&
      previous.qi >= 6 &&
      previous.darkSkill
    )
      darkPractice(j, previous.art);
    if (b.status === "active") return refresh();
    if (b.rewardClaimed) return;
    b.rewardClaimed = true;
    if (b.status === "lost") ensureDarkness(j).losses++;
    let reward = "";
    if (b.status === "won") {
      p.wins++;
      if (b.art && j.arts[b.art]?.status === "learned")
        reward += ` 무공 숙련 +${gainMartial(b.art, 5)}.`;
      if (p.sect && b.mode === "practice") {
        p.contribution += 2;
        reward += " 문파 공헌 +2.";
      }
      if (b.mode === "exam" && p.exam?.sect === b.sect) {
        p.exam.stage = "evaluation";
        reward += " 기초 시험을 통과했습니다. 입문 사건을 살펴보세요.";
      }
    }
    finishTurn(
      `비무 ${b.status === "won" ? "승리" : b.status === "lost" ? "패배" : "중단"}. 기력 −15 · 행동 1회.${reward}`,
    );
  }
  function startDrill(kind) {
    if (blocked() || !drills[kind]) return;
    const j = state.journey,
      p = ensureProgress(j),
      def = drills[kind];
    if (kind === "stance" && !j.trainingArt)
      return notify("먼저 수련할 무공을 선택하세요.");
    if (kind === "breath" && !j.activeMind)
      return notify("먼저 심법을 배우고 운용하세요.");
    if (j.energy < def.cost) return notify(`기력 ${def.cost}이 필요합니다.`);
    j.energy -= def.cost;
    p.drill = {
      kind,
      step: 0,
      correct: 0,
      finished: false,
      phase: "preview",
      sequence:
        kind === "stance"
          ? Array.from(
              { length: 3 },
              () =>
                def.options[
                  crypto.getRandomValues(new Uint32Array(1))[0] %
                    def.options.length
                ],
            )
          : [...def.cues],
      art: kind === "breath" ? j.activeMind : j.trainingArt,
    };
    refresh();
  }
  function answerDrill(answer) {
    const j = state.journey,
      p = ensureProgress(j);
    if (!p.drill || p.drill.phase === "preview") return;
    const d = drillStep(p.drill, answer);
    p.drill = d;
    if (!d.finished) return refresh();
    const mastery = gainMartial(
      d.art,
      2 + d.correct * 2 + Math.floor(state.chosen.stats[1] / 40),
    );
    const inner =
      d.kind === "breath"
        ? 1 +
          d.correct +
          Math.floor(state.chosen.stats[2] / 40) +
          (d.art === "wudangMind"
            ? 2
            : ["huashanMind", "shaolinMind"].includes(d.art)
              ? 1
              : 0)
        : 0;
    const darkGain = darkPractice(j, d.art);
    j.inner += inner + darkGain;
    p.trainingRecord++;
    if (p.sect && d.correct === 3) p.contribution++;
    p.drill = null;
    finishTurn(
      `${drills[d.kind].name} 완료 · ${d.correct}/3 정확 · ${catalog[d.art].name} 숙련 +${mastery}${inner ? ` · 내공량 +${inner + darkGain}` : ""}${p.sect && d.correct === 3 ? " · 문파 공헌 +1" : ""}${catalog[d.art].dark ? " · 마공 침식 발생" : ""}.`,
    );
  }
  function visit(id) {
    if (blocked()) return;
    const j = state.journey,
      p = ensureProgress(j);
    if (!sects[id] || !canVisitSect(j, sects[id])) return;
    p.exam = { sect: id, stage: "test", choice: null };
    p.battle = null;
    refresh();
  }
  function ritual() {
    if (blocked()) return;
    const j = state.journey,
      p = ensureProgress(j),
      exam = p.exam;
    if (!exam || exam.stage !== "test" || !sects[exam.sect]?.dark) return;
    if (j.energy < 8) return notify("입문 의식에 기력 8이 필요합니다.");
    j.energy -= 8;
    j.inner += 10;
    const d = ensureDarkness(j);
    d.erosion = Math.min(100, d.erosion + 8);
    j.alignment.demonic = Math.min(100, j.alignment.demonic + 8);
    exam.stage = "evaluation";
    finishTurn(
      `${sects[exam.sect].name}의 금기 의식을 치렀습니다. 내공량 +10 · 침식 +8 · 마도 +8 · 기력 −8. 이제 입문의 뜻을 선택하세요.`,
    );
  }
  function choose(index) {
    if (blocked()) return;
    const p = ensureProgress(state.journey),
      exam = p.exam;
    if (
      !exam ||
      exam.stage !== "evaluation" ||
      !sects[exam.sect].choices[index]
    )
      return;
    if (sects[exam.sect].dark && index === 2) {
      const d = ensureDarkness(state.journey);
      state.journey.inner += 12;
      d.erosion = Math.min(100, d.erosion + 10);
      state.journey.alignment.demonic = Math.min(
        100,
        state.journey.alignment.demonic + 6,
      );
    }
    exam.choice = index;
    exam.stage = "offer";
    refresh();
  }
  function accept() {
    if (blocked()) return;
    const j = state.journey,
      p = ensureProgress(j),
      exam = p.exam;
    if (!exam || exam.stage !== "offer" || p.sect) return;
    const sect = sects[exam.sect];
    p.entranceRecord = {
      sect: exam.sect,
      choice: exam.choice,
      result: sect.results[exam.choice],
    };
    p.sect = exam.sect;
    p.contribution = 0;
    learn(sect.art);
    learn(sect.mind);
    j.trainingArt = sect.art;
    j.activeMind = sect.mind;
    p.exam = null;
    finishTurn(
      `${sect.name} 외문제자로 입문했습니다. ${sectArtsNames(sect)}을 전수받았습니다. 내공과 무공을 수련하며 다음 경지에 도전하세요.`,
    );
  }
  const sectArtsNames = (sect) =>
    `${catalog[sect.art].name}·${catalog[sect.mind].name}`;
  function breakthrough() {
    if (blocked()) return;
    const j = state.journey,
      p = ensureProgress(j),
      check = breakthroughStatus(j);
    if (!check.ready) return;
    if (j.energy < 20) return notify("돌파에 기력 20이 필요합니다.");
    j.energy -= 20;
    p.realm++;
    finishTurn(
      `호흡과 초식이 하나로 이어졌습니다. ${realms[p.realm].name} 경지에 도달했습니다. 기력 −20.`,
    );
  }
  const meter = (label, value, max) =>
    `<div class="growth-meter"><span>${label} <b>${value} / ${max}</b></span><progress aria-label="${label}" value="${value}" max="${max}"></progress></div>`;
  function render() {
    const j = state.journey,
      p = ensureProgress(j),
      sect = sects[p.sect],
      stats = combatStats(j, state.chosen, catalog),
      { next, ready } = breakthroughStatus(j),
      busy = locked(),
      b = p.battle,
      d = p.drill;
    panel.innerHTML = `<div class="progress-heading"><div><span class="eyebrow">PRACTICE · TRIAL · GROWTH</span><h2>수련과 비무, 문파의 길</h2></div><span>${realms[p.realm].name} · ${sect ? sect.name + " 외문제자" : "문파 무소속"}</span></div>
      <div class="growth-summary"><div><small>내공량</small><strong>${j.inner}<em>점</em></strong><p>축적한 힘 · 전투 중 소모해도 내공량은 유지됩니다.</p></div><div><small>비무 체력 / 공격 / 방어</small><strong>${stats.maxHp} / ${stats.attack} / ${stats.defense}</strong><p>근골·신법·무공 숙련·경지가 반영됩니다.</p></div></div>
      <details class="aptitude-summary"><summary>선천 자질 · 성장의 바탕</summary><p>근골 ${state.chosen.stats[0]} · 오성 ${state.chosen.stats[1]} · 내공 자질 ${state.chosen.stats[2]} · 신법 ${state.chosen.stats[3]}</p></details>
      ${darkness.markup(busy)}
      <div class="breakthrough-card"><h3>다음 성장 목표 · ${next ? realms[p.realm].name + " → " + next.name : "일류 경지 달성"}</h3>${next ? meter("내공량", j.inner, next.inner) + meter("공격 무공 숙련", j.mastery, next.mastery) + `<button data-progress="breakthrough" ${!ready || busy ? "disabled" : ""}>${ready ? "경지 돌파 · 기력 20 · 행동 1회" : "내공과 공격 무공을 수련하세요"}</button>` : "<p>다음 경지는 이후 여정에서 이어집니다.</p>"}</div>
      ${b?.status === "active" ? renderBattle(b) : d ? renderDrill(d) : `<div class="training-options"><button data-progress="practice" ${busy ? "disabled" : ""}><strong>연습 비무</strong><small>기력 15 · 행동 1회 · 승리 시 숙련 +5</small></button><button data-progress="stance" ${busy || !j.trainingArt ? "disabled" : ""}><strong>초식 수련</strong><small>기력 12 · 동작 3회 · 정확도에 따라 성장</small></button><button data-progress="breath" ${busy || !j.activeMind ? "disabled" : ""}><strong>호흡 수련</strong><small>기력 10 · 호흡 3단계 · 내공량과 심법 성장</small></button></div>${b ? `<div class="battle-result" role="status"><h3>${b.status === "won" ? "비무 승리" : b.status === "lost" ? "비무 패배 · 수련 후 다시 도전하세요" : "비무 중단"}</h3><p>${b.log[0]}</p></div>` : ""}`}
      ${renderSect(p, busy)}<p class="progress-note">비무의 체력·현재 내공은 매 대련 시작 시 회복됩니다. 패배해도 사망하거나 소지품을 잃지 않습니다.</p>`;
    panel.querySelectorAll("[data-progress]").forEach(
      (button) =>
        (button.onclick = () => {
          const action = button.dataset.progress;
          if (action === "memorize") {
            if (p.drill?.phase === "preview") {
              p.drill.phase = "answer";
              refresh();
            }
          } else if (action === "practice") beginBattle("practice");
          else if (action === "ritual") ritual();
          else if (action === "exam") beginBattle("exam", p.exam?.sect);
          else if (action === "breakthrough") breakthrough();
          else if (action === "accept") accept();
          else if (action === "decline") {
            if (!blocked()) {
              p.exam = null;
              refresh();
            }
          } else startDrill(action);
        }),
    );
    darkness.bind(panel);
    panel
      .querySelectorAll("[data-battle]")
      .forEach(
        (button) =>
          (button.onclick = () => battleAction(button.dataset.battle)),
      );
    panel
      .querySelectorAll("[data-drill]")
      .forEach(
        (button) => (button.onclick = () => answerDrill(button.dataset.drill)),
      );
    panel
      .querySelectorAll("[data-visit]")
      .forEach(
        (button) => (button.onclick = () => visit(button.dataset.visit)),
      );
    panel
      .querySelectorAll("[data-exam-choice]")
      .forEach(
        (button) =>
          (button.onclick = () => choose(Number(button.dataset.examChoice))),
      );
  }
  function renderBattle(b) {
    const intent = {
      attack: "기본 공격 · 곧게 파고듭니다",
      heavy: "강공 준비 · 방어하면 피해를 줄이고 반격합니다",
      guard: "수비 자세 · 공격 피해가 줄어듭니다",
    }[b.intent];
    return `<div class="battle-arena" aria-label="턴제 비무"><span class="eyebrow">${b.mode === "exam" ? sects[b.sect].name + " · 입문 시험" : "청계학관 · 연습 비무"}</span><h3>${b.mode === "exam" ? "입문 지도 사형" : "학관 수련생"} · ${b.round}합</h3><div class="combatants"><div><h4>나의 상태</h4>${meter("체력", b.hp, b.maxHp)}${b.maxQi ? meter("현재 내공", b.qi, b.maxQi) : "<p>내공량 0 · 기본 공격과 방어로 겨룰 수 있습니다.</p>"}</div><div><h4>상대의 상태</h4>${meter("상대 체력", b.enemyHp, b.enemyMaxHp)}<p class="enemy-intent">예고: ${intent}</p></div></div><div class="battle-controls"><button data-battle="attack">기본 공격</button><button data-battle="skill" ${!b.skillKnown || b.qi < 6 ? "disabled" : ""}>${b.darkSkill ? `마공 초식 · 내공 6 · 침식 +2${b.backlash ? ` · 반동 ${b.backlash}` : ""}` : "무공 초식 · 내공 6"}</button><button data-battle="guard">방어·반격</button><button data-battle="breathe" ${b.qi >= b.maxQi ? "disabled" : ""}>호흡 정돈</button><button data-battle="retreat">비무 중단</button></div><div class="combat-log" aria-live="polite">${b.log.map((line) => `<p>${line}</p>`).join("")}</div></div>`;
  }
  function renderDrill(d) {
    const def = drills[d.kind];
    return `<div class="drill-arena"><span class="eyebrow">GUIDED TRAINING · ${d.step + 1} / 3</span><h3>${def.name}</h3><p>${def.desc}</p>${d.phase === "preview" ? `<div class="drill-cue" role="status">${d.sequence.join(" → ")}</div><p>순서를 충분히 살펴보세요. 시작하면 순서가 가려집니다.</p><button data-progress="memorize">기억했어요 · 수련 시작</button>` : `<div class="drill-cue" role="status">${d.step + 1}번째 동작은?</div><p>선택한 동작 ${d.step} / 3 · 결과는 수련을 마친 뒤 확인합니다.</p><div class="battle-controls">${def.options.map((option) => `<button data-drill="${option}">${option}</button>`).join("")}</div>`}</div>`;
  }

  function renderSect(p, busy) {
    if (p.sect)
      return `<div class="sect-membership"><span class="eyebrow">YOUR SECT</span><h3>${sects[p.sect].name} · 외문제자</h3><p>${sects[p.sect].style} · 문파 공헌 ${p.contribution} · 비무 승리 ${p.wins}회</p><p>전수 무공: ${sectArtsNames(sects[p.sect])}. 아래 무공 목록에서 운용·수련할 수 있습니다.</p>${p.entranceRecord ? `<p>입문 때의 인연: ${p.entranceRecord.result}</p>` : ""}<small>정확한 수련 완료 시 공헌 +1, 연습 비무 승리 시 +2. 상위 전승과 내문 승급은 이후 추가됩니다.</small></div>`;
    if (
      !p.exam &&
      !Object.values(sects).some((sect) => canVisitSect(state.journey, sect))
    )
      return '<div class="sect-membership"><h3>문파의 문은 첫 7일 이후 열립니다</h3><p>학관에서 기초를 익히고 비무로 실력을 확인하세요. 독행을 계속할 수도 있습니다.</p></div>';
    if (!p.exam)
      return `<div class="sect-selection"><h3>문파 방문 · 입문할 길을 살펴보세요</h3><p>자질 제한 없음 · 시험 미통과 시 재응시 가능 · 방문 전까지 독행을 이어갑니다.</p><div class="sect-cards">${Object.entries(
        sects,
      )
        .map(
          ([id, sect]) =>
            `<article><span class="sect-mark">${sect.mark}</span><h4>${sect.name}</h4><p>${sect.style}</p><button data-visit="${id}" ${busy || !canVisitSect(state.journey, sect) ? "disabled" : ""}>${canVisitSect(state.journey, sect) ? "문파 방문" : sect.dark ? "첫 7일 또는 금기 인연 필요" : "첫 7일 이후 방문 가능"}</button></article>`,
        )
        .join("")}</div></div>`;
    const exam = p.exam,
      sect = sects[exam.sect];
    return `<div class="entrance-event"><span class="eyebrow">SECT ENTRANCE · ${sect.name}</span><h3>${exam.stage === "test" ? sect.exam : exam.stage === "evaluation" ? "입문길의 선택" : "사부의 평가 · 입문 제안"}</h3><ol class="entrance-steps"><li>방문 완료</li><li>${exam.stage === "test" ? "기초 시험 진행" : "기초 시험 통과"}</li><li>${exam.stage === "offer" ? "평가 완료" : "선택과 평가"}</li><li>입문 결정</li></ol>${exam.stage === "test" ? (sect.dark ? `<p>낮은 자질이나 실력을 이유로 입문을 막지 않습니다. 금기 의식으로 힘을 얻되 침식을 감수해야 합니다.</p><p class="erosion-warning">내공량 +10 · 침식 +8 · 마도 +8 · 기력 8 · 행동 1회</p><button data-progress="ritual" ${busy ? "disabled" : ""}>대가를 알고 입문 의식에 참여한다</button>` : `<p>${exam.sect === "wudang" ? "먼저 호흡을 정돈하고, 지도 사형과의 대련에서 공수의 균형을 보이세요." : exam.sect === "shaolin" ? "지도 사형과의 대련에서 기본 자세와 인내를 보이세요." : "지도 사형과의 대련에서 검로와 기초 실력을 보이세요."} 실력이 부족하면 수련 후 재응시할 수 있습니다. 무공 종류로 입문을 제한하지 않습니다.</p><button data-progress="exam" ${busy ? "disabled" : ""}>입문 대련 · 기력 15 · 행동 1회</button>`) : exam.stage === "evaluation" ? `<p>${sect.story}</p><div class="entrance-choices">${sect.choices.map((text, index) => `<button data-exam-choice="${index}" ${busy ? "disabled" : ""}>${text}${sect.dark && index === 2 ? "<small>내공량 +12 · 침식 +10 · 마도 +6</small>" : ""}</button>`).join("")}</div>` : `<p>${sect.results[exam.choice]}</p><p>기초를 인정받아 외문제자 입문을 제안받았습니다. ${sectArtsNames(sect)}을 배울 수 있습니다.</p><button data-progress="accept" ${busy ? "disabled" : ""}>입문 수락 · 행동 1회</button>`}<button data-progress="decline" class="text-button" ${busy ? "disabled" : ""}>방문을 마치고 독행하기</button></div>`;
  }
  return { render, locked };
}
