import {
  eraTypes,
  eraTemplates,
  ERA_POOL_VERSION,
} from "../game/era-candidates.js";
import { drawEra, sampleEras } from "../game/era-draw.js";

export function mountEraDraw() {
  const $ = (s) => document.querySelector(s);
  const type = $("#draw-era-type"),
    seed = $("#draw-era-seed"),
    result = $("#draw-era-result"),
    history = [];
  eraTypes.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = t.name;
    type.append(option);
  });
  const percent = (n) => (n * 100).toFixed(1) + "%";
  function draw() {
    try {
      const draw = drawEra({ seed: seed.value, typeId: type.value || null });
      seed.value = draw.seed;
      const catalog = draw.template.catalog;
      $("#draw-era-name").textContent = catalog.era.name;
      $("#draw-era-summary").textContent = catalog.era.description;
      $("#draw-era-meta").textContent =
        draw.type.name + " · " + catalog.era.duration_years + "년";
      $("#draw-era-odds").textContent =
        "유형 " +
        percent(draw.chances.type) +
        " × 유형 내 템플릿 " +
        percent(draw.chances.template) +
        " = 최종 " +
        percent(draw.chances.combined);
      $("#draw-era-replay-key").textContent =
        "추첨 v1 · 후보 v" + draw.poolVersion + " · 시드: " + draw.seed;
      const tasks = $("#draw-era-tasks");
      tasks.replaceChildren();
      catalog.objectives.forEach((o) => {
        const li = document.createElement("li");
        li.textContent = o.name + " · " + o.points + "점";
        tasks.append(li);
      });
      $("#draw-era-outcomes").textContent = catalog.outcomes
        .map((o) => o.min_score + "~" + o.max_score + "점: " + o.world_result)
        .join("\n");
      history.unshift(draw);
      history.splice(5);
      const list = $("#draw-era-history");
      list.replaceChildren();
      history.forEach((d) => {
        const li = document.createElement("li");
        li.textContent =
          d.seed + " → " + d.type.name + " / " + d.template.catalog.era.name;
        list.append(li);
      });
      result.hidden = false;
      $("#draw-era-status").textContent =
        "추첨 완료. 미리보기이며 실제 게임과 저장된 시대 설정은 변경하지 않습니다.";
    } catch (error) {
      $("#draw-era-status").textContent = error.message;
    }
  }
  $("#draw-era-once").onclick = draw;
  $("#draw-era-new").onclick = () => {
    const values = crypto.getRandomValues(new Uint32Array(2));
    seed.value = Array.from(values, (x) =>
      x.toString(16).padStart(8, "0"),
    ).join("");
    draw();
  };
  $("#draw-era-batch").onclick = () => {
    try {
      const sample = sampleEras(seed.value, type.value || null);
      const host = $("#draw-era-distribution");
      host.replaceChildren();
      eraTypes.forEach((t) => {
        const templates = eraTemplates.filter(
          (x) => x.typeId === t.id && Object.hasOwn(sample.counts, x.id),
        );
        if (!templates.length) return;
        const sum = templates.reduce((s, x) => s + sample.counts[x.id], 0);
        const section = document.createElement("div");
        section.className = "draw-distribution-type";
        const title = document.createElement("h3");
        title.textContent =
          t.name + " · " + sum + "회 (" + percent(sum / sample.count) + ")";
        section.append(title);
        templates.forEach((x) => {
          const row = document.createElement("p");
          row.textContent =
            x.catalog.era.name +
            " · " +
            sample.counts[x.id] +
            "회 (" +
            percent(sample.counts[x.id] / sample.count) +
            ")";
          section.append(row);
          const meter = document.createElement("meter");
          meter.min = 0;
          meter.max = sample.count;
          meter.value = sample.counts[x.id];
          meter.setAttribute("aria-label", x.catalog.era.name + " 추첨 횟수");
          section.append(meter);
        });
        host.append(section);
      });
      $("#draw-era-batch-result").hidden = false;
      $("#draw-era-batch-summary").textContent =
        "총 " +
        sample.count +
        "회 · 유형: " +
        (eraTypes.find((t) => t.id === type.value)?.name || "전체 랜덤") +
        " · 시드: " +
        seed.value.trim() +
        " · 후보 v" +
        ERA_POOL_VERSION;
      $("#draw-era-status").textContent =
        "분포 검사 완료. 같은 시드·유형·후보 버전이면 동일한 결과입니다. 횟수와 비율은 전체 1,000회 기준입니다.";
    } catch (error) {
      $("#draw-era-status").textContent = error.message;
    }
  };
}
