import { mountMobileWorld, revealWorldTarget } from "./mobile-world.js";
import { mountEventPopup } from "./event-popup.js";
import { mountEra } from "./era-ui.js";
import { mountLongTraining } from "./long-training-ui.js";
import { ensureCalendar, formatDate, dispatchDueEvent } from "./game/time.js";
import {
  updateTemptation,
  ensureDarkness,
  darkPractice,
  erosionEffects,
} from "./game/darkness.js";
import { mountProgression } from "./progression-ui.js";
import { realms, sectArts, sects, ensureProgress } from "./game/progression.js";
import { loadSave, saveGame } from "./game/storage.js";
import {
  DRAW_RULES,
  origins,
  traits,
  weaknesses,
  defs,
  grades,
  portraitSets,
  startOrigins,
  encounterTypes,
  martialCatalog,
  categoryNames,
  alignments,
  roadEvents,
} from "./game/data.js";
import {
  random,
  grade,
  statFromTicket,
  generate,
  valid,
  kindFromTicket,
  martialPhase,
} from "./game/rules.js";
Object.assign(martialCatalog, sectArts);
const $ = (s) => document.querySelector(s);
const mobileLayout = window.matchMedia("(max-width: 760px)");
const mobileWorld = mountMobileWorld(mobileLayout);

let state;
try {
  state = loadSave();
} catch {}
if (!state || !valid(state.current))
  state = {
    current: generate(),
    saved: null,
    count: 1,
    chosen: null,
    rulesVersion: DRAW_RULES.version,
    drawsUsed: 1,
  };
if (!valid(state.saved)) state.saved = null;
if (!Number.isSafeInteger(state.count) || state.count < 1) state.count = 1;
const migrated = state.rulesVersion !== DRAW_RULES.version;
if (migrated) {
  state.rulesVersion = DRAW_RULES.version;
  state.drawsUsed = 0;
}
if (
  !Number.isInteger(state.drawsUsed) ||
  state.drawsUsed < 0 ||
  state.drawsUsed > DRAW_RULES.limit
)
  state.drawsUsed = DRAW_RULES.limit;
function remaining() {
  return Math.max(0, DRAW_RULES.limit - state.drawsUsed);
}
let busy = false,
  storageWarned = false;
function notify(msg) {
  $("#toast").textContent = msg;
  $("#toast").classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    2800,
  );
}
function persist() {
  try {
    saveGame(state);
  } catch {
    if (!storageWarned) {
      storageWarned = true;
      notify("브라우저 저장이 제한되어 있습니다. 현재 탭에서만 유지됩니다.");
    }
  }
}
function updateBudget() {
  const left = remaining();
  $("#count").textContent = left;
  $("#draw-total").textContent = DRAW_RULES.limit;
  $("#draw-dots").innerHTML = Array.from(
    { length: DRAW_RULES.limit },
    (_, i) => `<i class="${i < state.drawsUsed ? "spent" : "available"}"></i>`,
  ).join("");
  $("#draw-dots").setAttribute(
    "aria-label",
    `총 ${DRAW_RULES.limit}회 중 ${left}회 남음`,
  );
  $("#budget-note").textContent =
    left === 0
      ? "모든 기회를 사용했습니다. 현재 또는 보관한 운명을 선택하세요."
      : migrated && state.drawsUsed === 0
        ? "기존 운명은 유지됩니다. 새 확률로 10회의 기회가 주어졌습니다."
        : `한 생에 주어진 ${DRAW_RULES.limit}번의 기회 · ${left}회 남음`;
  $("#budget-note").classList.toggle("exhausted", left === 0);
  $("#roll").disabled = busy || left === 0;
  if (!busy)
    $("#roll").innerHTML =
      left === 0
        ? "천명이 모두 펼쳐졌습니다"
        : `<span>⟳</span> 운명 다시 굴리기 <small>${left}회 남음</small>`;
}
function render() {
  const f = state.current,
    o = origins[f.origin],
    t = traits.find((t) => t.name === f.trait),
    w = weaknesses.find((w) => w.name === f.weakness);
  updateBudget();
  $("#fate").innerHTML =
    `<div class="identity"><div class="origin-mark">${o.mark}</div><div><div class="origin-title"><h3>${o.name}</h3><span class="tag">${o.tag}</span></div><p>${o.desc}</p></div></div><div class="stat-grid">${defs
      .map((d, i) => {
        const g = grade(f.stats[i]);
        return `<div class="stat"><div class="stat-top"><span class="stat-label">${d[0]}<small>${d[1]}</small></span><span class="stat-value" style="color:${g.color}"><b>${f.stats[i]}</b>${g.name}</span></div><p>${d[2]}</p><div class="bar" role="meter" aria-label="${d[0]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${f.stats[i]}" style="color:${g.color};--width:${f.stats[i]}%"><i></i></div>${state.saved ? `<span class="delta">보관한 운명보다 ${f.stats[i] - state.saved.stats[i] > 0 ? "+" : ""}${f.stats[i] - state.saved.stats[i]}</span>` : ""}</div>`;
      })
      .join(
        "",
      )}</div><div class="talents"><span class="talent">${t.type === "rare" ? "✦ 희귀 재능" : "✧ 선천 재능"} · ${t.name}</span>${w ? `<span class="talent negative">◈ 시련 · ${w.name}</span>` : ""}</div><div class="reading">“${t.desc}”<small>${t.path}${w ? `<br>${w.desc}` : ""}</small></div>`;
  $("#keep").textContent = state.saved
    ? "＋ 현재 운명으로 교체"
    : "＋ 이 운명 보관";
  $("#saved").innerHTML = state.saved
    ? renderSaved()
    : `<div class="empty"><span>◇</span><p>아직 붙잡아 둔 운명이 없습니다.</p><small>마음에 드는 운명을 보관하고 비교해보세요.</small></div>`;
  if (state.saved) {
    $("#swap").onclick = () => {
      if (busy) return;
      [state.current, state.saved] = [state.saved, state.current];
      render();
      persist();
      notify("보관한 운명을 불러왔습니다. 이전 결과도 보관했습니다.");
    };
    $("#remove").onclick = () => {
      if (busy) return;
      state.saved = null;
      render();
      persist();
      notify("보관한 운명을 비웠습니다.");
    };
  }
}
function renderSaved() {
  const f = state.saved,
    o = origins[f.origin];
  return `<div class="saved-content"><h3>${o.name}</h3><span class="tag">${f.trait}</span><div class="mini-stats">${defs.map((d, i) => `<span>${d[0]} <b>${f.stats[i]} · ${grade(f.stats[i]).name}</b></span>`).join("")}</div><div class="saved-buttons"><button id="swap">⇄ 불러와 비교</button><button id="remove">보관 비우기</button></div></div>`;
}
const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let soundEnabled = false,
  audio = null,
  rollTimers = [],
  activeFinish = null;
