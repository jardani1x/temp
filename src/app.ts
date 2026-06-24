// app.ts — the set's brain. Owns the GL context, the channel line-up and the
// CRT pipeline, runs the render loop, and turns every input (pointer, keyboard,
// knobs, buttons) into a change on screen.

import { createContext } from "./core/gl";
import { CRTPipeline } from "./post/crt";
import { Channel } from "./channels/Channel";
import { createChannels } from "./channels";
import { Pointer } from "./input";
import { Bezel, BezelAction } from "./ui/bezel";
import { showFatal } from "./ui/error";
import { Frame, FxSettings } from "./types";
import { wrapIndex } from "./util";

const MAX_BACKING_WIDTH = 2400; // cap the CRT pass cost on huge/hi-dpi displays

const DEFAULT_FX: FxSettings = {
  tracking: 0.18,
  glow: 0.55,
  scanline: 0.5,
  persist: 0.35,
  hue: 0,
};

export class App {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private pipeline: CRTPipeline;
  private channels: Channel[];
  private bezel: Bezel;
  private pointer: Pointer;

  private fx: FxSettings = { ...DEFAULT_FX };
  private index = 0;
  private width = 1;
  private height = 1;

  private clock = 0; // accumulated time (pauses with the loop)
  private lastNow = 0;
  private frameCount = 0;
  private running = true;
  private rafId = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    // The canvas can host a GL context while still detached from the DOM, which
    // lets us build the channels first and feed their real names to the bezel.
    this.canvas = document.createElement("canvas");
    this.canvas.className = "tv__canvas";
    this.gl = createContext(this.canvas);

    // Provisional size; the ResizeObserver corrects it as soon as we're laid out.
    this.applySize(960, 600);
    this.pipeline = new CRTPipeline(this.gl, this.width, this.height);
    this.channels = createChannels(this.gl, this.width, this.height);

    const stations = this.channels.map((c) => ({ name: c.name, tagline: c.tagline }));
    this.bezel = new Bezel(stations, this.fx, {
      onSetChannel: (i) => this.setChannel(i),
      onFx: (name, value) => this.setFx(name, value),
      onAction: (action) => this.onAction(action),
    });
    root.appendChild(this.bezel.root);
    this.bezel.screenMount.appendChild(this.canvas);

    this.channels[this.index].activate();
    this.bezel.setReadout(this.index, this.channels[this.index].name);

    this.pointer = new Pointer(this.canvas);
    this.bindEvents();
    this.resize(); // now that the screen is in the DOM, size it for real

    this.lastNow = performance.now();
    this.loop();
  }

  // --- sizing ---------------------------------------------------------------

  private measure(): { w: number; h: number } {
    const r = this.bezel.screenMount.getBoundingClientRect();
    const cssW = r.width || window.innerWidth * 0.9;
    const cssH = r.height || cssW * 0.6;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(1, Math.floor(cssW * dpr));
    let h = Math.max(1, Math.floor(cssH * dpr));
    if (w > MAX_BACKING_WIDTH) {
      h = Math.floor(h * (MAX_BACKING_WIDTH / w));
      w = MAX_BACKING_WIDTH;
    }
    return { w, h };
  }

  private applySize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  private resize() {
    const { w, h } = this.measure();
    if (w === this.width && h === this.height) return;
    this.applySize(w, h);
    this.pipeline.resize(w, h);
    for (const c of this.channels) c.resize(w, h);
  }

  // --- events ---------------------------------------------------------------

  private bindEvents() {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.bezel.screenMount);

    // Scrolling over the screen tunes between stations.
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.setChannel(this.index + (e.deltaY > 0 ? 1 : -1));
      },
      { passive: false },
    );

    window.addEventListener("keydown", this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (/^[1-9]$/.test(e.key)) {
      const i = parseInt(e.key, 10) - 1;
      if (i < this.channels.length) this.setChannel(i);
      return;
    }

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
      case "]":
        this.setChannel(this.index + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
      case "[":
        this.setChannel(this.index - 1);
        break;
      case " ":
        e.preventDefault();
        this.togglePause();
        break;
      case "p":
      case "P":
        this.onAction("photo");
        break;
      case "r":
      case "R":
        this.onAction("shuffle");
        break;
      case "s":
      case "S":
        this.onAction("reseed");
        break;
      case "h":
      case "H":
        this.onAction("hideUI");
        break;
      case "f":
      case "F":
        this.onAction("fullscreen");
        break;
      case "?":
        this.onAction("help");
        break;
    }
  };

  // --- actions --------------------------------------------------------------

  private setChannel(index: number) {
    const next = wrapIndex(index, this.channels.length);
    if (next === this.index) return;
    this.index = next;
    const channel = this.channels[next];
    channel.activate();
    this.pipeline.triggerChange();
    this.bezel.setReadout(next, channel.name);
    this.bezel.osd(`CH ${String(next + 1).padStart(2, "0")} · ${channel.name}`);
  }

  private setFx(name: keyof FxSettings, value: number) {
    this.fx[name] = value;
    this.bezel.osd(`${name.toUpperCase()} ${Math.round(value * 100)}`);
  }

  private onAction(action: BezelAction) {
    switch (action) {
      case "photo":
        this.photo();
        break;
      case "shuffle":
        this.fx.hue = Math.random();
        this.bezel.setFx("hue", this.fx.hue);
        this.bezel.osd(`PALETTE ${Math.round(this.fx.hue * 360)}°`);
        break;
      case "reseed":
        this.channels[this.index].activate();
        this.pipeline.triggerChange();
        this.bezel.osd("RESEED");
        break;
      case "hideUI": {
        const bare = this.bezel.toggleBare();
        this.bezel.osd(bare ? "SET HIDDEN · press H" : "SET VISIBLE");
        break;
      }
      case "fullscreen":
        this.toggleFullscreen();
        break;
      case "help":
        this.bezel.toggleHelp();
        break;
    }
  }

  private togglePause() {
    this.running = !this.running;
    this.bezel.osd(this.running ? "▶ PLAY" : "❚❚ PAUSE");
    if (this.running) {
      this.lastNow = performance.now();
      this.loop();
    } else {
      cancelAnimationFrame(this.rafId);
    }
  }

  private toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void this.bezel.root.requestFullscreen?.();
    }
  }

  private photo() {
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `cathode88-${this.channels[this.index].id}-${stamp}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
    this.bezel.flash();
    this.bezel.osd("PHOTO SAVED");
  }

  // --- loop -----------------------------------------------------------------

  private loop = () => {
    if (!this.running) return;
    try {
      this.renderFrame();
    } catch (err) {
      // A GL/shader error at draw time would otherwise just freeze the canvas;
      // stop the loop and surface it on screen instead.
      this.running = false;
      showFatal(this.root, err);
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderFrame() {
    const now = performance.now();
    const dt = Math.min((now - this.lastNow) / 1000, 0.05); // clamp big gaps
    this.lastNow = now;
    this.clock += dt;

    const frame: Frame = {
      time: this.clock,
      dt,
      frame: this.frameCount++,
      width: this.width,
      height: this.height,
      aspect: this.width / this.height,
      pointer: {
        x: this.pointer.x,
        y: this.pointer.y,
        down: this.pointer.down ? 1 : 0,
        vx: 0,
        vy: 0,
      },
      hue: this.fx.hue,
    };

    const channel = this.channels[this.index];
    channel.update(frame);
    channel.render(frame, this.pipeline.sceneTarget);
    this.pipeline.present(frame.time, dt, this.fx);
  }
}
