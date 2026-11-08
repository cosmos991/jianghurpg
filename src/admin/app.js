import { mountGrowthSimulation } from "./growth-ui.js";
import { mountEraEventTest } from "./era-event-ui.js";
import { mountEraDraw } from "./era-draw-ui.js";
import { createClient } from "@supabase/supabase-js";
import {
  conditions,
  rewards,
  newObjective,
  newOutcome,
  validateDocument,
} from "./model.js";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const apiUrl = import.meta.env.VITE_SUPABASE_URL,
  apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client = apiUrl && apiKey ? createClient(apiUrl, apiKey) : null;
let doc = null,
  dirty = false,
  saving = false,
  loading = false,
  signup = false,
  userId = null,
  sessionGeneration = 0;
const ERA = "demonic_rise_v1";
const slots = {
  CLUE_FOUND: {
    clue_01: "첫 번째 단서",
    clue_02: "두 번째 단서",
    clue_03: "세 번째 단서",
  },
  INFILTRATORS_EXPOSED: { infiltration_network: "잠입 조직" },
  DEFENSE_SUCCESS: {
    region_01: "첫 번째 피해 지역",
    region_02: "두 번째 피해 지역",
  },
  ALLIANCE_SECURED: {
    ally_01: "첫 번째 협력 문파",
    ally_02: "두 번째 협력 문파",
  },
  SUPPLY_BASE_STOPPED: { supply_base: "보급 거점" },
  RITUAL_STOPPED: { core_ritual: "핵심 의식" },
};
const text = (selector, message) => {
  $(selector).textContent = message;
};
const errorText = (error) => {
  const message = error?.message || String(error);
  if (/Invalid login credentials/i.test(message))
    return "이메일 또는 비밀번호를 확인해주세요.";
  if (/Email not confirmed/i.test(message))
    return "이메일 확인이 필요합니다. 받은 메일의 확인 링크를 이용해주세요.";
  if (/rate limit|too many|security purposes/i.test(message))
    return "요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.";
  if (
    /Email address.*not authorized|email_address_not_authorized/i.test(message)
  )
    return "Supabase 기본 메일 발송 대상에 포함되지 않은 주소입니다. 프로젝트의 이메일 발송 설정이 필요합니다.";
  if (/fetch|network/i.test(message))
    return "서버에 연결할 수 없습니다. 입력 내용은 유지됩니다. 연결을 확인한 뒤 다시 시도해주세요.";
  if (/permission|권한|42501/i.test(message))
    return "이 계정에는 관리자 권한이 없습니다. 등록한 관리자 이메일로 인증했는지 확인해주세요.";
  return message;
};
function confirmAction(title, description, ok = "계속") {
  return new Promise((resolve) => {
    const dialog = $("#confirm-dialog");
    text("#confirm-title", title);
    text("#confirm-description", description);
    text("#confirm-ok", ok);
    const finish = (value) => {
      dialog.close();
      resolve(value);
    };
    $("#confirm-ok").onclick = () => finish(true);
    $("#confirm-cancel").onclick = () => finish(false);
    dialog.oncancel = (event) => {
      event.preventDefault();
      finish(false);
    };
    dialog.showModal();
  });
}
function setDirty() {
  dirty = true;
  text("#dirty-status", "저장하지 않은 변경 사항이 있습니다");
  text("#save-status", "");
  updateSummary();
}
function updateSummary() {
  if (!doc) return;
  const total = doc.objectives.reduce(
    (sum, o) => sum + (Number.isFinite(o.points) ? o.points : 0),
    0,
  );
  text("#total-score", total);
  $("#score-fill").style.width = Math.max(0, Math.min(100, total)) + "%";
  $("#score-fill").classList.toggle("invalid", total !== 100);
  text(
    "#score-help",
    total === 100
      ? "점수 합계가 맞습니다. 결과 구간도 확인해주세요."
      : `현재 ${total}점입니다. 적용하려면 합계를 100점으로 맞춰주세요.`,
  );
  text("#sidebar-name", doc.era.name || "이름 없는 시대");
}
function targets(objective) {
  const choices = { ...slots[objective.condition_code] };
  for (const other of doc.objectives.filter(
    (o) => o.condition_code === objective.condition_code,
  ))
    if (!choices[other.target_key])
      choices[other.target_key] =
        other.id === objective.id
          ? "이 과제의 새 대상"
          : `${other.name}의 대상`;
  return Object.entries(choices)
    .map(
      ([id, name]) =>
        `<option value="${esc(id)}" ${id === objective.target_key ? "selected" : ""}>${esc(name)}</option>`,
    )
    .join("");
}
function objectiveHTML(o, i) {
  return `<article class="objective-row" data-objective="${i}"><div class="row-number">${String(i + 1).padStart(2, "0")}</div><div class="objective-fields"><label class="objective-name">과제 이름<input data-kind="objective" data-index="${i}" data-field="name" value="${esc(o.name)}" maxlength="100"></label><label>완료 조건<select data-kind="objective" data-index="${i}" data-field="condition_code">${Object.entries(
    conditions,
  )
    .map(
      ([id, c]) =>
        `<option value="${id}" ${id === o.condition_code ? "selected" : ""}>${c.name}</option>`,
    )
    .join(
      "",
    )}</select></label><label>연결 대상<select data-kind="objective" data-index="${i}" data-field="target_key">${targets(o)}</select></label><label class="points-label">획득 점수<input data-kind="objective" data-index="${i}" data-field="points" type="number" min="1" max="100" step="1" value="${o.points}"></label><label class="objective-description">과제 설명 <small>선택</small><input data-kind="objective" data-index="${i}" data-field="description" value="${esc(o.description)}" placeholder="무엇을 해야 하는지 짧게 적어주세요."></label></div><button type="button" class="icon-button remove-objective" data-index="${i}" aria-label="${i + 1}번 과제 삭제">×</button></article>`;
}
function outcomeHTML(o, i) {
  return `<article class="outcome-card" data-outcome="${i}"><div class="outcome-top"><span class="result-rank">결과 ${i + 1}</span><button type="button" class="icon-button remove-outcome" data-index="${i}" aria-label="${i + 1}번 결과 삭제">×</button></div><div class="outcome-fields"><label class="outcome-name">결과 이름<input data-kind="outcome" data-index="${i}" data-field="name" value="${esc(o.name)}" maxlength="100"></label><div class="range-fields"><label>최소 점수<input data-kind="outcome" data-index="${i}" data-field="min_score" type="number" min="0" max="100" step="1" value="${o.min_score}"></label><span>—</span><label>최대 점수<input data-kind="outcome" data-index="${i}" data-field="max_score" type="number" min="0" max="100" step="1" value="${o.max_score}"></label></div><label class="full">세계에 남는 결과<textarea data-kind="outcome" data-index="${i}" data-field="world_result" rows="2">${esc(o.world_result)}</textarea></label><label>명성 보상<input data-kind="outcome" data-index="${i}" data-field="fame_reward" type="number" min="0" max="10000" step="1" value="${o.fame_reward}"></label><label>공헌 보상<input data-kind="outcome" data-index="${i}" data-field="contribution_reward" type="number" min="0" max="10000" step="1" value="${o.contribution_reward}"></label><label>전승 보상<select data-kind="outcome" data-index="${i}" data-field="legacy_reward_code">${Object.entries(
    rewards,
  )
    .map(
      ([id, label]) =>
        `<option value="${id}" ${id === o.legacy_reward_code ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></label></div><details class="required-objectives" ${o.required_objective_ids.length ? "open" : ""}><summary>필수 달성 과제 <span>${o.required_objective_ids.length}개 선택</span></summary><p>점수가 높아도 이 과제를 완료하지 못하면 아래 결과 등급으로 내려갑니다.</p><div class="checkbox-grid">${doc.objectives.map((task) => `<label><input type="checkbox" data-required="${i}" value="${esc(task.id)}" ${o.required_objective_ids.includes(task.id) ? "checked" : ""}><span>${esc(task.name)}</span></label>`).join("") || "<p>먼저 과제를 추가해주세요.</p>"}</div></details></article>`;
}
function renderLists() {
  $("#objectives-list").innerHTML =
    doc.objectives.map(objectiveHTML).join("") ||
    '<p class="empty-note">아직 과제가 없습니다. 과제를 추가해보세요.</p>';
  $("#outcomes-list").innerHTML =
    doc.outcomes.map(outcomeHTML).join("") ||
    '<p class="empty-note">아직 결과가 없습니다. 결과를 추가해보세요.</p>';
  updateSummary();
}
function renderDocument() {
  for (const field of ["name", "description", "duration_years", "version"])
    $(`[name="era.${field}"]`).value = doc.era[field];
  const status = doc.era.status === "published" ? "적용됨" : "초안";
  text("#era-status", status);
  text("#sidebar-status", status);
  text(
    "#saved-at",
    "마지막 저장 " + new Date(doc.era.updated_at).toLocaleString("ko-KR"),
  );
  text("#dirty-status", "저장된 상태입니다");
  $("#validation-panel").hidden = true;
  renderLists();
}
async function loadCatalog({ discard = false } = {}) {
  if (loading || saving) return;
  if (
    dirty &&
    !discard &&
    !(await confirmAction(
      "저장하지 않은 변경 사항이 있습니다",
      "다시 불러오면 지금 편집한 내용이 사라집니다. 저장된 데이터로 돌아갈까요?",
      "다시 불러오기",
    ))
  )
    return;
  loading = true;
  const loadGeneration = sessionGeneration;
  $("#editor-loading").hidden = false;
  text("#editor-loading", "Supabase에서 시대 데이터를 불러오고 있습니다…");
  try {
    const { data, error } = await client.rpc("era_editor_catalog", {
      era_key: ERA,
    });
    if (error) throw error;
    if (loadGeneration !== sessionGeneration) return;
    doc = data;
    dirty = false;
    renderDocument();
    $("#catalog-form").hidden = false;
    $("#editor-loading").hidden = true;
  } catch (error) {
    text("#editor-loading", errorText(error));
  } finally {
    loading = false;
  }
}
function showValidation(errors) {
  const el = $("#validation-panel");
  el.hidden = !errors.length;
  el.innerHTML = errors.length
    ? `<strong>아래 항목을 확인해주세요.</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`
    : "";
}
async function save(publish) {
  if (!doc || saving || loading) return;
  const errors = validateDocument(doc, { publish });
  showValidation(errors);
  if (errors.length) {
    $("#validation-panel").scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    return;
  }
  if (
    publish &&
    !(await confirmAction(
      "검사한 설정을 적용할까요?",
      "현재 편집한 시대·과제·보상을 공개 데이터로 저장합니다. 게임의 시대 진행 연결은 다음 단계입니다.",
      "적용하기",
    ))
  )
    return;
  if (
    !publish &&
    doc.era.status === "published" &&
    !(await confirmAction(
      "적용된 설정을 초안으로 바꿀까요?",
      "저장하면 이 시대는 일반 조회에서 숨겨집니다. 다시 검사 후 적용할 수 있습니다.",
      "초안으로 저장",
    ))
  )
    return;
  const payload = structuredClone(doc);
  payload.objectives.forEach((o, i) => (o.sort_order = i + 1));
  saving = true;
  for (const b of document.querySelectorAll("#catalog-form button"))
    b.disabled = true;
  for (const input of document.querySelectorAll(
    "#catalog-form input,#catalog-form textarea,#catalog-form select",
  ))
    input.disabled = true;
  text(
    "#save-status",
    publish
      ? "전체 구성을 검사하고 적용하고 있습니다…"
      : "초안을 저장하고 있습니다…",
  );
  try {
    const { data, error } = await client.rpc("save_era_editor_catalog", {
      era_key: ERA,
      expected_updated_at: doc.era.updated_at,
      document: payload,
      publish,
    });
    if (error) throw error;
    doc = data;
    dirty = false;
    renderDocument();
    text(
      "#save-status",
      publish ? "검사를 마치고 적용했습니다." : "초안을 저장했습니다.",
    );
  } catch (error) {
    text("#save-status", errorText(error));
    showValidation([errorText(error)]);
  } finally {
    saving = false;
    for (const b of document.querySelectorAll("#catalog-form button"))
      b.disabled = false;
    for (const input of document.querySelectorAll(
      "#catalog-form input,#catalog-form textarea,#catalog-form select",
    ))
      input.disabled = false;
  }
}
$("#catalog-form").addEventListener("submit", (event) =>
  event.preventDefault(),
);
$("#catalog-form").addEventListener("input", (event) => {
  const el = event.target;
  if (!doc || saving) return;
  if (el.name?.startsWith("era.")) {
    const key = el.name.split(".")[1];
    doc.era[key] = el.type === "number" ? Number(el.value) : el.value;
    setDirty();
  } else if (el.dataset.field && el.tagName !== "SELECT") {
    const row =
      el.dataset.kind === "objective"
        ? doc.objectives[Number(el.dataset.index)]
        : doc.outcomes[Number(el.dataset.index)];
    row[el.dataset.field] = el.type === "number" ? Number(el.value) : el.value;
    setDirty();
  }
});
$("#catalog-form").addEventListener("change", (event) => {
  const el = event.target;
  if (!doc || saving) return;
  if (el.dataset.required !== undefined) {
    const row = doc.outcomes[Number(el.dataset.required)];
    row.required_objective_ids = el.checked
      ? [...new Set([...row.required_objective_ids, el.value])]
      : row.required_objective_ids.filter((id) => id !== el.value);
    setDirty();
  } else if (el.tagName === "SELECT" && el.dataset.field) {
    const row =
      el.dataset.kind === "objective"
        ? doc.objectives[Number(el.dataset.index)]
        : doc.outcomes[Number(el.dataset.index)];
    row[el.dataset.field] = el.value;
    if (el.dataset.field === "condition_code") {
      row.category = conditions[el.value].category;
      const available = Object.keys(slots[el.value]).find(
        (key) =>
          !doc.objectives.some(
            (o) =>
              o.id !== row.id &&
              o.condition_code === el.value &&
              o.target_key === key,
          ),
      );
      row.target_key = available || row.id;
      renderLists();
    }
    setDirty();
  }
});
$("#catalog-form").addEventListener("click", async (event) => {
  const removeObjective = event.target.closest(".remove-objective"),
    removeOutcome = event.target.closest(".remove-outcome");
  if (removeObjective && !saving) {
    const i = Number(removeObjective.dataset.index);
    if (
      await confirmAction(
        "과제를 삭제할까요?",
        "이 과제의 필수 달성 연결도 함께 해제됩니다. 저장하기 전에는 DB에 반영되지 않습니다.",
        "삭제하기",
      )
    ) {
      const id = doc.objectives[i].id;
      doc.objectives.splice(i, 1);
      doc.outcomes.forEach(
        (o) =>
          (o.required_objective_ids = o.required_objective_ids.filter(
            (ref) => ref !== id,
          )),
      );
      renderLists();
      setDirty();
    }
  }
  if (removeOutcome && !saving) {
    if (
      await confirmAction(
        "결과를 삭제할까요?",
        "남은 결과가 0~100점을 빠짐없이 포함하는지 확인해주세요.",
        "삭제하기",
      )
    ) {
      doc.outcomes.splice(Number(removeOutcome.dataset.index), 1);
      renderLists();
      setDirty();
    }
  }
});
$("#add-objective").onclick = () => {
  if (!doc || saving) return;
  if (doc.objectives.length >= 50)
    return showValidation(["과제는 최대 50개까지 작성할 수 있습니다."]);
  doc.objectives.push(newObjective());
  renderLists();
  setDirty();
  $("#objectives-list article:last-child input").focus();
};
$("#add-outcome").onclick = () => {
  if (!doc || saving) return;
  if (doc.outcomes.length >= 20)
    return showValidation(["결과는 최대 20개까지 작성할 수 있습니다."]);
  doc.outcomes.push(newOutcome());
  renderLists();
  setDirty();
  $("#outcomes-list article:last-child input").focus();
};
$("#save-draft").onclick = () => save(false);
$("#publish").onclick = () => save(true);
$("#reload-catalog").onclick = () => loadCatalog();
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
async function sessionChanged(session) {
  if (session?.user?.id === userId && doc) return;
  const generation = ++sessionGeneration;
  if (!session) {
    userId = null;
    doc = null;
    dirty = false;
    $("#editor").hidden = true;
    $("#auth-panel").hidden = false;
    return;
  }
  userId = session.user.id;
  $("#auth-submit").disabled = true;
  const { data: allowed, error } = await client.rpc("era_admin_access");
  if (generation !== sessionGeneration) return;
  $("#auth-submit").disabled = false;
  if (error || !allowed) {
    $("#editor").hidden = true;
    $("#auth-panel").hidden = false;
    text(
      "#auth-status",
      error
        ? errorText(error)
        : "이메일 인증이 완료된 관리자 계정만 편집할 수 있습니다. 등록한 이메일 주소를 확인해주세요.",
    );
    return;
  }
  $("#auth-password").value = "";
  $("#verify-link").value = "";
  $("#auth-panel").hidden = true;
  $("#editor").hidden = false;
  text("#signed-in-email", session.user.email);
  await loadCatalog({ discard: true });
}
$("#auth-toggle").onclick = () => {
  signup = !signup;
  text("#auth-title", signup ? "관리자 계정 만들기" : "관리자 로그인");
  text("#auth-submit", signup ? "계정 만들고 이메일 확인" : "편집실 들어가기");
  text(
    "#auth-toggle",
    signup ? "이미 계정이 있나요? 로그인" : "처음 이용하시나요? 계정 만들기",
  );
  $("#auth-password").autocomplete = signup
    ? "new-password"
    : "current-password";
  text("#auth-status", "");
};
$("#auth-form").onsubmit = async (event) => {
  event.preventDefault();
  if (!client) return;
  $("#auth-submit").disabled = true;
  text(
    "#auth-status",
    signup ? "계정을 만들고 있습니다…" : "로그인하고 있습니다…",
  );
  try {
    const credentials = {
      email: $("#auth-email").value.trim(),
      password: $("#auth-password").value,
    };
    const { data, error } = signup
      ? await client.auth.signUp({
          ...credentials,
          options: {
            emailRedirectTo: new URL("/admin/", location.origin).href,
          },
        })
      : await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    if (data.session) await sessionChanged(data.session);
    else
      text(
        "#auth-status",
        "확인메일을 보냈습니다. 메일에서 이메일을 확인한 뒤 로그인해주세요. 링크가 열리지 않으면 아래의 ‘확인메일 링크가 열리지 않을 때’를 이용하세요.",
      );
  } catch (error) {
    text("#auth-status", errorText(error));
  } finally {
    $("#auth-submit").disabled = false;
  }
};
$("#verify-form").onsubmit = async (event) => {
  event.preventDefault();
  if (!client) return;
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const url = new URL($("#verify-link").value.trim());
    if (
      url.origin !== new URL(apiUrl).origin ||
      url.pathname !== "/auth/v1/verify" ||
      !["signup", "email"].includes(url.searchParams.get("type"))
    )
      throw Error("이 프로젝트에서 보낸 가입 확인메일의 링크를 입력해주세요.");
    const token =
      url.searchParams.get("token_hash") || url.searchParams.get("token");
    if (!token) throw Error("확인 토큰이 없는 링크입니다.");
    const { data, error } = await client.auth.verifyOtp({
      token_hash: token,
      type: url.searchParams.get("type"),
    });
    if (error) throw error;
    await sessionChanged(data.session);
  } catch (error) {
    text("#auth-status", errorText(error));
  } finally {
    button.disabled = false;
  }
};
$("#logout").onclick = async () => {
  if (
    dirty &&
    !(await confirmAction(
      "저장하지 않은 변경 사항이 있습니다",
      "저장하지 않고 로그아웃할까요?",
      "로그아웃",
    ))
  )
    return;
  const { error } = await client.auth.signOut();
  if (error) text("#save-status", errorText(error));
  else await sessionChanged(null);
};
if (!client) {
  text(
    "#auth-status",
    "편집실 연결 설정이 준비되지 않았습니다. Supabase 연결 설정을 확인해주세요.",
  );
  $("#auth-submit").disabled = true;
  $("#auth-toggle").disabled = true;
} else {
  client.auth.onAuthStateChange((_event, session) =>
    setTimeout(() => sessionChanged(session), 0),
  );
  client.auth.getSession().then(({ data, error }) => {
    if (error) text("#auth-status", errorText(error));
    else sessionChanged(data.session);
  });
}

mountEraDraw();

mountEraEventTest();

mountGrowthSimulation();
