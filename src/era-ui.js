import { createClient } from "@supabase/supabase-js";
import {
  createEraSnapshot,
  validEraSnapshot,
  eraClock,
  eraThemes,
  themeForEra,
  eraDateRange,
} from "./game/era.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function mountEra({
  state,
  persist,
  onSound,
  getSoundEnabled,
  toggleSound,
}) {
  const host = document.querySelector("#era-banner"),
    dialog = document.querySelector("#era-intro");
  const url = import.meta.env.VITE_SUPABASE_URL,
    key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  // Game reads are always public, independent of any admin login in this browser.
  const client =
    url && key
      ? createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: "jianghu-era-public",
          },
        })
      : null;
  let status = "idle",
    request = null,
    previousFocus = null,
    showingJourney = null;
  const setText = (id, value) => {
    document.getElementById(id).textContent = value;
  };
  function safeToShow() {
    const j = state.journey;
    return (
      state.screen === "world" &&
      j &&
      !j.pendingEvent &&
      j.progress?.battle?.status !== "active" &&
      !j.progress?.drill
    );
  }
  function show() {
    const snapshot = state.journey?.era;
    if (!validEraSnapshot(snapshot) || dialog.open) return;
    const theme = themeForEra(snapshot.catalog),
      copy = eraThemes[theme];
    dialog.dataset.theme = theme;
    dialog.classList.remove("era-arrive");
    setText("era-intro-glyph", copy.glyph);
    setText("era-intro-chapter", copy.chapter);
    setText("era-intro-number", `제${snapshot.ordinal}시대 · 강호의 새 장`);
    setText("era-intro-title", snapshot.catalog.era.name);
    setText("era-intro-tagline", copy.tagline);
    setText("era-intro-description", snapshot.catalog.era.description);
    setText("era-intro-duration", `${snapshot.catalog.era.duration_years}년`);
    setText("era-intro-range", "강호력 " + eraDateRange(snapshot));
    previousFocus = document.activeElement;
    showingJourney = state.journey;
    dialog.showModal();
    document.documentElement.classList.add("era-intro-open");
    void dialog.offsetWidth;
    dialog.classList.add("era-arrive");
    syncSound();
    if (getSoundEnabled()) onSound();
  }
  function close() {
    if (!dialog.open) return;
    if (
      state.journey === showingJourney &&
      validEraSnapshot(showingJourney.era)
    ) {
      showingJourney.era.introSeen = true;
      persist();
    }
    dialog.close();
    document.documentElement.classList.remove("era-intro-open");
    showingJourney = null;
    if (previousFocus?.isConnected && previousFocus.getClientRects().length)
      previousFocus.focus({ preventScroll: true });
    else host.querySelector("button")?.focus({ preventScroll: true });
  }
  function syncSound() {
    const enabled = getSoundEnabled();
    const button = document.querySelector("#era-intro-sound");
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "♪ 효과음 켜짐" : "♪ 효과음 꺼짐";
  }
  document.querySelector("#era-intro-enter").onclick = close;
  document.querySelector("#era-intro-skip").onclick = close;
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  document.querySelector("#era-intro-sound").onclick = () => {
    toggleSound();
    syncSound();
    if (getSoundEnabled()) onSound();
  };
  function renderBanner() {
    const snapshot = state.journey?.era;
    if (validEraSnapshot(snapshot)) {
      const clock = eraClock(snapshot, state.journey.turn),
        theme = themeForEra(snapshot.catalog),
        copy = eraThemes[theme];
      host.dataset.theme = theme;
      host.className = "era-banner";
      host.innerHTML = `<div class="era-banner-seal" aria-hidden="true">${copy.glyph}</div><div class="era-banner-copy"><span>제${snapshot.ordinal}시대 · ${clock.ended ? "시대 기간 종료" : `${clock.year}년차 / ${snapshot.catalog.era.duration_years}년`}</span><strong>${esc(snapshot.catalog.era.name)}</strong></div><button id="era-replay" class="era-replay" type="button">시대 다시 보기 <span aria-hidden="true">↗</span></button><div class="era-time-progress" role="progressbar" aria-label="시대 시간 경과" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clock.progress)}"><i style="width:${clock.progress}%"></i></div>`;
      document.querySelector("#era-replay").onclick = show;
    } else {
      host.className = "era-banner era-banner-loading";
      const label =
        status === "loading"
          ? "강호의 새 시대를 펼치고 있습니다…"
          : status === "empty"
            ? "아직 공개된 시대가 없습니다."
            : status === "error"
              ? "시대 정보를 불러오지 못했습니다."
              : !client
                ? "시대 연결을 준비하고 있습니다."
                : "새로운 시대를 기다립니다.";
      host.innerHTML = `<p role="status">${label}</p>${client && status !== "loading" ? '<button id="era-retry" type="button">다시 불러오기</button>' : ""}`;
      host.querySelector("#era-retry")?.addEventListener("click", () => {
        status = "idle";
        render();
      });
    }
  }
  async function load() {
    if (!client || request || status !== "idle") return;
    const journey = state.journey;
    status = "loading";
    renderBanner();
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 8000);
    request = (async () => {
      try {
        const { data, error } = await client
          .rpc("era_public_catalog")
          .abortSignal(controller.signal);
        if (error) throw error;
        if (state.journey !== journey) return;
        if (!data) {
          status = "empty";
          return;
        }
        // Existing journeys keep their current date; no retroactive twenty-year period.
        journey.era = createEraSnapshot(data, journey.turn);
        persist();
        status = "ready";
      } catch {
        if (state.journey === journey) status = "error";
      } finally {
        clearTimeout(timeout);
        request = null;
        if (state.screen === "world" && state.journey === journey) {
          renderBanner();
          if (
            safeToShow() &&
            validEraSnapshot(journey.era) &&
            !journey.era.introSeen
          )
            show();
        }
      }
    })();
    await request;
  }
  function render() {
    if (!state.journey) return;
    renderBanner();
    if (validEraSnapshot(state.journey.era)) {
      if (safeToShow() && !state.journey.era.introSeen) show();
    } else if (status === "idle") void load();
  }
  return { render };
}
