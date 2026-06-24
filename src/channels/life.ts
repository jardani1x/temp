// channels/life.ts — the LIFE station.
//
// Conway's Game of Life on a texture grid. We step at ~20 Hz (every few frames)
// so it's watchable rather than a blur, and keep a decaying "heat" channel so
// recently-living cells leave glowing phosphor trails. Draw with the cursor to
// seed new colonies.

import { GL } from "../core/gl";
import { Framebuffer, PingPong } from "../core/framebuffer";
import { ShaderPass } from "../core/pass";
import { frag } from "../shaders";
import { Frame } from "../types";
import { Channel } from "./Channel";

const GRID_HEIGHT = 170; // cells tall; width follows the aspect ratio
const STEP_INTERVAL = 3; // advance the simulation every N frames

export class LifeChannel implements Channel {
  readonly id = "life";
  readonly name = "LIFE";
  readonly tagline = "conway's game of life · draw to seed colonies";

  private seedPass: ShaderPass;
  private simPass: ShaderPass;
  private displayPass: ShaderPass;
  private state: PingPong;
  private gridW = 0;
  private gridH = 0;
  private tick = 0;

  constructor(gl: GL, width: number, height: number) {
    this.seedPass = new ShaderPass(gl, frag.lifeSeed, "life:seed");
    this.simPass = new ShaderPass(gl, frag.lifeSim, "life:sim");
    this.displayPass = new ShaderPass(gl, frag.lifeDisplay, "life:display");

    [this.gridW, this.gridH] = dims(width, height);
    // NEAREST keeps cells crisp and pixelated; the heat trail + bloom add glow.
    this.state = new PingPong(gl, this.gridW, this.gridH, {
      format: "rgba8",
      filter: "nearest",
    });
    this.seed();
  }

  private seed() {
    this.seedPass.render(this.state.write, { uSeed: Math.random() * 1000 });
    this.state.swap();
  }

  activate(): void {
    this.seed();
  }

  resize(width: number, height: number): void {
    const [w, h] = dims(width, height);
    if (w === this.gridW && h === this.gridH) return;
    this.gridW = w;
    this.gridH = h;
    this.state.resize(w, h);
    this.seed();
  }

  update(frame: Frame): void {
    this.tick++;
    if (this.tick % STEP_INTERVAL !== 0) return;
    this.simPass.render(this.state.write, {
      uState: this.state.read.texture,
      uTexel: [1 / this.gridW, 1 / this.gridH],
      uMouse: [frame.pointer.x, frame.pointer.y],
      uMouseDown: frame.pointer.down,
    });
    this.state.swap();
  }

  render(frame: Frame, target: Framebuffer): void {
    this.displayPass.render(target, {
      uState: this.state.read.texture,
      uHue: frame.hue,
      uTime: frame.time,
    });
  }

  dispose(): void {
    this.seedPass.dispose();
    this.simPass.dispose();
    this.displayPass.dispose();
    this.state.dispose();
  }
}

function dims(width: number, height: number): [number, number] {
  const aspect = width / Math.max(1, height);
  return [Math.max(1, Math.round(GRID_HEIGHT * aspect)), GRID_HEIGHT];
}
