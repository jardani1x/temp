// main.ts — boot the set. On any failure (no WebGL2, shader error, …) we show a
// "NO SIGNAL" card and log the full error (shader sources included) to the
// console so it's debuggable instead of a blank screen.

import "./style.css";
import { App } from "./app";
import { GLError } from "./core/gl";

const root = document.getElementById("app");

if (!root) {
  throw new Error("CATHODE-88: #app mount point is missing from index.html.");
}

try {
  new App(root);
} catch (err) {
  console.error("[CATHODE-88] failed to start:", err);
  root.innerHTML = "";
  const box = document.createElement("div");
  box.className = "boot-error";
  const detail = err instanceof GLError ? err.message : "The set failed to power on. See the console for details.";
  box.appendChild(Object.assign(document.createElement("h1"), { textContent: "NO SIGNAL" }));
  box.appendChild(Object.assign(document.createElement("pre"), { textContent: detail }));
  root.appendChild(box);
}
