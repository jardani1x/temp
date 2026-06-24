// main.ts — boot the set. On any failure (no WebGL2, shader error, …) we show a
// "NO SIGNAL" card and log the full error (shader sources included) to the
// console so it's debuggable instead of a blank screen.

import "./style.css";
import { App } from "./app";
import { showFatal } from "./ui/error";

const root = document.getElementById("app");

if (!root) {
  throw new Error("CATHODE-88: #app mount point is missing from index.html.");
}

try {
  new App(root);
} catch (err) {
  showFatal(root, err);
}
