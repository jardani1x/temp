// ui/osd.ts — the on-screen-display, the little glowing text a TV flashes when
// you change channel or nudge a setting. Auto-fades after a moment.

export class Osd {
  readonly element: HTMLElement;
  private timer = 0;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "osd";
  }

  show(text: string) {
    this.element.textContent = text;
    this.element.classList.add("osd--on");
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.element.classList.remove("osd--on");
    }, 1600);
  }
}
