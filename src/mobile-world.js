export function revealWorldTarget(target) {
  for (let el = target?.parentElement; el; el = el.parentElement)
    if (el.tagName === "DETAILS") el.open = true;
}
export function mountMobileWorld(media) {
  const $ = (s) => document.querySelector(s),
    profile = $("#world-profile-details"),
    player = $(".world-player"),
    host = $("#mobile-profile-host");
  let journey = null;
  const revealActive = () => {
    if (!journey) return;
    if (
      journey.progress?.battle?.status === "active" ||
      journey.progress?.drill ||
      journey.progress?.exam
    )
      $("#group-progression").open = true;
    if (journey.longTraining?.status === "paused")
      $("#group-growth").open = true;
  };
  const sync = () => {
    profile.open = false;
    $("#world-log-entries").setAttribute("aria-live", "off");
    if (media.matches) host.append(profile);
    else player.append(profile);
    document
      .querySelectorAll("[data-world-group]")
      .forEach((group) => (group.open = false));
    revealActive();
  };
  $("#review-encounter-mobile").onclick = () => $("#review-encounter").click();
  sync();
  media.addEventListener("change", sync);
  document.querySelectorAll(".mobile-world-nav a").forEach(
    (link) =>
      (link.onclick = (event) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        event.preventDefault();
        document
          .querySelectorAll("[data-world-group]")
          .forEach((group) => (group.open = false));
        document
          .querySelectorAll(".mobile-world-nav a")
          .forEach((item) =>
            item.setAttribute(
              "aria-current",
              item === link ? "location" : "false",
            ),
          );
        revealWorldTarget(target);
        if (link.dataset.groups)
          link.dataset.groups
            .split(" ")
            .forEach((id) => (document.getElementById(id).open = true));
        if (target.matches("details")) target.open = true;
        target.scrollIntoView({ block: "start", behavior: "instant" });
        (target.querySelector("summary") || target).focus({
          preventScroll: true,
        });
      }),
  );
  return {
    render(j, view, realm, sect) {
      $("#mobile-origin").textContent = $("#world-background").textContent;
      $("#world-core-status").textContent = realm + " · " + sect;
      $("#mobile-goal-title").textContent = view.title;
      $("#mobile-goal-reason").textContent = view.reason;
      $("#mobile-goal-open").hidden = !view.next;
      $("#mobile-goal-open").onclick = () => $("#view-suggestion")?.click();
      $("#mobile-latest").textContent =
        j.log[0]?.text || "강호에 첫발을 내디뎠습니다.";
      journey = j;
      revealActive();
    },
  };
}
