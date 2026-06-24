// ui/bezel.ts — builds the television set around the screen and wires every
// physical control to a callback. The app owns behaviour; the bezel owns chrome
// and reflects state back (readout, knob positions, OSD).

import { FxSettings } from "../types";
import { Knob, Tuner } from "./knob";
import { Osd } from "./osd";

export type BezelAction = "photo" | "shuffle" | "reseed" | "hideUI" | "fullscreen" | "help";

export interface StationInfo {
  name: string;
  tagline: string;
}

export interface BezelCallbacks {
  onSetChannel: (index: number) => void;
  onFx: (name: keyof FxSettings, value: number) => void;
  onAction: (action: BezelAction) => void;
}

/** Tiny hyperscript helper. */
function h(tag: string, className?: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const FX_KNOBS: { key: keyof FxSettings; label: string }[] = [
  { key: "tracking", label: "TRACKING" },
  { key: "glow", label: "GLOW" },
  { key: "scanline", label: "SCANLINE" },
  { key: "persist", label: "PERSIST" },
  { key: "hue", label: "HUE" },
];

const BUTTONS: { action: BezelAction; label: string; key: string }[] = [
  { action: "photo", label: "PHOTO", key: "P" },
  { action: "shuffle", label: "PALETTE", key: "R" },
  { action: "reseed", label: "RESEED", key: "S" },
  { action: "hideUI", label: "HIDE", key: "H" },
  { action: "fullscreen", label: "FULL", key: "F" },
  { action: "help", label: "?", key: "?" },
];

export class Bezel {
  readonly root: HTMLElement;
  readonly screenMount: HTMLElement;

  private readoutNum: HTMLElement;
  private readoutName: HTMLElement;
  private tuner: Tuner;
  private knobs = new Map<keyof FxSettings, Knob>();
  private osdView = new Osd();
  private flashEl: HTMLElement;
  private helpEl: HTMLElement;

  constructor(stations: StationInfo[], fx: FxSettings, cb: BezelCallbacks) {
    this.root = h("div", "tv");

    // --- screen ------------------------------------------------------------
    this.screenMount = h("div", "tv__screen");
    const overlay = h("div", "tv__overlay");
    const glare = h("div", "tv__glare");
    this.flashEl = h("div", "tv__flash");
    this.screenMount.append(overlay, glare, this.osdView.element, this.flashEl);

    // --- control panel -----------------------------------------------------
    const panel = h("div", "tv__panel");

    const left = h("div", "panel__left");
    const brand = h("div", "panel__brand");
    brand.append(h("span", "panel__brand-name", "CATHODE"), h("span", "panel__brand-num", "88"));
    const sub = h("div", "panel__sub", "CRT BROADCAST UNIT · MODEL 88-X");
    const readout = h("div", "readout");
    this.readoutNum = h("span", "readout__num", "01");
    this.readoutName = h("span", "readout__name", stations[0]?.name ?? "—");
    const air = h("span", "readout__air");
    air.append(h("span", "readout__dot"), h("span", undefined, "ON AIR"));
    readout.append(this.readoutNum, this.readoutName, air);
    left.append(brand, sub, readout);

    const center = h("div", "panel__center");
    const prev = h("button", "tv__chan-btn", "‹");
    prev.title = "Previous station";
    prev.addEventListener("click", () => cb.onSetChannel(this.cur - 1));
    const next = h("button", "tv__chan-btn", "›");
    next.title = "Next station";
    next.addEventListener("click", () => cb.onSetChannel(this.cur + 1));
    this.tuner = new Tuner({ total: stations.length, onSet: cb.onSetChannel });
    center.append(prev, this.tuner.element, next);

    const right = h("div", "panel__right");
    const knobRow = h("div", "panel__knobs");
    for (const { key, label } of FX_KNOBS) {
      const knob = new Knob({
        label,
        value: fx[key],
        onChange: (v) => cb.onFx(key, v),
      });
      this.knobs.set(key, knob);
      knobRow.append(knob.element);
    }
    const btnRow = h("div", "panel__buttons");
    for (const { action, label } of BUTTONS) {
      const btn = h("button", "panel__btn", label);
      if (action === "help") btn.classList.add("panel__btn--help");
      btn.addEventListener("click", () => cb.onAction(action));
      btnRow.append(btn);
    }
    right.append(knobRow, btnRow);

    panel.append(left, center, right);

    const frame = h("div", "tv__frame");
    frame.append(this.screenMount, panel);
    this.root.append(frame);

    // --- help overlay ------------------------------------------------------
    this.helpEl = this.buildHelp(stations);
    this.root.append(this.helpEl);

    this.cur = 0;
  }

  private cur = 0;

  private buildHelp(stations: StationInfo[]): HTMLElement {
    const help = h("div", "help");
    const card = h("div", "help__card");
    const close = h("button", "help__close", "✕");
    close.addEventListener("click", () => this.toggleHelp(false));
    card.append(close);
    card.append(h("h1", "help__title", "CATHODE-88"));
    card.append(h("p", "help__lede", "A haunted broadcast you tune by hand."));

    const stationList = h("div", "help__section");
    stationList.append(h("h2", undefined, "STATIONS"));
    stations.forEach((s, i) => {
      const row = h("div", "help__station");
      row.append(h("span", "help__kbd", String(i + 1)), h("b", undefined, s.name), h("span", "help__dim", s.tagline));
      stationList.append(row);
    });

    const keys = h("div", "help__section");
    keys.append(h("h2", undefined, "CONTROLS"));
    const lines: [string, string][] = [
      ["drag on screen", "perturb the current station"],
      ["← → / scroll / knob", "change station"],
      ["1 – 6", "jump to station"],
      ["P", "snap a photo (PNG)"],
      ["R", "shuffle palette (hue)"],
      ["S", "reseed simulation"],
      ["H", "hide the set (pure screen)"],
      ["F", "fullscreen"],
      ["Space", "pause / resume"],
      ["?", "this panel"],
    ];
    for (const [k, v] of lines) {
      const row = h("div", "help__key");
      row.append(h("span", "help__kbd", k), h("span", "help__dim", v));
      keys.append(row);
    }

    card.append(stationList, keys);
    help.append(card);
    help.addEventListener("click", (e) => {
      if (e.target === help) this.toggleHelp(false);
    });
    return help;
  }

  setReadout(index: number, name: string) {
    this.cur = index;
    this.readoutNum.textContent = String(index + 1).padStart(2, "0");
    this.readoutName.textContent = name;
    this.tuner.setIndex(index);
  }

  setFx(name: keyof FxSettings, value: number) {
    this.knobs.get(name)?.setValue(value);
  }

  osd(text: string) {
    this.osdView.show(text);
  }

  flash() {
    this.flashEl.classList.add("tv__flash--on");
    setTimeout(() => this.flashEl.classList.remove("tv__flash--on"), 130);
  }

  toggleBare(force?: boolean): boolean {
    const on = this.root.classList.toggle("tv--bare", force);
    return on;
  }

  toggleHelp(force?: boolean): boolean {
    return this.helpEl.classList.toggle("help--on", force);
  }
}
