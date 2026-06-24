// channels/Channel.ts — the contract every station implements, plus a base
// class for the "stateless" stations that are just a single fragment shader.

import { GL } from "../core/gl";
import { Framebuffer } from "../core/framebuffer";
import { ShaderPass } from "../core/pass";
import { Frame } from "../types";

export interface Channel {
  readonly id: string;
  readonly name: string; // shown big on the readout, e.g. "SUNSET"
  readonly tagline: string; // shown in the OSD / marquee

  /** Re-seed / reset when the viewer tunes to this station. */
  activate(): void;
  /** Scene render resolution changed. */
  resize(width: number, height: number): void;
  /** Advance simulation state (no-op for stateless stations). */
  update(frame: Frame): void;
  /** Draw the current image into `target`. */
  render(frame: Frame, target: Framebuffer): void;
  dispose(): void;
}

/** The standard uniform set every channel shader may read (unused ones are
 *  silently ignored by ShaderPass). */
export function standardUniforms(frame: Frame) {
  return {
    uResolution: [frame.width, frame.height] as [number, number],
    uTime: frame.time,
    uMouse: [frame.pointer.x, frame.pointer.y] as [number, number],
    uMouseDown: frame.pointer.down,
    uHue: frame.hue,
    uAspect: frame.aspect,
  };
}

/** A station that is a single full-screen fragment shader with no state. */
export class ShaderChannel implements Channel {
  private pass: ShaderPass;

  constructor(
    gl: GL,
    readonly id: string,
    readonly name: string,
    readonly tagline: string,
    fragmentSource: string,
  ) {
    this.pass = new ShaderPass(gl, fragmentSource, id);
  }

  activate(): void {}
  resize(): void {}
  update(): void {}

  render(frame: Frame, target: Framebuffer): void {
    this.pass.render(target, standardUniforms(frame));
  }

  dispose(): void {
    this.pass.dispose();
  }
}
