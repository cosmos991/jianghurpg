import {
  ensureDarkness,
  temptationTier,
  erosionEffects,
  resolveTemptation,
  purify,
} from "./game/darkness.js";

export function mountDarkness({
  state,
  locked,
  persist,
  renderWorld,
  finishTurn,
  notify,
}) {
  function act(token, accept) {
    if (locked()) return notify("진행 중인 사건·비무·수련을 먼저 마쳐주세요.");
    const result = resolveTemptation(state.journey, token, accept);
    if (!result)
      return notify("제안이 이미 끝났거나 필요한 기력이 부족합니다.");
    if (accept)
      finishTurn(
        `「${result.name}」을 받아들였습니다. 내공량 +${result.inner} · 침식 +${result.erosion} · 마도 +${result.demonic}. 역맥토납법을 익혔습니다. 더 깊은 힘에는 더 큰 대가가 따릅니다.`,
      );
    else {
      persist();
      renderWorld();
      notify("제안을 거절했습니다. 당신의 길을 계속 걸을 수 있습니다.");
    }
  }
  function cleanse() {
    if (locked()) return;
    if (!purify(state.journey))
      return notify("정화에는 기력 12와 내공량 3이 필요합니다.");
    finishTurn(
      "금기 기운을 가라앉혔습니다. 침식 최대 −12 · 내공량 −3 · 기력 −12. 배운 무공과 소속은 유지됩니다.",
    );
  }
  function markup(busy) {
    const j = state.journey,
      d = ensureDarkness(j),
      effect = erosionEffects(d.erosion),
      offer = d.offer,
      tier = temptationTier(j.alignment?.demonic || 0);
    return `<section class="darkness-panel" aria-label="마도의 유혹"><div class="darkness-heading"><span class="eyebrow">FORBIDDEN PATH · 마도의 유혹</span><span>${effect.label}</span></div><h3>힘을 얻는 대가, 선택은 당신에게</h3><div class="darkness-stats"><span>마도 성향 <b>${j.alignment?.demonic || 0} / 100</b></span><span>침식도 <b>${d.erosion} / 100</b></span></div><p>마도는 선택의 방향, 침식은 금기 수련의 대가입니다. 수치가 높아져도 행동을 대신 결정하지 않습니다.</p><p class="erosion-warning">현재 영향: 비무 체력 −${effect.hpPenalty} · 객잔 휴식 회복 −${effect.restPenalty} · 침식된 마공 초식의 반동 ${effect.backlash}.<br>침식 30 / 60 / 85에서 대가가 커집니다. 마도 20 / 45 / 70에서 다음 제안이 강해집니다.</p>${offer ? `<article class="temptation-offer"><small>${offer.reason}</small><h4>${offer.name}</h4><p>“${offer.words}”</p><div class="offer-price"><span>내공량 +${offer.inner}</span><span>침식 +${offer.erosion} · 마도 +${offer.demonic}</span><span>기력 ${offer.energy} · 행동 1회</span></div><p>수락하면 금기 심법 ‘역맥토납법’을 얻고 마도 문파를 일찍 방문할 수 있습니다. 기존 소속은 자동 변경되지 않습니다.</p><div class="battle-controls"><button data-dark-accept="${offer.token}" ${busy || j.energy < offer.energy ? "disabled" : ""}>힘을 받아들인다</button><button data-dark-decline="${offer.token}" ${busy ? "disabled" : ""}>제안을 거절한다 · 시간 소모 없음</button></div></article>` : `<p>${d.accepted ? "다음 제안을 기다리는 동안 힘을 다스리거나 수련을 이어갈 수 있습니다." : "낮은 자질이나 패배로 벽을 만났을 때, 낯선 이가 지름길을 제안할 수 있습니다."} 현재 마도에 따른 제안 단계: ${tier.name}.</p>`}<button data-purify ${busy || !d.erosion || j.energy < 12 || j.inner < 3 ? "disabled" : ""}>기운 정화 · 침식 −12 · 내공량 3 · 기력 12 · 행동 1회</button>${
      d.history.length
        ? `<details class="temptation-history"><summary>최근 유혹과 선택</summary>${d.history
            .slice(0, 3)
            .map(
              (h) =>
                `<p>${h.name} · ${h.accepted ? "수락" : "거절"}${h.accepted ? ` · 내공량 +${h.inner} · 침식 +${h.erosion}` : ""}</p>`,
            )
            .join("")}</details>`
        : ""
    }</section>`;
  }
  function bind(panel) {
    panel
      .querySelectorAll("[data-dark-accept]")
      .forEach((b) => (b.onclick = () => act(b.dataset.darkAccept, true)));
    panel
      .querySelectorAll("[data-dark-decline]")
      .forEach((b) => (b.onclick = () => act(b.dataset.darkDecline, false)));
    panel.querySelector("[data-purify]").onclick = cleanse;
  }
  return { markup, bind };
}
