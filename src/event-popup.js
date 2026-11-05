// Dismissal leaves the encounter pending. Only its choice handler resolves it.
export function mountEventPopup({
  dialog,
  notice,
  openButton,
  closeButton,
  fallbackFocus,
}) {
  let seenToken = null,
    previousFocus = null;
  function open() {
    if (!seenToken || dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal();
    dialog.scrollTop = 0;
    document.documentElement.classList.add("event-popup-open");
    dialog
      .querySelector("[data-popup-heading]")
      ?.focus({ preventScroll: true });
  }
  function close() {
    if (!dialog.open) return;
    dialog.close();
    document.documentElement.classList.remove("event-popup-open");
    if (
      previousFocus?.isConnected &&
      previousFocus.tabIndex >= 0 &&
      !previousFocus.disabled &&
      previousFocus.getClientRects().length
    )
      previousFocus.focus({ preventScroll: true });
    else if (!notice.hidden) openButton.focus({ preventScroll: true });
    else
      queueMicrotask(() => fallbackFocus?.()?.focus({ preventScroll: true }));
  }
  closeButton.onclick = close;
  openButton.onclick = open;
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      close();
  });
  return {
    open,
    close,
    sync(token) {
      notice.hidden = !token;
      if (!token) {
        seenToken = null;
        close();
        return;
      }
      if (token !== seenToken) {
        seenToken = token;
        open();
      }
    },
  };
}
