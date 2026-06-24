// ui/knob.ts — the two physical controls on the bezel.
//
// `Knob`  : a continuous rotary for the FX (drag up/down or scroll). 0..1 maps
//           to a -135°..+135° sweep, like a real panel pot.
// `Tuner` : a chunky discrete dial that selects a station by angle.

import { clamp, wrapIndex } from "../util";

export interface KnobOptions {
  label: string;
  value: number; // initial, in [min,max]
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export class Knob {
  readonly element: HTMLElement;
  private dial: HTMLElement;
  private valueEl: HTMLElement;
  private min: number;
  private max: number;
  private value: number;
  private onChange: (value: number) => void;
  private startY = 0;
  private startValue = 0;

  constructor(opts: KnobOptions) {
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 1;
    this.value = opts.value;
    this.onChange = opts.onChange;

    this.element = document.createElement("div");
    this.element.className = "knob";

    this.dial = document.createElement("div");
    this.dial.className = "knob__dial";
    const notch = document.createElement("div");
    notch.className = "knob__notch";
    this.dial.appendChild(notch);

    const label = document.createElement("div");
    label.className = "knob__label";
    label.textContent = opts.label;

    this.valueEl = document.createElement("div");
    this.valueEl.className = "knob__value";

    this.element.append(this.dial, label, this.valueEl);

    this.dial.addEventListener("pointerdown", this.onDown);
    this.dial.addEventListener("wheel", this.onWheel, { passive: false });
    this.reflect();
  }

  private norm(): number {
    return (this.value - this.min) / (this.max - this.min);
  }

  private reflect() {
    this.dial.style.transform = `rotate(${-135 + this.norm() * 270}deg)`;
    this.valueEl.textContent = String(Math.round(this.norm() * 100)).padStart(2, "0");
  }

  setValue(value: number, emit = false) {
    this.value = clamp(value, this.min, this.max);
    this.reflect();
    if (emit) this.onChange(this.value);
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    this.startY = e.clientY;
    this.startValue = this.value;
    window.addEventListener("pointermove", this.onDrag);
    window.addEventListener("pointerup", this.onUp);
  };

  private onDrag = (e: PointerEvent) => {
    const dy = this.startY - e.clientY; // drag up to increase
    this.setValue(this.startValue + (dy / 180) * (this.max - this.min), true);
  };

  private onUp = () => {
    window.removeEventListener("pointermove", this.onDrag);
    window.removeEventListener("pointerup", this.onUp);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    this.setValue(this.value + dir * (this.max - this.min) * 0.05, true);
  };
}

export interface TunerOptions {
  total: number;
  onSet: (index: number) => void;
}

export class Tuner {
  readonly element: HTMLElement;
  private dial: HTMLElement;
  private total: number;
  private index = 0;
  private onSet: (index: number) => void;

  constructor(opts: TunerOptions) {
    this.total = opts.total;
    this.onSet = opts.onSet;

    this.element = document.createElement("div");
    this.element.className = "tuner";

    this.dial = document.createElement("div");
    this.dial.className = "tuner__dial";
    const notch = document.createElement("div");
    notch.className = "tuner__notch";
    this.dial.appendChild(notch);

    const label = document.createElement("div");
    label.className = "tuner__label";
    label.textContent = "TUNE";

    this.element.append(this.dial, label);

    this.dial.addEventListener("pointerdown", this.onDown);
    this.dial.addEventListener("wheel", this.onWheel, { passive: false });
    this.reflect();
  }

  /** Reflect a station change without emitting (avoids feedback loops). */
  setIndex(index: number) {
    this.index = wrapIndex(index, this.total);
    this.reflect();
  }

  private reflect() {
    const angle = this.total > 1 ? -135 + (this.index / (this.total - 1)) * 270 : 0;
    this.dial.style.transform = `rotate(${angle}deg)`;
  }

  private angleFromCenter(e: PointerEvent): number {
    const r = this.dial.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    // atan2(dx, -dy): straight up is 0°, clockwise positive.
    return clamp((Math.atan2(dx, -dy) * 180) / Math.PI, -135, 135);
  }

  private setFromAngle(e: PointerEvent) {
    if (this.total <= 1) return;
    const ang = this.angleFromCenter(e);
    const idx = Math.round(((ang + 135) / 270) * (this.total - 1));
    if (idx !== this.index) {
      this.setIndex(idx);
      this.onSet(this.index);
    }
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    this.setFromAngle(e);
    window.addEventListener("pointermove", this.onDrag);
    window.addEventListener("pointerup", this.onUp);
  };

  private onDrag = (e: PointerEvent) => this.setFromAngle(e);

  private onUp = () => {
    window.removeEventListener("pointermove", this.onDrag);
    window.removeEventListener("pointerup", this.onUp);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.setIndex(this.index + (e.deltaY > 0 ? 1 : -1));
    this.onSet(this.index);
  };
}