function tone(freq, duration = 0.18, volume = 0.045) {
  if (!soundEnabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = audio || new AC();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audio.currentTime);
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.linearRampToValueAtTime(volume, audio.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {}
}
$("#sound").onclick = () => {
  soundEnabled = !soundEnabled;
  $("#sound").textContent = soundEnabled ? "♪ 효과음 켜짐" : "♪ 효과음 꺼짐";
  $("#sound").setAttribute("aria-pressed", String(soundEnabled));
  if (soundEnabled) tone(440);
};
function tierOf(f) {
  if (traits.find((t) => t.name === f.trait).type === "rare") return "legend";
  const max = Math.max(...f.stats);
  return max >= 95
    ? "gold"
    : max >= 85
      ? "violet"
      : max >= 70
        ? "jade"
        : "plain";
}
const tierInfo = {
  plain: ["기운이 모습을 드러냅니다", "#acb69b"],
  jade: ["비범한 기운이 느껴집니다", "#87cbb7"],
  violet: ["탁월한 재능이 깨어납니다", "#c7a0f2"],
  gold: ["천재의 별이 떠오릅니다", "#f0cd77"],
  legend: ["하늘이 내린 인연 · 희귀 재능", "#ffd788"],
};
function burst(tier) {
  const host = $("#particles");
  host.replaceChildren();
  if (reduced()) return;
  const color = tierInfo[tier][1],
    n =
      tier === "legend"
        ? 90
        : tier === "gold"
          ? 65
          : tier === "violet"
            ? 40
            : 18;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("i"),
      angle = (i / n) * Math.PI * 2,
      dist = 75 + random(tier === "legend" ? 260 : 170);
    el.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    el.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    el.style.setProperty("--spark", color);
    el.style.setProperty("--delay", random(200) + "ms");
    el.style.setProperty("--size", 2 + random(4) + "px");
    host.append(el);
  }
  host.className = "burst " + tier;
}
let cinemaTimer = null;
function cinema(mode, tier = "plain", f = null) {
  const host = $("#cinema");
  clearTimeout(cinemaTimer);
  host.className = "";
  host.dataset.tier = tier;
  host.style.setProperty("--cinema-color", tierInfo[tier][1]);
  if (mode === "off" || reduced()) {
    return;
  }
  void host.offsetWidth;
  host.className = mode;
  const peak = mode === "awakening";
  $("#cinema-kicker").textContent = peak
    ? tier === "legend"
      ? "天賜奇緣 · LEGENDARY AWAKENING"
      : tier === "gold"
        ? "天縱之才 · GENIUS AWAKENING"
        : "紫氣東來 · EXTRAORDINARY"
    : "凝氣聚神 · DESTINY IS CALLING";
  $("#cinema-title").textContent = peak
    ? tier === "legend"
      ? f.trait
      : tier === "gold"
        ? "天縱之才"
        : "卓 爾 不 群"
    : "天 命";
  $("#cinema-sub").textContent = peak
    ? tier === "legend"
      ? "千萬人中，唯你得此天賜之緣"
      : tier === "gold"
        ? "天生不凡 · 千里挑一的武道之資"
        : "紫氣凝聚 · 非凡的武道之資"
    : "萬般皆有定，一念入江湖";
  const sparks = $(".cinema-particles");
  sparks.replaceChildren();
  const count = peak ? 64 : 36;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("i");
    const angle = (i / count) * Math.PI * 2,
      dist = 120 + random(400);
    el.style.setProperty("--x", Math.cos(angle) * dist + "px");
    el.style.setProperty("--y", Math.sin(angle) * dist + "px");
    el.style.setProperty("--d", random(500) + "ms");
    el.style.setProperty("--r", random(360) + "deg");
    sparks.append(el);
  }
  if (peak)
    cinemaTimer = setTimeout(
      () => {
        host.className = "";
      },
      tier === "legend" ? 2400 : 1900,
    );
}
function resonance(el, rank) {
  if (reduced()) return;
  el.classList.remove("resonating");
  void el.offsetWidth;
  el.classList.add("resonating");
  if (rank === "gold") {
    tone(1046, 0.45, 0.035);
    const line = document.createElement("span");
    line.className = "sword-light";
    el.append(line);
  }
}
function roll() {
  if (state.encounter) {
    notify("이미 시작 인연을 만났습니다. 이 인물의 여정을 이어가세요.");
    return;
  }
  if (busy) return;
  if (remaining() === 0) {
    notify("기회를 모두 사용했습니다. 현재 또는 보관한 운명을 선택해주세요.");
    return;
  }
  busy = true;
  const panel = $(".fate-panel"),
    cover = $("#summon-cover"),
    banner = $("#reveal-banner"),
    result = generate(),
    tier = tierOf(result);
  const wait = reduced() ? 20 : 1550;
  cinema("summoning");
  $("#roll").disabled = $("#keep").disabled = $("#choose").disabled = true;
  $("#skip").hidden = false;
  $("#fate").setAttribute("aria-live", "off");
  $("#roll").innerHTML = '<span class="spinning">⟳</span> 천명을 읽는 중…';
  panel.dataset.tier = "plain";
  panel.classList.remove("impact", "pre-awaken");
  panel.classList.add("gathering");
  cover.classList.add("visible");
  cover.setAttribute("aria-hidden", "false");
  banner.className = "";
  banner.textContent = "";
  $("#particles").replaceChildren();
  $("#summon-status").textContent = "凝氣 · 흩어진 기운을 모으는 중";
  tone(146, 0.65, 0.035);
  function later(fn, ms) {
    rollTimers.push(setTimeout(fn, ms));
  }
  function showStat(i) {
    const el = $("#fate").querySelectorAll(".stat")[i];
    el.classList.remove("unrevealed");
    el.classList.add("stat-arrive");
    el.removeAttribute("aria-hidden");
    const g = grade(result.stats[i]);
    el.style.setProperty("--rank-color", g.color);
    el.dataset.rank =
      result.stats[i] >= 95
        ? "gold"
        : result.stats[i] >= 85
          ? "violet"
          : result.stats[i] >= 70
            ? "jade"
            : "plain";
    tone([261, 329, 392, 523][i], 0.24, result.stats[i] >= 85 ? 0.07 : 0.035);
    resonance(el, el.dataset.rank);
    $("#summon-status").textContent = defs[i][0] + " · " + g.name + "의 기운";
  }
  function finish(skipped = false) {
    if (!busy) return;
    rollTimers.forEach(clearTimeout);
    rollTimers = [];
    cover.classList.remove("visible");
    cover.setAttribute("aria-hidden", "true");
    panel.classList.remove("gathering", "revealing", "pre-awaken");
    panel.dataset.tier = tier;
    $("#fate")
      .querySelectorAll(".unrevealed")
      .forEach((el) => {
        el.classList.remove("unrevealed");
        el.removeAttribute("aria-hidden");
      });
    $("#fate").setAttribute("aria-live", "polite");
    banner.textContent = tierInfo[tier][0];
    banner.className = "shown " + tier;
    panel.classList.remove("impact");
    void panel.offsetWidth;
    panel.classList.add("impact");
    burst(tier);
    if (!skipped && ["violet", "gold", "legend"].includes(tier))
      cinema("awakening", tier, result);
    else cinema("off");
    $("#summon-status").textContent =
      tier === "legend"
        ? "天賜奇緣 · " + result.trait + " 각성"
        : tierInfo[tier][0];
    if (!skipped) {
      tone(tier === "legend" ? 880 : tier === "gold" ? 784 : 659, 0.7, 0.06);
      if (tier === "gold" || tier === "legend")
        setTimeout(() => tone(1046, 0.8, 0.04), 140);
    }
    busy = false;
    activeFinish = null;
    $("#roll").disabled = $("#keep").disabled = $("#choose").disabled = false;
    $("#skip").hidden = true;
    updateBudget();
    if (tier === "legend")
      notify("✦ 희귀 재능 「" + result.trait + "」이 깨어났습니다!");
  }
  activeFinish = () => finish(true);
  state.current = result;
  state.count++;
  state.drawsUsed++;
  persist();
  updateBudget();
  later(() => {
    cinema("off");
    render();
    cover.classList.remove("visible");
    cover.setAttribute("aria-hidden", "true");
    panel.classList.remove("gathering");
    panel.classList.add("revealing");
    $("#fate")
      .querySelectorAll(".stat,.talents,.reading")
      .forEach((el) => {
        el.classList.add("unrevealed");
        el.setAttribute("aria-hidden", "true");
      });
    $("#summon-status").textContent = "開命 · 당신의 재능을 펼칩니다";
    defs.forEach((_, i) =>
      later(() => showStat(i), reduced() ? i * 20 : 180 + i * 480),
    );
    later(
      () => {
        const talents = $("#fate .talents");
        talents.classList.remove("unrevealed");
        talents.removeAttribute("aria-hidden");
        talents.classList.add("talent-arrive");
        if (tier === "legend") {
          panel.dataset.tier = "legend";
          panel.classList.add("pre-awaken");
          $("#summon-status").textContent = "… 평범하지 않은 기운이 밀려옵니다";
          tone(196, 0.7, 0.045);
        }
      },
      reduced() ? 100 : 2200,
    );
    later(
      () => finish(false),
      reduced() ? 130 : tier === "legend" ? 3200 : 2650,
    );
  }, wait);
}
$("#skip").onclick = () => {
  if (!busy) return;
  render();
  activeFinish?.();
};
$("#roll").onclick = roll;
$("#keep").onclick = () => {
  if (busy) return;
  state.saved = structuredClone(state.current);
  render();
  persist();
  notify(
    remaining() > 0
      ? "이 운명을 보관했습니다. 남은 기회로 다시 도전할 수 있습니다."
      : "이 운명을 보관했습니다. 두 결과 중 마음에 드는 인물을 선택하세요.",
  );
};
$("#choose").onclick = () => {
  if (busy) return;
  openCharacter(state.current);
};
$(".close").onclick = $(".close-action").onclick = () => $("#dialog").close();
document.addEventListener("keydown", (e) => {
  if (
    (!state.screen || state.screen === "fate") &&
    e.code === "Space" &&
    !e.repeat &&
    !$("#dialog").open &&
    !["BUTTON", "INPUT", "TEXTAREA", "SELECT", "A"].includes(
      document.activeElement.tagName,
    )
  ) {
    e.preventDefault();
    roll();
  }
});
render();
persist();

