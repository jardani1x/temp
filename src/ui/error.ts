// ui/error.ts — the "NO SIGNAL" failure card. Used both for boot failures and
// for errors thrown inside the render loop, so a problem shows up on screen
// (with the message) instead of a frozen black canvas.

export function showFatal(root: HTMLElement, err: unknown) {
  console.error("[CATHODE-88] fatal:", err);
  const message = err instanceof Error ? err.message : String(err);

  root.innerHTML = "";
  const box = document.createElement("div");
  box.className = "boot-error";

  const h = document.createElement("h1");
  h.textContent = "NO SIGNAL";
  const p = document.createElement("p");
  p.textContent =
    "CATHODE-88 couldn't power on this device. The error is below (and in the browser console).";
  const pre = document.createElement("pre");
  pre.textContent = message;

  box.append(h, p, pre);
  root.appendChild(box);
}
