// input.ts — pointer tracking over the screen, normalised to UV space.
//
// We report the cursor in the same coordinate frame the shaders use: origin at
// the bottom-left, y pointing up, both axes in [0,1]. Velocity is left for the
// app loop to derive (it needs the frame's dt), so this class stays tiny.

import { clamp01 } from "./util";

export class Pointer {
  /** UV position, y up, clamped to [0,1]. */
  x = 0.5;
  y = 0.5;
  down = false;

  constructor(private el: HTMLElement) {
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    // Up/cancel can happen anywhere, so listen on the window.
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  private update(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.x = clamp01((e.clientX - r.left) / r.width);
    this.y = clamp01(1 - (e.clientY - r.top) / r.height);
  }

  private onDown = (e: PointerEvent) => {
    this.down = true;
    this.update(e);
  };
  private onMove = (e: PointerEvent) => {
    this.update(e);
  };
  private onUp = () => {
    this.down = false;
  };

  dispose() {
    this.el.removeEventListener("pointerdown", this.onDown);
    this.el.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
  }
}