$("#probability-body").innerHTML = DRAW_RULES.bands
  .slice()
  .reverse()
  .map(
    (b) =>
      `<tr><td style="color:${grade(b.min).color}">${b.name}</td><td>${b.min}–${b.max}</td><td>${b.weight}%</td></tr>`,
  )
  .join("");
$("#rare-rate").textContent = DRAW_RULES.rarePercent + "%";

const validProfile = (p) =>
  p &&
  ["male", "female"].includes(p.gender) &&
  portraitSets.some((s) => s.id === p.portraitId) &&
  typeof p.name === "string";
let characterDraft =
  validProfile(state.characterDraft) && valid(state.characterDraft.fate)
    ? structuredClone(state.characterDraft)
    : {
        gender: "male",
        portraitId: "qingfeng",
        name: "",
        fate: structuredClone(state.current),
      };
function escapeText(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function portraitPosition(p) {
  const set = portraitSets.find((s) => s.id === p.portraitId);
  return `${set.column * 50}% ${p.gender === "female" ? 100 : 0}%`;
}
function saveDraft() {
  state.characterDraft = structuredClone(characterDraft);
  persist();
}
function updateNamePreview() {
  $("#name-preview").textContent =
    characterDraft.name.trim() || "이름 없는 무인";
}
function renderCharacter() {
  const set = portraitSets.find((s) => s.id === characterDraft.portraitId);
  $("#character-name").value = characterDraft.name;
  updateNamePreview();
  $("#portrait-preview").style.backgroundPosition =
    portraitPosition(characterDraft);
  $("#portrait-preview").setAttribute(
    "aria-label",
    `${characterDraft.gender === "female" ? "여성" : "남성"} 초상화 · ${set.name} · ${set.tag}`,
  );
  $("#portrait-style-label").textContent = set.han + " · " + set.name;
  $("#portrait-description").textContent = set.desc;
  document
    .querySelectorAll("[data-gender]")
    .forEach((btn) =>
      btn.setAttribute(
        "aria-pressed",
        String(btn.dataset.gender === characterDraft.gender),
      ),
    );
  $("#portrait-options").innerHTML = portraitSets
    .map(
      (s) =>
        `<button class="portrait-option ${s.id === characterDraft.portraitId ? "selected" : ""}" data-portrait="${s.id}" aria-pressed="${s.id === characterDraft.portraitId}" aria-label="${s.name} · ${s.tag}"><span class="portrait-art thumbnail" style="background-position:${s.column * 50}% ${characterDraft.gender === "female" ? 100 : 0}%"></span><span class="portrait-choice-name">${s.name}<small>${s.han}</small></span><span class="portrait-choice-tag">${s.tag}</span><span class="portrait-check" aria-hidden="true">✓</span></button>`,
    )
    .join("");
  document.querySelectorAll("[data-portrait]").forEach(
    (btn) =>
      (btn.onclick = () => {
        characterDraft.portraitId = btn.dataset.portrait;
        renderCharacter();
        saveDraft();
        tone(523, 0.12, 0.025);
      }),
  );
  const f = characterDraft.fate;
  $("#character-fate-summary").innerHTML =
    `<div class="profile-origin"><small>이미 정해진 천명</small><strong>${origins[f.origin].name}</strong><span>✧ ${f.trait}</span></div><div class="profile-stats">${defs.map((d, i) => `<div><small>${d[0]}</small><b style="color:${grade(f.stats[i]).color}">${f.stats[i]}</b></div>`).join("")}</div>`;
  $("#character-saved-note").textContent =
    state.character && state.chosen?.id === f.id
      ? "저장된 인물입니다. 외모와 이름을 바꾼 뒤 다시 저장할 수 있습니다."
      : "";
}
function openCharacter(fate) {
  if (state.encounter) {
    openEncounter();
    return;
  }
  cinema("off");
  if (characterDraft.fate.id !== fate.id)
    characterDraft.fate = structuredClone(fate);
  state.screen = "character";
  $("#nav-fate").classList.remove("active");
  $("#nav-character").classList.add("active");
  $("#nav-character").classList.remove("locked");
  $("#fate-screen").hidden = true;
  $("#character-screen").hidden = false;
  renderCharacter();
  saveDraft();
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#character-title").setAttribute("tabindex", "-1");
  $("#character-title").focus({ preventScroll: true });
}
$("#back-fate").onclick = () => {
  if (state.encounter) {
    openEncounter();
    return;
  }
  state.screen = "fate";
  $("#nav-fate").classList.add("active");
  $("#nav-character").classList.remove("active");
  $("#nav-character").classList.add("locked");
  saveDraft();
  $("#character-screen").hidden = true;
  $("#fate-screen").hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#choose").focus();
};
document.querySelectorAll("[data-gender]").forEach(
  (btn) =>
    (btn.onclick = () => {
      characterDraft.gender = btn.dataset.gender;
      renderCharacter();
      saveDraft();
    }),
);
$("#character-name").addEventListener("input", (e) => {
  characterDraft.name = e.target.value;
  $("#name-error").textContent = "";
  $("#character-name").removeAttribute("aria-invalid");
  updateNamePreview();
  saveDraft();
});
$("#random-name").onclick = () => {
  const surnames = ["백", "진", "서", "유", "한", "윤", "하", "연", "남궁"];
  const given =
    characterDraft.gender === "female"
      ? ["서린", "하연", "소월", "청하", "설영", "유란"]
      : ["무진", "서준", "운", "도윤", "청운", "하진"];
  characterDraft.name =
    surnames[random(surnames.length)] + given[random(given.length)];
  $("#name-error").textContent = "";
  $("#character-name").removeAttribute("aria-invalid");
  renderCharacter();
  saveDraft();
};
$("#confirm-character").onclick = () => {
  if (state.encounter) {
    openEncounter();
    return;
  }
  const name = characterDraft.name.trim(),
    length = Array.from(name).length;
  if (length < 2 || length > 12) {
    $("#name-error").textContent = "이름을 2–12자로 입력해주세요.";
    $("#character-name").setAttribute("aria-invalid", "true");
    $("#character-name").focus();
    return;
  }
  characterDraft.name = name;
  state.chosen = structuredClone(characterDraft.fate);
  state.character = {
    name,
    gender: characterDraft.gender,
    portraitId: characterDraft.portraitId,
  };
  saveDraft();
  openEncounter();
};

function makeEncounter() {
  const kind = kindFromTicket(random(100)),
    list = encounterTypes[kind].variants;
  return {
    kind,
    variant: list[random(list.length)].id,
    fateId: state.chosen.id,
  };
}
function encounterDetails() {
  const table = encounterTypes[state.encounter.kind];
  return {
    ...table,
    ...table.variants.find((v) => v.id === state.encounter.variant),
  };
}
function switchScreen(id) {
  [
    "fate-screen",
    "character-screen",
    "encounter-screen",
    "world-screen",
  ].forEach((s) => ($("#" + s).hidden = s !== id));
  window.scrollTo({ top: 0, behavior: "instant" });
}
function openEncounter() {
  if (!validProfile(state.character) || !valid(state.chosen)) return;
  state.screen = "encounter";
  switchScreen("encounter-screen");
  cinema("off");
  $("#encounter-portrait").style.backgroundPosition = portraitPosition(
    state.character,
  );
  $("#encounter-name").textContent = state.character.name;
  $("#encounter-origin").textContent = origins[state.chosen.origin].name;
  $("#encounter-intro").textContent = startOrigins[state.chosen.origin].intro;
  $("#encounter-before").hidden = !!state.encounter;
  $("#encounter-result").hidden = !state.encounter;
  if (state.encounter) renderEncounter();
  persist();
}
function renderEncounter() {
  const e = encounterDetails();
  $("#encounter-screen").dataset.kind = state.encounter.kind;
  $("#encounter-rank").textContent = e.label;
  $("#encounter-result-title").textContent = e.title;
  $("#encounter-story").textContent =
    startOrigins[state.chosen.origin].intro + "\n\n" + e.story;
  $("#encounter-rewards").innerHTML =
    `<small>이번 인연이 남긴 것</small><strong>${e.item || "어디에도 얽매이지 않은 첫걸음"}</strong><span>${e.bonus}</span>`;
  $("#encounter-future").textContent = e.future;
  $("#enter-world").innerHTML =
    state.journey?.turn > 0
      ? "나의 여정 이어가기 <span>↗</span>"
      : "첫날 아침을 맞이하기 <span>↗</span>";
  $("#draw-encounter").disabled = !!state.encounter;
}
function makeJourney() {
  const o = startOrigins[state.chosen.origin],
    e = encounterDetails();
  const journey = {
    turn: 0,
    money: o.money + (e.id === "medicine" ? 15 : 0),
    food: o.food,
    energy: 100,
    inner: e.id === "meridian" ? 8 : 0,
    mastery: o.mastery,
    clues: 0,
    items: [...o.items, ...(e.item ? [e.item] : [])],
    log: [
      {
        time: "서장",
        text: `${e.title}. ${e.item ? "「" + e.item + "」을 얻었습니다." : "스스로 길을 개척할 준비를 마쳤습니다."}`,
      },
    ],
    decoded: false,
  };
  initializeArts(journey, false);
  return journey;
}
let encounterBusy = false;
$("#draw-encounter").onclick = () => {
  if (
    encounterBusy ||
    state.encounter ||
    !validProfile(state.character) ||
    !valid(state.chosen)
  )
    return;
  encounterBusy = true;
  state.encounter = makeEncounter();
  state.journey = makeJourney();
  state.screen = "encounter";
  persist();
  $("#draw-encounter").disabled = true;
  $("#encounter-back").disabled = true;
  $("#draw-encounter").textContent = "당신의 인연을 펼치는 중…";
  cinema("summoning");
  tone(196, 0.8, 0.035);
  setTimeout(
    () => {
      const e = encounterDetails();
      $("#encounter-before").hidden = true;
      $("#encounter-result").hidden = false;
      renderEncounter();
      cinema(state.encounter.kind === "major" ? "awakening" : "off", e.tier, {
        trait: e.title,
      });
      tone(state.encounter.kind === "major" ? 880 : 523, 0.6, 0.04);
      encounterBusy = false;
      $("#encounter-back").disabled = false;
    },
    reduced() ? 30 : 1800,
  );
};
$("#encounter-back").onclick = () => {
  if (state.encounter || encounterBusy) return;
  openCharacter(state.chosen);
};
$("#enter-world").onclick = () => {
  if (state.encounter && state.journey) openWorld();
};
$("#review-encounter").onclick = openEncounter;
function addLog(text, time) {
  const j = state.journey;
  j.log.unshift({ time, text });
  j.log = j.log.slice(0, 40);
}

function initializeArts(j, legacy) {
  if (j.artVersion === 1) return;
  const oldMastery = Math.max(0, Number(j.mastery) || 0),
    e = encounterDetails();
  j.arts = {};
  const give = (id, status, xp = 0) =>
    (j.arts[id] = {
      status,
      xp: Math.min(100, xp),
      decodeProgress: status === "owned" ? 0 : 100,
      chapter: 1,
    });
  if (state.chosen.origin === 0) give("familySword", "learned", 8);
  if (state.chosen.origin === 4) {
    give("sword", "learned", 10);
    give("basicBreath", "learned", 5);
  }
  if (e.id === "mentor") give("qingxu", "learned");
  if (e.id === "scroll") give("nameless", "owned");
  j.activeMind =
    e.id === "mentor" ? "qingxu" : j.arts.basicBreath ? "basicBreath" : null;
  j.trainingArt = j.arts.familySword
    ? "familySword"
    : j.arts.sword
      ? "sword"
      : null;
  if (legacy) {
    if (oldMastery > 0) {
      const attack = j.trainingArt || "liuhe";
      if (!j.arts[attack]) give(attack, "learned");
      j.arts[attack].xp = Math.min(
        100,
        Math.max(j.arts[attack].xp, oldMastery),
      );
      j.trainingArt = attack;
    }
    if (j.inner > (e.id === "meridian" ? 8 : 0)) {
      if (!j.activeMind) {
        give("basicBreath", "learned");
        j.activeMind = "basicBreath";
      }
      j.arts[j.activeMind].xp = Math.min(
        100,
        Math.max(j.arts[j.activeMind].xp, Math.floor(j.inner * 1.5)),
      );
    }
    if (j.decoded && (e.id === "mentor" || e.id === "scroll")) {
      const id = e.id === "mentor" ? "qingxu" : "nameless";
      give(id, "learned", Math.max(30, j.arts[id]?.xp || 0));
      j.arts[id].chapter = 2;
    }
    j.log.unshift({
      time: "수련 기록 정리",
      text: "기존 수련 기록을 무공별 숙련도로 옮겼습니다. 자금·내공·진행 날짜와 기연은 유지됩니다.",
    });
  }
  j.artVersion = 1;
  syncMartial(j);
}
function syncMartial(j) {
  const known = Object.entries(j.arts).filter(
    ([id, a]) =>
      a.status === "learned" && martialCatalog[id]?.category === "attack",
  );
  j.mastery = Math.max(0, ...known.map(([, a]) => a.xp));
}
function selectedTraining(j = state.journey) {
  return j.trainingArt && j.arts[j.trainingArt]?.status === "learned"
    ? martialCatalog[j.trainingArt]
    : null;
}
function activeMind(j = state.journey) {
  return j.activeMind && j.arts[j.activeMind]?.status === "learned"
    ? martialCatalog[j.activeMind]
    : null;
}
function finishWorldTurn(text) {
  const j = state.journey;
  ensureAlignment(j);
  const time = formatDate(j.turn);
  j.turn++;
  addLog(text, time);
  if (j.turn % 2 === 0) {
    if (j.food > 0) {
      j.food--;
      j.energy = Math.min(100, j.energy + 20);
      addLog(
        "밤사이 식량 1을 먹고 쉬었습니다. 기력 최대 20 회복.",
        formatDate(j.turn - 1).replace("오후", "밤"),
      );
    } else
      addLog(
        "식량이 떨어져 밤에 충분히 회복하지 못했습니다. 시장에서 식량을 구하세요.",
        formatDate(j.turn - 1).replace("오후", "밤"),
      );
  }
  syncMartial(j);
  if (!dispatchDueEvent(j, () => maybeRoadEvent(true))) maybeRoadEvent();
  if (j.turn === 14)
    addLog(
      "첫 일주일을 마쳤습니다. 익힌 무공과 인연을 바탕으로 이제 문파를 방문해 입문 시험을 치르거나 독행을 이어갈 수 있습니다.",
      "첫 여정 완료",
    );
  persist();
  renderWorld();
}
function gainMartial(id, amount) {
  const j = state.journey,
    a = j.arts[id],
    before = a.xp;
  a.xp = Math.min(100, a.xp + amount);
  if ((id === "qingxu" || id === "nameless") && a.xp >= 30 && a.chapter === 1) {
    a.chapter = 2;
    j.decoded = true;
    j.inner += 5;
    addLog(
      `${martialCatalog[id].name} 숙련도 30에 도달해 다음 ${id === "qingxu" ? "구결" : "장"}을 이해했습니다. 내공 +5. 깊은 전승은 이후 여정에서 이어집니다.`,
      "깨달음",
    );
  }
  return a.xp - before;
}
function martialOperation(id, operation) {
  const j = state.journey,
    c = martialCatalog[id];
  if (!j || !c || state.screen !== "world") return;
  if (j.pendingEvent || progression.locked()) {
    notify("먼저 눈앞의 사건에서 선택해주세요.");
    return;
  }
  const a = j.arts[id];
  if (operation === "equip") {
    if (a?.status !== "learned") return;
    if (c.category === "mind") j.activeMind = id;
    else j.trainingArt = id;
    persist();
    renderWorld();
    return;
  }

  if (operation === "dojo") {
    ensureAcademy(j);
    if (!j.academy.enrolled) {
      notify("먼저 청계학관에 입학해야 기초 무공을 선택할 수 있습니다.");
      return;
    }
    if (!c.dojo || a?.status === "learned") return;
    const cost = 0;
    if (j.money < cost) {
      notify(`학관 입학에 은전 ${cost}가 필요합니다.`);
      return;
    }
    if (j.energy < 8) {
      notify("기력 8이 필요합니다. 먼저 쉬어주세요.");
      return;
    }
    j.money -= cost;
    j.energy -= 8;
    j.arts[id] = { status: "learned", xp: 0, decodeProgress: 100, chapter: 1 };
    if (c.category === "mind") j.activeMind = id;
    else j.trainingArt = id;
    finishWorldTurn(
      `청계학관에서 ${c.name}을 배웠습니다. ${cost ? "은전 −" + cost + " · " : ""}기력 −8. 이제 직접 수련할 수 있습니다.`,
    );
  } else if (operation === "decode") {
    if (a?.status !== "owned") return;
    if (j.energy < 6) {
      notify("해독에 기력 6이 필요합니다.");
      return;
    }
    j.energy -= 6;
    a.decodeProgress = Math.min(
      100,
      a.decodeProgress + 25 + Math.floor(state.chosen.stats[1] / 3),
    );
    if (a.decodeProgress === 100) a.status = "decoded";
    finishWorldTurn(
      `${c.name} 비급을 해독했습니다. 해독 ${a.decodeProgress}/100 · 기력 −6.${a.status === "decoded" ? " 구결을 이해했습니다. 이제 습득할 수 있습니다." : ""}`,
    );
  } else if (operation === "learn") {
    if (a?.status !== "decoded") return;
    if (j.energy < 8) {
      notify("무공 습득에 기력 8이 필요합니다.");
      return;
    }
    j.energy -= 8;
    a.status = "learned";
    if (c.category === "mind") j.activeMind = id;
    else j.trainingArt = id;
    finishWorldTurn(
      `${c.name}의 첫 구결을 몸에 익혔습니다. 기력 −8. 수련할 무공으로 선택했습니다.`,
    );
  }
}
function worldAction(kind) {
  const j = state.journey;
  if (!j || !state.encounter || state.screen !== "world") return;
  if (j.pendingEvent || progression.locked()) {
    notify("먼저 눈앞의 사건에서 선택해주세요.");
    return;
  }
  const f = state.chosen,
    e = encounterDetails();
  let text = "";
  if (kind === "train") {
    const c = selectedTraining();
    if (!c) {
      notify("먼저 학관에 입학해 무공을 배우거나 보유 비급을 습득해주세요.");
      revealWorldTarget($("#martial-panel"));
      $("#martial-panel").scrollIntoView({
        behavior: reduced() ? "instant" : "smooth",
        block: "start",
      });
      return;
    }
    const cost = e.id === "letter" ? 14 : 18;
    if (j.energy < cost) {
      notify("기력이 부족합니다. 객잔에서 쉬어주세요.");
      return;
    }
    const id = j.trainingArt,
      attribute =
        c.category === "move"
          ? f.stats[3] * 2
          : c.category === "body"
            ? f.stats[0] * 2
            : f.stats[0] + f.stats[1],
      bonus = id === "nameless" ? 3 : 0;
    const amount =
      3 +
      Math.floor(attribute / 45) +
      bonus +
      (e.id === "blade" && c.category === "attack" ? 1 : 0) +
      (f.trait === "천무지체" ? 2 : 0);
    j.energy -= cost;
    const darkGain = darkPractice(j, id);
    j.inner += darkGain;
    const gain = gainMartial(id, amount);
    text = `${c.name}을 수련했습니다. ${c.category === "mind" ? "심법" : "숙련도"} +${gain} (${j.arts[id].xp}/100 · ${martialPhase(j.arts[id].xp)}), 기력 −${cost}${c.dark ? " · 마공 침식 발생" : ""}.`;
  } else if (kind === "breathe") {
    const c = activeMind();
    if (!c) {
      notify("운기조식을 하려면 심법을 먼저 배워야 합니다.");
      revealWorldTarget($("#martial-panel"));
      $("#martial-panel").scrollIntoView({
        behavior: reduced() ? "instant" : "smooth",
        block: "start",
      });
      return;
    }
    if (j.energy < 10) {
      notify("기력이 부족합니다. 먼저 휴식하세요.");
      return;
    }
    const gain =
      (j.activeMind === "wudangMind"
        ? 2
        : ["huashanMind", "shaolinMind"].includes(j.activeMind)
          ? 1
          : 0) +
      2 +
      Math.floor(f.stats[2] / 30) +
      (e.id === "meridian" ? 3 : 0) +
      (j.activeMind === "qingxu" ? 2 : 0) +
      (f.trait === "명경지수" ? 1 : 0);
    const darkGain = darkPractice(j, j.activeMind);
    j.inner += gain + darkGain;
    j.energy -= 10;
    const xp = gainMartial(j.activeMind, 3 + Math.floor(f.stats[1] / 25));
    text = `${c.name}으로 운기조식했습니다. 심법 숙련도 +${xp}, 내공량 +${gain + darkGain}, 기력 −10${c.dark ? " · 마공 침식 발생" : ""}.`;
  } else if (kind === "work") {
    if (j.energy < 16) {
      notify("기력이 부족합니다. 먼저 휴식하세요.");
      return;
    }
    const gain = 10 + Math.floor(f.stats[0] / 15);
    j.money += gain;
    j.energy -= 16;
    text = `장터의 짐을 나르고 품삯을 받았습니다. 은전 +${gain}, 기력 −16.`;
  } else if (kind === "explore") {
    if (j.energy < 20) {
      notify("기력이 부족합니다. 먼저 휴식하세요.");
      return;
    }
    j.energy -= 20;
    const hit = random(100) < 25 + Math.floor(f.stats[3] / 10);
    if (hit) {
      j.clues++;
      text =
        "산길의 오래된 표식과 약초꾼의 이야기를 연결했습니다. 강호의 단서 +1, 기력 −20.";
    } else {
      j.food++;
      text = "특별한 만남은 없었지만 산열매를 챙겼습니다. 식량 +1, 기력 −20.";
    }
  } else if (kind === "rest") {
    const heal =
      (e.id === "medicine" ? 45 : 35) -
      erosionEffects(ensureDarkness(j).erosion).restPenalty;
    j.energy = Math.min(100, j.energy + heal);
    text = `객잔 처마 아래에서 충분히 쉬었습니다. 기력 최대 ${heal} 회복.`;
  } else return;
  finishWorldTurn(text);
}
function buyFood() {
  const j = state.journey;
  if (!j || state.screen !== "world") return;
  if (j.pendingEvent || progression.locked()) {
    notify("먼저 눈앞의 사건에서 선택해주세요.");
    return;
  }
  if (j.money < 5) {
    notify("은전 5가 필요합니다. 품팔이로 돈을 모아보세요.");
    return;
  }
  j.money -= 5;
  j.food += 3;
  addLog(
    "시장에서 식량 3을 구입했습니다. 은전 −5. 시간은 흐르지 않습니다.",
    "장보기",
  );
  persist();
  renderWorld();
}
function openWorld() {
  if (!state.journey || !state.encounter) return;
  initializeArts(state.journey, true);
  ensureAcademy(state.journey);
  ensureAlignment(state.journey);
  cinema("off");
  state.screen = "world";
  switchScreen("world-screen");
  renderWorld();
  persist();
}
function ensureAcademy(j) {
  if (j.academy && typeof j.academy.enrolled === "boolean") return;
  const recorded = j.log.some((l) => /청계[무학]관에서 .*배웠/.test(l.text));
  const acquired = Object.entries(j.arts).some(
    ([id, a]) =>
      martialCatalog[id]?.dojo &&
      a.status === "learned" &&
      !(state.chosen.origin === 4 && ["sword", "basicBreath"].includes(id)),
  );
  j.academy = {
    enrolled: recorded || acquired,
    enrolledTurn: recorded || acquired ? 0 : null,
  };
}
function academyCard() {
  const j = state.journey,
    cost = encounterDetails().id === "letter" ? 0 : 5;
  return j.academy.enrolled
    ? `<div class="academy-card enrolled"><span class="academy-mark">學</span><div><small>청계학관 · 재학 중</small><h3>학관 수강 과목</h3><p>입학금 납부 완료 · 기초 수업료 없음<br>과목 습득마다 행동 1회·기력 8 소모. 문파 소속과는 별개입니다.</p></div></div>`
    : `<div class="academy-card"><span class="academy-mark">學</span><div><small>청계학관 · 입학 안내</small><h3>무공을 배우기 위한 첫걸음</h3><p>입학해야 기초 무공과 심법의 수강 과목을 고를 수 있습니다.<br>입학금 ${cost ? "은전 5" : "면제 · 추천서 보유"} · 행동 1회 · 기력 8<br>출생·성향 제한 없음. 입학은 문파 가입과 별개입니다.</p><button id="enroll-academy" ${j.pendingEvent || progression.locked() ? "disabled" : ""}>${`청계학관 입학하기${cost ? " · 5닢" : " · 입학금 면제"}`}</button><small class="academy-own">가전 무공과 기연의 전승은 입학 없이도 해독·습득·수련할 수 있습니다.</small></div></div>`;
}
function enrollAcademy() {
  const j = state.journey;
  if (!j || state.screen !== "world") return;
  ensureAcademy(j);
  if (j.academy.enrolled) return;
  if (j.pendingEvent || progression.locked()) {
    notify("먼저 돌발 사건의 선택을 마쳐주세요.");
    return;
  }
  const cost = encounterDetails().id === "letter" ? 0 : 5;
  if (j.money < cost) {
    notify("입학금 은전 5가 부족합니다. 품팔이로 마련해보세요.");
    return;
  }
  if (j.energy < 8) {
    notify("입학 절차에 기력 8이 필요합니다. 먼저 쉬어주세요.");
    return;
  }
  j.money -= cost;
  j.energy -= 8;
  j.academy = { enrolled: true, enrolledTurn: j.turn + 1 };
  finishWorldTurn(
    `청계학관에 정식 입학했습니다. ${cost ? "입학금 은전 −5" : "추천서로 입학금 면제"} · 기력 −8. 이제 수강할 무공과 심법을 고를 수 있습니다.`,
  );
  if (!j.pendingEvent) {
    revealWorldTarget($("#martial-panel"));
    $("#martial-panel").scrollIntoView({
      behavior: reduced() ? "instant" : "smooth",
      block: "start",
    });
  }
}
function renderMartial() {
  const j = state.journey;
  ensureAcademy(j);
  const c = selectedTraining(),
    mind = activeMind(),
    done = progression.locked();
  $("#martial-panel").innerHTML =
    `<div class="martial-heading"><div><span class="eyebrow">THE ARTS YOU PRACTICE</span><h2>나의 무공과 심법</h2></div><span>비급 보유 → 해독 → 습득 → 수련</span></div>${academyCard()}<div class="active-arts"><div><small>현재 집중 수련</small><strong>${c ? c.name : "선택한 무공 없음"}</strong><p>${c ? `${categoryNames[c.category]} · ${martialPhase(j.arts[j.trainingArt].xp)} · ${j.arts[j.trainingArt].xp}/100` : "학관에 입학하거나 보유 비급을 습득하세요."}</p></div><div><small>운용 중인 심법</small><strong>${mind ? mind.name : "아직 심법 미습득"}</strong><p>${mind ? `${martialPhase(j.arts[j.activeMind].xp)} · ${j.arts[j.activeMind].xp}/100 · 현재 내공 ${j.inner}` : `현재 내공 ${j.inner} · 심법을 배워야 운기조식이 가능합니다.`}</p></div></div><div class="martial-list">${Object.entries(
      martialCatalog,
    )
      .filter(([id, c]) => j.arts[id] || (j.academy.enrolled && c.dojo))
      .map(([id, c]) => {
        const a = j.arts[id],
          learned = a?.status === "learned",
          active =
            c.category === "mind" ? j.activeMind === id : j.trainingArt === id;
        const status = learned
          ? `${martialPhase(a.xp)} · ${a.xp}/100`
          : a?.status === "owned"
            ? `비급 보유 · 해독 ${a.decodeProgress}/100`
            : a?.status === "decoded"
              ? "해독 완료 · 습득 전"
              : "미습득 · 학관 수강 가능";
        const operation = learned
          ? "equip"
          : a?.status === "owned"
            ? "decode"
            : a?.status === "decoded"
              ? "learn"
              : "dojo";
        const label = learned
          ? active
            ? c.category === "mind"
              ? "운용 중"
              : "집중 수련 중"
            : c.category === "mind"
              ? "심법 운용"
              : "집중 수련 선택"
          : operation === "decode"
            ? "비급 해독 · 기력 6"
            : operation === "learn"
              ? "습득 · 기력 8"
              : "수강 과목 선택 · 수업료 없음";
        return `<article class="martial-card ${active && learned ? "equipped" : ""}"><div class="martial-card-top"><span>${categoryNames[c.category]} · ${c.rank}</span><small>${learned && a.chapter === 2 ? "제2편 개방" : c.rank === "전승" ? "제1편" : ""}</small></div><h3>${c.name}</h3><div class="martial-status">${status}</div><p>${c.desc}</p><small class="martial-effect">${c.effect}</small>${learned ? `<div class="martial-meter" role="meter" aria-label="${c.name} 숙련도" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${a.xp}"><i style="width:${a.xp}%"></i></div>` : ""}<button data-art="${id}" data-operation="${operation}" ${j.pendingEvent || progression.locked() || (learned && active) || (!learned && done) ? "disabled" : ""}>${label}</button>${!learned ? '<small class="martial-time">행동 1회 소모' + (operation === "dojo" ? " · 기력 8" : "") + "</small>" : ""}</article>`;
      })
      .join("")}</div>`;
  document
    .querySelectorAll("[data-art]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          martialOperation(b.dataset.art, b.dataset.operation)),
    );
  if (!j.academy.enrolled) $("#enroll-academy").onclick = enrollAcademy;
}
function renderWorld() {
  ensureCalendar(state.journey);
  ensureProgress(state.journey);
  ensureDarkness(state.journey);
  if (updateTemptation(state.journey, state.chosen)) persist();
  const j = state.journey,
    f = state.chosen,
    o = startOrigins[f.origin],
    e = encounterDetails(),
    training = selectedTraining(),
    mind = activeMind();
  $("#world-title").textContent = o.place;
  $("#world-time").textContent =
    `${formatDate(j.turn)} · 제${Math.floor(j.turn / 2) + 1}일`;
  $("#world-portrait").style.backgroundPosition = portraitPosition(
    state.character,
  );
  $("#world-player-name").textContent = state.character.name;
  $("#world-background").textContent = origins[f.origin].name + " · " + f.trait;
  $("#world-resources").innerHTML =
    `<span>기력 <b>${j.energy} / 100</b></span><span>은전 <b>${j.money} 닢</b></span><span>식량 <b>${j.food}</b></span>`;
  $("#world-growth").innerHTML =
    `<span>수련 무공 <b>${training ? training.name : "미선택"}</b></span><span>심법 <b>${mind ? mind.name : "미습득"}</b></span><span>내공량 <b>${j.inner}점</b></span><span>문파 <b>${sects[j.progress?.sect]?.name || "무소속"}</b></span><span>학관 <b>${j.academy.enrolled ? "청계학관 재학" : "미입학"}</b></span><span>강호의 단서 <b>${j.clues}</b></span><small>${escapeText(e.title)}</small>`;
  $("#world-items").innerHTML = j.items
    .map((i) => `<li>${escapeText(i)}</li>`)
    .join("");
  renderAlignment();
  renderRoadEvent();
  renderPlayerSituation();
  renderMartial();
  $("#world-actions").innerHTML = [
    [
      "train",
      "劍",
      training ? training.name + " 수련" : "무공 수련",
      training
        ? `기력 ${e.id === "letter" ? 14 : 18} · ${categoryNames[training.category]} 숙련도 성장`
        : "미습득 · 학관 입학 또는 비급 습득 필요",
    ],
    [
      "breathe",
      "氣",
      "운기조식",
      mind
        ? `기력 10 · ${mind.name} 숙련도와 내공 성장`
        : "심법 미습득 · 먼저 심법을 배워주세요",
    ],
    ["work", "商", "장터 품팔이", "기력 16 · 은전 11–16 획득"],
    ["explore", "山", "산길 탐색", "기력 20 · 식량 또는 단서 획득"],
    ["rest", "茶", "객잔 휴식", "비용 없이 기력 회복"],
    ["food", "米", "식량 구입", "은전 5 → 식량 3 · 시간 소모 없음"],
  ]
    .map(
      ([id, mark, title, desc]) =>
        `<button data-action="${id}" ${j.pendingEvent || progression.locked() || (id === "train" && !training) || (id === "breathe" && !mind) ? "disabled" : ""}><span>${mark}</span><strong>${title}</strong><small>${desc}</small></button>`,
    )
    .join("");
  document.querySelectorAll("[data-action]").forEach((b) => {
    b.onclick = () =>
      b.dataset.action === "food" ? buyFood() : worldAction(b.dataset.action);
    b.dataset.recommended = String(
      !progression.locked() && b.dataset.action === playerSituation().next,
    );
  });
  progression.render();
  longTraining.render();
  era.render();
  mobileWorld.render(
    j,
    playerSituation(),
    realms[j.progress.realm].name,
    sects[j.progress.sect]?.name || "무소속",
  );
  $("#world-log-entries").innerHTML = j.log
    .map(
      (l) =>
        `<article><small>${escapeText(l.time)}</small><p>${escapeText(l.text)}</p></article>`,
    )
    .join("");
}
function playerSituation() {
  const j = state.journey,
    f = state.chosen,
    e = encounterDetails(),
    completed = false,
    c = selectedTraining(),
    mind = activeMind();
  const stage = c
    ? `${c.name} · ${martialPhase(j.arts[j.trainingArt].xp)}`
    : mind
      ? "심법 입문 · 공격 무공 미습득"
      : "무공을 배우기 전";
  const opening = `${state.character.name} 님은 ${startOrigins[f.origin].place}에 머무르는 ${sects[j.progress?.sect] ? sects[j.progress.sect].name + " 외문제자" : j.academy?.enrolled ? "청계학관 학도이자 문파 무소속 입문자" : "문파 무소속 입문자"}입니다.`;
  const background =
    state.encounter.kind === "major"
      ? `큰 기연으로 ${e.item}을 얻었습니다. ${e.id === "scroll" && j.arts.nameless?.status !== "learned" ? "비급은 아직 익히지 못했습니다. 구결을 해독하고 습득해야 합니다." : e.id === "meridian" ? "기맥은 열렸지만, 심법에 따른 운기 수련으로 힘을 키워야 합니다." : j.decoded ? "전승의 다음 구결을 이해했습니다." : "귀한 전승을 기초부터 몸에 익히는 중입니다."}`
      : state.encounter.kind === "minor"
        ? `${e.item}을 얻은 작은 인연이 출발을 도와주고 있습니다.`
        : "특별한 시작 기연 없이, 자신의 노력으로 강호의 첫걸음을 내딛고 있습니다.";
  const growth =
    (c
      ? `현재 ${c.name}(${martialPhase(j.arts[j.trainingArt].xp)} · ${j.arts[j.trainingArt].xp}/100)을 집중 수련하고 있습니다.`
      : "아직 집중 수련할 무공을 익히지 못했습니다.") +
    (mind
      ? ` ${mind.name}으로 내공 ${j.inner}을 갈무리하고 있습니다.`
      : " 운기조식을 하려면 심법 입문이 필요합니다.");
  let next = "train",
    reason = c
      ? `${c.name} 수련으로 이 무공의 숙련도를 쌓아보세요.`
      : "무공 목록에서 입문할 무공을 골라보세요.",
    title = "첫 무공의 바탕을 만드는 시기";
  if (j.energy < 20) {
    next = "rest";
    reason =
      "기력이 낮아 수련·생업·탐색이 제한됩니다. 비용 없는 객잔 휴식으로 회복해보세요.";
    title = "잠시 숨을 고를 때입니다";
  } else if (j.food <= 1) {
    next = j.money >= 5 ? "food" : "work";
    reason =
      j.money >= 5
        ? "밤을 보낼 식량이 부족합니다. 은전 5로 식량 3을 구입할 수 있습니다."
        : "식량과 돈이 부족합니다. 장터 품팔이로 식량 살 돈을 먼저 마련해보세요.";
    title = "오늘 밤의 끼니를 챙기세요";
  } else if (!c) {
    next = "martial";
    reason =
      e.id === "scroll" && j.arts.nameless?.status !== "learned"
        ? "무명검결 비급을 해독하고 습득하면 직접 수련할 수 있습니다."
        : j.academy.enrolled
          ? "학관의 수강 과목에서 배울 무공을 골라보세요."
          : "청계학관에 입학하면 기초 무공과 심법을 골라 배울 수 있습니다.";
    title = "먼저 배울 무공을 골라보세요";
    if (
      !j.academy.enrolled &&
      j.money < 5 &&
      e.id !== "letter" &&
      e.id !== "scroll"
    ) {
      next = "work";
      reason = "학관 입학금은 은전 5입니다. 품팔이로 먼저 비용을 마련해보세요.";
    }
  } else if (!mind) {
    next = "martial";
    reason = j.academy.enrolled
      ? "학관에서 기초토납법을 배우면 운기조식을 할 수 있습니다."
      : "청계학관에 입학해 기초토납법을 배우거나, 별도의 심법 비급을 구해보세요.";
    title = "내공을 다룰 심법이 필요합니다";
    if (!j.academy.enrolled && j.money < 5 && e.id !== "letter") {
      next = "work";
      reason =
        "학관 입학금 은전 5를 품팔이로 마련해보세요. 입학 후 기초토납법 수업을 고를 수 있습니다.";
    }
  } else if (j.inner < 10) {
    next = "breathe";
    reason = `${mind.name}으로 호흡을 다스려 심법 숙련도와 내공을 함께 쌓아보세요.`;
    title = "몸과 호흡의 균형을 맞출 때입니다";
  } else if (j.mastery >= 30 && j.clues === 0) {
    next = "explore";
    reason =
      "산길에서 강호의 단서를 찾아보세요. 수련 외의 인연을 넓힐 수 있습니다.";
    title = "마을 밖의 이야기에 귀 기울여보세요";
  }
  if (j.pendingEvent) {
    title = "눈앞의 사건이 당신의 선택을 기다립니다";
    next = "event";
    reason =
      "사건의 선택지를 살펴보세요. 선택 결과가 정도·흑도·마도 성향과 상황에 반영됩니다.";
  } else if (progression.locked()) {
    title = "진행 중인 비무·수련을 마쳐주세요";
    next = "progress";
    reason = "위의 수련과 비무 화면에서 다음 행동을 선택하세요.";
  } else if (completed) {
    title = "첫 일주일의 발자취";
    reason =
      "첫 여정을 마쳤습니다. 익힌 무공을 바탕으로 다음 단계에서 문파 입문 또는 독행의 길을 정하게 됩니다.";
    next = null;
  }
  const resourceNotes = [
    {
      label: "몸 상태",
      text:
        j.energy < 20
          ? "기력 부족"
          : j.energy < 50
            ? "조금 지침"
            : "수련할 여유",
      kind: j.energy < 20 ? "warning" : "calm",
    },
    {
      label: "생활 기반",
      text:
        j.food <= 1
          ? j.money < 5
            ? "식량·은전 부족"
            : "식량 보충 필요"
          : j.money < 10
            ? "여행 자금 부족"
            : "당분간 머물 여유",
      kind: j.food <= 1 || j.money < 10 ? "warning" : "calm",
    },
    { label: "현재 성장", text: stage, kind: "calm" },
  ];
  return {
    opening,
    background,
    growth,
    title,
    next,
    reason,
    resourceNotes,
    completed,
    day: Math.floor(j.turn / 2) + 1,
    period: j.turn % 2 ? "오후" : "오전",
    actionsLeft: Math.max(0, 14 - j.turn),
  };
}
function renderPlayerSituation() {
  const view = playerSituation(),
    j = state.journey,
    labels = {
      train: "집중 무공 수련",
      breathe: "운기조식",
      work: "장터 품팔이",
      explore: "산길 탐색",
      rest: "객잔 휴식",
      food: "식량 구입",
      martial: "무공 입문",
      event: "돌발 사건 선택",
      progress: "비무·수련 이어가기",
    };
  $("#world-goal").innerHTML =
    `<div class="situation-top"><span class="eyebrow">YOUR CURRENT STORY · 지금 나의 상황</span><span class="situation-time">${`${formatDate(j.turn)}${j.turn < 14 ? ` · 문파 방문까지 ${view.actionsLeft}회 행동` : " · 문파 입문과 독행"}`}</span></div><h2>${view.title}</h2><div class="situation-tags"><span>${sects[j.progress?.sect]?.name || (j.academy.enrolled ? "청계학관 재학 · 문파 무소속" : "문파 무소속")}</span><span>${escapeText(alignmentIdentity().label)}</span><span>${escapeText(origins[state.chosen.origin].name)}</span><span>${state.encounter.kind === "major" ? "큰 기연" : state.encounter.kind === "minor" ? "작은 인연" : "평범한 출발"}</span></div><details class="situation-details" ${mobileLayout.matches ? "" : "open"}><summary>나의 상황 자세히 보기</summary><p class="situation-opening">${escapeText(view.opening)}</p><p class="situation-story">${escapeText(view.background)} ${escapeText(view.growth)}</p><div class="situation-conditions">${view.resourceNotes.map((n) => `<div class="${n.kind}"><small>${n.label}</small><strong>${n.text}</strong></div>`).join("")}</div></details><div class="situation-next"><span>${view.completed ? "다음 여정" : "추천 행동 · " + labels[view.next]}</span><p>${view.reason}</p>${view.next ? '<button id="view-suggestion" class="text-button">행동 살펴보기 ↓</button>' : ""}</div><div class="week-progress" role="meter" aria-label="첫 일주일 진행" aria-valuemin="0" aria-valuemax="14" aria-valuenow="${Math.min(14, j.turn)}"><i style="width:${(Math.min(14, j.turn) / 14) * 100}%"></i></div>`;
  if (view.next)
    $("#view-suggestion").onclick = () => {
      if (view.next === "event") {
        roadPopup.open();
        return;
      }
      const button =
        view.next === "progress"
          ? $("#progression-panel")
          : view.next === "event"
            ? $("#road-event-panel")
            : view.next === "martial"
              ? $("#martial-panel")
              : document.querySelector(`[data-action="${view.next}"]`);
      revealWorldTarget(button);
      button?.scrollIntoView({
        behavior: reduced() ? "instant" : "smooth",
        block: "center",
      });
      button?.focus({ preventScroll: true });
    };
}

function ensureAlignment(j) {
  if (!j.alignment) {
    j.alignment = { righteous: 0, black: 0, demonic: 0 };
    j.alignmentHistory = [];
    j.lastRoadEventTurn = j.turn;
    j.recentRoadEvents = [];
    j.pendingEvent = null;
  }
  for (const k of Object.keys(alignments))
    j.alignment[k] = Math.max(0, Math.min(100, Number(j.alignment[k]) || 0));
  j.alignmentHistory = j.alignmentHistory || [];
  j.recentRoadEvents = j.recentRoadEvents || [];
  if (!Number.isInteger(j.lastRoadEventTurn)) j.lastRoadEventTurn = j.turn;
}
function alignmentIdentity() {
  const j = state.journey;
  ensureAlignment(j);
  const ranked = Object.entries(j.alignment).sort((a, b) => b[1] - a[1]),
    [id, value] = ranked[0],
    lead = value - ranked[1][1];
  if (value < 8)
    return {
      label: "아직 정해지지 않은 길",
      desc: "출신과 기연은 성향을 정하지 않습니다. 당신의 선택이 길을 만듭니다.",
    };
  if (lead < 5)
    return {
      label: "여러 길이 교차하는 무인",
      desc: "서로 다른 신념이 함께 쌓이고 있습니다. 아직 한 길로 굳어지지 않았습니다.",
    };
  return {
    label:
      alignments[id].name +
      (value >= 60
        ? "의 길을 굳힌 무인"
        : value >= 30
          ? "를 따르는 무인"
          : "로 기우는 무인"),
    desc: alignments[id].desc + " · 이후 선택으로 달라질 수 있습니다.",
  };
}
function maybeRoadEvent(force = false) {
  const j = state.journey;
  ensureAlignment(j);
  if (j.pendingEvent || (!force && j.turn - j.lastRoadEventTurn < 2)) return;
  const gap = j.turn - j.lastRoadEventTurn;
  if (!force && gap < 4 && random(100) >= 35) return;
  const unseen = roadEvents.filter((e) => !j.recentRoadEvents.includes(e.id)),
    fresh = roadEvents.filter(
      (e) => !j.recentRoadEvents.slice(-3).includes(e.id),
    ),
    pool = unseen.length ? unseen : fresh.length ? fresh : roadEvents;
  const event = pool[random(pool.length)];
  j.pendingEvent = { id: event.id, token: crypto.randomUUID(), turn: j.turn };
  j.lastRoadEventTurn = j.turn;
  j.recentRoadEvents.push(event.id);
  j.recentRoadEvents = j.recentRoadEvents.slice(-roadEvents.length);
  addLog(`「${event.title}」 — 눈앞의 사건이 선택을 기다립니다.`, "돌발 사건");
}
function roadChoiceAllowed(c) {
  const j = state.journey;
  return ["money", "food", "energy"].every((k) => !(c[k] < 0) || j[k] >= -c[k]);
}
function signed(n) {
  return (n > 0 ? "+" : "") + n;
}
function resolveRoadEvent(token, index) {
  const j = state.journey;
  if (!j?.pendingEvent || j.pendingEvent.token !== token) return;
  const event = roadEvents.find((e) => e.id === j.pendingEvent.id),
    c = event?.choices[index];
  if (!c || !roadChoiceAllowed(c)) {
    notify("이 선택에 필요한 자원이 부족합니다. 다른 선택을 살펴보세요.");
    return;
  }
  const changes = [];
  for (const [k, v] of Object.entries(c.delta)) {
    const before = j.alignment[k];
    j.alignment[k] = Math.max(0, Math.min(100, before + v));
    const diff = j.alignment[k] - before;
    if (diff) changes.push(alignments[k].name + " " + signed(diff));
  }
  for (const k of ["money", "food", "energy", "inner", "clues"])
    if (c[k]) j[k] = k === "energy" ? Math.min(100, j[k] + c[k]) : j[k] + c[k];
  if (c.item && !j.items.includes(c.item)) j.items.push(c.item);
  j.alignmentHistory.unshift({
    turn: j.pendingEvent.turn,
    event: event.title,
    choice: c.text,
    changes: changes.join(" · ") || "성향 변화 없음",
  });
  j.alignmentHistory = j.alignmentHistory.slice(0, 20);
  j.pendingEvent = null;
  addLog(
    c.result + " " + (changes.length ? "[" + changes.join(" · ") + "]" : ""),
    "선택의 결과",
  );
  persist();
  renderWorld();
  notify(changes.length ? changes.join(" · ") : "당신의 선택을 기록했습니다.");
}
function renderAlignment() {
  const j = state.journey;
  ensureAlignment(j);
  const identity = alignmentIdentity();
  $("#alignment-panel").innerHTML =
    `<div class="alignment-title"><span class="eyebrow">THE PATH YOU CHOOSE · 강호 성향</span><small>각 수치 0–100 · 돌발 사건 ${roadEvents.length}종</small></div><h2>${identity.label}</h2><p>${identity.desc}</p><div class="alignment-bars">${Object.entries(
      alignments,
    )
      .map(
        ([k, a]) =>
          `<div style="--path-color:${a.color}"><div class="path-label"><span>${a.han} <b>${a.name}</b></span><strong>${j.alignment[k]}</strong></div><div class="path-meter" role="meter" aria-label="${a.name} 성향" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${j.alignment[k]}"><i style="width:${j.alignment[k]}%"></i></div><small>${a.desc}</small></div>`,
      )
      .join("")}</div>${
      j.alignmentHistory.length
        ? `<details class="path-history"><summary>최근 선택의 발자취</summary>${j.alignmentHistory
            .slice(0, 4)
            .map(
              (h) =>
                `<article><span>${formatDate(h.turn)} · ${escapeText(h.event)}</span><p>${escapeText(h.choice)}</p><small>${escapeText(h.changes)}</small></article>`,
            )
            .join("")}</details>`
        : '<div class="path-first">아직 기록된 선택이 없습니다. 돌발 사건에서 당신의 뜻을 보여주세요.</div>'
    }`;
}
function renderRoadEvent() {
  const j = state.journey,
    panel = $("#road-event-panel");
  if (!j.pendingEvent) {
    roadPopup.sync(null);
    return;
  }
  const event = roadEvents.find((e) => e.id === j.pendingEvent.id);
  if (!event) return;
  const token = j.pendingEvent.token;
  panel.innerHTML = `<div class="road-event-top"><span class="eyebrow">UNEXPECTED ENCOUNTER · 돌발 사건</span><small>${event.place}</small></div><h2 id="road-event-title" data-popup-heading tabindex="-1">${event.title}</h2><p class="road-event-story">${event.story}</p><div class="road-event-choices">${event.choices.map((c, i) => `<button data-road-choice="${i}" ${roadChoiceAllowed(c) ? "" : "disabled"}><strong>${c.text}</strong>${roadChoiceAllowed(c) ? "" : "<em>필요 자원 부족</em>"}</button>`).join("")}</div><p class="road-event-note">어느 길로 나아갈지는 당신의 선택에 달려 있습니다. 결정한 선택은 되돌릴 수 없습니다.</p>`;
  document
    .querySelectorAll("[data-road-choice]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          resolveRoadEvent(token, Number(b.dataset.roadChoice))),
    );
  roadPopup.sync(token);
}
const roadPopup = mountEventPopup({
  dialog: $("#road-event-dialog"),
  notice: $("#road-event-notice"),
  openButton: $("#road-event-reopen"),
  closeButton: $("#road-event-dismiss"),
  fallbackFocus: () => document.querySelector('[data-action="rest"]'),
});
const progression = mountProgression({
  state,
  catalog: martialCatalog,
  persist,
  notify,
  finishTurn: finishWorldTurn,
  gainMartial,
  renderWorld,
});

const longTraining = mountLongTraining({
  state,
  catalog: martialCatalog,
  random,
  locked: () => progression.locked(),
  onEvent: () => maybeRoadEvent(true),
  gainMartial,
  persist,
  renderWorld,
  addLog,
  syncMartial,
  notify,
});

const era = mountEra({
  state,
  persist,
  getSoundEnabled: () => soundEnabled,
  toggleSound: () => $("#sound").click(),
  onSound: () => tone(110, 0.8, 0.04),
});

if (
  state.encounter &&
  state.journey &&
  validProfile(state.character) &&
  valid(state.chosen)
) {
  initializeArts(state.journey, true);
  ensureAcademy(state.journey);
  if (state.screen === "world") openWorld();
  else openEncounter();
} else if (
  state.screen === "encounter" &&
  validProfile(state.character) &&
  valid(state.chosen)
)
  openEncounter();
else if (state.screen === "character") openCharacter(characterDraft.fate);
