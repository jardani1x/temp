// channels/reactionDiffusion.ts — the BLOOM station.
//
// A Gray-Scott reaction-diffusion system simulated on a float ping-pong texture
// at a fixed vertical resolution (width follows the aspect ratio). We run many
// small steps per frame so the pattern actually moves, then a display shader
// paints the chemical concentration as a glowing vaporwave gradient.

import { GL } from "../core/gl";
import { Framebuffer, PingPong } from "../core/framebuffer";
import { ShaderPass } from "../core/pass";
import { frag } from "../shaders";
import { Frame } from "../types";
import { Channel } from "./Channel";

const SIM_HEIGHT = 220; // simulation rows; columns follow the aspect ratio
const STEPS_PER_FRAME = 12;

// Classic Gray-Scott coral/mitosis parameters.
const FEED = 0.055;
const KILL = 0.062;
const DA = 1.0;
const DB = 0.5;
const DT = 1.0;

export class ReactionDiffusionChannel implements Channel {
  readonly id = "bloom";
  readonly name = "BLOOM";
  readonly tagline = "gray-scott reaction-diffusion · paint with the cursor";

  private seedPass: ShaderPass;
  private simPass: ShaderPass;
  private displayPass: ShaderPass;
  private state: PingPong;
  private simW = 0;
  private simH = 0;

  constructor(gl: GL, width: number, height: number) {
    this.seedPass = new ShaderPass(gl, frag.rdSeed, "rd:seed");
    this.simPass = new ShaderPass(gl, frag.rdSim, "rd:sim");
    this.displayPass = new ShaderPass(gl, frag.rdDisplay, "rd:display");

    [this.simW, this.simH] = dims(width, height);
    // RGBA16F is linear-filterable in WebGL2, giving us a smooth upscale.
    this.state = new PingPong(gl, this.simW, this.simH, {
      format: "rgba16f",
      filter: "linear",
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
    if (w === this.simW && h === this.simH) return;
    this.simW = w;
    this.simH = h;
    this.state.resize(w, h);
    this.seed();
  }

  update(frame: Frame): void {
    const texel: [number, number] = [1 / this.simW, 1 / this.simH];
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      this.simPass.render(this.state.write, {
        uState: this.state.read.texture,
        uTexel: texel,
        uFeed: FEED,
        uKill: KILL,
        uDA: DA,
        uDB: DB,
        uDt: DT,
        uMouse: [frame.pointer.x, frame.pointer.y],
        // Inject only on the first sub-step so a held cursor doesn't over-grow.
        uMouseDown: i === 0 ? frame.pointer.down : 0,
      });
      this.state.swap();
    }
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
  return [Math.max(1, Math.round(SIM_HEIGHT * aspect)), SIM_HEIGHT];
}
